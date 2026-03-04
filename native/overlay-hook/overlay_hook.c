/*
 * overlay_hook.c — LD_PRELOAD hook for fullscreen game overlay
 *
 * Intercepts glXSwapBuffers to composite a ReactJIT overlay onto any
 * OpenGL game's framebuffer. Reads overlay pixels from POSIX shared
 * memory written by the Love2D overlay process.
 *
 * Usage:
 *   LD_PRELOAD=liboverlay_hook.so RJIT_OVERLAY_SHM=/rjit-overlay-12345 ./game
 *
 * GL state save/restore is a direct C translation of lua/videos.lua
 * lines 524-561 (17 variables + pixel store). Battle-tested against
 * mpv GL state corruption in production.
 *
 * Build: zig build overlay-hook → zig-out/lib/liboverlay_hook.so
 */

#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <dlfcn.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <dirent.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <GL/gl.h>
#include <GL/glx.h>
#include <GL/glext.h>

/* ── Shared memory protocol (must match lua/overlay_shm.lua) ─────────────── */

#define RJIT_MAGIC    0x524A4954  /* "RJIT" */
#define FLAG_VISIBLE  (1 << 0)
#define FLAG_INTERACT (1 << 1)
#define SHM_HEADER_SIZE 32

typedef struct {
    uint32_t magic;
    uint32_t width;
    uint32_t height;
    uint32_t frame_seq;
    uint32_t flags;
    uint8_t  _pad[12];
    /* RGBA pixel data follows at offset 32 */
} rjit_shm_header_t;

/* ── GL constants (from lua/videos.lua lines 118-162) ────────────────────── */

#define GL_FRAMEBUFFER_BINDING_         0x8CA6
#define GL_FRAMEBUFFER_                 0x8D40
#define GL_CURRENT_PROGRAM_             0x8B8D
#define GL_VERTEX_ARRAY_BINDING_        0x85B5
#define GL_ARRAY_BUFFER_BINDING_        0x8894
#define GL_ELEMENT_ARRAY_BUFFER_BINDING_ 0x8895
#define GL_ACTIVE_TEXTURE_              0x84E0
#define GL_TEXTURE0_                    0x84C0
#define GL_TEXTURE_BINDING_2D_          0x8069
#define GL_VIEWPORT_                    0x0BA2
#define GL_SCISSOR_BOX_                 0x0C10
#define GL_BLEND_SRC_                   0x0BE1
#define GL_BLEND_DST_                   0x0BE0
#define GL_BLEND_                       0x0BE2
#define GL_SCISSOR_TEST_                0x0C11
#define GL_DEPTH_TEST_                  0x0B71
#define GL_STENCIL_TEST_                0x0B90
#define GL_CULL_FACE_                   0x0B44
#define GL_ARRAY_BUFFER_                0x8892
#define GL_ELEMENT_ARRAY_BUFFER_        0x8893

/* Pixel store constants */
#define GL_UNPACK_ALIGNMENT_            0x0CF5
#define GL_UNPACK_ROW_LENGTH_           0x0CF2
#define GL_UNPACK_SKIP_ROWS_            0x0CF3
#define GL_UNPACK_SKIP_PIXELS_          0x0CF4
#define GL_PACK_ALIGNMENT_              0x0D05
#define GL_PACK_ROW_LENGTH_             0x0D02
#define GL_PACK_SKIP_ROWS_              0x0D04
#define GL_PACK_SKIP_PIXELS_            0x0D03

/* Shader constants */
#define GL_FRAGMENT_SHADER_             0x8B30
#define GL_VERTEX_SHADER_               0x8B31
#define GL_COMPILE_STATUS_              0x8B81
#define GL_LINK_STATUS_                 0x8B82

/* ── GL function pointers (resolved via glXGetProcAddress) ───────────────
 * Types come from GL/glext.h (included via GL/gl.h). We just declare the
 * static pointers — the typedefs are already defined by the system headers.
 */

