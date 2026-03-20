//! Render surfaces — external display capture, virtual displays, VM rendering.
//!
//! Port of love2d/lua/render_source.lua + capabilities/render.lua.
//! Captures external pixel sources and renders them as textured quads in wgpu.
//!
//! Source types (parsed from string):
//!   "screen:0"           — Screen capture via X11/XShm (<1ms for 1080p)
//!   "cam:0"              — Webcam via FFmpeg/v4l2
//!   "hdmi:0"             — HDMI capture card via FFmpeg/v4l2
//!   "window:Firefox"     — Window capture via XShm (composited)
//!   "display"            — Virtual display (Xvfb/Xephyr + XShm capture)
//!   "vm:disk.qcow2"      — Boot VM via QEMU, capture via VNC
//!   "debian.iso"         — Auto-detect VM from file extension
//!   "vnc:host:port"      — Direct VNC connection
//!   "monitor:Name"       — Virtual monitor via xrandr + XShm
//!   "/dev/video0"        — Direct v4l2 device
//!
//! Architecture:
//!   1. parseSource() → SourceType enum + metadata
//!   2. Per-source Feed struct with backend-specific state
//!   3. update() polls backends for new RGBA frames
//!   4. paintSurface() uploads frame to wgpu texture, queues textured quad
//!
//! Integration: same pattern as videos.zig — node.render_src drives paint.

const std = @import("std");
const builtin = @import("builtin");
const wgpu = @import("wgpu");
const c = @import("c.zig").imports;
const gpu_core = @import("gpu/gpu.zig");
const images = @import("gpu/images.zig");
const log = @import("log.zig");

const page_alloc = std.heap.page_allocator;
const posix = std.posix;

// ════════════════════════════════════════════════════════════════════════
// X11/XShm FFI declarations
// ════════════════════════════════════════════════════════════════════════

const Display = opaque {};
const Visual = opaque {};
const XID = c_ulong;

const XImage = extern struct {
    width: c_int,
    height: c_int,
    xoffset: c_int,
    format: c_int,
    data: ?[*]u8,
    byte_order: c_int,
    bitmap_unit: c_int,
    bitmap_bit_order: c_int,
    bitmap_pad: c_int,
    depth: c_int,
    bytes_per_line: c_int,
    bits_per_pixel: c_int,
    red_mask: c_ulong,
    green_mask: c_ulong,
    blue_mask: c_ulong,
    obdata: ?*anyopaque,
    // function pointers — opaque, we don't call them
    f_create_image: ?*anyopaque,
    f_destroy_image: ?*anyopaque,
    f_get_pixel: ?*anyopaque,
    f_put_pixel: ?*anyopaque,
    f_sub_image: ?*anyopaque,
    f_add_pixel: ?*anyopaque,
};

const XShmSegmentInfo = extern struct {
    shmseg: c_ulong,
    shmid: c_int,
    shmaddr: ?[*]u8,
    read_only: c_int,
};

// X11 constants
const ZPixmap: c_int = 2;
const AllPlanes: c_ulong = 0xFFFFFFFF;

// POSIX shared memory constants
const IPC_PRIVATE: c_int = 0;
const IPC_RMID: c_int = 0;
const IPC_CREAT: c_int = 512;

// X11 function pointers (loaded at runtime via dlopen)
const X11Fns = struct {
    XOpenDisplay: *const fn (?[*:0]const u8) callconv(.c) ?*Display = undefined,
    XCloseDisplay: *const fn (*Display) callconv(.c) c_int = undefined,
    XDefaultRootWindow: *const fn (*Display) callconv(.c) XID = undefined,
    XDefaultScreen: *const fn (*Display) callconv(.c) c_int = undefined,
    XDefaultVisual: *const fn (*Display, c_int) callconv(.c) ?*Visual = undefined,
    XDefaultDepth: *const fn (*Display, c_int) callconv(.c) c_int = undefined,
    XDisplayWidth: *const fn (*Display, c_int) callconv(.c) c_int = undefined,
    XDisplayHeight: *const fn (*Display, c_int) callconv(.c) c_int = undefined,
    XFree: *const fn (?*anyopaque) callconv(.c) c_int = undefined,
    XFlush: *const fn (*Display) callconv(.c) c_int = undefined,
    XWarpPointer: *const fn (*Display, XID, XID, c_int, c_int, c_uint, c_uint, c_int, c_int) callconv(.c) c_int = undefined,
    XKeysymToKeycode: *const fn (*Display, c_ulong) callconv(.c) u8 = undefined,
};

// XTest extension function pointers (for synthetic input — no subprocess overhead)
const XTestFns = struct {
    XTestFakeKeyEvent: *const fn (*Display, c_uint, c_int, c_ulong) callconv(.c) c_int = undefined,
    XTestFakeButtonEvent: *const fn (*Display, c_uint, c_int, c_ulong) callconv(.c) c_int = undefined,
    XTestFakeMotionEvent: *const fn (*Display, c_int, c_int, c_int, c_ulong) callconv(.c) c_int = undefined,
};

const XExtFns = struct {
    XShmQueryExtension: *const fn (*Display) callconv(.c) c_int = undefined,
    XShmCreateImage: *const fn (*Display, ?*Visual, c_uint, c_int, ?[*]u8, *XShmSegmentInfo, c_uint, c_uint) callconv(.c) ?*XImage = undefined,
    XShmAttach: *const fn (*Display, *XShmSegmentInfo) callconv(.c) c_int = undefined,
    XShmDetach: *const fn (*Display, *XShmSegmentInfo) callconv(.c) c_int = undefined,
    XShmGetImage: *const fn (*Display, XID, *XImage, c_int, c_int, c_ulong) callconv(.c) c_int = undefined,
};

// POSIX shm (libc — linked by build.zig)
extern fn shmget(key: c_int, size: usize, shmflg: c_int) c_int;
extern fn shmat(shmid: c_int, shmaddr: ?*anyopaque, shmflg: c_int) ?*anyopaque;
extern fn shmdt(shmaddr: *anyopaque) c_int;
extern fn shmctl(shmid: c_int, cmd: c_int, buf: ?*anyopaque) c_int;

// POSIX fcntl — use the Linux syscall directly (libc fcntl is variadic, can't extern it cleanly)
const linux = std.os.linux;

fn setNonBlocking(fd: posix.fd_t) void {
    // F_GETFL=3, F_SETFL=4, O_NONBLOCK=0x800 on Linux
    const flags = linux.fcntl(fd, 3, 0); // F_GETFL
    if (@as(isize, @bitCast(flags)) < 0) return;
    _ = linux.fcntl(fd, 4, flags | 0x800); // F_SETFL | O_NONBLOCK
}

// ════════════════════════════════════════════════════════════════════════
// Module state
// ════════════════════════════════════════════════════════════════════════

var x11_lib: ?*anyopaque = null;
var xext_lib: ?*anyopaque = null;
var xtst_lib: ?*anyopaque = null;
var x11: X11Fns = .{};
var xext: XExtFns = .{};
var xtst: XTestFns = .{};
var xshm_available: bool = false;
var xtest_available: bool = false;
var x11_load_attempted: bool = false;

// Shared X11 display connection (dedicated for capture)
var x_display: ?*Display = null;
var x_root: XID = 0;
var x_screen: c_int = 0;

// ════════════════════════════════════════════════════════════════════════
// Source type parsing
// ════════════════════════════════════════════════════════════════════════

pub const SourceType = enum {
    screen,
    cam,
    hdmi,
    v4l2,
    window,
    display,
    vm,
    vnc_direct,
    monitor,
    unknown,
};

pub const ParsedSource = struct {
    source_type: SourceType = .unknown,
    index: u32 = 0,
    device: ?[]const u8 = null,
    title: ?[]const u8 = null,
    path: ?[]const u8 = null,
    host: ?[]const u8 = null,
    port: u16 = 0,
    name: ?[]const u8 = null,
    resolution: ?[]const u8 = null,
    command: ?[]const u8 = null, // app to launch into virtual display
};

const VM_EXTENSIONS = [_][]const u8{ "iso", "img", "qcow2", "qcow", "vmdk", "vdi", "vhd" };

pub fn parseSource(source: []const u8) ParsedSource {
    if (source.len == 0) return .{};

    if (std.mem.eql(u8, source, "self") or std.mem.eql(u8, source, "display")) {
        return .{ .source_type = .display };
    }
    if (std.mem.startsWith(u8, source, "display:")) {
        return .{ .source_type = .display, .resolution = source[8..] };
    }
    // app:command — launch command in virtual display
    if (std.mem.startsWith(u8, source, "app:")) {
        return .{ .source_type = .display, .command = source[4..] };
    }
    if (std.mem.startsWith(u8, source, "vnc:")) {
        const rest = source[4..];
        if (std.mem.lastIndexOfScalar(u8, rest, ':')) |colon| {
            const port = std.fmt.parseInt(u16, rest[colon + 1 ..], 10) catch 0;
            if (port > 0) return .{ .source_type = .vnc_direct, .host = rest[0..colon], .port = port };
        }
        return .{};
    }
    if (std.mem.startsWith(u8, source, "vm:")) {
        return .{ .source_type = .vm, .path = source[3..] };
    }
    if (std.mem.startsWith(u8, source, "monitor:")) {
        return .{ .source_type = .monitor, .name = source[8..] };
    }
    if (std.mem.startsWith(u8, source, "screen:")) {
        const idx = std.fmt.parseInt(u32, source[7..], 10) catch 0;
        return .{ .source_type = .screen, .index = idx };
    }
    if (std.mem.startsWith(u8, source, "cam:")) {
        const idx = std.fmt.parseInt(u32, source[4..], 10) catch 0;
        return .{ .source_type = .cam, .index = idx };
    }
    if (std.mem.startsWith(u8, source, "hdmi:")) {
        const idx = std.fmt.parseInt(u32, source[5..], 10) catch 0;
        return .{ .source_type = .hdmi, .index = idx };
    }
    if (std.mem.startsWith(u8, source, "window:")) {
        return .{ .source_type = .window, .title = source[7..] };
    }
    if (std.mem.startsWith(u8, source, "/dev/video")) {
        return .{ .source_type = .v4l2, .device = source };
    }
    if (std.mem.lastIndexOfScalar(u8, source, '.')) |dot| {
        const ext = source[dot + 1 ..];
        for (VM_EXTENSIONS) |vm_ext| {
            if (std.ascii.eqlIgnoreCase(ext, vm_ext)) {
                return .{ .source_type = .vm, .path = source };
            }
        }
    }
    return .{};
}

// ════════════════════════════════════════════════════════════════════════
// Backend enum
// ════════════════════════════════════════════════════════════════════════

const Backend = enum {
    xshm,
    ffmpeg,
    vnc,
    display_xshm,
};

// ════════════════════════════════════════════════════════════════════════
// Feed — per-source capture state
// ════════════════════════════════════════════════════════════════════════

