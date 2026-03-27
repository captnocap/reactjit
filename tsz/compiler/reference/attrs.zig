//! Attribute parsing — styles, strings, expressions, template literals, colors.
//!
//! Leaf functions called by jsx.zig during JSX element parsing.
//! Also contains style key mappings and CSS normalization helpers.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const emit_map = @import("emit_map.zig");

// ── Style parsing ──

/// Parse a style attribute value and return Zig struct fields.
///
/// Handles both style={...} and style={{...}} (double-brace JSX convention).
/// Input tokens: { { backgroundColor: '#ff0000', padding: 16, flexDirection: 'row' } }
/// Output string: ".background_color = Color.rgb(255, 0, 0), .padding = 16, .flex_direction = .row"
///
/// Style keys are dispatched through 4 mapping functions:
///   mapColorKey   → color fields (backgroundColor → .background_color = Color.rgb(...))
///   mapStyleKeyI16 → i16 fields (zIndex → .z_index = N)
///   mapStyleKey   → f32 fields (width, padding, margin, etc.)
///   mapEnumKey    → enum fields (flexDirection → .flex_direction = .row)
/// Unknown keys trigger a warning (possible typo).
pub fn parseStyleAttr(self: *Generator) ![]const u8 {
    if (self.curKind() == .lbrace) self.advance_token();
    var double_brace = false;
    if (self.curKind() == .lbrace) { self.advance_token(); double_brace = true; }

    var fields: std.ArrayListUnmanaged(u8) = .{};

    // Track which DynStyles are created in this style block (for transition tagging)
    const dyn_style_start = self.dyn_style_count;
    // Transition configs parsed from the 'transition' key (applied after loop)
    var trans_fields: [16][]const u8 = undefined; // Zig field names
    var trans_configs: [16][]const u8 = undefined; // Zig TransitionConfig literals
    var trans_is_color: [16]bool = undefined;
    var trans_is_spring: [16]bool = undefined;
    var trans_count: u32 = 0;

    while (self.curKind() != .rbrace and self.curKind() != .eof) {
        if (self.curKind() == .identifier or self.curKind() == .string) {
            var key = self.curText();
            const is_string_key = self.curKind() == .string;
            self.advance_token();
            if (is_string_key and key.len >= 2) key = key[1 .. key.len - 1];
            if (std.mem.indexOf(u8, key, "-") != null) {
                key = kebabToCamel(self.alloc, key) catch key;
            }
            if (self.curKind() == .colon) self.advance_token();

            if (mapColorKey(key)) |color_field| {
                if (self.curKind() == .string) {
                    const val = try parseStringAttrInline(self);
                    const color = try parseColorValue(self, val);
                    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                    try fields.appendSlice(self.alloc, ".");
                    try fields.appendSlice(self.alloc, color_field);
                    try fields.appendSlice(self.alloc, " = ");
                    try fields.appendSlice(self.alloc, color);
                } else {
                    // Non-string color — could be prop (hex string) or item.field (packed int)
                    const val = consumeStyleValueExpr(self);
                    // State getter in a color field → dynamic color binding
                    if (std.mem.indexOf(u8, val, "state.getSlot") != null or
                        std.mem.indexOf(u8, val, "state.getSlotFloat") != null)
                    {
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, color_field);
                        try fields.appendSlice(self.alloc, " = Color{}");
                        // Register dynamic color style for runtime update
                        if (self.dyn_style_count < codegen.MAX_DYN_STYLES) {
                            const color_expr = try std.fmt.allocPrint(self.alloc,
                                "Color.rgb(@intCast(({s} >> 16) & 0xFF), @intCast(({s} >> 8) & 0xFF), @intCast({s} & 0xFF))",
                                .{ val, val, val });
                            self.dyn_styles[self.dyn_style_count] = .{
                                .field = color_field,
                                .expression = color_expr,
                                .arr_name = "",
                                .arr_index = 0,
                                .has_ref = false,
                                .is_color = true,
                            };
                            self.dyn_style_count += 1;
                        }
                    } else {
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, color_field);
                        // Check if resolved value is a quoted hex string (from prop)
                        if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) {
                            const inner_hex = val[1 .. val.len - 1];
                            const color = try parseColorValue(self, inner_hex);
                            try fields.appendSlice(self.alloc, " = ");
                            try fields.appendSlice(self.alloc, color);
                        } else {
                            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                " = Color.rgb(@intCast(({s} >> 16) & 0xFF), @intCast(({s} >> 8) & 0xFF), @intCast({s} & 0xFF))",
                                .{ val, val, val }));
                        }
                    }
                }
            } else if (mapStyleKeyI16(key)) |zig_key| {
                const val = consumeStyleValueExpr(self);
                if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                try fields.appendSlice(self.alloc, ".");
                try fields.appendSlice(self.alloc, zig_key);
                try fields.appendSlice(self.alloc, " = ");
                try fields.appendSlice(self.alloc, val);
            } else if (mapStyleKey(key)) |zig_key| {
                if (self.curKind() == .string) {
                    const str_val = try parseStringAttrInline(self);
                    if (std.mem.eql(u8, str_val, "auto")) {
                        // margin auto: encode as inf sentinel for layout engine
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, zig_key);
                        try fields.appendSlice(self.alloc, " = std.math.inf(f32)");
                    } else if (std.mem.startsWith(u8, str_val, "theme-")) {
                        if (parseStyleTokenValue(self, str_val[6..])) |expr| {
                            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                            try fields.appendSlice(self.alloc, ".");
                            try fields.appendSlice(self.alloc, zig_key);
                            try fields.appendSlice(self.alloc, " = ");
                            try fields.appendSlice(self.alloc, expr);
                        }
                    } else if (std.mem.endsWith(u8, str_val, "%")) {
                        if (std.fmt.parseFloat(f32, str_val[0 .. str_val.len - 1]) catch null) |pct| {
                            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                            try fields.appendSlice(self.alloc, ".");
                            try fields.appendSlice(self.alloc, zig_key);
                            try fields.appendSlice(self.alloc, " = ");
                            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{d}", .{-(pct / 100.0)}));
                        }
                    } else if (parseCSSValue(str_val)) |px| {
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, zig_key);
                        try fields.appendSlice(self.alloc, " = ");
                        try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "{d}", .{px}));
                    }
                } else {
                    const val = consumeStyleValueExpr(self);
                    // State getter in a style field → dynamic style binding
                    if (std.mem.indexOf(u8, val, "state.getSlot") != null or
                        std.mem.indexOf(u8, val, "state.getSlotFloat") != null)
                    {
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, zig_key);
                        try fields.appendSlice(self.alloc, " = 0");
                        // Register dynamic style for runtime update
                        if (self.dyn_style_count < codegen.MAX_DYN_STYLES) {
                            // Ternary branches already have typed values (@as(i64, N) or float);
                            // non-ternary state.getSlot() returns i64 → needs @floatFromInt
                            const expr = if (std.mem.startsWith(u8, val, "(if ("))
                                try std.fmt.allocPrint(self.alloc, "@as(f32, {s})", .{val})
                            else
                                try std.fmt.allocPrint(self.alloc, "@as(f32, @floatFromInt({s}))", .{val});
                            self.dyn_styles[self.dyn_style_count] = .{
                                .field = zig_key,
                                .expression = expr,
                                .arr_name = "",
                                .arr_index = 0,
                                .has_ref = false,
                            };
                            self.dyn_style_count += 1;
                        }
                    } else {
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, zig_key);
                        try fields.appendSlice(self.alloc, " = ");
                        // Object array fields are i64 — cast to f32 for style values
                        if (std.mem.indexOf(u8, val, "_oa") != null) {
                            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                "@as(f32, @floatFromInt({s}))", .{val}));
                        } else {
                            try fields.appendSlice(self.alloc, val);
                        }
                    }
                }
            } else if (mapEnumKey(key)) |mapping| {
                if (self.curKind() == .string) {
                    const val = try parseStringAttrInline(self);
                    if (mapEnumValue(mapping.prefix, val)) |zig_val| {
                        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                        try fields.appendSlice(self.alloc, ".");
                        try fields.appendSlice(self.alloc, mapping.field);
                        try fields.appendSlice(self.alloc, " = ");
                        try fields.appendSlice(self.alloc, zig_val);
                    }
                } else {
                    // Expression value for enum key — consume and skip
                    _ = consumeStyleValueExpr(self);
                }
            } else if (std.mem.eql(u8, key, "transition")) {
                // Parse transition config: { property: { duration: N, easing: "..." }, ... }
                if (self.curKind() == .lbrace) {
                    self.advance_token();
                    while (self.curKind() != .rbrace and self.curKind() != .eof) {
                        if (self.curKind() == .identifier or self.curKind() == .string) {
                            var prop_key = self.curText();
                            const is_str = self.curKind() == .string;
                            self.advance_token();
                            if (is_str and prop_key.len >= 2) prop_key = prop_key[1 .. prop_key.len - 1];
                            if (self.curKind() == .colon) self.advance_token();

                            // Map camelCase prop name to Zig field name
                            const zig_field = mapColorKey(prop_key) orelse
                                (if (mapStyleKey(prop_key)) |sk| sk else
                                (if (std.mem.eql(u8, prop_key, "all")) "all" else prop_key));
                            const is_color = mapColorKey(prop_key) != null;

                            // Parse config: { duration: N, easing: "...", delay: N, type: "spring", stiffness: N, damping: N }
                            if (self.curKind() == .lbrace) {
                                self.advance_token();
                                var dur: u16 = 300;
                                var del: u16 = 0;
                                var easing_str: []const u8 = "ease_in_out";
                                var is_spring = false;
                                var stiffness: u16 = 100;
                                var damping_val: u16 = 10;
                                var mass: u16 = 1;
                                while (self.curKind() != .rbrace and self.curKind() != .eof) {
                                    if (self.curKind() == .identifier) {
                                        const cfg_key = self.curText();
                                        self.advance_token();
                                        if (self.curKind() == .colon) self.advance_token();
                                        if (std.mem.eql(u8, cfg_key, "duration")) {
                                            if (self.curKind() == .number) {
                                                dur = std.fmt.parseInt(u16, self.curText(), 10) catch 300;
                                                self.advance_token();
                                            }
                                        } else if (std.mem.eql(u8, cfg_key, "delay")) {
                                            if (self.curKind() == .number) {
                                                del = std.fmt.parseInt(u16, self.curText(), 10) catch 0;
                                                self.advance_token();
                                            }
                                        } else if (std.mem.eql(u8, cfg_key, "easing")) {
                                            if (self.curKind() == .string) {
                                                const raw = self.curText();
                                                easing_str = mapEasingName(if (raw.len >= 2) raw[1 .. raw.len - 1] else raw);
                                                self.advance_token();
                                            }
                                        } else if (std.mem.eql(u8, cfg_key, "type")) {
                                            if (self.curKind() == .string) {
                                                const raw = self.curText();
                                                const type_val = if (raw.len >= 2) raw[1 .. raw.len - 1] else raw;
                                                if (std.mem.eql(u8, type_val, "spring")) is_spring = true;
                                                self.advance_token();
                                            }
                                        } else if (std.mem.eql(u8, cfg_key, "stiffness")) {
                                            if (self.curKind() == .number) {
                                                stiffness = std.fmt.parseInt(u16, self.curText(), 10) catch 100;
                                                self.advance_token();
                                            }
                                        } else if (std.mem.eql(u8, cfg_key, "damping")) {
                                            if (self.curKind() == .number) {
                                                damping_val = std.fmt.parseInt(u16, self.curText(), 10) catch 10;
                                                self.advance_token();
                                            }
                                        } else if (std.mem.eql(u8, cfg_key, "mass")) {
                                            if (self.curKind() == .number) {
                                                mass = std.fmt.parseInt(u16, self.curText(), 10) catch 1;
                                                self.advance_token();
                                            }
                                        } else {
                                            // Unknown config key — skip value
                                            if (self.curKind() != .rbrace) self.advance_token();
                                        }
                                    } else {
                                        self.advance_token();
                                    }
                                    if (self.curKind() == .comma) self.advance_token();
                                }
                                if (self.curKind() == .rbrace) self.advance_token();

                                // Build Zig config literal
                                if (trans_count < 16) {
                                    trans_fields[trans_count] = zig_field;
                                    trans_is_color[trans_count] = is_color;
                                    trans_is_spring[trans_count] = is_spring;
                                    if (is_spring) {
                                        trans_configs[trans_count] = try std.fmt.allocPrint(self.alloc,
                                            ".{{ .stiffness = {d}, .damping = {d}, .mass = {d}, .delay_ms = {d} }}",
                                            .{ stiffness, damping_val, mass, del });
                                    } else {
                                        trans_configs[trans_count] = try std.fmt.allocPrint(self.alloc,
                                            ".{{ .duration_ms = {d}, .delay_ms = {d}, .easing = .{{ .named = .{s} }} }}",
                                            .{ dur, del, easing_str });
                                    }
                                    trans_count += 1;
                                }
                            } else {
                                skipStyleValue(self);
                            }
                        } else {
                            self.advance_token();
                        }
                        if (self.curKind() == .comma) self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                } else {
                    skipStyleValue(self);
                }
            } else {
                const warn_msg = std.fmt.allocPrint(self.alloc,
                    "unknown style property '{s}' — not a recognized layout, color, or enum field (typo?)", .{key}) catch "unknown style property";
                self.addWarning(self.cur().start, warn_msg);
                skipStyleValue(self);
            }
        } else {
            // Safety: skip unknown tokens to prevent infinite loop
            self.advance_token();
        }
        if (self.curKind() == .comma) self.advance_token();
    }

    // Apply transition configs to DynStyles created in this style block
    if (trans_count > 0) {
        var dsi = dyn_style_start;
        while (dsi < self.dyn_style_count) : (dsi += 1) {
            const ds_field = self.dyn_styles[dsi].field;
            var ti: u32 = 0;
            while (ti < trans_count) : (ti += 1) {
                // Match by field name, or "all" matches everything
                if (std.mem.eql(u8, trans_fields[ti], ds_field) or
                    std.mem.eql(u8, trans_fields[ti], "all"))
                {
                    self.dyn_styles[dsi].transition_config = trans_configs[ti];
                    self.dyn_styles[dsi].transition_is_spring = trans_is_spring[ti];
                    self.dyn_styles[dsi].is_color = trans_is_color[ti] or mapColorKey(ds_field) != null;
                    break;
                }
            }
        }
    }

    if (self.curKind() == .rbrace) self.advance_token();
    if (double_brace and self.curKind() == .rbrace) self.advance_token();
    return try self.alloc.dupe(u8, fields.items);
}

