--[[
  osk.lua -- On-Screen Keyboard for gamepad text entry

  Lua-owned singleton overlay (same pattern as contextmenu.lua).
  When a TextInput gains focus via gamepad, the OSK opens and intercepts
  all gamepad input. D-pad navigates keys, A selects, B closes.

  Text injection uses the existing event pipeline: pushEvent with
  "textinput" and "keydown" events targeting the TextInput node.
  No new event types needed.

  Context-aware: checks node.props.keyboardType for initial layout.

  Requires: measure.lua (injected via OSK.init)
]]

local OSK = {}

local Measure = nil

function OSK.init(config)
  config = config or {}
  Measure = config.measure
end

-- ============================================================================
-- Layouts
-- ============================================================================

-- Keys can be:
--   "a"                           → character key, label = "a", emits "a"
--   { label="Shift", action="shift", w=1.5 }  → action key with width multiplier
--
-- Actions: "shift", "capslock", "backspace", "submit", "space",
--          "symbols", "symbols2", "letters", "numeric"

-- Common action rows shared across keyboards
local function symbolsRow()
  return { {label="#+=",action="symbols",w=1.5},{label="Space",action="space",w=5},{label=".",action="."},{label="Enter",action="submit",w=1.5} }
end
local function symbolsRowShift()
  return { {label="#+=",action="symbols",w=1.5},{label="Space",action="space",w=5},{label=",",action=","},{label="Enter",action="submit",w=1.5} }
end
local function shiftKey(active)
  return {label="Shift",action="shift",w=1.5,active=active or false}
end
local function bkspKey()
  return {label="Bksp",action="backspace",w=1.5}
end

-- ===========================================================================
-- QWERTY (English, default)
-- ===========================================================================

local QWERTY = {
  { "1","2","3","4","5","6","7","8","9","0" },
  { "q","w","e","r","t","y","u","i","o","p" },
  { "a","s","d","f","g","h","j","k","l" },
  { shiftKey(),"z","x","c","v","b","n","m",bkspKey() },
  symbolsRow(),
}

local QWERTY_SHIFT = {
  { "!","@","#","$","%","^","&","*","(",")" },
  { "Q","W","E","R","T","Y","U","I","O","P" },
  { "A","S","D","F","G","H","J","K","L" },
  { shiftKey(true),"Z","X","C","V","B","N","M",bkspKey() },
  symbolsRowShift(),
}

-- ===========================================================================
-- AZERTY (French)
-- ===========================================================================

local AZERTY = {
  { "1","2","3","4","5","6","7","8","9","0" },
  { "a","z","e","r","t","y","u","i","o","p" },
  { "q","s","d","f","g","h","j","k","l","m" },
  { shiftKey(),"w","x","c","v","b","n",bkspKey() },
  symbolsRow(),
}

local AZERTY_SHIFT = {
  { "!","@","#","$","%","^","&","*","(",")" },
  { "A","Z","E","R","T","Y","U","I","O","P" },
  { "Q","S","D","F","G","H","J","K","L","M" },
  { shiftKey(true),"W","X","C","V","B","N",bkspKey() },
  symbolsRowShift(),
}

-- ===========================================================================
-- QWERTZ (German)
-- ===========================================================================

local QWERTZ = {
  { "1","2","3","4","5","6","7","8","9","0" },
  { "q","w","e","r","t","z","u","i","o","p" },
  { "a","s","d","f","g","h","j","k","l" },
  { shiftKey(),"y","x","c","v","b","n","m",bkspKey() },
  symbolsRow(),
}

local QWERTZ_SHIFT = {
  { "!","@","#","$","%","^","&","*","(",")" },
  { "Q","W","E","R","T","Z","U","I","O","P" },
  { "A","S","D","F","G","H","J","K","L" },
  { shiftKey(true),"Y","X","C","V","B","N","M",bkspKey() },
  symbolsRowShift(),
}

-- ===========================================================================
-- Spanish
-- ===========================================================================

local SPANISH = {
  { "1","2","3","4","5","6","7","8","9","0" },
  { "q","w","e","r","t","y","u","i","o","p" },
  { "a","s","d","f","g","h","j","k","l" },
  { shiftKey(),"z","x","c","v","b","n","m",bkspKey() },
  symbolsRow(),
}