pub const FeedStatus = enum { starting, connecting, ready, @"error", stopped };

const MAX_FEEDS = 8;
const UNLOAD_DEBOUNCE_FRAMES = 180; // ~3s at 60fps

const Feed = struct {
    source: []const u8 = "",
    parsed: ParsedSource = .{},
    backend: Backend = .xshm,
    status: FeedStatus = .starting,
    active: bool = false,
    inactive_frames: u32 = 0,

    // Capture dimensions
    width: u32 = 0,
    height: u32 = 0,

    // CPU pixel buffer (RGBA)
    pixel_buf: ?[]u8 = null,
    dirty: bool = false,

    // wgpu resources
    texture: ?*wgpu.Texture = null,
    texture_view: ?*wgpu.TextureView = null,
    sampler: ?*wgpu.Sampler = null,
    bind_group: ?*wgpu.BindGroup = null,

    // XShm state
    xshm_image: ?*XImage = null,
    xshm_info: XShmSegmentInfo = .{ .shmseg = 0, .shmid = -1, .shmaddr = null, .read_only = 0 },
    capture_ox: c_int = 0,
    capture_oy: c_int = 0,
    display_dpy: ?*Display = null,
    display_root: XID = 0,

    // FFmpeg subprocess state
    ffmpeg_child: ?std.process.Child = null,
    ffmpeg_stdout: ?std.fs.File = null,
    ffmpeg_read_offset: usize = 0, // partial frame read progress

    // VNC state
    vnc_socket: ?posix.socket_t = null,
    vnc_state: VncState = .not_connected,
    vnc_fb_width: u16 = 0,
    vnc_fb_height: u16 = 0,
    vnc_read_buf: [4096]u8 = undefined,

    // Process management
    qemu_child: ?std.process.Child = null,
    x_server_child: ?std.process.Child = null,
    app_child: ?std.process.Child = null, // app launched into virtual display
    display_num: ?u32 = null,
    vnc_port: u16 = 0,
    startup_wait: u32 = 0, // frames to wait for process startup
    app_command: ?[]const u8 = null, // command to launch after display is ready

    // Interactive mode
    interactive: bool = false,

    fn deinit(self: *Feed) void {
        if (self.bind_group) |bg| bg.release();
        if (self.sampler) |s| s.release();
        if (self.texture_view) |tv| tv.release();
        if (self.texture) |t| t.destroy();
        self.bind_group = null;
        self.sampler = null;
        self.texture_view = null;
        self.texture = null;

        if (self.pixel_buf) |buf| page_alloc.free(buf);
        self.pixel_buf = null;

        self.releaseXShm();

        if (self.display_dpy) |dpy| _ = x11.XCloseDisplay(dpy);
        self.display_dpy = null;

        self.closeVnc();
        self.closeFFmpeg();
        self.killSubprocesses();

        self.status = .stopped;
    }

    fn releaseXShm(self: *Feed) void {
        if (self.xshm_image) |img| {
            const dpy = self.display_dpy orelse x_display orelse return;
            if (self.xshm_info.shmid >= 0) {
                _ = xext.XShmDetach(dpy, &self.xshm_info);
                if (self.xshm_info.shmaddr) |addr| _ = shmdt(addr);
                self.xshm_info.shmid = -1;
                self.xshm_info.shmaddr = null;
            }
            img.data = null;
            _ = x11.XFree(@ptrCast(img));
            self.xshm_image = null;
        }
    }

    fn closeVnc(self: *Feed) void {
        if (self.vnc_socket) |sock| posix.close(sock);
        self.vnc_socket = null;
        self.vnc_state = .not_connected;
    }

    fn closeFFmpeg(self: *Feed) void {
        if (self.ffmpeg_child) |*child| {
            _ = child.kill() catch {};
            _ = child.wait() catch {};
        }
        self.ffmpeg_child = null;
        self.ffmpeg_stdout = null;
        self.ffmpeg_read_offset = 0;
    }

    fn killSubprocesses(self: *Feed) void {
        if (self.qemu_child) |*child| {
            _ = child.kill() catch {};
            _ = child.wait() catch {};
        }
        self.qemu_child = null;
        if (self.app_child) |*child| {
            _ = child.kill() catch {};
            _ = child.wait() catch {};
        }
        self.app_child = null;
        if (self.x_server_child) |*child| {
            _ = child.kill() catch {};
            _ = child.wait() catch {};
        }
        self.x_server_child = null;
    }
};

var feeds: [MAX_FEEDS]Feed = [_]Feed{.{}} ** MAX_FEEDS;
var feed_count: usize = 0;

// ════════════════════════════════════════════════════════════════════════
// VNC RFB protocol state machine
// ════════════════════════════════════════════════════════════════════════

const VncState = enum {
    not_connected,
    wait_version, // waiting for server RFB version (12 bytes)
    wait_security_types, // waiting for security type count
    wait_security_result, // waiting for security result (4 bytes)
    wait_server_init, // waiting for ServerInit (24 bytes + name)
    ready, // can send FramebufferUpdateRequest, read updates
    failed,
};

// ════════════════════════════════════════════════════════════════════════
// X11/XShm initialization (runtime dlopen)
// ════════════════════════════════════════════════════════════════════════

extern fn dlopen(filename: ?[*:0]const u8, flags: c_int) ?*anyopaque;
extern fn dlsym(handle: *anyopaque, symbol: [*:0]const u8) ?*anyopaque;
extern fn dlclose(handle: *anyopaque) c_int;
const RTLD_LAZY: c_int = 0x00001;

fn loadSym(comptime T: type, handle: *anyopaque, name: [*:0]const u8) ?T {
    const ptr = dlsym(handle, name) orelse return null;
    return @ptrCast(ptr);
}

fn initXShm() bool {
    if (x11_load_attempted) return xshm_available;
    x11_load_attempted = true;

    x11_lib = dlopen("libX11.so.6", RTLD_LAZY) orelse dlopen("libX11.so", RTLD_LAZY) orelse {
        log.info(.render, "libX11 not found", .{});
        return false;
    };
    xext_lib = dlopen("libXext.so.6", RTLD_LAZY) orelse dlopen("libXext.so", RTLD_LAZY) orelse {
        log.info(.render, "libXext not found", .{});
        return false;
    };

    x11.XOpenDisplay = loadSym(@TypeOf(x11.XOpenDisplay), x11_lib.?, "XOpenDisplay") orelse return false;
    x11.XCloseDisplay = loadSym(@TypeOf(x11.XCloseDisplay), x11_lib.?, "XCloseDisplay") orelse return false;
    x11.XDefaultRootWindow = loadSym(@TypeOf(x11.XDefaultRootWindow), x11_lib.?, "XDefaultRootWindow") orelse return false;
    x11.XDefaultScreen = loadSym(@TypeOf(x11.XDefaultScreen), x11_lib.?, "XDefaultScreen") orelse return false;
    x11.XDefaultVisual = loadSym(@TypeOf(x11.XDefaultVisual), x11_lib.?, "XDefaultVisual") orelse return false;
    x11.XDefaultDepth = loadSym(@TypeOf(x11.XDefaultDepth), x11_lib.?, "XDefaultDepth") orelse return false;
    x11.XDisplayWidth = loadSym(@TypeOf(x11.XDisplayWidth), x11_lib.?, "XDisplayWidth") orelse return false;
    x11.XDisplayHeight = loadSym(@TypeOf(x11.XDisplayHeight), x11_lib.?, "XDisplayHeight") orelse return false;
    x11.XFree = loadSym(@TypeOf(x11.XFree), x11_lib.?, "XFree") orelse return false;

    xext.XShmQueryExtension = loadSym(@TypeOf(xext.XShmQueryExtension), xext_lib.?, "XShmQueryExtension") orelse return false;
    xext.XShmCreateImage = loadSym(@TypeOf(xext.XShmCreateImage), xext_lib.?, "XShmCreateImage") orelse return false;
    xext.XShmAttach = loadSym(@TypeOf(xext.XShmAttach), xext_lib.?, "XShmAttach") orelse return false;
    xext.XShmDetach = loadSym(@TypeOf(xext.XShmDetach), xext_lib.?, "XShmDetach") orelse return false;
    xext.XShmGetImage = loadSym(@TypeOf(xext.XShmGetImage), xext_lib.?, "XShmGetImage") orelse return false;

    // Additional X11 functions for input forwarding
    x11.XFlush = loadSym(@TypeOf(x11.XFlush), x11_lib.?, "XFlush") orelse return false;
    x11.XWarpPointer = loadSym(@TypeOf(x11.XWarpPointer), x11_lib.?, "XWarpPointer") orelse return false;
    x11.XKeysymToKeycode = loadSym(@TypeOf(x11.XKeysymToKeycode), x11_lib.?, "XKeysymToKeycode") orelse return false;

    // XTest extension (for synthetic input — zero subprocess overhead)
    xtst_lib = dlopen("libXtst.so.6", RTLD_LAZY) orelse dlopen("libXtst.so", RTLD_LAZY);
    if (xtst_lib) |lib| {
        const key_fn = loadSym(@TypeOf(xtst.XTestFakeKeyEvent), lib, "XTestFakeKeyEvent");
        const btn_fn = loadSym(@TypeOf(xtst.XTestFakeButtonEvent), lib, "XTestFakeButtonEvent");
        const mot_fn = loadSym(@TypeOf(xtst.XTestFakeMotionEvent), lib, "XTestFakeMotionEvent");
        if (key_fn != null and btn_fn != null and mot_fn != null) {
            xtst.XTestFakeKeyEvent = key_fn.?;
            xtst.XTestFakeButtonEvent = btn_fn.?;
            xtst.XTestFakeMotionEvent = mot_fn.?;
            xtest_available = true;
            log.info(.render, "XTest extension loaded (fast input path)", .{});
        }
    }

    const display_env = posix.getenv("DISPLAY") orelse {
        log.info(.render, "no DISPLAY env", .{});
        return false;
    };
    var display_name_buf: [64]u8 = undefined;
    if (display_env.len >= display_name_buf.len) return false;
    @memcpy(display_name_buf[0..display_env.len], display_env);
    display_name_buf[display_env.len] = 0;
    const display_name: [*:0]const u8 = display_name_buf[0..display_env.len :0];

    x_display = x11.XOpenDisplay(display_name) orelse {
        log.info(.render, "XOpenDisplay failed", .{});
        return false;
    };

    if (xext.XShmQueryExtension(x_display.?) == 0) {
        _ = x11.XCloseDisplay(x_display.?);
        x_display = null;
        log.info(.render, "XShm extension not available", .{});
        return false;
    }

    x_screen = x11.XDefaultScreen(x_display.?);
    x_root = x11.XDefaultRootWindow(x_display.?);
    xshm_available = true;
    log.info(.render, "XShm capture ready", .{});
    return true;
}

