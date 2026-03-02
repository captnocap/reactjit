--[[
  textselection.lua -- Text selection and clipboard copy for Text nodes

  Manages a global selection state (only one text selection active at a time).
  Text nodes are selectable by default unless style.userSelect == "none".

  Flow:
    1. mousepressed on a Text node -> start(node, line, col)
    2. mousemoved while dragging   -> update(node, line, col)
    3. mousereleased               -> finalize() (extract text, clear if zero-length)
    4. Ctrl+C / Cmd+C              -> copyToClipboard()
    5. Click outside text           -> clear()

  Requires: measure.lua, events.lua, tree.lua (injected via init)
]]

local ZIndex = require("lua.zindex")

local TextSelection = {}

local Measure = nil
local Events = nil
local Tree = nil
local CodeBlockModule = nil

local function getCodeBlock()
  if not CodeBlockModule then
    local ok, mod = pcall(require, "lua.codeblock")
    if ok then CodeBlockModule = mod end
  end
  return CodeBlockModule
end

function TextSelection.init(config)
  config = config or {}
  Measure = config.measure
  Events = config.events
  Tree = config.tree
end

-- ============================================================================
-- Global selection state (singleton -- only one selection at a time)
-- ============================================================================

local selection = nil
-- {
--   node       = <node>,       -- legacy alias for startNode (compat)
--   startNode  = <node>,       -- canonical Text node where drag started
--   startLine  = number,       -- line where drag started (1-based)
--   startCol   = number,       -- col where drag started (0-based byte offset)
--   endNode    = <node>,       -- canonical Text node where drag currently is
--   endLine    = number,       -- line where drag currently is
--   endCol     = number,       -- col where drag currently is
--   isDragging = boolean,      -- true while mouse button is held
--   text       = string|nil,   -- extracted text after finalize()
--   order      = table|nil,    -- cached text-node order for range ops
-- }

-- ============================================================================
-- Helpers
-- ============================================================================

local function getRoot()
  if Tree and Tree.getTree then
    return Tree.getTree()
  end
  return nil
end

local function hasTextParent(node)
  return node and node.parent and node.parent.type == "Text"
end

local function canonicalTextNode(node)
  if not node then return nil end

  -- CodeBlock nodes are their own canonical node
  if node.type == "CodeBlock" then
    return node
  end

  local current = node
  if current.type == "__TEXT__" and current.parent then
    current = current.parent
  end

  if current.type ~= "Text" then
    return nil
  end

  -- Collapse nested Text spans into a single selectable block.
  while hasTextParent(current) do
    current = current.parent
  end
  return current
end

--- Check if a node allows text selection.
--- Default is selectable (true) unless userSelect == "none".
function TextSelection.isSelectable(node)
  if not node then return false end
  -- CodeBlock is always selectable (unless userSelect == "none")
  if node.type == "CodeBlock" then
    local s = node.style or {}
    return s.userSelect ~= "none"
  end
  local canonical = canonicalTextNode(node)
  if not canonical then return false end
  local s = canonical.style or {}
  return s.userSelect ~= "none"
end

local function isTopLevelTextNode(node)
  if not node then return false end
  if node.type == "CodeBlock" then
    return TextSelection.isSelectable(node)
  end
  return node.type == "Text"
    and not hasTextParent(node)
    and TextSelection.isSelectable(node)
end

--- Resolve style properties for a text node.
local function resolveTextStyle(node)
  local s = node.style or {}
  local fontSize = s.fontSize or 14
  local fontFamily = s.fontFamily
  local fontWeight = s.fontWeight
  local lineHeight = s.lineHeight
  local letterSpacing = s.letterSpacing or 0

  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if not s.fontSize and ps.fontSize then fontSize = ps.fontSize end
    if not fontFamily then fontFamily = ps.fontFamily end
    if not fontWeight then fontWeight = ps.fontWeight end
    if not lineHeight then lineHeight = ps.lineHeight end
    if not s.letterSpacing and ps.letterSpacing then letterSpacing = ps.letterSpacing end
  end

  return fontSize, fontFamily, fontWeight, lineHeight, letterSpacing
end

