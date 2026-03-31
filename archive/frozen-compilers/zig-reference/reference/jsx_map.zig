//! Map (.map()) parsing and style merging — extracted from jsx.zig.
//!
//! Handles items.map((item, index) => (<JSX/>)) templates, producing
//! MapInfo and MapInnerNode structures for the codegen pipeline.

const std = @import("std");
const codegen = @import("codegen.zig");
const surfaces = @import("rules/surfaces.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");
const emit_map = @import("emit_map.zig");
const handlers = @import("handlers.zig");
const components = @import("components.zig");
const html_tags = @import("rules/html_tags.zig");
const jsx_map_sub = @import("jsx_map_sub.zig");
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

    // Skip chained methods before .map(): .filter(...).sort(...).slice(...)
    while (self.curKind() == .identifier) {
        const method_name = self.curText();
        if (std.mem.eql(u8, method_name, "map")) break;
        if (std.mem.eql(u8, method_name, "filter") or
            std.mem.eql(u8, method_name, "sort") or
            std.mem.eql(u8, method_name, "slice"))
        {
            self.advance_token(); // method name
            if (self.curKind() == .lparen) {
                // Skip balanced parens
                var depth: u32 = 1;
                self.advance_token(); // (
                while (self.curKind() != .eof and depth > 0) {
                    if (self.curKind() == .lparen) depth += 1;
                    if (self.curKind() == .rparen) depth -= 1;
                    if (depth > 0) self.advance_token();
                }
                if (self.curKind() == .rparen) self.advance_token(); // )
            }
            if (self.curKind() == .dot) self.advance_token(); // .
        } else break;
    }

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
                .pool_raw_expr = template.pool_raw_expr,
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
                .pool_raw_expr = template.pool_raw_expr,
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
                .pool_raw_expr = template.pool_raw_expr,
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
    if ((std.mem.eql(u8, tag, "Graph") or std.mem.eql(u8, tag, "Canvas")) and self.curKind() == .dot) {
        const saved_pos = self.pos;
        self.advance_token(); // .
        if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "Path")) {
            self.advance_token(); // Path
            return try parseMapRootPathTemplate(self);
        }
        self.pos = saved_pos;
    }
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
    // If tag is still uppercase after html_tags resolve + classifier, it's a component
    const is_known_prim = surfaces.isTag(tag);
    if (tag.len > 0 and tag[0] >= 'A' and tag[0] <= 'Z' and !is_known_prim) {
        // Root of map template is a component — inline it and return pool_raw_expr
        var comp_idx: ?usize = null;
        for (0..self.component_count) |ci| {
            if (std.mem.eql(u8, self.components[ci].name, tag)) { comp_idx = ci; break; }
        }
        if (comp_idx) |ci| {
            const comp_expr = try components.inlineComponent(self, &self.components[ci]);
            return .{
                .outer_style = "",
                .outer_font_size = "",
                .outer_text_color = "",
                .inner_nodes = undefined,
                .inner_count = 0,
                .is_self_closing = true,
                .is_text_element = false,
                .pool_raw_expr = comp_expr,
            };
        }
        // Unknown component — skip to end of tag
        while (self.curKind() != .slash_gt and self.curKind() != .gt and self.curKind() != .eof) {
            self.advance_token();
        }
        if (self.curKind() == .slash_gt) self.advance_token();
        return .{
            .outer_style = "",
            .outer_font_size = "",
            .outer_text_color = "",
            .inner_nodes = undefined,
            .inner_count = 0,
            .is_self_closing = true,
            .is_text_element = false,
        };
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
                    const pre_dyn_count_outer = self.dyn_style_count;
                    style_str = try attrs.parseStyleAttr(self);
                    // Claim dyn_styles from the outer/pool element (background_color, border_color)
                    if (self.map_index_param != null or self.map_item_param != null) {
                        var dsi_o = pre_dyn_count_outer;
                        while (dsi_o < self.dyn_style_count) : (dsi_o += 1) {
                            if (std.mem.eql(u8, self.dyn_styles[dsi_o].field, "background_color") or
                                std.mem.eql(u8, self.dyn_styles[dsi_o].field, "border_color"))
                            {
                                self.dyn_styles[dsi_o].map_claimed = true;
                            }
                        }
                    }
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
                    if (try jsx_map_sub.tryParseMapConditional(self, &cond_inners, &cond_count)) {
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
    var tag: []const u8 = "";
    if (self.curKind() == .identifier) {
        tag = self.curText();
        self.advance_token();
    }
    if (std.mem.eql(u8, tag, "Graph")) {
        return try parseMapGraphNode(self);
    }
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
    var dyn_background_color: []const u8 = "";
    var dyn_border_color: []const u8 = "";
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
                    const pre_dyn_count = self.dyn_style_count;
                    style_str = try attrs.parseStyleAttr(self);
                    // Claim any background_color/border_color DynStyle added inside this map context.
                    // Such expressions reference _i and must be emitted inline in _rebuildMap.
                    if (self.map_index_param != null or self.map_item_param != null) {
                        var dsi = pre_dyn_count;
                        while (dsi < self.dyn_style_count) : (dsi += 1) {
                            if (std.mem.eql(u8, self.dyn_styles[dsi].field, "background_color")) {
                                dyn_background_color = self.dyn_styles[dsi].expression;
                                self.dyn_styles[dsi].map_claimed = true;
                            } else if (std.mem.eql(u8, self.dyn_styles[dsi].field, "border_color")) {
                                dyn_border_color = self.dyn_styles[dsi].expression;
                                self.dyn_styles[dsi].map_claimed = true;
                            }
                        }
                    }
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
                                // Check for ternary: v.field >= 0 ? "#hex1" : "#hex2"
                                const is_cmp = self.curKind() == .gt_eq or self.curKind() == .lt_eq or
                                    self.curKind() == .eq_eq or self.curKind() == .not_eq or
                                    self.curKind() == .gt or self.curKind() == .lt;
                                if (is_cmp) {
                                    const oa_idx2 = self.map_obj_array_idx.?;
                                    const arr_expr2 = try std.fmt.allocPrint(self.alloc, "_oa{d}_{s}[_i]", .{ oa_idx2, field_name });
                                    var cmp_op: []const u8 = ">=";
                                    if (self.curKind() == .gt_eq) cmp_op = ">="
                                    else if (self.curKind() == .lt_eq) cmp_op = "<="
                                    else if (self.curKind() == .eq_eq) cmp_op = "=="
                                    else if (self.curKind() == .not_eq) cmp_op = "!="
                                    else if (self.curKind() == .gt) cmp_op = ">"
                                    else if (self.curKind() == .lt) cmp_op = "<";
                                    self.advance_token(); // op
                                    const rhs_txt = self.curText();
                                    self.advance_token(); // rhs value
                                    if (self.curKind() == .question) self.advance_token(); // ?
                                    const then_hex = try attrs.parseStringAttr(self);
                                    const then_color = try attrs.parseColorValue(self, then_hex);
                                    if (self.curKind() == .colon) self.advance_token(); // :
                                    const else_hex = try attrs.parseStringAttr(self);
                                    const else_color = try attrs.parseColorValue(self, else_hex);
                                    if (self.curKind() == .rbrace) self.advance_token(); // }
                                    dyn_text_color = try std.fmt.allocPrint(self.alloc,
                                        "if ({s} {s} {s}) {s} else {s}",
                                        .{ arr_expr2, cmp_op, rhs_txt, then_color, else_color });
                                } else {
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
                const sub = try jsx_map_sub.parseMapSubElement(self);
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
                    if (try jsx_map_sub.tryParseMapConditional(self, &cond_inners_local, &cond_count_local)) {
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
        .dyn_background_color = dyn_background_color,
        .dyn_border_color = dyn_border_color,
        .sub_nodes = sub_nodes,
        .sub_count = sub_count,
        .handler_body = handler_body,
    };
}

fn resolveMapStringValue(self: *Generator, value: []const u8, is_expr: bool) ![]const u8 {
    if (!is_expr) {
        return try std.fmt.allocPrint(self.alloc, "\"{f}\"", .{std.zig.fmtString(value)});
    }

    if (self.map_item_param) |param| {
        if (std.mem.startsWith(u8, value, param) and value.len > param.len and value[param.len] == '.') {
            const field_name = value[param.len + 1 ..];
            if (self.map_obj_array_idx) |oa_idx| {
                return try std.fmt.allocPrint(self.alloc,
                    "_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]]",
                    .{ oa_idx, field_name, oa_idx, field_name });
            }
            return try std.fmt.allocPrint(self.alloc, "_item.{s}", .{field_name});
        }
    }

    // Handle already-resolved _oa references (from parseExprAttr): add slice bounds
    if (std.mem.startsWith(u8, value, "_oa") and std.mem.endsWith(u8, value, "[_i]")) {
        // Extract field part: "_oa{N}_{field}[_i]" → "_oa{N}_{field}"
        const base = value[0 .. value.len - 4]; // strip "[_i]"
        return try std.fmt.allocPrint(self.alloc,
            "{s}[_i][0..{s}_lens[_i]]",
            .{ base, base });
    }

    // Handle already-resolved _oa references (from parseExprAttr): add slice bounds
    if (std.mem.startsWith(u8, value, "_oa") and std.mem.endsWith(u8, value, "[_i]")) {
        const base = value[0 .. value.len - 4]; // strip "[_i]"
        return try std.fmt.allocPrint(self.alloc,
            "{s}[_i][0..{s}_lens[_i]]",
            .{ base, base });
    }

    if (self.map_item_param != null or self.map_index_param != null) {
        return try emit_map.rewriteMapArgs(self, value, self.map_item_param orelse "", self.map_index_param);
    }

    return value;
}

fn resolveMapColorValue(self: *Generator, value: []const u8, is_expr: bool) ![]const u8 {
    if (!is_expr) return attrs.parseColorValue(self, value);

    if (self.map_item_param) |param| {
        if (std.mem.startsWith(u8, value, param) and value.len > param.len and value[param.len] == '.') {
            const field_name = value[param.len + 1 ..];
            if (self.map_obj_array_idx) |oa_idx| {
                const oa = self.object_arrays[oa_idx];
                for (0..oa.field_count) |fi| {
                    if (std.mem.eql(u8, oa.fields[fi].name, field_name)) {
                        return switch (oa.fields[fi].field_type) {
                            .string => std.fmt.allocPrint(self.alloc,
                                "Color.fromHex(_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]])",
                                .{ oa_idx, field_name, oa_idx, field_name }),
                            else => blk: {
                                const arr_expr = try std.fmt.allocPrint(self.alloc, "_oa{d}_{s}[_i]", .{ oa_idx, field_name });
                                break :blk std.fmt.allocPrint(self.alloc,
                                    "Color.rgb(@intCast(({s} >> 16) & 0xFF), @intCast(({s} >> 8) & 0xFF), @intCast({s} & 0xFF))",
                                    .{ arr_expr, arr_expr, arr_expr });
                            },
                        };
                    }
                }
            }
            return try std.fmt.allocPrint(self.alloc, "Color.fromHex(_item.{s})", .{field_name});
        }
    }

    // Handle already-resolved _oa references (from parseExprAttr): wrap in Color.fromHex
    if (std.mem.startsWith(u8, value, "_oa") and std.mem.endsWith(u8, value, "[_i]")) {
        const base = value[0 .. value.len - 4]; // strip "[_i]"
        return try std.fmt.allocPrint(self.alloc,
            "Color.fromHex({s}[_i][0..{s}_lens[_i]])",
            .{ base, base });
    }

    if (self.map_item_param != null or self.map_index_param != null) {
        return try emit_map.rewriteMapArgs(self, value, self.map_item_param orelse "", self.map_index_param);
    }

    return value;
}

fn parseMapRootPathTemplate(self: *Generator) anyerror!codegen.MapTemplateResult {
    var path_d: []const u8 = "";
    var path_fill: []const u8 = "";
    var path_stroke: []const u8 = "";
    var path_fill_effect: []const u8 = "";
    var path_stroke_width: []const u8 = "";
    var path_d_is_expr = false;
    var path_fill_is_expr = false;
    var path_stroke_is_expr = false;
    var path_fill_effect_is_expr = false;
    var is_self_closing = false;

    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const attr = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, attr, "d")) {
                    path_d_is_expr = self.curKind() == .lbrace;
                    path_d = if (path_d_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr, "fill")) {
                    path_fill_is_expr = self.curKind() == .lbrace;
                    path_fill = if (path_fill_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr, "stroke")) {
                    path_stroke_is_expr = self.curKind() == .lbrace;
                    path_stroke = if (path_stroke_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr, "fillEffect")) {
                    path_fill_effect_is_expr = self.curKind() == .lbrace;
                    path_fill_effect = if (path_fill_effect_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr, "strokeWidth")) {
                    path_stroke_width = try attrs.parseExprAttr(self);
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
    } else if (self.curKind() == .gt) {
        self.advance_token();
    }

    if (!is_self_closing) {
        while (self.curKind() != .lt_slash and self.curKind() != .eof) self.advance_token();
        if (self.curKind() == .lt_slash) self.advance_token();
        if (self.curKind() == .identifier) self.advance_token();
        if (self.curKind() == .gt) self.advance_token();
    }

    var fields: std.ArrayListUnmanaged(u8) = .{};
    try fields.appendSlice(self.alloc, ".canvas_path = true, .canvas_path_d = ");
    try fields.appendSlice(self.alloc, try resolveMapStringValue(self, path_d, path_d_is_expr));
    if (path_stroke_width.len > 0) {
        try fields.appendSlice(self.alloc, ", .canvas_stroke_width = ");
        try fields.appendSlice(self.alloc, try resolveMapF32Value(self, path_stroke_width));
    }
    if (path_stroke.len > 0) {
        try fields.appendSlice(self.alloc, ", .text_color = ");
        try fields.appendSlice(self.alloc, try resolveMapColorValue(self, path_stroke, path_stroke_is_expr));
    }
    if (path_fill.len > 0) {
        try fields.appendSlice(self.alloc, ", .canvas_fill_color = ");
        try fields.appendSlice(self.alloc, try resolveMapColorValue(self, path_fill, path_fill_is_expr));
    }
    if (path_fill_effect.len > 0) {
        try fields.appendSlice(self.alloc, ", .canvas_fill_effect = ");
        try fields.appendSlice(self.alloc, try resolveMapStringValue(self, path_fill_effect, path_fill_effect_is_expr));
    }

    return .{
        .outer_style = "",
        .outer_font_size = "",
        .outer_text_color = "",
        .inner_nodes = undefined,
        .inner_count = 0,
        .is_self_closing = true,
        .is_text_element = false,
        .pool_raw_expr = try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{fields.items}),
    };
}

