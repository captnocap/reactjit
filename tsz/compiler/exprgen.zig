//! Expression codegen — translates TypeScript expressions to Zig expressions.
//!
//! Recursive descent parser with operator precedence. Called by stmtgen
//! for every expression position (assignments, conditions, return values, arguments).
//!
//!   a.b.c           → a.b.c (with camelCase → snake_case on fields)
//!   a ?? b          → a orelse b
//!   val === null    → val == null
//!   Math.abs(x)     → @abs(x)
//!   { x: 0, y: 0 } → .{ .x = 0, .y = 0 }
//!   cond ? a : b    → if (cond) a else b

const std = @import("std");
const lexer_mod = @import("lexer.zig");
const Lexer = lexer_mod.Lexer;
const Token = lexer_mod.Token;
const TokenKind = lexer_mod.TokenKind;

pub const ExprContext = enum {
    value, // general expression
    condition, // inside if/while — result should be bool-compatible
    assignment, // right side of =
    return_val, // after return keyword
    argument, // function call argument (stops at , or ) at depth 0)
};

/// Parse and emit a Zig expression from the current token position.
/// Advances pos past the consumed tokens.
/// Stops at context-appropriate terminators (semicolon, comma, closing delimiters).
pub fn emitExpression(
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    context: ExprContext,
) ![]const u8 {
    var p = Parser{
        .alloc = alloc,
        .lex = lex,
        .source = source,
        .pos = pos,
        .context = context,
    };
    const result = try p.parseTernary();

    // In condition context, a bare identifier/property access implies != null check
    if (context == .condition and isBareAccess(result)) {
        return try std.fmt.allocPrint(alloc, "{s} != null", .{result});
    }

    return result;
}

/// Returns true if the string looks like a bare identifier or property chain
/// (e.g. "node", "node.text", "node.style.width") — no operators, parens, etc.
fn isBareAccess(s: []const u8) bool {
    if (s.len == 0) return false;
    for (s) |ch| {
        switch (ch) {
            'a'...'z', 'A'...'Z', '0'...'9', '_', '.' => {},
            else => return false,
        }
    }
    return true;
}

