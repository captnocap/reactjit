/*
 * image_helper.c -- stb_image load + write + incremental resize for LuaJIT FFI
 *
 * Loads images into RGBA8 pixel buffers, writes JPEG/PNG/BMP, and provides
 * a row-based bilinear resize that can be driven incrementally (N rows per
 * frame) so the Lua run-loop never blocks on a large image.
 *
 * All buffers are flat RGBA8: (y * width + x) * 4.
 */

#include <stdlib.h>
#include <string.h>
#include <math.h>

/* ── stb_image (decode) ────────────────────────────────────────────────── */
#define STB_IMAGE_IMPLEMENTATION
#define STBI_ONLY_JPEG
#define STBI_ONLY_PNG
#define STBI_ONLY_BMP
#define STBI_ONLY_TGA
#define STBI_ONLY_GIF
#include "stb_image.h"

/* ── stb_image_write (encode) ──────────────────────────────────────────── */
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

/* ── Existing API (unchanged) ──────────────────────────────────────────── */

unsigned char *image_load(const char *path, int *out_w, int *out_h, int *out_channels) {
    return stbi_load(path, out_w, out_h, out_channels, 4);
}

void image_free(unsigned char *data) {
    stbi_image_free(data);
}

/* ── Encode (write to file) ────────────────────────────────────────────── */

int image_write_png(const char *path, int w, int h, const unsigned char *data) {
    return stbi_write_png(path, w, h, 4, data, w * 4);
}

int image_write_bmp(const char *path, int w, int h, const unsigned char *data) {
    return stbi_write_bmp(path, w, h, 4, data);
}

int image_write_jpg(const char *path, int w, int h, const unsigned char *data, int quality) {
    return stbi_write_jpg(path, w, h, 4, data, quality);
}

/* ── Encode to memory (JPEG) ──────────────────────────────────────────── */

/* Callback context for stbi_write_*_to_func → dynamic buffer */
typedef struct {
    unsigned char *buf;
    int len;
    int cap;
} MemWriteCtx;

static void mem_write_cb(void *ctx, void *data, int size) {
    MemWriteCtx *m = (MemWriteCtx *)ctx;
    int need = m->len + size;
    if (need > m->cap) {
        int newcap = m->cap * 2;
        if (newcap < need) newcap = need;
        m->buf = (unsigned char *)realloc(m->buf, newcap);
        m->cap = newcap;
    }
    memcpy(m->buf + m->len, data, size);
    m->len += size;
}

unsigned char *image_write_jpg_mem(const unsigned char *data, int w, int h,
                                   int quality, int *out_len) {
    MemWriteCtx ctx = { NULL, 0, 0 };
    ctx.cap = w * h;  /* rough initial guess */
    ctx.buf = (unsigned char *)malloc(ctx.cap);
    if (!ctx.buf) { *out_len = 0; return NULL; }

    int ok = stbi_write_jpg_to_func(mem_write_cb, &ctx, w, h, 4, data, quality);
    if (!ok) {
        free(ctx.buf);
        *out_len = 0;
        return NULL;
    }
    *out_len = ctx.len;
    return ctx.buf;
}

unsigned char *image_write_png_mem(const unsigned char *data, int w, int h,
                                   int *out_len) {
    MemWriteCtx ctx = { NULL, 0, 0 };
    ctx.cap = w * h * 2;
    ctx.buf = (unsigned char *)malloc(ctx.cap);
    if (!ctx.buf) { *out_len = 0; return NULL; }

    int ok = stbi_write_png_to_func(mem_write_cb, &ctx, w, h, 4, data, w * 4);
    if (!ok) {
        free(ctx.buf);
        *out_len = 0;
        return NULL;
    }
    *out_len = ctx.len;
    return ctx.buf;
}

/* ── Incremental bilinear resize ───────────────────────────────────────── *
 *
 * Frame-distributed: Lua calls image_resize_begin() once, then
 * image_resize_rows(ctx, N) each tick to process N output rows.
 * When image_resize_done(ctx) returns true, the output buffer is ready.
 *
 * This is how Tor distributes work across its event loop — never block
 * a single frame, spread the total cost across as many frames as needed.
 */

typedef struct {
    const unsigned char *input;
    int in_w, in_h;
    unsigned char *output;
    int out_w, out_h;
    int current_row;   /* next output row to process */
    float x_ratio;     /* pre-computed scale factors */
    float y_ratio;
} ImageResizeCtx;

