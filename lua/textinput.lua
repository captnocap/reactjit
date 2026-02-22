--[[
  textinput.lua -- Lua-owned text input field

  All editing state (text, cursor, selection, blink) lives entirely in Lua.
  The JS/TS side only hears about boundary events: focus, blur, submit, change.

  State is stored on node.inputState (similar to node.editorState for TextEditor).

  Supports:
    - Single-line and multiline modes
    - Cursor movement (arrows, home, end)
    - Selection (shift+arrows, shift+click, mouse drag, Ctrl+A)
    - Clipboard (Ctrl+C/X/V)
    - Secure text entry (password masking)
    - maxLength enforcement
    - Placeholder text
    - Controlled value (from JS props)
    - Custom cursor color, placeholder color
    - Read-only mode (editable=false)

  Requires: measure.lua for font resolution (injected via TextInput.init)
]]

local Measure = nil
local Focus   = require("lua.focus")
local Color   = require("lua.color")

local TextInput = {}

-- ============================================================================
-- Init
-- ============================================================================

function TextInput.init(config)
  config = config or {}
  Measure = config.measure
end

-- ============================================================================
-- State management
-- ============================================================================

function TextInput.initState(node)
  local props = node.props or {}
  local initialText = props.initialValue or props.value or props.defaultValue or ""
  node.inputState = {
    text = initialText,
    cursorPos = #initialText,
    scrollX = 0,
    selectStart = nil, -- byte offset or nil
    selectEnd = nil,   -- byte offset or nil
    blinkTimer = 0,
    blinkOn = true,
    isDragging = false,
    lastValue = initialText, -- track for controlled value changes
  }
end

local function ensureState(node)
  if not node.inputState then
    TextInput.initState(node)
  end
  return node.inputState
end

-- ============================================================================
-- Style / prop helpers
-- ============================================================================

local function getFont(node)
  local s = node.style or {}
  local fontSize = s.fontSize or 14
  if Measure then
    fontSize = Measure.scaleFontSize(fontSize, node)
    local fontFamily = s.fontFamily or nil
    local fontWeight = s.fontWeight or nil
    return Measure.getFont(fontSize, fontFamily, fontWeight)
  end
  -- Fallback: Love2D shim or Love2D native
  if love and love.graphics then
    if love.graphics.newFont then return love.graphics.newFont(fontSize) end
    if love.graphics.getFont then return love.graphics.getFont() end
  end
  return nil
end

local function isEditable(node)
  local props = node.props or {}
  if props.editable == false then return false end
  return true
end

local function isMultiline(node)
  local props = node.props or {}
  return props.multiline == true
end

local function isSecure(node)
  local props = node.props or {}
  return props.secureTextEntry == true
end

local function getMaxLength(node)
  local props = node.props or {}
  return props.maxLength
end

local function getPlaceholder(node)
  local props = node.props or {}
  return props.placeholder or ""
end

-- ============================================================================
-- Text helpers
-- ============================================================================

local BULLET = string.char(0xE2, 0x80, 0xA2) -- UTF-8 for U+2022

local function maskText(text)
  -- Each character becomes a bullet. Handle UTF-8 properly.
  local count = 0
  for _ in text:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
    count = count + 1
  end
  return BULLET:rep(count)
end

local function displayText(node, is)
  local text = is.text
  if isSecure(node) then
    return maskText(text)
  end
  return text
end

--- Count UTF-8 characters in a string.
local function utf8Len(s)
  local count = 0
  for _ in s:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
    count = count + 1
  end
  return count
end

-- ============================================================================
-- Cursor / selection helpers
-- ============================================================================

local function clampCursor(is)
  if is.cursorPos < 0 then is.cursorPos = 0 end
  if is.cursorPos > #is.text then is.cursorPos = #is.text end
end

local function resetBlink(is)
  is.blinkTimer = 0
  is.blinkOn = true
end

local function clearSelection(is)
  is.selectStart = nil
  is.selectEnd = nil
end

local function hasSelection(is)
  return is.selectStart ~= nil and is.selectEnd ~= nil
end

local function selectionOrdered(is)
  if not hasSelection(is) then return nil, nil end
  local s, e = is.selectStart, is.selectEnd
  if s > e then return e, s end
  return s, e
end

local function getSelectedText(is)
  local s, e = selectionOrdered(is)
  if not s then return "" end
  return is.text:sub(s + 1, e)
end