static PFNGLBINDFRAMEBUFFERPROC       pfn_glBindFramebuffer;
static PFNGLUSEPROGRAMPROC            pfn_glUseProgram;
static PFNGLBINDVERTEXARRAYPROC       pfn_glBindVertexArray;
static PFNGLBINDBUFFERPROC            pfn_glBindBuffer;
static PFNGLACTIVETEXTUREPROC         pfn_glActiveTexture;
static PFNGLCREATESHADERPROC          pfn_glCreateShader;
static PFNGLSHADERSOURCEPROC          pfn_glShaderSource;
static PFNGLCOMPILESHADERPROC         pfn_glCompileShader;
static PFNGLGETSHADERIVPROC           pfn_glGetShaderiv;
static PFNGLGETSHADERINFOLOGPROC      pfn_glGetShaderInfoLog;
static PFNGLCREATEPROGRAMPROC         pfn_glCreateProgram;
static PFNGLATTACHSHADERPROC          pfn_glAttachShader;
static PFNGLLINKPROGRAMPROC           pfn_glLinkProgram;
static PFNGLGETPROGRAMIVPROC          pfn_glGetProgramiv;
static PFNGLDELETESHADERPROC          pfn_glDeleteShader;
static PFNGLGETUNIFORMLOCATIONPROC    pfn_glGetUniformLocation;
static PFNGLUNIFORM1IPROC            pfn_glUniform1i;
static PFNGLGENVERTEXARRAYSPROC       pfn_glGenVertexArrays;
static PFNGLGENBUFFERSPROC            pfn_glGenBuffers;
static PFNGLBUFFERDATAPROC            pfn_glBufferData;
static PFNGLVERTEXATTRIBPOINTERPROC   pfn_glVertexAttribPointer;
static PFNGLENABLEVERTEXATTRIBARRAYPROC pfn_glEnableVertexAttribArray;

/* ── State ───────────────────────────────────────────────────────────────── */

static void (*real_glXSwapBuffers)(Display *, GLXDrawable) = NULL;
static int initialized = 0;

/* Shared memory */
static rjit_shm_header_t *shm = NULL;
static size_t shm_size = 0;
static int shm_fd = -1;

/* GL overlay resources */
static GLuint overlay_tex = 0;
static GLuint overlay_program = 0;
static GLuint overlay_vao = 0;
static GLuint overlay_vbo = 0;
static uint32_t last_seq = 0;
static uint32_t tex_width = 0;
static uint32_t tex_height = 0;

/* GL state save buffers (from videos.lua lines 328-344) */
static GLint saved_fbo, saved_program, saved_vao, saved_vbo, saved_ebo;
static GLint saved_active_tex, saved_tex2d;
static GLint saved_viewport[4], saved_scissor[4];
static GLint saved_blend_src, saved_blend_dst;
static GLint saved_blend_on, saved_scissor_on, saved_depth_on;
static GLint saved_stencil_on, saved_cull_on;
/* Pixel store */
static GLint saved_unpack_align, saved_unpack_row, saved_unpack_skip_r, saved_unpack_skip_p;
static GLint saved_pack_align, saved_pack_row, saved_pack_skip_r, saved_pack_skip_p;

/* ── Resolve GL extension functions ──────────────────────────────────────── */

static void resolve_gl_funcs(void) {
    #define RESOLVE(name) pfn_##name = (typeof(pfn_##name))glXGetProcAddress((const GLubyte *)#name)
    RESOLVE(glBindFramebuffer);
    RESOLVE(glUseProgram);
    RESOLVE(glBindVertexArray);
    RESOLVE(glBindBuffer);
    RESOLVE(glActiveTexture);
    RESOLVE(glCreateShader);
    RESOLVE(glShaderSource);
    RESOLVE(glCompileShader);
    RESOLVE(glGetShaderiv);
    RESOLVE(glGetShaderInfoLog);
    RESOLVE(glCreateProgram);
    RESOLVE(glAttachShader);
    RESOLVE(glLinkProgram);
    RESOLVE(glGetProgramiv);
    RESOLVE(glDeleteShader);
    RESOLVE(glGetUniformLocation);
    RESOLVE(glUniform1i);
    RESOLVE(glGenVertexArrays);
    RESOLVE(glGenBuffers);
    RESOLVE(glBufferData);
    RESOLVE(glVertexAttribPointer);
    RESOLVE(glEnableVertexAttribArray);
    #undef RESOLVE
}

/* ── GL state save/restore (videos.lua lines 524-561, C translation) ───── */

