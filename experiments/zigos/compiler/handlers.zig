//! Handler body emission and expression operator precedence chain.
//!
//! emitHandlerBody parses onPress={() => ...} and emits Zig statements.
//! The expression chain (emitStateExpr → emitTernary → ... → emitStateAtom)
//! translates TypeScript expressions to Zig expressions.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");

// ── Handler body ──

pub fn emitHandlerBody(self: *Generator, start: u32) ![]const u8 {
    const saved_pos = self.pos;
    self.pos = start;
    defer self.pos = saved_pos;

    // Skip { () => or { (param) =>
    if (self.curKind() == .lbrace) self.advance_token();
    if (self.curKind() == .lparen) self.advance_token();
    while (self.curKind() == .identifier or self.curKind() == .comma) self.advance_token();
    if (self.curKind() == .rparen) self.advance_token();
    if (self.curKind() == .arrow) self.advance_token();

    // Collect statements
    var stmts: std.ArrayListUnmanaged(u8) = .{};
    const in_block = self.curKind() == .lbrace;
    if (in_block) self.advance_token();

    const end_kind: codegen.TokenKind = if (in_block) .rbrace else .rbrace;
    while (self.curKind() != end_kind and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const name = self.curText();
            if (self.isSetter(name)) |slot_id| {
                self.advance_token();
                if (self.curKind() == .lparen) self.advance_token();
                const val_expr = try emitStateExpr(self);
                if (self.curKind() == .rparen) self.advance_token();
                const rid = self.regularSlotId(slot_id);
                const st = self.stateTypeById(slot_id);
                const set_fn = switch (st) {
                    .string => "state.setSlotString",
                    .float => "state.setSlotFloat",
                    .boolean => "state.setSlotBool",
                    else => "state.setSlot",
                };
                try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}({d}, {s});\n", .{ set_fn, rid, val_expr }));
            } else if (std.mem.eql(u8, name, "const") or std.mem.eql(u8, name, "let") or std.mem.eql(u8, name, "var")) {
                std.debug.print("[tsz] warning: local variable in handler body — not supported, skipping\n", .{});
                self.advance_token();
            } else if (std.mem.eql(u8, name, "if")) {
                std.debug.print("[tsz] warning: conditional in handler body — not supported, skipping\n", .{});
                self.advance_token();
            } else if (std.mem.eql(u8, name, "for") or std.mem.eql(u8, name, "while")) {
                std.debug.print("[tsz] warning: loop in handler body — not supported, skipping\n", .{});
                self.advance_token();
            } else {
                // Unknown identifier — could be a function call we don't recognize
                std.debug.print("[tsz] warning: unknown statement '{s}' in handler — only setter calls are supported\n", .{name});
                self.advance_token();
            }
        } else {
            self.advance_token();
        }
        while (self.curKind() == .semicolon) self.advance_token();
    }

    return try self.alloc.dupe(u8, stmts.items);
}

// ── Expression chain ──

pub fn emitStateExpr(self: *Generator) ![]const u8 {
    return try emitTernary(self);
}

pub fn emitTernary(self: *Generator) ![]const u8 {
    const cond = try emitLogicalOr(self);
    if (self.curKind() == .question_question) {
        self.advance_token();
        const fallback = try emitTernary(self);
        if (self.isStringExpr(cond)) {
            return try std.fmt.allocPrint(self.alloc, "(if ({s}.len > 0) {s} else {s})", .{ cond, cond, fallback });
        } else {
            return try std.fmt.allocPrint(self.alloc, "(if (({s}) != 0) {s} else {s})", .{ cond, cond, fallback });
        }
    }
    if (self.curKind() == .question) {
        self.advance_token();
        const then_val = try emitTernary(self);
        if (self.curKind() != .colon) return error.ExpectedColonInTernary;
        self.advance_token();
        const else_val = try emitTernary(self);
        const is_already_bool = std.mem.indexOf(u8, cond, "==") != null or
            std.mem.indexOf(u8, cond, "!=") != null or
            std.mem.indexOf(u8, cond, "< ") != null or
            std.mem.indexOf(u8, cond, "> ") != null or
            std.mem.indexOf(u8, cond, "<=") != null or
            std.mem.indexOf(u8, cond, ">=") != null or
            std.mem.eql(u8, cond, "true") or
            std.mem.eql(u8, cond, "false") or
            std.mem.indexOf(u8, cond, "(!") != null;
        if (is_already_bool) {
            return try std.fmt.allocPrint(self.alloc, "(if ({s}) {s} else {s})", .{ cond, then_val, else_val });
        } else {
            return try std.fmt.allocPrint(self.alloc, "(if (({s}) != 0) {s} else {s})", .{ cond, then_val, else_val });
        }
    }
    return cond;
}

