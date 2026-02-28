--[[
  sdl2_videoplayer.lua -- Lua-native video player with overlay controls (SDL2 target)

  Port of videoplayer.lua for the SDL2 target. Uses OpenGL immediate mode
  instead of Love2D drawing primitives. Same controls UI: play/pause, seek bar,
  volume, mute, loop, fullscreen, time display, auto-hide.

  React declares <VideoPlayer src="..." /> as a single host element.
  Lua handles ALL rendering and interaction.

  State stored on node._vp (per-node, survives re-renders):
    showControls, controlsTimer, hoverTarget, draggingSeek,
    draggingVolume, volume, muted, isFullscreen
]]

local GL   = require("lua.sdl2_gl")
local Font = require("lua.sdl2_font")

local Measure = nil
local Videos  = nil
local Images  = nil
local Focus   = require("lua.focus")

local VideoPlayer = {}

-- ============================================================================
-- Constants
-- ============================================================================

local CONTROLS_HEIGHT = 48
local GRADIENT_HEIGHT = 64
local SEEK_BAR_HEIGHT = 4
local SEEK_BAR_HIT_HEIGHT = 16
local SEEK_KNOB_RADIUS = 6
local VOLUME_BAR_WIDTH = 60
local VOLUME_BAR_HEIGHT = 4
local BUTTON_SIZE = 32
local CONTROLS_TIMEOUT = 3.0
local SEEK_STEP = 5
local VOLUME_STEP = 0.1

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

local fullscreenNode = nil

function VideoPlayer.init(config)
  config = config or {}
  Measure = config.measure
  Videos = config.videos
  Images = require("lua.sdl2_images")
end

function VideoPlayer.getFullscreenNode()
  return fullscreenNode
end

-- ============================================================================
-- GL drawing helpers
-- ============================================================================

local function glRect(x, y, w, h)
  GL.glBegin(GL.QUADS)
    GL.glVertex2f(x,     y)
    GL.glVertex2f(x + w, y)
    GL.glVertex2f(x + w, y + h)
    GL.glVertex2f(x,     y + h)
  GL.glEnd()
end

local function glCircle(cx, cy, r, segments)
  segments = segments or 24
  GL.glBegin(GL.TRIANGLE_FAN)
    GL.glVertex2f(cx, cy)
    for i = 0, segments do
      local angle = (i / segments) * math.pi * 2
      GL.glVertex2f(cx + math.cos(angle) * r, cy + math.sin(angle) * r)
    end
  GL.glEnd()
end

local function glLine(x1, y1, x2, y2)
  GL.glBegin(GL.LINES)
    GL.glVertex2f(x1, y1)
    GL.glVertex2f(x2, y2)
  GL.glEnd()
end

local function glTriangle(x1, y1, x2, y2, x3, y3)
  GL.glBegin(GL.TRIANGLES)
    GL.glVertex2f(x1, y1)
    GL.glVertex2f(x2, y2)
    GL.glVertex2f(x3, y3)
  GL.glEnd()
end

local function glQuad(x1, y1, x2, y2, x3, y3, x4, y4)
  GL.glBegin(GL.QUADS)
    GL.glVertex2f(x1, y1)
    GL.glVertex2f(x2, y2)
    GL.glVertex2f(x3, y3)
    GL.glVertex2f(x4, y4)
  GL.glEnd()
end

-- ============================================================================
-- State management
-- ============================================================================

local function getBounds(node, state)
  -- Fullscreen not implemented for SDL2 yet (needs SDL_SetWindowFullscreen)
  return node.computed
end

local function getState(node)
  if not node._vp then
    node._vp = {
      showControls = true,
      controlsTimer = CONTROLS_TIMEOUT,
      hoverTarget = nil,
      draggingSeek = false,
      draggingVolume = false,
      volume = (node.props and node.props.volume) or 1,
      muted = (node.props and node.props.muted) or false,
      isFullscreen = false,
      localPaused = nil,
    }
  end
  return node._vp
