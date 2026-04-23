//! ──── GENERATED-LINEAGE FILE — NOT FULLY REGENERATED ────
//!
//! Original generated-era source:
//!   archive/tsz-gen/runtime/tsz/layout.mod.tsz
//!
//! Current authored intent source:
//!   tsz/framework/layout.mod.tsz
//!
//! This Zig file still contains the generated-era body plus later handwritten
//! updates. It does not round-trip from the current intent source yet.

const std = @import("std");

inline fn asF32(val: anytype) f32 {
    return switch (@typeInfo(@TypeOf(val))) {
        .int, .comptime_int => @floatFromInt(val),
        .comptime_float => val,
        .float => if (@TypeOf(val) == f32) val else @floatCast(val),
        .optional => blk: {
            const v = val orelse 0;
            break :blk switch (@typeInfo(@TypeOf(v))) {
                .int, .comptime_int => @as(f32, @floatFromInt(v)),
                .comptime_float => @as(f32, v),
                .float => if (@TypeOf(v) == f32) v else @floatCast(v),
                else => @compileError("asF32: unsupported optional inner type"),
            };
        },
        else => @compileError("asF32: unsupported type"),
    };
}

// ── Imports ────────────────────────────────────────
const log = @import("log.zig");
const events = @import("events.zig");
const EventHandler = events.EventHandler;
const effect_ctx = @import("effect_ctx.zig");
const effect_shader = @import("effect_shader.zig");
const context_menu = @import("context_menu.zig");

// ── Type definitions ────────────────────────────────
pub const FlexDirection = enum { row, column, row_reverse, column_reverse };
pub const JustifyContent = enum { start, center, end, space_between, space_around, space_evenly };
pub const AlignItems = enum { start, center, end, stretch, baseline };
pub const AlignSelf = enum { auto, start, center, end, stretch, baseline };
pub const AlignContent = enum { start, center, end, stretch, space_between, space_around, space_evenly };
pub const FlexWrap = enum { no_wrap, wrap, wrap_reverse };
pub const Position = enum { relative, absolute };
pub const Display = enum { flex, none };
pub const ScrollbarSide = enum(u8) { auto, left, right, top, bottom };
pub const Overflow = enum { visible, hidden, scroll, auto };
pub const TextAlign = enum { left, center, right, justify };
pub const CodeLanguage = enum { none, zig, type_script, json, bash, markdown, plain };
pub const GradientDirection = enum { none, vertical, horizontal };
pub const DevtoolsViz = enum { none, sparkline, wireframe, node_tree, inspector_overlay };
pub const Color = struct {
    r: u8 = 0,
    g: u8 = 0,
    b: u8 = 0,
    a: u8 = 0,

    pub fn rgb(r: u8, g: u8, b: u8) Color {
        return .{ .r = r, .g = g, .b = b, .a = 255 };
    }
    pub fn rgba(r: u8, g: u8, b: u8, a: u8) Color {
        return .{ .r = r, .g = g, .b = b, .a = a };
    }

    /// Parse a "#RRGGBB" hex string at runtime. Returns transparent black on bad input.
    pub fn fromHex(hex: []const u8) Color {
        if (hex.len < 7 or hex[0] != '#') return .{};
        return .{
            .r = parseHexByte(hex[1], hex[2]),
            .g = parseHexByte(hex[3], hex[4]),
            .b = parseHexByte(hex[5], hex[6]),
            .a = 255,
        };
    }

    fn parseHexByte(hi: u8, lo: u8) u8 {
        return (@as(u8, hexNibble(hi)) << 4) | @as(u8, hexNibble(lo));
    }

    fn hexNibble(c: u8) u4 {
        if (c >= '0' and c <= '9') return @intCast(c - '0');
        if (c >= 'a' and c <= 'f') return @intCast(c - 'a' + 10);
        if (c >= 'A' and c <= 'F') return @intCast(c - 'A' + 10);
        return 0;
    }
};
/// Linear gradient stop — a color at a normalized offset along the gradient line.
pub const GradientStop = struct {
    offset: f32 = 0, // 0.0..1.0
    color: Color = .{},
};

/// Linear gradient spec — two endpoints in the path's coordinate space plus a
/// list of color stops. Stored on the node style via `canvas_fill_gradient`.
/// Slice lifetime matches other `?[]const u8` style fields (c_allocator duped
/// at CREATE/UPDATE time, leaked on replace — same pattern as canvas_path_d).
pub const LinearGradient = struct {
    x1: f32 = 0,
    y1: f32 = 0,
    x2: f32 = 0,
    y2: f32 = 0,
    stops: []const GradientStop = &.{},
};

pub const TextMetrics = struct {
    width: f32 = 0,
    height: f32 = 0,
    ascent: f32 = 0,
};

/// Descriptor for an inline glyph (polygon/3D embedded in text).
pub const InlineGlyph = struct {
    d: []const u8, // SVG path data
    fill: Color = Color.rgb(255, 255, 255),
    fill_effect: ?[]const u8 = null, // named effect for textured fill
    stroke: Color = Color.rgba(0, 0, 0, 0),
    stroke_width: f32 = 0,
    scale: f32 = 1.0, // multiplier on fontSize
};

/// Computed position for an inline glyph slot within rendered text.
pub const InlineSlot = struct {
    x: f32 = 0,
    y: f32 = 0,
    size: f32 = 0, // slot width/height (square)
    glyph_index: u8 = 0,
};

pub const ColorTextSpan = struct {
    text: []const u8 = "",
    color: Color = Color.rgb(255, 255, 255),
};

pub const ColorTextRow = struct {
    spans: []const ColorTextSpan = &.{},
};

// tslx:GEN:ROW_TYPES START
pub const GutterRow = struct {
    line: u32 = 0,
    marker: ?Color = null,
};

pub const MinimapRow = struct {
    width: f32 = 0,
    marker: ?Color = null,
    active: bool = false,
};
// tslx:GEN:ROW_TYPES END