local SPANISH_SHIFT = {
  { "!","@","#","$","%","^","&","*","(",")" },
  { "Q","W","E","R","T","Y","U","I","O","P" },
  { "A","S","D","F","G","H","J","K","L" },
  { shiftKey(true),"Z","X","C","V","B","N","M",bkspKey() },
  symbolsRowShift(),
}

-- ===========================================================================
-- Symbols (shared across all keyboards)
-- ===========================================================================

local SYMBOLS = {
  { "~","`","|","\\","{","}","[","]","<",">" },
  { "1","2","3","4","5","6","7","8","9","0" },
  { "-","/",":",";","(",")","$","&","@" },
  { {label="More",action="symbols2",w=1.5},".",",","?","!","'","\"",bkspKey() },
  { {label="ABC",action="letters",w=1.5},{label="Space",action="space",w=5},{label=".",action="."},{label="Enter",action="submit",w=1.5} },
}

local SYMBOLS2 = {
  { "+","=","_","^","%","#","!","?","*","/" },
  { "1","2","3","4","5","6","7","8","9","0" },
  { "-",".",",",":",";","'","\"","&","@" },
  { {label="More",action="symbols",w=1.5},"(",")","[","]","{","}",bkspKey() },
  { {label="ABC",action="letters",w=1.5},{label="Space",action="space",w=5},{label=".",action="."},{label="Enter",action="submit",w=1.5} },
}

-- ===========================================================================
-- Numeric (shared)
-- ===========================================================================

local NUMERIC = {
  { "7","8","9" },
  { "4","5","6" },
  { "1","2","3" },
  { {label="-",action="-"},{label="0",action="0"},{label=".",action="."} },
  { {label="ABC",action="letters",w=1.5},{label="Bksp",action="backspace",w=1.5},{label="Enter",action="submit",w=1.5} },
}

-- ===========================================================================
-- Keyboard registry
-- ===========================================================================

-- Each keyboard has a base and shift layout. Keyboards can be extended by
-- adding entries to KEYBOARDS and KEYBOARD_ORDER.

local KEYBOARDS = {
  qwerty  = { base = QWERTY,  shift = QWERTY_SHIFT,  label = "EN" },
  azerty  = { base = AZERTY,  shift = AZERTY_SHIFT,  label = "FR" },
  qwertz  = { base = QWERTZ,  shift = QWERTZ_SHIFT,  label = "DE" },
  spanish = { base = SPANISH, shift = SPANISH_SHIFT,  label = "ES" },
}

-- Order for LB/RB cycling. Keyboards not in this list won't appear in rotation.
local KEYBOARD_ORDER = { "qwerty", "azerty", "qwertz", "spanish" }

