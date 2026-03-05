--[[
  window_manager.lua — Multi-window registry (Love2D backend)

  Tracks all open windows and their per-window state (dimensions, scale,
  mouse position, event state). The main window is registered as ID 0. Child
  windows are created by the Window capability.

  Uses love.window.createSecondary() from forked Love2D.

  Usage:
    local WM = require("lua.window_manager")
    WM.init()
    WM.registerMain()
    local win = WM.create({ title="Panel", width=400, height=300 })
    WM.destroy(win.id)
]]

local WindowManager = {}

-- ============================================================================
-- State
-- ============================================================================

local windows = {}           -- id -> window entry
local sdlIdMap = {}          -- SDL window ID (uint32) -> framework window ID
local nextId = 1             -- next framework window ID (0 is main)
local mainWin = nil          -- shortcut to windows[0]

-- ============================================================================
-- Internal helpers
-- ============================================================================

local function newDragState()
  return {
    active = false,
    targetId = nil,
    startX = 0, startY = 0,
    lastX = 0, lastY = 0,
    thresholdCrossed = false,
  }
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Initialize the window manager.
function WindowManager.init()
  -- Nothing to initialize; Love2D APIs are available globally.
end

--- Get the current backend name.
function WindowManager.getBackend()
  return "love"
end

--- Register the main window (ID 0). Called once during startup.
function WindowManager.registerMain()
  local pw = love.graphics.getWidth()
  local ph = love.graphics.getHeight()
  local entry = {
    id          = 0,
    loveId      = nil,  -- main window has no secondary ID
    width       = pw,
    height      = ph,
    scaleX      = love.window.getDPIScale(),
    scaleY      = love.window.getDPIScale(),
    mx          = 0,
    my          = 0,
    rootNodeId  = nil,
    hoveredNode = nil,
    pressedNode = nil,
    dragState   = newDragState(),
    needsLayout = true,
    isMain      = true,
  }

  windows[0] = entry
  mainWin = entry
  return entry
end

--- Create a new child window. Returns the window entry.
--- config: { title, width, height, x, y, rootNodeId }
function WindowManager.create(config)
  config = config or {}
  local title  = config.title  or "ReactJIT"
  local w      = config.width  or 640
  local h      = config.height or 480
  local x      = config.x
  local y      = config.y

  -- Use forked Love2D's secondary window API
  -- Love2D wrapper defaults x/y to SDL_WINDOWPOS_CENTERED when omitted
  local moddedTitle = title .. " [MODDED]"
  local loveId = love.window.createSecondary(moddedTitle, w, h, x, y)

  local ww, wh, pw, ph = love.window.getSecondarySize(loveId)
  local sx = (ww > 0) and (pw / ww) or 1
  local sy = (wh > 0) and (ph / wh) or 1
  local sdlId = love.window.getSecondarySDLId(loveId)

  local id = nextId
  nextId = nextId + 1

  local entry = {
    id          = id,
    loveId      = loveId,
    sdlId       = sdlId,
    width       = pw,
    height      = ph,
    scaleX      = sx,
    scaleY      = sy,
    mx          = 0,
    my          = 0,
    rootNodeId  = config.rootNodeId or nil,
    hoveredNode = nil,
    pressedNode = nil,
    dragState   = newDragState(),
    needsLayout = true,
    isMain      = false,
  }

  windows[id] = entry
  sdlIdMap[sdlId] = id

  io.write("[window_manager] created window #" .. id .. " (" .. pw .. "x" .. ph .. ") loveId=" .. loveId .. "\n")
  io.flush()
  return entry
end

--- Destroy a child window by framework ID.
function WindowManager.destroy(id)
  local entry = windows[id]
  if not entry then return end
  if entry.isMain then
    io.write("[window_manager] refusing to destroy main window\n"); io.flush()
    return
  end

  if entry.loveId then
    love.window.destroySecondary(entry.loveId)
  end

  if entry.sdlId then
    sdlIdMap[entry.sdlId] = nil
  end
  windows[id] = nil

  io.write("[window_manager] destroyed window #" .. id .. "\n"); io.flush()
end

--- Look up a window entry by SDL window ID (from event.*.wid).
function WindowManager.getBySDLId(sdlId)
  local fwId = sdlIdMap[sdlId]
  if fwId then return windows[fwId] end
  return nil
end

--- Get a window entry by framework ID.
function WindowManager.get(id)
  return windows[id]
end

--- Get the main window (ID 0).
function WindowManager.getMain()
  return mainWin
end

