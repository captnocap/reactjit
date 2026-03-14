--[[
  select.lua -- Lua-owned dropdown select component

  Handles open/close state, hover tracking, keyboard navigation, and painting
  in Lua for zero-latency response. React sends props (options, value, colors)
  via the reconciler; Lua owns the interaction state and paints directly.
  Value changes are pushed back to JS via buffered events (select:change).

  Follows the contextmenu.lua pattern for floating overlay rendering.
]]

local Select = {}

local Measure = nil
local pendingEvents = {}

-- Currently open select node (only one can be open at a time)
local openSelectId = nil

-- ============================================================================
-- Initialization
-- ============================================================================

function Select.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._select then
    local props = node.props or {}
    node._select = {
      isOpen = false,
      hoveredIndex = nil,
      selectedValue = props.value,
      parsedOptions = nil,  -- cached parsed options
    }
  end
  return node._select
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
    value = props.value,
    options = props.options or "[]",  -- JSON string
    placeholder = props.placeholder or "Select...",
    disabled = props.disabled or false,
    color = props.color or "#3b82f6",
  }
end

local json_decode = nil

local function parseOptions(optionsStr)
  if type(optionsStr) ~= "string" then return {} end
  -- Minimal JSON array parser for [{label, value}, ...]
  if not json_decode then
    local ok, json = pcall(require, "lua.json")
    if ok and json then
      json_decode = json.decode
    else
      -- Fallback: try cjson
      local ok2, cjson = pcall(require, "cjson")
      if ok2 and cjson then
        json_decode = cjson.decode
      else
        -- Last resort: pattern-based parser for simple cases
        json_decode = function(str)
          local result = {}
          for label, value in str:gmatch('"label"%s*:%s*"([^"]*)"%s*,%s*"value"%s*:%s*"([^"]*)"') do
            result[#result + 1] = { label = label, value = value }
          end
          return result
        end
      end
    end
  end
  local ok, parsed = pcall(json_decode, optionsStr)
  if ok and type(parsed) == "table" then return parsed end
  return {}
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

-- Default font size for trigger and dropdown text
local SELECT_FONT_SIZE = 12

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

local ITEM_HEIGHT = 32
local TRIGGER_HEIGHT = 36
local PANEL_PADDING = 4

function Select.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  -- Sync selected value from React prop
  if p.value ~= nil then
    state.selectedValue = p.value
  end

  -- Parse options (cache for performance)
  if not state.parsedOptions or state.optionsRaw ~= p.options then
    state.parsedOptions = parseOptions(p.options)
    state.optionsRaw = p.options
  end
  local options = state.parsedOptions

  local opacity = (p.disabled and 0.5 or 1) * effectiveOpacity

  -- Find selected label
  local displayText = p.placeholder
  for _, opt in ipairs(options) do
    if opt.value == state.selectedValue then
      displayText = opt.label
      break
    end
  end

  -- Draw trigger button
  local triggerX = c.x
  local triggerY = c.y
  local triggerW = c.w
  local triggerH = TRIGGER_HEIGHT

  -- Trigger background
  love.graphics.setColor(0.118, 0.161, 0.231, opacity) -- #1e293b
  love.graphics.rectangle("fill", triggerX, triggerY, triggerW, triggerH, 6, 6)

  -- Trigger border
  local borderColor = state.isOpen and p.color or "#334155"
  local br, bg, bb, ba = parseColor(borderColor)
  love.graphics.setColor(br, bg, bb, ba * opacity)
  love.graphics.rectangle("line", triggerX, triggerY, triggerW, triggerH, 6, 6)

  -- Trigger text
  local font = getFontHandle(SELECT_FONT_SIZE)
  if font then
    local textColor = state.selectedValue and {0.886, 0.910, 0.941} or {0.392, 0.455, 0.545}
    love.graphics.setColor(textColor[1], textColor[2], textColor[3], opacity)
    love.graphics.print(displayText, triggerX + 12, triggerY + (triggerH - font:getHeight()) / 2)

    -- Arrow indicator
    love.graphics.setColor(0.392, 0.455, 0.545, opacity) -- #64748b
    local arrow = state.isOpen and "^" or "v"
    local arrowW = font:getWidth(arrow)
    love.graphics.print(arrow, triggerX + triggerW - arrowW - 12, triggerY + (triggerH - font:getHeight()) / 2)
  end

  -- Draw floating panel when open
  if state.isOpen and #options > 0 then
    local panelX = triggerX
    local panelY = triggerY + triggerH + 4
    local panelW = triggerW
    local panelH = #options * ITEM_HEIGHT + PANEL_PADDING * 2

    -- Panel background (semi-transparent dark)
    love.graphics.setColor(0.03, 0.03, 0.05, 0.92 * opacity)
    love.graphics.rectangle("fill", panelX, panelY, panelW, panelH, 6, 6)

    -- Panel border
    love.graphics.setColor(0.251, 0.251, 0.353, opacity) -- #40405a
    love.graphics.rectangle("line", panelX, panelY, panelW, panelH, 6, 6)

    -- Options
    for i, opt in ipairs(options) do
      local itemY = panelY + PANEL_PADDING + (i - 1) * ITEM_HEIGHT
      local isSelected = (opt.value == state.selectedValue)
      local isHovered = (state.hoveredIndex == i)

      -- Item background
      if isSelected then
        love.graphics.setColor(0.380, 0.651, 0.980, 0.15 * opacity) -- rgba(97, 166, 250, 0.15)
        love.graphics.rectangle("fill", panelX + 1, itemY, panelW - 2, ITEM_HEIGHT)
      elseif isHovered then
        love.graphics.setColor(1, 1, 1, 0.06 * opacity)
        love.graphics.rectangle("fill", panelX + 1, itemY, panelW - 2, ITEM_HEIGHT)
      end

      -- Separator
      if i < #options then
        love.graphics.setColor(0.251, 0.251, 0.353, 0.4 * opacity)
        love.graphics.line(panelX + 1, itemY + ITEM_HEIGHT, panelX + panelW - 1, itemY + ITEM_HEIGHT)
      end

      -- Item text
      if font then
        local textColor
        if isSelected then
          textColor = {0.380, 0.651, 0.980} -- #61a6fa
        elseif isHovered then
          textColor = {0.882, 0.894, 0.941} -- #e1e4f0
        else
          textColor = {0.580, 0.639, 0.722} -- #94a3b8
        end
        love.graphics.setColor(textColor[1], textColor[2], textColor[3], opacity)
        love.graphics.print(opt.label, panelX + 12, itemY + (ITEM_HEIGHT - font:getHeight()) / 2)

        -- Selected indicator
        if isSelected then
          love.graphics.setColor(0.380, 0.651, 0.980, opacity)
          love.graphics.print("*", panelX + panelW - 20, itemY + (ITEM_HEIGHT - font:getHeight()) / 2)
        end
      end
    end
  end
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function Select.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  local c = node.computed
  if not c then return false end

  local triggerH = TRIGGER_HEIGHT

  if not state.isOpen then
    -- Click on trigger: toggle open
    state.isOpen = true
    state.hoveredIndex = nil
    openSelectId = node.id
    return true
  else
    -- Panel is open: check if click is on an option
    local options = state.parsedOptions or {}
    local panelY = c.y + triggerH + 4

    for i, opt in ipairs(options) do
      local itemY = panelY + PANEL_PADDING + (i - 1) * ITEM_HEIGHT
      if my >= itemY and my < itemY + ITEM_HEIGHT then
        -- Selected this option
        state.selectedValue = opt.value
        state.isOpen = false
        state.hoveredIndex = nil
        openSelectId = nil
        queueEvent(node.id, "select:change", opt.value)
        return true
      end
    end

    -- Click outside panel: close
    state.isOpen = false
    state.hoveredIndex = nil
    openSelectId = nil
    return true
  end
end

function Select.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isOpen then return false end

  local c = node.computed
  if not c then return false end

  local options = state.parsedOptions or {}
  local panelY = c.y + TRIGGER_HEIGHT + 4

  local newHovered = nil
  for i = 1, #options do
    local itemY = panelY + PANEL_PADDING + (i - 1) * ITEM_HEIGHT
    if my >= itemY and my < itemY + ITEM_HEIGHT and mx >= c.x and mx <= c.x + c.w then
      newHovered = i
      break
    end
  end

  if newHovered ~= state.hoveredIndex then
    state.hoveredIndex = newHovered
  end

  return state.isOpen
end

-- Close select when clicking elsewhere
function Select.handleGlobalClick(nodeId)
  -- Called when a click happens on a non-Select node
  -- Close any open select
  if openSelectId and openSelectId ~= nodeId then
    -- Find and close the open select
    -- This is handled in init.lua by checking openSelectId
  end
end

function Select.getOpenSelectId()
  return openSelectId
end

function Select.closeOpen(nodes)
  if not openSelectId then return end
  local node = nodes and nodes[openSelectId]
  if node and node._select then
    node._select.isOpen = false
    node._select.hoveredIndex = nil
  end
  openSelectId = nil
end

-- Handle keyboard events for open select
function Select.handleKeyPressed(node, key)
  local state = getState(node)
  if not state.isOpen then return false end

  local options = state.parsedOptions or {}

  if key == "escape" then
    state.isOpen = false
    state.hoveredIndex = nil
    openSelectId = nil
    return true
  elseif key == "up" then
    local idx = (state.hoveredIndex or 1) - 1
    if idx < 1 then idx = #options end
    state.hoveredIndex = idx
    return true
  elseif key == "down" then
    local idx = (state.hoveredIndex or 0) + 1
    if idx > #options then idx = 1 end
    state.hoveredIndex = idx
    return true
  elseif key == "return" or key == "kpenter" then
    if state.hoveredIndex and options[state.hoveredIndex] then
      local opt = options[state.hoveredIndex]
      state.selectedValue = opt.value
      state.isOpen = false
      state.hoveredIndex = nil
      openSelectId = nil
      queueEvent(node.id, "select:change", opt.value)
    end
    return true
  end

  return false
end

-- ============================================================================
-- Event draining
-- ============================================================================

function Select.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return Select