static void save_gl_state(void) {
    glGetIntegerv(GL_FRAMEBUFFER_BINDING_, &saved_fbo);
    glGetIntegerv(GL_CURRENT_PROGRAM_, &saved_program);
    glGetIntegerv(GL_VERTEX_ARRAY_BINDING_, &saved_vao);
    glGetIntegerv(GL_ARRAY_BUFFER_BINDING_, &saved_vbo);
    glGetIntegerv(GL_ELEMENT_ARRAY_BUFFER_BINDING_, &saved_ebo);
    glGetIntegerv(GL_ACTIVE_TEXTURE_, &saved_active_tex);
    glGetIntegerv(GL_TEXTURE_BINDING_2D_, &saved_tex2d);
    glGetIntegerv(GL_VIEWPORT_, saved_viewport);
    glGetIntegerv(GL_SCISSOR_BOX_, saved_scissor);
    glGetIntegerv(GL_BLEND_SRC_, &saved_blend_src);
    glGetIntegerv(GL_BLEND_DST_, &saved_blend_dst);
    glGetIntegerv(GL_BLEND_, &saved_blend_on);
    glGetIntegerv(GL_SCISSOR_TEST_, &saved_scissor_on);
    glGetIntegerv(GL_DEPTH_TEST_, &saved_depth_on);
    glGetIntegerv(GL_STENCIL_TEST_, &saved_stencil_on);
    glGetIntegerv(GL_CULL_FACE_, &saved_cull_on);
    /* Pixel store */
    glGetIntegerv(GL_UNPACK_ALIGNMENT_, &saved_unpack_align);
    glGetIntegerv(GL_UNPACK_ROW_LENGTH_, &saved_unpack_row);
    glGetIntegerv(GL_UNPACK_SKIP_ROWS_, &saved_unpack_skip_r);
    glGetIntegerv(GL_UNPACK_SKIP_PIXELS_, &saved_unpack_skip_p);
    glGetIntegerv(GL_PACK_ALIGNMENT_, &saved_pack_align);
    glGetIntegerv(GL_PACK_ROW_LENGTH_, &saved_pack_row);
    glGetIntegerv(GL_PACK_SKIP_ROWS_, &saved_pack_skip_r);
    glGetIntegerv(GL_PACK_SKIP_PIXELS_, &saved_pack_skip_p);
}

static void restore_gl_state(void) {
    pfn_glBindFramebuffer(GL_FRAMEBUFFER_, saved_fbo);
    pfn_glUseProgram(saved_program);
    pfn_glBindVertexArray(saved_vao);
    pfn_glBindBuffer(GL_ARRAY_BUFFER_, saved_vbo);
    pfn_glBindBuffer(GL_ELEMENT_ARRAY_BUFFER_, saved_ebo);
    pfn_glActiveTexture(saved_active_tex);
    glBindTexture(GL_TEXTURE_2D, saved_tex2d);
    glViewport(saved_viewport[0], saved_viewport[1], saved_viewport[2], saved_viewport[3]);
    glScissor(saved_scissor[0], saved_scissor[1], saved_scissor[2], saved_scissor[3]);
    glBlendFunc(saved_blend_src, saved_blend_dst);
    if (saved_blend_on)   glEnable(GL_BLEND_);   else glDisable(GL_BLEND_);
    if (saved_scissor_on) glEnable(GL_SCISSOR_TEST_); else glDisable(GL_SCISSOR_TEST_);
    if (saved_depth_on)   glEnable(GL_DEPTH_TEST_);   else glDisable(GL_DEPTH_TEST_);
    if (saved_stencil_on) glEnable(GL_STENCIL_TEST_); else glDisable(GL_STENCIL_TEST_);
    if (saved_cull_on)    glEnable(GL_CULL_FACE_);    else glDisable(GL_CULL_FACE_);
    /* Pixel store */
    glPixelStorei(GL_UNPACK_ALIGNMENT_, saved_unpack_align);
    glPixelStorei(GL_UNPACK_ROW_LENGTH_, saved_unpack_row);
    glPixelStorei(GL_UNPACK_SKIP_ROWS_, saved_unpack_skip_r);
    glPixelStorei(GL_UNPACK_SKIP_PIXELS_, saved_unpack_skip_p);
    glPixelStorei(GL_PACK_ALIGNMENT_, saved_pack_align);
    glPixelStorei(GL_PACK_ROW_LENGTH_, saved_pack_row);
    glPixelStorei(GL_PACK_SKIP_ROWS_, saved_pack_skip_r);
    glPixelStorei(GL_PACK_SKIP_PIXELS_, saved_pack_skip_p);
}

/* ── Shader compilation ──────────────────────────────────────────────────── */

static const char *vert_src =
    "#version 330 core\n"
    "layout(location = 0) in vec2 aPos;\n"
    "layout(location = 1) in vec2 aUV;\n"
    "out vec2 vUV;\n"
    "void main() {\n"
    "    gl_Position = vec4(aPos, 0.0, 1.0);\n"
    "    vUV = aUV;\n"
    "}\n";

static const char *frag_src =
    "#version 330 core\n"
    "in vec2 vUV;\n"
    "out vec4 FragColor;\n"
    "uniform sampler2D uOverlay;\n"
    "void main() {\n"
    "    FragColor = texture(uOverlay, vUV);\n"
    "}\n";

