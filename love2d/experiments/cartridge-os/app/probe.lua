--[[
  probe.lua — layer-by-layer GPU stack diagnostic
  Tests: DRM fd → GBM device → EGL display → SDL_Init
  Each step prints before/after so the crash point is obvious in the log.
]]

local ffi = require("ffi")
io.write("[probe] start\n"); io.flush()

-- ── Step 1: Open DRM device directly ──────────────────────────────────────

ffi.cdef[[
  int open(const char *path, int flags);
  int close(int fd);
  int ioctl(int fd, unsigned long request, ...);
  char *strerror(int errnum);
  int *__errno_location(void);
]]

local O_RDWR = 2

io.write("[probe] step 1: open /dev/dri/card0...\n"); io.flush()
local fd = ffi.C.open("/dev/dri/card0", O_RDWR)
if fd < 0 then
  local e = ffi.C.__errno_location()[0]
  io.write("[probe] FAIL: open: " .. ffi.string(ffi.C.strerror(e)) .. "\n"); io.flush()
  os.exit(1)
end
io.write("[probe] step 1: OK (fd=" .. fd .. ")\n"); io.flush()

-- ── Step 2: Load libgbm and create GBM device ────────────────────────────

ffi.cdef[[
  typedef struct gbm_device gbm_device;
  gbm_device *gbm_create_device(int fd);
  void gbm_device_destroy(gbm_device *dev);
  const char *gbm_device_get_backend_name(gbm_device *dev);
]]

io.write("[probe] step 2: loading libgbm.so.1...\n"); io.flush()
local ok_gbm, gbm = pcall(ffi.load, "libgbm.so.1")
if not ok_gbm then
  io.write("[probe] FAIL: cannot load libgbm: " .. tostring(gbm) .. "\n"); io.flush()
  os.exit(1)
end
io.write("[probe] step 2: libgbm loaded\n"); io.flush()

io.write("[probe] step 2: gbm_create_device(fd=" .. fd .. ")...\n"); io.flush()
local gbm_dev = gbm.gbm_create_device(fd)
if gbm_dev == nil then
  io.write("[probe] FAIL: gbm_create_device returned NULL\n"); io.flush()
  os.exit(1)
end
io.write("[probe] step 2: GBM device created\n"); io.flush()

local backend = gbm.gbm_device_get_backend_name(gbm_dev)
if backend ~= nil then
  io.write("[probe] step 2: GBM backend: " .. ffi.string(backend) .. "\n"); io.flush()
end

-- ── Step 3: Load libEGL and get display ───────────────────────────────────

ffi.cdef[[
  typedef void *EGLDisplay;
  typedef void *EGLNativeDisplayType;
  typedef int EGLint;
  typedef unsigned int EGLBoolean;

  EGLDisplay eglGetDisplay(EGLNativeDisplayType native);
  EGLDisplay eglGetPlatformDisplay(unsigned int platform, void *native, const int *attribs);
  EGLBoolean eglInitialize(EGLDisplay dpy, EGLint *major, EGLint *minor);
  EGLBoolean eglTerminate(EGLDisplay dpy);
  const char *eglQueryString(EGLDisplay dpy, EGLint name);
  EGLint     eglGetError(void);
]]

local EGL_PLATFORM_GBM_KHR = 0x31D7
local EGL_NO_DISPLAY = ffi.cast("EGLDisplay", nil)
local EGL_VENDOR = 0x3053
local EGL_VERSION = 0x3054

io.write("[probe] step 3: loading libEGL.so.1...\n"); io.flush()
local ok_egl, egl = pcall(ffi.load, "libEGL.so.1")
if not ok_egl then
  io.write("[probe] FAIL: cannot load libEGL: " .. tostring(egl) .. "\n"); io.flush()
  gbm.gbm_device_destroy(gbm_dev)
  os.exit(1)
end
io.write("[probe] step 3: libEGL loaded\n"); io.flush()

