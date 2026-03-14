/*
 * gbm_format_shim.c — LD_PRELOAD shim
 * Intercepts gbm_surface_create and replaces GBM_FORMAT_ARGB8888
 * with GBM_FORMAT_XRGB8888 for scanout compatibility with virtio-gpu.
 *
 * SDL2's KMSDRM backend hardcodes ARGB8888, but virtio-gpu's DRM driver
 * may only support XRGB8888 for scanout (drmModeSetCrtc/drmModePageFlip).
 *
 * Build: zig cc -shared -fPIC -O2 gbm_format_shim.c -o gbm_format_shim.so -target x86_64-linux-musl
 * Use:   LD_PRELOAD=/app/gbm_format_shim.so luajit /app/main.lua
 */

#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdint.h>

/* GBM format fourcc codes */
#define GBM_FORMAT_ARGB8888 0x34325241  /* 'A', 'R', '2', '4' */
#define GBM_FORMAT_XRGB8888 0x34325258  /* 'X', 'R', '2', '4' */

typedef struct gbm_device gbm_device;
typedef struct gbm_surface gbm_surface;

typedef gbm_surface *(*gbm_surface_create_fn)(gbm_device *dev,
    uint32_t width, uint32_t height, uint32_t format, uint32_t flags);

gbm_surface *gbm_surface_create(gbm_device *dev,
    uint32_t width, uint32_t height, uint32_t format, uint32_t flags)
{
    static gbm_surface_create_fn real_fn = NULL;
    if (!real_fn) {
        real_fn = (gbm_surface_create_fn)dlsym(RTLD_NEXT, "gbm_surface_create");
    }

    if (format == GBM_FORMAT_ARGB8888) {
        fprintf(stderr, "[gbm_shim] ARGB8888 → XRGB8888 (%ux%u flags=0x%x)\n",
                width, height, flags);
        format = GBM_FORMAT_XRGB8888;
    }

    return real_fn(dev, width, height, format, flags);
}
