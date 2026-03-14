--[[
  videoplayer.lua -- Lua-native video player with overlay controls

  Renders the entire VideoPlayer UI (video frame + controls overlay) using
  Love2D drawing primitives, following the TextEditor/CodeBlock pattern where
  complex interactive primitives are drawn entirely in Lua.

  React declares <VideoPlayer src="..." /> as a single host element.
  Lua handles ALL rendering and interaction.

  State stored on node._vp (per-node, survives re-renders):
    showControls, controlsTimer, hoverTarget, draggingSeek,
    draggingVolume, volume, muted, isFullscreen

  Requires: measure.lua (for font), videos.lua (for playback queries/control)
]]

local Measure = nil
local Videos  = nil
local Focus   = require("lua.focus")

local VideoPlayer = {}

-- ============================================================================
-- Constants
-- ============================================================================

local CONTROLS_HEIGHT = 48       -- total height of controls bar
local GRADIENT_HEIGHT = 64       -- gradient overlay height
local SEEK_BAR_HEIGHT = 4        -- visual height
local SEEK_BAR_HIT_HEIGHT = 16   -- clickable area height
local SEEK_KNOB_RADIUS = 6      -- seek position indicator
local VOLUME_BAR_WIDTH = 60      -- volume slider width
local VOLUME_BAR_HEIGHT = 4      -- volume slider visual height
local BUTTON_SIZE = 32           -- play/pause/loop/fullscreen hit area
local CONTROLS_TIMEOUT = 3.0     -- seconds before auto-hide
local SEEK_STEP = 5              -- seconds per arrow key
local VOLUME_STEP = 0.1          -- volume per arrow key

-- ============================================================================
-- Colors
-- ============================================================================

local colors = {
  controlsBg     = { 0, 0, 0, 0.65 },
  seekBg         = { 1, 1, 1, 0.25 },
  seekFill       = { 1, 1, 1, 0.9 },
  seekKnob       = { 1, 1, 1, 1 },
  volumeBg       = { 1, 1, 1, 0.25 },
  volumeFill     = { 1, 1, 1, 0.8 },
  buttonNormal   = { 1, 1, 1, 0.8 },
  buttonHover    = { 1, 1, 1, 1 },
  buttonActive   = { 0.4, 0.7, 1, 1 },
  timeText       = { 1, 1, 1, 0.75 },
  gradientTop    = { 0, 0, 0, 0 },
  gradientBottom = { 0, 0, 0, 0.7 },
}

-- ============================================================================
-- Init
-- ============================================================================

local fullscreenNode = nil  -- currently fullscreen VideoPlayer node (or nil)

function VideoPlayer.init(config)
  config = config or {}
  Measure = config.measure
  Videos = config.videos
end

--- Return the currently fullscreen VideoPlayer node, or nil.
function VideoPlayer.getFullscreenNode()
  return fullscreenNode
end

-- ============================================================================
-- State management
-- ============================================================================

--- Get effective bounds (fullscreen overrides layout computed dimensions).
local function getBounds(node, state)
  if state and state.isFullscreen then
    local winW, winH = love.graphics.getDimensions()
    return { x = 0, y = 0, w = winW, h = winH }
  end
  return node.computed
end

--- Get or create per-node video player state.
local function getState(node)
  if not node._vp then
    node._vp = {
      showControls = true,
      controlsTimer = CONTROLS_TIMEOUT,
      hoverTarget = nil,        -- "play", "seek", "volume", "mute", "loop", "fullscreen", nil
      draggingSeek = false,
      draggingVolume = false,
      volume = (node.props and node.props.volume) or 1,
      muted = (node.props and node.props.muted) or false,
      isFullscreen = false,
      localPaused = nil,        -- local pause override (nil = use prop)
    }
  end
  return node._vp
end

--- Get effective paused state (local override > prop).
local function isPaused(node)
  local state = getState(node)
  if state.localPaused ~= nil then
    return state.localPaused
  end
  return node.props and node.props.paused