io.write("[probe] step 3: eglGetPlatformDisplay(GBM)...\n"); io.flush()
local dpy = egl.eglGetPlatformDisplay(EGL_PLATFORM_GBM_KHR, gbm_dev, nil)
if dpy == EGL_NO_DISPLAY then
  io.write("[probe] FAIL: eglGetPlatformDisplay returned EGL_NO_DISPLAY (error=" .. egl.eglGetError() .. ")\n"); io.flush()
  -- try eglGetDisplay as fallback
  io.write("[probe] step 3: trying eglGetDisplay...\n"); io.flush()
  dpy = egl.eglGetDisplay(ffi.cast("EGLNativeDisplayType", gbm_dev))
  if dpy == EGL_NO_DISPLAY then
    io.write("[probe] FAIL: eglGetDisplay also returned EGL_NO_DISPLAY\n"); io.flush()
    gbm.gbm_device_destroy(gbm_dev)
    os.exit(1)
  end
end
io.write("[probe] step 3: EGL display obtained\n"); io.flush()

io.write("[probe] step 3: eglInitialize...\n"); io.flush()
local major = ffi.new("EGLint[1]")
local minor = ffi.new("EGLint[1]")
local ok = egl.eglInitialize(dpy, major, minor)
if ok == 0 then
  io.write("[probe] FAIL: eglInitialize failed (error=" .. egl.eglGetError() .. ")\n"); io.flush()
  gbm.gbm_device_destroy(gbm_dev)
  os.exit(1)
end
io.write("[probe] step 3: EGL " .. major[0] .. "." .. minor[0] .. " initialized\n"); io.flush()

local vendor = egl.eglQueryString(dpy, EGL_VENDOR)
if vendor ~= nil then
  io.write("[probe] step 3: EGL vendor: " .. ffi.string(vendor) .. "\n"); io.flush()
end
local version = egl.eglQueryString(dpy, EGL_VERSION)
if version ~= nil then
  io.write("[probe] step 3: EGL version: " .. ffi.string(version) .. "\n"); io.flush()
end

egl.eglTerminate(dpy)
io.write("[probe] step 3: EGL terminated OK\n"); io.flush()

-- ── Step 3b: Check connector modes via DRM ioctl ─────────────────────────
-- If the connector has 0 modes, SDL2's kmsdrm backend may NULL-deref

ffi.cdef[[
  typedef struct {
    unsigned int connector_id;
    unsigned int encoder_id;
    unsigned int connector_type;
    unsigned int connector_type_id;
    unsigned int connection;
    unsigned int mm_width, mm_height;
    unsigned int subpixel;
    int count_modes;
    unsigned long long modes_ptr;
    int count_props;
    unsigned long long props_ptr, prop_values_ptr;
    int count_encoders;
    unsigned long long encoders_ptr;
  } drm_mode_get_connector;
]]

-- Reopen DRM for connector check
local fd2 = ffi.C.open("/dev/dri/card0", O_RDWR)
if fd2 >= 0 then
  io.write("[probe] step 3b: checking connector details...\n"); io.flush()

  -- First call: get counts (pass 0 for all pointers)
  local conn = ffi.new("drm_mode_get_connector")
  -- We know there's 1 connector; its ID is usually 1 but let's get resources first
  -- Use the DRM_IOCTL_MODE_GETRESOURCES to get connector IDs
  ffi.cdef[[
    struct drm_mode_card_res2 {
      unsigned long long fb_id_ptr, crtc_id_ptr, connector_id_ptr, encoder_id_ptr;
      int count_fbs, count_crtcs, count_connectors, count_encoders;
      int min_width, max_width, min_height, max_height;
    };
  ]]

  local DRM_IOCTL_MODE_GETRESOURCES = 0xC04064A0  -- _IOWR('d', 0xA0, ...)
  local res2 = ffi.new("struct drm_mode_card_res2")
  if ffi.C.ioctl(fd2, DRM_IOCTL_MODE_GETRESOURCES, res2) == 0 and res2.count_connectors > 0 then
    -- Second call with connector_id buffer
    local conn_ids = ffi.new("unsigned int[?]", res2.count_connectors)
    res2.connector_id_ptr = ffi.cast("unsigned long long", conn_ids)
    ffi.C.ioctl(fd2, DRM_IOCTL_MODE_GETRESOURCES, res2)

    for i = 0, res2.count_connectors - 1 do
      local DRM_IOCTL_MODE_GETCONNECTOR = 0xC05064A7  -- _IOWR('d', 0xA7, ...)
      local gc = ffi.new("drm_mode_get_connector")
      gc.connector_id = conn_ids[i]
      if ffi.C.ioctl(fd2, DRM_IOCTL_MODE_GETCONNECTOR, gc) == 0 then
        local status_names = {[1]="connected", [2]="disconnected", [3]="unknown"}
        local st = status_names[gc.connection] or tostring(gc.connection)
        io.write(string.format("  connector %d: type=%d status=%s modes=%d encoders=%d size=%dx%dmm\n",
          gc.connector_id, gc.connector_type, st, gc.count_modes, gc.count_encoders,
          gc.mm_width, gc.mm_height)); io.flush()
      end
    end
  end
  ffi.C.close(fd2)