--- Resolve textAlign for a text node (mirrors painter.lua behavior).
local function resolveTextAlign(node)
  local s = node.style or {}
  local align = s.textAlign

  if not align and node.type == "__TEXT__" and node.parent then
    align = (node.parent.style or {}).textAlign
  end

  if align == "center" or align == "right" then
    return align
  end
  return "left"
end

local function resolveTextOverflow(node)
  local s = node.style or {}
  local textOverflow = s.textOverflow

  if not textOverflow and node.type == "__TEXT__" and node.parent then
    textOverflow = (node.parent.style or {}).textOverflow
  end

  return textOverflow
end

local function resolveNumberOfLines(node)
  local p = node.props or {}
  local numberOfLines = p.numberOfLines

  if not numberOfLines and node.type == "__TEXT__" and node.parent then
    numberOfLines = (node.parent.props or {}).numberOfLines
  end

  return numberOfLines
end

local function getLineAlignOffset(align, maxWidth, lineWidth)
  if align == "center" then
    return (maxWidth - lineWidth) * 0.5
  end
  if align == "right" then
    return maxWidth - lineWidth
  end
  return 0
end

local ELLIPSIS = "..."

local function truncateWithEllipsis(font, text, maxWidth, letterSpacing)
  if not maxWidth or maxWidth <= 0 then
    return text
  end

  local fullWidth = Measure.getWidthWithSpacing(font, text, letterSpacing)
  if fullWidth <= maxWidth then
    return text
  end

  local ellipsisW = Measure.getWidthWithSpacing(font, ELLIPSIS, letterSpacing)
  local available = maxWidth - ellipsisW
  if available <= 0 then
    return ELLIPSIS
  end

  local lo, hi = 0, #text
  while lo < hi do
    local mid = math.floor((lo + hi + 1) / 2)
    local prefix = text:sub(1, mid)
    local pw = Measure.getWidthWithSpacing(font, prefix, letterSpacing)
    if pw <= available then
      lo = mid
    else
      hi = mid - 1
    end
  end

  if lo == 0 then
    return ELLIPSIS
  end

  return text:sub(1, lo) .. ELLIPSIS
end

local function getVisibleLines(font, text, maxWidth, numberOfLines, textOverflow, letterSpacing)
  text = text:gsub("\r\n", "\n"):gsub("\r", "\n")

  local wrapConstraint = maxWidth
  if letterSpacing and letterSpacing ~= 0 then
    local avgCharW = font:getWidth("M")
    if avgCharW > 0 then
      local ratio = avgCharW / (avgCharW + letterSpacing)
      wrapConstraint = maxWidth * ratio
    end
  end

  local _, lines = font:getWrap(text, wrapConstraint)
  if #lines == 0 then
    lines = { "" }
  end

  if not numberOfLines or numberOfLines <= 0 or #lines <= numberOfLines then
    return lines
  end

  local visible = {}
  for i = 1, numberOfLines do
    visible[i] = lines[i]
  end

  if textOverflow == "ellipsis" and numberOfLines > 0 then
    local lastLine = visible[numberOfLines] or ""
    visible[numberOfLines] = truncateWithEllipsis(font, lastLine, maxWidth, letterSpacing)
  end

  return visible
end

