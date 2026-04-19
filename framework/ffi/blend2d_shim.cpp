// blend2d_shim.cpp — Thin C wrapper around Blend2D for Zig FFI.
//
// Provides an opaque B2DSurface handle that wraps BLImage + BLContext + BLPath.
// All rendering happens on the CPU via Blend2D's JIT pipeline, then pixel data
// is handed to the caller for GPU upload.

#include <blend2d/blend2d.h>
#include "blend2d_shim.h"
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <new>

struct B2DSurface {
    BLImage   image;
    BLContext ctx;
    BLPath    path;
    int       width;
    int       height;
};

extern "C" {

B2DSurface* b2d_create(int width, int height) {
    B2DSurface* s = new (std::nothrow) B2DSurface();
    if (!s) return nullptr;

    s->width = width;
    s->height = height;

    if (s->image.create(width, height, BL_FORMAT_PRGB32) != BL_SUCCESS) {
        delete s;
        return nullptr;
    }

    if (s->ctx.begin(s->image) != BL_SUCCESS) {
        delete s;
        return nullptr;
    }

    // Default state
    s->ctx.set_comp_op(BL_COMP_OP_SRC_OVER);
    s->ctx.clear_all();

    return s;
}

void b2d_destroy(B2DSurface* s) {
    if (!s) return;
    s->ctx.end();
    delete s;
}

void b2d_clear(B2DSurface* s) {
    if (!s) return;
    s->ctx.set_comp_op(BL_COMP_OP_CLEAR);
    s->ctx.fill_all();
    s->ctx.set_comp_op(BL_COMP_OP_SRC_OVER);
}

void b2d_clear_rgba32(B2DSurface* s, uint32_t rgba32) {
    if (!s) return;
    s->ctx.set_comp_op(BL_COMP_OP_SRC_COPY);
    s->ctx.set_fill_style(BLRgba32(rgba32));
    s->ctx.fill_all();
    s->ctx.set_comp_op(BL_COMP_OP_SRC_OVER);
}

void b2d_set_fill_rgba32(B2DSurface* s, uint32_t rgba32) {
    if (!s) return;
    s->ctx.set_fill_style(BLRgba32(rgba32));
}

void b2d_set_stroke_rgba32(B2DSurface* s, uint32_t rgba32) {
    if (!s) return;
    s->ctx.set_stroke_style(BLRgba32(rgba32));
}

void b2d_set_stroke_width(B2DSurface* s, double width) {
    if (!s) return;
    s->ctx.set_stroke_width(width);
}

void b2d_set_comp_op(B2DSurface* s, int op) {
    if (!s) return;
    s->ctx.set_comp_op(static_cast<BLCompOp>(op));
}

void b2d_set_global_alpha(B2DSurface* s, double alpha) {
    if (!s) return;
    s->ctx.set_global_alpha(alpha);
}

// ── Path building ──────────────────────────────────────────────

void b2d_path_reset(B2DSurface* s) {
    if (!s) return;
    s->path.reset();
}

void b2d_path_move_to(B2DSurface* s, double x, double y) {
    if (!s) return;
    bl_path_move_to(&s->path, x, y);
}

void b2d_path_line_to(B2DSurface* s, double x, double y) {
    if (!s) return;
    bl_path_line_to(&s->path, x, y);
}

void b2d_path_quad_to(B2DSurface* s, double cx, double cy, double x, double y) {
    if (!s) return;
    bl_path_quad_to(&s->path, cx, cy, x, y);
}

void b2d_path_cubic_to(B2DSurface* s, double c1x, double c1y, double c2x, double c2y, double x, double y) {
    if (!s) return;
    bl_path_cubic_to(&s->path, c1x, c1y, c2x, c2y, x, y);
}

void b2d_path_close(B2DSurface* s) {
    if (!s) return;
    s->path.close();
}

// ── Drawing ────────────────────────────────────────────────────

void b2d_fill_path(B2DSurface* s) {
    if (!s) return;
    s->ctx.fill_path(s->path);
}

void b2d_stroke_path(B2DSurface* s) {
    if (!s) return;
    s->ctx.stroke_path(s->path);
}

void b2d_fill_rect(B2DSurface* s, double x, double y, double w, double h) {
    if (!s) return;
    s->ctx.fill_rect(x, y, w, h);
}

void b2d_fill_circle(B2DSurface* s, double cx, double cy, double r) {
    if (!s) return;
    s->ctx.fill_circle(cx, cy, r);
}

void b2d_fill_round_rect(B2DSurface* s, double x, double y, double w, double h, double r) {
    if (!s) return;
    s->ctx.fill_round_rect(x, y, w, h, r);
}

// ── Gradients ──────────────────────────────────────────────────

void b2d_set_fill_linear_gradient(B2DSurface* s,
    double x0, double y0, double x1, double y1,
    uint32_t color0, uint32_t color1)
{
    if (!s) return;
    BLGradient g(BLLinearGradientValues(x0, y0, x1, y1));
    g.add_stop(0.0, BLRgba32(color0));
    g.add_stop(1.0, BLRgba32(color1));
    s->ctx.set_fill_style(g);
}

void b2d_set_fill_radial_gradient(B2DSurface* s,
    double cx, double cy, double r,
    uint32_t color0, uint32_t color1)
{
    if (!s) return;
    BLGradient g(BLRadialGradientValues(cx, cy, cx, cy, r));
    g.add_stop(0.0, BLRgba32(color0));
    g.add_stop(1.0, BLRgba32(color1));
    s->ctx.set_fill_style(g);
}

void b2d_set_fill_conic_gradient(B2DSurface* s,
    double cx, double cy, double angle,
    uint32_t color0, uint32_t color1)
{
    if (!s) return;
    BLGradient g(BLConicGradientValues(cx, cy, angle));
    g.add_stop(0.0, BLRgba32(color0));
    g.add_stop(1.0, BLRgba32(color1));
    s->ctx.set_fill_style(g);
}

// ── Transforms ─────────────────────────────────────────────────

void b2d_reset_transform(B2DSurface* s) {
    if (!s) return;
    s->ctx.reset_transform();
}

void b2d_translate(B2DSurface* s, double tx, double ty) {
    if (!s) return;
    s->ctx.translate(tx, ty);
}

void b2d_scale(B2DSurface* s, double sx, double sy) {
    if (!s) return;
    s->ctx.scale(sx, sy);
}

void b2d_rotate(B2DSurface* s, double angle) {
    if (!s) return;
    s->ctx.rotate(angle);
}

// ── Pixel readback ─────────────────────────────────────────────

const uint8_t* b2d_get_pixels(B2DSurface* s) {
    if (!s) return nullptr;
    BLImageData data;
    s->image.get_data(&data);
    return static_cast<const uint8_t*>(data.pixel_data);
}

int b2d_get_width(B2DSurface* s) {
    return s ? s->width : 0;
}

int b2d_get_height(B2DSurface* s) {
    return s ? s->height : 0;
}

// ── SVG path parser (minimal — M L C Q S T A Z) ───────────────

static void skip_ws(const char* d, size_t len, size_t* pos) {
    while (*pos < len && (d[*pos] == ' ' || d[*pos] == ',' || d[*pos] == '\t' || d[*pos] == '\n' || d[*pos] == '\r'))
        (*pos)++;
}

static bool read_num(const char* d, size_t len, size_t* pos, double* out) {
    skip_ws(d, len, pos);
    if (*pos >= len) return false;
    char* end = nullptr;
    *out = strtod(d + *pos, &end);
    if (end == d + *pos) return false;
    *pos = (size_t)(end - d);
    return true;
}

static bool is_cmd(char c) {
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

void b2d_path_from_svg(B2DSurface* s, const char* svg_d, size_t len) {
    if (!s || !svg_d || len == 0) return;

    BLPath& p = s->path;
    double cx = 0, cy = 0;   // current point
    double sx = 0, sy = 0;   // subpath start
    double lcx = 0, lcy = 0; // last control point
    char last_cmd = 0;
    size_t pos = 0;

    while (pos < len) {
        skip_ws(svg_d, len, &pos);
        if (pos >= len) break;

        char cmd = svg_d[pos];
        if (is_cmd(cmd)) {
            pos++;
        } else if (last_cmd) {
            cmd = last_cmd;
            if (cmd == 'M') cmd = 'L';
            if (cmd == 'm') cmd = 'l';
        } else {
            break;
        }

        double x, y, x1, y1, x2, y2, x3, y3;
        double rx, ry, rot, la, sw;

        switch (cmd) {
        case 'M':
            if (!read_num(svg_d, len, &pos, &x) || !read_num(svg_d, len, &pos, &y)) goto done;
            bl_path_move_to(&p, x, y);
            cx = sx = x; cy = sy = y;
            break;
        case 'm':
            if (!read_num(svg_d, len, &pos, &x) || !read_num(svg_d, len, &pos, &y)) goto done;
            cx += x; cy += y;
            bl_path_move_to(&p, cx, cy);
            sx = cx; sy = cy;
            break;
        case 'L':
            if (!read_num(svg_d, len, &pos, &x) || !read_num(svg_d, len, &pos, &y)) goto done;
            bl_path_line_to(&p, x, y);
            cx = x; cy = y;
            break;
        case 'l':
            if (!read_num(svg_d, len, &pos, &x) || !read_num(svg_d, len, &pos, &y)) goto done;
            cx += x; cy += y;
            bl_path_line_to(&p, cx, cy);
            break;
        case 'H':
            if (!read_num(svg_d, len, &pos, &x)) goto done;
            cx = x;
            bl_path_line_to(&p, cx, cy);
            break;
        case 'h':
            if (!read_num(svg_d, len, &pos, &x)) goto done;
            cx += x;
            bl_path_line_to(&p, cx, cy);
            break;
        case 'V':
            if (!read_num(svg_d, len, &pos, &y)) goto done;
            cy = y;
            bl_path_line_to(&p, cx, cy);
            break;
        case 'v':
            if (!read_num(svg_d, len, &pos, &y)) goto done;
            cy += y;
            bl_path_line_to(&p, cx, cy);
            break;
        case 'C':
            if (!read_num(svg_d, len, &pos, &x1) || !read_num(svg_d, len, &pos, &y1) ||
                !read_num(svg_d, len, &pos, &x2) || !read_num(svg_d, len, &pos, &y2) ||
                !read_num(svg_d, len, &pos, &x3) || !read_num(svg_d, len, &pos, &y3)) goto done;
            bl_path_cubic_to(&p, x1, y1, x2, y2, x3, y3);
            lcx = x2; lcy = y2;
            cx = x3; cy = y3;
            break;
        case 'c':
            if (!read_num(svg_d, len, &pos, &x1) || !read_num(svg_d, len, &pos, &y1) ||
                !read_num(svg_d, len, &pos, &x2) || !read_num(svg_d, len, &pos, &y2) ||
                !read_num(svg_d, len, &pos, &x3) || !read_num(svg_d, len, &pos, &y3)) goto done;
            bl_path_cubic_to(&p, cx+x1, cy+y1, cx+x2, cy+y2, cx+x3, cy+y3);
            lcx = cx+x2; lcy = cy+y2;
            cx += x3; cy += y3;
            break;
        case 'S':
            if (!read_num(svg_d, len, &pos, &x2) || !read_num(svg_d, len, &pos, &y2) ||
                !read_num(svg_d, len, &pos, &x3) || !read_num(svg_d, len, &pos, &y3)) goto done;
            x1 = (last_cmd == 'C' || last_cmd == 'c' || last_cmd == 'S' || last_cmd == 's') ? 2*cx - lcx : cx;
            y1 = (last_cmd == 'C' || last_cmd == 'c' || last_cmd == 'S' || last_cmd == 's') ? 2*cy - lcy : cy;
            bl_path_cubic_to(&p, x1, y1, x2, y2, x3, y3);
            lcx = x2; lcy = y2;
            cx = x3; cy = y3;
            break;
        case 's':
            if (!read_num(svg_d, len, &pos, &x2) || !read_num(svg_d, len, &pos, &y2) ||
                !read_num(svg_d, len, &pos, &x3) || !read_num(svg_d, len, &pos, &y3)) goto done;
            x1 = (last_cmd == 'C' || last_cmd == 'c' || last_cmd == 'S' || last_cmd == 's') ? 2*cx - lcx : cx;
            y1 = (last_cmd == 'C' || last_cmd == 'c' || last_cmd == 'S' || last_cmd == 's') ? 2*cy - lcy : cy;
            bl_path_cubic_to(&p, x1, y1, cx+x2, cy+y2, cx+x3, cy+y3);
            lcx = cx+x2; lcy = cy+y2;
            cx += x3; cy += y3;
            break;
        case 'Q':
            if (!read_num(svg_d, len, &pos, &x1) || !read_num(svg_d, len, &pos, &y1) ||
                !read_num(svg_d, len, &pos, &x2) || !read_num(svg_d, len, &pos, &y2)) goto done;
            bl_path_quad_to(&p, x1, y1, x2, y2);
            lcx = x1; lcy = y1;
            cx = x2; cy = y2;
            break;
        case 'q':
            if (!read_num(svg_d, len, &pos, &x1) || !read_num(svg_d, len, &pos, &y1) ||
                !read_num(svg_d, len, &pos, &x2) || !read_num(svg_d, len, &pos, &y2)) goto done;
            bl_path_quad_to(&p, cx+x1, cy+y1, cx+x2, cy+y2);
            lcx = cx+x1; lcy = cy+y1;
            cx += x2; cy += y2;
            break;
        case 'T':
            if (!read_num(svg_d, len, &pos, &x2) || !read_num(svg_d, len, &pos, &y2)) goto done;
            x1 = (last_cmd == 'Q' || last_cmd == 'q' || last_cmd == 'T' || last_cmd == 't') ? 2*cx - lcx : cx;
            y1 = (last_cmd == 'Q' || last_cmd == 'q' || last_cmd == 'T' || last_cmd == 't') ? 2*cy - lcy : cy;
            bl_path_quad_to(&p, x1, y1, x2, y2);
            lcx = x1; lcy = y1;
            cx = x2; cy = y2;
            break;
        case 't':
            if (!read_num(svg_d, len, &pos, &x2) || !read_num(svg_d, len, &pos, &y2)) goto done;
            x1 = (last_cmd == 'Q' || last_cmd == 'q' || last_cmd == 'T' || last_cmd == 't') ? 2*cx - lcx : cx;
            y1 = (last_cmd == 'Q' || last_cmd == 'q' || last_cmd == 'T' || last_cmd == 't') ? 2*cy - lcy : cy;
            bl_path_quad_to(&p, x1, y1, cx+x2, cy+y2);
            lcx = x1; lcy = y1;
            cx += x2; cy += y2;
            break;
        case 'A': case 'a': {
            bool rel = (cmd == 'a');
            if (!read_num(svg_d, len, &pos, &rx) || !read_num(svg_d, len, &pos, &ry) ||
                !read_num(svg_d, len, &pos, &rot) || !read_num(svg_d, len, &pos, &la) ||
                !read_num(svg_d, len, &pos, &sw) ||
                !read_num(svg_d, len, &pos, &x) || !read_num(svg_d, len, &pos, &y)) goto done;
            if (rel) { x += cx; y += cy; }
            bl_path_elliptic_arc_to(&p, rx, ry, rot, la > 0.5, sw > 0.5, x, y);
            cx = x; cy = y;
            break;
        }
        case 'Z': case 'z':
            bl_path_close(&p);
            cx = sx; cy = sy;
            break;
        default:
            break;
        }
        last_cmd = cmd;
    }
done:
    return;
}

} // extern "C"
