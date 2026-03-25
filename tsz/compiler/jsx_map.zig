//! Map (.map()) parsing and style merging — extracted from jsx.zig.
//!
//! Handles items.map((item, index) => (<JSX/>)) templates, producing
//! MapInfo and MapInnerNode structures for the codegen pipeline.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");
const handlers = @import("handlers.zig");
const components = @import("components.zig");
const html_tags = @import("html_tags.zig");
const jsx_conditional = @import("jsx_conditional.zig");

/// Parse `items.map((item, index) => (<JSX/>))` and register a MapInfo.
/// Returns ".{}" as a placeholder node — the real nodes come from the pool at runtime.
pub fn parseMapExpression(self: *Generator) anyerror![]const u8 {
    const array_name = self.curText();
    const computed_idx = self.isComputedArray(array_name);
    // Check object arrays BEFORE plain array state — OA arrays have per-field
    // storage and must not fall through to the i64 getArraySlot path, which
    // would generate _item.field access on a raw i64 (Zig compile error).
    const obj_arr_idx = if (computed_idx == null) self.isObjectArray(array_name) else null;
    const state_idx = if (computed_idx == null and obj_arr_idx == null) self.isArrayState(array_name) else null;

    if (computed_idx == null and state_idx == null and obj_arr_idx == null) {
        // Not a known array source — skip past the .map() and return empty
        self.advance_token(); // identifier
        return ".{}";
    }

    self.advance_token(); // identifier (items)
    self.advance_token(); // .
    self.advance_token(); // map
    if (self.curKind() == .lparen) self.advance_token(); // (

    // Parse callback params: (item) or (item, index) or item =>
    if (self.curKind() == .lparen) self.advance_token(); // (
    const item_param = self.curText();
    self.advance_token(); // item
    var index_param: ?[]const u8 = null;
    if (self.curKind() == .comma) {
        self.advance_token(); // ,
        index_param = self.curText();
        self.advance_token(); // index
    }
    if (self.curKind() == .rparen) self.advance_token(); // )
    if (self.curKind() == .arrow) self.advance_token(); // =>

    // Skip optional ( around JSX
    var had_paren = false;
    if (self.curKind() == .lparen) {
        self.advance_token();
        had_paren = true;
    }

    // Set map context for template literal parsing
    // Save outer index param for nested maps (ci in inner map resolves to outer _i)
    if (self.map_index_param != null) {
        self.parent_map_index_param = self.map_index_param;
    }
    self.map_item_param = item_param;
    self.map_index_param = index_param;
    if (computed_idx) |ci| {
        self.map_item_type = self.computed_arrays[ci].element_type;
    }
    self.map_obj_array_idx = obj_arr_idx;

    // Pre-reserve map slot so nested maps can reference this as parent
    const my_map_idx = self.map_count;
    self.map_count += 1;

    // Parse the JSX template
    const template = try parseMapTemplate(self);

    // Clear map context
    self.map_item_param = null;
    self.map_index_param = null;
    self.map_item_type = null;
    self.map_obj_array_idx = null;

    // Skip optional ) after JSX
    if (had_paren and self.curKind() == .rparen) self.advance_token();

    // Skip ) closing map call
    if (self.curKind() == .rparen) self.advance_token();

    // Record map info (slot already reserved at my_map_idx)
    if (my_map_idx < codegen.MAX_MAPS) {
        if (computed_idx) |ci| {
            self.maps[my_map_idx] = .{
                .array_slot_id = 0,
                .item_param = item_param,
                .index_param = index_param,
                .parent_arr_name = "",
                .child_idx = 0,
                .outer_style = template.outer_style,
                .outer_font_size = template.outer_font_size,
                .outer_text_color = template.outer_text_color,
                .inner_nodes = template.inner_nodes,
                .inner_count = template.inner_count,
                .is_self_closing = template.is_self_closing,
                .is_text_element = template.is_text_element,
                .is_computed = true,
                .computed_idx = ci,
                .computed_element_type = self.computed_arrays[ci].element_type,
                .handler_body = template.handler_body,
                .pool_display_cond = template.pool_display_cond,
            };
        } else if (obj_arr_idx) |oi| {
            self.maps[my_map_idx] = .{
                .array_slot_id = 0,
                .item_param = item_param,
                .index_param = index_param,
                .parent_arr_name = "",
                .child_idx = 0,
                .outer_style = template.outer_style,
                .outer_font_size = template.outer_font_size,
                .outer_text_color = template.outer_text_color,
                .inner_nodes = template.inner_nodes,
                .inner_count = template.inner_count,
                .is_self_closing = template.is_self_closing,
                .is_text_element = template.is_text_element,
                .is_object_array = true,
                .object_array_idx = oi,
                .handler_body = template.handler_body,
                .pool_display_cond = template.pool_display_cond,
            };
        } else {
            const si = state_idx.?;
            const is_str_arr = std.meta.activeTag(self.state_slots[si].initial) == .string_array;
            self.maps[my_map_idx] = .{
                .array_slot_id = if (is_str_arr) 0 else self.arraySlotId(si),
                .item_param = item_param,
                .index_param = index_param,
                .parent_arr_name = "",
                .child_idx = 0,
                .outer_style = template.outer_style,
                .outer_font_size = template.outer_font_size,
                .outer_text_color = template.outer_text_color,
                .inner_nodes = template.inner_nodes,
                .inner_count = template.inner_count,
                .is_self_closing = template.is_self_closing,
                .is_text_element = template.is_text_element,
                .is_string_array = is_str_arr,
                .string_array_slot_id = if (is_str_arr) self.stringArraySlotId(si) else 0,
                .handler_body = template.handler_body,
                .pool_display_cond = template.pool_display_cond,
            };
        }
        // map_count already incremented via pre-reservation
    } else {
        self.setError("Too many .map() lists (limit: 32)");
    }

    return ".{}";
}

