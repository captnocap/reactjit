//! ReactJIT Engine — owns the window lifecycle, GPU, text, layout, paint, and event loop.
//!
//! The generated app provides a node tree + callbacks. The engine handles everything else.
//! Adding new framework modules (geometry, watchdog, etc.) happens here — no codegen changes needed.

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const gpu = @import("gpu/gpu.zig");
const geometry = @import("geometry.zig");
const selection = @import("selection.zig");
const breakpoint = @import("breakpoint.zig");
const windows = @import("windows.zig");
const svg_path = @import("svg_path.zig");
const log = @import("log.zig");
const tooltip = @import("tooltip.zig");
const telemetry = @import("telemetry.zig");
const filedrop = @import("filedrop.zig");
const input = @import("input.zig");
const classifier = @import("classifier.zig");
const semantic = @import("semantic.zig");

// ── Build-option-gated imports (lean tier omits these) ──────────────────
const build_options = @import("build_options");
const HAS_QUICKJS = if (@hasDecl(build_options, "has_quickjs")) build_options.has_quickjs else true;
const HAS_PHYSICS = if (@hasDecl(build_options, "has_physics")) build_options.has_physics else true;
const HAS_TERMINAL = if (@hasDecl(build_options, "has_terminal")) build_options.has_terminal else true;
const HAS_VIDEO = if (@hasDecl(build_options, "has_video")) build_options.has_video else true;
const HAS_RENDER_SURFACES = if (@hasDecl(build_options, "has_render_surfaces")) build_options.has_render_surfaces else true;
const HAS_EFFECTS = if (@hasDecl(build_options, "has_effects")) build_options.has_effects else true;
const HAS_CANVAS = if (@hasDecl(build_options, "has_canvas")) build_options.has_canvas else true;
const HAS_3D = if (@hasDecl(build_options, "has_3d")) build_options.has_3d else true;
const HAS_TRANSITIONS = if (@hasDecl(build_options, "has_transitions")) build_options.has_transitions else true;
const HAS_CRYPTO = if (@hasDecl(build_options, "has_crypto")) build_options.has_crypto else true;
const HAS_DEBUG_SERVER = if (@hasDecl(build_options, "has_debug_server")) build_options.has_debug_server else false;

const debug_server = if (HAS_DEBUG_SERVER) @import("debug_server.zig") else struct {
    pub fn init() void {}
    pub fn poll() void {}
    pub fn deinit() void {}
    pub fn getSelectedNode() i32 { return -1; }
};

// Force-reference crypto.zig so its export fn symbols (e.g. crypto_run_all_tests) are available to the linker.
comptime {
    if (HAS_CRYPTO) _ = @import("crypto.zig");
}

