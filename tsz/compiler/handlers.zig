//! Handler body emission and expression operator precedence chain.
//!
//! emitHandlerBody parses onPress={() => ...} and emits Zig statements.
//! The expression chain (emitStateExpr → emitTernary → ... → emitStateAtom)
//! translates TypeScript expressions to Zig expressions.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");

/// Check if a string is a bare integer literal (e.g. "0", "1", "-42").
fn isIntLiteral(s: []const u8) bool {
    if (s.len == 0) return false;
    var i: usize = 0;
    if (s[0] == '-') i = 1;
    if (i >= s.len) return false;
    while (i < s.len) : (i += 1) {
        if (s[i] < '0' or s[i] > '9') return false;
    }
    return true;
}

fn stateGetterExpr(self: *Generator, slot_id: u32) ![]const u8 {
    const rid = self.regularSlotId(slot_id);
    const st = self.stateTypeById(slot_id);
    return switch (st) {
        .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
        .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
        .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
        else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
    };
}

fn appendStateWrite(self: *Generator, stmts: *std.ArrayListUnmanaged(u8), pad: []const u8, slot_id: u32, value_expr: []const u8) !void {
    const rid = self.regularSlotId(slot_id);
    const st = self.stateTypeById(slot_id);
    const set_fn = switch (st) {
        .string => "state.setSlotString",
        .float => "state.setSlotFloat",
        .boolean => "state.setSlotBool",
        else => "state.setSlot",
    };
    try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}{s}({d}, {s});\n", .{ pad, set_fn, rid, value_expr }));
}

// ── Handler body ──

/// Return an indentation string for the given nesting depth.
/// depth=1 → 4 spaces (handler top level), depth=2 → 8 spaces, etc.
fn indentStr(alloc: std.mem.Allocator, depth: u32) ![]const u8 {
    const n = depth * 4;
    const buf = try alloc.alloc(u8, n);
    @memset(buf, ' ');
    return buf;
}

/// Parse statements until `}` — does NOT consume the closing `}`.
/// Saves and restores local_count so block-scoped locals (const/let) are cleaned up.
fn emitBlockBody(
    self: *Generator,
    stmts: *std.ArrayListUnmanaged(u8),
    depth: u32,
) anyerror!void {
    const saved_locals = self.local_count;
    defer self.local_count = saved_locals;
    const pad = try indentStr(self.alloc, depth);
    while (self.curKind() != .rbrace and self.curKind() != .eof) {
        try emitStatement(self, stmts, pad, depth);
        while (self.curKind() == .semicolon) self.advance_token();
    }
}

fn emitStatementOrBlock(
    self: *Generator,
    stmts: *std.ArrayListUnmanaged(u8),
    depth: u32,
) anyerror!void {
    const saved_locals = self.local_count;
    defer self.local_count = saved_locals;

    if (self.curKind() == .lbrace) {
        self.advance_token(); // consume {
        try emitBlockBody(self, stmts, depth);
        if (self.curKind() == .rbrace) self.advance_token(); // consume }
        return;
    }

    const pad = try indentStr(self.alloc, depth);
    try emitStatement(self, stmts, pad, depth);
    while (self.curKind() == .semicolon) self.advance_token();
}

