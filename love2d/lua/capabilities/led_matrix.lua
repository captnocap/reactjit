--[[
  capabilities/led_matrix.lua — NxM LED matrix visualization

  Renders an animated LED dot matrix display of any size. Supports multiple
  built-in patterns that scale to fit, procedural animations, and scrolling text.

  React usage:
    <Native type="LEDMatrix" color="red" />
    <Native type="LEDMatrix" cols={32} rows={8} color="green" pattern="scroll" scrollText="HELLO" />
    <Native type="LEDMatrix" cols={64} rows={64} color="blue" pattern="spiral" />
    <Native type="LEDMatrix" cols={128} rows={128} color="cyan" pattern="wave" />

  Patterns: smiley, heart, arrow, wave, checkerboard, spiral, rain, scroll, cycle
]]

local Capabilities = require("lua.capabilities")

-- ============================================================================
-- Built-in 8x8 patterns (source bitmaps — scaled to any grid size)
-- ============================================================================

local PATTERNS = {}

PATTERNS.smiley = {
  0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C,
}
PATTERNS.heart = {
  0x00, 0x66, 0xFF, 0xFF, 0xFF, 0x7E, 0x3C, 0x18,
}
PATTERNS.arrow = {
  0x18, 0x3C, 0x7E, 0xFF, 0x18, 0x18, 0x18, 0x18,
}
PATTERNS.checkerboard = {
  0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55, 0xAA, 0x55,
}
PATTERNS.x_mark = {
  0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81,
}
PATTERNS.diamond = {
  0x18, 0x3C, 0x7E, 0xFF, 0xFF, 0x7E, 0x3C, 0x18,
}
PATTERNS.skull = {
  0x7E, 0xFF, 0xDB, 0xFF, 0x7E, 0x3C, 0x66, 0x66,
}
PATTERNS.space_invader = {
  0x18, 0x3C, 0x7E, 0xDB, 0xFF, 0x24, 0x5A, 0xA5,
}

local PATTERN_NAMES = {"smiley", "heart", "arrow", "checkerboard", "x_mark", "diamond", "skull", "space_invader"}

--- Sample an 8x8 byte-pattern at arbitrary (row, col) using nearest-neighbor.
--- @param pat table  8-entry byte array
--- @param row number  0-based row in target grid
--- @param col number  0-based col in target grid
--- @param rows number  target grid height
--- @param cols number  target grid width
--- @return boolean  true if LED is on
local function samplePattern(pat, row, col, rows, cols)
  local srcRow = math.floor(row * 8 / rows)
  local srcCol = math.floor(col * 8 / cols)
  if srcRow > 7 then srcRow = 7 end
  if srcCol > 7 then srcCol = 7 end
  local byte = pat[srcRow + 1] or 0
  local bit = math.floor(byte / (2 ^ (7 - srcCol))) % 2
  return bit == 1
end

-- ============================================================================
-- Scroll text rendering (5x7 font subset)
-- ============================================================================

local FONT5 = {}
FONT5[string.byte("H")] = {0x11, 0x11, 0x1F, 0x11, 0x11, 0x11, 0x11}
FONT5[string.byte("E")] = {0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F}
FONT5[string.byte("L")] = {0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F}
FONT5[string.byte("O")] = {0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E}
FONT5[string.byte(" ")] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}
FONT5[string.byte("R")] = {0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11}
FONT5[string.byte("G")] = {0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F}
FONT5[string.byte("P")] = {0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10}
FONT5[string.byte("I")] = {0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1F}
FONT5[string.byte("J")] = {0x0F, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C}
FONT5[string.byte("A")] = {0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11}
FONT5[string.byte("C")] = {0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E}
FONT5[string.byte("D")] = {0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C}
FONT5[string.byte("T")] = {0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04}
FONT5[string.byte("S")] = {0x0E, 0x11, 0x10, 0x0E, 0x01, 0x11, 0x0E}
FONT5[string.byte("N")] = {0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11}
FONT5[string.byte("W")] = {0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11}
FONT5[string.byte("!")] = {0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04}
FONT5[string.byte("0")] = {0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E}
FONT5[string.byte("1")] = {0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E}
FONT5[string.byte("2")] = {0x0E, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1F}
FONT5[string.byte("3")] = {0x0E, 0x11, 0x01, 0x06, 0x01, 0x11, 0x0E}