local function deleteSelection(is)
  local s, e = selectionOrdered(is)
  if not s then return end
  is.text = is.text:sub(1, s) .. is.text:sub(e + 1)
  is.cursorPos = s
  clearSelection(is)
end

local function startOrExtendSelection(is)
  if not is.selectStart then
    is.selectStart = is.cursorPos
  end
end

local function updateSelectionEnd(is)
  is.selectEnd = is.cursorPos
end

--- Move cursor one character left (byte-aware for UTF-8).
local function moveCursorLeft(is)
  if is.cursorPos <= 0 then return end
  -- Walk back past continuation bytes
  local pos = is.cursorPos - 1
  while pos > 0 and is.text:byte(pos) >= 128 and is.text:byte(pos) < 192 do
    pos = pos - 1
  end
  is.cursorPos = pos
end

--- Move cursor one character right (byte-aware for UTF-8).
local function moveCursorRight(is)
  if is.cursorPos >= #is.text then return end
  local pos = is.cursorPos + 1
  -- Skip continuation bytes
  while pos < #is.text and is.text:byte(pos + 1) >= 128 and is.text:byte(pos + 1) < 192 do
    pos = pos + 1
  end
  is.cursorPos = pos
end

--- Delete one character before cursor.
local function deleteBeforeCursor(is)
  if is.cursorPos <= 0 then return end
  local oldPos = is.cursorPos
  moveCursorLeft(is)
  is.text = is.text:sub(1, is.cursorPos) .. is.text:sub(oldPos + 1)
end

--- Delete one character after cursor.
local function deleteAfterCursor(is)
  if is.cursorPos >= #is.text then return end
  -- Find end of current character
  local endPos = is.cursorPos + 1
  while endPos < #is.text and is.text:byte(endPos + 1) >= 128 and is.text:byte(endPos + 1) < 192 do
    endPos = endPos + 1
  end
  is.text = is.text:sub(1, is.cursorPos) .. is.text:sub(endPos + 1)
end

--- Insert text at cursor, respecting maxLength.
local function insertAtCursor(node, is, chars)
  local maxLen = getMaxLength(node)
  if maxLen then
    local currentLen = utf8Len(is.text)
    local insertLen = utf8Len(chars)
    if currentLen + insertLen > maxLen then
      -- Trim insertion
      local allowed = maxLen - currentLen
      if allowed <= 0 then return end
      local trimmed = ""
      local count = 0
      for c in chars:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
        if count >= allowed then break end
        trimmed = trimmed .. c
        count = count + 1
      end
      chars = trimmed
    end
  end
  is.text = is.text:sub(1, is.cursorPos) .. chars .. is.text:sub(is.cursorPos + 1)
  is.cursorPos = is.cursorPos + #chars
end

-- ============================================================================
-- Scroll management
-- ============================================================================

local function ensureCursorVisible(node, is)
  local font = getFont(node)
  local c = node.computed or { x = 0, y = 0, w = 200, h = 30 }
  local s = node.style or {}
  local padding = s.paddingLeft or s.padding or 6

  local dt = displayText(node, is)
  -- Compute cursor X in display-text space
  -- Map byte cursor to display-text cursor
  local displayCursorPos = is.cursorPos
  if isSecure(node) then
    -- For secure mode, count UTF-8 chars up to cursorPos in raw text
    local charCount = 0
    for _ in is.text:sub(1, is.cursorPos):gmatch("[%z\1-\127\194-\244][\128-\191]*") do
      charCount = charCount + 1
    end
    displayCursorPos = charCount * #BULLET
  end

  local cursorX = font:getWidth(dt:sub(1, displayCursorPos))
  local textAreaW = c.w - padding * 2

  if cursorX - is.scrollX > textAreaW - 2 then
    is.scrollX = cursorX - textAreaW + 20
  elseif cursorX - is.scrollX < 0 then
    is.scrollX = math.max(0, cursorX - 20)
  end
end

-- ============================================================================
-- Screen position <-> cursor position
-- ============================================================================

