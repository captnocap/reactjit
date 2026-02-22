/*
 * image_helper.c -- Thin stb_image wrapper for LuaJIT FFI
 *
 * Loads images into RGBA8 pixel buffers without requiring Lua to link
 * against any image library directly. Forces 4-channel output so callers
 * always get a flat uint8_t array at (y * width + x) * 4.
 */

#define STB_IMAGE_IMPLEMENTATION
#define STBI_ONLY_JPEG
#define STBI_ONLY_PNG
#define STBI_ONLY_BMP
#define STBI_ONLY_TGA
#define STBI_ONLY_GIF
#include "stb_image.h"

unsigned char *image_load(const char *path, int *out_w, int *out_h, int *out_channels) {
    return stbi_load(path, out_w, out_h, out_channels, 4);
}

void image_free(unsigned char *data) {
    stbi_image_free(data);
}
