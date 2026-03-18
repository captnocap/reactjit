//! Final Zig source emission — takes collected data and writes the output file.
//!
//! emitZigSource (app mode) generates a complete Zig program with this structure:
//!   1. Imports (std, layout, engine, state, router, qjs_runtime, FFI headers)
//!   2. FFI host function wrappers (_ffi_funcName)
//!   3. State manifest (human-readable slot→name mapping + comptime assertion)
//!   4. @compileError breadcrumbs (unbound dynamic text/styles/conditionals)
//!   5. Node tree (var _arr_N = [_]Node{...}; var root = Node{...};)
//!   6. Dynamic text buffers (var _dyn_buf_N: [size]u8 = undefined;)
//!   7. Event handlers (fn _handler_press_N() void { state.setSlot(...); })
//!   8. Component init functions (fn _initMyComp(...) Node { ... })
//!   9. JS_LOGIC (embedded JavaScript for QuickJS, setter calls rewritten)
//!  10. _initState, _updateDynamicTexts, _updateConditionals, updateRoutes
//!  11. _appInit (calls all init functions)
//!  12. _appTick (per-frame: FFI polling, state dirty checks, text updates)
//!  13. main() → engine.run(...)
//!
//! emitModuleSource (.mod.tsz mode) generates a lighter fragment:
//!   imports + arrays + pub fn render() Node { ... }

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const collect = @import("collect.zig");
const handlers = @import("handlers.zig");

fn slotReadExpr(self: *Generator, slot_id: u32) ![]const u8 {
    const rid = self.regularSlotId(slot_id);
    return switch (self.stateTypeById(slot_id)) {
        .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
        .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
        .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
        else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
    };
}

fn easingExpr(alloc: std.mem.Allocator, easing: codegen.EasingKind, t_expr: []const u8) ![]const u8 {
    return switch (easing) {
        .linear => try alloc.dupe(u8, t_expr),
        .ease_in => try std.fmt.allocPrint(alloc, "(({s}) * ({s}))", .{ t_expr, t_expr }),
        .ease_out => try std.fmt.allocPrint(alloc, "(1.0 - ((1.0 - ({s})) * (1.0 - ({s}))))", .{ t_expr, t_expr }),
        .ease_in_out => try std.fmt.allocPrint(alloc,
            "(if (({s}) < 0.5) (2.0 * ({s}) * ({s})) else (1.0 - (((-2.0 * ({s})) + 2.0) * ((-2.0 * ({s})) + 2.0)) / 2.0))",
            .{ t_expr, t_expr, t_expr, t_expr, t_expr }),
    };
}

fn emitTransitionTick(self: *Generator, out: *std.ArrayListUnmanaged(u8), hook: codegen.AnimHook) !void {
    const slot_id = hook.slot_id;
    const rid = self.regularSlotId(slot_id);
    const t_name = try std.fmt.allocPrint(self.alloc, "_t_{d}", .{slot_id});
    const eased_t = try easingExpr(self.alloc, hook.easing, t_name);

    try out.appendSlice(self.alloc, "    {\n");
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        const _target_{d}: f64 = {s};\n", .{ slot_id, hook.target_expr }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        const _cur_{d}: f64 = state.getSlotFloat({d});\n", .{ slot_id, rid }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        if (_anim_ts_{d} == 0) {\n" ++
        "            _anim_ts_{d} = now;\n" ++
        "            _anim_from_{d} = _cur_{d};\n" ++
        "            _anim_target_{d} = _target_{d};\n" ++
        "        }\n",
        .{ slot_id, slot_id, slot_id, slot_id, slot_id, slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        if (_anim_target_{d} != _target_{d}) {\n" ++
        "            _anim_ts_{d} = now;\n" ++
        "            _anim_from_{d} = _cur_{d};\n" ++
        "            _anim_target_{d} = _target_{d};\n" ++
        "        }\n",
        .{ slot_id, slot_id, slot_id, slot_id, slot_id, slot_id, slot_id }));

    if (hook.duration_ms == 0) {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "        if (_cur_{d} != _target_{d}) {{\n" ++
            "            state.setSlotFloat({d}, _target_{d});\n" ++
            "            _anim_from_{d} = _target_{d};\n" ++
            "            _anim_target_{d} = _target_{d};\n" ++
            "            _anim_ts_{d} = now;\n" ++
            "        }\n",
            .{ slot_id, slot_id, rid, slot_id, slot_id, slot_id, slot_id, slot_id, slot_id }));
        try out.appendSlice(self.alloc, "    }\n");
        return;
    }

    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        if (_cur_{d} != _target_{d}) {\n", .{ slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _elapsed_{d}: f64 = @as(f64, @floatFromInt(now - _anim_ts_{d}));\n", .{ slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _t_{d}: f64 = @min(@as(f64, 1.0), _elapsed_{d} / @as(f64, @floatFromInt({d})));\n",
        .{ slot_id, slot_id, hook.duration_ms }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _eased_t_{d}: f64 = {s};\n", .{ slot_id, eased_t }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _new_{d}: f64 = _anim_from_{d} + ((_anim_target_{d} - _anim_from_{d}) * _eased_t_{d});\n",
        .{ slot_id, slot_id, slot_id, slot_id, slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            state.setSlotFloat({d}, _new_{d});\n", .{ rid, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            if (_eased_t_{d} >= 1.0) {\n" ++
        "                state.setSlotFloat({d}, _anim_target_{d});\n" ++
        "                _anim_from_{d} = _anim_target_{d};\n" ++
        "                _anim_ts_{d} = now;\n" ++
        "            }\n" ++
        "        }\n",
        .{ slot_id, rid, slot_id, slot_id, slot_id, slot_id, slot_id }));
    try out.appendSlice(self.alloc, "    }\n");
}