end

-- ── Step 4: Test drmModeSetCrtc with a dumb buffer ────────────────────────
-- This tests the exact operation that SDL2's KMSDRM backend does on first
-- swap, without going through SDL2.

ffi.cdef[[
  /* libdrm */
  typedef struct _drmModeRes {
    int count_fbs;       unsigned int *fbs;
    int count_crtcs;     unsigned int *crtcs;
    int count_connectors;unsigned int *connectors;
    int count_encoders;  unsigned int *encoders;
    unsigned int min_width, max_width, min_height, max_height;
  } drmModeRes;

  typedef struct _drmModeModeInfo {
    unsigned int clock;
    unsigned short hdisplay, hsync_start, hsync_end, htotal, hskew;
    unsigned short vdisplay, vsync_start, vsync_end, vtotal, vscan;
    unsigned int vrefresh;
    unsigned int flags;
    unsigned int type;
    char name[32];
  } drmModeModeInfo;

  typedef struct _drmModeConnector {
    unsigned int connector_id;
    unsigned int encoder_id;
    unsigned int connector_type;
    unsigned int connector_type_id;
    unsigned int connection;
    unsigned int mmWidth, mmHeight;
    unsigned int subpixel;
    int count_modes;
    drmModeModeInfo *modes;
    int count_props;
    unsigned int *props;
    unsigned long long *prop_values;
    int count_encoders;
    unsigned int *encoders;
  } drmModeConnector;

  typedef struct _drmModeEncoder {
    unsigned int encoder_id;
    unsigned int encoder_type;
    unsigned int crtc_id;
    unsigned int possible_crtcs;
    unsigned int possible_clones;
  } drmModeEncoder;

  typedef struct _drmModeCrtc {
    unsigned int crtc_id;
    unsigned int buffer_id;
    unsigned int x, y;
    unsigned int width, height;
    int mode_valid;
    drmModeModeInfo mode;
    int gamma_size;
  } drmModeCrtc;

  typedef struct {
    unsigned int handle;
    unsigned int pitch;
    unsigned long long size;
  } drm_create_dumb;

  typedef struct {
    unsigned int handle;
    unsigned int pad;
    unsigned long long offset;
  } drm_map_dumb;

  drmModeRes       *drmModeGetResources(int fd);
  void              drmModeFreeResources(drmModeRes *ptr);
  drmModeConnector *drmModeGetConnector(int fd, unsigned int connectorId);
  void              drmModeFreeConnector(drmModeConnector *ptr);
  drmModeEncoder   *drmModeGetEncoder(int fd, unsigned int encoderId);
  void              drmModeFreeEncoder(drmModeEncoder *ptr);
  drmModeCrtc      *drmModeGetCrtc(int fd, unsigned int crtcId);
  void              drmModeFreeCrtc(drmModeCrtc *ptr);

  int drmModeSetCrtc(int fd, unsigned int crtcId, unsigned int bufferId,
                     unsigned int x, unsigned int y,
                     unsigned int *connectors, int count,
                     drmModeModeInfo *mode);
  int drmModeAddFB(int fd, unsigned int width, unsigned int height,
                   unsigned char depth, unsigned char bpp, unsigned int pitch,
                   unsigned int bo_handle, unsigned int *buf_id);
  int drmModeRmFB(int fd, unsigned int bufferId);
  int drmModePageFlip(int fd, unsigned int crtc_id, unsigned int fb_id,
                      unsigned int flags, void *user_data);
  int drmSetMaster(int fd);
  int drmDropMaster(int fd);
]]

io.write("\n[probe] step 4: direct DRM modeset test\n"); io.flush()

local ok_drm, drm = pcall(ffi.load, "libdrm.so.2")
if not ok_drm then
  io.write("[probe] FAIL: cannot load libdrm: " .. tostring(drm) .. "\n"); io.flush()
  gbm.gbm_device_destroy(gbm_dev)
  ffi.C.close(fd)
  os.exit(1)