end

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

local function drawGradient(x, y, w, h, opacity)
  local steps = 16
  GL.glBegin(GL.QUADS)
  for i = 0, steps - 1 do
    local t0 = i / steps
    local t1 = (i + 1) / steps
    local a0 = t0 * colors.gradientBottom[4] * opacity
    local a1 = t1 * colors.gradientBottom[4] * opacity
    local sy0 = y + t0 * h
    local sy1 = y + t1 * h
    GL.glColor4f(0, 0, 0, a0)
    GL.glVertex2f(x,     sy0)
    GL.glVertex2f(x + w, sy0)
    GL.glColor4f(0, 0, 0, a1)
    GL.glVertex2f(x + w, sy1)
    GL.glVertex2f(x,     sy1)
  end
  GL.glEnd()
end

local function drawPlayIcon(cx, cy, size, color)
  GL.glColor4f(color[1], color[2], color[3], color[4])
  local hw = size * 0.5
  local hh = size * 0.55
  glTriangle(
    cx - hw * 0.5, cy - hh,
    cx - hw * 0.5, cy + hh,
    cx + hw, cy)
end

local function drawPauseIcon(cx, cy, size, color)
  GL.glColor4f(color[1], color[2], color[3], color[4])
  local barW = size * 0.22
  local barH = size * 0.7
  local gap = size * 0.15
  glRect(cx - gap - barW, cy - barH / 2, barW, barH)
  glRect(cx + gap, cy - barH / 2, barW, barH)
end

local function drawVolumeIcon(cx, cy, size, muted, color)
  GL.glColor4f(color[1], color[2], color[3], color[4])
  local bodyW = size * 0.2
  local bodyH = size * 0.35
  local sx = cx - size * 0.25
  -- Speaker body
  glRect(sx, cy - bodyH / 2, bodyW, bodyH)
  -- Speaker cone
  glQuad(
    sx + bodyW, cy - bodyH / 2,
    sx + bodyW + size * 0.25, cy - size * 0.35,
    sx + bodyW + size * 0.25, cy + size * 0.35,
    sx + bodyW, cy + bodyH / 2)

  if muted then
    -- X through the speaker
    GL.glLineWidth(2)
    local ox = cx + size * 0.15
    local d = size * 0.18
    glLine(ox - d, cy - d, ox + d, cy + d)
    glLine(ox - d, cy + d, ox + d, cy - d)
    GL.glLineWidth(1)
  else
    -- Sound wave arc (line strip approximation)
    GL.glLineWidth(1.5)
    local ox = cx + size * 0.15
    local arcR = size * 0.2
    local segments = 8
    GL.glBegin(GL.LINE_STRIP)
    for i = 0, segments do
      local a = -math.pi / 4 + (math.pi / 2) * (i / segments)
      GL.glVertex2f(ox + math.cos(a) * arcR, cy + math.sin(a) * arcR)
    end
    GL.glEnd()
    GL.glLineWidth(1)
  end
end

local function drawLoopIcon(cx, cy, size, active, color)
  GL.glColor4f(color[1], color[2], color[3], color[4])
  GL.glLineWidth(1.5)
  local r = size * 0.3
  -- Draw most of a circle as line strip
  local segments = 16
  GL.glBegin(GL.LINE_STRIP)
  for i = 0, segments do
    local a = (i / segments) * math.pi * 1.6
    GL.glVertex2f(cx + math.cos(a) * r, cy + math.sin(a) * r)
  end
  GL.glEnd()
  -- Arrowhead
  local ax = cx + r * math.cos(math.pi * 1.6)
  local ay = cy + r * math.sin(math.pi * 1.6)
  local asize = size * 0.12
  glTriangle(ax, ay, ax + asize, ay - asize, ax + asize, ay + asize)
  GL.glLineWidth(1)
end