pub const MAX_INLINE_SLOTS = 8;
pub const ImageDims = struct {
    width: f32 = 0,
    height: f32 = 0,
};
pub const LayoutRect = struct {
    x: f32 = 0,
    y: f32 = 0,
    w: f32 = 0,
    h: f32 = 0,
};
pub const Style = struct {
    width: ?f32 = null,
    height: ?f32 = null,
    min_width: ?f32 = null,
    max_width: ?f32 = null,
    min_height: ?f32 = null,
    max_height: ?f32 = null,
    flex_direction: FlexDirection = .column,
    flex_grow: f32 = 0,
    flex_shrink: ?f32 = null,
    flex_basis: ?f32 = null,
    flex_wrap: FlexWrap = .no_wrap,
    justify_content: JustifyContent = .start,
    align_items: AlignItems = .stretch,
    align_content: AlignContent = .stretch,
    align_self: AlignSelf = .auto,
    gap: f32 = 0,
    row_gap: ?f32 = null,
    column_gap: ?f32 = null,
    order: i32 = 0,
    position: Position = .relative,
    top: ?f32 = null,
    left: ?f32 = null,
    right: ?f32 = null,
    bottom: ?f32 = null,
    aspect_ratio: ?f32 = null,
    padding: f32 = 0,
    padding_left: ?f32 = null,
    padding_right: ?f32 = null,
    padding_top: ?f32 = null,
    padding_bottom: ?f32 = null,
    margin: f32 = 0,
    margin_left: ?f32 = null,
    margin_right: ?f32 = null,
    margin_top: ?f32 = null,
    margin_bottom: ?f32 = null,
    display: Display = .flex,
    overflow: Overflow = .visible,
    text_align: TextAlign = .left,
    background_color: ?Color = null,
    border_radius: f32 = 0,
    border_top_left_radius: ?f32 = null,
    border_top_right_radius: ?f32 = null,
    border_bottom_right_radius: ?f32 = null,
    border_bottom_left_radius: ?f32 = null,
    opacity: f32 = 1.0,
    rotation: f32 = 0,
    scale_x: f32 = 1.0,
    scale_y: f32 = 1.0,
    border_width: f32 = 0,
    border_top_width: ?f32 = null,
    border_right_width: ?f32 = null,
    border_bottom_width: ?f32 = null,
    border_left_width: ?f32 = null,
    border_color: ?Color = null,
    // Animated / dashed border. Any non-default value here switches the
    // border paint from the rect-shader's baked edge to an SDF-stroked
    // rounded-rectangle perimeter (see framework/border_dash.zig).
    //   border_dash_on  — dash length in px (0 = solid).
    //   border_dash_off — gap length in px (0 = no gaps; flow_speed still animates).
    //   border_flow_speed — marching speed in px/second (positive = CW).
    border_dash_on: f32 = 0,
    border_dash_off: f32 = 0,
    border_flow_speed: f32 = 0,
    // Width of the animated dashed stroke. 0 = fall back to border_width,
    // then to 1.5 px. Lets a cart suppress the baked border (border_width=0)
    // while still drawing thick animated dashes at an explicit width.
    border_dash_width: f32 = 0,
    z_index: i16 = 0,
    gradient_color_end: ?Color = null,
    gradient_direction: GradientDirection = .none,
    shadow_offset_x: f32 = 0,
    shadow_offset_y: f32 = 0,
    shadow_blur: f32 = 0,
    shadow_color: ?Color = null,
    shadow_method: u8 = 0, // 0 = sdf (default), 1 = rect (multi-rect)

    pub fn padLeft(self: Style) f32 {
        return self.padding_left orelse self.padding;
    }
    pub fn padRight(self: Style) f32 {
        return self.padding_right orelse self.padding;
    }
    pub fn padTop(self: Style) f32 {
        return self.padding_top orelse self.padding;
    }
    pub fn padBottom(self: Style) f32 {
        return self.padding_bottom orelse self.padding;
    }
    pub fn brdTop(self: Style) f32 {
        return self.border_top_width orelse self.border_width;
    }
    pub fn brdRight(self: Style) f32 {
        return self.border_right_width orelse self.border_width;
    }
    pub fn brdBottom(self: Style) f32 {
        return self.border_bottom_width orelse self.border_width;
    }
    pub fn brdLeft(self: Style) f32 {
        return self.border_left_width orelse self.border_width;
    }
    pub fn marLeft(self: Style) f32 {
        const v = self.margin_left orelse self.margin;
        return if (std.math.isInf(v)) 0 else v;
    }
    pub fn marRight(self: Style) f32 {
        const v = self.margin_right orelse self.margin;
        return if (std.math.isInf(v)) 0 else v;
    }
    pub fn marTop(self: Style) f32 {
        const v = self.margin_top orelse self.margin;
        return if (std.math.isInf(v)) 0 else v;
    }
    pub fn marBottom(self: Style) f32 {
        const v = self.margin_bottom orelse self.margin;
        return if (std.math.isInf(v)) 0 else v;
    }
    pub fn isMarginAutoLeft(self: Style) bool {
        return if (self.margin_left) |v| std.math.isInf(v) else false;
    }
    pub fn isMarginAutoRight(self: Style) bool {
        return if (self.margin_right) |v| std.math.isInf(v) else false;
    }
    pub fn isMarginAutoTop(self: Style) bool {
        return if (self.margin_top) |v| std.math.isInf(v) else false;
    }
    pub fn isMarginAutoBottom(self: Style) bool {
        return if (self.margin_bottom) |v| std.math.isInf(v) else false;
    }
    pub fn radiusTL(self: Style) f32 {
        return self.border_top_left_radius orelse self.border_radius;
    }
    pub fn radiusTR(self: Style) f32 {
        return self.border_top_right_radius orelse self.border_radius;
    }
    pub fn radiusBR(self: Style) f32 {
        return self.border_bottom_right_radius orelse self.border_radius;
    }
    pub fn radiusBL(self: Style) f32 {
        return self.border_bottom_left_radius orelse self.border_radius;
    }
    pub fn mainGap(self: Style) f32 {
        const isRow = self.flex_direction == .row or self.flex_direction == .row_reverse;
        return if (isRow) (self.column_gap orelse self.gap) else (self.row_gap orelse self.gap);
    }
    pub fn crossGap(self: Style) f32 {
        const isRow = self.flex_direction == .row or self.flex_direction == .row_reverse;
        return if (isRow) (self.row_gap orelse self.gap) else (self.column_gap orelse self.gap);
    }
};
pub const Node = struct {
    style: Style = .{},
    children: []Node = &.{},
    computed: LayoutRect = .{},
    text: ?[]const u8 = null,
    font_size: u16 = 16,
    text_color: ?Color = null,
    letter_spacing: f32 = 0,
    line_height: f32 = 0,
    number_of_lines: u16 = 0,
    no_wrap: bool = false,
    code_language: CodeLanguage = .none,
    image_src: ?[]const u8 = null,
    video_src: ?[]const u8 = null,
    render_src: ?[]const u8 = null,
    cartridge_src: ?[]const u8 = null,
    effect_type: ?[]const u8 = null,
    input_id: ?u8 = null,
    input_paint_text: bool = true,
    input_color_rows: ?[]const ColorTextRow = null,
    // tslx:GEN:NODE_FIELDS START
    gutter_rows: ?[]const GutterRow = null,
    gutter_row_height: f32 = 17,
    gutter_cursor_line: u32 = 0,
    gutter_active_bg: ?Color = null,
    gutter_active_text: ?Color = null,
    gutter_text: ?Color = null,
    minimap_rows: ?[]const MinimapRow = null,
    minimap_row_height: f32 = 3,
    minimap_row_gap: f32 = 1,
    minimap_active_color: ?Color = null,
    minimap_inactive_color: ?Color = null,
    // tslx:GEN:NODE_FIELDS END
    placeholder: ?[]const u8 = null,
    debug_name: ?[]const u8 = null,
    test_id: ?[]const u8 = null,
    tooltip: ?[]const u8 = null,
    href: ?[]const u8 = null,
    hoverable: bool = false,
    handlers: EventHandler = .{},
    scroll_x: f32 = 0,
    scroll_y: f32 = 0,
    /// Lua-tree: index into global `_scrollY` for persisting scroll across `__clearLuaNodes`.
    scroll_persist_slot: u32 = 0,
    show_scrollbar: bool = true,
    scrollbar_side: ScrollbarSide = .auto,
    scrollbar_auto_hide: bool = true,
    scrollbar_last_activity_ms: i64 = 0,
    content_height: f32 = 0,
    content_width: f32 = 0,
    devtools_viz: DevtoolsViz = .none,
    // 3D elements — inline in the 2D tree, rendered by gpu/3d.zig
    scene3d: bool = false, // true = contains 3D.* children
    scene3d_mesh: bool = false, // true = 3D.Mesh
    scene3d_camera: bool = false, // true = 3D.Camera
    scene3d_light: bool = false, // true = 3D.Light
    scene3d_group: bool = false, // true = 3D.Group
    scene3d_geometry: ?[]const u8 = null, // "box", "sphere", "plane", etc.
    scene3d_light_type: ?[]const u8 = null, // "ambient", "directional", "point"
    scene3d_color_r: f32 = 0.8,
    scene3d_color_g: f32 = 0.8,
    scene3d_color_b: f32 = 0.8,
    scene3d_pos_x: f32 = 0,
    scene3d_pos_y: f32 = 0,
    scene3d_pos_z: f32 = 0,
    scene3d_rot_x: f32 = 0,
    scene3d_rot_y: f32 = 0,
    scene3d_rot_z: f32 = 0,
    scene3d_scale_x: f32 = 1,
    scene3d_scale_y: f32 = 1,
    scene3d_scale_z: f32 = 1,
    scene3d_look_x: f32 = 0, // Camera lookAt target
    scene3d_look_y: f32 = 0,
    scene3d_look_z: f32 = 0,
    scene3d_dir_x: f32 = 0, // Light direction
    scene3d_dir_y: f32 = -1,
    scene3d_dir_z: f32 = 0,
    scene3d_fov: f32 = 60, // Camera fov in degrees
    scene3d_intensity: f32 = 1.0, // Light intensity
    scene3d_radius: f32 = 0.5, // Sphere/cylinder radius
    scene3d_tube_radius: f32 = 0.25, // Torus tube radius
    scene3d_size_x: f32 = 1, // Box/plane width
    scene3d_size_y: f32 = 1, // Box/plane height
    scene3d_size_z: f32 = 1, // Box depth
    scene3d_show_grid: bool = false, // Scene3D navigation grid overlay
    scene3d_show_axes: bool = false, // Scene3D origin axes overlay
    // Physics 2D — inline in the 2D tree, driven by framework/physics2d.zig
    physics_world_id: u8 = 0, // multi-physics-world instance index (0..MAX_PHYSICS_WORLDS-1)
    physics_world: bool = false, // true = Physics.World container
    physics_body: bool = false, // true = Physics.Body (wraps child nodes)
    physics_collider: bool = false, // true = Physics.Collider (shape definition, no visual)
    physics_body_type: u8 = 2, // 0=static, 1=kinematic, 2=dynamic
    physics_x: f32 = 0, // initial body position (pixels)
    physics_y: f32 = 0,
    physics_angle: f32 = 0,
    physics_gravity_x: f32 = 0, // world gravity (pixels/s^2)
    physics_gravity_y: f32 = 980,
    physics_density: f32 = 1.0,
    physics_friction: f32 = 0.3,
    physics_restitution: f32 = 0.1,
    physics_radius: f32 = 0, // circle collider radius (pixels)
    physics_shape: u8 = 0, // 0=rectangle, 1=circle
    physics_body_idx: i16 = -1, // runtime: assigned body index from physics2d
    physics_fixed_rotation: bool = false,
    physics_bullet: bool = false,
    physics_gravity_scale: f32 = 1.0,
    context_menu_items: ?[]const context_menu.MenuItem = null,
    terminal: bool = false, // true = Terminal element (cell-grid rendering via vterm)
    terminal_font_size: u16 = 13, // monospace font size for terminal cell grid
    terminal_id: u8 = 0, // multi-terminal slot index (0..MAX_TERMINALS-1)
    graph_container: bool = false, // true = Graph element (SVG paths, no pan/zoom)
    // true = Graph/Canvas uses DOM-style origin (0,0 at element top-left).
    // Default is center-origin (world 0,0 sits at the element midpoint), which
    // suits polar / pan-zoom visualisations. Flip to true for chart code that
    // thinks in plot-area DOM coordinates (plotX, plotY, plotW, plotH).
    graph_origin_topleft: bool = false,
    canvas_id: u8 = 0, // multi-canvas instance index (0..MAX_CANVAS_INSTANCES-1)
    canvas_type: ?[]const u8 = null,
    // Canvas viewport — initial camera (center point + zoom)
    canvas_view_x: f32 = 0,
    canvas_view_y: f32 = 0,
    canvas_view_zoom: f32 = 1.0,
    canvas_view_set: bool = false, // true = apply on first frame
    // Canvas viewport drift — continuous camera animation (pixels/second)
    canvas_drift_x: f32 = 0, // horizontal drift speed (px/s, negative = left)
    canvas_drift_y: f32 = 0, // vertical drift speed (px/s, negative = up)
    canvas_drift_active: bool = false, // true = drift animation is running
    canvas_auto_stacked: bool = false, // true = generative layout already applied this visit
    // Per-node theme override (0 = inherit global, 1+ = palette ID from registry)
    theme_id: u8 = 0,
    // Canvas.Node fields — position + size in parent canvas's coordinate space
    canvas_node: bool = false, // true = this is a Canvas.Node
    canvas_gx: f32 = 0, // graph-space X (center)
    canvas_gy: f32 = 0, // graph-space Y (center)
    canvas_gw: f32 = 0, // graph-space width (0 = auto from content)
    canvas_gh: f32 = 0, // graph-space height (0 = auto from content)
    canvas_move_draggable: bool = false, // true = Alt+drag on this node fires onMove (for cart-driven reposition)
    // Canvas.Path fields — SVG path drawing
    canvas_clamp: bool = false, // true = this is a Canvas.Clamp (viewport-pinned)
    canvas_path: bool = false, // true = this is a Canvas.Path
    canvas_path_d: ?[]const u8 = null, // SVG path data string
    canvas_stroke_width: f32 = 2,
    canvas_fill_color: ?Color = null, // fill color for filled SVG paths (via blend2d)
    canvas_fill_gradient: ?LinearGradient = null, // linear gradient fill — Gouraud-interpolated via drawTriColored
    canvas_flow_speed: f32 = 0, // 0 = solid, >0 = flow forward, <0 = flow reverse
    canvas_fill_effect: ?[]const u8 = null, // effect name to use as polygon fill texture
    text_effect: ?[]const u8 = null, // effect name for per-glyph text coloring
    // Inline glyphs — polygons/3D embedded in text (emoji-like)
    inline_glyphs: ?[]const InlineGlyph = null,
    inline_slots: [MAX_INLINE_SLOTS]InlineSlot = [_]InlineSlot{.{}} ** MAX_INLINE_SLOTS,
    inline_slot_count: u8 = 0,
    // Effect — user-compiled pixel render callback
    effect_render: ?effect_ctx.RenderFn = null,
    effect_shader: ?effect_shader.GpuShaderDesc = null,
    effect_name: ?[]const u8 = null, // named effect — renders but not drawn, referenced by fillEffect
    effect_background: bool = false, // true = render behind parent's children
    effect_mask: bool = false, // true = post-process parent's rendered content
    // Custom window chrome — borderless window drag/resize regions
    window_drag: bool = false, // true = dragging this node moves the window
    window_resize: bool = false, // true = this node is a resize edge (direction auto-detected from position)
    _flex_w: ?f32 = null,
    _stretch_h: ?f32 = null,
    _parent_inner_w: ?f32 = null,
    _parent_inner_h: ?f32 = null,
    _cache_iw: f32 = -1,
    _cache_ih: f32 = -1,
    _cache_ih_avail: f32 = -1,
};
pub const MeasureTextFn = *const fn (text: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) TextMetrics;
pub const MeasureImageFn = *const fn (path: []const u8) ImageDims;

