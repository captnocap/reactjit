--[[
  source_editor.lua -- Standalone source code editor for the inspector detail panel

  Reads/writes real source files via io.open(). Draws within a given region
  using love.graphics. Syntax highlighting via syntax.lua (Catppuccin Mocha).

  Not tied to React nodes or the TextEditor component — this is a pure Lua
  editor that lives inside the inspector's draw pass.

  Public API:
    SourceEditor.open(path, lineNumber)
    SourceEditor.close()
    SourceEditor.draw(x, y, w, h, font)
    SourceEditor.keypressed(key)
    SourceEditor.textinput(text)
    SourceEditor.wheelmoved(dx, dy)
    SourceEditor.mousepressed(mx, my, btn)
    SourceEditor.isActive()
    SourceEditor.activate()
    SourceEditor.deactivate()
    SourceEditor.isDirty()
    SourceEditor.getPath()
    SourceEditor.save()
    SourceEditor.scrollToLine(lineNumber)
]]

local Syntax = require("lua.syntax")

local SourceEditor = {}

-- ============================================================================
-- State
-- ============================================================================

local state = {
  path          = nil,     -- absolute file path
  lines         = {},      -- array of line strings (1-based)
  cursorLine    = 1,       -- 1-based line
  cursorCol     = 0,       -- 0-based column (before first char = 0)
  scrollY       = 0,       -- line offset (0 = top)
  scrollX       = 0,       -- horizontal pixel offset
  dirty         = false,   -- unsaved changes?
  lang          = "tsx",   -- language for syntax highlighting
  highlightLine = nil,     -- line to accent-highlight (from node selection)
  active        = false,   -- has keyboard focus?
  blinkTimer    = 0,       -- cursor blink timer
  -- undo
  undoStack     = {},      -- array of { lines, cursorLine, cursorCol }
  redoStack     = {},
  -- drawing region (set during draw, used for input routing)
  region        = nil,     -- { x, y, w, h }
}

-- ============================================================================
-- Colors
-- ============================================================================

local BG           = { 0.08, 0.08, 0.13, 1 }
local GUTTER_BG    = { 0.06, 0.06, 0.10, 1 }
local GUTTER_TEXT  = { 0.40, 0.42, 0.50, 1 }
local HIGHLIGHT_BG = { 0.20, 0.30, 0.50, 0.35 }
local CURSOR_COLOR = { 0.38, 0.65, 0.98, 1 }
local CURSOR_LINE_BG = { 0.12, 0.12, 0.20, 0.6 }
local HEADER_BG    = { 0.06, 0.06, 0.10, 1 }
local HEADER_TEXT  = { 0.55, 0.58, 0.65, 1 }
local DIRTY_DOT    = { 0.96, 0.62, 0.04, 1 }
local SCROLLBAR_BG = { 0.15, 0.15, 0.22, 0.6 }
local SCROLLBAR_FG = { 0.35, 0.38, 0.48, 0.8 }

-- ============================================================================
-- Helpers
-- ============================================================================

local MAX_UNDO = 50

local function clamp(v, lo, hi) return math.max(lo, math.min(hi, v)) end