/// Parse the JSX template inside a .map() callback — the outer element and its children.
fn parseMapTemplate(self: *Generator) anyerror!codegen.MapTemplateResult {
    if (self.curKind() != .lt) return .{
        .outer_style = "",
        .outer_font_size = "",
        .outer_text_color = "",
        .inner_nodes = undefined,
        .inner_count = 0,
        .is_self_closing = true,
        .is_text_element = false,
    };
    self.advance_token(); // <

    var tag = self.curText();
    self.advance_token(); // tag name (or "C")
    // HTML tag → primitive resolution
    if (html_tags.resolve(tag)) |prim| {
        tag = prim;
    }
    // Handle C.Name classifier references
    var cls_idx: ?u32 = null;
    if (std.mem.eql(u8, tag, "C") and self.curKind() == .dot) {
        self.advance_token(); // .
        const cls_name = self.curText();
        self.advance_token(); // actual name
        if (self.findClassifier(cls_name)) |idx| {
            tag = self.classifier_primitives[idx];
            cls_idx = @intCast(idx);
        }
    }
    const is_text = std.mem.eql(u8, tag, "Text");

    // Pre-populate from classifier (style + text props)
    var style_str: []const u8 = if (cls_idx) |ci| self.classifier_styles[ci] else "";
    var font_size: []const u8 = "";
    var text_color: []const u8 = "";
    if (cls_idx) |ci| {
        const tp = self.classifier_text_props[ci];
        if (tp.len > 0) {
            if (std.mem.indexOf(u8, tp, ".font_size = ")) |fs_pos| {
                const after = tp[fs_pos + 13 ..];
                const end = std.mem.indexOfAny(u8, after, &[_]u8{ ',', 0 }) orelse after.len;
                font_size = after[0..end];
            }
            if (std.mem.indexOf(u8, tp, ".text_color = ")) |tc_pos| {
                const after = tp[tc_pos + 14 ..];
                // text_color value ends at comma or end-of-string
                const end = std.mem.indexOf(u8, after, ", .") orelse after.len;
                text_color = after[0..end];
            }
        }
    }
    var handler_body: []const u8 = "";
    const pool_display_cond: []const u8 = "";
    var is_self_closing = false;

    // Parse attributes
    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const attr = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token(); // =
                if (std.mem.eql(u8, attr, "style")) {
                    style_str = try attrs.parseStyleAttr(self);
                } else if (std.mem.eql(u8, attr, "fontSize")) {
                    font_size = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr, "color")) {
                    const hex = try attrs.parseStringAttr(self);
                    text_color = try attrs.parseColorValue(self, hex);
                } else if (std.mem.eql(u8, attr, "onPress")) {
                    const start = self.pos;
                    try attrs.skipAttrValue(self);
                    handler_body = try handlers.emitHandlerBody(self, start);
                } else {
                    try attrs.skipAttrValue(self);
                }
            }
        } else {
            self.advance_token();
        }
    }

    if (self.curKind() == .slash_gt) {
        self.advance_token();
        is_self_closing = true;
    } else {
        if (self.curKind() == .gt) self.advance_token();
    }

    var inner_nodes: [codegen.MAX_MAP_INNER]codegen.MapInnerNode = undefined;
    var inner_count: u32 = 0;

    if (!is_self_closing) {
        while (self.curKind() != .lt_slash and self.curKind() != .eof) {
            if (self.curKind() == .lt) {
                // Check if child is a component (uppercase tag) — inline it
                const peek_tag = if (self.pos + 1 < self.lex.count) self.lex.get(self.pos + 1).text(self.source) else "";
                if (peek_tag.len > 0 and peek_tag[0] >= 'A' and peek_tag[0] <= 'Z') {
                    var comp_idx: ?usize = null;
                    for (0..self.component_count) |ci| {
                        if (std.mem.eql(u8, self.components[ci].name, peek_tag)) { comp_idx = ci; break; }
                    }
                    if (comp_idx) |ci| {
                        // Component invocation inside map template — inline it
                        // Advance past < and tag name (inlineComponent expects attrs position)
                        self.advance_token(); // <
                        self.advance_token(); // TagName
                        // Resolve map index as _ci in prop expressions (component body may create inner maps)
                        const mc_before = self.map_count;
                        const parent_mi: i32 = if (self.map_count > 0) @as(i32, @intCast(self.map_count - 1)) else -1;
                        self.resolve_map_index_as_parent = true;
                        const comp_expr = try components.inlineComponent(self, &self.components[ci]);
                        self.resolve_map_index_as_parent = false;
                        // Mark any maps created during component inlining as nested
                        if (self.map_count > mc_before and parent_mi >= 0) {
                            for (mc_before..self.map_count) |nmi| {
                                self.maps[nmi].parent_map_idx = parent_mi;
                                self.maps[nmi].parent_inner_idx = inner_count;
                            }
                        }
                        if (inner_count < codegen.MAX_MAP_INNER) {
                            inner_nodes[inner_count] = .{
                                .font_size = "",
                                .text_color = "",
                                .text_fmt = "",
                                .text_args = "",
                                .is_dynamic_text = false,
                                .static_text = "",
                                .style = "",
                                .raw_expr = comp_expr,
                            };
                            inner_count += 1;
                        }
                    } else {
                        const mc2 = self.map_count;
                        const pmi2: i32 = if (self.map_count > 0) @as(i32, @intCast(self.map_count - 1)) else -1;
                        const child = try parseMapTemplateChild(self);
                        if (self.map_count > mc2 and pmi2 >= 0) {
                            for (mc2..self.map_count) |nmi| {
                                self.maps[nmi].parent_map_idx = pmi2;
                                self.maps[nmi].parent_inner_idx = inner_count;
                            }
                        }
                        if (inner_count < codegen.MAX_MAP_INNER) {
                            inner_nodes[inner_count] = child;
                            inner_count += 1;
                        }
                    }
                } else {
                    const mc_before = self.map_count;
                    const parent_mi: i32 = if (self.map_count > 0) @as(i32, @intCast(self.map_count - 1)) else -1;
                    const child = try parseMapTemplateChild(self);
                    // Check if child parsing created nested maps
                    if (self.map_count > mc_before and parent_mi >= 0) {
                        for (mc_before..self.map_count) |nmi| {
                            self.maps[nmi].parent_map_idx = parent_mi;
                            self.maps[nmi].parent_inner_idx = inner_count;
                        }
                    }
                    if (inner_count < codegen.MAX_MAP_INNER) {
                        inner_nodes[inner_count] = child;
                        inner_count += 1;
                    }
                }
            } else if (self.curKind() == .lbrace) {
                self.advance_token(); // {
                // Try conditional: {cond && <JSX>} → inner_node with display condition
                {
                    var cond_inners: [2]codegen.MapInnerNode = undefined;
                    var cond_count: u32 = 0;
                    if (try tryParseMapConditional(self, &cond_inners, &cond_count)) {
                        for (0..cond_count) |dsi| {
                            if (inner_count < codegen.MAX_MAP_INNER) {
                                // pool_display_cond not set here — the inner_node's
                                // own display condition handles visibility
                                inner_nodes[inner_count] = cond_inners[dsi];
                                inner_count += 1;
                            }
                        }
                        continue;
                    }
                }
                if (self.curKind() == .template_literal) {
                    const tl = try attrs.parseTemplateLiteral(self);
                    self.advance_token(); // template literal token
                    if (is_text and inner_count < codegen.MAX_MAP_INNER) {
                        inner_nodes[inner_count] = .{
                            .font_size = font_size,
                            .text_color = text_color,
                            .text_fmt = tl.fmt,
                            .text_args = tl.args,
                            .is_dynamic_text = tl.is_dynamic,
                            .static_text = if (!tl.is_dynamic) tl.static_text else "",
                            .style = "",
                        };
                        inner_count += 1;
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                } else if (self.curKind() == .identifier) {
                    // {item.field} or {index} — identifier reference in map template
                    const ident = self.curText();
                    var handled = false;
                    if (self.map_item_param) |param| {
                        if (std.mem.eql(u8, ident, param)) {
                            self.advance_token();
                            if (self.curKind() == .dot and self.map_obj_array_idx != null) {
                                self.advance_token(); // .
                                const field_name = self.curText();
                                self.advance_token(); // field
                                if (self.curKind() == .rbrace) {
                                    // Simple {item.field} expression
                                    const oa_idx = self.map_obj_array_idx.?;
                                    const oa = self.object_arrays[oa_idx];
                                    if (inner_count < codegen.MAX_MAP_INNER) {
                                        var text_fmt_r: []const u8 = "{d}";
                                        var text_args_r: []const u8 = "";
                                        for (0..oa.field_count) |fi| {
                                            if (std.mem.eql(u8, oa.fields[fi].name, field_name)) {
                                                switch (oa.fields[fi].field_type) {
                                                    .string => {
                                                        text_fmt_r = "{s}";
                                                        text_args_r = std.fmt.allocPrint(self.alloc,
                                                            "_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]]",
                                                            .{ oa_idx, field_name, oa_idx, field_name }) catch "";
                                                    },
                                                    else => {
                                                        text_args_r = std.fmt.allocPrint(self.alloc,
                                                            "_oa{d}_{s}[_i]", .{ oa_idx, field_name }) catch "";
                                                    },
                                                }
                                                break;
                                            }
                                        }
                                        if (text_args_r.len == 0) {
                                            text_args_r = std.fmt.allocPrint(self.alloc,
                                                "_oa{d}_{s}[_i]", .{ oa_idx, field_name }) catch "";
                                        }
                                        inner_nodes[inner_count] = .{
                                            .font_size = font_size,
                                            .text_color = text_color,
                                            .text_fmt = text_fmt_r,
                                            .text_args = text_args_r,
                                            .is_dynamic_text = true,
                                            .static_text = "",
                                            .style = "",
                                        };
                                        inner_count += 1;
                                    }
                                    self.advance_token(); // }
                                    handled = true;
                                }
                                // else: complex expression like {item.field == val} — fall through to skip
                            }
                            // else: no dot or no obj array — fall through
                        }
                    }
                    if (!handled) {
                        // Skip balanced braces for remaining expression
                        var bd: u32 = 1;
                        while (bd > 0 and self.curKind() != .eof) {
                            if (self.curKind() == .lbrace) bd += 1;
                            if (self.curKind() == .rbrace) { bd -= 1; if (bd == 0) break; }
                            self.advance_token();
                        }
                        if (self.curKind() == .rbrace) self.advance_token();
                    }
                } else {
                    // Skip balanced braces for non-identifier expressions
                    // (e.g., {tasks.map(...)}, {cond && <JSX>})
                    var brace_depth: u32 = 1;
                    while (brace_depth > 0 and self.curKind() != .eof) {
                        if (self.curKind() == .lbrace) brace_depth += 1;
                        if (self.curKind() == .rbrace) { brace_depth -= 1; if (brace_depth == 0) break; }
                        self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                }
            } else {
                // Raw text content
                const raw = attrs.collectTextContent(self);
                if (raw.len > 0 and is_text and inner_count < codegen.MAX_MAP_INNER) {
                    inner_nodes[inner_count] = .{
                        .font_size = font_size,
                        .text_color = text_color,
                        .text_fmt = "",
                        .text_args = "",
                        .is_dynamic_text = false,
                        .static_text = raw,
                        .style = "",
                    };
                    inner_count += 1;
                }
            }
        }
        // Skip closing tag (handles </Tag> and </C.Tag>)
        if (self.curKind() == .lt_slash) self.advance_token();
        if (self.curKind() == .identifier) self.advance_token();
        if (self.curKind() == .dot) self.advance_token();
        if (self.curKind() == .identifier) self.advance_token();
        if (self.curKind() == .gt) self.advance_token();
    }

    return .{
        .outer_style = style_str,
        .outer_font_size = font_size,
        .outer_text_color = text_color,
        .inner_nodes = inner_nodes,
        .inner_count = inner_count,
        .is_self_closing = is_self_closing,
        .is_text_element = is_text,
        .handler_body = handler_body,
        .pool_display_cond = pool_display_cond,
    };
}

/// Parse a single child element inside a .map() template.
fn parseMapTemplateChild(self: *Generator) anyerror!codegen.MapInnerNode {
    self.advance_token(); // <
    self.advance_token(); // tag name (or "C")
    // Handle C.Name classifier references
    var inner_cls_idx: ?u32 = null;
    if (self.curKind() == .dot) {
        self.advance_token(); // .
        const cls_name = self.curText();
        self.advance_token(); // actual name
        if (self.findClassifier(cls_name)) |idx| {
            inner_cls_idx = @intCast(idx);
        }
    }

    // Pre-populate from classifier
    var font_size: []const u8 = "";
    var text_color: []const u8 = "";
    var dyn_text_color: []const u8 = "";
    var dyn_href: []const u8 = "";
    var handler_body: []const u8 = "";
    var style_str: []const u8 = if (inner_cls_idx) |ci| self.classifier_styles[ci] else "";
    var is_self_closing = false;
    if (inner_cls_idx) |ci| {
        const tp = self.classifier_text_props[ci];
        if (tp.len > 0) {
            if (std.mem.indexOf(u8, tp, ".font_size = ")) |fs_pos| {
                const after = tp[fs_pos + 13 ..];
                const end = std.mem.indexOfAny(u8, after, &[_]u8{ ',', 0 }) orelse after.len;
                font_size = after[0..end];
            }
            if (std.mem.indexOf(u8, tp, ".text_color = ")) |tc_pos| {
                const after = tp[tc_pos + 14 ..];
                const end = std.mem.indexOf(u8, after, ", .") orelse after.len;
                text_color = after[0..end];
            }
        }
    }

    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const attr = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, attr, "style")) {
                    style_str = try attrs.parseStyleAttr(self);
                } else if (std.mem.eql(u8, attr, "fontSize")) {
                    font_size = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr, "color")) {
                    // Check for dynamic color: color={node.field}
                    if (self.curKind() == .lbrace and self.map_obj_array_idx != null and self.map_item_param != null) {
                        const saved = self.pos;
                        self.advance_token(); // {
                        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), self.map_item_param.?)) {
                            self.advance_token(); // node
                            if (self.curKind() == .dot) {
                                self.advance_token(); // .
                                const field_name = self.curText();
                                self.advance_token(); // field
                                if (self.curKind() == .rbrace) self.advance_token(); // }
                                const oa_idx = self.map_obj_array_idx.?;
                                const oa = self.object_arrays[oa_idx];
                                for (0..oa.field_count) |fi| {
                                    if (std.mem.eql(u8, oa.fields[fi].name, field_name)) {
                                        if (oa.fields[fi].field_type == .string) {
                                            dyn_text_color = try std.fmt.allocPrint(self.alloc,
                                                "Color.fromHex(_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]])",
                                                .{ oa_idx, field_name, oa_idx, field_name });
                                        } else {
                                            // Int field: packed 0xRRGGBB — bit-shift to Color
                                            const arr_expr = try std.fmt.allocPrint(self.alloc,
                                                "_oa{d}_{s}[_i]", .{ oa_idx, field_name });
                                            dyn_text_color = try std.fmt.allocPrint(self.alloc,
                                                "Color.rgb(@intCast(({s} >> 16) & 0xFF), @intCast(({s} >> 8) & 0xFF), @intCast({s} & 0xFF))",
                                                .{ arr_expr, arr_expr, arr_expr });
                                        }
                                        break;
                                    }
                                }
                            } else {
                                self.pos = saved;
                                const hex = try attrs.parseStringAttr(self);
                                text_color = try attrs.parseColorValue(self, hex);
                            }
                        } else {
                            self.pos = saved;
                            const hex = try attrs.parseStringAttr(self);
                            text_color = try attrs.parseColorValue(self, hex);
                        }
                    } else {
                        const hex = try attrs.parseStringAttr(self);
                        text_color = try attrs.parseColorValue(self, hex);
                    }
                } else if (std.mem.eql(u8, attr, "onPress")) {
                    const start = self.pos;
                    try attrs.skipAttrValue(self);
                    handler_body = try handlers.emitHandlerBody(self, start);
                } else if (std.mem.eql(u8, attr, "href")) {
                    // Dynamic href: href={item.field}
                    if (self.curKind() == .lbrace and self.map_obj_array_idx != null and self.map_item_param != null) {
                        const saved_h = self.pos;
                        self.advance_token(); // {
                        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), self.map_item_param.?)) {
                            self.advance_token(); // item
                            if (self.curKind() == .dot) {
                                self.advance_token(); // .
                                const field_name = self.curText();
                                self.advance_token(); // field
                                if (self.curKind() == .rbrace) self.advance_token(); // }
                                const oa_idx = self.map_obj_array_idx.?;
                                dyn_href = try std.fmt.allocPrint(self.alloc,
                                    "_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]]",
                                    .{ oa_idx, field_name, oa_idx, field_name });
                            } else {
                                self.pos = saved_h;
                                try attrs.skipAttrValue(self);
                            }
                        } else {
                            self.pos = saved_h;
                            try attrs.skipAttrValue(self);
                        }
                    } else {
                        try attrs.skipAttrValue(self);
                    }
                } else {
                    try attrs.skipAttrValue(self);
                }
            }
        } else {
            self.advance_token();
        }
    }

    if (self.curKind() == .slash_gt) {
        self.advance_token();
        is_self_closing = true;
    } else {
        if (self.curKind() == .gt) self.advance_token();
    }

    var text_fmt: []const u8 = "";
    var text_args: []const u8 = "";
    var is_dynamic_text = false;
    var static_text: []const u8 = "";

    var sub_nodes: [codegen.MAX_MAP_SUB]codegen.MapSubNode = undefined;
    var sub_count: u32 = 0;
    var handled_cond = false;

    if (!is_self_closing) {
        while (self.curKind() != .lt_slash and self.curKind() != .eof) {
            if (self.curKind() == .lt) {
                // Nested child element — parse as sub-node to capture text content
                const sub = try parseMapSubElement(self);
                if (sub_count < codegen.MAX_MAP_SUB) {
                    sub_nodes[sub_count] = sub;
                    sub_count += 1;
                }
            } else if (self.curKind() == .lbrace) {
                self.advance_token(); // {
                const brace_ident_pos = self.pos; // save position for conditional restore
                if (self.curKind() == .template_literal) {
                    const tl = try attrs.parseTemplateLiteral(self);
                    self.advance_token();
                    if (tl.is_dynamic) {
                        is_dynamic_text = true;
                        text_fmt = tl.fmt;
                        text_args = tl.args;
                    } else {
                        static_text = tl.static_text;
                    }
                } else if (self.curKind() == .identifier) {
                    const ident = self.curText();
                    // Detect nested map: {items.map(...)}
                    if (self.pos + 2 < self.lex.count and
                        self.lex.get(self.pos + 1).kind == .dot and
                        self.lex.get(self.pos + 2).kind == .identifier and
                        std.mem.eql(u8, self.lex.get(self.pos + 2).text(self.source), "map"))
                    {
                        _ = try parseMapExpression(self);
                        if (self.curKind() == .rbrace) self.advance_token();
                        continue;
                    }
                    self.advance_token();
                    if (self.map_item_param) |param| {
                        if (std.mem.eql(u8, ident, param)) {
                            if (self.curKind() == .dot and self.map_obj_array_idx != null) {
                                // Object array field access: {node.field.sub}
                                const field_name = self.consumeCompoundField();
                                // If followed by comparison, this is a conditional — don't mark as text
                                const nk2 = self.curKind();
                                if (nk2 != .eq_eq and nk2 != .not_eq and nk2 != .gt and nk2 != .lt and
                                    nk2 != .gt_eq and nk2 != .lt_eq and nk2 != .amp_amp)
                                {
                                    const oa_idx = self.map_obj_array_idx.?;
                                    const oa = self.object_arrays[oa_idx];
                                    for (0..oa.field_count) |fi| {
                                        if (std.mem.eql(u8, oa.fields[fi].name, field_name)) {
                                            is_dynamic_text = true;
                                            switch (oa.fields[fi].field_type) {
                                                .string => {
                                                    text_fmt = "{s}";
                                                    text_args = std.fmt.allocPrint(self.alloc,
                                                        "_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]]",
                                                        .{ oa_idx, field_name, oa_idx, field_name }) catch "";
                                                },
                                                .float => {
                                                    text_fmt = "{d}";
                                                    text_args = std.fmt.allocPrint(self.alloc,
                                                        "_oa{d}_{s}[_i]", .{ oa_idx, field_name }) catch "";
                                                },
                                                else => {
                                                    text_fmt = "{d}";
                                                    text_args = std.fmt.allocPrint(self.alloc,
                                                        "_oa{d}_{s}[_i]", .{ oa_idx, field_name }) catch "";
                                                },
                                            }
                                            break;
                                        }
                                    }
                                }
                            } else {
                                // Bare map item param — mark as dynamic text
                                is_dynamic_text = true;
                                text_fmt = "{s}";
                                text_args = ident;
                            }
                        }
                    }
                    if (!is_dynamic_text) {
                        if (self.map_index_param) |param| {
                            if (std.mem.eql(u8, ident, param)) {
                                // Only treat as dynamic text if NOT followed by a comparison/arithmetic
                                // operator — those indicate a conditional expression {i == 0 && <Box>}
                                const next_k = self.curKind();
                                if (next_k != .eq_eq and next_k != .not_eq and
                                    next_k != .gt and next_k != .lt and
                                    next_k != .gt_eq and next_k != .lt_eq and
                                    next_k != .percent and next_k != .plus and
                                    next_k != .minus and next_k != .amp_amp)
                                {
                                    is_dynamic_text = true;
                                    text_fmt = "{d}";
                                    text_args = ident;
                                }
                            }
                        }
                    }
                }
                // Check for conditional: {cond && <JSX>} or try balanced skip
                if (!is_dynamic_text and !handled_cond) {
                    // Restore position to before the consumed identifier so
                    // tryParseMapConditional can parse the full condition (e.g. "i == 0 && <Box>")
                    self.pos = brace_ident_pos;
                    var cond_inners_local: [2]codegen.MapInnerNode = undefined;
                    var cond_count_local: u32 = 0;
                    if (try tryParseMapConditional(self, &cond_inners_local, &cond_count_local)) {
                        // Convert MapInnerNode results back to sub_nodes for this context
                        for (0..cond_count_local) |ci2| {
                            const cinner = cond_inners_local[ci2];
                            // Add the conditional element as a sub_node, preserving all fields
                            if (sub_count < codegen.MAX_MAP_SUB) {
                                sub_nodes[sub_count] = .{
                                    .style = cinner.style,
                                    .font_size = cinner.font_size,
                                    .text_color = cinner.text_color,
                                    .text_fmt = cinner.text_fmt,
                                    .text_args = cinner.text_args,
                                    .is_dynamic_text = cinner.is_dynamic_text,
                                    .static_text = cinner.static_text,
                                };
                                sub_count += 1;
                            }
                        }
                        handled_cond = false;
                    } else {
                        // Not a conditional — skip balanced braces
                        var bd: u32 = 1;
                        while (bd > 0 and self.curKind() != .eof) {
                            if (self.curKind() == .lbrace) bd += 1;
                            if (self.curKind() == .rbrace) { bd -= 1; if (bd == 0) break; }
                            self.advance_token();
                        }
                        if (self.curKind() == .rbrace) self.advance_token();
                    }
                } else {
                    // Already handled text — skip to closing }
                    var bd: u32 = 1;
                    while (bd > 0 and self.curKind() != .eof) {
                        if (self.curKind() == .lbrace) bd += 1;
                        if (self.curKind() == .rbrace) { bd -= 1; if (bd == 0) break; }
                        self.advance_token();
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
                }
            } else if (self.curKind() != .lt_slash) {
                const raw = attrs.collectTextContent(self);
                if (raw.len > 0) static_text = raw;
            }
        }
        if (self.curKind() == .lt_slash) self.advance_token();
        if (self.curKind() == .identifier) self.advance_token();
        if (self.curKind() == .gt) self.advance_token();
    }

    return .{
        .font_size = font_size,
        .text_color = text_color,
        .text_fmt = text_fmt,
        .text_args = text_args,
        .is_dynamic_text = is_dynamic_text,
        .static_text = static_text,
        .style = style_str,
        .dyn_text_color = dyn_text_color,
        .dyn_href = dyn_href,
        .sub_nodes = sub_nodes,
        .sub_count = sub_count,
        .handler_body = handler_body,
    };
}

