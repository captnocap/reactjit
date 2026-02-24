--[[
  sdl2_videos.lua -- Video playback via libmpv OpenGL render API (SDL2 target)

  Port of videos.lua for the SDL2 target. Uses raw GL textures + FBOs instead
  of Love2D Canvases, SDL_GetTicks() instead of love.timer.getTime(), and
  resolves paths relative to cwd instead of love.filesystem.

  Renders video frames directly into GL textures using mpv's OpenGL backend.
  Any format mpv supports (MP4, MKV, WebM, AVI, MOV, etc.) plays instantly.

  Requires: libmpv-dev (apt install libmpv-dev)
  Fallback: Shows error placeholder if libmpv not installed.

  Status lifecycle per src:
    nil → "loading" → "ready" | "error"
]]

local ffi = require("ffi")
local bit = require("bit")
local GL  = require("lua.sdl2_gl")

local Videos = {}

-- ============================================================================
-- FFI declarations (only what's NOT already in sdl2_gl.lua or sdl2_init.lua)
-- ============================================================================

-- Guard against redeclaration errors from other modules
pcall(ffi.cdef, [[
  // --- dlopen ---
  void *dlopen(const char *filename, int flags);

  // --- SDL2 (for proc address + timer) ---
  void *SDL_GL_GetProcAddress(const char *proc);
  uint32_t SDL_GetTicks(void);

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

  // --- GL extensions not in sdl2_gl.lua ---
  void glBlitFramebuffer(int srcX0, int srcY0, int srcX1, int srcY1,
                          int dstX0, int dstY0, int dstX1, int dstY1,
                          unsigned int mask, unsigned int filter);
]])

-- ============================================================================
-- GL constants (supplement sdl2_gl.lua's set)
-- ============================================================================

local GL_FRAMEBUFFER          = GL.FRAMEBUFFER_EXT        -- 0x8D40
local GL_READ_FRAMEBUFFER     = 0x8CA8
local GL_DRAW_FRAMEBUFFER     = 0x8CA9
local GL_FRAMEBUFFER_BINDING  = 0x8CA6
local GL_COLOR_ATTACHMENT0    = GL.COLOR_ATTACHMENT0_EXT   -- 0x8CE0
local GL_FRAMEBUFFER_COMPLETE = GL.FRAMEBUFFER_COMPLETE_EXT -- 0x8CD5
local GL_RGBA8                = 0x8058
local GL_COLOR_BUFFER_BIT     = GL.COLOR_BUFFER_BIT        -- 0x4000

-- GL state query constants
local GL_CURRENT_PROGRAM              = 0x8B8D
local GL_ARRAY_BUFFER_BINDING         = 0x8894
local GL_ELEMENT_ARRAY_BUFFER_BINDING = 0x8895
local GL_ACTIVE_TEXTURE               = 0x84E0
local GL_TEXTURE_BINDING_2D           = 0x8069
local GL_BLEND_SRC                    = 0x0BE1
local GL_BLEND_DST                    = 0x0BE0

-- Pixel store constants
local GL_UNPACK_ALIGNMENT             = GL.UNPACK_ALIGNMENT  -- 0x0CF5
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
-- Load SDL2 (for proc address + timer)
-- ============================================================================

local loader = require("lua.lib_loader")
local sdl = loader.load("SDL2")

-- ============================================================================
-- Load libmpv (graceful fallback if not installed)
-- ============================================================================

local libmpvAvailable = false
local mpv = nil

do
  local RTLD_LAZY     = 0x00001
  local RTLD_DEEPBIND = 0x00008
  -- Try bundled lib/ first, then fall back to system library
  local paths = { "lib/libmpv.so.2", "libmpv.so.2" }
  local lastErr
  for _, path in ipairs(paths) do
    local ok, err = pcall(function()
      -- RTLD_DEEPBIND isolates mpv's Lua 5.2 symbols from LuaJIT.
      ffi.C.dlopen(path, bit.bor(RTLD_LAZY, RTLD_DEEPBIND))
      mpv = ffi.load(path)
    end)
    if ok then
      libmpvAvailable = true
      io.write("[sdl2_videos] libmpv loaded from " .. path .. " (RTLD_DEEPBIND)\n"); io.flush()
      break
    end
    lastErr = err
  end
  if not libmpvAvailable then
    io.write("[sdl2_videos] libmpv not available: " .. tostring(lastErr) .. "\n"); io.flush()
    io.write("[sdl2_videos] Install libmpv-dev for video playback\n"); io.flush()
  end
end

-- Shared GL proc address callback (anchored at module level — never GC'd)
local get_proc_address_cb = nil
if libmpvAvailable then
  get_proc_address_cb = ffi.cast(
    "void *(*)(void *, const char *)",
    function(_, name)
      return sdl.SDL_GL_GetProcAddress(name)
    end
  )
end

-- ============================================================================
-- Time helper (replaces love.timer.getTime())
-- ============================================================================

local function getTime()
  return tonumber(sdl.SDL_GetTicks()) / 1000.0
end

-- ============================================================================
-- State
-- ============================================================================

-- videoCache[src] = {
--   handle       = mpv_handle*,
--   renderCtx    = mpv_render_context*,
--   fbo          = GLuint (private FBO for mpv rendering),
--   fboTex       = GLuint (texture attached to private FBO),
--   outFbo       = GLuint (output FBO — blit target),
--   outTex       = GLuint (output texture — what painter draws),
--   width        = number (video pixel width),
--   height       = number (video pixel height),
-- }
local videoCache = {}
local videoStatus = {}      -- src -> "loading" | "ready" | "error"
local videoErrors = {}      -- src -> error message string
local videoDurations = {}   -- src -> duration in seconds
local lastLoadAttempt = {}  -- src -> getTime()
local REMOTE_RETRY_INTERVAL = 2.0

-- Playback tracking for event emission
local trackedNodes = {}     -- nodeId -> { src, wasPlaying, lastTime, readyEmitted, errorEmitted }
local TIME_UPDATE_INTERVAL = 0.25
local lastTimeUpdateEmit = {} -- nodeId -> last emitted time

-- Pre-allocated FFI buffers for GL state save/restore (avoid per-frame allocation)
local savedFbo          = ffi.new("int[1]")
local savedProgram      = ffi.new("int[1]")
local savedVbo          = ffi.new("int[1]")
local savedEbo          = ffi.new("int[1]")
local savedActiveTex    = ffi.new("int[1]")
local savedTex2D        = ffi.new("int[1]")
local savedViewport     = ffi.new("int[4]")
local savedScissorBox   = ffi.new("int[4]")
local savedBlendSrc     = ffi.new("int[1]")
local savedBlendDst     = ffi.new("int[1]")
local savedBlendEnabled = ffi.new("int[1]")
local savedScissorOn    = ffi.new("int[1]")
local savedDepthOn      = ffi.new("int[1]")
local savedStencilOn    = ffi.new("int[1]")
local savedCullOn       = ffi.new("int[1]")

-- Pre-allocated mpv render params (reused every frame for all videos)
local mpvFboParam = ffi.new("mpv_opengl_fbo")
local mpvFlipY    = ffi.new("int[1]", 0)  -- No flip — we flip during blit
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

  -- Relative to cwd
  local path = "./" .. src
  local f = io.open(path, "r")
  if f then f:close(); return path end

  return nil
end

--- Create a GL FBO + texture pair.
--- Used for both the private FBO (mpv render target) and output FBO (blit target).
local _fboIds = ffi.new("unsigned int[1]")
local _texIds = ffi.new("unsigned int[1]")

local function createFBO(w, h)
  GL.glGenTextures(1, _texIds)
  local texId = _texIds[0]
  GL.glBindTexture(GL.TEXTURE_2D, texId)
  GL.glTexImage2D(GL.TEXTURE_2D, 0, GL_RGBA8, w, h, 0, GL.RGBA, GL.UNSIGNED_BYTE, nil)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR)
  GL.glTexParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR)
  GL.glBindTexture(GL.TEXTURE_2D, 0)

  GL.glGenFramebuffersEXT(1, _fboIds)
  local fboId = _fboIds[0]
  GL.glBindFramebufferEXT(GL_FRAMEBUFFER, fboId)
  GL.glFramebufferTexture2DEXT(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL.TEXTURE_2D, texId, 0)

  local status = GL.glCheckFramebufferStatusEXT(GL_FRAMEBUFFER)
  GL.glBindFramebufferEXT(GL_FRAMEBUFFER, 0)

  if status ~= GL_FRAMEBUFFER_COMPLETE then
    io.write("[sdl2_videos] ERROR: FBO incomplete (status=" .. status .. ")\n"); io.flush()
    _texIds[0] = texId; GL.glDeleteTextures(1, _texIds)
    _fboIds[0] = fboId; GL.glDeleteFramebuffersEXT(1, _fboIds)
    return nil, nil
  end

  return fboId, texId
end

local function deleteFBO(fboId, texId)
  if fboId then _fboIds[0] = fboId; GL.glDeleteFramebuffersEXT(1, _fboIds) end
  if texId then _texIds[0] = texId; GL.glDeleteTextures(1, _texIds) end
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
  -- Private FBO
  deleteFBO(entry.fbo, entry.fboTex)
  entry.fbo = nil
  entry.fboTex = nil
  -- Output FBO
  deleteFBO(entry.outFbo, entry.outTex)
  entry.outFbo = nil
  entry.outTex = nil
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

-- FreeType font renderer uses UNPACK_ALIGNMENT=1 for single-byte glyph uploads.
-- mpv_render_context_create changes it to 4, corrupting font rendering.
local savedUnpackAlign  = ffi.new("int[1]")
local savedUnpackRowLen = ffi.new("int[1]")
local savedUnpackSkipR  = ffi.new("int[1]")
local savedUnpackSkipP  = ffi.new("int[1]")
local savedPackAlign    = ffi.new("int[1]")
local savedPackRowLen   = ffi.new("int[1]")
local savedPackSkipR    = ffi.new("int[1]")
local savedPackSkipP    = ffi.new("int[1]")

local function savePixelStore()
  GL.glGetIntegerv(GL_UNPACK_ALIGNMENT,  savedUnpackAlign)
  GL.glGetIntegerv(GL_UNPACK_ROW_LENGTH, savedUnpackRowLen)
  GL.glGetIntegerv(GL_UNPACK_SKIP_ROWS,  savedUnpackSkipR)
  GL.glGetIntegerv(GL_UNPACK_SKIP_PIXELS,savedUnpackSkipP)
  GL.glGetIntegerv(GL_PACK_ALIGNMENT,    savedPackAlign)
  GL.glGetIntegerv(GL_PACK_ROW_LENGTH,   savedPackRowLen)
  GL.glGetIntegerv(GL_PACK_SKIP_ROWS,    savedPackSkipR)
  GL.glGetIntegerv(GL_PACK_SKIP_PIXELS,  savedPackSkipP)
end

local function restorePixelStore()
  GL.glPixelStorei(GL_UNPACK_ALIGNMENT,   savedUnpackAlign[0])
  GL.glPixelStorei(GL_UNPACK_ROW_LENGTH,  savedUnpackRowLen[0])
  GL.glPixelStorei(GL_UNPACK_SKIP_ROWS,   savedUnpackSkipR[0])
  GL.glPixelStorei(GL_UNPACK_SKIP_PIXELS, savedUnpackSkipP[0])
  GL.glPixelStorei(GL_PACK_ALIGNMENT,     savedPackAlign[0])
  GL.glPixelStorei(GL_PACK_ROW_LENGTH,    savedPackRowLen[0])
  GL.glPixelStorei(GL_PACK_SKIP_ROWS,     savedPackSkipR[0])
  GL.glPixelStorei(GL_PACK_SKIP_PIXELS,   savedPackSkipP[0])
end

-- ============================================================================
-- GL state save/restore (16 variables — same as Love2D version minus VAO)
-- ============================================================================

local function saveGLState()
  GL.glGetIntegerv(GL_FRAMEBUFFER_BINDING, savedFbo)
  GL.glGetIntegerv(GL_CURRENT_PROGRAM, savedProgram)
  GL.glGetIntegerv(GL_ARRAY_BUFFER_BINDING, savedVbo)
  GL.glGetIntegerv(GL_ELEMENT_ARRAY_BUFFER_BINDING, savedEbo)
  GL.glGetIntegerv(GL_ACTIVE_TEXTURE, savedActiveTex)
  GL.glGetIntegerv(GL_TEXTURE_BINDING_2D, savedTex2D)
  GL.glGetIntegerv(GL.VIEWPORT, savedViewport)
  GL.glGetIntegerv(0x0C10, savedScissorBox)  -- GL_SCISSOR_BOX
  GL.glGetIntegerv(GL_BLEND_SRC, savedBlendSrc)
  GL.glGetIntegerv(GL_BLEND_DST, savedBlendDst)
  GL.glGetIntegerv(GL.BLEND, savedBlendEnabled)
  GL.glGetIntegerv(GL.SCISSOR_TEST, savedScissorOn)
  GL.glGetIntegerv(GL.DEPTH_TEST, savedDepthOn)
  GL.glGetIntegerv(GL.STENCIL_TEST, savedStencilOn)
  GL.glGetIntegerv(0x0B44, savedCullOn)  -- GL_CULL_FACE
  savePixelStore()
end

local function restoreGLState()
  GL.glBindFramebufferEXT(GL_FRAMEBUFFER, savedFbo[0])
  GL.glUseProgram(savedProgram[0])
  GL.glBindBuffer(GL.ARRAY_BUFFER, savedVbo[0])
  GL.glBindBuffer(0x8893, savedEbo[0])  -- GL_ELEMENT_ARRAY_BUFFER
  GL.glActiveTexture(savedActiveTex[0])
  GL.glBindTexture(GL.TEXTURE_2D, savedTex2D[0])
  GL.glViewport(savedViewport[0], savedViewport[1], savedViewport[2], savedViewport[3])
  GL.glScissor(savedScissorBox[0], savedScissorBox[1], savedScissorBox[2], savedScissorBox[3])
  GL.glBlendFunc(savedBlendSrc[0], savedBlendDst[0])
  if savedBlendEnabled[0] ~= 0 then GL.glEnable(GL.BLEND) else GL.glDisable(GL.BLEND) end
  if savedScissorOn[0] ~= 0    then GL.glEnable(GL.SCISSOR_TEST) else GL.glDisable(GL.SCISSOR_TEST) end
  if savedDepthOn[0] ~= 0      then GL.glEnable(GL.DEPTH_TEST)   else GL.glDisable(GL.DEPTH_TEST) end
  if savedStencilOn[0] ~= 0    then GL.glEnable(GL.STENCIL_TEST) else GL.glDisable(GL.STENCIL_TEST) end
  if savedCullOn[0] ~= 0       then GL.glEnable(0x0B44) else GL.glDisable(0x0B44) end  -- GL_CULL_FACE
  restorePixelStore()
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Ensure UNPACK_ALIGNMENT=1 for FreeType glyph uploads.
--- Called at top of paint as a safety net against mpv dirtying pixel-store.
function Videos.ensurePixelStore()
  GL.glPixelStorei(GL_UNPACK_ALIGNMENT, 1)
end

--- Return the video texture entry for a source. Painter draws this.
--- @return table|nil  { texId, w, h }
function Videos.get(src)
  if not src or src == "" then return nil end
  local entry = videoCache[src]
  if entry and entry.outTex then
    return { texId = entry.outTex, w = entry.width, h = entry.height }
  end
  return nil
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

local backendReady = false

--- Verify libmpv is available.
function Videos.initBackend()
  if not libmpvAvailable then
    io.write("[sdl2_videos] initBackend: libmpv not available\n"); io.flush()
    return
  end
  backendReady = true
  io.write("[sdl2_videos] initBackend: ready (per-source instances)\n"); io.flush()
end

--- Create a per-source mpv handle + render context + load the file.
local function loadVideo(src)
  lastLoadAttempt[src] = getTime()

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

  io.write("[sdl2_videos] loadVideo: " .. src .. "\n"); io.flush()

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
  -- changes UNPACK_ALIGNMENT from 1→4, corrupting font rendering)
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
    outFbo = nil,
    outTex = nil,
    width = nil,
    height = nil,
  }
  videoStatus[src] = "loading"
  io.write("[sdl2_videos] Loading: " .. src .. "\n"); io.flush()