/// Check if a string is a simple identifier (letters, digits, underscore only).
/// Used to distinguish `bar.pct` (simple field) from `bar.pct + 3` (arithmetic).
fn isSimpleFieldAccess(s: []const u8) bool {
    if (s.len == 0) return false;
    for (s) |ch| {
        if (!((ch >= 'a' and ch <= 'z') or (ch >= 'A' and ch <= 'Z') or
            (ch >= '0' and ch <= '9') or ch == '_')) return false;
    }
    return true;
}

pub fn skipStyleValue(self: *Generator) void {
    if (self.curKind() == .string or self.curKind() == .number or self.curKind() == .identifier) {
        self.advance_token();
    }
}

/// Consume a multi-token style value expression until comma or rbrace.
/// Handles expressions like `bar.pct * 3`, `item.color`, `foo + bar`.
/// Resolves map item field references (bar.field → _oa{N}_{field}[_i]),
/// map index params (i → _i), and prop bindings.
pub fn consumeStyleValueExpr(self: *Generator) []const u8 {
    var expr: std.ArrayListUnmanaged(u8) = .{};
    var depth: u32 = 0;
    var in_ternary = false; // tracking JS ternary ? : → Zig if/else
    var last_was_string_slot = false; // true immediately after emitting getSlotString(N)
    var in_string_cmp = false; // true between == and its string RHS, inside std.mem.eql rewrite
    var skip_rparen: u32 = 0; // grouping parens stripped from nested ternary conditions (else-branch only)
    var then_branch_start: usize = 0; // position in expr where the then-branch begins
    while (self.curKind() != .eof) {
        const k = self.curKind();
        // Stop at comma or closing brace (unless inside nested parens/braces)
        if (depth == 0 and (k == .comma or k == .rbrace)) break;
        // Colon at depth 0: if we're in a ternary it's the else separator;
        // otherwise it's the next key:value pair — stop.
        if (depth == 0 and k == .colon and !in_ternary) break;
        if (k == .lparen or k == .lbrace) depth += 1;
        if ((k == .rparen or k == .rbrace) and depth > 0) depth -= 1;
        const txt = self.curText();
        if (k == .identifier) {
            // Check map item param: bar.field.sub → _oa{N}_{field_sub}[_i]
            if (self.map_item_param != null and std.mem.eql(u8, txt, self.map_item_param.?)) {
                self.advance_token();
                if (self.curKind() == .dot) {
                    const field_name = self.consumeCompoundField();
                    if (self.map_obj_array_idx) |oa_idx| {
                        expr.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                            "_oa{d}_{s}[_i]", .{ oa_idx, field_name }) catch "") catch {};
                    } else {
                        expr.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                            "_item.{s}", .{field_name}) catch "") catch {};
                    }
                } else {
                    // Bare item param without field access
                    expr.appendSlice(self.alloc, "_item") catch {};
                }
                // Close std.mem.eql() if this was the RHS of a string comparison
                if (in_string_cmp) {
                    expr.appendSlice(self.alloc, ")") catch {};
                    in_string_cmp = false;
                }
                continue;
            }
            // Check map index param: i → _i
            if (self.map_index_param) |idx_p| {
                if (std.mem.eql(u8, txt, idx_p)) {
                    // Inside component inline: _i doesn't exist at file scope
                    if (self.current_inline_component != null) {
                        expr.appendSlice(self.alloc, "0") catch {};
                    } else {
                        expr.appendSlice(self.alloc, "_i") catch {};
                    }
                    self.advance_token();
                    continue;
                }
            }
            if (self.findProp(txt)) |resolved| {
                expr.appendSlice(self.alloc, resolved) catch {};
            } else if (self.isState(txt)) |slot_id| {
                const rid = self.regularSlotId(slot_id);
                const st = self.stateTypeById(slot_id);
                if (st == .float) {
                    expr.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                        "state.getSlotFloat({d})", .{rid}) catch "") catch {};
                    last_was_string_slot = false;
                } else if (st == .string) {
                    expr.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                        "state.getSlotString({d})", .{rid}) catch "") catch {};
                    last_was_string_slot = true;
                } else {
                    expr.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                        "state.getSlot({d})", .{rid}) catch "") catch {};
                    last_was_string_slot = false;
                }
            } else {
                expr.appendSlice(self.alloc, txt) catch {};
            }
        } else {
            // String equality: rewrite getSlotString(N) == 'val' → std.mem.eql(u8, ..., "val")
            if ((k == .eq_eq or k == .not_eq) and last_was_string_slot) {
                // absorb trailing = from === or !== (lexed as eq_eq/not_eq + equals)
                if (self.pos + 1 < self.lex.count and self.lex.get(self.pos + 1).kind == .equals) {
                    self.advance_token();
                }
                const prefix = "state.getSlotString(";
                if (std.mem.lastIndexOf(u8, expr.items, prefix)) |pos| {
                    const before = self.alloc.dupe(u8, expr.items[0..pos]) catch "";
                    const getslot = self.alloc.dupe(u8, expr.items[pos..]) catch "";
                    expr.clearRetainingCapacity();
                    expr.appendSlice(self.alloc, before) catch {};
                    if (k == .not_eq) {
                        expr.appendSlice(self.alloc, "!std.mem.eql(u8, ") catch {};
                    } else {
                        expr.appendSlice(self.alloc, "std.mem.eql(u8, ") catch {};
                    }
                    expr.appendSlice(self.alloc, getslot) catch {};
                    expr.appendSlice(self.alloc, ", ") catch {};
                }
                in_string_cmp = true;
                last_was_string_slot = false;
                self.advance_token();
                continue;
            }
            // String RHS of equality: close std.mem.eql with the literal and )
            if (k == .string and in_string_cmp) {
                const raw = txt;
                const inner = if (raw.len >= 2 and (raw[0] == '\'' or raw[0] == '"')) raw[1 .. raw.len - 1] else raw;
                expr.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc, "\"{s}\")", .{inner}) catch "") catch {};
                in_string_cmp = false;
                self.advance_token();
                continue;
            }
            // Logical operators: && → and, || → or
            if (k == .amp_amp) {
                expr.appendSlice(self.alloc, " and ") catch {};
                last_was_string_slot = false;
                self.advance_token();
                continue;
            }
            if (k == .pipe_pipe) {
                expr.appendSlice(self.alloc, " or ") catch {};
                last_was_string_slot = false;
                self.advance_token();
                continue;
            }
            // JS ternary → Zig if/else: "cond ? a : b" → "(if (cond != 0) a else b)"
            if (k == .question) {
                // Close any pending string comparison before wrapping in if()
                if (in_string_cmp) {
                    expr.appendSlice(self.alloc, ")") catch {};
                    in_string_cmp = false;
                }
                if (in_ternary) {
                    // Nested ternary: determine if nesting is in then-branch or else-branch
                    const last_else = std.mem.lastIndexOf(u8, expr.items, " else ");
                    const in_else_branch = last_else != null;
                    const cond_start = if (last_else) |le| le + 6 else then_branch_start;
                    const raw_cond = expr.items[cond_start..];
                    // Strip leading ( from TSX grouping paren around nested ternary
                    const has_group_paren = raw_cond.len > 0 and raw_cond[0] == '(';
                    const cond = if (has_group_paren) raw_cond[1..] else raw_cond;
                    // Only skip the matching ) for else-branch (chained else if).
                    // For then-branch, the ) closes the inner (if ...) sub-expression.
                    if (has_group_paren and in_else_branch) skip_rparen += 1;
                    const cond_is_bool = std.mem.indexOf(u8, cond, "==") != null or
                        std.mem.indexOf(u8, cond, "!=") != null or
                        std.mem.indexOf(u8, cond, ">=") != null or
                        std.mem.indexOf(u8, cond, "<=") != null or
                        std.mem.indexOf(u8, cond, " > ") != null or
                        std.mem.indexOf(u8, cond, " < ") != null or
                        std.mem.indexOf(u8, cond, "std.mem.eql") != null;
                    const cond_copy = self.alloc.dupe(u8, cond) catch cond;
                    if (in_else_branch) {
                        // Else-branch: chained else if
                        expr.items.len = last_else.?;
                        expr.appendSlice(self.alloc, " else if (") catch {};
                    } else {
                        // Then-branch: nested (if ...) sub-expression
                        expr.items.len = then_branch_start;
                        expr.appendSlice(self.alloc, "(if (") catch {};
                    }
                    expr.appendSlice(self.alloc, cond_copy) catch {};
                    if (cond_is_bool) {
                        expr.appendSlice(self.alloc, ") ") catch {};
                    } else {
                        expr.appendSlice(self.alloc, " != 0) ") catch {};
                    }
                } else {
                    // First ternary: wrap full expr as condition
                    const is_already_bool = std.mem.indexOf(u8, expr.items, "==") != null or
                        std.mem.indexOf(u8, expr.items, "!=") != null or
                        std.mem.indexOf(u8, expr.items, ">=") != null or
                        std.mem.indexOf(u8, expr.items, "<=") != null or
                        std.mem.indexOf(u8, expr.items, " > ") != null or
                        std.mem.indexOf(u8, expr.items, " < ") != null or
                        std.mem.indexOf(u8, expr.items, "std.mem.eql") != null;
                    var wrapped: std.ArrayListUnmanaged(u8) = .{};
                    wrapped.appendSlice(self.alloc, "(if (") catch {};
                    wrapped.appendSlice(self.alloc, expr.items) catch {};
                    if (is_already_bool) {
                        wrapped.appendSlice(self.alloc, ") ") catch {};
                    } else {
                        wrapped.appendSlice(self.alloc, " != 0) ") catch {};
                    }
                    expr.items.len = 0;
                    expr.appendSlice(self.alloc, wrapped.items) catch {};
                    in_ternary = true;
                    then_branch_start = expr.items.len;
                }
                self.advance_token();
                continue;
            }
            if (k == .colon and in_ternary) {
                expr.appendSlice(self.alloc, " else ") catch {};
                // Keep in_ternary=true so the else-branch number also gets @as(i64, N)
                self.advance_token();
                continue;
            }
            // Operators need spaces around them for valid Zig
            // Division: Zig requires @divTrunc for signed integers — wrap here
            if (k == .slash) {
                self.advance_token(); // consume the /
                const rhs_txt = self.curText();
                if (self.curKind() == .number) {
                    const lhs_copy = self.alloc.dupe(u8, expr.items) catch expr.items;
                    expr.items.len = 0;
                    const new_e = std.fmt.allocPrint(self.alloc, "@divTrunc({s}, {s})", .{ lhs_copy, rhs_txt }) catch lhs_copy;
                    expr.appendSlice(self.alloc, new_e) catch {};
                    // bottom advance_token() will consume the rhs number
                } else {
                    // Complex rhs — emit bare / and let next iteration handle rhs
                    expr.appendSlice(self.alloc, " / ") catch {};
                    continue; // skip bottom advance; rhs token is next iteration
                }
            } else if (k == .plus or k == .minus or k == .star) {
                if (expr.items.len > 0 and expr.items[expr.items.len - 1] != ' ')
                    expr.append(self.alloc, ' ') catch {};
                expr.appendSlice(self.alloc, txt) catch {};
                expr.append(self.alloc, ' ') catch {};
            } else if (k == .number and in_ternary) {
                // Inside ternary: give literals a concrete f32 type for result values.
                // But NOT for comparison operands (e.g. x == 1 ? ...) — those stay bare.
                const after_cmp = std.mem.endsWith(u8, expr.items, "==") or
                    std.mem.endsWith(u8, expr.items, "!=") or
                    std.mem.endsWith(u8, expr.items, ">=") or
                    std.mem.endsWith(u8, expr.items, "<=") or
                    std.mem.endsWith(u8, expr.items, "> ") or
                    std.mem.endsWith(u8, expr.items, "< ");
                if (after_cmp) {
                    expr.appendSlice(self.alloc, txt) catch {};
                } else {
                    expr.appendSlice(self.alloc, "@as(f32, ") catch {};
                    expr.appendSlice(self.alloc, txt) catch {};
                    expr.appendSlice(self.alloc, ")") catch {};
                }
            } else if (k == .string and txt.len == 9 and txt[1] == '#') {
                // Hex color string in style expression → convert to typed hex integer
                // "#1f2937" → @as(u32, 0x1f2937) (concrete type for runtime control flow)
                expr.appendSlice(self.alloc, "@as(u32, 0x") catch {};
                expr.appendSlice(self.alloc, txt[2..8]) catch {};
                expr.appendSlice(self.alloc, ")") catch {};
            } else if (k == .rparen and skip_rparen > 0) {
                // Skip TSX grouping ) that matched a ( stripped from nested ternary condition
                skip_rparen -= 1;
            } else {
                expr.appendSlice(self.alloc, txt) catch {};
            }
        }
        self.advance_token();
    }
    // Close the outer paren from ternary: "(if (...) a else b)"
    if (in_ternary or std.mem.startsWith(u8, expr.items, "(if (")) {
        expr.appendSlice(self.alloc, ")") catch {};
    }
    if (expr.items.len == 0) return "0";
    return expr.items;
}