local function drawFullscreenIcon(cx, cy, size, color)
  GL.glColor4f(color[1], color[2], color[3], color[4])
  GL.glLineWidth(1.5)
  local d = size * 0.28
  local s = size * 0.15
  -- Top-left corner
  GL.glBegin(GL.LINE_STRIP)
    GL.glVertex2f(cx - d, cy - d + s)
    GL.glVertex2f(cx - d, cy - d)
    GL.glVertex2f(cx - d + s, cy - d)
  GL.glEnd()
  -- Top-right corner
  GL.glBegin(GL.LINE_STRIP)
    GL.glVertex2f(cx + d - s, cy - d)
    GL.glVertex2f(cx + d, cy - d)
    GL.glVertex2f(cx + d, cy - d + s)
  GL.glEnd()
  -- Bottom-left corner
  GL.glBegin(GL.LINE_STRIP)
    GL.glVertex2f(cx - d, cy + d - s)
    GL.glVertex2f(cx - d, cy + d)
    GL.glVertex2f(cx - d + s, cy + d)
  GL.glEnd()
  -- Bottom-right corner
  GL.glBegin(GL.LINE_STRIP)
    GL.glVertex2f(cx + d - s, cy + d)
    GL.glVertex2f(cx + d, cy + d)
    GL.glVertex2f(cx + d, cy + d - s)
  GL.glEnd()
  GL.glLineWidth(1)
end

-- ============================================================================
-- Hit testing within controls
-- ============================================================================

local function hitTestControls(node, mx, my)
  local state = getState(node)
  local c = getBounds(node, state)
  if not c then return nil end
  if not state.showControls then
    if mx >= c.x and mx <= c.x + c.w and my >= c.y and my <= c.y + c.h then
      return "video"
    end
    return nil
  end

  local barY = c.y + c.h - CONTROLS_HEIGHT
  local barX = c.x

  local seekY = barY
  local seekH = SEEK_BAR_HIT_HEIGHT
  if my >= seekY - seekH / 2 and my <= seekY + seekH / 2 and mx >= c.x and mx <= c.x + c.w then
    return "seek"
  end

  local rowY = barY + SEEK_BAR_HIT_HEIGHT / 2
  local rowH = CONTROLS_HEIGHT - SEEK_BAR_HIT_HEIGHT / 2

  if my >= rowY and my <= rowY + rowH then
    local playX = barX + 8
    if mx >= playX and mx <= playX + BUTTON_SIZE then
      return "play"
    end

    local rightEdge = c.x + c.w - 8
    local fsX = rightEdge - BUTTON_SIZE
    if mx >= fsX and mx <= fsX + BUTTON_SIZE then
      return "fullscreen"
    end

    local loopX = fsX - BUTTON_SIZE - 4
    if mx >= loopX and mx <= loopX + BUTTON_SIZE then
      return "loop"
    end

    local volSliderEnd = loopX - 8
    local volSliderStart = volSliderEnd - VOLUME_BAR_WIDTH
    if mx >= volSliderStart and mx <= volSliderEnd then
      return "volume"
    end

    local muteX = volSliderStart - BUTTON_SIZE - 4
    if mx >= muteX and mx <= muteX + BUTTON_SIZE then
      return "mute"
    end
  end

  if mx >= c.x and mx <= c.x + c.w and my >= c.y and my <= c.y + c.h then
    return "video"
  end

  return nil
end

-- ============================================================================
-- Drawing
-- ============================================================================