/// Open a dedicated X connection to a specific display (e.g. ":10" for virtual display)
fn openDisplayConnection(display_num: u32) ?*Display {
    var buf: [16]u8 = undefined;
    const name = std.fmt.bufPrint(&buf, ":{d}", .{display_num}) catch return null;
    buf[name.len] = 0;
    const cname: [*:0]const u8 = buf[0..name.len :0];
    return x11.XOpenDisplay(cname);
}

// ════════════════════════════════════════════════════════════════════════
// XShm capture context creation
// ════════════════════════════════════════════════════════════════════════

fn createXShmCapture(feed: *Feed, dpy: *Display, w: u32, h: u32) bool {
    const scr = if (feed.display_dpy != null) x11.XDefaultScreen(dpy) else x_screen;
    const visual = x11.XDefaultVisual(dpy, scr) orelse return false;
    const depth: c_uint = @intCast(x11.XDefaultDepth(dpy, scr));

    feed.xshm_info = .{ .shmseg = 0, .shmid = -1, .shmaddr = null, .read_only = 0 };

    const ximage = xext.XShmCreateImage(dpy, visual, depth, ZPixmap, null, &feed.xshm_info, @intCast(w), @intCast(h)) orelse return false;

    const shmsize: usize = @intCast(@as(c_uint, @intCast(ximage.bytes_per_line)) * @as(c_uint, @intCast(ximage.height)));
    feed.xshm_info.shmid = shmget(IPC_PRIVATE, shmsize, IPC_CREAT | 0o666);
    if (feed.xshm_info.shmid < 0) {
        _ = x11.XFree(@ptrCast(ximage));
        return false;
    }

    const shm_ptr = shmat(feed.xshm_info.shmid, null, 0) orelse {
        _ = shmctl(feed.xshm_info.shmid, IPC_RMID, null);
        _ = x11.XFree(@ptrCast(ximage));
        return false;
    };
    feed.xshm_info.shmaddr = @ptrCast(@alignCast(shm_ptr));
    ximage.data = @ptrCast(@alignCast(shm_ptr));
    feed.xshm_info.read_only = 0;

    _ = xext.XShmAttach(dpy, &feed.xshm_info);
    _ = shmctl(feed.xshm_info.shmid, IPC_RMID, null);

    feed.xshm_image = ximage;
    feed.width = w;
    feed.height = h;
    return true;
}

/// Capture a frame via XShm: BGRX → RGBA conversion into feed.pixel_buf
fn captureXShm(feed: *Feed) bool {
    const dpy = feed.display_dpy orelse x_display orelse return false;
    const img = feed.xshm_image orelse return false;
    const dest = feed.pixel_buf orelse return false;
    const drawable = if (feed.display_dpy != null) feed.display_root else x_root;

    if (xext.XShmGetImage(dpy, drawable, img, feed.capture_ox, feed.capture_oy, AllPlanes) == 0) return false;

    const src: [*]const u8 = img.data orelse return false;
    const w = feed.width;
    const h = feed.height;
    const bpl: usize = @intCast(img.bytes_per_line);
    const w4 = w * 4;

    if (bpl == w4) {
        const npixels = w * h;
        var i: usize = 0;
        while (i < npixels * 4) : (i += 4) {
            dest[i] = src[i + 2]; // R
            dest[i + 1] = src[i + 1]; // G
            dest[i + 2] = src[i]; // B
            dest[i + 3] = 255; // A
        }
    } else {
        var y: usize = 0;
        while (y < h) : (y += 1) {
            const src_row = y * bpl;
            const dst_row = y * w4;
            var px: usize = 0;
            while (px < w4) : (px += 4) {
                dest[dst_row + px] = src[src_row + px + 2];
                dest[dst_row + px + 1] = src[src_row + px + 1];
                dest[dst_row + px + 2] = src[src_row + px];
                dest[dst_row + px + 3] = 255;
            }
        }
    }

    feed.dirty = true;
    return true;
}

// ════════════════════════════════════════════════════════════════════════
// wgpu texture creation (same pattern as videos.zig)
// ════════════════════════════════════════════════════════════════════════

fn ensureTexture(feed: *Feed) bool {
    if (feed.bind_group != null) return true;
    const device = gpu_core.getDevice() orelse return false;
    const w = feed.width;
    const h = feed.height;
    if (w == 0 or h == 0) return false;

    const tex = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("render_surface"),
        .size = .{ .width = w, .height = h, .depth_or_array_layers = 1 },
        .mip_level_count = 1,
        .sample_count = 1,
        .dimension = .@"2d",
        .format = .rgba8_unorm,
        .usage = wgpu.TextureUsages.texture_binding | wgpu.TextureUsages.copy_dst,
    }) orelse return false;

    const view = tex.createView(&.{
        .format = .rgba8_unorm,
        .dimension = .@"2d",
        .base_mip_level = 0,
        .mip_level_count = 1,
        .base_array_layer = 0,
        .array_layer_count = 1,
        .aspect = .all,
    }) orelse {
        tex.destroy();
        return false;
    };

    const sampler = device.createSampler(&.{
        .address_mode_u = .clamp_to_edge,
        .address_mode_v = .clamp_to_edge,
        .mag_filter = .linear,
        .min_filter = .linear,
    }) orelse {
        view.release();
        tex.destroy();
        return false;
    };

    const bg = images.createBindGroup(view, sampler) orelse {
        sampler.release();
        view.release();
        tex.destroy();
        return false;
    };

    feed.texture = tex;
    feed.texture_view = view;
    feed.sampler = sampler;
    feed.bind_group = bg;
    return true;
}

fn uploadPixels(feed: *Feed) void {
    if (!feed.dirty) return;
    feed.dirty = false;

    const tex = feed.texture orelse return;
    const buf = feed.pixel_buf orelse return;
    const queue = gpu_core.getQueue() orelse return;
    const w = feed.width;
    const h = feed.height;
    const row_bytes = w * 4;

    // Flip rows vertically before upload.
    // The shared image shader has `1.0 - corner.y` (UV Y-flip for GL readback),
    // but our sources (VNC, XShm, FFmpeg) produce top-down frames.
    // Flipping here cancels the shader flip → correct orientation.
    // Use @memcpy with a temp row buffer — much faster than XOR byte swap.
    if (row_bytes <= 8192) {
        var tmp: [8192]u8 = undefined;
        const tmp_row = tmp[0..row_bytes];
        var top: usize = 0;
        var bot: usize = h - 1;
        while (top < bot) {
            const top_ptr = buf[top * row_bytes ..][0..row_bytes];
            const bot_ptr = buf[bot * row_bytes ..][0..row_bytes];
            @memcpy(tmp_row, top_ptr);
            @memcpy(top_ptr, bot_ptr);
            @memcpy(bot_ptr, tmp_row);
            top += 1;
            bot -= 1;
        }
    }

    queue.writeTexture(
        &.{ .texture = tex, .mip_level = 0, .origin = .{ .x = 0, .y = 0, .z = 0 }, .aspect = .all },
        @ptrCast(buf.ptr),
        @as(usize, w) * @as(usize, h) * 4,
        &.{ .offset = 0, .bytes_per_row = w * 4, .rows_per_image = h },
        &.{ .width = w, .height = h, .depth_or_array_layers = 1 },
    );
}

// ════════════════════════════════════════════════════════════════════════
// FFmpeg subprocess backend (cam/hdmi/v4l2/window fallback/screen fallback)
// ════════════════════════════════════════════════════════════════════════

/// Spawn ffmpeg as a child process writing raw RGBA to stdout.
fn startFFmpeg(feed: *Feed, parsed: ParsedSource, fps: u32, w: u32, h: u32) bool {
    var dev_buf: [32]u8 = undefined;
    var size_buf: [16]u8 = undefined;
    var fps_buf: [8]u8 = undefined;

    const size_str = std.fmt.bufPrint(&size_buf, "{d}x{d}", .{ w, h }) catch return false;
    const fps_str = std.fmt.bufPrint(&fps_buf, "{d}", .{fps}) catch return false;

    // Build argv as []const u8 slices (Zig 0.15 Child.init API)
    var argv: [20][]const u8 = undefined;
    var argc: usize = 0;

    argv[argc] = "ffmpeg";
    argc += 1;
    argv[argc] = "-nostdin";
    argc += 1;
    argv[argc] = "-loglevel";
    argc += 1;
    argv[argc] = "quiet";
    argc += 1;

    switch (parsed.source_type) {
        .cam, .hdmi, .v4l2 => {
            const device_str: []const u8 = switch (parsed.source_type) {
                .cam, .hdmi => std.fmt.bufPrint(&dev_buf, "/dev/video{d}", .{parsed.index}) catch return false,
                .v4l2 => parsed.device orelse return false,
                else => unreachable,
            };

            argv[argc] = "-f";
            argc += 1;
            argv[argc] = "v4l2";
            argc += 1;
            argv[argc] = "-framerate";
            argc += 1;
            argv[argc] = fps_str;
            argc += 1;
            argv[argc] = "-video_size";
            argc += 1;
            argv[argc] = size_str;
            argc += 1;
            argv[argc] = "-i";
            argc += 1;
            argv[argc] = device_str;
            argc += 1;
        },
        .screen => {
            const display_env = posix.getenv("DISPLAY") orelse ":0";
            argv[argc] = "-f";
            argc += 1;
            argv[argc] = "x11grab";
            argc += 1;
            argv[argc] = "-framerate";
            argc += 1;
            argv[argc] = fps_str;
            argc += 1;
            argv[argc] = "-video_size";
            argc += 1;
            argv[argc] = size_str;
            argc += 1;
            argv[argc] = "-i";
            argc += 1;
            argv[argc] = display_env;
            argc += 1;
        },
        else => return false,
    }

    // Output format: raw RGBA to stdout
    argv[argc] = "-f";
    argc += 1;
    argv[argc] = "rawvideo";
    argc += 1;
    argv[argc] = "-pix_fmt";
    argc += 1;
    argv[argc] = "rgba";
    argc += 1;
    argv[argc] = "-an";
    argc += 1;
    argv[argc] = "-sn";
    argc += 1;
    argv[argc] = "-";
    argc += 1;

    var child = std.process.Child.init(argv[0..argc], page_alloc);
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Ignore;
    child.stdin_behavior = .Ignore;

    child.spawn() catch |err| {
        log.info(.render, "FFmpeg spawn failed: {}", .{err});
        return false;
    };

    feed.ffmpeg_child = child;
    feed.ffmpeg_stdout = child.stdout.?;

    // Set stdout to non-blocking so update() doesn't stall
    const fd = child.stdout.?.handle;
    setNonBlocking(fd);

    feed.width = w;
    feed.height = h;
    feed.pixel_buf = page_alloc.alloc(u8, @as(usize, w) * @as(usize, h) * 4) catch return false;
    feed.ffmpeg_read_offset = 0;
    feed.backend = .ffmpeg;
    feed.status = .ready;

    log.info(.render, "FFmpeg capture started ({d}x{d})", .{ w, h });
    return true;
}