/// Emit a single handler statement. Called by emitBlockBody and recursively
/// by if/while/for handlers for their nested blocks.
fn emitStatement(
    self: *Generator,
    stmts: *std.ArrayListUnmanaged(u8),
    pad: []const u8,
    depth: u32,
) anyerror!void {
    if (self.curKind() != .identifier) {
        self.advance_token();
        return;
    }
    const name = self.curText();

    // ── 1. Object setter: setUser({ ...user, name: "bob" }) ──
    if (self.objectStateVarBySetter(name)) |obj_state| {
        self.advance_token();
        if (self.curKind() == .lparen) self.advance_token();
        if (self.curKind() == .lbrace) {
            self.advance_token();
            while (self.curKind() != .rbrace and self.curKind() != .eof) {
                if (self.curKind() == .spread) {
                    self.advance_token();
                    if (self.curKind() == .identifier) self.advance_token();
                } else if (self.curKind() == .identifier) {
                    const field_name = self.curText();
                    const field_start = self.cur().start;
                    self.advance_token();
                    if (self.curKind() == .colon) self.advance_token();
                    const value_expr = try emitStateExpr(self);

                    var matched = false;
                    for (0..obj_state.field_count) |i| {
                        const field = obj_state.fields[i];
                        if (std.mem.eql(u8, field.field_name, field_name)) {
                            try appendStateWrite(self, stmts, pad, field.slot_id, value_expr);
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) {
                        const msg = std.fmt.allocPrint(self.alloc, "unknown object state field '{s}.{s}'", .{ obj_state.getter, field_name }) catch "unknown object state field";
                        self.setErrorAt(field_start, msg);
                    }
                } else {
                    self.advance_token();
                }
                if (self.curKind() == .comma) self.advance_token();
            }
            if (self.curKind() == .rbrace) self.advance_token();
        } else {
            self.addWarning(self.cur().start, "object state setter only supports object literals");
            while (self.curKind() != .rparen and self.curKind() != .eof) self.advance_token();
        }
        if (self.curKind() == .rparen) self.advance_token();
        return;
    }

    // ── 2. Setter call: setFoo(expr) ──
    if (self.isSetter(name)) |slot_id| {
        self.advance_token();
        if (self.curKind() == .lparen) self.advance_token();
        const val_expr = try emitStateExpr(self);
        if (self.curKind() == .rparen) self.advance_token();
        try appendStateWrite(self, stmts, pad, slot_id, val_expr);
        return;
    }

    // ── 3. navigate('/path') → router.push("/path") ──
    if (std.mem.eql(u8, name, "navigate")) {
        self.advance_token();
        if (self.curKind() == .lparen) self.advance_token();
        if (self.curKind() == .string) {
            const raw = self.curText();
            const path = if (raw.len >= 2) raw[1 .. raw.len - 1] else raw;
            try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}router.push(\"{s}\");\n", .{ pad, path }));
            self.advance_token();
        }
        if (self.curKind() == .rparen) self.advance_token();
        return;
    }

    // ── 3b. setVariant(N) → Theme.setVariant(N) ──
    if (std.mem.eql(u8, name, "setVariant")) {
        self.advance_token();
        if (self.curKind() == .lparen) self.advance_token();
        const val_expr = try emitStateExpr(self);
        if (self.curKind() == .rparen) self.advance_token();
        self.has_theme = true;
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}Theme.setVariant(@intCast({s}));\n", .{ pad, val_expr }));
        return;
    }

    // ── 3c. setBreakpoints(md, lg, xl) → breakpoint.setThresholds(md, lg, xl) ──
    if (std.mem.eql(u8, name, "setBreakpoints")) {
        self.advance_token();
        if (self.curKind() == .lparen) self.advance_token();
        const md_expr = try emitStateExpr(self);
        if (self.curKind() == .comma) self.advance_token();
        const lg_expr = try emitStateExpr(self);
        if (self.curKind() == .comma) self.advance_token();
        const xl_expr = try emitStateExpr(self);
        if (self.curKind() == .rparen) self.advance_token();
        self.has_breakpoints = true;
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}breakpoint.setThresholds({s}, {s}, {s});\n", .{ pad, md_expr, lg_expr, xl_expr }));
        return;
    }

    // ── 4. Local variable: const/let/var name = expr ──
    // Pushed to Generator.local_vars for compile-time substitution in emitStateAtom.
    // NOT emitted as Zig code — referenced by name in subsequent expressions.
    if (std.mem.eql(u8, name, "const") or
        std.mem.eql(u8, name, "let") or
        std.mem.eql(u8, name, "var"))
    {
        const decl_kw = name;
        self.advance_token(); // skip keyword
        if (self.curKind() != .identifier) return;
        const var_name = try self.alloc.dupe(u8, self.curText());
        self.advance_token(); // skip name
        // skip optional type annotation: `: Type`
        if (self.curKind() == .colon) {
            self.advance_token();
            if (self.curKind() == .identifier) self.advance_token();
        }
        if (self.curKind() == .equals) self.advance_token(); // skip =
        const val_expr = try emitStateExpr(self);
        if (self.local_count < codegen.MAX_LOCALS) {
            if (self.effect_param != null) {
                const zig_kw = if (std.mem.eql(u8, decl_kw, "const")) "const" else "var";
                try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}{s} {s} = {s};\n", .{ pad, zig_kw, var_name, val_expr }));
                self.local_vars[self.local_count] = .{
                    .name = var_name,
                    .expr = var_name,
                    .assign_expr = if (std.mem.eql(u8, decl_kw, "const")) null else var_name,
                    .state_type = .int,
                };
            } else {
                self.local_vars[self.local_count] = .{
                    .name = var_name,
                    .expr = val_expr,
                    .state_type = .int,
                };
            }
            self.local_count += 1;
        }
        return;
    }

    // ── 4b. Local assignment: foo = expr ──
    if (self.pos + 1 < self.lex.count and self.lex.get(self.pos + 1).kind == .equals) {
        if (self.isLocalVar(name)) |lv| {
            self.advance_token(); // skip local name
            self.advance_token(); // skip =
            const val_expr = try emitStateExpr(self);
            if (lv.assign_expr) |assign_expr| {
                try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}{s} = {s};\n", .{ pad, assign_expr, val_expr }));
            } else {
                try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}// unsupported: assignment to immutable local {s}\n", .{ pad, name }));
            }
            return;
        }
    }

    // ── 4. if / else ──
    if (std.mem.eql(u8, name, "if")) {
        self.advance_token(); // skip "if"
        if (self.curKind() == .lparen) self.advance_token();
        const cond = try emitStateExpr(self);
        if (self.curKind() == .rparen) self.advance_token();
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}if ({s}) {{\n", .{ pad, cond }));
        try emitStatementOrBlock(self, stmts, depth + 1);
        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "else")) {
            self.advance_token(); // skip "else"
            try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}}} else {{\n", .{pad}));
            try emitStatementOrBlock(self, stmts, depth + 1);
        }
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}}}\n", .{pad}));
        return;
    }

    // ── 5. while loop ──
    if (std.mem.eql(u8, name, "while")) {
        self.advance_token(); // skip "while"
        if (self.curKind() == .lparen) self.advance_token();
        const cond = try emitStateExpr(self);
        if (self.curKind() == .rparen) self.advance_token();
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}while ({s}) {{\n", .{ pad, cond }));
        try emitStatementOrBlock(self, stmts, depth + 1);
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}}}\n", .{pad}));
        return;
    }

    // ── 6. C-style for loop: for (let i = 0; i < n; i++) { ... } ──
    if (std.mem.eql(u8, name, "for")) {
        self.advance_token(); // skip "for"
        if (self.curKind() != .lparen) return;
        self.advance_token(); // skip "("

        // Peek ahead to distinguish for-of from C-style
        const peek_start = self.pos;
        var is_for_of = false;
        if (self.curKind() == .identifier) self.advance_token(); // let/const/var
        if (self.curKind() == .identifier) {
            self.advance_token(); // variable name
            if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "of")) {
                is_for_of = true;
            }
        }
        self.pos = peek_start;

        if (is_for_of) {
            // Skip entire for-of clause + body — not yet supported
            var bd: u32 = 1;
            while (bd > 0 and self.curKind() != .eof) {
                if (self.curKind() == .lparen) bd += 1;
                if (self.curKind() == .rparen) {
                    bd -= 1;
                    if (bd == 0) {
                        self.advance_token();
                        break;
                    }
                }
                self.advance_token();
            }
            if (self.curKind() == .lbrace) {
                var bb: u32 = 1;
                self.advance_token();
                while (bb > 0 and self.curKind() != .eof) {
                    if (self.curKind() == .lbrace) bb += 1;
                    if (self.curKind() == .rbrace) bb -= 1;
                    self.advance_token();
                }
            }
            try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}// for-of: not yet supported\n", .{pad}));
            return;
        }

        // C-style: parse init — skip let/const/var keyword
        if (self.curKind() == .identifier and
            (std.mem.eql(u8, self.curText(), "let") or
                std.mem.eql(u8, self.curText(), "const") or
                std.mem.eql(u8, self.curText(), "var")))
        {
            self.advance_token();
        }
        const loop_var_ts = try self.alloc.dupe(u8, self.curText()); // e.g. "i"
        self.advance_token();
        if (self.curKind() == .equals) self.advance_token(); // skip =
        const init_expr = try emitStateExpr(self);
        if (self.curKind() == .semicolon) self.advance_token();

        // Generate a unique, Zig-safe name for the loop variable
        const lv_zig = try std.fmt.allocPrint(self.alloc, "_for_{s}_{d}", .{ loop_var_ts, self.array_counter });
        self.array_counter += 1;

        // Push loop var into local_vars so body expressions (and condition) resolve it.
        // Inside effect render bodies, register as @floatFromInt so float math works.
        const for_local_base = self.local_count;
        const lv_expr = if (self.effect_param != null)
            try std.fmt.allocPrint(self.alloc, "@as(f32, @floatFromInt({s}))", .{lv_zig})
        else
            lv_zig;
        if (self.local_count < codegen.MAX_LOCALS) {
            self.local_vars[self.local_count] = .{
                .name = loop_var_ts,
                .expr = lv_expr,
                .assign_expr = lv_zig,
                .state_type = .int,
            };
            self.local_count += 1;
        }

        // Parse condition and increment with loop var in scope
        const cond = try emitStateExpr(self);
        if (self.curKind() == .semicolon) self.advance_token();
        const incr = try parseForIncrement(self, lv_zig);
        if (self.curKind() == .rparen) self.advance_token();

        // Emit: var _for_i_N: i32 = init; while (cond) : (incr) { body }
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}var {s}: i32 = @intCast({s});\n", .{ pad, lv_zig, init_expr }));
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}while ({s}) : ({s}) {{\n", .{ pad, cond, incr }));
        try emitStatementOrBlock(self, stmts, depth + 1);
        self.local_count = for_local_base; // pop loop var (emitBlockBody already popped body locals)
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}}}\n", .{pad}));
        return;
    }

    // ── 6b. Effect param method call: e.setPixel(...) → ctx.setPixel(...); ──
    if (self.effect_param) |ep| {
        if (std.mem.eql(u8, name, ep) and self.pos + 1 < self.lex.count and self.lex.get(self.pos + 1).kind == .dot) {
            self.advance_token(); // skip param name
            self.advance_token(); // skip '.'
            if (self.curKind() == .identifier) {
                const method = try self.alloc.dupe(u8, self.curText());
                self.advance_token(); // skip method name
                if (self.curKind() == .lparen) {
                    self.advance_token(); // skip '('
                    var args_buf: std.ArrayListUnmanaged(u8) = .{};
                    var arg_count: u32 = 0;
                    while (self.curKind() != .rparen and self.curKind() != .eof) {
                        if (arg_count > 0) try args_buf.appendSlice(self.alloc, ", ");
                        const arg = try emitStateExpr(self);
                        try args_buf.appendSlice(self.alloc, arg);
                        arg_count += 1;
                        if (self.curKind() == .comma) self.advance_token();
                    }
                    if (self.curKind() == .rparen) self.advance_token();
                    try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}ctx.{s}({s});\n", .{ pad, method, args_buf.items }));
                    return;
                }
            }
        }
    }

    // ── 7. Unknown call — collect args via emitStateExpr, call via QJS bridge ──
    const call_name = try self.alloc.dupe(u8, name);
    self.advance_token();
    var arg_exprs: [8][]const u8 = undefined;
    var arg_types: [8]enum { int, string, js_ident } = undefined;
    var arg_count: u32 = 0;
    var has_dynamic_args = false;
    if (self.curKind() == .lparen) {
        self.advance_token();
        while (self.curKind() != .rparen and self.curKind() != .eof and arg_count < 8) {
            const arg_expr = try emitStateExpr(self);
            // Determine if arg is a string expression
            const is_str = self.isStringExpr(arg_expr);
            const is_dynamic = std.mem.indexOf(u8, arg_expr, "_oa") != null or
                std.mem.indexOf(u8, arg_expr, "_i") != null or
                std.mem.indexOf(u8, arg_expr, "state.") != null;
            // Plain JS-scope identifier: alphanumeric/underscore, no Zig binding
            const is_js_ident = !is_str and !is_dynamic and blk: {
                if (arg_expr.len == 0) break :blk false;
                if (!std.ascii.isAlphabetic(arg_expr[0]) and arg_expr[0] != '_') break :blk false;
                for (arg_expr) |c| {
                    if (!std.ascii.isAlphanumeric(c) and c != '_') break :blk false;
                }
                // Must not be a known state variable
                break :blk self.isState(arg_expr) == null;
            };
            arg_exprs[arg_count] = arg_expr;
            arg_types[arg_count] = if (is_str) .string else if (is_js_ident) .js_ident else .int;
            if (is_dynamic) has_dynamic_args = true;
            arg_count += 1;
            if (self.curKind() == .comma) self.advance_token();
        }
        if (self.curKind() == .rparen) self.advance_token();
    }
    // If there's a <script> block, assume it's a JS function — call it via QJS bridge
    if (self.compute_js != null) {
        if (arg_count == 0) {
            try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}qjs_runtime.callGlobal(\"{s}\");\n", .{ pad, call_name }));
        } else if (arg_count == 1 and !has_dynamic_args and arg_types[0] == .string) {
            // Simple string arg — strip quotes and use callGlobalStr
            var stripped = arg_exprs[0];
            if (stripped.len >= 2 and (stripped[0] == '"')) stripped = stripped[1 .. stripped.len - 1];
            try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}qjs_runtime.callGlobalStr(\"{s}\", \"{s}\");\n", .{ pad, call_name, stripped }));
        } else {
            // Multi-arg or dynamic args — build JS expression at runtime and eval
            // Generate: var _eb: [512]u8 = undefined;
            //           const _ev = std.fmt.bufPrint(&_eb, "func({d}, '{s}')", .{args...}) catch "";
            //           qjs_runtime.evalExpr(_ev);
            var js_fmt: std.ArrayListUnmanaged(u8) = .{};
            var js_args: std.ArrayListUnmanaged(u8) = .{};
            try js_fmt.appendSlice(self.alloc, call_name);
            try js_fmt.append(self.alloc, '(');
            for (0..arg_count) |ai| {
                if (ai > 0) try js_fmt.appendSlice(self.alloc, ", ");
                if (arg_types[ai] == .string) {
                    try js_fmt.appendSlice(self.alloc, "'{s}'");
                    if (js_args.items.len > 0) try js_args.appendSlice(self.alloc, ", ");
                    try js_args.appendSlice(self.alloc, arg_exprs[ai]);
                } else if (arg_types[ai] == .js_ident) {
                    // JS-scope variable — embed name directly, no Zig format arg
                    try js_fmt.appendSlice(self.alloc, arg_exprs[ai]);
                } else {
                    try js_fmt.appendSlice(self.alloc, "{d}");
                    if (js_args.items.len > 0) try js_args.appendSlice(self.alloc, ", ");
                    try js_args.appendSlice(self.alloc, arg_exprs[ai]);
                }
            }
            try js_fmt.append(self.alloc, ')');
            if (js_args.items.len == 0) {
                // All args are static/JS-scope — emit direct evalExpr
                try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}qjs_runtime.evalExpr(\"{s}\");\n", .{ pad, js_fmt.items }));
            } else {
                try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}{{\n" ++
                    "{s}    var _eb: [512]u8 = undefined;\n" ++
                    "{s}    const _ev = std.fmt.bufPrint(&_eb, \"{s}\", .{{ {s} }}) catch \"\";\n" ++
                    "{s}    qjs_runtime.evalExpr(_ev);\n" ++
                    "{s}}}\n", .{ pad, pad, pad, js_fmt.items, js_args.items, pad, pad }));
            }
        }
    } else if (self.compute_zig != null) {
        // <zscript> — direct native Zig function call
        if (arg_count == 0) {
            try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}{s}();\n", .{ pad, call_name }));
        } else {
            var args_buf: std.ArrayListUnmanaged(u8) = .{};
            for (0..arg_count) |ai| {
                if (ai > 0) try args_buf.appendSlice(self.alloc, ", ");
                try args_buf.appendSlice(self.alloc, arg_exprs[ai]);
            }
            try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}{s}({s});\n", .{ pad, call_name, args_buf.items }));
        }
    } else {
        try stmts.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{s}// unsupported: {s}(...)\n", .{ pad, call_name }));
    }
}