// ── String/expr attribute parsing ──

pub fn parseStringAttr(self: *Generator) ![]const u8 {
    if (self.curKind() == .string) {
        const tok = self.cur();
        const raw = tok.text(self.source);
        self.advance_token();
        return raw[1 .. raw.len - 1];
    }
    if (self.curKind() == .lbrace) {
        self.advance_token();
        if (self.curKind() == .identifier) {
            const name = self.curText();
            if (self.findProp(name)) |val| {
                self.advance_token();
                if (self.curKind() == .rbrace) self.advance_token();
                if (std.mem.startsWith(u8, val, "_p_")) return val;
                if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) return val[1 .. val.len - 1];
                return val;
            }
        }
        const result = try parseStringAttr(self);
        if (self.curKind() == .rbrace) self.advance_token();
        return result;
    }
    self.advance_token();
    return "";
}

pub fn parseStringAttrInline(self: *Generator) ![]const u8 {
    if (self.curKind() == .string) {
        const tok = self.cur();
        const raw = tok.text(self.source);
        self.advance_token();
        return raw[1 .. raw.len - 1];
    }
    if (self.curKind() == .identifier) {
        const name = self.curText();
        if (self.findProp(name)) |val| {
            self.advance_token();
            if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) return val[1 .. val.len - 1];
            return val;
        }
        if (self.isLocalVar(name)) |lv| {
            self.advance_token();
            if (lv.expr.len >= 2 and (lv.expr[0] == '"' or lv.expr[0] == '\'')) return lv.expr[1 .. lv.expr.len - 1];
            return lv.expr;
        }
    }
    self.advance_token();
    return "";
}