/// Read available data from FFmpeg stdout pipe. Non-blocking.
/// When a full frame (w*h*4 bytes) is accumulated, marks dirty.
fn updateFFmpeg(feed: *Feed) void {
    const stdout_file = feed.ffmpeg_stdout orelse return;
    const buf = feed.pixel_buf orelse return;
    const frame_size = @as(usize, feed.width) * @as(usize, feed.height) * 4;
    if (frame_size == 0) return;

    // Read as much as available (non-blocking)
    const remaining = frame_size - feed.ffmpeg_read_offset;
    const dest = buf[feed.ffmpeg_read_offset..frame_size];

    const n = stdout_file.read(dest[0..remaining]) catch |err| {
        if (err == error.WouldBlock) return; // no data yet, try next frame
        feed.status = .@"error";
        return;
    };

    if (n == 0) {
        // pipe closed — ffmpeg died
        feed.status = .@"error";
        return;
    }

    feed.ffmpeg_read_offset += n;
    if (feed.ffmpeg_read_offset >= frame_size) {
        feed.ffmpeg_read_offset = 0;
        feed.dirty = true;
    }
}

// ════════════════════════════════════════════════════════════════════════
// Window capture via xdotool + XShm at root offset
// ════════════════════════════════════════════════════════════════════════

/// Run xdotool to find a window by title and get its geometry.
/// Returns (x, y, w, h) or null if not found.
fn findWindowGeometry(title: []const u8) ?struct { x: c_int, y: c_int, w: u32, h: u32 } {
    var script_buf: [512]u8 = undefined;
    const script = std.fmt.bufPrint(
        &script_buf,
        "WID=$(xdotool search --name \"{s}\" 2>/dev/null | head -1); if [ -n \"$WID\" ]; then eval $(xdotool getwindowgeometry --shell $WID 2>/dev/null); echo \"$X $Y $WIDTH $HEIGHT\"; fi",
        .{title},
    ) catch return null;

    const argv = [_][]const u8{ "bash", "-c", script };
    var child = std.process.Child.init(&argv, page_alloc);
    child.stdout_behavior = .Pipe;
    child.stderr_behavior = .Ignore;
    child.stdin_behavior = .Ignore;

    child.spawn() catch return null;

    var out_buf: [128]u8 = undefined;
    const stdout = child.stdout orelse {
        _ = child.wait() catch {};
        return null;
    };
    const n = stdout.read(&out_buf) catch 0;
    _ = child.wait() catch {};

    if (n == 0) return null;

    // Parse "X Y WIDTH HEIGHT\n"
    var iter = std.mem.splitScalar(u8, std.mem.trimRight(u8, out_buf[0..n], "\n"), ' ');
    const x_str = iter.next() orelse return null;
    const y_str = iter.next() orelse return null;
    const w_str = iter.next() orelse return null;
    const h_str = iter.next() orelse return null;

    const wx = std.fmt.parseInt(c_int, x_str, 10) catch return null;
    const wy = std.fmt.parseInt(c_int, y_str, 10) catch return null;
    const ww = std.fmt.parseInt(u32, w_str, 10) catch return null;
    const wh = std.fmt.parseInt(u32, h_str, 10) catch return null;

    if (ww == 0 or wh == 0) return null;
    return .{ .x = wx, .y = wy, .w = ww, .h = wh };
}

// ════════════════════════════════════════════════════════════════════════
// Virtual display management (Xvfb / Xephyr)
// ════════════════════════════════════════════════════════════════════════

fn findFreeDisplay() ?u32 {
    var i: u32 = 10;
    while (i < 100) : (i += 1) {
        var lock_buf: [32]u8 = undefined;
        const lock_path = std.fmt.bufPrint(&lock_buf, "/tmp/.X{d}-lock", .{i}) catch continue;
        // Try to stat the lock file — if it doesn't exist, the display is free
        const stat = std.fs.cwd().statFile(lock_path) catch {
            return i; // file doesn't exist = display free
        };
        _ = stat;
    }
    return null;
}

fn spawnXvfb(display_num: u32, w: u32, h: u32) ?std.process.Child {
    var disp_buf: [8]u8 = undefined;
    const disp_str = std.fmt.bufPrint(&disp_buf, ":{d}", .{display_num}) catch return null;

    var screen_buf: [32]u8 = undefined;
    const screen_str = std.fmt.bufPrint(&screen_buf, "{d}x{d}x24", .{ w, h }) catch return null;

    const argv = [_][]const u8{ "Xvfb", disp_str, "-screen", "0", screen_str };
    var child = std.process.Child.init(&argv, page_alloc);
    child.stdout_behavior = .Ignore;
    child.stderr_behavior = .Ignore;
    child.stdin_behavior = .Ignore;

    child.spawn() catch return null;
    return child;
}

fn startVirtualDisplay(feed: *Feed, w: u32, h: u32, command: ?[]const u8) bool {
    if (!initXShm()) return false;

    const display_num = findFreeDisplay() orelse {
        log.info(.render, "no free X display number", .{});
        return false;
    };

    var child = spawnXvfb(display_num, w, h) orelse {
        log.info(.render, "Xvfb spawn failed", .{});
        return false;
    };
    _ = &child;

    feed.x_server_child = child;
    feed.display_num = display_num;
    feed.app_command = command;
    feed.width = w;
    feed.height = h;
    feed.pixel_buf = page_alloc.alloc(u8, @as(usize, w) * @as(usize, h) * 4) catch return false;
    feed.backend = .display_xshm;
    feed.status = .starting;
    feed.startup_wait = 60; // wait ~1s at 60fps for Xvfb to start
    feed.interactive = true;

    log.info(.render, "Virtual display :{d} ({d}x{d}) starting", .{ display_num, w, h });
    return true;
}

/// Called during update() to finish virtual display initialization after Xvfb has started.
fn finalizeVirtualDisplay(feed: *Feed) void {
    if (feed.startup_wait > 0) {
        feed.startup_wait -= 1;
        return;
    }

    const display_num = feed.display_num orelse return;

    // Open dedicated X connection to virtual display
    const dpy = openDisplayConnection(display_num) orelse {
        // Xvfb may need more time
        feed.startup_wait = 30;
        return;
    };

    if (xext.XShmQueryExtension(dpy) == 0) {
        _ = x11.XCloseDisplay(dpy);
        feed.status = .@"error";
        log.info(.render, "XShm not available on :{d}", .{display_num});
        return;
    }

    feed.display_dpy = dpy;
    const scr = x11.XDefaultScreen(dpy);
    feed.display_root = x11.XDefaultRootWindow(dpy);

    // Create XShm capture for the virtual display
    const visual = x11.XDefaultVisual(dpy, scr) orelse {
        feed.status = .@"error";
        return;
    };
    const depth: c_uint = @intCast(x11.XDefaultDepth(dpy, scr));

    feed.xshm_info = .{ .shmseg = 0, .shmid = -1, .shmaddr = null, .read_only = 0 };
    const ximage = xext.XShmCreateImage(dpy, visual, depth, ZPixmap, null, &feed.xshm_info, @intCast(feed.width), @intCast(feed.height)) orelse {
        feed.status = .@"error";
        return;
    };

    const shmsize: usize = @intCast(@as(c_uint, @intCast(ximage.bytes_per_line)) * @as(c_uint, @intCast(ximage.height)));
    feed.xshm_info.shmid = shmget(IPC_PRIVATE, shmsize, IPC_CREAT | 0o666);
    if (feed.xshm_info.shmid < 0) {
        _ = x11.XFree(@ptrCast(ximage));
        feed.status = .@"error";
        return;
    }
    const shm_ptr = shmat(feed.xshm_info.shmid, null, 0) orelse {
        _ = shmctl(feed.xshm_info.shmid, IPC_RMID, null);
        _ = x11.XFree(@ptrCast(ximage));
        feed.status = .@"error";
        return;
    };
    feed.xshm_info.shmaddr = @ptrCast(@alignCast(shm_ptr));
    ximage.data = @ptrCast(@alignCast(shm_ptr));
    feed.xshm_info.read_only = 0;

    _ = xext.XShmAttach(dpy, &feed.xshm_info);
    _ = shmctl(feed.xshm_info.shmid, IPC_RMID, null);

    feed.xshm_image = ximage;
    feed.status = .ready;
    log.info(.render, "Virtual display :{d} ready ({d}x{d})", .{ display_num, feed.width, feed.height });

    // Launch the app command into the virtual display.
    // After launching, maximize the window so it fills the display (matching Lua AppEmbed).
    // The Lua version relies on apps specifying their own geometry (e.g. kitty -o initial_window_width=W),
    // but as a fallback we find and resize the first window to fill the display.
    if (feed.app_command) |cmd| {
        std.debug.print("[rsurface] Launching app into :{d}: {s}\n", .{ display_num, cmd });

        // Launch: DISPLAY=:N <command> & sleep 0.5; DISPLAY=:N xdotool search --onlyvisible --name "" windowsize W H windowmove 0 0
        // This launches the app, waits for it to create a window, then resizes it to fill.
        var launch_buf: [2048]u8 = undefined;
        const launch_cmd = std.fmt.bufPrint(&launch_buf, "DISPLAY=:{d} {s} & sleep 0.8; DISPLAY=:{d} xdotool search --onlyvisible --name '' windowsize --usehints {d} {d} windowmove 0 0 2>/dev/null", .{ display_num, cmd, display_num, feed.width, feed.height }) catch return;

        const launch_argv = [_][]const u8{ "bash", "-c", launch_cmd };
        var app = std.process.Child.init(&launch_argv, page_alloc);
        app.stdout_behavior = .Ignore;
        app.stderr_behavior = .Ignore;
        app.stdin_behavior = .Ignore;

        app.spawn() catch |err| {
            std.debug.print("[rsurface] App spawn failed: {}\n", .{err});
            return;
        };
        feed.app_child = app;
        std.debug.print("[rsurface] App launched into :{d} ({d}x{d})\n", .{ display_num, feed.width, feed.height });
    }
}

// ════════════════════════════════════════════════════════════════════════
// VNC RFB client (for VM capture and direct VNC)
// ════════════════════════════════════════════════════════════════════════

fn u16be(val: u16) [2]u8 {
    return .{ @intCast(val >> 8), @intCast(val & 0xFF) };
}

fn u32be(val: u32) [4]u8 {
    return .{
        @intCast((val >> 24) & 0xFF),
        @intCast((val >> 16) & 0xFF),
        @intCast((val >> 8) & 0xFF),
        @intCast(val & 0xFF),
    };
}

fn readU16be(buf: []const u8) u16 {
    if (buf.len < 2) return 0;
    return (@as(u16, buf[0]) << 8) | @as(u16, buf[1]);
}

