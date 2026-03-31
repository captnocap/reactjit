//! Expression codegen — primary expression parsing, object/array literals, variable type resolution.
//!
//! Extracted from exprgen.zig Parser struct. These are the largest parsing methods.

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;
const typegen = @import("typegen.zig");
const helpers = @import("exprgen_helpers.zig");
const exprgen = @import("exprgen.zig");
const Parser = exprgen.Parser;
const ExprType = exprgen.ExprType;

const Error = Parser.Error;
const TypedExpr = exprgen.TypedExpr;

pub fn parsePrimary(self: *Parser) Error!TypedExpr {
    switch (self.curKind()) {
        .number => {
            const text = self.curText();
            self.advance();
            // Determine if integer or float literal
            const is_float = std.mem.indexOf(u8, text, ".") != null;
            return .{
                .text = try self.alloc.dupe(u8, text),
                .ty = if (is_float) .float_lit else .int_lit,
            };
        },

        .string => {
            const text = self.curText();
            self.advance();
            // Single-quoted → double-quoted (escape inner double quotes)
            if (text.len >= 2 and text[0] == '\'') {
                const inner = text[1 .. text.len - 1];
                // Count inner double quotes to size the buffer
                var dq_count: usize = 0;
                for (inner) |ch| {
                    if (ch == '"') dq_count += 1;
                }
                var buf = try self.alloc.alloc(u8, text.len + dq_count);
                buf[0] = '"';
                var wi: usize = 1;
                for (inner) |ch| {
                    if (ch == '"') {
                        buf[wi] = '\\';
                        wi += 1;
                    }
                    buf[wi] = ch;
                    wi += 1;
                }
                buf[wi] = '"';
                return .{ .text = buf[0 .. wi + 1], .ty = .string_t };
            }
            return .{ .text = try self.alloc.dupe(u8, text), .ty = .string_t };
        },

        .template_literal => {
            const text = self.curText();
            self.advance();
            return .{
                .text = try helpers.emitTemplateLiteral(self.alloc, text),
                .ty = .string_t,
            };
        },

        .identifier => {
            const text = self.curText();

            // true / false
            if (std.mem.eql(u8, text, "true") or std.mem.eql(u8, text, "false")) {
                self.advance();
                return .{ .text = try self.alloc.dupe(u8, text), .ty = .bool_t };
            }

            // null → null
            if (std.mem.eql(u8, text, "null")) {
                self.advance();
                return .{ .text = try self.alloc.dupe(u8, "null"), .ty = .opt_f32_t };
            }
            // undefined → undefined (Zig uninitialized) in assignment, null elsewhere
            if (std.mem.eql(u8, text, "undefined")) {
                self.advance();
                if (self.context == .assignment) {
                    return .{ .text = try self.alloc.dupe(u8, "undefined"), .ty = .unknown };
                }
                return .{ .text = try self.alloc.dupe(u8, "null"), .ty = .opt_f32_t };
            }

            // switch-expression: switch (val) { case .a: expr; break; ... }
            if (std.mem.eql(u8, text, "switch")) {
                self.advance(); // skip 'switch'

                // Parse discriminant in parens
                self.expect(.lparen);
                const disc = try self.parseTernary();
                self.expect(.rparen);

                self.expect(.lbrace);

                var arms = std.ArrayListUnmanaged([]const u8){};
                var result_ty: ExprType = .unknown;

                while (self.curKind() != .rbrace and self.curKind() != .eof) {
                    if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "case")) {
                        self.advance(); // skip 'case'

                        // Parse case value (collect until : or |)
                        var case_val = std.ArrayListUnmanaged(u8){};
                        while (self.curKind() != .colon and self.curKind() != .pipe and self.curKind() != .eof) {
                            try case_val.appendSlice(self.alloc, self.curText());
                            self.advance();
                        }

                        // Check for |capture|
                        var arm_capture: ?[]const u8 = null;
                        if (self.curKind() == .colon) self.advance(); // skip :
                        if (self.curKind() == .pipe) {
                            self.advance(); // skip |
                            arm_capture = self.curText();
                            self.advance();
                            if (self.curKind() == .pipe) self.advance(); // skip |
                        }

                        // Parse arm value expression
                        const arm_val = try self.parseTernary();
                        if (result_ty == .unknown) result_ty = arm_val.ty;

                        // Skip break and semicolons
                        if (self.curKind() == .semicolon) self.advance();
                        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "break")) {
                            self.advance();
                            if (self.curKind() == .semicolon) self.advance();
                        }

                        // Convert case value to Zig enum
                        const cv = try self.alloc.dupe(u8, case_val.items);
                        // Check if it's a number literal
                        const is_num = cv.len > 0 and (cv[0] >= '0' and cv[0] <= '9');
                        const zig_case = if (is_num) cv
                            else if (std.mem.indexOf(u8, cv, ".")) |dot| blk: {
                                const variant = cv[dot + 1 ..];
                                break :blk try std.fmt.allocPrint(self.alloc, ".{s}", .{variant});
                            } else try std.fmt.allocPrint(self.alloc, ".{s}", .{cv});

                        if (arm_capture) |cap| {
                            try arms.append(self.alloc, try std.fmt.allocPrint(self.alloc, "{s} => |{s}| {s}", .{ zig_case, cap, arm_val.text }));
                        } else {
                            try arms.append(self.alloc, try std.fmt.allocPrint(self.alloc, "{s} => {s}", .{ zig_case, arm_val.text }));
                        }
                    } else if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "default")) {
                        self.advance(); // skip 'default'
                        if (self.curKind() == .colon) self.advance(); // skip :

                        const arm_val = try self.parseTernary();
                        if (result_ty == .unknown) result_ty = arm_val.ty;

                        if (self.curKind() == .semicolon) self.advance();
                        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "break")) {
                            self.advance();
                            if (self.curKind() == .semicolon) self.advance();
                        }

                        try arms.append(self.alloc, try std.fmt.allocPrint(self.alloc, "else => {s}", .{arm_val.text}));
                    } else {
                        self.advance(); // skip unknown token
                    }
                }
                self.expect(.rbrace);

                // Build switch expression
                var out = std.ArrayListUnmanaged(u8){};
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "switch ({s}) {{ ", .{disc.text}));
                for (arms.items, 0..) |arm, ai| {
                    if (ai > 0) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, arm);
                }
                try out.appendSlice(self.alloc, " }");

                return .{
                    .text = try self.alloc.dupe(u8, out.items),
                    .ty = result_ty,
                };
            }

            // if-expression: if (cond) then_val else else_val
            // Also handles: if (optional) |capture| then_val else else_val
            if (std.mem.eql(u8, text, "if")) {
                self.advance(); // skip 'if'

                // Parse condition in parens
                self.expect(.lparen);
                const cond = try self.parseTernary();
                self.expect(.rparen);

                // Check for |capture|
                var capture: ?[]const u8 = null;
                if (self.curKind() == .pipe) {
                    self.advance(); // skip |
                    capture = self.curText();
                    self.advance(); // skip name
                    if (self.curKind() == .pipe) self.advance(); // skip |
                }

                // Parse then-value
                const then_val = try self.parseTernary();

                // Expect 'else'
                var else_val: ?[]const u8 = null;
                if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "else")) {
                    self.advance(); // skip 'else'
                    const ev = try self.parseTernary();
                    else_val = ev.text;
                }

                if (capture) |cap| {
                    if (else_val) |ev| {
                        return .{
                            .text = try std.fmt.allocPrint(self.alloc, "if ({s}) |{s}| {s} else {s}", .{ cond.text, cap, then_val.text, ev }),
                            .ty = then_val.ty,
                        };
                    }
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "if ({s}) |{s}| {s}", .{ cond.text, cap, then_val.text }),
                        .ty = then_val.ty,
                    };
                }

                if (else_val) |ev| {
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "if ({s}) {s} else {s}", .{ cond.text, then_val.text, ev }),
                        .ty = then_val.ty,
                    };
                }
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "if ({s}) {s}", .{ cond.text, then_val.text }),
                    .ty = then_val.ty,
                };
            }

            // comptime prefix — passthrough to Zig
            if (std.mem.eql(u8, text, "comptime")) {
                self.advance();
                const inner = try self.parseTernary();
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "comptime {s}", .{inner.text}),
                    .ty = inner.ty,
                };
            }

            // try prefix — passthrough to Zig
            if (std.mem.eql(u8, text, "try")) {
                self.advance();
                const inner = try self.parseTernary();
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "try {s}", .{inner.text}),
                    .ty = inner.ty,
                };
            }

            // new Array(N) → std.mem.zeroes([N]f32)
            if (std.mem.eql(u8, text, "new")) {
                self.advance();
                if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "Array")) {
                    self.advance();
                    self.expect(.lparen);
                    const size = self.curText();
                    self.advance();
                    self.expect(.rparen);
                    return .{
                        .text = try std.fmt.allocPrint(self.alloc, "std.mem.zeroes([{s}]f32)", .{size}),
                        .ty = .unknown,
                    };
                }
                return .{ .text = try self.alloc.dupe(u8, "new"), .ty = .unknown };
            }

            // PascalCase.Variant → .variant (enum access)
            // But NOT PascalCase.method() (namespace call like Math.abs)
            if (text.len > 0 and text[0] >= 'A' and text[0] <= 'Z') {
                if (self.pos.* + 2 < self.lex.count and
                    self.lex.get(self.pos.* + 1).kind == .dot and
                    self.lex.get(self.pos.* + 2).kind == .identifier)
                {
                    // Check if the member is followed by ( → method call, not enum
                    const after_member = if (self.pos.* + 3 < self.lex.count)
                        self.lex.get(self.pos.* + 3).kind
                    else
                        TokenKind.eof;

                    if (after_member != .lparen) {
                        // Enum access: FlexDirection.Row → .row
                        self.advance(); // skip type name
                        self.advance(); // skip .
                        const variant = self.curText();
                        self.advance(); // skip variant
                        const snake = try helpers.camelToSnake(self.alloc, variant);
                        // Lowercase the first char for Zig enum convention
                        const lowered = try helpers.lowerFirst(self.alloc, snake);
                        return .{
                            .text = try std.fmt.allocPrint(self.alloc, ".{s}", .{lowered}),
                            .ty = .enum_t,
                        };
                    }
                }
                // PascalCase identifier without enum access — could be type, namespace, or ALL_CAPS const
                self.advance();
                const upper_ty = self.resolveVarType(text);
                return .{ .text = try self.alloc.dupe(u8, text), .ty = upper_ty };
            }

            // Regular identifier — keep original name, escape Zig keywords.
            // Exception: 'error' followed by '.' is the error namespace, not a variable.
            self.advance();
            const is_error_ns = std.mem.eql(u8, text, "error") and self.curKind() == .dot;
            const zig_name = if (!is_error_ns and typegen.isZigKeyword(text))
                try std.fmt.allocPrint(self.alloc, "@\"{s}\"", .{text})
            else
                try self.alloc.dupe(u8, text);

            // Look up variable type in the registry
            const var_ty = self.resolveVarType(text);

            return .{ .text = zig_name, .ty = var_ty };
        },

        // Parenthesized expression
        .lparen => {
            self.advance();
            const saved = self.context;
            self.context = .value;
            const inner = try self.parseTernary();
            self.context = saved;
            self.expect(.rparen);
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "({s})", .{inner.text}),
                .ty = inner.ty,
            };
        },

        // Anonymous struct/tuple literal: .{ x, y } or .{ .field = val }
        .dot => {
            if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .lbrace) {
                self.advance(); // skip .
                const obj = try self.parseObjectLiteral();
                return .{ .text = obj, .ty = .struct_t };
            }
            // Bare .variant (enum literal) or .@"escaped" (Zig escaped enum)
            self.advance();
            if (self.curKind() == .identifier) {
                const variant = self.curText();
                self.advance();
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, ".{s}", .{variant}),
                    .ty = .enum_t,
                };
            }
            if (self.curKind() == .builtin) {
                // .@"2d" etc — pass through as-is
                const escaped = self.curText();
                self.advance();
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, ".{s}", .{escaped}),
                    .ty = .enum_t,
                };
            }
            return .{ .text = try self.alloc.dupe(u8, "."), .ty = .unknown };
        },

        // Address-of: &x → &x (unary prefix)
        .ampersand => {
            self.advance();
            const inner = try self.parsePostfix();
            return .{
                .text = try std.fmt.allocPrint(self.alloc, "&{s}", .{inner.text}),
                .ty = .ptr_t,
            };
        },

        // Object literal: { x: 0, y: 0 } → .{ .x = 0, .y = 0 }
        .lbrace => {
            const text = try self.parseObjectLiteral();
            return .{ .text = text, .ty = .struct_t };
        },

        // Array literal: [a, b, c] → .{ a, b, c }
        .lbracket => {
            const text = try self.parseArrayLiteral();
            return .{ .text = text, .ty = .unknown };
        },

        // Zig builtins: @bitCast(x), @memcpy(dst, src), @intCast(v), etc.
        .builtin => {
            const name = self.curText();
            self.advance();
            if (self.curKind() == .lparen) {
                self.advance(); // consume (
                var args = std.ArrayListUnmanaged([]const u8){};
                const saved = self.context;
                self.context = .argument;
                while (self.curKind() != .rparen and self.curKind() != .eof) {
                    const arg = try self.parseTernary();
                    try args.append(self.alloc, arg.text);
                    if (self.curKind() == .comma) self.advance();
                }
                self.context = saved;
                self.expect(.rparen);
                const joined = try helpers.joinArgs(self.alloc, args.items);
                // Infer return type for common builtins
                const ret_ty: ExprType = if (std.mem.eql(u8, name, "@floatFromInt") or std.mem.eql(u8, name, "@floatCast"))
                    .f32_t
                else if (std.mem.eql(u8, name, "@intFromFloat") or std.mem.eql(u8, name, "@intCast"))
                    .usize_t
                else if (std.mem.eql(u8, name, "@intFromBool"))
                    .usize_t
                else if (std.mem.eql(u8, name, "@abs") or std.mem.eql(u8, name, "@max") or
                    std.mem.eql(u8, name, "@min") or std.mem.eql(u8, name, "@floor") or
                    std.mem.eql(u8, name, "@ceil") or std.mem.eql(u8, name, "@sqrt"))
                    .f32_t
                else
                    .unknown;
                return .{
                    .text = try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ name, joined }),
                    .ty = ret_ty,
                };
            }
            // Bare builtin without parens (e.g., @import used as value)
            return .{ .text = try self.alloc.dupe(u8, name), .ty = .unknown };
        },

        else => {
            if (self.curKind() != .eof) {
                const text = self.curText();
                self.advance();
                return .{ .text = try self.alloc.dupe(u8, text), .ty = .unknown };
            }
            return .{ .text = try self.alloc.dupe(u8, ""), .ty = .unknown };
        },
    }
}