/// Parse a for-loop increment expression and return the Zig continue expression.
/// Handles: i++ (two .plus tokens), i-- (two .minus), i += n (.plus .equals expr),
/// i -= n (.minus .equals expr). The loop var name has already been mapped to lv_zig.
fn parseForIncrement(self: *Generator, lv_zig: []const u8) ![]const u8 {
    if (self.curKind() == .identifier) self.advance_token(); // skip loop var name
    if (self.curKind() == .plus) {
        self.advance_token();
        if (self.curKind() == .plus) { // i++
            self.advance_token();
            return try std.fmt.allocPrint(self.alloc, "{s} += 1", .{lv_zig});
        }
        if (self.curKind() == .equals) { // i += n
            self.advance_token();
            const n = try emitStateExpr(self);
            return try std.fmt.allocPrint(self.alloc, "{s} += {s}", .{ lv_zig, n });
        }
        return try std.fmt.allocPrint(self.alloc, "{s} += 1", .{lv_zig});
    }
    if (self.curKind() == .minus) {
        self.advance_token();
        if (self.curKind() == .minus) { // i--
            self.advance_token();
            return try std.fmt.allocPrint(self.alloc, "{s} -= 1", .{lv_zig});
        }
        if (self.curKind() == .equals) { // i -= n
            self.advance_token();
            const n = try emitStateExpr(self);
            return try std.fmt.allocPrint(self.alloc, "{s} -= {s}", .{ lv_zig, n });
        }
        return try std.fmt.allocPrint(self.alloc, "{s} -= 1", .{lv_zig});
    }
    return try std.fmt.allocPrint(self.alloc, "{s} += 1", .{lv_zig}); // fallback
}

