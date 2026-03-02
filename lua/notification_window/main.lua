--[[
  notification_window/main.lua — Self-contained notification renderer

  Fire-and-forget Love2D subprocess that renders a borderless notification
  window at a specified screen position, then fades out and exits.

  All config is passed via environment variables:
    REACTJIT_NOTIF_TITLE     Notification title (bold)
    REACTJIT_NOTIF_BODY      Notification body text
    REACTJIT_NOTIF_DURATION  Duration in seconds before auto-dismiss (default 5)
    REACTJIT_NOTIF_X         Window X position
    REACTJIT_NOTIF_Y         Window Y position
    REACTJIT_NOTIF_WIDTH     Window width (default 380)
    REACTJIT_NOTIF_HEIGHT    Window height (default 100)
    REACTJIT_NOTIF_ACCENT    Accent color hex (default "4C9EFF")

  No IPC, no tree, no layout engine. Just Love2D drawing primitives.
]]

local ffi = require("ffi")

-- ============================================================================
-- Config from env vars
-- ============================================================================

local title    = os.getenv("REACTJIT_NOTIF_TITLE") or "Notification"
local body     = os.getenv("REACTJIT_NOTIF_BODY") or ""
local duration = tonumber(os.getenv("REACTJIT_NOTIF_DURATION")) or 5
local posX     = tonumber(os.getenv("REACTJIT_NOTIF_X"))
local posY     = tonumber(os.getenv("REACTJIT_NOTIF_Y"))
local accentHex = os.getenv("REACTJIT_NOTIF_ACCENT") or "4C9EFF"

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
-- love.load
-- ============================================================================

function love.load()
  fadeOutStart = duration - fadeOutTime

  -- Position the window
  if posX and posY then
    love.window.setPosition(posX, posY)
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

  -- Transparent background
  love.graphics.setBackgroundColor(0, 0, 0, 0)

  -- Load fonts (use Love2D default font at different sizes)
  titleFont = love.graphics.newFont(14)
  bodyFont  = love.graphics.newFont(12)
end

-- ============================================================================
-- love.update
-- ============================================================================

function love.update(dt)
  if dismissed then return end

  elapsed = elapsed + dt

  -- Compute alpha: fade in → hold → fade out
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

local function roundedRect(x, y, w, h, r)
  love.graphics.rectangle("fill", x + r, y, w - 2 * r, h)
  love.graphics.rectangle("fill", x, y + r, w, h - 2 * r)
  love.graphics.circle("fill", x + r, y + r, r)
  love.graphics.circle("fill", x + w - r, y + r, r)
  love.graphics.circle("fill", x + r, y + h - r, r)
  love.graphics.circle("fill", x + w - r, y + h - r, r)
end

function love.draw()
  local w = love.graphics.getWidth()
  local h = love.graphics.getHeight()
  local radius = 12
  local accentWidth = 4
  local pad = 16

  -- Background
  love.graphics.setColor(0.08, 0.08, 0.10, alpha * 0.95)
  roundedRect(0, 0, w, h, radius)

  -- Accent stripe on left
  love.graphics.setColor(accentR, accentG, accentB, alpha)
  roundedRect(0, 0, accentWidth + radius, h, radius)
  -- Clean up the right side of the accent (sharp edge)
  love.graphics.setColor(0.08, 0.08, 0.10, alpha * 0.95)
  love.graphics.rectangle("fill", accentWidth, radius, radius, h - 2 * radius)

  -- Border (subtle)
  love.graphics.setColor(0.25, 0.25, 0.30, alpha * 0.6)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", 0.5, 0.5, w - 1, h - 1, radius, radius)

  -- Title
  love.graphics.setFont(titleFont)
  love.graphics.setColor(1, 1, 1, alpha)
  love.graphics.print(title, accentWidth + pad, pad)

  -- Body
  if body and body ~= "" then
    love.graphics.setFont(bodyFont)
    love.graphics.setColor(0.7, 0.7, 0.75, alpha)
    love.graphics.printf(body, accentWidth + pad, pad + 22, w - accentWidth - pad * 2)
  end

  -- Dismiss hint (bottom-right)
  love.graphics.setFont(bodyFont)
  love.graphics.setColor(0.4, 0.4, 0.45, alpha * 0.6)
  local hint = "click to dismiss"
  local hintW = bodyFont:getWidth(hint)
  love.graphics.print(hint, w - hintW - pad, h - 20)
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
