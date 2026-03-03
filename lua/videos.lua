--[[
  videos.lua -- Video playback via libmpv OpenGL render API

  Renders video frames directly into Love2D Canvases using mpv's OpenGL backend.
  Any format mpv supports (MP4, MKV, WebM, AVI, MOV, etc.) plays instantly
  with hardware acceleration. No FFmpeg transcoding step required.

  Key discoveries from the PoC (experiments/mpv-poc/):
    - RTLD_DEEPBIND isolates mpv's Lua 5.2 symbols from Love2D's LuaJIT
    - Private FBO pipeline: mpv → private FBO → glBlitFramebuffer → Canvas FBO
    - Full 17-variable GL state save/restore around mpv render calls
    - FLIP_Y=0 (Love2D already flips canvases when drawing)

  Requires: libmpv-dev (apt install libmpv-dev)
  Fallback: Shows error placeholder if libmpv not installed.

  Status lifecycle per src:
    nil → "loading" → "ready" | "error"
]]

local ffi = require("ffi")

local Videos = {}

-- ============================================================================
-- FFI declarations
-- ============================================================================

ffi.cdef[[
  // --- SDL2 (Love2D already has it loaded) ---
  void *SDL_GL_GetProcAddress(const char *proc);

  // --- dlopen / dlclose ---
  void *dlopen(const char *filename, int flags);
  int dlclose(void *handle);
  char *dlerror(void);

  // --- mpv client API ---
  typedef struct mpv_handle mpv_handle;
  typedef struct mpv_render_context mpv_render_context;

  mpv_handle *mpv_create(void);
  int mpv_initialize(mpv_handle *ctx);
  int mpv_set_option_string(mpv_handle *ctx, const char *name, const char *data);
  int mpv_command(mpv_handle *ctx, const char **args);
  void mpv_terminate_destroy(mpv_handle *ctx);
  const char *mpv_error_string(int error);

  int mpv_get_property(mpv_handle *ctx, const char *name, int format, void *data);
  int mpv_set_property_string(mpv_handle *ctx, const char *name, const char *data);
  char *mpv_get_property_string(mpv_handle *ctx, const char *name);
  void mpv_free(void *data);

  // --- mpv render API ---
  typedef struct mpv_render_param {
    int type;
    void *data;
  } mpv_render_param;

  typedef struct mpv_opengl_init_params {
    void *(*get_proc_address)(void *ctx, const char *name);
    void *get_proc_address_ctx;
  } mpv_opengl_init_params;

  typedef struct mpv_opengl_fbo {
    int fbo;
    int w;
    int h;
    int internal_format;
  } mpv_opengl_fbo;

  int mpv_render_context_create(mpv_render_context **res, mpv_handle *mpv, mpv_render_param *params);
  int mpv_render_context_render(mpv_render_context *ctx, mpv_render_param *params);
  uint64_t mpv_render_context_update(mpv_render_context *ctx);
  void mpv_render_context_free(mpv_render_context *ctx);
  void mpv_render_context_report_swap(mpv_render_context *ctx);

  // --- OpenGL ---
  typedef int GLint;
  typedef unsigned int GLuint;
  typedef unsigned int GLenum;
  typedef int GLsizei;
  typedef unsigned char GLboolean;

  void glGetIntegerv(GLenum pname, GLint *params);
  void glGenFramebuffers(GLsizei n, GLuint *framebuffers);
  void glDeleteFramebuffers(GLsizei n, const GLuint *framebuffers);
  void glBindFramebuffer(GLenum target, GLuint framebuffer);
  void glFramebufferTexture2D(GLenum target, GLenum attachment, GLenum textarget,
                               GLuint texture, GLint level);
  GLenum glCheckFramebufferStatus(GLenum target);
  void glGenTextures(GLsizei n, GLuint *textures);
  void glDeleteTextures(GLsizei n, const GLuint *textures);
  void glBindTexture(GLenum target, GLuint texture);
  void glTexImage2D(GLenum target, GLint level, GLint internalformat,
                     GLsizei width, GLsizei height, GLint border,
                     GLenum format, GLenum type, const void *pixels);
  void glTexParameteri(GLenum target, GLenum pname, GLint param);
  void glBlitFramebuffer(GLint srcX0, GLint srcY0, GLint srcX1, GLint srcY1,
                          GLint dstX0, GLint dstY0, GLint dstX1, GLint dstY1,
                          unsigned int mask, GLenum filter);
  void glUseProgram(GLuint program);
  void glBindVertexArray(GLuint array);
  void glBindBuffer(GLenum target, GLuint buffer);
  void glActiveTexture(GLenum texture);
  void glEnable(GLenum cap);
  void glDisable(GLenum cap);
  void glBlendFunc(GLenum sfactor, GLenum dfactor);
  void glViewport(GLint x, GLint y, GLsizei width, GLsizei height);
  void glScissor(GLint x, GLint y, GLsizei width, GLsizei height);
  void glPixelStorei(GLenum pname, GLint param);
]]

-- ============================================================================
-- GL constants
-- ============================================================================

local GL_FRAMEBUFFER          = 0x8D40
local GL_READ_FRAMEBUFFER     = 0x8CA8
local GL_DRAW_FRAMEBUFFER     = 0x8CA9
local GL_FRAMEBUFFER_BINDING  = 0x8CA6
local GL_COLOR_ATTACHMENT0    = 0x8CE0
local GL_FRAMEBUFFER_COMPLETE = 0x8CD5
local GL_TEXTURE_2D           = 0x0DE1
local GL_RGBA8                = 0x8058
local GL_RGBA                 = 0x1908
local GL_UNSIGNED_BYTE        = 0x1401
local GL_TEXTURE_MIN_FILTER   = 0x2801
local GL_TEXTURE_MAG_FILTER   = 0x2800
local GL_LINEAR               = 0x2601
local GL_COLOR_BUFFER_BIT     = 0x00004000
local GL_NEAREST              = 0x2600

