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
local Color   = require("lua.color")
local Syntax  = require("lua.syntax")

local CodeBlock = {}

-- ============================================================================
-- Init
-- ============================================================================

function CodeBlock.init(config)
  config = config or {}
  Measure = config.measure
end

-- ============================================================================
-- Syntax highlighting (dispatches to per-language tokenizer)
-- ============================================================================

--- Resolve the language string, running auto-detect if needed.
local function resolveLanguage(lang, code)
  if not lang or lang == "" or lang == "auto" then
    -- Split into lines for detection
    local lines = {}
    for line in (code .. "\n"):gmatch("([^\n]*)\n") do
      lines[#lines + 1] = line
    end
    return Syntax.detectLanguage(lines)
  end
  return lang
end

-- ============================================================================
-- Measurement
-- ============================================================================

function CodeBlock.measure(node)
  local props = node.props or {}
  local code = props.code or ""
  local fontSize = Measure.scaleFontSize(props.fontSize or 10, node)
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
  local lang = resolveLanguage(props.language, code)
  local fontSize = Measure.scaleFontSize(props.fontSize or 10, node)
  local s = node.style or {}
  local padding = s.padding or 10

  -- Background
  local bgColor = s.backgroundColor
  if type(bgColor) == "string" then
    bgColor = Color.toTable(bgColor)
  elseif type(bgColor) == "table" then
    -- Already RGBA array
  else
    bgColor = Color.toTable("#0d1117")
  end
  setColorWithOpacity(bgColor, effectiveOpacity)
  local br = s.borderRadius or 4
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, br, br)

  -- Border
  if s.borderWidth and s.borderWidth > 0 then
    local borderColor = s.borderColor
    if type(borderColor) == "string" then
      borderColor = Color.toTable(borderColor)
    elseif type(borderColor) == "table" then
      -- Already RGBA array
    else
      borderColor = Color.toTable("#1e293b")
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

  -- Render each line with token-based syntax highlighting
  for i, line in ipairs(lines) do
    local y = c.y + padding + (i - 1) * lineHeight
    local tokens = Syntax.tokenizeLine(line, lang)
    local x = c.x + padding
    for _, tok in ipairs(tokens) do
      setColorWithOpacity(tok.color, effectiveOpacity)
      love.graphics.print(tok.text, x, y)
      x = x + font:getWidth(tok.text)
    end
  end

  -- Reset scissor
  love.graphics.setScissor()

  -- Copy button (rendered on top, outside scissor)
  local cs = getCopyState(node)
  local btnFont = Measure.getFont(9, nil, nil)
  local bx, by, bw, bh = getCopyButtonRect(c, btnFont)

  local btnBg = cs.copied and Color.toTable("#1a3a2a") or Color.toTable("#1e293b")
  setColorWithOpacity(btnBg, effectiveOpacity)
  love.graphics.rectangle("fill", bx, by, bw, bh, 3, 3)

  local btnColor = cs.copied and Color.toTable("#4ade80") or Color.toTable("#64748b")
  setColorWithOpacity(btnColor, effectiveOpacity)
  love.graphics.setFont(btnFont)
  local label = cs.copied and "Copied!" or "Copy"
  love.graphics.print(label, bx + 8, by + 3)
end

return CodeBlock
