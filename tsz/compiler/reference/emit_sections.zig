//! Emit helpers — extracted sections from emit.zig to stay under 1600 lines.
//!
//! Contains: slot read helpers, transition/spring tick emission, animation helpers,
//! the tail of emitZigSource (_initState through main()), and emitModuleSource.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const collect = @import("collect.zig");
const handlers = @import("handlers.zig");
const emit_map = @import("emit_map.zig");

pub fn slotReadExpr(self: *Generator, slot_id: u32) ![]const u8 {
    const rid = self.regularSlotId(slot_id);
    return switch (self.stateTypeById(slot_id)) {
        .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
        .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
        .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
        else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
    };
}

pub fn easingExpr(alloc: std.mem.Allocator, easing: codegen.EasingKind, t_expr: []const u8) ![]const u8 {
    return switch (easing) {
        .linear => try alloc.dupe(u8, t_expr),
        .ease_in => try std.fmt.allocPrint(alloc, "(({s}) * ({s}))", .{ t_expr, t_expr }),
        .ease_out => try std.fmt.allocPrint(alloc, "(1.0 - ((1.0 - ({s})) * (1.0 - ({s}))))", .{ t_expr, t_expr }),
        .ease_in_out => try std.fmt.allocPrint(alloc,
            "(if (({s}) < 0.5) (2.0 * ({s}) * ({s})) else (1.0 - (((-2.0 * ({s})) + 2.0) * ((-2.0 * ({s})) + 2.0)) / 2.0))",
            .{ t_expr, t_expr, t_expr, t_expr, t_expr }),
    };
}

/// Check if any DynStyle has a CSS transition config (controls whether transition import is emitted).
pub fn hasAnyTransitions(self: *Generator) bool {
    for (0..self.dyn_style_count) |i| {
        if (self.dyn_styles[i].transition_config.len > 0) return true;
    }
    return false;
}