/// Try to parse a conditional expression inside braces: {cond && <JSX>}
/// Pattern: identifier.field == value && <Element>...</Element>
/// Returns true if a conditional sub-node was added, false if not a conditional.
/// The caller's brace depth tracking is at depth 1 (already consumed opening {).
fn tryParseMapConditional(
    self: *Generator,
    out_inners: *[2]codegen.MapInnerNode,
    out_count: *u32,
) !bool {
    // Look ahead: need identifier (possibly with .field), then comparison op, then value, then &&
    const saved = self.pos;

    // Build condition expression by consuming tokens until we hit &&
    var cond: std.ArrayListUnmanaged(u8) = .{};
    var found_and = false;
    var depth: u32 = 0;
    // Track last OA string field for empty-string comparison rewriting
    var last_oa_string_field: []const u8 = "";
    var last_oa_string_idx: u32 = 0;
    while (self.curKind() != .eof) {
        if (self.curKind() == .amp_amp and depth == 0) {
            // Only treat as render gate if the next token is '<' (start of JSX)
            const next_pos = self.pos + 1;
            const next_is_jsx = next_pos < self.lex.count and self.lex.get(next_pos).kind == .lt;
            if (next_is_jsx) {
                found_and = true;
                self.advance_token(); // skip &&
                break;
            }
            // Otherwise, this && is part of a compound condition (a && b && <JSX>)
            try cond.appendSlice(self.alloc, " and ");
            self.advance_token();
            continue;
        }
        if (self.curKind() == .rbrace and depth == 0) break; // no && found
        if (self.curKind() == .lparen) depth += 1;
        if (self.curKind() == .rparen and depth > 0) depth -= 1;
        // Resolve map references in the condition
        const txt = self.curText();
        const k = self.curKind();
        if (k == .identifier) {
            if (self.map_item_param) |param| {
                if (std.mem.eql(u8, txt, param) and self.pos + 2 < self.lex.count and
                    self.lex.get(self.pos + 1).kind == .dot)
                {
                    self.advance_token(); // item
                    const field = self.consumeCompoundField();
                    if (self.map_obj_array_idx) |oa_idx| {
                        // Check if this is a string field for empty-string comparison handling
                        const oa = self.object_arrays[oa_idx];
                        var is_str = false;
                        for (0..oa.field_count) |fci| {
                            if (std.mem.eql(u8, oa.fields[fci].name, field) and oa.fields[fci].field_type == .string) {
                                is_str = true;
                                break;
                            }
                        }
                        if (is_str) {
                            last_oa_string_field = field;
                            last_oa_string_idx = oa_idx;
                        } else {
                            last_oa_string_field = "";
                        }
                        try cond.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                            "_oa{d}_{s}[_i]", .{ oa_idx, field }) catch "0");
                    } else {
                        last_oa_string_field = "";
                        try cond.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                            "_item.{s}", .{field}) catch "0");
                    }
                    continue;
                }
            }
            if (self.map_index_param) |idx_p| {
                if (std.mem.eql(u8, txt, idx_p)) {
                    try cond.appendSlice(self.alloc, "@as(i64, @intCast(_i))");
                    self.advance_token();
                    continue;
                }
            }
            if (self.isState(txt)) |slot_id| {
                const rid = self.regularSlotId(slot_id);
                try cond.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                    "state.getSlot({d})", .{rid}) catch "0");
                self.advance_token();
                continue;
            }
            // Component prop resolution
            if (self.findProp(txt)) |prop_val| {
                try cond.appendSlice(self.alloc, prop_val);
                self.advance_token();
                continue;
            }
            // Parent map index param (outer _i for nested maps)
            if (self.parent_map_index_param) |pidx| {
                if (std.mem.eql(u8, txt, pidx)) {
                    try cond.appendSlice(self.alloc, "@as(i64, @intCast(_ci))");
                    self.advance_token();
                    continue;
                }
            }
        }
        if (k == .eq_eq) {
            try cond.appendSlice(self.alloc, " == ");
        } else if (k == .not_eq) {
            try cond.appendSlice(self.alloc, " != ");
        } else if (k == .gt_eq) {
            try cond.appendSlice(self.alloc, " >= ");
        } else if (k == .lt) {
            try cond.appendSlice(self.alloc, " < ");
        } else if (k == .gt) {
            try cond.appendSlice(self.alloc, " > ");
        } else if (k == .amp_amp) {
            try cond.appendSlice(self.alloc, " and ");
        } else if (k == .pipe_pipe) {
            try cond.appendSlice(self.alloc, " or ");
        } else if (k == .string and last_oa_string_field.len > 0 and
            (std.mem.eql(u8, txt, "''") or std.mem.eql(u8, txt, "\"\"")))
        {
            // Empty string comparison with OA string field:
            //   field != '' → _oa0_field_lens[_i] > 0
            //   field == '' → _oa0_field_lens[_i] == 0
            // Rewrite: remove the LHS + operator already appended, emit length check
            const is_neq = std.mem.endsWith(u8, cond.items, " != ");
            const op_len: usize = if (is_neq) 4 else if (std.mem.endsWith(u8, cond.items, " == ")) 4 else 0;
            if (op_len > 0) {
                // Find and remove "_oaN_field[_i] OP " — the field ref + operator
                const field_ref = std.fmt.allocPrint(self.alloc, "_oa{d}_{s}[_i]", .{ last_oa_string_idx, last_oa_string_field }) catch "";
                const remove_len = field_ref.len + op_len;
                if (cond.items.len >= remove_len) {
                    cond.items.len -= @intCast(remove_len);
                }
                try cond.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                    "_oa{d}_{s}_lens[_i] {s} 0", .{
                    last_oa_string_idx,
                    last_oa_string_field,
                    if (is_neq) @as([]const u8, ">") else @as([]const u8, "=="),
                }) catch "0");
            } else {
                try cond.appendSlice(self.alloc, txt);
            }
            last_oa_string_field = "";
        } else {
            try cond.appendSlice(self.alloc, txt);
        }
        self.advance_token();
    }

    if (!found_and or cond.items.len == 0) {
        self.pos = saved; // restore — not a conditional
        return false;
    }

    // After &&, expect <JSX> element
    if (self.curKind() != .lt) {
        // Skip to closing }
        var bd: u32 = 1;
        while (bd > 0 and self.curKind() != .eof) {
            if (self.curKind() == .lbrace) bd += 1;
            if (self.curKind() == .rbrace) { bd -= 1; if (bd == 0) break; }
            self.advance_token();
        }
        if (self.curKind() == .rbrace) self.advance_token();
        return true; // consumed but no element to render
    }

    // Parse the conditional element: extract its tag/style, then parse children as sub-nodes
    if (self.curKind() != .lt) {
        skipToClosingBrace(self);
        return true;
    }
    self.advance_token(); // <
    var cond_tag: []const u8 = "";
    if (self.curKind() == .identifier) { cond_tag = self.curText(); self.advance_token(); }
    // Resolve C.Name classifier references for the conditional element
    var cond_cls_idx: ?u32 = null;
    if (std.mem.eql(u8, cond_tag, "C") and self.curKind() == .dot) {
        self.advance_token(); // .
        const cls_name = self.curText();
        self.advance_token(); // actual name
        if (self.findClassifier(cls_name)) |idx| {
            cond_tag = self.classifier_primitives[idx];
            cond_cls_idx = @intCast(idx);
        }
    }

    // Pre-populate from classifier
    var outer_style: []const u8 = if (cond_cls_idx) |ci| self.classifier_styles[ci] else "";
    var cond_font_size: []const u8 = "";
    var cond_text_color: []const u8 = "";
    if (cond_cls_idx) |ci| {
        const tp = self.classifier_text_props[ci];
        if (tp.len > 0) {
            if (std.mem.indexOf(u8, tp, ".font_size = ")) |fs_pos| {
                const after = tp[fs_pos + 13 ..];
                const end = std.mem.indexOfAny(u8, after, &[_]u8{ ',', 0 }) orelse after.len;
                cond_font_size = after[0..end];
            }
            if (std.mem.indexOf(u8, tp, ".text_color = ")) |tc_pos| {
                const after = tp[tc_pos + 14 ..];
                const end = std.mem.indexOf(u8, after, ", .") orelse after.len;
                cond_text_color = after[0..end];
            }
        }
    }
    // Parse outer element attributes
    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const a = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, a, "style")) {
                    outer_style = try attrs.parseStyleAttr(self);
                } else if (std.mem.eql(u8, a, "fontSize")) {
                    cond_font_size = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, a, "color")) {
                    const hex = try attrs.parseStringAttr(self);
                    cond_text_color = try attrs.parseColorValue(self, hex);
                } else {
                    try attrs.skipAttrValue(self);
                }
            }
        } else self.advance_token();
    }
    const display_cond = try self.alloc.dupe(u8, cond.items);
    const cond_style = try std.fmt.allocPrint(self.alloc, "{s}{s}.display = if ({s}) .flex else .none",
        .{ if (outer_style.len > 0) outer_style else "", if (outer_style.len > 0) ", " else "", display_cond });

    if (self.curKind() == .slash_gt) {
        self.advance_token();
        if (out_count.* < 2) {
            out_inners[out_count.*] = .{
                .font_size = cond_font_size, .text_color = cond_text_color, .text_fmt = "", .text_args = "",
                .is_dynamic_text = false, .static_text = "", .style = cond_style,
            };
            out_count.* += 1;
        }
        skipToClosingBrace(self);
        return true;
    }
    if (self.curKind() == .gt) self.advance_token();

    // Capture text content of the conditional element (e.g. <Text>*</Text>)
    var cond_static_text: []const u8 = "";

    // Parse children of the conditional element as MapSubNodes (preserving handlers + leaves)
    var child_subs: [codegen.MAX_MAP_SUB]codegen.MapSubNode = undefined;
    var child_count: u32 = 0;
    var safety: u32 = 0;
    while (self.curKind() != .lt_slash and self.curKind() != .eof and safety < 500) : (safety += 1) {
        const prev_pos = self.pos;
        if (self.curKind() == .lt) {
            if (child_count < codegen.MAX_MAP_SUB) {
                child_subs[child_count] = try parseMapSubElement(self);
                child_count += 1;
            } else {
                skipBalancedElement(self);
            }
        } else if (self.curKind() == .lbrace) {
            self.advance_token();
            skipToClosingBrace(self);
        } else {
            // Raw text content — capture it
            const raw = attrs.collectTextContent(self);
            if (raw.len > 0) cond_static_text = raw;
        }
        if (self.pos == prev_pos) self.advance_token(); // prevent stuck
    }
    // Skip closing tag (handles C.Foo namespaced tags)
    if (self.curKind() == .lt_slash) self.advance_token();
    if (self.curKind() == .identifier) self.advance_token();
    if (self.curKind() == .dot) { self.advance_token(); if (self.curKind() == .identifier) self.advance_token(); }
    if (self.curKind() == .gt) self.advance_token();

    // Output as a MapInnerNode with children as sub_nodes
    if (out_count.* < 2) {
        var inner: codegen.MapInnerNode = .{
            .font_size = cond_font_size, .text_color = cond_text_color, .text_fmt = "", .text_args = "",
            .is_dynamic_text = false, .static_text = cond_static_text, .style = cond_style,
        };
        for (0..child_count) |ci| {
            if (inner.sub_count < codegen.MAX_MAP_SUB) {
                inner.sub_nodes[inner.sub_count] = child_subs[ci];
                inner.sub_count += 1;
            }
        }
        out_inners[out_count.*] = inner;
        out_count.* += 1;
    }

    skipToClosingBrace(self);
    return true;
}

