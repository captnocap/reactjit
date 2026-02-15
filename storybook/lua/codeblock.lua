--[[
  codeblock.lua -- Lua-owned code block renderer

  Renders syntax-highlighted code with tight line spacing.
  No React layout involvement for line positioning — we calculate positions
  directly like texteditor.lua does.

  Provides:
    - CodeBlock.measure(node) -> { width, height }
    - CodeBlock.render(node, c, effectiveOpacity)
]]

local Measure = nil

local CodeBlock = {}

-- ============================================================================
-- Init
-- ============================================================================

function CodeBlock.init(config)
  config = config or {}
  Measure = config.measure
end

-- ============================================================================
-- Syntax highlighting colors
-- ============================================================================

local KEYWORDS = {
  ["const"] = true, ["let"] = true, ["var"] = true, ["function"] = true,
  ["class"] = true, ["interface"] = true, ["type"] = true, ["enum"] = true,
  ["return"] = true, ["if"] = true, ["else"] = true, ["for"] = true,
  ["while"] = true, ["switch"] = true, ["case"] = true, ["break"] = true,
  ["continue"] = true, ["new"] = true, ["throw"] = true, ["try"] = true,
  ["catch"] = true, ["finally"] = true, ["async"] = true, ["await"] = true,
  ["yield"] = true, ["do"] = true, ["in"] = true, ["of"] = true,
  ["typeof"] = true, ["instanceof"] = true, ["void"] = true, ["delete"] = true,
  ["default"] = true, ["extends"] = true, ["implements"] = true, ["super"] = true,
  ["this"] = true, ["static"] = true, ["get"] = true, ["set"] = true,
  ["true"] = true, ["false"] = true, ["nil"] = true, ["null"] = true,
  ["undefined"] = true, ["local"] = true, ["then"] = true, ["end"] = true,
  ["elseif"] = true, ["not"] = true, ["and"] = true, ["or"] = true,
  ["require"] = true,
}

local IMPORTS = {
  ["import"] = true, ["export"] = true, ["from"] = true,
}

local TYPES = {
  ["string"] = true, ["number"] = true, ["boolean"] = true, ["any"] = true,
  ["never"] = true, ["Record"] = true, ["Array"] = true, ["Promise"] = true,
  ["void"] = true, ["null"] = true, ["undefined"] = true, ["object"] = true,
  ["symbol"] = true, ["bigint"] = true, ["unknown"] = true,
}

local function hexToRGBA(hex)
  hex = hex:gsub("#", "")
  local r = tonumber(hex:sub(1,2), 16) / 255
  local g = tonumber(hex:sub(3,4), 16) / 255
  local b = tonumber(hex:sub(5,6), 16) / 255
  local color = {r, g, b, 1}
  return color
end

local COLORS = {
  comment = hexToRGBA("#6a9955"),
  keyword = hexToRGBA("#569cd6"),
  type = hexToRGBA("#4ec9b0"),
  import = hexToRGBA("#c586c0"),
  string = hexToRGBA("#ce9178"),
  number = hexToRGBA("#b5cea8"),
  default = hexToRGBA("#c9d1d9"),
}

--- Determine line color based on content
local function getLineColor(line)
  local trimmed = line:match("^%s*(.-)%s*$") or ""

  -- Comments
  if trimmed:match("^//") or trimmed:match("^#") or trimmed:match("^%-%-") or
     trimmed:match("^%*") or trimmed:match("^/%*") then
    return COLORS.comment
  end

  -- Imports
  if trimmed:match("^import%s") or trimmed:match("^export%s") or
     trimmed:match("^from%s") or trimmed:match("^require%s") then
    return COLORS.import
  end

  -- Keywords (check first word)
  local firstWord = trimmed:match("^([%w_]+)")
  if firstWord and KEYWORDS[firstWord] then
    return COLORS.keyword
  end
  if firstWord and TYPES[firstWord] then
    return COLORS.type
  end

  -- String-heavy lines
  if trimmed:match("['\"`]") then
    return COLORS.string
  end

  -- Number-heavy lines
  if trimmed:match("^%d") or trimmed:match("[,:=]%s*%d") then
    return COLORS.number
  end

  return COLORS.default
end

-- ============================================================================
-- Measurement
-- ============================================================================