end

-- ============================================================================
-- Time formatting
-- ============================================================================

local function formatTime(seconds)
  if not seconds or seconds ~= seconds then return "--:--" end
  local mins = math.floor(seconds / 60)
  local secs = math.floor(seconds % 60)
  if secs < 10 then
    return mins .. ":0" .. secs
  end
  return mins .. ":" .. secs
end

-- ============================================================================
-- Drawing helpers
-- ============================================================================

--- Draw a gradient rectangle from top (transparent) to bottom (semi-black).
local function drawGradient(x, y, w, h, opacity)
  local steps = 16
  for i = 0, steps - 1 do
    local t = i / steps
    local alpha = t * colors.gradientBottom[4] * opacity
    love.graphics.setColor(0, 0, 0, alpha)
    local sy = y + t * h
    local sh = h / steps + 1  -- +1 to avoid seams
    love.graphics.rectangle("fill", x, sy, w, sh)
  end
end

--- Draw a play triangle (pointing right).
local function drawPlayIcon(cx, cy, size, color)
  love.graphics.setColor(color)
  local hw = size * 0.5
  local hh = size * 0.55
  love.graphics.polygon("fill",
    cx - hw * 0.5, cy - hh,
    cx - hw * 0.5, cy + hh,
    cx + hw, cy)
end

--- Draw a pause icon (two bars).
local function drawPauseIcon(cx, cy, size, color)
  love.graphics.setColor(color)
  local barW = size * 0.22
  local barH = size * 0.7
  local gap = size * 0.15
  love.graphics.rectangle("fill", cx - gap - barW, cy - barH / 2, barW, barH)
  love.graphics.rectangle("fill", cx + gap, cy - barH / 2, barW, barH)
end

--- Draw a speaker/volume icon.
local function drawVolumeIcon(cx, cy, size, muted, color)
  love.graphics.setColor(color)
  -- Speaker body (small rectangle)
  local bodyW = size * 0.2
  local bodyH = size * 0.35
  local sx = cx - size * 0.25
  love.graphics.rectangle("fill", sx, cy - bodyH / 2, bodyW, bodyH)
  -- Speaker cone (triangle)
  local coneW = size * 0.25
  love.graphics.polygon("fill",
    sx + bodyW, cy - bodyH / 2,
    sx + bodyW + coneW, cy - size * 0.35,
    sx + bodyW + coneW, cy + size * 0.35,
    sx + bodyW, cy + bodyH / 2)

  if muted then
    -- X through the speaker
    love.graphics.setLineWidth(2)
    local ox = cx + size * 0.15
    local d = size * 0.18
    love.graphics.line(ox - d, cy - d, ox + d, cy + d)
    love.graphics.line(ox - d, cy + d, ox + d, cy - d)
    love.graphics.setLineWidth(1)
  else
    -- Sound waves (arcs)
    love.graphics.setLineWidth(1.5)
    local ox = cx + size * 0.15
    local arcR = size * 0.2
    love.graphics.arc("line", "open", ox, cy, arcR, -math.pi / 4, math.pi / 4)
    love.graphics.setLineWidth(1)
  end
end

--- Draw a loop icon (circular arrow).
local function drawLoopIcon(cx, cy, size, active, color)
  love.graphics.setColor(color)
  love.graphics.setLineWidth(1.5)
  local r = size * 0.3
  -- Draw most of a circle
  love.graphics.arc("line", "open", cx, cy, r, 0, math.pi * 1.6)
  -- Arrowhead at the end of the arc
  local ax = cx + r * math.cos(math.pi * 1.6)
  local ay = cy + r * math.sin(math.pi * 1.6)
  local asize = size * 0.12
  love.graphics.polygon("fill",
    ax, ay,
    ax + asize, ay - asize,
    ax + asize, ay + asize)
  love.graphics.setLineWidth(1)
end

