//! Attribute parsing — styles, strings, expressions, template literals, colors.
//!
//! Leaf functions called by jsx.zig during JSX element parsing.
//! Also contains style key mappings and CSS normalization helpers.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;

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
                    // Non-string color (e.g., item.color where color is packed 0xRRGGBB i64)
                    const val = consumeStyleValueExpr(self);
                    if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                    try fields.appendSlice(self.alloc, ".");
                    try fields.appendSlice(self.alloc, color_field);
                    try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
                        " = Color.rgb(@intCast(({s} >> 16) & 0xFF), @intCast(({s} >> 8) & 0xFF), @intCast({s} & 0xFF))",
                        .{ val, val, val }));
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
                    if (std.mem.startsWith(u8, str_val, "theme-")) {
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
                            self.dyn_styles[self.dyn_style_count] = .{
                                .field = zig_key,
                                .expression = try std.fmt.allocPrint(self.alloc, "@as(f32, @floatFromInt({s}))", .{val}),
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
    while (self.curKind() != .eof) {
        const k = self.curKind();
        // Stop at comma or closing brace (unless inside nested parens/braces)
        if (depth == 0 and (k == .comma or k == .rbrace)) break;
        if (k == .lparen or k == .lbrace) depth += 1;
        if ((k == .rparen or k == .rbrace) and depth > 0) depth -= 1;
        const txt = self.curText();
        if (k == .identifier) {
            // Check map item param: bar.field → _oa{N}_{field}[_i]
            if (self.map_item_param != null and std.mem.eql(u8, txt, self.map_item_param.?)) {
                self.advance_token();
                if (self.curKind() == .dot) {
                    self.advance_token(); // skip dot
                    const field_name = self.curText();
                    self.advance_token(); // skip field
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
                continue;
            }
            // Check map index param: i → _i
            if (self.map_index_param) |idx_p| {
                if (std.mem.eql(u8, txt, idx_p)) {
                    expr.appendSlice(self.alloc, "@as(f32, @floatFromInt(_i))") catch {};
                    self.advance_token();
                    continue;
                }
            }
            if (self.findProp(txt)) |resolved| {
                expr.appendSlice(self.alloc, resolved) catch {};
            } else {
                expr.appendSlice(self.alloc, txt) catch {};
            }
        } else {
            // Operators need spaces around them for valid Zig
            if (k == .plus or k == .minus or k == .star or k == .slash) {
                if (expr.items.len > 0 and expr.items[expr.items.len - 1] != ' ')
                    expr.append(self.alloc, ' ') catch {};
                expr.appendSlice(self.alloc, txt) catch {};
                expr.append(self.alloc, ' ') catch {};
            } else {
                expr.appendSlice(self.alloc, txt) catch {};
            }
        }
        self.advance_token();
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
        const val = self.curText();
        self.advance_token();
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
            } else {
                // Unknown expression — embed as static text
                const warn_msg = std.fmt.allocPrint(self.alloc,
                    "expression '${{{s}}}' in template literal could not be resolved — embedded as static text", .{expr}) catch "unresolved template expression";
                self.addWarning(0, warn_msg);
                try fmt.appendSlice(self.alloc, expr);
            }
        } else {
            try fmt.append(self.alloc, inner[i]);
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

// ── Style key mappings ──

const EnumMapping = struct { field: []const u8, prefix: []const u8 };

pub fn mapStyleKey(key: []const u8) ?[]const u8 {
    const mappings = .{
        .{ "width", "width" }, .{ "height", "height" },
        .{ "minWidth", "min_width" }, .{ "maxWidth", "max_width" },
        .{ "minHeight", "min_height" }, .{ "maxHeight", "max_height" },
        .{ "flexGrow", "flex_grow" }, .{ "flexShrink", "flex_shrink" }, .{ "flexBasis", "flex_basis" },
        .{ "gap", "gap" },
        .{ "padding", "padding" }, .{ "paddingLeft", "padding_left" }, .{ "paddingRight", "padding_right" },
        .{ "paddingTop", "padding_top" }, .{ "paddingBottom", "padding_bottom" },
        .{ "margin", "margin" }, .{ "marginLeft", "margin_left" }, .{ "marginRight", "margin_right" },
        .{ "marginTop", "margin_top" }, .{ "marginBottom", "margin_bottom" },
        .{ "borderRadius", "border_radius" }, .{ "opacity", "opacity" }, .{ "borderWidth", "border_width" },
        .{ "shadowOffsetX", "shadow_offset_x" }, .{ "shadowOffsetY", "shadow_offset_y" }, .{ "shadowBlur", "shadow_blur" },
        .{ "top", "top" }, .{ "left", "left" }, .{ "right", "right" }, .{ "bottom", "bottom" },
        .{ "aspectRatio", "aspect_ratio" }, .{ "rotation", "rotation" }, .{ "scaleX", "scale_x" }, .{ "scaleY", "scale_y" },
    };
    inline for (mappings) |m| {
        if (std.mem.eql(u8, key, m[0])) return m[1];
    }
    return null;
}

pub fn mapStyleKeyI16(key: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, key, "zIndex")) return "z_index";
    return null;
}

pub fn mapColorKey(key: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, key, "backgroundColor")) return "background_color";
    if (std.mem.eql(u8, key, "borderColor")) return "border_color";
    if (std.mem.eql(u8, key, "shadowColor")) return "shadow_color";
    if (std.mem.eql(u8, key, "gradientColorEnd")) return "gradient_color_end";
    return null;
}

