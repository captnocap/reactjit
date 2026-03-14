--[[
  capabilities/pcb_board.lua — PCB board visualization

  Renders a stylized printed circuit board with IC chips, pin headers,
  passive components, copper traces, and a blinking power LED.

  React usage:
    <Native type="PCBBoard" />
    <Native type="PCBBoard" showLabels={false} ledColor="red" />
]]

local Capabilities = require("lua.capabilities")

-- ============================================================================
-- Visual constants
-- ============================================================================

-- PCB green
local PCB_BG     = {0.05, 0.30, 0.12, 1}
local PCB_EDGE   = {0.03, 0.22, 0.09, 1}
local SILK       = {0.85, 0.85, 0.80, 0.9}   -- silkscreen white
local COPPER     = {0.72, 0.55, 0.20, 1}      -- copper traces
local GOLD       = {0.85, 0.72, 0.20, 1}      -- pads
local IC_BODY    = {0.12, 0.12, 0.14, 1}      -- IC package
local IC_MARK    = {0.30, 0.30, 0.32, 1}      -- IC notch
local SOLDER     = {0.60, 0.60, 0.58, 1}      -- solder joints
local RESIST_R   = {0.65, 0.20, 0.15, 1}      -- resistor body
local CAP_BLUE   = {0.15, 0.25, 0.65, 1}      -- ceramic cap
local LED_OFF    = {0.25, 0.08, 0.08, 1}      -- LED off
local VIA_HOLE   = {0.02, 0.02, 0.03, 1}      -- via holes

-- ============================================================================
-- Drawing helpers
-- ============================================================================

local function setColor(c, opacity)
  love.graphics.setColor(c[1], c[2], c[3], (c[4] or 1) * (opacity or 1))
end

local function drawRoundRect(x, y, w, h, r)
  love.graphics.rectangle("fill", x, y, w, h, r, r)
end

local function drawPad(cx, cy, size)
  love.graphics.circle("fill", cx, cy, size)
end

local function drawIC(x, y, w, h, label, pinCount, opacity)
  -- Body
  setColor(IC_BODY, opacity)
  drawRoundRect(x, y, w, h, 2)

  -- Pin 1 notch
  setColor(IC_MARK, opacity)
  love.graphics.circle("fill", x + 6, y + 6, 3)

  -- Pins on left and right
  local pinsPerSide = math.floor(pinCount / 2)
  local pinSpacing = (h - 8) / math.max(1, pinsPerSide - 1)
  setColor(SOLDER, opacity)
  for i = 0, pinsPerSide - 1 do
    local py = y + 4 + i * pinSpacing
    -- Left pins
    love.graphics.rectangle("fill", x - 4, py, 6, 2)
    -- Right pins
    love.graphics.rectangle("fill", x + w - 2, py, 6, 2)
  end

  -- Label
  if label then
    setColor(SILK, opacity)
    local font = love.graphics.getFont()
    local tw = font:getWidth(label)
    love.graphics.print(label, x + (w - tw) / 2, y + h / 2 - 5)
  end
end

local function drawResistor(x, y, opacity)
  -- Body
  setColor(RESIST_R, opacity)
  drawRoundRect(x, y, 18, 8, 2)
  -- Leads
  setColor(SOLDER, opacity)
  love.graphics.rectangle("fill", x - 4, y + 3, 5, 2)
  love.graphics.rectangle("fill", x + 17, y + 3, 5, 2)
  -- Color bands
  love.graphics.setColor(0.8, 0.6, 0.1, opacity)
  love.graphics.rectangle("fill", x + 3, y, 2, 8)
  love.graphics.setColor(0.1, 0.1, 0.1, opacity)
  love.graphics.rectangle("fill", x + 7, y, 2, 8)
  love.graphics.setColor(0.8, 0.1, 0.1, opacity)
  love.graphics.rectangle("fill", x + 11, y, 2, 8)
  love.graphics.setColor(0.85, 0.72, 0.2, opacity)
  love.graphics.rectangle("fill", x + 14, y, 2, 8)
