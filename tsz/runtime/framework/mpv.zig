//! ReactJIT mpv integration — video playback via libmpv
//!
//! Simple wrapper around mpv's client API. Creates an mpv instance
//! that opens its own window. For embedded rendering (into SDL texture),
//! use the render API in a future phase.
//!
//! This is the native equivalent of lua/videos.lua — same library,
//! no LuaJIT FFI middleman.

const std = @import("std");
const c = @cImport({
    @cInclude("mpv/client.h");
});

var g_handle: ?*c.mpv_handle = null;

/// Initialize mpv if not already done. Lazy — only called on first play().
fn ensureInit() bool {
    if (g_handle != null) return true;

    const handle = c.mpv_create() orelse return false;

    // Configure for standalone window playback
    _ = c.mpv_set_option_string(handle, "vo", "gpu");
    _ = c.mpv_set_option_string(handle, "hwdec", "auto");
    _ = c.mpv_set_option_string(handle, "keep-open", "yes");
    _ = c.mpv_set_option_string(handle, "osd-level", "1");
    _ = c.mpv_set_option_string(handle, "terminal", "no");
    _ = c.mpv_set_option_string(handle, "input-default-bindings", "yes");
    _ = c.mpv_set_option_string(handle, "input-vo-keyboard", "yes");

    if (c.mpv_initialize(handle) < 0) {
        c.mpv_terminate_destroy(handle);
        return false;
    }

    g_handle = handle;
    std.debug.print("[mpv] Initialized\n", .{});
    return true;
}

/// Play a video file or URL. Opens mpv's own window.
/// Safe to call multiple times — replaces the current video.
pub fn play(path: [*:0]const u8) void {
    if (!ensureInit()) {
        std.debug.print("[mpv] Failed to initialize\n", .{});
        return;
    }

    const handle = g_handle.?;
    var cmd = [_:null]?[*:0]const u8{ "loadfile", path, "replace" };
    const err = c.mpv_command(handle, @ptrCast(&cmd));
    if (err < 0) {
        std.debug.print("[mpv] loadfile failed: {s}\n", .{c.mpv_error_string(err)});
        return;
    }

    // Unpause
    _ = c.mpv_set_option_string(handle, "pause", "no");
    std.debug.print("[mpv] Playing: {s}\n", .{path});
}

/// Stop playback.
pub fn stop() void {
    if (g_handle) |handle| {
        var cmd = [_:null]?[*:0]const u8{"stop"};
        _ = c.mpv_command(handle, @ptrCast(&cmd));
    }
}

/// Pause/unpause.
pub fn setPaused(paused: bool) void {
    if (g_handle) |handle| {
        _ = c.mpv_set_option_string(handle, "pause", if (paused) "yes" else "no");
    }
}

/// Drain mpv's event queue. Call once per frame from the main loop.
/// Without this, mpv can't process window close, EOF, etc.
pub fn poll() void {
    if (g_handle) |handle| {
        while (true) {
            const ev = c.mpv_wait_event(handle, 0);
            if (ev.*.event_id == c.MPV_EVENT_NONE) break;
            if (ev.*.event_id == c.MPV_EVENT_SHUTDOWN) {
                // User closed the mpv window — clean up
                c.mpv_terminate_destroy(handle);
                g_handle = null;
                std.debug.print("[mpv] Window closed by user\n", .{});
                return;
            }
        }
    }
}

/// Clean shutdown.
pub fn deinit() void {
    if (g_handle) |handle| {
        c.mpv_terminate_destroy(handle);
        g_handle = null;
        std.debug.print("[mpv] Destroyed\n", .{});
    }
}
