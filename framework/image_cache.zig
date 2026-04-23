//! Image cache — decodes `<Image source={...}>` sources to GPU textures once
//! and reuses the bind group on every subsequent frame. Keyed by the source
//! string pointer so repeated renders of the same node hit the cache.
//!
//! Supported sources:
//!   - Absolute or cwd-relative file path to a PNG / JPEG / BMP / etc.
//!   - `data:image/<fmt>;base64,<payload>` data URLs.
//!
//! stbi_load_from_memory handles the actual decode. Transport-level work
//! (fetching a URL, async loading) is out of scope — sources must resolve
//! to in-memory bytes synchronously. For every Image node, painting dispatches
//! to `queueForPaint(node, rect)` which queues a quad via gpu.images.

const std = @import("std");
const wgpu = @import("wgpu");
const gpu = @import("gpu/gpu.zig");
const images = @import("gpu/images.zig");
const c = @import("c.zig").imports;

const MAX_ENTRIES: u32 = 256;

const Entry = struct {
    key_ptr: usize = 0, // keyed by source-string pointer identity
    key_len: usize = 0,
    width: u32 = 0,
    height: u32 = 0,
    texture: ?*wgpu.Texture = null,
    texture_view: ?*wgpu.TextureView = null,
    bind_group: ?*wgpu.BindGroup = null,
    failed: bool = false, // stop retrying broken sources every frame
    active: bool = false,
};

var g_entries: [MAX_ENTRIES]Entry = [_]Entry{.{}} ** MAX_ENTRIES;
var g_count: u32 = 0;
var g_sampler: ?*wgpu.Sampler = null;

fn find(src: []const u8) ?*Entry {
    const p = @intFromPtr(src.ptr);
    var i: u32 = 0;
    while (i < g_count) : (i += 1) {
        const e = &g_entries[i];
        if (e.active and e.key_ptr == p and e.key_len == src.len) return e;
    }
    return null;
}

fn getSampler(device: *wgpu.Device) ?*wgpu.Sampler {
    if (g_sampler != null) return g_sampler;
    g_sampler = device.createSampler(&.{
        .address_mode_u = .clamp_to_edge,
        .address_mode_v = .clamp_to_edge,
        .mag_filter = .linear,
        .min_filter = .linear,
    });
    return g_sampler;
}

/// Decode a data URL into its raw byte payload. Caller frees on success.
fn decodeDataUrl(src: []const u8, alloc: std.mem.Allocator) ?[]u8 {
    // Expected shape: data:<mime>[;base64],<payload>
    if (!std.mem.startsWith(u8, src, "data:")) return null;
    const comma = std.mem.indexOfScalar(u8, src, ',') orelse return null;
    const head = src[5..comma];
    const payload = src[comma + 1 ..];
    if (std.mem.indexOf(u8, head, ";base64") != null) {
        // Strip whitespace before decoding — some carts embed newlines for
        // readability and std.base64 rejects them outright.
        var trimmed: std.ArrayList(u8) = .{};
        defer trimmed.deinit(alloc);
        trimmed.ensureTotalCapacity(alloc, payload.len) catch return null;
        for (payload) |ch| {
            if (ch == ' ' or ch == '\n' or ch == '\r' or ch == '\t') continue;
            trimmed.append(alloc, ch) catch return null;
        }
        const decoder = std.base64.standard.Decoder;
        const out_len = decoder.calcSizeForSlice(trimmed.items) catch return null;
        const out = alloc.alloc(u8, out_len) catch return null;
        decoder.decode(out, trimmed.items) catch {
            alloc.free(out);
            return null;
        };
        return out;
    }
    // Percent-encoded plain text (utf8) — decode is costly but rarely used
    // for bitmap images; stb_image can't read SVG anyway. Reject.
    return null;
}

/// Read a file path's contents. Caller frees.
fn readFile(path: []const u8, alloc: std.mem.Allocator) ?[]u8 {
    return std.fs.cwd().readFileAlloc(alloc, path, 64 * 1024 * 1024) catch null;
}