fn emitLogicalOr(self: *Generator) ![]const u8 {
    var left = try emitLogicalAnd(self);
    while (self.curKind() == .pipe_pipe) {
        self.advance_token();
        const right = try emitLogicalAnd(self);
        left = try std.fmt.allocPrint(self.alloc, "({s} or {s})", .{ left, right });
    }
    return left;
}

fn emitLogicalAnd(self: *Generator) ![]const u8 {
    var left = try emitEquality(self);
    while (self.curKind() == .amp_amp) {
        self.advance_token();
        const right = try emitEquality(self);
        left = try std.fmt.allocPrint(self.alloc, "({s} and {s})", .{ left, right });
    }
    return left;
}

fn emitEquality(self: *Generator) ![]const u8 {
    var left = try emitComparison(self);
    while (self.curKind() == .eq_eq or self.curKind() == .not_eq) {
        const op = if (self.curKind() == .eq_eq) "==" else "!=";
        self.advance_token();
        const right = try emitComparison(self);
        left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
    }
    return left;
}

fn emitComparison(self: *Generator) ![]const u8 {
    var left = try emitAdditive(self);
    while (self.curKind() == .lt or self.curKind() == .gt or
        self.curKind() == .lt_eq or self.curKind() == .gt_eq)
    {
        const op = switch (self.curKind()) {
            .lt => "<",
            .gt => ">",
            .lt_eq => "<=",
            .gt_eq => ">=",
            else => unreachable,
        };
        self.advance_token();
        const right = try emitAdditive(self);
        left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
    }
    return left;
}

fn emitAdditive(self: *Generator) ![]const u8 {
    var left = try emitMultiplicative(self);
    while (self.curKind() == .plus or self.curKind() == .minus) {
        if (self.curKind() == .minus) {
            self.advance_token();
            const right = try emitMultiplicative(self);
            left = try std.fmt.allocPrint(self.alloc, "({s} - {s})", .{ left, right });
            continue;
        }
        self.advance_token();
        const right = try emitMultiplicative(self);
        if (self.isStringExpr(left) or self.isStringExpr(right)) {
            var parts = std.ArrayListUnmanaged([]const u8){};
            try parts.append(self.alloc, left);
            try parts.append(self.alloc, right);
            while (self.curKind() == .plus) {
                self.advance_token();
                const next = try emitMultiplicative(self);
                try parts.append(self.alloc, next);
            }
            const lbl = self.array_counter;
            self.array_counter += 1;
            var fmt_str = std.ArrayListUnmanaged(u8){};
            var arg_str = std.ArrayListUnmanaged(u8){};
            for (parts.items) |part| {
                if (self.isStringExpr(part)) {
                    try fmt_str.appendSlice(self.alloc, "{s}");
                } else {
                    try fmt_str.appendSlice(self.alloc, "{d}");
                }
                if (arg_str.items.len > 0) try arg_str.appendSlice(self.alloc, ", ");
                try arg_str.appendSlice(self.alloc, part);
            }
            const blk_name = try std.fmt.allocPrint(self.alloc, "blk_{d}", .{lbl});
            left = try std.fmt.allocPrint(self.alloc,
                "({s}: {{ var _cb: [512]u8 = undefined; break :{s} std.fmt.bufPrint(&_cb, \"{s}\", .{{ {s} }}) catch \"\"; }})",
                .{ blk_name, blk_name, fmt_str.items, arg_str.items });
        } else {
            left = try std.fmt.allocPrint(self.alloc, "({s} + {s})", .{ left, right });
        }
    }
    return left;
}

fn emitMultiplicative(self: *Generator) ![]const u8 {
    var left = try emitUnary(self);
    while (self.curKind() == .star or self.curKind() == .slash or self.curKind() == .percent) {
        const op = self.curText();
        self.advance_token();
        const right = try emitUnary(self);
        left = try std.fmt.allocPrint(self.alloc, "({s} {s} {s})", .{ left, op, right });
    }
    return left;
}