end

--- Scan tree nodes for Video elements — auto-load new srcs, auto-cleanup removed ones.
function Videos.syncWithTree(nodes)
  if not nodes then return end

  -- Collect all Video srcs currently in the tree
  local activeSrcs = {}
  local activeNodes = {}
  for id, node in pairs(nodes) do
    if (node.type == "Video" or node.type == "VideoPlayer") and node.props and node.props.src and node.props.src ~= "" then
      activeSrcs[node.props.src] = true
      activeNodes[id] = node.props.src
    end
    if (node.type == "View" or node.type == "box") and node.props then
      local bgv = node.props.backgroundVideo
      if bgv and bgv ~= "" then activeSrcs[bgv] = true end
      local hv = node.props.hoverVideo
      if hv and hv ~= "" then activeSrcs[hv] = true end
    end
  end

  -- Load new srcs. For remote URLs, retry errored loads after a short interval.
  local now = getTime()
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

  -- Unload srcs no longer in the tree
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
end

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

--- Render all active mpv videos into their output textures.
--- Call once per frame from sdl2_init.lua (before painter runs).
function Videos.renderAll()
  if not libmpvAvailable then return end

  -- Phase 1: Initialize FBOs for newly loaded videos whose dimensions are now known
  for src, entry in pairs(videoCache) do
    if not entry.outTex and entry.handle then
      local w = getMpvInt(entry.handle, "video-params/w")
      local h = getMpvInt(entry.handle, "video-params/h")
      if w and h and w > 0 and h > 0 then
        entry.width = w
        entry.height = h

        -- Create output FBO + texture (blit target — what painter draws)
        entry.outFbo, entry.outTex = createFBO(w, h)
        if not entry.outFbo then
          videoStatus[src] = "error"
          videoErrors[src] = "Failed to create output framebuffer"
          goto continue
        end

        -- Create private FBO + texture (mpv render target)
        entry.fbo, entry.fboTex = createFBO(w, h)
        if entry.fbo then
          videoStatus[src] = "ready"
          local dur = getMpvDouble(entry.handle, "duration")
          if dur then videoDurations[src] = dur end
          io.write("[sdl2_videos] Ready: " .. src .. " (" .. w .. "x" .. h .. ")\n"); io.flush()
        else
          videoStatus[src] = "error"
          videoErrors[src] = "Failed to create private framebuffer"
        end

        ::continue::
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

        -- Blit from private FBO → output FBO (flip Y: mpv is bottom-up)
        GL.glDisable(GL.SCISSOR_TEST)
        GL.glBindFramebufferEXT(GL_READ_FRAMEBUFFER, entry.fbo)
        GL.glBindFramebufferEXT(GL_DRAW_FRAMEBUFFER, entry.outFbo)
        ffi.C.glBlitFramebuffer(
          0, 0, entry.width, entry.height,
          0, entry.height, entry.width, 0,
          GL_COLOR_BUFFER_BIT, GL.NEAREST
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

--- Poll for video status changes.
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
function Videos.pollPlayback()
  local events = {}
  local now = getTime()

  for nodeId, info in pairs(trackedNodes) do
    local entry = videoCache[info.src]
    if entry and entry.handle and videoStatus[info.src] == "ready" then
      if not info.readyEmitted then
        events[#events + 1] = { nodeId = nodeId, type = "onReady" }
        info.readyEmitted = true
      end

      local pauseStr = getMpvString(entry.handle, "pause")
      local isPlaying = (pauseStr == "no")
      local currentTime = getMpvDouble(entry.handle, "time-pos") or 0
      local duration = videoDurations[info.src]

      if not duration then
        duration = getMpvDouble(entry.handle, "duration")
        if duration then videoDurations[info.src] = duration end
      end

      if isPlaying and not info.wasPlaying then
        events[#events + 1] = { nodeId = nodeId, type = "onPlay" }
      elseif not isPlaying and info.wasPlaying then
        events[#events + 1] = { nodeId = nodeId, type = "onPause" }
        local eofStr = getMpvString(entry.handle, "eof-reached")
        if eofStr == "yes" then
          events[#events + 1] = { nodeId = nodeId, type = "onEnded" }
        end
      end

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
  Videos.clearCache()
  backendReady = false
end

return Videos
