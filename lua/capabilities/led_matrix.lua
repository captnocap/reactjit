--[[
  capabilities/led_matrix.lua — 8x8 LED matrix visualization

  Renders an animated 8x8 LED dot matrix display. Supports multiple
  built-in patterns that cycle automatically, or a custom 64-bit pattern
  via the pattern prop.

  React usage:
    <Native type="LEDMatrix" color="red" />
    <Native type="LEDMatrix" color="green" pattern="smiley" speed={2} />
    <Native type="LEDMatrix" color="blue" pattern="scroll" scrollText="HELLO" />

  Patterns: smiley, heart, arrow, wave, checkerboard, spiral, rain, scroll
]]

local Capabilities = require("lua.capabilities")

-- ============================================================================
-- Built-in 8x8 patterns (each row is a byte, 8 rows = 8 bytes)
-- ============================================================================

local PATTERNS = {}

PATTERNS.smiley = {
  0x3C, -- 00111100
  0x42, -- 01000010
  0xA5, -- 10100101
  0x81, -- 10000001
  0xA5, -- 10100101
  0x99, -- 10011001
  0x42, -- 01000010
  0x3C, -- 00111100
}

PATTERNS.heart = {
  0x00, -- 00000000
  0x66, -- 01100110
  0xFF, -- 11111111
  0xFF, -- 11111111
  0xFF, -- 11111111
  0x7E, -- 01111110
  0x3C, -- 00111100
  0x18, -- 00011000
}

PATTERNS.arrow = {
  0x18, -- 00011000
  0x3C, -- 00111100
  0x7E, -- 01111110
  0xFF, -- 11111111
  0x18, -- 00011000
  0x18, -- 00011000
  0x18, -- 00011000
  0x18, -- 00011000
}

PATTERNS.checkerboard = {
  0xAA, -- 10101010
  0x55, -- 01010101
  0xAA, -- 10101010
  0x55, -- 01010101
  0xAA, -- 10101010
  0x55, -- 01010101
  0xAA, -- 10101010
  0x55, -- 01010101
}

PATTERNS.x_mark = {
  0x81, -- 10000001
  0x42, -- 01000010
  0x24, -- 00100100
  0x18, -- 00011000
  0x18, -- 00011000
  0x24, -- 00100100
  0x42, -- 01000010
  0x81, -- 10000001
}

PATTERNS.diamond = {
  0x18, -- 00011000
  0x3C, -- 00111100
  0x7E, -- 01111110
  0xFF, -- 11111111
  0xFF, -- 11111111
  0x7E, -- 01111110
  0x3C, -- 00111100
  0x18, -- 00011000
}

PATTERNS.skull = {
  0x7E, -- 01111110
  0xFF, -- 11111111
  0xDB, -- 11011011
  0xFF, -- 11111111
  0x7E, -- 01111110
  0x3C, -- 00111100
  0x66, -- 01100110
  0x66, -- 01100110
}

PATTERNS.space_invader = {
  0x18, -- 00011000
  0x3C, -- 00111100
  0x7E, -- 01111110
  0xDB, -- 11011011
  0xFF, -- 11111111
  0x24, -- 00100100
  0x5A, -- 01011010
  0xA5, -- 10100101
}

-- Pattern name list for cycling
local PATTERN_NAMES = {"smiley", "heart", "arrow", "checkerboard", "x_mark", "diamond", "skull", "space_invader"}

-- ============================================================================
-- Scroll text rendering (5x7 font subset)
-- ============================================================================

-- Minimal 5-wide font for uppercase + digits
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

