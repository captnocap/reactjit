/*
 * ft_helper.c -- Thin FreeType wrapper for LuaJIT FFI
 *
 * Exposes a simple API for glyph rasterization without requiring Lua to
 * replicate FreeType's complex internal struct layout.
 */

#include <ft2build.h>
#include FT_FREETYPE_H
#include <stdlib.h>
#include <string.h>

static FT_Library library = NULL;
static FT_Face    face    = NULL;

int ft_init(void) {
    return FT_Init_FreeType(&library);
}

void ft_done(void) {
    if (face)    { FT_Done_Face(face);         face    = NULL; }
    if (library) { FT_Done_FreeType(library); library = NULL; }
}

int ft_load_font(const char *path) {
    if (face) { FT_Done_Face(face); face = NULL; }
    return FT_New_Face(library, path, 0, &face);
}

int ft_set_size(int pixel_height) {
    if (!face) return -1;
    return FT_Set_Pixel_Sizes(face, 0, pixel_height);
}

/*
 * Rasterize a single Unicode codepoint at the current size.
 * Allocates *out_buffer (caller must ft_free_buffer it).
 * Returns 1 on success, 0 on failure.
 */
int ft_render_char(
    unsigned long charcode,
    int *out_w, int *out_h,
    int *out_left, int *out_top,
    int *out_advance_x,
    int *out_buffer_len,
    unsigned char **out_buffer)
{
    if (!face) return 0;
    if (FT_Load_Char(face, charcode, FT_LOAD_RENDER)) return 0;

    FT_GlyphSlot slot = face->glyph;
    FT_Bitmap   *bm   = &slot->bitmap;

    *out_w          = bm->width;
    *out_h          = bm->rows;
    *out_left       = slot->bitmap_left;
    *out_top        = slot->bitmap_top;
    *out_advance_x  = (int)(slot->advance.x >> 6);
    *out_buffer_len = bm->width * bm->rows;

    if (*out_buffer_len > 0) {
        *out_buffer = (unsigned char *)malloc(*out_buffer_len);
        if (!*out_buffer) return 0;
        for (int row = 0; row < (int)bm->rows; row++) {
            memcpy(*out_buffer + row * bm->width,
                   bm->buffer  + row * bm->pitch,
                   bm->width);
        }
    } else {
        *out_buffer = NULL;
    }
    return 1;
}

void ft_free_buffer(unsigned char *buf) {
    if (buf) free(buf);
}

int ft_get_line_height(void) {
    if (!face) return 16;
    return (int)(face->size->metrics.height >> 6);
}

int ft_get_ascender(void) {
    if (!face) return 12;
    return (int)(face->size->metrics.ascender >> 6);
}

/*
 * Measure advance width of a UTF-8 string in pixels.
 */
int ft_measure_text_utf8(const char *text, int byte_len) {
    if (!face || !text) return 0;
    int total = 0;
    int i = 0;
    while (i < byte_len) {
        unsigned char  c = (unsigned char)text[i];
        unsigned long  cp;
        int            bytes;
        if      (c < 0x80) { cp = c;              bytes = 1; }
        else if (c < 0xE0) { cp = c & 0x1F;      bytes = 2; }
        else if (c < 0xF0) { cp = c & 0x0F;      bytes = 3; }
        else               { cp = c & 0x07;      bytes = 4; }
        for (int j = 1; j < bytes && (i + j) < byte_len; j++)
            cp = (cp << 6) | ((unsigned char)text[i + j] & 0x3F);
        if (FT_Load_Char(face, cp, FT_LOAD_ADVANCE_ONLY) == 0)
            total += (int)(face->glyph->advance.x >> 6);
        i += bytes;
    }
    return total;
}