pub fn mapEnumKey(key: []const u8) ?EnumMapping {
    if (std.mem.eql(u8, key, "flexDirection")) return .{ .field = "flex_direction", .prefix = "fd" };
    if (std.mem.eql(u8, key, "justifyContent")) return .{ .field = "justify_content", .prefix = "jc" };
    if (std.mem.eql(u8, key, "alignItems")) return .{ .field = "align_items", .prefix = "ai" };
    if (std.mem.eql(u8, key, "alignSelf")) return .{ .field = "align_self", .prefix = "as" };
    if (std.mem.eql(u8, key, "flexWrap")) return .{ .field = "flex_wrap", .prefix = "fw" };
    if (std.mem.eql(u8, key, "position")) return .{ .field = "position", .prefix = "pos" };
    if (std.mem.eql(u8, key, "display")) return .{ .field = "display", .prefix = "d" };
    if (std.mem.eql(u8, key, "textAlign")) return .{ .field = "text_align", .prefix = "ta" };
    if (std.mem.eql(u8, key, "overflow")) return .{ .field = "overflow", .prefix = "ov" };
    if (std.mem.eql(u8, key, "gradientDirection")) return .{ .field = "gradient_direction", .prefix = "gd" };
    return null;
}

pub fn mapEnumValue(prefix: []const u8, value: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, prefix, "fd")) { if (std.mem.eql(u8, value, "row")) return ".row"; if (std.mem.eql(u8, value, "column")) return ".column"; }
    if (std.mem.eql(u8, prefix, "jc")) { if (std.mem.eql(u8, value, "start")) return ".start"; if (std.mem.eql(u8, value, "center")) return ".center"; if (std.mem.eql(u8, value, "end")) return ".end"; if (std.mem.eql(u8, value, "space-between") or std.mem.eql(u8, value, "spaceBetween")) return ".space_between"; if (std.mem.eql(u8, value, "space-around") or std.mem.eql(u8, value, "spaceAround")) return ".space_around"; if (std.mem.eql(u8, value, "space-evenly") or std.mem.eql(u8, value, "spaceEvenly")) return ".space_evenly"; if (std.mem.eql(u8, value, "flex-start") or std.mem.eql(u8, value, "flexStart")) return ".start"; if (std.mem.eql(u8, value, "flex-end") or std.mem.eql(u8, value, "flexEnd")) return ".end"; }
    if (std.mem.eql(u8, prefix, "ai")) { if (std.mem.eql(u8, value, "start") or std.mem.eql(u8, value, "flexStart") or std.mem.eql(u8, value, "flex-start")) return ".start"; if (std.mem.eql(u8, value, "center")) return ".center"; if (std.mem.eql(u8, value, "end") or std.mem.eql(u8, value, "flexEnd") or std.mem.eql(u8, value, "flex-end")) return ".end"; if (std.mem.eql(u8, value, "stretch")) return ".stretch"; }
    if (std.mem.eql(u8, prefix, "d")) { if (std.mem.eql(u8, value, "flex")) return ".flex"; if (std.mem.eql(u8, value, "none")) return ".none"; }
    if (std.mem.eql(u8, prefix, "ta")) { if (std.mem.eql(u8, value, "left")) return ".left"; if (std.mem.eql(u8, value, "center")) return ".center"; if (std.mem.eql(u8, value, "right")) return ".right"; }
    if (std.mem.eql(u8, prefix, "as")) { if (std.mem.eql(u8, value, "auto")) return ".auto"; if (std.mem.eql(u8, value, "start") or std.mem.eql(u8, value, "flexStart") or std.mem.eql(u8, value, "flex-start")) return ".start"; if (std.mem.eql(u8, value, "center")) return ".center"; if (std.mem.eql(u8, value, "end") or std.mem.eql(u8, value, "flexEnd") or std.mem.eql(u8, value, "flex-end")) return ".end"; if (std.mem.eql(u8, value, "stretch")) return ".stretch"; }
    if (std.mem.eql(u8, prefix, "fw")) { if (std.mem.eql(u8, value, "nowrap") or std.mem.eql(u8, value, "noWrap")) return ".no_wrap"; if (std.mem.eql(u8, value, "wrap")) return ".wrap"; }
    if (std.mem.eql(u8, prefix, "pos")) { if (std.mem.eql(u8, value, "relative")) return ".relative"; if (std.mem.eql(u8, value, "absolute")) return ".absolute"; }
    if (std.mem.eql(u8, prefix, "ov")) { if (std.mem.eql(u8, value, "visible")) return ".visible"; if (std.mem.eql(u8, value, "hidden")) return ".hidden"; if (std.mem.eql(u8, value, "scroll")) return ".scroll"; }
    if (std.mem.eql(u8, prefix, "gd")) { if (std.mem.eql(u8, value, "vertical")) return ".vertical"; if (std.mem.eql(u8, value, "horizontal")) return ".horizontal"; if (std.mem.eql(u8, value, "none")) return ".none"; }
    return null;
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
    if (std.mem.eql(u8, name, "black")) return .{ 0, 0, 0 };
    if (std.mem.eql(u8, name, "white")) return .{ 255, 255, 255 };
    if (std.mem.eql(u8, name, "red")) return .{ 255, 0, 0 };
    if (std.mem.eql(u8, name, "green")) return .{ 0, 128, 0 };
    if (std.mem.eql(u8, name, "blue")) return .{ 0, 0, 255 };
    if (std.mem.eql(u8, name, "yellow")) return .{ 255, 255, 0 };
    if (std.mem.eql(u8, name, "cyan")) return .{ 0, 255, 255 };
    if (std.mem.eql(u8, name, "magenta")) return .{ 255, 0, 255 };
    if (std.mem.eql(u8, name, "gray")) return .{ 128, 128, 128 };
    if (std.mem.eql(u8, name, "grey")) return .{ 128, 128, 128 };
    if (std.mem.eql(u8, name, "silver")) return .{ 192, 192, 192 };
    if (std.mem.eql(u8, name, "orange")) return .{ 255, 165, 0 };
    if (std.mem.eql(u8, name, "transparent")) return .{ 0, 0, 0 };
    return null;
}

