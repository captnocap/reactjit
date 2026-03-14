//! wgpu-native GPU backend for tsz
//!
//! Replaces SDL_Renderer with wgpu for GPU-accelerated rendering.
//! SDL2 is still used for windowing and events — wgpu gets the
//! native window handle from SDL to create its surface.

const std = @import("std");
const wgpu = @import("wgpu");
const c = @import("c.zig").imports;

// Re-export types needed by other modules
pub const Instance = wgpu.Instance;
pub const Surface = wgpu.Surface;
pub const Device = wgpu.Device;
pub const Queue = wgpu.Queue;
pub const Adapter = wgpu.Adapter;
pub const TextureFormat = wgpu.TextureFormat;

// ════════════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════════════

var g_instance: ?*wgpu.Instance = null;
var g_surface: ?*wgpu.Surface = null;
var g_adapter: ?*wgpu.Adapter = null;
var g_device: ?*wgpu.Device = null;
var g_queue: ?*wgpu.Queue = null;
var g_format: wgpu.TextureFormat = .bgra8_unorm;
var g_width: u32 = 0;
var g_height: u32 = 0;

// ════════════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════════════

pub fn init(window: *c.SDL_Window) !void {
    // Create wgpu instance with Vulkan backend only
    // (the GL/EGL probe panics when SDL already has the display)
    var extras = wgpu.InstanceExtras{
        .backends = wgpu.InstanceBackends.vulkan,
        .flags = wgpu.InstanceFlags.default,
        .dx12_shader_compiler = .@"undefined",
        .gles3_minor_version = .automatic,
        .gl_fence_behavior = .gl_fence_behaviour_normal,
        .dxc_max_shader_model = .dxc_max_shader_model_v6_0,
    };
    var desc = wgpu.InstanceDescriptor{
        .features = .{ .timed_wait_any_enable = 0, .timed_wait_any_max_count = 0 },
    };
    desc = desc.withNativeExtras(&extras);
    g_instance = wgpu.Instance.create(&desc) orelse return error.WGPUInstanceFailed;
    const instance = g_instance.?;

    // Get native window handle from SDL2
    var wm_info: c.SDL_SysWMinfo = std.mem.zeroes(c.SDL_SysWMinfo);
    // SDL_VERSION macro can't be translated by @cImport, set manually
    wm_info.version.major = c.SDL_MAJOR_VERSION;
    wm_info.version.minor = c.SDL_MINOR_VERSION;
    wm_info.version.patch = c.SDL_PATCHLEVEL;
    if (c.SDL_GetWindowWMInfo(window, &wm_info) != c.SDL_TRUE) {
        std.debug.print("SDL_GetWindowWMInfo failed: {s}\n", .{c.SDL_GetError()});
        return error.WindowInfoFailed;
    }

    // Create surface from native window handle
    g_surface = createSurfaceFromSDL(instance, &wm_info) orelse return error.SurfaceCreateFailed;
    const surface = g_surface.?;

    // Request adapter (synchronous, with 200ms polling)
    const adapter_response = instance.requestAdapterSync(&.{
        .compatible_surface = surface,
        .power_preference = .high_performance,
    }, 200_000_000);
    if (adapter_response.status != .success) {
        std.debug.print("wgpu adapter request failed\n", .{});
        return error.AdapterRequestFailed;
    }
    g_adapter = adapter_response.adapter;
    const adapter = g_adapter.?;

    // Request device (synchronous, with 200ms polling)
    const device_response = adapter.requestDeviceSync(instance, null, 200_000_000);
    if (device_response.status != .success) {
        std.debug.print("wgpu device request failed\n", .{});
        return error.DeviceRequestFailed;
    }
    g_device = device_response.device;
    const device = g_device.?;
    g_queue = device.getQueue();

    // Get window size and configure surface
    var w: c_int = 0;
    var h: c_int = 0;
    c.SDL_GetWindowSize(window, &w, &h);
    g_width = @intCast(w);
    g_height = @intCast(h);

    configureSurface(g_width, g_height);

    std.debug.print("wgpu initialized: {d}x{d}\n", .{ g_width, g_height });
}

