--[[
  overlay.lua — Game overlay mode

  Two transport modes:
    1. Transparent window (default) — borderless, always-on-top SDL2 window
       with X11 XFixes input passthrough. For borderless-windowed games.
    2. Shared memory (REACTJIT_OVERLAY_SHM=1) — renders to an FBO, copies
       pixels into POSIX shm. The LD_PRELOAD hook in the game process reads
       shm and composites. For true fullscreen games.

  Three visibility modes, cycled by hotkey (default F6):
    interactive  — overlay visible, captures input
    passthrough  — overlay visible, clicks fall through to game
    hidden       — overlay invisible, all input to game

  Usage: set REACTJIT_OVERLAY=1 env var, or use `rjit overlay`.
         Add REACTJIT_OVERLAY_SHM=1 for shm transport (rjit overlay --attach).
]]

local ffi = require("ffi")

local Overlay = {}

-- ── State ────────────────────────────────────────────────────────────────────

Overlay.enabled     = false
Overlay.mode        = "passthrough"  -- "interactive" | "passthrough" | "hidden"
Overlay.opacity     = 0.9
Overlay.hotkey      = "f6"
Overlay.shmMode     = false  -- true when using shared-memory transport

local sdlWindow     = nil   -- SDL_Window* cached
local x11Display    = nil   -- Display* cached
local x11Window     = 0     -- X11 Window ID cached
local hasX11        = false -- true if X11 FFI loaded successfully
local overlaySHM    = nil   -- overlay_shm module (loaded in shm mode)

local MODES = { "passthrough", "interactive", "hidden" }

-- ── SDL2 FFI ─────────────────────────────────────────────────────────────────

pcall(ffi.cdef, [[
  typedef struct SDL_Window SDL_Window;
  typedef int SDL_bool;

  SDL_Window* SDL_GetKeyboardFocus(void);
  void SDL_SetWindowAlwaysOnTop(SDL_Window* window, SDL_bool on_top);
  void SDL_SetWindowBordered(SDL_Window* window, SDL_bool bordered);
  int  SDL_SetWindowOpacity(SDL_Window* window, float opacity);
  void SDL_ShowWindow(SDL_Window* window);
  void SDL_HideWindow(SDL_Window* window);
  void SDL_RaiseWindow(SDL_Window* window);
]])

-- ── X11 + XFixes FFI (for input passthrough) ────────────────────────────────

local libX11, libXfixes

local function initX11()
  -- Load X11 and XFixes shared libraries
  local ok1, x11 = pcall(ffi.load, "X11")
  if not ok1 then return false end
  local ok2, xfixes = pcall(ffi.load, "Xfixes")
  if not ok2 then return false end

  libX11 = x11
  libXfixes = xfixes

  pcall(ffi.cdef, [[
    // X11 types
    typedef unsigned long XID;
    typedef XID Window;
    typedef struct _XDisplay Display;
    typedef unsigned long XserverRegion;

    // XFixes functions
    XserverRegion XFixesCreateRegion(Display* dpy, void* rectangles, int nrectangles);
    void XFixesDestroyRegion(Display* dpy, XserverRegion region);
    void XFixesSetWindowShapeRegion(Display* dpy, Window win, int shape_kind,
                                    int x_off, int y_off, XserverRegion region);

    // X11 display
    Display* XOpenDisplay(const char* display_name);
    int XFlush(Display* dpy);
  ]])

  -- SDL_GetWindowWMInfo to extract X11 handles
  -- We need the SDL_SysWMinfo struct. Rather than declaring the full union,
  -- we use love.window.getDesktopDimensions as a proxy and get X11 handles
  -- from the environment or via a simpler SDL approach.

  -- Alternative: use SDL_GetWindowWMInfo
  pcall(ffi.cdef, [[
    typedef enum {
      SDL_SYSWM_UNKNOWN,
      SDL_SYSWM_WINDOWS,
      SDL_SYSWM_X11,
      SDL_SYSWM_DIRECTFB,
      SDL_SYSWM_COCOA,
      SDL_SYSWM_UIKIT,
      SDL_SYSWM_WAYLAND,
      SDL_SYSWM_MIR,
      SDL_SYSWM_WINRT,
      SDL_SYSWM_ANDROID,
      SDL_SYSWM_VIVANTE,
      SDL_SYSWM_OS2,
      SDL_SYSWM_HAIKU,
      SDL_SYSWM_KMSDRM
    } SDL_SYSWM_TYPE;

    typedef struct SDL_version {
      uint8_t major;
      uint8_t minor;
      uint8_t patch;
    } SDL_version;

    // X11 info portion of SDL_SysWMinfo
    typedef struct {
      Display* display;
      Window window;
    } SDL_SysWMinfo_x11;

    // Simplified SDL_SysWMinfo — we only need version + subsystem + x11
    // The real struct has a union, but x11 is the first/largest member on Linux
    typedef struct {
      SDL_version version;
      SDL_SYSWM_TYPE subsystem;
      SDL_SysWMinfo_x11 info;
      // Padding for the rest of the union (safe to over-allocate)
      char _padding[128];
    } SDL_SysWMinfo;

    void SDL_GetVersion(SDL_version* ver);
    int SDL_GetWindowWMInfo(SDL_Window* window, SDL_SysWMinfo* info);
  ]])

  return true
