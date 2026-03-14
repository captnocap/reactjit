--[[
  notification_window/main.lua — Self-contained notification renderer

  Fire-and-forget Love2D subprocess that renders a borderless notification
  window at a specified screen position, then fades out and exits.

  All config is passed via environment variables:
    REACTJIT_NOTIF_TITLE     Notification title (bold)
    REACTJIT_NOTIF_BODY      Notification body text
    REACTJIT_NOTIF_DURATION  Duration in seconds before auto-dismiss (default 5)
    REACTJIT_NOTIF_X         Window X position (display-relative)
    REACTJIT_NOTIF_Y         Window Y position (display-relative)
    REACTJIT_NOTIF_WIDTH     Window width (default 380)
    REACTJIT_NOTIF_HEIGHT    Window height (default 100)
    REACTJIT_NOTIF_ACCENT    Accent color hex (default "4C9EFF")
    REACTJIT_NOTIF_DISPLAY   Display index (1-based, Love2D convention)
    REACTJIT_NOTIF_REFOCUS   X11 window ID to refocus after spawn

  No IPC, no tree, no layout engine. Just Love2D drawing primitives.
]]

local ffi = require("ffi")

-- ============================================================================
-- Config from env vars
-- ============================================================================

local title      = os.getenv("REACTJIT_NOTIF_TITLE") or "Notification"
local body       = os.getenv("REACTJIT_NOTIF_BODY") or ""
local duration   = tonumber(os.getenv("REACTJIT_NOTIF_DURATION")) or 5
local posX       = tonumber(os.getenv("REACTJIT_NOTIF_X"))
local posY       = tonumber(os.getenv("REACTJIT_NOTIF_Y"))
local display    = tonumber(os.getenv("REACTJIT_NOTIF_DISPLAY"))
local accentHex  = os.getenv("REACTJIT_NOTIF_ACCENT") or "4C9EFF"
local refocusWin = os.getenv("REACTJIT_NOTIF_REFOCUS") or ""

-- Parse hex color
local function hexToRGB(hex)
  hex = hex:gsub("^#", "")
  local r = tonumber(hex:sub(1, 2), 16) / 255
  local g = tonumber(hex:sub(3, 4), 16) / 255
  local b = tonumber(hex:sub(5, 6), 16) / 255
  return r, g, b
end

local accentR, accentG, accentB = hexToRGB(accentHex)

-- ============================================================================
-- State
-- ============================================================================

local elapsed    = 0
local alpha      = 0       -- current opacity (0..1)
local fadeInTime = 0.15    -- seconds to fade in
local fadeOutTime = 0.4    -- seconds to fade out
local fadeOutStart         -- computed in love.load
local dismissed  = false

-- Fonts
local titleFont
local bodyFont

-- ============================================================================
-- X11: prevent focus stealing
-- ============================================================================

local function setupX11NoFocus()
  -- Find our own X11 window ID via xdotool
  pcall(ffi.cdef, "int getpid(void);")
  local ok, pid = pcall(function() return ffi.C.getpid() end)
  if not ok then return end

  local h = io.popen("xdotool search --pid " .. pid .. " 2>/dev/null")
  local xwinId
  if h then xwinId = h:read("*l"); h:close() end
  if not xwinId or xwinId == "" then return end

  -- Set window type to NOTIFICATION — tells the WM this is a transient overlay,
  -- not an app window. Most WMs won't give it keyboard focus on click.
  os.execute("xprop -id " .. xwinId ..
    " -f _NET_WM_WINDOW_TYPE 32a" ..
    " -set _NET_WM_WINDOW_TYPE _NET_WM_WINDOW_TYPE_NOTIFICATION" ..
    " 2>/dev/null")

  -- Skip taskbar + pager + stay above
  os.execute("xprop -id " .. xwinId ..
    " -f _NET_WM_STATE 32a" ..
    " -set _NET_WM_STATE _NET_WM_STATE_ABOVE,_NET_WM_STATE_SKIP_TASKBAR,_NET_WM_STATE_SKIP_PAGER" ..
    " 2>/dev/null")