pub fn parseExprAttr(self: *Generator) ![]const u8 {
    if (self.curKind() == .lbrace) {
        self.advance_token();
        const val = consumeStyleValueExpr(self);
        if (self.curKind() == .rbrace) self.advance_token();
        return val;
    }
    if (self.curKind() == .number or self.curKind() == .string) {
        const val = self.curText();
        self.advance_token();
        return val;
    }
    return "0";
}

pub fn skipAttrValue(self: *Generator) !void {
    if (self.curKind() == .string or self.curKind() == .number) {
        self.advance_token();
    } else if (self.curKind() == .lbrace) {
        try skipBalanced(self);
    }
}

pub fn skipBalanced(self: *Generator) !void {
    if (self.curKind() != .lbrace) return;
    self.advance_token();
    var depth: u32 = 1;
    while (depth > 0 and self.curKind() != .eof) {
        if (self.curKind() == .lbrace) depth += 1;
        if (self.curKind() == .rbrace) depth -= 1;
        if (depth > 0) self.advance_token();
    }
    if (self.curKind() == .rbrace) self.advance_token();
}

// ── Text content ──

pub fn collectTextContent(self: *Generator) []const u8 {
    const start = self.pos;
    while (self.curKind() != .lt and self.curKind() != .lt_slash and
        self.curKind() != .lbrace and self.curKind() != .eof)
    {
        self.advance_token();
    }
    if (self.pos > start) {
        const first = self.lex.get(start);
        const last = self.lex.get(self.pos - 1);
        return self.source[first.start..last.end];
    }
    return "";
}

