--[[
  fader.lua -- Lua-owned vertical fader component

  Handles all drag interaction and painting in Lua for zero-latency response.
  React sends props (value, min, max, colors, sizes) via the reconciler;
  Lua owns the drag state and paints directly. Value changes are pushed
  back to JS via buffered events (fader:change, fader:start, fader:end).

  This is the vertical counterpart of slider.lua. Bottom = min, top = max.
]]

local Fader = {}

-- Injected dependencies
local Measure = nil

-- Pending events to push to JS (drained each frame by init.lua)
local pendingEvents = {}

-- ============================================================================
-- Initialization
-- ============================================================================

function Fader.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._fader then
    local props = node.props or {}
    node._fader = {
      value = props.value or 0,
      isDragging = false,
    }
  end
  return node._fader
end

-- ============================================================================
-- Helpers
-- ============================================================================

local function clamp(val, min, max)
  if val < min then return min end
  if val > max then return max end
  return val
end

local function snapToStep(value, step, min, max)
  if not step or step <= 0 then return value end
  local steps = math.floor((value - min) / step + 0.5)
  return clamp(min + steps * step, min, max)
end

local function getProps(node)
  local props = node.props or {}
  return {
    value = props.value or 0,
    min = props.min or 0,
    max = props.max or 1,
    step = props.step,
    disabled = props.disabled or false,
    color = props.color or "#6366f1",
    trackColor = props.trackColor or "#1e1e1e",
    thumbColor = props.thumbColor or "#cccccc",
    label = props.label,
    width = props.width or 32,
    height = props.height or 120,
  }
end

--- Parse a hex color string to r, g, b, a (0-1 range)
local function parseColor(hex)
  if type(hex) ~= "string" then return 1, 1, 1, 1 end
  hex = hex:gsub("^#", "")
  if #hex == 6 then
    local r = tonumber(hex:sub(1, 2), 16) / 255
    local g = tonumber(hex:sub(3, 4), 16) / 255
    local b = tonumber(hex:sub(5, 6), 16) / 255
    return r, g, b, 1
  elseif #hex == 8 then
    local r = tonumber(hex:sub(1, 2), 16) / 255
    local g = tonumber(hex:sub(3, 4), 16) / 255
    local b = tonumber(hex:sub(5, 6), 16) / 255
    local a = tonumber(hex:sub(7, 8), 16) / 255
    return r, g, b, a
  end
  return 1, 1, 1, 1
end

local function queueEvent(nodeId, eventType, value)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    value = value,
  }
end

-- ============================================================================
-- Font helper (works on both Love2D and SDL2)
-- ============================================================================

-- Default font size for labels
local LABEL_FONT_SIZE = 10

--- Get a font handle for text measurement.
--- Uses the injected Measure module (works on both targets) with a fallback
--- to love.graphics.newFont for pure Love2D environments where Measure is nil.
local function getFontHandle(fontSize)
  if Measure and Measure.getFont then
    return Measure.getFont(fontSize)
  end
  -- Love2D fallback
  if love and love.graphics and love.graphics.newFont then
    return love.graphics.newFont(fontSize)
  end
  return nil
end

-- ============================================================================
-- Drawing
-- ============================================================================

function Fader.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  -- Use local drag value when dragging, otherwise prop value
  local currentValue
  if state.isDragging then
    currentValue = state.value
  else
    -- Sync from React prop when not dragging
    state.value = p.value
    currentValue = p.value
  end

  local opacity = (p.disabled and 0.5 or 1) * effectiveOpacity

  -- Geometry: vertical fader
  local faderWidth = p.width
  local faderHeight = p.height
  local trackWidth = 4
  local thumbHeight = 12
  local thumbWidth = faderWidth

  -- Center the track horizontally within the computed area
  local trackX = c.x + (c.w - trackWidth) / 2
  local trackY = c.y + (c.h - faderHeight) / 2
  local trackH = faderHeight
  local trackRadius = trackWidth / 2

  -- Value -> position (bottom = min, top = max)
  local range = p.max - p.min
  local ratio = range > 0 and clamp((currentValue - p.min) / range, 0, 1) or 0
  local fillH = ratio * trackH

  -- Draw inactive track (full height)
  local tr, tg, tb, ta = parseColor(p.trackColor)
  love.graphics.setColor(tr, tg, tb, ta * opacity)
  love.graphics.rectangle("fill", trackX, trackY, trackWidth, trackH, trackRadius, trackRadius)

  -- Draw active track (bottom portion)
  if fillH > 0 then
    local ar, ag, ab, aa = parseColor(p.color)
    love.graphics.setColor(ar, ag, ab, aa * opacity)
    love.graphics.rectangle("fill", trackX, trackY + trackH - fillH, trackWidth, fillH, trackRadius, trackRadius)
  end

  -- Draw thumb (horizontal bar)
  local thumbX = c.x + (c.w - thumbWidth) / 2
  local thumbY = trackY + trackH - fillH - thumbHeight / 2
  thumbY = clamp(thumbY, trackY - thumbHeight / 2, trackY + trackH - thumbHeight / 2)

  local cr, cg, cb, ca = parseColor(p.thumbColor)
  love.graphics.setColor(cr, cg, cb, ca * opacity)
  love.graphics.rectangle("fill", thumbX, thumbY, thumbWidth, thumbHeight, 2, 2)

  -- Draw border on thumb
  love.graphics.setColor(0.4, 0.4, 0.4, opacity)
  love.graphics.rectangle("line", thumbX, thumbY, thumbWidth, thumbHeight, 2, 2)

  -- Draw label below
  if p.label then
    local font = getFontHandle(LABEL_FONT_SIZE)
    if font then
      local labelWidth = font:getWidth(p.label)
      local labelX = c.x + (c.w - labelWidth) / 2
      local labelY = trackY + trackH + 4
      love.graphics.setColor(0.58, 0.64, 0.72, opacity) -- #94a3b8
      love.graphics.print(p.label, labelX, labelY)
    end
  end
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function Fader.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  local c = node.computed
  if not c then return false end

  -- Start dragging and jump to clicked position
  state.isDragging = true

  local faderHeight = p.height
  local trackY = c.y + (c.h - faderHeight) / 2
  local trackH = faderHeight

  -- Invert: top of track = max, bottom = min
  local ratio = clamp(1 - (my - trackY) / trackH, 0, 1)
  local range = p.max - p.min
  local newValue = p.min + ratio * range
  newValue = snapToStep(newValue, p.step, p.min, p.max)

  state.value = newValue

  queueEvent(node.id, "fader:start", newValue)
  queueEvent(node.id, "fader:change", newValue)

  return true
end

function Fader.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isDragging then return false end

  local p = getProps(node)
  local c = node.computed
  if not c then return false end

  local faderHeight = p.height
  local trackY = c.y + (c.h - faderHeight) / 2
  local trackH = faderHeight

  local ratio = clamp(1 - (my - trackY) / trackH, 0, 1)
  local range = p.max - p.min
  local newValue = p.min + ratio * range
  newValue = snapToStep(newValue, p.step, p.min, p.max)

  if newValue ~= state.value then
    state.value = newValue
    queueEvent(node.id, "fader:change", newValue)
  end

  return true
end

function Fader.handleMouseReleased(node, mx, my, button)
  local state = getState(node)
  if not state.isDragging then return false end

  state.isDragging = false
  queueEvent(node.id, "fader:end", state.value)

  return true
end

-- ============================================================================
-- Event draining (called by init.lua each frame)
-- ============================================================================

function Fader.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return Fader
