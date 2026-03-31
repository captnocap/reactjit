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
const jsx_map = @import("jsx_map.zig");
const jsx_elements = @import("jsx_elements.zig");
const html_tags = @import("rules/html_tags.zig");
const jsx_conditional = @import("jsx_conditional.zig");
const effect_shadergen = @import("effect_shadergen.zig");

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
        const frag_cond_base = self.conditional_count;
        while (self.curKind() != .lt_slash and self.curKind() != .eof) {
            if (self.curKind() == .lt) {
                try frag_children.append(self.alloc, try parseJSXElement(self));
            } else if (self.curKind() == .lbrace) {
                self.advance_token(); // {
                // {/* JSX comment */} — skip block comments
                if (self.curKind() == .comment) {
                    self.advance_token();
                    if (self.curKind() == .rbrace) self.advance_token();
                    continue;
                }
                // {children} splice
                if (self.isIdent("children") and self.component_children_exprs != null) {
                    self.advance_token();
                    if (self.curKind() == .rbrace) self.advance_token();
                    for (self.component_children_exprs.?.items) |child_expr| {
                        try frag_children.append(self.alloc, child_expr);
                    }
                    continue;
                }
                // {expr && <JSX>} conditional rendering
                if (try jsx_conditional.tryParseConditionalChild(self, &frag_children)) {
                    continue;
                }
                if (self.curKind() == .rbrace) self.advance_token();
            } else {
                self.advance_token();
            }
        }
        if (self.curKind() == .lt_slash) {
            self.advance_token();
            if (self.curKind() == .gt) self.advance_token();
        }
        if (frag_children.items.len == 0) return try self.alloc.dupe(u8, ".{}");
        const arr_name = try std.fmt.allocPrint(self.alloc, "_arr_{d}", .{self.array_counter});
        self.array_counter += 1;
        var arr_body = std.ArrayListUnmanaged(u8){};
        for (frag_children.items, 0..) |child_expr, ci| {
            if (ci > 0) try arr_body.appendSlice(self.alloc, ", ");
            try arr_body.appendSlice(self.alloc, child_expr);
        }
        const frag_loc = self.lineCol(jsx_source_offset);
        try self.array_decls.append(self.alloc, try std.fmt.allocPrint(self.alloc, "// tsz:{s}:{d} — <>\nvar {s} = [_]Node{{ {s} }};", .{ std.fs.path.basename(self.input_file), frag_loc.line, arr_name, arr_body.items }));
        // Bind conditionals from this fragment's children
        for (frag_cond_base..self.conditional_count) |ci| {
            if (self.conditionals[ci].arr_name.len == 0) {
                self.conditionals[ci].arr_name = arr_name;
            }
        }
        return try std.fmt.allocPrint(self.alloc, ".{{ .children = &{s} }}", .{arr_name});
    }

    var tag_name = self.curText();
    self.advance_token();

    // 3D namespace: lexer tokenizes <3D.Mesh> as number("3") + ident("D") + dot + ident
    // Combine into "3D" so the dot-namespace logic below can parse 3D.Mesh/Camera/Light/Group
    var is_3d = false;
    var is_3d_mesh = false;
    var is_3d_camera = false;
    var is_3d_light = false;
    var is_3d_group = false;
    var is_3d_view = false;
    if (std.mem.eql(u8, tag_name, "3") and self.curKind() == .identifier and std.mem.eql(u8, self.curText(), "D")) {
        self.advance_token(); // skip "D"
        is_3d = true;
        tag_name = "Box"; // 3D elements compile to Box nodes with 3D fields
        if (self.curKind() == .dot) {
            self.advance_token(); // skip "."
            if (self.curKind() == .identifier) {
                const sub = self.curText();
                if (std.mem.eql(u8, sub, "Mesh")) {
                    self.advance_token();
                    is_3d_mesh = true;
                } else if (std.mem.eql(u8, sub, "Camera")) {
                    self.advance_token();
                    is_3d_camera = true;
                } else if (std.mem.eql(u8, sub, "Light")) {
                    self.advance_token();
                    is_3d_light = true;
                } else if (std.mem.eql(u8, sub, "Group")) {
                    self.advance_token();
                    is_3d_group = true;
                } else if (std.mem.eql(u8, sub, "View")) {
                    self.advance_token();
                    is_3d_view = true;
                }
            }
        }
    }

    // HTML tag → primitive resolution (div→Box, span→Text, etc.)
    if (html_tags.resolve(tag_name)) |prim| {
        tag_name = prim;
    }

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

    // TextInput/TextArea detection
    const is_text_input = std.mem.eql(u8, tag_name, "TextInput") or std.mem.eql(u8, tag_name, "TextArea");
    const is_multiline = std.mem.eql(u8, tag_name, "TextArea");
    // ScrollView → Box with overflow: auto (no special primitive needed)
    const is_scroll_view = std.mem.eql(u8, tag_name, "ScrollView");
    // Video → Box with video_src field
    const is_video = std.mem.eql(u8, tag_name, "Video");
    // Render → Box with render_src field
    const is_render = std.mem.eql(u8, tag_name, "Render");
    // Effect → Box with effect_type field (legacy named effects)
    const is_effect = std.mem.eql(u8, tag_name, "Spirograph") or std.mem.eql(u8, tag_name, "Rings") or
        std.mem.eql(u8, tag_name, "Constellation") or std.mem.eql(u8, tag_name, "FlowParticles") or
        std.mem.eql(u8, tag_name, "Voronoi") or std.mem.eql(u8, tag_name, "Terrain") or
        std.mem.eql(u8, tag_name, "Sunburst") or std.mem.eql(u8, tag_name, "Cymatics");
    // Effect → Box with effect_render callback (composable user-defined effects)
    const is_custom_effect = std.mem.eql(u8, tag_name, "Effect");
    // Scene3D / 3D.View → Box with scene3d flag (3D viewport)
    const is_scene3d = std.mem.eql(u8, tag_name, "Scene3D") or is_3d_view;
    // Canvas → Box with canvas_type field
    const is_canvas = std.mem.eql(u8, tag_name, "Canvas");
    // Graph → Box with graph_container (SVG paths, no pan/zoom)
    const is_graph = std.mem.eql(u8, tag_name, "Graph");
    // Canvas.Node / Canvas.Path / Canvas.Clamp / Graph.Path / Graph.Node
    var is_canvas_node = false;
    var is_canvas_path = false;
    var is_canvas_clamp = false;
    // Cartridge → embedded .so app (loaded at runtime via dlopen)
    const is_cartridge = std.mem.eql(u8, tag_name, "Cartridge");
    // Terminal → cell-grid rendering via vterm
    const is_terminal = std.mem.eql(u8, tag_name, "Terminal");
    var terminal_font_size: []const u8 = "";
    // Physics.World / Physics.Body / Physics.Collider
    const is_physics = std.mem.eql(u8, tag_name, "Physics");
    var phys_props = jsx_elements.PhysicsProps{};
    if ((is_canvas or is_graph or is_physics) and self.curKind() == .dot) {
        self.advance_token(); // skip '.'
        if (self.curKind() == .identifier) {
            const sub = self.curText();
            if (std.mem.eql(u8, sub, "Node") and !is_physics) {
                self.advance_token();
                is_canvas_node = true;
            } else if (std.mem.eql(u8, sub, "Path") and !is_physics) {
                self.advance_token();
                is_canvas_path = true;
            } else if (std.mem.eql(u8, sub, "Clamp") and is_canvas) {
                self.advance_token();
                is_canvas_clamp = true;
            } else if (std.mem.eql(u8, sub, "World") and is_physics) {
                self.advance_token();
                phys_props.is_physics_world = true;
            } else if (std.mem.eql(u8, sub, "Body") and is_physics) {
                self.advance_token();
                phys_props.is_physics_body = true;
            } else if (std.mem.eql(u8, sub, "Collider") and is_physics) {
                self.advance_token();
                phys_props.is_physics_collider = true;
            }
        }
    }

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
    var on_right_click_start: ?u32 = null;
    var on_change_text_start: ?u32 = null;
    var on_submit_start: ?u32 = null;
    var placeholder_str: []const u8 = "";
    var canvas_type_str: []const u8 = "";
    var canvas_gx_str: []const u8 = "";
    var canvas_gy_str: []const u8 = "";
    var canvas_gw_str: []const u8 = "";
    var canvas_gh_str: []const u8 = "";
    var canvas_path_d: []const u8 = "";
    var canvas_path_d_is_expr = false;
    var canvas_stroke_str: []const u8 = "";
    var canvas_stroke_is_expr = false;
    var canvas_fill_str: []const u8 = "";
    var canvas_fill_is_expr = false;
    var canvas_stroke_w_str: []const u8 = "";
    var canvas_flow_speed_str: []const u8 = "";
    var canvas_view_x_str: []const u8 = "";
    var canvas_view_y_str: []const u8 = "";
    var canvas_view_zoom_str: []const u8 = "";
    var canvas_drift_x_str: []const u8 = "";
    var canvas_drift_y_str: []const u8 = "";
    var tooltip_str: []const u8 = "";
    // 3D element props
    var s3d_geometry: []const u8 = "";
    var s3d_light_type: []const u8 = "";
    var s3d_color: []const u8 = "";
    var s3d_fov: []const u8 = "";
    var s3d_intensity: []const u8 = "";
    var s3d_radius: []const u8 = "";
    var s3d_tube_radius: []const u8 = "";
    var s3d_show_grid: bool = false;
    var s3d_show_axes: bool = false;
    var s3d_pos: [3][]const u8 = .{ "", "", "" };
    var s3d_rot: [3][]const u8 = .{ "", "", "" };
    var s3d_lookat: [3][]const u8 = .{ "", "", "" };
    var s3d_dir: [3][]const u8 = .{ "", "", "" };
    var s3d_size: [3][]const u8 = .{ "", "", "" };
    var s3d_scale: [3][]const u8 = .{ "", "", "" };
    var href_str: []const u8 = "";
    var hoverable: bool = false;
    var on_render_start: ?u32 = null; // <Effect onRender={...}>
    var effect_is_background: bool = false; // <Effect background ...>
    var effect_is_mask: bool = false; // <Effect mask ...>
    var effect_name_str: []const u8 = ""; // <Effect name="foo">
    var canvas_fill_effect_str: []const u8 = ""; // <Graph.Path fillEffect="foo">
    var canvas_fill_effect_is_expr = false;
    var text_effect_str: []const u8 = ""; // <Text textEffect="foo">

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

    while (self.curKind() != .gt and self.curKind() != .gt_eq and self.curKind() != .slash_gt and self.curKind() != .eof) {
        if (self.curKind() == .identifier) {
            const attr_name = self.curText();
            self.advance_token();
            if (self.curKind() == .equals) {
                self.advance_token();
                if (std.mem.eql(u8, attr_name, "style")) {
                    const inline_style = try attrs.parseStyleAttr(self);
                    if (style_str.len > 0 and inline_style.len > 0) {
                        style_str = try jsx_map.mergeStyles(self.alloc, style_str, inline_style);
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
                } else if (std.mem.eql(u8, attr_name, "textEffect")) {
                    text_effect_str = try attrs.parseStringAttr(self);
                } else if (!is_3d and std.mem.eql(u8, attr_name, "color")) {
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
                } else if (std.mem.eql(u8, attr_name, "onRightClick")) {
                    if (self.curKind() == .lbrace) {
                        on_right_click_start = self.pos;
                        try attrs.skipBalanced(self);
                    } else {
                        on_right_click_start = self.pos;
                        try attrs.skipBalanced(self);
                    }
                } else if (std.mem.eql(u8, attr_name, "placeholder")) {
                    placeholder_str = try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "onChangeText")) {
                    if (self.curKind() == .lbrace) {
                        on_change_text_start = self.pos;
                        try attrs.skipBalanced(self);
                    } else {
                        try attrs.skipAttrValue(self);
                    }
                } else if (std.mem.eql(u8, attr_name, "onSubmit")) {
                    if (self.curKind() == .lbrace) {
                        on_submit_start = self.pos;
                        try attrs.skipBalanced(self);
                    } else {
                        try attrs.skipAttrValue(self);
                    }
                } else if (std.mem.eql(u8, attr_name, "onRender") and is_custom_effect) {
                    if (self.curKind() == .lbrace) {
                        on_render_start = self.pos;
                        try attrs.skipBalanced(self);
                    } else {
                        try attrs.skipAttrValue(self);
                    }
                } else if (std.mem.eql(u8, attr_name, "name") and is_custom_effect) {
                    effect_name_str = try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "fillEffect") and is_canvas_path) {
                    canvas_fill_effect_is_expr = self.curKind() == .lbrace;
                    canvas_fill_effect_str = if (canvas_fill_effect_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "tooltip")) {
                    tooltip_str = try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "href")) {
                    href_str = try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "hoverable")) {
                    hoverable = true;
                    try attrs.skipAttrValue(self);
                } else if (std.mem.eql(u8, attr_name, "type") and is_canvas and !is_canvas_node and !is_canvas_path) {
                    canvas_type_str = try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "viewX") and (is_canvas or is_graph) and !is_canvas_node and !is_canvas_path) {
                    canvas_view_x_str = try jsx_elements.parseSignedNum(self);
                } else if (std.mem.eql(u8, attr_name, "viewY") and (is_canvas or is_graph) and !is_canvas_node and !is_canvas_path) {
                    canvas_view_y_str = try jsx_elements.parseSignedNum(self);
                } else if (std.mem.eql(u8, attr_name, "viewZoom") and (is_canvas or is_graph) and !is_canvas_node and !is_canvas_path) {
                    canvas_view_zoom_str = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr_name, "driftX") and is_canvas and !is_canvas_node and !is_canvas_path) {
                    canvas_drift_x_str = try jsx_elements.parseSignedNum(self);
                } else if (std.mem.eql(u8, attr_name, "driftY") and is_canvas and !is_canvas_node and !is_canvas_path) {
                    canvas_drift_y_str = try jsx_elements.parseSignedNum(self);
                } else if (std.mem.eql(u8, attr_name, "gx") and is_canvas_node) {
                    canvas_gx_str = try jsx_elements.parseSignedNum(self);
                } else if (std.mem.eql(u8, attr_name, "gy") and is_canvas_node) {
                    canvas_gy_str = try jsx_elements.parseSignedNum(self);
                } else if (std.mem.eql(u8, attr_name, "gw") and is_canvas_node) {
                    canvas_gw_str = try jsx_elements.parseSignedNum(self);
                } else if (std.mem.eql(u8, attr_name, "gh") and is_canvas_node) {
                    canvas_gh_str = try jsx_elements.parseSignedNum(self);
                } else if (std.mem.eql(u8, attr_name, "d") and is_canvas_path) {
                    canvas_path_d_is_expr = self.curKind() == .lbrace;
                    canvas_path_d = if (canvas_path_d_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "stroke") and is_canvas_path) {
                    canvas_stroke_is_expr = self.curKind() == .lbrace;
                    canvas_stroke_str = if (canvas_stroke_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "fill") and is_canvas_path) {
                    canvas_fill_is_expr = self.curKind() == .lbrace;
                    canvas_fill_str = if (canvas_fill_is_expr) try attrs.parseExprAttr(self) else try attrs.parseStringAttr(self);
                } else if (std.mem.eql(u8, attr_name, "strokeWidth") and is_canvas_path) {
                    canvas_stroke_w_str = try attrs.parseExprAttr(self);
                } else if (std.mem.eql(u8, attr_name, "flowSpeed") and is_canvas_path) {
                    canvas_flow_speed_str = try jsx_elements.parseSignedNum(self);
                    // ── 3D element props ──
                } else if (is_3d and std.mem.eql(u8, attr_name, "geometry")) {
                    s3d_geometry = try attrs.parseStringAttr(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "type")) {
                    s3d_light_type = try attrs.parseStringAttr(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "color")) {
                    s3d_color = try attrs.parseStringAttr(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "fov")) {
                    s3d_fov = try attrs.parseExprAttr(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "intensity")) {
                    s3d_intensity = try attrs.parseExprAttr(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "radius")) {
                    s3d_radius = try attrs.parseExprAttr(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "tubeRadius")) {
                    s3d_tube_radius = try attrs.parseExprAttr(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "position")) {
                    s3d_pos = try jsx_elements.parse3DVector(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "rotation")) {
                    s3d_rot = try jsx_elements.parse3DVector(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "lookAt")) {
                    s3d_lookat = try jsx_elements.parse3DVector(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "direction")) {
                    s3d_dir = try jsx_elements.parse3DVector(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "size")) {
                    s3d_size = try jsx_elements.parse3DVector(self);
                } else if (is_3d and std.mem.eql(u8, attr_name, "scale")) {
                    s3d_scale = try jsx_elements.parse3DVector(self);
                    // ── Terminal element props ──
                } else if (is_terminal and std.mem.eql(u8, attr_name, "fontSize")) {
                    terminal_font_size = try attrs.parseExprAttr(self);
                    // ── Physics element props ──
                } else if (is_physics and std.mem.eql(u8, attr_name, "type")) {
                    phys_props.body_type = try attrs.parseStringAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "x")) {
                    phys_props.x = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "y")) {
                    phys_props.y = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "angle")) {
                    phys_props.angle = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "gravity")) {
                    const gv = try jsx_elements.parse2DVector(self);
                    phys_props.gravity_x = gv[0];
                    phys_props.gravity_y = gv[1];
                } else if (is_physics and std.mem.eql(u8, attr_name, "shape")) {
                    phys_props.shape = try attrs.parseStringAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "radius")) {
                    phys_props.radius = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "width")) {
                    phys_props.width = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "height")) {
                    phys_props.height = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "density")) {
                    phys_props.density = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "friction")) {
                    phys_props.friction = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "restitution")) {
                    phys_props.restitution = try attrs.parseExprAttr(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "fixedRotation")) {
                    phys_props.fixed_rotation = true;
                    try attrs.skipAttrValue(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "bullet")) {
                    phys_props.bullet = true;
                    try attrs.skipAttrValue(self);
                } else if (is_physics and std.mem.eql(u8, attr_name, "gravityScale")) {
                    phys_props.gravity_scale = try attrs.parseExprAttr(self);
                } else {
                    try attrs.skipAttrValue(self);
                }
            } else {
                // Bare boolean attributes (no =): <Effect background />, <Effect mask />
                if (is_custom_effect and std.mem.eql(u8, attr_name, "background")) {
                    effect_is_background = true;
                } else if (is_custom_effect and std.mem.eql(u8, attr_name, "mask")) {
                    effect_is_mask = true;
                } else if (is_scene3d and std.mem.eql(u8, attr_name, "showGrid")) {
                    s3d_show_grid = true;
                } else if (is_scene3d and std.mem.eql(u8, attr_name, "showAxes")) {
                    s3d_show_axes = true;
                }
            }
        } else {
            self.advance_token();
        }
    }

    // ── Phase 2: Parse children (between > and </Tag>) ──
    // Collects: child elements, text content, dynamic text {expressions},
    // template literals, conditional rendering {expr && <JSX>}
    const dyn_bind_start = self.dyn_count; // scope dyn_text binding to this element
    var child_exprs = std.ArrayListUnmanaged([]const u8){}; // child node expressions
    var text_content: ?[]const u8 = null; // static text content for <Text>
    var is_dynamic_text = false; // true if text comes from state/expression
    var is_prop_text_ref = false; // true if text is a _p_name reference
    var dyn_fmt: []const u8 = ""; // format string for dynamic text: "{d}" or "{s}"
    var dyn_args: []const u8 = ""; // args for dynamic text: "state.getSlot(0)"
    var text_dep_slots: [MAX_DYN_DEPS]u32 = undefined; // which state slots this text depends on
    var text_dep_count: u32 = 0;
    // Inline glyphs (<Glyph> inside <Text>)
    var inline_glyph_exprs: std.ArrayListUnmanaged([]const u8) = .{};
    var text_builder: std.ArrayListUnmanaged(u8) = .{}; // accumulates text + \x01 sentinels

    const cond_base = self.conditional_count; // track conditionals added by this element's children

    if (self.curKind() == .slash_gt) {
        self.advance_token();
    } else if (self.curKind() == .gt or self.curKind() == .gt_eq) {
        // gt_eq (>=) can appear when > closes a tag and = is text content
        // (e.g. <C.SourceLineCode>=</C.SourceLineCode> lexes as >='s single token)
        if (self.curKind() == .gt_eq) text_content = "=";
        self.advance_token();

        while (self.curKind() != .lt_slash and self.curKind() != .eof) {
            if (self.curKind() == .lt) {
                // <Glyph d="..." fill="#color" /> — inline polygon in text
                if (self.pos + 1 < self.lex.count and self.lex.get(self.pos + 1).kind == .identifier and std.mem.eql(u8, self.lex.get(self.pos + 1).text(self.source), "Glyph")) {
                    try inline_glyph_exprs.append(self.alloc, try jsx_elements.parseInlineGlyph(self, &text_builder));
                    continue;
                }
                const child = try parseJSXElement(self);
                try child_exprs.append(self.alloc, child);
                // Bind route metadata per-child (Route sets last_route_path)
                if (self.last_route_path) |path| {
                    if (self.route_count < MAX_ROUTES) {
                        self.routes[self.route_count] = .{
                            .path = path,
                            .arr_name = "", // filled in when Routes array is created
                            .child_idx = @intCast(child_exprs.items.len - 1),
                        };
                        self.route_count += 1;
                    }
                    self.last_route_path = null;
                }
            } else if (self.curKind() == .lbrace) {
                self.advance_token(); // {

                // {/* JSX comment */} — skip block comments
                if (self.curKind() == .comment) {
                    self.advance_token();
                    if (self.curKind() == .rbrace) self.advance_token();
                    continue;
                }

                // {children} splice
                if (self.isIdent("children") and self.component_children_exprs != null) {
                    self.advance_token();
                    if (self.curKind() == .rbrace) self.advance_token();
                    for (self.component_children_exprs.?.items) |child_expr| {
                        try child_exprs.append(self.alloc, child_expr);
                    }
                    continue;
                }

                // {expr ? <A/> : <B/>} ternary conditional rendering
                if (try jsx_conditional.tryParseTernaryChild(self, &child_exprs)) {
                    // Bind the ternary conditional's arr_name to the current parent
                    // (will be filled in after the parent array is named)
                    continue;
                }

                // {expr && <JSX>} conditional rendering
                if (try jsx_conditional.tryParseConditionalChild(self, &child_exprs)) {
                    continue;
                }

                // {items.map((item, index) => <JSX/>)} dynamic list
                if (self.isMapAhead()) {
                    const map_result = try jsx_map.parseMapExpression(self);
                    // Make map placeholder inherit parent's layout-affecting properties
                    // (flex_direction, gap, flex_wrap) so pool children lay out correctly.
                    // Do NOT copy visual properties (background, padding, border, etc.)
                    if (std.mem.eql(u8, map_result, ".{}") and style_str.len > 0) {
                        var layout_props: std.ArrayListUnmanaged(u8) = .{};
                        const layout_keys = [_][]const u8{ ".flex_direction", ".flex_grow", ".gap", ".flex_wrap", ".align_items", ".justify_content", ".width", ".height" };
                        for (layout_keys) |key| {
                            if (std.mem.indexOf(u8, style_str, key)) |pos| {
                                // Extract "key = value" until next comma or end
                                var end = pos;
                                var depth_p: u32 = 0;
                                while (end < style_str.len) : (end += 1) {
                                    if (style_str[end] == '(') depth_p += 1;
                                    if (style_str[end] == ')') {
                                        if (depth_p > 0) depth_p -= 1;
                                    }
                                    if (style_str[end] == ',' and depth_p == 0) break;
                                }
                                if (layout_props.items.len > 0) layout_props.appendSlice(self.alloc, ", ") catch {};
                                layout_props.appendSlice(self.alloc, style_str[pos..end]) catch {};
                            }
                        }
                        if (layout_props.items.len > 0) {
                            const inherited = try std.fmt.allocPrint(self.alloc, ".{{ .style = .{{ {s} }} }}", .{layout_props.items});
                            try child_exprs.append(self.alloc, inherited);
                        } else {
                            try child_exprs.append(self.alloc, map_result);
                        }
                    } else {
                        try child_exprs.append(self.alloc, map_result);
                    }
                    if (self.map_count > 0) {
                        self.maps[self.map_count - 1].child_idx = @intCast(child_exprs.items.len - 1);
                    }
                    if (self.curKind() == .rbrace) self.advance_token();
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
                                is_dynamic_text = true;
                                dyn_fmt = "{d}";
                                dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotString(")) {
                                is_dynamic_text = true;
                                dyn_fmt = "{s}";
                                dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotFloat(")) {
                                is_dynamic_text = true;
                                dyn_fmt = "{d}";
                                dyn_args = val;
                            } else if (std.mem.startsWith(u8, val, "state.getSlotBool(")) {
                                is_dynamic_text = true;
                                dyn_fmt = "{s}";
                                dyn_args = try std.fmt.allocPrint(self.alloc, "if ({s}) \"true\" else \"false\"", .{val});
                            } else if (std.mem.indexOf(u8, val, "state.getSlot") != null) {
                                is_dynamic_text = true;
                                dyn_fmt = "{d}";
                                dyn_args = val;
                            } else {
                                text_content = val;
                            }
                        }
                    } else if (self.isObjectStateVar(ident) != null and
                        self.pos + 2 < self.lex.count and
                        self.lex.get(self.pos + 1).kind == .dot and
                        self.lex.get(self.pos + 2).kind == .identifier)
                    {
                        const field_name = self.lex.get(self.pos + 2).text(self.source);
                        if (self.resolveObjectStateField(ident, field_name)) |field| {
                            self.advance_token();
                            self.advance_token();
                            self.advance_token();
                            is_dynamic_text = true;
                            const rid = self.regularSlotId(field.slot_id);
                            text_dep_slots[0] = rid;
                            text_dep_count = 1;
                            dyn_fmt = switch (field.state_type) {
                                .string => "{s}",
                                .float => "{d}",
                                .boolean => "{s}",
                                else => "{d}",
                            };
                            dyn_args = switch (field.state_type) {
                                .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                                .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                                .boolean => try std.fmt.allocPrint(self.alloc, "if (state.getSlotBool({d})) \"true\" else \"false\"", .{rid}),
                                else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                            };
                        } else if (self.isObjectStateVar(ident) != null) {
                            const field_start = self.lex.get(self.pos + 2).start;
                            const msg = std.fmt.allocPrint(self.alloc, "unknown object state field '{s}.{s}'", .{ ident, field_name }) catch "unknown object state field";
                            self.setErrorAt(field_start, msg);
                            self.advance_token();
                            self.advance_token();
                            self.advance_token();
                        }
                    } else if (self.isState(ident)) |slot_id| {
                        self.advance_token();
                        is_dynamic_text = true;
                        const st = self.stateTypeById(slot_id);
                        const rid = self.regularSlotId(slot_id);
                        text_dep_slots[0] = rid;
                        text_dep_count = 1;
                        dyn_fmt = switch (st) {
                            .string => "{s}",
                            .float => "{d}",
                            .boolean => "{s}",
                            else => "{d}",
                        };
                        dyn_args = switch (st) {
                            .string => try std.fmt.allocPrint(self.alloc, "state.getSlotString({d})", .{rid}),
                            .float => try std.fmt.allocPrint(self.alloc, "state.getSlotFloat({d})", .{rid}),
                            .boolean => try std.fmt.allocPrint(self.alloc, "if (state.getSlotBool({d})) \"true\" else \"false\"", .{rid}),
                            else => try std.fmt.allocPrint(self.alloc, "state.getSlot({d})", .{rid}),
                        };
                    } else if (self.isLocalVar(ident)) |lv| {
                        self.advance_token();
                        is_dynamic_text = true;
                        dyn_fmt = switch (lv.state_type) {
                            .string => "{s}",
                            .float => "{d}",
                            .boolean => "{s}",
                            else => "{d}",
                        };
                        dyn_args = lv.expr;
                    } else {
                        self.advance_token();
                    }
                }
                if (self.curKind() == .rbrace) self.advance_token();
            } else if (self.curKind() != .lt and self.curKind() != .lt_slash and self.curKind() != .eof) {
                const raw = attrs.collectTextContent(self);
                if (raw.len > 0) {
                    if (inline_glyph_exprs.items.len > 0) {
                        try text_builder.appendSlice(self.alloc, raw);
                    } else {
                        text_content = raw;
                    }
                }
            } else {
                self.advance_token();
            }
        }

        // Skip closing tag (handles </Tag>, </Canvas.Node>, </3D.Mesh>)
        if (self.curKind() == .lt_slash) {
            self.advance_token();
            // </3D.Mesh> — number + identifier + dot + identifier
            if (self.curKind() == .number) {
                self.advance_token(); // skip "3"
                if (self.curKind() == .identifier) self.advance_token(); // skip "D"
            } else if (self.curKind() == .identifier) {
                self.advance_token();
            }
            if (self.curKind() == .dot) {
                self.advance_token();
                if (self.curKind() == .identifier) self.advance_token();
            }
            if (self.curKind() == .gt or self.curKind() == .gt_eq) self.advance_token();
        }
    }

    // ── Phase 3: Build the Zig node struct literal ──
    // Assembles all collected data into ".{ .style = ..., .text = ..., .children = &_arr_N }"
    var fields: std.ArrayListUnmanaged(u8) = .{};

    // Style — ScrollView injects overflow: auto automatically
    if (style_str.len > 0 or is_scroll_view) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".style = .{ ");
        if (is_scroll_view) {
            try fields.appendSlice(self.alloc, ".overflow = .auto");
            if (style_str.len > 0) try fields.appendSlice(self.alloc, ", ");
        }
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
    } else if (inline_glyph_exprs.items.len > 0) {
        // Text with inline glyphs — merge text_content + text_builder (contains \x01 sentinels)
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".text = \"");
        if (text_content) |tc| try jsx_elements.emitEscapedText(&fields, self.alloc, tc);
        try jsx_elements.emitEscapedText(&fields, self.alloc, text_builder.items);
        try fields.appendSlice(self.alloc, "\"");
        try fields.appendSlice(self.alloc, ", .inline_glyphs = &[_]layout.InlineGlyph{ ");
        for (inline_glyph_exprs.items, 0..) |gexpr, gi| {
            if (gi > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, gexpr);
        }
        try fields.appendSlice(self.alloc, " }");
    } else if (text_content) |tc| {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        if (is_prop_text_ref) {
            try fields.appendSlice(self.alloc, ".text = ");
            try fields.appendSlice(self.alloc, tc);
        } else {
            try fields.appendSlice(self.alloc, ".text = \"");
            try jsx_elements.emitEscapedText(&fields, self.alloc, tc);
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

    // Text effect (per-glyph coloring from named effect)
    if (text_effect_str.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".text_effect = \"");
        try fields.appendSlice(self.alloc, text_effect_str);
        try fields.appendSlice(self.alloc, "\"");
    }

    // Image / Video / Render / Cartridge src
    if (src_str.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        if (is_render) {
            // Render sources are URIs (screen:0, vm:path, vnc:host:port) — pass raw, no path resolution
            try fields.appendSlice(self.alloc, ".render_src = \"");
            try fields.appendSlice(self.alloc, src_str);
        } else if (is_cartridge) {
            // Cartridge sources are .so paths — resolve relative to the .tsz file
            try fields.appendSlice(self.alloc, ".cartridge_src = \"");
            if (std.fs.path.dirname(self.input_file)) |dir| {
                try fields.appendSlice(self.alloc, try std.fs.path.resolve(self.alloc, &.{ dir, src_str }));
            } else {
                try fields.appendSlice(self.alloc, src_str);
            }
        } else {
            try fields.appendSlice(self.alloc, if (is_video) ".video_src = \"" else ".image_src = \"");
            if (std.fs.path.dirname(self.input_file)) |dir| {
                try fields.appendSlice(self.alloc, try std.fs.path.resolve(self.alloc, &.{ dir, src_str }));
            } else {
                try fields.appendSlice(self.alloc, src_str);
            }
        }
        try fields.appendSlice(self.alloc, "\"");
    }

    // Effect type
    if (is_effect) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".effect_type = \"");
        try fields.appendSlice(self.alloc, tag_name);
        try fields.appendSlice(self.alloc, "\"");
    }

    // 3D element fields (delegated to jsx_elements.zig)
    try jsx_elements.emit3DFields(self, &fields, .{
        .is_scene3d = is_scene3d,
        .is_3d = is_3d,
        .is_3d_mesh = is_3d_mesh,
        .is_3d_camera = is_3d_camera,
        .is_3d_light = is_3d_light,
        .is_3d_group = is_3d_group,
        .geometry = s3d_geometry,
        .light_type = s3d_light_type,
        .color = s3d_color,
        .pos = s3d_pos,
        .rot = s3d_rot,
        .lookat = s3d_lookat,
        .dir = s3d_dir,
        .size = s3d_size,
        .scale = s3d_scale,
        .fov = s3d_fov,
        .intensity = s3d_intensity,
        .radius = s3d_radius,
        .tube_radius = s3d_tube_radius,
        .show_grid = s3d_show_grid,
        .show_axes = s3d_show_axes,
    });

    // Register dynamic 3D vector props as dyn_styles so _updateDynamicTexts updates them at runtime
    if (is_3d) {
        const dyn3d_vecs = [_]struct { vals: [3][]const u8, flds: [3][]const u8 }{
            .{ .vals = s3d_pos, .flds = .{ "scene3d_pos_x", "scene3d_pos_y", "scene3d_pos_z" } },
            .{ .vals = s3d_lookat, .flds = .{ "scene3d_look_x", "scene3d_look_y", "scene3d_look_z" } },
            .{ .vals = s3d_rot, .flds = .{ "scene3d_rot_x", "scene3d_rot_y", "scene3d_rot_z" } },
        };
        for (dyn3d_vecs) |vec| {
            for (vec.vals, vec.flds) |val, fld| {
                if (std.mem.startsWith(u8, val, "state.get") and self.dyn_style_count < MAX_DYN_STYLES) {
                    self.dyn_styles[self.dyn_style_count] = .{
                        .field = fld,
                        .expression = val,
                        .arr_name = "",
                        .arr_index = 0,
                        .has_ref = false,
                    };
                    self.dyn_style_count += 1;
                }
            }
        }
    }

    // Terminal element fields
    if (is_terminal) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".terminal = true");
        if (terminal_font_size.len > 0) {
            try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ", .terminal_font_size = {s}", .{terminal_font_size}));
        }
    }

    // Physics element fields (delegated to jsx_elements.zig)
    if (is_physics) try jsx_elements.emitPhysicsFields(self, &fields, phys_props);

    // onRender callback (Effect element)
    if (on_render_start) |start| {
        const render_name = try std.fmt.allocPrint(self.alloc, "_effect_render_{d}", .{self.handler_counter});
        self.handler_counter += 1;
        const body = try handlers.emitEffectRenderBody(self, start);
        const render_fn = try std.fmt.allocPrint(self.alloc, "fn {s}(ctx: *effect_ctx.EffectContext) void {{\n{s}}}", .{ render_name, body });
        try self.handler_decls.append(self.alloc, render_fn);
        if (try effect_shadergen.tryGenerate(self, start)) |shader| {
            const shader_name = try std.fmt.allocPrint(self.alloc, "_effect_shader_{d}", .{self.handler_counter});
            self.handler_counter += 1;
            const shader_decl = try std.fmt.allocPrint(self.alloc, "const {s} = effect_shader.GpuShaderDesc{{ .wgsl = \"{f}\" }};\n", .{ shader_name, std.zig.fmtString(shader.wgsl) });
            try self.effect_shader_decls.append(self.alloc, shader_decl);
            self.has_effect_shader = true;
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".effect_shader = ");
            try fields.appendSlice(self.alloc, shader_name);
        }
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".effect_render = ");
        try fields.appendSlice(self.alloc, render_name);
        self.has_effect_render = true;
        if (effect_is_background) {
            try fields.appendSlice(self.alloc, ", .effect_background = true");
        }
        if (effect_is_mask) {
            try fields.appendSlice(self.alloc, ", .effect_mask = true");
        }
        if (effect_name_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .effect_name = \"");
            try fields.appendSlice(self.alloc, effect_name_str);
            try fields.appendSlice(self.alloc, "\"");
        }
    }

    // onPress handler
    var press_handler_name: []const u8 = "";
    if (on_press_start) |start| {
        press_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_press_{d}", .{self.handler_counter});
        self.handler_counter += 1;
        const body = try handlers.emitHandlerBody(self, start);
        if (body.len == 0) {
            self.addWarning(self.lex.get(start).start, "onPress handler body produced no statements — onClick will do nothing at runtime");
        }
        const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n{s}}}", .{ press_handler_name, body });
        try self.handler_decls.append(self.alloc, handler_fn);
    }

    // onRightClick handler
    var right_click_handler_name: []const u8 = "";
    if (on_right_click_start) |start| {
        right_click_handler_name = try std.fmt.allocPrint(self.alloc, "_handler_rightclick_{d}", .{self.handler_counter});
        self.handler_counter += 1;
        const body = try handlers.emitHandlerBody(self, start);
        const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}(_: f32, _: f32) void {{\n{s}}}", .{ right_click_handler_name, body });
        try self.handler_decls.append(self.alloc, handler_fn);
    }

    // Emit combined handlers struct (onPress + onRightClick)
    if (press_handler_name.len > 0 or right_click_handler_name.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".handlers = .{ ");
        var handler_need_comma = false;
        if (press_handler_name.len > 0) {
            try fields.appendSlice(self.alloc, ".on_press = ");
            try fields.appendSlice(self.alloc, press_handler_name);
            handler_need_comma = true;
        }
        if (right_click_handler_name.len > 0) {
            if (handler_need_comma) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".on_right_click = ");
            try fields.appendSlice(self.alloc, right_click_handler_name);
        }
        try fields.appendSlice(self.alloc, " }");
    }

    // Tooltip
    if (tooltip_str.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".tooltip = \"");
        for (tooltip_str) |ch| {
            if (ch == '"') try fields.appendSlice(self.alloc, "\\\"") else if (ch == '\\') try fields.appendSlice(self.alloc, "\\\\") else try fields.append(self.alloc, ch);
        }
        try fields.appendSlice(self.alloc, "\"");
    }

    // Href (clickable hyperlink)
    if (href_str.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".href = \"");
        for (href_str) |ch| {
            if (ch == '"') try fields.appendSlice(self.alloc, "\\\"") else if (ch == '\\') try fields.appendSlice(self.alloc, "\\\\") else try fields.append(self.alloc, ch);
        }
        try fields.appendSlice(self.alloc, "\"");
    }

    // Graph container (SVG paths, no pan/zoom)
    if (is_graph and !is_canvas_node and !is_canvas_path) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".graph_container = true");
        const has_view = canvas_view_x_str.len > 0 or canvas_view_y_str.len > 0 or canvas_view_zoom_str.len > 0;
        if (has_view) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".canvas_view_set = true");
        }
        if (canvas_view_x_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_view_x = ");
            try fields.appendSlice(self.alloc, canvas_view_x_str);
        }
        if (canvas_view_y_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_view_y = ");
            try fields.appendSlice(self.alloc, canvas_view_y_str);
        }
        if (canvas_view_zoom_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_view_zoom = ");
            try fields.appendSlice(self.alloc, canvas_view_zoom_str);
        }
    }

    // Canvas type + view
    if (is_canvas and !is_canvas_node and !is_canvas_path and !is_canvas_clamp) {
        // Always emit canvas_type — defaults to "canvas" if no type prop
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        if (canvas_type_str.len > 0) {
            try fields.appendSlice(self.alloc, ".canvas_type = \"");
            try fields.appendSlice(self.alloc, canvas_type_str);
            try fields.appendSlice(self.alloc, "\"");
        } else {
            try fields.appendSlice(self.alloc, ".canvas_type = \"canvas\"");
        }
        const has_view = canvas_view_x_str.len > 0 or canvas_view_y_str.len > 0 or canvas_view_zoom_str.len > 0;
        if (has_view) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".canvas_view_set = true");
        }
        if (canvas_view_x_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_view_x = ");
            try fields.appendSlice(self.alloc, canvas_view_x_str);
        }
        if (canvas_view_y_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_view_y = ");
            try fields.appendSlice(self.alloc, canvas_view_y_str);
        }
        if (canvas_view_zoom_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_view_zoom = ");
            try fields.appendSlice(self.alloc, canvas_view_zoom_str);
        }
        // Drift — continuous viewport animation
        const has_drift = canvas_drift_x_str.len > 0 or canvas_drift_y_str.len > 0;
        if (has_drift) {
            try fields.appendSlice(self.alloc, ", .canvas_drift_active = true");
            if (canvas_drift_x_str.len > 0) {
                try fields.appendSlice(self.alloc, ", .canvas_drift_x = ");
                try fields.appendSlice(self.alloc, canvas_drift_x_str);
            }
            if (canvas_drift_y_str.len > 0) {
                try fields.appendSlice(self.alloc, ", .canvas_drift_y = ");
                try fields.appendSlice(self.alloc, canvas_drift_y_str);
            }
        }
    }

    // Canvas.Node
    if (is_canvas_node) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".canvas_node = true");
        if (canvas_gx_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_gx = ");
            try fields.appendSlice(self.alloc, canvas_gx_str);
        }
        if (canvas_gy_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_gy = ");
            try fields.appendSlice(self.alloc, canvas_gy_str);
        }
        if (canvas_gw_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_gw = ");
            try fields.appendSlice(self.alloc, canvas_gw_str);
        }
        if (canvas_gh_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_gh = ");
            try fields.appendSlice(self.alloc, canvas_gh_str);
        }
    }

    // Canvas.Path
    if (is_canvas_path) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".canvas_path = true");
        if (canvas_path_d.len > 0) {
            if (canvasPathNeedsDynBinding(canvas_path_d, canvas_path_d_is_expr)) {
                try fields.appendSlice(self.alloc, ", .canvas_path_d = \"0\"");
                if (self.dyn_style_count < MAX_DYN_STYLES) {
                    self.dyn_styles[self.dyn_style_count] = .{
                        .field = "canvas_path_d",
                        .expression = canvas_path_d,
                        .arr_name = "",
                        .arr_index = 0,
                        .has_ref = false,
                    };
                    self.dyn_style_count += 1;
                }
            } else {
                try fields.appendSlice(self.alloc, ", .canvas_path_d = ");
                try fields.appendSlice(self.alloc, try resolveCanvasStringValue(self, canvas_path_d, canvas_path_d_is_expr));
            }
        }
        if (canvas_stroke_w_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_stroke_width = ");
            try fields.appendSlice(self.alloc, canvas_stroke_w_str);
        }
        // Stroke color → text_color field (reuse existing color field)
        if (canvas_stroke_str.len > 0) {
            const color = try resolveCanvasColorValue(self, canvas_stroke_str, canvas_stroke_is_expr);
            try fields.appendSlice(self.alloc, ", .text_color = ");
            try fields.appendSlice(self.alloc, color);
        }
        // Fill color → canvas_fill_color field
        if (canvas_fill_str.len > 0) {
            const fill_color = try resolveCanvasColorValue(self, canvas_fill_str, canvas_fill_is_expr);
            try fields.appendSlice(self.alloc, ", .canvas_fill_color = ");
            try fields.appendSlice(self.alloc, fill_color);
        }
        // Fill effect → canvas_fill_effect (reference to named effect texture)
        if (canvas_fill_effect_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .canvas_fill_effect = ");
            try fields.appendSlice(self.alloc, try resolveCanvasStringValue(self, canvas_fill_effect_str, canvas_fill_effect_is_expr));
        }
        if (canvas_flow_speed_str.len > 0) {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".canvas_flow_speed = ");
            try fields.appendSlice(self.alloc, canvas_flow_speed_str);
        }
    }

    // Canvas.Clamp
    if (is_canvas_clamp) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".canvas_clamp = true");
    }

    // Hoverable
    if (hoverable or tooltip_str.len > 0) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".hoverable = true");
    }

    // onChangeText handler (TextInput)
    var change_handler_name: []const u8 = "";
    if (on_change_text_start) |start| {
        const handler_name = try std.fmt.allocPrint(self.alloc, "_handler_change_{d}", .{self.handler_counter});
        change_handler_name = handler_name;
        self.handler_counter += 1;
        const body = try handlers.emitHandlerBody(self, start);
        const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n{s}}}", .{ handler_name, body });
        try self.handler_decls.append(self.alloc, handler_fn);
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".handlers = .{ .on_change_text = ");
        try fields.appendSlice(self.alloc, handler_name);
        try fields.appendSlice(self.alloc, " }");
    }

    // onSubmit handler (TextInput — fires on Enter key)
    var submit_handler_name: []const u8 = "";
    if (on_submit_start) |start| {
        const handler_name = try std.fmt.allocPrint(self.alloc, "_handler_submit_{d}", .{self.handler_counter});
        submit_handler_name = handler_name;
        self.handler_counter += 1;
        const body = try handlers.emitHandlerBody(self, start);
        const handler_fn = try std.fmt.allocPrint(self.alloc, "fn {s}() void {{\n{s}}}", .{ handler_name, body });
        try self.handler_decls.append(self.alloc, handler_fn);
        // If on_change_text already set handlers, merge with it
        if (on_change_text_start != null) {
            // handlers already has .on_change_text — add .on_submit via separate field
            // (we'll register via setOnSubmit in _initState instead)
        } else {
            if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
            try fields.appendSlice(self.alloc, ".handlers = .{ .on_submit = ");
            try fields.appendSlice(self.alloc, handler_name);
            try fields.appendSlice(self.alloc, " }");
        }
    }

    // TextInput/TextArea: assign compile-time input_id and emit placeholder
    if (is_text_input) {
        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        const iid = self.input_counter;
        try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ".input_id = {d}", .{iid}));
        if (iid < 16) {
            self.input_multiline[iid] = is_multiline;
            self.input_change_handler[iid] = change_handler_name;
            self.input_submit_handler[iid] = submit_handler_name;
        }
        self.input_counter += 1;
        if (placeholder_str.len > 0) {
            try fields.appendSlice(self.alloc, ", .placeholder = \"");
            for (placeholder_str) |ch| {
                if (ch == '"') try fields.appendSlice(self.alloc, "\\\"") else if (ch == '\\') try fields.appendSlice(self.alloc, "\\\\") else try fields.append(self.alloc, ch);
            }
            try fields.appendSlice(self.alloc, "\"");
        }
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
        try arr_content.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, "// tsz:{s}:{d} — <{s}>\n", .{ std.fs.path.basename(self.input_file), tag_loc.line, tag_name }));
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

        // Bind routes — fill in arr_name for routes registered during children parsing
        if (self.routes_bind_from) |from| {
            for (from..self.route_count) |ri| {
                if (self.routes[ri].arr_name.len == 0) {
                    self.routes[ri].arr_name = arr_name;
                }
            }
            self.routes_bind_from = null;
        }

        // Bind conditionals
        for (cond_base..self.conditional_count) |ci| {
            if (self.conditionals[ci].arr_name.len == 0) {
                self.conditionals[ci].arr_name = arr_name;
            }
        }

        // Bind maps to this array
        for (0..self.map_count) |mi| {
            if (self.maps[mi].parent_arr_name.len == 0) {
                if (self.maps[mi].child_idx < child_exprs.items.len) {
                    self.maps[mi].parent_arr_name = arr_name;
                }
            }
        }

        if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
        try fields.appendSlice(self.alloc, ".children = &");
        try fields.appendSlice(self.alloc, arr_name);

        // Bind dynamic texts — only consider dyn_texts created within this element's scope
        // (prevents component inlining from cross-binding outer scope texts to inner arrays)
        var claimed: [64]bool = [_]bool{false} ** 64;
        for (dyn_bind_start..self.dyn_count) |di| {
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
        // Track claimed (arr_name, field, ci) tuples so two siblings with the same
        // placeholder field (e.g. both Pressables with background_color = Color{})
        // bind to distinct child indices instead of both landing on ci=0.
        const MAX_STYLE_CLAIMED = 128;
        var style_claimed_arr: [MAX_STYLE_CLAIMED][3][]const u8 = undefined;
        var style_claimed_count: usize = 0;
        for (0..self.dyn_style_count) |dsi| {
            if (!self.dyn_styles[dsi].has_ref) {
                // Build the placeholder pattern for this field
                const field = self.dyn_styles[dsi].field;
                const placeholder = if (std.mem.eql(u8, field, "text_color"))
                    ".text_color = Color.rgb(0, 0, 0)"
                else if (std.mem.eql(u8, field, "canvas_path_d"))
                    ".canvas_path_d = \"0\""
                else if (std.mem.eql(u8, field, "canvas_flow_speed"))
                    ".canvas_flow_speed = 0"
                else if (std.mem.eql(u8, field, "background_color") or
                    std.mem.eql(u8, field, "border_color") or
                    std.mem.eql(u8, field, "shadow_color") or
                    std.mem.eql(u8, field, "gradient_color_end"))
                    // Color fields are initialized as Color{} (not 0)
                    std.fmt.allocPrint(self.alloc, ".{s} = Color{{}}", .{field}) catch ""
                else
                    // Generic numeric style field (width, height, padding, etc.)
                    std.fmt.allocPrint(self.alloc, ".{s} = 0", .{field}) catch "";
                if (placeholder.len > 0) {
                    for (child_exprs.items, 0..) |expr, ci| {
                        if (std.mem.indexOf(u8, expr, placeholder) != null) {
                            // Check if this (arr_name, field, ci) was already claimed
                            const ci_str = std.fmt.allocPrint(self.alloc, "{d}", .{ci}) catch "";
                            var already_claimed = false;
                            for (0..style_claimed_count) |sci| {
                                if (std.mem.eql(u8, style_claimed_arr[sci][0], arr_name) and
                                    std.mem.eql(u8, style_claimed_arr[sci][1], field) and
                                    std.mem.eql(u8, style_claimed_arr[sci][2], ci_str))
                                {
                                    already_claimed = true;
                                    break;
                                }
                            }
                            if (already_claimed) continue;
                            self.dyn_styles[dsi].arr_name = arr_name;
                            self.dyn_styles[dsi].arr_index = @intCast(ci);
                            self.dyn_styles[dsi].has_ref = true;
                            if (style_claimed_count < MAX_STYLE_CLAIMED) {
                                style_claimed_arr[style_claimed_count] = .{ arr_name, field, ci_str };
                                style_claimed_count += 1;
                            }
                            break;
                        }
                    }
                }
            }
        }

        // Bind variant updates
        for (0..self.variant_update_count) |vi| {
            if (self.variant_updates[vi].arr_name.len == 0) {
                const marker = std.fmt.allocPrint(self.alloc, "\"__v{d}\"", .{vi}) catch continue;
                for (child_exprs.items, 0..) |expr, ci| {
                    if (std.mem.indexOf(u8, expr, marker) != null) {
                        self.variant_updates[vi].arr_name = arr_name;
                        self.variant_updates[vi].arr_index = @intCast(ci);
                        break;
                    }
                }
            }
        }
    }

    // Register variant update for variant/breakpoint classifiers
    if (classifier_idx) |idx| {
        if (self.classifier_has_variants[idx] or self.classifier_bp_idx[idx] != null) {
            const vu_idx = self.variant_update_count;
            if (vu_idx < MAX_DYN_STYLES) {
                self.variant_updates[vu_idx] = .{
                    .arr_name = "",
                    .arr_index = 0,
                    .classifier_idx = idx,
                };
                self.variant_update_count += 1;
                // Embed marker so binding phase can find this node
                if (fields.items.len > 0) try fields.appendSlice(self.alloc, ", ");
                try fields.appendSlice(self.alloc, try std.fmt.allocPrint(self.alloc, ".debug_name = \"__v{d}\"", .{vu_idx}));
            }
        }
    }

    return try std.fmt.allocPrint(self.alloc, ".{{ {s} }}", .{fields.items});
}
fn resolveCanvasStringValue(self: *Generator, value: []const u8, is_expr: bool) ![]const u8 {
    if (!is_expr) return try std.fmt.allocPrint(self.alloc, "\"{f}\"", .{std.zig.fmtString(value)});
    if (std.mem.startsWith(u8, value, "_p_")) return value;
    if (std.mem.startsWith(u8, value, "_oa") and std.mem.endsWith(u8, value, "[_i]")) {
        const base = value[0 .. value.len - 4];
        return try std.fmt.allocPrint(self.alloc, "{s}[_i][0..{s}_lens[_i]]", .{ base, base });
    }
    return value;
}

fn canvasPathNeedsDynBinding(value: []const u8, is_expr: bool) bool {
    return is_expr and std.mem.indexOf(u8, value, "state.getSlot") != null;
}

fn resolveCanvasColorValue(self: *Generator, value: []const u8, is_expr: bool) ![]const u8 {
    if (!is_expr) return attrs.parseColorValue(self, value);
    if (std.mem.startsWith(u8, value, "_p_")) return value;
    if (std.mem.startsWith(u8, value, "_oa") and std.mem.endsWith(u8, value, "[_i]")) {
        const base = value[0 .. value.len - 4];
        return try std.fmt.allocPrint(self.alloc, "Color.fromHex({s}[_i][0..{s}_lens[_i]])", .{ base, base });
    }
    return value;
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

    while (self.curKind() != .gt and self.curKind() != .gt_eq and self.curKind() != .slash_gt and self.curKind() != .eof) {
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