--- Draw a fullscreen icon (four corners).
local function drawFullscreenIcon(cx, cy, size, color)
  love.graphics.setColor(color)
  love.graphics.setLineWidth(1.5)
  local d = size * 0.28
  local s = size * 0.15
  -- Top-left corner
  love.graphics.line(cx - d, cy - d + s, cx - d, cy - d, cx - d + s, cy - d)
  -- Top-right corner
  love.graphics.line(cx + d - s, cy - d, cx + d, cy - d, cx + d, cy - d + s)
  -- Bottom-left corner
  love.graphics.line(cx - d, cy + d - s, cx - d, cy + d, cx - d + s, cy + d)
  -- Bottom-right corner
  love.graphics.line(cx + d - s, cy + d, cx + d, cy + d, cx + d, cy + d - s)
  love.graphics.setLineWidth(1)
end

-- ============================================================================
-- Hit testing within controls
-- ============================================================================

--- Determine which control element (if any) is at (mx, my) relative to the node.
--- Returns "play", "seek", "mute", "volume", "loop", "fullscreen", "video", or nil.
local function hitTestControls(node, mx, my)
  local state = getState(node)
  local c = getBounds(node, state)
  if not c then return nil end
  if not state.showControls then
    -- Controls hidden: entire area is "video"
    if mx >= c.x and mx <= c.x + c.w and my >= c.y and my <= c.y + c.h then
      return "video"
    end
    return nil
  end

  -- Controls bar region (bottom of video)
  local barY = c.y + c.h - CONTROLS_HEIGHT
  local barX = c.x

  -- Seek bar: full width, above the button row
  local seekY = barY
  local seekH = SEEK_BAR_HIT_HEIGHT
  if my >= seekY - seekH / 2 and my <= seekY + seekH / 2 and mx >= c.x and mx <= c.x + c.w then
    return "seek"
  end

  -- Button row: below seek bar
  local rowY = barY + SEEK_BAR_HIT_HEIGHT / 2
  local rowH = CONTROLS_HEIGHT - SEEK_BAR_HIT_HEIGHT / 2

  if my >= rowY and my <= rowY + rowH then
    -- Play/pause button (left side)
    local playX = barX + 8
    if mx >= playX and mx <= playX + BUTTON_SIZE then
      return "play"
    end

    -- Right side buttons (from right edge inward)
    local rightEdge = c.x + c.w - 8

    -- Fullscreen button (rightmost)
    local fsX = rightEdge - BUTTON_SIZE
    if mx >= fsX and mx <= fsX + BUTTON_SIZE then
      return "fullscreen"
    end

    -- Loop button
    local loopX = fsX - BUTTON_SIZE - 4
    if mx >= loopX and mx <= loopX + BUTTON_SIZE then
      return "loop"
    end

    -- Volume slider
    local volSliderEnd = loopX - 8
    local volSliderStart = volSliderEnd - VOLUME_BAR_WIDTH
    if mx >= volSliderStart and mx <= volSliderEnd then
      return "volume"
    end

    -- Mute button (left of volume slider)
    local muteX = volSliderStart - BUTTON_SIZE - 4
    if mx >= muteX and mx <= muteX + BUTTON_SIZE then
      return "mute"
    end
  end

  -- Anywhere else in the video area
  if mx >= c.x and mx <= c.x + c.w and my >= c.y and my <= c.y + c.h then
    return "video"
  end

  return nil
end

-- ============================================================================
-- Drawing
-- ============================================================================