const Parser = struct {
    alloc: std.mem.Allocator,
    lex: *const Lexer,
    source: []const u8,
    pos: *u32,
    context: ExprContext,

    fn cur(self: *Parser) Token {
        return self.lex.get(self.pos.*);
    }

    fn curKind(self: *Parser) TokenKind {
        return self.cur().kind;
    }

    fn curText(self: *Parser) []const u8 {
        return self.cur().text(self.source);
    }

    fn advance(self: *Parser) void {
        if (self.curKind() != .eof) {
            self.pos.* += 1;
        }
    }

    fn expect(self: *Parser, kind: TokenKind) void {
        if (self.curKind() == kind) {
            self.advance();
        }
    }

    // ── Precedence 1: Ternary (cond ? a : b → if (cond) a else b) ──

    const Error = std.mem.Allocator.Error;

    fn parseTernary(self: *Parser) Error![]const u8 {
        const cond = try self.parseLogicalOr();
        if (self.curKind() == .question) {
            self.advance(); // consume ?
            const then_val = try self.parseTernary();
            self.expect(.colon);
            const else_val = try self.parseTernary();
            return try std.fmt.allocPrint(self.alloc, "if ({s}) {s} else {s}", .{ cond, then_val, else_val });
        }
        return cond;
    }

    // ── Precedence 2: Logical OR (|| → or) ─────────────────────────

    fn parseLogicalOr(self: *Parser) Error![]const u8 {
        var left = try self.parseLogicalAnd();
        while (self.curKind() == .pipe_pipe) {
            self.advance();
            const right = try self.parseLogicalAnd();
            left = try std.fmt.allocPrint(self.alloc, "({s} or {s})", .{ left, right });
        }
        return left;
    }

    // ── Precedence 3: Logical AND (&& → and) ──────────────────────

    fn parseLogicalAnd(self: *Parser) Error![]const u8 {
        var left = try self.parseNullishCoalescing();
        while (self.curKind() == .amp_amp) {
            self.advance();
            const right = try self.parseNullishCoalescing();
            left = try std.fmt.allocPrint(self.alloc, "({s} and {s})", .{ left, right });
        }
        return left;
    }

    // ── Precedence 4: Nullish coalescing (?? → orelse) ─────────────

    fn parseNullishCoalescing(self: *Parser) Error![]const u8 {
        var left = try self.parseEquality();
        while (self.curKind() == .question_question) {
            self.advance();
            const right = try self.parseEquality();
            left = try std.fmt.allocPrint(self.alloc, "{s} orelse {s}", .{ left, right });
        }
        return left;
    }

    // ── Precedence 5: Equality (===, !==) ──────────────────────────

    fn parseEquality(self: *Parser) Error![]const u8 {
        var left = try self.parseComparison();
        while (self.curKind() == .eq_eq or self.curKind() == .not_eq) {
            const is_eq = self.curKind() == .eq_eq;
            self.advance();

            // null/undefined on RHS
            if (self.curKind() == .identifier) {
                const rhs = self.curText();
                if (std.mem.eql(u8, rhs, "null") or std.mem.eql(u8, rhs, "undefined")) {
                    self.advance();
                    const op = if (is_eq) "==" else "!=";
                    return try std.fmt.allocPrint(self.alloc, "({s} {s} null)", .{ left, op });
                }
            }

            // String literal on RHS → std.mem.eql
            if (self.curKind() == .string) {
                const str_text = self.curText();
                self.advance();
                if (is_eq) {
                    return try std.fmt.allocPrint(self.alloc, "std.mem.eql(u8, {s}, {s})", .{ left, str_text });
                } else {
                    return try std.fmt.allocPrint(self.alloc, "!std.mem.eql(u8, {s}, {s})", .{ left, str_text });
                }
            }

            const right = try self.parseComparison();
            const op = if (is_eq) "==" else "!=";
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    // ── Precedence 6: Comparison (<, >, <=, >=) ────────────────────

    fn parseComparison(self: *Parser) Error![]const u8 {
        var left = try self.parseAdditive();
        while (true) {
            const op: []const u8 = switch (self.curKind()) {
                .lt => "<",
                .gt => ">",
                .lt_eq => "<=",
                .gt_eq => ">=",
                else => break,
            };
            self.advance();
            const right = try self.parseAdditive();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    // ── Precedence 7: Additive (+, -) ──────────────────────────────

    fn parseAdditive(self: *Parser) Error![]const u8 {
        var left = try self.parseMultiplicative();
        while (self.curKind() == .plus or self.curKind() == .minus) {
            const op: []const u8 = if (self.curKind() == .plus) "+" else "-";
            self.advance();
            const right = try self.parseMultiplicative();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    // ── Precedence 8: Multiplicative (*, /, %) ─────────────────────

    fn parseMultiplicative(self: *Parser) Error![]const u8 {
        var left = try self.parseUnary();
        while (self.curKind() == .star or self.curKind() == .slash or self.curKind() == .percent) {
            const op: []const u8 = switch (self.curKind()) {
                .star => "*",
                .slash => "/",
                .percent => "%",
                else => unreachable,
            };
            self.advance();
            const right = try self.parseUnary();
            left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
        }
        return left;
    }

    // ── Precedence 9: Unary (!, -, typeof) ─────────────────────────

    fn parseUnary(self: *Parser) Error![]const u8 {
        if (self.curKind() == .bang) {
            self.advance();
            const operand = try self.parseUnary();
            return try std.fmt.allocPrint(self.alloc, "!{s}", .{operand});
        }
        if (self.curKind() == .minus) {
            self.advance();
            const operand = try self.parseUnary();
            return try std.fmt.allocPrint(self.alloc, "-{s}", .{operand});
        }
        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "typeof")) {
            self.advance();
            return try self.parsePostfix();
        }
        return try self.parsePostfix();
    }

    // ── Precedence 10: Postfix / Call / Member access ──────────────

    fn parsePostfix(self: *Parser) Error![]const u8 {
        var left = try self.parsePrimary();

        while (true) {
            switch (self.curKind()) {
                // Property access: a.b
                .dot => {
                    self.advance();
                    if (self.curKind() != .identifier) break;
                    const prop = self.curText();
                    self.advance();

                    // .length → .len
                    if (std.mem.eql(u8, prop, "length")) {
                        left = try std.fmt.allocPrint(self.alloc, "{s}.len", .{left});
                        continue;
                    }

                    // .slice(a, b) → [@intCast(a)..@intCast(b)]
                    if (std.mem.eql(u8, prop, "slice") and self.curKind() == .lparen) {
                        self.advance(); // (
                        const saved = self.context;
                        self.context = .argument;
                        const arg_a = try self.parseTernary();
                        self.expect(.comma);
                        const arg_b = try self.parseTernary();
                        self.context = saved;
                        self.expect(.rparen);
                        left = try std.fmt.allocPrint(self.alloc, "{s}[@intCast({s})..@intCast({s})]", .{ left, arg_a, arg_b });
                        continue;
                    }

                    // Regular property — camelCase → snake_case
                    const snake = try camelToSnake(self.alloc, prop);
                    left = try std.fmt.allocPrint(self.alloc, "{s}.{s}", .{ left, snake });
                },

                // Index access: a[i] → a[@intCast(i)]
                .lbracket => {
                    self.advance();
                    const saved = self.context;
                    self.context = .value;
                    const idx = try self.parseTernary();
                    self.context = saved;
                    self.expect(.rbracket);
                    left = try std.fmt.allocPrint(self.alloc, "{s}[@intCast({s})]", .{ left, idx });
                },

                // Function call: a(x, y)
                .lparen => {
                    left = try self.parseCallArgs(left);
                },

                // Postfix ++
                .plus => {
                    if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .plus) {
                        self.advance();
                        self.advance();
                        left = try std.fmt.allocPrint(self.alloc, "blk: {{ const tmp = {s}; {s} += 1; break :blk tmp; }}", .{ left, left });
                    } else break;
                },

                // Postfix --
                .minus => {
                    if (self.pos.* + 1 < self.lex.count and self.lex.get(self.pos.* + 1).kind == .minus) {
                        self.advance();
                        self.advance();
                        left = try std.fmt.allocPrint(self.alloc, "blk: {{ const tmp = {s}; {s} -= 1; break :blk tmp; }}", .{ left, left });
                    } else break;
                },

                // Type assertion: x as number → @as(f32, x)
                .identifier => {
                    if (std.mem.eql(u8, self.curText(), "as")) {
                        self.advance();
                        const type_name = self.curText();
                        self.advance();
                        left = try std.fmt.allocPrint(self.alloc, "@as({s}, {s})", .{ mapTsType(type_name), left });
                    } else break;
                },

                else => break,
            }
        }

        return left;
    }

    fn parseCallArgs(self: *Parser, callee: []const u8) Error![]const u8 {
        self.advance(); // consume (

        var args = std.ArrayListUnmanaged([]const u8){};
        const saved = self.context;
        self.context = .argument;

        while (self.curKind() != .rparen and self.curKind() != .eof) {
            const arg = try self.parseTernary();
            try args.append(self.alloc, arg);
            if (self.curKind() == .comma) self.advance();
        }
        self.context = saved;
        self.expect(.rparen);

        const joined = try joinArgs(self.alloc, args.items);

        // Math builtins
        if (callee.len > 5 and std.mem.eql(u8, callee[0..5], "Math.")) {
            const method = callee[5..];
            const builtin: ?[]const u8 = if (std.mem.eql(u8, method, "abs"))
                "@abs"
            else if (std.mem.eql(u8, method, "max"))
                "@max"
            else if (std.mem.eql(u8, method, "min"))
                "@min"
            else if (std.mem.eql(u8, method, "floor"))
                "@floor"
            else if (std.mem.eql(u8, method, "ceil"))
                "@ceil"
            else if (std.mem.eql(u8, method, "sqrt"))
                "@sqrt"
            else
                null;

            if (builtin) |b| {
                return try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ b, joined });
            }
        }

        return try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ callee, joined });
    }

    // ── Precedence 11: Primary ─────────────────────────────────────

    fn parsePrimary(self: *Parser) Error![]const u8 {
        switch (self.curKind()) {
            .number => {
                const text = self.curText();
                self.advance();
                return try self.alloc.dupe(u8, text);
            },

            .string => {
                const text = self.curText();
                self.advance();
                // Single-quoted → double-quoted
                if (text.len >= 2 and text[0] == '\'') {
                    var buf = try self.alloc.alloc(u8, text.len);
                    buf[0] = '"';
                    @memcpy(buf[1 .. buf.len - 1], text[1 .. text.len - 1]);
                    buf[buf.len - 1] = '"';
                    return buf;
                }
                return try self.alloc.dupe(u8, text);
            },

            .template_literal => {
                const text = self.curText();
                self.advance();
                return try emitTemplateLiteral(self.alloc, text);
            },

            .identifier => {
                const text = self.curText();

                // true / false
                if (std.mem.eql(u8, text, "true") or std.mem.eql(u8, text, "false")) {
                    self.advance();
                    return try self.alloc.dupe(u8, text);
                }

                // null / undefined → null
                if (std.mem.eql(u8, text, "null") or std.mem.eql(u8, text, "undefined")) {
                    self.advance();
                    return try self.alloc.dupe(u8, "null");
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
                        return try std.fmt.allocPrint(self.alloc, "std.mem.zeroes([{s}]f32)", .{size});
                    }
                    return try self.alloc.dupe(u8, "new");
                }

                // Regular identifier — no camelToSnake (only after .)
                self.advance();
                return try self.alloc.dupe(u8, text);
            },

            // Parenthesized expression
            .lparen => {
                self.advance();
                const saved = self.context;
                self.context = .value;
                const inner = try self.parseTernary();
                self.context = saved;
                self.expect(.rparen);
                return try std.fmt.allocPrint(self.alloc, "({s})", .{inner});
            },

            // Object literal: { x: 0, y: 0 } → .{ .x = 0, .y = 0 }
            .lbrace => return try self.parseObjectLiteral(),

            // Array literal: [a, b, c] → .{ a, b, c }
            .lbracket => return try self.parseArrayLiteral(),

            else => {
                if (self.curKind() != .eof) {
                    const text = self.curText();
                    self.advance();
                    return try self.alloc.dupe(u8, text);
                }
                return try self.alloc.dupe(u8, "");
            },
        }
    }

    fn parseObjectLiteral(self: *Parser) Error![]const u8 {
        self.advance(); // consume {
        var fields = std.ArrayListUnmanaged([]const u8){};

        while (self.curKind() != .rbrace and self.curKind() != .eof) {
            if (self.curKind() == .identifier) {
                const key = self.curText();
                self.advance();

                if (self.curKind() == .colon) {
                    // key: value
                    self.advance();
                    const saved = self.context;
                    self.context = .argument;
                    const val = try self.parseTernary();
                    self.context = saved;
                    const snake = try camelToSnake(self.alloc, key);
                    try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s} = {s}", .{ snake, val }));
                } else {
                    // Shorthand: { r } → .{ .r = r }
                    const snake = try camelToSnake(self.alloc, key);
                    try fields.append(self.alloc, try std.fmt.allocPrint(self.alloc, ".{s} = {s}", .{ snake, key }));
                }
            } else {
                self.advance();
            }

            if (self.curKind() == .comma) self.advance();
        }
        self.expect(.rbrace);

        return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{try joinArgs(self.alloc, fields.items)});
    }

    fn parseArrayLiteral(self: *Parser) Error![]const u8 {
        self.advance(); // consume [
        var elems = std.ArrayListUnmanaged([]const u8){};
        const saved = self.context;
        self.context = .argument;

        while (self.curKind() != .rbracket and self.curKind() != .eof) {
            try elems.append(self.alloc, try self.parseTernary());
            if (self.curKind() == .comma) self.advance();
        }
        self.context = saved;
        self.expect(.rbracket);

        return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{try joinArgs(self.alloc, elems.items)});
    }
};

