//! ReactJIT Multi-Window Manager
//!
//! Multiple SDL2 windows in the same process. No IPC. No TCP. No sockets.
//! Each window has its own SDL_Window + SDL_Renderer + TextEngine + ImageCache.
//! State is shared — same address space, same variables.
//!
//! Usage from generated code:
//!   const win_id = windows.open("Inspector", 400, 300);
//!   windows.setRoot(win_id, &my_tree);
//!   // In main loop:
//!   windows.layoutAll();
//!   windows.paintAll();
//!   windows.presentAll();

const std = @import("std");
const c = @import("c.zig").imports;
const layout = @import("layout.zig");
const text_mod = @import("text.zig");
const image_mod = @import("image.zig");
const events = @import("events.zig");
const Node = layout.Node;
const Color = layout.Color;
const TextEngine = text_mod.TextEngine;
const ImageCache = image_mod.ImageCache;

const MAX_WINDOWS = 8;

pub const WindowSlot = struct {
    active: bool = false,
    window: ?*c.SDL_Window = null,
    renderer: ?*c.SDL_Renderer = null,
    window_id: u32 = 0, // SDL window ID for event routing
    text_engine: ?TextEngine = null,
    image_cache: ?ImageCache = null,
    root: ?*Node = null,
    hovered: ?*Node = null,
    win_w: f32 = 400,
    win_h: f32 = 300,
    bg_color: Color = Color.rgb(24, 24, 32),
};

var slots: [MAX_WINDOWS]WindowSlot = [_]WindowSlot{.{}} ** MAX_WINDOWS;
var slot_count: usize = 0;

/// Check if any window with this root is already open.
pub fn isRootOpen(root: *Node) bool {
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active and slots[i].root == root) return true;
    }
    return false;
}

/// Open a new window. Returns slot index, or null on failure.
pub fn open(title: [*:0]const u8, w: c_int, h: c_int) ?usize {
    // Find a free slot
    var idx: usize = 0;
    while (idx < MAX_WINDOWS) : (idx += 1) {
        if (!slots[idx].active) break;
    }
    if (idx >= MAX_WINDOWS) return null;

    const window = c.SDL_CreateWindow(
        title,
        c.SDL_WINDOWPOS_CENTERED,
        c.SDL_WINDOWPOS_CENTERED,
        w,
        h,
        c.SDL_WINDOW_SHOWN | c.SDL_WINDOW_RESIZABLE,
    ) orelse return null;

    const renderer = c.SDL_CreateRenderer(
        window,
        -1,
        c.SDL_RENDERER_ACCELERATED | c.SDL_RENDERER_PRESENTVSYNC,
    ) orelse {
        c.SDL_DestroyWindow(window);
        return null;
    };
    _ = c.SDL_SetRenderDrawBlendMode(renderer, c.SDL_BLENDMODE_BLEND);

    const window_id = c.SDL_GetWindowID(window);

    // Each window gets its own text engine and image cache
    const text_engine = TextEngine.init(renderer, "fonts/base/DejaVuSans-Regular.ttf") catch
        TextEngine.init(renderer, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") catch {
        c.SDL_DestroyRenderer(renderer);
        c.SDL_DestroyWindow(window);
        return null;
    };

    const image_cache = ImageCache.init(renderer);

    slots[idx] = .{
        .active = true,
        .window = window,
        .renderer = renderer,
        .window_id = window_id,
        .text_engine = text_engine,
        .image_cache = image_cache,
        .root = null,
        .hovered = null,
        .win_w = @floatFromInt(w),
        .win_h = @floatFromInt(h),
    };
    slot_count += 1;

    std.debug.print("[windows] Opened window {d}: {s} ({d}x{d})\n", .{ idx, title, w, h });
    return idx;
}

/// Close a window by slot index.
pub fn close(idx: usize) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;

    if (slots[idx].image_cache) |*cache| cache.deinit();
    if (slots[idx].text_engine) |*te| te.deinit();
    if (slots[idx].renderer) |r| c.SDL_DestroyRenderer(r);
    if (slots[idx].window) |w| c.SDL_DestroyWindow(w);

    std.debug.print("[windows] Closed window {d}\n", .{idx});
    slots[idx] = .{};
    if (slot_count > 0) slot_count -= 1;
}

/// Set the root node tree for a window.
pub fn setRoot(idx: usize, root: *Node) void {
    if (idx >= MAX_WINDOWS) return;
    slots[idx].root = root;
}

/// Find which window slot an SDL window ID belongs to. Returns null if not found.
pub fn findByWindowId(sdl_window_id: u32) ?usize {
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active and slots[i].window_id == sdl_window_id) return i;
    }
    return null;
}

/// Handle a window resize event.
pub fn handleResize(idx: usize, w: c_int, h: c_int) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;
    slots[idx].win_w = @floatFromInt(w);
    slots[idx].win_h = @floatFromInt(h);
}

/// Handle a window close event.
pub fn handleClose(idx: usize) void {
    close(idx);
}

/// Handle mouse motion for hover state.
pub fn handleMouseMotion(idx: usize, mx: f32, my: f32) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;
    if (slots[idx].root) |root| {
        const prev = slots[idx].hovered;
        slots[idx].hovered = events.hitTest(root, mx, my);
        if (prev != slots[idx].hovered) {
            if (prev) |p| { if (p.handlers.on_hover_exit) |h| h(); }
            if (slots[idx].hovered) |n| { if (n.handlers.on_hover_enter) |h| h(); }
        }
    }
}