const qjs_runtime = if (HAS_QUICKJS) @import("qjs_runtime.zig") else struct {
    pub fn initVM() void {}
    pub fn deinit() void {}
    pub fn tick() void {}
    pub fn evalScript(_: []const u8) void {}
    pub fn ptyActive() bool { return false; }
    pub fn ptyHandleTextInput(_: [*:0]const u8) void {}
    pub fn ptyHandleKeyDown(_: i32, _: u16) void {}
    pub var telemetry_tick_us: i64 = 0;
    pub var telemetry_layout_us: i64 = 0;
    pub var telemetry_paint_us: i64 = 0;
    pub var telemetry_fps: u32 = 0;
    pub var telemetry_bridge_calls: u32 = 0;
    pub var bridge_calls_this_second: u32 = 0;
};
const canvas = if (HAS_CANVAS) @import("canvas.zig") else struct {
    pub const CameraTransform = struct { cx: f32 = 0, cy: f32 = 0, scale: f32 = 1 };
    pub fn init() void {}
    pub fn setCamera(_: f32, _: f32, _: f32) void {}
    pub fn getHoveredNode() ?u16 { return null; }
    pub fn setHoveredNode(_: ?u16) void {}
    pub fn getSelectedNode() ?u16 { return null; }
    pub fn clickNode() void {}
    pub fn screenToGraph(_: f32, _: f32, _: f32, _: f32) [2]f32 { return .{ 0, 0 }; }
    pub fn handleDrag(_: f32, _: f32) void {}
    pub fn handleScroll(_: f32, _: f32, _: f32, _: f32, _: f32) void {}
    pub fn renderCanvas(_: ?[]const u8, _: f32, _: f32, _: f32, _: f32) void {}
    pub fn getCameraTransform(_: f32, _: f32, _: f32, _: f32) CameraTransform { return .{}; }
    pub fn getNodeDim(_: u16) f32 { return 1.0; }
    pub fn getFlowOverride(_: u16) bool { return true; }
};
const devtools = if (HAS_QUICKJS) @import("devtools.zig") else struct {
    pub var root: layout.Node = .{};
    pub fn _appInit() void {}
    pub fn _appTick(_: u32) void {}
    pub const JS_LOGIC: []const u8 = "";
};
const testharness = if (HAS_QUICKJS) @import("testharness.zig") else struct {
    pub fn envEnabled() bool { return false; }
    pub fn enable() void {}
    pub fn tick() bool { return false; }
    pub fn runAll(_: *Node) u8 { return 0; }
};
const videos = if (HAS_VIDEO) @import("videos.zig") else struct {
    pub fn init() void {}
    pub fn deinit() void {}
    pub fn update() void {}
    pub fn handleKey(_: i32) bool { return false; }
    pub fn paintVideo(_: ?[]const u8, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
};
const render_surfaces = if (HAS_RENDER_SURFACES) @import("render_surfaces.zig") else struct {
    pub fn init() void {}
    pub fn deinit() void {}
    pub fn update() void {}
    pub fn handleMouseDown(_: f32, _: f32, _: u8) bool { return false; }
    pub fn handleMouseUp(_: f32, _: f32, _: u8) bool { return false; }
    pub fn handleMouseMotion(_: f32, _: f32) bool { return false; }
    pub fn handleTextInput(_: [*:0]const u8) bool { return false; }
    pub fn handleKeyDown(_: i32) bool { return false; }
    pub fn handleKeyUp(_: i32) bool { return false; }
    pub fn paintSurface(_: ?[]const u8, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
};
const capture = if (HAS_EFFECTS) @import("capture.zig") else struct {
    pub fn init() void {}
    pub fn deinit() void {}
    pub fn handleKey(_: i32) bool { return false; }
    pub fn tick(_: *Node) bool { return false; }
};
const effect_ctx = @import("effect_ctx.zig");
const effects = if (HAS_EFFECTS) @import("effects.zig") else struct {
    pub fn init() void {}
    pub fn deinit() void {}
    pub fn update(_: f32) void {}
    pub fn paintEffect(_: ?[]const u8, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
    pub fn paintCustomEffect(_: effect_ctx.RenderFn, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
};
const r3d = if (HAS_3D) @import("gpu/3d.zig") else struct {
    pub fn render(_: *Node, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
    pub fn update(_: f32) void {}
};
const transition = if (HAS_TRANSITIONS) @import("transition.zig") else struct {
    pub fn tick(_: f32) bool { return false; }
};
const vterm_mod = if (HAS_TERMINAL) @import("vterm.zig") else VtermStub;
const VtermStub = struct {
    pub const VtColor = struct { r: u8 = 0, g: u8 = 0, b: u8 = 0 };
    pub const Cell = struct {
        char_buf: [4]u8 = .{ 0, 0, 0, 0 }, char_len: u8 = 0, width: u8 = 1,
        fg: ?VtColor = null, bg: ?VtColor = null, bold: bool = false,
        italic: bool = false, underline: bool = false, strike: bool = false, reverse: bool = false,
    };
    pub fn spawnShell(_: anytype, _: u16, _: u16) void {}
    pub fn pollPty() bool { return false; }
    pub fn writePty(_: []const u8) void {}
    pub fn getCell(_: u16, _: u16) Cell { return .{}; }
    pub fn getRows() u16 { return 0; }
    pub fn getCols() u16 { return 0; }
    pub fn getCursorVisible() bool { return false; }
    pub fn getCursorRow() u16 { return 0; }
    pub fn getCursorCol() u16 { return 0; }
    pub fn resizeVterm(_: u16, _: u16) void {}
};
const physics2d = if (HAS_PHYSICS) @import("physics2d.zig") else struct {
    pub const BodyType = enum(c_int) { static_body = 0, kinematic = 1, dynamic = 2 };
    pub fn init(_: f32, _: f32) void {}
    pub fn isInitialized() bool { return false; }
    pub fn tick(_: f32) void {}
    pub fn createBody(_: BodyType, _: f32, _: f32, _: f32, _: ?*Node) ?u32 { return null; }
    pub fn addBoxCollider(_: u32, _: f32, _: f32, _: f32, _: f32, _: f32) void {}
    pub fn addCircleCollider(_: u32, _: f32, _: f32, _: f32, _: f32) void {}
    pub fn setFixedRotation(_: u32, _: bool) void {}
    pub fn setBullet(_: u32, _: bool) void {}
    pub fn setGravityScale(_: u32, _: f32) void {}
    pub fn startDrag(_: f32, _: f32) void {}
    pub fn updateDrag(_: f32, _: f32) void {}
    pub fn endDrag() void {}
    pub fn isDragging() bool { return false; }
};
const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;

// ── Devtools state ──────────────────────────────────────────────────────
var devtools_visible: bool = false;
var devtools_initialized: bool = false;
const DEVTOOLS_HEIGHT: f32 = 360;

// ── Cursor blink state ───────────────────────────────────────────────────
var g_cursor_visible: bool = true;
var g_prev_tick: u32 = 0;

// ── Physics 2D state ────────────────────────────────────────────────────
var physics_initialized: bool = false;

// ── Terminal state ──────────────────────────────────────────────────────
var terminal_initialized: bool = false;
var term_sel_active: bool = false;
var term_sel_dragging: bool = false;
var term_sel_start_row: u16 = 0;
var term_sel_start_col: u16 = 0;
var term_sel_end_row: u16 = 0;
var term_sel_end_col: u16 = 0;

fn termPixelToCell(tn: *Node, mx: f32, my: f32) struct { row: u16, col: u16 } {
    const r = tn.computed;
    const font_size = tn.terminal_font_size;
    const padding: f32 = 4;
    const cell_w = gpu.getCharWidth(font_size);
    const cell_h = gpu.getLineHeight(font_size);
    if (cell_w <= 0 or cell_h <= 0) return .{ .row = 0, .col = 0 };
    const local_x = @max(0, mx - r.x - padding);
    const local_y = @max(0, my - r.y - padding);
    return .{
        .row = @intFromFloat(@min(@floor(local_y / cell_h), 255)),
        .col = @intFromFloat(@min(@floor(local_x / cell_w), 255)),
    };
}

fn termCellSelected(row: u16, col: u16) bool {
    if (!term_sel_active) return false;
    var r0 = term_sel_start_row; var c0 = term_sel_start_col;
    var r1 = term_sel_end_row; var c1 = term_sel_end_col;
    if (r0 > r1 or (r0 == r1 and c0 > c1)) {
        r0 = term_sel_end_row; c0 = term_sel_end_col;
        r1 = term_sel_start_row; c1 = term_sel_start_col;
    }
    if (row < r0 or row > r1) return false;
    if (r0 == r1) return col >= c0 and col <= c1;
    if (row == r0) return col >= c0;
    if (row == r1) return col <= c1;
    return true;
}

fn termClearSelection() void {
    term_sel_active = false;
    term_sel_dragging = false;
}

fn findTerminalNode(node: *Node) ?*Node {
    if (node.terminal) return node;
    for (node.children) |*child| {
        if (findTerminalNode(child)) |found| return found;
    }
    return null;
}

/// Route SDL key event to the terminal PTY as ANSI escape sequences.
fn terminalHandleKey(sym: i32, mod_state: u16) void {
    const ctrl = (mod_state & @as(u16, c.KMOD_CTRL)) != 0;
    termClearSelection();
    vterm_mod.scrollToBottom();
    // Ctrl+letter → raw control character
    if (ctrl and sym >= 'a' and sym <= 'z') {
        const buf = [1]u8{@intCast(sym - 'a' + 1)};
        vterm_mod.writePty(&buf);
        return;
    }
    // Special keys → ANSI escape sequences
    const seq: ?[]const u8 = switch (sym) {
        c.SDLK_RETURN => "\r",
        c.SDLK_BACKSPACE => "\x7f",
        c.SDLK_TAB => "\t",
        c.SDLK_ESCAPE => "\x1b",
        c.SDLK_UP => "\x1b[A",
        c.SDLK_DOWN => "\x1b[B",
        c.SDLK_RIGHT => "\x1b[C",
        c.SDLK_LEFT => "\x1b[D",
        c.SDLK_HOME => "\x1b[H",
        c.SDLK_END => "\x1b[F",
        c.SDLK_DELETE => "\x1b[3~",
        c.SDLK_PAGEUP => "\x1b[5~",
        c.SDLK_PAGEDOWN => "\x1b[6~",
        c.SDLK_INSERT => "\x1b[2~",
        c.SDLK_F1 => "\x1bOP",
        c.SDLK_F2 => "\x1bOQ",
        c.SDLK_F3 => "\x1bOR",
        c.SDLK_F4 => "\x1bOS",
        c.SDLK_F5 => "\x1b[15~",
        c.SDLK_F6 => "\x1b[17~",
        c.SDLK_F7 => "\x1b[18~",
        c.SDLK_F8 => "\x1b[19~",
        c.SDLK_F9 => "\x1b[20~",
        c.SDLK_F10 => "\x1b[21~",
        c.SDLK_F11 => "\x1b[23~",
        else => null,
    };
    if (seq) |s| vterm_mod.writePty(s);
}

fn terminalHandleTextInput(text: [*:0]const u8) void {
    const slice = std.mem.span(text);
    std.debug.print("[terminal] textInput: len={d} chars=\"{s}\"\n", .{ slice.len, slice });
    if (slice.len > 0) {
        termClearSelection();
        vterm_mod.scrollToBottom();
        vterm_mod.writePty(slice);
    }
}

/// Walk the node tree to find Physics.World/Body/Collider nodes and set up the simulation.
fn initPhysicsFromTree(root: *Node) void {
    initPhysicsNode(root);
}

fn initPhysicsNode(node: *Node) void {
    if (node.physics_world) {
        physics2d.init(node.physics_gravity_x, node.physics_gravity_y);
        // Recurse into world children to find bodies
        for (node.children) |*child| {
            initPhysicsNode(child);
        }
        return;
    }
    if (node.physics_body) {
        // Create the physics body
        // Find the first visual child to link the body to
        var visual_child: ?*Node = null;
        var collider_child: ?*Node = null;
        for (node.children) |*child| {
            if (child.physics_collider) {
                collider_child = child;
            } else if (!child.physics_world and !child.physics_body) {
                visual_child = child;
            }
        }
        const body_type: physics2d.BodyType = switch (node.physics_body_type) {
            0 => .static_body,
            1 => .kinematic,
            else => .dynamic,
        };
        // Link to the visual child node (or self if no visual child)
        const target = visual_child orelse node;
        if (physics2d.createBody(body_type, node.physics_x, node.physics_y, node.physics_angle, target)) |idx| {
            node.physics_body_idx = @intCast(idx);
            // Apply body properties
            if (node.physics_fixed_rotation) physics2d.setFixedRotation(idx, true);
            if (node.physics_bullet) physics2d.setBullet(idx, true);
            if (node.physics_gravity_scale != 1.0) physics2d.setGravityScale(idx, node.physics_gravity_scale);
            // Attach collider if found
            if (collider_child) |col| {
                if (col.physics_shape == 1) {
                    // Circle
                    physics2d.addCircleCollider(idx, col.physics_radius,
                        col.physics_density, col.physics_friction, col.physics_restitution);
                } else {
                    // Rectangle — use the visual child's dimensions or collider's own
                    const w = if (visual_child) |v| (v.style.width orelse 40) else 40;
                    const h = if (visual_child) |v| (v.style.height orelse 40) else 40;
                    physics2d.addBoxCollider(idx, w, h,
                        col.physics_density, col.physics_friction, col.physics_restitution);
                }
            }
        }
        return;
    }
    // Recurse
    for (node.children) |*child| {
        initPhysicsNode(child);
    }
}

// ── Hover state ─────────────────────────────────────────────────────────

var hovered_node: ?*Node = null;
var cursor_hand: ?*c.SDL_Cursor = null;
var cursor_arrow: ?*c.SDL_Cursor = null;
var cursor_is_hand: bool = false;

fn updateHover(root: *Node, mx: f32, my: f32) void {
    const events = @import("events.zig");
    const hit = events.hitTestHoverable(root, mx, my);
    if (hit == hovered_node) return;

    // Exit previous
    if (hovered_node) |prev| {
        if (prev.handlers.on_hover_exit) |handler| handler();
    }
    hovered_node = hit;
    // Enter new
    if (hit) |node| {
        if (node.handlers.on_hover_enter) |handler| handler();
        // Tooltip: show if node carries tooltip text
        if (node.tooltip) |tt| {
            const r = node.computed;
            tooltip.show(tt, r.x, r.y, r.w, r.h);
        } else {
            tooltip.hide();
        }
        // Hand cursor for href links
        if (node.href != null) {
            if (!cursor_is_hand) {
                if (cursor_hand == null) cursor_hand = c.SDL_CreateSystemCursor(c.SDL_SYSTEM_CURSOR_HAND);
                if (cursor_hand) |cur| c.SDL_SetCursor(cur);
                cursor_is_hand = true;
            }
        } else if (cursor_is_hand) {
            if (cursor_arrow == null) cursor_arrow = c.SDL_CreateSystemCursor(c.SDL_SYSTEM_CURSOR_ARROW);
            if (cursor_arrow) |cur| c.SDL_SetCursor(cur);
            cursor_is_hand = false;
        }
    } else {
        tooltip.hide();
        if (cursor_is_hand) {
            if (cursor_arrow == null) cursor_arrow = c.SDL_CreateSystemCursor(c.SDL_SYSTEM_CURSOR_ARROW);
            if (cursor_arrow) |cur| c.SDL_SetCursor(cur);
            cursor_is_hand = false;
        }
    }
}

fn brighten(color: Color, amount: u8) Color {
    return .{
        .r = @min(255, @as(u16, color.r) + amount),
        .g = @min(255, @as(u16, color.g) + amount),
        .b = @min(255, @as(u16, color.b) + amount),
        .a = color.a,
    };
}

// ── App interface ────────────────────────────────────────────────────────

pub const AppConfig = struct {
    title: [*:0]const u8 = "tsz app",
    width: u32 = 1280,
    height: u32 = 800,
    min_width: u32 = 320,
    min_height: u32 = 240,
    root: *Node,
    js_logic: []const u8 = "",
    /// Called once after QuickJS VM is ready. Register FFI host functions, set initial state.
    init: ?*const fn () void = null,
    /// Called every frame before layout. Do FFI polling, state dirty checks, dynamic text updates.
    tick: ?*const fn (now_ms: u32) void = null,
};

// ── Text measurement (framework-owned) ──────────────────────────────────

var g_text_engine: ?*TextEngine = null;

/// Open a URL — if the app has a JS _browserNavigate handler, navigate in-app.
/// Otherwise open in the system browser via xdg-open.
fn openUrl(url: []const u8) void {
    log.info(.events, "openUrl: {s}", .{url});
    // Try in-app navigation first (browser cart defines _browserNavigate in JS)
    const qjs_rt = @import("qjs_runtime.zig");
    if (qjs_rt.hasGlobal("_browserNavigate")) {
        // Null-terminate the URL for callGlobalStr
        var url_buf: [2048]u8 = undefined;
        if (url.len < url_buf.len) {
            @memcpy(url_buf[0..url.len], url);
            url_buf[url.len] = 0;
            qjs_rt.callGlobalStr("_browserNavigate", @ptrCast(&url_buf));
            return;
        }
    }
    var cmd_buf: [2048]u8 = undefined;
    const cmd = std.fmt.bufPrint(&cmd_buf, "xdg-open '{s}' &", .{url}) catch return;
    const argv = [_][]const u8{ "sh", "-c", cmd };
    var child = std.process.Child.init(&argv, std.heap.page_allocator);
    _ = child.spawnAndWait() catch {};
}

fn measureCallback(t: []const u8, font_size: u16, max_width: f32, letter_spacing: f32, line_height: f32, max_lines: u16, no_wrap: bool) layout.TextMetrics {
    if (g_text_engine) |te| {
        return te.measureTextWrappedEx(t, font_size, max_width, letter_spacing, line_height, max_lines, no_wrap);
    }
    return .{};
}

fn measureWidthOnly(t: []const u8, font_size: u16) f32 {
    if (g_text_engine) |te| {
        return te.measureTextWrappedEx(t, font_size, 0, 0, 0, 1, true).width;
    }
    return 0;
}

fn measureImageCallback(_: []const u8) layout.ImageDims {
    return .{};
}

// ── Node painting (framework-owned) ─────────────────────────────────────

fn offsetDescendants(node: *Node, dy: f32) void {
    for (node.children) |*child| {
        child.computed.y += dy;
        offsetDescendants(child, dy);
    }
}

/// Recursively offset a node and all descendants by dx/dy.
fn offsetNodeXY(node: *Node, dx: f32, dy: f32) void {
    node.computed.x += dx;
    node.computed.y += dy;
    for (node.children) |*child| offsetNodeXY(child, dx, dy);
}

/// Translate Canvas.Node children from flex positions to raw graph-space.
/// gx/gy is the center of the node in graph space.
/// GPU transform maps graph space → screen space.
fn positionCanvasNodes(parent: *Node) void {
    for (parent.children) |*child| {
        if (!child.canvas_node) continue;
        // Place at raw graph coordinates (gx/gy = center)
        const target_x = child.canvas_gx - child.computed.w / 2;
        const target_y = child.canvas_gy - child.computed.h / 2;
        const dx = target_x - child.computed.x;
        const dy = target_y - child.computed.y;
        child.computed.x = target_x;
        child.computed.y = target_y;
        for (child.children) |*gc| offsetNodeXY(gc, dx, dy);
    }
}

var g_paint_count: u32 = 0;
var g_hidden_count: u32 = 0;
var g_zero_count: u32 = 0;
var g_dt_sec: f32 = 0;
var g_paint_opacity: f32 = 1.0; // global opacity multiplier for dim/highlight
var g_flow_enabled: bool = true; // per-child flow override for hover mode
var g_hover_changed: bool = false; // debug flag

// Canvas drag state — tracks which canvas is being dragged for pan
var canvas_drag_node: ?*Node = null;
var canvas_drag_last_x: f32 = 0;
var canvas_drag_last_y: f32 = 0;

// TextInput drag-select state
var input_drag_active: bool = false;
var input_drag_id: u8 = 0;
var input_drag_node_x: f32 = 0; // node rect x (for computing local_x)
var input_drag_node_pl: f32 = 0; // node padding-left
var input_drag_font_size: u16 = 0;

fn paintNode(node: *Node) void {
    if (node.style.display == .none) { g_hidden_count += 1; return; }
    g_paint_count += 1;

    // Canvas.Path: draw before size check
    if (node.canvas_path) { paintCanvasPath(node); return; }

    const r = node.computed;
    if (r.w <= 0 or r.h <= 0) { g_zero_count += 1; return; }

    // Apply node opacity (cascades to children via g_paint_opacity)
    const saved_opacity = g_paint_opacity;
    if (node.style.opacity < 1.0) {
        g_paint_opacity *= node.style.opacity;
    }
    if (g_paint_opacity <= 0) { g_paint_opacity = saved_opacity; return; }

    // Paint this node's visuals (background, text, input, selection)
    paintNodeVisuals(node);

    // Background effects — children with effect_background paint behind siblings
    for (node.children) |*child| {
        if (child.effect_background and child.effect_render != null) {
            _ = effects.paintCustomEffect(child.effect_render.?, r.x, r.y, r.w, r.h, g_paint_opacity);
        }
    }

    // Canvas rendering — separate heavy path
    if (node.canvas_type != null) { paintCanvasContainer(node); return; }

    // Overflow clipping + scroll offset + recurse children
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    const is_clipped = is_scroll or ov == .hidden;

    if (is_clipped) gpu.pushScissor(r.x, r.y, r.w, r.h);

    if (is_scroll and node.scroll_y != 0) {
        const sy = node.scroll_y;
        offsetDescendants(node, -sy);
        for (node.children) |*child| if (!child.effect_background) paintNode(child);
        offsetDescendants(node, sy);
    } else {
        for (node.children) |*child| if (!child.effect_background) paintNode(child);
    }

    if (is_clipped) gpu.popScissor();
    g_paint_opacity = saved_opacity;
}

/// Paint a Canvas.Path node (SVG stroke curves). Separated to keep paintNode frame small.
fn paintCanvasPath(node: *Node) callconv(.auto) void {
    @setRuntimeSafety(false);
    if (node.canvas_path_d) |d| {
        const tc = node.text_color orelse Color.rgb(255, 255, 255);
        const path = svg_path.parsePath(d);
        svg_path.drawStrokeCurves(
            &path,
            @as(f32, @floatFromInt(tc.r)) / 255.0,
            @as(f32, @floatFromInt(tc.g)) / 255.0,
            @as(f32, @floatFromInt(tc.b)) / 255.0,
            @as(f32, @floatFromInt(tc.a)) / 255.0 * g_paint_opacity,
            node.canvas_stroke_width,
            if (g_flow_enabled) node.canvas_flow_speed else 0,
            c.SDL_GetTicks(),
        );
    }
}

/// Paint node visuals: background, hover, text, selection, text input.
/// Separated from paintNode to reduce the recursive frame size.
noinline fn paintNodeVisuals(node: *Node) void {
    const r = node.computed;
    const is_hovered = (hovered_node == node) and (node.handlers.on_hover_enter != null or node.handlers.on_hover_exit != null or node.hoverable);

    if (is_hovered and node.style.background_color == null) {
        gpu.drawRect(r.x, r.y, r.w, r.h, 0.15, 0.15, 0.22, 0.6, node.style.border_radius, 0, 0, 0, 0, 0);
    }

    if (node.style.background_color) |bg_raw| {
        if (bg_raw.a > 0) {
            const bg = if (is_hovered) brighten(bg_raw, 20) else bg_raw;
            const bc = node.style.border_color orelse Color.rgb(0, 0, 0);
            const has_transform = node.style.rotation != 0 or node.style.scale_x != 1.0 or node.style.scale_y != 1.0;
            if (has_transform) {
                gpu.drawRectTransformed(
                    r.x, r.y, r.w, r.h,
                    @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                    @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                    node.style.border_radius, node.style.border_width,
                    @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                    @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                    node.style.rotation, node.style.scale_x, node.style.scale_y,
                );
            } else {
                gpu.drawRect(
                    r.x, r.y, r.w, r.h,
                    @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                    @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                    node.style.border_radius, node.style.border_width,
                    @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                    @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                );
            }
        }
    }

    // Video frame — draw after background, before text
    if (node.video_src) |src| {
        _ = videos.paintVideo(src, r.x, r.y, r.w, r.h, g_paint_opacity);
    }

    // Render surface — screen capture, webcam, VM, etc.
    if (node.render_src) |src| {
        _ = render_surfaces.paintSurface(src, r.x, r.y, r.w, r.h, g_paint_opacity);
    }

    // Effect — generative visual
    if (node.effect_type) |etype| {
        _ = effects.paintEffect(etype, r.x, r.y, r.w, r.h, g_paint_opacity);
    }
    // Custom effect — user-compiled onRender callback
    if (node.effect_render) |render_fn| {
        _ = effects.paintCustomEffect(render_fn, r.x, r.y, r.w, r.h, g_paint_opacity);
    }
    // 3D.View — 3D viewport rendered offscreen, composited here
    if (node.scene3d) {
        _ = r3d.render(node, r.x, r.y, r.w, r.h, g_paint_opacity);
    }

    selection.paintHighlight(node, r.x, r.y);

    // Terminal — cell-grid rendering via vterm
    if (node.terminal) paintTerminal(node);

    if (node.text) |t| {
        if (t.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            const final_a = @as(f32, @floatFromInt(tc.a)) / 255.0 * g_paint_opacity;
            const text_h = gpu.drawTextWrapped(
                t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
                @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0, final_a, node.number_of_lines,
            );
            // Underline for href links — span text content width, not node width
            if (node.href != null) {
                const text_w = measureWidthOnly(t, node.font_size);
                const underline_y = r.y + pt + text_h - 2;
                gpu.drawRect(r.x + pl, underline_y, text_w, 1,
                    @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                    @as(f32, @floatFromInt(tc.b)) / 255.0, final_a * 0.6,
                    0, 0, 0, 0, 0, 0);
            }
        }
    }

    if (node.input_id) |id| paintTextInput(node, id);
}

/// Paint TextInput: typed text, placeholder, selection highlight, blinking cursor.
noinline fn paintTextInput(node: *Node, id: u8) void {
    const r = node.computed;
    if (input.isFocused(id)) {
        const pad: f32 = 4;
        gpu.drawRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 0, 0, 0, 0, 5, 1.5, 0.30, 0.56, 0.92, 0.7);
    }
    const typed = input.getText(id);
    const is_placeholder = typed.len == 0;
    if (!is_placeholder) {
        const sel = input.getSelection(id);
        if (sel.hi > sel.lo) {
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            gpu.drawSelectionRects(typed, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr), sel.lo, sel.hi);
        }
    }
    const display_text: ?[]const u8 = if (!is_placeholder) typed else node.placeholder;
    if (display_text) |t| {
        if (t.len > 0) {
            const tc = if (is_placeholder)
                Color.rgb(100, 100, 110)
            else
                (node.text_color orelse Color.rgb(220, 220, 220));
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            _ = gpu.drawTextWrapped(
                t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
                @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0, @as(f32, @floatFromInt(tc.a)) / 255.0, 0,
            );
        }
    }
    if (input.isFocused(id) and g_cursor_visible) {
        const cursor_pos = input.getCursorPos(id);
        const pl = node.style.padLeft();
        const pt = node.style.padTop();
        const pb = node.style.padBottom();
        const metrics = measureCallback(typed[0..cursor_pos], node.font_size, r.w - pl - node.style.padRight(), 0, 0, 1, true);
        const cx = r.x + pl + metrics.width;
        const ch = r.h - pt - pb;
        gpu.drawRect(cx, r.y + pt, 2, @max(ch, 4), 1, 1, 1, 0.8, 0, 0, 0, 0, 0, 0);
    }
}

/// Paint a Terminal node: cell-grid rendering via vterm.
/// Each cell gets its own fg color; non-default backgrounds get a bg rect.
/// Uses span-based batching: consecutive cells with the same fg are drawn as one string.
noinline fn paintTerminal(node: *Node) void {
    const r = node.computed;
    const font_size = node.terminal_font_size;
    const padding: f32 = 4;

    const cell_w = gpu.getCharWidth(font_size);
    const cell_h = gpu.getLineHeight(font_size);
    if (cell_w <= 0 or cell_h <= 0) return;

    const avail_w = r.w - padding * 2;
    const avail_h = r.h - padding * 2;
    const cols: u16 = @intFromFloat(@max(1, @floor(avail_w / cell_w)));
    const rows: u16 = @intFromFloat(@max(1, @floor(avail_h / cell_h)));

    // Auto-resize vterm to match layout (only if changed)
    const vt_rows = vterm_mod.getRows();
    const vt_cols = vterm_mod.getCols();
    if (vt_rows != rows or vt_cols != cols) {
        vterm_mod.resizeVterm(rows, cols);
    }

    const base_x = r.x + padding;
    const base_y = r.y + padding;

    // Scrollback: when scrolled up, top rows come from scrollback, rest from live screen
    const scroll_off = vterm_mod.scrollOffset();
    const sb_visible: u16 = @min(scroll_off, rows);

    // Draw cells row by row
    var row: u16 = 0;
    while (row < rows) : (row += 1) {
        const cy = base_y + @as(f32, @floatFromInt(row)) * cell_h;

        // Alternating row background for visual tracking
        if (row % 2 == 1) {
            gpu.drawRect(base_x, cy, avail_w, cell_h, 1.0, 1.0, 1.0, 0.02 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
        }

        // Left accent bar: bright for classified tokens, dim for output
        if (row >= sb_visible) {
            const live_r = row - sb_visible;
            const tok = classifier.getRowToken(live_r);
            if (tok != .output and tok != .text) {
                const ac = classifier.tokenColor(tok);
                gpu.drawRect(r.x, cy, 2, cell_h,
                    @as(f32, @floatFromInt(ac.r)) / 255.0,
                    @as(f32, @floatFromInt(ac.g)) / 255.0,
                    @as(f32, @floatFromInt(ac.b)) / 255.0,
                    0.9 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
            } else {
                gpu.drawRect(r.x, cy + cell_h * 0.35, 2, cell_h * 0.3, 0.3, 0.33, 0.4, 0.25 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
            }
        }

        var col: u16 = 0;
        while (col < cols) : (col += 1) {
            const cell = if (row < sb_visible)
                vterm_mod.getScrollbackCell(row, col)
            else
                vterm_mod.getCell(row - sb_visible, col);
            const cx = base_x + @as(f32, @floatFromInt(col)) * cell_w;

            // Selection highlight
            if (termCellSelected(row, col)) {
                gpu.drawRect(cx, cy, cell_w, cell_h, 0.3, 0.45, 0.8, 0.45 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
            }

            // Background rect (non-default bg only)
            if (cell.bg) |bg| {
                const actual_bg = if (cell.reverse) (cell.fg orelse @TypeOf(cell.fg.?){ .r = 204, .g = 204, .b = 204 }) else bg;
                gpu.drawRect(cx, cy, cell_w * @as(f32, @floatFromInt(cell.width)), cell_h,
                    @as(f32, @floatFromInt(actual_bg.r)) / 255.0,
                    @as(f32, @floatFromInt(actual_bg.g)) / 255.0,
                    @as(f32, @floatFromInt(actual_bg.b)) / 255.0,
                    g_paint_opacity, 0, 0, 0, 0, 0, 0);
            }

            // Foreground glyph — semantic color for live rows, cell color for scrollback
            if (cell.char_len > 0 and cell.char_buf[0] != ' ') {
                const default_fg = @TypeOf(cell.fg.?){ .r = 204, .g = 204, .b = 204 };
                const raw_fg = if (cell.reverse) (cell.bg orelse @TypeOf(cell.bg.?){ .r = 0, .g = 0, .b = 0 }) else (cell.fg orelse default_fg);
                // Use semantic classifier color for live screen rows
                const fg = if (row >= sb_visible) blk: {
                    const live_row = row - sb_visible;
                    const token = classifier.getRowToken(live_row);
                    if (token != .output and token != .text) {
                        const tc = classifier.tokenColor(token);
                        break :blk @TypeOf(raw_fg){ .r = tc.r, .g = tc.g, .b = tc.b };
                    }
                    break :blk raw_fg;
                } else raw_fg;
                gpu.drawGlyphAt(
                    cell.char_buf[0..cell.char_len],
                    cx, cy, font_size,
                    @as(f32, @floatFromInt(fg.r)) / 255.0,
                    @as(f32, @floatFromInt(fg.g)) / 255.0,
                    @as(f32, @floatFromInt(fg.b)) / 255.0,
                    g_paint_opacity,
                );
            }

            // Skip wide characters (CJK occupies 2 cells)
            if (cell.width > 1) col += cell.width - 1;
        }
    }

    // Scrollback indicator — dim bar at top when scrolled up
    if (scroll_off > 0) {
        gpu.drawRect(base_x, r.y, avail_w, 2, 0.5, 0.5, 0.8, 0.6 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
    }

    // Cursor — only show when at live view (not scrolled up)
    if (scroll_off == 0 and vterm_mod.getCursorVisible() and g_cursor_visible) {
        const crow = vterm_mod.getCursorRow();
        const ccol = vterm_mod.getCursorCol();
        if (crow < rows and ccol < cols) {
            const cx = base_x + @as(f32, @floatFromInt(ccol)) * cell_w;
            const cy_cur = base_y + @as(f32, @floatFromInt(crow)) * cell_h;
            gpu.drawRect(cx, cy_cur, cell_w, cell_h, 0.8, 0.8, 0.8, 0.7 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
        }
    }
}

/// Paint a Canvas container: transform setup, graph children, HUD layer.
noinline fn paintCanvasContainer(node: *Node) void {
    const r = node.computed;
    const ct = node.canvas_type.?;
    if (node.canvas_view_set) {
        canvas.setCamera(node.canvas_view_x, node.canvas_view_y, node.canvas_view_zoom);
        node.canvas_view_set = false;
    }
    // Apply drift — continuous camera animation (pauses during drag)
    if (node.canvas_drift_active and canvas_drag_node == null and g_dt_sec > 0) {
        canvas.handleDrag(-node.canvas_drift_x * g_dt_sec, -node.canvas_drift_y * g_dt_sec);
    }
    gpu.pushScissor(r.x, r.y, r.w, r.h);
    canvas.renderCanvas(ct, r.x, r.y, r.w, r.h);
    positionCanvasNodes(node);
    const cam = canvas.getCameraTransform(r.x, r.y, r.w, r.h);
    const vp_cx = r.x + r.w / 2;
    const vp_cy = r.y + r.h / 2;
    gpu.setTransform(0, 0, vp_cx - cam.cx * cam.scale, vp_cy - cam.cy * cam.scale, cam.scale);
    {
        const hovered = canvas.getHoveredNode();
        const selected = canvas.getSelectedNode();
        var child_idx: u16 = 0;
        for (node.children) |*child| {
            if (!child.canvas_clamp) {
                if (child.canvas_node) {
                    const node_selected = selected != null and selected.? == child_idx;
                    const node_hovered = hovered != null and hovered.? == child_idx;
                    if (node_selected) {
                        const hw = child.canvas_gw / 2 + 5;
                        const hh = child.canvas_gh / 2 + 5;
                        gpu.drawRect(child.canvas_gx - hw, child.canvas_gy - hh, hw * 2, hh * 2, 0.5, 0.4, 1.0, 0.4, 8, 2, 1.0, 1.0, 1.0, 0.5);
                    } else if (node_hovered) {
                        const hw = child.canvas_gw / 2 + 4;
                        const hh = child.canvas_gh / 2 + 4;
                        gpu.drawRect(child.canvas_gx - hw, child.canvas_gy - hh, hw * 2, hh * 2, 0.4, 0.3, 0.9, 0.25, 8, 0, 0, 0, 0, 0);
                    }
                }
                g_paint_opacity = canvas.getNodeDim(child_idx);
                g_flow_enabled = canvas.getFlowOverride(child_idx);
                paintNode(child);
                g_paint_opacity = 1.0;
                g_flow_enabled = true;
            }
            child_idx += 1;
        }
    }
    gpu.resetTransform();
    for (node.children) |*child| {
        if (child.canvas_clamp) {
            layout.layoutNode(child, r.x, r.y, r.w, r.h);
            paintNode(child);
        }
    }
    gpu.popScissor();
}

// ── Engine entry point ──────────────────────────────────────────────────

pub fn run(config: AppConfig) !void {
    // Debug server — auto-start if TSZ_DEBUG=1 (before SDL so it works headless)
    debug_server.init();
    defer debug_server.deinit();

    if (c.SDL_Init(c.SDL_INIT_VIDEO) != 0) return error.SDLInitFailed;
    defer c.SDL_Quit();
    log.info(.engine, "SDL initialized", .{});

    // Canvas system init
    canvas.init();

    // Geometry: restore saved window position/size
    geometry.init(std.mem.span(config.title));
    var init_x: c_int = c.SDL_WINDOWPOS_CENTERED;
    var init_y: c_int = c.SDL_WINDOWPOS_CENTERED;
    var init_w: c_int = @intCast(config.width);
    var init_h: c_int = @intCast(config.height);
    if (geometry.load()) |g| {
        init_x = g.x;
        init_y = g.y;
        init_w = g.width;
        init_h = g.height;
        log.info(.geometry, "restored {d}x{d} at ({d},{d})", .{ g.width, g.height, g.x, g.y });
    }

    const window = c.SDL_CreateWindow(
        config.title,
        init_x, init_y,
        init_w, init_h,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);
    defer windows.deinitAll(); // close all secondary windows before SDL_Quit
    c.SDL_SetWindowMinimumSize(window, @intCast(config.min_width), @intCast(config.min_height));

    // Enable text input events (SDL_TEXTINPUT) — required for keyboard input to work
    c.SDL_StartTextInput();

    if (geometry.load() != null) geometry.blockSaves();

    videos.init();
    defer videos.deinit();

    render_surfaces.init();
    defer render_surfaces.deinit();

    capture.init();
    defer capture.deinit();

    effects.init();
    defer effects.deinit();

    // GPU init
    gpu.init(window) catch |err| {
        std.debug.print("wgpu init failed: {}\n", .{err});
        return error.GPUInitFailed;
    };
    defer gpu.deinit();

    // Text engine (FreeType)
    var te = TextEngine.initHeadless("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch
        TextEngine.initHeadless("/System/Library/Fonts/Supplemental/Arial.ttf") catch
        TextEngine.initHeadless("C:/Windows/Fonts/segoeui.ttf") catch
        return error.FontNotFound;
    defer te.deinit();

    gpu.initText(te.library, te.face, te.fallback_faces, te.fallback_count);
    g_text_engine = &te;
    layout.setMeasureFn(measureCallback);
    layout.setMeasureImageFn(measureImageCallback);
    input.setMeasureWidthFn(measureWidthOnly);

    var win_w: f32 = @floatFromInt(init_w);
    var win_h: f32 = @floatFromInt(init_h);
    breakpoint.update(win_w);

    // QuickJS VM
    qjs_runtime.initVM();
    defer qjs_runtime.deinit();

    // App init (FFI registration, initial state)
    if (config.init) |initFn| initFn();

    // Test harness — enable if ZIGOS_TEST=1
    if (testharness.envEnabled()) testharness.enable();

    // Run embedded JS
    if (config.js_logic.len > 0) qjs_runtime.evalScript(config.js_logic);

    // Initial tick — set up dynamic texts after JS is evaluated
    if (config.tick) |tickFn| tickFn(c.SDL_GetTicks());

    // Main loop
    var running = true;
    var fps_frames: u32 = 0;
    var fps_last: u32 = c.SDL_GetTicks();

    while (running) {
        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event) != 0) {
            // Route to secondary windows first — if consumed, skip main window handling
            if (windows.routeEvent(&event)) continue;

            switch (event.type) {
                c.SDL_QUIT => {
                    std.debug.print("[engine] SDL_QUIT received\n", .{});
                    running = false;
                },
                c.SDL_WINDOWEVENT => {
                    switch (event.window.event) {
                        c.SDL_WINDOWEVENT_CLOSE => {
                            std.debug.print("[engine] SDL_WINDOWEVENT_CLOSE for window {d}\n", .{event.window.windowID});
                            running = false;
                        },
                        c.SDL_WINDOWEVENT_SIZE_CHANGED => {
                            win_w = @floatFromInt(event.window.data1);
                            win_h = @floatFromInt(event.window.data2);
                            gpu.resize(@intCast(event.window.data1), @intCast(event.window.data2));
                            breakpoint.update(win_w);
                            geometry.save(window);
                        },
                        c.SDL_WINDOWEVENT_MOVED => {
                            geometry.save(window);
                        },
                        else => {},
                    }
                },
                c.SDL_MOUSEBUTTONDOWN => {
                    // Render surface input forwarding (VNC mouse) — check first
                    {
                        const rmx: f32 = @floatFromInt(event.button.x);
                        const rmy: f32 = @floatFromInt(event.button.y);
                        if (render_surfaces.handleMouseDown(rmx, rmy, event.button.button)) continue;
                    }
                    // Physics drag — try to grab a dynamic body
                    if (event.button.button == c.SDL_BUTTON_LEFT and physics2d.isInitialized()) {
                        const pmx: f32 = @floatFromInt(event.button.x);
                        const pmy: f32 = @floatFromInt(event.button.y);
                        physics2d.startDrag(pmx, pmy);
                    }
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        const mx: f32 = @floatFromInt(event.button.x);
                        const my: f32 = @floatFromInt(event.button.y);
                        const events = @import("events.zig");
                        // Hit test devtools first (if visible), then app tree
                        const devtools_hit = if (devtools_visible) layout.hitTest(&devtools.root, mx, my) else null;
                        const hit = devtools_hit orelse layout.hitTest(config.root, mx, my);
                        const hit_is_interactive = if (hit) |h| (h.input_id != null or h.handlers.on_press != null or h.href != null) else false;
                        if (hit_is_interactive) {
                            const h = hit.?;
                            if (h.input_id) |id| {
                                const now_ms = c.SDL_GetTicks();
                                const clicks = input.trackClick(now_ms);
                                input.focus(id);
                                const pl = h.style.padLeft();
                                const local_x = mx - h.computed.x - pl;
                                if (clicks == 3) {
                                    input.selectAll(id);
                                } else if (clicks == 2) {
                                    input.setCursorFromX(id, local_x, h.font_size);
                                    input.selectWord(id);
                                } else {
                                    input.setCursorFromX(id, local_x, h.font_size);
                                    input.startDrag(id);
                                    input_drag_active = true;
                                    input_drag_id = id;
                                    input_drag_node_x = h.computed.x;
                                    input_drag_node_pl = pl;
                                    input_drag_font_size = h.font_size;
                                }
                            } else if (h.handlers.on_press) |handler| {
                                input.unfocus();
                                handler();
                            } else if (h.href) |url| {
                                openUrl(url);
                            }
                        } else if ((if (devtools_visible) events.findCanvasNode(&devtools.root, mx, my) else null) orelse events.findCanvasNode(config.root, mx, my)) |cn| {
                            // Canvas click + drag start (only if no HUD element was clicked)
                            input.unfocus();
                            if (canvas.getHoveredNode() != null) canvas.clickNode();
                            canvas_drag_node = cn;
                            canvas_drag_last_x = mx;
                            canvas_drag_last_y = my;
                        } else if (terminal_initialized) {
                            if (findTerminalNode(config.root)) |tn| {
                                const tr = tn.computed;
                                if (mx >= tr.x and mx <= tr.x + tr.w and my >= tr.y and my <= tr.y + tr.h) {
                                    const cell = termPixelToCell(tn, mx, my);
                                    term_sel_start_row = cell.row;
                                    term_sel_start_col = cell.col;
                                    term_sel_end_row = cell.row;
                                    term_sel_end_col = cell.col;
                                    term_sel_active = false;
                                    term_sel_dragging = true;
                                } else {
                                    termClearSelection();
                                    selection.onMouseDown(config.root, mx, my, c.SDL_GetTicks());
                                }
                            } else {
                                selection.onMouseDown(config.root, mx, my, c.SDL_GetTicks());
                            }
                            input.unfocus();
                        } else {
                            input.unfocus();
                            selection.onMouseDown(config.root, mx, my, c.SDL_GetTicks());
                        }
                    }
                },
                c.SDL_MOUSEMOTION => {
                    const mx: f32 = @floatFromInt(event.motion.x);
                    const my: f32 = @floatFromInt(event.motion.y);
                    // Render surface mouse motion forwarding
                    if (render_surfaces.handleMouseMotion(mx, my)) continue;
                    // Physics drag update
                    if (physics2d.isDragging()) {
                        physics2d.updateDrag(mx, my);
                    }
                    // Terminal drag selection
                    if (term_sel_dragging) {
                        if (findTerminalNode(config.root)) |tn| {
                            const cell = termPixelToCell(tn, mx, my);
                            term_sel_end_row = cell.row;
                            term_sel_end_col = cell.col;
                            term_sel_active = (term_sel_start_row != term_sel_end_row or term_sel_start_col != term_sel_end_col);
                        }
                    }
                    // TextInput drag selection
                    if (input_drag_active) {
                        const local_x = mx - input_drag_node_x - input_drag_node_pl;
                        input.updateDrag(input_drag_id, local_x, input_drag_font_size);
                    }
                    if (devtools_visible) updateHover(&devtools.root, mx, my);
                    updateHover(config.root, mx, my);
                    // Canvas hit testing — find which Canvas.Node the mouse is over
                    {
                        const mevents = @import("events.zig");
                        if (mevents.findCanvasNode(config.root, mx, my)) |cn| {
                            const vp_cx = cn.computed.x + cn.computed.w / 2;
                            const vp_cy = cn.computed.y + cn.computed.h / 2;
                            const gpos = canvas.screenToGraph(mx, my, vp_cx, vp_cy);
                            // Check Canvas.Node children
                            var found_idx: ?u16 = null;
                            var ci: u16 = 0;
                            for (cn.children) |*child| {
                                if (child.canvas_node) {
                                    const hw = child.canvas_gw / 2;
                                    const hh = child.canvas_gh / 2;
                                    if (gpos[0] >= child.canvas_gx - hw and gpos[0] <= child.canvas_gx + hw and
                                        gpos[1] >= child.canvas_gy - hh and gpos[1] <= child.canvas_gy + hh)
                                    {
                                        found_idx = ci;
                                    }
                                }
                                ci += 1;
                            }
                            canvas.setHoveredNode(found_idx);
                            g_hover_changed = true;
                        } else {
                            if (canvas.getHoveredNode() != null) g_hover_changed = true;
                            canvas.setHoveredNode(null);
                        }
                    }
                    const dragging_left = (event.motion.state & c.SDL_BUTTON_LMASK) != 0;
                    if (dragging_left and canvas_drag_node != null) {
                        // Canvas pan — built-in
                        const dx = mx - canvas_drag_last_x;
                        const dy = my - canvas_drag_last_y;
                        canvas.handleDrag(dx, dy);
                        canvas_drag_last_x = mx;
                        canvas_drag_last_y = my;
                    } else if (dragging_left) {
                        selection.onMouseDrag(config.root, mx, my);
                    }
                },
                c.SDL_MOUSEBUTTONUP => {
                    // Render surface mouse up forwarding
                    {
                        const rmx: f32 = @floatFromInt(event.button.x);
                        const rmy: f32 = @floatFromInt(event.button.y);
                        if (render_surfaces.handleMouseUp(rmx, rmy, event.button.button)) continue;
                    }
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        physics2d.endDrag();
                        canvas_drag_node = null;
                        input_drag_active = false;
                        term_sel_dragging = false;
                        selection.onMouseUp();
                    }
                },
                c.SDL_TEXTINPUT => {
                    // Native terminal gets text first
                    if (terminal_initialized) {
                        terminalHandleTextInput(@ptrCast(&event.text.text));
                        continue;
                    }
                    // PTY gets text first when active
                    if (qjs_runtime.ptyActive()) {
                        qjs_runtime.ptyHandleTextInput(@ptrCast(&event.text.text));
                        continue;
                    }
                    // Render surface text input forwarding
                    if (render_surfaces.handleTextInput(@ptrCast(&event.text.text))) continue;
                    input.handleTextInput(@ptrCast(&event.text.text));
                },
                c.SDL_KEYDOWN => {
                    const sym = event.key.keysym.sym;
                    const mod = event.key.keysym.mod;
                    // Capture key (F9 recording toggle)
                    if (capture.handleKey(sym)) continue;
                    // Terminal copy/paste: Ctrl+Shift+C/V (not Ctrl+C which is SIGINT)
                    if (terminal_initialized) {
                        const t_ctrl = (mod & @as(u16, c.KMOD_CTRL)) != 0;
                        const t_shift = (mod & @as(u16, c.KMOD_SHIFT)) != 0;
                        if (t_ctrl and t_shift and sym == c.SDLK_c) {
                            if (term_sel_active) {
                                var copy_buf: [8192]u8 = undefined;
                                const len = vterm_mod.copySelectedText(
                                    term_sel_start_row, term_sel_start_col,
                                    term_sel_end_row, term_sel_end_col,
                                    &copy_buf,
                                );
                                if (len > 0 and len < copy_buf.len) {
                                    copy_buf[len] = 0;
                                    _ = c.SDL_SetClipboardText(@ptrCast(&copy_buf));
                                }
                            }
                            continue;
                        }
                        if (t_ctrl and t_shift and sym == c.SDLK_v) {
                            const clip = c.SDL_GetClipboardText();
                            if (clip != null) {
                                vterm_mod.scrollToBottom();
                                vterm_mod.writePty(std.mem.span(clip));
                                c.SDL_free(@ptrCast(clip));
                            }
                            continue;
                        }
                    }
                    // Native terminal special key routing
                    if (terminal_initialized and sym != c.SDLK_F12) {
                        terminalHandleKey(sym, mod);
                        continue;
                    }
                    // PTY special key routing (arrows, enter, backspace, ctrl combos)
                    if (qjs_runtime.ptyActive() and sym != c.SDLK_F12) {
                        qjs_runtime.ptyHandleKeyDown(sym, mod);
                        continue;
                    }
                    // Render surface key forwarding (before F12 check so F12 still works)
                    if (sym != c.SDLK_F12 and render_surfaces.handleKeyDown(sym)) continue;
                    // F12: toggle devtools
                    if (sym == c.SDLK_F12) {
                        devtools_visible = !devtools_visible;
                        std.debug.print("[devtools] F12 pressed — visible={}\n", .{devtools_visible});
                        if (devtools_visible and !devtools_initialized) {
                            std.debug.print("[devtools] calling _appInit...\n", .{});
                            devtools._appInit();
                            std.debug.print("[devtools] _appInit done, evaluating JS ({d} bytes)...\n", .{devtools.JS_LOGIC.len});
                            if (devtools.JS_LOGIC.len > 0) qjs_runtime.evalScript(devtools.JS_LOGIC);
                            std.debug.print("[devtools] JS done, initialized\n", .{});
                            devtools_initialized = true;
                        }
                    } else {
                        const ctrl = (mod & c.KMOD_CTRL) != 0;
                        const input_consumed = if (input.getFocusedId() != null)
                            (if (ctrl) input.handleCtrlKey(sym) else input.handleKey(sym))
                        else
                            false;
                        if (!input_consumed and !videos.handleKey(sym)) {
                            selection.onKeyDown(config.root, sym, mod);
                        }
                    }
                },
                c.SDL_KEYUP => {
                    _ = render_surfaces.handleKeyUp(event.key.keysym.sym);
                },
                c.SDL_MOUSEWHEEL => {
                    var mx_i: c_int = undefined;
                    var my_i: c_int = undefined;
                    _ = c.SDL_GetMouseState(&mx_i, &my_i);
                    const mx: f32 = @floatFromInt(mx_i);
                    const my: f32 = @floatFromInt(my_i);
                    const events = @import("events.zig");
                    // Terminal scrollback — mouse wheel scrolls history
                    if (terminal_initialized) {
                        if (findTerminalNode(config.root)) |tn| {
                            const tr = tn.computed;
                            if (mx >= tr.x and mx <= tr.x + tr.w and my >= tr.y and my <= tr.y + tr.h) {
                                if (event.wheel.y > 0) {
                                    vterm_mod.scrollUp(@intCast(event.wheel.y * 3));
                                } else if (event.wheel.y < 0) {
                                    vterm_mod.scrollDown(@intCast(-event.wheel.y * 3));
                                }
                                continue;
                            }
                        }
                    }
                    // Canvas zoom — built-in (check devtools first, then app)
                    if ((if (devtools_visible) events.findCanvasNode(&devtools.root, mx, my) else null) orelse events.findCanvasNode(config.root, mx, my)) |cn| {
                        const delta: f32 = @floatFromInt(event.wheel.y);
                        canvas.handleScroll(mx - cn.computed.x, my - cn.computed.y, delta, cn.computed.w, cn.computed.h);
                    } else if (events.findScrollContainer(config.root, mx, my)) |scroll_node| {
                        if (event.wheel.y != 0) {
                            scroll_node.scroll_y -= @as(f32, @floatFromInt(event.wheel.y)) * 30.0;
                        }
                        if (event.wheel.x != 0) {
                            const page = @max(scroll_node.computed.h * 0.8, 60.0);
                            scroll_node.scroll_y -= @as(f32, @floatFromInt(event.wheel.x)) * page;
                        }
                        const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
                        scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
                    }
                },
                c.SDL_DROPFILE => {
                    if (event.drop.file) |file_ptr| {
                        filedrop.dispatch(std.mem.span(file_ptr), config.root);
                        c.SDL_free(file_ptr);
                    }
                },
                else => {},
            }
        }

        // QuickJS tick
        const t0 = std.time.microTimestamp();
        qjs_runtime.tick();
        const t1 = std.time.microTimestamp();
        qjs_runtime.telemetry_tick_us = @intCast(@max(0, t1 - t0));

        // App tick (FFI polling, state updates, dynamic texts)
        if (config.tick) |tickFn| tickFn(c.SDL_GetTicks());

        // Devtools tick
        if (devtools_visible and devtools_initialized) {
            devtools._appTick(c.SDL_GetTicks());
        }

        // Transition tick — interpolate active transitions AFTER style updates, BEFORE layout
        {
            const now_t = c.SDL_GetTicks();
            const dt_t = now_t -% g_prev_tick;
            const dt_t_sec = @as(f32, @floatFromInt(dt_t)) / 1000.0;
            _ = transition.tick(dt_t_sec);
        }

        // Physics 2D init — create world and bodies on first frame (before layout)
        if (!physics_initialized) {
            initPhysicsFromTree(config.root);
            physics_initialized = true;
        }

        // Terminal tick — init PTY on first frame, poll for output
        if (!terminal_initialized) {
            if (findTerminalNode(config.root)) |_| {
        
                vterm_mod.spawnShell("bash", 24, 80);
                terminal_initialized = true;
            }
        }
        if (terminal_initialized) {
            if (vterm_mod.pollPty()) {
                classifier.markDirty();
            }
            // Re-classify when damage occurred
            if (classifier.isDirty()) {
                const cls_rows = vterm_mod.getRows();
                var cls_r: u16 = 0;
                while (cls_r < cls_rows) : (cls_r += 1) {
                    const cls_text = vterm_mod.getRowText(cls_r);
                    classifier.classifyAndCache(cls_r, cls_text, cls_rows);
                }
                classifier.clearDirty();
                // Build semantic graph from freshly classified rows
                semantic.tick(cls_rows);
            }
        }

        // Layout (main window)
        const t2 = std.time.microTimestamp();
        const app_h = if (devtools_visible) @max(100, win_h - DEVTOOLS_HEIGHT) else win_h;
        layout.layout(config.root, 0, 0, win_w, app_h);
        if (devtools_visible) {
            layout.layout(&devtools.root, 0, app_h, win_w, DEVTOOLS_HEIGHT);
        }
        const t3 = std.time.microTimestamp();
        qjs_runtime.telemetry_layout_us = @intCast(@max(0, t3 - t2));

        // Physics 2D tick — step world, sync body positions to nodes AFTER layout
        // (physics overwrites computed.x/y — must happen after layout sets them)
        if (physics2d.isInitialized()) {
            const now_p = c.SDL_GetTicks();
            const dt_p = now_p -% g_prev_tick;
            const dt_p_sec = @as(f32, @floatFromInt(dt_p)) / 1000.0;
            physics2d.tick(@min(dt_p_sec, 0.05)); // cap at 50ms to prevent explosion
        }

        // Layout + paint secondary windows (in-process, notifications)
        windows.layoutAll();
        windows.paintAndPresent();

        // Resolve deferred selection (safe — layout is done, FT mutations won't corrupt measurements)
        selection.resolvePending();

        // Video update — poll mpv for new frames before paint
        videos.update();

        // Render surfaces update — poll XShm/FFmpeg/VNC for new frames
        render_surfaces.update();

        // Cursor blink — update before paint so cursor state is fresh
        const now_tick = c.SDL_GetTicks();
        const dt_ms = now_tick -% g_prev_tick;
        g_prev_tick = now_tick;
        const dt_sec = @as(f32, @floatFromInt(dt_ms)) / 1000.0;
        g_cursor_visible = input.tickBlink(dt_sec);

        // Effects update — animate and render all effect instances
        effects.update(dt_sec);
        r3d.update(dt_sec);

        // Paint (main window — wgpu)
        g_dt_sec = dt_sec;
        selection.resetWalkState();
        const t4 = std.time.microTimestamp();
        paintNode(config.root);

        // Paint devtools panel (below app)
        if (devtools_visible) {
            gpu.drawRect(0, app_h, win_w, 2, 0.4, 0.2, 0.9, 1.0, 0, 0, 0, 0, 0, 0);
            paintNode(&devtools.root);
        }

        // Tooltip overlay (always on top of main tree)
        tooltip.paintOverlay(measureCallback, win_w, win_h);

        const t5 = std.time.microTimestamp();
        qjs_runtime.telemetry_paint_us = @intCast(@max(0, t5 - t4));

        gpu.frame(0.051, 0.067, 0.090);

        // Capture — screenshot/recording (fires inside gpu.frame via callback)
        if (capture.tick(config.root)) {
            std.process.exit(0); // screenshot captured — clean exit
        }

        // Test harness — run tests after layout+paint, then exit
        if (testharness.tick()) {
            const exit_code = testharness.runAll(config.root);
            std.process.exit(exit_code);
        }

        // Unified telemetry snapshot
        const t6 = std.time.microTimestamp();
        telemetry.collect(.{
            .tick_us = @intCast(@max(0, t1 - t0)),
            .layout_us = @intCast(@max(0, t3 - t2)),
            .paint_us = @intCast(@max(0, t5 - t4)),
            .frame_total_us = @intCast(@max(0, t6 - t0)),
            .fps = qjs_runtime.telemetry_fps,
            .bridge_calls_per_sec = qjs_runtime.telemetry_bridge_calls,
            .root = config.root,
            .visible_nodes = g_paint_count,
            .hidden_nodes = g_hidden_count,
            .zero_size_nodes = g_zero_count,
            .window = window,
            .hovered_node = hovered_node,
        });

        // Debug server — poll for requests + push telemetry stream
        debug_server.poll();

        // Telemetry (legacy stderr + qjs_runtime vars)
        fps_frames += 1;
        const now = c.SDL_GetTicks();
        if (now - fps_last >= 1000) {
            qjs_runtime.telemetry_fps = fps_frames;
            const ppf = g_paint_count / @max(fps_frames, 1);
            const hpf = g_hidden_count / @max(fps_frames, 1);
            const zpf = g_zero_count / @max(fps_frames, 1);
            std.debug.print("[telemetry] FPS: {d} | layout: {d}us | paint: {d}us | visible: {d} | hidden: {d} | zero: {d} | bridge: {d}/s\n", .{
                fps_frames, qjs_runtime.telemetry_layout_us, qjs_runtime.telemetry_paint_us, ppf, hpf, zpf, qjs_runtime.bridge_calls_this_second,
            });
            qjs_runtime.telemetry_bridge_calls = qjs_runtime.bridge_calls_this_second;
            qjs_runtime.bridge_calls_this_second = 0;
            g_paint_count = 0;
            g_hover_changed = false;
            g_hidden_count = 0;
            g_zero_count = 0;
            fps_frames = 0;
            fps_last = now;
        }
    }
}