/// Parse an onPress handler body and emit equivalent Zig statements.
///
/// Input token stream: { () => { setCount(count + 1); setName('hello') } }
/// Output Zig: "    state.setSlot(0, (state.getSlot(0) + 1));\n    state.setSlotString(1, \"hello\");\n"
///
/// Supported statements: setter calls, navigate(), const/let locals (compile-time
/// substitution), if/else, while loops, C-style for loops. Unknown calls emit a comment.
pub fn emitHandlerBody(self: *Generator, start: u32) ![]const u8 {
    const saved_pos = self.pos;
    const saved_locals = self.local_count;
    self.pos = start;
    defer {
        self.pos = saved_pos;
        self.local_count = saved_locals;
    }

    // Skip the arrow function preamble: { () => or { (e) =>
    if (self.curKind() == .lbrace) self.advance_token(); // outer { from JSX attr
    if (self.curKind() == .lparen) self.advance_token();
    while (self.curKind() == .identifier or self.curKind() == .comma) self.advance_token();
    if (self.curKind() == .rparen) self.advance_token();
    if (self.curKind() == .arrow) self.advance_token();

    var stmts: std.ArrayListUnmanaged(u8) = .{};
    if (self.curKind() == .lbrace) self.advance_token(); // consume function body {
    try emitBlockBody(self, &stmts, 1);

    return try self.alloc.dupe(u8, stmts.items);
}