function CodeBlock.measure(node)
  local props = node.props or {}
  local code = props.code or ""
  local fontSize = props.fontSize or 10
  local s = node.style or {}
  local padding = s.padding or 10

  -- Split into lines
  local lines = {}
  for line in (code .. "\n"):gmatch("([^\n]*)\n") do
    lines[#lines + 1] = line
  end
  if #lines == 0 then lines[1] = "" end

  -- Get font and line height
  local font = Measure.getFont(fontSize, nil, nil)
  local lineHeight = font:getHeight()

  -- Calculate dimensions
  local maxWidth = 0
  for _, line in ipairs(lines) do
    local w = font:getWidth(line)
    if w > maxWidth then maxWidth = w end
  end

  local width = maxWidth + padding * 2
  local height = #lines * lineHeight + padding * 2

  return { width = width, height = height }
end

-- ============================================================================
-- Rendering
-- ============================================================================

local function setColorWithOpacity(color, opacity)
  love.graphics.setColor(color[1], color[2], color[3], (color[4] or 1) * opacity)
end

-- ============================================================================
-- Copy button state (per-node, keyed by node id)
-- ============================================================================

local copyStates = {}  -- [nodeId] = { copied = false, timer = 0 }

local function getCopyState(node)
  local id = node.id or tostring(node)
  if not copyStates[id] then
    copyStates[id] = { copied = false, timer = 0 }
  end
  return copyStates[id]
end

--- Returns the bounding rect of the copy button for a given node's computed rect.
local function getCopyButtonRect(c, btnFont)
  local label = "Copy"
  local textW = btnFont:getWidth(label)
  local textH = btnFont:getHeight()
  local padH, padV = 8, 3
  local btnW = textW + padH * 2
  local btnH = textH + padV * 2
  local margin = 6
  local bx = c.x + c.w - btnW - margin
  local by = c.y + margin
  return bx, by, btnW, btnH
end

function CodeBlock.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  local c = node.computed
  if not c then return false end

  local btnFont = Measure.getFont(9, nil, nil)
  local bx, by, bw, bh = getCopyButtonRect(c, btnFont)

  if mx >= bx and mx <= bx + bw and my >= by and my <= by + bh then
    local code = (node.props or {}).code or ""
    pcall(function() love.system.setClipboardText(code) end)
    local cs = getCopyState(node)
    cs.copied = true
    cs.timer = 2.0
    return true
  end
  return false
end

function CodeBlock.update(dt)
  for id, cs in pairs(copyStates) do
    if cs.copied then
      cs.timer = cs.timer - dt
      if cs.timer <= 0 then
        cs.copied = false
        cs.timer = 0
      end
    end
  end
end

function CodeBlock.render(node, c, effectiveOpacity)
  local props = node.props or {}
  local code = props.code or ""
  local fontSize = props.fontSize or 10
  local s = node.style or {}
  local padding = s.padding or 10

  -- Background
  local bgColor = s.backgroundColor
  if type(bgColor) == "string" then
    bgColor = hexToRGBA(bgColor)
  elseif type(bgColor) == "table" then
    -- Already RGBA array
  else
    bgColor = hexToRGBA("#0d1117")
  end
  setColorWithOpacity(bgColor, effectiveOpacity)
  local br = s.borderRadius or 4
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, br, br)

  -- Border
  if s.borderWidth and s.borderWidth > 0 then
    local borderColor = s.borderColor
    if type(borderColor) == "string" then
      borderColor = hexToRGBA(borderColor)
    elseif type(borderColor) == "table" then
      -- Already RGBA array
    else
      borderColor = hexToRGBA("#1e293b")
    end
    setColorWithOpacity(borderColor, effectiveOpacity)
    love.graphics.setLineWidth(s.borderWidth)
    love.graphics.rectangle("line", c.x, c.y, c.w, c.h, br, br)
  end

  -- Split into lines
  local lines = {}
  for line in (code .. "\n"):gmatch("([^\n]*)\n") do
    lines[#lines + 1] = line
  end
  if #lines == 0 then lines[1] = "" end

  -- Get font and line height
  local font = Measure.getFont(fontSize, nil, nil)
  love.graphics.setFont(font)
  local lineHeight = font:getHeight()

  -- Scissor to code area (transform-aware for scroll containers)
  local sx, sy = love.graphics.transformPoint(c.x, c.y)
  love.graphics.setScissor(sx, sy, c.w, c.h)

  -- Render each line
  for i, line in ipairs(lines) do
    local y = c.y + padding + (i - 1) * lineHeight
    local color = getLineColor(line)
    setColorWithOpacity(color, effectiveOpacity)
    love.graphics.print(line, c.x + padding, y)
  end

  -- Reset scissor
  love.graphics.setScissor()

  -- Copy button (rendered on top, outside scissor)
  local cs = getCopyState(node)
  local btnFont = Measure.getFont(9, nil, nil)
  local bx, by, bw, bh = getCopyButtonRect(c, btnFont)

  local btnBg = cs.copied and hexToRGBA("#1a3a2a") or hexToRGBA("#1e293b")
  setColorWithOpacity(btnBg, effectiveOpacity)
  love.graphics.rectangle("fill", bx, by, bw, bh, 3, 3)

  local btnColor = cs.copied and hexToRGBA("#4ade80") or hexToRGBA("#64748b")
  setColorWithOpacity(btnColor, effectiveOpacity)
  love.graphics.setFont(btnFont)
  local label = cs.copied and "Copied!" or "Copy"
  love.graphics.print(label, bx + 8, by + 3)
end

return CodeBlock