-- GL state query constants
local GL_CURRENT_PROGRAM              = 0x8B8D
local GL_VERTEX_ARRAY_BINDING         = 0x85B5
local GL_ARRAY_BUFFER_BINDING         = 0x8894
local GL_ELEMENT_ARRAY_BUFFER_BINDING = 0x8895
local GL_ACTIVE_TEXTURE               = 0x84E0
local GL_TEXTURE0                     = 0x84C0
local GL_TEXTURE_BINDING_2D           = 0x8069
local GL_VIEWPORT                     = 0x0BA2
local GL_SCISSOR_BOX                  = 0x0C10
local GL_BLEND_SRC                    = 0x0BE1
local GL_BLEND_DST                    = 0x0BE0
local GL_BLEND                        = 0x0BE2
local GL_SCISSOR_TEST                 = 0x0C11
local GL_DEPTH_TEST                   = 0x0B71
local GL_STENCIL_TEST                 = 0x0B90
local GL_CULL_FACE                    = 0x0B44
local GL_ARRAY_BUFFER                 = 0x8892
local GL_ELEMENT_ARRAY_BUFFER         = 0x8893

-- Pixel store constants
local GL_UNPACK_ALIGNMENT             = 0x0CF5
local GL_UNPACK_ROW_LENGTH            = 0x0CF2
local GL_UNPACK_SKIP_ROWS             = 0x0CF3
local GL_UNPACK_SKIP_PIXELS           = 0x0CF4
local GL_PACK_ALIGNMENT               = 0x0D05
local GL_PACK_ROW_LENGTH              = 0x0D02
local GL_PACK_SKIP_ROWS               = 0x0D04
local GL_PACK_SKIP_PIXELS             = 0x0D03

-- ============================================================================
-- MPV constants
-- ============================================================================

local MPV_RENDER_PARAM_API_TYPE           = 1
local MPV_RENDER_PARAM_OPENGL_INIT_PARAMS = 2
local MPV_RENDER_PARAM_OPENGL_FBO         = 3
local MPV_RENDER_PARAM_FLIP_Y             = 4
local MPV_RENDER_UPDATE_FRAME             = 1

local MPV_FORMAT_INT64  = 4
local MPV_FORMAT_DOUBLE = 5

-- ============================================================================
-- Load libmpv (lazy — deferred until first video is requested)
-- ============================================================================

local libmpvAvailable = false
local libmpvLoadAttempted = false
local mpv = nil
local dlopen_handle = nil  -- explicit dlopen handle for dlclose support
local backendReady = false