pub fn deinit() void {
    if (g_queue) |q| q.release();
    if (g_device) |d| d.release();
    if (g_adapter) |a| a.release();
    if (g_surface) |s| s.release();
    if (g_instance) |i| i.release();
    g_queue = null;
    g_device = null;
    g_adapter = null;
    g_surface = null;
    g_instance = null;
}

pub fn resize(width: u32, height: u32) void {
    if (width == 0 or height == 0) return;
    g_width = width;
    g_height = height;
    configureSurface(width, height);
}

/// Render a single frame with a solid background color.
/// Step 1 test — just clear to a color.
pub fn frame(bg_r: f64, bg_g: f64, bg_b: f64) void {
    const surface = g_surface orelse return;
    const device = g_device orelse return;
    const queue = g_queue orelse return;

    // Get current surface texture
    var surface_texture: wgpu.SurfaceTexture = undefined;
    surface.getCurrentTexture(&surface_texture);
    if (surface_texture.status != .success_optimal and surface_texture.status != .success_suboptimal) {
        // Surface needs reconfiguration (resize, lost, etc.)
        if (g_width > 0 and g_height > 0) {
            configureSurface(g_width, g_height);
        }
        return;
    }

    const texture = surface_texture.texture orelse return;
    const view = texture.createView(null) orelse return;
    defer view.release();

    const encoder = device.createCommandEncoder(&.{}) orelse return;

    // Begin render pass with clear color
    const color_attachment = wgpu.ColorAttachment{
        .view = view,
        .load_op = .clear,
        .store_op = .store,
        .clear_value = .{ .r = bg_r, .g = bg_g, .b = bg_b, .a = 1.0 },
    };

    const render_pass = encoder.beginRenderPass(&.{
        .color_attachment_count = 1,
        .color_attachments = @ptrCast(&color_attachment),
    }) orelse return;
    render_pass.end();
    render_pass.release();

    const command = encoder.finish(null) orelse return;
    encoder.release();

    queue.submit(&.{command});
    command.release();

    _ = surface.present();
}

// ════════════════════════════════════════════════════════════════════════
// Internal
// ════════════════════════════════════════════════════════════════════════

fn configureSurface(width: u32, height: u32) void {
    const surface = g_surface orelse return;
    const device = g_device orelse return;
    const adapter = g_adapter orelse return;

    // Get surface capabilities
    var caps: wgpu.SurfaceCapabilities = undefined;
    _ = surface.getCapabilities(adapter, &caps);
    g_format = if (caps.format_count > 0) caps.formats[0] else .bgra8_unorm;

    const config = wgpu.SurfaceConfiguration{
        .device = device,
        .format = g_format,
        .width = width,
        .height = height,
        .present_mode = .fifo,
        .alpha_mode = .auto,
    };
    surface.configure(&config);
}

fn createSurfaceFromSDL(instance: *wgpu.Instance, wm_info: *const c.SDL_SysWMinfo) ?*wgpu.Surface {
    const subsystem = wm_info.subsystem;

    // X11
    if (subsystem == c.SDL_SYSWM_X11) {
        const desc = wgpu.surfaceDescriptorFromXlibWindow(.{
            .display = @ptrCast(wm_info.info.x11.display),
            .window = @intCast(wm_info.info.x11.window),
        });
        return instance.createSurface(&desc);
    }

    // Wayland
    if (subsystem == c.SDL_SYSWM_WAYLAND) {
        const desc = wgpu.surfaceDescriptorFromWaylandSurface(.{
            .display = @ptrCast(wm_info.info.wl.display),
            .surface = @ptrCast(wm_info.info.wl.surface),
        });
        return instance.createSurface(&desc);
    }

    std.debug.print("Unsupported windowing subsystem: {d}\n", .{subsystem});
    return null;
}
