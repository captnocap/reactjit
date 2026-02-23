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
 * Measure advance width of a UTF-8 byte range in pixels.
 */
static int measure_range(const char *text, int start, int end) {
    if (!face) return 0;
    int total = 0;
    int i = start;
    while (i < end) {
        unsigned char  c = (unsigned char)text[i];
        unsigned long  cp;
        int            bytes;
        if      (c < 0x80) { cp = c;              bytes = 1; }
        else if (c < 0xE0) { cp = c & 0x1F;      bytes = 2; }
        else if (c < 0xF0) { cp = c & 0x0F;      bytes = 3; }
        else               { cp = c & 0x07;      bytes = 4; }
        for (int j = 1; j < bytes && (i + j) < end; j++)
            cp = (cp << 6) | ((unsigned char)text[i + j] & 0x3F);
        if (FT_Load_Char(face, cp, FT_LOAD_ADVANCE_ONLY) == 0)
            total += (int)(face->glyph->advance.x >> 6);
        i += bytes;
    }
    return total;
}

/*
 * Measure advance width of a UTF-8 string in pixels.
 */
int ft_measure_text_utf8(const char *text, int byte_len) {
    if (!face || !text) return 0;
    return measure_range(text, 0, byte_len);
}

/*
 * Word-wrap a UTF-8 string to fit within max_width pixels.
 *
 * Splits on whitespace (matching Lua's %S+ pattern). For each paragraph
 * (split on \n), accumulates words greedily.
 *
 * Output: writes null-separated lines into out_buf (caller must ft_free_buffer).
 * Returns the number of lines. out_buf_len receives total buffer length.
 *
 * Example: "hello world\nfoo" at narrow width -> "hello\0world\0foo\0", returns 3
 */
int ft_wrap_text_utf8(const char *text, int byte_len, int max_width,
                      char **out_buf, int *out_buf_len) {
    if (!face || !text || byte_len <= 0 || max_width <= 0) {
        *out_buf = NULL;
        *out_buf_len = 0;
        return 0;
    }

    /* Allocate output buffer — worst case each char is its own line */
    int cap = byte_len + 256;
    char *buf = (char *)malloc(cap);
    if (!buf) { *out_buf = NULL; *out_buf_len = 0; return 0; }

    int buf_pos = 0;
    int num_lines = 0;

    /* Process each paragraph (split on \n) */
    int para_start = 0;
    while (para_start < byte_len) {
        /* Find end of paragraph */
        int para_end = para_start;
        while (para_end < byte_len && text[para_end] != '\n')
            para_end++;

        /* Skip empty paragraphs */
        if (para_end == para_start) {
            para_start = para_end + 1;
            continue;
        }

        /* Word-wrap this paragraph */
        int line_start = -1;  /* byte offset of current line start in text */
        int line_end   = -1;  /* byte offset of current line end in text */
        int i = para_start;

        while (i < para_end) {
            /* Skip whitespace */
            while (i < para_end && (text[i] == ' ' || text[i] == '\t' || text[i] == '\r'))
                i++;
            if (i >= para_end) break;

            /* Find word end */
            int word_start = i;
            while (i < para_end && text[i] != ' ' && text[i] != '\t' && text[i] != '\r')
                i++;
            int word_end = i;

            if (line_start < 0) {
                /* First word on line */
                line_start = word_start;
                line_end   = word_end;
                /* Check if even the first word fits */
                int w = measure_range(text, line_start, line_end);
                if (w > max_width && num_lines > 0) {
                    /* Word alone exceeds width — emit it anyway (can't break further) */
                }
            } else {
                /* Try adding word to current line (line + " " + word) */
                int cand_w = measure_range(text, line_start, word_end);
                /* Account for the space between line_end and word_start:
                   measure from line_start to word_end includes the space chars
                   which is exactly what we want. But the text between line_end
                   and word_start is whitespace we'll replace with a single space.
                   So we need to measure line_start..line_end + space + word_start..word_end */
                /* Simpler: measure the candidate "line so far" + " " + "word" */
                /* We have the original text — just measure line_start..line_end then space then word */
                int line_w = measure_range(text, line_start, line_end);
                int space_w = measure_range(" ", 0, 1);
                int word_w = measure_range(text, word_start, word_end);
                cand_w = line_w + space_w + word_w;

                if (cand_w <= max_width) {
                    /* Fits — extend line */
                    line_end = word_end;
                } else {
                    /* Doesn't fit — emit current line, start new one */
                    /* Grow buffer if needed */
                    int line_len = line_end - line_start;
                    if (buf_pos + line_len + 1 > cap) {
                        cap = cap * 2 + line_len;
                        buf = (char *)realloc(buf, cap);
                    }
                    memcpy(buf + buf_pos, text + line_start, line_len);
                    buf_pos += line_len;
                    buf[buf_pos++] = '\0';
                    num_lines++;

                    line_start = word_start;
                    line_end   = word_end;
                }
            }
        }

        /* Emit remaining line for this paragraph */
        if (line_start >= 0) {
            int line_len = line_end - line_start;
            if (buf_pos + line_len + 1 > cap) {
                cap = cap * 2 + line_len;
                buf = (char *)realloc(buf, cap);
            }
            memcpy(buf + buf_pos, text + line_start, line_len);
            buf_pos += line_len;
            buf[buf_pos++] = '\0';
            num_lines++;
        }

        para_start = para_end + 1;
    }

    if (num_lines == 0) {
        /* No lines produced (empty or whitespace-only text) */
        buf[0] = '\0';
        buf_pos = 1;
        num_lines = 1;
    }

    *out_buf = buf;
    *out_buf_len = buf_pos;
    return num_lines;
}