end

-- Use the existing fd from step 1

-- Set DRM master
io.write("[probe] step 4: drmSetMaster...\n"); io.flush()
local mret = drm.drmSetMaster(fd)
io.write("[probe] step 4: drmSetMaster returned " .. mret .. "\n"); io.flush()

-- Get resources
io.write("[probe] step 4: drmModeGetResources...\n"); io.flush()
local res = drm.drmModeGetResources(fd)
if res == nil then
  io.write("[probe] FAIL: drmModeGetResources returned NULL\n"); io.flush()
  gbm.gbm_device_destroy(gbm_dev); ffi.C.close(fd); os.exit(1)
end
io.write(string.format("[probe] step 4: crtcs=%d connectors=%d encoders=%d\n",
  res.count_crtcs, res.count_connectors, res.count_encoders)); io.flush()

-- Find connected connector
local conn = nil
local conn_id = 0
for i = 0, res.count_connectors - 1 do
  local c = drm.drmModeGetConnector(fd, res.connectors[i])
  if c ~= nil then
    io.write(string.format("[probe] connector %d: type=%d connection=%d modes=%d\n",
      c.connector_id, c.connector_type, c.connection, c.count_modes)); io.flush()
    if c.connection == 1 and c.count_modes > 0 then
      conn = c
      conn_id = c.connector_id
      -- Print first few modes
      for m = 0, math.min(c.count_modes - 1, 4) do
        local mode = c.modes[m]
        io.write(string.format("  mode[%d]: %dx%d @%dHz type=0x%x flags=0x%x name=%s\n",
          m, mode.hdisplay, mode.vdisplay, mode.vrefresh,
          mode.type, mode.flags, ffi.string(mode.name))); io.flush()
      end
    else
      drm.drmModeFreeConnector(c)
    end
  end
end

if conn == nil then
  io.write("[probe] FAIL: no connected connector with modes\n"); io.flush()
  drm.drmModeFreeResources(res)
  gbm.gbm_device_destroy(gbm_dev); ffi.C.close(fd); os.exit(1)
end

-- Get encoder + CRTC
local enc = drm.drmModeGetEncoder(fd, conn.encoder_id)
local crtc_id = 0
if enc ~= nil then
  crtc_id = enc.crtc_id
  io.write(string.format("[probe] encoder %d: crtc_id=%d\n", enc.encoder_id, crtc_id)); io.flush()
  drm.drmModeFreeEncoder(enc)
else
  crtc_id = res.crtcs[0]
  io.write("[probe] no encoder, using first CRTC: " .. crtc_id .. "\n"); io.flush()
end

-- Get current CRTC state
local crtc = drm.drmModeGetCrtc(fd, crtc_id)
if crtc ~= nil then
  io.write(string.format("[probe] CRTC %d: mode_valid=%d %dx%d buffer_id=%d\n",
    crtc.crtc_id, crtc.mode_valid,
    crtc.width, crtc.height, crtc.buffer_id)); io.flush()
  drm.drmModeFreeCrtc(crtc)
end

-- Use preferred mode (first mode)
local mode = conn.modes[0]
local w, h = mode.hdisplay, mode.vdisplay
io.write(string.format("[probe] using mode: %dx%d @%dHz\n", w, h, mode.vrefresh)); io.flush()

-- Create dumb buffer
io.write("[probe] step 4: creating dumb buffer...\n"); io.flush()

local DRM_IOCTL_MODE_CREATE_DUMB = 0xC02064B2  -- _IOWR('d', 0xB2, ...)
local create = ffi.new("drm_create_dumb")
create.handle = 0
create.pitch = 0
create.size = 0
-- Need to pack width/height/bpp into the ioctl struct
-- drm_mode_create_dumb: __u32 height, width, bpp, flags; __u32 handle, pitch; __u64 size
ffi.cdef[[
  typedef struct {
    unsigned int height, width, bpp, flags;
    unsigned int handle, pitch;
    unsigned long long size;
  } drm_mode_create_dumb2;
]]
local cd = ffi.new("drm_mode_create_dumb2")
cd.height = h
cd.width = w
cd.bpp = 32
cd.flags = 0
local r = ffi.C.ioctl(fd, DRM_IOCTL_MODE_CREATE_DUMB, cd)
io.write(string.format("[probe] create_dumb: ret=%d handle=%d pitch=%d size=%d\n",
  r, cd.handle, cd.pitch, tonumber(cd.size))); io.flush()