fn load(src: []const u8) ?*Entry {
    if (g_count >= MAX_ENTRIES) return null;
    const device = gpu.getDevice() orelse return null;
    const queue = gpu.getQueue() orelse return null;

    const alloc = std.heap.c_allocator;
    const raw: []u8 = blk: {
        if (std.mem.startsWith(u8, src, "data:")) {
            break :blk decodeDataUrl(src, alloc) orelse return null;
        }
        break :blk readFile(src, alloc) orelse return null;
    };
    defer alloc.free(raw);

    // stbi_load_from_memory → 4-channel RGBA8 pixels.
    var w: c_int = 0;
    var h: c_int = 0;
    var channels: c_int = 0;
    const pixels_ptr = c.stbi_load_from_memory(
        raw.ptr,
        @intCast(raw.len),
        &w,
        &h,
        &channels,
        4,
    );
    if (pixels_ptr == null or w <= 0 or h <= 0) {
        std.debug.print("[image_cache] decode FAILED src_len={d} raw_len={d}\n", .{ src.len, raw.len });
        return null;
    }
    std.debug.print("[image_cache] decode OK {d}x{d} ch={d} raw_len={d}\n", .{ w, h, channels, raw.len });
    defer c.stbi_image_free(pixels_ptr);
    const pw: u32 = @intCast(w);
    const ph: u32 = @intCast(h);

    // Swizzle RGBA → BGRA when the swapchain format requires it, matching
    // blend2d.zig's pattern. stb returns RGBA; WebGPU/BGRA8Unorm expects
    // B,G,R,A byte order.
    const total_bytes: usize = @as(usize, pw) * @as(usize, ph) * 4;
    const pixels_slice: []u8 = pixels_ptr[0..total_bytes];
    if (gpu.getFormat() == .bgra8_unorm) {
        var i: usize = 0;
        while (i < total_bytes) : (i += 4) {
            const r = pixels_slice[i];
            pixels_slice[i] = pixels_slice[i + 2];
            pixels_slice[i + 2] = r;
        }
    }

    const tex = device.createTexture(&.{
        .label = wgpu.StringView.fromSlice("image_cache_tex"),
        .size = .{ .width = pw, .height = ph, .depth_or_array_layers = 1 },
        .mip_level_count = 1,
        .sample_count = 1,
        .dimension = .@"2d",
        .format = gpu.getFormat(),
        .usage = wgpu.TextureUsages.texture_binding | wgpu.TextureUsages.copy_dst,
    }) orelse return null;
    const tv = tex.createView(null) orelse {
        tex.release();
        return null;
    };
    queue.writeTexture(
        &.{ .texture = tex, .mip_level = 0, .origin = .{ .x = 0, .y = 0, .z = 0 }, .aspect = .all },
        pixels_slice.ptr,
        pw * ph * 4,
        &.{ .offset = 0, .bytes_per_row = pw * 4, .rows_per_image = ph },
        &.{ .width = pw, .height = ph, .depth_or_array_layers = 1 },
    );
    const samp = getSampler(device) orelse {
        tv.release();
        tex.release();
        return null;
    };
    const bg = images.createBindGroup(tv, samp) orelse {
        tv.release();
        tex.release();
        return null;
    };

    const entry = &g_entries[g_count];
    entry.* = .{
        .key_ptr = @intFromPtr(src.ptr),
        .key_len = src.len,
        .width = pw,
        .height = ph,
        .texture = tex,
        .texture_view = tv,
        .bind_group = bg,
        .failed = false,
        .active = true,
    };
    g_count += 1;
    return entry;
}

/// Memoized get — decodes on first call, returns the cached entry thereafter.
/// Returns null on decode failure (and marks a negative-cache slot so we
/// don't re-decode a broken source every frame).
fn getOrLoad(src: []const u8) ?*Entry {
    if (src.len == 0) return null;
    if (find(src)) |entry| {
        if (entry.failed) return null;
        return entry;
    }
    if (load(src)) |entry| return entry;
    // Reserve a negative-cache slot so we don't re-attempt the decode every
    // frame. Reuse the source pointer as key.
    if (g_count < MAX_ENTRIES) {
        g_entries[g_count] = .{
            .key_ptr = @intFromPtr(src.ptr),
            .key_len = src.len,
            .failed = true,
            .active = true,
        };
        g_count += 1;
    }
    return null;
}

/// Queue an image quad for rendering at (x,y,w,h) with the given opacity.
/// No-op when decode fails — the Image node renders as an empty rect (its
/// parent's background shows through). Intrinsic sizing (w/h=0 inputs) is
/// handled by the caller.
pub fn queueQuad(src: []const u8, x: f32, y: f32, w: f32, h: f32, opacity: f32) void {
    const entry = getOrLoad(src) orelse return;
    if (entry.bind_group) |bg| {
        images.queueQuad(x, y, w, h, opacity, bg);
    }
}

/// Natural pixel dimensions of the decoded image. Used by layout for
/// intrinsic sizing when an <Image> has no explicit width/height.
pub fn measure(src: []const u8) struct { w: f32, h: f32 } {
    const entry = getOrLoad(src) orelse return .{ .w = 0, .h = 0 };
    return .{ .w = @floatFromInt(entry.width), .h = @floatFromInt(entry.height) };
}