fn readU32be(buf: []const u8) u32 {
    if (buf.len < 4) return 0;
    return (@as(u32, buf[0]) << 24) | (@as(u32, buf[1]) << 16) | (@as(u32, buf[2]) << 8) | @as(u32, buf[3]);
}

/// Non-blocking read from VNC socket. Returns bytes read or 0.
fn vncRead(sock: posix.socket_t, buf: []u8) usize {
    const n = posix.read(sock, buf) catch |err| {
        if (err != error.WouldBlock) {
            std.debug.print("[rsurface:vnc] read error: {s}\n", .{@errorName(err)});
        }
        return 0;
    };
    return n;
}

/// Blocking-ish write to VNC socket.
fn vncWrite(sock: posix.socket_t, data: []const u8) bool {
    var sent: usize = 0;
    while (sent < data.len) {
        const n = posix.write(sock, data[sent..]) catch return false;
        if (n == 0) return false;
        sent += n;
    }
    return true;
}

fn connectVnc(host_str: []const u8, port: u16) ?posix.socket_t {
    const addr = std.net.Address.parseIp4(host_str, port) catch return null;

    const sock = posix.socket(posix.AF.INET, posix.SOCK.STREAM, 0) catch return null;
    errdefer posix.close(sock);

    posix.connect(sock, &addr.any, addr.getOsSockLen()) catch {
        posix.close(sock);
        return null;
    };

    setNonBlocking(sock);
    return sock;
}

/// Drive the VNC handshake state machine. Called each frame.
fn updateVnc(feed: *Feed) void {
    const sock = feed.vnc_socket orelse {
        std.debug.print("[rsurface:vnc] updateVnc: no socket!\n", .{});
        return;
    };

    switch (feed.vnc_state) {
        .not_connected, .failed => return,

        .wait_version => {
            // Read 12-byte RFB version string
            var ver_buf: [12]u8 = undefined;
            const n = vncRead(sock, &ver_buf);
            if (n < 12) {
                if (n > 0) std.debug.print("[rsurface:vnc] wait_version: got {d}/12 bytes\n", .{n});
                return;
            }

            std.debug.print("[rsurface:vnc] got server version, sending ours\n", .{});
            _ = vncWrite(sock, "RFB 003.008\n");
            feed.vnc_state = .wait_security_types;
        },

        .wait_security_types => {
            // Read security type count (1 byte) + types
            var sec_buf: [64]u8 = undefined;
            const n = vncRead(sock, &sec_buf);
            if (n == 0) return;

            const num_types = sec_buf[0];
            if (num_types == 0) {
                feed.vnc_state = .failed;
                feed.status = .@"error";
                return;
            }
            if (n < 1 + @as(usize, num_types)) return; // wait for full type list

            // Select SecurityType 1 (None) — QEMU localhost uses no auth
            _ = vncWrite(sock, &[_]u8{1});
            feed.vnc_state = .wait_security_result;
        },

        .wait_security_result => {
            // 4 bytes: 0 = OK
            var res_buf: [4]u8 = undefined;
            const n = vncRead(sock, &res_buf);
            if (n < 4) return;

            if (readU32be(&res_buf) != 0) {
                feed.vnc_state = .failed;
                feed.status = .@"error";
                return;
            }

            // ClientInit: shared = true
            _ = vncWrite(sock, &[_]u8{1});
            feed.vnc_state = .wait_server_init;
        },

        .wait_server_init => {
            // ServerInit: width(2) + height(2) + pixelFormat(16) + nameLen(4) = 24 bytes min
            var init_buf: [256]u8 = undefined;
            const n = vncRead(sock, &init_buf);
            if (n < 24) return;

            feed.vnc_fb_width = readU16be(init_buf[0..2]);
            feed.vnc_fb_height = readU16be(init_buf[2..4]);

            const name_len = readU32be(init_buf[20..24]);
            // Consume name bytes (may already be in buffer, or skip)
            _ = name_len;

            // SetPixelFormat: 32bpp RGBA little-endian
            const pixel_fmt = [20]u8{
                0, 0, 0, 0, // type=0, padding x3
                32, // bits-per-pixel
                24, // depth
                0, // big-endian = false
                1, // true-colour = true
                0, 255, // red-max = 255
                0, 255, // green-max = 255
                0, 255, // blue-max = 255
                0, // red-shift = 0
                8, // green-shift = 8
                16, // blue-shift = 16
                0, 0, 0, // padding
            };
            _ = vncWrite(sock, &pixel_fmt);

            // SetEncodings: RAW(0)
            const encodings = [_]u8{ 2, 0 } ++ u16be(1) ++ u32be(0);
            _ = vncWrite(sock, &encodings);

            // Resize feed to match VNC framebuffer
            const vw: u32 = @intCast(feed.vnc_fb_width);
            const vh: u32 = @intCast(feed.vnc_fb_height);
            if (vw > 0 and vh > 0 and (vw != feed.width or vh != feed.height)) {
                // Reallocate pixel buffer
                if (feed.pixel_buf) |old| page_alloc.free(old);
                feed.pixel_buf = page_alloc.alloc(u8, @as(usize, vw) * @as(usize, vh) * 4) catch {
                    feed.status = .@"error";
                    return;
                };
                feed.width = vw;
                feed.height = vh;
                // Invalidate wgpu texture (will be recreated)
                if (feed.bind_group) |bg| bg.release();
                if (feed.sampler) |s| s.release();
                if (feed.texture_view) |tv| tv.release();
                if (feed.texture) |t| t.destroy();
                feed.bind_group = null;
                feed.sampler = null;
                feed.texture_view = null;
                feed.texture = null;
            }

            feed.vnc_state = .ready;
            feed.status = .ready;
            log.info(.render, "VNC connected: {d}x{d}", .{ vw, vh });
        },

        .ready => {
            // Request full framebuffer update (non-incremental)
            const req = [_]u8{3, 0} ++ u16be(0) ++ u16be(0) ++ u16be(feed.vnc_fb_width) ++ u16be(feed.vnc_fb_height);
            _ = vncWrite(sock, &req);

            // Read FramebufferUpdate response
            var msg_buf: [4]u8 = undefined;
            const n = vncRead(sock, &msg_buf);
            if (n == 0) return;

            if (msg_buf[0] == 0) {
                // FramebufferUpdate: padding(1) + numRects(2) — we already read msg_buf[0]
                if (n < 4) return; // need at least type + padding + numRects
                const num_rects = readU16be(msg_buf[2..4]);

                var rect_i: u16 = 0;
                while (rect_i < num_rects) : (rect_i += 1) {
                    // Rectangle header: x(2)+y(2)+w(2)+h(2)+encoding(4) = 12 bytes
                    var rect_hdr: [12]u8 = undefined;
                    const rn = vncRead(sock, &rect_hdr);
                    if (rn < 12) break;

                    const rw = readU16be(rect_hdr[4..6]);
                    const rh = readU16be(rect_hdr[6..8]);
                    const encoding = readU32be(rect_hdr[8..12]);

                    if (encoding == 0) {
                        // RAW encoding — read pixel data directly into feed buffer
                        const pix_size: usize = @as(usize, rw) * @as(usize, rh) * 4;
                        const rx: usize = @intCast(readU16be(rect_hdr[0..2]));
                        const ry: usize = @intCast(readU16be(rect_hdr[2..4]));

                        const buf = feed.pixel_buf orelse break;
                        const fb_w: usize = @intCast(feed.width);

                        // If full-screen rect, read directly into pixel_buf
                        if (rx == 0 and ry == 0 and rw == feed.vnc_fb_width and rh == feed.vnc_fb_height) {
                            var read_total: usize = 0;
                            while (read_total < pix_size) {
                                const chunk = vncRead(sock, buf[read_total..pix_size]);
                                if (chunk == 0) break;
                                read_total += chunk;
                            }
                            if (read_total >= pix_size) feed.dirty = true;
                        } else {
                            // Partial rect — read row by row into correct position
                            const rect_w: usize = @intCast(rw);
                            const rect_h: usize = @intCast(rh);
                            var row_buf: [8192]u8 = undefined; // max ~2048px wide
                            const row_bytes = rect_w * 4;

                            var row: usize = 0;
                            while (row < rect_h) : (row += 1) {
                                if (row_bytes > row_buf.len) break;
                                var row_read: usize = 0;
                                while (row_read < row_bytes) {
                                    const chunk = vncRead(sock, row_buf[row_read..row_bytes]);
                                    if (chunk == 0) break;
                                    row_read += chunk;
                                }
                                if (row_read < row_bytes) break;
                                // Copy into framebuffer at (rx, ry+row)
                                const dst_off = ((ry + row) * fb_w + rx) * 4;
                                if (dst_off + row_bytes <= buf.len) {
                                    @memcpy(buf[dst_off .. dst_off + row_bytes], row_buf[0..row_bytes]);
                                }
                            }
                            feed.dirty = true;
                        }
                    } else {
                        // Unknown encoding — try to skip pixel data
                        const skip_size: usize = @as(usize, rw) * @as(usize, rh) * 4;
                        var skipped: usize = 0;
                        var skip_buf: [4096]u8 = undefined;
                        while (skipped < skip_size) {
                            const remain = @min(skip_buf.len, skip_size - skipped);
                            const chunk = vncRead(sock, skip_buf[0..remain]);
                            if (chunk == 0) break;
                            skipped += chunk;
                        }
                    }
                }
            }
        },
    }
}

// ════════════════════════════════════════════════════════════════════════
// QEMU VM management
// ════════════════════════════════════════════════════════════════════════

fn findFreeVncPort() ?u16 {
    var port: u16 = 5910;
    while (port < 5999) : (port += 1) {
        // Try to bind — if it works, port is free
        const sock = posix.socket(posix.AF.INET, posix.SOCK.STREAM, 0) catch continue;
        defer posix.close(sock);
        const addr = std.net.Address.parseIp4("127.0.0.1", port) catch continue;
        posix.connect(sock, &addr.any, addr.getOsSockLen()) catch {
            return port; // connect failed = port is free
        };
    }
    return null;
}