/// Parse a nested child element inside a map template child.
/// Collects style, text, onPress handlers, and leaf children.
fn parseMapSubElement(self: *Generator) anyerror!codegen.MapSubNode {
    if (self.curKind() != .lt) return .{};
    self.advance_token(); // <
    var tag: []const u8 = "";
    if (self.curKind() == .identifier) { tag = self.curText(); self.advance_token(); }
    // Resolve C.Name classifier references
    var sub_cls_idx: ?u32 = null;
    if (std.mem.eql(u8, tag, "C") and self.curKind() == .dot) {
        self.advance_token(); // .
        const cls_name = self.curText();
        self.advance_token(); // actual name
        if (self.findClassifier(cls_name)) |idx| {
            tag = self.classifier_primitives[idx];
            sub_cls_idx = @intCast(idx);
        }
    }

    // Pre-populate from classifier
    var sub_font: []const u8 = "";
    var sub_color: []const u8 = "";
    var sub_style: []const u8 = if (sub_cls_idx) |ci| self.classifier_styles[ci] else "";
    var sub_handler: []const u8 = "";
    if (sub_cls_idx) |ci| {
        const tp = self.classifier_text_props[ci];
        if (tp.len > 0) {
            if (std.mem.indexOf(u8, tp, ".font_size = ")) |fs_pos| {
                const after = tp[fs_pos + 13 ..];
                const end = std.mem.indexOfAny(u8, after, &[_]u8{ ',', 0 }) orelse after.len;
                sub_font = after[0..end];
            }
            if (std.mem.indexOf(u8, tp, ".text_color = ")) |tc_pos| {
                const after = tp[tc_pos + 14 ..];
                const end = std.mem.indexOf(u8, after, ", .") orelse after.len;
                sub_color = after[0..end];
            }
        }
    }

    // Parse attributes
    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const a = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, a, "style")) {
                    sub_style = try attrs.parseStyleAttr(self);
                } else if (std.mem.eql(u8, a, "fontSize")) {
                    sub_font = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, a, "color")) {
                    const hex = try attrs.parseStringAttr(self);
                    sub_color = try attrs.parseColorValue(self, hex);
                } else if (std.mem.eql(u8, a, "onPress")) {
                    const start = self.pos;
                    try attrs.skipAttrValue(self);
                    sub_handler = try handlers.emitHandlerBody(self, start);
                } else {
                    try attrs.skipAttrValue(self);
                }
            }
        } else {
            self.advance_token();
        }
    }

    if (self.curKind() == .slash_gt) {
        self.advance_token();
        return .{ .style = sub_style, .font_size = sub_font, .text_color = sub_color, .handler_body = sub_handler };
    }
    if (self.curKind() == .gt) self.advance_token();

    // Parse content — extract text and collect leaf children
    var sub_fmt: []const u8 = "";
    var sub_args: []const u8 = "";
    var sub_dynamic = false;
    var sub_static: []const u8 = "";
    var leaves: [codegen.MAX_MAP_LEAVES]codegen.MapLeafNode = undefined;
    var leaf_count: u32 = 0;

    var sub_safety: u32 = 0;
    while (self.curKind() != .lt_slash and self.curKind() != .eof and sub_safety < 500) : (sub_safety += 1) {
        const sub_prev = self.pos;
        if (self.curKind() == .lt) {
            // Parse child element as a leaf node (preserving structure)
            const leaf = try parseMapLeafElement(self);
            if (leaf_count < codegen.MAX_MAP_LEAVES) {
                leaves[leaf_count] = leaf;
                leaf_count += 1;
            }
        } else if (self.curKind() == .lbrace) {
            self.advance_token(); // {
            // Check for conditional: {cond && <JSX>} → leaf with display_cond
            var cond_handled = false;
            var cond_inners_sub: [2]codegen.MapInnerNode = undefined;
            var cond_count_sub: u32 = 0;
            if (try tryParseMapConditional(self, &cond_inners_sub, &cond_count_sub)) {
                for (0..cond_count_sub) |ci2| {
                    if (leaf_count < codegen.MAX_MAP_LEAVES) {
                        const cinner = cond_inners_sub[ci2];
                        leaves[leaf_count] = .{
                            .style = cinner.style,
                            .static_text = if (cinner.static_text.len > 0) cinner.static_text else "",
                            .font_size = cinner.font_size,
                            .text_color = cinner.text_color,
                        };
                        leaf_count += 1;
                    }
                }
                cond_handled = true;
            }
            if (!cond_handled) {
                const text_result = try parseMapTextExpr(self);
                if (text_result.is_dynamic) { sub_dynamic = true; sub_fmt = text_result.fmt; sub_args = text_result.args; }
                else if (text_result.static_text.len > 0) { sub_static = text_result.static_text; }
                skipToClosingBrace(self);
            }
        } else {
            const raw = attrs.collectTextContent(self);
            if (raw.len > 0) sub_static = raw;
        }
        if (self.pos == sub_prev) self.advance_token(); // prevent stuck
    }

    // Skip closing tag
    if (self.curKind() == .lt_slash) self.advance_token();
    if (self.curKind() == .identifier) self.advance_token();
    if (self.curKind() == .dot) { self.advance_token(); if (self.curKind() == .identifier) self.advance_token(); }
    if (self.curKind() == .gt) self.advance_token();

    return .{
        .font_size = sub_font,
        .text_color = sub_color,
        .text_fmt = sub_fmt,
        .text_args = sub_args,
        .is_dynamic_text = sub_dynamic,
        .static_text = sub_static,
        .style = sub_style,
        .handler_body = sub_handler,
        .leaves = if (leaf_count > 0) (self.alloc.dupe(codegen.MapLeafNode, leaves[0..leaf_count]) catch &[_]codegen.MapLeafNode{}) else &[_]codegen.MapLeafNode{},
        .leaf_count = leaf_count,
    };
}

