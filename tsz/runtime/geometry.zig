//! Window geometry persistence — save/restore window position and size.
//!
//! Main window only. Saves to /tmp/tsz-geometry-<app-name>.dat as 16 bytes
//! (4 x i32: x, y, width, height). Validates against SDL display bounds
//! on restore to handle monitor changes.
//!
//! Anti-race: blocks saves for 2s after restore to prevent resize callbacks
//! from overwriting the restored position.

const std = @import("std");
const c = @import("c.zig").imports;

pub const WindowGeometry = struct {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
};

const SAVE_BLOCK_MS: u32 = 2000;
var save_blocked_until: u32 = 0;

var path_buf: [256]u8 = undefined;
var path_len: usize = 0;

pub fn init(app_name: []const u8) void {
    const prefix = "/tmp/tsz-geometry-";
    const suffix = ".dat";
    const total = prefix.len + app_name.len + suffix.len;
    if (total >= path_buf.len) return;
    @memcpy(path_buf[0..prefix.len], prefix);
    @memcpy(path_buf[prefix.len .. prefix.len + app_name.len], app_name);
    @memcpy(path_buf[prefix.len + app_name.len .. total], suffix);
    path_len = total;
}

fn getPath() [:0]const u8 {
    if (path_len == 0) return "/tmp/tsz-geometry.dat";
    path_buf[path_len] = 0;
    return path_buf[0..path_len :0];
}

pub fn save(window: *c.SDL_Window) void {
    const now = c.SDL_GetTicks();
    if (now < save_blocked_until) return;

    var x: c_int = undefined;
    var y: c_int = undefined;
    c.SDL_GetWindowPosition(window, &x, &y);

    var w: c_int = undefined;
    var h: c_int = undefined;
    c.SDL_GetWindowSize(window, &w, &h);

    const geom = WindowGeometry{
        .x = @intCast(x),
        .y = @intCast(y),
        .width = @intCast(w),
        .height = @intCast(h),
    };

    const bytes: *const [16]u8 = @ptrCast(&geom);
    const file = std.fs.createFileAbsolute(getPath(), .{}) catch return;
    defer file.close();
    file.writeAll(bytes) catch {};
}

pub fn load() ?WindowGeometry {
    const file = std.fs.openFileAbsolute(getPath(), .{}) catch return null;
    defer file.close();

    var bytes: [16]u8 = undefined;
    const n = file.readAll(&bytes) catch return null;
    if (n < 16) return null;

    const geom: *const WindowGeometry = @ptrCast(@alignCast(&bytes));
    const g = geom.*;

    // Basic sanity check
    if (g.width < 100 or g.height < 100) return null;
    if (g.width > 10000 or g.height > 10000) return null;

    // Validate against actual display bounds
    const num_displays = c.SDL_GetNumVideoDisplays();
    if (num_displays <= 0) return g; // can't validate, trust it

    var on_screen = false;
    var i: c_int = 0;
    while (i < num_displays) : (i += 1) {
        var bounds: c.SDL_Rect = undefined;
        if (c.SDL_GetDisplayBounds(i, &bounds) == 0) {
            const cx = g.x + @divTrunc(g.width, 2);
            const cy = g.y + @divTrunc(g.height, 2);
            if (cx >= bounds.x and cx < bounds.x + bounds.w and
                cy >= bounds.y and cy < bounds.y + bounds.h)
            {
                on_screen = true;
                break;
            }
        }
    }

    if (!on_screen) return null;
    return g;
}

pub fn blockSaves() void {
    save_blocked_until = c.SDL_GetTicks() + SAVE_BLOCK_MS;
}