end

local function drawCapacitor(x, y, opacity)
  setColor(CAP_BLUE, opacity)
  love.graphics.circle("fill", x + 5, y + 5, 5)
  -- Leads
  setColor(SOLDER, opacity)
  love.graphics.rectangle("fill", x + 4, y - 3, 2, 4)
  love.graphics.rectangle("fill", x + 4, y + 9, 2, 4)
  -- Label
  setColor(SILK, opacity * 0.7)
  love.graphics.print("C", x + 2, y + 1)
end

local function drawPinHeader(x, y, rows, cols, opacity)
  local pitch = 8
  for r = 0, rows - 1 do
    for col = 0, cols - 1 do
      local px = x + col * pitch
      local py = y + r * pitch
      -- Gold pad
      setColor(GOLD, opacity)
      drawPad(px, py, 3)
      -- Hole
      setColor(VIA_HOLE, opacity)
      drawPad(px, py, 1.5)
    end
  end
end

local function drawTrace(points, width, opacity)
  setColor(COPPER, opacity)
  love.graphics.setLineWidth(width or 2)
  if #points >= 4 then
    love.graphics.line(points)
  end
  love.graphics.setLineWidth(1)
end

local function drawVia(x, y, opacity)
  setColor(COPPER, opacity)
  love.graphics.circle("fill", x, y, 3.5)
  setColor(VIA_HOLE, opacity)
  love.graphics.circle("fill", x, y, 1.5)
end