--- Generate scroll bitmap columns from text.
--- Returns array of columns, each column is array of 0/1 per row (7 rows from font + padding).
local function textToBitmap(text, numRows)
  text = text or "HELLO "
  numRows = numRows or 8
  local cols = {}
  for i = 1, #text do
    local ch = text:byte(i)
    local glyph = FONT5[ch] or FONT5[string.byte(" ")]
    for col = 4, 0, -1 do
      local column = {}
      for row = 1, 7 do
        local bit = math.floor(glyph[row] / (2 ^ col)) % 2
        column[row] = bit
      end
      -- Pad remaining rows with 0
      for row = 8, numRows do
        column[row] = 0
      end
      cols[#cols + 1] = column
    end
    -- 1-pixel gap between chars
    local gap = {}
    for row = 1, numRows do gap[row] = 0 end
    cols[#cols + 1] = gap
  end
  return cols
end

-- ============================================================================
-- Procedural pattern generators (size-independent)
-- ============================================================================

--- Generate a wave pattern. Returns a function(row, col) -> bool.
local function isWaveOn(row, col, rows, cols, time)
  local normCol = col / math.max(1, cols - 1)
  local normRow = row / math.max(1, rows - 1)
  local wave = math.sin((normCol * 6.28 + time * 4) * 0.8) * 0.5 + 0.5
  return normRow >= wave
end

--- Generate rain. Returns a function(row, col) -> bool.
local function isRainOn(row, col, rows, cols, time)
  local drop = (row + math.floor(time * 8) + col * 3) % 11
  return drop < 2
end

--- Generate spiral. Returns a function(row, col) -> bool.
local function isSpiralOn(row, col, rows, cols, time)
  local cx = (cols - 1) / 2
  local cy = (rows - 1) / 2
  local dx, dy = col - cx, row - cy
  local dist = math.sqrt(dx * dx + dy * dy)
  local maxDist = math.sqrt(cx * cx + cy * cy)
  local normDist = dist / math.max(1, maxDist)
  local a = math.atan2(dy, dx)
  local spiral = (normDist * 4 - a + time * 2) % (math.pi * 2)
  return spiral < math.pi * 0.8
end

--- Checkerboard that works at any size (no sampling needed).
local function isCheckerOn(row, col)
  return (row + col) % 2 == 0
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("LEDMatrix", {
  visual = true,

  schema = {
    cols      = { type = "number", default = 8,       desc = "Number of columns (e.g. 8, 32, 64, 128)" },
    rows      = { type = "number", default = 8,       desc = "Number of rows (e.g. 8, 32, 64, 128)" },
    color     = { type = "string", default = "red",   desc = "LED color (red/green/blue/yellow/white/cyan/purple)" },
    pattern   = { type = "string", default = "cycle", desc = "Pattern name or 'cycle' to auto-rotate" },
    speed     = { type = "number", default = 1.0,     desc = "Animation speed multiplier" },
    scrollText = { type = "string", default = "",     desc = "Text to scroll (for scroll pattern)" },
    showFrame = { type = "bool",   default = true,    desc = "Show matrix housing frame" },
  },

  events = {},

  create = function(nodeId, props)
    return {
      time = 0,
      cycleIndex = 1,
      cycleTimer = 0,
      scrollBitmap = nil,
      scrollOffset = 0,
    }
  end,

  update = function(nodeId, props, prev, state)
    if props.pattern == "scroll" then
      local numRows = props.rows or 8
      local newText = (props.scrollText and props.scrollText ~= "") and props.scrollText or "HELLO "
      if not state.scrollBitmap or (prev and (prev.scrollText ~= props.scrollText or prev.rows ~= props.rows)) then
        state.scrollBitmap = textToBitmap(newText, numRows)
        state.scrollOffset = 0
      end
    end
  end,

  destroy = function(nodeId, state) end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local speed = props.speed or 1
    state.time = state.time + dt * speed

    if (props.pattern or "cycle") == "cycle" then
      state.cycleTimer = state.cycleTimer + dt * speed
      if state.cycleTimer >= 2.5 then
        state.cycleTimer = state.cycleTimer - 2.5
        state.cycleIndex = (state.cycleIndex % #PATTERN_NAMES) + 1
      end
    end

    if props.pattern == "scroll" then
      state.scrollOffset = state.scrollOffset + dt * speed * 6
      if state.scrollBitmap and state.scrollOffset >= #state.scrollBitmap then
        state.scrollOffset = 0
      end
    end
  end,

  render = function(node, c, opacity)
    local inst = Capabilities._instances and Capabilities._instances[node.id]
    if not inst then return end
    local state = inst.state
    local props = inst.props or {}

    local x, y = c.x, c.y
    local w, h = c.w, c.h
    if w < 10 or h < 10 then return end

    local numCols = math.max(1, math.floor(props.cols or 8))
    local numRows = math.max(1, math.floor(props.rows or 8))
    local color = props.color or "red"
    local patternName = props.pattern or "cycle"
    local showFrame = props.showFrame ~= false

    -- Resolve LED color
    local lr, lg, lb = 1, 0, 0
    if color == "green" then lr, lg, lb = 0, 1, 0.2
    elseif color == "blue" then lr, lg, lb = 0.2, 0.4, 1
    elseif color == "yellow" then lr, lg, lb = 1, 0.8, 0
    elseif color == "white" then lr, lg, lb = 1, 1, 1
    elseif color == "cyan" then lr, lg, lb = 0, 0.9, 0.9
    elseif color == "purple" then lr, lg, lb = 0.7, 0.2, 1
    end

    -- Resolve which static pattern (for cycle and named patterns)
    local staticPat = nil
    if patternName == "cycle" then
      staticPat = PATTERNS[PATTERN_NAMES[state.cycleIndex]]
    elseif PATTERNS[patternName] then
      staticPat = PATTERNS[patternName]
    end

    -- Scroll bitmap setup
    local scrollBM = nil
    local scrollOff = 0
    if patternName == "scroll" then
      if not state.scrollBitmap then
        state.scrollBitmap = textToBitmap(props.scrollText or "HELLO ", numRows)
      end
      scrollBM = state.scrollBitmap
      scrollOff = math.floor(state.scrollOffset)
    end

    -- Calculate geometry
    local padding = showFrame and (math.min(w, h) * 0.04) or 0
    local innerW = w - padding * 2
    local innerH = h - padding * 2
    local cellW = innerW / numCols
    local cellH = innerH / numRows
    local ledRadius = math.min(cellW, cellH) * 0.35

    -- For very large grids, skip the glow (performance)
    local totalLEDs = numCols * numRows
    local useGlow = totalLEDs <= 1024

    -- Frame / housing
    if showFrame then
      love.graphics.setColor(0.10, 0.10, 0.12, opacity)
      love.graphics.rectangle("fill", x, y, w, h, 4, 4)
      love.graphics.setColor(0.15, 0.15, 0.18, opacity)
      love.graphics.rectangle("fill", x + padding * 0.5, y + padding * 0.5,
        w - padding, h - padding, 3, 3)
    end

    -- Draw LEDs
    local time = state.time
    for row = 0, numRows - 1 do
      for col = 0, numCols - 1 do
        -- Determine if this LED is on
        local on = false

        if staticPat then
          on = samplePattern(staticPat, row, col, numRows, numCols)
        elseif patternName == "wave" then
          on = isWaveOn(row, col, numRows, numCols, time)
        elseif patternName == "rain" then
          on = isRainOn(row, col, numRows, numCols, time)
        elseif patternName == "spiral" then
          on = isSpiralOn(row, col, numRows, numCols, time)
        elseif patternName == "checkerboard_live" then
          on = isCheckerOn(row, col)
        elseif patternName == "scroll" and scrollBM then
          local srcCol = ((scrollOff + col) % #scrollBM) + 1
          -- Scale font rows (7px tall) to grid rows
          local srcRow = math.floor(row * 7 / numRows) + 1
          if srcRow > 7 then srcRow = 7 end
          on = scrollBM[srcCol] and scrollBM[srcCol][srcRow] == 1
        end

        local cx = x + padding + col * cellW + cellW / 2
        local cy = y + padding + row * cellH + cellH / 2

        if on then
          if useGlow then
            love.graphics.setColor(lr, lg, lb, 0.10 * opacity)
            love.graphics.circle("fill", cx, cy, ledRadius * 2.2)
            love.graphics.setColor(lr, lg, lb, 0.25 * opacity)
            love.graphics.circle("fill", cx, cy, ledRadius * 1.5)
          end
          love.graphics.setColor(lr, lg, lb, 0.85 * opacity)
          love.graphics.circle("fill", cx, cy, ledRadius)
          if useGlow then
            love.graphics.setColor(1, 1, 1, 0.35 * opacity)
            love.graphics.circle("fill", cx - ledRadius * 0.2, cy - ledRadius * 0.2, ledRadius * 0.3)
          end
        else
          love.graphics.setColor(lr * 0.15, lg * 0.15, lb * 0.15, 0.5 * opacity)
          love.graphics.circle("fill", cx, cy, ledRadius)
        end
      end
    end
  end,
})

return {}