/// Parse a leaf element (deepest level in map body). Collects style + text only.
fn parseMapLeafElement(self: *Generator) !codegen.MapLeafNode {
    if (self.curKind() != .lt) return .{};
    self.advance_token(); // <
    var leaf_tag: []const u8 = "";
    if (self.curKind() == .identifier) { leaf_tag = self.curText(); self.advance_token(); }
    // Resolve C.Name classifier references
    var leaf_cls_idx: ?u32 = null;
    if (std.mem.eql(u8, leaf_tag, "C") and self.curKind() == .dot) {
        self.advance_token(); // .
        const cls_name = self.curText();
        self.advance_token(); // actual name
        if (self.findClassifier(cls_name)) |idx| {
            leaf_tag = self.classifier_primitives[idx];
            leaf_cls_idx = @intCast(idx);
        }
    }

    // Pre-populate from classifier
    var leaf_font: []const u8 = "";
    var leaf_color: []const u8 = "";
    var leaf_style: []const u8 = if (leaf_cls_idx) |ci| self.classifier_styles[ci] else "";
    if (leaf_cls_idx) |ci| {
        const tp = self.classifier_text_props[ci];
        if (tp.len > 0) {
            if (std.mem.indexOf(u8, tp, ".font_size = ")) |fs_pos| {
                const after = tp[fs_pos + 13 ..];
                const end = std.mem.indexOfAny(u8, after, &[_]u8{ ',', 0 }) orelse after.len;
                leaf_font = after[0..end];
            }
            if (std.mem.indexOf(u8, tp, ".text_color = ")) |tc_pos| {
                const after = tp[tc_pos + 14 ..];
                const end = std.mem.indexOf(u8, after, ", .") orelse after.len;
                leaf_color = after[0..end];
            }
        }
    }

    var leaf_handler: []const u8 = "";

    // Parse attributes
    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const a = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, a, "style")) {
                    leaf_style = try attrs.parseStyleAttr(self);
                } else if (std.mem.eql(u8, a, "fontSize")) {
                    leaf_font = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, a, "color")) {
                    const hex = try attrs.parseStringAttr(self);
                    leaf_color = try attrs.parseColorValue(self, hex);
                } else if (std.mem.eql(u8, a, "onPress")) {
                    const start = self.pos;
                    try attrs.skipAttrValue(self);
                    leaf_handler = try handlers.emitHandlerBody(self, start);
                } else {
                    try attrs.skipAttrValue(self);
                }
            }
        } else {
            self.advance_token();
        }
    }

    if (self.curKind() == .slash_gt) {
        self.advance_token();
        return .{ .style = leaf_style, .font_size = leaf_font, .text_color = leaf_color, .handler_body = leaf_handler };
    }
    if (self.curKind() == .gt) self.advance_token();

    // Parse content — recursively parse children, text, and conditionals
    var leaf_fmt: []const u8 = "";
    var leaf_args: []const u8 = "";
    var leaf_dynamic = false;
    var leaf_static: []const u8 = "";
    var child_list: std.ArrayListUnmanaged(codegen.MapLeafNode) = .{};

    var leaf_safety: u32 = 0;
    while (self.curKind() != .lt_slash and self.curKind() != .eof and leaf_safety < 500) : (leaf_safety += 1) {
        const prev = self.pos;
        if (self.curKind() == .lt) {
            // Recursively parse child element
            const child = try parseMapLeafElement(self);
            try child_list.append(self.alloc, child);
        } else if (self.curKind() == .lbrace) {
            self.advance_token();
            // Check for conditional: {cond && <JSX>} at any depth
            if (jsx_conditional.isLogicalAndAhead(self)) {
                var cond_inners: [2]codegen.MapInnerNode = undefined;
                var cond_count: u32 = 0;
                if (try tryParseMapConditional(self, &cond_inners, &cond_count)) {
                    for (0..cond_count) |ci| {
                        const cinner = cond_inners[ci];
                        // Convert MapInnerNode to MapLeafNode with children
                        var cond_children: std.ArrayListUnmanaged(codegen.MapLeafNode) = .{};
                        for (0..cinner.sub_count) |si| {
                            const sub = cinner.sub_nodes[si];
                            // Convert sub_node to leaf node (preserving its leaves as children)
                            try cond_children.append(self.alloc, .{
                                .style = sub.style,
                                .font_size = sub.font_size,
                                .text_color = sub.text_color,
                                .text_fmt = sub.text_fmt,
                                .text_args = sub.text_args,
                                .is_dynamic_text = sub.is_dynamic_text,
                                .static_text = sub.static_text,
                                .handler_body = sub.handler_body,
                                .children = sub.leaves,
                            });
                        }
                        try child_list.append(self.alloc, .{
                            .style = cinner.style,
                            .font_size = cinner.font_size,
                            .text_color = cinner.text_color,
                            .static_text = cinner.static_text,
                            .text_fmt = cinner.text_fmt,
                            .text_args = cinner.text_args,
                            .is_dynamic_text = cinner.is_dynamic_text,
                            .children = if (cond_children.items.len > 0)
                                (self.alloc.dupe(codegen.MapLeafNode, cond_children.items) catch &[_]codegen.MapLeafNode{})
                            else
                                &[_]codegen.MapLeafNode{},
                        });
                    }
                    continue;
                }
            }
            const text_result = try parseMapTextExpr(self);
            if (text_result.is_dynamic) { leaf_dynamic = true; leaf_fmt = text_result.fmt; leaf_args = text_result.args; }
            else if (text_result.static_text.len > 0) { leaf_static = text_result.static_text; }
            skipToClosingBrace(self);
        } else {
            const raw = attrs.collectTextContent(self);
            if (raw.len > 0) leaf_static = raw;
        }
        if (self.pos == prev) self.advance_token(); // prevent stuck
    }

    // Skip closing tag (handles C.Foo namespaced tags)
    if (self.curKind() == .lt_slash) self.advance_token();
    if (self.curKind() == .identifier) self.advance_token();
    if (self.curKind() == .dot) { self.advance_token(); if (self.curKind() == .identifier) self.advance_token(); }
    if (self.curKind() == .gt) self.advance_token();

    const children_slice = if (child_list.items.len > 0)
        (self.alloc.dupe(codegen.MapLeafNode, child_list.items) catch &[_]codegen.MapLeafNode{})
    else
        &[_]codegen.MapLeafNode{};

    return .{
        .font_size = leaf_font,
        .text_color = leaf_color,
        .text_fmt = leaf_fmt,
        .text_args = leaf_args,
        .is_dynamic_text = leaf_dynamic,
        .static_text = leaf_static,
        .style = leaf_style,
        .handler_body = leaf_handler,
        .children = children_slice,
    };
}

