//! Map template sub-element parsing — conditionals, nested children, leaf elements.
//!
//! Extracted from jsx_map.zig. Handles the inner parsing of .map() templates
//! at sub-element and leaf levels, plus style merging utilities.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");
const handlers = @import("handlers.zig");
const jsx_conditional = @import("jsx_conditional.zig");

pub fn tryParseMapConditional(
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
            // absorb trailing = from === (lexed as eq_eq + equals)
            if (self.pos + 1 < self.lex.count and self.lex.get(self.pos + 1).kind == .equals) {
                self.advance_token();
            }
        } else if (k == .not_eq) {
            try cond.appendSlice(self.alloc, " != ");
            // absorb trailing = from !== (lexed as not_eq + equals)
            if (self.pos + 1 < self.lex.count and self.lex.get(self.pos + 1).kind == .equals) {
                self.advance_token();
            }
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
            !std.mem.eql(u8, txt, "''") and !std.mem.eql(u8, txt, "\"\""))
        {
            // Non-empty string comparison with OA string field:
            //   status === 'ok' → std.mem.eql(u8, _oa0_status[_i][0.._oa0_status_lens[_i]], "ok")
            //   status !== 'ok' → !std.mem.eql(...)
            const is_neq = std.mem.endsWith(u8, cond.items, " != ");
            const op_len: usize = if (is_neq) 4 else if (std.mem.endsWith(u8, cond.items, " == ")) 4 else 0;
            if (op_len > 0) {
                const field_ref = std.fmt.allocPrint(self.alloc, "_oa{d}_{s}[_i]", .{ last_oa_string_idx, last_oa_string_field }) catch "";
                const remove_len = field_ref.len + op_len;
                if (cond.items.len >= remove_len) {
                    cond.items.len -= @intCast(remove_len);
                }
                const inner = if (txt.len >= 2) txt[1..txt.len-1] else txt;
                const prefix: []const u8 = if (is_neq) "!" else "";
                try cond.appendSlice(self.alloc, std.fmt.allocPrint(self.alloc,
                    "{s}std.mem.eql(u8, _oa{d}_{s}[_i][0.._oa{d}_{s}_lens[_i]], \"{s}\")",
                    .{ prefix, last_oa_string_idx, last_oa_string_field, last_oa_string_idx, last_oa_string_field, inner }) catch "false");
            } else {
                try cond.appendSlice(self.alloc, txt);
            }
            last_oa_string_field = "";
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
pub fn parseMapSubElement(self: *Generator) anyerror!codegen.MapSubNode {
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
    var sub_dyn_bg: []const u8 = "";
    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const a = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, a, "style")) {
                    const pre_dyn_count = self.dyn_style_count;
                    sub_style = try attrs.parseStyleAttr(self);
                    // Claim any background_color DynStyle added inside this map sub-element.
                    if (self.map_index_param != null or self.map_item_param != null) {
                        var dsi = pre_dyn_count;
                        while (dsi < self.dyn_style_count) : (dsi += 1) {
                            if (std.mem.eql(u8, self.dyn_styles[dsi].field, "background_color")) {
                                sub_dyn_bg = self.dyn_styles[dsi].expression;
                                self.dyn_styles[dsi].map_claimed = true;
                                break;
                            }
                        }
                    }
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
        return .{ .style = sub_style, .font_size = sub_font, .text_color = sub_color, .handler_body = sub_handler, .dyn_background_color = sub_dyn_bg };
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
        .dyn_background_color = sub_dyn_bg,
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
