//! JSX parser — recursive descent parsing of JSX element trees.
//!
//! parseJSXElement is the core: it parses <Tag attrs>children</Tag> and emits
//! Zig node declarations. Handles fragments, classifiers, components,
//! conditionals, routes, dynamic text, and dynamic colors.

const std = @import("std");
const codegen = @import("codegen.zig");
const Generator = codegen.Generator;
const attrs = @import("attrs.zig");
const handlers = @import("handlers.zig");
const components = @import("components.zig");

const MAX_DYN_TEXTS = codegen.MAX_DYN_TEXTS;
const MAX_DYN_DEPS = codegen.MAX_DYN_DEPS;
const MAX_DYN_STYLES = codegen.MAX_DYN_STYLES;
const MAX_CONDITIONALS = codegen.MAX_CONDITIONALS;
const MAX_ROUTES = codegen.MAX_ROUTES;

/// Parse a single JSX element and return a Zig Node struct literal string.
///
/// This is the core of the compiler. It handles:
///   - Fragments: <>...</>
///   - Classifier references: <C.ClassName />
///   - Route elements: <Route path="/" element={...} />
///   - Component calls: <MyComp prop="val" /> → delegates to components.inlineComponent
///   - Primitive elements: <Box style={{...}}>, <Text>hello</Text>, <Image src="..." />
///
/// For each element it:
///   1. Parses attributes (style, color, fontSize, onPress, src, etc.)
///   2. Parses children (child elements, text content, {expressions}, {conditionals})
///   3. Builds a Zig struct literal: .{ .style = .{...}, .text = "hello", .children = &_arr_N }
///   4. Emits child array declarations and binds dynamic text/style/conditional refs
///
/// Returns a string like ".{ .style = .{ .padding = 16 }, .children = &_arr_3 }"
pub fn parseJSXElement(self: *Generator) ![]const u8 {
    if (self.curKind() != .lt) {
        components.setExpectedJSXError(self);
        return error.ExpectedJSX;
    }
    const jsx_source_offset = self.cur().start; // capture <Tag source position for breadcrumbs
    self.advance_token(); // consume <

    // ── Fragment: <>...</> — anonymous wrapper, no style/attrs ──
    if (self.curKind() == .gt) {
        self.advance_token();
        var frag_children = std.ArrayListUnmanaged([]const u8){};
        while (self.curKind() != .lt_slash and self.curKind() != .eof) {
            if (self.curKind() == .lt) {
                try frag_children.append(self.alloc, try parseJSXElement(self));
            } else {
                self.advance_token();
            }
        }
        if (self.curKind() == .lt_slash) { self.advance_token(); if (self.curKind() == .gt) self.advance_token(); }
        if (frag_children.items.len == 0) return try self.alloc.dupe(u8, ".{}");
        const arr_name = try std.fmt.allocPrint(self.alloc, "_arr_{d}", .{self.array_counter});
        self.array_counter += 1;
        var arr_body = std.ArrayListUnmanaged(u8){};
        for (frag_children.items, 0..) |child_expr, ci| {
            if (ci > 0) try arr_body.appendSlice(self.alloc, ", ");
            try arr_body.appendSlice(self.alloc, child_expr);
        }
        const frag_loc = self.lineCol(jsx_source_offset);
        try self.array_decls.append(self.alloc, try std.fmt.allocPrint(self.alloc,
            "// tsz:{s}:{d} — <>\nvar {s} = [_]Node{{ {s} }};",
            .{ std.fs.path.basename(self.input_file), frag_loc.line, arr_name, arr_body.items }));
        return try std.fmt.allocPrint(self.alloc, ".{{ .children = &{s} }}", .{arr_name});
    }

    var tag_name = self.curText();
    self.advance_token();

    // C.Name classifier reference
    var classifier_idx: ?u32 = null;
    if (std.mem.eql(u8, tag_name, "C") and self.curKind() == .dot) {
        self.advance_token();
        const cls_name = self.curText();
        self.advance_token();
        classifier_idx = self.findClassifier(cls_name);
        if (classifier_idx) |idx| {
            tag_name = self.classifier_primitives[idx];
        }
    }

    // Route element
    if (std.mem.eql(u8, tag_name, "Route")) {
        return try parseRouteElement(self);
    }

    // Routes container
    const is_routes = std.mem.eql(u8, tag_name, "Routes");
    if (is_routes) self.routes_bind_from = self.route_count;

    // Component call
    if (self.compile_error != null) return ".{}";
    if (self.findComponent(tag_name)) |comp| {
        return try components.inlineComponent(self, comp);
    }

    // Parse attributes
    var style_str: []const u8 = "";
    var font_size: []const u8 = "";
    var letter_spacing: []const u8 = "";
    var line_height_val: []const u8 = "";
    var number_of_lines: []const u8 = "";
    var no_wrap: bool = false;
    var color_str: []const u8 = "";
    var dyn_color_expr: ?[]const u8 = null;
    var src_str: []const u8 = "";
    var on_press_start: ?u32 = null;
    var hoverable: bool = false;

    // Pre-populate from classifier
    if (classifier_idx) |idx| {
        style_str = self.classifier_styles[idx];
        const tp = self.classifier_text_props[idx];
        if (tp.len > 0) {
            if (std.mem.indexOf(u8, tp, ".font_size = ")) |fs_pos| {
                const after = tp[fs_pos + 13 ..];
                const end = std.mem.indexOfAny(u8, after, &[_]u8{ ',', 0 }) orelse after.len;
                font_size = after[0..end];
            }
        }
    }

    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const attr_name = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, attr_name, "style")) {
                    const inline_style = try attrs.parseStyleAttr(self);
                    if (style_str.len > 0 and inline_style.len > 0) {
                        style_str = try std.fmt.allocPrint(self.alloc, "{s}, {s}", .{ style_str, inline_style });
                    } else if (inline_style.len > 0) {
                        style_str = inline_style;
                    }
                } else if (std.mem.eql(u8, attr_name, "fontSize")) {
                    font_size = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr_name, "letterSpacing")) {
                    letter_spacing = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr_name, "lineHeight")) {
                    line_height_val = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr_name, "numberOfLines")) {
                    number_of_lines = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr_name, "noWrap")) {
                    try attrs.skipAttrValue(self);
                    no_wrap = true;
                } else if (std.mem.eql(u8, attr_name, "color")) {
                    if (self.curKind() == .lbrace) {
                        self.advance_token();
                        self.emit_colors_as_rgb = true;
                        dyn_color_expr = try handlers.emitStateExpr(self);
                        self.emit_colors_as_rgb = false;
                        if (self.curKind() == .rbrace) self.advance_token();
                    } else {
                        color_str = try attrs.parseStringAttr(self);
                    }
                } else if (std.mem.eql(u8, attr_name, "src")) {
                    src_str = try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "onPress")) {
                    if (self.curKind() == .lbrace) {
                        const peek_pos = self.pos + 1;
                        if (peek_pos < self.lex.count and self.lex.get(peek_pos).kind == .identifier) {
                            const peek_name = self.lex.get(peek_pos).text(self.source);
                            if (self.findProp(peek_name)) |pval| {
                                if (std.mem.startsWith(u8, pval, "__handler_pos_")) {
                                    on_press_start = std.fmt.parseInt(u32, pval["__handler_pos_".len..], 10) catch self.pos;
                                    try attrs.skipBalanced(self);
                                } else {
                                    on_press_start = self.pos;
                                    try attrs.skipBalanced(self);
                                }
                            } else {
                                on_press_start = self.pos;
                                try attrs.skipBalanced(self);
                            }
                        } else {
                            on_press_start = self.pos;
                            try attrs.skipBalanced(self);
                        }
                    } else {
                        on_press_start = self.pos;
                        try attrs.skipBalanced(self);
                    }
                } else if (std.mem.eql(u8, attr_name, "hoverable")) {
                    hoverable = true;
                    try attrs.skipAttrValue(self);
                } else {
                    try attrs.skipAttrValue(self);
                }
            }
        } else {
            self.advance_token();
        }
    }

    // ── Phase 2: Parse children (between > and </Tag>) ──
    // Collects: child elements, text content, dynamic text {expressions},
    // template literals, conditional rendering {expr && <JSX>}
    var child_exprs = std.ArrayListUnmanaged([]const u8){}; // child node expressions
    var text_content: ?[]const u8 = null; // static text content for <Text>
    var is_dynamic_text = false; // true if text comes from state/expression
    var is_prop_text_ref = false; // true if text is a _p_name reference
    var dyn_fmt: []const u8 = ""; // format string for dynamic text: "{d}" or "{s}"
    var dyn_args: []const u8 = ""; // args for dynamic text: "state.getSlot(0)"
    var text_dep_slots: [MAX_DYN_DEPS]u32 = undefined; // which state slots this text depends on
    var text_dep_count: u32 = 0;

    const cond_base = self.conditional_count; // track conditionals added by this element's children

    if (self.curKind() == .slash_gt) {
        self.advance_token();
    } else if (self.curKind() == .gt) {
        self.advance_token();

        while (self.curKind() != .lt_slash and self.curKind() != .eof) {
            if (self.curKind() == .lt) {
                const child = try parseJSXElement(self);
                try child_exprs.append(self.alloc, child);
            } else if (self.curKind() == .lbrace) {
                self.advance_token(); // {

                // {children} splice
                if (self.isIdent("children") and self.component_children_exprs != null) {
                    self.advance_token();
                    if (self.curKind() == .rbrace) self.advance_token();
                    for (self.component_children_exprs.?.items) |child_expr| {
                        try child_exprs.append(self.alloc, child_expr);
                    }
                    continue;
                }

                // {expr && <JSX>} conditional rendering
                if (try tryParseConditionalChild(self, &child_exprs)) {
                    continue;
                }

                // {'string'} or {"string"} escape expressions
                if (self.curKind() == .string) {
                    const raw = self.cur().text(self.source);
                    if (raw.len >= 2) {
                        text_content = raw[1 .. raw.len - 1];
                    }
                    self.advance_token();
                    if (self.curKind() == .rbrace) self.advance_token();
                    continue;
                }

                if (self.curKind() == .template_literal) {
                    const tl = try attrs.parseTemplateLiteral(self);
                    if (tl.is_dynamic) {
                        is_dynamic_text = true;
                        dyn_fmt = tl.fmt;
                        dyn_args = tl.args;
                        text_dep_slots = tl.dep_slots;
                        text_dep_count = tl.dep_count;
                    } else {
                        text_content = tl.static_text;
                    }
                    self.advance_token();
                } else if (self.curKind() == .identifier) {
                    const ident = self.curText();
                    if (self.findPropBinding(ident)) |binding| {
                        self.advance_token();
                        if (binding.prop_type == .dynamic_text and !self.emit_prop_refs) {
                            if (binding.value.len >= 2 and binding.value[0] == '`') {
                                const inner = binding.value[1 .. binding.value.len - 1];
                                if (std.mem.indexOf(u8, inner, "${") != null) {
                                    const tmpl = try attrs.parseTemplateLiteralFromText(self, inner);
                                    if (tmpl.is_dynamic) {
                                        is_dynamic_text = true;
                                        dyn_fmt = tmpl.fmt;
                                        dyn_args = tmpl.args;
                                        for (0..tmpl.dep_count) |di| {
                                            if (text_dep_count < MAX_DYN_DEPS) {
                                                text_dep_slots[text_dep_count] = tmpl.dep_slots[di];
                                                text_dep_count += 1;
                                            }
                                        }
                                    } else {
                                        text_content = tmpl.static_text;
                                    }
                                } else {
                                    text_content = inner;
                                }
                            } else {
                                text_content = binding.value;
                            }
                        } else {
                            const val = if (self.emit_prop_refs)
                                (std.fmt.allocPrint(self.alloc, "_p_{s}", .{ident}) catch "")
                            else
                                binding.value;
                            if (std.mem.startsWith(u8, val, "_p_")) {
                                text_content = val;
                                is_prop_text_ref = true;
                            } else if (val.len >= 2 and (val[0] == '"' or val[0] == '\'')) {
                                text_content = val[1 .. val.len - 1];
                            } else if (std.mem.startsWith(u8, val, "state.getSlot(")) {
                                is_dynamic_text = true; dyn_fmt = "{d}"; dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotString(")) {
                                is_dynamic_text = true; dyn_fmt = "{s}"; dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotFloat(")) {
                                is_dynamic_text = true; dyn_fmt = "{d}"; dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotBool(")) {
                                is_dynamic_text = true; dyn_fmt = "{s}";
                                dyn_args = try std.fmt.allocPrint(self.alloc, "if ({s}) \"true\" else \"false\"", .{val});
                            } else if (std.mem.indexOf(u8, val, "state.getSlot") != null) {
                                is_dynamic_text = true; dyn_fmt = "{d}"; dyn_args = val;
                            } else {
                                text_content = val;
                            }
                        }
                    } else if (self.isState(ident)) |slot_id| {
                        self.advance_token();
                        is_dynamic_text = true;
                        const st = self.stateTypeById(slot_id);
                        const rid = self.regularSlotId(slot_id);
                        text_dep_slots[0] = rid;
                        text_dep_count = 1;
                        dyn_fmt = switch (st) { .string => "{s}", .float => "{d}", .boolean => "{s}", else => "{d}" };
                        dyn_args = switch (st) {
                            .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                            .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                            .boolean => try std.fmt.allocPrint(self.alloc, "if (state.getSlotBool({d})) \"true\" else \"false\"", .{rid}),
                            else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                        };
                    } else if (self.isLocalVar(ident)) |lv| {
                        self.advance_token();
                        is_dynamic_text = true;
                        dyn_fmt = switch (lv.state_type) { .string => "{s}", .float => "{d}", .boolean => "{s}", else => "{d}" };
                        dyn_args = lv.expr;
                    } else {
                        self.advance_token();
                    }
                }
                if (self.curKind() == .rbrace) self.advance_token();
            } else if (self.curKind() != .lt and self.curKind() != .lt_slash and self.curKind() != .eof) {
                const raw = attrs.collectTextContent(self);
                if (raw.len > 0) text_content = raw;
            } else {
                self.advance_token();
            }
        }

        // Skip closing tag
        if (self.curKind() == .lt_slash) {
            self.advance_token();
            if (self.curKind() == .identifier) {
                self.advance_token();
                if (self.curKind() == .dot) { self.advance_token(); if (self.curKind() == .identifier) self.advance_token(); }
            }
            if (self.curKind() == .gt) self.advance_token();
        }
    }

    // ── Phase 3: Build the Zig node struct literal ──
    // Assembles all collected data into ".{ .style = ..., .text = ..., .children = &_arr_N }"
    var fields: std.ArrayListUnmanaged(u8) = .{};

    // Style
    if (style_str.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".style = .{ ");
        try fields.appendSlice(self.alloc, style_str);
        try fields.appendSlice(self.alloc, " }");
    }

    // Text
    if (is_dynamic_text) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".text = \"\"");
        if (self.dyn_count < MAX_DYN_TEXTS) {
            self.dyn_texts[self.dyn_count] = .{
                .buf_id = self.dyn_count,
                .fmt_string = dyn_fmt,
                .fmt_args = dyn_args,
                .arr_name = "",
                .arr_index = 0,
                .has_ref = false,
                .dep_slots = text_dep_slots,
                .dep_count = text_dep_count,
            };
            self.last_dyn_id = self.dyn_count;
            self.dyn_count += 1;
        }
    } else if (text_content) |tc| {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        if (is_prop_text_ref) {
            try fields.appendSlice(self.alloc, ".text = ");
            try fields.appendSlice(self.alloc, tc);
        } else {
            try fields.appendSlice(self.alloc, ".text = \"");
            for (tc) |ch| {
                if (ch == '"') { try fields.appendSlice(self.alloc, "\\\""); } else if (ch == '\\') { try fields.appendSlice(self.alloc, "\\\\"); } else if (ch == '\n') { try fields.appendSlice(self.alloc, "\\n"); } else { try fields.append(self.alloc, ch); }
            }
            try fields.appendSlice(self.alloc, "\"");
        }
    }

    // Font size
    if (font_size.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".font_size = ");
        try fields.appendSlice(self.alloc, font_size);
    }
    if (no_wrap) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".no_wrap = true");
    }
    if (letter_spacing.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".letter_spacing = ");
        try fields.appendSlice(self.alloc, letter_spacing);
    }
    if (line_height_val.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".line_height = ");
        try fields.appendSlice(self.alloc, line_height_val);
    }
    if (number_of_lines.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".number_of_lines = ");
        try fields.appendSlice(self.alloc, number_of_lines);
    }

    // Color
    if (dyn_color_expr) |expr| {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".text_color = Color.rgb(0, 0, 0)");
        if (self.dyn_style_count < MAX_DYN_STYLES) {
            self.dyn_styles[self.dyn_style_count] = .{
                .field = "text_color",
                .expression = expr,
                .arr_name = "",
                .arr_index = 0,
                .has_ref = false,
            };
            self.dyn_style_count += 1;
        }
    } else if (color_str.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".text_color = ");
        if (std.mem.startsWith(u8, color_str, "_p_")) {
            try fields.appendSlice(self.alloc, color_str);
        } else {
            try fields.appendSlice(self.alloc, try attrs.parseColorValue(self, color_str));
        }
    }
    // Classifier text_color
    if (classifier_idx != null and color_str.len == 0 and dyn_color_expr == null) {
        const tp = self.classifier_text_props[classifier_idx.?];
        if (std.mem.indexOf(u8, tp, ".text_color = ")) |tc_pos| {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, tp[tc_pos..]);
        }
    }

    // Image src
    if (src_str.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".image_src = \"");
        if (std.fs.path.dirname(self.input_file)) |dir| {
            try fields.appendSlice(self.alloc, try std.fs.path.resolve(self.alloc, &.{ dir, src_str }));
        } else {
            try fields.appendSlice(self.alloc, src_str);
        }
        try fields.appendSlice(self.alloc, "\"");
    }

    // onPress handler
    if (on_press_start) |start| {
        const handler_name = try std.fmt.allocPrint(self.alloc, "_handler_press_{d}", .{self.handler_counter});
        self.handler_counter += 1;
        const body = try handlers.emitHandlerBody(self, start);
        if (body.len == 0) {
            self.addWarning(self.lex.get(start).start, "onPress handler body produced no statements — onClick will do nothing at runtime");
        }
        const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n{s}}}", .{ handler_name, body });
        try self.handler_decls.append(self.alloc, handler_fn);
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".handlers = .{ .on_press = ");
        try fields.appendSlice(self.alloc, handler_name);
        try fields.appendSlice(self.alloc, " }");
    }

    // Hoverable
    if (hoverable) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".hoverable = true");
    }

    // ── Phase 4: Emit children array and bind dynamic refs ──
    // If this element has child nodes, emit a `var _arr_N = [_]Node{ child0, child1, ... };`
    // declaration and set .children = &_arr_N on this node.
    // Then bind any unbound dynamic texts, styles, and conditionals to their
    // parent array + index so _updateDynamicTexts() knows where to write at runtime.
    if (child_exprs.items.len > 0) {
        const arr_name = try std.fmt.allocPrint(self.alloc, "_arr_{d}", .{self.array_counter});
        self.array_counter += 1;

        var arr_content: std.ArrayListUnmanaged(u8) = .{};
        // Source breadcrumb: tsz:file:line — <Tag>
        const tag_loc = self.lineCol(jsx_source_offset);
        try arr_content.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc,
            "// tsz:{s}:{d} — <{s}>\n", .{ std.fs.path.basename(self.input_file), tag_loc.line, tag_name }));
        try arr_content.appendSlice(self.alloc, "var ");
        try arr_content.appendSlice(self.alloc, arr_name);
        try arr_content.appendSlice(self.alloc, " = [_]Node{ ");
        for (child_exprs.items, 0..) |expr, idx| {
            if (idx > 0) try arr_content.appendSlice(self.alloc, ", ");
            try arr_content.appendSlice(self.alloc, expr);
        }
        try arr_content.appendSlice(self.alloc, " };");
        if (self.current_inline_component) |comp_name| {
            try arr_content.appendSlice(self.alloc, " // ");
            try arr_content.appendSlice(self.alloc, comp_name);
        }
        try self.array_decls.append(self.alloc, try arr_content.toOwnedSlice(self.alloc));

        // Bind component instances
        for (child_exprs.items, 0..) |expr, ci| {
            if (std.mem.eql(u8, expr, ".{}")) {
                for (0..self.comp_instance_count) |cii| {
                    if (self.comp_instances[cii].parent_arr.len == 0) {
                        self.comp_instances[cii].parent_arr = arr_name;
                        self.comp_instances[cii].parent_idx = @intCast(ci);
                        break;
                    }
                }
            }
        }

        // Bind routes
        if (self.last_route_path) |path| {
            if (self.route_count < MAX_ROUTES) {
                self.routes[self.route_count] = .{
                    .path = path,
                    .arr_name = arr_name,
                    .child_idx = @intCast(child_exprs.items.len - 1),
                };
                self.route_count += 1;
            }
            self.last_route_path = null;
        }

        // Bind conditionals
        for (cond_base..self.conditional_count) |ci| {
            if (self.conditionals[ci].arr_name.len == 0) {
                self.conditionals[ci].arr_name = arr_name;
            }
        }

        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".children = &");
        try fields.appendSlice(self.alloc, arr_name);

        // Bind dynamic texts
        var claimed: [64]bool = [_]bool{false} ** 64;
        for (0..self.dyn_count) |di| {
            if (!self.dyn_texts[di].has_ref) {
                for (child_exprs.items, 0..) |expr, ci| {
                    if (ci < 64 and !claimed[ci] and std.mem.indexOf(u8, expr, ".text = \"\"") != null) {
                        self.dyn_texts[di].arr_name = arr_name;
                        self.dyn_texts[di].arr_index = @intCast(ci);
                        self.dyn_texts[di].has_ref = true;
                        claimed[ci] = true;
                        break;
                    }
                }
            }
        }

        // Bind dynamic styles (color, opacity, etc.)
        for (0..self.dyn_style_count) |dsi| {
            if (!self.dyn_styles[dsi].has_ref) {
                // Build the placeholder pattern for this field
                const placeholder = if (std.mem.eql(u8, self.dyn_styles[dsi].field, "text_color"))
                    ".text_color = Color.rgb(0, 0, 0)"
                else
                    "";
                if (placeholder.len > 0) {
                    for (child_exprs.items, 0..) |expr, ci| {
                        if (std.mem.indexOf(u8, expr, placeholder) != null) {
                            self.dyn_styles[dsi].arr_name = arr_name;
                            self.dyn_styles[dsi].arr_index = @intCast(ci);
                            self.dyn_styles[dsi].has_ref = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{fields.items});
}

// ── Conditional child parsing ──
// Handles {expr && <JSX>} patterns inside JSX children.
// Two modes:
//   - Compile-time: if expr is a prop (no state), evaluate truthiness at compile time
//     and either include or exclude the child entirely.
//   - Runtime: if expr references state, emit a ConditionalInfo that _updateConditionals()
//     toggles display:.flex/.none on each state change.

/// Look ahead from current position to see if there's a && before the next closing brace.
/// Used to distinguish {expr && <JSX>} from {expr} or {children}.
pub fn isLogicalAndAhead(self: *Generator) bool {
    var look = self.pos;
    var brace_depth: u32 = 0;
    while (look < self.lex.count) {
        const kind = self.lex.get(look).kind;
        if (kind == .lbrace) brace_depth += 1;
        if (kind == .rbrace) {
            if (brace_depth == 0) return false;
            brace_depth -= 1;
        }
        if (kind == .amp_amp and brace_depth == 0) return true;
        if (kind == .eof) return false;
        look += 1;
    }
    return false;
}

/// Try to parse a {expr && <JSX>} conditional child.
/// Returns true if it was a conditional (consumed tokens), false if not (no tokens consumed).
///
/// Compile-time path (props only): evaluates the condition at compile time and either
/// includes or omits the child JSX entirely — zero runtime cost.
///
/// Runtime path (state refs): always includes the child, but records a ConditionalInfo
/// that _updateConditionals() uses to toggle display:.flex/.none on state changes.
pub fn tryParseConditionalChild(self: *Generator, child_exprs: *std.ArrayListUnmanaged([]const u8)) anyerror!bool {
    if (!isLogicalAndAhead(self)) return false;

    const saved_pos = self.pos;
    var has_state_ref = false;
    var has_comparison = false;
    var token_count: u32 = 0;

    {
        var scan = self.pos;
        while (scan < self.lex.count) {
            const kind = self.lex.get(scan).kind;
            if (kind == .amp_amp) break;
            if (kind == .identifier) {
                const txt = self.lex.get(scan).text(self.source);
                if (self.isState(txt) != null) has_state_ref = true;
            }
            if (kind == .eq_eq or kind == .not_eq or kind == .lt or kind == .gt or
                kind == .lt_eq or kind == .gt_eq) has_comparison = true;
            token_count += 1;
            scan += 1;
        }
    }

    // Compile-time conditional: props only (no state)
    if (!has_state_ref) {
        self.pos = saved_pos;

        var amp_pos = self.pos;
        while (amp_pos < self.lex.count and self.lex.get(amp_pos).kind != .amp_amp) amp_pos += 1;

        var lhs: ?i64 = null;
        var rhs: ?i64 = null;
        var cmp_op: enum { none, eq, neq } = .none;

        if (!has_comparison and token_count == 1) {
            const ident = self.curText();
            const prop_val = self.findProp(ident) orelse "";
            const is_truthy = prop_val.len > 0 and
                !std.mem.eql(u8, prop_val, "0") and
                !std.mem.eql(u8, prop_val, "\"\"") and
                !std.mem.eql(u8, prop_val, "''");
            self.pos = amp_pos;
            self.advance_token();
            if (is_truthy) {
                const child_expr = try parseJSXElement(self);
                try child_exprs.append(self.alloc, child_expr);
            } else {
                _ = try parseJSXElement(self);
            }
            if (self.curKind() == .rbrace) self.advance_token();
            return true;
        }

        while (self.pos < amp_pos) {
            if (self.curKind() == .identifier) {
                const val_str = self.findProp(self.curText()) orelse self.curText();
                lhs = std.fmt.parseInt(i64, val_str, 10) catch null;
            } else if (self.curKind() == .number) {
                const n = std.fmt.parseInt(i64, self.curText(), 10) catch null;
                if (lhs != null and cmp_op != .none) rhs = n else lhs = n;
            } else if (self.curKind() == .eq_eq) {
                cmp_op = .eq;
            } else if (self.curKind() == .not_eq) {
                cmp_op = .neq;
            }
            self.advance_token();
        }

        const is_truthy = if (lhs != null and rhs != null and cmp_op != .none)
            (if (cmp_op == .eq) lhs.? == rhs.? else lhs.? != rhs.?)
        else if (lhs != null)
            lhs.? != 0
        else
            false;

        self.advance_token();
        if (is_truthy) {
            const child_expr = try parseJSXElement(self);
            try child_exprs.append(self.alloc, child_expr);
        } else {
            _ = try parseJSXElement(self);
        }
        if (self.curKind() == .rbrace) self.advance_token();
        return true;
    }

    // State-based condition: runtime conditional
    if (has_state_ref) {
        self.pos = saved_pos;

        var amp_pos = self.pos;
        while (amp_pos < self.lex.count and self.lex.get(amp_pos).kind != .amp_amp) amp_pos += 1;

        var cond_parts: std.ArrayListUnmanaged(u8) = .{};
        try cond_parts.appendSlice(self.alloc, "(");
        while (self.pos < amp_pos) {
            const tok_text = self.curText();
            if (self.curKind() == .identifier) {
                if (self.isState(tok_text)) |slot_id| {
                    const rid = self.regularSlotId(slot_id);
                    const st = self.stateTypeById(slot_id);
                    const accessor = switch (st) {
                        .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                        .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                        .boolean => try std.fmt.allocPrint(self.alloc, "state.getSlotBool({d})", .{rid}),
                        else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                    };
                    try cond_parts.appendSlice(self.alloc, accessor);
                    self.advance_token();
                    continue;
                }
                if (self.findProp(tok_text)) |pval| {
                    if (cond_parts.items.len > 1) try cond_parts.append(self.alloc, ' ');
                    try cond_parts.appendSlice(self.alloc, pval);
                    self.advance_token();
                    continue;
                }
            }
            if (self.curKind() == .eq_eq) {
                try cond_parts.appendSlice(self.alloc, " == ");
            } else if (self.curKind() == .not_eq) {
                try cond_parts.appendSlice(self.alloc, " != ");
            } else {
                if (cond_parts.items.len > 1) try cond_parts.append(self.alloc, ' ');
                try cond_parts.appendSlice(self.alloc, tok_text);
            }
            self.advance_token();
        }
        try cond_parts.appendSlice(self.alloc, ")");

        self.advance_token(); // skip &&

        const child_expr = try parseJSXElement(self);
        try child_exprs.append(self.alloc, child_expr);

        if (self.conditional_count < MAX_CONDITIONALS) {
            self.conditionals[self.conditional_count] = .{
                .kind = .show_hide,
                .cond_expr = try self.alloc.dupe(u8, cond_parts.items),
                .arr_name = "",
                .true_idx = @intCast(child_exprs.items.len - 1),
            };
            self.conditional_count += 1;
        }

        if (self.curKind() == .rbrace) self.advance_token();
        return true;
    }

    self.pos = saved_pos;
    return false;
}

// ── Route element ──

/// Parse <Route path="/about" element={<AboutPage />} />
/// Records the route path and returns the element expression.
/// The parent <Routes> container binds all routes to a shared array,
/// and updateRoutes() toggles display based on router.currentPath().
pub fn parseRouteElement(self: *Generator) anyerror![]const u8 {
    const saved_bind = self.routes_bind_from;
    self.routes_bind_from = null;
    defer self.routes_bind_from = saved_bind;

    var path: []const u8 = "/";
    var element_expr: []const u8 = ".{}";

    while (self.curKind() != .gt and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const attr_name = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, attr_name, "path")) {
                    path = try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "element")) {
                    if (self.curKind() == .lbrace) self.advance_token();
                    element_expr = try parseJSXElement(self);
                    if (self.curKind() == .rbrace) self.advance_token();
                } else {
                    try attrs.skipAttrValue(self);
                }
            }
        } else {
            self.advance_token();
        }
    }

    self.advance_token();
    self.last_route_path = path;
    self.has_routes = true;

    return element_expr;
}