// ── Helpers ────────────────────────────────────────────────────────────

fn joinArgs(alloc: std.mem.Allocator, args: []const []const u8) ![]const u8 {
    if (args.len == 0) return "";
    var total: usize = 0;
    for (args, 0..) |arg, i| {
        total += arg.len;
        if (i + 1 < args.len) total += 2;
    }
    var buf = try alloc.alloc(u8, total);
    var off: usize = 0;
    for (args, 0..) |arg, i| {
        @memcpy(buf[off .. off + arg.len], arg);
        off += arg.len;
        if (i + 1 < args.len) {
            buf[off] = ',';
            buf[off + 1] = ' ';
            off += 2;
        }
    }
    return buf;
}

fn mapTsType(ts_type: []const u8) []const u8 {
    if (std.mem.eql(u8, ts_type, "number")) return "f32";
    if (std.mem.eql(u8, ts_type, "i64")) return "i64";
    if (std.mem.eql(u8, ts_type, "i32")) return "i32";
    if (std.mem.eql(u8, ts_type, "u32")) return "u32";
    if (std.mem.eql(u8, ts_type, "u8")) return "u8";
    if (std.mem.eql(u8, ts_type, "f64")) return "f64";
    if (std.mem.eql(u8, ts_type, "boolean")) return "bool";
    if (std.mem.eql(u8, ts_type, "string")) return "[]const u8";
    return ts_type;
}

