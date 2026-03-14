--[[
  dragdrop.lua — Drag-hover detection via LuaJIT FFI

  Detects when files are being dragged over the window (before drop)
  by polling X11's XDnD selection owner and SDL2's mouse state.

  Also provides getMousePosition() which returns accurate window-local
  cursor coordinates even during OS file drags (when love.mouse.getPosition()
  returns stale values).

  X11-only for hover detection (Linux). getMousePosition() works anywhere
  SDL2 is available (Love2D exposes SDL2 symbols via ffi.C).
]]

local ffi = require("ffi")

local DragDrop = {}

-- State
local x11Available = false   -- X11 drag-hover detection available
local sdlMouseAvail = false  -- SDL_GetMouseState available
local sdlGlobalMouseAvail = false  -- SDL_GetGlobalMouseState available
local isDragHover = false
local localX, localY = 0, 0
local loggedEnter = false

-- X11 handles
local x11Display = nil
local xdndSelectionAtom = nil
local x11Lib = nil

-- SDL2 library handle (Love2D exposes SDL2 symbols in ffi.C)
local sdlLib = ffi.C

-- ── SDL2 mouse state setup (independent of X11) ─────────────

local function initSDLMouse()
  pcall(ffi.cdef, [[
    unsigned int SDL_GetMouseState(int* x, int* y);
  ]])
  -- Verify SDL_GetMouseState works with the chosen handle
  local testOk = pcall(function()
    local mx = ffi.new("int[1]")
    local my = ffi.new("int[1]")
    sdlLib.SDL_GetMouseState(mx, my)
  end)
  if testOk then
    sdlMouseAvail = true
  end
end

-- ── X11 FFI setup ────────────────────────────────────────────

local function tryInitX11()
  if ffi.os ~= "Linux" then
    return false
  end

  -- X11 bindings
  local ok, cdefErr = pcall(ffi.cdef, [[
    void* XOpenDisplay(const char* display_name);
    int   XCloseDisplay(void* display);
    unsigned long XGetSelectionOwner(void* display, unsigned long selection);
    unsigned long XInternAtom(void* display, const char* atom_name, int only_if_exists);
  ]])
  if not ok then return false end

  -- SDL2 global mouse state for hover detection (needs screen coords)
  pcall(ffi.cdef, [[
    unsigned int SDL_GetGlobalMouseState(int* x, int* y);
  ]])

  -- Verify SDL_GetGlobalMouseState works with our handle
  local globalOk = pcall(function()
    local mx = ffi.new("int[1]")
    local my = ffi.new("int[1]")
    sdlLib.SDL_GetGlobalMouseState(mx, my)
  end)
  if globalOk then
    sdlGlobalMouseAvail = true
  else
    return false
  end

  -- Load libX11
  local loadOk
  loadOk, x11Lib = pcall(ffi.load, "X11")
  if not loadOk then return false end

  x11Display = x11Lib.XOpenDisplay(nil)
  if x11Display == nil then return false end

  xdndSelectionAtom = x11Lib.XInternAtom(x11Display, "XdndSelection", 0)
  if tonumber(xdndSelectionAtom) == 0 then
    x11Lib.XCloseDisplay(x11Display)
    x11Display = nil
    return false
  end

  return true
end

-- ── Public API ─────────────────────────────────────────────

--- Initialize drag-drop detection.
function DragDrop.init()
  -- SDL mouse (works on all platforms, needed for file drop position)
  initSDLMouse()

  -- X11 drag-hover detection (Linux only)
  x11Available = tryInitX11()
end

--- Poll drag-hover state. Call once per frame from love.update.
function DragDrop.poll()
  if not x11Available then
    isDragHover = false
    return
  end

  local owner = x11Lib.XGetSelectionOwner(x11Display, xdndSelectionAtom)
  if tonumber(owner) == 0 then
    if isDragHover and loggedEnter then
      io.write("[dragdrop] drag ended (selection owner cleared)\n"); io.flush()
      loggedEnter = false
    end
    isDragHover = false
    return
  end

  -- A drag is active. Use SDL_GetGlobalMouseState for screen coords
  -- and love.window for bounds check.
  local mx = ffi.new("int[1]")
  local my = ffi.new("int[1]")
  sdlLib.SDL_GetGlobalMouseState(mx, my)
  local screenX, screenY = tonumber(mx[0]), tonumber(my[0])

  local winX, winY = love.window.getPosition()
  local winW, winH = love.window.getMode()

  if screenX >= winX and screenX < winX + winW
     and screenY >= winY and screenY < winY + winH then
    if not isDragHover and not loggedEnter then
      io.write("[dragdrop] drag ENTERED window at screen=" .. screenX .. "," .. screenY
               .. " win=" .. winX .. "," .. winY .. " size=" .. winW .. "x" .. winH .. "\n"); io.flush()
      loggedEnter = true
    end
    isDragHover = true
    -- Use SDL_GetMouseState for window-local coords (more reliable than subtraction)
    if sdlMouseAvail then
      local lx = ffi.new("int[1]")
      local ly = ffi.new("int[1]")
      sdlLib.SDL_GetMouseState(lx, ly)
      localX = tonumber(lx[0])
      localY = tonumber(ly[0])
    else
      localX = screenX - winX
      localY = screenY - winY
    end
  else
    if isDragHover and loggedEnter then
      io.write("[dragdrop] drag LEFT window\n"); io.flush()
      loggedEnter = false
    end
    isDragHover = false
  end
end

function DragDrop.isDragHovering()
  return isDragHover
end

function DragDrop.getPosition()
  return localX, localY
end

--- Returns window-local cursor position using SDL_GetMouseState.
--- Works when love.mouse.getPosition() returns stale values during OS drags.
--- Returns x, y or nil if SDL mouse state is not available.
function DragDrop.getMousePosition()
  if not sdlMouseAvail then return nil end
  local mx = ffi.new("int[1]")
  local my = ffi.new("int[1]")
  sdlLib.SDL_GetMouseState(mx, my)
  return tonumber(mx[0]), tonumber(my[0])
end

function DragDrop.cleanup()
  if x11Display then
    x11Lib.XCloseDisplay(x11Display)
    x11Display = nil
  end
  x11Available = false
  sdlGlobalMouseAvail = false
  isDragHover = false
end

return DragDrop