/// Helper: parse a text expression inside {}, resolving item.field and template literals.
const MapTextResult = struct { fmt: []const u8 = "", args: []const u8 = "", is_dynamic: bool = false, static_text: []const u8 = "" };
fn parseMapTextExpr(self: *Generator) !MapTextResult {
    if (self.curKind() == .template_literal) {
        const tl = try attrs.parseTemplateLiteral(self);
        self.advance_token();
        if (tl.is_dynamic) return .{ .fmt = tl.fmt, .args = tl.args, .is_dynamic = true };
        return .{ .static_text = tl.static_text };
    }
    if (self.curKind() == .identifier) {
        const ident = self.curText();
        self.advance_token();
        if (self.map_item_param) |param| {
            if (std.mem.eql(u8, ident, param) and self.curKind() == .dot and self.map_obj_array_idx != null) {
                self.advance_token(); // .
                const field_name = self.curText();
                self.advance_token(); // field
                const oa_idx = self.map_obj_array_idx.?;
                const oa = self.object_arrays[oa_idx];
                for (0..oa.field_count) |fi| {
                    if (std.mem.eql(u8, oa.fields[fi].name, field_name)) {
                        if (oa.fields[fi].field_type == .string) {
                            return .{ .fmt = "{s}", .args = std.fmt.allocPrint(self.alloc,
                                "_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]]",
                                .{ oa_idx, field_name, oa_idx, field_name }) catch "", .is_dynamic = true };
                        } else {
                            return .{ .fmt = "{d}", .args = std.fmt.allocPrint(self.alloc,
                                "_oa{d}_{s}[_i]", .{ oa_idx, field_name }) catch "", .is_dynamic = true };
                        }
                    }
                }
            }
        }
    }
    return .{};
}