fn startVM(feed: *Feed, disk_path: []const u8, memory: u32, cpus: u32) bool {
    const vnc_port = findFreeVncPort() orelse {
        log.info(.render, "no free VNC port", .{});
        return false;
    };
    const vnc_display = vnc_port - 5900;

    var mem_buf: [16]u8 = undefined;
    const mem_str = std.fmt.bufPrint(&mem_buf, "{d}", .{memory}) catch return false;

    var cpu_buf: [8]u8 = undefined;
    const cpu_str = std.fmt.bufPrint(&cpu_buf, "{d}", .{cpus}) catch return false;

    var vnc_buf: [8]u8 = undefined;
    const vnc_str = std.fmt.bufPrint(&vnc_buf, ":{d}", .{vnc_display}) catch return false;

    const ext = if (std.mem.lastIndexOfScalar(u8, disk_path, '.')) |dot| disk_path[dot + 1 ..] else "";
    const is_iso = std.ascii.eqlIgnoreCase(ext, "iso");

    const has_kvm = blk: {
        _ = std.fs.cwd().statFile("/dev/kvm") catch break :blk false;
        break :blk true;
    };

    var drive_buf: [600]u8 = undefined;

    // Build argv as []const u8 slices
    var argv: [24][]const u8 = undefined;
    var argc: usize = 0;

    argv[argc] = "qemu-system-x86_64";
    argc += 1;
    if (has_kvm) {
        argv[argc] = "-enable-kvm";
        argc += 1;
    }
    argv[argc] = "-m";
    argc += 1;
    argv[argc] = mem_str;
    argc += 1;
    argv[argc] = "-smp";
    argc += 1;
    argv[argc] = cpu_str;
    argc += 1;

    if (is_iso) {
        argv[argc] = "-cdrom";
        argc += 1;
        argv[argc] = disk_path;
        argc += 1;
        argv[argc] = "-boot";
        argc += 1;
        argv[argc] = "d";
        argc += 1;
    } else {
        argv[argc] = "-drive";
        argc += 1;
        const drive_str = std.fmt.bufPrint(&drive_buf, "file={s},format=raw", .{disk_path}) catch return false;
        argv[argc] = drive_str;
        argc += 1;
    }

    argv[argc] = "-vnc";
    argc += 1;
    argv[argc] = vnc_str;
    argc += 1;
    argv[argc] = "-usb";
    argc += 1;
    argv[argc] = "-device";
    argc += 1;
    argv[argc] = "usb-tablet";
    argc += 1;
    argv[argc] = "-display";
    argc += 1;
    argv[argc] = "none";
    argc += 1;

    var child = std.process.Child.init(argv[0..argc], page_alloc);
    child.stdout_behavior = .Ignore;
    child.stderr_behavior = .Ignore;
    child.stdin_behavior = .Ignore;

    std.debug.print("[rsurface] QEMU spawning: argc={d} kvm={} iso={}\n", .{ argc, has_kvm, is_iso });

    child.spawn() catch |err| {
        std.debug.print("[rsurface] QEMU spawn FAILED: {}\n", .{err});
        log.info(.render, "QEMU spawn failed: {}", .{err});
        return false;
    };

    feed.qemu_child = child;
    feed.vnc_port = vnc_port;
    feed.width = 1024;
    feed.height = 768;
    feed.pixel_buf = page_alloc.alloc(u8, @as(usize, 1024) * @as(usize, 768) * 4) catch return false;
    feed.backend = .vnc;
    feed.status = .starting;
    feed.interactive = true;
    feed.startup_wait = 120; // ~2s for QEMU to start

    std.debug.print("[rsurface] QEMU started OK, VNC port={d} display=:{d}\n", .{ vnc_port, vnc_display });
    log.info(.render, "QEMU started (VNC :{d}, {d}MB, {d} CPUs)", .{ vnc_display, memory, cpus });
    return true;
}

/// Called during update() to connect VNC after QEMU has started.
fn finalizeVM(feed: *Feed) void {
    if (feed.startup_wait > 0) {
        if (feed.startup_wait % 30 == 0) std.debug.print("[rsurface] finalizeVM: waiting {d} frames for QEMU\n", .{feed.startup_wait});
        feed.startup_wait -= 1;
        return;
    }

    std.debug.print("[rsurface] finalizeVM: attempting VNC connect to 127.0.0.1:{d}\n", .{feed.vnc_port});

    // Try to connect to VNC
    const sock = connectVnc("127.0.0.1", feed.vnc_port) orelse {
        std.debug.print("[rsurface] finalizeVM: VNC connect failed, retrying in 30 frames\n", .{});
        feed.startup_wait = 30;
        return;
    };

    std.debug.print("[rsurface] finalizeVM: VNC connected! sock={d}\n", .{sock});
    feed.vnc_socket = sock;
    feed.vnc_state = .wait_version;
    feed.status = .connecting;
    log.info(.render, "VNC connecting to port {d}", .{feed.vnc_port});
}

// ════════════════════════════════════════════════════════════════════════
// Feed creation by source type
// ════════════════════════════════════════════════════════════════════════

fn findFeed(src: []const u8) ?*Feed {
    for (feeds[0..feed_count]) |*f| {
        if (std.mem.eql(u8, f.source, src)) return f;
    }
    return null;
}

fn allocBuf(w: u32, h: u32) ?[]u8 {
    return page_alloc.alloc(u8, @as(usize, w) * @as(usize, h) * 4) catch return null;
}

fn setError(feed: *Feed) void {
    feed.status = .@"error";
}

fn createFeed(src: []const u8, node_w: f32, node_h: f32) ?*Feed {
    if (feed_count >= MAX_FEEDS) return null;

    const parsed = parseSource(src);
    var feed = &feeds[feed_count];
    feed.* = .{ .source = src, .parsed = parsed, .active = true };

    switch (parsed.source_type) {
        .screen => {
            // XShm screen capture (fast path). Falls back to FFmpeg if XShm unavailable.
            if (initXShm()) {
                const dpy = x_display orelse {
                    setError(feed);
                    feed_count += 1;
                    return feed;
                };
                const sw: u32 = @intCast(x11.XDisplayWidth(dpy, x_screen));
                const sh: u32 = @intCast(x11.XDisplayHeight(dpy, x_screen));

                if (createXShmCapture(feed, dpy, sw, sh)) {
                    feed.pixel_buf = allocBuf(sw, sh) orelse {
                        setError(feed);
                        feed_count += 1;
                        return feed;
                    };
                    feed.backend = .xshm;
                    feed.status = .ready;
                    log.info(.render, "XShm screen capture: {d}x{d}", .{ sw, sh });
                    feed_count += 1;
                    return feed;
                }
            }
            // Fallback: FFmpeg x11grab
            if (!startFFmpeg(feed, parsed, 30, 1920, 1080)) setError(feed);
        },

        .window => {
            // Window capture via XShm at root window offset
            if (!initXShm()) {
                setError(feed);
                feed_count += 1;
                return feed;
            }
            const title = parsed.title orelse {
                setError(feed);
                feed_count += 1;
                return feed;
            };

            const geom = findWindowGeometry(title) orelse {
                log.info(.render, "window not found: {s}", .{title});
                setError(feed);
                feed_count += 1;
                return feed;
            };

            // Clamp to screen bounds
            const dpy = x_display orelse {
                setError(feed);
                feed_count += 1;
                return feed;
            };
            const scr_w = x11.XDisplayWidth(dpy, x_screen);
            const scr_h = x11.XDisplayHeight(dpy, x_screen);
            var ww = geom.w;
            var wh = geom.h;
            var wx = geom.x;
            var wy = geom.y;
            if (wx + @as(c_int, @intCast(ww)) > scr_w) ww = @intCast(scr_w - wx);
            if (wy + @as(c_int, @intCast(wh)) > scr_h) wh = @intCast(scr_h - wy);
            if (wx < 0) {
                ww = @intCast(@as(c_int, @intCast(ww)) + wx);
                wx = 0;
            }
            if (wy < 0) {
                wh = @intCast(@as(c_int, @intCast(wh)) + wy);
                wy = 0;
            }

            if (ww == 0 or wh == 0) {
                setError(feed);
                feed_count += 1;
                return feed;
            }

            if (!createXShmCapture(feed, dpy, ww, wh)) {
                setError(feed);
                feed_count += 1;
                return feed;
            }
            feed.capture_ox = wx;
            feed.capture_oy = wy;
            feed.pixel_buf = allocBuf(ww, wh) orelse {
                setError(feed);
                feed_count += 1;
                return feed;
            };
            feed.backend = .xshm;
            feed.status = .ready;
            log.info(.render, "XShm window capture: {s} ({d}x{d}+{d}+{d})", .{ title, ww, wh, wx, wy });
        },

        .cam, .hdmi, .v4l2 => {
            // FFmpeg v4l2 capture
            if (!startFFmpeg(feed, parsed, 30, 1280, 720)) setError(feed);
        },

        .display => {
            // Virtual display (Xvfb) + XShm capture
            // Use node rect dimensions so the display matches the container exactly (no dead space).
            // If an explicit resolution was given, use that instead.
            var rw: u32 = @max(320, @as(u32, @intFromFloat(node_w)));
            var rh: u32 = @max(240, @as(u32, @intFromFloat(node_h)));
            if (parsed.resolution) |res| {
                if (std.mem.indexOfScalar(u8, res, 'x')) |xi| {
                    rw = std.fmt.parseInt(u32, res[0..xi], 10) catch rw;
                    rh = std.fmt.parseInt(u32, res[xi + 1 ..], 10) catch rh;
                }
            }
            std.debug.print("[rsurface] display: creating {d}x{d} virtual display (node={d:.0}x{d:.0})\n", .{ rw, rh, node_w, node_h });
            if (!startVirtualDisplay(feed, rw, rh, parsed.command)) setError(feed);
        },

        .vm => {
            // QEMU + VNC capture
            const disk = parsed.path orelse {
                std.debug.print("[rsurface] VM: no disk path in source\n", .{});
                setError(feed);
                feed_count += 1;
                return feed;
            };
            std.debug.print("[rsurface] VM: creating feed for disk={s}\n", .{disk});
            if (!startVM(feed, disk, 2048, 2)) {
                std.debug.print("[rsurface] VM: startVM FAILED\n", .{});
                setError(feed);
            }
        },

        .vnc_direct => {
            // Direct VNC connection (no QEMU)
            const host = parsed.host orelse "127.0.0.1";
            const port = parsed.port;
            if (port == 0) {
                setError(feed);
                feed_count += 1;
                return feed;
            }

            const sock = connectVnc(host, port) orelse {
                log.info(.render, "VNC connect failed: {s}:{d}", .{ host, port });
                setError(feed);
                feed_count += 1;
                return feed;
            };

            feed.vnc_socket = sock;
            feed.vnc_state = .wait_version;
            feed.width = 1280;
            feed.height = 720;
            feed.pixel_buf = allocBuf(1280, 720) orelse {
                posix.close(sock);
                setError(feed);
                feed_count += 1;
                return feed;
            };
            feed.backend = .vnc;
            feed.status = .connecting;
            feed.interactive = true;
            log.info(.render, "VNC direct: {s}:{d}", .{ host, port });
        },

        .monitor => {
            // Virtual monitor via xrandr + XShm
            // Same as screen capture but at an xrandr-defined offset
            if (!initXShm()) {
                setError(feed);
                feed_count += 1;
                return feed;
            }
            // Use same dimensions as screen for now — xrandr integration
            // would need subprocess calls to set up the virtual monitor region
            const dpy = x_display orelse {
                setError(feed);
                feed_count += 1;
                return feed;
            };
            const sw: u32 = @intCast(x11.XDisplayWidth(dpy, x_screen));
            const sh: u32 = @intCast(x11.XDisplayHeight(dpy, x_screen));

            if (!createXShmCapture(feed, dpy, sw, sh)) {
                setError(feed);
                feed_count += 1;
                return feed;
            }
            feed.pixel_buf = allocBuf(sw, sh) orelse {
                setError(feed);
                feed_count += 1;
                return feed;
            };
            feed.backend = .xshm;
            feed.status = .ready;
            log.info(.render, "Monitor capture: {s} ({d}x{d})", .{ parsed.name orelse "?", sw, sh });
        },

        .unknown => setError(feed),
    }

    feed_count += 1;
    return feed;
}