-- Shared GL proc address callback (anchored at module level — never GC'd)
local get_proc_address_cb = nil

-- Unload debounce: seconds to wait after last video node disappears before dlclose
local UNLOAD_DEBOUNCE = 3.0
local unloadTimer = nil  -- love.timer.getTime() when last video node disappeared

--- Load libmpv on demand. Called from loadVideo() on first use.
--- Returns true if libmpv is available, false otherwise.
--- Safe to call multiple times — only attempts the dlopen once.
function Videos.loadLibrary()
  if libmpvAvailable then return true end
  if libmpvLoadAttempted then return false end
  libmpvLoadAttempted = true

  local loader = require("lua.lib_loader")
  local isLinux = ffi.os == "Linux"

  -- Platform-aware library paths:
  -- Linux: libmpv.so.2 (versioned soname)
  -- macOS: libmpv.2.dylib (Homebrew versioned) or libmpv.dylib
  local paths
  if isLinux then
    paths = { "lib/libmpv.so.2", "libmpv.so.2" }
  else
    paths = {
      "lib/libmpv.2.dylib", "lib/libmpv.dylib",
      "/opt/homebrew/lib/libmpv.dylib", "/usr/local/lib/libmpv.dylib",
      "libmpv.2.dylib",
    }
  end

  local RTLD_LAZY     = 0x00001
  -- RTLD_DEEPBIND is Linux-only (0x00008). macOS uses two-level namespaces
  -- by default, which provides equivalent symbol isolation.
  local RTLD_DEEPBIND = isLinux and 0x00008 or 0
  local lastErr
  for _, path in ipairs(paths) do
    local ok, err = pcall(function()
      dlopen_handle = ffi.C.dlopen(path, bit.bor(RTLD_LAZY, RTLD_DEEPBIND))
      mpv = ffi.load(path)
    end)
    if ok then
      libmpvAvailable = true
      io.write("[videos] libmpv lazy-loaded from " .. path .. "\n"); io.flush()
      break
    end
    lastErr = err
  end

  if not libmpvAvailable then
    io.write("[videos] libmpv not available: " .. tostring(lastErr) .. "\n"); io.flush()
    io.write("[videos] Install libmpv for video playback\n"); io.flush()
    return false
  end

  -- Create the GL proc address callback now that mpv is loaded
  get_proc_address_cb = ffi.cast(
    "void *(*)(void *, const char *)",
    function(_, name)
      return ffi.C.SDL_GL_GetProcAddress(name)
    end
  )

  return true
end

--- Fully unload libmpv: destroy all video objects, free the callback,
--- dlclose both handles (ffi.load's internal + our explicit one), and
--- reset all flags so the next loadVideo() triggers a fresh load.
--- Returns true if the library was unloaded, false if it wasn't loaded.
function Videos.unloadLibrary()
  if not libmpvAvailable then return false end

  io.write("[videos] unloadLibrary: tearing down mpv...\n"); io.flush()

  -- 1. Destroy all mpv handles, render contexts, FBOs, textures, canvases
  Videos.clearCache()
  backendReady = false

  -- 2. Free the GL proc address callback
  if get_proc_address_cb ~= nil then
    get_proc_address_cb:free()
    get_proc_address_cb = nil
  end

  -- 3. Drop the ffi.load library namespace — LuaJIT's GC will dlclose its
  --    internal handle when it collects this object
  mpv = nil

  -- 4. Force GC to collect the ffi library object (two cycles for weak refs)
  collectgarbage("collect")
  collectgarbage("collect")

  -- 5. dlclose our explicit handle (the one with RTLD_DEEPBIND)
  if dlopen_handle ~= nil then
    local ret = ffi.C.dlclose(dlopen_handle)
    if ret ~= 0 then
      local err = ffi.string(ffi.C.dlerror())
      io.write("[videos] dlclose warning: " .. err .. "\n"); io.flush()
    else
      io.write("[videos] dlclose: explicit handle closed\n"); io.flush()
    end
    dlopen_handle = nil
  end

  -- 6. Reset flags so loadLibrary() can be called again
  libmpvAvailable = false
  libmpvLoadAttempted = false
  unloadTimer = nil

  io.write("[videos] unloadLibrary: complete — mpv fully unloaded\n"); io.flush()
  return true
end

-- ============================================================================
-- State
-- ============================================================================

-- videoCache[src] = {
--   handle       = mpv_handle*,
--   renderCtx    = mpv_render_context*,
--   fbo          = GLuint (private FBO for mpv rendering),
--   fboTex       = GLuint (texture attached to private FBO),
--   canvas       = Love2D Canvas (blit target — what painter draws),
--   canvasFboId  = GLuint (Canvas's internal FBO ID for blit target),
--   width        = number (video pixel width),
--   height       = number (video pixel height),
-- }
local videoCache = {}
local videoStatus = {}      -- src -> "loading" | "ready" | "error"
local videoErrors = {}      -- src -> error message string
local videoDurations = {}   -- src -> duration in seconds
local lastLoadAttempt = {}  -- src -> love.timer.getTime()
local REMOTE_RETRY_INTERVAL = 2.0

-- Playback tracking for event emission
local trackedNodes = {}     -- nodeId -> { src, wasPlaying, lastTime, readyEmitted, errorEmitted }
local TIME_UPDATE_INTERVAL = 0.25
local lastTimeUpdateEmit = {} -- nodeId -> last emitted time

-- Pre-allocated FFI buffers for GL state save/restore (avoid per-frame allocation)
local savedFbo          = ffi.new("GLint[1]")
local savedProgram      = ffi.new("GLint[1]")
local savedVao          = ffi.new("GLint[1]")
local savedVbo          = ffi.new("GLint[1]")
local savedEbo          = ffi.new("GLint[1]")
local savedActiveTex    = ffi.new("GLint[1]")
local savedTex2D        = ffi.new("GLint[1]")
local savedViewport     = ffi.new("GLint[4]")
local savedScissorBox   = ffi.new("GLint[4]")
local savedBlendSrc     = ffi.new("GLint[1]")
local savedBlendDst     = ffi.new("GLint[1]")
local savedBlendEnabled = ffi.new("GLint[1]")
local savedScissorOn    = ffi.new("GLint[1]")
local savedDepthOn      = ffi.new("GLint[1]")
local savedStencilOn    = ffi.new("GLint[1]")
local savedCullOn       = ffi.new("GLint[1]")

-- Pre-allocated mpv render params (reused every frame for all videos)
local mpvFboParam = ffi.new("mpv_opengl_fbo")
local mpvFlipY    = ffi.new("int[1]", 0)  -- No flip — we flip during blit to match Love2D's canvas convention
local mpvRenderParams = ffi.new("mpv_render_param[3]")
mpvRenderParams[0].type = MPV_RENDER_PARAM_OPENGL_FBO
mpvRenderParams[0].data = ffi.cast("void*", mpvFboParam)
mpvRenderParams[1].type = MPV_RENDER_PARAM_FLIP_Y
mpvRenderParams[1].data = ffi.cast("void*", mpvFlipY)
mpvRenderParams[2].type = 0
mpvRenderParams[2].data = nil

-- ============================================================================
-- Helpers
-- ============================================================================

local function isRemoteUrl(src)
  return type(src) == "string" and src:match("^https?://") ~= nil
end

--- Resolve a video path to an absolute OS path for mpv.
local function resolveVideoPath(src)
  -- URLs pass through directly
  if isRemoteUrl(src) then return src end

  -- Absolute path — check existence
  if src:sub(1, 1) == "/" then
    local f = io.open(src, "r")
    if f then f:close(); return src end
  end

  -- Relative to Love2D source directory
  local sourceDir = love.filesystem.getSource()
  local path = sourceDir .. "/" .. src
  local f = io.open(path, "r")
  if f then f:close(); return path end

  -- Relative to save directory
  local saveDir = love.filesystem.getSaveDirectory()
  path = saveDir .. "/" .. src
  f = io.open(path, "r")
  if f then f:close(); return path end

  return nil
end

--- Create a private GL FBO + texture for mpv to render into.
local function createPrivateFBO(w, h)
  local tex = ffi.new("GLuint[1]")
  ffi.C.glGenTextures(1, tex)
  ffi.C.glBindTexture(GL_TEXTURE_2D, tex[0])
  ffi.C.glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, nil)
  ffi.C.glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
  ffi.C.glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
  ffi.C.glBindTexture(GL_TEXTURE_2D, 0)

  local fb = ffi.new("GLuint[1]")
  ffi.C.glGenFramebuffers(1, fb)
  ffi.C.glBindFramebuffer(GL_FRAMEBUFFER, fb[0])
  ffi.C.glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex[0], 0)

  local status = ffi.C.glCheckFramebufferStatus(GL_FRAMEBUFFER)
  ffi.C.glBindFramebuffer(GL_FRAMEBUFFER, 0)

  if status ~= GL_FRAMEBUFFER_COMPLETE then
    io.write("[videos] ERROR: Private FBO incomplete\n"); io.flush()
    ffi.C.glDeleteTextures(1, tex)
    ffi.C.glDeleteFramebuffers(1, fb)
    return nil, nil
  end

  return fb[0], tex[0]
end

--- Get an mpv property as a double.
local function getMpvDouble(handle, name)
  local val = ffi.new("double[1]")
  local err = mpv.mpv_get_property(handle, name, MPV_FORMAT_DOUBLE, val)
  if err >= 0 then return val[0] end
  return nil
end

--- Get an mpv property as an int64.
local function getMpvInt(handle, name)
  local val = ffi.new("int64_t[1]")
  local err = mpv.mpv_get_property(handle, name, MPV_FORMAT_INT64, val)
  if err >= 0 then return tonumber(val[0]) end
  return nil
end

--- Get an mpv property as a string.
local function getMpvString(handle, name)
  local raw = mpv.mpv_get_property_string(handle, name)
  if raw ~= nil then
    local s = ffi.string(raw)
    mpv.mpv_free(raw)
    return s
  end
  return nil
end

--- Destroy a single video entry's mpv handle, render context, and GL resources.
local function destroyVideoEntry(entry)
  if entry.renderCtx then
    mpv.mpv_render_context_free(entry.renderCtx)
    entry.renderCtx = nil
  end
  if entry.handle then
    mpv.mpv_terminate_destroy(entry.handle)
    entry.handle = nil
  end
  if entry.fbo then
    local fb = ffi.new("GLuint[1]", entry.fbo)
    ffi.C.glDeleteFramebuffers(1, fb)
    entry.fbo = nil
  end
  if entry.fboTex then
    local tex = ffi.new("GLuint[1]", entry.fboTex)
    ffi.C.glDeleteTextures(1, tex)
    entry.fboTex = nil
  end
  if entry.canvas then
    entry.canvas:release()
    entry.canvas = nil
  end
end

--- Clear all cached state for a source key.
local function clearSource(src)
  local entry = videoCache[src]
  if entry then destroyVideoEntry(entry) end
  videoCache[src] = nil
  videoStatus[src] = nil
  videoErrors[src] = nil
  videoDurations[src] = nil
  lastLoadAttempt[src] = nil
end

-- ============================================================================
-- Pixel-store save/restore
-- ============================================================================

-- Love2D uses UNPACK_ALIGNMENT=1 for single-byte glyph atlas uploads.
-- mpv_render_context_create changes it to 4, corrupting font rendering.
local savedUnpackAlign  = ffi.new("GLint[1]")
local savedUnpackRowLen = ffi.new("GLint[1]")
local savedUnpackSkipR  = ffi.new("GLint[1]")
local savedUnpackSkipP  = ffi.new("GLint[1]")
local savedPackAlign    = ffi.new("GLint[1]")
local savedPackRowLen   = ffi.new("GLint[1]")
local savedPackSkipR    = ffi.new("GLint[1]")
local savedPackSkipP    = ffi.new("GLint[1]")

local function savePixelStore()
  ffi.C.glGetIntegerv(GL_UNPACK_ALIGNMENT,  savedUnpackAlign)
  ffi.C.glGetIntegerv(GL_UNPACK_ROW_LENGTH, savedUnpackRowLen)
  ffi.C.glGetIntegerv(GL_UNPACK_SKIP_ROWS,  savedUnpackSkipR)
  ffi.C.glGetIntegerv(GL_UNPACK_SKIP_PIXELS,savedUnpackSkipP)
  ffi.C.glGetIntegerv(GL_PACK_ALIGNMENT,    savedPackAlign)
  ffi.C.glGetIntegerv(GL_PACK_ROW_LENGTH,   savedPackRowLen)
  ffi.C.glGetIntegerv(GL_PACK_SKIP_ROWS,    savedPackSkipR)
  ffi.C.glGetIntegerv(GL_PACK_SKIP_PIXELS,  savedPackSkipP)
end

local function restorePixelStore()
  ffi.C.glPixelStorei(GL_UNPACK_ALIGNMENT,   savedUnpackAlign[0])
  ffi.C.glPixelStorei(GL_UNPACK_ROW_LENGTH,  savedUnpackRowLen[0])
  ffi.C.glPixelStorei(GL_UNPACK_SKIP_ROWS,   savedUnpackSkipR[0])
  ffi.C.glPixelStorei(GL_UNPACK_SKIP_PIXELS, savedUnpackSkipP[0])
  ffi.C.glPixelStorei(GL_PACK_ALIGNMENT,     savedPackAlign[0])
  ffi.C.glPixelStorei(GL_PACK_ROW_LENGTH,    savedPackRowLen[0])
  ffi.C.glPixelStorei(GL_PACK_SKIP_ROWS,     savedPackSkipR[0])
  ffi.C.glPixelStorei(GL_PACK_SKIP_PIXELS,   savedPackSkipP[0])
end

-- ============================================================================
-- GL state save/restore (17 variables — proven in PoC)
-- ============================================================================

local function saveGLState()
  ffi.C.glGetIntegerv(GL_FRAMEBUFFER_BINDING, savedFbo)
  ffi.C.glGetIntegerv(GL_CURRENT_PROGRAM, savedProgram)
  ffi.C.glGetIntegerv(GL_VERTEX_ARRAY_BINDING, savedVao)
  ffi.C.glGetIntegerv(GL_ARRAY_BUFFER_BINDING, savedVbo)
  ffi.C.glGetIntegerv(GL_ELEMENT_ARRAY_BUFFER_BINDING, savedEbo)
  ffi.C.glGetIntegerv(GL_ACTIVE_TEXTURE, savedActiveTex)
  ffi.C.glGetIntegerv(GL_TEXTURE_BINDING_2D, savedTex2D)
  ffi.C.glGetIntegerv(GL_VIEWPORT, savedViewport)
  ffi.C.glGetIntegerv(GL_SCISSOR_BOX, savedScissorBox)
  ffi.C.glGetIntegerv(GL_BLEND_SRC, savedBlendSrc)
  ffi.C.glGetIntegerv(GL_BLEND_DST, savedBlendDst)
  ffi.C.glGetIntegerv(GL_BLEND, savedBlendEnabled)
  ffi.C.glGetIntegerv(GL_SCISSOR_TEST, savedScissorOn)
  ffi.C.glGetIntegerv(GL_DEPTH_TEST, savedDepthOn)
  ffi.C.glGetIntegerv(GL_STENCIL_TEST, savedStencilOn)
  ffi.C.glGetIntegerv(GL_CULL_FACE, savedCullOn)
  savePixelStore()
end

local function restoreGLState()
  ffi.C.glBindFramebuffer(GL_FRAMEBUFFER, savedFbo[0])
  ffi.C.glUseProgram(savedProgram[0])
  ffi.C.glBindVertexArray(savedVao[0])
  ffi.C.glBindBuffer(GL_ARRAY_BUFFER, savedVbo[0])
  ffi.C.glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, savedEbo[0])
  ffi.C.glActiveTexture(savedActiveTex[0])
  ffi.C.glBindTexture(GL_TEXTURE_2D, savedTex2D[0])
  ffi.C.glViewport(savedViewport[0], savedViewport[1], savedViewport[2], savedViewport[3])
  ffi.C.glScissor(savedScissorBox[0], savedScissorBox[1], savedScissorBox[2], savedScissorBox[3])
  ffi.C.glBlendFunc(savedBlendSrc[0], savedBlendDst[0])
  if savedBlendEnabled[0] ~= 0 then ffi.C.glEnable(GL_BLEND) else ffi.C.glDisable(GL_BLEND) end
  if savedScissorOn[0] ~= 0    then ffi.C.glEnable(GL_SCISSOR_TEST) else ffi.C.glDisable(GL_SCISSOR_TEST) end
  if savedDepthOn[0] ~= 0      then ffi.C.glEnable(GL_DEPTH_TEST)   else ffi.C.glDisable(GL_DEPTH_TEST) end
  if savedStencilOn[0] ~= 0    then ffi.C.glEnable(GL_STENCIL_TEST) else ffi.C.glDisable(GL_STENCIL_TEST) end
  if savedCullOn[0] ~= 0       then ffi.C.glEnable(GL_CULL_FACE)    else ffi.C.glDisable(GL_CULL_FACE) end
  restorePixelStore()
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Ensure UNPACK_ALIGNMENT=1 for Love2D glyph uploads.
--- Called at top of love.draw() as a safety net against mpv dirtying pixel-store.
function Videos.ensurePixelStore()
  ffi.C.glPixelStorei(GL_UNPACK_ALIGNMENT, 1)
