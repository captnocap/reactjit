//! Shared C imports for the engine.
//! All modules import C types from here to avoid Zig's
//! "different @cImport = different type" issue.
//!
//! Usage: const c = @import("c.zig");
//! Then: c.SDL_Init(...), c.FT_Init_FreeType(...), etc.

pub const imports = @cImport({
    @cInclude("SDL2/SDL.h");
    @cInclude("GL/gl.h");
    @cInclude("ft2build.h");
    @cInclude("freetype/freetype.h");
});
