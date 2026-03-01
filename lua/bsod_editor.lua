--[[
  bsod_editor.lua — Inline code editor for BSOD crash recovery

  Standalone mini code editor that works without the React tree, layout
  engine, or painter. Uses Love2D's direct drawing API.

  Parses error messages to extract file:line, reads the source file from
  disk, renders a code view with the error line highlighted, and lets the
  developer fix the code in-place. Ctrl+S saves and triggers reload.

  Used by both errors.lua (Layer 1) and bsod.lua (Layer 2).
]]

local Editor = {}

-- ============================================================================
-- State
-- ============================================================================

local state = {
  filePath    = nil,    -- resolved path to source file
  lines       = nil,    -- array of line strings (1-based)
  errorLine   = 0,      -- 1-based line number of the error
  scrollTop   = 1,      -- first visible line
  cursorLine  = 0,      -- 1-based cursor line (0 = no cursor / view mode)
  cursorCol   = 1,      -- 1-based cursor column
  dirty       = false,  -- any modifications?
  dirtyLines  = {},     -- set of modified line numbers
  statusMsg   = nil,    -- temporary status message (e.g., "Saved!")
  statusTimer = 0,      -- countdown for status message
  cursorBlink = 0,      -- blink timer
  -- Drawing region (set by draw(), used by mousepressed())
  drawX = 0, drawY = 0, drawW = 0, drawH = 0,
  lineHeight = 16,
  gutterW    = 48,
  charW      = 0,       -- monospace character width (set in draw)
  font       = nil,     -- cached font reference
}

-- ============================================================================
-- Colors
-- ============================================================================

local C = {
  bg          = { 0.10, 0.08, 0.12, 1 },
  gutterBg    = { 0.08, 0.06, 0.10, 1 },
  gutterText  = { 0.45, 0.42, 0.48, 1 },
  gutterDirty = { 0.85, 0.75, 0.20, 1 },
  errorLineBg = { 0.35, 0.08, 0.10, 0.6 },
  cursorLineBg= { 0.16, 0.14, 0.20, 1 },
  cursor      = { 0.90, 0.88, 0.95, 1 },
  text        = { 0.85, 0.83, 0.88, 1 },
  keyword     = { 0.65, 0.50, 0.85, 1 },
  string      = { 0.55, 0.78, 0.50, 1 },
  comment     = { 0.50, 0.50, 0.55, 1 },
  number      = { 0.85, 0.65, 0.40, 1 },
  border      = { 0.25, 0.20, 0.30, 1 },
  scrollbar   = { 0.35, 0.30, 0.40, 0.6 },
  headerBg    = { 0.12, 0.10, 0.15, 1 },
  headerText  = { 0.70, 0.68, 0.75, 1 },
  statusText  = { 0.40, 0.85, 0.50, 1 },
}

-- ============================================================================
-- Lua keyword set (for minimal syntax coloring)
-- ============================================================================

local LUA_KEYWORDS = {}
for _, kw in ipairs({
  "and", "break", "do", "else", "elseif", "end", "false", "for",
  "function", "goto", "if", "in", "local", "nil", "not", "or",
  "repeat", "return", "then", "true", "until", "while",
}) do
  LUA_KEYWORDS[kw] = true
end

-- ============================================================================
-- Error location parsing
-- ============================================================================

--- Try to extract file:line from a string.
--- Returns filePath, lineNumber or nil, nil.
local function parseFileLine(text)
  if not text then return nil, nil end
  -- Match patterns like: lua/foo.lua:42: message
  -- or: ./lua/foo.lua:42: message
  -- or: /abs/path/foo.lua:42: message
  local path, lineStr = text:match("^([%w%.%_/%-]+%.lua):(%d+):")
  if not path then
    -- Try with ./ prefix
    path, lineStr = text:match("^%./([%w%.%_/%-]+%.lua):(%d+):")
  end
  if not path then
    -- Try anywhere in the string (for stack trace lines like "  in function 'foo'")
    path, lineStr = text:match("([%w%.%_/%-]+%.lua):(%d+)")
  end
  if path and lineStr then
    return path, tonumber(lineStr)
  end
  return nil, nil
end

