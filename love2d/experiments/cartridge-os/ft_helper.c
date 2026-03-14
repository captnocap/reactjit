/*
 * ft_helper.c — Thin FreeType2 wrapper for CartridgeOS font rendering.
 * Provides glyph rasterization + text measurement via LuaJIT FFI.
 *
 * Build (musl, static FreeType):
 *   zig cc -target x86_64-linux-musl -shared -o ft_helper.so ft_helper.c \
 *       -I/usr/include/freetype2 -lfreetype -lz -lpng -lbz2
 */

#include <ft2build.h>
#include FT_FREETYPE_H

#include <stdlib.h>
#include <string.h>

static FT_Library ft_lib;
static FT_Face    ft_face;

int ft_init(void) {
    FT_Error err = FT_Init_FreeType(&ft_lib);
    return err;  /* 0 = success (FreeType convention) */
}

void ft_done(void) {
    if (ft_face) { FT_Done_Face(ft_face); ft_face = NULL; }
    if (ft_lib)  { FT_Done_FreeType(ft_lib); ft_lib = NULL; }
}

int ft_load_font(const char *path) {
    if (ft_face) FT_Done_Face(ft_face);
    FT_Error err = FT_New_Face(ft_lib, path, 0, &ft_face);
    return err;  /* 0 = success */
}

int ft_set_size(int pixel_height) {
    if (!ft_face) return -1;
    FT_Error err = FT_Set_Pixel_Sizes(ft_face, 0, pixel_height);
    return err;  /* 0 = success */
}

int ft_render_char(unsigned long charcode,
                   int *out_w, int *out_h,
                   int *out_left, int *out_top,
                   int *out_advance_x,
                   int *out_buffer_len,
                   unsigned char **out_buffer) {
    if (!ft_face) return 0;

    FT_UInt idx = FT_Get_Char_Index(ft_face, charcode);
    if (idx == 0) return 0;

    FT_Error err = FT_Load_Glyph(ft_face, idx, FT_LOAD_DEFAULT);
    if (err) return 0;

    err = FT_Render_Glyph(ft_face->glyph, FT_RENDER_MODE_NORMAL);
    if (err) return 0;

    FT_GlyphSlot g = ft_face->glyph;
    int w = g->bitmap.width;
    int h = g->bitmap.rows;

    *out_w = w;
    *out_h = h;
    *out_left = g->bitmap_left;
    *out_top  = g->bitmap_top;
    *out_advance_x = (int)(g->advance.x >> 6);

    int buf_len = w * h;
    *out_buffer_len = buf_len;

    if (buf_len > 0) {
        unsigned char *buf = (unsigned char *)malloc(buf_len);
        if (!buf) return 0;
        /* Copy row by row (bitmap.pitch may differ from width) */
        for (int row = 0; row < h; row++) {
            memcpy(buf + row * w,
                   g->bitmap.buffer + row * g->bitmap.pitch,
                   w);
        }
        *out_buffer = buf;
    } else {
        *out_buffer = NULL;
    }

    return 1;
}

void ft_free_buffer(unsigned char *buf) {
    free(buf);
}

int ft_get_line_height(void) {
    if (!ft_face) return 0;
    return (int)(ft_face->size->metrics.height >> 6);
}

int ft_get_ascender(void) {
    if (!ft_face) return 0;
    return (int)(ft_face->size->metrics.ascender >> 6);
}

int ft_measure_text_utf8(const char *text, int byte_len) {
    if (!ft_face || !text) return 0;

    int width = 0;
    int i = 0;
    while (i < byte_len) {
        unsigned long cp;
        int len;
        unsigned char c = (unsigned char)text[i];
        if (c < 0x80)      { cp = c;                   len = 1; }
        else if (c < 0xE0) { cp = c & 0x1F;            len = 2; }
        else if (c < 0xF0) { cp = c & 0x0F;            len = 3; }
        else               { cp = c & 0x07;            len = 4; }
        for (int j = 1; j < len && (i + j) < byte_len; j++) {
            cp = (cp << 6) | ((unsigned char)text[i + j] & 0x3F);
        }

        FT_UInt idx = FT_Get_Char_Index(ft_face, cp);
        if (idx != 0) {
            FT_Load_Glyph(ft_face, idx, FT_LOAD_DEFAULT);
            width += (int)(ft_face->glyph->advance.x >> 6);
        }

        i += len;
    }
    return width;
}
