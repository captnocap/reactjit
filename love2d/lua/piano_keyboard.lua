--[[
  piano_keyboard.lua -- Lua-owned piano keyboard component

  Handles all drawing and interaction in Lua for zero-latency response.
  React sends props (key definitions, palette, sizes) via the reconciler;
  Lua owns the drag state and paints directly. Key events are pushed
  back to JS via buffered events (pianokeyboard:keydown, pianokeyboard:keyup).

  Supports glissando: dragging across keys fires keyup on the old key and
  keydown on the new key, enabling slide-across-keys interaction.
]]

local PianoKeyboard = {}

-- Injected dependencies
local Measure = nil

-- Pending events to push to JS (drained each frame by init.lua)
local pendingEvents = {}

-- ============================================================================
-- Initialization
-- ============================================================================

function PianoKeyboard.init(config)
  Measure = config.measure
end

-- ============================================================================
-- Per-node state
-- ============================================================================

local function getState(node)
  if not node._pianokeyboard then
    node._pianokeyboard = {
      isDragging = false,
      lastKeyId = nil,      -- id of the currently held key
      lastKeyIsBlack = false,
    }
  end
  return node._pianokeyboard
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

local function queueEvent(nodeId, eventType, payload)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    value = payload,
  }
end

--- Safely decode a JSON string prop. Returns fallback on failure.
local function jsonProp(props, key, fallback)
  local raw = props[key]
  if type(raw) == "string" then
    local ok, result = pcall(function()
      return require("cjson").decode(raw)
    end)
    if ok then return result end
    -- Try Lua's load-based JSON decode as fallback (QuickJS bridge may use it)
    ok, result = pcall(function()
      -- The bridge may already convert JSON strings to tables
      return raw
    end)
  elseif type(raw) == "table" then
    return raw
  end
  return fallback
end

--- Attempt JSON decode — handles both string and pre-parsed table props.
--- Uses the same library detection as bridge_quickjs.lua.
local _json = nil
local function safeDecode(val, fallback)
  if type(val) == "table" then return val end
  if type(val) ~= "string" or val == "" then return fallback end
  if not _json then
    local ok, mod
    ok, mod = pcall(require, "cjson")    if ok then _json = mod
    else ok, mod = pcall(require, "json")    if ok then _json = mod
    else ok, mod = pcall(require, "lib.json")    if ok then _json = mod
    else ok, mod = pcall(require, "lua.json")    if ok then _json = mod
    else _json = false end end end end
  end
  if _json then
    local ok, result = pcall(_json.decode, val)
    if ok then return result end
  end
  return fallback
end

-- Default palette matching the JSX component
local DEFAULT_PALETTE = {
  whiteKey = "#e8e8f0",
  whiteHover = "#dddde8",
  whitePress = "#d0d0dc",
  whiteActive = "#c4bef8",
  blackKey = "#1a1a28",
  blackHover = "#222234",
  blackPress = "#2a2a3e",
  blackActive = "#7c5bf5",
  whiteText = "#9999aa",
  blackText = "#555568",
  activeText = "#ffffff",
  whiteBorder = "#c8c8d8",
  blackBorder = "#2a2a3a",
  activeBorder = "#7c5bf5",
}

local DEFAULT_BLACK_AFTER = {0, 1, 3, 4, 5}  -- 0-indexed: after C, D, F, G, A

local NOTE_NAMES = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}