fn parseMapGraphNode(self: *Generator) anyerror!codegen.MapInnerNode {
    var style_str: []const u8 = "";
    var view_x: []const u8 = "0";
    var view_y: []const u8 = "0";
    var view_zoom: []const u8 = "1";
    var is_self_closing = false;

    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const attr = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, attr, "style")) {
                    style_str = try attrs.parseStyleAttr(self);
                } else if (std.mem.eql(u8, attr, "viewX")) {
                    view_x = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr, "viewY")) {
                    view_y = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr, "viewZoom")) {
                    view_zoom = try attrs.parseExprAttr(self);
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
    } else if (self.curKind() == .gt) {
        self.advance_token();
    }

    var path_d: []const u8 = "";
    var path_fill: []const u8 = "";
    var path_stroke: []const u8 = "";
    var path_fill_effect: []const u8 = "";
    var path_stroke_width: []const u8 = "1";
    var path_d_is_expr = false;
    var path_fill_is_expr = false;
    var path_stroke_is_expr = false;
    var path_fill_effect_is_expr = false;

    if (!is_self_closing) {
        while (self.curKind() != .lt_slash and self.curKind() != .eof) {
            if (self.curKind() == .lt) {
                self.advance_token(); // <
                if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "Graph")) {
                    self.advance_token(); // Graph
                    if (self.curKind() == .dot) self.advance_token(); // .
                    if (self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "Path")) {
                        self.advance_token(); // Path
                        while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
                            if (self.curKind() == .identifier) {
                                const attr = self.curText();
                                self.advance_token();
                                if (self.curKind() == .equals) {
                                    self.advance_token();
                                    if (std.mem.eql(u8, attr, "d")) {
                                        path_d_is_expr = self.curKind() == .lbrace;
                                        path_d = if (path_d_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                                    } else if (std.mem.eql(u8, attr, "fill")) {
                                        path_fill_is_expr = self.curKind() == .lbrace;
                                        path_fill = if (path_fill_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                                    } else if (std.mem.eql(u8, attr, "stroke")) {
                                        path_stroke_is_expr = self.curKind() == .lbrace;
                                        path_stroke = if (path_stroke_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                                    } else if (std.mem.eql(u8, attr, "fillEffect")) {
                                        path_fill_effect_is_expr = self.curKind() == .lbrace;
                                        path_fill_effect = if (path_fill_effect_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                                    } else if (std.mem.eql(u8, attr, "strokeWidth")) {
                                        path_stroke_width = try attrs.parseExprAttr(self);
                                    } else {
                                        try attrs.skipAttrValue(self);
                                    }
                                }
                            } else {
                                self.advance_token();
                            }
                        }
                        if (self.curKind() == .slash_gt) self.advance_token() else if (self.curKind() == .gt) self.advance_token();
                        continue;
                    }
                }
            }
            self.advance_token();
        }

        if (self.curKind() == .lt_slash) self.advance_token();
        if (self.curKind() == .identifier) self.advance_token();
        if (self.curKind() == .gt) self.advance_token();
    }

    const path_d_expr = try resolveMapStringValue(self, path_d, path_d_is_expr);
    const fill_expr = if (path_fill.len > 0) try resolveMapColorValue(self, path_fill, path_fill_is_expr) else "Color{}";
    const stroke_expr = if (path_stroke.len > 0) try resolveMapColorValue(self, path_stroke, path_stroke_is_expr) else "Color.rgb(255, 255, 255)";
    const fill_effect_field = if (path_fill_effect.len > 0)
        try std.fmt.allocPrint(self.alloc, ", .canvas_fill_effect = {s}",
            .{try resolveMapStringValue(self, path_fill_effect, path_fill_effect_is_expr)})
    else
        "";
    // Wrap view props in @floatCast if they're f64 object-array accesses (node fields are f32)
    const view_x_expr = if (std.mem.indexOf(u8, view_x, "_oa") != null)
        try std.fmt.allocPrint(self.alloc, "@floatCast({s})", .{view_x})
    else
        view_x;
    const view_y_expr = if (std.mem.indexOf(u8, view_y, "_oa") != null)
        try std.fmt.allocPrint(self.alloc, "@floatCast({s})", .{view_y})
    else
        view_y;
    const view_zoom_expr = if (std.mem.indexOf(u8, view_zoom, "_oa") != null)
        try std.fmt.allocPrint(self.alloc, "@floatCast({s})", .{view_zoom})
    else
        view_zoom;
    // Wrap stroke width: object-array integer fields are i64, node field is f32
    const stroke_width_expr = if (std.mem.indexOf(u8, path_stroke_width, "_oa") != null)
        try std.fmt.allocPrint(self.alloc, "@floatFromInt({s})", .{path_stroke_width})
    else
        path_stroke_width;
    const raw_expr = try std.fmt.allocPrint(self.alloc,
        ".{{ .style = .{{ {s} }}, .graph_container = true, .canvas_view_set = true, .canvas_view_x = {s}, .canvas_view_y = {s}, .canvas_view_zoom = {s}, .children = @constCast(&[_]Node{{ .{{ .canvas_path = true, .canvas_path_d = {s}{s}, .canvas_fill_color = {s}, .canvas_stroke_width = {s}, .text_color = {s} }} }}) }}",
        .{ style_str, view_x_expr, view_y_expr, view_zoom_expr, path_d_expr, fill_effect_field, fill_expr, stroke_width_expr, stroke_expr });
    return .{
        .font_size = "",
        .text_color = "",
        .text_fmt = "",
        .text_args = "",
        .is_dynamic_text = false,
        .static_text = "",
        .style = "",
        .raw_expr = raw_expr,
    };
}