static GLuint compile_shader(GLenum type, const char *src) {
    GLuint s = pfn_glCreateShader(type);
    pfn_glShaderSource(s, 1, &src, NULL);
    pfn_glCompileShader(s);

    GLint ok;
    pfn_glGetShaderiv(s, GL_COMPILE_STATUS_, &ok);
    if (!ok) {
        char log[512];
        pfn_glGetShaderInfoLog(s, sizeof(log), NULL, log);
        fprintf(stderr, "[rjit-overlay] Shader compile error: %s\n", log);
    }
    return s;
}

static void init_shader(void) {
    GLuint vs = compile_shader(GL_VERTEX_SHADER_, vert_src);
    GLuint fs = compile_shader(GL_FRAGMENT_SHADER_, frag_src);

    overlay_program = pfn_glCreateProgram();
    pfn_glAttachShader(overlay_program, vs);
    pfn_glAttachShader(overlay_program, fs);
    pfn_glLinkProgram(overlay_program);

    GLint ok;
    pfn_glGetProgramiv(overlay_program, GL_LINK_STATUS_, &ok);
    if (!ok) {
        fprintf(stderr, "[rjit-overlay] Shader link error\n");
    }

    pfn_glDeleteShader(vs);
    pfn_glDeleteShader(fs);

    /* Set texture uniform */
    pfn_glUseProgram(overlay_program);
    GLint loc = pfn_glGetUniformLocation(overlay_program, "uOverlay");
    pfn_glUniform1i(loc, 0);
    pfn_glUseProgram(0);
}

/* ── Fullscreen quad ─────────────────────────────────────────────────────── */

static void init_quad(void) {
    /* Fullscreen triangle strip: 4 vertices (pos.xy + uv.xy) */
    /* UV is flipped vertically: shm pixel data is top-down, GL is bottom-up */
    float quad[] = {
        /* pos        uv */
        -1.f, -1.f,  0.f, 1.f,   /* bottom-left  */
         1.f, -1.f,  1.f, 1.f,   /* bottom-right */
        -1.f,  1.f,  0.f, 0.f,   /* top-left     */
         1.f,  1.f,  1.f, 0.f,   /* top-right    */
    };

    pfn_glGenVertexArrays(1, &overlay_vao);
    pfn_glGenBuffers(1, &overlay_vbo);

    pfn_glBindVertexArray(overlay_vao);
    pfn_glBindBuffer(GL_ARRAY_BUFFER_, overlay_vbo);
    pfn_glBufferData(GL_ARRAY_BUFFER_, sizeof(quad), quad, GL_STATIC_DRAW);

    /* aPos = location 0, 2 floats */
    pfn_glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void *)0);
    pfn_glEnableVertexAttribArray(0);
    /* aUV = location 1, 2 floats */
    pfn_glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void *)(2 * sizeof(float)));
    pfn_glEnableVertexAttribArray(1);

    pfn_glBindVertexArray(0);
    pfn_glBindBuffer(GL_ARRAY_BUFFER_, 0);
}

/* ── Shared memory discovery ─────────────────────────────────────────────── */

static int attach_shm(void) {
    const char *name = getenv("RJIT_OVERLAY_SHM");
    if (!name) {
        /* Scan /dev/shm for rjit-overlay-* */
        DIR *d = opendir("/dev/shm");
        if (!d) return 0;
        static char found[256];
        struct dirent *e;
        while ((e = readdir(d))) {
            if (strncmp(e->d_name, "rjit-overlay-", 13) == 0) {
                snprintf(found, sizeof(found), "/%s", e->d_name);
                name = found;
                break;
            }
        }
        closedir(d);
    }

    if (!name) {
        fprintf(stderr, "[rjit-overlay] No shm segment found\n");
        return 0;
    }

    shm_fd = shm_open(name, O_RDONLY, 0);
    if (shm_fd < 0) {
        fprintf(stderr, "[rjit-overlay] shm_open(%s) failed\n", name);
        return 0;
    }

    /* Map just the header first to read dimensions */
    rjit_shm_header_t *hdr = mmap(NULL, SHM_HEADER_SIZE, PROT_READ, MAP_SHARED, shm_fd, 0);
    if (hdr == MAP_FAILED) {
        fprintf(stderr, "[rjit-overlay] mmap header failed\n");
        close(shm_fd);
        shm_fd = -1;
        return 0;
    }

    if (hdr->magic != RJIT_MAGIC) {
        fprintf(stderr, "[rjit-overlay] Bad magic: 0x%08X\n", hdr->magic);
        munmap(hdr, SHM_HEADER_SIZE);
        close(shm_fd);
        shm_fd = -1;
        return 0;
    }

    uint32_t w = hdr->width;
    uint32_t h = hdr->height;
    munmap(hdr, SHM_HEADER_SIZE);

    /* Remap the full segment (header + pixels) */
    shm_size = SHM_HEADER_SIZE + (size_t)w * h * 4;
    shm = mmap(NULL, shm_size, PROT_READ, MAP_SHARED, shm_fd, 0);
    if (shm == MAP_FAILED) {
        fprintf(stderr, "[rjit-overlay] mmap full segment failed (%u x %u)\n", w, h);
        shm = NULL;
        close(shm_fd);
        shm_fd = -1;
        return 0;
    }

    fprintf(stderr, "[rjit-overlay] Attached to %s (%u x %u)\n", name, w, h);
    return 1;
}