local function splitLines(text)
  local lines = {}
  for line in (text .. "\n"):gmatch("([^\n]*)\n") do
    lines[#lines + 1] = line
  end
  if #lines == 0 then lines[1] = "" end
  return lines
end

local function joinLines(lines)
  return table.concat(lines, "\n")
end

local function pushUndo()
  -- Deep copy lines
  local copy = {}
  for i, l in ipairs(state.lines) do copy[i] = l end
  state.undoStack[#state.undoStack + 1] = {
    lines = copy,
    cursorLine = state.cursorLine,
    cursorCol = state.cursorCol,
  }
  if #state.undoStack > MAX_UNDO then
    table.remove(state.undoStack, 1)
  end
  state.redoStack = {}
end

local function undo()
  if #state.undoStack == 0 then return end
  -- Save current to redo
  local copy = {}
  for i, l in ipairs(state.lines) do copy[i] = l end
  state.redoStack[#state.redoStack + 1] = {
    lines = copy,
    cursorLine = state.cursorLine,
    cursorCol = state.cursorCol,
  }
  -- Restore
  local snap = table.remove(state.undoStack)
  state.lines = snap.lines
  state.cursorLine = snap.cursorLine
  state.cursorCol = snap.cursorCol
  state.dirty = true
end

local function redo()
  if #state.redoStack == 0 then return end
  -- Save current to undo
  local copy = {}
  for i, l in ipairs(state.lines) do copy[i] = l end
  state.undoStack[#state.undoStack + 1] = {
    lines = copy,
    cursorLine = state.cursorLine,
    cursorCol = state.cursorCol,
  }
  -- Restore
  local snap = table.remove(state.redoStack)
  state.lines = snap.lines
  state.cursorLine = snap.cursorLine
  state.cursorCol = snap.cursorCol
  state.dirty = true
end

-- ============================================================================
-- Public API
-- ============================================================================

function SourceEditor.open(path, lineNumber)
  if state.path == path and lineNumber then
    -- Same file, just scroll to line
    SourceEditor.scrollToLine(lineNumber)
    state.highlightLine = lineNumber
    return
  end

  local f = io.open(path, "r")
  if not f then
    state.path = nil
    state.lines = { "-- Cannot read: " .. path }
    return
  end

  local content = f:read("*a")
  f:close()

  state.path = path
  state.lines = splitLines(content)
  state.cursorLine = 1
  state.cursorCol = 0
  state.scrollY = 0
  state.scrollX = 0
  state.dirty = false
  state.highlightLine = lineNumber
  state.active = false
  state.blinkTimer = 0
  state.undoStack = {}
  state.redoStack = {}

  -- Detect language from extension
  local ext = path:match("%.([^%.]+)$") or ""
  local langMap = {
    tsx = "tsx", ts = "typescript", jsx = "jsx", js = "javascript",
    lua = "lua", py = "python", rs = "rust", go = "go",
    css = "css", html = "html", json = "json", md = "markdown",
    glsl = "glsl", vert = "glsl", frag = "glsl",
  }
  state.lang = langMap[ext] or Syntax.detectLanguage(state.lines) or "text"

  if lineNumber then
    SourceEditor.scrollToLine(lineNumber)
  end
end

function SourceEditor.close()
  state.path = nil
  state.lines = {}
  state.active = false
  state.dirty = false
  state.highlightLine = nil
  state.region = nil
end

function SourceEditor.isActive()
  return state.active
end

function SourceEditor.activate()
  state.active = true
  state.blinkTimer = 0
end

function SourceEditor.deactivate()
  state.active = false
end

function SourceEditor.isDirty()
  return state.dirty
end

function SourceEditor.getPath()
  return state.path
end

function SourceEditor.getRegion()
  return state.region
end

function SourceEditor.scrollToLine(lineNumber)
  state.highlightLine = lineNumber
  -- Center the target line in the visible area (we don't know visible lines
  -- yet, so estimate ~20 and adjust; draw() will clamp)
  state.scrollY = math.max(0, lineNumber - 10)
end

function SourceEditor.save()
  if not state.path or not state.dirty then return false end
  local f = io.open(state.path, "w")
  if not f then return false end
  f:write(joinLines(state.lines))
  f:close()
  state.dirty = false
  return true
end

-- ============================================================================
-- Drawing
-- ============================================================================

function SourceEditor.draw(x, y, w, h, font)
  if not state.path or #state.lines == 0 then return end

  state.region = { x = x, y = y, w = w, h = h }

  local lineH = font:getHeight() + 2
  local gutterDigits = math.max(3, #tostring(#state.lines))
  local gutterW = font:getWidth(string.rep("0", gutterDigits)) + 12
  local codeX = x + gutterW
  local codeW = w - gutterW
  local visibleLines = math.floor(h / lineH)

  -- Clamp scroll
  state.scrollY = clamp(state.scrollY, 0, math.max(0, #state.lines - visibleLines))

  -- Save graphics state
  love.graphics.push()
  love.graphics.setScissor(x, y, w, h)

  -- Background
  love.graphics.setColor(BG)
  love.graphics.rectangle("fill", x, y, w, h)

  -- Gutter background
  love.graphics.setColor(GUTTER_BG)
  love.graphics.rectangle("fill", x, y, gutterW - 2, h)

  -- Draw visible lines
  local startLine = math.floor(state.scrollY) + 1
  local endLine = math.min(#state.lines, startLine + visibleLines)

  for i = startLine, endLine do
    local ly = y + (i - startLine) * lineH
    local line = state.lines[i]

    -- Highlight line (from node selection)
    if i == state.highlightLine then
      love.graphics.setColor(HIGHLIGHT_BG)
      love.graphics.rectangle("fill", x, ly, w, lineH)
    end

    -- Cursor line background
    if state.active and i == state.cursorLine then
      love.graphics.setColor(CURSOR_LINE_BG)
      love.graphics.rectangle("fill", codeX, ly, codeW, lineH)
    end

    -- Gutter line number
    local numStr = tostring(i)
    local numW = font:getWidth(numStr)
    if i == state.highlightLine then
      love.graphics.setColor(CURSOR_COLOR)
    else
      love.graphics.setColor(GUTTER_TEXT)
    end
    love.graphics.print(numStr, x + gutterW - numW - 8, ly)

    -- Syntax-highlighted code
    local tokens = Syntax.tokenizeLine(line, state.lang)
    local tx = codeX + 4 - state.scrollX
    for _, tok in ipairs(tokens) do
      love.graphics.setColor(tok.color or Syntax.colors.text)
      love.graphics.print(tok.text, tx, ly)
      tx = tx + font:getWidth(tok.text)
    end
  end

  -- Cursor
  if state.active then
    state.blinkTimer = state.blinkTimer + love.timer.getDelta()
    local blinkOn = (state.blinkTimer % 1.0) < 0.6

    if blinkOn and state.cursorLine >= startLine and state.cursorLine <= endLine then
      local cy = y + (state.cursorLine - startLine) * lineH
      local lineText = state.lines[state.cursorLine] or ""
      local beforeCursor = lineText:sub(1, state.cursorCol)
      local cx = codeX + 4 - state.scrollX + font:getWidth(beforeCursor)

      love.graphics.setColor(CURSOR_COLOR)
      love.graphics.setLineWidth(2)
      love.graphics.line(cx, cy + 2, cx, cy + lineH - 2)
      love.graphics.setLineWidth(1)
    end
  end

  -- Scrollbar
  if #state.lines > visibleLines then
    local barH = h
    local thumbRatio = visibleLines / #state.lines
    local thumbH = math.max(20, barH * thumbRatio)
    local maxScroll = #state.lines - visibleLines
    local thumbY = y + (state.scrollY / maxScroll) * (barH - thumbH)

    love.graphics.setColor(SCROLLBAR_BG)
    love.graphics.rectangle("fill", x + w - 6, y, 6, h, 2, 2)
    love.graphics.setColor(SCROLLBAR_FG)
    love.graphics.rectangle("fill", x + w - 6, thumbY, 6, thumbH, 2, 2)
  end

  love.graphics.setScissor()
  love.graphics.pop()
end

-- ============================================================================
-- Input handling
-- ============================================================================

function SourceEditor.keypressed(key)
  if not state.active or not state.path then return false end

  local ctrl = love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui")
  local shift = love.keyboard.isDown("lshift", "rshift")

  -- Ctrl+S: save
  if ctrl and key == "s" then
    SourceEditor.save()
    return true
  end

  -- Ctrl+Z: undo
  if ctrl and key == "z" and not shift then
    undo()
    return true
  end

  -- Ctrl+Shift+Z or Ctrl+Y: redo
  if ctrl and (key == "z" and shift) or (ctrl and key == "y") then
    redo()
    return true
  end

  -- Navigation
  if key == "up" then
    state.cursorLine = math.max(1, state.cursorLine - 1)
    local maxCol = #(state.lines[state.cursorLine] or "")
    state.cursorCol = math.min(state.cursorCol, maxCol)
    state.blinkTimer = 0
    ensureCursorVisible()
    return true
  end

  if key == "down" then
    state.cursorLine = math.min(#state.lines, state.cursorLine + 1)
    local maxCol = #(state.lines[state.cursorLine] or "")
    state.cursorCol = math.min(state.cursorCol, maxCol)
    state.blinkTimer = 0
    ensureCursorVisible()
    return true
  end

  if key == "left" then
    if state.cursorCol > 0 then
      state.cursorCol = state.cursorCol - 1
    elseif state.cursorLine > 1 then
      state.cursorLine = state.cursorLine - 1
      state.cursorCol = #(state.lines[state.cursorLine] or "")
    end
    state.blinkTimer = 0
    return true
  end

  if key == "right" then
    local lineLen = #(state.lines[state.cursorLine] or "")
    if state.cursorCol < lineLen then
      state.cursorCol = state.cursorCol + 1
    elseif state.cursorLine < #state.lines then
      state.cursorLine = state.cursorLine + 1
      state.cursorCol = 0
    end
    state.blinkTimer = 0
    return true
  end

  if key == "home" then
    state.cursorCol = 0
    state.blinkTimer = 0
    return true
  end

  if key == "end" then
    state.cursorCol = #(state.lines[state.cursorLine] or "")
    state.blinkTimer = 0
    return true
  end

  -- Editing
  if key == "backspace" then
    pushUndo()
    if state.cursorCol > 0 then
      local line = state.lines[state.cursorLine]
      state.lines[state.cursorLine] = line:sub(1, state.cursorCol - 1) .. line:sub(state.cursorCol + 1)
      state.cursorCol = state.cursorCol - 1
    elseif state.cursorLine > 1 then
      -- Join with previous line
      local prevLine = state.lines[state.cursorLine - 1]
      state.cursorCol = #prevLine
      state.lines[state.cursorLine - 1] = prevLine .. state.lines[state.cursorLine]
      table.remove(state.lines, state.cursorLine)
      state.cursorLine = state.cursorLine - 1
    end
    state.dirty = true
    state.blinkTimer = 0
    return true
  end

  if key == "delete" then
    pushUndo()
    local line = state.lines[state.cursorLine]
    if state.cursorCol < #line then
      state.lines[state.cursorLine] = line:sub(1, state.cursorCol) .. line:sub(state.cursorCol + 2)
    elseif state.cursorLine < #state.lines then
      -- Join with next line
      state.lines[state.cursorLine] = line .. state.lines[state.cursorLine + 1]
      table.remove(state.lines, state.cursorLine + 1)
    end
    state.dirty = true
    state.blinkTimer = 0
    return true
  end

  if key == "return" or key == "kpenter" then
    pushUndo()
    local line = state.lines[state.cursorLine]
    local before = line:sub(1, state.cursorCol)
    local after = line:sub(state.cursorCol + 1)

    -- Auto-indent: match leading whitespace of current line
    local indent = line:match("^(%s*)") or ""

    state.lines[state.cursorLine] = before
    table.insert(state.lines, state.cursorLine + 1, indent .. after)
    state.cursorLine = state.cursorLine + 1
    state.cursorCol = #indent
    state.dirty = true
    state.blinkTimer = 0
    ensureCursorVisible()
    return true
  end

  if key == "tab" then
    pushUndo()
    local line = state.lines[state.cursorLine]
    state.lines[state.cursorLine] = line:sub(1, state.cursorCol) .. "  " .. line:sub(state.cursorCol + 1)
    state.cursorCol = state.cursorCol + 2
    state.dirty = true
    state.blinkTimer = 0
    return true
  end

  return false
end

function SourceEditor.textinput(text)
  if not state.active or not state.path then return false end

  pushUndo()
  local line = state.lines[state.cursorLine]
  state.lines[state.cursorLine] = line:sub(1, state.cursorCol) .. text .. line:sub(state.cursorCol + 1)
  state.cursorCol = state.cursorCol + #text
  state.dirty = true
  state.blinkTimer = 0
  return true
end

function SourceEditor.wheelmoved(dx, dy)
  if not state.path or #state.lines == 0 then return false end
  local r = state.region
  if not r then return false end

  -- Check if mouse is over editor region
  local mx, my = love.mouse.getPosition()
  if mx < r.x or mx > r.x + r.w or my < r.y or my > r.y + r.h then
    return false
  end

  state.scrollY = state.scrollY - dy * 3
  state.scrollY = clamp(state.scrollY, 0, math.max(0, #state.lines - 1))
  return true
end

function SourceEditor.mousepressed(mx, my, btn)
  if not state.path or #state.lines == 0 then return false end
  local r = state.region
  if not r then return false end

  -- Check if click is inside editor region
  if mx < r.x or mx > r.x + r.w or my < r.y or my > r.y + r.h then
    return false
  end

  if btn == 1 then
    state.active = true
    state.blinkTimer = 0

    -- Calculate which line was clicked
    local font = love.graphics.getFont()
    local lineH = font:getHeight() + 2
    local gutterDigits = math.max(3, #tostring(#state.lines))
    local gutterW = font:getWidth(string.rep("0", gutterDigits)) + 12
    local codeX = r.x + gutterW + 4

    local clickedLine = math.floor((my - r.y) / lineH) + math.floor(state.scrollY) + 1
    clickedLine = clamp(clickedLine, 1, #state.lines)
    state.cursorLine = clickedLine

    -- Calculate column from x position (UTF-8 safe: iterate codepoints, not bytes)
    local line = state.lines[clickedLine] or ""
    local relX = mx - codeX + state.scrollX
    local byteCol = 0
    local pos = 1
    while pos <= #line do
      -- Determine byte length of next UTF-8 codepoint
      local b = line:byte(pos)
      local charLen = 1
      if b and b >= 0xF0 then charLen = 4
      elseif b and b >= 0xE0 then charLen = 3
      elseif b and b >= 0xC0 then charLen = 2
      end
      local ch = line:sub(pos, pos + charLen - 1)
      local charW = font:getWidth(ch)
      if relX < charW / 2 then break end
      relX = relX - charW
      byteCol = pos + charLen - 1
      pos = pos + charLen
    end
    state.cursorCol = byteCol
  end

  return true
end

-- ============================================================================
-- Internal helpers
-- ============================================================================

function ensureCursorVisible()
  -- Vertical: keep cursor within visible range
  local r = state.region
  if not r then return end
  local font = love.graphics.getFont()
  local lineH = font:getHeight() + 2
  local visibleLines = math.floor(r.h / lineH)

  if state.cursorLine < state.scrollY + 1 then
    state.scrollY = state.cursorLine - 1
  elseif state.cursorLine > state.scrollY + visibleLines then
    state.scrollY = state.cursorLine - visibleLines
  end
  state.scrollY = clamp(state.scrollY, 0, math.max(0, #state.lines - 1))
end

return SourceEditor
