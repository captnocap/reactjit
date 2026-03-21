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
        "        if (_anim_ts_{d} == 0) {{\n" ++
        "            _anim_ts_{d} = now;\n" ++
        "            _anim_from_{d} = _cur_{d};\n" ++
        "            _anim_target_{d} = _target_{d};\n" ++
        "        }}\n",
        .{ slot_id, slot_id, slot_id, slot_id, slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        if (_anim_target_{d} != _target_{d}) {{\n" ++
        "            _anim_ts_{d} = now;\n" ++
        "            _anim_from_{d} = _cur_{d};\n" ++
        "            _anim_target_{d} = _target_{d};\n" ++
        "        }}\n",
        .{ slot_id, slot_id, slot_id, slot_id, slot_id, slot_id, slot_id }));

    if (hook.duration_ms == 0) {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "        if (_cur_{d} != _target_{d}) {{\n" ++
            "            state.setSlotFloat({d}, _target_{d});\n" ++
            "            _anim_from_{d} = _target_{d};\n" ++
            "            _anim_target_{d} = _target_{d};\n" ++
            "            _anim_ts_{d} = now;\n" ++
            "        }}\n",
            .{ slot_id, slot_id, rid, slot_id, slot_id, slot_id, slot_id, slot_id, slot_id }));
        try out.appendSlice(self.alloc, "    }\n");
        return;
    }

    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "        if (_cur_{d} != _target_{d}) {{\n", .{ slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _elapsed_{d}: f64 = @as(f64, @floatFromInt(now - _anim_ts_{d}));\n", .{ slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _t_{d}: f64 = @min(@as(f64, 1.0), _elapsed_{d} / @as(f64, @floatFromInt({d})));\n",
        .{ slot_id, slot_id, hook.duration_ms }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _eased_t_{d}: f64 = {s};\n", .{ slot_id, eased_t }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            const _new_{d}: f64 = _anim_from_{d} + ((_anim_target_{d} - _anim_from_{d}) * _eased_t_{d});\n",
        .{ slot_id, slot_id, slot_id, slot_id, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            state.setSlotFloat({d}, _new_{d});\n", .{ rid, slot_id }));
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
        "            if (_eased_t_{d} >= 1.0) {{\n" ++
        "                state.setSlotFloat({d}, _anim_target_{d});\n" ++
        "                _anim_from_{d} = _anim_target_{d};\n" ++
        "                _anim_ts_{d} = now;\n" ++
        "            }}\n" ++
        "        }}\n",
        .{ slot_id, rid, slot_id, slot_id, slot_id, slot_id }));
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
        "        if (@abs(_delta_{d}) <= 0.0001 and @abs(_vel_{d}) <= 0.0001) {{\n" ++
        "            state.setSlotFloat({d}, 0.0);\n" ++
        "            if (_cur_{d} != _target_{d}) state.setSlotFloat({d}, _target_{d});\n" ++
        "        }} else {{\n",
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
                else if (std.mem.eql(u8, self.dyn_styles[dsi].field, "canvas_flow_speed"))
                    ".canvas_flow_speed = 0"
                else
                    "";
                if (placeholder.len > 0 and std.mem.indexOf(u8, root_expr, placeholder) != null) {
                    self.dyn_styles[dsi].arr_name = "";
                    self.dyn_styles[dsi].has_ref = true;
                }
            }
        }
    }

    // ── Late binding pass for dynamic styles in nested arrays ──
    // Styles registered during component inlining may not be bound by the parent's
    // child_exprs scan. Scan ALL emitted arrays to find unbound dynamic styles.
    for (0..self.dyn_style_count) |dsi| {
        if (!self.dyn_styles[dsi].has_ref) {
            const field = self.dyn_styles[dsi].field;
            const placeholder = std.fmt.allocPrint(self.alloc, ".{s} = 0", .{field}) catch continue;
            for (self.array_decls.items) |decl| {
                if (std.mem.indexOf(u8, decl, placeholder)) |_| {
                    // Extract array name: "var _arr_N = ..."
                    if (std.mem.indexOf(u8, decl, "var ")) |vs| {
                        if (std.mem.indexOf(u8, decl[vs + 4 ..], " =")) |es| {
                            const arr_name = decl[vs + 4 .. vs + 4 + es];
                            // Find element index: count Node elements before the placeholder
                            const arr_start = std.mem.indexOf(u8, decl, "[_]Node{ ") orelse continue;
                            const before_placeholder = decl[arr_start .. std.mem.indexOf(u8, decl, placeholder).?];
                            var elem_idx: u32 = 0;
                            var bi: usize = 0;
                            while (bi < before_placeholder.len) {
                                if (bi + 3 < before_placeholder.len and
                                    before_placeholder[bi] == '.' and before_placeholder[bi + 1] == '{' and before_placeholder[bi + 2] == ' ')
                                {
                                    elem_idx += 1;
                                }
                                bi += 1;
                            }
                            if (elem_idx > 0) elem_idx -= 1; // .{ that contains the placeholder is the target
                            self.dyn_styles[dsi].arr_name = arr_name;
                            self.dyn_styles[dsi].arr_index = elem_idx;
                            self.dyn_styles[dsi].has_ref = true;
                            break;
                        }
                    }
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

    // Imports — embedded mode uses framework-relative paths and isolated state
    const prefix = if (self.is_embedded) "" else "framework/";
    try out.appendSlice(self.alloc, "const std = @import(\"std\");\n");
    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const layout = @import(\"{s}layout.zig\");\n", .{prefix}));
    if (!self.is_embedded) try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const engine = @import(\"{s}engine.zig\");\n", .{prefix}));
    try out.appendSlice(self.alloc, "const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n");
    if (self.has_state) {
        const state_mod = if (self.is_embedded) "devtools_state.zig" else "framework/state.zig";
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const state = @import(\"{s}\");\n", .{state_mod}));
    }
    if (self.has_routes) try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const router = @import(\"{s}router.zig\");\n", .{prefix}));
    if (self.input_counter > 0) try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const input = @import(\"{s}input.zig\");\n", .{prefix}));
    if (self.has_theme) try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const Theme = @import(\"{s}theme.zig\");\n", .{prefix}));
    if (self.has_breakpoints) try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const breakpoint = @import(\"{s}breakpoint.zig\");\n", .{prefix}));
    if (self.ffi_funcs.items.len > 0 or self.compute_js != null or self.object_array_count > 0) try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const qjs_runtime = @import(\"{s}qjs_runtime.zig\");\n", .{prefix}));
    if (self.compute_zig != null) {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const testharness = @import(\"{s}testharness.zig\");\n", .{prefix}));
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const query = @import(\"{s}query.zig\");\n", .{prefix}));
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "const testassert = @import(\"{s}testassert.zig\");\n", .{prefix}));
    }

    // FFI imports
    if (self.ffi_headers.items.len > 0) {
        try out.appendSlice(self.alloc, "const ffi = @cImport({\n");
        for (self.ffi_headers.items) |h| {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    @cInclude(\"{s}\");\n", .{h}));
        }
        try out.appendSlice(self.alloc, "});\n");
    }
    try out.appendSlice(self.alloc, "\n");

    // Variant style arrays — one array per classifier that has variants (no bp)
    if (self.variant_update_count > 0) {
        try out.appendSlice(self.alloc, "// ── Layout variant styles ───────────────────────────────────────\n");
        for (0..self.classifier_count) |ci| {
            if (!self.classifier_has_variants[ci] or self.classifier_bp_idx[ci] != null) continue;
            const cls_name = self.classifier_names[ci];
            const total_variants = @as(u32, self.variant_count) + 1;
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "const _cls_{s}_v = [_]Style{{ ", .{cls_name}));
            for (0..total_variants) |vi| {
                if (vi > 0) try out.appendSlice(self.alloc, ", ");
                const vs = self.classifier_variant_styles[ci][vi];
                if (vs.len > 0) {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        ".{{ {s} }}", .{vs}));
                } else {
                    const base = self.classifier_variant_styles[ci][0];
                    if (base.len > 0) {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".{{ {s} }}", .{base}));
                    } else {
                        try out.appendSlice(self.alloc, ".{}");
                    }
                }
            }
            try out.appendSlice(self.alloc, " };\n");
        }
        try out.appendSlice(self.alloc, "\n");
    }

    // Breakpoint style arrays — [4]Style or [4][N]Style per classifier with bp:
    // Breakpoint style arrays — [4]Style or [4][N]Style per classifier with bp:
    if (self.has_breakpoints) {
        try out.appendSlice(self.alloc, "// ── Breakpoint styles ───────────────────────────────────────────\n");
        var bp_emitted_names: [codegen.MAX_BP_CLASSIFIERS][]const u8 = .{""} ** codegen.MAX_BP_CLASSIFIERS;
        var bp_emitted_count: u32 = 0;
        for (0..self.classifier_count) |ci| {
            const bs_idx = self.classifier_bp_idx[ci] orelse continue;
            const cls_name = self.classifier_names[ci];
            // Dedup by name — same classifier imported from multiple files
            var already = false;
            for (0..bp_emitted_count) |ei| {
                if (std.mem.eql(u8, bp_emitted_names[ei], cls_name)) { already = true; break; }
            }
            if (already) continue;
            if (bp_emitted_count < codegen.MAX_BP_CLASSIFIERS) {
                bp_emitted_names[bp_emitted_count] = cls_name;
                bp_emitted_count += 1;
            }
            const has_any_variants = self.classifier_has_variants[ci] or
                self.bp_has_variants[bs_idx][0] or self.bp_has_variants[bs_idx][1] or
                self.bp_has_variants[bs_idx][2] or self.bp_has_variants[bs_idx][3];

            if (has_any_variants) {
                const total_variants = @as(u32, self.variant_count) + 1;
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "const _cls_{s}_bp = [4][{d}]Style{{ ", .{ cls_name, total_variants }));
                for (0..4) |ti| {
                    if (ti > 0) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, ".{ ");
                    for (0..total_variants) |vi| {
                        if (vi > 0) try out.appendSlice(self.alloc, ", ");
                        const vs = self.bp_variant_styles[bs_idx][ti][vi];
                        if (vs.len > 0) {
                            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{vs}));
                        } else {
                            const base = self.bp_styles[bs_idx][ti];
                            if (base.len > 0) {
                                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{base}));
                            } else {
                                try out.appendSlice(self.alloc, ".{}");
                            }
                        }
                    }
                    try out.appendSlice(self.alloc, " }");
                }
                try out.appendSlice(self.alloc, " };\n");
            } else {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "const _cls_{s}_bp = [4]Style{{ ", .{cls_name}));
                for (0..4) |ti| {
                    if (ti > 0) try out.appendSlice(self.alloc, ", ");
                    const bps = self.bp_styles[bs_idx][ti];
                    if (bps.len > 0) {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{bps}));
                    } else {
                        try out.appendSlice(self.alloc, ".{}");
                    }
                }
                try out.appendSlice(self.alloc, " };\n");
            }
        }
        try out.appendSlice(self.alloc, "\n");
    }

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
                .string_array => "string_array",
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
    try out.appendSlice(self.alloc, if (self.is_embedded) "pub var _root = Node{" else "var _root = Node{");
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

    // Computed arrays (.filter() / .split() results)
    if (self.computed_count > 0) {
        try out.appendSlice(self.alloc, "\n// ── Computed arrays ─────────────────────────────────────────────\n");
        for (0..self.computed_count) |ci| {
            const ca = self.computed_arrays[ci];
            switch (ca.kind) {
                .filter => {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "const MAX_COMPUTED_{d}: usize = 256;\n" ++
                        "var _computed_{d}: [MAX_COMPUTED_{d}]i64 = undefined;\n" ++
                        "var _computed_{d}_count: usize = 0;\n",
                        .{ ci, ci, ci, ci }));
                },
                .split => {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "const MAX_COMPUTED_{d}: usize = 64;\n" ++
                        "var _computed_{d}: [MAX_COMPUTED_{d}][]const u8 = undefined;\n" ++
                        "var _computed_{d}_count: usize = 0;\n",
                        .{ ci, ci, ci, ci }));
                },
            }
        }
    }

    // Object arrays (useState([{...}]) — parallel heap-allocated arrays per field)
    if (self.object_array_count > 0) {
        // Ensure qjs import exists for the unpack host functions
        if (self.ffi_funcs.items.len == 0) {
            try out.appendSlice(self.alloc, "const qjs = @cImport({ @cDefine(\"_GNU_SOURCE\", \"1\"); @cDefine(\"QUICKJS_NG_BUILD\", \"1\"); @cInclude(\"quickjs.h\"); });\n");
            try out.appendSlice(self.alloc, "const QJS_UNDEFINED = qjs.JSValue{ .u = .{ .int32 = 0 }, .tag = 3 };\n");
        }
        try out.appendSlice(self.alloc, "\n// ── Object arrays ───────────────────────────────────────────────\n");
        try out.appendSlice(self.alloc, "const _oa_alloc = std.heap.page_allocator;\n\n");

        for (0..self.object_array_count) |oi| {
            const oa = self.object_arrays[oi];

            // Per-field parallel arrays
            for (0..oa.field_count) |fi| {
                const f = oa.fields[fi];
                switch (f.field_type) {
                    .string => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "var _oa{d}_{s}: [][256]u8 = &[_][256]u8{{}};\n" ++
                            "var _oa{d}_{s}_lens: []u16 = &[_]u16{{}};\n" ++
                            "var _oa{d}_{s}_cap: usize = 0;\n",
                            .{ oi, f.name, oi, f.name, oi, f.name }));
                    },
                    .float => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "var _oa{d}_{s}: []f64 = &[_]f64{{}};\n" ++
                            "var _oa{d}_{s}_cap: usize = 0;\n",
                            .{ oi, f.name, oi, f.name }));
                    },
                    else => { // int, boolean
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "var _oa{d}_{s}: []i64 = &[_]i64{{}};\n" ++
                            "var _oa{d}_{s}_cap: usize = 0;\n",
                            .{ oi, f.name, oi, f.name }));
                    },
                }
            }
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "var _oa{d}_count: usize = 0;\n" ++
                "var _oa{d}_dirty: bool = false;\n\n",
                .{ oi, oi }));

            // ensureCapacity function
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "fn _oa{d}_ensureCapacity(needed: usize) void {{\n" ++
                "    if (needed <= _oa{d}_{s}_cap) return;\n" ++
                "    const new_cap = @max(needed, if (_oa{d}_{s}_cap == 0) @as(usize, 64) else _oa{d}_{s}_cap * 2);\n",
                .{ oi, oi, oa.fields[0].name, oi, oa.fields[0].name, oi, oa.fields[0].name }));

            for (0..oa.field_count) |fi| {
                const f = oa.fields[fi];
                switch (f.field_type) {
                    .string => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    if (_oa{d}_{s}_cap == 0) {{\n" ++
                            "        _oa{d}_{s} = _oa_alloc.alloc([256]u8, new_cap) catch return;\n" ++
                            "        _oa{d}_{s}_lens = _oa_alloc.alloc(u16, new_cap) catch return;\n" ++
                            "        @memset(_oa{d}_{s}_lens, 0);\n" ++
                            "    }} else {{\n" ++
                            "        _oa{d}_{s} = _oa_alloc.realloc(_oa{d}_{s}.ptr[0.._oa{d}_{s}_cap], new_cap) catch return;\n" ++
                            "        _oa{d}_{s}_lens = _oa_alloc.realloc(_oa{d}_{s}_lens.ptr[0.._oa{d}_{s}_cap], new_cap) catch return;\n" ++
                            "        @memset(_oa{d}_{s}_lens[_oa{d}_{s}_cap..new_cap], 0);\n" ++
                            "    }}\n" ++
                            "    _oa{d}_{s}_cap = new_cap;\n",
                            .{ oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name }));
                    },
                    .float => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    if (_oa{d}_{s}_cap == 0) {{\n" ++
                            "        _oa{d}_{s} = _oa_alloc.alloc(f64, new_cap) catch return;\n" ++
                            "        @memset(_oa{d}_{s}, 0.0);\n" ++
                            "    }} else {{\n" ++
                            "        _oa{d}_{s} = _oa_alloc.realloc(_oa{d}_{s}.ptr[0.._oa{d}_{s}_cap], new_cap) catch return;\n" ++
                            "        @memset(_oa{d}_{s}[_oa{d}_{s}_cap..new_cap], 0.0);\n" ++
                            "    }}\n" ++
                            "    _oa{d}_{s}_cap = new_cap;\n",
                            .{ oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name }));
                    },
                    else => { // int, boolean
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "    if (_oa{d}_{s}_cap == 0) {{\n" ++
                            "        _oa{d}_{s} = _oa_alloc.alloc(i64, new_cap) catch return;\n" ++
                            "        @memset(_oa{d}_{s}, 0);\n" ++
                            "    }} else {{\n" ++
                            "        _oa{d}_{s} = _oa_alloc.realloc(_oa{d}_{s}.ptr[0.._oa{d}_{s}_cap], new_cap) catch return;\n" ++
                            "        @memset(_oa{d}_{s}[_oa{d}_{s}_cap..new_cap], 0);\n" ++
                            "    }}\n" ++
                            "    _oa{d}_{s}_cap = new_cap;\n",
                            .{ oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name, oi, f.name }));
                    },
                }
            }
            try out.appendSlice(self.alloc, "}\n\n");

            // Unpack host function: reads JS array of objects, writes to parallel arrays
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "fn _oa{d}_unpack(ctx: ?*qjs.JSContext, _: qjs.JSValue, _: c_int, argv: [*c]qjs.JSValue) callconv(.c) qjs.JSValue {{\n" ++
                "    const c2 = ctx orelse return QJS_UNDEFINED;\n" ++
                "    const arr = argv[0];\n" ++
                "    const len_val = qjs.JS_GetPropertyStr(c2, arr, \"length\");\n" ++
                "    var arr_len: i32 = 0;\n" ++
                "    _ = qjs.JS_ToInt32(c2, &arr_len, len_val);\n" ++
                "    qjs.JS_FreeValue(c2, len_val);\n" ++
                "    const count: usize = @intCast(@max(0, arr_len));\n" ++
                "    _oa{d}_ensureCapacity(count);\n" ++
                "    for (0..count) |_i| {{\n" ++
                "        const elem = qjs.JS_GetPropertyUint32(c2, arr, @intCast(_i));\n",
                .{ oi, oi }));

            // Per-field extraction
            for (0..oa.field_count) |fi| {
                const f = oa.fields[fi];
                switch (f.field_type) {
                    .string => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {{ const _v = qjs.JS_GetPropertyStr(c2, elem, \"{s}\");\n" ++
                            "        const _s = qjs.JS_ToCString(c2, _v);\n" ++
                            "        qjs.JS_FreeValue(c2, _v);\n" ++
                            "        if (_s) |ss| {{ const sl = std.mem.span(ss); const n = @min(sl.len, 255); @memcpy(_oa{d}_{s}[_i][0..n], sl[0..n]); _oa{d}_{s}_lens[_i] = @intCast(n); qjs.JS_FreeCString(c2, _s); }}\n" ++
                            "        else {{ _oa{d}_{s}_lens[_i] = 0; }} }}\n",
                            .{ f.name, oi, f.name, oi, f.name, oi, f.name }));
                    },
                    .float => {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {{ const _v = qjs.JS_GetPropertyStr(c2, elem, \"{s}\");\n" ++
                            "        var _f: f64 = 0; _ = qjs.JS_ToFloat64(c2, &_f, _v);\n" ++
                            "        qjs.JS_FreeValue(c2, _v); _oa{d}_{s}[_i] = _f; }}\n",
                            .{ f.name, oi, f.name }));
                    },
                    else => { // int, boolean
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "        {{ const _v = qjs.JS_GetPropertyStr(c2, elem, \"{s}\");\n" ++
                            "        var _n: i64 = 0; _ = qjs.JS_ToInt64(c2, &_n, _v);\n" ++
                            "        qjs.JS_FreeValue(c2, _v); _oa{d}_{s}[_i] = _n; }}\n",
                            .{ f.name, oi, f.name }));
                    },
                }
            }

            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "        qjs.JS_FreeValue(c2, elem);\n" ++
                "    }}\n" ++
                "    _oa{d}_count = count;\n" ++
                "    _oa{d}_dirty = true;\n" ++
                "    state.markDirty();\n" ++
                "    return QJS_UNDEFINED;\n" ++
                "}}\n\n",
                .{ oi, oi }));
        }
    }

    // Map pools
    if (self.map_count > 0) {
        try out.appendSlice(self.alloc, "\n// ── Map pools ───────────────────────────────────────────────────\n");
        for (0..self.map_count) |mi| {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "const MAX_MAP_{d}: usize = 256;\n" ++
                "var _map_pool_{d}: [MAX_MAP_{d}]Node = [_]Node{{.{{}}}} ** MAX_MAP_{d};\n" ++
                "var _map_count_{d}: usize = 0;\n",
                .{ mi, mi, mi, mi, mi }));
            const m = self.maps[mi];
            if (m.inner_count > 0 and !m.is_self_closing) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "var _map_inner_{d}: [MAX_MAP_{d}][{d}]Node = undefined;\n",
                    .{ mi, mi, m.inner_count }));
            }
            var has_dyn_text = false;
            for (0..m.inner_count) |ni| {
                if (m.inner_nodes[ni].is_dynamic_text) { has_dyn_text = true; break; }
            }
            if (has_dyn_text) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "var _map_text_bufs_{d}: [MAX_MAP_{d}][256]u8 = undefined;\n" ++
                    "var _map_texts_{d}: [MAX_MAP_{d}][]const u8 = [_][]const u8{{\"\"}} ** MAX_MAP_{d};\n",
                    .{ mi, mi, mi, mi, mi }));
            }
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

    // Computed array rebuild functions
    if (self.computed_count > 0) {
        try out.appendSlice(self.alloc, "\n// ── Computed array rebuild ──────────────────────────────────────\n");
        for (0..self.computed_count) |ci| {
            const ca = self.computed_arrays[ci];
            switch (ca.kind) {
                .filter => {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "fn _rebuildComputed{d}() void {{\n" ++
                        "    const _src = state.getArraySlot({d});\n" ++
                        "    _computed_{d}_count = 0;\n" ++
                        "    for (_src) |_item| {{\n" ++
                        "        if ({s}) {{\n" ++
                        "            _computed_{d}[_computed_{d}_count] = _item;\n" ++
                        "            _computed_{d}_count += 1;\n" ++
                        "            if (_computed_{d}_count >= MAX_COMPUTED_{d}) break;\n" ++
                        "        }}\n" ++
                        "    }}\n" ++
                        "}}\n\n",
                        .{ ci, ca.source_slot, ci, ca.predicate_expr, ci, ci, ci, ci, ci }));
                },
                .split => {
                    const sep_char: u8 = if (ca.separator.len > 0) ca.separator[0] else ',';
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "fn _rebuildComputed{d}() void {{\n" ++
                        "    const _str = state.getSlotString({d});\n" ++
                        "    _computed_{d}_count = 0;\n" ++
                        "    var _iter = std.mem.splitScalar(u8, _str, '{c}');\n" ++
                        "    while (_iter.next()) |_part| {{\n" ++
                        "        if (_computed_{d}_count >= MAX_COMPUTED_{d}) break;\n" ++
                        "        _computed_{d}[_computed_{d}_count] = _part;\n" ++
                        "        _computed_{d}_count += 1;\n" ++
                        "    }}\n" ++
                        "}}\n\n",
                        .{ ci, ca.source_slot, ci, sep_char, ci, ci, ci, ci, ci }));
                },
            }
        }
    }

    // Map rebuild functions
    if (self.map_count > 0) {
        for (0..self.map_count) |mi| {
            const m = self.maps[mi];
            if (m.parent_arr_name.len == 0) continue;

            if (m.is_computed) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "fn _rebuildMap{d}() void {{\n" ++
                    "    const items = _computed_{d}[0.._computed_{d}_count];\n" ++
                    "    _map_count_{d} = @min(items.len, MAX_MAP_{d});\n" ++
                    "    for (0.._map_count_{d}) |_i| {{\n" ++
                    "        const _item = items[_i];\n",
                    .{ mi, m.computed_idx, m.computed_idx, mi, mi, mi }));
            } else if (m.is_string_array) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "fn _rebuildMap{d}() void {{\n" ++
                    "    const _sa_len = state.getStringArrayLen({d});\n" ++
                    "    _map_count_{d} = @min(_sa_len, MAX_MAP_{d});\n" ++
                    "    for (0.._map_count_{d}) |_i| {{\n" ++
                    "        const _item = state.getStringArrayElement({d}, _i);\n",
                    .{ mi, m.string_array_slot_id, mi, mi, mi, m.string_array_slot_id }));
            } else {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "fn _rebuildMap{d}() void {{\n" ++
                    "    const items = state.getArraySlot({d});\n" ++
                    "    _map_count_{d} = @min(items.len, MAX_MAP_{d});\n" ++
                    "    for (0.._map_count_{d}) |_i| {{\n" ++
                    "        const _item = items[_i];\n",
                    .{ mi, m.array_slot_id, mi, mi, mi }));
            }

            // Find dynamic text in inner nodes
            var has_dyn_text = false;
            var dyn_ni: u32 = 0;
            for (0..m.inner_count) |ni| {
                if (m.inner_nodes[ni].is_dynamic_text) {
                    has_dyn_text = true;
                    dyn_ni = @intCast(ni);
                    break;
                }
            }

            if (has_dyn_text) {
                if (m.is_string_array) {
                    // String array: _item is already []const u8, assign directly
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "        _map_texts_{d}[_i] = _item;\n", .{mi}));
                } else {
                    const inner = m.inner_nodes[dyn_ni];
                    // Rewrite template args: replace item param with _item, index param with _i
                    const rewritten_args = try rewriteMapArgs(self, inner.text_args, m.item_param, m.index_param);
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "        _map_texts_{d}[_i] = std.fmt.bufPrint(&_map_text_bufs_{d}[_i], \"{s}\", .{{ {s} }}) catch \"\";\n",
                        .{ mi, mi, inner.text_fmt, rewritten_args }));
                }
            }

            // Emit inner children array assignment
            if (m.inner_count > 0 and !m.is_self_closing) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "        _map_inner_{d}[_i] = [{d}]Node{{ ", .{ mi, m.inner_count }));
                for (0..m.inner_count) |ni| {
                    const inner = m.inner_nodes[ni];
                    if (ni > 0) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, ".{ ");
                    var has_field = false;
                    if (inner.is_dynamic_text) {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".text = _map_texts_{d}[_i]", .{mi}));
                        has_field = true;
                    } else if (inner.static_text.len > 0) {
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".text = \"{s}\"", .{inner.static_text}));
                        has_field = true;
                    }
                    if (inner.font_size.len > 0) {
                        if (has_field) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".font_size = {s}", .{inner.font_size}));
                        has_field = true;
                    }
                    if (inner.text_color.len > 0) {
                        if (has_field) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".text_color = {s}", .{inner.text_color}));
                        has_field = true;
                    }
                    if (inner.style.len > 0) {
                        if (has_field) try out.appendSlice(self.alloc, ", ");
                        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            ".style = .{{ {s} }}", .{inner.style}));
                    }
                    try out.appendSlice(self.alloc, " }");
                }
                try out.appendSlice(self.alloc, " };\n");
            }

            // Emit pool node
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "        _map_pool_{d}[_i] = .{{ ", .{mi}));
            var has_outer_field = false;
            if (m.outer_style.len > 0) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    ".style = .{{ {s} }}", .{m.outer_style}));
                has_outer_field = true;
            }
            if (m.is_text_element and m.inner_count > 0) {
                const inner = m.inner_nodes[0];
                if (inner.is_dynamic_text) {
                    if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        ".text = _map_texts_{d}[_i]", .{mi}));
                    has_outer_field = true;
                } else if (inner.static_text.len > 0) {
                    if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        ".text = \"{s}\"", .{inner.static_text}));
                    has_outer_field = true;
                }
                if (m.outer_font_size.len > 0) {
                    if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        ".font_size = {s}", .{m.outer_font_size}));
                    has_outer_field = true;
                }
                if (m.outer_text_color.len > 0) {
                    if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        ".text_color = {s}", .{m.outer_text_color}));
                    has_outer_field = true;
                }
            } else if (m.inner_count > 0 and !m.is_self_closing) {
                if (has_outer_field) try out.appendSlice(self.alloc, ", ");
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    ".children = &_map_inner_{d}[_i]", .{mi}));
            }
            try out.appendSlice(self.alloc, " };\n");

            // Close for loop
            try out.appendSlice(self.alloc, "    }\n");

            // Update parent children slice
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}].children = _map_pool_{d}[0.._map_count_{d}];\n",
                .{ m.parent_arr_name, m.child_idx, mi, mi }));

            try out.appendSlice(self.alloc, "}\n\n");
        }
    }

    // Embedded Zig logic (<zscript> block)
    if (self.compute_zig) |zig_code| {
        try out.appendSlice(self.alloc, "\n// ── Embedded Zig logic (<zscript>) ──────────────────────────\n");
        try out.appendSlice(self.alloc, zig_code);
        try out.appendSlice(self.alloc, "\n\n");
    }

    // JS_LOGIC
    try out.appendSlice(self.alloc, "\n// ── Embedded JS logic ────────────────────────────────────────\n");
    try out.appendSlice(self.alloc, if (self.is_embedded) "pub const JS_LOGIC =\n" else "const JS_LOGIC =\n");
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
    try out.appendSlice(self.alloc, if (self.is_embedded) "pub fn _initState() void {\n" else "fn _initState() void {\n");
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
                .string_array => {
                    try out.appendSlice(self.alloc, "    _ = state.createStringArraySlot();\n");
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
                "    _root.text = _dyn_text_{d};\n", .{dt.buf_id}));
        } else {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}].text = _dyn_text_{d};\n",
                .{ dt.arr_name, dt.arr_index, dt.buf_id }));
        }
    }
    for (0..self.dyn_style_count) |dsi| {
        const ds = &self.dyn_styles[dsi];
        if (!ds.has_ref) continue;
        // f32 fields assigned from state slots need casting:
        // state.getSlot() returns i64 → @floatFromInt
        // state.getSlotFloat() returns f64 → @floatCast
        const needs_int_cast = std.mem.eql(u8, ds.field, "canvas_flow_speed");
        // arr_name="" means style is on root itself
        if (ds.arr_name.len == 0) {
            const is_root_style = !std.mem.eql(u8, ds.field, "text_color") and
                !std.mem.eql(u8, ds.field, "canvas_flow_speed") and
                !std.mem.eql(u8, ds.field, "font_size") and
                !std.mem.eql(u8, ds.field, "opacity");
            const root_acc = if (is_root_style) "_root.style." else "_root.";
            if (needs_int_cast) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}{s} = @floatFromInt({s});\n",
                    .{ root_acc, ds.field, ds.expression }));
            } else {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}{s} = {s};\n",
                    .{ root_acc, ds.field, ds.expression }));
            }
        } else {
            // Style fields (width, height, padding, etc.) live in Node.style
            // Node-level fields (text_color, canvas_flow_speed) are direct
            const is_style_field = !std.mem.eql(u8, ds.field, "text_color") and
                !std.mem.eql(u8, ds.field, "canvas_flow_speed") and
                !std.mem.eql(u8, ds.field, "font_size") and
                !std.mem.eql(u8, ds.field, "opacity");
            const accessor = if (is_style_field) ".style." else ".";
            if (needs_int_cast) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}]{s}{s} = @floatFromInt({s});\n",
                    .{ ds.arr_name, ds.arr_index, accessor, ds.field, ds.expression }));
            } else {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}]{s}{s} = {s};\n",
                    .{ ds.arr_name, ds.arr_index, accessor, ds.field, ds.expression }));
            }
        }
    }
    // Variant/breakpoint style assignments — swap entire style block each frame
    for (0..self.variant_update_count) |vi| {
        const vu = &self.variant_updates[vi];
        if (vu.arr_name.len == 0) continue;
        const cls_name = self.classifier_names[vu.classifier_idx];
        const has_bp = self.classifier_bp_idx[vu.classifier_idx] != null;
        const has_variants = self.classifier_has_variants[vu.classifier_idx];

        if (has_bp and has_variants) {
            // 2D: breakpoint × variant
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}].style = _cls_{s}_bp[@intFromEnum(breakpoint.current())][Theme.activeVariant()];\n",
                .{ vu.arr_name, vu.arr_index, cls_name }));
        } else if (has_bp) {
            // 1D: breakpoint only
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}].style = _cls_{s}_bp[@intFromEnum(breakpoint.current())];\n",
                .{ vu.arr_name, vu.arr_index, cls_name }));
        } else {
            // 1D: variant only
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    {s}[{d}].style = _cls_{s}_v[Theme.activeVariant()];\n",
                .{ vu.arr_name, vu.arr_index, cls_name }));
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
            // Wrap condition in parens + != 0 for integer state slots
            const is_already_bool = std.mem.indexOf(u8, c.cond_expr, "!=") != null or
                std.mem.indexOf(u8, c.cond_expr, "==") != null or
                std.mem.indexOf(u8, c.cond_expr, ">=") != null or
                std.mem.indexOf(u8, c.cond_expr, "<=") != null or
                std.mem.indexOf(u8, c.cond_expr, " > ") != null or
                std.mem.indexOf(u8, c.cond_expr, " < ") != null or
                std.mem.indexOf(u8, c.cond_expr, " and ") != null or
                std.mem.indexOf(u8, c.cond_expr, "getBool") != null;
            const cond = if (is_already_bool)
                try std.fmt.allocPrint(self.alloc, "({s})", .{c.cond_expr})
            else
                try std.fmt.allocPrint(self.alloc, "(({s}) != 0)", .{c.cond_expr});
            switch (c.kind) {
                .show_hide => {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    {s}[{d}].style.display = if {s} .flex else .none;\n",
                        .{ c.arr_name, c.true_idx, cond }));
                },
                .ternary => {
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "    {s}[{d}].style.display = if {s} .flex else .none;\n" ++
                        "    {s}[{d}].style.display = if {s} .none else .flex;\n",
                        .{ c.arr_name, c.true_idx, cond, c.arr_name, c.false_idx, cond }));
                },
            }
        }
        if (self.app_cond_count > 0) {
            const root_arr = try std.fmt.allocPrint(self.alloc, "_arr_{d}", .{self.array_counter - 1});
            for (0..self.app_cond_count) |ci| {
                const ac = self.app_conds[ci];
                const ac_is_bool = std.mem.indexOf(u8, ac.cond_expr, "!=") != null or
                    std.mem.indexOf(u8, ac.cond_expr, "==") != null or
                    std.mem.indexOf(u8, ac.cond_expr, ">=") != null or
                    std.mem.indexOf(u8, ac.cond_expr, "<=") != null or
                    std.mem.indexOf(u8, ac.cond_expr, " > ") != null or
                    std.mem.indexOf(u8, ac.cond_expr, " < ") != null or
                    std.mem.indexOf(u8, ac.cond_expr, " and ") != null or
                    std.mem.indexOf(u8, ac.cond_expr, "getBool") != null;
                const ac_cond = if (ac_is_bool)
                    try std.fmt.allocPrint(self.alloc, "({s})", .{ac.cond_expr})
                else
                    try std.fmt.allocPrint(self.alloc, "(({s}) != 0)", .{ac.cond_expr});
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}].style.display = if {s} .flex else .none;\n",
                    .{ root_arr, ac.child_idx, ac_cond }));
            }
        }
        try out.appendSlice(self.alloc, "}\n\n");
    }

    // _appInit
    try out.appendSlice(self.alloc, if (self.is_embedded) "\npub fn _appInit() void {\n    _initState();\n" else "\nfn _appInit() void {\n    _initState();\n");
    for (0..self.input_counter) |i| {
        if (i < 16 and self.input_multiline[i]) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    input.registerMultiline({d});\n", .{i}));
        } else {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    input.register({d});\n", .{i}));
        }
        if (i < 16 and self.input_change_handler[i].len > 0) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    input.setOnChange({d}, {s});\n", .{ i, self.input_change_handler[i] }));
        }
    }
    if (self.comp_instance_count > 0) {
        try out.appendSlice(self.alloc, "    _initComponents();\n");
    }
    for (self.ffi_funcs.items) |func_name| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    qjs_runtime.registerHostFn(\"{s}\", @ptrCast(&_ffi_{s}), 8);\n", .{ func_name, func_name }));
    }
    for (0..self.object_array_count) |oi| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "    qjs_runtime.registerHostFn(\"__setObjArr{d}\", @ptrCast(&_oa{d}_unpack), 1);\n", .{ oi, oi }));
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
    if (self.computed_count > 0) {
        for (0..self.computed_count) |ci| {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    _rebuildComputed{d}();\n", .{ci}));
        }
    }
    if (self.map_count > 0) {
        for (0..self.map_count) |mi| {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    _rebuildMap{d}();\n", .{mi}));
        }
    }
    // Auto-register test functions from <zscript> (any fn named test_*)
    if (self.compute_zig) |zig_code| {
        try emitTestRegistrations(self, &out, zig_code);
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
    try out.appendSlice(self.alloc, if (self.is_embedded) "pub fn _appTick(now: u32) void {\n" else "fn _appTick(now: u32) void {\n");

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
    if (self.has_breakpoints) {
        try out.appendSlice(self.alloc, "    if (breakpoint.isDirty()) { _updateDynamicTexts(); breakpoint.clearDirty(); }\n");
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
        try emitMapRebuildCalls(self, &out, "    ");
        if (self.has_state) try out.appendSlice(self.alloc, "    if (state.isDirty()) state.clearDirty();\n");
    } else if (self.has_state and (self.dyn_count > 0 or self.dyn_style_count > 0 or has_any_conds or self.map_count > 0 or self.computed_count > 0)) {
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
        if (self.map_count > 0) {
            try out.appendSlice(self.alloc, "\n");
            try emitMapRebuildCalls(self, &out, "        ");
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

    // main (skip in embedded mode — the engine manages the lifecycle)
    if (!self.is_embedded) {
        const basename = std.fs.path.basename(self.input_file);
        const dot_pos = std.mem.lastIndexOfScalar(u8, basename, '.') orelse basename.len;
        const app_name = basename[0..dot_pos];
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "pub fn main() !void {{\n" ++
            "    try engine.run(.{{\n" ++
            "        .title = \"{s}\",\n" ++
            "        .root = &_root,\n" ++
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
    try out.appendSlice(self.alloc, "const Node = layout.Node;\nconst Style = layout.Style;\nconst Color = layout.Color;\n");
    if (self.has_theme) try out.appendSlice(self.alloc, "const Theme = @import(\"framework/theme.zig\");\n");
    try out.appendSlice(self.alloc, "\n");

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

// ── Map helpers ──────────────────────────────────────────────────────

/// Emit _rebuildComputedN() + _rebuildMapN() calls (used in _appInit and _appTick).
fn emitMapRebuildCalls(self: *Generator, out: *std.ArrayListUnmanaged(u8), pad: []const u8) !void {
    for (0..self.computed_count) |ci| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "{s}_rebuildComputed{d}();\n", .{ pad, ci }));
    }
    for (0..self.map_count) |mi| {
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "{s}_rebuildMap{d}();\n", .{ pad, mi }));
    }
}