--- Resolve text content from a node (same as layout.lua's resolveTextContent).
local function resolveTextContent(node)
  if node.type == "CodeBlock" then
    return (node.props or {}).code or ""
  end

  if node.type == "__TEXT__" then
    return node.text or ""
  end

  if node.type == "Text" then
    if node.children then
      local parts = {}
      for _, child in ipairs(node.children) do
        if child.type == "__TEXT__" then
          parts[#parts + 1] = child.text or ""
        elseif child.type == "Text" then
          parts[#parts + 1] = resolveTextContent(child)
        end
      end
      if #parts > 0 then
        return table.concat(parts)
      end
    end

    local text = node.text or (node.props and node.props.children) or ""
    if type(text) == "table" then text = table.concat(text) end
    return tostring(text)
  end

  return ""
end

--- Get wrapped lines for a text node (mirrors painter.lua's getVisibleLines).
local function getWrappedLines(node)
  -- CodeBlock has its own line splitting (no wrapping)
  if node.type == "CodeBlock" then
    local cb = getCodeBlock()
    if cb and cb.getLines then
      local lines, font, lineH, _ = cb.getLines(node)
      return lines, font, 0, lineH, 0
    end
    return {}, nil, 0, 14, 0
  end

  local fontSize, fontFamily, fontWeight, lineHeight, letterSpacing = resolveTextStyle(node)
  local font = Measure.getFont(fontSize, fontFamily, fontWeight)
  local c = node.computed
  if not c then return {}, font, fontSize, lineHeight, letterSpacing end

  local text = resolveTextContent(node)
  if text == "" then return { "" }, font, fontSize, lineHeight, letterSpacing end

  local maxWidth = c.w
  if maxWidth and maxWidth > 0 then
    local textOverflow = resolveTextOverflow(node)
    local numberOfLines = resolveNumberOfLines(node)

    if textOverflow == "ellipsis" and not numberOfLines then
      local truncated = truncateWithEllipsis(font, text, maxWidth, letterSpacing)
      return { truncated }, font, fontSize, lineHeight, letterSpacing
    end

    local lines = getVisibleLines(font, text, maxWidth, numberOfLines, textOverflow, letterSpacing)
    return lines, font, fontSize, lineHeight, letterSpacing
  end

  text = text:gsub("\r\n", "\n"):gsub("\r", "\n")
  return { text }, font, fontSize, lineHeight, letterSpacing
end

local function clampPos(node, line, col, linesOpt)
  local lines = linesOpt or getWrappedLines(node)
  if #lines == 0 then lines = { "" } end

  local clampedLine = math.max(1, math.min(tonumber(line) or 1, #lines))
  local lineText = lines[clampedLine] or ""
  local maxCol = #lineText
  local clampedCol = math.max(0, math.min(tonumber(col) or 0, maxCol))
  return clampedLine, clampedCol
end

local function collectSelectableTextNodes(node, out)
  if not node or not node.computed then return end
  local s = node.style or {}
  if s.display == "none" then return end

  if isTopLevelTextNode(node) then
    out[#out + 1] = node
  end

  local children = ZIndex.getSortedChildren(node.children or {})
  for i = 1, #children do
    collectSelectableTextNodes(children[i], out)
  end
end

local function buildNodeOrder(root)
  local nodes = {}
  collectSelectableTextNodes(root, nodes)

  local indexByNode = {}
  for i, node in ipairs(nodes) do
    indexByNode[node] = i
  end

  return {
    nodes = nodes,
    indexByNode = indexByNode,
    root = root,
  }
end

local function refreshOrder(root)
  if not selection then return nil end
  local treeRoot = root or getRoot()
  if not treeRoot then
    selection.order = nil
    return nil
  end
  selection.order = buildNodeOrder(treeRoot)
  return selection.order
end

local function ensureOrder()
  if not selection then return nil end
  local order = selection.order
  if not order then
    return refreshOrder()
  end

  local startNode = selection.startNode
  local endNode = selection.endNode
  if not startNode or not endNode then
    return refreshOrder()
  end

  if not order.indexByNode[startNode] or not order.indexByNode[endNode] then
    return refreshOrder()
  end

  return order
end

local function nearestSelectableTextNode(root, mx, my)
  if not root then return nil end
  local order = buildNodeOrder(root)
  local bestNode = nil
  local bestDist2 = nil

  for _, node in ipairs(order.nodes) do
    local c = node.computed
    if c then
      local dx = 0
      if mx < c.x then
        dx = c.x - mx
      elseif mx > c.x + c.w then
        dx = mx - (c.x + c.w)
      end

      local dy = 0
      if my < c.y then
        dy = c.y - my
      elseif my > c.y + c.h then
        dy = my - (c.y + c.h)
      end

      local d2 = dx * dx + dy * dy
      if not bestDist2 or d2 < bestDist2 then
        bestDist2 = d2
        bestNode = node
      end
    end
  end

  return bestNode
end

local function comparePositions(a, b, order)
  if a.node == b.node then
    if a.line ~= b.line then
      return (a.line < b.line) and -1 or 1
    end
    if a.col ~= b.col then
      return (a.col < b.col) and -1 or 1
    end
    return 0
  end

  local ai = order and order.indexByNode[a.node] or nil
  local bi = order and order.indexByNode[b.node] or nil
  if ai and bi and ai ~= bi then
    return (ai < bi) and -1 or 1
  end

  if ai and not bi then return -1 end
  if bi and not ai then return 1 end

  local aid = tonumber(a.node and a.node.id) or 0
  local bid = tonumber(b.node and b.node.id) or 0
  if aid ~= bid then
    return (aid < bid) and -1 or 1
  end

  if a.line ~= b.line then
    return (a.line < b.line) and -1 or 1
  end
  if a.col ~= b.col then
    return (a.col < b.col) and -1 or 1
  end
  return 0
end

local function normalizedRange()
  if not selection or not selection.startNode or not selection.endNode then
    return nil, nil, nil
  end

  local order = ensureOrder()
  local a = {
    node = selection.startNode,
    line = selection.startLine,
    col = selection.startCol,
  }
  local b = {
    node = selection.endNode,
    line = selection.endLine,
    col = selection.endCol,
  }

  if comparePositions(a, b, order) <= 0 then
    return a, b, order
  end
  return b, a, order
end

--- Map screen coordinates (mx, my) to (line, col) within a Text node.
--- Returns 1-based line, 0-based col (byte offset before cursor position).
function TextSelection.screenToPos(node, mx, my)
  local canonical = canonicalTextNode(node)
  if not canonical or not canonical.computed then return 1, 0 end

  -- Delegate to CodeBlock's own screenToPos
  if canonical.type == "CodeBlock" then
    local cb = getCodeBlock()
    if cb and cb.screenToPos then
      return cb.screenToPos(canonical, mx, my)
    end
    return 1, 0
  end

  local c = canonical.computed
  local lines, font, _, lineHeight, letterSpacing = getWrappedLines(canonical)
  local effectiveLineH = lineHeight or font:getHeight()
  local align = resolveTextAlign(canonical)

  local sx, sy = mx, my
  if Events and Events.screenToContent then
    sx, sy = Events.screenToContent(canonical, mx, my)
  end

  local relY = sy - c.y
  local line = math.floor(relY / effectiveLineH) + 1
  line = math.max(1, math.min(line, #lines))

  local lineText = lines[line] or ""
  local lineWidth = Measure.getWidthWithSpacing(font, lineText, letterSpacing)
  local lineOffset = getLineAlignOffset(align, c.w or 0, lineWidth)
  local relX = sx - c.x - lineOffset
  local col = 0
  local bytePos = 1
  local len = #lineText

  while bytePos <= len do
    local b = lineText:byte(bytePos)
    local cpLen = (b < 0x80 and 1) or (b < 0xE0 and 2) or (b < 0xF0 and 3) or 4
    local endByte = math.min(bytePos + cpLen - 1, len)

    local substr = lineText:sub(1, endByte)
    local w = Measure.getWidthWithSpacing(font, substr, letterSpacing)
    if w > relX then
      local prevSubstr = lineText:sub(1, bytePos - 1)
      local prevW = (bytePos > 1) and Measure.getWidthWithSpacing(font, prevSubstr, letterSpacing) or 0
      col = (relX - prevW < w - relX) and (bytePos - 1) or endByte
      break
    end
    col = endByte
    bytePos = endByte + 1
  end

  return line, col
end

--- Resolve best selection endpoint for a screen point.
--- Returns canonical node + line/col.
function TextSelection.screenToSelectionPos(root, mx, my, fallbackNode)
  local treeRoot = root or getRoot()
  local node = nil

  if treeRoot and Events and Events.textHitTest then
    local hit = Events.textHitTest(treeRoot, mx, my)
    node = canonicalTextNode(hit)
  end

  if not TextSelection.isSelectable(node) and treeRoot then
    node = nearestSelectableTextNode(treeRoot, mx, my)
  end

  if not TextSelection.isSelectable(node) then
    node = canonicalTextNode(fallbackNode)
  end

  if not TextSelection.isSelectable(node) then
    return nil, 1, 0
  end

  local line, col = TextSelection.screenToPos(node, mx, my)
  return node, line, col
end

-- ============================================================================
-- Selection API
-- ============================================================================

--- Begin selection on a Text node at (line, col).
function TextSelection.start(node, line, col)
  local canonical = canonicalTextNode(node)
  if not TextSelection.isSelectable(canonical) then return end

  local lines = getWrappedLines(canonical)
  local clampedLine, clampedCol = clampPos(canonical, line, col, lines)

  selection = {
    node = canonical,
    startNode = canonical,
    startLine = clampedLine,
    startCol = clampedCol,
    endNode = canonical,
    endLine = clampedLine,
    endCol = clampedCol,
    isDragging = true,
    text = nil,
    order = nil,
  }

  refreshOrder()
end

--- Update the end position during drag.
--- Supports:
---   update(line, col) for same-node updates
---   update(node, line, col) for cross-node updates
function TextSelection.update(a, b, c)
  if not selection or not selection.isDragging then return end

  local node, line, col
  if type(a) == "table" then
    node, line, col = a, b, c
  else
    node, line, col = selection.endNode or selection.startNode, a, b
  end

  node = canonicalTextNode(node) or selection.endNode or selection.startNode
  if not TextSelection.isSelectable(node) then
    return
  end

  local lines = getWrappedLines(node)
  local clampedLine, clampedCol = clampPos(node, line, col, lines)

  selection.endNode = node
  selection.endLine = clampedLine
  selection.endCol = clampedCol
  selection.text = nil
end

--- Extract text from wrapped lines between (startLine, startCol) and (endLine, endCol).
local function extractText(lines, startLine, startCol, endLine, endCol)
  if startLine > endLine or (startLine == endLine and startCol > endCol) then
    startLine, startCol, endLine, endCol = endLine, endCol, startLine, startCol
  end

  if startLine == endLine then
    local lineText = lines[startLine] or ""
    return lineText:sub(startCol + 1, endCol)
  end

  local parts = {}
  local firstLine = lines[startLine] or ""
  parts[#parts + 1] = firstLine:sub(startCol + 1)

  for i = startLine + 1, endLine - 1 do
    parts[#parts + 1] = lines[i] or ""
  end

  local lastLine = lines[endLine] or ""
  parts[#parts + 1] = lastLine:sub(1, endCol)

  return table.concat(parts, "\n")
end

local function separatorBetween(prevNode, nextNode)
  if not prevNode or not nextNode then return "\n" end
  local pc = prevNode.computed
  local nc = nextNode.computed
  if not pc or not nc then return "\n" end

  local rowThreshold = math.max(2, math.min(pc.h or 0, nc.h or 0) * 0.35)
  local sameRow = math.abs((pc.y or 0) - (nc.y or 0)) <= rowThreshold

  if sameRow and (nc.x or 0) >= (pc.x or 0) then
    local gap = (nc.x or 0) - ((pc.x or 0) + (pc.w or 0))
    if gap > 4 then
      return " "
    end
    return ""
  end

  return "\n"
end

local function extractSelectionText()
  local rangeStart, rangeEnd, order = normalizedRange()
  if not rangeStart or not rangeEnd then
    return ""
  end

  if rangeStart.node == rangeEnd.node then
    local lines = getWrappedLines(rangeStart.node)
    return extractText(lines, rangeStart.line, rangeStart.col, rangeEnd.line, rangeEnd.col)
  end

  local indexByNode = order and order.indexByNode or nil
  local nodes = order and order.nodes or nil
  local startIdx = indexByNode and indexByNode[rangeStart.node] or nil
  local endIdx = indexByNode and indexByNode[rangeEnd.node] or nil
  if not startIdx or not endIdx or not nodes then
    return ""
  end

  local parts = {}
  for i = startIdx, endIdx do
    local node = nodes[i]
    local lines = getWrappedLines(node)
    local nodeStartLine, nodeStartCol = 1, 0
    local nodeEndLine = #lines
    local nodeEndCol = #(lines[nodeEndLine] or "")

    if node == rangeStart.node then
      nodeStartLine, nodeStartCol = rangeStart.line, rangeStart.col
    end
    if node == rangeEnd.node then
      nodeEndLine, nodeEndCol = rangeEnd.line, rangeEnd.col
    end

    local chunk = extractText(lines, nodeStartLine, nodeStartCol, nodeEndLine, nodeEndCol)
    parts[#parts + 1] = chunk

    if i < endIdx then
      parts[#parts + 1] = separatorBetween(node, nodes[i + 1])
    end
  end

  return table.concat(parts)
end

--- Finalize selection after mouse release. Extracts text, clears if zero-length.
function TextSelection.finalize()
  if not selection then return end
  selection.isDragging = false

  local text = extractSelectionText()
  if #text == 0 then
    selection = nil
    return
  end

  selection.text = text
end

--- Clear the current selection.
function TextSelection.clear()
  selection = nil
end

--- Get the current selection state (or nil).
function TextSelection.get()
  return selection
end

--- Select all selectable Text nodes on the page.
--- Sets selection spanning from the first character of the first node to the
--- last character of the last node, extracts text, and copies to clipboard.
--- Returns true if any text was selected, false if no text nodes were found.
function TextSelection.selectAll(root)
  local treeRoot = root or getRoot()
  if not treeRoot then return false end

  local order = buildNodeOrder(treeRoot)
  if not order or #order.nodes == 0 then return false end

  local firstNode = order.nodes[1]
  local lastNode  = order.nodes[#order.nodes]
  local lastLines = getWrappedLines(lastNode)
  local lastLine  = #lastLines
  local lastCol   = #(lastLines[lastLine] or "")

  selection = {
    node       = firstNode,
    startNode  = firstNode,
    startLine  = 1,
    startCol   = 0,
    endNode    = lastNode,
    endLine    = lastLine,
    endCol     = lastCol,
    isDragging = false,
    text       = nil,
    order      = order,
  }

  selection.text = extractSelectionText()
  if not selection.text or #selection.text == 0 then
    selection = nil
    return false
  end

  return true
end

--- Copy selected text to system clipboard.
--- Returns true if text was copied, false otherwise.
function TextSelection.copyToClipboard()
  if selection and selection.text then
    love.system.setClipboardText(selection.text)
    return true
  end
  return false
end

-- ============================================================================
-- Rendering helpers (called by painter.lua)
-- ============================================================================

--- Draw selection highlight rectangles for the given node.
--- Call this BEFORE drawing the text so text renders on top.
function TextSelection.drawHighlight(node)
  if not selection then return end
  if not node then return end
  -- CodeBlock draws its own highlight in codeblock.lua render()
  if node.type == "CodeBlock" then return end
  if node.type ~= "Text" then return end
  if canonicalTextNode(node) ~= node then return end

  local rangeStart, rangeEnd, order = normalizedRange()
  if not rangeStart or not rangeEnd or not order then return end

  local indexByNode = order.indexByNode or {}
  local nodeIdx = indexByNode[node]
  local startIdx = indexByNode[rangeStart.node]
  local endIdx = indexByNode[rangeEnd.node]
  if not nodeIdx or not startIdx or not endIdx then return end
  if nodeIdx < startIdx or nodeIdx > endIdx then return end

  local c = node.computed
  if not c then return end

  local lines, font, _, lineHeight, letterSpacing = getWrappedLines(node)
  if #lines == 0 then return end
  local effectiveLineH = lineHeight or font:getHeight()
  local align = resolveTextAlign(node)

  local startLine, startCol = 1, 0
  local endLine = #lines
  local endCol = #(lines[endLine] or "")

  if nodeIdx == startIdx then
    startLine, startCol = clampPos(node, rangeStart.line, rangeStart.col, lines)
  end
  if nodeIdx == endIdx then
    endLine, endCol = clampPos(node, rangeEnd.line, rangeEnd.col, lines)
  end

  love.graphics.setColor(0.22, 0.35, 0.55, 0.55)

  for i = startLine, endLine do
    local lineText = lines[i] or ""
    local lineWidth = Measure.getWidthWithSpacing(font, lineText, letterSpacing)
    local lineOffset = getLineAlignOffset(align, c.w or 0, lineWidth)
    local x0 = c.x + lineOffset
    local y0 = c.y + (i - 1) * effectiveLineH

    local sx, ex
    if i == startLine then
      if startCol > 0 then
        sx = Measure.getWidthWithSpacing(font, lineText:sub(1, startCol), letterSpacing)
      else
        sx = 0
      end
    else
      sx = 0
    end

    if i == endLine then
      if endCol > 0 then
        ex = Measure.getWidthWithSpacing(font, lineText:sub(1, endCol), letterSpacing)
      else
        ex = 0
      end
    else
      ex = Measure.getWidthWithSpacing(font, lineText, letterSpacing)
    end

    if ex > sx then
      love.graphics.rectangle("fill", x0 + sx, y0, ex - sx, effectiveLineH)
    end
  end
end

return TextSelection