// ── Template literals ──
// Converts JS template literals like `Hello ${name}, you have ${count} items`
// into Zig format strings + args: fmt="Hello {s}, you have {d} items", args="state.getSlotString(0), state.getSlot(1)"
//
// Each ${expr} is resolved in order:
//   1. State variable  → state.getSlot*(N) with correct type specifier
//   2. Prop binding    → substituted value or _p_name reference
//   3. Local variable  → substituted expression
//   4. FFI function    → ffi.funcName() call
//   5. Unknown         → embedded as static text with a warning

/// Parse a template literal from the current token (backtick-delimited).
pub fn parseTemplateLiteral(self: *Generator) !codegen.TemplateResult {
    const tok = self.cur();
    const raw = tok.text(self.source);
    const inner = raw[1 .. raw.len - 1];
    return parseTemplateLiteralFromText(self, inner);
}

pub fn parseTemplateLiteralFromText(self: *Generator, inner: []const u8) !codegen.TemplateResult {
    if (std.mem.indexOf(u8, inner, "${") == null) {
        return .{ .is_dynamic = false, .static_text = inner, .fmt = "", .args = "", .dep_slots = undefined, .dep_count = 0 };
    }

    var fmt: std.ArrayListUnmanaged(u8) = .{};
    var args: std.ArrayListUnmanaged(u8) = .{};
    var dep_slots: [codegen.MAX_DYN_DEPS]u32 = undefined;
    var dep_count: u32 = 0;
    var i: usize = 0;

    while (i < inner.len) {
        if (i + 1 < inner.len and inner[i] == '$' and inner[i + 1] == '{') {
            i += 2;
            const expr_start = i;
            var depth: u32 = 1;
            while (i < inner.len and depth > 0) {
                if (inner[i] == '{') depth += 1;
                if (inner[i] == '}') depth -= 1;
                if (depth > 0) i += 1;
            }
            const expr = inner[expr_start..i];
            if (i < inner.len) i += 1;

            if (self.isState(expr)) |slot_id| {
                const st = self.stateTypeById(slot_id);
                const rid = self.regularSlotId(slot_id);
                if (dep_count < codegen.MAX_DYN_DEPS) { dep_slots[dep_count] = rid; dep_count += 1; }
                switch (st) {
                    .string => {
                        try fmt.appendSlice(self.alloc, "{s}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}));
                    },
                    .float => {
                        try fmt.appendSlice(self.alloc, "{d}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}));
                    },
                    .boolean => {
                        try fmt.appendSlice(self.alloc, "{s}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "if (state.getSlotBool({d})) \"true\" else \"false\"", .{rid}));
                    },
                    else => {
                        try fmt.appendSlice(self.alloc, "{d}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}));
                    },
                }
            } else if (self.findPropBinding(expr)) |binding| {
                const pval = if (self.emit_prop_refs)
                    (std.fmt.allocPrint(self.alloc, "_p_{s}", .{expr}) catch "")
                else
                    binding.value;
                if (binding.prop_type == .dynamic_text and !self.emit_prop_refs) {
                    if (binding.value.len >= 2 and binding.value[0] == '`') {
                        const tmpl_inner = binding.value[1 .. binding.value.len - 1];
                        const tmpl = try parseTemplateLiteralFromText(self, tmpl_inner);
                        if (tmpl.is_dynamic) {
                            try fmt.appendSlice(self.alloc, tmpl.fmt);
                            if (tmpl.args.len > 0) {
                                if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                                try args.appendSlice(self.alloc, tmpl.args);
                            }
                            for (0..tmpl.dep_count) |di| {
                                if (dep_count < codegen.MAX_DYN_DEPS) { dep_slots[dep_count] = tmpl.dep_slots[di]; dep_count += 1; }
                            }
                        } else {
                            try fmt.appendSlice(self.alloc, tmpl.static_text);
                        }
                    } else {
                        try fmt.appendSlice(self.alloc, binding.value);
                    }
                } else if (pval.len >= 2 and (pval[0] == '"' or pval[0] == '\'')) {
                    try fmt.appendSlice(self.alloc, pval[1 .. pval.len - 1]);
                } else if (std.mem.startsWith(u8, pval, "_p_")) {
                    try fmt.appendSlice(self.alloc, "{s}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, pval);
                } else if (std.mem.startsWith(u8, pval, "state.getSlotString")) {
                    try fmt.appendSlice(self.alloc, "{s}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, pval);
                } else {
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, pval);
                }
            } else if (self.isLocalVar(expr)) |lv| {
                switch (lv.state_type) {
                    .string => {
                        try fmt.appendSlice(self.alloc, "{s}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, lv.expr);
                    },
                    .float => {
                        try fmt.appendSlice(self.alloc, "{d}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, lv.expr);
                    },
                    .boolean => {
                        try fmt.appendSlice(self.alloc, "{s}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "if ({s}) \"true\" else \"false\"", .{lv.expr}));
                    },
                    else => {
                        try fmt.appendSlice(self.alloc, "{d}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, lv.expr);
                    },
                }
            } else if (self.map_item_param != null and std.mem.eql(u8, expr, self.map_item_param.?)) {
                // .map() item param — will be rewritten to _item at emit time
                try fmt.appendSlice(self.alloc, "{d}");
                if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                try args.appendSlice(self.alloc, expr);
            } else if (self.map_item_param != null and std.mem.startsWith(u8, expr, self.map_item_param.?) and
                expr.len > self.map_item_param.?.len and expr[self.map_item_param.?.len] == '.' and
                isSimpleFieldAccess(expr[self.map_item_param.?.len + 1 ..]))
            {
                // .map() item field access: bar.pct → _oa{N}_{field}[_i]
                // Only matches simple field access (no arithmetic operators)
                const field_name = expr[self.map_item_param.?.len + 1 ..];
                if (self.map_obj_array_idx) |oa_idx| {
                    const oa = self.object_arrays[oa_idx];
                    var resolved = false;
                    for (0..oa.field_count) |fi| {
                        if (std.mem.eql(u8, oa.fields[fi].name, field_name)) {
                            switch (oa.fields[fi].field_type) {
                                .string => {
                                    try fmt.appendSlice(self.alloc, "{s}");
                                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                                    try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                        "_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]]", .{ oa_idx, field_name, oa_idx, field_name }));
                                },
                                else => {
                                    try fmt.appendSlice(self.alloc, "{d}");
                                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                                    try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                                        "_oa{d}_{s}[_i]", .{ oa_idx, field_name }));
                                },
                            }
                            resolved = true;
                            break;
                        }
                    }
                    if (!resolved) {
                        // Field not found in object array — emit as {d} with raw access
                        try fmt.appendSlice(self.alloc, "{d}");
                        if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                            "_oa{d}_{s}[_i]", .{ oa_idx, field_name }));
                    }
                } else {
                    // Regular array item field: _item.field
                    try fmt.appendSlice(self.alloc, "{d}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        "_item.{s}", .{field_name}));
                }
            } else if (self.map_index_param != null and std.mem.eql(u8, expr, self.map_index_param.?)) {
                // .map() index param — will be rewritten to _i at emit time
                try fmt.appendSlice(self.alloc, "{d}");
                if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "@as(i64, @intCast({s}))", .{expr}));
            } else if (std.mem.indexOf(u8, expr, "(")) |paren_pos| blk: {
                const func_name = expr[0..paren_pos];
                if (self.isFFIFunc(func_name)) {
                    const ret_type = self.ffiReturnType(func_name);
                    const fmt_spec: []const u8 = if (ret_type == .string) "{s}" else "{d}";
                    try fmt.appendSlice(self.alloc, fmt_spec);
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    const ac = self.ffiArgCount(func_name);
                    if (ac == 0) {
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "ffi.{s}()", .{func_name}));
                    } else {
                        try args.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "ffi.{s}(0)", .{func_name}));
                    }
                    break :blk;
                }
                // Not an FFI function — embed as static text
                const warn_msg = std.fmt.allocPrint(self.alloc,
                    "expression '${{{s}}}' in template literal is not a state variable, prop, or FFI call — embedded as static text", .{expr}) catch "unresolved template expression";
                self.addWarning(0, warn_msg);
                try fmt.appendSlice(self.alloc, expr);
            } else if (self.map_item_param != null and
                std.mem.indexOf(u8, expr, self.map_item_param.?) != null)
            {
                // Compound expression with map item references: row.x + row.y + ri + offset
                // Do textual substitution of item.field → _oa{N}_{field}[_i], index → _i, state → getter
                const resolved_expr = try self.resolveCompoundMapExpr(expr);
                try fmt.appendSlice(self.alloc, "{d}");
                if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                try args.appendSlice(self.alloc, resolved_expr);
            } else if (self.map_index_param != null and
                std.mem.indexOf(u8, expr, self.map_index_param.?) != null)
            {
                // Expression containing map index param: i + 1, i * 2, etc.
                // Substitute index param → @as(i64, @intCast(_i))
                const resolved = try emit_map.replaceIdent(self.alloc, expr, self.map_index_param.?, "@as(i64, @intCast(_i))");
                try fmt.appendSlice(self.alloc, "{d}");
                if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                try args.appendSlice(self.alloc, resolved);
            } else if (std.mem.indexOf(u8, expr, "?") != null) {
                // Possible string-returning ternary with state refs
                // e.g. mode == 0 ? "default" : mode == 1 ? "compact" : "expanded"
                if (try resolveStringTernaryFromText(self, expr, &dep_slots, &dep_count)) |zig_expr| {
                    try fmt.appendSlice(self.alloc, "{s}");
                    if (args.items.len > 0) try args.appendSlice(self.alloc, ", ");
                    try args.appendSlice(self.alloc, zig_expr);
                } else {
                    const warn_msg = std.fmt.allocPrint(self.alloc,
                        "expression '${{{s}}}' in template literal could not be resolved — embedded as static text", .{expr}) catch "unresolved template expression";
                    self.addWarning(0, warn_msg);
                    try fmt.appendSlice(self.alloc, expr);
                }
            } else if (expr.len > 0 and (expr[0] >= '0' and expr[0] <= '9' or expr[0] == '-')) {
                // Numeric literal (e.g., ${7}, ${-5}) — embed as static text
                try fmt.appendSlice(self.alloc, expr);
            } else {
                // Unknown expression — embed as static text
                const warn_msg = std.fmt.allocPrint(self.alloc,
                    "expression '${{{s}}}' in template literal could not be resolved — embedded as static text", .{expr}) catch "unresolved template expression";
                self.addWarning(0, warn_msg);
                try fmt.appendSlice(self.alloc, expr);
            }
        } else {
            // Escape double-quote and backslash for Zig string literal
            if (inner[i] == '"') try fmt.appendSlice(self.alloc, "\\\"")
            else if (inner[i] == '\\') try fmt.appendSlice(self.alloc, "\\\\")
            else try fmt.append(self.alloc, inner[i]);
            i += 1;
        }
    }

    if (args.items.len > 0) {
        return .{
            .is_dynamic = true,
            .static_text = "",
            .fmt = try self.alloc.dupe(u8, fmt.items),
            .args = try self.alloc.dupe(u8, args.items),
            .dep_slots = dep_slots,
            .dep_count = dep_count,
        };
    }
    // If fmt was populated by resolved static interpolations (e.g., ${propValue} → "2,340"),
    // use the resolved fmt instead of the raw inner which still contains ${...} syntax
    const resolved = if (fmt.items.len > 0 and !std.mem.eql(u8, fmt.items, inner))
        try self.alloc.dupe(u8, fmt.items)
    else
        inner;
    return .{ .is_dynamic = false, .static_text = resolved, .fmt = "", .args = "", .dep_slots = undefined, .dep_count = 0 };
}