fn emitSpringTick(self: *Generator, out: *std.ArrayListUnmanaged(u8), hook: codegen.AnimHook) !void {
    const slot_id = hook.slot_id;
    const rid = self.regularSlotId(slot_id);
    const vel_rid = self.regularSlotId(hook.vel_slot_id);

    try out.appendSlice(self.alloc, "    {\n");
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        const _target_{d}: f64 = {s};\n", .{ slot_id, hook.target_expr }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        const _cur_{d}: f64 = state.getSlotFloat({d});\n", .{ slot_id, rid }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        var _vel_{d}: f64 = state.getSlotFloat({d});\n", .{ slot_id, vel_rid }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        const _delta_{d}: f64 = _target_{d} - _cur_{d};\n", .{ slot_id, slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        if (@abs(_delta_{d}) <= 0.0001 and @abs(_vel_{d}) <= 0.0001) {\n" ++
        "            state.setSlotFloat({d}, 0.0);\n" ++
        "            if (_cur_{d} != _target_{d}) state.setSlotFloat({d}, _target_{d});\n" ++
        "        } else {\n",
        .{ slot_id, slot_id, vel_rid, slot_id, slot_id, rid, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _force_{d}: f64 = {d} * _delta_{d} - {d} * _vel_{d};\n",
        .{ slot_id, hook.stiffness, slot_id, hook.damping, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            _vel_{d} += _force_{d} * 0.016;\n", .{ slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            state.setSlotFloat({d}, _vel_{d});\n", .{ vel_rid, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            state.setSlotFloat({d}, _cur_{d} + _vel_{d} * 0.016);\n", .{ rid, slot_id, slot_id }));
    try out.appendSlice(self.alloc, "        }\n");
    try out.appendSlice(self.alloc, "    }\n");
}

pub fn emitZigSource(self: *Generator, root_expr: []const u8) ![]const u8 {
    var out: std.ArrayListUnmanaged(u8) = .{};

    // Header
    try out.appendSlice(self.alloc, "//! Generated by tsz compiler (Zig) — do not edit\n//!\n");
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "//! Source: {s}\n\n", .{std.fs.path.basename(self.input_file)}));

    // Module mode: emit a function returning a Node tree
    if (self.is_module) {
        return emitModuleSource(self, root_expr);
    }

    // ── Unused state detection ──
    // Check each state slot for any reference in dynamic texts, styles, handlers, or conditionals
    if (self.has_state) {
        for (0..self.state_count) |si| {
            const slot = self.state_slots[si];
            var getter_used = false;
            var setter_used = false;

            // Check dynamic text args for getter references
            for (0..self.dyn_count) |di| {
                if (std.mem.indexOf(u8, self.dyn_texts[di].fmt_args, slot.getter) != null) {
                    getter_used = true;
                    break;
                }
            }

            // Check dynamic style expressions for getter references
            if (!getter_used) {
                for (0..self.dyn_style_count) |dsi| {
                    if (std.mem.indexOf(u8, self.dyn_styles[dsi].expression, slot.getter) != null) {
                        getter_used = true;
                        break;
                    }
                }
            }

            // Check conditional expressions for getter references
            if (!getter_used) {
                for (0..self.conditional_count) |ci| {
                    if (std.mem.indexOf(u8, self.conditionals[ci].cond_expr, slot.getter) != null) {
                        getter_used = true;
                        break;
                    }
                }
            }

            // Check app conditionals for getter references
            if (!getter_used) {
                for (0..self.app_cond_count) |ci| {
                    if (std.mem.indexOf(u8, self.app_conds[ci].cond_expr, slot.getter) != null) {
                        getter_used = true;
                        break;
                    }
                }
            }

            // Check handler bodies for setter references
            for (self.handler_decls.items) |h| {
                if (std.mem.indexOf(u8, h, slot.setter) != null) {
                    setter_used = true;
                }
                if (std.mem.indexOf(u8, h, slot.getter) != null) {
                    getter_used = true;
                }
                if (getter_used and setter_used) break;
            }

            if (!getter_used or !setter_used) {
                const slot_read = try slotReadExpr(self, @intCast(si));
                for (0..self.anim_hook_count) |ai| {
                    const hook = self.anim_hooks[ai];
                    if (hook.slot_id == @as(u32, @intCast(si))) {
                        getter_used = true;
                        setter_used = true;
                    }
                    if (hook.kind == .spring and hook.vel_slot_id == @as(u32, @intCast(si))) {
                        getter_used = true;
                        setter_used = true;
                    }
                    if (std.mem.indexOf(u8, hook.target_expr, slot_read) != null) {
                        getter_used = true;
                    }
                    if (getter_used and setter_used) break;
                }
            }

            if (!getter_used and !setter_used) {
                const msg = std.fmt.allocPrint(self.alloc,
                    "state variable '{s}' (slot {d}) is never read or written — dead state",
                    .{ slot.getter, si }) catch "unused state variable";
                self.addWarning(0, msg);
            } else if (!getter_used) {
                const msg = std.fmt.allocPrint(self.alloc,
                    "state variable '{s}' (slot {d}) is written by '{s}' but never read in JSX — value is invisible",
                    .{ slot.getter, si, slot.setter }) catch "write-only state variable";
                self.addWarning(0, msg);
            } else if (!setter_used) {
                const msg = std.fmt.allocPrint(self.alloc,
                    "state variable '{s}' (slot {d}) is read in JSX but never written — value will never change",
                    .{ slot.getter, si }) catch "read-only state variable";
                self.addWarning(0, msg);
            }
        }
    }

    // ── Root binding pass ──
    // If the root node itself contains `.text = ""` (i.e. App returns a bare component
    // that inlines to a Text node — no parent array exists), bind unbound dyn texts to root.
    if (std.mem.indexOf(u8, root_expr, ".text = \"\"") != null) {
        for (0..self.dyn_count) |di| {
            if (!self.dyn_texts[di].has_ref) {
                self.dyn_texts[di].arr_name = ""; // stays empty — sentinel for "root"
                self.dyn_texts[di].has_ref = true;
            }
        }
    }
    // Same for dynamic styles on root
    if (self.dyn_style_count > 0) {
        for (0..self.dyn_style_count) |dsi| {
            if (!self.dyn_styles[dsi].has_ref) {
                // Check if root_expr contains the placeholder for this style
                const placeholder = if (std.mem.eql(u8, self.dyn_styles[dsi].field, "text_color"))
                    ".text_color = Color.rgb(0, 0, 0)"
                else
                    "";
                if (placeholder.len > 0 and std.mem.indexOf(u8, root_expr, placeholder) != null) {
                    self.dyn_styles[dsi].arr_name = "";
                    self.dyn_styles[dsi].has_ref = true;
                }
            }
        }
    }

    // ── Binding validation ──
    // Warn about dynamic texts that were never bound to a parent array
    for (0..self.dyn_count) |di| {
        if (!self.dyn_texts[di].has_ref) {
            const msg = std.fmt.allocPrint(self.alloc,
                "dynamic text #{d} (fmt: \"{s}\") was never bound to a node — will not update at runtime",
                .{ di, self.dyn_texts[di].fmt_string }) catch "unbound dynamic text";
            self.addWarning(0, msg);
        }
    }
    // Warn about dynamic styles that were never bound
    for (0..self.dyn_style_count) |dsi| {
        if (!self.dyn_styles[dsi].has_ref) {
            const msg = std.fmt.allocPrint(self.alloc,
                "dynamic style '{s}' was never bound to a node — will not update at runtime",
                .{self.dyn_styles[dsi].field}) catch "unbound dynamic style";
            self.addWarning(0, msg);
        }
    }
    // Warn about conditionals that were never bound to a parent array
    for (0..self.conditional_count) |ci| {
        if (self.conditionals[ci].arr_name.len == 0) {
            const msg = std.fmt.allocPrint(self.alloc,
                "conditional #{d} (expr: {s}) was never bound to a parent array",
                .{ ci, self.conditionals[ci].cond_expr }) catch "unbound conditional";
            self.addWarning(0, msg);
        }
    }

    // ── App mode: full binary with main loop ──

    // Imports
    try out.appendSlice(self.alloc, "const std = @import(\"std\");\n");
    try out.appendSlice(self.alloc, "const layout = @import(\"framework/layout.zig\");\n");
    try out.appendSlice(self.alloc, "const engine = @import(\"framework/engine.zig\");\n");
    try out.appendSlice(self.alloc, "const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n");
    if (self.has_state) try out.appendSlice(self.alloc, "const state = @import(\"framework/state.zig\");\n");
    if (self.has_routes) try out.appendSlice(self.alloc, "const router = @import(\"framework/router.zig\");\n");
    if (self.input_counter > 0) try out.appendSlice(self.alloc, "const input = @import(\"framework/input.zig\");\n");
    if (self.ffi_funcs.items.len > 0) try out.appendSlice(self.alloc, "const qjs_runtime = @import(\"framework/qjs_runtime.zig\");\n");

    // FFI imports
    if (self.ffi_headers.items.len > 0) {
        try out.appendSlice(self.alloc, "const ffi = @cImport({\n");
        for (self.ffi_headers.items) |h| {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    @cInclude(\"{s}\");\n", .{h}));
        }
        try out.appendSlice(self.alloc, "});\n");
    }
    try out.appendSlice(self.alloc, "\n");

    // FFI host function wrappers
    if (self.ffi_funcs.items.len > 0) {
        try out.appendSlice(self.alloc, "const qjs = @cImport({ @cDefine(\"_GNU_SOURCE\", \"1\"); @cDefine(\"QUICKJS_NG_BUILD\", \"1\"); @cInclude(\"quickjs.h\"); });\n");
        try out.appendSlice(self.alloc, "const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };\n\n");
        for (self.ffi_funcs.items) |func_name| {
            const argc = self.ffiArgCount(func_name);
            var call_args: std.ArrayListUnmanaged(u8) = .{};
            for (0..argc) |ai| {
                if (ai > 0) try call_args.appendSlice(self.alloc, ", ");
                try call_args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "args[{d}]", .{ai}));
            }
            if (argc == 0) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "fn _ffi_{s}(_: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, _: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {{\n" ++
                    "    const result = ffi.{s}();\n" ++
                    "    return qjs.JS_NewFloat64(null, @floatFromInt(result));\n" ++
                    "}}\n\n", .{ func_name, func_name }));
            } else {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "fn _ffi_{s}(ctx: ?*qjs.JSContext, _: qjs.JSValue, argc: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {{\n" ++
                    "    var args: [8]c_long = undefined;\n" ++
                    "    var i: usize = 0;\n" ++
                    "    while (i < @as(usize, @intCast(@max(0, argc))) and i < 8) : (i += 1) {{\n" ++
                    "        var v: f64 = 0;\n" ++
                    "        _ = qjs.JS_ToFloat64(ctx, &v, argv[i]);\n" ++
                    "        args[i] = @intFromFloat(v);\n" ++
                    "    }}\n" ++
                    "    const result = ffi.{s}({s});\n" ++
                    "    return qjs.JS_NewFloat64(ctx, @floatFromInt(result));\n" ++
                    "}}\n\n", .{ func_name, func_name, call_args.items }));
            }
        }
    }

    // State manifest — human-readable slot map for debugging
    if (self.has_state) {
        try out.appendSlice(self.alloc, "// ── State manifest ──────────────────────────────────────────────\n");
        for (0..self.state_count) |i| {
            const slot = self.state_slots[i];
            const type_name = switch (std.meta.activeTag(slot.initial)) {
                .int => "int",
                .float => "float",
                .boolean => "bool",
                .string => "string",
                .array => "array",
            };
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "// slot {d}: {s} ({s})\n", .{ i, slot.getter, type_name }));
        }
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "comptime {{ if ({d} != {d}) @compileError(\"state slot count mismatch\"); }}\n\n",
            .{ self.state_count, self.state_count }));
    }

    // ── @compileError breadcrumbs — catch unresolved bindings at zig build time ──
    {
        const basename = std.fs.path.basename(self.input_file);
        var breadcrumb_count: u32 = 0;
        for (0..self.dyn_count) |di| {
            if (!self.dyn_texts[di].has_ref) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "comptime {{ @compileError(\"{s}: dynamic text #{d} (fmt: '{s}') was never bound — will not update at runtime\"); }}\n",
                    .{ basename, di, self.dyn_texts[di].fmt_string }));
                breadcrumb_count += 1;
            }
        }
        for (0..self.dyn_style_count) |dsi| {
            if (!self.dyn_styles[dsi].has_ref) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "comptime {{ @compileError(\"{s}: dynamic style '{s}' was never bound — will not update at runtime\"); }}\n",
                    .{ basename, self.dyn_styles[dsi].field }));
                breadcrumb_count += 1;
            }
        }
        for (0..self.conditional_count) |ci| {
            if (self.conditionals[ci].arr_name.len == 0) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "comptime {{ @compileError(\"{s}: conditional (expr: {s}) was never bound to a parent array\"); }}\n",
                    .{ basename, self.conditionals[ci].cond_expr }));
                breadcrumb_count += 1;
            }
        }
        if (breadcrumb_count > 0) {
            try out.appendSlice(self.alloc, "\n");
        }
    }

    // Node tree
    try out.appendSlice(self.alloc, "// ── Generated node tree ─────────────────────────────────────────\n");
    for (self.array_decls.items) |decl| {
        try out.appendSlice(self.alloc, decl);
        try out.appendSlice(self.alloc, "\n");
    }
    try out.appendSlice(self.alloc, "var root = Node{");
    try out.appendSlice(self.alloc, root_expr[2..]);
    try out.appendSlice(self.alloc, ";\n");

    // Dynamic text buffers
    if (self.dyn_count > 0) {
        try out.appendSlice(self.alloc, "\n// ── Dynamic text buffers ─────────────────────────────────────────\n");
        for (0..self.dyn_count) |i| {
            const buf_size = Generator.estimateBufSize(self.dyn_texts[i].fmt_string);
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "var _dyn_buf_{d}: [{d}]u8 = undefined;\nvar _dyn_text_{d}: []const u8 = \"\";\n", .{ i, buf_size, i }));
        }
    }

    // Event handler functions
    if (self.handler_decls.items.len > 0) {
        try out.appendSlice(self.alloc, "\n// ── Event handlers ──────────────────────────────────────────────\n");
        for (self.handler_decls.items) |h| {
            try out.appendSlice(self.alloc, h);
            try out.appendSlice(self.alloc, "\n\n");
        }
    }

    // Component init functions
    if (self.comp_func_count > 0) {
        try out.appendSlice(self.alloc, "\n// ── Component init functions ────────────────────────────────────\n");
        for (0..self.comp_func_count) |fi| {
            try out.appendSlice(self.alloc, self.comp_funcs[fi].func_source);
            try out.appendSlice(self.alloc, "\n");
        }
    }

    // _initComponents
    if (self.comp_instance_count > 0) {
        try out.appendSlice(self.alloc, "fn _initComponents() void {\n");
        for (0..self.comp_instance_count) |ci| {
            const inst = self.comp_instances[ci];
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    {s}[{d}] = {s};\n", .{ inst.parent_arr, inst.parent_idx, inst.init_call }));
        }
        try out.appendSlice(self.alloc, "}\n\n");
    }

    // JS_LOGIC
    try out.appendSlice(self.alloc, "\n// ── Embedded JS logic ────────────────────────────────────────\n");
    try out.appendSlice(self.alloc, "const JS_LOGIC =\n");
    const js_source = self.compute_js orelse "";
    const rewritten = try collect.rewriteSetterCalls(self, js_source);
    var line_iter = std.mem.splitScalar(u8, rewritten, '\n');
    while (line_iter.next()) |line| {
        try out.appendSlice(self.alloc, "    \\\\");
        try out.appendSlice(self.alloc, line);
        try out.appendSlice(self.alloc, "\n");
    }
    try out.appendSlice(self.alloc, ";\n\n");

    // _initState
    try out.appendSlice(self.alloc, "fn _initState() void {\n");
    if (self.has_state) {
        for (0..self.state_count) |i| {
            const slot = self.state_slots[i];
            switch (slot.initial) {
                .int => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlot({d});\n", .{v})),
                .float => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlotFloat({d});\n", .{v})),
                .boolean => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlotBool({});\n", .{v})),
                .string => |v| try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    _ = state.createSlotString(\"{s}\");\n", .{v})),
                .array => |v| {
                    try out.appendSlice(self.alloc, "    _ = state.createArraySlot(&[_]i64{ ");
                    for (0..v.count) |j| {
                        if (j > 0) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{d}", .{v.values[j]}));
                    }
                    try out.appendSlice(self.alloc, " });\n");
                },
            }
        }
    }
    try out.appendSlice(self.alloc, "}\n\n");

    // _updateDynamicTexts
    try out.appendSlice(self.alloc, "fn _updateDynamicTexts() void {\n");
    for (0..self.dyn_count) |di| {
        const dt = &self.dyn_texts[di];
        if (!dt.has_ref) continue;
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    _dyn_text_{d} = std.fmt.bufPrint(&_dyn_buf_{d}, \"{s}\", .{{ {s} }}) catch \"\";\n",
            .{ dt.buf_id, dt.buf_id, dt.fmt_string, dt.fmt_args }));
        // arr_name="" means the text node is root itself (App returns a bare component that
        // inlines to a single Text — no child array exists, the node IS root)
        if (dt.arr_name.len == 0) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    root.text = _dyn_text_{d};\n", .{dt.buf_id}));
        } else {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}].text = _dyn_text_{d};\n",
                .{ dt.arr_name, dt.arr_index, dt.buf_id }));
        }
    }
    for (0..self.dyn_style_count) |dsi| {
        const ds = &self.dyn_styles[dsi];
        if (!ds.has_ref) continue;
        // arr_name="" means style is on root itself
        if (ds.arr_name.len == 0) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    root.{s} = {s};\n",
                .{ ds.field, ds.expression }));
        } else {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}].{s} = {s};\n",
                .{ ds.arr_name, ds.arr_index, ds.field, ds.expression }));
        }
    }
    try out.appendSlice(self.alloc, "}\n\n");

    // FFI timer variables
    for (0..self.ffi_hook_count) |hi| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "var _ffi_timer_{d}: u32 = 0;\n", .{hi}));
    }

    // Animation state variables
    for (0..self.anim_hook_count) |ai| {
        const hook = self.anim_hooks[ai];
        if (hook.kind == .transition) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "var _anim_ts_{d}: u32 = 0;\n" ++
                "var _anim_from_{d}: f64 = 0.0;\n" ++
                "var _anim_target_{d}: f64 = 0.0;\n",
                .{ hook.slot_id, hook.slot_id, hook.slot_id }));
        }
    }

    // Effect timer variables (for interval effects)
    for (0..self.effect_hook_count) |ei| {
        if (self.effect_hooks[ei].kind == .interval) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "var _effect_timer_{d}: u32 = 0;\n", .{ei}));
        }
    }

    // updateRoutes
    if (self.route_count > 0) {
        try out.appendSlice(self.alloc, "fn updateRoutes() void {\n");
        try out.appendSlice(self.alloc, "    const path = router.currentPath();\n");
        try out.appendSlice(self.alloc, "    const patterns = [_][]const u8{ ");
        for (0..self.route_count) |i| {
            if (i > 0) try out.appendSlice(self.alloc, ", ");
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "\"{s}\"", .{self.routes[i].path}));
        }
        try out.appendSlice(self.alloc, " };\n");
        try out.appendSlice(self.alloc, "    const best = router.findBestMatch(&patterns, path);\n");
        for (0..self.route_count) |i| {
            const r = self.routes[i];
            if (r.arr_name.len == 0) continue;
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}].style.display = .none;\n", .{ r.arr_name, r.child_idx }));
        }
        try out.appendSlice(self.alloc, "    if (best) |idx| {\n        switch (idx) {\n");
        for (0..self.route_count) |i| {
            const r = self.routes[i];
            if (r.arr_name.len == 0) continue;
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "            {d} => {{ {s}[{d}].style.display = .flex; }},\n", .{ i, r.arr_name, r.child_idx }));
        }
        try out.appendSlice(self.alloc, "            else => {},\n        }\n    }\n}\n\n");
    }

    // _updateConditionals
    const has_any_conds = self.conditional_count > 0 or self.app_cond_count > 0;
    if (has_any_conds) {
        try out.appendSlice(self.alloc, "fn _updateConditionals() void {\n");
        for (0..self.conditional_count) |ci| {
            const c = self.conditionals[ci];
            if (c.arr_name.len == 0) continue;
            switch (c.kind) {
                .show_hide => {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    {s}[{d}].style.display = if {s} .flex else .none;\n",
                        .{ c.arr_name, c.true_idx, c.cond_expr }));
                },
                .ternary => {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    {s}[{d}].style.display = if {s} .flex else .none;\n" ++
                        "    {s}[{d}].style.display = if {s} .none else .flex;\n",
                        .{ c.arr_name, c.true_idx, c.cond_expr, c.arr_name, c.false_idx, c.cond_expr }));
                },
            }
        }
        if (self.app_cond_count > 0) {
            const root_arr = try std.fmt.allocPrint(self.alloc, "_arr_{d}", .{self.array_counter - 1});
            for (0..self.app_cond_count) |ci| {
                const ac = self.app_conds[ci];
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}].style.display = if {s} .flex else .none;\n",
                    .{ root_arr, ac.child_idx, ac.cond_expr }));
            }
        }
        try out.appendSlice(self.alloc, "}\n\n");
    }

    // _appInit
    try out.appendSlice(self.alloc, "\nfn _appInit() void {\n    _initState();\n");
    for (0..self.input_counter) |i| {
        if (i < 16 and self.input_multiline[i]) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    input.registerMultiline({d});\n", .{i}));
        } else {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    input.register({d});\n", .{i}));
        }
    }
    if (self.comp_instance_count > 0) {
        try out.appendSlice(self.alloc, "    _initComponents();\n");
    }
    for (self.ffi_funcs.items) |func_name| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    qjs_runtime.registerHostFn(\"{s}\", @ptrCast(&_ffi_{s}), 8);\n", .{ func_name, func_name }));
    }
    if (self.dyn_count > 0 or self.dyn_style_count > 0) {
        try out.appendSlice(self.alloc, "    _updateDynamicTexts();\n");
    }
    if (self.has_routes) {
        // Init router to the first route's path so the default page is visible
        const init_path = if (self.route_count > 0) self.routes[0].path else "/";
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    router.init(\"{s}\");\n    updateRoutes();\n", .{init_path}));
    }
    if (has_any_conds) {
        try out.appendSlice(self.alloc, "    _updateConditionals();\n");
    }
    // Mount effects — run once at init
    for (0..self.effect_hook_count) |ei| {
        if (self.effect_hooks[ei].kind == .mount) {
            const body = try handlers.emitHandlerBody(self, self.effect_hooks[ei].body_start);
            if (body.len > 0) {
                try out.appendSlice(self.alloc, "    // useEffect mount\n");
                try out.appendSlice(self.alloc, body);
            }
        }
    }
    try out.appendSlice(self.alloc, "}\n\n");

    // _appTick
    try out.appendSlice(self.alloc, "fn _appTick(now: u32) void {\n");

    // Check if `now` is used by FFI hooks, animation hooks, or interval effects
    var needs_now = self.ffi_hook_count > 0 or self.anim_hook_count > 0;
    if (!needs_now) {
        for (0..self.effect_hook_count) |ei| {
            if (self.effect_hooks[ei].kind == .interval) { needs_now = true; break; }
        }
    }
    if (!needs_now) {
        try out.appendSlice(self.alloc, "    _ = now;\n");
    }

    // FFI polling
    if (self.ffi_hook_count > 0) {
        for (0..self.ffi_hook_count) |hi| {
            const hook = self.ffi_hooks[hi];
            const rid = self.regularSlotId(hook.slot_id);
            const set_fn = switch (hook.return_type) {
                .string => "state.setSlotString",
                .boolean => "state.setSlotBool",
                .float => "state.setSlotFloat",
                else => "state.setSlot",
            };
            const cast = switch (hook.return_type) {
                .string => "",
                .boolean => " != 0",
                .float => "",
                else => "",
            };
            const ffi_call = if (self.ffiArgCount(hook.ffi_func) == 0)
                try std.fmt.allocPrint(self.alloc, "ffi.{s}()", .{hook.ffi_func})
            else
                try std.fmt.allocPrint(self.alloc, "ffi.{s}(0)", .{hook.ffi_func});
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    if (now - _ffi_timer_{d} >= {d}) {{ {s}({d}, {s}{s}); _ffi_timer_{d} = now; }}\n",
                .{ hi, hook.interval_ms, set_fn, rid, ffi_call, cast, hi }));
        }
    }

    if (self.anim_hook_count > 0) {
        for (0..self.anim_hook_count) |ai| {
            const hook = self.anim_hooks[ai];
            switch (hook.kind) {
                .transition => try emitTransitionTick(self, &out, hook),
                .spring => try emitSpringTick(self, &out, hook),
            }
        }
    }

    if (self.has_routes) {
        try out.appendSlice(self.alloc, "    if (router.isDirty()) { updateRoutes(); router.clearDirty(); }\n");
    }

    // Frame effects — run every tick
    for (0..self.effect_hook_count) |ei| {
        if (self.effect_hooks[ei].kind == .frame) {
            const body = try handlers.emitHandlerBody(self, self.effect_hooks[ei].body_start);
            if (body.len > 0) {
                try out.appendSlice(self.alloc, "    // useEffect frame\n");
                try out.appendSlice(self.alloc, body);
            }
        }
    }

    // Interval effects — run every N ms
    for (0..self.effect_hook_count) |ei| {
        const eff = self.effect_hooks[ei];
        if (eff.kind == .interval) {
            const body = try handlers.emitHandlerBody(self, eff.body_start);
            if (body.len > 0) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    if (now - _effect_timer_{d} >= {d}) {{\n", .{ ei, eff.interval_ms }));
                try out.appendSlice(self.alloc, body);
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "        _effect_timer_{d} = now;\n    }}\n", .{ei}));
            }
        }
    }

    var has_per_frame_text = false;
    for (0..self.dyn_count) |di| {
        if (self.dyn_texts[di].dep_count == 0 and self.dyn_texts[di].has_ref) {
            has_per_frame_text = true;
            break;
        }
    }
    if (has_per_frame_text) {
        try out.appendSlice(self.alloc, "    _updateDynamicTexts();\n");
        if (has_any_conds) try out.appendSlice(self.alloc, "    _updateConditionals();\n");
        if (self.has_state) try out.appendSlice(self.alloc, "    if (state.isDirty()) state.clearDirty();\n");
    } else if (self.has_state and (self.dyn_count > 0 or self.dyn_style_count > 0 or has_any_conds)) {
        try out.appendSlice(self.alloc, "    if (state.isDirty()) { _updateDynamicTexts();");
        if (has_any_conds) try out.appendSlice(self.alloc, " _updateConditionals();");
        // Watch effects — run when watched state slots change
        for (0..self.effect_hook_count) |ei| {
            const eff = self.effect_hooks[ei];
            if (eff.kind == .watch) {
                const body = try handlers.emitHandlerBody(self, eff.body_start);
                if (body.len > 0) {
                    try out.appendSlice(self.alloc, "\n");
                    try out.appendSlice(self.alloc, body);
                }
            }
        }
        try out.appendSlice(self.alloc, " state.clearDirty(); }\n");
    } else if (self.has_state and has_any_conds) {
        try out.appendSlice(self.alloc, "    if (state.isDirty()) { _updateConditionals(); state.clearDirty(); }\n");
    } else if (self.has_state) {
        try out.appendSlice(self.alloc, "    if (state.isDirty()) state.clearDirty();\n");
    }
    // Watch effects when no dyn texts — need their own dirty check
    {
        var has_watch = false;
        for (0..self.effect_hook_count) |ei| {
            if (self.effect_hooks[ei].kind == .watch) { has_watch = true; break; }
        }
        if (has_watch and !has_per_frame_text and !(self.has_state and (self.dyn_count > 0 or self.dyn_style_count > 0 or has_any_conds))) {
            try out.appendSlice(self.alloc, "    if (state.isDirty()) {\n");
            for (0..self.effect_hook_count) |ei| {
                const eff = self.effect_hooks[ei];
                if (eff.kind == .watch) {
                    const body = try handlers.emitHandlerBody(self, eff.body_start);
                    if (body.len > 0) {
                        try out.appendSlice(self.alloc, "        // useEffect watch\n");
                        try out.appendSlice(self.alloc, body);
                    }
                }
            }
            try out.appendSlice(self.alloc, "        state.clearDirty();\n    }\n");
        }
    }
    try out.appendSlice(self.alloc, "}\n\n");

    // main
    {
        const basename = std.fs.path.basename(self.input_file);
        const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
        const app_name = basename[0..dot_pos];
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "pub fn main() !void {{\n" ++
            "    try engine.run(.{{\n" ++
            "        .title = \"{s}\",\n" ++
            "        .root = &root,\n" ++
            "        .js_logic = JS_LOGIC,\n" ++
            "        .init = _appInit,\n" ++
            "        .tick = _appTick,\n" ++
            "    }});\n" ++
            "}}\n", .{app_name}));
    }

    return try out.toOwnedSlice(self.alloc);
}