end

-- ShapeInput constant (from X11/extensions/shapeconst.h)
local ShapeInput = 2

-- ── Core functions ───────────────────────────────────────────────────────────

local function getSDLWindow()
  if sdlWindow ~= nil then return sdlWindow end
  local ok, win = pcall(function() return ffi.C.SDL_GetKeyboardFocus() end)
  if ok and win ~= nil then
    sdlWindow = win
  end
  return sdlWindow
end

local function getX11Handles()
  if x11Display ~= nil then return true end

  local win = getSDLWindow()
  if not win then return false end

  local ok, err = pcall(function()
    local info = ffi.new("SDL_SysWMinfo")
    ffi.C.SDL_GetVersion(info.version)
    local result = ffi.C.SDL_GetWindowWMInfo(win, info)
    if result ~= 1 then
      error("SDL_GetWindowWMInfo failed (result=" .. tostring(result) .. ")")
    end
    if info.subsystem ~= ffi.C.SDL_SYSWM_X11 then
      error("Not running on X11 (subsystem=" .. tostring(tonumber(info.subsystem)) .. ")")
    end
    x11Display = info.info.display
    x11Window  = info.info.window
  end)

  if not ok then
    io.write("[overlay] X11 handle extraction failed: " .. tostring(err) .. "\n")
    io.flush()
    return false
  end

  return true
end

local function setInputPassthrough(on)
  if not hasX11 then return end
  if not getX11Handles() then return end

  pcall(function()
    if on then
      -- Create empty region → all input falls through
      local region = libXfixes.XFixesCreateRegion(x11Display, nil, 0)
      libXfixes.XFixesSetWindowShapeRegion(x11Display, x11Window, ShapeInput, 0, 0, region)
      libXfixes.XFixesDestroyRegion(x11Display, region)
    else
      -- Reset input region to full window → captures input normally
      -- Passing 0 (None) as region restores default behavior
      libXfixes.XFixesSetWindowShapeRegion(x11Display, x11Window, ShapeInput, 0, 0, 0)
    end
    libX11.XFlush(x11Display)
  end)
end

local function applyMode(mode)
  Overlay.mode = mode

  -- In shm mode, flags are read by the hook from the shm header.
  -- No SDL2 window manipulation needed.
  if Overlay.shmMode then return end

  local win = getSDLWindow()
  if not win then return end

  if mode == "interactive" then
    pcall(function() ffi.C.SDL_ShowWindow(win) end)
    pcall(function() ffi.C.SDL_SetWindowOpacity(win, Overlay.opacity) end)
    setInputPassthrough(false)
    pcall(function() ffi.C.SDL_RaiseWindow(win) end)

  elseif mode == "passthrough" then
    pcall(function() ffi.C.SDL_ShowWindow(win) end)
    pcall(function() ffi.C.SDL_SetWindowOpacity(win, Overlay.opacity) end)
    setInputPassthrough(true)

  elseif mode == "hidden" then
    setInputPassthrough(true)
    pcall(function() ffi.C.SDL_HideWindow(win) end)
  end
end

-- ── Public API ───────────────────────────────────────────────────────────────