ImageResizeCtx *image_resize_begin(const unsigned char *input,
                                   int in_w, int in_h,
                                   int out_w, int out_h) {
    if (!input || in_w <= 0 || in_h <= 0 || out_w <= 0 || out_h <= 0)
        return NULL;

    ImageResizeCtx *ctx = (ImageResizeCtx *)calloc(1, sizeof(ImageResizeCtx));
    if (!ctx) return NULL;

    ctx->output = (unsigned char *)malloc(out_w * out_h * 4);
    if (!ctx->output) { free(ctx); return NULL; }

    ctx->input  = input;
    ctx->in_w   = in_w;
    ctx->in_h   = in_h;
    ctx->out_w  = out_w;
    ctx->out_h  = out_h;
    ctx->current_row = 0;
    ctx->x_ratio = (float)(in_w - 1) / (float)(out_w > 1 ? out_w - 1 : 1);
    ctx->y_ratio = (float)(in_h - 1) / (float)(out_h > 1 ? out_h - 1 : 1);

    return ctx;
}

/*
 * Process up to num_rows output rows using bilinear interpolation.
 * Returns the number of rows actually processed (may be less if we hit the end).
 */
int image_resize_rows(ImageResizeCtx *ctx, int num_rows) {
    if (!ctx || ctx->current_row >= ctx->out_h) return 0;

    int end_row = ctx->current_row + num_rows;
    if (end_row > ctx->out_h) end_row = ctx->out_h;

    int processed = 0;
    const int in_w  = ctx->in_w;
    const int out_w = ctx->out_w;
    const float x_ratio = ctx->x_ratio;
    const float y_ratio = ctx->y_ratio;
    const unsigned char *src = ctx->input;
    unsigned char *dst = ctx->output;

    for (int oy = ctx->current_row; oy < end_row; oy++) {
        float fy = oy * y_ratio;
        int iy  = (int)fy;
        float fy_frac = fy - iy;

        /* Clamp source row to valid range */
        int iy1 = iy + 1;
        if (iy1 >= ctx->in_h) iy1 = ctx->in_h - 1;

        const unsigned char *row0 = src + (iy  * in_w) * 4;
        const unsigned char *row1 = src + (iy1 * in_w) * 4;
        unsigned char *out_row = dst + (oy * out_w) * 4;

        for (int ox = 0; ox < out_w; ox++) {
            float fx = ox * x_ratio;
            int ix  = (int)fx;
            float fx_frac = fx - ix;

            /* Clamp source column */
            int ix1 = ix + 1;
            if (ix1 >= in_w) ix1 = in_w - 1;

            /* Four source pixels */
            const unsigned char *p00 = row0 + ix  * 4;
            const unsigned char *p10 = row0 + ix1 * 4;
            const unsigned char *p01 = row1 + ix  * 4;
            const unsigned char *p11 = row1 + ix1 * 4;

            /* Bilinear weights */
            float w00 = (1.0f - fx_frac) * (1.0f - fy_frac);
            float w10 = fx_frac          * (1.0f - fy_frac);
            float w01 = (1.0f - fx_frac) * fy_frac;
            float w11 = fx_frac          * fy_frac;

            /* Interpolate RGBA */
            for (int c = 0; c < 4; c++) {
                float v = p00[c] * w00 + p10[c] * w10 +
                          p01[c] * w01 + p11[c] * w11;
                int iv = (int)(v + 0.5f);
                if (iv > 255) iv = 255;
                out_row[ox * 4 + c] = (unsigned char)iv;
            }
        }
        processed++;
    }

    ctx->current_row = end_row;
    return processed;
}

int image_resize_done(ImageResizeCtx *ctx) {
    return ctx && ctx->current_row >= ctx->out_h;
}

/* Get the current progress row (for Lua to compute progress %) */
int image_resize_progress(ImageResizeCtx *ctx) {
    return ctx ? ctx->current_row : 0;
}

/* Get output dimensions */
int image_resize_out_w(ImageResizeCtx *ctx) { return ctx ? ctx->out_w : 0; }
int image_resize_out_h(ImageResizeCtx *ctx) { return ctx ? ctx->out_h : 0; }

/* Get the output buffer pointer (valid only after resize is complete) */
unsigned char *image_resize_result(ImageResizeCtx *ctx) {
    return ctx ? ctx->output : NULL;
}

/* Free the context AND the output buffer. Call after encoding is complete. */
void image_resize_free(ImageResizeCtx *ctx) {
    if (!ctx) return;
    if (ctx->output) free(ctx->output);
    free(ctx);
}