/// Parse an onRender callback body for <Effect> and emit Zig statements.
///
/// Input: { (e) => { e.setPixel(x, y, r, g, b, a); ... } }
/// Output: Zig code using ctx: *effect_ctx.EffectContext parameter.
///
/// Sets self.effect_param during body compilation so emitStateAtom and
/// emitStatement translate e.xxx → ctx.xxx / @builtin.
pub fn emitEffectRenderBody(self: *Generator, start: u32) ![]const u8 {
    const saved_pos = self.pos;
    const saved_locals = self.local_count;
    const saved_effect_param = self.effect_param;
    self.pos = start;
    defer {
        self.pos = saved_pos;
        self.local_count = saved_locals;
        self.effect_param = saved_effect_param;
    }

    // Parse arrow function preamble: { (e) => { body } }
    if (self.curKind() == .lbrace) self.advance_token(); // outer { from JSX attr
    if (self.curKind() == .lparen) self.advance_token(); // (
    // Extract parameter name
    if (self.curKind() == .identifier) {
        self.effect_param = try self.alloc.dupe(u8, self.curText());
        self.advance_token();
    }
    while (self.curKind() == .comma or self.curKind() == .identifier) self.advance_token();
    if (self.curKind() == .rparen) self.advance_token(); // )
    if (self.curKind() == .arrow) self.advance_token(); // =>

    var stmts: std.ArrayListUnmanaged(u8) = .{};
    if (self.curKind() == .lbrace) self.advance_token(); // consume function body {
    try emitBlockBody(self, &stmts, 1);

    return try self.alloc.dupe(u8, stmts.items);
}