if r ~= 0 then
  io.write("[probe] FAIL: cannot create dumb buffer\n"); io.flush()
  drm.drmModeFreeConnector(conn)
  drm.drmModeFreeResources(res)
  gbm.gbm_device_destroy(gbm_dev); ffi.C.close(fd); os.exit(1)
end

-- Add framebuffer
local fb_id = ffi.new("unsigned int[1]")
io.write("[probe] step 4: drmModeAddFB...\n"); io.flush()
r = drm.drmModeAddFB(fd, w, h, 24, 32, cd.pitch, cd.handle, fb_id)
io.write(string.format("[probe] drmModeAddFB: ret=%d fb_id=%d\n", r, fb_id[0])); io.flush()

if r ~= 0 then
  io.write("[probe] FAIL: drmModeAddFB failed\n"); io.flush()
else
  -- Try SetCrtc
  local conn_arr = ffi.new("unsigned int[1]", conn_id)
  io.write("[probe] step 4: drmModeSetCrtc...\n"); io.flush()
  r = drm.drmModeSetCrtc(fd, crtc_id, fb_id[0], 0, 0, conn_arr, 1, conn.modes)
  io.write(string.format("[probe] drmModeSetCrtc: ret=%d\n", r)); io.flush()

  if r == 0 then
    io.write("[probe] MODESET SUCCESS! Display should show a blank frame.\n"); io.flush()

    -- Try pageflip
    io.write("[probe] step 4: drmModePageFlip...\n"); io.flush()
    r = drm.drmModePageFlip(fd, crtc_id, fb_id[0], 0, nil)
    io.write(string.format("[probe] drmModePageFlip: ret=%d\n", r)); io.flush()
  end

  drm.drmModeRmFB(fd, fb_id[0])
end

-- ── Step 5: GBM BO → drmModeAddFB → drmModeSetCrtc ─────────────────────
-- This replicates what SDL2's KMSDRM backend does: creates a GBM surface,
-- locks a BO from it, and tries to scanout that BO.

ffi.cdef[[
  typedef struct gbm_surface gbm_surface;
  typedef struct gbm_bo gbm_bo;

  gbm_surface *gbm_surface_create(gbm_device *dev,
    unsigned int width, unsigned int height,
    unsigned int format, unsigned int flags);
  void gbm_surface_destroy(gbm_surface *surface);

  gbm_bo *gbm_bo_create(gbm_device *dev,
    unsigned int width, unsigned int height,
    unsigned int format, unsigned int flags);
  void gbm_bo_destroy(gbm_bo *bo);

  unsigned int gbm_bo_get_handle(gbm_bo *bo);
  unsigned int gbm_bo_get_stride(gbm_bo *bo);
  unsigned int gbm_bo_get_width(gbm_bo *bo);
  unsigned int gbm_bo_get_height(gbm_bo *bo);
  unsigned int gbm_bo_get_format(gbm_bo *bo);

  int drmModeAddFB2(int fd, unsigned int width, unsigned int height,
                    unsigned int pixel_format,
                    unsigned int *bo_handles, unsigned int *pitches,
                    unsigned int *offsets, unsigned int *buf_id,
                    unsigned int flags);
]]

local GBM_FORMAT_XRGB8888 = 0x34325258
local GBM_FORMAT_ARGB8888 = 0x34325241
local GBM_BO_USE_SCANOUT   = 0x0001
local GBM_BO_USE_RENDERING = 0x0004

io.write("\n[probe] step 5: GBM BO scanout test\n"); io.flush()