local function getProps(node)
  local props = node.props or {}
  local whites = safeDecode(props.whites, {})
  local blacks = safeDecode(props.blacks, {})
  local blackAfter = safeDecode(props.blackAfter, DEFAULT_BLACK_AFTER)
  local activeKeys = safeDecode(props.activeKeys, {})
  local palette = safeDecode(props.palette, {})

  -- Merge palette with defaults
  local p = {}
  for k, v in pairs(DEFAULT_PALETTE) do p[k] = v end
  if type(palette) == "table" then
    for k, v in pairs(palette) do p[k] = v end
  end

  return {
    whites = whites,
    blacks = blacks,
    blackAfter = blackAfter,
    activeKeys = activeKeys,
    showNoteNames = props.showNoteNames ~= false,
    whiteKeyWidth = tonumber(props.whiteKeyWidth) or 44,
    whiteKeyHeight = tonumber(props.whiteKeyHeight) or 120,
    whiteGap = tonumber(props.whiteGap) or 2,
    blackKeyWidth = tonumber(props.blackKeyWidth) or 28,
    blackKeyHeight = tonumber(props.blackKeyHeight) or 72,
    disabled = props.disabled or false,
    palette = p,
  }
end

--- Check if a key ID is in the activeKeys set.
local function isKeyActive(activeKeys, keyId)
  if not activeKeys or not keyId then return false end
  -- Array form: ["a", "b", ...]
  if #activeKeys > 0 then
    for i = 1, #activeKeys do
      if activeKeys[i] == keyId then return true end
    end
    return false
  end
  -- Object form: { a: true, b: true }
  return activeKeys[keyId] == true
end

--- Get note name from MIDI number
local function noteName(midi)
  if not midi then return nil end
  local idx = (midi % 12) + 1
  local octave = math.floor(midi / 12) - 1
  return NOTE_NAMES[idx] .. tostring(octave)
end

-- ============================================================================
-- Geometry helpers
-- ============================================================================