--- Main draw function — called from painter.lua.
function VideoPlayer.draw(node, effectiveOpacity)
  if not Videos then return end

  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local src = node.props and node.props.src
  if not src then return end

  local state = getState(node)
  c = getBounds(node, state)

  local status = Videos.getStatus(src)
  local borderRadius = state.isFullscreen and 0 or ((node.style and node.style.borderRadius) or 0)

  -- Apply playback control from local state
  Videos.setPaused(src, isPaused(node))
  Videos.setMuted(src, state.muted)
  Videos.setVolume(src, state.volume)
  Videos.setLoop(src, node.props.loop)

  -- Fullscreen: black background covering everything
  if state.isFullscreen then
    love.graphics.setColor(0, 0, 0, 1)
    love.graphics.rectangle("fill", 0, 0, c.w, c.h)
  end

  -- 1. Draw the video frame (or placeholder)
  if status == "ready" then
    local canvas = Videos.get(src)
    if canvas then
      local objectFit = (node.style and node.style.objectFit) or "contain"
      local vidW, vidH = Videos.getDimensions(src)
      if not vidW then vidW, vidH = canvas:getWidth(), canvas:getHeight() end

      local scaleX, scaleY, drawX, drawY
      if objectFit == "contain" then
        local scale = math.min(c.w / vidW, c.h / vidH)
        scaleX = scale
        scaleY = scale
        local drawW = vidW * scale
        local drawH = vidH * scale
        drawX = c.x + (c.w - drawW) / 2
        drawY = c.y + (c.h - drawH) / 2
      elseif objectFit == "cover" then
        local scale = math.max(c.w / vidW, c.h / vidH)
        scaleX = scale
        scaleY = scale
        local drawW = vidW * scale
        local drawH = vidH * scale
        drawX = c.x + (c.w - drawW) / 2
        drawY = c.y + (c.h - drawH) / 2
      else
        -- "fill"
        scaleX = c.w / vidW
        scaleY = c.h / vidH
        drawX = c.x
        drawY = c.y
      end

      -- Clip to border radius if needed
      local videoStencil = borderRadius > 0
      if videoStencil then
        love.graphics.stencil(function()
          love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
        end, "replace", 1)
        love.graphics.setStencilTest("greater", 0)
      end

      love.graphics.setColor(1, 1, 1, effectiveOpacity)
      love.graphics.draw(canvas, drawX, drawY, 0, scaleX, scaleY)

      if videoStencil then
        love.graphics.setStencilTest()
      end
    end
  else
    -- Loading/error placeholder: dark surface with play triangle
    love.graphics.setColor(0.10, 0.11, 0.14, effectiveOpacity)
    love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
    love.graphics.setColor(0.20, 0.22, 0.28, 0.5 * effectiveOpacity)
    love.graphics.rectangle("line", c.x, c.y, c.w, c.h, borderRadius, borderRadius)

    local iconSize = math.min(c.w, c.h) * 0.15
    if iconSize > 6 then
      drawPlayIcon(c.x + c.w / 2, c.y + c.h / 2, iconSize,
        { 0.30, 0.33, 0.40, 0.5 * effectiveOpacity })
    end
  end

  -- 2. Draw controls overlay (if visible)
  if not state.showControls then return end

  local controls = (node.props and node.props.controls)
  if controls == false then return end

  local currentTime = Videos.getCurrentTime(src) or 0
  local duration = Videos.getDuration(src) or 0
  local progress = duration > 0 and (currentTime / duration) or 0

  -- Clip overlay to border radius
  local overlayStencil = borderRadius > 0
  if overlayStencil then
    love.graphics.stencil(function()
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
    end, "replace", 1)
    love.graphics.setStencilTest("greater", 0)
  end

  -- Gradient overlay at bottom
  drawGradient(c.x, c.y + c.h - GRADIENT_HEIGHT, c.w, GRADIENT_HEIGHT, effectiveOpacity)

  local barY = c.y + c.h - CONTROLS_HEIGHT
  local hoverTarget = state.hoverTarget

  -- Seek bar (full width)
  local seekY = barY + 2
  local seekBarX = c.x + 8
  local seekBarW = c.w - 16
  -- Background track
  love.graphics.setColor(colors.seekBg[1], colors.seekBg[2], colors.seekBg[3],
    colors.seekBg[4] * effectiveOpacity)
  love.graphics.rectangle("fill", seekBarX, seekY, seekBarW, SEEK_BAR_HEIGHT, 2, 2)
  -- Fill track
  local fillW = seekBarW * progress
  love.graphics.setColor(colors.seekFill[1], colors.seekFill[2], colors.seekFill[3],
    colors.seekFill[4] * effectiveOpacity)
  love.graphics.rectangle("fill", seekBarX, seekY, fillW, SEEK_BAR_HEIGHT, 2, 2)
  -- Seek knob (only when hovering seek or dragging)
  if hoverTarget == "seek" or state.draggingSeek then
    local knobX = seekBarX + fillW
    local knobY = seekY + SEEK_BAR_HEIGHT / 2
    love.graphics.setColor(colors.seekKnob[1], colors.seekKnob[2], colors.seekKnob[3],
      colors.seekKnob[4] * effectiveOpacity)
    love.graphics.circle("fill", knobX, knobY, SEEK_KNOB_RADIUS)
  end

  -- Button row
  local rowY = barY + SEEK_BAR_HIT_HEIGHT / 2 + 2
  local rowCenterY = rowY + (CONTROLS_HEIGHT - SEEK_BAR_HIT_HEIGHT / 2) / 2 - 2

  -- Play/pause button
  local playX = c.x + 8
  local playCX = playX + BUTTON_SIZE / 2
  local playColor = hoverTarget == "play" and colors.buttonHover or colors.buttonNormal
  if isPaused(node) then
    drawPlayIcon(playCX, rowCenterY, BUTTON_SIZE * 0.6,
      { playColor[1], playColor[2], playColor[3], playColor[4] * effectiveOpacity })
  else
    drawPauseIcon(playCX, rowCenterY, BUTTON_SIZE * 0.6,
      { playColor[1], playColor[2], playColor[3], playColor[4] * effectiveOpacity })
  end

  -- Time text
  do
    local timeStr = formatTime(currentTime) .. " / " .. formatTime(duration)
    local fontSize = 12
    local font = Measure.getFont(fontSize)
    love.graphics.setFont(font)
    love.graphics.setColor(colors.timeText[1], colors.timeText[2], colors.timeText[3],
      colors.timeText[4] * effectiveOpacity)
    local textH = font:getHeight()
    love.graphics.print(timeStr, playX + BUTTON_SIZE + 8, rowCenterY - textH / 2)
  end

  -- Right side controls (from right edge inward)
  local rightEdge = c.x + c.w - 8

  -- Fullscreen button
  local fsX = rightEdge - BUTTON_SIZE
  local fsCX = fsX + BUTTON_SIZE / 2
  local fsColor = hoverTarget == "fullscreen" and colors.buttonHover or colors.buttonNormal
  drawFullscreenIcon(fsCX, rowCenterY, BUTTON_SIZE * 0.65,
    { fsColor[1], fsColor[2], fsColor[3], fsColor[4] * effectiveOpacity })

  -- Loop button
  local loopActive = node.props and node.props.loop
  local loopX = fsX - BUTTON_SIZE - 4
  local loopCX = loopX + BUTTON_SIZE / 2
  local loopColor
  if loopActive then
    loopColor = colors.buttonActive
  elseif hoverTarget == "loop" then
    loopColor = colors.buttonHover
  else
    loopColor = colors.buttonNormal
  end
  drawLoopIcon(loopCX, rowCenterY, BUTTON_SIZE * 0.65, loopActive,
    { loopColor[1], loopColor[2], loopColor[3], loopColor[4] * effectiveOpacity })

  -- Volume slider
  local volSliderEnd = loopX - 8
  local volSliderStart = volSliderEnd - VOLUME_BAR_WIDTH
  local volY = rowCenterY - VOLUME_BAR_HEIGHT / 2
  -- Background
  love.graphics.setColor(colors.volumeBg[1], colors.volumeBg[2], colors.volumeBg[3],
    colors.volumeBg[4] * effectiveOpacity)
  love.graphics.rectangle("fill", volSliderStart, volY, VOLUME_BAR_WIDTH, VOLUME_BAR_HEIGHT, 2, 2)
  -- Fill
  local effectiveVolume = state.muted and 0 or state.volume
  local volFillW = VOLUME_BAR_WIDTH * effectiveVolume
  love.graphics.setColor(colors.volumeFill[1], colors.volumeFill[2], colors.volumeFill[3],
    colors.volumeFill[4] * effectiveOpacity)
  love.graphics.rectangle("fill", volSliderStart, volY, volFillW, VOLUME_BAR_HEIGHT, 2, 2)

  -- Mute button
  local muteX = volSliderStart - BUTTON_SIZE - 4
  local muteCX = muteX + BUTTON_SIZE / 2
  local muteColor = hoverTarget == "mute" and colors.buttonHover or colors.buttonNormal
  drawVolumeIcon(muteCX, rowCenterY, BUTTON_SIZE * 0.65, state.muted,
    { muteColor[1], muteColor[2], muteColor[3], muteColor[4] * effectiveOpacity })

  -- Restore stencil
  if overlayStencil then
    love.graphics.setStencilTest()
  end