-- Test both formats
for _, fmt_info in ipairs({
  {fmt = GBM_FORMAT_XRGB8888, name = "XRGB8888"},
  {fmt = GBM_FORMAT_ARGB8888, name = "ARGB8888"},
}) do
  io.write(string.format("[probe] step 5: gbm_bo_create %dx%d %s SCANOUT|RENDERING...\n",
    w, h, fmt_info.name)); io.flush()

  local bo = gbm.gbm_bo_create(gbm_dev, w, h, fmt_info.fmt,
    GBM_BO_USE_SCANOUT + GBM_BO_USE_RENDERING)

  if bo == nil then
    io.write("[probe] step 5: gbm_bo_create FAILED for " .. fmt_info.name .. "\n"); io.flush()

    -- Try SCANOUT only
    io.write("[probe] step 5: retrying with SCANOUT only...\n"); io.flush()
    bo = gbm.gbm_bo_create(gbm_dev, w, h, fmt_info.fmt, GBM_BO_USE_SCANOUT)
    if bo == nil then
      io.write("[probe] step 5: gbm_bo_create SCANOUT-only also FAILED for " .. fmt_info.name .. "\n"); io.flush()
    end
  end

  if bo ~= nil then
    local bo_handle = gbm.gbm_bo_get_handle(bo)
    local bo_stride = gbm.gbm_bo_get_stride(bo)
    local bo_fmt    = gbm.gbm_bo_get_format(bo)
    io.write(string.format("[probe] step 5: BO created: handle=%d stride=%d format=0x%08x\n",
      bo_handle, bo_stride, bo_fmt)); io.flush()

    -- Try drmModeAddFB (legacy — depth/bpp)
    local fb5 = ffi.new("unsigned int[1]")
    r = drm.drmModeAddFB(fd, w, h, 24, 32, bo_stride, bo_handle, fb5)
    io.write(string.format("[probe] step 5: drmModeAddFB(%s): ret=%d fb_id=%d\n",
      fmt_info.name, r, fb5[0])); io.flush()

    if r == 0 then
      -- Try SetCrtc with the GBM BO framebuffer
      local conn_arr5 = ffi.new("unsigned int[1]", conn_id)
      r = drm.drmModeSetCrtc(fd, crtc_id, fb5[0], 0, 0, conn_arr5, 1, conn.modes)
      io.write(string.format("[probe] step 5: drmModeSetCrtc(%s GBM BO): ret=%d\n",
        fmt_info.name, r)); io.flush()

      if r == 0 then
        io.write("[probe] step 5: GBM BO MODESET SUCCESS with " .. fmt_info.name .. "!\n"); io.flush()
      else
        local e = ffi.C.__errno_location()[0]
        io.write(string.format("[probe] step 5: GBM BO MODESET FAILED (%s): errno=%d (%s)\n",
          fmt_info.name, e, ffi.string(ffi.C.strerror(e)))); io.flush()
      end

      drm.drmModeRmFB(fd, fb5[0])
    else
      local e = ffi.C.__errno_location()[0]
      io.write(string.format("[probe] step 5: drmModeAddFB FAILED (%s): errno=%d (%s)\n",
        fmt_info.name, e, ffi.string(ffi.C.strerror(e)))); io.flush()

      -- Also try drmModeAddFB2
      local handles = ffi.new("unsigned int[4]", bo_handle, 0, 0, 0)
      local pitches = ffi.new("unsigned int[4]", bo_stride, 0, 0, 0)
      local offsets = ffi.new("unsigned int[4]", 0, 0, 0, 0)
      r = drm.drmModeAddFB2(fd, w, h, fmt_info.fmt, handles, pitches, offsets, fb5, 0)
      io.write(string.format("[probe] step 5: drmModeAddFB2(%s): ret=%d fb_id=%d\n",
        fmt_info.name, r, fb5[0])); io.flush()

      if r == 0 then
        local conn_arr5 = ffi.new("unsigned int[1]", conn_id)
        r = drm.drmModeSetCrtc(fd, crtc_id, fb5[0], 0, 0, conn_arr5, 1, conn.modes)
        io.write(string.format("[probe] step 5: drmModeSetCrtc(%s GBM BO via AddFB2): ret=%d\n",
          fmt_info.name, r)); io.flush()
        drm.drmModeRmFB(fd, fb5[0])
      end
    end

    gbm.gbm_bo_destroy(bo)
  end
end

-- ── Step 6: Full EGL render → GBM lock → scanout ───────────────────────
-- Replicate SDL2's full path: EGL context on GBM surface, render, swap, lock BO, modeset

