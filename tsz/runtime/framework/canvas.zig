//! Unified Canvas System — Registry + Lifecycle + Input Dispatch
//!
//! One primitive: <Canvas type="X">. The `type` prop selects the renderer.
//! Each canvas type implements CanvasRenderer. The runtime handles hit testing,
//! sizing, events, and lifecycle once. Each type only implements what's unique.
//!
//! Registry is static — canvas types register at init time.

const std = @import("std");
const gpu = @import("gpu.zig");

// ── Canvas Renderer Interface ───────────────────────────────────────────

pub const CanvasRenderer = struct {
    /// Called once when the canvas node first appears in the tree.
    init_fn: ?*const fn (props: CanvasProps) void = null,
    /// Called every frame with delta time.
    tick_fn: ?*const fn (dt: f32) void = null,
    /// Called during paint pass with the node's computed bounds.
    render_fn: *const fn (x: f32, y: f32, w: f32, h: f32) void,
    /// Called when the canvas node is removed from the tree.
    destroy_fn: ?*const fn () void = null,

    // Input handlers — optional, called when this canvas has focus/hover
    handle_key_fn: ?*const fn (sym: c_int, mods: u16) void = null,
    handle_text_fn: ?*const fn (text: [*:0]const u8) void = null,
    handle_click_fn: ?*const fn (mx: f32, my: f32) bool = null,
    handle_scroll_fn: ?*const fn (delta: f32) void = null,
    handle_mouse_fn: ?*const fn (mx: f32, my: f32) void = null,
};

// ── Canvas Props ────────────────────────────────────────────────────────

/// Props passed through from .tsz to the canvas renderer.
/// Type-specific props are stored as string key-value pairs.
pub const CanvasProps = struct {
    canvas_type: []const u8 = "",
    // Common props
    width: f32 = 0,
    height: f32 = 0,
};

// ── Registry ────────────────────────────────────────────────────────────

const MAX_CANVAS_TYPES = 32;

var type_names: [MAX_CANVAS_TYPES][]const u8 = undefined;
var type_renderers: [MAX_CANVAS_TYPES]CanvasRenderer = undefined;
var type_count: usize = 0;
var initialized: bool = false;

/// Register a canvas type renderer. Called at init time.
pub fn register(name: []const u8, renderer: CanvasRenderer) void {
    if (type_count >= MAX_CANVAS_TYPES) {
        std.debug.print("[canvas] Registry full — cannot register '{s}'\n", .{name});
        return;
    }
    // Check for duplicates
    for (0..type_count) |i| {
        if (std.mem.eql(u8, type_names[i], name)) {
            std.debug.print("[canvas] Type '{s}' already registered — replacing\n", .{name});
            type_renderers[i] = renderer;
            return;
        }
    }
    type_names[type_count] = name;
    type_renderers[type_count] = renderer;
    type_count += 1;
}

/// Look up a renderer by type name. Returns null if not registered.
pub fn get(name: []const u8) ?*const CanvasRenderer {
    for (0..type_count) |i| {
        if (std.mem.eql(u8, type_names[i], name)) {
            return &type_renderers[i];
        }
    }
    return null;
}

// ── Lifecycle ───────────────────────────────────────────────────────────

/// Initialize the canvas system. Register built-in canvas types here.
pub fn init() void {
    if (initialized) return;
    initialized = true;

    // Placeholder renderer — renders a labeled box for unimplemented canvas types
    register("placeholder", .{
        .render_fn = renderPlaceholder,
    });
}

pub fn deinit() void {
    // Call destroy on all active canvas instances
    // (instance tracking is Phase 2 — for now just reset)
    type_count = 0;
    initialized = false;
}

/// Tick all active canvas instances. Called once per frame.
pub fn tickAll(dt: f32) void {
    _ = dt;
    // Phase 2: iterate active canvas instances and call tick_fn
}

// ── Rendering ───────────────────────────────────────────────────────────

/// Render a canvas node. Called by compositor when it encounters a canvas_type node.
pub fn renderCanvas(canvas_type: []const u8, x: f32, y: f32, w: f32, h: f32) void {
    if (get(canvas_type)) |renderer| {
        renderer.render_fn(x, y, w, h);
    } else {
        // Unknown type — render placeholder with type name
        renderUnknownCanvas(canvas_type, x, y, w, h);
    }
}

/// Dispatch a click event to the canvas renderer.
pub fn dispatchClick(canvas_type: []const u8, mx: f32, my: f32) bool {
    if (get(canvas_type)) |renderer| {
        if (renderer.handle_click_fn) |handler| {
            return handler(mx, my);
        }
    }
    return false;
}

/// Dispatch a key event to the canvas renderer.
pub fn dispatchKey(canvas_type: []const u8, sym: c_int, mods: u16) void {
    if (get(canvas_type)) |renderer| {
        if (renderer.handle_key_fn) |handler| {
            handler(sym, mods);
        }
    }
}

/// Dispatch a scroll event to the canvas renderer.
pub fn dispatchScroll(canvas_type: []const u8, delta: f32) void {
    if (get(canvas_type)) |renderer| {
        if (renderer.handle_scroll_fn) |handler| {
            handler(delta);
        }
    }
}

/// Dispatch a mouse move event to the canvas renderer.
pub fn dispatchMouse(canvas_type: []const u8, mx: f32, my: f32) void {
    if (get(canvas_type)) |renderer| {
        if (renderer.handle_mouse_fn) |handler| {
            handler(mx, my);
        }
    }
}

// ── Built-in Renderers ─────────────────────────────────────────────────

/// Placeholder renderer — a colored box with a label
fn renderPlaceholder(x: f32, y: f32, w: f32, h: f32) void {
    // Dark background with border
    gpu.drawRect(x, y, w, h, 0.12, 0.12, 0.16, 1.0, 4.0, 1.0, 0.3, 0.3, 0.4, 1.0);
    // Label
    gpu.drawTextLine("Canvas", x + 8, y + 8, 14, 0.5, 0.5, 0.6, 1.0);
}

/// Unknown canvas type — show error state
fn renderUnknownCanvas(canvas_type: []const u8, x: f32, y: f32, w: f32, h: f32) void {
    // Red-tinted background
    gpu.drawRect(x, y, w, h, 0.2, 0.08, 0.08, 1.0, 4.0, 1.0, 0.5, 0.15, 0.15, 1.0);
    // Error label
    const label = std.fmt.comptimePrint("Unknown canvas type", .{});
    _ = canvas_type;
    gpu.drawTextLine(label, x + 8, y + 8, 12, 0.9, 0.3, 0.3, 1.0);
}