end

--- Return the Canvas for a video source. Painter draws this.
function Videos.get(src)
  if not src or src == "" then return nil end
  local entry = videoCache[src]
  return entry and entry.canvas or nil
end

--- Get the playback status of a video source.
--- @return "loading" | "ready" | "error" | nil
function Videos.getStatus(src)
  if not src or src == "" then return nil end
  return videoStatus[src]
end

--- Get the error message for a failed video.
function Videos.getError(src)
  return videoErrors[src]
end

--- Get the duration of a video in seconds (may be nil if unknown).
function Videos.getDuration(src)
  return videoDurations[src]
end

--- Get the intrinsic dimensions of a video.
function Videos.getDimensions(src)
  local entry = videoCache[src]
  if entry and entry.width then
    return entry.width, entry.height
  end
  return nil, nil
end

--- Get the current playback time in seconds.
function Videos.getCurrentTime(src)
  local entry = videoCache[src]
  if entry and entry.handle then
    return getMpvDouble(entry.handle, "time-pos")
  end
  return nil
end

--- Get whether the video is currently paused.
function Videos.getPaused(src)
  local entry = videoCache[src]
  if entry and entry.handle then
    local val = getMpvString(entry.handle, "pause")
    return val == "yes"
  end
  return true
end

-- ============================================================================
-- Per-source mpv instances (each video source gets its own handle + render ctx)
-- ============================================================================