--- Compute the black key positions (marginLeft from previous element's right edge).
--- Returns array of { marginLeft, centerX } for each black key.
local function computeBlackKeyPositions(whiteCount, blackAfter, whiteKeyWidth, whiteGap, blackKeyWidth)
  local positions = {}
  for i = 1, #blackAfter do
    local afterIdx = blackAfter[i]  -- 0-indexed white key index
    if afterIdx + 1 >= whiteCount then break end

    local leftWhiteCenter = afterIdx * (whiteKeyWidth + whiteGap) + whiteKeyWidth / 2
    local rightWhiteCenter = (afterIdx + 1) * (whiteKeyWidth + whiteGap) + whiteKeyWidth / 2
    local blackCenter = (leftWhiteCenter + rightWhiteCenter) / 2
    local blackLeft = blackCenter - blackKeyWidth / 2

    positions[#positions + 1] = {
      x = blackLeft,
      center = blackCenter,
    }
  end
  return positions
end

--- Hit-test: given mouse coordinates relative to the keyboard origin,
--- determine which key was hit. Black keys are tested first (on top).
--- Returns keyId, keyDef, isBlack or nil.
local function hitTestKey(p, localX, localY, blackPositions)
  -- Test black keys first (they're on top)
  if localY < p.blackKeyHeight then
    for i = 1, #blackPositions do
      local bx = blackPositions[i].x
      if localX >= bx and localX < bx + p.blackKeyWidth then
        local key = p.blacks[i]
        if key then
          return key.id, key, true
        end
      end
    end
  end

  -- Test white keys
  if localY >= 0 and localY < p.whiteKeyHeight then
    local whiteIdx = math.floor(localX / (p.whiteKeyWidth + p.whiteGap))
    -- Check we're actually on a key and not in the gap
    local keyLeft = whiteIdx * (p.whiteKeyWidth + p.whiteGap)
    if localX < keyLeft + p.whiteKeyWidth then
      local idx = whiteIdx + 1
      local key = p.whites[idx]
      if key then
        return key.id, key, false
      end
    end
  end

  return nil, nil, false
end

-- ============================================================================
-- Font helper
-- ============================================================================

local LABEL_FONT_SIZE = 10
local NOTE_FONT_SIZE = 8

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

function PianoKeyboard.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)
  local pal = p.palette

  local opacity = (p.disabled and 0.5 or 1) * effectiveOpacity
  local whiteCount = #p.whites
  if whiteCount == 0 then return end

  local blackPositions = computeBlackKeyPositions(
    whiteCount, p.blackAfter, p.whiteKeyWidth, p.whiteGap, p.blackKeyWidth
  )

  local originX = c.x
  local originY = c.y

  local labelFont = getFontHandle(LABEL_FONT_SIZE)
  local noteFont = getFontHandle(NOTE_FONT_SIZE)

  -- ── Draw white keys ──────────────────────────
  for i = 1, whiteCount do
    local key = p.whites[i]
    local active = isKeyActive(p.activeKeys, key.id)
    local held = state.isDragging and state.lastKeyId == key.id

    local kx = originX + (i - 1) * (p.whiteKeyWidth + p.whiteGap)
    local ky = originY
    local kw = p.whiteKeyWidth
    local kh = p.whiteKeyHeight
    local radius = 3

    -- Background
    local bgColor
    if active then bgColor = pal.whiteActive
    elseif held then bgColor = pal.whitePress
    else bgColor = pal.whiteKey end
    local r, g, b, a = parseColor(bgColor)
    love.graphics.setColor(r, g, b, a * opacity)
    love.graphics.rectangle("fill", kx, ky, kw, kh, radius, radius)

    -- Border
    local borderColor = active and pal.activeBorder or pal.whiteBorder
    local br, bg2, bb, ba = parseColor(borderColor)
    local borderW = active and 2 or 1
    love.graphics.setLineWidth(borderW)
    love.graphics.setColor(br, bg2, bb, ba * opacity)
    love.graphics.rectangle("line", kx, ky, kw, kh, radius, radius)

    -- Label text at bottom
    if labelFont and key.label then
      local textColor = active and pal.activeBorder or pal.whiteText
      local tr, tg, tb, ta = parseColor(textColor)
      love.graphics.setColor(tr, tg, tb, ta * opacity)
      local tw = labelFont:getWidth(key.label)
      local labelX = kx + (kw - tw) / 2
      local labelY = ky + kh - 6 - labelFont:getHeight()
      love.graphics.setFont(labelFont)
      love.graphics.print(key.label, labelX, labelY)

      -- Note name below label
      if p.showNoteNames and key.note and noteFont then
        local nn = noteName(key.note)
        if nn then
          local nColor = active and pal.activeBorder or "#b0b0c0"
          local nr, ng, nb, na = parseColor(nColor)
          love.graphics.setColor(nr, ng, nb, na * opacity)
          local nw = noteFont:getWidth(nn)
          love.graphics.setFont(noteFont)
          love.graphics.print(nn, kx + (kw - nw) / 2, labelY + labelFont:getHeight() + 1)
        end
      end
    end
  end

  -- ── Draw black keys ──────────────────────────
  for i = 1, #blackPositions do
    local key = p.blacks[i]
    if not key then break end
    local active = isKeyActive(p.activeKeys, key.id)
    local held = state.isDragging and state.lastKeyId == key.id

    local kx = originX + blackPositions[i].x
    local ky = originY
    local kw = p.blackKeyWidth
    local kh = p.blackKeyHeight
    local radius = 3

    -- Background
    local bgColor
    if active then bgColor = pal.blackActive
    elseif held then bgColor = pal.blackPress
    else bgColor = pal.blackKey end
    local r, g, b, a = parseColor(bgColor)
    love.graphics.setColor(r, g, b, a * opacity)
    love.graphics.rectangle("fill", kx, ky, kw, kh, radius, radius)

    -- Border
    local borderColor = active and pal.activeBorder or pal.blackBorder
    local br, bg2, bb, ba = parseColor(borderColor)
    local borderW = active and 2 or 1
    love.graphics.setLineWidth(borderW)
    love.graphics.setColor(br, bg2, bb, ba * opacity)
    love.graphics.rectangle("line", kx, ky, kw, kh, radius, radius)

    -- Label text at bottom
    if labelFont and key.label then
      local textColor = active and pal.activeText or pal.blackText
      local tr, tg, tb, ta = parseColor(textColor)
      love.graphics.setColor(tr, tg, tb, ta * opacity)
      local tw = labelFont:getWidth(key.label)
      love.graphics.setFont(labelFont)
      love.graphics.print(key.label, kx + (kw - tw) / 2, ky + kh - 5 - labelFont:getHeight())

      -- Note name
      if p.showNoteNames and key.note and noteFont then
        local nn = noteName(key.note)
        if nn then
          local nColor = active and pal.activeText or "#6a6a80"
          local nr, ng, nb, na = parseColor(nColor)
          love.graphics.setColor(nr, ng, nb, na * opacity)
          local nw = noteFont:getWidth(nn)
          love.graphics.setFont(noteFont)
          love.graphics.print(nn, kx + (kw - nw) / 2, ky + kh - 5 - labelFont:getHeight() + labelFont:getHeight() + 1)
        end
      end
    end
  end

  love.graphics.setLineWidth(1)
end

-- ============================================================================
-- Mouse event handlers
-- ============================================================================

function PianoKeyboard.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end

  local state = getState(node)
  local p = getProps(node)
  if p.disabled then return false end

  local c = node.computed
  if not c then return false end

  local blackPositions = computeBlackKeyPositions(
    #p.whites, p.blackAfter, p.whiteKeyWidth, p.whiteGap, p.blackKeyWidth
  )

  local localX = mx - c.x
  local localY = my - c.y
  local keyId, keyDef, isBlack = hitTestKey(p, localX, localY, blackPositions)

  if keyId then
    state.isDragging = true
    state.lastKeyId = keyId
    state.lastKeyIsBlack = isBlack

    queueEvent(node.id, "pianokeyboard:keydown", {
      keyId = keyId,
      key = keyDef,
    })
  end

  return true
end

function PianoKeyboard.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isDragging then return false end

  local p = getProps(node)
  local c = node.computed
  if not c then return false end

  local blackPositions = computeBlackKeyPositions(
    #p.whites, p.blackAfter, p.whiteKeyWidth, p.whiteGap, p.blackKeyWidth
  )

  local localX = mx - c.x
  local localY = my - c.y
  local keyId, keyDef, isBlack = hitTestKey(p, localX, localY, blackPositions)

  -- Glissando: if we moved to a different key, fire keyup on old, keydown on new
  if keyId and keyId ~= state.lastKeyId then
    -- Release old key
    if state.lastKeyId then
      -- Find the old key def for the event payload
      local oldKey = nil
      if state.lastKeyIsBlack then
        for i = 1, #p.blacks do
          if p.blacks[i].id == state.lastKeyId then oldKey = p.blacks[i]; break end
        end
      else
        for i = 1, #p.whites do
          if p.whites[i].id == state.lastKeyId then oldKey = p.whites[i]; break end
        end
      end
      queueEvent(node.id, "pianokeyboard:keyup", {
        keyId = state.lastKeyId,
        key = oldKey,
      })
    end

    -- Press new key
    state.lastKeyId = keyId
    state.lastKeyIsBlack = isBlack
    queueEvent(node.id, "pianokeyboard:keydown", {
      keyId = keyId,
      key = keyDef,
    })
  end

  return true
end

function PianoKeyboard.handleMouseReleased(node, mx, my, button)
  local state = getState(node)
  if not state.isDragging then return false end

  local p = getProps(node)

  -- Release current key
  if state.lastKeyId then
    local oldKey = nil
    if state.lastKeyIsBlack then
      for i = 1, #p.blacks do
        if p.blacks[i].id == state.lastKeyId then oldKey = p.blacks[i]; break end
      end
    else
      for i = 1, #p.whites do
        if p.whites[i].id == state.lastKeyId then oldKey = p.whites[i]; break end
      end
    end
    queueEvent(node.id, "pianokeyboard:keyup", {
      keyId = state.lastKeyId,
      key = oldKey,
    })
  end

  state.isDragging = false
  state.lastKeyId = nil
  state.lastKeyIsBlack = false

  return true
end

-- ============================================================================
-- Event draining (called by init.lua each frame)
-- ============================================================================

function PianoKeyboard.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return PianoKeyboard
