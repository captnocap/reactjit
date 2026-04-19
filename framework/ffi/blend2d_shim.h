#ifndef BLEND2D_SHIM_H
#define BLEND2D_SHIM_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Opaque handle for a blend2d rendering surface. */
typedef struct B2DSurface B2DSurface;

/* Create a PRGB32 surface of given size. Returns NULL on failure. */
B2DSurface* b2d_create(int width, int height);

/* Destroy a surface and free all resources. */
void b2d_destroy(B2DSurface* s);

/* Clear the surface to transparent black. */
void b2d_clear(B2DSurface* s);

/* Clear to a specific RGBA color (0xAARRGGBB premultiplied). */
void b2d_clear_rgba32(B2DSurface* s, uint32_t rgba32);

/* Set the current fill color (0xAARRGGBB premultiplied). */
void b2d_set_fill_rgba32(B2DSurface* s, uint32_t rgba32);

/* Set the current stroke color (0xAARRGGBB premultiplied). */
void b2d_set_stroke_rgba32(B2DSurface* s, uint32_t rgba32);

/* Set stroke width. */
void b2d_set_stroke_width(B2DSurface* s, double width);

/* Set composition operator (0=SrcOver, 1=SrcCopy, 2=SrcIn, etc). */
void b2d_set_comp_op(B2DSurface* s, int op);

/* Set global alpha [0.0 .. 1.0]. */
void b2d_set_global_alpha(B2DSurface* s, double alpha);

/* Path building — these operate on an internal path object. */
void b2d_path_reset(B2DSurface* s);
void b2d_path_move_to(B2DSurface* s, double x, double y);
void b2d_path_line_to(B2DSurface* s, double x, double y);
void b2d_path_quad_to(B2DSurface* s, double cx, double cy, double x, double y);
void b2d_path_cubic_to(B2DSurface* s, double c1x, double c1y, double c2x, double c2y, double x, double y);
void b2d_path_close(B2DSurface* s);

/* Fill the current path with the current fill style. */
void b2d_fill_path(B2DSurface* s);

/* Stroke the current path with the current stroke style. */
void b2d_stroke_path(B2DSurface* s);

/* Fill a rectangle. */
void b2d_fill_rect(B2DSurface* s, double x, double y, double w, double h);

/* Fill a circle. */
void b2d_fill_circle(B2DSurface* s, double cx, double cy, double r);

/* Fill a rounded rectangle. */
void b2d_fill_round_rect(B2DSurface* s, double x, double y, double w, double h, double r);

/* Set a linear gradient as fill style. */
void b2d_set_fill_linear_gradient(B2DSurface* s,
    double x0, double y0, double x1, double y1,
    uint32_t color0, uint32_t color1);

/* Set a radial gradient as fill style. */
void b2d_set_fill_radial_gradient(B2DSurface* s,
    double cx, double cy, double r,
    uint32_t color0, uint32_t color1);

/* Set a conic gradient as fill style. */
void b2d_set_fill_conic_gradient(B2DSurface* s,
    double cx, double cy, double angle,
    uint32_t color0, uint32_t color1);

/* Transform: apply 2D affine matrix. */
void b2d_reset_transform(B2DSurface* s);
void b2d_translate(B2DSurface* s, double tx, double ty);
void b2d_scale(B2DSurface* s, double sx, double sy);
void b2d_rotate(B2DSurface* s, double angle);

/* Get pixel data pointer (PRGB32 format: premultiplied ARGB, 4 bytes/pixel).
 * Returns pointer to first pixel. Stride is width*4 (tightly packed). */
const uint8_t* b2d_get_pixels(B2DSurface* s);

/* Get surface dimensions. */
int b2d_get_width(B2DSurface* s);
int b2d_get_height(B2DSurface* s);

/* Parse an SVG path string and add it to the current path. */
void b2d_path_from_svg(B2DSurface* s, const char* svg_d, size_t len);

#ifdef __cplusplus
}
#endif

#endif /* BLEND2D_SHIM_H */