ffi.cdef[[
  typedef void *EGLConfig;
  typedef void *EGLContext;
  typedef void *EGLSurface;
  typedef void *EGLNativeWindowType;

  EGLBoolean eglChooseConfig(EGLDisplay dpy, const EGLint *attribs,
    EGLConfig *configs, EGLint config_size, EGLint *num_config);
  EGLContext eglCreateContext(EGLDisplay dpy, EGLConfig config,
    EGLContext share, const EGLint *attribs);
  EGLSurface eglCreateWindowSurface(EGLDisplay dpy, EGLConfig config,
    EGLNativeWindowType win, const EGLint *attribs);
  EGLBoolean eglMakeCurrent(EGLDisplay dpy, EGLSurface draw,
    EGLSurface read, EGLContext ctx);
  EGLBoolean eglSwapBuffers(EGLDisplay dpy, EGLSurface surface);
  EGLBoolean eglDestroyContext(EGLDisplay dpy, EGLContext ctx);
  EGLBoolean eglDestroySurface(EGLDisplay dpy, EGLSurface surface);

  gbm_bo *gbm_surface_lock_front_buffer(gbm_surface *surface);
  void gbm_surface_release_buffer(gbm_surface *surface, gbm_bo *bo);

  void glClearColor(float r, float g, float b, float a);
  void glClear(unsigned int mask);
]]

io.write("\n[probe] step 6: full EGL render → GBM → scanout test\n"); io.flush()

-- Reinit EGL on our GBM device
local dpy6 = egl.eglGetPlatformDisplay(EGL_PLATFORM_GBM_KHR, gbm_dev, nil)
if dpy6 == EGL_NO_DISPLAY then
  dpy6 = egl.eglGetDisplay(ffi.cast("EGLNativeDisplayType", gbm_dev))
end
local maj6, min6 = ffi.new("EGLint[1]"), ffi.new("EGLint[1]")
egl.eglInitialize(dpy6, maj6, min6)
io.write("[probe] step 6: EGL initialized\n"); io.flush()

-- Choose config
local EGL_SURFACE_TYPE = 0x3033
local EGL_WINDOW_BIT   = 0x0004
local EGL_RED_SIZE     = 0x3024
local EGL_GREEN_SIZE   = 0x3023
local EGL_BLUE_SIZE    = 0x3022
local EGL_ALPHA_SIZE   = 0x3021
local EGL_RENDERABLE_TYPE = 0x3040
local EGL_OPENGL_ES2_BIT  = 0x0004
local EGL_OPENGL_BIT      = 0x0008
local EGL_NONE         = 0x3038
local EGL_CONTEXT_CLIENT_VERSION = 0x3098

local config_attribs = ffi.new("EGLint[13]",
  EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
  EGL_RED_SIZE, 8,
  EGL_GREEN_SIZE, 8,
  EGL_BLUE_SIZE, 8,
  EGL_ALPHA_SIZE, 0,  -- 0 alpha = XRGB behavior
  EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT,
  EGL_NONE)

local config6 = ffi.new("EGLConfig[1]")
local nconfig = ffi.new("EGLint[1]")
r = egl.eglChooseConfig(dpy6, config_attribs, config6, 1, nconfig)
io.write(string.format("[probe] step 6: eglChooseConfig: ret=%d nconfig=%d\n",
  r, nconfig[0])); io.flush()