end

-- ============================================================================
-- Update (called each frame)
-- ============================================================================

--- Tick controls auto-hide timer.
function VideoPlayer.update(dt, nodes)
  if not nodes then return end
  for _, node in pairs(nodes) do
    if node.type == "VideoPlayer" and node._vp then
      local state = node._vp
      if state.showControls and not isPaused(node) and not state.draggingSeek and not state.draggingVolume then
        state.controlsTimer = state.controlsTimer - dt
        if state.controlsTimer <= 0 then
          state.showControls = false
          state.hoverTarget = nil
        end
      end
    end
  end
end

--- Reset controls visibility timer.
local function showControls(state)
  state.showControls = true
  state.controlsTimer = CONTROLS_TIMEOUT
end

-- ============================================================================
-- Mouse interaction
-- ============================================================================

--- Handle mouse pressed on a VideoPlayer node.
--- Returns true if consumed.
function VideoPlayer.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  if not Videos then return false end

  local state = getState(node)
  local c = getBounds(node, state)
  if not c then return false end

  -- Check if click is inside the node
  if mx < c.x or mx > c.x + c.w or my < c.y or my > c.y + c.h then
    return false
  end

  showControls(state)

  local target = hitTestControls(node, mx, my)

  if target == "play" or target == "video" then
    -- Toggle play/pause; restart from beginning if video ended
    local wasPaused = isPaused(node)
    local src = node.props and node.props.src
    if wasPaused and src then
      local ct = Videos.getCurrentTime(src) or 0
      local dur = Videos.getDuration(src) or 0
      if dur > 0 and ct >= dur - 0.5 then
        Videos.seek(src, 0)
      end
    end
    state.localPaused = not wasPaused
    return true

  elseif target == "seek" then
    -- Start seek drag
    state.draggingSeek = true
    local seekBarX = c.x + 8
    local seekBarW = c.w - 16
    local ratio = math.max(0, math.min(1, (mx - seekBarX) / seekBarW))
    local duration = Videos.getDuration(node.props.src) or 0
    Videos.seek(node.props.src, ratio * duration)
    return true

  elseif target == "mute" then
    state.muted = not state.muted
    return true

  elseif target == "volume" then
    -- Start volume drag
    state.draggingVolume = true
    local volSliderEnd = c.x + c.w - 8 - BUTTON_SIZE - 4 - BUTTON_SIZE - 4 - 8
    local volSliderStart = volSliderEnd - VOLUME_BAR_WIDTH
    local ratio = math.max(0, math.min(1, (mx - volSliderStart) / VOLUME_BAR_WIDTH))
    state.volume = ratio
    state.muted = false
    return true

  elseif target == "loop" then
    -- Toggle loop (this modifies the prop, which will be picked up next frame)
    local currentLoop = node.props and node.props.loop
    node.props.loop = not currentLoop
    return true

  elseif target == "fullscreen" then
    state.isFullscreen = not state.isFullscreen
    love.window.setFullscreen(state.isFullscreen)
    fullscreenNode = state.isFullscreen and node or nil
    return true
  end

  return false