// ── String ternary resolver (for template literal ${...} expressions) ──

/// Resolve a condition like "mode == 0" → "state.getSlot(1) == 0".
/// Returns null if no state variable is found in the condition.
fn resolveConditionStateRefs(self: *Generator, cond: []const u8, dep_slots: *[codegen.MAX_DYN_DEPS]u32, dep_count: *u32) !?[]const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    var found_state = false;
    var i: usize = 0;
    while (i < cond.len) {
        const c = cond[i];
        if (std.ascii.isAlphabetic(c) or c == '_') {
            const start = i;
            while (i < cond.len and (std.ascii.isAlphanumeric(cond[i]) or cond[i] == '_')) : (i += 1) {}
            const ident = cond[start..i];
            if (self.isState(ident)) |slot_id| {
                const rid = self.regularSlotId(slot_id);
                const st = self.stateTypeById(slot_id);
                if (dep_count.* < codegen.MAX_DYN_DEPS) { dep_slots.*[dep_count.*] = rid; dep_count.* += 1; }
                found_state = true;
                const getter = if (st == .string)
                    try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid})
                else if (st == .float)
                    try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid})
                else
                    try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid});
                try result.appendSlice(self.alloc, getter);
            } else {
                try result.appendSlice(self.alloc, ident);
            }
        } else {
            try result.append(self.alloc, c);
            i += 1;
        }
    }
    if (!found_state) return null;
    return try self.alloc.dupe(u8, result.items);
}

