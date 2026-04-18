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
const context_menu = @import("context_menu.zig");
const telemetry = @import("telemetry.zig");
const filedrop = @import("filedrop.zig");
const input = @import("input.zig");
const classifier = @import("classifier.zig");
const semantic = @import("semantic.zig");
const pty_remote = @import("pty_remote.zig");
const crashlog = @import("crashlog.zig");
const watchdog = @import("watchdog.zig");
const cart = @import("cartridge.zig");

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
const HAS_BLEND2D = if (@hasDecl(build_options, "has_blend2d")) build_options.has_blend2d else false;
const HAS_DEBUG_SERVER = if (@hasDecl(build_options, "has_debug_server")) build_options.has_debug_server else false;

const blend2d_gfx = if (HAS_BLEND2D) @import("blend2d.zig") else struct {
    pub fn fillSVGPath(_: []const u8, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32) void {}
    pub fn fillSVGPathFromEffect(_: []const u8, _: [*]const u8, _: u32, _: u32, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32, _: f32) void {}
    pub fn deinit() void {}
};

var g_paisley_debug_enabled: ?bool = null;

fn paisleyDebugEnabled() bool {
    if (g_paisley_debug_enabled == null) {
        g_paisley_debug_enabled = std.posix.getenv("ZIGOS_PAISLEY_DEBUG") != null;
    }
    return g_paisley_debug_enabled.?;
}

fn isPaisleyName(name: []const u8) bool {
    return std.mem.startsWith(u8, name, "paisley-");
}

const debug_server = if (HAS_DEBUG_SERVER) @import("debug_server.zig") else struct {
    pub fn init(_: [*:0]const u8) void {}
    pub fn poll() void {}
    pub fn deinit() void {}
    pub fn getSelectedNode() i32 { return -1; }
    pub fn getPairingCode() ?[]const u8 { return null; }
};

// Force-reference crypto.zig so its export fn symbols (e.g. crypto_run_all_tests) are available to the linker.
comptime {
    if (HAS_CRYPTO) _ = @import("crypto.zig");
}

// Force-reference luajit_worker.zig so its export fn symbols are available to the linker.
// LuaJIT workers are compute-only, off-thread — they never touch rendering, layout, or state.
comptime {
    _ = @import("luajit_worker.zig");
}

// LuaJIT main-thread runtime — replaces QuickJS for logic (events, state, conditionals).
// Same API surface as qjs_runtime: initVM, evalScript, evalExpr, tick, callGlobal.
const luajit_runtime = @import("luajit_runtime.zig");

// Force-reference audio.zig so its export fn symbols are available to the linker.
comptime {
    _ = @import("audio.zig");
}