/// Rewrite template args: replace item/index param names with _item/_i.
/// E.g. if item_param is "task" and text_args is "@intCast(task)",
/// we need to emit "@intCast(_item)" so the generated for-loop variable works.
fn rewriteMapArgs(self: *Generator, text_args: []const u8, item_param: []const u8, index_param: ?[]const u8) ![]const u8 {
    var result: []const u8 = text_args;
    // Replace item param with _item
    if (item_param.len > 0) {
        result = try replaceIdent(self.alloc, result, item_param, "_item");
    }
    // Replace index param with _i
    if (index_param) |idx| {
        if (idx.len > 0) {
            result = try replaceIdent(self.alloc, result, idx, "_i");
        }
    }
    return result;
}

/// Replace whole-word occurrences of `needle` with `replacement` in `text`.
/// Only replaces when needle is at a word boundary (not inside an identifier).
fn replaceIdent(alloc: std.mem.Allocator, text: []const u8, needle: []const u8, replacement: []const u8) ![]const u8 {
    if (needle.len == 0 or text.len < needle.len) return text;
    var result: std.ArrayListUnmanaged(u8) = .{};
    var i: usize = 0;
    while (i <= text.len - needle.len) {
        if (std.mem.eql(u8, text[i .. i + needle.len], needle)) {
            // Check word boundary before
            const before_ok = i == 0 or !isIdentByte(text[i - 1]);
            // Check word boundary after
            const after_ok = (i + needle.len >= text.len) or !isIdentByte(text[i + needle.len]);
            if (before_ok and after_ok) {
                try result.appendSlice(alloc, replacement);
                i += needle.len;
                continue;
            }
        }
        try result.append(alloc, text[i]);
        i += 1;
    }
    // Append remaining bytes
    if (i < text.len) {
        try result.appendSlice(alloc, text[i..]);
    }
    return result.items;
}