// ── Module state ───────────────────────────────────
var measureFn: ?MeasureTextFn = null;
var measureImageFn: ?MeasureImageFn = null;
const LAYOUT_BUDGET: usize = 100000;
var layoutCount: usize = 0;

/// When false, the main loop may skip `layout.layout(root)` until something calls `markLayoutDirty`.
/// Starts true so the first frame always runs flex layout after app init.
var g_layout_dirty: bool = true;

pub fn markLayoutDirty() void {
    g_layout_dirty = true;
}

pub fn isLayoutDirty() bool {
    return g_layout_dirty;
}

pub fn clearLayoutDirty() void {
    g_layout_dirty = false;
}

// ── Functions ──────────────────────────────────────

pub fn hitTest(node: *Node, mx: f32, my: f32) ?*Node {
    if (node.style.display == .none) {
        return null;
    }
    // Scroll container: clip hit test to container bounds and adjust coordinates
    const ov = node.style.overflow;
    const r = node.computed;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    var child_mx = mx;
    var child_my = my;
    if (is_scroll) {
        // Reject clicks outside the scroll container's visible bounds
        if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) {
            return null;
        }
        // Convert screen coordinates to content coordinates
        child_my = my + node.scroll_y;
        child_mx = mx + node.scroll_x;
    }
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (hitTest(&node.children[i], child_mx, child_my)) |hit| {
            return hit;
        }
    }
    if (hasHandlers(node.handlers) or node.href != null or node.input_id != null or node.canvas_type != null) {
        if (mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
            return node;
        }
    }
    return null;
}

fn hasHandlers(h: EventHandler) bool {
    return h.on_press != null or h.js_on_press != null or h.lua_on_press != null or h.on_hover_enter != null or h.on_hover_exit != null or h.js_on_hover_enter != null or h.lua_on_hover_enter != null or h.js_on_hover_exit != null or h.lua_on_hover_exit != null or h.on_key != null or h.on_change_text != null or h.on_scroll != null or h.on_right_click != null;
}

pub fn hitTestText(node: *Node, mx: f32, my: f32) ?Node {
    if (node.style.display == .none) {
        return null;
    }
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        const hit = &hitTestText(node.children[@intCast(i)], mx, my);
        if (hit != null) {
            return hit.?;
        }
    }
    if (node.text != null) {
        const r = node.computed;
        if (mx >= r.x and mx < r.x + r.w and my >= r.y and my < r.y + r.h) {
            return node;
        }
    }
    return null;
}

pub fn findScrollContainer(node: *Node, mx: f32, my: f32) ?Node {
    if (node.style.display == .none) {
        return null;
    }
    const r = node.computed;
    if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) {
        return null;
    }
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        const hit = &findScrollContainer(node.children[@intCast(i)], mx, my);
        if (hit != null) {
            return hit.?;
        }
    }
    if (node.style.overflow == .scroll) {
        return node;
    }
    return null;
}

fn rgb(r: u8, g: u8, b: u8) Color {
    return .{ .r = r, .g = g, .b = b, .a = 255 };
}

fn rgba(r: u8, g: u8, b: u8, a: u8) Color {
    return .{ .r = r, .g = g, .b = b, .a = a };
}

pub fn setMeasureFn(f: ?MeasureTextFn) void {
    measureFn = f;
}

pub fn setMeasureImageFn(f: ?MeasureImageFn) void {
    measureImageFn = f;
}

fn padLeft(s: Style) f32 {
    return s.padding_left orelse s.padding;
}

fn padRight(s: Style) f32 {
    return s.padding_right orelse s.padding;
}

fn padTop(s: Style) f32 {
    return s.padding_top orelse s.padding;
}

fn padBottom(s: Style) f32 {
    return s.padding_bottom orelse s.padding;
}

fn marLeft(s: Style) f32 {
    const v = s.margin_left orelse s.margin;
    return if (std.math.isInf(v)) 0 else v;
}
fn marRight(s: Style) f32 {
    const v = s.margin_right orelse s.margin;
    return if (std.math.isInf(v)) 0 else v;
}
fn marTop(s: Style) f32 {
    const v = s.margin_top orelse s.margin;
    return if (std.math.isInf(v)) 0 else v;
}

fn marBottom(s: Style) f32 {
    const v = s.margin_bottom orelse s.margin;
    return if (std.math.isInf(v)) 0 else v;
}

fn resolveMaybePct(val: ?f32, parent: f32) ?f32 {
    if (val == null) {
        return null;
    }
    if (val.? < 0) {
        return (-val.?) * parent;
    }
    return val.?;
}

fn clampVal(val: f32, minVal: ?f32, maxVal: ?f32) f32 {
    var v = val;
    if (minVal != null and asF32(v) < asF32(minVal.?)) {
        v = minVal.?;
    }
    if (maxVal != null and asF32(v) > asF32(maxVal.?)) {
        v = maxVal.?;
    }
    return v;
}

fn measureNodeImage(node: *Node) ImageDims {
    if (node.image_src != null and measureImageFn != null) {
        return measureImageFn.?(node.image_src.?);
    }
    return .{ .width = 0, .height = 0 };
}

fn measureNodeText(node: *Node) TextMetrics {
    return measureNodeTextW(node, 0);
}

// ── Text measurement cache ──────────────────────────────────────
// Avoids redundant FreeType calls during estimation + layout.
// Keyed on (text_ptr, text_len, font_size, maxWidth_bits).
// Direct-mapped (hash & mask) for speed. Collisions just re-measure.

const TEXT_CACHE_SIZE = 1024; // must be power of 2
const TEXT_CACHE_MASK = TEXT_CACHE_SIZE - 1;

const TextCacheEntry = struct {
    text_ptr: usize = 0,
    text_len: usize = 0,
    font_size: u16 = 0,
    max_width_bits: u32 = 0,
    result: TextMetrics = .{},
    valid: bool = false,
};

var textCache: [TEXT_CACHE_SIZE]TextCacheEntry = [_]TextCacheEntry{.{}} ** TEXT_CACHE_SIZE;

fn textCacheHash(text_ptr: usize, text_len: usize, font_size: u16, max_width_bits: u32) usize {
    // FNV-1a style hash
    var h: usize = 0x811c9dc5;
    h ^= text_ptr;
    h *%= 0x01000193;
    h ^= text_len;
    h *%= 0x01000193;
    h ^= font_size;
    h *%= 0x01000193;
    h ^= max_width_bits;
    h *%= 0x01000193;
    return h & TEXT_CACHE_MASK;
}

fn measureNodeTextW(node: *Node, maxWidth: f32) TextMetrics {
    if (node.text == null or measureFn == null) {
        return .{ .width = 0, .height = 0, .ascent = 0 };
    }
    const txt = node.text.?;
    const text_ptr = @intFromPtr(txt.ptr);
    const text_len = txt.len;
    const mw_bits: u32 = @bitCast(@as(f32, maxWidth));
    const idx = textCacheHash(text_ptr, text_len, node.font_size, mw_bits);

    const entry = &textCache[idx];
    if (entry.valid and entry.text_ptr == text_ptr and entry.text_len == text_len and
        entry.font_size == node.font_size and entry.max_width_bits == mw_bits and
        node.number_of_lines == 0) // skip cache for truncated text
    {
        return entry.result;
    }

    const result = measureFn.?(txt, node.font_size, maxWidth, node.letter_spacing, node.line_height, node.number_of_lines, node.no_wrap);
    entry.* = .{
        .text_ptr = text_ptr,
        .text_len = text_len,
        .font_size = node.font_size,
        .max_width_bits = mw_bits,
        .result = result,
        .valid = true,
    };
    return result;
}

fn invalidateTextCache() void {
    for (&textCache) |*entry| {
        entry.valid = false;
    }
}