/// Convert camelCase to snake_case.
/// "flexDirection" → "flex_direction", "paddingLeft" → "padding_left"
pub fn camelToSnake(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
    if (input.len == 0) return try alloc.dupe(u8, "");

    // Count uppercase letters after first char to size the output
    var extra: usize = 0;
    for (input[1..]) |ch| {
        if (ch >= 'A' and ch <= 'Z') extra += 1;
    }
    if (extra == 0) return try alloc.dupe(u8, input);

    var buf = try alloc.alloc(u8, input.len + extra);
    var j: usize = 0;
    buf[0] = input[0];
    j = 1;
    for (input[1..]) |ch| {
        if (ch >= 'A' and ch <= 'Z') {
            buf[j] = '_';
            buf[j + 1] = ch - 'A' + 'a';
            j += 2;
        } else {
            buf[j] = ch;
            j += 1;
        }
    }
    return buf[0..j];
}

/// Convert `template ${expr}` to std.fmt.comptimePrint("template {s}", .{ expr })
fn emitTemplateLiteral(alloc: std.mem.Allocator, raw: []const u8) ![]const u8 {
    if (raw.len < 2) return try alloc.dupe(u8, "\"\"");
    const inner = raw[1 .. raw.len - 1];

    // No interpolations → simple string
    if (std.mem.indexOf(u8, inner, "${") == null) {
        return try std.fmt.allocPrint(alloc, "\"{s}\"", .{inner});
    }

    var parts: std.ArrayListUnmanaged(u8) = .{};
    var args: std.ArrayListUnmanaged([]const u8) = .{};

    try parts.appendSlice(alloc, "std.fmt.comptimePrint(\"");

    var i: usize = 0;
    while (i < inner.len) {
        if (i + 1 < inner.len and inner[i] == '$' and inner[i + 1] == '{') {
            try parts.appendSlice(alloc, "{s}");
            i += 2;
            const expr_start = i;
            var depth: u32 = 1;
            while (i < inner.len and depth > 0) {
                if (inner[i] == '{') depth += 1;
                if (inner[i] == '}') depth -= 1;
                if (depth > 0) i += 1;
            }
            try args.append(alloc, try alloc.dupe(u8, inner[expr_start..i]));
            if (i < inner.len) i += 1;
        } else {
            try parts.append(alloc, inner[i]);
            i += 1;
        }
    }

    try parts.appendSlice(alloc, "\", .{ ");
    for (args.items, 0..) |arg, idx| {
        try parts.appendSlice(alloc, arg);
        if (idx + 1 < args.items.len) try parts.appendSlice(alloc, ", ");
    }
    try parts.appendSlice(alloc, " })");

    return try alloc.dupe(u8, parts.items);
}