fn isIdentByte(ch: u8) bool {
    return (ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or (ch >= '0' and ch <= '9') or ch == '_';
}

/// Scan <zscript> contents for `fn test_*` function definitions and emit
/// testharness.register() calls for each one in _appInit.
fn emitTestRegistrations(self: *Generator, out: *std.ArrayListUnmanaged(u8), zig_code: []const u8) !void {
    // Scan for "fn test_" patterns
    const needle = "fn test_";
    var i: usize = 0;
    var found_any = false;
    while (i + needle.len < zig_code.len) : (i += 1) {
        if (std.mem.eql(u8, zig_code[i .. i + needle.len], needle)) {
            // Check word boundary before "fn"
            if (i > 0 and isIdentByte(zig_code[i - 1])) continue;

            // Extract function name: fn test_foo(
            const name_start = i + 3; // skip "fn "
            var name_end = name_start;
            while (name_end < zig_code.len and isIdentByte(zig_code[name_end])) name_end += 1;
            const func_name = zig_code[name_start..name_end];

            if (func_name.len > 0) {
                if (!found_any) {
                    try out.appendSlice(self.alloc, "    // Auto-registered tests from <zscript>\n");
                    found_any = true;
                }
                // Convert test_foo_bar to "foo bar" for display
                const display_name = try testDisplayName(self.alloc, func_name);
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    testharness.register(\"{s}\", {s});\n", .{ display_name, func_name }));
            }
        }
    }
}

/// Convert "test_map_renders_items" → "map renders items" for test display.
fn testDisplayName(alloc: std.mem.Allocator, name: []const u8) ![]const u8 {
    // Strip "test_" prefix
    const stripped = if (std.mem.startsWith(u8, name, "test_")) name[5..] else name;
    var result: std.ArrayListUnmanaged(u8) = .{};
    for (stripped) |ch| {
        try result.append(alloc, if (ch == '_') ' ' else ch);
    }
    return result.items;
}