end

--- Handle mouse moved over a VideoPlayer node.
--- Returns true if consumed.
function VideoPlayer.handleMouseMoved(node, mx, my)
  local state = getState(node)
  local c = getBounds(node, state)
  if not c then return false end

  -- Check if mouse is inside the node
  local inside = mx >= c.x and mx <= c.x + c.w and my >= c.y and my <= c.y + c.h
  if not inside and not state.draggingSeek and not state.draggingVolume then
    state.hoverTarget = nil
    return false
  end

  showControls(state)

  -- Handle seek drag
  if state.draggingSeek and Videos then
    local seekBarX = c.x + 8
    local seekBarW = c.w - 16
    local ratio = math.max(0, math.min(1, (mx - seekBarX) / seekBarW))
    local duration = Videos.getDuration(node.props.src) or 0
    Videos.seek(node.props.src, ratio * duration)
    return true
  end

  -- Handle volume drag
  if state.draggingVolume then
    local rightEdge = c.x + c.w - 8
    local fsEnd = rightEdge - BUTTON_SIZE
    local loopEnd = fsEnd - BUTTON_SIZE - 4
    local volSliderEnd = loopEnd - 8
    local volSliderStart = volSliderEnd - VOLUME_BAR_WIDTH
    local ratio = math.max(0, math.min(1, (mx - volSliderStart) / VOLUME_BAR_WIDTH))
    state.volume = ratio
    state.muted = false
    return true
  end

  -- Update hover target
  state.hoverTarget = hitTestControls(node, mx, my)
  if state.hoverTarget == "video" then
    state.hoverTarget = nil  -- "video" is not a control
  end

  return inside