--- For secure mode, map display byte position to raw text byte position.
local function displayPosToRawPos(is, displayBytePos)
  -- Count how many bullets that is
  local bulletCount = math.floor(displayBytePos / #BULLET)
  -- Walk raw text to find the byte position of that many chars
  local pos = 0
  local count = 0
  for char in is.text:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
    if count >= bulletCount then break end
    pos = pos + #char
    count = count + 1
  end
  return pos
end

local function screenToPos(node, is, mx)
  local font = getFont(node)
  local c = node.computed or { x = 0, y = 0, w = 200, h = 30 }
  local s = node.style or {}
  local padding = s.paddingLeft or s.padding or 6

  local dt = displayText(node, is)
  local textX = mx - c.x - padding + is.scrollX

  -- Walk characters to find closest position
  local pos = 0
  local bytePos = 0
  for char in dt:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
    local nextByte = bytePos + #char
    local w = font:getWidth(dt:sub(1, nextByte))
    if w > textX then
      local prevW = font:getWidth(dt:sub(1, bytePos))
      if textX - prevW < w - textX then
        if isSecure(node) then
          return displayPosToRawPos(is, bytePos)
        end
        return bytePos
      else
        if isSecure(node) then
          return displayPosToRawPos(is, nextByte)
        end
        return nextByte
      end
    end
    bytePos = nextByte
    pos = pos + 1
  end

  -- Past end of text
  if isSecure(node) then
    return #is.text
  end
  return bytePos
end

-- ============================================================================
-- Public API: get value
-- ============================================================================

function TextInput.getValue(node)
  local is = ensureState(node)
  return is.text
end

-- ============================================================================
-- Public API: update (call each frame for blink timer)
-- ============================================================================

function TextInput.update(node, dt)
  local is = ensureState(node)
  if not Focus.isFocused(node) then return end
  is.blinkTimer = is.blinkTimer + dt
  if is.blinkTimer >= 0.53 then
    is.blinkTimer = is.blinkTimer - 0.53
    is.blinkOn = not is.blinkOn
  end
end

-- ============================================================================
-- Public API: check for controlled value changes from JS
-- ============================================================================

function TextInput.syncValue(node)
  local is = ensureState(node)
  local props = node.props or {}
  if props.value ~= nil and props.value ~= is.lastValue then
    is.text = props.value
    is.lastValue = props.value
    clampCursor(is)
  end
end

-- ============================================================================
-- Public API: blur
-- ============================================================================

function TextInput.blur(node)
  local is = ensureState(node)
  is.blinkOn = false
  is.isDragging = false
  clearSelection(is)
  return is.text
end

-- ============================================================================
-- Public API: focus (called when node gains focus externally)
-- ============================================================================

function TextInput.focus(node)
  local is = ensureState(node)
  resetBlink(is)
end

-- ============================================================================
-- Input handlers
-- ============================================================================

function TextInput.handleKeyPressed(node, key, scancode, isRepeat)
  local is = ensureState(node)

  local ctrl = love.keyboard.isDown("lctrl", "rctrl")
  local shift = love.keyboard.isDown("lshift", "rshift")

  -- Ctrl combos
  if ctrl then
    if key == "a" then
      is.selectStart = 0
      is.cursorPos = #is.text
      is.selectEnd = is.cursorPos
      resetBlink(is)
      return true
    elseif key == "c" then
      if hasSelection(is) then
        love.system.setClipboardText(getSelectedText(is))
      end
      return true
    elseif key == "x" then
      if isEditable(node) and hasSelection(is) then
        love.system.setClipboardText(getSelectedText(is))
        deleteSelection(is)
        resetBlink(is)
        ensureCursorVisible(node, is)
      end
      return true
    elseif key == "v" then
      if not isEditable(node) then return true end
      local text = love.system.getClipboardText() or ""
      if text ~= "" then
        -- Strip newlines in single-line mode
        if not isMultiline(node) then
          text = text:gsub("\r\n", " "):gsub("\n", " "):gsub("\r", " ")
        end
        if hasSelection(is) then deleteSelection(is) end
        insertAtCursor(node, is, text)
        clearSelection(is)
        resetBlink(is)
        ensureCursorVisible(node, is)
      end
      return true
    end
  end

  -- Escape = blur
  if key == "escape" then
    return "blur"
  end

  -- Tab = blur
  if key == "tab" then
    return "blur"
  end

  -- Enter
  if key == "return" then
    if isMultiline(node) and isEditable(node) then
      if hasSelection(is) then deleteSelection(is) end
      insertAtCursor(node, is, "\n")
      clearSelection(is)
      resetBlink(is)
      ensureCursorVisible(node, is)
      return true
    else
      return "submit"
    end
  end

  -- Movement
  if key == "left" then
    if shift then startOrExtendSelection(is) end
    if not shift and hasSelection(is) then
      local s, _ = selectionOrdered(is)
      is.cursorPos = s
      clearSelection(is)
    else
      moveCursorLeft(is)
    end
    if shift then updateSelectionEnd(is) end
    clampCursor(is); resetBlink(is); ensureCursorVisible(node, is)
    return true
  elseif key == "right" then
    if shift then startOrExtendSelection(is) end
    if not shift and hasSelection(is) then
      local _, e = selectionOrdered(is)
      is.cursorPos = e
      clearSelection(is)
    else
      moveCursorRight(is)
    end
    if shift then updateSelectionEnd(is) end
    clampCursor(is); resetBlink(is); ensureCursorVisible(node, is)
    return true
  elseif key == "home" then
    if shift then startOrExtendSelection(is) end
    if not shift then clearSelection(is) end
    is.cursorPos = 0
    if shift then updateSelectionEnd(is) end
    resetBlink(is); ensureCursorVisible(node, is)
    return true
  elseif key == "end" then
    if shift then startOrExtendSelection(is) end
    if not shift then clearSelection(is) end
    is.cursorPos = #is.text
    if shift then updateSelectionEnd(is) end
    resetBlink(is); ensureCursorVisible(node, is)
    return true
  end

  -- Editing keys
  if not isEditable(node) then return true end

  if key == "backspace" then
    if hasSelection(is) then
      deleteSelection(is)
    else
      deleteBeforeCursor(is)
    end
    resetBlink(is); ensureCursorVisible(node, is)
    return true
  elseif key == "delete" then
    if hasSelection(is) then
      deleteSelection(is)
    else
      deleteAfterCursor(is)
    end
    resetBlink(is); ensureCursorVisible(node, is)
    return true
  end

  -- Unhandled modifier combo — don't consume, let it through to the bridge
  if love.keyboard.isDown("lctrl", "rctrl", "lgui", "rgui") then
    return false
  end

  return true -- consume regular keys while focused
end

function TextInput.handleTextInput(node, text)
  if not isEditable(node) then return end
  local is = ensureState(node)
  if love.keyboard.isDown("lctrl", "rctrl") then return end

  -- Strip newlines in single-line mode
  if not isMultiline(node) then
    if text == "\n" or text == "\r" then return end
  end

  if hasSelection(is) then deleteSelection(is) end
  insertAtCursor(node, is, text)
  resetBlink(is)
  ensureCursorVisible(node, is)
end

function TextInput.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  local is = ensureState(node)
  local c = node.computed
  if not c then return false end

  -- No bounds check here — events.hitTest already verified the click
  -- is within this node. Re-checking with potentially different coordinates
  -- (screenToContent vs hitTest traversal) can cause false negatives.

  local pos = screenToPos(node, is, mx)
  is.cursorPos = pos
  clampCursor(is)
  resetBlink(is)

  if love.keyboard.isDown("lshift", "rshift") then
    if not is.selectStart then
      is.selectStart = pos
    end
    updateSelectionEnd(is)
  else
    clearSelection(is)
    is.selectStart = is.cursorPos
    is.isDragging = true
  end

  return true
end

function TextInput.handleMouseMoved(node, mx, my)
  local is = ensureState(node)
  if not is.isDragging then return false end

  local pos = screenToPos(node, is, mx)
  is.cursorPos = pos
  clampCursor(is)
  is.selectEnd = is.cursorPos
  resetBlink(is)
  return true
end

function TextInput.handleMouseReleased(node)
  local is = ensureState(node)
  if not is.isDragging then return false end
  is.isDragging = false
  if hasSelection(is) then
    local s, e = selectionOrdered(is)
    if s == e then
      clearSelection(is)
    end
  end
  return true
end

-- ============================================================================
-- Drawing
-- ============================================================================

-- Color parsing delegated to lua/color.lua
local parseColor = Color.toTable

local function setColorWithOpacity(c, opacity)
  love.graphics.setColor(c[1], c[2], c[3], (c[4] or 1) * opacity)
end

function TextInput.draw(node, effectiveOpacity)
  local is = ensureState(node)
  local c = node.computed
  if not c then return end

  effectiveOpacity = effectiveOpacity or 1
  local font = getFont(node)
  local isFocused = Focus.isFocused(node)
  local s = node.style or {}
  local props = node.props or {}

  -- Sync controlled value
  TextInput.syncValue(node)

  love.graphics.setFont(font)

  local padding = s.paddingLeft or s.padding or 6
  local paddingTop = s.paddingTop or s.padding or 4
  local borderRadius = s.borderRadius or 4

  -- Background
  local bgColor = parseColor(s.backgroundColor, { 0.10, 0.10, 0.12, 1 })
  setColorWithOpacity(bgColor, effectiveOpacity)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)

  -- Focused background tint (subtle overlay to signal active state)
  if isFocused then
    love.graphics.setColor(0.15, 0.25, 0.45, 0.12 * effectiveOpacity)
    love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
  end

  -- Save parent scissor and intersect (so parent overflow clips are respected)
  local prevScissor = {love.graphics.getScissor()}
  local sx, sy = love.graphics.transformPoint(c.x, c.y)
  local sx2, sy2 = love.graphics.transformPoint(c.x + c.w, c.y + c.h)
  local sw, sh = math.max(0, sx2 - sx), math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)

  local textAreaX = c.x + padding
  local textAreaY = c.y + paddingTop
  local textAreaW = c.w - padding * 2
  local textAreaH = c.h - paddingTop * 2
  local lineH = font:getHeight()

  -- Vertical center
  local textY = textAreaY + (textAreaH - lineH) / 2

  local dt = displayText(node, is)
  local isEmpty = is.text == ""

  -- Display cursor position mapped to display text
  local displayCursorPos = is.cursorPos
  if isSecure(node) then
    local charCount = 0
    for _ in is.text:sub(1, is.cursorPos):gmatch("[%z\1-\127\194-\244][\128-\191]*") do
      charCount = charCount + 1
    end
    displayCursorPos = charCount * #BULLET
  end

  -- Selection highlight
  if isFocused and hasSelection(is) then
    local selS, selE = selectionOrdered(is)
    local dSelS, dSelE = selS, selE
    if isSecure(node) then
      local cs = 0
      for _ in is.text:sub(1, selS):gmatch("[%z\1-\127\194-\244][\128-\191]*") do cs = cs + 1 end
      local ce = 0
      for _ in is.text:sub(1, selE):gmatch("[%z\1-\127\194-\244][\128-\191]*") do ce = ce + 1 end
      dSelS = cs * #BULLET
      dSelE = ce * #BULLET
    end
    local sx = font:getWidth(dt:sub(1, dSelS))
    local ex = font:getWidth(dt:sub(1, dSelE))
    love.graphics.setColor(0.22, 0.35, 0.55, 0.55 * effectiveOpacity)
    love.graphics.rectangle("fill",
      textAreaX + sx - is.scrollX, textY,
      ex - sx, lineH)
  end

  -- Text or placeholder
  if isEmpty then
    -- Show placeholder (dimmed when focused, normal when unfocused)
    local ph = getPlaceholder(node)
    if ph ~= "" then
      local phColor = parseColor(props.placeholderColor, { 0.45, 0.45, 0.50, 1 })
      local phOpacity = isFocused and (effectiveOpacity * 0.45) or effectiveOpacity
      setColorWithOpacity(phColor, phOpacity)
      love.graphics.print(ph, textAreaX, textY)
    end
  else
    -- Actual text
    local textColor = parseColor(s.color, { 0.90, 0.90, 0.95, 1 })
    setColorWithOpacity(textColor, effectiveOpacity)
    love.graphics.print(dt, textAreaX - is.scrollX, textY)
  end

  -- Cursor
  if isFocused and is.blinkOn then
    local cursorX = textAreaX + font:getWidth(dt:sub(1, displayCursorPos)) - is.scrollX
    local cursorColor = parseColor(props.cursorColor, { 0.29, 0.56, 0.85, 1 })
    setColorWithOpacity(cursorColor, effectiveOpacity)
    love.graphics.rectangle("fill", cursorX, textY + 1, 2, lineH - 2)
  end

  -- Restore previous scissor (don't clear — parent scroll containers need theirs)
  if prevScissor[1] then
    love.graphics.setScissor(prevScissor[1], prevScissor[2], prevScissor[3], prevScissor[4])
  else
    love.graphics.setScissor()
  end

  -- Border
  local borderColor
  local bw = s.borderWidth or 1
  if isFocused then
    borderColor = parseColor(props.cursorColor, { 0.29, 0.56, 0.85, 0.9 })
    bw = math.max(bw, 2)  -- at least 2px when focused
  else
    local bc = parseColor(s.borderColor, nil)
    if bc then
      borderColor = bc
    end
  end
  if borderColor then
    setColorWithOpacity(borderColor, effectiveOpacity)
    love.graphics.setLineWidth(bw)
    love.graphics.rectangle("line", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
  end
end

return TextInput