fn estimateIntrinsicWidth(node: *Node) f32 {
    if (node._cache_iw >= 0) return node._cache_iw;
    const result = estimateIntrinsicWidthUncached(node);
    node._cache_iw = result;
    return result;
}

fn estimateIntrinsicWidthUncached(node: *Node) f32 {
    const s = node.style;
    if (s.width != null and s.width.? >= 0) {
        return s.width.?;
    }
    const pl = padLeft(s);
    const pr = padRight(s);
    const g = s.gap;
    const isRow = s.flex_direction == .row or s.flex_direction == .row_reverse;
    if (node.text != null) {
        const m = measureNodeText(node);
        return m.width + pl + pr;
    }
    if (node.image_src != null) {
        const dims = measureNodeImage(node);
        return dims.width + pl + pr;
    }
    if (node.children.len == 0) {
        return pl + pr;
    }
    var total: f32 = 0;
    var maxCross: f32 = 0;
    var visibleCount: usize = 0;
    for (node.children) |*child| {
        if (child.style.display == .none) {
            continue;
        }
        const cw = estimateIntrinsicWidth(child);
        const cmL = marLeft(child.style);
        const cmR = marRight(child.style);
        if (isRow) {
            total += cw + cmL + cmR;
            visibleCount += 1;
        } else {
            const cross = cw + cmL + cmR;
            if (cross > maxCross) {
                maxCross = cross;
            }
        }
    }
    if (isRow) {
        const gaps = if (visibleCount > 1) g * @as(f32, @floatFromInt((visibleCount - 1))) else 0;
        return total + gaps + pl + pr;
    }
    return maxCross + pl + pr;
}

fn estimateIntrinsicHeight(node: *Node, availableWidth: f32) f32 {
    if (node._cache_ih >= 0 and node._cache_ih_avail == availableWidth) return node._cache_ih;
    const result = estimateIntrinsicHeightUncached(node, availableWidth);
    node._cache_ih = result;
    node._cache_ih_avail = availableWidth;
    return result;
}

fn estimateIntrinsicHeightUncached(node: *Node, availableWidth: f32) f32 {
    const s = node.style;
    if (s.height != null and s.height.? >= 0) {
        return s.height.?;
    }
    if (s.aspect_ratio != null and s.aspect_ratio.? > 0 and s.width != null) {
        return s.width.? / s.aspect_ratio.?;
    }
    const pt = padTop(s);
    const pb = padBottom(s);
    const pl = padLeft(s);
    const pr = padRight(s);
    const g = s.gap;
    const isRow = s.flex_direction == .row or s.flex_direction == .row_reverse;
    const innerW = if (s.width != null) s.width.? - pl - pr else if (availableWidth > 0) availableWidth - pl - pr else 0;
    if (node.text != null) {
        const m = measureNodeTextW(node, innerW);
        return m.height + pt + pb;
    }
    if (node.image_src != null) {
        const dims = measureNodeImage(node);
        return dims.height + pt + pb;
    }
    if (node.input_id != null) {
        return @as(f32, @floatFromInt(node.font_size)) * 1.4 + pt + pb;
    }
    // tslx:GEN:INTRINSIC_HEIGHT START
    if (node.gutter_rows) |gr| {
        return @as(f32, @floatFromInt(gr.len)) * node.gutter_row_height + pt + pb;
    }
    if (node.minimap_rows) |gr| {
        return @as(f32, @floatFromInt(gr.len)) * (node.minimap_row_height + node.minimap_row_gap) + pt + pb;
    }
    // tslx:GEN:INTRINSIC_HEIGHT END
    if (node.children.len == 0) {
        return pt + pb;
    }
    var total: f32 = 0;
    var maxCross: f32 = 0;
    var visibleCount: usize = 0;
    if (isRow and innerW > 0) {
        // Row: estimate each child's actual allocated width before measuring height.
        // Without this, text children get measured at full row width and don't wrap,
        // causing the row's height estimate to be too short.
        const MAX_ROW_EST = 32;
        var childWidths: [MAX_ROW_EST]f32 = undefined;
        var totalIntrinsic: f32 = 0;
        var growTotal: f32 = 0;
        var vc: usize = 0;
        for (node.children) |*child| {
            if (child.style.display == .none) continue;
            if (vc >= MAX_ROW_EST) break;
            const cw = resolveMaybePct(child.style.width, innerW) orelse estimateIntrinsicWidth(child);
            const cmL = marLeft(child.style);
            const cmR = marRight(child.style);
            childWidths[vc] = cw;
            totalIntrinsic += cw + cmL + cmR;
            growTotal += child.style.flex_grow;
            vc += 1;
        }
        const rowGaps = if (vc > 1) g * @as(f32, @floatFromInt(vc - 1)) else 0;
        const freeSpace = innerW - totalIntrinsic - rowGaps;
        // Distribute free space to grow children
        if (freeSpace > 0 and growTotal > 0) {
            var ri: usize = 0;
            for (node.children) |*child| {
                if (child.style.display == .none) continue;
                if (ri >= vc) break;
                if (child.style.flex_grow > 0) {
                    childWidths[ri] += (child.style.flex_grow / growTotal) * freeSpace;
                }
                ri += 1;
            }
        }
        // Now measure height with estimated widths
        var ri2: usize = 0;
        for (node.children) |*child| {
            if (child.style.display == .none) continue;
            if (ri2 >= vc) break;
            const allocW = childWidths[ri2];
            const ch = estimateIntrinsicHeight(child, allocW);
            const cmT = marTop(child.style);
            const cmB = marBottom(child.style);
            const cross = ch + cmT + cmB;
            if (cross > maxCross) maxCross = cross;
            ri2 += 1;
        }
        visibleCount = vc;
    } else {
        for (node.children) |*child| {
            if (child.style.display == .none) continue;
            const ch = estimateIntrinsicHeight(child, innerW);
            const cmT = marTop(child.style);
            const cmB = marBottom(child.style);
            if (!isRow) {
                total += ch + cmT + cmB;
                visibleCount += 1;
            } else {
                const cross = ch + cmT + cmB;
                if (cross > maxCross) maxCross = cross;
            }
        }
    }
    if (!isRow) {
        const gaps = if (visibleCount > 1) g * @as(f32, @floatFromInt((visibleCount - 1))) else 0;
        return total + gaps + pt + pb;
    }
    if ((s.flex_wrap == .wrap or s.flex_wrap == .wrap_reverse) and innerW > 0) {
        var lineMain: f32 = 0;
        var lineCrossMax: f32 = 0;
        var totalCross: f32 = 0;
        var itemsOnLine: usize = 0;
        var lineCount: usize = 0;
        for (node.children) |*child| {
            if (child.style.display == .none) {
                continue;
            }
            if (child.style.position == .absolute) {
                continue;
            }
            const cw = estimateIntrinsicWidth(child);
            const cmL = marLeft(child.style);
            const cmR = marRight(child.style);
            const itemMain = cw + cmL + cmR;
            const gapBefore = if (itemsOnLine > 0) g else 0;
            if (itemsOnLine > 0 and (asF32(lineMain) + asF32(gapBefore) + itemMain) > innerW) {
                totalCross += lineCrossMax;
                lineCount += 1;
                lineMain = itemMain;
                lineCrossMax = estimateIntrinsicHeight(child, innerW) + marTop(child.style) + marBottom(child.style);
                itemsOnLine = 1;
            } else {
                lineMain += asF32(gapBefore) + asF32(itemMain);
                const chCross = estimateIntrinsicHeight(child, innerW) + marTop(child.style) + marBottom(child.style);
                if (chCross > lineCrossMax) {
                    lineCrossMax = chCross;
                }
                itemsOnLine += 1;
            }
        }
        if (itemsOnLine > 0) {
            totalCross += lineCrossMax;
            lineCount += 1;
        }
        const lineGaps = if (lineCount > 1) g * @as(f32, @floatFromInt((lineCount - 1))) else 0;
        return totalCross + lineGaps + pt + pb;
    }
    return maxCross + pt + pb;
}

fn computeMinContentW(node: *Node) f32 {
    const s = node.style;
    const pl = padLeft(s);
    const pr = padRight(s);
    if (s.width != null) {
        return s.width.?;
    }
    if (node.text != null and measureFn != null) {
        var maxWordW: f32 = 0;
        var i: usize = 0;
        while (i < node.text.?.len) {
            while (i < node.text.?.len and (node.text.?[@intCast(i)] == ' ' or node.text.?[@intCast(i)] == '\n')) : (i += 1) {}
            if (i >= node.text.?.len) {
                break;
            }
            const wordStart = i;
            while (i < node.text.?.len and node.text.?[@intCast(i)] != ' ' and node.text.?[@intCast(i)] != '\n') : (i += 1) {}
            const word = node.text.?[@intCast(wordStart)..@intCast(i)];
            const m = measureFn.?(word, node.font_size, 0, node.letter_spacing, node.line_height, node.number_of_lines, false);
            if (m.width > maxWordW) {
                maxWordW = m.width;
            }
        }
        return maxWordW + pl + pr;
    }
    if (node.children.len == 0) {
        return pl + pr;
    }
    const isRow = s.flex_direction == .row or s.flex_direction == .row_reverse;
    const g = s.gap;
    var minW: f32 = 0;
    var visCount: usize = 0;
    for (node.children) |*child| {
        if (child.style.display == .none) {
            continue;
        }
        if (child.style.position == .absolute) {
            continue;
        }
        const childMin = computeMinContentW(child);
        if (isRow) {
            minW += childMin;
            visCount += 1;
        } else {
            if (asF32(childMin) > asF32(minW)) {
                minW = childMin;
            }
        }
    }
    if (isRow and visCount > 1) {
        minW += @as(f32, @floatFromInt((visCount - 1))) * g;
    }
    return minW + pl + pr;
}

