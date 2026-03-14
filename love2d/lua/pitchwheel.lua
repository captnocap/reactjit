--[[
  pitchwheel.lua -- Lua-owned pitch wheel / vertical slider with spring return

  Handles all drag interaction and painting in Lua for zero-latency response.
  React sends props (value, min, max, springReturn, colors) via the reconciler;
  Lua owns the drag state and paints directly. Value changes are pushed
  back to JS via buffered events (pitchwheel:change, pitchwheel:start, pitchwheel:end).

  Visual: vertical track with draggable thumb and center line.
  Interaction: vertical drag — drag up = increase, drag down = decrease.
  Spring return: snaps to center value on release if springReturn is true.
]]

local PitchWheel = {}

local Measure = nil
local pendingEvents = {}

function PitchWheel.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._pitchwheel then
    local props = node.props or {}
    local min = props.min or -1
    local max = props.max or 1
    node._pitchwheel = {
      value = props.value or props.defaultValue or ((min + max) / 2),
      isDragging = false,
      dragStartY = 0,
      dragStartValue = 0,
    }
  end
  return node._pitchwheel
end

-- ============================================================================
-- Helpers
-- ============================================================================

local function clamp(val, min, max)
  if val < min then return min end
  if val > max then return max end
  return val
end

local function getProps(node)
  local props = node.props or {}
  return {
    value = props.value,
    defaultValue = props.defaultValue or 0,
    min = props.min or -1,
    max = props.max or 1,
    springReturn = props.springReturn ~= false,  -- default true
    disabled = props.disabled or false,
    height = props.height or 128,
    width = props.width or 34,
    color = props.color or "#22c55e",
    trackColor = props.trackColor or "#141827",
    thumbColor = props.thumbColor or "#f8fafc",
    label = props.label or "Pitch",
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

-- ============================================================================
-- Font helper
-- ============================================================================

local LABEL_FONT_SIZE = 10
local VALUE_FONT_SIZE = 9

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

function PitchWheel.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  -- Use local drag value when dragging, otherwise prop value
  local currentValue
  if state.isDragging then
    currentValue = state.value
  else
    currentValue = p.value or state.value
    state.value = currentValue
  end

  local opacity = (p.disabled and 0.45 or 1) * effectiveOpacity
  local trackW = p.width
  local trackH = p.height
  local thumbH = math.max(10, 12)

  -- Track origin (below label if present)
  local tx = c.x + (c.w - trackW) / 2
  local ty = c.y
  if p.label then ty = ty + 16 end

  -- Track background
  local br, bg, bb, ba = parseColor(p.trackColor)
  love.graphics.setColor(br, bg, bb, ba * opacity)
  love.graphics.rectangle("fill", tx, ty, trackW, trackH, 8, 8)

  -- Border
  love.graphics.setColor(0.18, 0.2, 0.28, opacity)  -- #2e3348
  love.graphics.rectangle("line", tx, ty, trackW, trackH, 8, 8)

  -- Center line
  love.graphics.setColor(0.2, 0.25, 0.33, opacity)  -- #334155
  love.graphics.line(tx, ty + trackH / 2, tx + trackW, ty + trackH / 2)

  -- Thumb position
  local range = p.max - p.min
  local t = range > 0 and (currentValue - p.min) / range or 0.5
  t = clamp(t, 0, 1)
  local thumbTop = (1 - t) * (trackH - thumbH)
  local thumbInset = 2

  -- Thumb
  local tr, tg, tb, ta = parseColor(p.thumbColor)
  love.graphics.setColor(tr, tg, tb, ta * opacity)
  love.graphics.rectangle("fill", tx + thumbInset, ty + thumbTop, trackW - thumbInset * 2, thumbH, 6, 6)

  -- Thumb border
  local cr, cg, cb, ca = parseColor(p.color)
  love.graphics.setColor(cr, cg, cb, ca * opacity)
  love.graphics.rectangle("line", tx + thumbInset, ty + thumbTop, trackW - thumbInset * 2, thumbH, 6, 6)

  -- Label above
  if p.label then
    local font = getFontHandle(LABEL_FONT_SIZE)
    if font then
      local labelWidth = font:getWidth(p.label)
      local labelX = c.x + (c.w - labelWidth) / 2
      local labelY = c.y
      love.graphics.setColor(0.58, 0.64, 0.72, opacity)  -- #94a3b8
      love.graphics.print(p.label, labelX, labelY)
    end
  end

  -- Value text below
  local valueText = string.format("%.2f", currentValue)
  local font = getFontHandle(VALUE_FONT_SIZE)
  if font then
    local tw = font:getWidth(valueText)
    local vx = c.x + (c.w - tw) / 2
    local vy = ty + trackH + 4
    love.graphics.setColor(0.39, 0.46, 0.55, opacity)  -- #64748b
    love.graphics.print(valueText, vx, vy)
  end
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function PitchWheel.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  state.isDragging = true
  state.dragStartY = my
  state.dragStartValue = state.value

  queueEvent(node.id, "pitchwheel:start", state.value)
  return true
end

function PitchWheel.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isDragging then return false end

  local p = getProps(node)
  local range = p.max - p.min
  local sensitivity = range / p.height

  local dy = -(my - state.dragStartY)  -- up = increase
  local newValue = clamp(state.dragStartValue + dy * sensitivity, p.min, p.max)

  if newValue ~= state.value then
    state.value = newValue
    queueEvent(node.id, "pitchwheel:change", newValue)
  end

  return true
end

function PitchWheel.handleMouseReleased(node, mx, my, button)
  local state = getState(node)
  if not state.isDragging then return false end

  state.isDragging = false
  local p = getProps(node)

  -- Spring return to center
  if p.springReturn then
    local center = (p.min + p.max) / 2
    state.value = center
    queueEvent(node.id, "pitchwheel:change", center)
  end

  queueEvent(node.id, "pitchwheel:end", state.value)
  return true
end

-- ============================================================================
-- Event draining
-- ============================================================================

function PitchWheel.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return PitchWheel