function VideoPlayer.draw(node, effectiveOpacity)
  if not Videos then return end

  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local src = node.props and node.props.src
  if not src then return end

  local state = getState(node)
  c = getBounds(node, state)

  local status = Videos.getStatus(src)
  local borderRadius = (node.style and node.style.borderRadius) or 0

  -- Apply playback control from local state
  Videos.setPaused(src, isPaused(node))
  Videos.setMuted(src, state.muted)
  Videos.setVolume(src, state.volume)
  Videos.setLoop(src, node.props.loop)

  -- 1. Draw video frame (or placeholder)
  if status == "ready" then
    local vidEntry = Videos.get(src)
    if vidEntry then
      local objectFit = (node.style and node.style.objectFit) or "contain"
      local vidW, vidH = vidEntry.w, vidEntry.h

      local drawX, drawY, drawW, drawH
      if objectFit == "contain" then
        local scale = math.min(c.w / vidW, c.h / vidH)
        drawW = vidW * scale
        drawH = vidH * scale
        drawX = c.x + (c.w - drawW) / 2
        drawY = c.y + (c.h - drawH) / 2
      elseif objectFit == "cover" then
        local scale = math.max(c.w / vidW, c.h / vidH)
        drawW = vidW * scale
        drawH = vidH * scale
        drawX = c.x + (c.w - drawW) / 2
        drawY = c.y + (c.h - drawH) / 2
      else -- "fill"
        drawX = c.x
        drawY = c.y
        drawW = c.w
        drawH = c.h
      end

      -- Draw video as textured quad
      if Images and Images.drawTexture then
        Images.drawTexture(vidEntry.texId, drawX, drawY, drawW, drawH, effectiveOpacity)
      end
    end
  else
    -- Loading/error placeholder
    GL.glColor4f(0.10, 0.11, 0.14, effectiveOpacity)
    glRect(c.x, c.y, c.w, c.h)

    local iconSize = math.min(c.w, c.h) * 0.15
    if iconSize > 6 then
      drawPlayIcon(c.x + c.w / 2, c.y + c.h / 2, iconSize,
        { 0.30, 0.33, 0.40, 0.5 * effectiveOpacity })
    end
  end

  -- 2. Draw controls overlay
  if not state.showControls then return end

  local controls = (node.props and node.props.controls)
  if controls == false then return end

  local currentTime = Videos.getCurrentTime(src) or 0
  local duration = Videos.getDuration(src) or 0
  local progress = duration > 0 and (currentTime / duration) or 0

  -- Gradient overlay at bottom
  drawGradient(c.x, c.y + c.h - GRADIENT_HEIGHT, c.w, GRADIENT_HEIGHT, effectiveOpacity)

  local barY = c.y + c.h - CONTROLS_HEIGHT
  local hoverTarget = state.hoverTarget

  -- Seek bar (full width)
  local seekY = barY + 2
  local seekBarX = c.x + 8
  local seekBarW = c.w - 16
  -- Background track
  GL.glColor4f(colors.seekBg[1], colors.seekBg[2], colors.seekBg[3],
    colors.seekBg[4] * effectiveOpacity)
  glRect(seekBarX, seekY, seekBarW, SEEK_BAR_HEIGHT)
  -- Fill track
  local fillW = seekBarW * progress
  GL.glColor4f(colors.seekFill[1], colors.seekFill[2], colors.seekFill[3],
    colors.seekFill[4] * effectiveOpacity)
  glRect(seekBarX, seekY, fillW, SEEK_BAR_HEIGHT)
  -- Seek knob
  if hoverTarget == "seek" or state.draggingSeek then
    local knobX = seekBarX + fillW
    local knobY = seekY + SEEK_BAR_HEIGHT / 2
    GL.glColor4f(colors.seekKnob[1], colors.seekKnob[2], colors.seekKnob[3],
      colors.seekKnob[4] * effectiveOpacity)
    glCircle(knobX, knobY, SEEK_KNOB_RADIUS)
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
    local textH = Font.lineHeight(fontSize)
    local textY = rowCenterY - textH / 2
    GL.glColor4f(colors.timeText[1], colors.timeText[2], colors.timeText[3],
      colors.timeText[4] * effectiveOpacity)
    Font.draw(timeStr, playX + BUTTON_SIZE + 8, textY, fontSize,
      colors.timeText[1], colors.timeText[2], colors.timeText[3],
      colors.timeText[4] * effectiveOpacity)
  end

  -- Right side controls
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
  GL.glColor4f(colors.volumeBg[1], colors.volumeBg[2], colors.volumeBg[3],
    colors.volumeBg[4] * effectiveOpacity)
  glRect(volSliderStart, volY, VOLUME_BAR_WIDTH, VOLUME_BAR_HEIGHT)
  local effectiveVolume = state.muted and 0 or state.volume
  local volFillW = VOLUME_BAR_WIDTH * effectiveVolume
  GL.glColor4f(colors.volumeFill[1], colors.volumeFill[2], colors.volumeFill[3],
    colors.volumeFill[4] * effectiveOpacity)
  glRect(volSliderStart, volY, volFillW, VOLUME_BAR_HEIGHT)

  -- Mute button
  local muteX = volSliderStart - BUTTON_SIZE - 4
  local muteCX = muteX + BUTTON_SIZE / 2
  local muteColor = hoverTarget == "mute" and colors.buttonHover or colors.buttonNormal
  drawVolumeIcon(muteCX, rowCenterY, BUTTON_SIZE * 0.65, state.muted,
    { muteColor[1], muteColor[2], muteColor[3], muteColor[4] * effectiveOpacity })