/// Resolve a JS string-returning ternary expression to a Zig if/else expression.
/// e.g. `mode == 0 ? "default" : mode == 1 ? "compact" : "expanded"`
///   →  `if (state.getSlot(1) == 0) "default" else if (state.getSlot(1) == 1) "compact" else "expanded"`
/// Returns null if the expression cannot be resolved.
fn resolveStringTernaryFromText(self: *Generator, expr: []const u8, dep_slots: *[codegen.MAX_DYN_DEPS]u32, dep_count: *u32) !?[]const u8 {
    const trimmed = std.mem.trim(u8, expr, " \t");
    // Base case: string literal "..."
    if (trimmed.len >= 2 and trimmed[0] == '"' and trimmed[trimmed.len - 1] == '"') {
        return trimmed;
    }
    // Find '?' at depth 0, skipping quoted strings
    var depth: u32 = 0;
    var in_str = false;
    var q_pos: ?usize = null;
    var i: usize = 0;
    while (i < trimmed.len) : (i += 1) {
        const c = trimmed[i];
        if (in_str) { if (c == '"') in_str = false; continue; }
        if (c == '"') { in_str = true; continue; }
        if (c == '(' or c == '[') { depth += 1; continue; }
        if (c == ')' or c == ']') { if (depth > 0) depth -= 1; continue; }
        if (depth == 0 and c == '?') { q_pos = i; break; }
    }
    const qp = q_pos orelse return null;
    const cond_raw = std.mem.trim(u8, trimmed[0..qp], " \t");
    const after_q = std.mem.trim(u8, trimmed[qp + 1 ..], " \t");
    // Find ':' at depth 0 in after_q, skipping quoted strings
    depth = 0; in_str = false;
    var colon_pos: ?usize = null;
    i = 0;
    while (i < after_q.len) : (i += 1) {
        const c = after_q[i];
        if (in_str) { if (c == '"') in_str = false; continue; }
        if (c == '"') { in_str = true; continue; }
        if (c == '(' or c == '[') { depth += 1; continue; }
        if (c == ')' or c == ']') { if (depth > 0) depth -= 1; continue; }
        if (depth == 0 and c == ':') { colon_pos = i; break; }
    }
    const cp = colon_pos orelse return null;
    const true_raw = std.mem.trim(u8, after_q[0..cp], " \t");
    const false_raw = std.mem.trim(u8, after_q[cp + 1 ..], " \t");
    const zig_cond = (try resolveConditionStateRefs(self, cond_raw, dep_slots, dep_count)) orelse return null;
    const true_zig = (try resolveStringTernaryFromText(self, true_raw, dep_slots, dep_count)) orelse return null;
    const false_zig = (try resolveStringTernaryFromText(self, false_raw, dep_slots, dep_count)) orelse return null;
    return try std.fmt.allocPrint(self.alloc, "if ({s}) {s} else {s}", .{ zig_cond, true_zig, false_zig });
}

// ── Color parsing ──