// ════════════════════════════════════════════════════════════════════════
// Public API (called from engine.zig)
// ════════════════════════════════════════════════════════════════════════

pub fn init() void {
    // Backends init lazily on first createFeed().
}

pub fn deinit() void {
    for (feeds[0..feed_count]) |*f| f.deinit();
    feed_count = 0;

    if (x_display) |dpy| {
        _ = x11.XCloseDisplay(dpy);
        x_display = null;
    }
    if (xext_lib) |lib| _ = dlclose(lib);
    if (x11_lib) |lib| _ = dlclose(lib);
    xext_lib = null;
    x11_lib = null;
    xshm_available = false;
    x11_load_attempted = false;
}

/// Called every frame: poll backends for new frames.
var _upd_dbg: u32 = 0;

pub fn update() void {
    _upd_dbg +%= 1;
    if (_upd_dbg % 120 == 1 and feed_count > 0) std.debug.print("[rsurface] update: {d} feeds\n", .{feed_count});

    for (feeds[0..feed_count]) |*feed| {
        switch (feed.status) {
            .ready => {
                switch (feed.backend) {
                    .xshm, .display_xshm => _ = captureXShm(feed),
                    .ffmpeg => updateFFmpeg(feed),
                    .vnc => updateVnc(feed),
                }

                if (feed.dirty) {
                    if (_upd_dbg % 60 == 1) std.debug.print("[rsurface] frame dirty, uploading {d}x{d}\n", .{ feed.width, feed.height });
                    if (!ensureTexture(feed)) {
                        std.debug.print("[rsurface] ensureTexture FAILED\n", .{});
                        continue;
                    }
                    uploadPixels(feed);
                }

                if (!feed.active) {
                    feed.inactive_frames += 1;
                    if (feed.inactive_frames > UNLOAD_DEBOUNCE_FRAMES) {
                        feed.deinit();
                    }
                }
                feed.active = false;
            },

            .starting => {
                if (_upd_dbg % 60 == 1) std.debug.print("[rsurface] feed starting, backend={s} wait={d}\n", .{ @tagName(feed.backend), feed.startup_wait });
                switch (feed.backend) {
                    .display_xshm => finalizeVirtualDisplay(feed),
                    .vnc => finalizeVM(feed),
                    else => {},
                }
            },

            .connecting => {
                if (_upd_dbg % 60 == 1) std.debug.print("[rsurface] VNC connecting, state={s}\n", .{@tagName(feed.vnc_state)});
                updateVnc(feed);
            },

            else => {},
        }
    }
}

/// Called during paint when a node with render_src is encountered.
/// Returns true if a surface quad was queued.
var _dbg_frame: u32 = 0;

pub fn paintSurface(src: []const u8, x: f32, y: f32, w: f32, h: f32, opacity: f32) bool {
    _dbg_frame +%= 1;
    if (_dbg_frame % 60 == 1) std.debug.print("[rsurface] paintSurface called src_len={d} rect=({d:.0},{d:.0},{d:.0},{d:.0})\n", .{ src.len, x, y, w, h });

    var feed = findFeed(src);
    if (feed == null) {
        std.debug.print("[rsurface] no feed found, creating for src_len={d}\n", .{src.len});
        feed = createFeed(src, w, h);
    }
    const f = feed orelse {
        std.debug.print("[rsurface] createFeed returned null\n", .{});
        return false;
    };
    f.active = true;

    if (f.status != .ready) {
        if (_dbg_frame % 60 == 1) std.debug.print("[rsurface] feed not ready, status={s}\n", .{@tagName(f.status)});
        return false;
    }
    const bg = f.bind_group orelse {
        if (_dbg_frame % 60 == 1) std.debug.print("[rsurface] no bind_group\n", .{});
        return false;
    };
    if (f.width == 0 or f.height == 0) {
        std.debug.print("[rsurface] zero dimensions {d}x{d}\n", .{ f.width, f.height });
        return false;
    }

    // display_xshm: stretch-fill (app IS the display, fill the node rect)
    // VNC/other: aspect-ratio "contain" fit (preserve source aspect ratio)
    var draw_w: f32 = undefined;
    var draw_h: f32 = undefined;
    var draw_x: f32 = undefined;
    var draw_y: f32 = undefined;

    if (f.backend == .display_xshm) {
        // Stretch-fill: app fills the entire node rect (matches Lua behavior)
        draw_w = w;
        draw_h = h;
        draw_x = x;
        draw_y = y;
    } else {
        // Contain-fit for VM/VNC/screen capture
        const vid_w: f32 = @floatFromInt(f.width);
        const vid_h: f32 = @floatFromInt(f.height);
        const vid_aspect = vid_w / vid_h;
        const box_aspect = w / h;
        if (vid_aspect > box_aspect) {
            draw_w = w;
            draw_h = w / vid_aspect;
        } else {
            draw_h = h;
            draw_w = h * vid_aspect;
        }
        draw_x = x + (w - draw_w) / 2;
        draw_y = y + (h - draw_h) / 2;
    }

    // Store node rect (for hit testing) and draw rect (for coordinate mapping)
    for (0..feed_count) |i| {
        if (std.mem.eql(u8, feeds[i].source, f.source)) {
            feed_draw_rects[i] = .{
                .node = .{ .x = x, .y = y, .w = w, .h = h },
                .draw = .{ .x = draw_x, .y = draw_y, .w = draw_w, .h = draw_h },
                .fb_w = f.width,
                .fb_h = f.height,
            };
            break;
        }
    }

    images.queueQuad(draw_x, draw_y, draw_w, draw_h, opacity, bg);
    return true;
}

/// Get the status of a render surface.
pub fn getStatus(src: []const u8) ?FeedStatus {
    const f = findFeed(src) orelse return null;
    return f.status;
}

/// Check if a render source is interactive.
pub fn isInteractive(src: []const u8) bool {
    const f = findFeed(src) orelse return false;
    return f.interactive;
}

/// Get the dimensions of a render surface.
pub fn getDimensions(src: []const u8) ?struct { w: u32, h: u32 } {
    const f = findFeed(src) orelse return null;
    if (f.width > 0 and f.height > 0) return .{ .w = f.width, .h = f.height };
    return null;
}

// ════════════════════════════════════════════════════════════════════════
// Input forwarding — focus, keyboard, mouse
// ════════════════════════════════════════════════════════════════════════

// Focused feed index (null = no render surface focused)
var focused_feed: ?usize = null;
var vnc_button_mask: u8 = 0;

// Per-feed rects (set during paintSurface)
// node_rect = full node computed rect (for hit testing — click anywhere in the node)
// draw_rect = contain-fit quad (for coordinate mapping to VNC framebuffer)
const FeedRect = struct { x: f32, y: f32, w: f32, h: f32 };
const FeedRects = struct { node: FeedRect = .{ .x = 0, .y = 0, .w = 0, .h = 0 }, draw: FeedRect = .{ .x = 0, .y = 0, .w = 0, .h = 0 }, fb_w: u32 = 0, fb_h: u32 = 0 };
var feed_draw_rects: [MAX_FEEDS]FeedRects = [_]FeedRects{.{}} ** MAX_FEEDS;

/// Find which feed (if any) the screen point (mx, my) lands on.
/// Uses the full node rect (not the contain-fit draw rect) for hit testing.
fn hitTestFeeds(mx: f32, my: f32) ?usize {
    for (0..feed_count) |i| {
        const r = feed_draw_rects[i].node; // hit test against full node rect
        if (r.w > 0 and r.h > 0 and feeds[i].interactive and feeds[i].status == .ready) {
            if (mx >= r.x and mx <= r.x + r.w and my >= r.y and my <= r.y + r.h) {
                return i;
            }
        }
    }
    return null;
}

/// Map screen coordinates to VNC framebuffer coordinates.
/// Uses the contain-fit draw rect for coordinate mapping.
fn screenToFb(idx: usize, mx: f32, my: f32) struct { x: u16, y: u16 } {
    const rects = feed_draw_rects[idx];
    const r = rects.draw; // map within the drawn quad
    if (r.w <= 0 or r.h <= 0) return .{ .x = 0, .y = 0 };
    const nx = std.math.clamp((mx - r.x) / r.w, 0, 1);
    const ny = std.math.clamp((my - r.y) / r.h, 0, 1);
    const fx: u16 = @intFromFloat(@min(@as(f32, @floatFromInt(rects.fb_w)) - 1, nx * @as(f32, @floatFromInt(rects.fb_w))));
    const fy: u16 = @intFromFloat(@min(@as(f32, @floatFromInt(rects.fb_h)) - 1, ny * @as(f32, @floatFromInt(rects.fb_h))));
    return .{ .x = fx, .y = fy };
}

/// Send a key event to the feed (dispatches by backend).
fn sendKey(feed: *Feed, down: bool, keysym: u32) void {
    switch (feed.backend) {
        .vnc => {
            const sock = feed.vnc_socket orelse return;
            if (feed.vnc_state != .ready) return;
            const msg = [_]u8{ 4, if (down) 1 else 0, 0, 0 } ++ u32be(keysym);
            _ = vncWrite(sock, &msg);
        },
        .display_xshm => {
            // XTest: inject key event directly through the X connection — zero latency.
            // Falls back to xdotool subprocess if XTest is unavailable.
            const dpy = feed.display_dpy orelse return;
            if (xtest_available) {
                const keycode = x11.XKeysymToKeycode(dpy, @intCast(keysym));
                if (keycode != 0) {
                    _ = xtst.XTestFakeKeyEvent(dpy, @intCast(keycode), if (down) 1 else 0, 0);
                    _ = x11.XFlush(dpy);
                }
            } else {
                // Fallback: xdotool subprocess (slow but always works)
                const display_num = feed.display_num orelse return;
                const xkey = keysymToXdotoolName(keysym) orelse return;
                const action: []const u8 = if (down) "keydown" else "keyup";
                var cmd_buf: [128]u8 = undefined;
                const cmd = std.fmt.bufPrint(&cmd_buf, "DISPLAY=:{d} xdotool {s} {s}", .{ display_num, action, xkey }) catch return;
                const argv = [_][]const u8{ "bash", "-c", cmd };
                var child = std.process.Child.init(&argv, page_alloc);
                child.stdout_behavior = .Ignore;
                child.stderr_behavior = .Ignore;
                child.stdin_behavior = .Ignore;
                child.spawn() catch return;
            }
        },
        else => {},
    }
}