-- Generate scroll bitmap from text
local function textToBitmap(text)
  text = text or "HELLO "
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
      column[8] = 0 -- 8th row padding
      cols[#cols + 1] = column
    end
    -- 1-pixel gap between chars
    cols[#cols + 1] = {0, 0, 0, 0, 0, 0, 0, 0}
  end
  return cols
end

-- ============================================================================
-- Wave pattern generator
-- ============================================================================

local function generateWave(time)
  local grid = {}
  for row = 0, 7 do
    local byte = 0
    for col = 0, 7 do
      local wave = math.sin((col + time * 4) * 0.8) * 3.5 + 3.5
      if row >= math.floor(wave) then
        byte = byte + 2 ^ (7 - col)
      end
    end
    grid[row + 1] = byte
  end
  return grid
end

-- Rain pattern
local function generateRain(time)
  local grid = {}
  for row = 0, 7 do
    local byte = 0
    for col = 0, 7 do
      local drop = (row + math.floor(time * 8) + col * 3) % 11
      if drop < 2 then
        byte = byte + 2 ^ (7 - col)
      end
    end
    grid[row + 1] = byte
  end
  return grid
end

-- Spiral pattern
local function generateSpiral(time)
  local grid = {}
  local cx, cy = 3.5, 3.5
  local angle = time * 2
  for row = 0, 7 do
    local byte = 0
    for col = 0, 7 do
      local dx, dy = col - cx, row - cy
      local dist = math.sqrt(dx * dx + dy * dy)
      local a = math.atan2(dy, dx)
      local spiral = (dist * 0.8 - a + angle) % (math.pi * 2)
      if spiral < math.pi * 0.8 then
        byte = byte + 2 ^ (7 - col)
      end
    end
    grid[row + 1] = byte
  end
  return grid
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("LEDMatrix", {
  visual = true,

  schema = {
    color     = { type = "string", default = "red",     desc = "LED color (red/green/blue/yellow/white/cyan/purple)" },
    pattern   = { type = "string", default = "cycle",   desc = "Pattern name or 'cycle' to auto-rotate" },
    speed     = { type = "number", default = 1.0,       desc = "Animation speed multiplier" },
    scrollText = { type = "string", default = "",       desc = "Text to scroll (for scroll pattern)" },
    showFrame = { type = "bool",   default = true,      desc = "Show matrix housing frame" },
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
    -- Rebuild scroll bitmap if text changed
    if props.pattern == "scroll" then
      local newText = (props.scrollText and props.scrollText ~= "") and props.scrollText or "HELLO "
      if not state.scrollBitmap or (prev and prev.scrollText ~= props.scrollText) then
        state.scrollBitmap = textToBitmap(newText)
        state.scrollOffset = 0
      end
    end
  end,

  destroy = function(nodeId, state) end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local speed = props.speed or 1
    state.time = state.time + dt * speed

    -- Cycle pattern every 2.5 seconds
    if (props.pattern or "cycle") == "cycle" then
      state.cycleTimer = state.cycleTimer + dt * speed
      if state.cycleTimer >= 2.5 then
        state.cycleTimer = state.cycleTimer - 2.5
        state.cycleIndex = (state.cycleIndex % #PATTERN_NAMES) + 1
      end
    end

    -- Advance scroll
    if props.pattern == "scroll" then
      state.scrollOffset = state.scrollOffset + dt * speed * 6
      if state.scrollBitmap then
        if state.scrollOffset >= #state.scrollBitmap then
          state.scrollOffset = 0
        end
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
    if w < 20 or h < 20 then return end

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

    -- Resolve current pattern
    local grid
    if patternName == "cycle" then
      local name = PATTERN_NAMES[state.cycleIndex]
      grid = PATTERNS[name]
    elseif patternName == "wave" then
      grid = generateWave(state.time)
    elseif patternName == "rain" then
      grid = generateRain(state.time)
    elseif patternName == "spiral" then
      grid = generateSpiral(state.time)
    elseif patternName == "scroll" then
      -- Build 8x8 from scroll bitmap at current offset
      if not state.scrollBitmap then
        state.scrollBitmap = textToBitmap(props.scrollText or "HELLO ")
      end
      grid = {}
      local bm = state.scrollBitmap
      local off = math.floor(state.scrollOffset)
      for row = 1, 8 do
        local byte = 0
        for col = 0, 7 do
          local srcCol = ((off + col) % #bm) + 1
          if bm[srcCol] and bm[srcCol][row] == 1 then
            byte = byte + 2 ^ (7 - col)
          end
        end
        grid[row] = byte
      end
    else
      grid = PATTERNS[patternName] or PATTERNS.smiley
    end

    -- Calculate LED sizes
    local matrixSize = math.min(w, h)
    local padding = showFrame and (matrixSize * 0.08) or 0
    local innerSize = matrixSize - padding * 2
    local cellSize = innerSize / 8
    local ledRadius = cellSize * 0.35
    local ox = x + (w - matrixSize) / 2
    local oy = y + (h - matrixSize) / 2

    -- Frame / housing
    if showFrame then
      love.graphics.setColor(0.10, 0.10, 0.12, opacity)
      love.graphics.rectangle("fill", ox, oy, matrixSize, matrixSize, 6, 6)
      love.graphics.setColor(0.15, 0.15, 0.18, opacity)
      love.graphics.rectangle("fill", ox + padding * 0.5, oy + padding * 0.5,
        matrixSize - padding, matrixSize - padding, 4, 4)
    end

    -- Draw 8x8 LEDs
    for row = 0, 7 do
      local byte = grid[row + 1] or 0
      for col = 0, 7 do
        local bit = math.floor(byte / (2 ^ (7 - col))) % 2
        local cx = ox + padding + col * cellSize + cellSize / 2
        local cy = oy + padding + row * cellSize + cellSize / 2

        if bit == 1 then
          -- LED on: glow + body + highlight
          love.graphics.setColor(lr, lg, lb, 0.10 * opacity)
          love.graphics.circle("fill", cx, cy, ledRadius * 2.2)
          love.graphics.setColor(lr, lg, lb, 0.25 * opacity)
          love.graphics.circle("fill", cx, cy, ledRadius * 1.5)
          love.graphics.setColor(lr, lg, lb, 0.85 * opacity)
          love.graphics.circle("fill", cx, cy, ledRadius)
          -- Specular highlight
          love.graphics.setColor(1, 1, 1, 0.35 * opacity)
          love.graphics.circle("fill", cx - ledRadius * 0.2, cy - ledRadius * 0.2, ledRadius * 0.3)
        else
          -- LED off: dim dot
          love.graphics.setColor(lr * 0.15, lg * 0.15, lb * 0.15, 0.5 * opacity)
          love.graphics.circle("fill", cx, cy, ledRadius)
        end
      end
    end
  end,
})

return {}