pub fn parseColorValue(self: *Generator, hex: []const u8) ![]const u8 {
    if (hex.len == 0) return "Color.rgb(255, 255, 255)";
    // theme-* tokens → runtime lookup via Theme.get()
    if (std.mem.startsWith(u8, hex, "theme-")) {
        const token_name = hex[6..]; // strip "theme-" prefix
        // Map camelCase token names to snake_case enum field names
        const field = themeTokenField(token_name) orelse {
            self.addWarning(0, try std.fmt.allocPrint(self.alloc, "Unknown theme token: '{s}'", .{token_name}));
            return "Color.rgb(255, 0, 255)"; // magenta = unknown token
        };
        self.has_theme = true;
        return try std.fmt.allocPrint(self.alloc, "Theme.get(.{s})", .{field});
    }
    if (namedColor(hex)) |rgb| {
        return try std.fmt.allocPrint(self.alloc, "Color.rgb({d}, {d}, {d})", .{ rgb[0], rgb[1], rgb[2] });
    }
    const h = if (hex[0] == '#') hex[1..] else hex;
    if (h.len == 8) {
        const r = std.fmt.parseInt(u8, h[0..2], 16) catch 0;
        const g = std.fmt.parseInt(u8, h[2..4], 16) catch 0;
        const b = std.fmt.parseInt(u8, h[4..6], 16) catch 0;
        const a = std.fmt.parseInt(u8, h[6..8], 16) catch 255;
        return try std.fmt.allocPrint(self.alloc, "Color.rgba({d}, {d}, {d}, {d})", .{ r, g, b, a });
    }
    if (h.len == 6) {
        const r = std.fmt.parseInt(u8, h[0..2], 16) catch 0;
        const g = std.fmt.parseInt(u8, h[2..4], 16) catch 0;
        const b = std.fmt.parseInt(u8, h[4..6], 16) catch 0;
        return try std.fmt.allocPrint(self.alloc, "Color.rgb({d}, {d}, {d})", .{ r, g, b });
    }
    if (h.len == 3) {
        const r = std.fmt.parseInt(u8, h[0..1], 16) catch 0;
        const g = std.fmt.parseInt(u8, h[1..2], 16) catch 0;
        const b = std.fmt.parseInt(u8, h[2..3], 16) catch 0;
        return try std.fmt.allocPrint(self.alloc, "Color.rgb({d}, {d}, {d})", .{ r * 17, g * 17, b * 17 });
    }
    return "Color.rgb(255, 255, 255)";
}

// ── Style key mappings (data-driven from compiler/rules/) ──

const style_keys = @import("rules/style_keys.zig");
const enum_keys = @import("rules/enum_keys.zig");
const easing_rules = @import("rules/easing_names.zig");
const named_colors_rules = @import("rules/named_colors.zig");
const theme_rules = @import("rules/theme_tokens.zig");
const lookup = @import("rules/lookup.zig");

const EnumMapping = struct { field: []const u8, prefix: []const u8 };

pub fn mapStyleKey(key: []const u8) ?[]const u8 {
    return lookup.map(style_keys.Entry, &style_keys.f32_keys, "css", "zig", key);
}

pub fn mapStyleKeyI16(key: []const u8) ?[]const u8 {
    return lookup.map(style_keys.Entry, &style_keys.i16_keys, "css", "zig", key);
}

pub fn mapColorKey(key: []const u8) ?[]const u8 {
    return lookup.map(style_keys.Entry, &style_keys.color_keys, "css", "zig", key);
}

/// Map CSS easing name to transition.EasingType enum field name.
pub fn mapEasingName(name: []const u8) []const u8 {
    return lookup.map(easing_rules.Entry, &easing_rules.easings, "css", "zig", name) orelse easing_rules.default;
}

pub fn mapEnumKey(key: []const u8) ?EnumMapping {
    if (lookup.find(enum_keys.EnumKey, &enum_keys.keys, "css", key)) |e| {
        return .{ .field = e.field, .prefix = e.prefix };
    }
    return null;
}

pub fn mapEnumValue(prefix: []const u8, value: []const u8) ?[]const u8 {
    return enum_keys.findValue(prefix, value);
}

// ── CSS normalization helpers ──

pub fn kebabToCamel(alloc: std.mem.Allocator, input: []const u8) ![]const u8 {
    var result: std.ArrayListUnmanaged(u8) = .{};
    var capitalize_next = false;
    for (input) |ch| {
        if (ch == '-') { capitalize_next = true; } else if (capitalize_next) { try result.append(alloc, if (ch >= 'a' and ch <= 'z') ch - 32 else ch); capitalize_next = false; } else { try result.append(alloc, ch); }
    }
    return try alloc.dupe(u8, result.items);
}

pub fn parseCSSValue(value: []const u8) ?f32 {
    if (value.len == 0) return null;
    if (std.mem.eql(u8, value, "auto")) return null;
    if (std.mem.endsWith(u8, value, "px")) return std.fmt.parseFloat(f32, value[0 .. value.len - 2]) catch null;
    if (std.mem.endsWith(u8, value, "rem")) { const num = std.fmt.parseFloat(f32, value[0 .. value.len - 3]) catch return null; return num * 16.0; }
    if (std.mem.endsWith(u8, value, "%")) return std.fmt.parseFloat(f32, value[0 .. value.len - 1]) catch null;
    return std.fmt.parseFloat(f32, value) catch null;
}

pub fn namedColor(name: []const u8) ?[3]u8 {
    if (lookup.find(named_colors_rules.Entry, &named_colors_rules.colors, "name", name)) |c| {
        return .{ c.r, c.g, c.b };
    }
    return null;
}

/// Map camelCase theme token name to Zig enum field name.
/// e.g. "bgAlt" → "bg_alt", "textSecondary" → "text_secondary", "error" → "@\"error\""
fn themeTokenField(name: []const u8) ?[]const u8 {
    const Entry = theme_rules.Entry;
    return lookup.map(Entry, &theme_rules.theme_tokens, "css", "zig", name);
}

/// Map camelCase style token name to Zig enum field name.
/// e.g. "radiusMd" → "radius_md", "spacingSm" → "spacing_sm"
fn styleTokenField(name: []const u8) ?[]const u8 {
    const Entry = theme_rules.Entry;
    return lookup.map(Entry, &theme_rules.style_tokens, "css", "zig", name);
}

/// Parse a style token reference and return the Zig expression.
/// e.g. "radiusMd" → "Theme.getFloat(.radius_md)"
fn parseStyleTokenValue(self: *Generator, token_name: []const u8) ?[]const u8 {
    const field = styleTokenField(token_name) orelse {
        self.addWarning(0, std.fmt.allocPrint(self.alloc, "Unknown style token: '{s}'", .{token_name}) catch "Unknown style token");
        return null;
    };
    self.has_theme = true;
    return std.fmt.allocPrint(self.alloc, "Theme.getFloat(.{s})", .{field}) catch null;
}