--- Return an ordered list of all window entries (main first).
function WindowManager.getAll()
  local result = {}
  if mainWin then result[1] = mainWin end
  for id, entry in pairs(windows) do
    if id ~= 0 then
      result[#result + 1] = entry
    end
  end
  return result
end

--- Update a window's dimensions after resize. Recalculates scale factors.
function WindowManager.handleResize(entry)
  if entry.isMain then
    entry.width  = love.graphics.getWidth()
    entry.height = love.graphics.getHeight()
    entry.scaleX = love.window.getDPIScale()
    entry.scaleY = love.window.getDPIScale()
  elseif entry.loveId then
    local ww, wh, pw, ph = love.window.getSecondarySize(entry.loveId)
    entry.width  = pw
    entry.height = ph
    local sx = (ww > 0) and (pw / ww) or 1
    local sy = (wh > 0) and (ph / wh) or 1
    entry.scaleX = sx
    entry.scaleY = sy
  end
  entry.needsLayout = true
end

--- Set a window's title.
function WindowManager.setTitle(entry, title)
  if entry.isMain then
    love.window.setTitle(title)
  end
  -- Love2D secondary windows: title is set at creation, no API to change it yet
end

--- Set a window's size.
function WindowManager.setSize(entry, w, h)
  -- No-op guard: prevent resize loops when the size hasn't actually changed
  w, h = math.floor(w), math.floor(h)
  if w == entry.width and h == entry.height then return end

  if entry.isMain then
    love.window.updateMode(w, h, { resizable = true })
  end
  -- Love2D secondary windows: no resize API yet
  WindowManager.handleResize(entry)
end

--- Set a window's position.
function WindowManager.setPosition(entry, x, y)
  x, y = math.floor(x), math.floor(y)
  if entry.isMain then
    love.window.setPosition(x, y)
    entry._lastX = x
    entry._lastY = y
  end
  -- Love2D secondary windows: no position API yet
end

--- Get a window's current position. Returns x, y.
--- Prefers the last SDL-reported position (accurate on Wayland/XWayland)
--- over love.window.getPosition() which can return stale values.
function WindowManager.getPosition(entry)
  if entry.isMain then
    if entry._lastX then
      return entry._lastX, entry._lastY
    end
    local x, y = love.window.getPosition()
    return x, y
  end
  return 0, 0
end

--- Set whether a window stays on top of all others.
function WindowManager.setAlwaysOnTop(entry, onTop)
  -- Not available in Love2D secondary window API yet
end

--- Raise a window to the front and give it input focus.
function WindowManager.raise(entry)
  -- Not available in Love2D secondary window API yet
end

--- Activate a secondary window's GL context.
function WindowManager.activate(entry)
  if entry.loveId then
    love.window.activateSecondary(entry.loveId)
  end
end

--- Swap buffers for a secondary window.
function WindowManager.swap(entry)
  if entry.loveId then
    love.window.swapSecondary(entry.loveId)
  end
end

--- Restore the main window's GL context.
function WindowManager.activateMain()
  love.window.activateMain()
end

--- Return count of all windows.
function WindowManager.count()
  local n = 0
  for _ in pairs(windows) do n = n + 1 end
  return n
end

-- ============================================================================
-- Animated resize
-- ============================================================================

local activeAnimations = 0

local function easeOutCubic(t)
  t = t - 1
  return t * t * t + 1
end

--- Animate a window to a target size over `durationMs` milliseconds.
function WindowManager.animateTo(entry, w, h, durationMs)
  w, h = math.floor(w), math.floor(h)
  if w == entry.width and h == entry.height then return end
  if not entry.anim then
    activeAnimations = activeAnimations + 1
  end
  entry.anim = {
    startW   = entry.width,
    startH   = entry.height,
    targetW  = w,
    targetH  = h,
    duration = (durationMs or 300) / 1000,
    elapsed  = 0,
  }
end

--- Animate a window to a target position over `durationMs` milliseconds.
function WindowManager.animatePositionTo(entry, x, y, durationMs)
  x, y = math.floor(x), math.floor(y)
  local cx, cy = WindowManager.getPosition(entry)
  if x == cx and y == cy then return end
  if not entry.posAnim then
    activeAnimations = activeAnimations + 1
  end
  entry.posAnim = {
    startX   = cx,
    startY   = cy,
    targetX  = x,
    targetY  = y,
    duration = (durationMs or 300) / 1000,
    elapsed  = 0,
  }
end

--- Tick all active window animations. Call once per frame.
--- Returns true if any animation is still in progress.
function WindowManager.tick(dt)
  if activeAnimations == 0 then return false end

  local still = false
  for _, entry in pairs(windows) do
    -- Size animation
    local a = entry.anim
    if a then
      a.elapsed = a.elapsed + dt
      if a.elapsed >= a.duration then
        WindowManager.setSize(entry, a.targetW, a.targetH)
        entry.anim = nil
        activeAnimations = activeAnimations - 1
      else
        local t = easeOutCubic(a.elapsed / a.duration)
        local cw = a.startW + (a.targetW - a.startW) * t
        local ch = a.startH + (a.targetH - a.startH) * t
        WindowManager.setSize(entry, cw, ch)
        still = true
      end
    end

    -- Position animation
    local p = entry.posAnim
    if p then
      p.elapsed = p.elapsed + dt
      if p.elapsed >= p.duration then
        WindowManager.setPosition(entry, p.targetX, p.targetY)
        entry.posAnim = nil
        activeAnimations = activeAnimations - 1
      else
        local t = easeOutCubic(p.elapsed / p.duration)
        local cx = p.startX + (p.targetX - p.startX) * t
        local cy = p.startY + (p.targetY - p.startY) * t
        WindowManager.setPosition(entry, cx, cy)
        still = true
      end
    end
  end
  return still
end

-- ============================================================================
-- Window geometry persistence (save/restore across restarts)
-- ============================================================================

local GEOMETRY_FILE = "save/window_geometry.json"
local geometrySaveBlockedUntil = 0

--- Save the main window's current geometry to disk.
--- Called on quit so the next launch can restore position+size.
function WindowManager.saveGeometry()
  if not mainWin then return end
  -- Block saves during/after restore to prevent async resize callbacks
  -- from overwriting the restored geometry with clamped values
  local now = love.timer and love.timer.getTime() or 0
  if now < geometrySaveBlockedUntil then return end

  -- love.window.getPosition returns display-relative coords + display index
  local x, y, display = love.window.getPosition()
  local w, h = mainWin.width, mainWin.height

  local data = string.format(
    '{"x":%d,"y":%d,"width":%d,"height":%d,"display":%d}',
    x, y, w, h, display
  )

  -- Ensure save directory exists
  local info = love.filesystem.getInfo("save")
  if not info then
    love.filesystem.createDirectory("save")
  end

  local ok, err = love.filesystem.write(GEOMETRY_FILE, data)
  if ok then
    io.write("[window_manager] saved geometry: " .. data .. "\n"); io.flush()
  else
    io.write("[window_manager] failed to save geometry: " .. tostring(err) .. "\n"); io.flush()
  end
end

--- Restore the main window's geometry from a previous session.
--- Call after registerMain() and after the window is fully initialized.
--- Returns true if geometry was restored, false otherwise.
function WindowManager.restoreGeometry()
  if not mainWin then return false end

  local info = love.filesystem.getInfo(GEOMETRY_FILE)
  if not info then return false end

  local contents, err = love.filesystem.read(GEOMETRY_FILE)
  if not contents then
    io.write("[window_manager] failed to read geometry: " .. tostring(err) .. "\n"); io.flush()
    return false
  end

  -- Minimal JSON parse for our known format
  local x = tonumber(contents:match('"x":([%-]?%d+)'))
  local y = tonumber(contents:match('"y":([%-]?%d+)'))
  local w = tonumber(contents:match('"width":(%d+)'))
  local h = tonumber(contents:match('"height":(%d+)'))
  local display = tonumber(contents:match('"display":(%d+)'))

  if not (x and y and w and h) then
    io.write("[window_manager] invalid geometry file, ignoring\n"); io.flush()
    return false
  end

  -- Validate saved display index still exists
  local displayCount = love.window.getDisplayCount()
  if display and display > displayCount then
    display = nil  -- display was unplugged, fall back to current
  end

  -- Validate position against the target display bounds
  local targetDisplay = display or 1
  local dw, dh = love.window.getDesktopDimensions(targetDisplay)
  if x < -w or x >= dw or y < -h or y >= dh then
    io.write("[window_manager] saved geometry is off-screen for display " .. targetDisplay .. ", ignoring\n"); io.flush()
    return false
  end

  -- Block geometry saves for 2 seconds to prevent async resize/move callbacks
  -- from overwriting the restored geometry with clamped intermediate values
  geometrySaveBlockedUntil = (love.timer and love.timer.getTime() or 0) + 2.0

  -- Move to correct display FIRST so the window manager doesn't clamp
  -- the size to the wrong monitor's dimensions
  love.window.setPosition(x, y, display or nil)
  WindowManager.setSize(mainWin, w, h)
  -- Re-apply position after resize (some WMs shift the window on resize)
  love.window.setPosition(x, y, display or nil)
  if mainWin.isMain then
    mainWin._lastX = nil
    mainWin._lastY = nil
  end

  io.write(string.format("[window_manager] restored geometry: %dx%d at (%d,%d) display=%s\n",
    w, h, x, y, tostring(display or "current"))); io.flush()
  return true
end

-- ============================================================================
-- Event-driven geometry persistence
-- ============================================================================

--- Called when the window is moved (SDL_WINDOWEVENT_MOVED).
--- Persists geometry so crashes don't lose position.
function WindowManager.handleMoved(x, y)
  if not mainWin then return end
  WindowManager.saveGeometry()
end

return WindowManager