// Force-reference pty_client.zig for unix socket terminal remote control.
comptime {
    _ = @import("pty_client.zig");
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
// devtools removed — inspector lives in tsz-tools (standalone IPC app)
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
const effects = if (HAS_EFFECTS) @import("effects.zig") else struct {
    pub fn init() void {}
    pub fn deinit() void {}
    pub fn update(_: f32) void {}
    pub fn paintEffect(_: ?[]const u8, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
    pub fn paintCustomEffect(_: *const Node, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
    pub fn paintNamedEffect(_: *const Node, _: []const u8, _: f32, _: f32, _: f32, _: f32) bool { return false; }
    pub const EffectFillInfo = struct { pixel_buf: [*]const u8, width: u32, height: u32, screen_x: f32, screen_y: f32 };
    pub fn getEffectFill(_: []const u8) ?EffectFillInfo { return null; }
};
const r3d = if (HAS_3D) @import("gpu/3d.zig") else struct {
    pub fn render(_: *Node, _: f32, _: f32, _: f32, _: f32, _: f32) bool { return false; }
    pub fn update(_: f32) void {}
};
const transition = if (HAS_TRANSITIONS) @import("transition.zig") else struct {
    pub fn tick(_: f32) bool {
        return false;
    }
    pub fn needsRelayout() bool {
        return false;
    }
};
const vterm_mod = if (HAS_TERMINAL) @import("vterm.zig") else VtermStub;
const VtermStub = struct {
    pub const MAX_TERMINALS: u8 = 4;
    pub const VtColor = struct { r: u8 = 0, g: u8 = 0, b: u8 = 0 };
    pub const Cell = struct {
        char_buf: [4]u8 = .{ 0, 0, 0, 0 }, char_len: u8 = 0, width: u8 = 1,
        fg: ?VtColor = null, bg: ?VtColor = null, bold: bool = false,
        italic: bool = false, underline: bool = false, strike: bool = false, reverse: bool = false,
    };
    pub fn initVterm(_: u16, _: u16) void {}
    pub fn feed(_: []const u8) void {}
    pub fn readOutput(_: []u8) ?[]const u8 { return null; }
    pub fn getRowText(_: u16) []const u8 { return ""; }
    pub fn getCell(_: u16, _: u16) Cell { return .{}; }
    pub fn getCursorRow() u16 { return 0; }
    pub fn getCursorCol() u16 { return 0; }
    pub fn getCursorVisible() bool { return false; }
    pub fn hasDamage() bool { return false; }
    pub fn clearDamageState() void {}
    pub fn getRows() u16 { return 0; }
    pub fn getCols() u16 { return 0; }
    pub fn resizeVterm(_: u16, _: u16) void {}
    pub fn deinit() void {}
    pub fn spawnShell(_: anytype, _: u16, _: u16) void {}
    pub fn pollPty() bool { return false; }
    pub fn writePty(_: []const u8) void {}
    pub fn ptyAlive() bool { return false; }
    pub fn closePty() void {}
    pub fn getScrollbackCell(_: u16, _: u16) Cell { return .{}; }
    pub fn scrollbackCount() u16 { return 0; }
    pub fn scrollOffset() u16 { return 0; }
    pub fn scrollUp(_: u16) void {}
    pub fn scrollDown(_: u16) void {}
    pub fn scrollToBottom() void {}
    pub fn copySelectedText(_: u16, _: u16, _: u16, _: u16, _: []u8) usize { return 0; }
    // Idx variants for multi-terminal support
    pub fn spawnShellIdx(_: u8, _: anytype, _: u16, _: u16) void {}
    pub fn pollPtyIdx(_: u8) bool { return false; }
    pub fn writePtyIdx(_: u8, _: []const u8) void {}
    pub fn getRowTextIdx(_: u8, _: u16) []const u8 { return ""; }
    pub fn getCellIdx(_: u8, _: u16, _: u16) Cell { return .{}; }
    pub fn getRowsIdx(_: u8) u16 { return 0; }
    pub fn getColsIdx(_: u8) u16 { return 0; }
    pub fn resizeVtermIdx(_: u8, _: u16, _: u16) void {}
    pub fn getScrollbackCellIdx(_: u8, _: u16, _: u16) Cell { return .{}; }
    pub fn scrollOffsetIdx(_: u8) u16 { return 0; }
    pub fn scrollUpIdx(_: u8, _: u16) void {}
    pub fn scrollDownIdx(_: u8, _: u16) void {}
    pub fn scrollToBottomIdx(_: u8) void {}
    pub fn getCursorRowIdx(_: u8) u16 { return 0; }
    pub fn getCursorColIdx(_: u8) u16 { return 0; }
    pub fn getCursorVisibleIdx(_: u8) bool { return false; }
    pub fn copySelectedTextIdx(_: u8, _: u16, _: u16, _: u16, _: u16, _: []u8) usize { return 0; }
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
const state_mod = @import("state.zig");
const witness = @import("witness.zig");

// ── Devtools removed — inspector lives in tsz-tools ─────────────────────

// ── Cursor blink state ───────────────────────────────────────────────────
var g_cursor_visible: bool = true;
var g_prev_tick: u32 = 0;

// ── Physics 2D state ────────────────────────────────────────────────────
var physics_initialized: bool = false;

// ── Terminal state ──────────────────────────────────────────────────────
const MAX_TERMINALS = vterm_mod.MAX_TERMINALS;
var terminals_initialized: [MAX_TERMINALS]bool = .{false} ** MAX_TERMINALS;
var g_semantic_detected_flags: [MAX_TERMINALS]bool = .{false} ** MAX_TERMINALS;
var g_focused_terminal: u8 = 0;
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

fn findTerminalNodes(node: *Node, count: *u8) void {
    if (node.terminal) {
        if (count.* < MAX_TERMINALS) {
            node.terminal_id = count.*;
            count.* += 1;
        }
        return;
    }
    for (node.children) |*child| {
        findTerminalNodes(child, count);
    }
}

fn findTerminalNodeById(node: *Node, id: u8) ?*Node {
    if (node.terminal and node.terminal_id == id) return node;
    for (node.children) |*child| {
        if (findTerminalNodeById(child, id)) |found| return found;
    }
    return null;
}

fn anyTerminalInitialized() bool {
    for (terminals_initialized) |t| { if (t) return true; }
    return false;
}

/// Route SDL key event to the terminal PTY as ANSI escape sequences.
fn terminalHandleKey(sym: i32, mod_state: u16) void {
    const ti = g_focused_terminal;
    const ctrl = (mod_state & c.SDL_KMOD_CTRL) != 0;
    termClearSelection();
    vterm_mod.scrollToBottomIdx(ti);
    // Ctrl+letter → raw control character
    if (ctrl and sym >= 'a' and sym <= 'z') {
        const buf = [1]u8{@intCast(sym - 'a' + 1)};
        vterm_mod.writePtyIdx(ti, &buf);
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
    if (seq) |s| vterm_mod.writePtyIdx(ti, s);
}

fn terminalHandleTextInput(text: [*:0]const u8) void {
    const ti = g_focused_terminal;
    const slice = std.mem.span(text);
    std.debug.print("[terminal] textInput: len={d} chars=\"{s}\"\n", .{ slice.len, slice });
    if (slice.len > 0) {
        termClearSelection();
        vterm_mod.scrollToBottomIdx(ti);
        vterm_mod.writePtyIdx(ti, slice);
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

/// Walk the node tree looking for nodes with cartridge_src set.
/// For each one found, load the .so (if not already loaded) and set
/// the cartridge node's children to the loaded app's root children.
fn scanCartridgeNodes(node: *Node) void {
    if (node.cartridge_src) |src| {
        // Check if already loaded (children non-empty means we already set it up)
        if (node.children.len == 0) {
            const idx = cart.load(src) catch |err| {
                std.debug.print("[engine] Failed to load cartridge {s}: {}\n", .{ src, err });
                return;
            };
            if (cart.get(idx)) |cr| {
                // Set this node's children to the cartridge's root children
                node.children = cr.root.children;
                // Inherit background color if the cartridge root has one
                if (cr.root.style.background_color != null and node.style.background_color == null) {
                    node.style.background_color = cr.root.style.background_color;
                }
                std.debug.print("[engine] Loaded cartridge: {s}\n", .{cr.titleSlice()});
            }
        } else {
            // Already loaded — refresh children from the active root
            // (the cartridge's tick may have changed the tree)
            for (0..cart.count()) |i| {
                if (cart.get(i)) |cr| {
                    if (std.mem.eql(u8, cr.soPathSlice(), src)) {
                        node.children = cr.root.children;
                        break;
                    }
                }
            }
        }
    }
    // Recurse into children
    for (node.children) |*child| {
        scanCartridgeNodes(child);
    }
}

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
                if (cursor_hand == null) cursor_hand = c.SDL_CreateSystemCursor(c.SDL_SYSTEM_CURSOR_POINTER);
                if (cursor_hand) |cur| _ = c.SDL_SetCursor(cur);
                cursor_is_hand = true;
            }
        } else if (cursor_is_hand) {
            if (cursor_arrow == null) cursor_arrow = c.SDL_CreateSystemCursor(c.SDL_SYSTEM_CURSOR_DEFAULT);
            if (cursor_arrow) |cur| _ = c.SDL_SetCursor(cur);
            cursor_is_hand = false;
        }
    } else {
        tooltip.hide();
        if (cursor_is_hand) {
            if (cursor_arrow == null) cursor_arrow = c.SDL_CreateSystemCursor(c.SDL_SYSTEM_CURSOR_DEFAULT);
            if (cursor_arrow) |cur| _ = c.SDL_SetCursor(cur);
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
    lua_logic: []const u8 = "",
    /// Called once after QuickJS VM is ready. Register FFI host functions, set initial state.
    init: ?*const fn () void = null,
    /// Called every frame before layout. Do FFI polling, state dirty checks, dynamic text updates.
    tick: ?*const fn (now_ms: u32) void = null,
    /// Hot-reload callback — called at the start of each frame.
    /// If it returns true, root/init/tick were swapped and the engine re-inits.
    check_reload: ?*const fn (*AppConfig) bool = null,
    /// Called after init during a hot-reload, before tick. Used for state restoration.
    post_reload: ?*const fn () void = null,
    /// Borderless window — removes OS window decorations (title bar, borders).
    /// The app must provide its own chrome using window_drag / window_resize nodes.
    borderless: bool = false,
};

// ── Text measurement (framework-owned) ──────────────────────────────────

var g_text_engine: ?*TextEngine = null;

// ── Custom window chrome (borderless mode) ──────────────────────────────

var g_chrome_root: ?*Node = null; // root node for hit-test callback
var g_chrome_window: ?*c.SDL_Window = null; // window pointer for control functions

/// SDL hit-test callback — called by SDL to determine what region of a borderless
/// window the cursor is in. Walks the node tree looking for window_drag / window_resize nodes.
fn windowHitTestCallback(
    _: ?*c.SDL_Window,
    point: ?*const c.SDL_Point,
    _: ?*anyopaque,
) callconv(std.builtin.CallingConvention.c) c.SDL_HitTestResult {
    const root = g_chrome_root orelse return c.SDL_HITTEST_NORMAL;
    const pt = point orelse return c.SDL_HITTEST_NORMAL;
    const mx: f32 = @floatFromInt(pt.x);
    const my: f32 = @floatFromInt(pt.y);

    // Walk the tree — deepest matching node wins (children checked first)
    if (hitTestChrome(root, mx, my)) |result| return result;
    return c.SDL_HITTEST_NORMAL;
}

fn hitTestChrome(node: *Node, mx: f32, my: f32) ?c.SDL_HitTestResult {
    if (node.style.display == .none) return null;
    const r = node.computed;
    // Only test nodes the cursor is actually inside
    if (mx < r.x or mx >= r.x + r.w or my < r.y or my >= r.y + r.h) return null;

    // Children first (deeper nodes take priority)
    var i = node.children.len;
    while (i > 0) {
        i -= 1;
        if (hitTestChrome(&node.children[i], mx, my)) |result| return result;
    }

    // Interactive nodes (buttons, inputs) override drag — let clicks through
    if (node.handlers.on_press != null or node.handlers.js_on_press != null or
        node.handlers.lua_on_press != null or node.input_id != null)
        return c.SDL_HITTEST_NORMAL;

    // Check this node
    if (node.window_drag) return c.SDL_HITTEST_DRAGGABLE;
    if (node.window_resize) return chromeResizeEdge(node, mx, my);

    return null;
}

/// Determine which resize edge based on the node's position in the window.
/// Uses the root node's bounds to figure out which side this edge node is on.
fn chromeResizeEdge(node: *Node, mx: f32, my: f32) c.SDL_HitTestResult {
    const root = g_chrome_root orelse return c.SDL_HITTEST_NORMAL;
    const win_w = root.computed.w;
    const win_h = root.computed.h;
    const r = node.computed;

    // Node center relative to window
    const ncx = r.x + r.w / 2;
    const ncy = r.y + r.h / 2;
    const half_w = win_w / 2;
    const half_h = win_h / 2;

    // Corner zone: if cursor is near a window corner (within 20px)
    const corner_thresh: f32 = 20;
    const near_win_left = mx < corner_thresh;
    const near_win_right = mx > (win_w - corner_thresh);
    const near_win_top = my < corner_thresh;
    const near_win_bottom = my > (win_h - corner_thresh);

    if (near_win_top and near_win_left) return c.SDL_HITTEST_RESIZE_TOPLEFT;
    if (near_win_top and near_win_right) return c.SDL_HITTEST_RESIZE_TOPRIGHT;
    if (near_win_bottom and near_win_left) return c.SDL_HITTEST_RESIZE_BOTTOMLEFT;
    if (near_win_bottom and near_win_right) return c.SDL_HITTEST_RESIZE_BOTTOMRIGHT;

    // Edge: determine by where the node sits in the window
    if (r.w > r.h) {
        // Wide node = horizontal edge → top or bottom based on position
        return if (ncy > half_h) c.SDL_HITTEST_RESIZE_BOTTOM else c.SDL_HITTEST_RESIZE_TOP;
    } else {
        // Tall node = vertical edge → left or right based on position
        return if (ncx > half_w) c.SDL_HITTEST_RESIZE_RIGHT else c.SDL_HITTEST_RESIZE_LEFT;
    }
}

/// Close the window (for custom close button).
pub fn windowClose() void {
    if (g_chrome_window) |_| {
        // Push a close event so the normal shutdown path runs
        var event: c.SDL_Event = std.mem.zeroes(c.SDL_Event);
        event.type = c.SDL_EVENT_QUIT;
        _ = c.SDL_PushEvent(&event);
    }
}

/// Minimize the window (for custom minimize button).
pub fn windowMinimize() void {
    if (g_chrome_window) |w| _ = c.SDL_MinimizeWindow(w);
}

/// Maximize or restore the window (toggles, for custom maximize button).
pub fn windowMaximize() void {
    if (g_chrome_window) |w| {
        const flags = c.SDL_GetWindowFlags(w);
        if ((flags & c.SDL_WINDOW_MAXIMIZED) != 0) {
            _ = c.SDL_RestoreWindow(w);
        } else {
            _ = c.SDL_MaximizeWindow(w);
        }
    }
}

/// Query whether the window is currently maximized.
pub fn windowIsMaximized() bool {
    if (g_chrome_window) |w| {
        return (c.SDL_GetWindowFlags(w) & c.SDL_WINDOW_MAXIMIZED) != 0;
    }
    return false;
}

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

/// Position a single Canvas.Node at its raw graph coordinates (gx/gy = center).
fn positionOneCanvasNode(child: *Node) void {
    const target_x = child.canvas_gx - child.computed.w / 2;
    const target_y = child.canvas_gy - child.computed.h / 2;
    const dx = target_x - child.computed.x;
    const dy = target_y - child.computed.y;
    child.computed.x = target_x;
    child.computed.y = target_y;
    for (child.children) |*gc| offsetNodeXY(gc, dx, dy);
}

/// Translate Canvas.Node children from flex positions to raw graph-space.
/// Flattens through non-canvas containers (e.g., map pool wrappers from .map() inside Canvas).
/// On drift-enabled canvases, auto-distributes and stacks tiles generatively:
///   - Collects all Canvas.Node children into a flat list
///   - Shuffles them randomly (Fisher-Yates, seeded by SDL_GetTicks)
///   - Distributes round-robin across N columns at COLUMN_SPACING apart
///   - Each column gets a randomized stagger — no flat horizontal edges
///   - Tiles stack outward from stagger anchor: odd down, even up
///   - Uniform CANVAS_NODE_GAP (30px) between all tiles
///   - Re-stacks every time the canvas becomes visible (generative layout)
fn positionCanvasNodes(parent: *Node) void {
    for (parent.children) |*child| {
        if (child.canvas_node) {
            positionOneCanvasNode(child);
        } else if (!child.canvas_path and !child.canvas_clamp) {
            // Flatten through non-canvas container (map pool wrapper)
            for (child.children) |*gc| {
                if (gc.canvas_node) positionOneCanvasNode(gc);
            }
        }
    }
}

const PAINT_BUDGET: u32 = 50_000;
var g_paint_count: u32 = 0;
var g_hidden_count: u32 = 0;
var g_zero_count: u32 = 0;
var g_budget_exceeded: bool = false;
var g_effect_child_seen2: bool = false;
var g_effect_bg_logged2: bool = false;
var g_dt_sec: f32 = 0;
var g_paint_opacity: f32 = 1.0; // global opacity multiplier for dim/highlight
var g_flow_enabled: bool = true; // per-child flow override for hover mode
var g_hover_changed: bool = false; // debug flag
var g_semantic_overlay: bool = false; // Ctrl+Shift+D toggles semantic color overlay

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
    if (g_paint_count > PAINT_BUDGET) {
        if (!g_budget_exceeded) {
            g_budget_exceeded = true;
            std.debug.print("[BUDGET] Paint pass exceeded {d} nodes — bailing (likely infinite loop)\n", .{PAINT_BUDGET});
        }
        return;
    }

    // Canvas.Path: draw before size check
    if (node.canvas_path or node.canvas_path_d != null) { paintCanvasPath(node); return; }

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
        if (child.effect_render != null and !g_effect_child_seen2) {
            g_effect_child_seen2 = true;
            std.debug.print("[eng effect-seen] parent={x} child={x} bg={} parent_rect={d}x{d} child_rect={d}x{d}\n", .{ @intFromPtr(node), @intFromPtr(child), child.effect_background, r.w, r.h, child.computed.w, child.computed.h });
        }
        if (child.effect_background and child.effect_render != null) {
            if (!g_effect_bg_logged2) {
                g_effect_bg_logged2 = true;
                std.debug.print("[eng effect-bg-paint] firing rect={d}x{d}\n", .{ r.w, r.h });
            }
            const _pce_ret = effects.paintCustomEffect(child, r.x, r.y, r.w, r.h, g_paint_opacity);
            std.debug.print("[eng after-pce] ret={}\n", .{_pce_ret});
        }
    }

    // Canvas rendering — separate heavy path
    if (node.canvas_type != null) { paintCanvasContainer(node); return; }

    // Graph container — lightweight canvas with transform for SVG path children
    if (node.graph_container) {
        gpu.pushScissor(r.x, r.y, r.w, r.h);
        // Set up transform: graph-space center (viewX,viewY) maps to element center
        const vx: f32 = node.canvas_view_x;
        const vy: f32 = node.canvas_view_y;
        const vz: f32 = if (node.canvas_view_zoom > 0) node.canvas_view_zoom else 1.0;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const saved_tf = gpu.getTransform();
        gpu.setTransform(0, 0, cx - vx * vz, cy - vy * vz, vz);
        for (node.children) |*child| paintNode(child);
        if (saved_tf.active) {
            gpu.setTransform(saved_tf.ox, saved_tf.oy, saved_tf.tx, saved_tf.ty, saved_tf.scale);
        } else {
            gpu.resetTransform();
        }
        gpu.popScissor();
        return;
    }

    // Overflow clipping + scroll offset + recurse children
    const ov = node.style.overflow;
    const is_scroll = (ov == .scroll or (ov == .auto and node.content_height > r.h));
    const is_clipped = is_scroll or ov == .hidden;

    if (is_clipped) {
        // When a canvas transform is active, scissor coordinates are in graph space
        // but pushScissor expects screen space. Transform through the active GPU transform.
        const tf = gpu.getTransform();
        if (tf.active) {
            gpu.pushScissor(r.x * tf.scale + tf.tx, r.y * tf.scale + tf.ty, r.w * tf.scale, r.h * tf.scale);
        } else {
            gpu.pushScissor(r.x, r.y, r.w, r.h);
        }
    }

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

/// Paint a Canvas.Path node (SVG stroke curves + optional blend2d fill).
fn paintCanvasPath(node: *Node) callconv(.auto) void {
    @setRuntimeSafety(false);
    if (node.canvas_path_d) |d| {
        const tc = node.text_color orelse Color.rgb(255, 255, 255);
        // Standalone path (icon mode): scale 24×24 viewbox into node's rect.
        // Inline paths (canvas_path=true) overlay parent and don't transform.
        const r = node.computed;
        const is_icon = !node.canvas_path and r.w > 0 and r.h > 0;
        if (is_icon) {
            const vb: f32 = 24.0;
            const scale = @min(r.w / vb, r.h / vb);
            const ox = r.x + (r.w - vb * scale) / 2;
            const oy = r.y + (r.h - vb * scale) / 2;
            gpu.setTransform(0, 0, ox, oy, scale);
        }
        // Fill pass — either from named effect texture or flat color
        if (node.canvas_fill_effect) |ename| {
            // Look up the named effect's pixel buffer and fill triangles with sampled colors
            if (effects.getEffectFill(ename)) |info| {
                const fill_path = svg_path.parsePath(d);
                // Compute path bounding box for UV mapping
                var min_x: f32 = 1e9;
                var min_y: f32 = 1e9;
                var max_x: f32 = -1e9;
                var max_y: f32 = -1e9;
                for (0..fill_path.subpath_count) |si2| {
                    const sp2 = &fill_path.subpaths[si2];
                    var pi2: u32 = 0;
                    while (pi2 + 1 < sp2.count) : (pi2 += 2) {
                        if (sp2.points[pi2] < min_x) min_x = sp2.points[pi2];
                        if (sp2.points[pi2 + 1] < min_y) min_y = sp2.points[pi2 + 1];
                        if (sp2.points[pi2] > max_x) max_x = sp2.points[pi2];
                        if (sp2.points[pi2 + 1] > max_y) max_y = sp2.points[pi2 + 1];
                    }
                }
                if (paisleyDebugEnabled() and isPaisleyName(ename)) {
                    std.debug.print(
                        "[paisley] paintCanvasPath name={s} d_len={d} bbox=({d:.1},{d:.1},{d:.1},{d:.1}) stroke_w={d:.2} curve_count={d} subpaths={d}\n",
                        .{
                            ename,
                            d.len,
                            min_x,
                            min_y,
                            max_x - min_x,
                            max_y - min_y,
                            node.canvas_stroke_width,
                            fill_path.curve_count,
                            fill_path.subpath_count,
                        },
                    );
                }
                if (HAS_BLEND2D) {
                    blend2d_gfx.fillSVGPathFromEffect(
                        d,
                        info.pixel_buf,
                        info.width,
                        info.height,
                        min_x,
                        min_y,
                        max_x - min_x,
                        max_y - min_y,
                        g_paint_opacity,
                        @as(f32, @floatFromInt(tc.r)) / 255.0,
                        @as(f32, @floatFromInt(tc.g)) / 255.0,
                        @as(f32, @floatFromInt(tc.b)) / 255.0,
                        @as(f32, @floatFromInt(tc.a)) / 255.0,
                        node.canvas_stroke_width,
                    );
                } else {
                    svg_path.drawFillFromEffect(
                        &fill_path,
                        info.pixel_buf,
                        info.width,
                        info.height,
                        min_x, min_y, max_x - min_x, max_y - min_y,
                    );
                }
            } else if (paisleyDebugEnabled() and isPaisleyName(ename)) {
                std.debug.print("[paisley] paintCanvasPath name={s} missing fill source\n", .{ename});
            }
        } else if (node.canvas_fill_color) |fc| {
            const fill_path = svg_path.parsePath(d);
            svg_path.drawFill(
                &fill_path,
                @as(f32, @floatFromInt(fc.r)) / 255.0,
                @as(f32, @floatFromInt(fc.g)) / 255.0,
                @as(f32, @floatFromInt(fc.b)) / 255.0,
                @as(f32, @floatFromInt(fc.a)) / 255.0 * g_paint_opacity,
            );
        }
        // Stroke pass (GPU-native SDF curves)
        const path = svg_path.parsePath(d);
        svg_path.drawStrokeCurves(
            &path,
            @as(f32, @floatFromInt(tc.r)) / 255.0,
            @as(f32, @floatFromInt(tc.g)) / 255.0,
            @as(f32, @floatFromInt(tc.b)) / 255.0,
            @as(f32, @floatFromInt(tc.a)) / 255.0 * g_paint_opacity,
            node.canvas_stroke_width,
            if (g_flow_enabled) node.canvas_flow_speed else 0,
            @as(u32, @truncate(c.SDL_GetTicks())),
        );
        if (is_icon) gpu.resetTransform();
    }
}

/// Paint node visuals: background, hover, text, selection, text input.
/// Separated from paintNode to reduce the recursive frame size.
noinline fn paintNodeVisuals(node: *Node) void {
    const r = node.computed;
    const is_hovered = (hovered_node == node) and (node.handlers.on_hover_enter != null or node.handlers.on_hover_exit != null or node.hoverable);

    if (is_hovered and node.style.background_color == null) {
        gpu.drawRectCorners(r.x, r.y, r.w, r.h, 0.15, 0.15, 0.22, 0.6,
            node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
            0, 0, 0, 0, 0);
    }

    // Box shadow — draw BEFORE background so it appears behind
    if (node.style.shadow_color) |sc| {
        if (node.style.shadow_blur > 0) {
            const sa = @as(f32, @floatFromInt(sc.a)) / 255.0 * g_paint_opacity;
            const sr = @as(f32, @floatFromInt(sc.r)) / 255.0;
            const sg = @as(f32, @floatFromInt(sc.g)) / 255.0;
            const sb = @as(f32, @floatFromInt(sc.b)) / 255.0;
            const ox = node.style.shadow_offset_x;
            const oy = node.style.shadow_offset_y;
            const blur = node.style.shadow_blur;
            if (node.style.shadow_method == 1) {
                // Multi-rect: N expanded rects with fading alpha (shadowMethod: 'rect')
                var steps: u32 = @intFromFloat(@ceil(blur));
                if (steps > 16) steps = 16;
                if (steps < 1) steps = 1;
                const fsteps = @as(f32, @floatFromInt(steps));
                var i: u32 = steps;
                while (i >= 1) : (i -= 1) {
                    const expand = @as(f32, @floatFromInt(i));
                    const alpha = (sa / fsteps) * (fsteps - expand + 1);
                    const rad = node.style.radiusTL() + expand;
                    gpu.drawRect(
                        r.x + ox - expand, r.y + oy - expand,
                        r.w + expand * 2, r.h + expand * 2,
                        sr, sg, sb, alpha,
                        rad, 0, 0, 0, 0, 0,
                    );
                }
            } else {
                // SDF shader: single rect with GPU blur (default, shadowMethod: 'sdf')
                gpu.drawRectShadow(
                    r.x + ox, r.y + oy, r.w, r.h,
                    sr, sg, sb, sa,
                    node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                    blur,
                );
            }
        }
    }

    if (node.style.background_color) |bg_raw| {
        if (bg_raw.a > 0) {
            const bg = if (is_hovered) brighten(bg_raw, 20) else bg_raw;
            const bc = node.style.border_color orelse Color.rgb(0, 0, 0);
            const has_transform = node.style.rotation != 0 or node.style.scale_x != 1.0 or node.style.scale_y != 1.0;
            if (has_transform) {
                gpu.drawRectCornersTransformed(
                    r.x, r.y, r.w, r.h,
                    @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                    @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                    node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                    node.style.brdTop(),
                    @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                    @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                    node.style.rotation, node.style.scale_x, node.style.scale_y,
                );
            } else if (node.style.gradient_color_end) |ge| {
                if (node.style.gradient_direction != .none) {
                    const dir: f32 = switch (node.style.gradient_direction) {
                        .vertical => 1.0,
                        .horizontal => 2.0,
                        else => 0.0,
                    };
                    gpu.drawRectGradient(
                        r.x, r.y, r.w, r.h,
                        @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                        @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                        node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                        node.style.brdTop(),
                        @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                        @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                        @as(f32, @floatFromInt(ge.r)) / 255.0, @as(f32, @floatFromInt(ge.g)) / 255.0,
                        @as(f32, @floatFromInt(ge.b)) / 255.0, @as(f32, @floatFromInt(ge.a)) / 255.0 * g_paint_opacity,
                        dir,
                    );
                } else {
                    gpu.drawRectCorners(
                        r.x, r.y, r.w, r.h,
                        @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                        @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                        node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                        node.style.brdTop(),
                        @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                        @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                    );
                }
            } else {
                gpu.drawRectCorners(
                    r.x, r.y, r.w, r.h,
                    @as(f32, @floatFromInt(bg.r)) / 255.0, @as(f32, @floatFromInt(bg.g)) / 255.0,
                    @as(f32, @floatFromInt(bg.b)) / 255.0, @as(f32, @floatFromInt(bg.a)) / 255.0 * g_paint_opacity,
                    node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                    node.style.brdTop(),
                    @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                    @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
                );
            }
        }
    }

    // Border without background — draw border-only rect with transparent fill
    if (node.style.background_color == null and (node.style.brdTop() > 0 or node.style.border_width > 0)) {
        if (node.style.border_color) |bc| {
            gpu.drawRectCorners(
                r.x, r.y, r.w, r.h,
                0, 0, 0, 0,
                node.style.radiusTL(), node.style.radiusTR(), node.style.radiusBR(), node.style.radiusBL(),
                node.style.brdTop(),
                @as(f32, @floatFromInt(bc.r)) / 255.0, @as(f32, @floatFromInt(bc.g)) / 255.0,
                @as(f32, @floatFromInt(bc.b)) / 255.0, @as(f32, @floatFromInt(bc.a)) / 255.0 * g_paint_opacity,
            );
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
        _ = render_fn;
        if (node.effect_name) |ename| {
            _ = effects.paintNamedEffect(node, ename, r.x, r.y, r.w, r.h);
        } else {
            _ = effects.paintCustomEffect(node, r.x, r.y, r.w, r.h, g_paint_opacity);
        }
    }
    // 3D.View — 3D viewport rendered offscreen, composited here
    if (node.scene3d) {
        _ = r3d.render(node, r.x, r.y, r.w, r.h, g_paint_opacity);
    }

    selection.paintHighlight(node, r.x, r.y);

    // Terminal — cell-grid rendering via vterm
    if (node.terminal) {
        crashlog.logFmt("paint:term id={d}", .{node.terminal_id});
        paintTerminal(node);
        crashlog.log("paint:term-done");
    }

    if (node.text) |t| {
        if (t.len > 0) {
            const tc = node.text_color orelse Color.rgb(255, 255, 255);
            const pl = node.style.padLeft();
            const pt = node.style.padTop();
            const pr = node.style.padRight();
            const final_a = @as(f32, @floatFromInt(tc.a)) / 255.0 * g_paint_opacity;
            gpu.resetInlineSlots();
            // Set up text effect if present
            if (node.text_effect) |ename| {
                if (effects.getEffectFill(ename)) |info| {
                    gpu.setTextEffect(info.pixel_buf, info.width, info.height, info.screen_x, info.screen_y);
                }
            }
            const text_h = gpu.drawTextWrapped(
                t, r.x + pl, r.y + pt, node.font_size, @max(1.0, r.w - pl - pr),
                @as(f32, @floatFromInt(tc.r)) / 255.0, @as(f32, @floatFromInt(tc.g)) / 255.0,
                @as(f32, @floatFromInt(tc.b)) / 255.0, final_a, node.number_of_lines,
            );
            // Render inline glyphs into recorded slot positions
            if (node.inline_glyphs) |glyphs| {
                paintInlineGlyphs(glyphs, node.font_size);
            }
            if (node.text_effect != null) gpu.clearTextEffect();
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

/// Render inline glyphs (polygons embedded in text) at their recorded slot positions.
fn paintInlineGlyphs(glyphs: []const layout.InlineGlyph, font_size: u16) void {
    const slot_count = gpu.getInlineSlotCount();
    const slots = gpu.getInlineSlots();
    var gi: usize = 0;
    while (gi < slot_count and gi < glyphs.len) : (gi += 1) {
        const slot = slots[gi];
        const glyph = glyphs[gi];
        const slot_size = slot.size * glyph.scale;
        if (slot_size <= 0) continue;
        const path = svg_path.parsePath(glyph.d);
        if (path.subpath_count == 0) continue;
        // Compute path bounding box
        var min_x: f32 = 1e9;
        var min_y: f32 = 1e9;
        var max_x: f32 = -1e9;
        var max_y: f32 = -1e9;
        for (0..path.subpath_count) |si| {
            const sp = &path.subpaths[si];
            var pi: u32 = 0;
            while (pi + 1 < sp.count) : (pi += 2) {
                if (sp.points[pi] < min_x) min_x = sp.points[pi];
                if (sp.points[pi + 1] < min_y) min_y = sp.points[pi + 1];
                if (sp.points[pi] > max_x) max_x = sp.points[pi];
                if (sp.points[pi + 1] > max_y) max_y = sp.points[pi + 1];
            }
        }
        const pw = max_x - min_x;
        const ph = max_y - min_y;
        if (pw <= 0 or ph <= 0) continue;
        // Scale to fit slot, centered
        const scale = @min(slot_size / pw, slot_size / ph);
        const cx_path = (min_x + max_x) / 2;
        const cy_path = (min_y + max_y) / 2;
        const cx_slot = slot.x + slot_size / 2;
        const cy_slot = slot.y + @as(f32, @floatFromInt(font_size)) / 2;
        // Transform: translate path center to slot center, scale around slot center
        gpu.setTransform(cx_path, cy_path, cx_slot - cx_path * scale, cy_slot - cy_path * scale, scale);
        // Fill: effect texture or flat color
        var used_effect = false;
        if (glyph.fill_effect) |ename| {
            if (effects.getEffectFill(ename)) |info| {
                // Always use direct triangle fill for inline glyphs. The
                // Blend2D path uses a shared surface that can be overwritten
                // between glyph paints, which breaks effect-masked icons.
                svg_path.drawFillFromEffect(&path, info.pixel_buf, info.width, info.height, min_x, min_y, pw, ph);
                used_effect = true;
            }
        }
        if (!used_effect) {
            const fc = glyph.fill;
            svg_path.drawFill(&path,
                @as(f32, @floatFromInt(fc.r)) / 255.0, @as(f32, @floatFromInt(fc.g)) / 255.0,
                @as(f32, @floatFromInt(fc.b)) / 255.0, @as(f32, @floatFromInt(fc.a)) / 255.0 * g_paint_opacity);
        }
        // Stroke
        if (glyph.stroke_width > 0 and glyph.stroke.a > 0) {
            const sc = glyph.stroke;
            svg_path.drawStrokeCurves(&path,
                @as(f32, @floatFromInt(sc.r)) / 255.0, @as(f32, @floatFromInt(sc.g)) / 255.0,
                @as(f32, @floatFromInt(sc.b)) / 255.0, @as(f32, @floatFromInt(sc.a)) / 255.0 * g_paint_opacity,
                glyph.stroke_width, 0, 0);
        }
        gpu.resetTransform();
    }
}

/// Paint TextInput: typed text, placeholder, selection highlight, blinking cursor.
noinline fn paintTextInput(node: *Node, id: u8) void {
    const r = node.computed;
    if (input.isFocused(id)) {
        const pad: f32 = 4;
        gpu.drawRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 0, 0, 0, 0, 5, 1.5, 1.5, 1.5, 1.5, 0.30);
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
        const max_w = r.w - pl - node.style.padRight();
        const metrics = measureCallback(typed[0..cursor_pos], node.font_size, max_w, 0, 0, 0, false);
        const cx = r.x + pl + metrics.width;
        // Cursor height = one line of text, not the full input height.
        // For multi-line inputs, position cursor at the baseline of the current line.
        const line_h: f32 = @as(f32, @floatFromInt(node.font_size)) * 1.3;
        const cy = r.y + pt + metrics.height - line_h;
        gpu.drawRect(cx, @max(cy, r.y + pt), 2, @max(line_h, 4), 1, 1, 1, 0.8, 0, 0, 0, 0, 0, 0);
    }
}

/// Paint a Terminal node: cell-grid rendering via vterm.
/// Each cell gets its own fg color; non-default backgrounds get a bg rect.
/// Uses span-based batching: consecutive cells with the same fg are drawn as one string.
noinline fn paintTerminal(node: *Node) void {
    const ti = node.terminal_id;
    const r = node.computed;
    const font_size = node.terminal_font_size;
    const padding: f32 = 4;

    // Sanity check: don't paint if vterm not initialized
    if (vterm_mod.getRowsIdx(ti) == 0) {
        crashlog.logFmt("paint:skip id={d} rows=0", .{ti});
        return;
    }

    const cell_w = gpu.getCharWidth(font_size);
    const cell_h = gpu.getLineHeight(font_size);
    if (cell_w <= 0 or cell_h <= 0) return;

    const avail_w = r.w - padding * 2;
    const avail_h = r.h - padding * 2;
    const cols: u16 = @intFromFloat(@max(1, @floor(avail_w / cell_w)));
    const rows: u16 = @intFromFloat(@max(1, @floor(avail_h / cell_h)));

    // Auto-resize vterm to match layout (only if changed)
    const vt_rows = vterm_mod.getRowsIdx(ti);
    const vt_cols = vterm_mod.getColsIdx(ti);
    if (vt_rows != rows or vt_cols != cols) {
        vterm_mod.resizeVtermIdx(ti, rows, cols);
    }

    const base_x = r.x + padding;
    const base_y = r.y + padding;

    // Scrollback: when scrolled up, top rows come from scrollback, rest from live screen
    const scroll_off = vterm_mod.scrollOffsetIdx(ti);
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
            const tok = classifier.getRowTokenIdx(ti, live_r);
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
                vterm_mod.getScrollbackCellIdx(ti, row, col)
            else
                vterm_mod.getCellIdx(ti, row - sb_visible, col);
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
                // Use semantic classifier color for live screen rows (only when overlay active)
                const fg = if (g_semantic_overlay and row >= sb_visible) blk: {
                    const live_row = row - sb_visible;
                    const token = classifier.getRowTokenIdx(ti, live_row);
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
    if (scroll_off == 0 and vterm_mod.getCursorVisibleIdx(ti) and g_cursor_visible) {
        const crow = vterm_mod.getCursorRowIdx(ti);
        const ccol = vterm_mod.getCursorColIdx(ti);
        if (crow < rows and ccol < cols) {
            const cx = base_x + @as(f32, @floatFromInt(ccol)) * cell_w;
            const cy_cur = base_y + @as(f32, @floatFromInt(crow)) * cell_h;
            gpu.drawRect(cx, cy_cur, cell_w, cell_h, 0.8, 0.8, 0.8, 0.7 * g_paint_opacity, 0, 0, 0, 0, 0, 0);
        }
    }
}

/// Check if a Canvas.Node contains graph-space coordinates (for hover detection).
fn hoverTestCanvasNode(child: *const Node, gpos: [2]f32) bool {
    const hw = child.canvas_gw / 2;
    const hh = child.canvas_gh / 2;
    return gpos[0] >= child.canvas_gx - hw and gpos[0] <= child.canvas_gx + hw and
        gpos[1] >= child.canvas_gy - hh and gpos[1] <= child.canvas_gy + hh;
}

/// Hit-test a Canvas.Node against graph-space coordinates.
fn hitTestCanvasNode(child: *Node, gpos: [2]f32) ?*Node {
    const hw = child.canvas_gw / 2;
    const hh = child.canvas_gh / 2;
    if (gpos[0] >= child.canvas_gx - hw and gpos[0] <= child.canvas_gx + hw and
        gpos[1] >= child.canvas_gy - hh and gpos[1] <= child.canvas_gy + hh)
    {
        return layout.hitTest(child, gpos[0], gpos[1]);
    }
    return null;
}

/// Paint a single canvas child (Canvas.Path or Canvas.Node) with highlight + dim/flow.
fn paintCanvasChild(child: *Node, child_idx: u16, hovered: ?u16, selected: ?u16) void {
    if (child.canvas_node) {
        const node_selected = selected != null and selected.? == child_idx;
        const node_hovered = hovered != null and hovered.? == child_idx;
        if (node_selected) {
            const hw = child.canvas_gw / 2 + 5;
            const hh = child.canvas_gh / 2 + 5;
            gpu.drawRect(child.canvas_gx - hw, child.canvas_gy - hh, hw * 2, hh * 2, 0.5, 0.4, 1.0, 0.4, 8, 2, 2, 2, 2, 1.0);
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

/// Paint a Canvas container: transform setup, graph children, HUD layer.
noinline fn paintCanvasContainer(node: *Node) void {
    const r = node.computed;
    const ct = node.canvas_type.?;
    // Apply initial camera only once per canvas instance — re-renders from
    // state updates rebuild the Node tree with canvas_view_set=true each time,
    // which would otherwise reset the user's pan/zoom on every state change.
    if (node.canvas_view_set and !canvas.cameraIsActive(node.canvas_id)) {
        canvas.setCamera(node.canvas_view_x, node.canvas_view_y, node.canvas_view_zoom);
        node.canvas_view_set = false;
    }
    // Apply drift — continuous camera animation (pauses during drag or node selection)
    if (node.canvas_drift_active and canvas_drag_node == null and canvas.getSelectedNode() == null and g_dt_sec > 0) {
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
            if (child.canvas_clamp) continue;
            if (child.canvas_node or child.canvas_path) {
                paintCanvasChild(child, child_idx, hovered, selected);
                child_idx += 1;
            } else {
                // Flatten through non-canvas container (map pool wrapper)
                for (child.children) |*gc| {
                    if (gc.canvas_clamp) continue;
                    paintCanvasChild(gc, child_idx, hovered, selected);
                    child_idx += 1;
                }
            }
        }
    }
    gpu.resetTransform();
    // Force a scissor segment boundary so tile text (batched) renders
    // BEFORE the clamp's background rect. Without this, all rects draw
    // first then all text — tile text bleeds over the clamp background.
    gpu.popScissor();
    gpu.pushScissor(r.x, r.y, r.w, r.h);
    for (node.children) |*child| {
        if (child.canvas_clamp) {
            layout.layoutNode(child, r.x, r.y, r.w, r.h);
            paintNode(child);
        } else if (!child.canvas_node and !child.canvas_path) {
            // Flatten through container for clamp grandchildren
            for (child.children) |*gc| {
                if (gc.canvas_clamp) {
                    layout.layoutNode(gc, r.x, r.y, r.w, r.h);
                    paintNode(gc);
                }
            }
        }
    }
    gpu.popScissor();
}

// ── Engine entry point ──────────────────────────────────────────────────

pub fn run(config_in: AppConfig) !void {
    var config = config_in;
    const startup_t0 = std.time.microTimestamp();
    // Crash log + signal handling for file-explorer launches (no stderr).
    // Logs to /run/user/<uid>/claude-sessions/supervisor-crash.log
    crashlog.init();
    crashlog.log("engine.run: starting");

    // Ignore signals that kill the process when launched without a controlling terminal
    crashlog.ignoreSignal(13); // SIGPIPE
    crashlog.ignoreSignal(1);  // SIGHUP
    crashlog.ignoreSignal(15); // SIGTERM (catch and log instead of die)
    crashlog.ignoreSignal(20); // SIGTSTP

    // External watchdog: monitors RSS spikes + heartbeat from a separate process
    watchdog.init();

    // Debug server — auto-start if TSZ_DEBUG=1 (before SDL so it works headless)
    debug_server.init(config.title);
    defer debug_server.deinit();

    // Witness — record/replay for regression testing
    witness.init();

    if (!c.SDL_Init(c.SDL_INIT_VIDEO)) return error.SDLInitFailed;
    defer {
        c.SDL_Quit();
        watchdog.markCleanExit();
        crashlog.markCleanShutdown();
    }
    log.info(.engine, "SDL initialized", .{});

    // Canvas system init
    canvas.init();

    // Geometry: restore saved window position/size
    geometry.init(std.mem.span(config.title));
    var init_w: c_int = @intCast(config.width);
    var init_h: c_int = @intCast(config.height);
    var init_x: c_int = c.SDL_WINDOWPOS_CENTERED;
    var init_y: c_int = c.SDL_WINDOWPOS_CENTERED;
    const explicit_size = config.width != 1280 or config.height != 800;
    const headless_skip_geo = std.posix.getenv("ZIGOS_HEADLESS") != null;
    if (!headless_skip_geo) {
        if (geometry.load()) |g| {
            init_x = g.x;
            init_y = g.y;
            if (!explicit_size) {
                init_w = g.width;
                init_h = g.height;
            }
            log.info(.geometry, "restored {d}x{d} at ({d},{d})", .{ g.width, g.height, g.x, g.y });
        }
    }
    if (std.posix.getenv("ZIGOS_WINDOW_W")) |ws| {
        if (std.fmt.parseInt(c_int, ws, 10) catch null) |w| init_w = w;
    }
    if (std.posix.getenv("ZIGOS_WINDOW_H")) |hs| {
        if (std.fmt.parseInt(c_int, hs, 10) catch null) |h| init_h = h;
    }

    const builtin_os = @import("builtin").os.tag;
    const headless = std.posix.getenv("ZIGOS_HEADLESS") != null;
    const window_flags: u64 = c.SDL_WINDOW_RESIZABLE |
        (if (comptime builtin_os == .macos) c.SDL_WINDOW_METAL else @as(u64, 0)) |
        (if (headless) c.SDL_WINDOW_HIDDEN else @as(u64, 0)) |
        (if (config.borderless) c.SDL_WINDOW_BORDERLESS else @as(u64, 0));
    const window = c.SDL_CreateWindow(
        config.title,
        init_w, init_h,
        window_flags,
    ) orelse return error.WindowCreateFailed;
    defer c.SDL_DestroyWindow(window);
    defer windows.deinitAll(); // close all secondary windows before SDL_Quit
    // SDL3: position is set after creation (not in CreateWindow)
    _ = c.SDL_SetWindowPosition(window, init_x, init_y);
    _ = c.SDL_SetWindowMinimumSize(window, @intCast(config.min_width), @intCast(config.min_height));

    // Custom window chrome — register hit-test callback for borderless windows
    if (config.borderless) {
        g_chrome_root = config.root;
        g_chrome_window = window;
        _ = c.SDL_SetWindowHitTest(window, windowHitTestCallback, null);
    }

    // Enable text input events (SDL_EVENT_TEXT_INPUT) — required for keyboard input to work
    _ = c.SDL_StartTextInput(window);

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
    {
        const dt = @divTrunc(std.time.microTimestamp() - startup_t0, 1000);
        std.debug.print("[startup] gpu: {d}ms\n", .{dt});
    }

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
    {
        const dt = @divTrunc(std.time.microTimestamp() - startup_t0, 1000);
        std.debug.print("[startup] text: {d}ms\n", .{dt});
    }

    var win_w: f32 = @floatFromInt(init_w);
    var win_h: f32 = @floatFromInt(init_h);
    breakpoint.update(win_w);

    // QuickJS VM
    qjs_runtime.initVM();
    defer qjs_runtime.deinit();

    // LuaJIT logic VM (main-thread — events, state, conditionals)
    luajit_runtime.initVM();
    defer luajit_runtime.deinit();
    @import("audio.zig").registerQjsHostFunctions();
    @import("pty_client.zig").registerQjsHostFunctions();
    @import("applescript.zig").registerQjsHostFunctions();
    {
        const dt = @divTrunc(std.time.microTimestamp() - startup_t0, 1000);
        std.debug.print("[startup] vms: {d}ms\n", .{dt});
    }

    // Register window-open bridge so JS can call __openWindow
    qjs_runtime.setOpenWindowFn(struct {
        fn open(title: [*:0]const u8, w: c_int, h: c_int) void {
            _ = windows.open(.{ .title = title, .width = w, .height = h, .kind = .in_process });
        }
    }.open);

    // App init (FFI registration, state slots, initial conditionals/maps)
    if (config.init) |initFn| initFn();
    {
        const dt = @divTrunc(std.time.microTimestamp() - startup_t0, 1000);
        std.debug.print("[startup] app_init: {d}ms\n", .{dt});
    }

    // Load embedded scripts — after init so host functions are registered,
    // then mark dirty so first tick re-evaluates conditionals with scripts available.
    if (config.js_logic.len > 0) qjs_runtime.evalScript(config.js_logic);
    if (config.lua_logic.len > 0) luajit_runtime.evalScript(config.lua_logic);
    if (config.js_logic.len > 0) qjs_runtime.evalExpr("__luaReady = true;");
    if (config.js_logic.len > 0 or config.lua_logic.len > 0) state_mod.markDirty();
    {
        const dt = @divTrunc(std.time.microTimestamp() - startup_t0, 1000);
        std.debug.print("[startup] scripts: {d}ms\n", .{dt});
    }

    // Test harness — enable if ZIGOS_TEST=1
    if (testharness.envEnabled()) testharness.enable();

    // Initial tick — set up dynamic texts after JS/Lua is evaluated
    if (config.tick) |tickFn| tickFn(@truncate(c.SDL_GetTicks()));
    {
        const dt = @divTrunc(std.time.microTimestamp() - startup_t0, 1000);
        std.debug.print("[startup] first_tick: {d}ms → ready\n", .{dt});
    }

    // PTY remote control socket
    pty_remote.init();
    defer pty_remote.deinit();

    // Main loop
    var running = true;
    var g_carts_scanned = false;
    var fps_frames: u32 = 0;
    var fps_last: u64 = c.SDL_GetTicks();

    while (running) {
        // Hot-reload: check if the app .so was recompiled
        if (config.check_reload) |check| {
            if (check(&config)) {
                // Reset stale pointers from the old .so
                canvas_drag_node = null;
                input_drag_active = false;
                term_sel_dragging = false;
                hovered_node = null;
                g_hover_changed = true;
                // Re-init first (registers host functions), then load scripts
                // (matches startup order: _appInit → evalScript)
                if (config.init) |initFn| initFn();
                if (config.js_logic.len > 0) qjs_runtime.evalScript(config.js_logic);
                if (config.lua_logic.len > 0) luajit_runtime.evalScript(config.lua_logic);
                if (config.js_logic.len > 0) qjs_runtime.evalExpr("__luaReady = true;");
                // Restore preserved state (after init resets to defaults, before tick uses it)
                if (config.post_reload) |postFn| postFn();
                if (config.tick) |tickFn| tickFn(@truncate(c.SDL_GetTicks()));
                // Update chrome root for borderless hit-testing after root swap
                if (config.borderless) g_chrome_root = config.root;
                layout.markLayoutDirty();
                std.debug.print("[hot-reload] App reloaded\n", .{});
            }
        }

        var event: c.SDL_Event = undefined;
        while (c.SDL_PollEvent(&event)) {
            // Route to secondary windows first — if consumed, skip main window handling
            if (windows.routeEvent(&event)) continue;

            switch (event.type) {
                c.SDL_EVENT_QUIT => {
                    std.debug.print("[engine] SDL_EVENT_QUIT received\n", .{});
                    witness.flush(); // save recording before exit
                    running = false;
                },
                c.SDL_EVENT_WINDOW_CLOSE_REQUESTED => {
                    std.debug.print("[engine] SDL_EVENT_WINDOW_CLOSE_REQUESTED for window {d}\n", .{event.window.windowID});
                    running = false;
                },
                c.SDL_EVENT_WINDOW_PIXEL_SIZE_CHANGED => {
                    var ww: c_int = 0;
                    var wh: c_int = 0;
                    _ = c.SDL_GetWindowSize(window, &ww, &wh);
                    win_w = @floatFromInt(ww);
                    win_h = @floatFromInt(wh);
                    gpu.resize(@intCast(ww), @intCast(wh));
                    breakpoint.update(win_w);
                    geometry.save(window);
                    layout.markLayoutDirty();
                },
                c.SDL_EVENT_WINDOW_MOVED => {
                    geometry.save(window);
                },
                c.SDL_EVENT_MOUSE_BUTTON_DOWN => {
                    luajit_runtime.updateMouseButton(true, event.button.button == c.SDL_BUTTON_RIGHT);
                    // Render surface input forwarding (VNC mouse) — check first
                    {
                        const rmx: f32 = event.button.x;
                        const rmy: f32 = event.button.y;
                        if (render_surfaces.handleMouseDown(rmx, rmy, event.button.button)) continue;
                    }
                    // Physics drag — try to grab a dynamic body
                    if (event.button.button == c.SDL_BUTTON_LEFT and physics2d.isInitialized()) {
                        const pmx: f32 = event.button.x;
                        const pmy: f32 = event.button.y;
                        physics2d.startDrag(pmx, pmy);
                    }
                    // Context menu: dismiss on left-click, consume if item was hit
                    if (event.button.button == c.SDL_BUTTON_LEFT and context_menu.isVisible()) {
                        const cmx: f32 = event.button.x;
                        const cmy: f32 = event.button.y;
                        if (context_menu.handleClick(cmx, cmy)) continue;
                        // handleClick returns false for outside clicks (and hides the menu)
                        // — fall through to normal left-click handling
                    }
                    // Right-click — context menu items or on_right_click handler
                    if (event.button.button == c.SDL_BUTTON_RIGHT) {
                        const mx: f32 = event.button.x;
                        const my: f32 = event.button.y;
                        context_menu.hide(); // dismiss any existing menu first
                        const rc_events = @import("events.zig");
                        if (rc_events.hitTestRightClick(config.root, mx, my)) |h| {
                            if (h.handlers.on_right_click) |handler| {
                                handler(mx, my);
                            } else if (h.context_menu_items) |items| {
                                context_menu.show(mx, my, items);
                            }
                        }
                    }
                    if (event.button.button == c.SDL_BUTTON_LEFT) {
                        const mx: f32 = event.button.x;
                        const my: f32 = event.button.y;
                        const events = @import("events.zig");
                        const hit = layout.hitTest(config.root, mx, my);
                        const hit_is_interactive = if (hit) |h| (h.input_id != null or h.handlers.on_press != null or h.handlers.js_on_press != null or h.handlers.lua_on_press != null or h.href != null) else false;
                        if (hit_is_interactive) {
                            const h = hit.?;
                            if (h.input_id) |id| {
                                const now_ms: u32 = @intCast(c.SDL_GetTicks() & 0xFFFFFFFF);
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
                                std.debug.print("[press] zig handler at ({d:.0},{d:.0})\n", .{ mx, my });
                                handler();
                                // Also run JS handler if present
                                if (h.handlers.js_on_press) |js_expr| {
                                    const expr = std.mem.span(js_expr);
                                    std.debug.print("[press] +js: '{s}'\n", .{expr});
                                    qjs_runtime.callGlobal("__beginJsEvent");
                                    qjs_runtime.evalExpr(expr);
                                    qjs_runtime.callGlobal("__endJsEvent");
                                    state_mod.markDirty();
                                    std.debug.print("[press] +js done\n", .{});
                                }
                                // Also run Lua handler if present
                                if (h.handlers.lua_on_press) |lua_expr| {
                                    luajit_runtime.evalExpr(std.mem.span(lua_expr));
                                }
                            } else if (h.handlers.lua_on_press) |lua_expr| {
                                input.unfocus();
                                std.debug.print("[lua_on_press] eval: '{s}'\n", .{std.mem.span(lua_expr)});
                                luajit_runtime.evalExpr(std.mem.span(lua_expr));
                                std.debug.print("[lua_on_press] done\n", .{});
                            } else if (h.handlers.js_on_press) |js_expr| {
                                input.unfocus();
                                const expr = std.mem.span(js_expr);
                                std.debug.print("[js_on_press] eval: '{s}'\n", .{expr});
                                qjs_runtime.callGlobal("__beginJsEvent");
                                qjs_runtime.evalExpr(expr);
                                qjs_runtime.callGlobal("__endJsEvent");
                                state_mod.markDirty();
                                std.debug.print("[js_on_press] done\n", .{});
                            } else if (h.href) |url| {
                                openUrl(url);
                            }
                            // Witness: record the click with semantic target
                            witness.recordClick(h);
                        } else if (events.findCanvasNode(config.root, mx, my)) |cn| {
                            // Canvas click — check for interactive elements inside Canvas.Nodes
                            // Convert screen coords to graph space for canvas-child hit testing
                            const vp_cx = cn.computed.x + cn.computed.w / 2;
                            const vp_cy = cn.computed.y + cn.computed.h / 2;
                            const gpos = canvas.screenToGraph(mx, my, vp_cx, vp_cy);
                            // Find which Canvas.Node child contains the click (flatten through containers)
                            var canvas_child_hit: ?*Node = null;
                            for (cn.children) |*child| {
                                if (child.canvas_node) {
                                    canvas_child_hit = hitTestCanvasNode(child, gpos);
                                    if (canvas_child_hit != null) break;
                                } else if (!child.canvas_path and !child.canvas_clamp) {
                                    for (child.children) |*gc| {
                                        if (gc.canvas_node) {
                                            canvas_child_hit = hitTestCanvasNode(gc, gpos);
                                            if (canvas_child_hit != null) break;
                                        }
                                    }
                                    if (canvas_child_hit != null) break;
                                }
                            }
                            // Dispatch interactive element if found, otherwise select node + start drag
                            var handled_interactive = false;
                            if (canvas_child_hit) |h| {
                                if (h.input_id) |id| {
                                    input.focus(id);
                                    const pl = h.style.padLeft();
                                    const local_x = gpos[0] - h.computed.x - pl;
                                    input.setCursorFromX(id, local_x, h.font_size);
                                    input_drag_active = true;
                                    input_drag_id = id;
                                    input_drag_node_x = h.computed.x;
                                    input_drag_node_pl = pl;
                                    input_drag_font_size = h.font_size;
                                    handled_interactive = true;
                                } else if (h.handlers.on_press) |handler| {
                                    handler();
                                    if (h.handlers.js_on_press) |js_expr| {
                                        qjs_runtime.callGlobal("__beginJsEvent");
                                        qjs_runtime.evalExpr(std.mem.span(js_expr));
                                        qjs_runtime.callGlobal("__endJsEvent");
                                        state_mod.markDirty();
                                    }
                                    if (h.handlers.lua_on_press) |lua_expr| {
                                        luajit_runtime.evalExpr(std.mem.span(lua_expr));
                                    }
                                    handled_interactive = true;
                                } else if (h.handlers.lua_on_press) |lua_expr| {
                                    luajit_runtime.evalExpr(std.mem.span(lua_expr));
                                    handled_interactive = true;
                                } else if (h.handlers.js_on_press) |js_expr| {
                                    qjs_runtime.callGlobal("__beginJsEvent");
                                    qjs_runtime.evalExpr(std.mem.span(js_expr));
                                    qjs_runtime.callGlobal("__endJsEvent");
                                    state_mod.markDirty();
                                    handled_interactive = true;
                                } else if (h.href) |url| {
                                    openUrl(url);
                                    handled_interactive = true;
                                }
                                if (handled_interactive) witness.recordClick(h);
                            }
                            if (!handled_interactive) {
                                // Background click — select/deselect canvas node and start drag
                                input.unfocus();
                                if (canvas.getHoveredNode() != null) canvas.clickNode();
                                canvas_drag_node = cn;
                                canvas_drag_last_x = mx;
                                canvas_drag_last_y = my;
                            }
                        } else {
                            // Check all terminals for click
                            var clicked_term: ?u8 = null;
                            var ti2: u8 = 0;
                            while (ti2 < MAX_TERMINALS) : (ti2 += 1) {
                                if (!terminals_initialized[ti2]) continue;
                                if (findTerminalNodeById(config.root, ti2)) |tn| {
                                    const tr = tn.computed;
                                    if (mx >= tr.x and mx <= tr.x + tr.w and my >= tr.y and my <= tr.y + tr.h) {
                                        clicked_term = ti2;
                                        break;
                                    }
                                }
                            }
                            if (clicked_term) |tid| {
                                g_focused_terminal = tid;
                                if (findTerminalNodeById(config.root, tid)) |tn| {
                                    const cell = termPixelToCell(tn, mx, my);
                                    term_sel_start_row = cell.row;
                                    term_sel_start_col = cell.col;
                                    term_sel_end_row = cell.row;
                                    term_sel_end_col = cell.col;
                                    term_sel_active = false;
                                    term_sel_dragging = true;
                                }
                            } else {
                                termClearSelection();
                                selection.onMouseDown(config.root, mx, my, @intCast(c.SDL_GetTicks() & 0xFFFFFFFF));
                            }
                            input.unfocus();
                        }
                    }
                },
                c.SDL_EVENT_MOUSE_MOTION => {
                    const mx: f32 = event.motion.x;
                    const my: f32 = event.motion.y;
                    luajit_runtime.updateMouse(mx, my);
                    // Render surface mouse motion forwarding
                    if (render_surfaces.handleMouseMotion(mx, my)) continue;
                    // Physics drag update
                    if (physics2d.isDragging()) {
                        physics2d.updateDrag(mx, my);
                    }
                    // Terminal drag selection
                    if (term_sel_dragging) {
                        if (findTerminalNodeById(config.root, g_focused_terminal)) |tn| {
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
                    updateHover(config.root, mx, my);
                    // Context menu hover tracking
                    context_menu.updateHover(mx, my);
                    // Canvas hit testing — find which Canvas.Node the mouse is over
                    {
                        const mevents = @import("events.zig");
                        if (mevents.findCanvasNode(config.root, mx, my)) |cn| {
                            const vp_cx = cn.computed.x + cn.computed.w / 2;
                            const vp_cy = cn.computed.y + cn.computed.h / 2;
                            const gpos = canvas.screenToGraph(mx, my, vp_cx, vp_cy);
                            // Check Canvas.Node children (flatten through containers)
                            var found_idx: ?u16 = null;
                            var ci: u16 = 0;
                            for (cn.children) |*child| {
                                if (child.canvas_node) {
                                    if (hoverTestCanvasNode(child, gpos)) found_idx = ci;
                                    ci += 1;
                                } else if (!child.canvas_path and !child.canvas_clamp) {
                                    for (child.children) |*gc| {
                                        if (gc.canvas_node) {
                                            if (hoverTestCanvasNode(gc, gpos)) found_idx = ci;
                                            ci += 1;
                                        } else if (gc.canvas_path) {
                                            ci += 1;
                                        }
                                    }
                                } else if (child.canvas_path) {
                                    ci += 1;
                                }
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
                c.SDL_EVENT_MOUSE_BUTTON_UP => {
                    luajit_runtime.updateMouseButton(false, event.button.button == c.SDL_BUTTON_RIGHT);
                    // Render surface mouse up forwarding
                    {
                        const rmx: f32 = event.button.x;
                        const rmy: f32 = event.button.y;
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
                c.SDL_EVENT_TEXT_INPUT => {
                    // SDL3: event.text.text is a const char* pointer
                    const text_ptr: [*:0]const u8 = @ptrCast(event.text.text orelse continue);
                    // Native terminal gets text first
                    if (terminals_initialized[g_focused_terminal]) {
                        terminalHandleTextInput(text_ptr);
                        continue;
                    }
                    // PTY gets text first when active
                    if (qjs_runtime.ptyActive()) {
                        qjs_runtime.ptyHandleTextInput(text_ptr);
                        continue;
                    }
                    // Render surface text input forwarding
                    if (render_surfaces.handleTextInput(text_ptr)) continue;
                    input.handleTextInput(text_ptr);
                },
                c.SDL_EVENT_KEY_DOWN => {
                    const sym: c_int = @intCast(event.key.key);
                    const mod = event.key.mod;
                    // Capture key (F9 recording toggle)
                    if (capture.handleKey(sym)) continue;
                    // Terminal copy/paste: Ctrl+Shift+C/V (not Ctrl+C which is SIGINT)
                    if (terminals_initialized[g_focused_terminal]) {
                        const t_ctrl = (mod & c.SDL_KMOD_CTRL) != 0;
                        const t_shift = (mod & c.SDL_KMOD_SHIFT) != 0;
                        if (t_ctrl and t_shift and sym == c.SDLK_C) {
                            if (term_sel_active) {
                                var copy_buf: [8192]u8 = undefined;
                                const len = vterm_mod.copySelectedTextIdx(
                                    g_focused_terminal,
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
                        // Ctrl+Shift+D — toggle semantic overlay
                        if (t_ctrl and t_shift and sym == c.SDLK_D) {
                            g_semantic_overlay = !g_semantic_overlay;
                            // When overlay turns on, activate basic classifier if none set
                            if (g_semantic_overlay and classifier.getModeIdx(g_focused_terminal) == .none) {
                                classifier.setModeIdx(g_focused_terminal, .basic);
                                classifier.markDirtyIdx(g_focused_terminal);
                            }
                            std.debug.print("[semantic] overlay {s}\n", .{if (g_semantic_overlay) "ON" else "OFF"});
                            continue;
                        }
                        if (t_ctrl and t_shift and sym == c.SDLK_V) {
                            const clip = c.SDL_GetClipboardText();
                            if (clip != null) {
                                vterm_mod.scrollToBottomIdx(g_focused_terminal);
                                vterm_mod.writePtyIdx(g_focused_terminal, std.mem.span(clip));
                                c.SDL_free(@ptrCast(clip));
                            }
                            continue;
                        }
                    }
                    // Native terminal special key routing
                    if (terminals_initialized[g_focused_terminal]) {
                        terminalHandleKey(sym, mod);
                        continue;
                    }
                    // PTY special key routing (arrows, enter, backspace, ctrl combos)
                    if (qjs_runtime.ptyActive()) {
                        qjs_runtime.ptyHandleKeyDown(sym, mod);
                        continue;
                    }
                    // Render surface key forwarding
                    if (render_surfaces.handleKeyDown(sym)) continue;
                    {
                        const ctrl = (mod & c.SDL_KMOD_CTRL) != 0;
                        const input_consumed = if (input.getFocusedId() != null)
                            (if (ctrl) input.handleCtrlKey(sym) else input.handleKey(sym))
                        else
                            false;
                        if (!input_consumed and !videos.handleKey(sym)) {
                            selection.onKeyDown(config.root, sym, mod);
                            // Forward key events to QuickJS script layer
                            qjs_runtime.callGlobalInt("__onKeyDown", @intCast(sym));
                        }
                    }
                },
                c.SDL_EVENT_KEY_UP => {
                    _ = render_surfaces.handleKeyUp(@intCast(event.key.key));
                },
                c.SDL_EVENT_MOUSE_WHEEL => {
                    // SDL3: mouse_x/mouse_y are in the wheel event itself
                    const mx: f32 = event.wheel.mouse_x;
                    const my: f32 = event.wheel.mouse_y;
                    witness.recordScroll(mx, my, event.wheel.x, event.wheel.y);
                    const events = @import("events.zig");
                    // Terminal scrollback — mouse wheel scrolls history (check all terminals)
                    {
                        var scroll_ti: u8 = 0;
                        var scroll_handled = false;
                        while (scroll_ti < MAX_TERMINALS) : (scroll_ti += 1) {
                            if (!terminals_initialized[scroll_ti]) continue;
                            if (findTerminalNodeById(config.root, scroll_ti)) |tn| {
                                const tr = tn.computed;
                                if (mx >= tr.x and mx <= tr.x + tr.w and my >= tr.y and my <= tr.y + tr.h) {
                                    const wheel_y: i32 = @intFromFloat(event.wheel.y);
                                    if (wheel_y > 0) {
                                        vterm_mod.scrollUpIdx(scroll_ti, @intCast(wheel_y * 3));
                                    } else if (wheel_y < 0) {
                                        vterm_mod.scrollDownIdx(scroll_ti, @intCast(-wheel_y * 3));
                                    }
                                    scroll_handled = true;
                                    break;
                                }
                            }
                        }
                        if (scroll_handled) continue;
                    }
                    // Canvas: check for scroll containers inside tiles before zooming
                    if (events.findCanvasNode(config.root, mx, my)) |cn| {
                        // Transform mouse to graph space, then search each canvas tile for ScrollViews
                        const vp_cx = cn.computed.x + cn.computed.w / 2;
                        const vp_cy = cn.computed.y + cn.computed.h / 2;
                        const gpos = canvas.screenToGraph(mx, my, vp_cx, vp_cy);
                        var scroll_hit: ?*Node = null;
                        for (cn.children) |*tile| {
                            if (!tile.canvas_node) continue;
                            // Each canvas tile's children have graph-space computed rects
                            for (tile.children) |*tile_child| {
                                if (events.findScrollContainer(tile_child, gpos[0], gpos[1])) |s| {
                                    scroll_hit = s;
                                    break;
                                }
                            }
                            if (scroll_hit != null) break;
                        }
                        if (scroll_hit) |scroll_node| {
                            const sc: f32 = if (comptime @import("builtin").os.tag == .macos) 10.0 else 30.0;
                            if (event.wheel.y != 0) scroll_node.scroll_y -= event.wheel.y * sc;
                            if (event.wheel.x != 0) scroll_node.scroll_y -= event.wheel.x * sc;
                            const max_s = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
                            scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_s));
                            luajit_runtime.persistScrollSlot(scroll_node.scroll_persist_slot, scroll_node.scroll_y);
                        } else {
                            const delta: f32 = event.wheel.y;
                            canvas.handleScroll(mx - cn.computed.x, my - cn.computed.y, delta, cn.computed.w, cn.computed.h);
                        }
                    } else if (events.findScrollContainer(config.root, mx, my)) |scroll_node| {
                        if (event.wheel.y != 0) {
                            // macOS trackpad: SDL3 gives pixel-precise fractional deltas
                            // Mouse wheel: SDL3 gives ±1.0 per notch
                            const scale: f32 = if (comptime @import("builtin").os.tag == .macos) 10.0 else 30.0;
                            scroll_node.scroll_y -= event.wheel.y * scale;
                        }
                        if (event.wheel.x != 0) {
                            const scale_x: f32 = if (comptime @import("builtin").os.tag == .macos) 10.0 else @max(scroll_node.computed.h * 0.8, 60.0);
                            scroll_node.scroll_y -= event.wheel.x * scale_x;
                        }
                        const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
                        scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
                        luajit_runtime.persistScrollSlot(scroll_node.scroll_persist_slot, scroll_node.scroll_y);
                    }
                },
                c.SDL_EVENT_DROP_FILE => {
                    if (event.drop.data) |data_ptr| {
                        filedrop.dispatch(std.mem.span(data_ptr), config.root);
                        // SDL3: drop data is managed by SDL, no SDL_free needed
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

        // LuaJIT tick
        luajit_runtime.tick();

        // App tick (FFI polling, state updates, dynamic texts)
        if (config.tick) |tickFn| {
            tickFn(@truncate(c.SDL_GetTicks()));
            // Tick may reset arena pools (map rebuilds), invalidating node pointers.
            // Null out hovered_node to prevent telemetry/paint from reading freed memory.
            // Next mouse move re-establishes it via updateHover().
            hovered_node = null;
        }

        // Tick all loaded cartridges + scan for new <Cartridge> nodes (first frame only)
        if (cart.count() > 0) cart.tickAll(@truncate(c.SDL_GetTicks()));
        if (!g_carts_scanned) {
            g_carts_scanned = true;
            scanCartridgeNodes(config.root);
        }

        // (devtools tick removed — inspector lives in tsz-tools)

        // Transition tick — interpolate active transitions AFTER style updates, BEFORE layout
        {
            const now_t: u32 = @truncate(c.SDL_GetTicks());
            const dt_t = now_t -% g_prev_tick;
            const dt_t_sec = @as(f32, @floatFromInt(dt_t)) / 1000.0;
            _ = transition.tick(dt_t_sec);
            if (transition.needsRelayout()) layout.markLayoutDirty();
        }

        // Physics 2D init — create world and bodies on first frame (before layout)
        if (!physics_initialized) {
            initPhysicsFromTree(config.root);
            physics_initialized = true;
        }

        // PTY remote control — accept connections, process commands
        pty_remote.poll();

        // Terminal tick — init PTYs for all Terminal nodes, poll for output
        {
            crashlog.log("tick:term-start");
            var term_count: u8 = 0;
            findTerminalNodes(config.root, &term_count);
            var ti: u8 = 0;
            while (ti < term_count) : (ti += 1) {
                if (!terminals_initialized[ti]) {
                    vterm_mod.spawnShellIdx(ti, "bash", 24, 80);
                    terminals_initialized[ti] = true;
                }
                crashlog.log("tick:poll");
                if (vterm_mod.pollPtyIdx(ti)) {
                    classifier.markDirtyIdx(ti);
                    layout.markLayoutDirty();
                }
                // Auto-detect CLI from banner text (first 6 rows)
                if (!g_semantic_detected_flags[ti]) {
                    const detect_rows = @min(vterm_mod.getRowsIdx(ti), 6);
                    var dr: u16 = 0;
                    while (dr < detect_rows) : (dr += 1) {
                        const dt = vterm_mod.getRowTextIdx(ti, dr);
                        if (dt.len > 0 and std.mem.indexOf(u8, dt, "Claude Code") != null) {
                            classifier.setModeIdx(ti, .claude_code);
                            classifier.markDirtyIdx(ti);
                            g_semantic_detected_flags[ti] = true;
                            break;
                        }
                    }
                }
                // Re-classify when damage occurred
                if (classifier.isDirtyIdx(ti) and classifier.getModeIdx(ti) != .none and classifier.getModeIdx(ti) != .json) {
                    const cls_rows = vterm_mod.getRowsIdx(ti);
                    var cls_r: u16 = 0;
                    while (cls_r < cls_rows) : (cls_r += 1) {
                        const cls_text = vterm_mod.getRowTextIdx(ti, cls_r);
                        classifier.classifyAndCacheIdx(ti, cls_r, cls_text, cls_rows);
                    }
                    classifier.clearDirtyIdx(ti);
                    // Only build semantic graph for terminal 0 (primary)
                    if (ti == 0) semantic.tick(cls_rows);
                }
            }
        }

        // Layout (main window) — skip full flex pass when nothing invalidated geometry
        const t2 = std.time.microTimestamp();
        const app_h = win_h;
        layout.layout(config.root, 0, 0, win_w, app_h);
        const t3 = std.time.microTimestamp();
        qjs_runtime.telemetry_layout_us = @intCast(@max(0, t3 - t2));

        // Physics 2D tick — step world, sync body positions to nodes AFTER layout
        // (physics overwrites computed.x/y — must happen after layout sets them)
        if (physics2d.isInitialized()) {
            const now_p: u32 = @truncate(c.SDL_GetTicks());
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
        const now_tick: u32 = @truncate(c.SDL_GetTicks());
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
        g_paint_count = 0;
        g_budget_exceeded = false;
        g_hidden_count = 0;
        const t4 = std.time.microTimestamp();
        paintNode(config.root);

        // (devtools paint removed — inspector lives in tsz-tools)

        // Tooltip overlay (always on top of main tree)
        tooltip.paintOverlay(measureCallback, win_w, win_h);

        // Context menu overlay (on top of everything except debug pairing)
        context_menu.paintOverlay(measureCallback, win_w, win_h);

        // Debug pairing overlay — modal with 6-digit code
        if (debug_server.getPairingCode()) |code| {
            // Semi-transparent backdrop
            gpu.drawRect(0, 0, win_w, win_h, 0, 0, 0, 0.6, 0, 0, 0, 0, 0, 0);
            // Card background
            const cw: f32 = 320;
            const ch: f32 = 140;
            const cx = (win_w - cw) / 2;
            const cy = (win_h - ch) / 2;
            gpu.drawRect(cx, cy, cw, ch, 0.12, 0.14, 0.20, 0.95, 12, 0, 0, 0, 0, 0);
            // Border
            gpu.drawRect(cx, cy, cw, ch, 0, 0, 0, 0, 12, 1.5, 1.5, 1.5, 1.5, 0.38);
            // Title
            _ = gpu.drawTextWrapped("Debug Pairing", cx + 20, cy + 16, 15, cw - 40, 0.89, 0.91, 0.94, 1.0, 0);
            // Code (large)
            _ = gpu.drawTextWrapped(code, cx + 60, cy + 55, 36, cw - 120, 0.38, 0.65, 0.98, 1.0, 0);
            // Hint
            _ = gpu.drawTextWrapped("Enter this code in tsz-tools", cx + 20, cy + 108, 11, cw - 40, 0.58, 0.63, 0.73, 0.8, 0);
        }

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

        // Witness — record tree snapshots / replay actions
        if (witness.tick(config.root)) {
            witness.flush();
            std.process.exit(witness.exitCode());
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
        const now: u64 = c.SDL_GetTicks();
        if (now -% fps_last >= 1000) {
            qjs_runtime.telemetry_fps = fps_frames;
            luajit_runtime.telemetry_fps = fps_frames;
            // Use last frame's counts directly (counters reset per-frame for budget checks)
            const ppf = g_paint_count;
            const hpf = g_hidden_count;
            const zpf = g_zero_count;
            std.debug.print("[telemetry] FPS: {d} | layout: {d}us | paint: {d}us | visible: {d}/{d} | gpu: {d}/{d} | hidden: {d} | zero: {d} | bridge: {d}/s\n", .{
                fps_frames, qjs_runtime.telemetry_layout_us, qjs_runtime.telemetry_paint_us, ppf, PAINT_BUDGET, gpu.g_gpu_ops, gpu.GPU_OPS_BUDGET, hpf, zpf, qjs_runtime.bridge_calls_this_second,
            });
            log.writeLine("[telemetry] FPS: {d} | layout: {d}us | paint: {d}us | visible: {d}/{d} | gpu: {d}/{d} | hidden: {d} | zero: {d} | bridge: {d}/s", .{
                fps_frames, qjs_runtime.telemetry_layout_us, qjs_runtime.telemetry_paint_us, ppf, PAINT_BUDGET, gpu.g_gpu_ops, gpu.GPU_OPS_BUDGET, hpf, zpf, qjs_runtime.bridge_calls_this_second,
            });
            qjs_runtime.telemetry_bridge_calls = qjs_runtime.bridge_calls_this_second;
            qjs_runtime.bridge_calls_this_second = 0;
            @import("luajit_worker.zig").logTelemetry();
            @import("audio.zig").logTelemetry();
            watchdog.heartbeat();
            g_budget_exceeded = false;
            g_hover_changed = false;
            g_hidden_count = 0;
            g_zero_count = 0;
            fps_frames = 0;
            fps_last = now;
        }
    }
}