pub fn emitTransitionTick(self: *Generator, out: *std.ArrayListUnmanaged(u8), hook: codegen.AnimHook) !void {
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

pub fn emitSpringTick(self: *Generator, out: *std.ArrayListUnmanaged(u8), hook: codegen.AnimHook) !void {
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


/// Emit the tail of the generated Zig source: _initState, _updateDynamicTexts,
/// _updateConditionals, _appInit, _appTick, cartridge ABI, and main().
pub fn emitZigSourceTail(self: *Generator, out: *std.ArrayListUnmanaged(u8)) !void {
    // Pre-compute which dyn_texts reference map item data ([_i]) and must be
    // emitted inside _rebuildMap instead of _updateDynamicTexts
    var map_dep_dyn: [128]bool = [_]bool{false} ** 128;
    for (0..self.dyn_count) |di| {
        if (di < 128 and self.dyn_texts[di].has_ref and
            (std.mem.indexOf(u8, self.dyn_texts[di].fmt_args, "[_i]") != null or
            std.mem.indexOf(u8, self.dyn_texts[di].fmt_args, "_i)") != null or
            self.dyn_texts[di].map_claimed))
        {
            map_dep_dyn[di] = true;
        }
    }
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
        // Skip dyn_texts that reference map item data (_oa*[_i]) — these are
        // component text interpolations inside maps, emitted in _rebuildMap instead
        if (di < 128 and map_dep_dyn[di]) continue;
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
        // Skip per-item dynamic styles that reference _i — handled inline in pool_raw_expr or _rebuildMap
        if (ds.map_claimed) continue;
        if (std.mem.indexOf(u8, ds.expression, "_i") != null) continue;

        // CSS transition path: emit transition.set()/setSpring() instead of direct assignment
        if (ds.transition_config.len > 0) {
            const value_wrapper = if (ds.is_color) "color" else "float";
            const fn_name = if (ds.transition_is_spring) "setSpring" else "set";
            if (ds.arr_name.len == 0) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    transition.{s}(&_root, .{s}, .{{ .{s} = {s} }}, {s});\n",
                    .{ fn_name, ds.field, value_wrapper, ds.expression, ds.transition_config }));
            } else {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    transition.{s}(&{s}[{d}], .{s}, .{{ .{s} = {s} }}, {s});\n",
                    .{ fn_name, ds.arr_name, ds.arr_index, ds.field, value_wrapper, ds.expression, ds.transition_config }));
            }
            continue;
        }

        // f32 fields assigned from state slots need casting:
        // state.getSlot() returns i64 → @floatFromInt
        // state.getSlotFloat() returns f64 → @floatCast
        const needs_int_cast = std.mem.eql(u8, ds.field, "canvas_flow_speed");
        const is_scene3d_field = std.mem.startsWith(u8, ds.field, "scene3d_");
        // Color fields: i64 packed 0xRRGGBB → Color.rgb(r, g, b)
        // Only wrap if expression isn't already a Color.rgb() call (attrs.zig pre-wraps style colors)
        const is_color_field = (std.mem.eql(u8, ds.field, "text_color") or
            std.mem.eql(u8, ds.field, "background_color") or
            std.mem.eql(u8, ds.field, "border_color") or
            std.mem.eql(u8, ds.field, "shadow_color") or
            std.mem.eql(u8, ds.field, "gradient_color_end")) and
            !std.mem.startsWith(u8, ds.expression, "Color.rgb(") and
            std.mem.indexOf(u8, ds.expression, "Color.rgb(") == null;
        // scene3d fields: f32 direct node fields from f64 state.getSlotFloat → need @floatCast
        const needs_float_cast = is_scene3d_field;
        const expr = if (is_color_field)
            try std.fmt.allocPrint(self.alloc, "Color.rgb(@intCast(({s} >> 16) & 0xFF), @intCast(({s} >> 8) & 0xFF), @intCast({s} & 0xFF))", .{ ds.expression, ds.expression, ds.expression })
        else if (needs_float_cast)
            try std.fmt.allocPrint(self.alloc, "@floatCast({s})", .{ds.expression})
        else
            ds.expression;
        // arr_name="" means style is on root itself
        if (ds.arr_name.len == 0) {
            const is_root_style = !std.mem.eql(u8, ds.field, "text_color") and
                !std.mem.eql(u8, ds.field, "canvas_path_d") and
                !std.mem.eql(u8, ds.field, "canvas_flow_speed") and
                !std.mem.eql(u8, ds.field, "font_size") and
                !std.mem.eql(u8, ds.field, "opacity") and
                !is_scene3d_field;
            const root_acc = if (is_root_style) "_root.style." else "_root.";
            if (needs_int_cast) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}{s} = @floatFromInt({s});\n",
                    .{ root_acc, ds.field, expr }));
            } else {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}{s} = {s};\n",
                    .{ root_acc, ds.field, expr }));
            }
        } else {
            // Style fields (width, height, padding, etc.) live in Node.style
            // Node-level fields (text_color, canvas_flow_speed, scene3d_*) are direct
            const is_style_field = !std.mem.eql(u8, ds.field, "text_color") and
                !std.mem.eql(u8, ds.field, "canvas_path_d") and
                !std.mem.eql(u8, ds.field, "canvas_flow_speed") and
                !std.mem.eql(u8, ds.field, "font_size") and
                !std.mem.eql(u8, ds.field, "opacity") and
                !is_scene3d_field;
            const accessor = if (is_style_field) ".style." else ".";
            if (needs_int_cast) {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}]{s}{s} = @floatFromInt({s});\n",
                    .{ ds.arr_name, ds.arr_index, accessor, ds.field, expr }));
            } else {
                try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                    "    {s}[{d}]{s}{s} = {s};\n",
                    .{ ds.arr_name, ds.arr_index, accessor, ds.field, expr }));
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
        if (i < 16 and self.input_submit_handler[i].len > 0) {
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "    input.setOnSubmit({d}, {s});\n", .{ i, self.input_submit_handler[i] }));
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
            if (self.maps[mi].parent_map_idx >= 0) continue; // nested maps
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "    _rebuildMap{d}();\n", .{mi}));
        }
    }
    // Auto-register test functions from <zscript> (any fn named test_*)
    if (self.compute_zig) |zig_code| {
        try emit_map.emitTestRegistrations(self, out, zig_code);
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
                .transition => try emitTransitionTick(self, out, hook),
                .spring => try emitSpringTick(self, out, hook),
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

    const has_dirty_sources = self.has_state or self.object_array_count > 0;

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
        try emit_map.emitMapRebuildCalls(self, out,"    ");
        if (has_dirty_sources) try out.appendSlice(self.alloc, "    if (state.isDirty()) state.clearDirty();\n");
    } else if (has_dirty_sources and (self.dyn_count > 0 or self.dyn_style_count > 0 or has_any_conds or self.map_count > 0 or self.computed_count > 0)) {
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
            try emit_map.emitMapRebuildCalls(self, out,"        ");
        }
        try out.appendSlice(self.alloc, " state.clearDirty(); }\n");
    } else if (has_dirty_sources and has_any_conds) {
        try out.appendSlice(self.alloc, "    if (state.isDirty()) { _updateConditionals(); state.clearDirty(); }\n");
    } else if (has_dirty_sources) {
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
        // Export symbols for dlopen loading by the dev shell.
        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "export fn app_get_root() *Node {{ return &_root; }}\n" ++
            "export fn app_get_init() ?*const fn () void {{ return _appInit; }}\n" ++
            "export fn app_get_tick() ?*const fn (u32) void {{ return _appTick; }}\n" ++
            "export fn app_get_js_logic() [*]const u8 {{ return JS_LOGIC.ptr; }}\n" ++
            "export fn app_get_js_logic_len() usize {{ return JS_LOGIC.len; }}\n" ++
            "export fn app_get_lua_logic() [*]const u8 {{ return LUA_LOGIC.ptr; }}\n" ++
            "export fn app_get_lua_logic_len() usize {{ return LUA_LOGIC.len; }}\n" ++
            "export fn app_get_title() [*:0]const u8 {{ return \"{s}\"; }}\n", .{app_name}));

        // State preservation exports (for hot-reload state survival)
        {
            // Emit slot type array: 0=int, 1=float, 2=bool, 3=string, 4=array, 5=string_array
            const sc = self.state_count;
            try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                "\nexport fn app_state_count() usize {{ return {d}; }}\n", .{sc}));
            if (sc > 0) {
                try out.appendSlice(self.alloc, "const _slot_types = [_]u8{ ");
                for (0..sc) |i| {
                    if (i > 0) try out.appendSlice(self.alloc, ", ");
                    const t: u8 = switch (self.state_slots[i].initial) {
                        .int => 0, .float => 1, .boolean => 2, .string => 3, .array => 4, .string_array => 5,
                    };
                    try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{d}", .{t}));
                }
                try out.appendSlice(self.alloc, " };\n");
            }
            if (sc > 0) {
                try out.appendSlice(self.alloc,
                    "export fn app_state_slot_type(id: usize) u8 { " ++
                        "if (id < _slot_types.len) return _slot_types[id]; return 0; }\n" ++
                    "export fn app_state_get_int(id: usize) i64 { return state.getSlot(id); }\n" ++
                    "export fn app_state_set_int(id: usize, val: i64) void { state.setSlot(id, val); }\n" ++
                    "export fn app_state_get_float(id: usize) f64 { return state.getSlotFloat(id); }\n" ++
                    "export fn app_state_set_float(id: usize, val: f64) void { state.setSlotFloat(id, val); }\n" ++
                    "export fn app_state_get_bool(id: usize) u8 { return if (state.getSlotBool(id)) 1 else 0; }\n" ++
                    "export fn app_state_set_bool(id: usize, val: u8) void { state.setSlotBool(id, val != 0); }\n" ++
                    "export fn app_state_get_string_ptr(id: usize) [*]const u8 { return state.getSlotString(id).ptr; }\n" ++
                    "export fn app_state_get_string_len(id: usize) usize { return state.getSlotString(id).len; }\n" ++
                    "export fn app_state_set_string(id: usize, ptr: [*]const u8, len: usize) void { state.setSlotString(id, ptr[0..len]); }\n" ++
                    "export fn app_state_mark_dirty() void { state.markDirty(); }\n");
            }
        }

        try out.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "\n// Standalone mode — when compiled as an executable directly (skipped in .so builds)\n" ++
            "pub fn main() !void {{\n" ++
            "    if (IS_LIB) return;\n" ++
            "    try engine.run(.{{\n" ++
            "        .title = \"{s}\",\n" ++
            "        .root = &_root,\n" ++
            "        .js_logic = JS_LOGIC,\n" ++
            "        .lua_logic = LUA_LOGIC,\n" ++
            "        .init = _appInit,\n" ++
            "        .tick = _appTick,\n" ++
            "    }});\n" ++
            "}}\n", .{app_name}));
    }

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