// ── Expression chain ──
// Operator precedence parser for TS expressions → Zig expressions.
// Each function handles one precedence level and calls the next one down:
//
//   emitStateExpr  (entry point)
//     └─ emitTernary        ?:  and  ??
//         └─ emitLogicalOr  ||
//             └─ emitLogicalAnd  &&
//                 └─ emitEquality  ==  !=
//                     └─ emitComparison  <  >  <=  >=
//                         └─ emitAdditive  +  -  (+ string concat)
//                             └─ emitMultiplicative  *  /  %
//                                 └─ emitUnary  !  -  ~
//                                     └─ emitStateAtom  literals, state getters, FFI calls, props

/// Entry point: parse a complete TS expression and return the equivalent Zig expression string.
pub fn emitStateExpr(self: *Generator) ![]const u8 {
    return try emitTernary(self);
}

/// Ternary (a ? b : c) and nullish coalescing (a ?? b).
/// Also handles the TS→Zig conversion: JS truthiness → Zig bool comparison.
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
        // Wrap bare integer literals with @as(i32, ...) to avoid comptime_int in runtime if
        const tv = if (isIntLiteral(then_val))
            try std.fmt.allocPrint(self.alloc, "@as(i32, {s})", .{then_val})
        else
            then_val;
        const ev = if (isIntLiteral(else_val))
            try std.fmt.allocPrint(self.alloc, "@as(i32, {s})", .{else_val})
        else
            else_val;
        if (is_already_bool) {
            return try std.fmt.allocPrint(self.alloc, "(if ({s}) {s} else {s})", .{ cond, tv, ev });
        } else {
            return try std.fmt.allocPrint(self.alloc, "(if (({s}) != 0) {s} else {s})", .{ cond, tv, ev });
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
            left = try std.fmt.allocPrint(self.alloc, "({s}: {{ var _cb: [512]u8 = undefined; break :{s} std.fmt.bufPrint(&_cb, \"{s}\", .{{ {s} }}) catch \"\"; }})", .{ blk_name, blk_name, fmt_str.items, arg_str.items });
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
    return try emitPostfix(self);
}

fn emitPostfix(self: *Generator) anyerror![]const u8 {
    var expr = try emitStateAtom(self);
    while (self.curKind() == .lbracket) {
        self.advance_token();
        const idx = try emitStateExpr(self);
        if (self.curKind() == .rbracket) self.advance_token();
        expr = try std.fmt.allocPrint(self.alloc, "{s}[{s}]", .{ expr, idx });
    }
    return expr;
}