/* ── Texture setup ───────────────────────────────────────────────────────── */

static void init_texture(uint32_t w, uint32_t h) {
    glGenTextures(1, &overlay_tex);
    glBindTexture(GL_TEXTURE_2D, overlay_tex);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    glBindTexture(GL_TEXTURE_2D, 0);

    tex_width = w;
    tex_height = h;
}

/* ── Init (called once on first swap) ────────────────────────────────────── */

static void init_overlay(void) {
    initialized = 1;

    resolve_gl_funcs();

    if (!attach_shm()) return;

    /* Save/restore GL state around our init to not corrupt the game */
    save_gl_state();

    init_texture(shm->width, shm->height);
    init_shader();
    init_quad();

    restore_gl_state();

    fprintf(stderr, "[rjit-overlay] Initialized — ready to composite\n");
}

/* ── The hook ────────────────────────────────────────────────────────────── */

void glXSwapBuffers(Display *dpy, GLXDrawable drawable) {
    if (!real_glXSwapBuffers) {
        real_glXSwapBuffers = dlsym(RTLD_NEXT, "glXSwapBuffers");
    }

    if (!initialized) {
        init_overlay();
    }

    /* Composite overlay if shm is attached and visible */
    if (shm && shm->magic == RJIT_MAGIC && (shm->flags & FLAG_VISIBLE)) {
        /* Check for dimension changes (overlay resized) */
        if (shm->width != tex_width || shm->height != tex_height) {
            if (overlay_tex) {
                glDeleteTextures(1, &overlay_tex);
                overlay_tex = 0;
            }
            save_gl_state();
            init_texture(shm->width, shm->height);
            restore_gl_state();
            last_seq = 0;  /* Force texture re-upload */
        }

        /* Upload new frame if sequence changed */
        if (shm->frame_seq != last_seq && overlay_tex) {
            const uint8_t *pixels = (const uint8_t *)shm + SHM_HEADER_SIZE;

            save_gl_state();

            glBindTexture(GL_TEXTURE_2D, overlay_tex);
            glPixelStorei(GL_UNPACK_ALIGNMENT_, 4);
            glPixelStorei(GL_UNPACK_ROW_LENGTH_, 0);
            glPixelStorei(GL_UNPACK_SKIP_ROWS_, 0);
            glPixelStorei(GL_UNPACK_SKIP_PIXELS_, 0);
            glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0,
                            shm->width, shm->height,
                            GL_RGBA, GL_UNSIGNED_BYTE, pixels);

            restore_gl_state();

            last_seq = shm->frame_seq;
        }

        /* Draw the overlay quad */
        if (overlay_tex && overlay_program && overlay_vao) {
            save_gl_state();

            pfn_glBindFramebuffer(GL_FRAMEBUFFER_, 0);
            pfn_glUseProgram(overlay_program);

            glEnable(GL_BLEND_);
            glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
            glDisable(GL_DEPTH_TEST_);
            glDisable(GL_SCISSOR_TEST_);
            glDisable(GL_STENCIL_TEST_);
            glDisable(GL_CULL_FACE_);

            /* Use the game's current viewport (fullscreen) */
            /* We don't change viewport — the quad covers -1..1 NDC = full screen */

            pfn_glActiveTexture(GL_TEXTURE0_);
            glBindTexture(GL_TEXTURE_2D, overlay_tex);
            pfn_glBindVertexArray(overlay_vao);
            glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);

            restore_gl_state();
        }
    }

    /* Call the real swap */
    real_glXSwapBuffers(dpy, drawable);
}