fn resolveMapF32Value(self: *Generator, value: []const u8) ![]const u8 {
    if (!(std.mem.startsWith(u8, value, "_oa") and std.mem.endsWith(u8, value, "[_i]"))) return value;

    const base = value[0 .. value.len - 4];
    const after_prefix = base[3..];
    const underscore = std.mem.indexOfScalar(u8, after_prefix, '_') orelse return value;
    const oa_idx = std.fmt.parseInt(usize, after_prefix[0..underscore], 10) catch return value;
    const field_name = after_prefix[underscore + 1 ..];
    if (oa_idx >= self.object_array_count) return value;

    const oa = self.object_arrays[oa_idx];
    for (0..oa.field_count) |fi| {
        if (!std.mem.eql(u8, oa.fields[fi].name, field_name)) continue;
        return switch (oa.fields[fi].field_type) {
            .float => std.fmt.allocPrint(self.alloc, "@floatCast({s})", .{value}),
            else => std.fmt.allocPrint(self.alloc, "@as(f32, @floatFromInt({s}))", .{value}),
        };
    }
    if (std.mem.indexOf(u8, value, "ribbonWidth") != null) {
        return std.fmt.allocPrint(self.alloc, "@floatCast({s})", .{value});
    }
    return std.fmt.allocPrint(self.alloc, "@as(f32, @floatFromInt({s}))", .{value});
}

/// Try to parse a conditional expression inside braces: {cond && <JSX>}
/// Pattern: identifier.field == value && <Element>...</Element>
/// Returns true if a conditional sub-node was added, false if not a conditional.
/// The caller's brace depth tracking is at depth 1 (already consumed opening {).

// ── Re-exports from jsx_map_sub.zig ──
pub const mergeStyles = jsx_map_sub.mergeStyles;