end

--- Handle mouse released.
--- Returns true if consumed.
function VideoPlayer.handleMouseReleased(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local consumed = state.draggingSeek or state.draggingVolume
  state.draggingSeek = false
  state.draggingVolume = false
  return consumed
end

-- ============================================================================
-- Keyboard interaction
-- ============================================================================

--- Handle keyboard input for a VideoPlayer node.
--- Returns true if consumed.
function VideoPlayer.handleKeyPressed(node, key)
  if not Videos then return false end

  local state = getState(node)
  local src = node.props and node.props.src
  if not src then return false end

  showControls(state)

  if key == "escape" and state.isFullscreen then
    state.isFullscreen = false
    love.window.setFullscreen(false)
    fullscreenNode = nil
    return true

  elseif key == "space" then
    local wasPaused = isPaused(node)
    local src2 = node.props and node.props.src
    if wasPaused and src2 then
      local ct = Videos.getCurrentTime(src2) or 0
      local dur = Videos.getDuration(src2) or 0
      if dur > 0 and ct >= dur - 0.5 then
        Videos.seek(src2, 0)
      end
    end
    state.localPaused = not wasPaused
    return true

  elseif key == "left" then
    local ct = Videos.getCurrentTime(src) or 0
    Videos.seek(src, math.max(0, ct - SEEK_STEP))
    return true

  elseif key == "right" then
    local ct = Videos.getCurrentTime(src) or 0
    local dur = Videos.getDuration(src) or 0
    Videos.seek(src, math.min(dur, ct + SEEK_STEP))
    return true

  elseif key == "up" then
    state.volume = math.min(1, state.volume + VOLUME_STEP)
    state.muted = false
    return true

  elseif key == "down" then
    state.volume = math.max(0, state.volume - VOLUME_STEP)
    return true

  elseif key == "m" then
    state.muted = not state.muted
    return true

  elseif key == "f" then
    state.isFullscreen = not state.isFullscreen
    love.window.setFullscreen(state.isFullscreen)
    fullscreenNode = state.isFullscreen and node or nil
    return true

  elseif key == "l" then
    local currentLoop = node.props and node.props.loop
    node.props.loop = not currentLoop
    return true
  end

  return false
end

return VideoPlayer
