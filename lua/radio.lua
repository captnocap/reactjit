--[[
  radio.lua -- Lua-owned radio button component

  Handles selection state and painting in Lua for zero-latency response.
  React sends props (value, groupId, color, size, label) via the reconciler;
  Lua owns the selection state per group and paints directly. Value changes
  are pushed back to JS via buffered events (radio:change).

  Group management: all Radio nodes with the same groupId share selection state.
  When one is clicked, all others in the group are deselected.
]]

local Radio = {}

local Measure = nil
local pendingEvents = {}

-- Group state: groupId -> selected value
local groupState = {}

-- ============================================================================
-- Initialization
-- ============================================================================

function Radio.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._radio then
    node._radio = {}
  end
  return node._radio
end

-- ============================================================================
-- Helpers
-- ============================================================================

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

local function getProps(node)
  local props = node.props or {}
  return {
    value = props.value or "",
    groupId = props.groupId or "__default",
    selectedValue = props.selectedValue,  -- controlled from React
    disabled = props.disabled or false,
    label = props.label,
    size = props.size or 20,
    color = props.color or "#3b82f6",
    uncheckedColor = props.uncheckedColor or "#6b7280",
  }
end

local function queueEvent(nodeId, eventType, value, groupId)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    value = value,
    groupId = groupId,
  }
end

local function snapHalf(v)
  return math.floor(v) + 0.5
end

local function drawSoftDot(cx, cy, radius, r, g, b, a, opacity)
  local baseA = (a or 1) * opacity

  love.graphics.setColor(0, 0, 0, 0.20 * opacity)
  love.graphics.circle("fill", cx, cy + 0.8, radius + 0.9)
  love.graphics.setColor(0, 0, 0, 0.09 * opacity)
  love.graphics.circle("fill", cx, cy + 1.0, radius + 1.6)

  love.graphics.setColor(r, g, b, baseA * 0.22)
  love.graphics.circle("fill", cx, cy, radius + 0.9)

  love.graphics.setColor(r, g, b, baseA)
  love.graphics.circle("fill", cx, cy, radius)

  love.graphics.setLineWidth(1)
  love.graphics.setColor(0, 0, 0, baseA * 0.22)
  love.graphics.circle("line", cx, cy + 0.1, math.max(0.5, radius - 0.2))
  love.graphics.setColor(1, 1, 1, 0.20 * opacity)
  love.graphics.circle("line", cx, cy - 0.5, math.max(0.5, radius - 0.9))
end

-- ============================================================================
-- Font helper (works on both Love2D and SDL2)
-- ============================================================================

-- Default font size for labels
local LABEL_FONT_SIZE = 12

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

function Radio.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  -- Determine if selected: controlled mode (selectedValue prop) or group state
  local isSelected
  if p.selectedValue ~= nil then
    isSelected = (p.selectedValue == p.value)
  else
    isSelected = (groupState[p.groupId] == p.value)
  end

  local opacity = (p.disabled and 0.5 or 1) * effectiveOpacity
  local size = p.size
  local radius = size / 2
  local borderWidth = math.max(2, math.floor(size / 10))
  local innerSize = math.floor(size * 0.5)
  local innerRadius = innerSize / 2

  -- Circle position (vertically centered)
  local circleX = snapHalf(c.x + radius)
  local circleY = snapHalf(c.y + c.h / 2)

  -- Draw outer circle
  local borderColor = isSelected and p.color or p.uncheckedColor
  local br, bg, bb, ba = parseColor(borderColor)
  love.graphics.setColor(br, bg, bb, ba * opacity)
  love.graphics.setLineWidth(borderWidth)
  love.graphics.circle("line", circleX, circleY, radius - borderWidth / 2)
  love.graphics.setLineWidth(1)

  -- Draw inner dot when selected
  if isSelected then
    local ar, ag, ab, aa = parseColor(p.color)
    drawSoftDot(circleX, circleY, innerRadius, ar, ag, ab, aa, opacity)
  end

  -- Draw label
  if p.label then
    local font = getFontHandle(LABEL_FONT_SIZE)
    if font then
      local labelX = c.x + size + 8
      local labelY = c.y + (c.h - font:getHeight()) / 2
      love.graphics.setColor(0.886, 0.910, 0.941, opacity) -- #e2e8f0
      love.graphics.print(p.label, labelX, labelY)
    end
  end
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function Radio.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local p = getProps(node)
  if p.disabled then return false end

  -- Update group state
  groupState[p.groupId] = p.value

  queueEvent(node.id, "radio:change", p.value, p.groupId)
  return true
end

-- ============================================================================
-- Event draining
-- ============================================================================

function Radio.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return Radio