end

local function refocusPreviousWindow()
  if refocusWin == "" then return end
  -- Refocus the window that was active before we spawned.
  -- Backgrounded so we don't block love.load.
  os.execute("xdotool windowactivate " .. refocusWin .. " 2>/dev/null &")
end

-- ============================================================================
-- love.load
-- ============================================================================

function love.load()
  fadeOutStart = duration - fadeOutTime

  -- Position the window on the correct display
  if posX and posY then
    love.window.setPosition(posX, posY, display or 1)
  end

  -- Always on top via SDL2 FFI
  pcall(ffi.cdef, [[
    typedef struct SDL_Window SDL_Window;
    SDL_Window* SDL_GetKeyboardFocus(void);
    void SDL_SetWindowAlwaysOnTop(SDL_Window* window, int on_top);
  ]])
  pcall(function()
    local win = ffi.C.SDL_GetKeyboardFocus()
    if win ~= nil then
      ffi.C.SDL_SetWindowAlwaysOnTop(win, 1)
    end
  end)

  -- Set X11 window type to NOTIFICATION + skip taskbar/pager
  setupX11NoFocus()

  -- Immediately return focus to the window that was active before us
  refocusPreviousWindow()

  -- Transparent background
  love.graphics.setBackgroundColor(0, 0, 0, 0)

  -- Load fonts (cached once, never per-frame)
  titleFont = love.graphics.newFont(14)
  bodyFont  = love.graphics.newFont(12)
end

-- ============================================================================
-- love.update
-- ============================================================================

function love.update(dt)
  if dismissed then return end

  elapsed = elapsed + dt

  -- Compute alpha: fade in -> hold -> fade out
  if elapsed < fadeInTime then
    alpha = elapsed / fadeInTime
  elseif elapsed < fadeOutStart then
    alpha = 1
  elseif elapsed < duration then
    local t = (elapsed - fadeOutStart) / fadeOutTime
    alpha = 1 - t
  else
    -- Done
    love.event.quit()
    return
  end

  alpha = math.max(0, math.min(1, alpha))
end

-- ============================================================================
-- love.draw
-- ============================================================================

function love.draw()
  local w = love.graphics.getWidth()
  local h = love.graphics.getHeight()
  local r = 10
  local bar = 3
  local pad = 14
  local inset = 8  -- accent bar inset from top/bottom

  -- Background
  love.graphics.setColor(0.09, 0.09, 0.11, alpha * 0.96)
  love.graphics.rectangle("fill", 0, 0, w, h, r, r)

  -- Accent bar — thin vertical stripe inside the left edge, rounded caps
  love.graphics.setColor(accentR, accentG, accentB, alpha)
  love.graphics.rectangle("fill", 6, inset, bar, h - inset * 2, 2, 2)

  -- Border
  love.graphics.setColor(0.22, 0.22, 0.27, alpha * 0.5)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", 0.5, 0.5, w - 1, h - 1, r, r)

  -- Title
  local textX = 16
  love.graphics.setFont(titleFont)
  love.graphics.setColor(1, 1, 1, alpha)
  love.graphics.print(title, textX, pad)

  -- Body
  if body and body ~= "" then
    love.graphics.setFont(bodyFont)
    love.graphics.setColor(0.65, 0.65, 0.70, alpha)
    love.graphics.printf(body, textX, pad + 24, w - textX - pad)
  end

  -- Dismiss hint (bottom-right, very subtle)
  love.graphics.setFont(bodyFont)
  love.graphics.setColor(0.35, 0.35, 0.40, alpha * 0.4)
  local hint = "click to dismiss"
  local hintW = bodyFont:getWidth(hint)
  love.graphics.print(hint, w - hintW - pad, h - 22)
end

-- ============================================================================
-- Input — click anywhere to dismiss
-- ============================================================================

function love.mousepressed()
  dismissed = true
  love.event.quit()
end

-- ============================================================================
-- Prevent window from stealing focus on close
-- ============================================================================

function love.quit()
  return false
end
