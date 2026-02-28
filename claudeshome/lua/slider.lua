--[[
  slider.lua -- Lua-owned slider component

  Handles all drag interaction and painting in Lua for zero-latency response.
  React sends props (value, min, max, colors, sizes) via the reconciler;
  Lua owns the drag state and paints directly. Value changes are pushed
  back to JS via buffered events (slider:change, slider:start, slider:end).
]]

local Slider = {}

-- Injected dependencies
local Measure = nil

-- Pending events to push to JS (drained each frame by init.lua)
local pendingEvents = {}

-- ============================================================================
-- Initialization
-- ============================================================================

function Slider.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._slider then
    local props = node.props or {}
    node._slider = {
      value = props.value or 0,
      isDragging = false,
    }
  end
  return node._slider
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
    min = props.minimumValue or 0,
    max = props.maximumValue or 1,
    step = props.step,
    disabled = props.disabled or false,
    trackColor = props.trackColor or "#333333",
    activeTrackColor = props.activeTrackColor or "#4A90D9",
    thumbColor = props.thumbColor or "#ffffff",
    thumbSize = props.thumbSize or 20,
    trackHeight = props.trackHeight or 4,
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

local function snapHalf(v)
  return math.floor(v) + 0.5
end

local function drawSoftCircle(cx, cy, radius, r, g, b, a, opacity)
  local baseA = (a or 1) * opacity

  -- Two-pass shadow softens jagged silhouette against dark backgrounds.
  love.graphics.setColor(0, 0, 0, 0.22 * opacity)
  love.graphics.circle("fill", cx, cy + 1.0, radius + 1.1)
  love.graphics.setColor(0, 0, 0, 0.10 * opacity)
  love.graphics.circle("fill", cx, cy + 1.2, radius + 2.0)

  -- Outer halo masks stair-step edges before the solid fill.
  love.graphics.setColor(r, g, b, baseA * 0.22)
  love.graphics.circle("fill", cx, cy, radius + 1.2)

  -- Main thumb body.
  love.graphics.setColor(r, g, b, baseA)
  love.graphics.circle("fill", cx, cy, radius)

  -- Edge ring + highlight make the contour read smoother at small sizes.
  love.graphics.setLineWidth(1)
  love.graphics.setColor(0, 0, 0, baseA * 0.24)
  love.graphics.circle("line", cx, cy + 0.1, math.max(0.5, radius - 0.2))
  love.graphics.setColor(1, 1, 1, 0.22 * opacity)
  love.graphics.circle("line", cx, cy - 0.6, math.max(0.5, radius - 1.2))
end

-- ============================================================================
-- Drawing
-- ============================================================================

function Slider.draw(node, effectiveOpacity)
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

  -- Track geometry
  local thumbSize = p.thumbSize
  local trackHeight = p.trackHeight
  local trackX = c.x + thumbSize / 2
  local trackW = c.w - thumbSize
  local trackY = c.y + (c.h - trackHeight) / 2
  local trackRadius = trackHeight / 2

  -- Value → position
  local range = p.max - p.min
  local ratio = range > 0 and clamp((currentValue - p.min) / range, 0, 1) or 0
  local fillW = ratio * trackW

  -- Draw inactive track (full width)
  local tr, tg, tb, ta = parseColor(p.trackColor)
  love.graphics.setColor(tr, tg, tb, ta * opacity)
  love.graphics.rectangle("fill", trackX, trackY, trackW, trackHeight, trackRadius, trackRadius)

  -- Draw active track (left portion)
  if fillW > 0 then
    local ar, ag, ab, aa = parseColor(p.activeTrackColor)
    love.graphics.setColor(ar, ag, ab, aa * opacity)
    love.graphics.rectangle("fill", trackX, trackY, fillW, trackHeight, trackRadius, trackRadius)
  end

  -- Draw thumb
  local thumbX = snapHalf(trackX + fillW)
  local thumbY = snapHalf(c.y + c.h / 2)
  local thumbRadius = thumbSize / 2
  local cr, cg, cb, ca = parseColor(p.thumbColor)
  drawSoftCircle(thumbX, thumbY, thumbRadius, cr, cg, cb, ca, opacity)
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function Slider.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  local c = node.computed
  if not c then return false end

  -- Start dragging and jump to clicked position
  state.isDragging = true

  local trackX = c.x + p.thumbSize / 2
  local trackW = c.w - p.thumbSize
  local ratio = clamp((mx - trackX) / trackW, 0, 1)
  local range = p.max - p.min
  local newValue = p.min + ratio * range
  newValue = snapToStep(newValue, p.step, p.min, p.max)

  state.value = newValue

  queueEvent(node.id, "slider:start", newValue)
  queueEvent(node.id, "slider:change", newValue)

  return true
end

function Slider.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isDragging then return false end

  local p = getProps(node)
  local c = node.computed
  if not c then return false end

  local trackX = c.x + p.thumbSize / 2
  local trackW = c.w - p.thumbSize
  local ratio = clamp((mx - trackX) / trackW, 0, 1)
  local range = p.max - p.min
  local newValue = p.min + ratio * range
  newValue = snapToStep(newValue, p.step, p.min, p.max)

  if newValue ~= state.value then
    state.value = newValue
    queueEvent(node.id, "slider:change", newValue)
  end

  return true
end

function Slider.handleMouseReleased(node, mx, my, button)
  local state = getState(node)
  if not state.isDragging then return false end

  state.isDragging = false
  queueEvent(node.id, "slider:end", state.value)

  return true
end

-- ============================================================================
-- Event draining (called by init.lua each frame)
-- ============================================================================

function Slider.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return Slider
