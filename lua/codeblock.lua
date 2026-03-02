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

-- Lazy-load Measure if init() was never called (e.g. subprocess windows)
local function getMeasure()
  if not Measure then
    Measure = require("lua.measure")
  end
  return Measure
end

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
  local fontSize = getMeasure().scaleFontSize(props.fontSize or 10, node)
  local s = node.style or {}
  local padding = s.padding or 10

  -- Split into lines
  local lines = {}
  for line in (code .. "\n"):gmatch("([^\n]*)\n") do
    lines[#lines + 1] = line
  end
  if #lines == 0 then lines[1] = "" end

  -- Get font and line height
  local font = getMeasure().getFont(fontSize, nil, nil)
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

  local btnFont = getMeasure().getFont(9, nil, nil)
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
  local fontSize = getMeasure().scaleFontSize(props.fontSize or 10, node)
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
  local font = getMeasure().getFont(fontSize, nil, nil)
  love.graphics.setFont(font)
  local lineHeight = font:getHeight()

  -- Scissor to code area (transform-aware, intersects parent scissor)
  local prevScissor = {love.graphics.getScissor()}
  local sx, sy = love.graphics.transformPoint(c.x, c.y)
  local sx2, sy2 = love.graphics.transformPoint(c.x + c.w, c.y + c.h)
  local sw, sh = math.max(0, sx2 - sx), math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)

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

  -- Draw text selection highlight (inside scissor so it clips with content)
  CodeBlock.drawHighlight(node, c, padding, lines, font, lineHeight, effectiveOpacity)

  -- Restore previous scissor state
  if prevScissor[1] then
    love.graphics.setScissor(prevScissor[1], prevScissor[2], prevScissor[3], prevScissor[4])
  else
    love.graphics.setScissor()
  end

  -- Copy button (rendered on top, outside scissor)
  local cs = getCopyState(node)
  local btnFont = getMeasure().getFont(9, nil, nil)
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

-- ============================================================================
-- Text selection support
-- ============================================================================