/// Setup passes: unused state detection, root/late binding, binding validation.
/// Runs before any code emission. Modifies Generator fields only (no output).
pub fn emitSetupPasses(self: *Generator, root_expr: []const u8) !void {
    // ── Unused state detection ──
    // Check each state slot for any reference in dynamic texts, styles, handlers, or conditionals
    if (self.has_state) {
        for (0..self.state_count) |si| {
            const slot = self.state_slots[si];
            var getter_used = false;
            var setter_used = false;

            // useFFI slots are written by the Zig FFI tick, not a JS setter
            for (0..self.ffi_hook_count) |hi| {
                if (self.ffi_hooks[hi].slot_id == @as(u32, @intCast(si))) {
                    setter_used = true;
                    break;
                }
            }

            // Check dynamic text args for getter references (raw name OR compiled state.getSlot form)
            {
                const slot_expr = try slotReadExpr(self, @intCast(si));
                for (0..self.dyn_count) |di| {
                    if (std.mem.indexOf(u8, self.dyn_texts[di].fmt_args, slot.getter) != null or
                        std.mem.indexOf(u8, self.dyn_texts[di].fmt_args, slot_expr) != null)
                    {
                        getter_used = true;
                        break;
                    }
                }
            }

            // Check dynamic style expressions for getter references
            // Expressions are already compiled: `mode` → `state.getSlot(0)`, so check both forms
            if (!getter_used) {
                const slot_expr = try slotReadExpr(self, @intCast(si));
                for (0..self.dyn_style_count) |dsi| {
                    if (std.mem.indexOf(u8, self.dyn_styles[dsi].expression, slot.getter) != null or
                        std.mem.indexOf(u8, self.dyn_styles[dsi].expression, slot_expr) != null)
                    {
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

            // Check handler bodies for setter/getter references
            // Handlers are already compiled: setMode(v) → state.setSlot(N, v), so check both forms
            {
                const rid = self.regularSlotId(@intCast(si));
                const slot_set_prefix = try std.fmt.allocPrint(self.alloc, "state.setSlot({d},", .{rid});
                const slot_read = try slotReadExpr(self, @intCast(si));
                for (self.handler_decls.items) |h| {
                    if (std.mem.indexOf(u8, h, slot.setter) != null or
                        std.mem.indexOf(u8, h, slot_set_prefix) != null)
                    {
                        setter_used = true;
                    }
                    if (std.mem.indexOf(u8, h, slot.getter) != null or
                        std.mem.indexOf(u8, h, slot_read) != null)
                    {
                        getter_used = true;
                    }
                    if (getter_used and setter_used) break;
                }
            }

            // Check embedded <script> logic for setter/getter references.
            // compute_js stores the original script source, so the raw getter/setter names
            // are the correct forms to search for here.
            if (!getter_used or !setter_used) {
                if (self.compute_js) |js| {
                    if (!setter_used and std.mem.indexOf(u8, js, slot.setter) != null) {
                        setter_used = true;
                    }
                    if (!getter_used and std.mem.indexOf(u8, js, slot.getter) != null) {
                        getter_used = true;
                    }
                }
            }

            // Check embedded <zscript> logic for setter/getter references.
            if (!getter_used or !setter_used) {
                if (self.compute_zig) |zig_code| {
                    if (!setter_used and std.mem.indexOf(u8, zig_code, slot.setter) != null) {
                        setter_used = true;
                    }
                    if (!getter_used and std.mem.indexOf(u8, zig_code, slot.getter) != null) {
                        getter_used = true;
                    }
                }
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
                else if (std.mem.eql(u8, self.dyn_styles[dsi].field, "canvas_path_d"))
                    ".canvas_path_d = \"0\""
                else if (std.mem.eql(u8, self.dyn_styles[dsi].field, "canvas_flow_speed"))
                    ".canvas_flow_speed = 0"
                else if (self.dyn_styles[dsi].is_color)
                    (std.fmt.allocPrint(self.alloc, ".{s} = Color{{}}", .{self.dyn_styles[dsi].field}) catch "")
                else
                    (std.fmt.allocPrint(self.alloc, ".{s} = 0", .{self.dyn_styles[dsi].field}) catch "");
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
            const placeholder = if (std.mem.eql(u8, field, "canvas_path_d"))
                (self.alloc.dupe(u8, ".canvas_path_d = \"0\"") catch continue)
            else
                (std.fmt.allocPrint(self.alloc, ".{s} = 0", .{field}) catch continue);
            const color_placeholder = if (self.dyn_styles[dsi].is_color)
                (std.fmt.allocPrint(self.alloc, ".{s} = Color{{}}", .{field}) catch "")
            else
                "";
            for (self.array_decls.items) |decl| {
                // Find all placeholder occurrences, skip already-claimed ones
                var search_start: usize = 0;
                while (true) {
                    const ph_pos = blk: {
                        const p1 = if (search_start < decl.len)
                            std.mem.indexOf(u8, decl[search_start..], placeholder)
                        else
                            null;
                        const p2 = if (color_placeholder.len > 0 and search_start < decl.len)
                            std.mem.indexOf(u8, decl[search_start..], color_placeholder)
                        else
                            null;
                        // Pick the earliest match
                        if (p1) |a| {
                            if (p2) |b| {
                                break :blk @min(a, b) + search_start;
                            }
                            break :blk a + search_start;
                        }
                        if (p2) |b| break :blk b + search_start;
                        break :blk @as(?usize, null);
                    };
                    if (ph_pos == null) break;

                    // Extract array name: "var _arr_N = ..."
                    const vs = std.mem.indexOf(u8, decl, "var ") orelse break;
                    const es = std.mem.indexOf(u8, decl[vs + 4 ..], " =") orelse break;
                    const arr_name = decl[vs + 4 .. vs + 4 + es];
                    // Find element index: count Node elements before the placeholder
                    const arr_start = std.mem.indexOf(u8, decl, "[_]Node{ ") orelse break;
                    const before_placeholder = decl[arr_start..ph_pos.?];
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
                    // Check if this arr_name+elem_idx is already claimed by another dyn_style
                    var already_claimed = false;
                    for (0..self.dyn_style_count) |other| {
                        if (other != dsi and self.dyn_styles[other].has_ref and
                            std.mem.eql(u8, self.dyn_styles[other].arr_name, arr_name) and
                            self.dyn_styles[other].arr_index == elem_idx and
                            std.mem.eql(u8, self.dyn_styles[other].field, field))
                        {
                            already_claimed = true;
                            break;
                        }
                    }
                    if (!already_claimed) {
                        self.dyn_styles[dsi].arr_name = arr_name;
                        self.dyn_styles[dsi].arr_index = elem_idx;
                        self.dyn_styles[dsi].has_ref = true;
                        break;
                    }
                    // Skip past this occurrence and try next
                    search_start = ph_pos.? + 1;
                }
                if (self.dyn_styles[dsi].has_ref) break;
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
        if (!self.dyn_styles[dsi].has_ref and !self.dyn_styles[dsi].map_claimed) {
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

}