fn emitUnary(self: *Generator) ![]const u8 {
    if (self.curKind() == .bang) {
        self.advance_token();
        const operand = try emitUnary(self);
        return try std.fmt.allocPrint(self.alloc, "(!{s})", .{operand});
    }
    if (self.curKind() == .minus) {
        self.advance_token();
        const operand = try emitUnary(self);
        return try std.fmt.allocPrint(self.alloc, "(-{s})", .{operand});
    }
    if (self.curKind() == .tilde) {
        self.advance_token();
        const operand = try emitUnary(self);
        return try std.fmt.allocPrint(self.alloc, "(~{s})", .{operand});
    }
    return try emitStateAtom(self);
}

pub fn emitStateAtom(self: *Generator) anyerror![]const u8 {
    // Parenthesized expression
    if (self.curKind() == .lparen) {
        self.advance_token();
        const inner = try emitStateExpr(self);
        if (self.curKind() == .rparen) self.advance_token();
        return try std.fmt.allocPrint(self.alloc, "({s})", .{inner});
    }
    // Number literal
    if (self.curKind() == .number) {
        const val = self.curText();
        self.advance_token();
        return val;
    }
    // String literal
    if (self.curKind() == .string) {
        const val = self.curText();
        self.advance_token();
        if (val.len >= 2 and val[0] == '\'') {
            const inner = val[1 .. val.len - 1];
            if (self.emit_colors_as_rgb and inner.len > 0 and (inner[0] == '#' or attrs.namedColor(inner) != null)) {
                return try attrs.parseColorValue(self, inner);
            }
            return try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{inner});
        }
        if (self.emit_colors_as_rgb and val.len >= 2 and val[0] == '"') {
            const inner = val[1 .. val.len - 1];
            if (inner.len > 0 and (inner[0] == '#' or attrs.namedColor(inner) != null)) {
                return try attrs.parseColorValue(self, inner);
            }
        }
        return val;
    }
    // Template literal in expression context
    if (self.curKind() == .template_literal) {
        const tmpl = try attrs.parseTemplateLiteral(self);
        self.advance_token();
        if (!tmpl.is_dynamic) {
            return try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{tmpl.static_text});
        }
        const buf_size = Generator.estimateBufSize(tmpl.fmt);
        const lbl = self.array_counter;
        self.array_counter += 1;
        return try std.fmt.allocPrint(self.alloc, "(blk_{d}: {{ var _tb: [{d}]u8 = undefined; break :blk_{d} std.fmt.bufPrint(&_tb, \"{s}\", .{{ {s} }}) catch \"\"; }})", .{ lbl, buf_size, lbl, tmpl.fmt, tmpl.args });
    }
    if (self.curKind() == .identifier) {
        const name = self.curText();
        // Boolean literals
        if (std.mem.eql(u8, name, "true") or std.mem.eql(u8, name, "false")) {
            self.advance_token();
            return name;
        }
        // Component prop resolution
        if (self.findProp(name)) |prop_val| {
            self.advance_token();
            // If we're in color context and the prop value is a hex color string, convert it
            if (self.emit_colors_as_rgb and prop_val.len >= 2 and (prop_val[0] == '"' or prop_val[0] == '\'')) {
                const inner = prop_val[1 .. prop_val.len - 1];
                if (inner.len > 0 and (inner[0] == '#' or attrs.namedColor(inner) != null)) {
                    return try attrs.parseColorValue(self, inner);
                }
            }
            return prop_val;
        }
        // State getter
        if (self.isState(name)) |slot_id| {
            self.advance_token();
            const rid = self.regularSlotId(slot_id);
            const st = self.stateTypeById(slot_id);
            return switch (st) {
                .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
                else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
            };
        }
        // Local variable
        if (self.isLocalVar(name)) |lv| {
            self.advance_token();
            return try self.alloc.dupe(u8, lv.expr);
        }
        // FFI call
        if (self.isFFIFunc(name)) {
            self.advance_token();
            if (self.curKind() == .lparen) self.advance_token();
            var ffi_args: std.ArrayListUnmanaged(u8) = .{};
            while (self.curKind() != .rparen and self.curKind() != .eof) {
                if (self.curKind() == .number) {
                    if (std.mem.eql(u8, self.curText(), "0")) {
                        try ffi_args.appendSlice(self.alloc, "null");
                    } else {
                        try ffi_args.appendSlice(self.alloc, self.curText());
                    }
                }
                self.advance_token();
            }
            if (self.curKind() == .rparen) self.advance_token();
            return try std.fmt.allocPrint(self.alloc, "ffi.{s}({s})", .{ name, ffi_args.items });
        }
        // Bare identifier fallback
        self.advance_token();
        return name;
    }
    self.advance_token();
    return "0";
}
