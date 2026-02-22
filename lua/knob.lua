--[[
  knob.lua -- Lua-owned rotary knob component

  Handles all drag interaction and painting in Lua for zero-latency response.
  React sends props (value, min, max, colors, size) via the reconciler;
  Lua owns the drag state and paints directly. Value changes are pushed
  back to JS via buffered events (knob:change, knob:start, knob:end).

  Visual: arc of dots (270deg sweep, gap at bottom), knob body, indicator line.
  Interaction: vertical drag — drag up = increase, drag down = decrease.
]]

local Knob = {}

-- Injected dependencies
local Measure = nil

-- Pending events to push to JS (drained each frame by init.lua)
local pendingEvents = {}

-- ============================================================================
-- Initialization
-- ============================================================================

function Knob.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._knob then
    local props = node.props or {}
    node._knob = {
      value = props.value or 0,
      isDragging = false,
      dragStartY = 0,
      dragStartValue = 0,
    }
  end
  return node._knob
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
    trackColor = props.trackColor or "#333333",
    label = props.label,
    size = props.size or 48,
  }
end

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

-- Map value to angle: 0% = -135deg, 100% = +135deg (270deg sweep, gap at bottom)
local function valueToAngle(value, min, max)
  local range = max - min
  if range <= 0 then return -135 end
  local normalized = clamp((value - min) / range, 0, 1)
  return -135 + normalized * 270
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
  if love and love.graphics and love.graphics.newFont then
    return love.graphics.newFont(fontSize)
  end
  return nil
end

-- ============================================================================
-- Drawing
-- ============================================================================

local DOT_COUNT = 24

function Knob.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  -- Use local drag value when dragging, otherwise prop value
  local currentValue
  if state.isDragging then
    currentValue = state.value
  else
    state.value = p.value
    currentValue = p.value
  end

  local opacity = (p.disabled and 0.5 or 1) * effectiveOpacity
  local knobSize = p.size

  -- Center of the knob area
  local cx = c.x + c.w / 2
  local cy = c.y + knobSize / 2  -- label space below

  local arcRadius = knobSize * 0.42
  local dotSize = math.max(2, math.floor(knobSize * 0.05))
  local bodyRadius = knobSize * 0.325
  local indicatorLen = knobSize * 0.3
  local indicatorWidth = math.max(2, math.floor(knobSize * 0.06))

  local range = p.max - p.min
  local normalized = range > 0 and clamp((currentValue - p.min) / range, 0, 1) or 0
  local activeDots = math.floor(normalized * (DOT_COUNT - 1) + 0.5) + 1

  -- Draw arc dots
  local ar, ag, ab, aa = parseColor(p.color)
  local tr, tg, tb, ta = parseColor(p.trackColor)

  for i = 0, DOT_COUNT - 1 do
    local t = i / (DOT_COUNT - 1)
    local angle = -135 + t * 270
    local rad = math.rad(angle)
    local dx = math.cos(rad) * arcRadius
    local dy = math.sin(rad) * arcRadius

    if i < activeDots then
      love.graphics.setColor(ar, ag, ab, aa * opacity)
    else
      love.graphics.setColor(tr, tg, tb, ta * opacity)
    end

    love.graphics.circle("fill", cx + dx, cy + dy, dotSize)
  end

  -- Draw knob body
  love.graphics.setColor(0.165, 0.165, 0.165, opacity) -- #2a2a2a
  love.graphics.circle("fill", cx, cy, bodyRadius)
  love.graphics.setColor(0.267, 0.267, 0.267, opacity) -- #444
  love.graphics.circle("line", cx, cy, bodyRadius)

  -- Draw indicator line
  local angle = valueToAngle(currentValue, p.min, p.max)
  local rad = math.rad(angle)
  local indEndX = cx + math.cos(rad) * indicatorLen
  local indEndY = cy + math.sin(rad) * indicatorLen
  local indStartX = cx + math.cos(rad) * (bodyRadius * 0.3)
  local indStartY = cy + math.sin(rad) * (bodyRadius * 0.3)

  love.graphics.setColor(ar, ag, ab, aa * opacity)
  love.graphics.setLineWidth(indicatorWidth)
  love.graphics.line(indStartX, indStartY, indEndX, indEndY)
  love.graphics.setLineWidth(1)

  -- Draw label below
  if p.label then
    local font = getFontHandle(LABEL_FONT_SIZE)
    if font then
      local labelWidth = font:getWidth(p.label)
      local labelX = c.x + (c.w - labelWidth) / 2
      local labelY = c.y + knobSize + 4
      love.graphics.setColor(0.58, 0.64, 0.72, opacity) -- #94a3b8
      love.graphics.print(p.label, labelX, labelY)
    end
  end
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function Knob.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  -- Start dragging — vertical drag maps to value change
  state.isDragging = true
  state.dragStartY = my
  state.dragStartValue = state.value

  queueEvent(node.id, "knob:start", state.value)

  return true
end

function Knob.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isDragging then return false end

  local p = getProps(node)

  -- Vertical drag: up = increase, down = decrease
  -- Sensitivity: full knob diameter drag = full value range
  local sensitivity = (p.max - p.min) / (p.size * 2)
  local deltaY = state.dragStartY - my  -- invert: up is positive
  local newValue = state.dragStartValue + deltaY * sensitivity
  newValue = clamp(newValue, p.min, p.max)
  newValue = snapToStep(newValue, p.step, p.min, p.max)

  if newValue ~= state.value then
    state.value = newValue
    queueEvent(node.id, "knob:change", newValue)
  end

  return true
end

function Knob.handleMouseReleased(node, mx, my, button)
  local state = getState(node)
  if not state.isDragging then return false end

  state.isDragging = false
  queueEvent(node.id, "knob:end", state.value)

  return true
end

-- ============================================================================
-- Event draining (called by init.lua each frame)
-- ============================================================================

function Knob.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return Knob