--- Get the plain-text lines and font info for a CodeBlock node.
--- Used by textselection.lua to extract selected text.
function CodeBlock.getLines(node)
  local props = node.props or {}
  local code = props.code or ""
  local fontSize = getMeasure().scaleFontSize(props.fontSize or 10, node)
  local s = node.style or {}
  local padding = s.padding or 10
  local font = getMeasure().getFont(fontSize, nil, nil)
  local lineHeight = font:getHeight()

  local lines = {}
  for line in (code .. "\n"):gmatch("([^\n]*)\n") do
    lines[#lines + 1] = line
  end
  if #lines == 0 then lines[1] = "" end

  return lines, font, lineHeight, padding
end

--- Map screen coordinates to (line, col) within this CodeBlock.
--- Returns 1-based line, 0-based col (byte offset).
function CodeBlock.screenToPos(node, mx, my)
  local c = node.computed
  if not c then return 1, 0 end

  local lines, font, lineHeight, padding = CodeBlock.getLines(node)

  -- Convert screen coords to content-space (account for scroll ancestors)
  local sx, sy = mx, my
  local ok, Events = pcall(require, "lua.events")
  if ok and Events and Events.screenToContent then
    sx, sy = Events.screenToContent(node, mx, my)
  end

  local relY = sy - c.y - padding
  local line = math.floor(relY / lineHeight) + 1
  line = math.max(1, math.min(line, #lines))

  local lineText = lines[line] or ""
  local relX = sx - c.x - padding
  local col = 0
  local bytePos = 1
  local len = #lineText

  while bytePos <= len do
    local b = lineText:byte(bytePos)
    local cpLen = (b < 0x80 and 1) or (b < 0xE0 and 2) or (b < 0xF0 and 3) or 4
    local endByte = math.min(bytePos + cpLen - 1, len)

    local substr = lineText:sub(1, endByte)
    local w = font:getWidth(substr)
    if w > relX then
      local prevSubstr = lineText:sub(1, bytePos - 1)
      local prevW = (bytePos > 1) and font:getWidth(prevSubstr) or 0
      col = (relX - prevW < w - relX) and (bytePos - 1) or endByte
      break
    end
    col = endByte
    bytePos = endByte + 1
  end

  return line, col
end

--- Draw selection highlight rectangles for this CodeBlock.
--- Called during render, inside the scissor region.
function CodeBlock.drawHighlight(node, c, padding, lines, font, lineHeight, effectiveOpacity)
  -- Lazy-require to avoid circular dependency at load time
  local ok, TextSelection = pcall(require, "lua.textselection")
  if not ok or not TextSelection then return end

  local sel = TextSelection.get()
  if not sel then return end

  -- Check if this node is part of the selection range
  local startNode = sel.startNode
  local endNode = sel.endNode
  if startNode ~= node and endNode ~= node then
    -- Also check multi-node range via order
    local order = sel.order
    if not order then return end
    local idx = order.indexByNode and order.indexByNode[node]
    local sIdx = order.indexByNode and order.indexByNode[startNode]
    local eIdx = order.indexByNode and order.indexByNode[endNode]
    if not idx or not sIdx or not eIdx then return end
    local lo, hi = math.min(sIdx, eIdx), math.max(sIdx, eIdx)
    if idx < lo or idx > hi then return end
  end

  -- Determine which lines/cols are selected in this node
  local startLine, startCol, endLine, endCol

  -- Normalize direction
  local rangeStartNode, rangeStartLine, rangeStartCol
  local rangeEndNode, rangeEndLine, rangeEndCol
  local order = sel.order
  if order and order.indexByNode then
    local sIdx = order.indexByNode[sel.startNode] or 0
    local eIdx = order.indexByNode[sel.endNode] or 0
    if sIdx < eIdx or (sIdx == eIdx and (sel.startLine < sel.endLine or (sel.startLine == sel.endLine and sel.startCol <= sel.endCol))) then
      rangeStartNode, rangeStartLine, rangeStartCol = sel.startNode, sel.startLine, sel.startCol
      rangeEndNode, rangeEndLine, rangeEndCol = sel.endNode, sel.endLine, sel.endCol
    else
      rangeStartNode, rangeStartLine, rangeStartCol = sel.endNode, sel.endLine, sel.endCol
      rangeEndNode, rangeEndLine, rangeEndCol = sel.startNode, sel.startLine, sel.startCol
    end
  else
    rangeStartNode, rangeStartLine, rangeStartCol = sel.startNode, sel.startLine, sel.startCol
    rangeEndNode, rangeEndLine, rangeEndCol = sel.endNode, sel.endLine, sel.endCol
  end

  if node == rangeStartNode then
    startLine, startCol = rangeStartLine, rangeStartCol
  else
    startLine, startCol = 1, 0
  end

  if node == rangeEndNode then
    endLine, endCol = rangeEndLine, rangeEndCol
  else
    endLine = #lines
    endCol = #(lines[endLine] or "")
  end

  if startLine > endLine or (startLine == endLine and startCol >= endCol) then return end

  love.graphics.setColor(0.22, 0.35, 0.55, 0.55 * effectiveOpacity)

  for i = startLine, endLine do
    local lineText = lines[i] or ""
    local x0 = c.x + padding
    local y0 = c.y + padding + (i - 1) * lineHeight

    local sx, ex
    if i == startLine and startCol > 0 then
      sx = font:getWidth(lineText:sub(1, startCol))
    else
      sx = 0
    end

    if i == endLine and endCol > 0 then
      ex = font:getWidth(lineText:sub(1, endCol))
    elseif i == endLine then
      ex = 0
    else
      ex = font:getWidth(lineText)
    end

    if ex > sx then
      love.graphics.rectangle("fill", x0 + sx, y0, ex - sx, lineHeight)
    end
  end
end

return CodeBlock