if nconfig[0] > 0 then
  -- Create GBM surface
  io.write("[probe] step 6: creating GBM surface XRGB8888 SCANOUT|RENDERING...\n"); io.flush()
  local gsurface = gbm.gbm_surface_create(gbm_dev, w, h,
    GBM_FORMAT_XRGB8888, GBM_BO_USE_SCANOUT + GBM_BO_USE_RENDERING)
  if gsurface == nil then
    io.write("[probe] step 6: GBM surface creation FAILED\n"); io.flush()
  else
    io.write("[probe] step 6: GBM surface created\n"); io.flush()

    -- Create EGL surface on GBM surface
    local egl_surface = egl.eglCreateWindowSurface(dpy6, config6[0],
      ffi.cast("EGLNativeWindowType", gsurface), nil)
    io.write(string.format("[probe] step 6: eglCreateWindowSurface: %s\n",
      egl_surface ~= nil and "OK" or "FAILED (err=" .. egl.eglGetError() .. ")")); io.flush()

    if egl_surface ~= nil then
      -- Create context
      local ctx_attribs = ffi.new("EGLint[3]", EGL_CONTEXT_CLIENT_VERSION, 2, EGL_NONE)
      local ctx6 = egl.eglCreateContext(dpy6, config6[0], nil, ctx_attribs)
      io.write(string.format("[probe] step 6: eglCreateContext: %s\n",
        ctx6 ~= nil and "OK" or "FAILED")); io.flush()

      if ctx6 ~= nil then
        egl.eglMakeCurrent(dpy6, egl_surface, egl_surface, ctx6)

        -- Load GL
        local ok_gl, gles = pcall(ffi.load, "libGLESv2.so.2")
        if not ok_gl then ok_gl, gles = pcall(ffi.load, "libGL.so.1") end

        if ok_gl then
          local GL_COLOR_BUFFER_BIT = 0x00004000
          gles.glClearColor(0.2, 0.4, 0.8, 1.0)
          gles.glClear(GL_COLOR_BUFFER_BIT)
          io.write("[probe] step 6: rendered blue frame\n"); io.flush()

          -- Swap
          r = egl.eglSwapBuffers(dpy6, egl_surface)
          io.write(string.format("[probe] step 6: eglSwapBuffers: ret=%d\n", r)); io.flush()

          -- Lock front buffer
          local front_bo = gbm.gbm_surface_lock_front_buffer(gsurface)
          if front_bo == nil then
            io.write("[probe] step 6: gbm_surface_lock_front_buffer FAILED\n"); io.flush()
          else
            local fbo_handle = gbm.gbm_bo_get_handle(front_bo)
            local fbo_stride = gbm.gbm_bo_get_stride(front_bo)
            local fbo_fmt    = gbm.gbm_bo_get_format(front_bo)
            local fbo_w      = gbm.gbm_bo_get_width(front_bo)
            local fbo_h      = gbm.gbm_bo_get_height(front_bo)
            io.write(string.format("[probe] step 6: front BO: %dx%d handle=%d stride=%d format=0x%08x\n",
              fbo_w, fbo_h, fbo_handle, fbo_stride, fbo_fmt)); io.flush()

            -- Try AddFB
            local fb6 = ffi.new("unsigned int[1]")
            r = drm.drmModeAddFB(fd, fbo_w, fbo_h, 24, 32, fbo_stride, fbo_handle, fb6)
            io.write(string.format("[probe] step 6: drmModeAddFB(front BO): ret=%d fb_id=%d\n",
              r, fb6[0])); io.flush()

            if r ~= 0 then
              local e = ffi.C.__errno_location()[0]
              io.write(string.format("[probe] step 6: AddFB FAILED: errno=%d (%s)\n",
                e, ffi.string(ffi.C.strerror(e)))); io.flush()

              -- Try AddFB2
              local handles6 = ffi.new("unsigned int[4]", fbo_handle, 0, 0, 0)
              local pitches6 = ffi.new("unsigned int[4]", fbo_stride, 0, 0, 0)
              local offsets6 = ffi.new("unsigned int[4]", 0, 0, 0, 0)
              r = drm.drmModeAddFB2(fd, fbo_w, fbo_h, fbo_fmt, handles6, pitches6, offsets6, fb6, 0)
              io.write(string.format("[probe] step 6: drmModeAddFB2(front BO): ret=%d fb_id=%d\n",
                r, fb6[0])); io.flush()
            end

            if r == 0 then
              -- Try SetCrtc
              local conn_arr6 = ffi.new("unsigned int[1]", conn_id)
              r = drm.drmModeSetCrtc(fd, crtc_id, fb6[0], 0, 0, conn_arr6, 1, conn.modes)
              io.write(string.format("[probe] step 6: drmModeSetCrtc(EGL-rendered GBM BO): ret=%d\n", r)); io.flush()

              if r == 0 then
                io.write("[probe] step 6: EGL SCANOUT SUCCESS! Blue frame should be visible.\n"); io.flush()
              else
                local e = ffi.C.__errno_location()[0]
                io.write(string.format("[probe] step 6: MODESET FAILED: errno=%d (%s)\n",
                  e, ffi.string(ffi.C.strerror(e)))); io.flush()
              end

              drm.drmModeRmFB(fd, fb6[0])
            end

            gbm.gbm_surface_release_buffer(gsurface, front_bo)
          end
        end

        egl.eglDestroyContext(dpy6, ctx6)
      end
      egl.eglDestroySurface(dpy6, egl_surface)
    end
    gbm.gbm_surface_destroy(gsurface)
  end
end

egl.eglTerminate(dpy6)

-- Cleanup
drm.drmModeFreeConnector(conn)
drm.drmModeFreeResources(res)
gbm.gbm_device_destroy(gbm_dev)
ffi.C.close(fd)

io.write("\n[probe] all steps complete\n"); io.flush()