--- Eagerly load libmpv and mark backend ready.
--- Called by storybook or apps that want mpv available at startup.
--- For lazy loading, skip this — loadVideo() will call loadLibrary() on demand.
function Videos.initBackend()
  Videos.loadLibrary()
  if not libmpvAvailable then
    io.write("[videos] initBackend: libmpv not available\n"); io.flush()
    return
  end
  backendReady = true
  io.write("[videos] initBackend: ready (per-source instances)\n"); io.flush()
end

--- Create a per-source mpv handle + render context + load the file.
--- Each video source gets its own independent mpv pipeline.
local function loadVideo(src)
  -- Lazy-load libmpv on first actual video request
  if not libmpvAvailable then
    Videos.loadLibrary()
    if libmpvAvailable then
      backendReady = true
      io.write("[videos] libmpv lazy-loaded on first video request\n"); io.flush()
    end
  end

  lastLoadAttempt[src] = love.timer.getTime()

  -- If we're retrying the same src, clear stale render resources first.
  local existing = videoCache[src]
  if existing then
    destroyVideoEntry(existing)
    videoCache[src] = nil
  end
  videoDurations[src] = nil
  videoErrors[src] = nil

  if not backendReady then
    videoStatus[src] = "error"
    videoErrors[src] = "mpv backend not initialized"
    return
  end

  local resolvedPath = resolveVideoPath(src)
  if not resolvedPath then
    videoStatus[src] = "error"
    videoErrors[src] = "Video file not found: " .. src
    return
  end

  io.write("[videos] loadVideo: " .. src .. "\n"); io.flush()

  -- Create mpv handle
  local handle = mpv.mpv_create()
  if handle == nil then
    videoStatus[src] = "error"
    videoErrors[src] = "mpv_create failed"
    return
  end

  -- Configure
  mpv.mpv_set_option_string(handle, "vo", "libmpv")
  mpv.mpv_set_option_string(handle, "hwdec", "no")
  -- ao not set → mpv auto-detects (pulse, pipewire, alsa, etc.)
  mpv.mpv_set_option_string(handle, "load-scripts", "no")
  mpv.mpv_set_option_string(handle, "ytdl", "no")
  mpv.mpv_set_option_string(handle, "osd-level", "0")
  mpv.mpv_set_option_string(handle, "sub", "no")
  mpv.mpv_set_option_string(handle, "terminal", "yes")
  mpv.mpv_set_option_string(handle, "msg-level", "all=warn")
  mpv.mpv_set_option_string(handle, "keep-open", "yes")
  mpv.mpv_set_option_string(handle, "idle", "yes")
  mpv.mpv_set_option_string(handle, "input-default-bindings", "no")
  mpv.mpv_set_option_string(handle, "input-vo-keyboard", "no")
  mpv.mpv_set_option_string(handle, "pause", "yes")

  local err = mpv.mpv_initialize(handle)
  if err < 0 then
    videoStatus[src] = "error"
    videoErrors[src] = "mpv_initialize: " .. ffi.string(mpv.mpv_error_string(err))
    mpv.mpv_terminate_destroy(handle)
    return
  end

  -- Create OpenGL render context
  local glInit = ffi.new("mpv_opengl_init_params")
  glInit.get_proc_address = get_proc_address_cb
  glInit.get_proc_address_ctx = nil

  local apiType = ffi.new("char[7]", "opengl")
  local createParams = ffi.new("mpv_render_param[3]")
  createParams[0].type = MPV_RENDER_PARAM_API_TYPE
  createParams[0].data = ffi.cast("void*", apiType)
  createParams[1].type = MPV_RENDER_PARAM_OPENGL_INIT_PARAMS
  createParams[1].data = ffi.cast("void*", glInit)
  createParams[2].type = 0
  createParams[2].data = nil

  local ctxPtr = ffi.new("mpv_render_context*[1]")

  -- Save full GL state including pixel-store (mpv_render_context_create
  -- changes UNPACK_ALIGNMENT from 1→4, corrupting Love2D font rendering)
  saveGLState()
  err = mpv.mpv_render_context_create(ctxPtr, handle, createParams)
  restoreGLState()

  if err < 0 then
    videoStatus[src] = "error"
    videoErrors[src] = "render_context_create: " .. ffi.string(mpv.mpv_error_string(err))
    mpv.mpv_terminate_destroy(handle)
    return
  end

  local renderCtx = ctxPtr[0]

  -- Load the file
  local cmd = ffi.new("const char*[4]")
  cmd[0] = ffi.cast("const char*", "loadfile")
  cmd[1] = ffi.cast("const char*", resolvedPath)
  cmd[2] = ffi.cast("const char*", "replace")
  cmd[3] = nil
  err = mpv.mpv_command(handle, cmd)
  if err < 0 then
    videoStatus[src] = "error"
    videoErrors[src] = "loadfile: " .. ffi.string(mpv.mpv_error_string(err))
    mpv.mpv_render_context_free(renderCtx)
    mpv.mpv_terminate_destroy(handle)
    return
  end

  videoCache[src] = {
    handle = handle,
    renderCtx = renderCtx,
    fbo = nil,
    fboTex = nil,
    canvas = nil,
    canvasFboId = nil,
    width = nil,
    height = nil,
  }
  videoStatus[src] = "loading"
  io.write("[videos] Loading: " .. src .. "\n"); io.flush()
