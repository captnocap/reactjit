--[[
  switch.lua -- Lua-owned toggle switch component

  Handles toggle state, thumb animation, and painting in Lua for zero-latency.
  React sends props (value, colors, sizes) via the reconciler;
  Lua owns the toggle state and paints directly. Value changes are pushed
  back to JS via buffered events (switch:change).
]]

local Switch = {}

local Measure = nil
local pendingEvents = {}

-- ============================================================================
-- Initialization
-- ============================================================================

function Switch.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._switch then
    local props = node.props or {}
    local val = props.value or false
    node._switch = {
      value = val,
      -- Animation: thumbX lerps between 0 (off) and 1 (on)
      thumbRatio = val and 1 or 0,
      animating = false,
    }
  end
  return node._switch
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
    value = props.value or false,
    disabled = props.disabled or false,
    trackColorTrue = props.trackColorTrue or "#81b0ff",
    trackColorFalse = props.trackColorFalse or "#767577",
    thumbColor = props.thumbColor or "#f4f3f4",
    width = props.width or 50,
    height = props.height or 28,
  }
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

  love.graphics.setColor(0, 0, 0, 0.22 * opacity)
  love.graphics.circle("fill", cx, cy + 1.0, radius + 1.1)
  love.graphics.setColor(0, 0, 0, 0.10 * opacity)
  love.graphics.circle("fill", cx, cy + 1.2, radius + 2.0)

  love.graphics.setColor(r, g, b, baseA * 0.22)
  love.graphics.circle("fill", cx, cy, radius + 1.2)

  love.graphics.setColor(r, g, b, baseA)
  love.graphics.circle("fill", cx, cy, radius)

  love.graphics.setLineWidth(1)
  love.graphics.setColor(0, 0, 0, baseA * 0.24)
  love.graphics.circle("line", cx, cy + 0.1, math.max(0.5, radius - 0.2))
  love.graphics.setColor(1, 1, 1, 0.22 * opacity)
  love.graphics.circle("line", cx, cy - 0.6, math.max(0.5, radius - 1.2))
end

-- ============================================================================
-- Update (called each frame to animate thumb)
-- ============================================================================

function Switch.update(dt)
  -- no-op for now; animation could be added here
end

-- ============================================================================
-- Drawing
-- ============================================================================

function Switch.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  -- Sync from React prop when not animating
  local currentValue = p.value
  state.value = currentValue
  state.thumbRatio = currentValue and 1 or 0

  local opacity = (p.disabled and 0.5 or 1) * effectiveOpacity

  local w = p.width
  local h = p.height
  local radius = h / 2
  local thumbPad = 2
  local thumbDiameter = h - thumbPad * 2
  local thumbRadius = thumbDiameter / 2

  -- Center within computed area
  local trackX = c.x + (c.w - w) / 2
  local trackY = c.y + (c.h - h) / 2

  -- Draw track
  local trackColor = currentValue and p.trackColorTrue or p.trackColorFalse
  local tr, tg, tb, ta = parseColor(trackColor)
  love.graphics.setColor(tr, tg, tb, ta * opacity)
  love.graphics.rectangle("fill", trackX, trackY, w, h, radius, radius)

  -- Draw thumb
  local thumbX = snapHalf(trackX + thumbPad + state.thumbRatio * (w - thumbDiameter - thumbPad * 2) + thumbRadius)
  local thumbY = snapHalf(trackY + h / 2)
  local cr, cg, cb, ca = parseColor(p.thumbColor)
  drawSoftCircle(thumbX, thumbY, thumbRadius, cr, cg, cb, ca, opacity)
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function Switch.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  -- Toggle
  local newValue = not state.value
  state.value = newValue
  state.thumbRatio = newValue and 1 or 0

  queueEvent(node.id, "switch:change", newValue)
  return true
end

-- ============================================================================
-- Event draining
-- ============================================================================

function Switch.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return Switch