// ── Tests ──────────────────────────────────────────────────────────────

fn testExpr(input: []const u8, expected: []const u8) !void {
    var lex = Lexer.init(input);
    lex.tokenize();
    var pos: u32 = 0;
    const result = try emitExpression(std.testing.allocator, &lex, input, &pos, .value);
    defer std.testing.allocator.free(result);
    try std.testing.expectEqualStrings(expected, result);
}

fn testExprCtx(input: []const u8, expected: []const u8, ctx: ExprContext) !void {
    var lex = Lexer.init(input);
    lex.tokenize();
    var pos: u32 = 0;
    const result = try emitExpression(std.testing.allocator, &lex, input, &pos, ctx);
    defer std.testing.allocator.free(result);
    try std.testing.expectEqualStrings(expected, result);
}

test "property access with snake_case" {
    try testExpr("node.flexDirection", "node.flex_direction");
}

test "chained property access" {
    try testExpr("node.style.paddingLeft", "node.style.padding_left");
}

test "length to len" {
    try testExpr("node.children.length", "node.children.len");
    try testExpr("node.text.length", "node.text.len");
}

test "null coalescing" {
    try testExpr("a ?? b", "a orelse b");
}

test "null coalescing with property" {
    try testExpr("s.paddingLeft ?? s.padding", "s.padding_left orelse s.padding");
}