pub fn layoutNode(node: *Node, px: f32, py: f32, pw: f32, ph: f32) void {
    layoutCount += 1;
    if (layoutCount > LAYOUT_BUDGET) {
        return;
    }
    const s = node.style;
    if (s.display == .none) {
        node.computed = .{ .x = px, .y = py, .w = 0, .h = 0 };
        return;
    }
    // Canvas.Path: standalone (icon) paths take their box's style/parent size
    // so paintCanvasPath can scale the 24×24 viewbox to fit. Inline paths
    // (canvas_path=true) collapse — they overlay their parent.
    if (node.canvas_path) {
        node.computed = .{ .x = px, .y = py, .w = 0, .h = 0 };
        return;
    }
    if (node.canvas_path_d != null) {
        const pin_w: f32 = node._parent_inner_w orelse 0;
        const pin_h: f32 = node._parent_inner_h orelse 0;
        const fb_w: f32 = if (s.flex_basis) |fb| fb else 0;
        const w_pref = if (s.width) |v| v
            else if (fb_w > 0) fb_w
            else if (pw > 0) pw
            else if (pin_w > 0) pin_w
            else 24;
        const h_pref = if (s.height) |v| v
            else if (ph > 0) ph
            else if (pin_h > 0) pin_h
            else 24;
        node.computed = .{ .x = px, .y = py, .w = w_pref, .h = h_pref };
        return;
    }
    // Canvas.Clamp: spans full parent bounds (viewport overlay).
    if (node.canvas_clamp) {
        node.computed = .{ .x = px, .y = py, .w = pw, .h = ph };
        for (node.children) |*child| {
            layoutNode(child, px, py, pw, ph);
        }
        return;
    }
    // Video/Render: fill parent bounds, clamped to GPU texture limit (8192).
    // The proportional fallback can produce ph=9999 which exceeds the GPU max.
    if (node.video_src != null or node.render_src != null) {
        node.computed = .{ .x = px, .y = py, .w = @min(pw, 8192), .h = @min(ph, 8192) };
        return;
    }
    // Canvas.Node layout:
    // - gw sets width (or parent width if 0)
    // - gh>0: fixed height
    // - gh=0: auto-height — allocate generous box, layout children, measure
    //   content extent, shrink node to fit, re-layout with real height
    if (node.canvas_node) {
        const cw = if (node.canvas_gw > 0) node.canvas_gw else pw;
        if (node.canvas_gh > 0) {
            // Fixed dimensions
            node.computed = .{ .x = px, .y = py, .w = cw, .h = node.canvas_gh };
            for (node.children) |*child| {
                layoutNode(child, px, py, cw, node.canvas_gh);
            }
        } else {
            // Auto-height: allocate big, measure content, shrink to fit
            const alloc_h: f32 = 500; // generous initial box
            node.computed = .{ .x = px, .y = py, .w = cw, .h = alloc_h };
            for (node.children) |*child| {
                layoutNode(child, px, py, cw, alloc_h);
            }
            // Measure actual content extent (subtract dead space)
            var max_bottom: f32 = 0;
            for (node.children) |*child| {
                const bottom = (child.computed.y - py) + child.computed.h;
                if (bottom > max_bottom) max_bottom = bottom;
            }
            const content_h = if (max_bottom > 0) max_bottom else 0;
            // Shrink node to content and re-layout so % children get real height
            node.computed.h = content_h;
            node.canvas_gh = content_h;
            for (node.children) |*child| {
                layoutNode(child, px, py, cw, content_h);
            }
        }
        return;
    }
    var w: f32 = undefined;
    var h: ?f32 = null;
    if (node._flex_w != null) {
        w = node._flex_w.?;
        node._flex_w = null;
    } else {
        const resolved = resolveMaybePct(s.width, pw);
        w = if (resolved != null) resolved.? else pw;
    }
    w = clampVal(w, resolveMaybePct(s.min_width, pw), resolveMaybePct(s.max_width, pw));
    if (node._stretch_h != null) {
        h = node._stretch_h.?;
        node._stretch_h = null;
    } else {
        h = resolveMaybePct(s.height, ph);
    }
    if (h != null) {
        h.? = clampVal(h.?, resolveMaybePct(s.min_height, ph), resolveMaybePct(s.max_height, ph));
    }
    if (s.aspect_ratio != null and s.aspect_ratio.? > 0) {
        if (s.width != null and s.height == null and h == null) {
            h = w / s.aspect_ratio.?;
        } else if (s.height != null and s.width == null and node._flex_w == null) {
            if (h != null) {
                w = h.? * s.aspect_ratio.?;
                w = clampVal(w, resolveMaybePct(s.min_width, pw), resolveMaybePct(s.max_width, pw));
            }
        }
    }
    const pl = padLeft(s);
    const pr = padRight(s);
    const pt = padTop(s);
    const pb = padBottom(s);
    const ml = marLeft(s);
    const mt = marTop(s);
    const x = px + ml;
    const y = py + mt;
    const innerW = w - pl - pr;
    const autoHeight = h == null;
    // Scroll containers need TWO heights:
    // - innerH: the REAL container height (for flex distribution — children share this space)
    // - childLayoutH: unlimited (so children can overflow and be scrolled to)
    //
    // When height is indefinite, innerH must be derived from content + min/max,
    // NOT a 9999 sentinel. If 9999 flows into flex distribution, a flex-grow
    // child with flex-basis:0 eats the 9999 — producing ~10000-tall containers
    // whose centered content ends up at y≈5000. Top-down rule: every container
    // has a concrete height from parent offer or its own floor; flex-grow
    // distributes only over that concrete height's free space.
    var innerH: f32 = undefined;
    if (h != null) {
        innerH = h.? - pt - pb;
    } else {
        const intrinsic_total = estimateIntrinsicHeight(node, innerW);
        const intrinsic_inner = intrinsic_total - pt - pb;
        const min_raw = resolveMaybePct(s.min_height, ph);
        const max_raw = resolveMaybePct(s.max_height, ph);
        var v: f32 = intrinsic_inner;
        if (min_raw) |m| {
            const m_inner = m - pt - pb;
            if (v < m_inner) v = m_inner;
        }
        if (max_raw) |m| {
            const m_inner = m - pt - pb;
            if (v > m_inner) v = m_inner;
        }
        if (v < 0) v = 0;
        innerH = v;
    }
    const hasExplicitFlexSpacing = s.gap != 0 or s.row_gap != null or s.column_gap != null or s.padding != 0 or s.padding_left != null or s.padding_right != null or s.padding_top != null or s.padding_bottom != null or s.flex_wrap != .no_wrap or s.flex_direction == .row or s.flex_direction == .row_reverse;
    var onlyTextChildren = node.text == null and node.children.len > 0 and !hasExplicitFlexSpacing;
    if (onlyTextChildren) {
        var ti: usize = 0;
        while (ti < node.children.len) : (ti += 1) {
            const child = &node.children[ti];
            if (child.style.display == .none) continue;
            if (child.text == null or child.children.len != 0) {
                onlyTextChildren = false;
                break;
            }
        }
    }
    const isRow = s.flex_direction == .row or s.flex_direction == .row_reverse or onlyTextChildren;
    const isReverse = s.flex_direction == .row_reverse or s.flex_direction == .column_reverse;
    // Vertical scroll containers should preserve child heights and overflow.
    // If we shrink them to fit the viewport, content_height collapses to the
    // container height and there is nothing left to scroll.
    const preserveMainOverflow = !isRow and (s.overflow == .scroll or s.overflow == .auto);
    const gap = s.mainGap();
    const crossGapVal = s.crossGap();
    const justify = s.justify_content;
    const @"align" = s.align_items;
    const mainSize = if (isRow) innerW else innerH;
    const MAX_CHILDREN = 512;
    var childBasis: [MAX_CHILDREN]f32 = undefined;
    var childGrow: [MAX_CHILDREN]f32 = undefined;
    var childShrink: [MAX_CHILDREN]f32 = undefined;
    var childMainSize: [MAX_CHILDREN]f32 = undefined;
    var childCrossSize: [MAX_CHILDREN]f32 = undefined;
    var childMainMarginStart: [MAX_CHILDREN]f32 = undefined;
    var childMainMarginEnd: [MAX_CHILDREN]f32 = undefined;
    var childCrossMarginStart: [MAX_CHILDREN]f32 = undefined;
    var childCrossMarginEnd: [MAX_CHILDREN]f32 = undefined;
    var visibleIndices: [MAX_CHILDREN]usize = undefined;
    var visibleCount: usize = 0;
    var absoluteIndices: [MAX_CHILDREN]usize = undefined;
    var absoluteCount: usize = 0;
    {
        var i: usize = 0;
        while (i < node.children.len) : (i += 1) {
            const child = &node.children[@intCast(i)];
            if (child.style.display == .none) {
                child.computed = .{ .x = 0, .y = 0, .w = 0, .h = 0 };
                continue;
            }
            if (child.style.position == .absolute) {
                if (absoluteCount < MAX_CHILDREN) {
                    absoluteIndices[@intCast(absoluteCount)] = i;
                    absoluteCount += 1;
                }
                continue;
            }
            if (visibleCount >= MAX_CHILDREN) {
                break;
            }
            const cs = child.style;
            const cw = resolveMaybePct(cs.width, innerW) orelse estimateIntrinsicWidth(child);
            const chVal = resolveMaybePct(cs.height, innerH) orelse estimateIntrinsicHeight(child, innerW);
            const cwClamped = clampVal(cw, resolveMaybePct(cs.min_width, innerW), resolveMaybePct(cs.max_width, innerW));
            const chClamped = clampVal(chVal, resolveMaybePct(cs.min_height, innerH), resolveMaybePct(cs.max_height, innerH));
            const grow = cs.flex_grow;
            const shrink = cs.flex_shrink orelse 1.0;
            // flex_grow children with no explicit size: basis=0 so they don't inflate totalBasis
            // and steal space from fixed-size siblings. They grow INTO free space, not FROM content.
            const defaultBasis = if (grow > 0 and ((isRow and cs.width == null) or (!isRow and cs.height == null)))
                @as(f32, 0)
            else
                (if (isRow) cwClamped else chClamped);
            const basis = resolveMaybePct(cs.flex_basis, if (isRow) innerW else innerH) orelse defaultBasis;
            const cmL = marLeft(cs);
            const cmR = marRight(cs);
            const cmT = marTop(cs);
            const cmB = marBottom(cs);
            visibleIndices[@intCast(visibleCount)] = i;
            childBasis[@intCast(visibleCount)] = basis;
            childGrow[@intCast(visibleCount)] = grow;
            childShrink[@intCast(visibleCount)] = shrink;
            childMainSize[@intCast(visibleCount)] = if (isRow) cwClamped else chClamped;
            childCrossSize[@intCast(visibleCount)] = if (isRow) chClamped else cwClamped;
            childMainMarginStart[@intCast(visibleCount)] = if (isRow) cmL else cmT;
            childMainMarginEnd[@intCast(visibleCount)] = if (isRow) cmR else cmB;
            childCrossMarginStart[@intCast(visibleCount)] = if (isRow) cmT else cmL;
            childCrossMarginEnd[@intCast(visibleCount)] = if (isRow) cmB else cmR;
            visibleCount += 1;
        }
    }
    // Sort visible children by CSS order property (stable insertion sort)
    if (visibleCount > 1) {
        var hasOrder = false;
        for (0..visibleCount) |i| {
            if (node.children[visibleIndices[i]].style.order != 0) {
                hasOrder = true;
                break;
            }
        }
        if (hasOrder) {
            var si: usize = 1;
            while (si < visibleCount) : (si += 1) {
                const keyIdx = visibleIndices[si];
                const keyOrder = node.children[keyIdx].style.order;
                const keyBasis = childBasis[si];
                const keyGrow = childGrow[si];
                const keyShrink = childShrink[si];
                const keyMain = childMainSize[si];
                const keyCross = childCrossSize[si];
                const keyMMS = childMainMarginStart[si];
                const keyMME = childMainMarginEnd[si];
                const keyCMS = childCrossMarginStart[si];
                const keyCME = childCrossMarginEnd[si];
                var j: usize = si;
                while (j > 0 and node.children[visibleIndices[j - 1]].style.order > keyOrder) {
                    visibleIndices[j] = visibleIndices[j - 1];
                    childBasis[j] = childBasis[j - 1];
                    childGrow[j] = childGrow[j - 1];
                    childShrink[j] = childShrink[j - 1];
                    childMainSize[j] = childMainSize[j - 1];
                    childCrossSize[j] = childCrossSize[j - 1];
                    childMainMarginStart[j] = childMainMarginStart[j - 1];
                    childMainMarginEnd[j] = childMainMarginEnd[j - 1];
                    childCrossMarginStart[j] = childCrossMarginStart[j - 1];
                    childCrossMarginEnd[j] = childCrossMarginEnd[j - 1];
                    j -= 1;
                }
                visibleIndices[j] = keyIdx;
                childBasis[j] = keyBasis;
                childGrow[j] = keyGrow;
                childShrink[j] = keyShrink;
                childMainSize[j] = keyMain;
                childCrossSize[j] = keyCross;
                childMainMarginStart[j] = keyMMS;
                childMainMarginEnd[j] = keyMME;
                childCrossMarginStart[j] = keyCMS;
                childCrossMarginEnd[j] = keyCME;
            }
        }
    }
    const MAX_LINES = 64;
    var lineStarts = std.mem.zeroes([MAX_LINES]usize);
    var lineCounts = std.mem.zeroes([MAX_LINES]usize);
    var numLines: usize = 0;
    if ((s.flex_wrap == .wrap or s.flex_wrap == .wrap_reverse) and visibleCount > 0) {
        var lineMain: f32 = 0;
        var lineStartIdx: usize = 0;
        var itemsOnLine: usize = 0;
        {
            var i: usize = 0;
            while (i < visibleCount) : (i += 1) {
                const itemMain = childBasis[@intCast(i)] + childMainMarginStart[@intCast(i)] + childMainMarginEnd[@intCast(i)];
                const gapBefore = if (itemsOnLine > 0) gap else 0;
                if (itemsOnLine > 0 and (asF32(lineMain) + asF32(gapBefore) + itemMain) > mainSize) {
                    if (numLines < MAX_LINES) {
                        lineStarts[@intCast(numLines)] = lineStartIdx;
                        lineCounts[@intCast(numLines)] = itemsOnLine;
                        numLines += 1;
                    }
                    lineStartIdx = i;
                    lineMain = itemMain;
                    itemsOnLine = 1;
                } else {
                    lineMain += asF32(gapBefore) + asF32(itemMain);
                    itemsOnLine += 1;
                }
            }
        }
        if (itemsOnLine > 0 and numLines < MAX_LINES) {
            lineStarts[@intCast(numLines)] = lineStartIdx;
            lineCounts[@intCast(numLines)] = itemsOnLine;
            numLines += 1;
        }
    } else {
        lineStarts[@intCast(0)] = 0;
        lineCounts[@intCast(0)] = visibleCount;
        numLines = if (visibleCount > 0) 1 else 0;
    }
    // wrap_reverse: reverse line order so last line appears first on cross axis
    if (s.flex_wrap == .wrap_reverse and numLines > 1) {
        var lo: usize = 0;
        var hi: usize = numLines - 1;
        while (lo < hi) {
            const tmpS = lineStarts[lo];
            const tmpC = lineCounts[lo];
            lineStarts[lo] = lineStarts[hi];
            lineCounts[lo] = lineCounts[hi];
            lineStarts[hi] = tmpS;
            lineCounts[hi] = tmpC;
            lo += 1;
            hi -= 1;
        }
    }
    // Pre-compute line cross sizes for align-content distribution
    var lineCrossSizes: [MAX_LINES]f32 = undefined;
    var totalLineCross: f32 = 0;
    {
        var li: usize = 0;
        while (li < numLines) : (li += 1) {
            var lcMax: f32 = 0;
            const lls = lineStarts[@intCast(li)];
            const llc = lineCounts[@intCast(li)];
            var lci = lls;
            while (lci < lls + llc) : (lci += 1) {
                const cc = childCrossSize[@intCast(lci)] + childCrossMarginStart[@intCast(lci)] + childCrossMarginEnd[@intCast(lci)];
                if (cc > lcMax) lcMax = cc;
            }
            if (numLines == 1) {
                if (isRow and h != null) {
                    lcMax = if (h) |hv| hv - pt - pb else lcMax;
                } else if (!isRow) {
                    lcMax = innerW;
                }
            }
            lineCrossSizes[@intCast(li)] = lcMax;
            totalLineCross += lcMax;
        }
    }
    // align-content: distribute free cross space between wrapped lines
    const crossSize = if (isRow) (if (h != null) h.? - pt - pb else totalLineCross) else innerW;
    const crossGaps = if (numLines > 1) crossGapVal * @as(f32, @floatFromInt(numLines - 1)) else 0;
    const freeCross = crossSize - totalLineCross - crossGaps;
    var crossOffset: f32 = 0;
    var extraCrossGap: f32 = 0;
    if (numLines > 1 and freeCross > 0) {
        switch (s.align_content) {
            .center => {
                crossOffset = @floor(freeCross / 2);
            },
            .end => {
                crossOffset = freeCross;
            },
            .space_between => {
                extraCrossGap = freeCross / @as(f32, @floatFromInt(numLines - 1));
            },
            .space_around => {
                extraCrossGap = freeCross / @as(f32, @floatFromInt(numLines));
                crossOffset = @floor(extraCrossGap / 2);
            },
            .space_evenly => {
                extraCrossGap = freeCross / @as(f32, @floatFromInt(numLines + 1));
                crossOffset = @floor(extraCrossGap);
            },
            .stretch => {
                // Distribute extra space equally to each line
                const perLine = freeCross / @as(f32, @floatFromInt(numLines));
                var sli: usize = 0;
                while (sli < numLines) : (sli += 1) {
                    lineCrossSizes[@intCast(sli)] += perLine;
                }
            },
            .start => {},
        }
    }
    var crossCursor: f32 = crossOffset;
    var contentMainEnd: f32 = 0;
    var contentCrossEnd: f32 = 0;
    {
        var lineIdx: usize = 0;
        while (lineIdx < numLines) : (lineIdx += 1) {
            const ls = lineStarts[@intCast(lineIdx)];
            const lc = lineCounts[@intCast(lineIdx)];
            var totalBasis: f32 = 0;
            var totalFlex: f32 = 0;
            var totalMainMargin: f32 = 0;
            {
                var i = ls;
                while (i < ls + lc) : (i += 1) {
                    totalBasis += childBasis[@intCast(i)];
                    totalMainMargin += childMainMarginStart[@intCast(i)] + childMainMarginEnd[@intCast(i)];
                    if (childGrow[@intCast(i)] > 0) {
                        totalFlex += childGrow[@intCast(i)];
                    }
                }
            }
            const lineGaps = if (lc > 1) gap * @as(f32, @floatFromInt((lc - 1))) else 0;
            const freeSpace = mainSize - totalBasis - lineGaps - totalMainMargin;
            if (freeSpace > 0 and totalFlex > 0) {
                var frozen = std.mem.zeroes([MAX_CHILDREN]bool);
                var savedBasis = std.mem.zeroes([MAX_CHILDREN]f32);
                {
                    var i = ls;
                    while (i < ls + lc) : (i += 1) {
                        frozen[@intCast(i)] = childGrow[@intCast(i)] <= 0;
                        savedBasis[@intCast(i)] = childBasis[@intCast(i)];
                    }
                }
                var passes: usize = 0;
                while (passes < 10) {
                    passes += 1;
                    var used: f32 = 0;
                    var activeFlex: f32 = 0;
                    {
                        var i = ls;
                        while (i < ls + lc) : (i += 1) {
                            if (frozen[@intCast(i)]) {
                                used += childBasis[@intCast(i)];
                            } else {
                                used += savedBasis[@intCast(i)];
                                activeFlex += childGrow[@intCast(i)];
                            }
                        }
                    }
                    if (activeFlex <= 0) {
                        break;
                    }
                    const space = mainSize - used - lineGaps - totalMainMargin;
                    if (space <= 0) {
                        break;
                    }
                    var anyClamped = false;
                    {
                        var i = ls;
                        while (i < ls + lc) : (i += 1) {
                            if (frozen[@intCast(i)]) {
                                continue;
                            }
                            childBasis[@intCast(i)] = savedBasis[@intCast(i)] + (childGrow[@intCast(i)] / activeFlex) * space;
                            const ci = visibleIndices[@intCast(i)];
                            const csG = &node.children[@intCast(ci)].style;
                            const mn = resolveMaybePct(if (isRow) csG.min_width else csG.min_height, if (isRow) innerW else innerH);
                            const mx = resolveMaybePct(if (isRow) csG.max_width else csG.max_height, if (isRow) innerW else innerH);
                            const clampedVal = clampVal(childBasis[@intCast(i)], mn, mx);
                            if (clampedVal != childBasis[@intCast(i)]) {
                                childBasis[@intCast(i)] = clampedVal;
                                frozen[@intCast(i)] = true;
                                anyClamped = true;
                            }
                        }
                    }
                    if (!anyClamped) {
                        break;
                    }
                }
            } else if (freeSpace < 0 and !preserveMainOverflow) {
                var totalShrinkScaled: f32 = 0;
                {
                    var i = ls;
                    while (i < ls + lc) : (i += 1) {
                        totalShrinkScaled += childShrink[@intCast(i)] * childBasis[@intCast(i)];
                    }
                }
                if (totalShrinkScaled > 0) {
                    const shrinkOverflow = -freeSpace;
                    {
                        var i = ls;
                        while (i < ls + lc) : (i += 1) {
                            const amount = (childShrink[@intCast(i)] * childBasis[@intCast(i)] / totalShrinkScaled) * shrinkOverflow;
                            childBasis[@intCast(i)] -= amount;
                        }
                    }
                }
                if (isRow) {
                    {
                        var i = ls;
                        while (i < ls + lc) : (i += 1) {
                            const childIdx = visibleIndices[@intCast(i)];
                            const childNode = &node.children[@intCast(childIdx)];
                            if (childNode.style.min_width != null) {
                                continue;
                            }
                            const mcw = computeMinContentW(childNode);
                            if (asF32(childBasis[@intCast(i)]) < asF32(mcw)) {
                                childBasis[@intCast(i)] = mcw;
                            }
                        }
                    }
                }
            }
            if (isRow) {
                var i = ls;
                while (i < ls + lc) : (i += 1) {
                    const childIdx = visibleIndices[@intCast(i)];
                    const childNode = &node.children[@intCast(childIdx)];
                    if (childNode.style.min_width != null) {
                        continue;
                    }
                    if (childBasis[@intCast(i)] <= 0) {
                        const autoMinW = computeMinContentW(childNode);
                        const maxW = resolveMaybePct(childNode.style.max_width, innerW);
                        const floorW = if (maxW != null) @min(autoMinW, maxW.?) else autoMinW;
                        if (asF32(childBasis[@intCast(i)]) < asF32(floorW)) {
                            childBasis[@intCast(i)] = floorW;
                        }
                    }
                }
            }
            {
                var i = ls;
                while (i < ls + lc) : (i += 1) {
                    const childIdx = visibleIndices[@intCast(i)];
                    const child = &node.children[@intCast(childIdx)];
                    if (isRow) {
                        if (child.text != null) {
                            if (child.style.height != null) continue;
                            const finalW = clampVal(childBasis[@intCast(i)], resolveMaybePct(child.style.min_width, innerW), resolveMaybePct(child.style.max_width, innerW));
                            const prevW = childMainSize[@intCast(i)];
                            if (@abs(finalW - prevW) > 0.5) {
                                const cpl = padLeft(child.style);
                                const cpr = padRight(child.style);
                                const cpt = padTop(child.style);
                                const cpb = padBottom(child.style);
                                const constrainW = finalW - cpl - cpr;
                                const m = measureNodeTextW(child, if (constrainW > 0) constrainW else 0);
                                childCrossSize[@intCast(i)] = clampVal(m.height + cpt + cpb, resolveMaybePct(child.style.min_height, innerH), resolveMaybePct(child.style.max_height, innerH));
                            }
                        }
                    } else {
                        // Column: re-estimate height at actual cross-axis width for ALL auto-height children,
                        // not just direct text nodes. Nested text may wrap at narrower widths than innerW.
                        const effAlign = resolveAlign(child.style.align_self, @"align");
                        const finalW = resolveMaybePct(child.style.width, innerW) orelse (if (effAlign == .stretch) innerW else childCrossSize[@intCast(i)]);
                        if (child.text != null) {
                            const cpl = padLeft(child.style);
                            const cpr = padRight(child.style);
                            const cpt = padTop(child.style);
                            const cpb = padBottom(child.style);
                            const constrainW = asF32(finalW) - asF32(cpl) - cpr;
                            const m = measureNodeTextW(child, if (constrainW > 0) constrainW else 0);
                            const newH = clampVal(m.height + cpt + cpb, resolveMaybePct(child.style.min_height, innerH), resolveMaybePct(child.style.max_height, innerH));
                            if (child.style.height == null) {
                                childBasis[@intCast(i)] = newH;
                                childMainSize[@intCast(i)] = newH;
                            }
                            childCrossSize[@intCast(i)] = finalW;
                        }
                    }
                }
            }
            const lineCross = lineCrossSizes[@intCast(lineIdx)];
            var usedMain: f32 = 0;
            {
                var i = ls;
                while (i < ls + lc) : (i += 1) {
                    usedMain += childBasis[@intCast(i)] + childMainMarginStart[@intCast(i)] + childMainMarginEnd[@intCast(i)];
                }
            }
            const freeMain = mainSize - usedMain - lineGaps;
            // Auto margins: distribute free space to auto margins before justify-content
            var autoMarginCount: usize = 0;
            // Pre-scan: count auto margins even before checking freeMain
            // (needed to zero out the auto margin from usedMain calculation)
            {
                var am_pre = ls;
                while (am_pre < ls + lc) : (am_pre += 1) {
                    const am_pre_ci = visibleIndices[@intCast(am_pre)];
                    const am_pre_cs = node.children[@intCast(am_pre_ci)].style;
                    if (isRow) {
                        if (am_pre_cs.isMarginAutoLeft()) autoMarginCount += 1;
                        if (am_pre_cs.isMarginAutoRight()) autoMarginCount += 1;
                    } else {
                        if (am_pre_cs.isMarginAutoTop()) autoMarginCount += 1;
                        if (am_pre_cs.isMarginAutoBottom()) autoMarginCount += 1;
                    }
                }
            }


            if (freeMain > 0 and autoMarginCount > 0) {
                {
                    const perAuto = freeMain / @as(f32, @floatFromInt(autoMarginCount));
                    var am_j = ls;
                    while (am_j < ls + lc) : (am_j += 1) {
                        const am_cj = visibleIndices[@intCast(am_j)];
                        const am_cs = node.children[@intCast(am_cj)].style;
                        if (isRow) {
                            if (am_cs.isMarginAutoLeft()) childMainMarginStart[@intCast(am_j)] = perAuto;
                            if (am_cs.isMarginAutoRight()) childMainMarginEnd[@intCast(am_j)] = perAuto;
                        } else {
                            if (am_cs.isMarginAutoTop()) childMainMarginStart[@intCast(am_j)] = perAuto;
                            if (am_cs.isMarginAutoBottom()) childMainMarginEnd[@intCast(am_j)] = perAuto;
                        }
                    }
                }
            }
            var mainOffset: f32 = 0;
            var extraGap: f32 = 0;
            // Don't apply justify offsets when the main axis is auto-sized (h == null for columns).
            // The 9999 sentinel is not a real size — centering against it produces absurd offsets.
            const mainAxisAuto = if (isRow) false else autoHeight;
            if (!mainAxisAuto and autoMarginCount == 0) {
                switch (justify) {
                    .center => {
                        mainOffset = @floor(freeMain / 2);
                    },
                    .end => {
                        mainOffset = freeMain;
                    },
                    .space_between => {
                        if (lc > 1) {
                            extraGap = freeMain / @as(f32, @floatFromInt((lc - 1)));
                        }
                    },
                    .space_around => {
                        if (lc > 0) {
                            extraGap = freeMain / @as(f32, @floatFromInt(lc));
                            mainOffset = @floor(extraGap / 2);
                        }
                    },
                    .space_evenly => {
                        if (lc > 0) {
                            extraGap = freeMain / @as(f32, @floatFromInt((lc + 1)));
                            mainOffset = @floor(extraGap);
                        }
                    },
                    .start => {},
                }
            }
            var cursor = if (isReverse) mainSize - mainOffset else mainOffset;
            {
                var i = ls;
                while (i < ls + lc) : (i += 1) {
                    const childIdx = visibleIndices[@intCast(i)];
                    const child = &node.children[@intCast(childIdx)];
                    var cx: f32 = undefined;
                    var cy: f32 = undefined;
                    var cwFinal: f32 = undefined;
                    var chFinal: f32 = undefined;
                    const effAlign = resolveAlign(child.style.align_self, @"align");
                    if (isRow) {
                        cwFinal = clampVal(childBasis[@intCast(i)], resolveMaybePct(child.style.min_width, innerW), resolveMaybePct(child.style.max_width, innerW));
                        if (isReverse) {
                            cursor -= childMainMarginEnd[@intCast(i)] + cwFinal;
                        } else {
                            cursor += childMainMarginStart[@intCast(i)];
                        }
                        cx = x + pl + cursor;
                        chFinal = childCrossSize[@intCast(i)];
                        const crossAvail = lineCross - childCrossMarginStart[@intCast(i)] - childCrossMarginEnd[@intCast(i)];
                        switch (effAlign) {
                            .center => {
                                cy = y + pt + crossCursor + @floor((crossAvail - chFinal) / 2);
                            },
                            .end => {
                                cy = y + pt + crossCursor + crossAvail - chFinal;
                            },
                            .stretch => {
                                cy = y + pt + crossCursor;
                                if (child.style.height == null) {
                                    chFinal = clampVal(crossAvail, resolveMaybePct(child.style.min_height, innerH), resolveMaybePct(child.style.max_height, innerH));
                                }
                            },
                            .baseline => {
                                // Baseline alignment: offset by ascent difference
                                // Ascent ≈ font_size * 0.8; align first text baselines
                                const childBaseline = padTop(child.style) + @as(f32, @floatFromInt(child.font_size)) * 0.8;
                                const lineBaseline = @as(f32, @floatFromInt(node.font_size)) * 0.8;
                                const maxBaseline = @max(childBaseline, lineBaseline);
                                cy = y + pt + crossCursor + (maxBaseline - childBaseline);
                            },
                            .start => {
                                cy = y + pt + crossCursor;
                            },
                        }
                    } else {
                        chFinal = clampVal(childBasis[@intCast(i)], resolveMaybePct(child.style.min_height, innerH), resolveMaybePct(child.style.max_height, innerH));
                        if (isReverse) {
                            cursor -= childMainMarginEnd[@intCast(i)] + chFinal;
                        } else {
                            cursor += childMainMarginStart[@intCast(i)];
                        }
                        cy = y + pt + cursor;
                        cwFinal = childCrossSize[@intCast(i)];
                        const crossAvail = lineCross - childCrossMarginStart[@intCast(i)] - childCrossMarginEnd[@intCast(i)];
                        switch (effAlign) {
                            .center => {
                                cx = x + pl + crossCursor + (crossAvail - cwFinal) / 2;
                            },
                            .end => {
                                cx = x + pl + crossCursor + crossAvail - cwFinal;
                            },
                            .stretch => {
                                cx = x + pl + crossCursor;
                                if (child.style.width == null) {
                                    cwFinal = clampVal(crossAvail, resolveMaybePct(child.style.min_width, innerW), resolveMaybePct(child.style.max_width, innerW));
                                }
                            },
                            .baseline => {
                                // Baseline on cross=horizontal doesn't apply; treat as start
                                cx = x + pl + crossCursor;
                            },
                            .start => {
                                cx = x + pl + crossCursor;
                            },
                        }
                    }
                    if (isRow) {
                        if (child.style.width == null or cwFinal != (child.style.width orelse 0)) {
                            child._flex_w = cwFinal;
                        }
                        if (child.style.height == null and effAlign == .stretch) {
                            child._stretch_h = chFinal;
                        } else if (child.style.height != null and child.style.height.? < 0) {
                            // Percentage height already resolved — prevent double-resolution
                            child._stretch_h = chFinal;
                        }
                    } else {
                        if (child.style.height == null and child.style.flex_grow > 0) {
                            child._stretch_h = chFinal;
                        } else if (child.style.height != null and child.style.height.? < 0) {
                            // Percentage height already resolved — prevent double-resolution
                            child._stretch_h = chFinal;
                        } else if (child.style.height != null and chFinal < (resolveMaybePct(child.style.height, innerH) orelse chFinal)) {
                            // Flex shrink: child was compressed below its explicit height
                            child._stretch_h = chFinal;
                        }
                        if (child.style.width == null and effAlign == .stretch) {
                            child._flex_w = cwFinal;
                        } else if (child.style.width != null and child.style.width.? < 0) {
                            // Percentage width already resolved — prevent double-resolution
                            child._flex_w = cwFinal;
                        }
                    }
                    if (child.style.text_align == .left and s.text_align != .left) {
                        child.style.text_align = s.text_align;
                    }
                    child._parent_inner_w = innerW;
                    child._parent_inner_h = innerH;
                    layoutNode(child, cx, cy, cwFinal, chFinal);
                    const actualMain = if (isRow) child.computed.w else child.computed.h;
                    if (isReverse) {
                        cursor -= childMainMarginStart[@intCast(i)] + gap + extraGap;
                    } else {
                        cursor += actualMain + childMainMarginEnd[@intCast(i)] + gap + extraGap;
                    }
                    if (isRow) {
                        const me = (child.computed.x - x) + child.computed.w + childMainMarginEnd[@intCast(i)];
                        const ce = (child.computed.y - y) + child.computed.h + childCrossMarginEnd[@intCast(i)];
                        if (me > contentMainEnd) {
                            contentMainEnd = me;
                        }
                        if (ce > contentCrossEnd) {
                            contentCrossEnd = ce;
                        }
                    } else {
                        const me = (child.computed.y - y) + child.computed.h + childMainMarginEnd[@intCast(i)];
                        const ce = (child.computed.x - x) + child.computed.w + childCrossMarginEnd[@intCast(i)];
                        if (me > contentMainEnd) {
                            contentMainEnd = me;
                        }
                        if (ce > contentCrossEnd) {
                            contentCrossEnd = ce;
                        }
                    }
                }
            }
            crossCursor += lineCross + (if (lineIdx + 1 < numLines) crossGapVal + extraCrossGap else 0);
        }
    }
    if (h == null) {
        if (node.input_id != null) {
            h = @as(f32, @floatFromInt(node.font_size)) + pt + pb;
        } else
        // tslx:GEN:INTRINSIC_HEIGHT_FALLBACK START
        if (node.gutter_rows) |gr| {
            h = @as(f32, @floatFromInt(gr.len)) * node.gutter_row_height + pt + pb;
        } else
        if (node.minimap_rows) |gr| {
            h = @as(f32, @floatFromInt(gr.len)) * (node.minimap_row_height + node.minimap_row_gap) + pt + pb;
        } else
        // tslx:GEN:INTRINSIC_HEIGHT_FALLBACK END
        if (node.text != null) {
            const m = measureNodeTextW(node, innerW);
            h = m.height + pt + pb;
        } else if (isRow) {
            h = contentCrossEnd + pb;
        } else {
            h = contentMainEnd + pb;
        }
        if (h != null) {
            h.? = clampVal(h.?, resolveMaybePct(s.min_height, ph), resolveMaybePct(s.max_height, ph));
        }
    }
    if (s.overflow == .scroll or s.overflow == .hidden or s.overflow == .auto) {
        node.content_width = if (isRow) contentMainEnd + pr else contentCrossEnd + pr;
        node.content_height = if (isRow) contentCrossEnd + pb else contentMainEnd + pb;
    }
    const resolvedH = h orelse 0;
    {
        var ai: usize = 0;
        while (ai < absoluteCount) : (ai += 1) {
            const absIdx = absoluteIndices[@intCast(ai)];
            const absChild = &node.children[@intCast(absIdx)];
            const acs = absChild.style;
            var absW: f32 = undefined;
            const resolvedW = resolveMaybePct(acs.width, innerW);
            if (resolvedW != null) {
                absW = resolvedW.?;
            } else if (acs.left != null and acs.right != null) {
                absW = innerW - (acs.left orelse 0) - (acs.right orelse 0);
            } else {
                absW = estimateIntrinsicWidth(absChild);
            }
            absW = clampVal(absW, resolveMaybePct(acs.min_width, innerW), resolveMaybePct(acs.max_width, innerW));
            const absInnerH = resolvedH - pt - pb;
            var absH: f32 = undefined;
            const resolvedAH = resolveMaybePct(acs.height, absInnerH);
            if (resolvedAH != null) {
                absH = resolvedAH.?;
            } else if (acs.top != null and acs.bottom != null) {
                absH = absInnerH - (acs.top orelse 0) - (acs.bottom orelse 0);
            } else {
                absH = estimateIntrinsicHeight(absChild, absW);
            }
            absH = clampVal(absH, resolveMaybePct(acs.min_height, absInnerH), resolveMaybePct(acs.max_height, absInnerH));
            var absX = x + pl;
            var absY = y + pt;
            if (acs.left != null) {
                absX = x + pl + acs.left.?;
            } else if (acs.right != null) {
                absX = asF32(x + pl + innerW - absW) - asF32(acs.right);
            }
            if (acs.top != null) {
                absY = y + pt + acs.top.?;
            } else if (acs.bottom != null) {
                absY = asF32(y + pt + absInnerH - absH) - asF32(acs.bottom);
            }
            absChild._flex_w = absW;
            absChild._stretch_h = absH;
            layoutNode(absChild, absX, absY, absW, absH);
        }
    }
    node.computed = .{ .x = x, .y = y, .w = w, .h = resolvedH };
}