/// Helper: skip to closing } at depth 0.
fn skipToClosingBrace(self: *Generator) void {
    var bd: u32 = 1;
    while (bd > 0 and self.curKind() != .eof) {
        if (self.curKind() == .lbrace) bd += 1;
        if (self.curKind() == .rbrace) { bd -= 1; if (bd == 0) break; }
        self.advance_token();
    }
    if (self.curKind() == .rbrace) self.advance_token();
}

/// Skip over a complete JSX element including its content and closing tag.
/// Handles self-closing (<Foo />) and open/close (<Foo>...</Foo>) elements,
/// including nested children of arbitrary depth.
fn skipBalancedElement(self: *Generator) void {
    if (self.curKind() != .lt) return;
    self.advance_token(); // <
    // Skip tag name (and C.Name patterns)
    if (self.curKind() == .identifier) self.advance_token();
    if (self.curKind() == .dot) { self.advance_token(); if (self.curKind() == .identifier) self.advance_token(); }
    // Skip attributes until > or />
    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .lbrace) {
            attrs.skipBalanced(self) catch {};
        } else {
            self.advance_token();
        }
    }
    if (self.curKind() == .slash_gt) {
        self.advance_token();
        return; // Self-closing
    }
    if (self.curKind() == .gt) self.advance_token();
    // Skip content until matching closing tag
    while (self.curKind() != .lt_slash and self.curKind() != .eof) {
        if (self.curKind() == .lt) {
            skipBalancedElement(self); // Recurse for nested children
        } else if (self.curKind() == .lbrace) {
            attrs.skipBalanced(self) catch {};
        } else {
            self.advance_token();
        }
    }
    // Skip closing tag </Tag> or </C.Tag>
    if (self.curKind() == .lt_slash) self.advance_token();
    if (self.curKind() == .identifier) self.advance_token();
    if (self.curKind() == .dot) self.advance_token();
    if (self.curKind() == .identifier) self.advance_token();
    if (self.curKind() == .gt) self.advance_token();
}

