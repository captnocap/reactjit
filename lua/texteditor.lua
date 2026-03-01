--[[
  texteditor.lua -- Lua-owned document-style text editor

  This is the first "Lua-owned interaction" primitive. All editing state
  (lines, cursor, selection, scrolling) lives entirely in Lua. The JS/TS
  side only hears about boundary events: focus, blur, submit.

  State is stored on node.editorState (similar to node.scrollState for
  scroll containers).

  Requires: measure.lua for font resolution (injected via TextEditor.init)
]]

local Measure = nil
local Focus   = require("lua.focus")
local Tooltips = require("lua.texteditor_tooltips")
local Color   = require("lua.color")
local Syntax  = require("lua.syntax")

local TextEditor = {}

local currentTheme = nil

-- ============================================================================
-- Theme helpers
-- ============================================================================

local function themeColor(key, fallback)
  if currentTheme and currentTheme.colors and currentTheme.colors[key] then
    return Color.toTable(currentTheme.colors[key], fallback)
  end
  return fallback
end

-- Hardcoded fallbacks only used when no theme is set
local fallbackColors = {
  bg         = { 0.12, 0.12, 0.14, 1 },
  gutter     = { 0.15, 0.15, 0.17, 1 },
  gutterText = { 0.45, 0.45, 0.50, 1 },
  lineNum    = { 0.55, 0.55, 0.62, 1 },
  text       = { 0.85, 0.87, 0.90, 1 },
  cursor     = { 0.90, 0.90, 0.95, 1 },
  selection  = { 0.22, 0.35, 0.55, 0.55 },
  activeLine = { 0.16, 0.16, 0.19, 1 },
  scrollbar  = { 0.30, 0.30, 0.35, 0.6 },
  placeholder= { 0.45, 0.45, 0.50, 1 },
  tooltipBg  = { 0.10, 0.10, 0.13, 0.95 },
  tooltipText= { 0.82, 0.84, 0.88, 1 },
  tooltipBorder = { 0.25, 0.25, 0.30, 0.8 },
}

-- Resolve editor colors from theme tokens with hardcoded fallbacks
local function resolveColors()
  return {
    bg         = themeColor("bgElevated", fallbackColors.bg),
    gutter     = themeColor("surface", fallbackColors.gutter),
    gutterText = themeColor("textDim", fallbackColors.gutterText),
    lineNum    = themeColor("textSecondary", fallbackColors.lineNum),
    text       = themeColor("text", fallbackColors.text),
    cursor     = themeColor("primary", fallbackColors.cursor),
    selection  = (function()
      local p = themeColor("primary", fallbackColors.selection)
      return { p[1], p[2], p[3], 0.25 }
    end)(),
    activeLine = themeColor("surface", fallbackColors.activeLine),
    scrollbar  = themeColor("border", fallbackColors.scrollbar),
    placeholder= themeColor("textDim", fallbackColors.placeholder),
    tooltipBg  = themeColor("bgElevated", fallbackColors.tooltipBg),
    tooltipText= themeColor("text", fallbackColors.tooltipText),
    tooltipBorder = themeColor("border", fallbackColors.tooltipBorder),
  }
end

-- ============================================================================
-- Syntax highlighting (shared tokenizer from lua/syntax.lua)
-- ============================================================================

local syntaxColors = Syntax.colors

local tokenizeLine = Syntax.tokenizeLine

-- ============================================================================
-- Init
-- ============================================================================

function TextEditor.init(config)
  config = config or {}
  Measure = config.measure
  if config.theme then currentTheme = config.theme end
end

function TextEditor.setTheme(theme)
  currentTheme = theme
end

-- ============================================================================
-- State management
-- ============================================================================