end

--- Scan tree nodes for Video elements — auto-load new srcs, auto-cleanup removed ones.
--- Called once per frame from renderAll(), completely outside command processing.
function Videos.syncWithTree(nodes)
  if not nodes then return end

  -- Collect all Video srcs currently in the tree
  local activeSrcs = {}   -- src -> true
  local activeNodes = {}  -- nodeId -> src
  for id, node in pairs(nodes) do
    if (node.type == "Video" or node.type == "VideoPlayer") and node.props and node.props.src and node.props.src ~= "" then
      activeSrcs[node.props.src] = true
      activeNodes[id] = node.props.src
    end
    -- View nodes with backgroundVideo or hoverVideo (loaded but not event-tracked)
    if (node.type == "View" or node.type == "box") and node.props then
      local bgv = node.props.backgroundVideo
      if bgv and bgv ~= "" then activeSrcs[bgv] = true end
      local hv = node.props.hoverVideo
      if hv and hv ~= "" then activeSrcs[hv] = true end
    end
  end

  -- Load any new srcs not yet initialized.
  -- For remote URLs, retry errored loads after a short interval.
  local now = love.timer.getTime()
  for src in pairs(activeSrcs) do
    local status = videoStatus[src]
    if not status then
      loadVideo(src)
    elseif status == "error" and backendReady and isRemoteUrl(src) then
      local lastTry = lastLoadAttempt[src] or 0
      if now - lastTry >= REMOTE_RETRY_INTERVAL then
        loadVideo(src)
      end
    end
  end

  -- Sync node tracking
  for nodeId, src in pairs(activeNodes) do
    if not trackedNodes[nodeId] then
      trackedNodes[nodeId] = {
        src = src,
        wasPlaying = false,
        lastTime = 0,
        readyEmitted = false,
        errorEmitted = false,
      }
      lastTimeUpdateEmit[nodeId] = 0
    elseif trackedNodes[nodeId].src ~= src then
      -- src changed on this node
      trackedNodes[nodeId].src = src
      trackedNodes[nodeId].wasPlaying = false
      trackedNodes[nodeId].lastTime = 0
      trackedNodes[nodeId].readyEmitted = false
      trackedNodes[nodeId].errorEmitted = false
      lastTimeUpdateEmit[nodeId] = 0
    end
  end

  -- Untrack removed nodes
  for nodeId in pairs(trackedNodes) do
    if not activeNodes[nodeId] then
      trackedNodes[nodeId] = nil
      lastTimeUpdateEmit[nodeId] = nil
    end
  end

  -- Unload srcs no longer in the tree.
  -- Covers both cached entries and early-error srcs that never made it into videoCache.
  local staleSrcs = {}
  for src in pairs(videoStatus) do
    if not activeSrcs[src] then staleSrcs[src] = true end
  end
  for src in pairs(videoCache) do
    if not activeSrcs[src] then staleSrcs[src] = true end
  end
  for src in pairs(staleSrcs) do
    clearSource(src)
  end

  -- Auto-unload: if no video nodes remain and mpv is loaded, start debounce timer.
  -- If timer expires, fully unload the library to reclaim ~111 MB of RSS.
  local hasAnyVideo = next(activeSrcs) ~= nil
  if hasAnyVideo then
    -- Video nodes exist — cancel any pending unload
    unloadTimer = nil
  elseif libmpvAvailable then
    -- No video nodes — start or check debounce timer
    if unloadTimer == nil then
      unloadTimer = now
    elseif now - unloadTimer >= UNLOAD_DEBOUNCE then
      io.write("[videos] No video nodes for " .. UNLOAD_DEBOUNCE .. "s — unloading libmpv\n"); io.flush()
      Videos.unloadLibrary()
    end
  end