end

-- ============================================================================
-- Update (called each frame)
-- ============================================================================

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

local function showControls(state)
  state.showControls = true
  state.controlsTimer = CONTROLS_TIMEOUT
end

-- ============================================================================
-- Mouse interaction
-- ============================================================================

function VideoPlayer.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  if not Videos then return false end

  local state = getState(node)
  local c = getBounds(node, state)
  if not c then return false end

  if mx < c.x or mx > c.x + c.w or my < c.y or my > c.y + c.h then
    return false
  end

  showControls(state)

  local target = hitTestControls(node, mx, my)

  if target == "play" or target == "video" then
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
    state.draggingVolume = true
    local volSliderEnd = c.x + c.w - 8 - BUTTON_SIZE - 4 - BUTTON_SIZE - 4 - 8
    local volSliderStart = volSliderEnd - VOLUME_BAR_WIDTH
    local ratio = math.max(0, math.min(1, (mx - volSliderStart) / VOLUME_BAR_WIDTH))
    state.volume = ratio
    state.muted = false
    return true

  elseif target == "loop" then
    local currentLoop = node.props and node.props.loop
    node.props.loop = not currentLoop
    return true

  elseif target == "fullscreen" then
    -- Fullscreen toggle (not yet wired to SDL2 fullscreen API)
    state.isFullscreen = not state.isFullscreen
    fullscreenNode = state.isFullscreen and node or nil
    return true
  end

  return false
end

function VideoPlayer.handleMouseMoved(node, mx, my)
  local state = getState(node)
  local c = getBounds(node, state)
  if not c then return false end

  local inside = mx >= c.x and mx <= c.x + c.w and my >= c.y and my <= c.y + c.h
  if not inside and not state.draggingSeek and not state.draggingVolume then
    state.hoverTarget = nil
    return false
  end

  showControls(state)

  if state.draggingSeek and Videos then
    local seekBarX = c.x + 8
    local seekBarW = c.w - 16
    local ratio = math.max(0, math.min(1, (mx - seekBarX) / seekBarW))
    local duration = Videos.getDuration(node.props.src) or 0
    Videos.seek(node.props.src, ratio * duration)
    return true
  end

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

  state.hoverTarget = hitTestControls(node, mx, my)
  if state.hoverTarget == "video" then
    state.hoverTarget = nil
  end

  return inside
end

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

function VideoPlayer.handleKeyPressed(node, key)
  if not Videos then return false end

  local state = getState(node)
  local src = node.props and node.props.src
  if not src then return false end

  showControls(state)

  if key == "space" then
    local wasPaused = isPaused(node)
    if wasPaused then
      local ct = Videos.getCurrentTime(src) or 0
      local dur = Videos.getDuration(src) or 0
      if dur > 0 and ct >= dur - 0.5 then
        Videos.seek(src, 0)
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