/// Resolve the type of a variable from the registry or by name heuristics.
pub fn resolveVarType(self: *Parser, name: []const u8) ExprType {
    // First check the explicit registry
    if (self.var_types) |vt| {
        if (vt.get(name)) |ty| return ty;
    }

    // Heuristic: well-known variable names in layout code
    // Short loop vars (i, j, k) → usize
    if (name.len == 1 and name[0] >= 'a' and name[0] <= 'z') {
        return switch (name[0]) {
            'i', 'j', 'k', 'n' => .usize_t,
            else => .unknown,
        };
    }

    // camelCase names that suggest counts/indices → usize
    if (helpers.containsAny(name, &.{
        "count", "Count", "idx", "Idx", "index", "Index",
        "num", "Num", "Lines", "Items", "Passes",
        "depth", "Depth", "Len", "Start", "start",
    })) return .usize_t;

    // ALL_CAPS → usize (constants like LAYOUT_BUDGET)
    if (helpers.isAllCaps(name) and name.len > 1) return .usize_t;

    return .unknown;
}

pub fn parseObjectLiteral(self: *Parser) Error![]const u8 {
    self.advance(); // consume {
    var fields = std.ArrayListUnmanaged([]const u8){};

    while (self.curKind() != .rbrace and self.curKind() != .eof) {
        // Zig-style: .field = value (dot-prefixed field names)
        if (self.curKind() == .dot and self.pos.* + 1 < self.lex.count and
            self.lex.get(self.pos.* + 1).kind == .identifier)
        {
            self.advance(); // skip .
            const key = self.curText();
            self.advance(); // skip field name
            if (self.curKind() == .equals) {
                self.advance(); // skip =
                const saved = self.context;
                self.context = .argument;
                const val = try self.parseTernary();
                self.context = saved;
                try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s} = {s}", .{ key, val.text }));
            } else {
                // .field (shorthand)
                try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s}", .{key}));
            }
        } else if (self.curKind() == .identifier) {
            const key = self.curText();

            if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .colon) {
                // key: value (TS-style) — identifier followed by :
                self.advance(); // skip key
                self.advance(); // skip :
                const saved = self.context;
                self.context = .argument;
                const val = try self.parseTernary();
                self.context = saved;
                const snake = try helpers.camelToSnake(self.alloc, key);
                try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s} = {s}", .{ snake, val.text }));
            } else if (self.pos.* + 1 < self.lex.count and
                (self.lex.get(self.pos.* + 1).kind == .dot or
                self.lex.get(self.pos.* + 1).kind == .lbracket or
                self.lex.get(self.pos.* + 1).kind == .lparen))
            {
                // Expression: identifier followed by . or [ or ( → positional value
                const saved3 = self.context;
                self.context = .argument;
                const val = try self.parseTernary();
                self.context = saved3;
                try fields.append(self.alloc, val.text);
            } else {
                self.advance();
                // Check for comma/rbrace → shorthand: { r } → .{ .r = r }
                if (self.curKind() == .comma or self.curKind() == .rbrace) {
                    const snake = try helpers.camelToSnake(self.alloc, key);
                    try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s} = {s}", .{ snake, key }));
                } else {
                    // Unknown pattern — treat as positional with already-consumed token
                    try fields.append(self.alloc, try self.alloc.dupe(u8, key));
                }
            }
        } else {
            // Positional value (tuple literal): .{ expr, expr }
            const saved2 = self.context;
            self.context = .argument;
            const val = try self.parseTernary();
            self.context = saved2;
            try fields.append(self.alloc, val.text);
        }
        if (self.curKind() == .comma) self.advance();
    }
    self.expect(.rbrace);
    return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{try helpers.joinArgs(self.alloc, fields.items)});
}
pub fn parseArrayLiteral(self: *Parser) Error![]const u8 {
    self.advance(); // consume [
    var elems = std.ArrayListUnmanaged([]const u8){};
    const saved = self.context;
    self.context = .argument;
    while (self.curKind() != .rbracket and self.curKind() != .eof) {
        const val = try self.parseTernary();
        try elems.append(self.alloc, val.text);
        if (self.curKind() == .comma) self.advance();
    }
    self.context = saved;
    self.expect(.rbracket);
    return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{try helpers.joinArgs(self.alloc, elems.items)});
}