/// Send a pointer event to the feed (dispatches by backend).
fn sendPointer(feed: *Feed, x_pos: u16, y_pos: u16, button_mask: u8, event_type: enum { down, up, move }, button: u8) void {
    switch (feed.backend) {
        .vnc => {
            const sock = feed.vnc_socket orelse return;
            if (feed.vnc_state != .ready) return;
            const msg = [_]u8{ 5, button_mask } ++ u16be(x_pos) ++ u16be(y_pos);
            _ = vncWrite(sock, &msg);
        },
        .display_xshm => {
            // XTest: inject mouse events directly through X connection — zero latency.
            const dpy = feed.display_dpy orelse return;
            if (xtest_available) {
                // Move pointer
                _ = xtst.XTestFakeMotionEvent(dpy, -1, @intCast(x_pos), @intCast(y_pos), 0);
                // Button press/release
                switch (event_type) {
                    .down => _ = xtst.XTestFakeButtonEvent(dpy, @intCast(button), 1, 0),
                    .up => _ = xtst.XTestFakeButtonEvent(dpy, @intCast(button), 0, 0),
                    .move => {},
                }
                _ = x11.XFlush(dpy);
            } else {
                // Fallback: xdotool subprocess
                const display_num = feed.display_num orelse return;
                var cmd_buf: [128]u8 = undefined;
                const cmd = switch (event_type) {
                    .down => std.fmt.bufPrint(&cmd_buf, "DISPLAY=:{d} xdotool mousemove {d} {d} mousedown {d}", .{ display_num, x_pos, y_pos, button }) catch return,
                    .up => std.fmt.bufPrint(&cmd_buf, "DISPLAY=:{d} xdotool mousemove {d} {d} mouseup {d}", .{ display_num, x_pos, y_pos, button }) catch return,
                    .move => std.fmt.bufPrint(&cmd_buf, "DISPLAY=:{d} xdotool mousemove {d} {d}", .{ display_num, x_pos, y_pos }) catch return,
                };
                const argv = [_][]const u8{ "bash", "-c", cmd };
                var child = std.process.Child.init(&argv, page_alloc);
                child.stdout_behavior = .Ignore;
                child.stderr_behavior = .Ignore;
                child.stdin_behavior = .Ignore;
                child.spawn() catch return;
            }
        },
        else => {},
    }
}

/// Map X11 keysym to xdotool key name.
fn keysymToXdotoolName(keysym: u32) ?[]const u8 {
    return switch (keysym) {
        0xff0d => "Return",
        0xff1b => "Escape",
        0xff08 => "BackSpace",
        0xff09 => "Tab",
        0x0020 => "space",
        0xffff => "Delete",
        0xff52 => "Up",
        0xff54 => "Down",
        0xff51 => "Left",
        0xff53 => "Right",
        0xff50 => "Home",
        0xff57 => "End",
        0xff55 => "Prior",
        0xff56 => "Next",
        0xff63 => "Insert",
        0xffe1 => "Shift_L",
        0xffe2 => "Shift_R",
        0xffe3 => "Control_L",
        0xffe4 => "Control_R",
        0xffe9 => "Alt_L",
        0xffea => "Alt_R",
        0xffeb => "Super_L",
        0xffec => "Super_R",
        0xffe5 => "Caps_Lock",
        0xff7f => "Num_Lock",
        0xff14 => "Scroll_Lock",
        0xffbe => "F1",
        0xffbf => "F2",
        0xffc0 => "F3",
        0xffc1 => "F4",
        0xffc2 => "F5",
        0xffc3 => "F6",
        0xffc4 => "F7",
        0xffc5 => "F8",
        0xffc6 => "F9",
        0xffc7 => "F10",
        0xffc8 => "F11",
        0xffc9 => "F12",
        else => {
            // ASCII printable: xdotool accepts single chars
            if (keysym >= 0x20 and keysym <= 0x7e) {
                // Return a static string for common ASCII
                const ascii_table = "                                 !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
                const idx = keysym - 0x20;
                if (idx < ascii_table.len) return ascii_table[idx .. idx + 1];
            }
            return null;
        },
    };
}

// SDL scancode → X11 keysym mapping (matches love2d/lua/render_source.lua KEYSYM table)
fn sdlKeyToKeysym(sym: c_int) ?u32 {
    return switch (sym) {
        c.SDLK_RETURN => 0xff0d,
        c.SDLK_ESCAPE => 0xff1b,
        c.SDLK_BACKSPACE => 0xff08,
        c.SDLK_TAB => 0xff09,
        c.SDLK_SPACE => 0x0020,
        c.SDLK_DELETE => 0xffff,
        c.SDLK_UP => 0xff52,
        c.SDLK_DOWN => 0xff54,
        c.SDLK_LEFT => 0xff51,
        c.SDLK_RIGHT => 0xff53,
        c.SDLK_HOME => 0xff50,
        c.SDLK_END => 0xff57,
        c.SDLK_PAGEUP => 0xff55,
        c.SDLK_PAGEDOWN => 0xff56,
        c.SDLK_INSERT => 0xff63,
        c.SDLK_LSHIFT => 0xffe1,
        c.SDLK_RSHIFT => 0xffe2,
        c.SDLK_LCTRL => 0xffe3,
        c.SDLK_RCTRL => 0xffe4,
        c.SDLK_LALT => 0xffe9,
        c.SDLK_RALT => 0xffea,
        c.SDLK_LGUI => 0xffeb,
        c.SDLK_RGUI => 0xffec,
        c.SDLK_CAPSLOCK => 0xffe5,
        c.SDLK_NUMLOCKCLEAR => 0xff7f,
        c.SDLK_SCROLLLOCK => 0xff14,
        c.SDLK_F1 => 0xffbe,
        c.SDLK_F2 => 0xffbf,
        c.SDLK_F3 => 0xffc0,
        c.SDLK_F4 => 0xffc1,
        c.SDLK_F5 => 0xffc2,
        c.SDLK_F6 => 0xffc3,
        c.SDLK_F7 => 0xffc4,
        c.SDLK_F8 => 0xffc5,
        c.SDLK_F9 => 0xffc6,
        c.SDLK_F10 => 0xffc7,
        c.SDLK_F11 => 0xffc8,
        c.SDLK_F12 => 0xffc9,
        c.SDLK_MINUS => 0x002d,
        c.SDLK_EQUALS => 0x003d,
        c.SDLK_LEFTBRACKET => 0x005b,
        c.SDLK_RIGHTBRACKET => 0x005d,
        c.SDLK_BACKSLASH => 0x005c,
        c.SDLK_SEMICOLON => 0x003b,
        c.SDLK_QUOTE => 0x0027,
        c.SDLK_BACKQUOTE => 0x0060,
        c.SDLK_COMMA => 0x002c,
        c.SDLK_PERIOD => 0x002e,
        c.SDLK_SLASH => 0x002f,
        else => {
            // ASCII printable range: SDL keysym == Unicode codepoint for a-z, 0-9
            if (sym >= 0x20 and sym <= 0x7e) return @intCast(sym);
            return null;
        },
    };
}

/// Handle mouse button down. Returns true if consumed by a render surface.
pub fn handleMouseDown(mx: f32, my: f32, button: u8) bool {
    std.debug.print("[rsurface:input] mouseDown at ({d:.0},{d:.0}) btn={d} feeds={d}\n", .{ mx, my, button, feed_count });
    for (0..feed_count) |di| {
        const nr = feed_draw_rects[di].node;
        const dr = feed_draw_rects[di].draw;
        std.debug.print("[rsurface:input]   feed[{d}] node=({d:.0},{d:.0},{d:.0},{d:.0}) draw=({d:.0},{d:.0},{d:.0},{d:.0}) interactive={} status={s}\n", .{ di, nr.x, nr.y, nr.w, nr.h, dr.x, dr.y, dr.w, dr.h, feeds[di].interactive, @tagName(feeds[di].status) });
    }
    if (hitTestFeeds(mx, my)) |idx| {
        focused_feed = idx;
        const pos = screenToFb(idx, mx, my);
        const bit_val: u8 = switch (button) {
            1 => 1,
            2 => 4,
            3 => 2,
            else => 0,
        };
        vnc_button_mask |= bit_val;
        std.debug.print("[rsurface:input] HIT feed[{d}] → pointer ({d},{d}) mask={d} backend={s}\n", .{ idx, pos.x, pos.y, vnc_button_mask, @tagName(feeds[idx].backend) });
        sendPointer(&feeds[idx], pos.x, pos.y, vnc_button_mask, .down, button);
        return true;
    }
    std.debug.print("[rsurface:input] MISS — no feed hit\n", .{});
    focused_feed = null;
    return false;
}

/// Handle mouse button up. Returns true if consumed.
pub fn handleMouseUp(mx: f32, my: f32, button: u8) bool {
    const idx = focused_feed orelse return false;
    if (idx >= feed_count) return false;
    const pos = screenToFb(idx, mx, my);
    const bit_val: u8 = switch (button) {
        1 => 1,
        2 => 4,
        3 => 2,
        else => 0,
    };
    vnc_button_mask &= ~bit_val;
    sendPointer(&feeds[idx], pos.x, pos.y, vnc_button_mask, .up, button);
    return true;
}

/// Handle mouse motion. Returns true if consumed.
pub fn handleMouseMotion(mx: f32, my: f32) bool {
    const idx = focused_feed orelse return false;
    if (idx >= feed_count) return false;
    if (!feeds[idx].interactive or feeds[idx].status != .ready) return false;
    const pos = screenToFb(idx, mx, my);
    sendPointer(&feeds[idx], pos.x, pos.y, vnc_button_mask, .move, 0);
    return true;
}

/// Handle SDL key down. Returns true if consumed by a focused render surface.
pub fn handleKeyDown(sym: c_int) bool {
    const idx = focused_feed orelse return false;
    if (idx >= feed_count) return false;
    const keysym = sdlKeyToKeysym(sym) orelse return false;
    sendKey(&feeds[idx], true, keysym);
    return true;
}

/// Handle SDL key up. Returns true if consumed.
pub fn handleKeyUp(sym: c_int) bool {
    const idx = focused_feed orelse return false;
    if (idx >= feed_count) return false;
    const keysym = sdlKeyToKeysym(sym) orelse return false;
    sendKey(&feeds[idx], false, keysym);
    return true;
}

/// Handle SDL text input. Just consume it — handleKeyDown already sends key events.
/// Without this, printable keys get sent twice (once via KEYDOWN, once via TEXTINPUT).
pub fn handleTextInput(text: [*:0]const u8) bool {
    _ = text;
    return focused_feed != null;
}

/// Check if a render surface currently has focus (for engine to skip other input handling).
pub fn hasFocus() bool {
    return focused_feed != null;
}