end

-- Videos.load / Videos.unload removed — lifecycle is driven by syncWithTree()

-- ============================================================================
-- Playback control (via mpv property API)
-- ============================================================================

function Videos.setPaused(src, paused)
  local entry = videoCache[src]
  if entry and entry.handle then
    mpv.mpv_set_property_string(entry.handle, "pause", paused and "yes" or "no")
  end
end

function Videos.setVolume(src, volume)
  local entry = videoCache[src]
  if entry and entry.handle then
    mpv.mpv_set_property_string(entry.handle, "volume", tostring((volume or 1) * 100))
  end
end

function Videos.setMuted(src, muted)
  local entry = videoCache[src]
  if entry and entry.handle then
    mpv.mpv_set_property_string(entry.handle, "mute", muted and "yes" or "no")
  end
end

function Videos.setLoop(src, loop)
  local entry = videoCache[src]
  if entry and entry.handle then
    mpv.mpv_set_property_string(entry.handle, "loop-file", loop and "inf" or "no")
  end
end

function Videos.seek(src, time)
  local entry = videoCache[src]
  if entry and entry.handle then
    local cmd = ffi.new("const char*[4]")
    cmd[0] = ffi.cast("const char*", "seek")
    cmd[1] = ffi.cast("const char*", tostring(time))
    cmd[2] = ffi.cast("const char*", "absolute")
    cmd[3] = nil
    mpv.mpv_command(entry.handle, cmd)
  end
end

-- ============================================================================
-- Per-frame rendering
-- ============================================================================