-- Active keyboard set (persists across OSK open/close so the user's preference sticks)
local activeKeyboard = "qwerty"

-- ============================================================================
-- State
-- ============================================================================

local state = nil
-- When open:
-- {
--   targetNode  = node,       -- the TextInput node
--   layout      = "letters",  -- "letters" | "symbols" | "symbols2" | "numeric"
--   shifted     = false,      -- shift active (one-shot)
--   capsLock    = false,      -- caps lock (sticky)
--   row         = 2,          -- selected row (1-based)
--   col         = 1,          -- selected column (1-based)
--   joystickId  = number,     -- which controller owns this OSK
--   pushEvent   = function,   -- bridge event push function
--   stickState  = { x=0, y=0, repeatDir=nil, repeatTimer=0 },
-- }

-- ============================================================================
-- Visual constants
-- ============================================================================

local KEY_HEIGHT   = 40
local KEY_GAP      = 4
local KEY_RADIUS   = 6
local PANEL_PAD_X  = 20
local PANEL_PAD_Y  = 16
local PANEL_RADIUS = 12
local FONT_SIZE    = 15

local STICK_DEADZONE   = 0.4
local REPEAT_INITIAL   = 0.35
local REPEAT_RATE      = 0.12

-- Colors
local BG_COLOR       = { 0.08, 0.08, 0.11, 0.94 }
local BORDER_COLOR   = { 0.25, 0.30, 0.45, 0.7 }
local KEY_COLOR      = { 0.15, 0.15, 0.19, 1.0 }
local KEY_BORDER     = { 0.25, 0.25, 0.30, 0.6 }
local KEY_TEXT       = { 0.85, 0.87, 0.91, 1.0 }
local SELECT_COLOR   = { 0.25, 0.45, 0.75, 0.9 }
local ACTION_COLOR   = { 0.18, 0.18, 0.23, 1.0 }
local ACTIVE_ACTION  = { 0.30, 0.50, 0.70, 1.0 }
local DIM_TEXT       = { 0.55, 0.57, 0.62, 1.0 }

-- ============================================================================
-- Helpers
-- ============================================================================

local function getFont(size)
  if Measure then
    return Measure.getFont(size or FONT_SIZE)
  end
  return love.graphics.getFont()
end

--- Get the layout table for the current state.
local function currentLayout()
  if not state then
    return KEYBOARDS[activeKeyboard].base
  end
  local mode = state.layout

  if mode == "letters" then
    local kb = KEYBOARDS[activeKeyboard]
    if state.shifted then
      return kb.shift
    end
    return kb.base
  elseif mode == "symbols" then
    return SYMBOLS
  elseif mode == "symbols2" then
    return SYMBOLS2
  elseif mode == "numeric" then
    return NUMERIC
  end

  return KEYBOARDS[activeKeyboard].base
end

--- Get key definition at (row, col) in the current layout.
--- Returns the key def (string or table) or nil.
local function getKey(row, col)
  local layout = currentLayout()
  local r = layout[row]
  if not r then return nil end
  return r[col]
end

--- Get the character or action from a key definition.
local function keyAction(keyDef)
  if type(keyDef) == "string" then return keyDef end
  if type(keyDef) == "table" then return keyDef.action or keyDef.label end
  return nil
end

--- Get the display label for a key.
local function keyLabel(keyDef)
  if type(keyDef) == "string" then
    if state and state.shifted and #keyDef == 1 then
      return keyDef:upper()
    end
    return keyDef
  end
  if type(keyDef) == "table" then return keyDef.label or "" end
  return ""
end

--- Get the width multiplier for a key (default 1).
local function keyWidth(keyDef)
  if type(keyDef) == "table" and keyDef.w then return keyDef.w end
  return 1
end

--- Is this key an action key (non-character)?
local function isActionKey(keyDef)
  if type(keyDef) == "table" and keyDef.action then
    local a = keyDef.action
    return a == "shift" or a == "backspace" or a == "submit"
        or a == "space" or a == "symbols" or a == "symbols2"
        or a == "letters" or a == "numeric" or a == "capslock"
  end
  return false
end

--- Compute the total width-units for a row.
local function rowTotalWidth(row)
  local total = 0
  for _, k in ipairs(row) do
    total = total + keyWidth(k)
  end
  return total
end

--- Clamp row/col to valid bounds in the current layout.
local function clampSelection()
  if not state then return end
  local layout = currentLayout()
  state.row = math.max(1, math.min(state.row, #layout))
  local r = layout[state.row]
  if r then
    state.col = math.max(1, math.min(state.col, #r))
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Register a custom keyboard layout.
--- @param name string Unique key (e.g. "cyrillic", "hangul")
--- @param def table { base = {...}, shift = {...}, label = "RU" }
--- @param position number|nil Insert position in rotation order (nil = append)
function OSK.registerKeyboard(name, def, position)
  KEYBOARDS[name] = def
  -- Add to rotation order if not already present
  for _, existing in ipairs(KEYBOARD_ORDER) do
    if existing == name then return end
  end
  if position then
    table.insert(KEYBOARD_ORDER, position, name)
  else
    table.insert(KEYBOARD_ORDER, name)
  end
end

--- Set the active keyboard by name. Persists across open/close.
function OSK.setKeyboard(name)
  if KEYBOARDS[name] then
    activeKeyboard = name
  end
end

--- Get the current active keyboard name.
function OSK.getKeyboard()
  return activeKeyboard
end

--- Get list of available keyboard names.
function OSK.getKeyboards()
  local list = {}
  for _, name in ipairs(KEYBOARD_ORDER) do
    list[#list + 1] = { name = name, label = KEYBOARDS[name].label }
  end
  return list
end

function OSK.isOpen()
  return state ~= nil
end

function OSK.open(targetNode, joystickId, pushEvent)
  -- Determine initial layout from node props
  local layout = "letters"
  local props = targetNode.props or {}
  local kt = props.keyboardType
  if kt == "numeric" or kt == "number-pad" or kt == "phone-pad" then
    layout = "numeric"
  end

  state = {
    targetNode = targetNode,
    layout     = layout,
    shifted    = false,
    capsLock   = false,
    row        = 2,     -- start on first letter row
    col        = 1,
    joystickId = joystickId,
    pushEvent  = pushEvent,
    stickState = { x = 0, y = 0, repeatDir = nil, repeatTimer = 0 },
  }

  -- For numeric layout, start on row 1
  if layout == "numeric" then
    state.row = 1
  end

  clampSelection()
end

function OSK.close()
  if not state then return end
  -- Push escape to blur the TextInput
  local targetId = state.targetNode and state.targetNode.id
  if targetId and state.pushEvent then
    state.pushEvent({
      type = "keydown",
      payload = {
        type = "keydown",
        targetId = targetId,
        key = "escape",
        scancode = "escape",
      }
    })
  end
  state = nil
end

-- ============================================================================
-- Navigation
-- ============================================================================

local function navigate(direction)
  if not state then return end
  local layout = currentLayout()

  if direction == "up" then
    if state.row > 1 then
      state.row = state.row - 1
    end
  elseif direction == "down" then
    if state.row < #layout then
      state.row = state.row + 1
    end
  elseif direction == "left" then
    if state.col > 1 then
      state.col = state.col - 1
    end
  elseif direction == "right" then
    local r = layout[state.row]
    if r and state.col < #r then
      state.col = state.col + 1
    end
  end

  clampSelection()
end

-- ============================================================================
-- Key activation
-- ============================================================================

local function activateKey()
  if not state then return end
  local keyDef = getKey(state.row, state.col)
  if not keyDef then return end

  local action = keyAction(keyDef)
  if not action then return end

  local pushEvent = state.pushEvent
  local targetId = state.targetNode and state.targetNode.id

  -- Layout switches
  if action == "shift" then
    if state.capsLock then
      state.capsLock = false
      state.shifted = false
    elseif state.shifted then
      -- Double-tap shift → caps lock
      state.capsLock = true
      state.shifted = true
    else
      state.shifted = true
    end
    return
  end

  if action == "symbols" then
    state.layout = "symbols"
    state.shifted = false
    state.capsLock = false
    clampSelection()
    return
  end

  if action == "symbols2" then
    state.layout = "symbols2"
    clampSelection()
    return
  end

  if action == "letters" then
    state.layout = "letters"
    state.shifted = false
    state.capsLock = false
    clampSelection()
    return
  end

  if action == "numeric" then
    state.layout = "numeric"
    state.shifted = false
    state.capsLock = false
    clampSelection()
    return
  end

  -- Backspace
  if action == "backspace" then
    if pushEvent and targetId then
      pushEvent({
        type = "keydown",
        payload = {
          type = "keydown",
          targetId = targetId,
          key = "backspace",
          scancode = "backspace",
        }
      })
    end
    return
  end

  -- Submit (Enter)
  if action == "submit" then
    if pushEvent and targetId then
      pushEvent({
        type = "keydown",
        payload = {
          type = "keydown",
          targetId = targetId,
          key = "return",
          scancode = "return",
        }
      })
    end
    OSK.close()
    return
  end

  -- Space
  if action == "space" then
    if pushEvent and targetId then
      pushEvent({
        type = "textinput",
        payload = {
          type = "textinput",
          targetId = targetId,
          text = " ",
        }
      })
    end
    -- Clear one-shot shift
    if state.shifted and not state.capsLock then
      state.shifted = false
    end
    return
  end

  -- Character key
  local char = action
  if state.shifted and #char == 1 then
    char = char:upper()
  end

  if pushEvent and targetId then
    pushEvent({
      type = "textinput",
      payload = {
        type = "textinput",
        targetId = targetId,
        text = char,
      }
    })
  end

  -- Clear one-shot shift (not caps lock)
  if state.shifted and not state.capsLock then
    state.shifted = false
  end
end

-- ============================================================================
-- Gamepad input handlers
-- ============================================================================

function OSK.handleGamepadPressed(button, joystickId)
  if not state then return end
  -- Only the controller that opened the OSK can use it
  if joystickId ~= state.joystickId then return end

  if button == "dpup" then navigate("up"); return end
  if button == "dpdown" then navigate("down"); return end
  if button == "dpleft" then navigate("left"); return end
  if button == "dpright" then navigate("right"); return end

  if button == "a" then
    activateKey()
    return
  end

  if button == "b" or button == "start" then
    OSK.close()
    return
  end

  -- L/R shoulder: cycle keyboard language
  if button == "leftshoulder" or button == "rightshoulder" then
    local dir = button == "rightshoulder" and 1 or -1
    local curIdx = 1
    for i, name in ipairs(KEYBOARD_ORDER) do
      if name == activeKeyboard then curIdx = i; break end
    end
    curIdx = curIdx + dir
    if curIdx < 1 then curIdx = #KEYBOARD_ORDER end
    if curIdx > #KEYBOARD_ORDER then curIdx = 1 end
    activeKeyboard = KEYBOARD_ORDER[curIdx]
    -- Switch to letters layout when changing keyboard
    state.layout = "letters"
    state.shifted = false
    state.capsLock = false
    clampSelection()
    return
  end

  -- X button: backspace shortcut
  if button == "x" then
    local pushEvent = state.pushEvent
    local targetId = state.targetNode and state.targetNode.id
    if pushEvent and targetId then
      pushEvent({
        type = "keydown",
        payload = {
          type = "keydown",
          targetId = targetId,
          key = "backspace",
          scancode = "backspace",
        }
      })
    end
    return
  end

  -- Y button: space shortcut
  if button == "y" then
    local pushEvent = state.pushEvent
    local targetId = state.targetNode and state.targetNode.id
    if pushEvent and targetId then
      pushEvent({
        type = "textinput",
        payload = {
          type = "textinput",
          targetId = targetId,
          text = " ",
        }
      })
    end
    return
  end
end

function OSK.handleGamepadAxis(axis, value, joystickId)
  if not state then return end
  if joystickId ~= state.joystickId then return end

  if axis == "leftx" then state.stickState.x = value end
  if axis == "lefty" then state.stickState.y = value end
end

-- ============================================================================
-- Update (stick repeat)
-- ============================================================================

function OSK.update(dt)
  if not state then return end

  -- Check if target node is still in the tree
  if state.targetNode and not state.targetNode.computed then
    state = nil
    return
  end

  -- Stick navigation with repeat
  local ss = state.stickState
  local x, y = ss.x, ss.y

  if math.abs(x) < STICK_DEADZONE then x = 0 end
  if math.abs(y) < STICK_DEADZONE then y = 0 end

  local dir = nil
  if math.abs(x) > math.abs(y) then
    if x > 0 then dir = "right" elseif x < 0 then dir = "left" end
  else
    if y > 0 then dir = "down" elseif y < 0 then dir = "up" end
  end

  if dir == nil then
    ss.repeatDir = nil
    ss.repeatTimer = 0
  elseif dir ~= ss.repeatDir then
    ss.repeatDir = dir
    ss.repeatTimer = REPEAT_INITIAL
    navigate(dir)
  else
    ss.repeatTimer = ss.repeatTimer - dt
    if ss.repeatTimer <= 0 then
      ss.repeatTimer = REPEAT_RATE
      navigate(dir)
    end
  end
end

-- ============================================================================
-- Drawing
-- ============================================================================

function OSK.draw()
  if not state then return end

  local layout = currentLayout()
  local font = getFont(FONT_SIZE)
  local screenW, screenH = love.graphics.getDimensions()

  -- Compute panel dimensions
  local maxRowWidth = 0
  for _, row in ipairs(layout) do
    maxRowWidth = math.max(maxRowWidth, rowTotalWidth(row))
  end

  -- Key unit width: fit the widest row within 80% of screen
  local availW = screenW * 0.8
  local unitW = (availW - KEY_GAP * (maxRowWidth - 1)) / maxRowWidth
  -- Clamp unit width to reasonable bounds
  unitW = math.min(unitW, 56)
  unitW = math.max(unitW, 28)

  local panelW = maxRowWidth * unitW + (maxRowWidth - 1) * KEY_GAP + PANEL_PAD_X * 2
  local panelH = #layout * KEY_HEIGHT + (#layout - 1) * KEY_GAP + PANEL_PAD_Y * 2
  local panelX = (screenW - panelW) / 2
  local panelY = screenH - panelH - 24

  -- Dim background behind panel
  love.graphics.setColor(0, 0, 0, 0.3)
  love.graphics.rectangle("fill", 0, 0, screenW, screenH)

  -- Panel background
  love.graphics.setColor(BG_COLOR[1], BG_COLOR[2], BG_COLOR[3], BG_COLOR[4])
  love.graphics.rectangle("fill", panelX, panelY, panelW, panelH, PANEL_RADIUS, PANEL_RADIUS)

  -- Panel border
  love.graphics.setColor(BORDER_COLOR[1], BORDER_COLOR[2], BORDER_COLOR[3], BORDER_COLOR[4])
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", panelX, panelY, panelW, panelH, PANEL_RADIUS, PANEL_RADIUS)

  love.graphics.setFont(font)

  -- Draw keys
  for rowIdx, row in ipairs(layout) do
    local totalW = rowTotalWidth(row)
    -- Center this row within the panel
    local rowPixelW = totalW * unitW + (#row - 1) * KEY_GAP
    local startX = panelX + (panelW - rowPixelW) / 2
    local y = panelY + PANEL_PAD_Y + (rowIdx - 1) * (KEY_HEIGHT + KEY_GAP)

    local x = startX
    for colIdx, keyDef in ipairs(row) do
      local w = keyWidth(keyDef) * unitW + (keyWidth(keyDef) - 1) * KEY_GAP
      local isSelected = (rowIdx == state.row and colIdx == state.col)
      local isAction = isActionKey(keyDef)
      local isActiveAction = type(keyDef) == "table" and keyDef.active

      -- Key background
      if isSelected then
        love.graphics.setColor(SELECT_COLOR[1], SELECT_COLOR[2], SELECT_COLOR[3], SELECT_COLOR[4])
      elseif isActiveAction then
        love.graphics.setColor(ACTIVE_ACTION[1], ACTIVE_ACTION[2], ACTIVE_ACTION[3], ACTIVE_ACTION[4])
      elseif isAction then
        love.graphics.setColor(ACTION_COLOR[1], ACTION_COLOR[2], ACTION_COLOR[3], ACTION_COLOR[4])
      else
        love.graphics.setColor(KEY_COLOR[1], KEY_COLOR[2], KEY_COLOR[3], KEY_COLOR[4])
      end
      love.graphics.rectangle("fill", x, y, w, KEY_HEIGHT, KEY_RADIUS, KEY_RADIUS)

      -- Key border
      if isSelected then
        love.graphics.setColor(1, 1, 1, 0.4)
      else
        love.graphics.setColor(KEY_BORDER[1], KEY_BORDER[2], KEY_BORDER[3], KEY_BORDER[4])
      end
      love.graphics.rectangle("line", x, y, w, KEY_HEIGHT, KEY_RADIUS, KEY_RADIUS)

      -- Key label
      local label = keyLabel(keyDef)
      if isAction and not isSelected then
        love.graphics.setColor(DIM_TEXT[1], DIM_TEXT[2], DIM_TEXT[3], DIM_TEXT[4])
      else
        love.graphics.setColor(KEY_TEXT[1], KEY_TEXT[2], KEY_TEXT[3], KEY_TEXT[4])
      end
      local textW = font:getWidth(label)
      local textH = font:getHeight()
      love.graphics.print(label, x + (w - textW) / 2, y + (KEY_HEIGHT - textH) / 2)

      x = x + w + KEY_GAP
    end
  end

  -- Status bar: show current layout, shift state, button hints
  local statusY = panelY - 22
  local smallFont = getFont(11)
  love.graphics.setFont(smallFont)
  love.graphics.setColor(0.5, 0.52, 0.58, 0.8)

  local kb = KEYBOARDS[activeKeyboard]
  local layoutName = (kb and kb.label or activeKeyboard)
  if state.layout == "symbols" or state.layout == "symbols2" then
    layoutName = layoutName .. " Sym"
  elseif state.layout == "numeric" then
    layoutName = layoutName .. " Num"
  end
  if state.capsLock then
    layoutName = layoutName .. " CAPS"
  elseif state.shifted then
    layoutName = layoutName .. " SHIFT"
  end

  local hints = layoutName .. "   |   A:select  B:close  X:bksp  Y:space  LB/RB:lang"
  local hintsW = smallFont:getWidth(hints)
  love.graphics.print(hints, (screenW - hintsW) / 2, statusY)

  -- Reset
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.setLineWidth(1)
end

return OSK
