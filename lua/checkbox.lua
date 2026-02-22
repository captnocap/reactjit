--[[
  checkbox.lua -- Lua-owned checkbox component

  Handles toggle state and painting in Lua for zero-latency response.
  React sends props (value, color, size, label) via the reconciler;
  Lua owns the check state and paints directly. Value changes are pushed
  back to JS via buffered events (checkbox:change).
]]

local Checkbox = {}

local Measure = nil
local pendingEvents = {}

-- ============================================================================
-- Initialization
-- ============================================================================

function Checkbox.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._checkbox then
    local props = node.props or {}
    node._checkbox = {
      value = props.value or false,
    }
  end
  return node._checkbox
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
    label = props.label,
    size = props.size or 20,
    color = props.color or "#3b82f6",
    uncheckedColor = props.uncheckedColor or "#6b7280",
  }
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

function Checkbox.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  -- Sync from React prop
  local checked = p.value
  state.value = checked

  local opacity = (p.disabled and 0.5 or 1) * effectiveOpacity
  local size = p.size
  local borderWidth = math.max(2, math.floor(size / 10))

  -- Box position (vertically centered)
  local boxX = c.x
  local boxY = c.y + (c.h - size) / 2

  -- Draw outer box
  local borderColor = checked and p.color or p.uncheckedColor
  local br, bg, bb, ba = parseColor(borderColor)

  if checked then
    -- Filled box
    love.graphics.setColor(br, bg, bb, ba * opacity)
    love.graphics.rectangle("fill", boxX, boxY, size, size, 4, 4)

    -- Checkmark (inner white rect)
    local innerSize = math.floor(size * 0.4)
    local innerX = boxX + (size - innerSize) / 2
    local innerY = boxY + (size - innerSize) / 2
    love.graphics.setColor(1, 1, 1, opacity)
    love.graphics.rectangle("fill", innerX, innerY, innerSize, innerSize, 2, 2)
  else
    -- Border only
    love.graphics.setColor(br, bg, bb, ba * opacity)
    love.graphics.setLineWidth(borderWidth)
    love.graphics.rectangle("line", boxX + borderWidth/2, boxY + borderWidth/2,
      size - borderWidth, size - borderWidth, 4, 4)
    love.graphics.setLineWidth(1)
  end

  -- Draw label
  if p.label then
    local font = getFontHandle(LABEL_FONT_SIZE)
    if font then
      local labelX = boxX + size + 8
      local labelY = c.y + (c.h - font:getHeight()) / 2
      love.graphics.setColor(0.886, 0.910, 0.941, opacity) -- #e2e8f0
      love.graphics.print(p.label, labelX, labelY)
    end
  end
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function Checkbox.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  -- Toggle
  local newValue = not state.value
  state.value = newValue

  queueEvent(node.id, "checkbox:change", newValue)
  return true
end

-- ============================================================================
-- Event draining
-- ============================================================================

function Checkbox.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return Checkbox