--- Render all active mpv videos into their Canvases.
--- Call once per frame from init.lua (in love.update, before painter runs).
function Videos.renderAll()
  if not libmpvAvailable then return end

  -- Phase 1: Initialize Canvas/FBO for newly loaded videos whose dimensions are now known
  for src, entry in pairs(videoCache) do
    if not entry.canvas and entry.handle then
      local w = getMpvInt(entry.handle, "video-params/w")
      local h = getMpvInt(entry.handle, "video-params/h")
      if w and h and w > 0 and h > 0 then
        entry.canvas = love.graphics.newCanvas(w, h)
        entry.width = w
        entry.height = h

        -- Extract Canvas's internal FBO ID
        love.graphics.setCanvas(entry.canvas)
        local fboPtr = ffi.new("GLint[1]")
        ffi.C.glGetIntegerv(GL_FRAMEBUFFER_BINDING, fboPtr)
        entry.canvasFboId = fboPtr[0]
        love.graphics.setCanvas()

        -- Create private FBO for mpv to render into
        entry.fbo, entry.fboTex = createPrivateFBO(w, h)
        if entry.fbo then
          videoStatus[src] = "ready"
          local dur = getMpvDouble(entry.handle, "duration")
          if dur then videoDurations[src] = dur end
          io.write("[videos] Ready: " .. src .. " (" .. w .. "x" .. h .. ")\n"); io.flush()
        else
          videoStatus[src] = "error"
          videoErrors[src] = "Failed to create GL framebuffer"
        end
      end
    end
  end

  -- Phase 2: Render all ready videos (single GL state save/restore for all)
  local hasWork = false
  for _, entry in pairs(videoCache) do
    if entry.renderCtx and entry.fbo then
      hasWork = true
      break
    end
  end
  if not hasWork then return end

  saveGLState()

  for src, entry in pairs(videoCache) do
    if entry.renderCtx and entry.fbo then
      local flags = mpv.mpv_render_context_update(entry.renderCtx)
      if bit.band(flags, MPV_RENDER_UPDATE_FRAME) ~= 0 then
        -- Configure render target for this video
        mpvFboParam.fbo = entry.fbo
        mpvFboParam.w = entry.width
        mpvFboParam.h = entry.height
        mpvFboParam.internal_format = 0

        -- Render to private FBO
        mpv.mpv_render_context_render(entry.renderCtx, mpvRenderParams)
        mpv.mpv_render_context_report_swap(entry.renderCtx)

        -- Blit from private FBO → Canvas FBO (flip Y: mpv is bottom-up, canvas is top-down)
        -- Disable scissor test to prevent mpv's scissor state from clipping the blit
        ffi.C.glDisable(GL_SCISSOR_TEST)
        ffi.C.glBindFramebuffer(GL_READ_FRAMEBUFFER, entry.fbo)
        ffi.C.glBindFramebuffer(GL_DRAW_FRAMEBUFFER, entry.canvasFboId)
        ffi.C.glBlitFramebuffer(
          0, 0, entry.width, entry.height,
          0, entry.height, entry.width, 0,
          GL_COLOR_BUFFER_BIT, GL_NEAREST
        )
      end

      -- Update duration if not yet known
      if not videoDurations[src] then
        local dur = getMpvDouble(entry.handle, "duration")
        if dur then videoDurations[src] = dur end
      end
    end
  end

  restoreGLState()
end

-- Node tracking is now handled by syncWithTree()

function Videos.getNodesForSrc(src)
  local result = {}
  for nodeId, info in pairs(trackedNodes) do
    if info.src == src then
      result[#result + 1] = nodeId
    end
  end
  return result
end

-- ============================================================================
-- Event polling
-- ============================================================================

--- Poll for video status changes. Called once per frame from init.lua.
function Videos.poll()
  local events = {}
  for src, _ in pairs(videoCache) do
    if videoStatus[src] == "ready" then
      local nodes = Videos.getNodesForSrc(src)
      for _, nodeId in ipairs(nodes) do
        local info = trackedNodes[nodeId]
        if info and not info.readyEmitted then
          events[#events + 1] = { src = src, status = "ready" }
          break
        end
      end
    end
  end

  -- Emit one error event per tracked node for errored srcs.
  -- This covers early failures where videoCache[src] was never created.
  for nodeId, info in pairs(trackedNodes) do
    local status = videoStatus[info.src]
    if status == "error" then
      if not info.errorEmitted then
        events[#events + 1] = {
          src = info.src,
          status = "error",
          message = videoErrors[info.src] or "Video playback error",
          nodeId = nodeId,
        }
        info.errorEmitted = true
      end
    else
      info.errorEmitted = false
    end
  end

  return events
end

--- Poll playback state of all tracked video nodes.
--- Returns events: { { nodeId, type, currentTime?, duration? } }
function Videos.pollPlayback()
  local events = {}
  local now = love.timer.getTime()

  for nodeId, info in pairs(trackedNodes) do
    local entry = videoCache[info.src]
    if entry and entry.handle and videoStatus[info.src] == "ready" then
      -- Emit onReady once
      if not info.readyEmitted then
        events[#events + 1] = { nodeId = nodeId, type = "onReady" }
        info.readyEmitted = true
      end

      -- Query playback state from mpv
      local pauseStr = getMpvString(entry.handle, "pause")
      local isPlaying = (pauseStr == "no")
      local currentTime = getMpvDouble(entry.handle, "time-pos") or 0
      local duration = videoDurations[info.src]

      -- Update duration if newly available
      if not duration then
        duration = getMpvDouble(entry.handle, "duration")
        if duration then videoDurations[info.src] = duration end
      end

      -- Detect play/pause state changes
      if isPlaying and not info.wasPlaying then
        events[#events + 1] = { nodeId = nodeId, type = "onPlay" }
      elseif not isPlaying and info.wasPlaying then
        events[#events + 1] = { nodeId = nodeId, type = "onPause" }
        -- Check if video reached end
        local eofStr = getMpvString(entry.handle, "eof-reached")
        if eofStr == "yes" then
          events[#events + 1] = { nodeId = nodeId, type = "onEnded" }
        end
      end

      -- Periodic time update
      if isPlaying then
        local lastEmit = lastTimeUpdateEmit[nodeId] or 0
        if now - lastEmit >= TIME_UPDATE_INTERVAL then
          events[#events + 1] = {
            nodeId = nodeId,
            type = "onTimeUpdate",
            currentTime = currentTime,
            duration = duration,
          }
          lastTimeUpdateEmit[nodeId] = now
        end
      end

      info.wasPlaying = isPlaying
      info.lastTime = currentTime
    end
  end

  return events
end

-- ============================================================================
-- Cleanup
-- ============================================================================

function Videos.clearCache()
  for _, entry in pairs(videoCache) do
    destroyVideoEntry(entry)
  end
  videoCache = {}
  videoStatus = {}
  videoErrors = {}
  videoDurations = {}
  lastLoadAttempt = {}
  trackedNodes = {}
  lastTimeUpdateEmit = {}
end

function Videos.shutdown()
  Videos.unloadLibrary()
end

--- Return count of loaded videos (for panic snapshot diagnostics).
function Videos.count()
  local n = 0
  for _ in pairs(videoCache) do n = n + 1 end
  return n
end

return Videos