pub fn emitModuleSource(self: *Generator, root_expr: []const u8) ![]const u8 {
    var out: std.ArrayListUnmanaged(u8) = .{};

    try out.appendSlice(self.alloc, "//! Generated by tsz compiler (Zig) — do not edit\n//!\n");
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "//! Source: {s}\n\n", .{std.fs.path.basename(self.input_file)}));

    try out.appendSlice(self.alloc, "const layout = @import(\"framework/layout.zig\");\n");
    try out.appendSlice(self.alloc, "const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n\n");

    for (self.array_decls.items) |decl| {
        try out.appendSlice(self.alloc, decl);
        try out.appendSlice(self.alloc, "\n");
    }

    if (self.comp_func_count > 0) {
        try out.appendSlice(self.alloc, "\n");
        for (0..self.comp_func_count) |fi| {
            try out.appendSlice(self.alloc, self.comp_funcs[fi].func_source);
            try out.appendSlice(self.alloc, "\n");
        }
    }

    if (self.comp_instance_count > 0) {
        try out.appendSlice(self.alloc, "fn _initComponents() void {\n");
        for (0..self.comp_instance_count) |ci| {
            const inst = self.comp_instances[ci];
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}] = {s};\n", .{ inst.parent_arr, inst.parent_idx, inst.init_call }));
        }
        try out.appendSlice(self.alloc, "}\n\n");
    }

    try out.appendSlice(self.alloc, "pub fn render() Node {\n");
    if (self.comp_instance_count > 0) {
        try out.appendSlice(self.alloc, "    _initComponents();\n");
    }
    try out.appendSlice(self.alloc, "    return Node{");
    try out.appendSlice(self.alloc, root_expr[2..]);
    try out.appendSlice(self.alloc, ";\n}\n");

    return try out.toOwnedSlice(self.alloc);
}