/// Lowest-precedence: parse a single value (literal, state getter, prop, FFI call, etc).
/// This is the "leaves" of the expression tree — everything bottoms out here.
///
/// Resolution order:
///   1. (expr)        → recurse into emitStateExpr
///   2. 42, 3.14      → number literal passthrough
///   3. "hello", 'x'  → string literal (single quotes → double quotes, hex colors → Color.rgb)
///   4. `template`    → template literal with ${} interpolation
///   5. true/false    → boolean literal
///   6. prop name     → substitute with concrete value from prop_stack
///   7. state getter  → state.getSlot(N) / getSlotString(N) / etc
///   8. local var     → substitute with collected expression
///   9. FFI func      → ffi.funcName(args)
///  10. bare ident    → passthrough (fallback, may produce Zig compile error)
pub fn emitStateAtom(self: *Generator) anyerror![]const u8 {
    // (expr) — parenthesized subexpression
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
        // Object state field access
        if (self.isObjectStateVar(name)) |obj_state| {
            if (self.pos + 1 < self.lex.count and self.lex.get(self.pos + 1).kind == .dot) {
                self.advance_token();
                self.advance_token();
                if (self.curKind() == .identifier) {
                    const field_name = self.curText();
                    const field_start = self.cur().start;
                    self.advance_token();
                    for (0..obj_state.field_count) |i| {
                        const field = obj_state.fields[i];
                        if (std.mem.eql(u8, field.field_name, field_name)) {
                            return try stateGetterExpr(self, field.slot_id);
                        }
                    }
                    const msg = std.fmt.allocPrint(self.alloc, "unknown object state field '{s}.{s}'", .{ obj_state.getter, field_name }) catch "unknown object state field";
                    self.setErrorAt(field_start, msg);
                    return "0";
                }
            }
        }
        // Map item param: entry.field → _oa{N}_{field}[_i]
        if (self.map_item_param) |param| {
            if (std.mem.eql(u8, name, param)) {
                self.advance_token();
                if (self.curKind() == .dot) {
                    const field_name = self.consumeCompoundField();
                    // Inside component inline: _i doesn't exist at file scope, default to 0
                    if (self.current_inline_component != null) return "0";
                    if (self.map_obj_array_idx) |oa_idx| {
                        // Check if this is a string field — needs length slice
                        const oa = self.object_arrays[oa_idx];
                        for (0..oa.field_count) |fi| {
                            if (std.mem.eql(u8, oa.fields[fi].name, field_name) and oa.fields[fi].field_type == .string) {
                                return try std.fmt.allocPrint(self.alloc, "_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]]", .{ oa_idx, field_name, oa_idx, field_name });
                            }
                        }
                        return try std.fmt.allocPrint(self.alloc, "_oa{d}_{s}[_i]", .{ oa_idx, field_name });
                    }
                    return try std.fmt.allocPrint(self.alloc, "_item.{s}", .{field_name});
                }
                if (self.current_inline_component != null) return "0";
                return "_item";
            }
        }
        // Map index param: i → _i (or _ci when resolving props for components inside map templates)
        if (self.map_index_param) |idx_p| {
            if (std.mem.eql(u8, name, idx_p)) {
                self.advance_token();
                // Inside component inline: _i doesn't exist at file scope
                if (self.current_inline_component != null) return "0";
                if (self.resolve_map_index_as_parent)
                    return "@as(i64, @intCast(_ci))";
                return "@as(i64, @intCast(_i))";
            }
        }
        // Effect render param: e.time → ctx.time, e.sin(x) → @sin(x), etc.
        if (self.effect_param) |ep| {
            if (std.mem.eql(u8, name, ep)) {
                self.advance_token(); // skip param name
                if (self.curKind() == .dot) {
                    self.advance_token(); // skip '.'
                    if (self.curKind() == .identifier) {
                        const member = self.curText();
                        self.advance_token(); // skip member name

                        // Properties → ctx.property (u32 dims get float-casted)
                        if (std.mem.eql(u8, member, "width") or std.mem.eql(u8, member, "height")) {
                            return try std.fmt.allocPrint(self.alloc, "@as(f32, @floatFromInt(ctx.{s}))", .{member});
                        }
                        if (std.mem.eql(u8, member, "time") or std.mem.eql(u8, member, "dt") or
                            std.mem.eql(u8, member, "frame") or std.mem.eql(u8, member, "mouse_x") or
                            std.mem.eql(u8, member, "mouse_y") or std.mem.eql(u8, member, "mouse_inside"))
                        {
                            return try std.fmt.allocPrint(self.alloc, "ctx.{s}", .{member});
                        }

                        // Math builtins: e.sin(x) → @sin(x)
                        if (self.curKind() == .lparen) {
                            if (std.mem.eql(u8, member, "sin") or std.mem.eql(u8, member, "cos") or
                                std.mem.eql(u8, member, "sqrt") or std.mem.eql(u8, member, "abs") or
                                std.mem.eql(u8, member, "floor") or std.mem.eql(u8, member, "ceil"))
                            {
                                self.advance_token(); // skip '('
                                const arg = try emitStateExpr(self);
                                if (self.curKind() == .rparen) self.advance_token();
                                return try std.fmt.allocPrint(self.alloc, "@{s}({s})", .{ member, arg });
                            }
                            if (std.mem.eql(u8, member, "mod")) {
                                self.advance_token(); // skip '('
                                const a = try emitStateExpr(self);
                                if (self.curKind() == .comma) self.advance_token();
                                const b = try emitStateExpr(self);
                                if (self.curKind() == .rparen) self.advance_token();
                                return try std.fmt.allocPrint(self.alloc, "@mod({s}, {s})", .{ a, b });
                            }

                            // Two-arg math: e.atan2(y,x) → std.math.atan2(y,x)
                            if (std.mem.eql(u8, member, "atan2")) {
                                self.advance_token(); // skip '('
                                const a = try emitStateExpr(self);
                                if (self.curKind() == .comma) self.advance_token();
                                const b = try emitStateExpr(self);
                                if (self.curKind() == .rparen) self.advance_token();
                                return try std.fmt.allocPrint(self.alloc, "std.math.atan2({s}, {s})", .{ a, b });
                            }

                            // ctx methods: e.noise(x,y) → ctx.noise(x,y)
                            if (std.mem.eql(u8, member, "noise") or std.mem.eql(u8, member, "lerp") or
                                std.mem.eql(u8, member, "remap") or std.mem.eql(u8, member, "smoothstep") or
                                std.mem.eql(u8, member, "dist") or std.mem.eql(u8, member, "getPixel") or
                                std.mem.eql(u8, member, "getSource") or std.mem.eql(u8, member, "getSourceAlpha") or
                                std.mem.eql(u8, member, "getSourceR") or std.mem.eql(u8, member, "getSourceG") or
                                std.mem.eql(u8, member, "getSourceB") or
                                std.mem.eql(u8, member, "noise3") or std.mem.eql(u8, member, "fbm") or
                                std.mem.eql(u8, member, "clamp"))
                            {
                                const zig_name = if (std.mem.eql(u8, member, "clamp")) "clampVal" else member;
                                self.advance_token(); // skip '('
                                var args_buf: std.ArrayListUnmanaged(u8) = .{};
                                var arg_count: u32 = 0;
                                while (self.curKind() != .rparen and self.curKind() != .eof) {
                                    if (arg_count > 0) try args_buf.appendSlice(self.alloc, ", ");
                                    const arg = try emitStateExpr(self);
                                    try args_buf.appendSlice(self.alloc, arg);
                                    arg_count += 1;
                                    if (self.curKind() == .comma) self.advance_token();
                                }
                                if (self.curKind() == .rparen) self.advance_token();
                                return try std.fmt.allocPrint(self.alloc, "ctx.{s}({s})", .{ zig_name, args_buf.items });
                            }

                            // Color: e.hsv(h,s,v) → effect_ctx.EffectContext.hsvToRgb(h,s,v)
                            if (std.mem.eql(u8, member, "hsv") or std.mem.eql(u8, member, "hsl")) {
                                const fn_name = if (std.mem.eql(u8, member, "hsv")) "hsvToRgb" else "hslToRgb";
                                self.advance_token(); // skip '('
                                var args_buf: std.ArrayListUnmanaged(u8) = .{};
                                var arg_count: u32 = 0;
                                while (self.curKind() != .rparen and self.curKind() != .eof) {
                                    if (arg_count > 0) try args_buf.appendSlice(self.alloc, ", ");
                                    const arg = try emitStateExpr(self);
                                    try args_buf.appendSlice(self.alloc, arg);
                                    arg_count += 1;
                                    if (self.curKind() == .comma) self.advance_token();
                                }
                                if (self.curKind() == .rparen) self.advance_token();
                                return try std.fmt.allocPrint(self.alloc, "effect_ctx.EffectContext.{s}({s})", .{ fn_name, args_buf.items });
                            }
                        }
                        // Fallback: unknown member → ctx.member
                        return try std.fmt.allocPrint(self.alloc, "ctx.{s}", .{member});
                    }
                }
                return "ctx";
            }
        }
        // State getter
        if (self.isState(name)) |slot_id| {
            self.advance_token();
            return try stateGetterExpr(self, slot_id);
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
        // Zscript / unknown function call: name(args) → name(args)
        if (self.pos + 1 < self.lex.count and self.lex.get(self.pos + 1).kind == .lparen) {
            self.advance_token(); // skip name
            self.advance_token(); // skip (
            var args_buf: std.ArrayListUnmanaged(u8) = .{};
            var arg_count: u32 = 0;
            while (self.curKind() != .rparen and self.curKind() != .eof) {
                if (arg_count > 0) try args_buf.appendSlice(self.alloc, ", ");
                const arg = try emitStateExpr(self);
                try args_buf.appendSlice(self.alloc, arg);
                arg_count += 1;
                if (self.curKind() == .comma) self.advance_token();
            }
            if (self.curKind() == .rparen) self.advance_token();
            return try std.fmt.allocPrint(self.alloc, "{s}({s})", .{ name, args_buf.items });
        }
        // Bare identifier fallback — if inside a component inline, default unresolved props to 0
        self.advance_token();
        if (self.current_inline_component != null) return "0";
        return name;
    }
    self.advance_token();
    return "0";
}