--- Parse error message + stack trace to find the crash location.
--- Returns filePath, lineNumber or nil, nil.
local function findCrashLocation(message, stack)
  -- Try the error message first
  local path, line = parseFileLine(message)
  if path then return path, line end

  -- Walk the stack trace
  if stack then
    for traceLine in stack:gmatch("[^\n]+") do
      -- Skip boot.lua, [C], and init.lua wrapper lines
      if not traceLine:match("%[string") and not traceLine:match("%[C%]") then
        path, line = parseFileLine(traceLine)
        if path then return path, line end
      end
    end
  end

  return nil, nil
end

--- Verify a file exists and can be read.
local function fileExists(path)
  local f = io.open(path, "r")
  if f then
    f:close()
    return true
  end
  return false
end

--- Read all lines from a file.
local function readFile(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local lines = {}
  for line in f:lines() do
    lines[#lines + 1] = line
  end
  f:close()
  -- Ensure at least one line
  if #lines == 0 then lines[1] = "" end
  return lines
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Initialize the editor with an error message and stack trace.
--- Parses the error to find file:line, reads the source file.
function Editor.init(errorMessage, stackTrace)
  Editor.reset()

  local path, line = findCrashLocation(errorMessage, stackTrace)
  if not path then return end

  -- Try to find the file
  if not fileExists(path) then
    -- Try with ../../ prefix (storybook runs from storybook/love/)
    if fileExists("../../" .. path) then
      path = "../../" .. path
    else
      return
    end
  end

  local lines = readFile(path)
  if not lines then return end

  state.filePath = path
  state.lines = lines
  state.errorLine = math.min(line or 1, #lines)
  state.cursorLine = 0
  state.cursorCol = 1
  state.dirty = false
  state.dirtyLines = {}

  -- Center the error line in the view
  state.scrollTop = math.max(1, state.errorLine - 10)
end

--- Reset editor state.
function Editor.reset()
  state.filePath = nil
  state.lines = nil
  state.errorLine = 0
  state.scrollTop = 1
  state.cursorLine = 0
  state.cursorCol = 1
  state.dirty = false
  state.dirtyLines = {}
  state.statusMsg = nil
  state.statusTimer = 0
  state.cursorBlink = 0
end

--- Check if the editor has a file loaded and is active.
function Editor.isActive()
  return state.filePath ~= nil and state.lines ~= nil
end

--- Get the resolved file path.
function Editor.getFilePath()
  return state.filePath
end

-- ============================================================================
-- Minimal syntax coloring
-- ============================================================================

--- Tokenize a line into colored segments for Lua source.
--- Returns array of { text, color }.
local function tokenizeLine(lineText)
  local segments = {}
  local i = 1
  local len = #lineText

  while i <= len do
    local ch = lineText:sub(i, i)

    -- Single-line comment
    if ch == "-" and lineText:sub(i, i + 1) == "--" then
      segments[#segments + 1] = { text = lineText:sub(i), color = C.comment }
      break
    end

    -- String (double-quoted)
    if ch == '"' then
      local j = i + 1
      while j <= len do
        local sc = lineText:sub(j, j)
        if sc == "\\" then j = j + 2
        elseif sc == '"' then j = j + 1; break
        else j = j + 1 end
      end
      segments[#segments + 1] = { text = lineText:sub(i, j - 1), color = C.string }
      i = j
    -- String (single-quoted)
    elseif ch == "'" then
      local j = i + 1
      while j <= len do
        local sc = lineText:sub(j, j)
        if sc == "\\" then j = j + 2
        elseif sc == "'" then j = j + 1; break
        else j = j + 1 end
      end
      segments[#segments + 1] = { text = lineText:sub(i, j - 1), color = C.string }
      i = j
    -- Number
    elseif ch:match("%d") then
      local j = i + 1
      while j <= len and lineText:sub(j, j):match("[%d%.xXa-fA-F]") do j = j + 1 end
      segments[#segments + 1] = { text = lineText:sub(i, j - 1), color = C.number }
      i = j
    -- Word (keyword or identifier)
    elseif ch:match("[%a_]") then
      local j = i + 1
      while j <= len and lineText:sub(j, j):match("[%w_]") do j = j + 1 end
      local word = lineText:sub(i, j - 1)
      if LUA_KEYWORDS[word] then
        segments[#segments + 1] = { text = word, color = C.keyword }
      else
        segments[#segments + 1] = { text = word, color = C.text }
      end
      i = j
    -- Whitespace or punctuation
    else
      -- Accumulate plain characters
      local j = i + 1
      while j <= len do
        local nc = lineText:sub(j, j)
        if nc:match("[%a_%d\"'%-]") then break end
        j = j + 1
      end
      segments[#segments + 1] = { text = lineText:sub(i, j - 1), color = C.text }
      i = j
    end
  end

  return segments
end

-- ============================================================================
-- Drawing
-- ============================================================================

--- Draw the editor in the given rectangle.
--- @param x number  Left edge
--- @param y number  Top edge
--- @param w number  Width
--- @param h number  Height
--- @param font love.Font  Monospace font to use
function Editor.draw(x, y, w, h, font)
  if not state.lines then return end

  state.drawX = x
  state.drawY = y
  state.drawW = w
  state.drawH = h
  state.font = font

  love.graphics.setFont(font)
  state.lineHeight = math.floor(font:getHeight() * 1.4)
  state.charW = font:getWidth("M")
  state.gutterW = math.max(48, state.charW * (math.floor(math.log10(#state.lines)) + 2) + 16)

  local visibleLines = math.floor(h / state.lineHeight)
  local headerH = state.lineHeight + 4

  -- Clamp scroll
  state.scrollTop = math.max(1, math.min(state.scrollTop, math.max(1, #state.lines - visibleLines + 2)))

  -- Background
  love.graphics.setColor(C.bg)
  love.graphics.rectangle("fill", x, y, w, h)

  -- Border
  love.graphics.setColor(C.border)
  love.graphics.rectangle("line", x, y, w, h)

  -- Header bar: file path + dirty indicator
  love.graphics.setColor(C.headerBg)
  love.graphics.rectangle("fill", x + 1, y + 1, w - 2, headerH)
  love.graphics.setColor(C.headerText)
  local headerText = state.filePath or "unknown"
  if state.dirty then headerText = headerText .. " [modified]" end
  love.graphics.print(headerText, x + 8, y + 4)

  -- Status message (right side of header)
  if state.statusMsg and state.statusTimer > 0 then
    love.graphics.setColor(C.statusText)
    local sw = font:getWidth(state.statusMsg)
    love.graphics.print(state.statusMsg, x + w - sw - 8, y + 4)
  end

  -- Code area
  local codeY = y + headerH + 2
  local codeH = h - headerH - 2

  -- Scissor to clip code area
  love.graphics.setScissor(x, codeY, w, codeH)

  -- Gutter background
  love.graphics.setColor(C.gutterBg)
  love.graphics.rectangle("fill", x, codeY, state.gutterW, codeH)

  -- Render visible lines
  local textX = x + state.gutterW + 8
  local maxTextW = w - state.gutterW - 16

  -- Blink timer
  state.cursorBlink = state.cursorBlink + (love.timer.getDelta() or 0.016)

  for i = 0, visibleLines - 1 do
    local lineNum = state.scrollTop + i
    if lineNum > #state.lines then break end

    local lineY = codeY + i * state.lineHeight
    local lineText = state.lines[lineNum] or ""

    -- Error line highlight
    if lineNum == state.errorLine then
      love.graphics.setColor(C.errorLineBg)
      love.graphics.rectangle("fill", x + state.gutterW, lineY, w - state.gutterW, state.lineHeight)
    end

    -- Cursor line highlight
    if lineNum == state.cursorLine then
      love.graphics.setColor(C.cursorLineBg)
      love.graphics.rectangle("fill", x + state.gutterW, lineY, w - state.gutterW, state.lineHeight)
    end

    -- Gutter: line number
    local numStr = tostring(lineNum)
    if state.dirtyLines[lineNum] then
      love.graphics.setColor(C.gutterDirty)
    else
      love.graphics.setColor(C.gutterText)
    end
    local numW = font:getWidth(numStr)
    love.graphics.print(numStr, x + state.gutterW - numW - 8, lineY + 2)

    -- Syntax-colored text
    local segments = tokenizeLine(lineText)
    local sx = textX
    for _, seg in ipairs(segments) do
      love.graphics.setColor(seg.color)
      love.graphics.print(seg.text, sx, lineY + 2)
      sx = sx + font:getWidth(seg.text)
    end

    -- Cursor
    if lineNum == state.cursorLine and math.floor(state.cursorBlink * 2) % 2 == 0 then
      local beforeCursor = lineText:sub(1, state.cursorCol - 1)
      local cursorX = textX + font:getWidth(beforeCursor)
      love.graphics.setColor(C.cursor)
      love.graphics.rectangle("fill", cursorX, lineY + 2, 2, state.lineHeight - 4)
    end
  end

  -- Scrollbar
  if #state.lines > visibleLines then
    local scrollbarH = math.max(20, codeH * (visibleLines / #state.lines))
    local scrollRatio = (state.scrollTop - 1) / math.max(1, #state.lines - visibleLines)
    local scrollbarY = codeY + scrollRatio * (codeH - scrollbarH)
    love.graphics.setColor(C.scrollbar)
    love.graphics.rectangle("fill", x + w - 6, scrollbarY, 4, scrollbarH, 2, 2)
  end

  love.graphics.setScissor()

  -- Update status timer
  if state.statusTimer > 0 then
    state.statusTimer = state.statusTimer - (love.timer.getDelta() or 0.016)
  end
end

-- ============================================================================
-- Input handling
-- ============================================================================

--- Handle a mouse click. Places cursor at the clicked position.
--- @param mx number  Mouse X
--- @param my number  Mouse Y
--- @param button number  Mouse button
--- @return boolean  Whether the click was consumed
function Editor.mousepressed(mx, my, button)
  if not state.lines then return false end
  if button ~= 1 then return false end

  -- Check if click is within the code area
  local headerH = state.lineHeight + 4
  local codeY = state.drawY + headerH + 2
  local codeX = state.drawX + state.gutterW

  if mx < state.drawX or mx > state.drawX + state.drawW then return false end
  if my < codeY or my > state.drawY + state.drawH then return false end

  -- Calculate which line was clicked
  local relY = my - codeY
  local lineOffset = math.floor(relY / state.lineHeight)
  local lineNum = state.scrollTop + lineOffset

  if lineNum < 1 or lineNum > #state.lines then return false end

  state.cursorLine = lineNum
  state.cursorBlink = 0

  -- Calculate column from X position
  local textX = state.drawX + state.gutterW + 8
  local relX = mx - textX
  local lineText = state.lines[lineNum] or ""

  if relX <= 0 then
    state.cursorCol = 1
  else
    -- Find the closest column
    local col = 1
    for c = 1, #lineText do
      local w = state.font and state.font:getWidth(lineText:sub(1, c)) or (c * 8)
      if w > relX then break end
      col = c + 1
    end
    state.cursorCol = math.min(col, #lineText + 1)
  end

  -- Enable text input
  love.keyboard.setTextInput(true)

  return true
end

--- Handle mouse wheel scroll.
--- @return boolean  Whether the scroll was consumed
function Editor.wheelmoved(wx, wy)
  if not state.lines then return false end

  local visibleLines = math.floor(state.drawH / state.lineHeight) - 1
  if wy > 0 then
    state.scrollTop = math.max(1, state.scrollTop - 3)
  elseif wy < 0 then
    state.scrollTop = math.min(math.max(1, #state.lines - visibleLines + 2), state.scrollTop + 3)
  end
  return true
end

--- Handle a keypress.
--- @param key string  Love2D key name
--- @return string|nil  Returns "save" if Ctrl+S was pressed
function Editor.keypressed(key)
  if not state.lines then return nil end

  local ctrl = love.keyboard.isDown("lctrl", "rctrl")

  -- Ctrl+S: save
  if key == "s" and ctrl then
    return "save"
  end

  -- No cursor = not editing, only respond to scroll keys
  if state.cursorLine < 1 then
    return nil
  end

  local lineText = state.lines[state.cursorLine] or ""

  -- Navigation
  if key == "left" then
    if state.cursorCol > 1 then
      state.cursorCol = state.cursorCol - 1
    elseif state.cursorLine > 1 then
      state.cursorLine = state.cursorLine - 1
      state.cursorCol = #(state.lines[state.cursorLine] or "") + 1
    end
    state.cursorBlink = 0
  elseif key == "right" then
    if state.cursorCol <= #lineText then
      state.cursorCol = state.cursorCol + 1
    elseif state.cursorLine < #state.lines then
      state.cursorLine = state.cursorLine + 1
      state.cursorCol = 1
    end
    state.cursorBlink = 0
  elseif key == "up" then
    if state.cursorLine > 1 then
      state.cursorLine = state.cursorLine - 1
      state.cursorCol = math.min(state.cursorCol, #(state.lines[state.cursorLine] or "") + 1)
      -- Scroll if needed
      if state.cursorLine < state.scrollTop then
        state.scrollTop = state.cursorLine
      end
    end
    state.cursorBlink = 0
  elseif key == "down" then
    if state.cursorLine < #state.lines then
      state.cursorLine = state.cursorLine + 1
      state.cursorCol = math.min(state.cursorCol, #(state.lines[state.cursorLine] or "") + 1)
      -- Scroll if needed
      local visibleLines = math.floor(state.drawH / state.lineHeight) - 2
      if state.cursorLine >= state.scrollTop + visibleLines then
        state.scrollTop = state.cursorLine - visibleLines + 1
      end
    end
    state.cursorBlink = 0
  elseif key == "home" then
    state.cursorCol = 1
    state.cursorBlink = 0
  elseif key == "end" then
    state.cursorCol = #lineText + 1
    state.cursorBlink = 0

  -- Editing
  elseif key == "backspace" then
    if state.cursorCol > 1 then
      local before = lineText:sub(1, state.cursorCol - 2)
      local after = lineText:sub(state.cursorCol)
      state.lines[state.cursorLine] = before .. after
      state.cursorCol = state.cursorCol - 1
      state.dirty = true
      state.dirtyLines[state.cursorLine] = true
    elseif state.cursorLine > 1 then
      -- Join with previous line
      local prevLine = state.lines[state.cursorLine - 1] or ""
      local newCol = #prevLine + 1
      state.lines[state.cursorLine - 1] = prevLine .. lineText
      table.remove(state.lines, state.cursorLine)
      state.cursorLine = state.cursorLine - 1
      state.cursorCol = newCol
      state.dirty = true
      state.dirtyLines[state.cursorLine] = true
    end
    state.cursorBlink = 0
  elseif key == "delete" then
    if state.cursorCol <= #lineText then
      local before = lineText:sub(1, state.cursorCol - 1)
      local after = lineText:sub(state.cursorCol + 1)
      state.lines[state.cursorLine] = before .. after
      state.dirty = true
      state.dirtyLines[state.cursorLine] = true
    elseif state.cursorLine < #state.lines then
      -- Join with next line
      local nextLine = state.lines[state.cursorLine + 1] or ""
      state.lines[state.cursorLine] = lineText .. nextLine
      table.remove(state.lines, state.cursorLine + 1)
      state.dirty = true
      state.dirtyLines[state.cursorLine] = true
    end
    state.cursorBlink = 0
  elseif key == "return" then
    -- Split line at cursor
    local before = lineText:sub(1, state.cursorCol - 1)
    local after = lineText:sub(state.cursorCol)
    state.lines[state.cursorLine] = before
    table.insert(state.lines, state.cursorLine + 1, after)
    state.cursorLine = state.cursorLine + 1
    state.cursorCol = 1
    state.dirty = true
    state.dirtyLines[state.cursorLine] = true
    state.dirtyLines[state.cursorLine - 1] = true
    state.cursorBlink = 0
  elseif key == "tab" then
    -- Insert two spaces
    local before = lineText:sub(1, state.cursorCol - 1)
    local after = lineText:sub(state.cursorCol)
    state.lines[state.cursorLine] = before .. "  " .. after
    state.cursorCol = state.cursorCol + 2
    state.dirty = true
    state.dirtyLines[state.cursorLine] = true
    state.cursorBlink = 0
  end

  return nil
end

--- Handle text input (character insertion).
function Editor.textinput(text)
  if not state.lines then return end
  if state.cursorLine < 1 then return end

  local lineText = state.lines[state.cursorLine] or ""
  local before = lineText:sub(1, state.cursorCol - 1)
  local after = lineText:sub(state.cursorCol)
  state.lines[state.cursorLine] = before .. text .. after
  state.cursorCol = state.cursorCol + #text
  state.dirty = true
  state.dirtyLines[state.cursorLine] = true
  state.cursorBlink = 0
end

--- Save the file to disk.
--- @return boolean  true on success
function Editor.save()
  if not state.filePath or not state.lines then
    state.statusMsg = "No file to save"
    state.statusTimer = 2.0
    return false
  end

  local f = io.open(state.filePath, "w")
  if not f then
    state.statusMsg = "Failed to open file for writing"
    state.statusTimer = 3.0
    return false
  end

  for i, line in ipairs(state.lines) do
    f:write(line)
    if i < #state.lines then
      f:write("\n")
    end
  end
  f:write("\n")
  f:close()

  state.dirty = false
  state.dirtyLines = {}
  state.statusMsg = "Saved! Reloading..."
  state.statusTimer = 2.0
  return true
end

return Editor