function Overlay.init(config)
  config = config or {}
  Overlay.enabled = true
  Overlay.hotkey  = config.hotkey or "f6"
  Overlay.opacity = config.opacity or 0.9
  Overlay.shmMode = config.shm or false

  local initialMode = config.mode or "passthrough"

  if Overlay.shmMode then
    -- ── Shared memory mode ───────────────────────────────────────────────
    -- Render to FBO, copy pixels to POSIX shm for the LD_PRELOAD hook.
    -- No SDL2 window reconfiguration needed — the Love2D window can be
    -- hidden or minimized since output goes through shm.
    local shmOk, shmMod = pcall(require, "lua.overlay_shm")
    if not shmOk then
      io.write("[overlay] ERROR: overlay_shm failed to load: " .. tostring(shmMod) .. "\n")
      io.flush()
      Overlay.shmMode = false
      return
    end
    overlaySHM = shmMod
    local w = config.width or love.graphics.getWidth()
    local h = config.height or love.graphics.getHeight()
    if not overlaySHM.init(w, h) then
      io.write("[overlay] ERROR: shm init failed\n"); io.flush()
      Overlay.shmMode = false
      overlaySHM = nil
      return
    end
    Overlay.mode = initialMode
    io.write(string.format(
      "[overlay] SHM mode initialized — %s (%dx%d), hotkey=%s\n",
      overlaySHM.getName(), w, h, Overlay.hotkey
    ))
    io.flush()
  else
    -- ── Transparent window mode ──────────────────────────────────────────
    -- Init X11 FFI (optional — gracefully degrades without input passthrough)
    hasX11 = initX11()
    if not hasX11 then
      io.write("[overlay] X11/XFixes not available — input passthrough disabled\n")
      io.flush()
    end

    -- Get SDL window handle
    local win = getSDLWindow()
    if not win then
      io.write("[overlay] WARNING: could not get SDL window handle\n")
      io.flush()
      return
    end

    -- Remove window decorations (borderless)
    pcall(function() ffi.C.SDL_SetWindowBordered(win, 0) end)

    -- Always on top
    pcall(function() ffi.C.SDL_SetWindowAlwaysOnTop(win, 1) end)

    -- Transparent background
    love.graphics.setBackgroundColor(0, 0, 0, 0)

    -- Apply initial mode
    applyMode(initialMode)

    io.write(string.format(
      "[overlay] Initialized — mode=%s, hotkey=%s, opacity=%.1f, x11=%s\n",
      initialMode, Overlay.hotkey, Overlay.opacity, tostring(hasX11)
    ))
    io.flush()
  end
end

function Overlay.setMode(mode)
  for _, m in ipairs(MODES) do
    if m == mode then
      applyMode(mode)
      return true
    end
  end
  return false
end

function Overlay.toggle()
  -- Find current mode index and advance
  for i, m in ipairs(MODES) do
    if m == Overlay.mode then
      local next = MODES[(i % #MODES) + 1]
      applyMode(next)
      return next
    end
  end
  -- Fallback
  applyMode("passthrough")
  return "passthrough"
end

function Overlay.setOpacity(opacity)
  Overlay.opacity = math.max(0, math.min(1, opacity))
  if Overlay.shmMode then return end
  local win = getSDLWindow()
  if win and Overlay.mode ~= "hidden" then
    pcall(function() ffi.C.SDL_SetWindowOpacity(win, Overlay.opacity) end)
  end
end

function Overlay.keypressed(key)
  if not Overlay.enabled then return false end
  if key == Overlay.hotkey then
    local newMode = Overlay.toggle()
    io.write("[overlay] Mode: " .. newMode .. "\n")
    io.flush()
    return true
  end
  return false
end

function Overlay.getState()
  return {
    enabled = Overlay.enabled,
    mode    = Overlay.mode,
    opacity = Overlay.opacity,
    hotkey  = Overlay.hotkey,
    hasX11  = hasX11,
    shmMode = Overlay.shmMode,
    shmName = overlaySHM and overlaySHM.getName() or nil,
  }
end

-- ── SHM mode draw hooks ──────────────────────────────────────────────────────
-- Called from init.lua's draw cycle to wrap rendering in FBO capture.

function Overlay.beginFrame()
  if not overlaySHM then return end
  overlaySHM.beginFrame()
end

function Overlay.endFrame()
  if not overlaySHM then return end
  overlaySHM.endFrame(Overlay)
end

function Overlay.getCanvas()
  if not overlaySHM then return nil end
  return overlaySHM.getCanvas()
end

function Overlay.shutdown()
  if overlaySHM then
    overlaySHM.shutdown()
    overlaySHM = nil
  end
end

return Overlay
