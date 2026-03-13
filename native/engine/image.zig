//! ReactJIT Image Loader — Phase 4
//!
//! stb_image decode → SDL2 texture cache → screen.
//! Loads images once, caches as SDL textures (same pattern as glyph cache).
//! Supports PNG, JPEG, BMP, GIF via stb_image.

const std = @import("std");
const c = @import("c.zig").imports;

// ── Image cache ─────────────────────────────────────────────────────────────

const MAX_CACHED_IMAGES = 64;

pub const ImageEntry = struct {
    path: [256]u8 = undefined,
    path_len: usize = 0,
    texture: *c.SDL_Texture = undefined,
    width: i32 = 0,
    height: i32 = 0,
};

pub const ImageCache = struct {
    renderer: *c.SDL_Renderer,
    entries: [MAX_CACHED_IMAGES]ImageEntry = undefined,
    count: usize = 0,

    pub fn init(renderer: *c.SDL_Renderer) ImageCache {
        return .{ .renderer = renderer };
    }

    pub fn deinit(self: *ImageCache) void {
        for (0..self.count) |i| {
            c.SDL_DestroyTexture(self.entries[i].texture);
        }
        self.count = 0;
    }

    /// Load an image by path, returning a cached entry. Returns null on failure.
    pub fn load(self: *ImageCache, path: []const u8) ?*const ImageEntry {
        // Check cache first
        for (0..self.count) |i| {
            if (self.entries[i].path_len == path.len and
                std.mem.eql(u8, self.entries[i].path[0..self.entries[i].path_len], path))
            {
                return &self.entries[i];
            }
        }

        // Cache full — can't load more (no eviction for now)
        if (self.count >= MAX_CACHED_IMAGES) return null;

        // Path too long
        if (path.len >= 256) return null;

        // Need null-terminated path for stbi_load
        var path_z: [256:0]u8 = undefined;
        @memcpy(path_z[0..path.len], path);
        path_z[path.len] = 0;

        // Decode image via stb_image
        var img_w: c_int = 0;
        var img_h: c_int = 0;
        var channels: c_int = 0;
        const pixels = c.stbi_load(&path_z, &img_w, &img_h, &channels, 4); // force RGBA
        if (pixels == null) return null;
        defer c.stbi_image_free(pixels);

        if (img_w <= 0 or img_h <= 0) return null;

        // Create SDL texture from pixel data
        const texture = c.SDL_CreateTexture(
            self.renderer,
            c.SDL_PIXELFORMAT_ABGR8888, // stb_image RGBA = SDL ABGR on little-endian
            c.SDL_TEXTUREACCESS_STATIC,
            img_w,
            img_h,
        ) orelse return null;

        _ = c.SDL_SetTextureBlendMode(texture, c.SDL_BLENDMODE_BLEND);

        if (c.SDL_UpdateTexture(texture, null, pixels, img_w * 4) != 0) {
            c.SDL_DestroyTexture(texture);
            return null;
        }

        // Store in cache
        const idx = self.count;
        self.entries[idx] = .{
            .texture = texture,
            .width = img_w,
            .height = img_h,
            .path_len = path.len,
        };
        @memcpy(self.entries[idx].path[0..path.len], path);
        self.count += 1;

        return &self.entries[idx];
    }
};