local function drawLED(x, y, r, color, on, opacity)
  local cr, cg, cb = 1, 0, 0
  if color == "green" then cr, cg, cb = 0, 1, 0.2
  elseif color == "blue" then cr, cg, cb = 0.2, 0.4, 1
  elseif color == "yellow" then cr, cg, cb = 1, 0.8, 0
  elseif color == "white" then cr, cg, cb = 1, 1, 1 end

  if on then
    -- Glow
    love.graphics.setColor(cr, cg, cb, 0.15 * opacity)
    love.graphics.circle("fill", x, y, r * 3)
    love.graphics.setColor(cr, cg, cb, 0.3 * opacity)
    love.graphics.circle("fill", x, y, r * 2)
    -- LED body
    love.graphics.setColor(cr, cg, cb, 0.9 * opacity)
    love.graphics.circle("fill", x, y, r)
    -- Highlight
    love.graphics.setColor(1, 1, 1, 0.4 * opacity)
    love.graphics.circle("fill", x - r * 0.25, y - r * 0.25, r * 0.35)
  else
    setColor(LED_OFF, opacity)
    love.graphics.circle("fill", x, y, r)
  end
  -- Leads
  setColor(SOLDER, opacity)
  love.graphics.rectangle("fill", x - 1, y + r + 1, 2, 4)
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("PCBBoard", {
  visual = true,

  schema = {
    showLabels = { type = "bool",   default = true,  desc = "Show component reference designators" },
    ledColor   = { type = "string", default = "green", desc = "Power LED color (red/green/blue/yellow/white)" },
    ledBlink   = { type = "bool",   default = true,  desc = "Blink the power LED" },
  },

  events = {},

  create = function(nodeId, props)
    return { time = 0 }
  end,

  update = function(nodeId, props, prev, state) end,

  destroy = function(nodeId, state) end,

  tick = function(nodeId, state, dt, pushEvent, props)
    state.time = state.time + dt
  end,

  render = function(node, c, opacity)
    local inst = Capabilities._instances and Capabilities._instances[node.id]
    if not inst then return end
    local state = inst.state
    local props = inst.props or {}

    local x, y = c.x, c.y
    local w, h = c.w, c.h
    if w < 10 or h < 10 then return end

    local showLabels = props.showLabels ~= false
    local ledColor = props.ledColor or "green"
    local ledBlink = props.ledBlink ~= false

    -- Scale everything relative to the node size
    local scale = math.min(w / 300, h / 200)
    love.graphics.push()
    love.graphics.translate(x, y)
    love.graphics.scale(scale, scale)

    local bw, bh = 300, 200

    -- PCB body with edge outline
    setColor(PCB_EDGE, opacity)
    drawRoundRect(-2, -2, bw + 4, bh + 4, 6)
    setColor(PCB_BG, opacity)
    drawRoundRect(0, 0, bw, bh, 5)

    -- Mounting holes (corners)
    setColor(VIA_HOLE, opacity)
    for _, pos in ipairs({{12, 12}, {bw - 12, 12}, {12, bh - 12}, {bw - 12, bh - 12}}) do
      love.graphics.circle("fill", pos[1], pos[2], 4)
      setColor(COPPER, opacity)
      love.graphics.circle("line", pos[1], pos[2], 5.5)
      setColor(VIA_HOLE, opacity)
    end

    -- Copper traces — main bus
    drawTrace({20, 50, 80, 50, 80, 80, 130, 80}, 2.5, opacity)
    drawTrace({130, 80, 130, 50, 170, 50}, 2, opacity)
    drawTrace({170, 70, 220, 70, 220, 120}, 2, opacity)
    drawTrace({80, 80, 80, 130, 40, 130}, 1.5, opacity)
    drawTrace({130, 80, 130, 140, 180, 140}, 2, opacity)
    drawTrace({220, 120, 260, 120, 260, 160}, 1.5, opacity)
    drawTrace({40, 130, 40, 160, 80, 160}, 1.5, opacity)

    -- Vias
    drawVia(80, 80, opacity)
    drawVia(130, 80, opacity)
    drawVia(220, 120, opacity)
    drawVia(40, 130, opacity)

    -- IC chip U1 (main microcontroller)
    drawIC(100, 40, 60, 50, "ATmega", 16, opacity)

    -- IC chip U2 (smaller, voltage regulator)
    drawIC(200, 40, 40, 30, "7805", 8, opacity)

    -- Resistors
    drawResistor(30, 60, opacity)
    drawResistor(30, 80, opacity)
    drawResistor(200, 100, opacity)

    -- Capacitors
    drawCapacitor(170, 85, opacity)
    drawCapacitor(245, 85, opacity)
    drawCapacitor(85, 110, opacity)

    -- Pin headers
    drawPinHeader(20, 140, 2, 8, opacity)  -- J1: GPIO header
    drawPinHeader(240, 140, 2, 4, opacity)  -- J2: power header
    drawPinHeader(260, 40, 6, 1, opacity)   -- J3: serial header

    -- Power LED
    local ledOn = true
    if ledBlink then
      ledOn = math.sin(state.time * 3) > 0
    end
    drawLED(270, 100, 5, ledColor, ledOn, opacity)

    -- Silkscreen labels
    if showLabels then
      setColor(SILK, opacity * 0.8)
      local font = love.graphics.getFont()
      love.graphics.print("U1", 115, 92)
      love.graphics.print("U2", 208, 72)
      love.graphics.print("R1", 32, 52)
      love.graphics.print("R2", 32, 72)
      love.graphics.print("R3", 202, 92)
      love.graphics.print("C1", 178, 85)
      love.graphics.print("C2", 252, 78)
      love.graphics.print("C3", 92, 108)
      love.graphics.print("J1", 20, 162)
      love.graphics.print("J2", 240, 162)
      love.graphics.print("J3", 265, 32)
      love.graphics.print("PWR", 258, 110)

      -- Board title
      setColor(SILK, opacity * 0.6)
      love.graphics.print("ReactJIT GPIO v1.0", 80, bh - 18)
    end

    love.graphics.pop()
  end,
})

return {}