fn resolveAlign(self: AlignSelf, parent: AlignItems) AlignItems {
    switch (self) {
        .auto => {
            return parent;
        },
        .start => {
            return .start;
        },
        .center => {
            return .center;
        },
        .end => {
            return .end;
        },
        .stretch => {
            return .stretch;
        },
        .baseline => {
            return .baseline;
        },
    }
}

pub fn layout(root: *Node, x: f32, y: f32, w: f32, h: f32) void {
    layoutCount = 0;
    invalidateTextCache();
    invalidateCaches(root);
    root._flex_w = w;
    root._stretch_h = h;
    layoutNode(root, x, y, w, h);
    if (log.isEnabled(.layout)) logTree(root, 0);
}

fn logTree(node: *Node, depth: u32) void {
    const name = node.debug_name orelse "?";
    const r = node.computed;
    const zero: []const u8 = if (r.w <= 0 or r.h <= 0) " <<ZERO>>" else "";
    log.info(.layout, "d={d} node={s} x={d:.0} y={d:.0} w={d:.0} h={d:.0}{s}", .{ depth, name, r.x, r.y, r.w, r.h, zero });
    for (node.children) |*child| logTree(child, depth + 1);
}

fn invalidateCaches(node: *Node) void {
    node._cache_iw = -1;
    node._cache_ih = -1;
    node._cache_ih_avail = -1;
    for (node.children) |*child| {
        invalidateCaches(child);
    }
}

// ── Telemetry ────────────────────────────────────────────────────────────

pub fn telemetryBudget() u32 {
    return LAYOUT_BUDGET;
}

pub fn telemetryBudgetUsed() u32 {
    return @intCast(layoutCount);
}
