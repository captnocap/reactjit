--[[
  xypad.lua -- Lua-owned XY pad component

  Handles all drag interaction and painting in Lua for zero-latency response.
  React sends props (x, y, min/max, colors, size) via the reconciler;
  Lua owns the drag state and paints directly. Value changes are pushed
  back to JS via buffered events (xypad:change, xypad:start, xypad:end).

  Visual: square pad with crosshair and draggable thumb dot.
  Interaction: 2D drag — drag moves thumb in both axes simultaneously.
]]

local XYPad = {}

local Measure = nil
local pendingEvents = {}

function XYPad.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._xypad then
    local props = node.props or {}
    node._xypad = {
      x = props.x or props.defaultX or 0.5,
      y = props.y or props.defaultY or 0.5,
      isDragging = false,
      dragStartMX = 0,
      dragStartMY = 0,
      dragStartX = 0,
      dragStartY = 0,
    }
  end
  return node._xypad
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
    x = props.x,
    y = props.y,
    defaultX = props.defaultX or 0.5,
    defaultY = props.defaultY or 0.5,
    minX = props.minX or 0,
    maxX = props.maxX or 1,
    minY = props.minY or 0,
    maxY = props.maxY or 1,
    disabled = props.disabled or false,
    size = props.size or 132,
    color = props.color or "#6366f1",
    backgroundColor = props.backgroundColor or "#141827",
    thumbColor = props.thumbColor or "#f8fafc",
    label = props.label,
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

local function queueEvent(nodeId, eventType, x, y)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    x = x,
    y = y,
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

function XYPad.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  -- Use local drag values when dragging, otherwise prop values
  local currentX, currentY
  if state.isDragging then
    currentX = state.x
    currentY = state.y
  else
    currentX = p.x or state.x
    currentY = p.y or state.y
    state.x = currentX
    state.y = currentY
  end

  local opacity = (p.disabled and 0.45 or 1) * effectiveOpacity
  local padSize = p.size
  local thumbSize = math.max(10, math.floor(12))

  -- Pad origin
  local px = c.x
  local py = c.y
  if p.label then py = py + 16 end  -- account for label above

  -- Background
  local br, bg, bb, ba = parseColor(p.backgroundColor)
  love.graphics.setColor(br, bg, bb, ba * opacity)
  love.graphics.rectangle("fill", px, py, padSize, padSize, 8, 8)

  -- Border
  love.graphics.setColor(0.18, 0.2, 0.28, opacity)  -- #2e3348
  love.graphics.rectangle("line", px, py, padSize, padSize, 8, 8)

  -- Crosshair lines
  love.graphics.setColor(0.17, 0.19, 0.27, opacity)  -- #2b3146
  love.graphics.line(px + padSize / 2, py, px + padSize / 2, py + padSize)
  love.graphics.line(px, py + padSize / 2, px + padSize, py + padSize / 2)

  -- Thumb position
  local nx = (currentX - p.minX) / (p.maxX - p.minX)
  local ny = (currentY - p.minY) / (p.maxY - p.minY)
  nx = clamp(nx, 0, 1)
  ny = clamp(ny, 0, 1)
  local thumbX = px + nx * (padSize - thumbSize) + thumbSize / 2
  local thumbY = py + (1 - ny) * (padSize - thumbSize) + thumbSize / 2

  -- Thumb
  local tr, tg, tb, ta = parseColor(p.thumbColor)
  love.graphics.setColor(tr, tg, tb, ta * opacity)
  love.graphics.circle("fill", thumbX, thumbY, thumbSize / 2)

  -- Thumb border
  local cr, cg, cb, ca = parseColor(p.color)
  love.graphics.setColor(cr, cg, cb, ca * opacity)
  love.graphics.circle("line", thumbX, thumbY, thumbSize / 2)

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

  -- Value text below pad
  local valueText = string.format("X %.2f  Y %.2f", currentX, currentY)
  local font = getFontHandle(VALUE_FONT_SIZE)
  if font then
    local tw = font:getWidth(valueText)
    local tx = c.x + (c.w - tw) / 2
    local ty = py + padSize + 4
    love.graphics.setColor(0.39, 0.46, 0.55, opacity)  -- #64748b
    love.graphics.print(valueText, tx, ty)
  end
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function XYPad.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  state.isDragging = true
  state.dragStartMX = mx
  state.dragStartMY = my
  state.dragStartX = state.x
  state.dragStartY = state.y

  queueEvent(node.id, "xypad:start", state.x, state.y)
  return true
end

function XYPad.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isDragging then return false end

  local p = getProps(node)
  local rangeX = p.maxX - p.minX
  local rangeY = p.maxY - p.minY

  local dx = (mx - state.dragStartMX) / p.size * rangeX
  local dy = (my - state.dragStartMY) / p.size * rangeY

  local newX = clamp(state.dragStartX + dx, p.minX, p.maxX)
  local newY = clamp(state.dragStartY - dy, p.minY, p.maxY)  -- invert Y (up = increase)

  if newX ~= state.x or newY ~= state.y then
    state.x = newX
    state.y = newY
    queueEvent(node.id, "xypad:change", newX, newY)
  end

  return true
end

function XYPad.handleMouseReleased(node, mx, my, button)
  local state = getState(node)
  if not state.isDragging then return false end

  state.isDragging = false
  queueEvent(node.id, "xypad:end", state.x, state.y)
  return true
end

-- ============================================================================
-- Event draining
-- ============================================================================

function XYPad.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return XYPad
