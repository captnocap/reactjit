//! Map (.map()) parsing and style merging — extracted from jsx.zig.
//!
//! Handles items.map((item, index) => (<JSX/>)) templates, producing
//! MapInfo and MapInnerNode structures for the codegen pipeline.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");
const handlers = @import("handlers.zig");
const html_tags = @import("html_tags.zig");

/// Parse `items.map((item, index) => (<JSX/>))` and register a MapInfo.
/// Returns ".{}" as a placeholder node — the real nodes come from the pool at runtime.
pub fn parseMapExpression(self: *Generator) anyerror![]const u8 {
    const array_name = self.curText();
    const computed_idx = self.isComputedArray(array_name);
    const state_idx = if (computed_idx == null) self.isArrayState(array_name) else null;
    const obj_arr_idx = if (computed_idx == null and state_idx == null) self.isObjectArray(array_name) else null;

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
    self.map_item_param = item_param;
    self.map_index_param = index_param;
    if (computed_idx) |ci| {
        self.map_item_type = self.computed_arrays[ci].element_type;
    }
    self.map_obj_array_idx = obj_arr_idx;

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

    // Record map info
    if (self.map_count < codegen.MAX_MAPS) {
        if (computed_idx) |ci| {
            self.maps[self.map_count] = .{
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
            };
        } else if (obj_arr_idx) |oi| {
            self.maps[self.map_count] = .{
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
            };
        } else {
            const si = state_idx.?;
            const is_str_arr = std.meta.activeTag(self.state_slots[si].initial) == .string_array;
            self.maps[self.map_count] = .{
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
            };
        }
        self.map_count += 1;
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
    if (std.mem.eql(u8, tag, "C") and self.curKind() == .dot) {
        self.advance_token(); // .
        const cls_name = self.curText();
        self.advance_token(); // actual name
        if (self.findClassifier(cls_name)) |idx| {
            tag = self.classifier_primitives[idx];
        }
    }
    const is_text = std.mem.eql(u8, tag, "Text");

    var style_str: []const u8 = "";
    var font_size: []const u8 = "";
    var text_color: []const u8 = "";
    var handler_body: []const u8 = "";
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
                const child = try parseMapTemplateChild(self);
                if (inner_count < codegen.MAX_MAP_INNER) {
                    inner_nodes[inner_count] = child;
                    inner_count += 1;
                }
            } else if (self.curKind() == .lbrace) {
                self.advance_token(); // {
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
    };
}

/// Parse a single child element inside a .map() template.
fn parseMapTemplateChild(self: *Generator) anyerror!codegen.MapInnerNode {
    self.advance_token(); // <
    self.advance_token(); // tag name (or "C")
    // Handle C.Name classifier references
    if (self.curKind() == .dot) {
        self.advance_token(); // .
        self.advance_token(); // actual name
    }

    var font_size: []const u8 = "";
    var text_color: []const u8 = "";
    var dyn_text_color: []const u8 = "";
    var style_str: []const u8 = "";
    var is_self_closing = false;

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
                    // {item} or {node.field} — identifier reference in .map() callbacks
                    const ident = self.curText();
                    self.advance_token();
                    if (self.map_item_param) |param| {
                        if (std.mem.eql(u8, ident, param)) {
                            if (self.curKind() == .dot and self.map_obj_array_idx != null) {
                                // Object array field access: {node.tag}
                                self.advance_token(); // .
                                const field_name = self.curText();
                                self.advance_token(); // field
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
                                is_dynamic_text = true;
                                text_fmt = "{d}";
                                text_args = ident;
                            }
                        }
                    }
                }
                // Skip remaining tokens until closing } (handles complex expressions
                // like {cond && <JSX>}, {tasks.map(...)}, {item.field == val})
                {
                    var bd: u32 = 1;
                    while (bd > 0 and self.curKind() != .eof) {
                        if (self.curKind() == .lbrace) bd += 1;
                        if (self.curKind() == .rbrace) {
                            bd -= 1;
                            if (bd == 0) break;
                        }
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
        .sub_nodes = sub_nodes,
        .sub_count = sub_count,
    };
}

/// Parse a nested child element inside a map template child and extract its
/// text/style into a MapSubNode. Handles <Text>{...}</Text> and <Box style={...} />.
/// For elements with their own nested children, recurses via skipBalancedElement.
fn parseMapSubElement(self: *Generator) !codegen.MapSubNode {
    if (self.curKind() != .lt) return .{};
    self.advance_token(); // <
    var tag: []const u8 = "";
    if (self.curKind() == .identifier) { tag = self.curText(); self.advance_token(); }
    if (self.curKind() == .dot) { self.advance_token(); if (self.curKind() == .identifier) self.advance_token(); }

    var sub_font: []const u8 = "";
    var sub_color: []const u8 = "";
    var sub_style: []const u8 = "";

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
        return .{ .style = sub_style, .font_size = sub_font, .text_color = sub_color };
    }
    if (self.curKind() == .gt) self.advance_token();

    // Parse content — extract text
    var sub_fmt: []const u8 = "";
    var sub_args: []const u8 = "";
    var sub_dynamic = false;
    var sub_static: []const u8 = "";

    while (self.curKind() != .lt_slash and self.curKind() != .eof) {
        if (self.curKind() == .lt) {
            skipBalancedElement(self); // deeper nesting — skip
        } else if (self.curKind() == .lbrace) {
            self.advance_token(); // {
            if (self.curKind() == .template_literal) {
                const tl = try attrs.parseTemplateLiteral(self);
                self.advance_token();
                if (tl.is_dynamic) { sub_dynamic = true; sub_fmt = tl.fmt; sub_args = tl.args; }
                else { sub_static = tl.static_text; }
            } else if (self.curKind() == .identifier) {
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
                                sub_dynamic = true;
                                if (oa.fields[fi].field_type == .string) {
                                    sub_fmt = "{s}";
                                    sub_args = std.fmt.allocPrint(self.alloc,
                                        "_oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]]",
                                        .{ oa_idx, field_name, oa_idx, field_name }) catch "";
                                } else {
                                    sub_fmt = "{d}";
                                    sub_args = std.fmt.allocPrint(self.alloc,
                                        "_oa{d}_{s}[_i]", .{ oa_idx, field_name }) catch "";
                                }
                                break;
                            }
                        }
                    }
                }
            }
            // Skip to closing }
            var bd: u32 = 1;
            while (bd > 0 and self.curKind() != .eof) {
                if (self.curKind() == .lbrace) bd += 1;
                if (self.curKind() == .rbrace) { bd -= 1; if (bd == 0) break; }
                self.advance_token();
            }
            if (self.curKind() == .rbrace) self.advance_token();
        } else {
            const raw = attrs.collectTextContent(self);
            if (raw.len > 0) sub_static = raw;
        }
    }

    // Skip closing tag
    if (self.curKind() == .lt_slash) self.advance_token();
    if (self.curKind() == .identifier) self.advance_token();
    if (self.curKind() == .gt) self.advance_token();

    return .{
        .font_size = sub_font,
        .text_color = sub_color,
        .text_fmt = sub_fmt,
        .text_args = sub_args,
        .is_dynamic_text = sub_dynamic,
        .static_text = sub_static,
        .style = sub_style,
    };
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