test "null comparison" {
    try testExpr("val === null", "(val == null)");
    try testExpr("val !== null", "(val != null)");
    try testExpr("x !== undefined", "(x != null)");
}

test "object literal" {
    try testExpr("{ x: 0, y: 1 }", ".{ .x = 0, .y = 1 }");
}

test "object literal shorthand" {
    try testExpr("{ r, g, b }", ".{ .r = r, .g = g, .b = b }");
}

test "object literal mixed" {
    try testExpr("{ r, g, b, a: 255 }", ".{ .r = r, .g = g, .b = b, .a = 255 }");
}

test "Math builtin" {
    try testExpr("Math.abs(x)", "@abs(x)");
    try testExpr("Math.max(a, b)", "@max(a, b)");
    try testExpr("Math.min(a, b)", "@min(a, b)");
    try testExpr("Math.floor(x)", "@floor(x)");
}

test "ternary" {
    try testExpr("cond ? a : b", "if (cond) a else b");
}

test "logical operators" {
    try testExpr("a && b", "(a and b)");
    try testExpr("a || b", "(a or b)");
}

test "arithmetic" {
    try testExpr("a + b", "(a + b)");
    try testExpr("a * b + c", "((a * b) + c)");
    try testExpr("a + b * c", "(a + (b * c))");
}

test "comparison" {
    try testExpr("a < b", "(a < b)");
    try testExpr("a >= b", "(a >= b)");
}

test "unary" {
    try testExpr("-1", "-1");
    try testExpr("!flag", "!flag");
}

test "string equality" {
    try testExpr("a === \"hello\"", "std.mem.eql(u8, a, \"hello\")");
}

test "type assertion" {
    try testExpr("x as number", "@as(f32, x)");
}

test "new Array" {
    try testExpr("new Array(512)", "std.mem.zeroes([512]f32)");
}

test "boolean context bare identifier" {
    try testExprCtx("node.text", "node.text != null", .condition);
}

test "camelToSnake" {
    const alloc = std.testing.allocator;

    const t1 = try camelToSnake(alloc, "flexDirection");
    defer alloc.free(t1);
    try std.testing.expectEqualStrings("flex_direction", t1);

    const t2 = try camelToSnake(alloc, "paddingLeft");
    defer alloc.free(t2);
    try std.testing.expectEqualStrings("padding_left", t2);

    const t3 = try camelToSnake(alloc, "width");
    defer alloc.free(t3);
    try std.testing.expectEqualStrings("width", t3);

    const t4 = try camelToSnake(alloc, "backgroundColor");
    defer alloc.free(t4);
    try std.testing.expectEqualStrings("background_color", t4);
}

test "number literals" {
    try testExpr("42", "42");
    try testExpr("3.14", "3.14");
}

test "null and undefined" {
    try testExpr("null", "null");
    try testExpr("undefined", "null");
}

test "parenthesized" {
    try testExpr("(a + b)", "((a + b))");
}

test "function call" {
    try testExpr("foo(a, b)", "foo(a, b)");
    try testExpr("resolveMaybePct(val, parent)", "resolveMaybePct(val, parent)");
}

test "index access" {
    try testExpr("arr[i]", "arr[@intCast(i)]");
}

test "template literal simple" {
    try testExpr("`hello`", "\"hello\"");
}

test "comparison chain with logical" {
    try testExpr("a < b && b < c", "((a < b) and (b < c))");
}

test "slice method" {
    try testExpr("str.slice(a, b)", "str[@intCast(a)..@intCast(b)]");
}