/// Handle mouse click.
pub fn handleClick(idx: usize, mx: f32, my: f32) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;
    if (slots[idx].root) |root| {
        if (events.hitTest(root, mx, my)) |node| {
            if (node.handlers.on_press) |handler| handler();
        }
    }
}

/// Handle mouse wheel for scroll.
pub fn handleWheel(idx: usize, mx: f32, my: f32, dy: f32) void {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return;
    if (slots[idx].root) |root| {
        if (events.findScrollContainer(root, mx, my)) |scroll_node| {
            scroll_node.scroll_y -= dy * 30.0;
            const max_scroll = @max(0.0, scroll_node.content_height - scroll_node.computed.h);
            scroll_node.scroll_y = @max(0.0, @min(scroll_node.scroll_y, max_scroll));
        }
    }
}

/// Layout all active windows.
pub fn layoutAll() void {
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active) {
            if (slots[i].root) |root| {
                // Temporarily set the text engine for this window's layout pass
                if (slots[i].text_engine) |*te| {
                    const prev_te = layout_text_engine_backup;
                    layout_text_engine_backup = te;
                    layout.layout(root, 0, 0, slots[i].win_w, slots[i].win_h);
                    layout_text_engine_backup = prev_te;
                } else {
                    layout.layout(root, 0, 0, slots[i].win_w, slots[i].win_h);
                }
            }
        }
    }
}

// Backup pointer for text engine swapping during layout
var layout_text_engine_backup: ?*TextEngine = null;

/// Paint and present all active windows.
pub fn paintAndPresent(brighten_fn: *const fn (Color) Color) void {
    for (0..MAX_WINDOWS) |i| {
        if (!slots[i].active) continue;
        const rend = slots[i].renderer orelse continue;
        const root = slots[i].root orelse continue;
        if (slots[i].text_engine == null or slots[i].image_cache == null) continue;
        // CRITICAL: use pointers into the slot, not copies.
        // Copying TextEngine/ImageCache leaks SDL textures every frame.
        const te: *TextEngine = &slots[i].text_engine.?;
        const ic: *ImageCache = &slots[i].image_cache.?;

        const bg = slots[i].bg_color;
        _ = c.SDL_SetRenderDrawColor(rend, bg.r, bg.g, bg.b, bg.a);
        _ = c.SDL_RenderClear(rend);

        paintNode(rend, te, ic, root, 0, 0, slots[i].hovered, brighten_fn);

        c.SDL_RenderPresent(rend);
    }
}

/// Recursive paint for a secondary window (standalone, doesn't use the main Painter).
fn paintNode(
    rend: *c.SDL_Renderer,
    te: *TextEngine,
    ic: *ImageCache,
    node: *Node,
    sx: f32,
    sy: f32,
    hovered: ?*Node,
    brighten_fn: *const fn (Color) Color,
) void {
    if (node.style.display == .none) return;
    const screen_x = node.computed.x - sx;
    const screen_y = node.computed.y - sy;

    if (node.style.background_color) |col| {
        const is_hovered = (hovered != null and hovered.? == node);
        const paint_col = if (is_hovered) brighten_fn(col) else col;
        _ = c.SDL_SetRenderDrawColor(rend, paint_col.r, paint_col.g, paint_col.b, paint_col.a);
        var r = c.SDL_Rect{
            .x = @intFromFloat(screen_x),
            .y = @intFromFloat(screen_y),
            .w = @intFromFloat(node.computed.w),
            .h = @intFromFloat(node.computed.h),
        };
        _ = c.SDL_RenderFillRect(rend, &r);
    }

    if (node.image_src) |src| {
        if (ic.load(src)) |img| {
            var dst = c.SDL_Rect{
                .x = @intFromFloat(screen_x),
                .y = @intFromFloat(screen_y),
                .w = @intFromFloat(node.computed.w),
                .h = @intFromFloat(node.computed.h),
            };
            _ = c.SDL_RenderCopy(rend, img.texture, null, &dst);
        }
    }

    if (node.text) |txt| {
        const pad_l = node.style.padLeft();
        const pad_r = node.style.padRight();
        const pad_t = node.style.padTop();
        const col = node.text_color orelse Color.rgb(255, 255, 255);
        const text_max_w = node.computed.w - pad_l - pad_r;
        te.drawTextWrapped(txt, screen_x + pad_l, screen_y + pad_t, node.font_size, text_max_w, col);
    }

    // Recurse children (simplified — no scissor clipping for now)
    for (node.children) |*child| {
        paintNode(rend, te, ic, child, sx, sy, hovered, brighten_fn);
    }
}

/// Return how many windows are active.
pub fn count() usize {
    return slot_count;
}

/// Close all windows.
pub fn deinitAll() void {
    for (0..MAX_WINDOWS) |i| {
        if (slots[i].active) close(i);
    }
}

/// Get a slot (for external read access).
pub fn getSlot(idx: usize) ?*WindowSlot {
    if (idx >= MAX_WINDOWS or !slots[idx].active) return null;
    return &slots[idx];
}
