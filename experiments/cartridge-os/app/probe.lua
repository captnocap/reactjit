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

-- ── Step 4: Clean up GBM, then try SDL_Init ──────────────────────────────

gbm.gbm_device_destroy(gbm_dev)
ffi.C.close(fd)
io.write("[probe] step 3: GBM + DRM cleaned up\n\n"); io.flush()

-- SDL FFI
ffi.cdef[[
  int           SDL_Init(unsigned int flags);
  void          SDL_Quit(void);
  const char   *SDL_GetError(void);
  int           SDL_SetHint(const char *name, const char *value);
  int           SDL_VideoInit(const char *driver_name);
  void          SDL_VideoQuit(void);
  int           SDL_GetNumVideoDrivers(void);
  const char   *SDL_GetVideoDriver(int index);
]]

io.write("[probe] step 4: loading libSDL2...\n"); io.flush()
local ok_sdl, sdl = pcall(ffi.load, "libSDL2-2.0.so.0")
if not ok_sdl then
  io.write("[probe] FAIL: cannot load libSDL2: " .. tostring(sdl) .. "\n"); io.flush()
  os.exit(1)
end
io.write("[probe] step 4: libSDL2 loaded\n"); io.flush()

local SDL_INIT_EVENTS = 0x00004000
local SDL_INIT_VIDEO  = 0x00000020

-- 4a: init events only (no video) — sanity check
io.write("[probe] step 4a: SDL_Init(SDL_INIT_EVENTS)...\n"); io.flush()
local ret = sdl.SDL_Init(SDL_INIT_EVENTS)
io.write("[probe] step 4a: returned " .. ret .. "\n"); io.flush()
if ret ~= 0 then
  io.write("[probe] SDL error: " .. ffi.string(sdl.SDL_GetError()) .. "\n"); io.flush()
end
sdl.SDL_Quit()

-- 4b: list available video drivers
io.write("[probe] step 4b: available video drivers:\n"); io.flush()
-- Re-init for driver enumeration
sdl.SDL_Init(0)
local ndrivers = sdl.SDL_GetNumVideoDrivers()
for i = 0, ndrivers - 1 do
  local name = sdl.SDL_GetVideoDriver(i)
  if name ~= nil then
    io.write("    " .. ffi.string(name) .. "\n"); io.flush()
  end
end
sdl.SDL_Quit()

-- 4c: try dummy backend
io.write("[probe] step 4c: SDL_VideoInit('dummy')...\n"); io.flush()
sdl.SDL_Init(0)
local dret = sdl.SDL_VideoInit("dummy")
io.write("[probe] step 4c: returned " .. dret .. "\n"); io.flush()
if dret ~= 0 then
  io.write("[probe] SDL error: " .. ffi.string(sdl.SDL_GetError()) .. "\n"); io.flush()
else
  io.write("[probe] step 4c: dummy video OK\n"); io.flush()
  sdl.SDL_VideoQuit()
end
sdl.SDL_Quit()

-- 4d: try kmsdrm backend (the one that crashes)
io.write("[probe] step 4d: SDL_VideoInit('KMSDRM')...\n"); io.flush()
sdl.SDL_Init(0)
local kret = sdl.SDL_VideoInit("KMSDRM")
io.write("[probe] step 4d: returned " .. kret .. "\n"); io.flush()
if kret ~= 0 then
  io.write("[probe] SDL error: " .. ffi.string(sdl.SDL_GetError()) .. "\n"); io.flush()
else
  io.write("[probe] step 4d: KMSDRM video OK!\n"); io.flush()
  sdl.SDL_VideoQuit()
end
sdl.SDL_Quit()

io.write("[probe] all steps complete\n"); io.flush()