pub fn mergeStyles(alloc: std.mem.Allocator, base: []const u8, override: []const u8) ![]const u8 {
    var result = base;
    // Scan override for ".prop_name" at property positions and strip from base
    var i: usize = 0;
    while (i < override.len) {
        if (override[i] == '.') {
            const at_start = i == 0;
            const after_sep = i >= 2 and override[i - 2] == ',' and override[i - 1] == ' ';
            if (at_start or after_sep) {
                var j = i + 1;
                while (j < override.len and override[j] != ' ' and override[j] != '=' and override[j] != ',') j += 1;
                const prop_name = override[i + 1 .. j];
                if (prop_name.len > 0) {
                    result = try removePropFromStyle(alloc, result, prop_name);
                }
            }
        }
        i += 1;
    }
    if (result.len > 0) {
        return std.fmt.allocPrint(alloc, "{s}, {s}", .{ result, override });
    }
    return override;
}

fn removePropFromStyle(alloc: std.mem.Allocator, style: []const u8, prop_name: []const u8) ![]const u8 {
    // Remove ".prop_name = value" from style string
    const needle = try std.fmt.allocPrint(alloc, ".{s}", .{prop_name});
    var result = std.ArrayListUnmanaged(u8){};
    var i: usize = 0;
    while (i < style.len) {
        if (i + needle.len <= style.len and std.mem.eql(u8, style[i .. i + needle.len], needle)) {
            // Check if at property boundary
            const at_start = i == 0;
            const after_sep = i >= 2 and style[i - 2] == ',' and style[i - 1] == ' ';
            if (at_start or after_sep) {
                // Skip until next comma or end
                var j = i;
                while (j < style.len and style[j] != ',') j += 1;
                // Skip ", " after the property
                if (j + 2 <= style.len and style[j] == ',') {
                    j += 2; // skip ", "
                }
                i = j;
                continue;
            }
        }
        try result.append(alloc, style[i]);
        i += 1;
    }
    // Trim trailing ", "
    const items = result.items;
    if (items.len >= 2 and items[items.len - 2] == ',' and items[items.len - 1] == ' ') {
        return items[0 .. items.len - 2];
    }
    return items;
}