/// Map camelCase theme token name to Zig enum field name.
/// e.g. "bgAlt" → "bg_alt", "textSecondary" → "text_secondary", "error" → "@\"error\""
fn themeTokenField(name: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, name, "bg")) return "bg";
    if (std.mem.eql(u8, name, "bgAlt")) return "bg_alt";
    if (std.mem.eql(u8, name, "bgElevated")) return "bg_elevated";
    if (std.mem.eql(u8, name, "surface")) return "surface";
    if (std.mem.eql(u8, name, "surfaceHover")) return "surface_hover";
    if (std.mem.eql(u8, name, "border")) return "border";
    if (std.mem.eql(u8, name, "borderFocus")) return "border_focus";
    if (std.mem.eql(u8, name, "text")) return "text";
    if (std.mem.eql(u8, name, "textSecondary")) return "text_secondary";
    if (std.mem.eql(u8, name, "textDim")) return "text_dim";
    if (std.mem.eql(u8, name, "primary")) return "primary";
    if (std.mem.eql(u8, name, "primaryHover")) return "primary_hover";
    if (std.mem.eql(u8, name, "primaryPressed")) return "primary_pressed";
    if (std.mem.eql(u8, name, "accent")) return "accent";
    if (std.mem.eql(u8, name, "error")) return "@\"error\"";
    if (std.mem.eql(u8, name, "warning")) return "warning";
    if (std.mem.eql(u8, name, "success")) return "success";
    if (std.mem.eql(u8, name, "info")) return "info";
    return null;
}

/// Map camelCase style token name to Zig enum field name.
/// e.g. "radiusMd" → "radius_md", "spacingSm" → "spacing_sm"
fn styleTokenField(name: []const u8) ?[]const u8 {
    if (std.mem.eql(u8, name, "radiusSm")) return "radius_sm";
    if (std.mem.eql(u8, name, "radiusMd")) return "radius_md";
    if (std.mem.eql(u8, name, "radiusLg")) return "radius_lg";
    if (std.mem.eql(u8, name, "spacingSm")) return "spacing_sm";
    if (std.mem.eql(u8, name, "spacingMd")) return "spacing_md";
    if (std.mem.eql(u8, name, "spacingLg")) return "spacing_lg";
    if (std.mem.eql(u8, name, "borderThin")) return "border_thin";
    if (std.mem.eql(u8, name, "borderMedium")) return "border_medium";
    if (std.mem.eql(u8, name, "fontSm")) return "font_sm";
    if (std.mem.eql(u8, name, "fontMd")) return "font_md";
    if (std.mem.eql(u8, name, "fontLg")) return "font_lg";
    return null;
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