--- Parse a string into an array of lines.
local function textToLines(text)
  if not text or text == "" then return { "" } end
  local lines = {}
  for line in (text .. "\n"):gmatch("([^\n]*)\n") do
    lines[#lines + 1] = line
  end
  if #lines == 0 then lines[1] = "" end
  return lines
end

--- Join lines back into a single string.
local function linesToText(lines)
  return table.concat(lines, "\n")
end

--- Initialize or reset editor state on a node.
function TextEditor.initState(node)
  local props = node.props or {}
  local initialText = props.initialValue or props.value or ""
  node.editorState = {
    lines = textToLines(initialText),
    cursorLine = 1,
    cursorCol = 0,
    scrollY = 0,
    scrollX = 0,
    selectStart = nil,
    selectEnd = nil,
    blinkTimer = 0,
    blinkOn = true,
    isDragging = false,
    lastValue = initialText,  -- track for controlled value changes
    dirty = false,            -- text changed since last change event
    changeTimer = 0,          -- seconds since last edit (for idle detection)
    undoStack = {},           -- { {lines, cursorLine, cursorCol}, ... }
    redoStack = {},           -- redo buffer (cleared on new edit)
    -- Hover tooltip state
    hoverWord = nil,          -- currently hovered token (string or nil)
    hoverLine = 0,            -- line of hovered word
    hoverCol = 0,             -- start col (0-based) of hovered token
    hoverEndCol = 0,          -- end col (exclusive) of hovered token
    hoverText = nil,          -- resolved tooltip text for hovered token
    hoverTimer = 0,           -- seconds hovering on current word
    hoverVisible = false,     -- whether tooltip is showing
    lastMouseX = 0,           -- last known mouse X
    lastMouseY = 0,           -- last known mouse Y
  }
end

--- Ensure editorState exists on the node.
local function ensureState(node)
  if not node.editorState then
    TextEditor.initState(node)
  end
  return node.editorState
end

--- Get the font for this editor node.
local function getFont(node)
  local s = node.style or {}
  local fontSize = s.fontSize or 14
  if Measure then
    fontSize = Measure.scaleFontSize(fontSize, node)
    local fontFamily = s.fontFamily or nil
    local fontWeight = s.fontWeight or nil
    return Measure.getFont(fontSize, fontFamily, fontWeight)
  end
  if love and love.graphics then
    if love.graphics.newFont then return love.graphics.newFont(fontSize) end
    if love.graphics.getFont then return love.graphics.getFont() end
  end
  return nil
end

--- Get line height for this editor.
local function getLineHeight(node)
  local font = getFont(node)
  return math.floor(font:getHeight() * 1.55)
end

--- Whether line numbers are shown.
local function showLineNumbers(node)
  local props = node.props or {}
  if props.lineNumbers == false then return false end
  return true -- default on
end

--- Whether the editor is read-only.
local function isReadOnly(node)
  local props = node.props or {}
  return props.readOnly == true
end

-- ============================================================================
-- Editor state helpers (operate on editorState)
-- ============================================================================

local clearSelection  -- forward declaration (used by applySnapshot before definition)

local function lineCount(es)
  return #es.lines
end

local function currentLine(es)
  return es.lines[es.cursorLine] or ""
end

local function clampCursor(es)
  es.cursorLine = math.max(1, math.min(es.cursorLine, lineCount(es)))
  es.cursorCol = math.max(0, math.min(es.cursorCol, #currentLine(es)))
end

local function resetBlink(es)
  es.blinkTimer = 0
  es.blinkOn = true
end

local function markDirty(es)
  es.dirty = true
  es.changeTimer = 0
end

local function pushUndo(es)
  local snap = { lines = {}, cursorLine = es.cursorLine, cursorCol = es.cursorCol }
  for i, l in ipairs(es.lines) do snap.lines[i] = l end
  es.undoStack[#es.undoStack + 1] = snap
  if #es.undoStack > 100 then table.remove(es.undoStack, 1) end
  es.redoStack = {}
end

local function applySnapshot(es, snap)
  local cur = { lines = {}, cursorLine = es.cursorLine, cursorCol = es.cursorCol }
  for i, l in ipairs(es.lines) do cur.lines[i] = l end
  es.lines = snap.lines
  es.cursorLine = snap.cursorLine
  es.cursorCol = snap.cursorCol
  clearSelection(es)
  clampCursor(es)
  return cur
end

--- Jump cursor to start of previous word on current line.
local function wordJumpLeft(es)
  local col = es.cursorCol
  local line = es.lines[es.cursorLine]
  if col == 0 then
    if es.cursorLine > 1 then
      es.cursorLine = es.cursorLine - 1
      es.cursorCol = #es.lines[es.cursorLine]
    end
    return
  end
  -- Step back past non-word chars, then past word chars (stop at word boundary)
  while col > 0 and not line:sub(col, col):match("[%w_]") do col = col - 1 end
  while col > 0 and line:sub(col, col):match("[%w_]") do col = col - 1 end
  es.cursorCol = col
end

--- Jump cursor to end of next word on current line.
local function wordJumpRight(es)
  local col = es.cursorCol
  local line = es.lines[es.cursorLine]
  local len = #line
  if col >= len then
    if es.cursorLine < lineCount(es) then
      es.cursorLine = es.cursorLine + 1
      es.cursorCol = 0
    end
    return
  end
  -- Step forward past non-word chars, then past word chars
  while col < len and not line:sub(col+1, col+1):match("[%w_]") do col = col + 1 end
  while col < len and line:sub(col+1, col+1):match("[%w_]") do col = col + 1 end
  es.cursorCol = col
end

clearSelection = function(es)
  es.selectStart = nil
  es.selectEnd = nil
end

local function hasSelection(es)
  return es.selectStart ~= nil and es.selectEnd ~= nil
end

local function selectionOrdered(es)
  if not hasSelection(es) then return nil, nil end
  local s, e = es.selectStart, es.selectEnd
  if s[1] > e[1] or (s[1] == e[1] and s[2] > e[2]) then
    return e, s
  end
  return s, e
end

local function getSelectedText(es)
  local s, e = selectionOrdered(es)
  if not s then return "" end
  if s[1] == e[1] then
    return es.lines[s[1]]:sub(s[2] + 1, e[2])
  end
  local parts = { es.lines[s[1]]:sub(s[2] + 1) }
  for i = s[1] + 1, e[1] - 1 do
    parts[#parts + 1] = es.lines[i]
  end
  parts[#parts + 1] = es.lines[e[1]]:sub(1, e[2])
  return table.concat(parts, "\n")
end

local function deleteSelection(es)
  local s, e = selectionOrdered(es)
  if not s then return end
  local before = es.lines[s[1]]:sub(1, s[2])
  local after = es.lines[e[1]]:sub(e[2] + 1)
  es.lines[s[1]] = before .. after
  for _ = s[1] + 1, e[1] do
    table.remove(es.lines, s[1] + 1)
  end
  es.cursorLine = s[1]
  es.cursorCol = s[2]
  clearSelection(es)
end

local function startOrExtendSelection(es)
  if not es.selectStart then
    es.selectStart = { es.cursorLine, es.cursorCol }
  end
end

local function updateSelectionEnd(es)
  es.selectEnd = { es.cursorLine, es.cursorCol }
end

--- Compute visible area metrics relative to node's computed rect.
local function visibleArea(node, es)
  local c = node.computed or { x = 0, y = 0, w = 400, h = 300 }
  local lh = getLineHeight(node)
  local gutterW = showLineNumbers(node) and 50 or 0
  local padding = 8
  local textAreaX = c.x + gutterW
  local textAreaY = c.y
  local textAreaW = c.w - gutterW
  local textAreaH = c.h
  local firstLine = math.floor(es.scrollY / lh) + 1
  local visLines = math.ceil(textAreaH / lh) + 1
  return {
    firstLine = firstLine,
    visLines = visLines,
    textAreaX = textAreaX,
    textAreaY = textAreaY,
    textAreaW = textAreaW,
    textAreaH = textAreaH,
    gutterW = gutterW,
    padding = padding,
    lineHeight = lh,
    nodeX = c.x,
    nodeY = c.y,
    nodeW = c.w,
    nodeH = c.h,
  }
end

local function ensureCursorVisible(node, es)
  local va = visibleArea(node, es)
  local font = getFont(node)
  local cursorY = (es.cursorLine - 1) * va.lineHeight

  if cursorY < es.scrollY then
    es.scrollY = cursorY
  elseif cursorY + va.lineHeight > es.scrollY + va.textAreaH then
    es.scrollY = cursorY + va.lineHeight - va.textAreaH
  end

  -- Clamp vertical scroll to valid bounds (matches handleWheel logic)
  local maxScrollY = math.max(0, lineCount(es) * va.lineHeight - va.textAreaH + va.lineHeight)
  es.scrollY = math.max(0, math.min(es.scrollY, maxScrollY))

  local cursorX = font:getWidth(currentLine(es):sub(1, es.cursorCol))
  local textW = va.textAreaW - va.padding * 2
  if cursorX - es.scrollX > textW - 20 then
    es.scrollX = cursorX - textW + 40
  elseif cursorX - es.scrollX < 0 then
    es.scrollX = math.max(0, cursorX - 20)
  end

  -- Clamp horizontal scroll to valid bounds
  es.scrollX = math.max(0, es.scrollX)
end

--- Convert screen coordinates to line/col within the editor.
local function screenToPos(node, es, mx, my)
  local va = visibleArea(node, es)
  local font = getFont(node)

  local line = math.floor((my - va.textAreaY + es.scrollY) / va.lineHeight) + 1
  line = math.max(1, math.min(line, lineCount(es)))

  local textX = mx - va.textAreaX - va.padding + es.scrollX
  local col = 0
  local lineStr = es.lines[line] or ""
  for i = 1, #lineStr do
    local w = font:getWidth(lineStr:sub(1, i))
    if w > textX then
      local prevW = font:getWidth(lineStr:sub(1, i - 1))
      col = (textX - prevW < w - textX) and (i - 1) or i
      break
    end
    col = i
  end
  return line, col
end

-- ============================================================================
-- Hover tooltip helpers
-- ============================================================================

-- Extract the token under the given line/col position.
-- Returns token info or nil.
local function tokenAtPos(es, line, col)
  local lineStr = es.lines[line]
  if not lineStr or #lineStr == 0 then return nil end

  local tokens = tokenizeLine(lineStr)
  if not tokens or #tokens == 0 then return nil end

  local hitIdx = nil
  local off = 0
  for i, tok in ipairs(tokens) do
    local txt = tok.text or ""
    local len = #txt
    local s = off
    local e = off + len
    -- Inclusive-right hit testing improves hover feel near token edges.
    if len > 0 and col >= s and col <= e then
      hitIdx = i
      break
    end
    off = e
  end

  if not hitIdx then return nil end
  local hit = tokens[hitIdx]
  local token = hit.text or ""
  if token == "" or token:match("^%s+$") then return nil end

  local startCol = 0
  for i = 1, hitIdx - 1 do
    startCol = startCol + #((tokens[i] and tokens[i].text) or "")
  end
  local endCol = startCol + #token

  local prevToken = nil
  for i = hitIdx - 1, 1, -1 do
    local t = (tokens[i] and tokens[i].text) or ""
    if t ~= "" and not t:match("^%s+$") then
      prevToken = t
      break
    end
  end

  local nextToken = nil
  for i = hitIdx + 1, #tokens do
    local t = (tokens[i] and tokens[i].text) or ""
    if t ~= "" and not t:match("^%s+$") then
      nextToken = t
      break
    end
  end

  return {
    token = token,
    startCol = startCol,
    endCol = endCol,
    prevToken = prevToken,
    nextToken = nextToken,
    line = lineStr,
  }
end

--- Update hover state based on current mouse position.
--- Called from update() each frame.
local function updateHover(node, es, dt)
  local props = node.props or {}
  local level = props.tooltipLevel
  if not level or level == "" or level == "clean" then
    es.hoverVisible = false
    es.hoverWord = nil
    es.hoverText = nil
    return
  end

  local mx, my = es.lastMouseX, es.lastMouseY
  local va = visibleArea(node, es)

  -- Check if mouse is within the text area
  if mx < va.textAreaX or mx > va.textAreaX + va.textAreaW or
     my < va.nodeY or my > va.nodeY + va.nodeH then
    es.hoverWord = nil
    es.hoverText = nil
    es.hoverTimer = 0
    es.hoverVisible = false
    return
  end

  local line, col = screenToPos(node, es, mx, my)
  local tokenInfo = tokenAtPos(es, line, col)
  local resolved = nil

  if tokenInfo then
    if Tooltips.lookup then
      resolved = Tooltips.lookup(tokenInfo.token, level, {
        line = tokenInfo.line,
        lineNumber = line,
        col = col,
        startCol = tokenInfo.startCol,
        endCol = tokenInfo.endCol,
        prevToken = tokenInfo.prevToken,
        nextToken = tokenInfo.nextToken,
      })
    else
      local entry = Tooltips[tokenInfo.token]
      if entry then
        resolved = {
          key = tokenInfo.token,
          text = entry[level] or entry.guided or entry.clean or entry.beginner,
        }
      end
    end
  end

  if tokenInfo and resolved and resolved.text and resolved.text ~= "" then
    if tokenInfo.token == es.hoverWord and line == es.hoverLine and tokenInfo.startCol == es.hoverCol then
      -- Same token — advance timer
      es.hoverText = resolved.text
      es.hoverTimer = es.hoverTimer + dt
      if es.hoverTimer >= 0.4 then
        es.hoverVisible = true
      end
    else
      -- New token — reset timer
      es.hoverWord = tokenInfo.token
      es.hoverLine = line
      es.hoverCol = tokenInfo.startCol
      es.hoverEndCol = tokenInfo.endCol
      es.hoverText = resolved.text
      es.hoverTimer = 0
      es.hoverVisible = false
    end
  else
    -- No known token under cursor
    es.hoverWord = nil
    es.hoverText = nil
    es.hoverTimer = 0
    es.hoverVisible = false
  end
end

-- ============================================================================
-- Public API: get value
-- ============================================================================

function TextEditor.getValue(node)
  local es = ensureState(node)
  return linesToText(es.lines)
end

--- Return active hover context for IDE-style learning links.
--- Returns nil when hover tooltip is not currently visible.
function TextEditor.getHoverContext(node)
  if not node then return nil end
  local es = ensureState(node)
  local props = node.props or {}
  local level = props.tooltipLevel
  if not level or level == "" or level == "clean" then return nil end
  if not es.hoverVisible or not es.hoverWord then return nil end
  return {
    line = es.hoverLine,
    token = es.hoverWord,
    level = level,
    text = es.hoverText,
  }
end

-- ============================================================================
-- Public API: update (call each frame for blink timer)
-- ============================================================================

function TextEditor.update(node, dt)
  local es = ensureState(node)

  -- Track mouse position for hover tooltips (always, even when unfocused)
  local mx, my = love.mouse.getPosition()
  es.lastMouseX = mx
  es.lastMouseY = my
  updateHover(node, es, dt)

  if not Focus.isFocused(node) then return end
  es.blinkTimer = es.blinkTimer + dt
  if es.blinkTimer >= 0.53 then
    es.blinkTimer = es.blinkTimer - 0.53
    es.blinkOn = not es.blinkOn
  end

  -- Idle change detection: when dirty, wait for changeDelay then signal
  if es.dirty then
    es.changeTimer = es.changeTimer + dt
    local delay = (node.props or {}).changeDelay or 3.0
    if es.changeTimer >= delay then
      es.dirty = false
      es.changeTimer = 0
      return "change"
    end
  end
end

-- ============================================================================
-- Public API: check for controlled value changes from JS
-- ============================================================================

function TextEditor.syncValue(node)
  local es = ensureState(node)
  local props = node.props or {}
  if props.value ~= nil and props.value ~= es.lastValue then
    es.lines = textToLines(props.value)
    es.lastValue = props.value
    clampCursor(es)
    -- Reset scroll when content changes externally (e.g. file drop)
    es.scrollY = 0
    es.scrollX = 0
  end
end

-- ============================================================================
-- Public API: blur
-- ============================================================================

function TextEditor.blur(node)
  local es = ensureState(node)
  es.blinkOn = false
  es.isDragging = false
  clearSelection(es)
  return linesToText(es.lines)
end

-- ============================================================================
-- Input handlers
-- ============================================================================

function TextEditor.handleKeyPressed(node, key, scancode, isRepeat)
  local es = ensureState(node)
  if isReadOnly(node) and key ~= "escape" then
    -- Allow escape in read-only mode (for blur), block everything else
    if key ~= "escape" then return false end
  end

  local ctrl = love.keyboard.isDown("lctrl", "rctrl")
  local shift = love.keyboard.isDown("lshift", "rshift")

  -- Ctrl combos
  if ctrl then
    if key == "a" then
      es.selectStart = { 1, 0 }
      es.cursorLine = lineCount(es)
      es.cursorCol = #es.lines[lineCount(es)]
      es.selectEnd = { es.cursorLine, es.cursorCol }
      resetBlink(es)
      return true
    elseif key == "c" then
      if hasSelection(es) then
        love.system.setClipboardText(getSelectedText(es))
      end
      return true
    elseif key == "x" then
      if not isReadOnly(node) and hasSelection(es) then
        love.system.setClipboardText(getSelectedText(es))
        pushUndo(es)
        deleteSelection(es)
        markDirty(es)
        resetBlink(es)
      end
      return true
    elseif key == "v" then
      if isReadOnly(node) then return true end
      local text = love.system.getClipboardText() or ""
      if text ~= "" then
        pushUndo(es)
        if hasSelection(es) then deleteSelection(es) end
        local before = currentLine(es):sub(1, es.cursorCol)
        local after = currentLine(es):sub(es.cursorCol + 1)
        local pasteLines = {}
        for line in (text .. "\n"):gmatch("([^\n]*)\n") do
          pasteLines[#pasteLines + 1] = line
        end
        if #pasteLines == 1 then
          es.lines[es.cursorLine] = before .. pasteLines[1] .. after
          es.cursorCol = #before + #pasteLines[1]
        else
          es.lines[es.cursorLine] = before .. pasteLines[1]
          for i = 2, #pasteLines - 1 do
            table.insert(es.lines, es.cursorLine + i - 1, pasteLines[i])
          end
          local lastIdx = es.cursorLine + #pasteLines - 1
          table.insert(es.lines, lastIdx, pasteLines[#pasteLines] .. after)
          es.cursorLine = lastIdx
          es.cursorCol = #pasteLines[#pasteLines]
        end
        clearSelection(es)
        markDirty(es)
        resetBlink(es)
        ensureCursorVisible(node, es)
      end
      return true
    elseif key == "return" then
      -- Ctrl+Enter = submit
      return "submit"
    elseif key == "z" then
      local shift = love.keyboard.isDown("lshift", "rshift")
      if shift then
        -- Ctrl+Shift+Z = redo
        if #es.redoStack > 0 then
          local snap = table.remove(es.redoStack)
          local cur = applySnapshot(es, snap)
          es.undoStack[#es.undoStack + 1] = cur
          markDirty(es); resetBlink(es); ensureCursorVisible(node, es)
        end
      else
        -- Ctrl+Z = undo
        if #es.undoStack > 0 then
          local snap = table.remove(es.undoStack)
          local cur = applySnapshot(es, snap)
          es.redoStack[#es.redoStack + 1] = cur
          markDirty(es); resetBlink(es); ensureCursorVisible(node, es)
        end
      end
      return true
    elseif key == "y" then
      -- Ctrl+Y = redo
      if #es.redoStack > 0 then
        local snap = table.remove(es.redoStack)
        local cur = applySnapshot(es, snap)
        es.undoStack[#es.undoStack + 1] = cur
        markDirty(es); resetBlink(es); ensureCursorVisible(node, es)
      end
      return true
    elseif key == "left" then
      -- Ctrl+Left = word jump left
      if shift then startOrExtendSelection(es) end
      if not shift then clearSelection(es) end
      wordJumpLeft(es)
      if shift then updateSelectionEnd(es) end
      clampCursor(es); resetBlink(es); ensureCursorVisible(node, es)
      return true
    elseif key == "right" then
      -- Ctrl+Right = word jump right
      if shift then startOrExtendSelection(es) end
      if not shift then clearSelection(es) end
      wordJumpRight(es)
      if shift then updateSelectionEnd(es) end
      clampCursor(es); resetBlink(es); ensureCursorVisible(node, es)
      return true
    end
  end

  -- Escape = blur
  if key == "escape" then
    return "blur"
  end

  -- Movement
  if key == "left" then
    if shift then startOrExtendSelection(es) end
    if not shift and hasSelection(es) then
      local s = selectionOrdered(es)
      es.cursorLine, es.cursorCol = s[1], s[2]
      clearSelection(es)
    elseif es.cursorCol > 0 then
      es.cursorCol = es.cursorCol - 1
    elseif es.cursorLine > 1 then
      es.cursorLine = es.cursorLine - 1
      es.cursorCol = #currentLine(es)
    end
    if shift then updateSelectionEnd(es) end
    clampCursor(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "right" then
    if shift then startOrExtendSelection(es) end
    if not shift and hasSelection(es) then
      local _, e = selectionOrdered(es)
      es.cursorLine, es.cursorCol = e[1], e[2]
      clearSelection(es)
    elseif es.cursorCol < #currentLine(es) then
      es.cursorCol = es.cursorCol + 1
    elseif es.cursorLine < lineCount(es) then
      es.cursorLine = es.cursorLine + 1
      es.cursorCol = 0
    end
    if shift then updateSelectionEnd(es) end
    clampCursor(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "up" then
    if shift then startOrExtendSelection(es) end
    if not shift then clearSelection(es) end
    if es.cursorLine > 1 then
      es.cursorLine = es.cursorLine - 1
    end
    if shift then updateSelectionEnd(es) end
    clampCursor(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "down" then
    if shift then startOrExtendSelection(es) end
    if not shift then clearSelection(es) end
    if es.cursorLine < lineCount(es) then
      es.cursorLine = es.cursorLine + 1
    end
    if shift then updateSelectionEnd(es) end
    clampCursor(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "home" then
    if shift then startOrExtendSelection(es) end
    if not shift then clearSelection(es) end
    es.cursorCol = 0
    if shift then updateSelectionEnd(es) end
    resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "end" then
    if shift then startOrExtendSelection(es) end
    if not shift then clearSelection(es) end
    es.cursorCol = #currentLine(es)
    if shift then updateSelectionEnd(es) end
    resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "pageup" then
    if shift then startOrExtendSelection(es) end
    if not shift then clearSelection(es) end
    local va = visibleArea(node, es)
    es.cursorLine = math.max(1, es.cursorLine - va.visLines)
    if shift then updateSelectionEnd(es) end
    clampCursor(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "pagedown" then
    if shift then startOrExtendSelection(es) end
    if not shift then clearSelection(es) end
    local va = visibleArea(node, es)
    es.cursorLine = math.min(lineCount(es), es.cursorLine + va.visLines)
    if shift then updateSelectionEnd(es) end
    clampCursor(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  end

  -- Editing keys
  if isReadOnly(node) then return true end

  if key == "backspace" then
    pushUndo(es)
    if hasSelection(es) then
      deleteSelection(es)
    elseif es.cursorCol > 0 then
      local line = currentLine(es)
      es.lines[es.cursorLine] = line:sub(1, es.cursorCol - 1) .. line:sub(es.cursorCol + 1)
      es.cursorCol = es.cursorCol - 1
    elseif es.cursorLine > 1 then
      local prev = es.lines[es.cursorLine - 1]
      es.cursorCol = #prev
      es.lines[es.cursorLine - 1] = prev .. currentLine(es)
      table.remove(es.lines, es.cursorLine)
      es.cursorLine = es.cursorLine - 1
    end
    markDirty(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "delete" then
    pushUndo(es)
    if hasSelection(es) then
      deleteSelection(es)
    elseif es.cursorCol < #currentLine(es) then
      local line = currentLine(es)
      es.lines[es.cursorLine] = line:sub(1, es.cursorCol) .. line:sub(es.cursorCol + 2)
    elseif es.cursorLine < lineCount(es) then
      es.lines[es.cursorLine] = currentLine(es) .. es.lines[es.cursorLine + 1]
      table.remove(es.lines, es.cursorLine + 1)
    end
    markDirty(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "return" then
    pushUndo(es)
    if hasSelection(es) then deleteSelection(es) end
    local line = currentLine(es)
    local before = line:sub(1, es.cursorCol)
    local after = line:sub(es.cursorCol + 1)
    local indent = before:match("^(%s*)") or ""
    es.lines[es.cursorLine] = before
    table.insert(es.lines, es.cursorLine + 1, indent .. after)
    es.cursorLine = es.cursorLine + 1
    es.cursorCol = #indent
    markDirty(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  elseif key == "tab" then
    pushUndo(es)
    if hasSelection(es) then deleteSelection(es) end
    local line = currentLine(es)
    local spaces = "    "
    es.lines[es.cursorLine] = line:sub(1, es.cursorCol) .. spaces .. line:sub(es.cursorCol + 1)
    es.cursorCol = es.cursorCol + #spaces
    markDirty(es); resetBlink(es); ensureCursorVisible(node, es)
    return true
  end

  -- Unhandled modifier combo — don't consume, let it through to the bridge
  if love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui") then
    return false
  end

  return true  -- consume regular keys while focused
end

function TextEditor.handleTextInput(node, text)
  if isReadOnly(node) then return end
  local es = ensureState(node)
  if love.keyboard.isDown("lctrl", "rctrl") then return end
  pushUndo(es)
  if hasSelection(es) then deleteSelection(es) end
  local line = currentLine(es)
  es.lines[es.cursorLine] = line:sub(1, es.cursorCol) .. text .. line:sub(es.cursorCol + 1)
  es.cursorCol = es.cursorCol + #text
  markDirty(es)
  resetBlink(es)
  ensureCursorVisible(node, es)
end

function TextEditor.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  local es = ensureState(node)
  local va = visibleArea(node, es)

  -- Check if click is within the editor bounds
  if mx < va.nodeX or mx > va.nodeX + va.nodeW or
     my < va.nodeY or my > va.nodeY + va.nodeH then
    return false
  end

  local line, col = screenToPos(node, es, mx, my)
  es.cursorLine = line
  es.cursorCol = col
  clampCursor(es)
  resetBlink(es)

  if love.keyboard.isDown("lshift", "rshift") then
    if not es.selectStart then
      es.selectStart = { line, col }
    end
    updateSelectionEnd(es)
  else
    clearSelection(es)
    es.selectStart = { es.cursorLine, es.cursorCol }
    es.isDragging = true
  end

  return true
end

function TextEditor.handleMouseMoved(node, mx, my)
  local es = ensureState(node)
  if not es.isDragging then return false end

  local line, col = screenToPos(node, es, mx, my)
  es.cursorLine = line
  es.cursorCol = col
  clampCursor(es)
  es.selectEnd = { es.cursorLine, es.cursorCol }
  resetBlink(es)
  return true
end

function TextEditor.handleMouseReleased(node)
  local es = ensureState(node)
  if not es.isDragging then return false end
  es.isDragging = false
  if hasSelection(es) then
    local s, e = selectionOrdered(es)
    if s[1] == e[1] and s[2] == e[2] then
      clearSelection(es)
    end
  end
  return true
end

function TextEditor.handleWheel(node, dx, dy)
  local es = ensureState(node)
  local va = visibleArea(node, es)
  es.scrollY = es.scrollY - dy * va.lineHeight * 3
  local maxScroll = math.max(0, lineCount(es) * va.lineHeight - va.textAreaH + va.lineHeight)
  es.scrollY = math.max(0, math.min(es.scrollY, maxScroll))
  return true
end

-- ============================================================================
-- Drawing
-- ============================================================================

local function setColorWithOpacity(c, opacity)
  love.graphics.setColor(c[1], c[2], c[3], (c[4] or 1) * opacity)
end

function TextEditor.draw(node, effectiveOpacity)
  local es = ensureState(node)
  local c = node.computed
  if not c then return end

  effectiveOpacity = effectiveOpacity or 1
  local font = getFont(node)
  local isFocused = Focus.isFocused(node)
  local va = visibleArea(node, es)
  local lh = va.lineHeight
  local useSyntax = (node.props or {}).syntaxHighlight == true
  local tooltipLevel = (node.props or {}).tooltipLevel

  -- Sync controlled value first (content may change, invalidating scroll)
  TextEditor.syncValue(node)

  -- Clamp scroll bounds every frame (layout or content changes can invalidate scroll position)
  local maxScrollY = math.max(0, lineCount(es) * lh - va.textAreaH + lh)
  es.scrollY = math.max(0, math.min(es.scrollY, maxScrollY))
  es.scrollX = math.max(0, es.scrollX)

  love.graphics.setFont(font)

  local colors = resolveColors()
  local s = node.style or {}

  -- Background (only if explicitly set — transparent by default)
  local br = s.borderRadius or 0
  if s.backgroundColor then
    local bgColor
    if type(s.backgroundColor) == "table" then
      bgColor = s.backgroundColor
    else
      bgColor = Color.toTable(s.backgroundColor, nil)
    end
    if bgColor then
      setColorWithOpacity(bgColor, effectiveOpacity)
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, br, br)
    end
  end

  -- Save parent scissor and intersect (so parent overflow clips are respected)
  local prevScissor = {love.graphics.getScissor()}
  local sx, sy = love.graphics.transformPoint(c.x, c.y)
  local sx2, sy2 = love.graphics.transformPoint(c.x + c.w, c.y + c.h)
  local sw, sh = math.max(0, sx2 - sx), math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)

  -- Gutter
  if va.gutterW > 0 then
    setColorWithOpacity(colors.gutter, effectiveOpacity)
    love.graphics.rectangle("fill", c.x, c.y, va.gutterW, c.h)
  end

  local lastLine = math.min(va.firstLine + va.visLines, lineCount(es))

  for i = va.firstLine, lastLine do
    local y = va.textAreaY + (i - 1) * lh - es.scrollY
    local lineStr = es.lines[i] or ""

    -- Active line highlight
    if isFocused and i == es.cursorLine then
      setColorWithOpacity(colors.activeLine, effectiveOpacity)
      love.graphics.rectangle("fill", va.textAreaX, y, va.textAreaW, lh)
    end

    -- Selection highlight
    if isFocused and hasSelection(es) then
      local selS, selE = selectionOrdered(es)
      if i >= selS[1] and i <= selE[1] then
        local sx, ex
        if i == selS[1] then
          sx = font:getWidth(lineStr:sub(1, selS[2]))
        else
          sx = 0
        end
        if i == selE[1] then
          ex = font:getWidth(lineStr:sub(1, selE[2]))
        else
          ex = font:getWidth(lineStr) + font:getWidth("m")
        end
        setColorWithOpacity(colors.selection, effectiveOpacity)
        love.graphics.rectangle("fill",
          va.textAreaX + va.padding + sx - es.scrollX, y,
          ex - sx, lh)
      end
    end

    -- Line numbers
    if va.gutterW > 0 then
      local numColor = (isFocused and i == es.cursorLine) and colors.lineNum or colors.gutterText
      setColorWithOpacity(numColor, effectiveOpacity)
      love.graphics.printf(tostring(i), c.x + 4, y + (lh - font:getHeight()) / 2,
        va.gutterW - 12, "right")
    end

    -- Text (clip to text area, not gutter)
    local tax, tay = love.graphics.transformPoint(va.textAreaX, c.y)
    local tax2, tay2 = love.graphics.transformPoint(va.textAreaX + va.textAreaW, c.y + c.h)
    love.graphics.intersectScissor(tax, tay, math.max(0, tax2 - tax), math.max(0, tay2 - tay))

    local textY = y + (lh - font:getHeight()) / 2
    local textX = va.textAreaX + va.padding - es.scrollX

    if useSyntax then
      -- Per-token colored rendering
      local tokens = tokenizeLine(lineStr)
      local xOff = textX
      for _, tok in ipairs(tokens) do
        setColorWithOpacity(tok.color, effectiveOpacity)
        love.graphics.print(tok.text, xOff, textY)
        xOff = xOff + font:getWidth(tok.text)
      end
    else
      -- Monochrome fallback
      local textColor = colors.text
      if s.color and type(s.color) == "table" then
        textColor = s.color
      end
      setColorWithOpacity(textColor, effectiveOpacity)
      love.graphics.print(lineStr, textX, textY)
    end

    -- Beginner-only dynamic inline hints (visual aid; does not mutate source text).
    if tooltipLevel == "beginner" and Tooltips.inlineHint and (i == es.cursorLine or i == es.hoverLine) then
      local hint = Tooltips.inlineHint(lineStr, tooltipLevel)
      if hint and hint ~= "" then
        local commentText = " // " .. hint
        local lineW = font:getWidth(lineStr)
        local hintX = textX + lineW + font:getWidth("  ")
        local maxX = va.textAreaX + va.textAreaW - va.padding
        if hintX + font:getWidth(commentText) <= maxX then
          setColorWithOpacity(syntaxColors.comment or colors.gutterText, effectiveOpacity * 0.9)
          love.graphics.print(commentText, hintX, textY)
        end
      end
    end

    -- Restore full-node scissor
    love.graphics.intersectScissor(sx, sy, sw, sh)
  end

  -- Placeholder
  if lineCount(es) == 1 and es.lines[1] == "" and not isFocused then
    local props = node.props or {}
    local ph = props.placeholder
    if ph and ph ~= "" then
      setColorWithOpacity(colors.placeholder, effectiveOpacity)
      love.graphics.print(ph,
        va.textAreaX + va.padding,
        va.textAreaY + (lh - font:getHeight()) / 2)
    end
  end

  -- Cursor
  if isFocused and es.blinkOn then
    local cy = va.textAreaY + (es.cursorLine - 1) * lh - es.scrollY
    local cx = va.textAreaX + va.padding +
      font:getWidth(currentLine(es):sub(1, es.cursorCol)) - es.scrollX
    local tax, tay = love.graphics.transformPoint(va.textAreaX, c.y)
    local tax2, tay2 = love.graphics.transformPoint(va.textAreaX + va.textAreaW, c.y + c.h)
    love.graphics.intersectScissor(tax, tay, math.max(0, tax2 - tax), math.max(0, tay2 - tay))
    setColorWithOpacity(colors.cursor, effectiveOpacity)
    love.graphics.rectangle("fill", cx, cy + 3, 2, lh - 6)
    love.graphics.intersectScissor(sx, sy, sw, sh)
  end

  -- Scrollbar
  local totalContentH = lineCount(es) * lh
  if totalContentH > va.textAreaH then
    local ratio = va.textAreaH / totalContentH
    local barH = math.max(20, va.textAreaH * ratio)
    local barY = c.y + (es.scrollY / totalContentH) * (va.textAreaH - barH)
    setColorWithOpacity(colors.scrollbar, effectiveOpacity)
    love.graphics.rectangle("fill", c.x + c.w - 6, barY, 4, barH, 2, 2)
  end

  -- Border (theme-aware: always thin, focus color on focus)
  local bw = s.borderWidth or 1
  local borderColor
  if isFocused then
    borderColor = themeColor("borderFocus", { 0.29, 0.56, 0.85, 0.9 })
  else
    borderColor = themeColor("border", nil)
  end
  if s.borderColor then
    borderColor = Color.toTable(s.borderColor, borderColor)
  end
  if borderColor then
    setColorWithOpacity(borderColor, effectiveOpacity)
    love.graphics.setLineWidth(bw)
    love.graphics.rectangle("line", c.x, c.y, c.w, c.h, br, br)
  end

  -- Restore parent scissor (so parent overflow clips are preserved)
  if #prevScissor > 0 then
    love.graphics.setScissor(unpack(prevScissor))
  else
    love.graphics.setScissor()
  end

  -- ── Hover tooltip (drawn OUTSIDE the scissor so it can overflow) ──
  if tooltipLevel and tooltipLevel ~= "" and tooltipLevel ~= "clean"
     and es.hoverVisible and es.hoverWord and es.hoverText then
    local tooltipText = es.hoverText
    if tooltipText and tooltipText ~= "" then
      -- Use a slightly smaller font for the tooltip
      local tooltipFontSize = (node.style or {}).fontSize or 14
      tooltipFontSize = math.max(10, tooltipFontSize - 2)
      local tooltipFont
      if Measure then
        tooltipFontSize = Measure.scaleFontSize(tooltipFontSize, node)
        tooltipFont = Measure.getFont(tooltipFontSize, nil, nil)
      else
        tooltipFont = love.graphics.getFont()
      end

      local maxW = 300
      local padX, padY = 10, 8
      local textW = maxW - padX * 2

      -- Wrap text manually
      local wrappedLines = {}
      for _, segment in ipairs({tooltipText}) do
        local words = {}
        for w in segment:gmatch("%S+") do words[#words+1] = w end
        local line = ""
        for _, w in ipairs(words) do
          local test = line == "" and w or (line .. " " .. w)
          if tooltipFont:getWidth(test) > textW then
            if line ~= "" then wrappedLines[#wrappedLines+1] = line end
            line = w
          else
            line = test
          end
        end
        if line ~= "" then wrappedLines[#wrappedLines+1] = line end
      end

      local lineH = math.floor(tooltipFont:getHeight() * 1.4)
      local contentH = #wrappedLines * lineH
      local boxW = maxW
      local boxH = contentH + padY * 2

      -- Position: above the hovered word, or below if near top
      local wordY = va.textAreaY + (es.hoverLine - 1) * lh - es.scrollY
      local wordX = va.textAreaX + va.padding + font:getWidth(
        (es.lines[es.hoverLine] or ""):sub(1, es.hoverCol)
      ) - es.scrollX

      local tooltipX = math.max(c.x + 4, math.min(wordX, c.x + c.w - boxW - 4))
      local tooltipY = wordY - boxH - 6
      if tooltipY < c.y then
        tooltipY = wordY + lh + 4  -- below the word if no room above
      end

      -- Draw tooltip background
      love.graphics.setFont(tooltipFont)
      setColorWithOpacity(colors.tooltipBg, effectiveOpacity)
      love.graphics.rectangle("fill", tooltipX, tooltipY, boxW, boxH, 6, 6)

      -- Border
      setColorWithOpacity(colors.tooltipBorder, effectiveOpacity)
      love.graphics.setLineWidth(1)
      love.graphics.rectangle("line", tooltipX, tooltipY, boxW, boxH, 6, 6)

      -- Text
      setColorWithOpacity(colors.tooltipText, effectiveOpacity)
      for li, wline in ipairs(wrappedLines) do
        love.graphics.print(wline,
          tooltipX + padX,
          tooltipY + padY + (li - 1) * lineH)
      end

      -- Restore original font
      love.graphics.setFont(font)
    end
  end
end

return TextEditor
