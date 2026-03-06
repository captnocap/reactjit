--[[
  capabilities/phase_diagram.lua — Phase diagram visualization

  Renders pressure-temperature phase diagrams with phase boundaries, triple point,
  critical point, and labeled regions. Interactive: hover shows state at any T,P.

  React usage:
    <PhaseDiagram compound="H2O" />
    <PhaseDiagram compound="CO2" showCriticalPoint showTriplePoint />

  Props:
    compound          string   Compound formula (default: "H2O")
    showCriticalPoint boolean  Label critical point (default: true)
    showTriplePoint   boolean  Label triple point (default: true)
    temperature       number   Highlight current T (K) with crosshair
    pressure          number   Highlight current P (atm) with crosshair
]]

local Capabilities = require("lua.capabilities")

-- ============================================================================
-- Phase diagram data
-- Each compound: { tripleT, tripleP, critT, critP, boilT_1atm, meltT_1atm, ... }
-- Boundaries are cubic bezier-approximated for rendering
-- ============================================================================

local PHASE_DATA = {
  H2O = {
    name = "Water",
    tripleT = 273.16, tripleP = 0.006,
    critT = 647.1, critP = 218.0,
    boilT = 373.15, meltT = 273.15,
    -- Boundary curves: arrays of {T, P} for solid-liquid, liquid-gas, solid-gas
    solidLiquid = { {273.16, 0.006}, {273.15, 1}, {272, 100}, {270, 500}, {268, 1000} }, -- negative slope (anomalous)
    liquidGas   = { {273.16, 0.006}, {373.15, 1}, {453, 10}, {523, 40}, {593, 100}, {647.1, 218} },
    solidGas    = { {200, 0.0001}, {230, 0.001}, {260, 0.003}, {273.16, 0.006} },
    tRange = {150, 700}, pRange = {0.0001, 300},
  },
  CO2 = {
    name = "Carbon Dioxide",
    tripleT = 216.55, tripleP = 5.18,
    critT = 304.13, critP = 72.8,
    boilT = 194.65, meltT = 216.55,
    solidLiquid = { {216.55, 5.18}, {220, 10}, {240, 50}, {260, 200}, {280, 500}, {300, 1000} },
    liquidGas   = { {216.55, 5.18}, {240, 10}, {260, 20}, {280, 40}, {290, 55}, {304.13, 72.8} },
    solidGas    = { {140, 0.001}, {170, 0.01}, {190, 0.1}, {200, 0.5}, {210, 2}, {216.55, 5.18} },
    tRange = {130, 350}, pRange = {0.001, 500},
  },
  N2 = {
    name = "Nitrogen",
    tripleT = 63.15, tripleP = 0.125,
    critT = 126.2, critP = 33.5,
    boilT = 77.36, meltT = 63.15,
    solidLiquid = { {63.15, 0.125}, {64, 10}, {66, 100}, {70, 500}, {75, 1000} },
    liquidGas   = { {63.15, 0.125}, {77.36, 1}, {95, 5}, {110, 15}, {120, 25}, {126.2, 33.5} },
    solidGas    = { {40, 0.0001}, {50, 0.01}, {58, 0.05}, {63.15, 0.125} },
    tRange = {30, 150}, pRange = {0.0001, 100},
  },
}

-- ============================================================================
-- Log-scale helpers
-- ============================================================================

local function logMap(val, lo, hi, pixLo, pixHi)
  if val <= 0 then val = lo end
  local logVal = math.log10(val)
  local logLo = math.log10(lo)
  local logHi = math.log10(hi)
  return pixLo + (logVal - logLo) / (logHi - logLo) * (pixHi - pixLo)
end

local function linMap(val, lo, hi, pixLo, pixHi)
  return pixLo + (val - lo) / (hi - lo) * (pixHi - pixLo)
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("PhaseDiagram", {
  visual = true,

  schema = {
    compound          = { type = "string", default = "H2O", desc = "Compound formula" },
    showCriticalPoint = { type = "bool",   default = true },
    showTriplePoint   = { type = "bool",   default = true },
    temperature       = { type = "number", default = -1, desc = "Highlight T (K)" },
    pressure          = { type = "number", default = -1, desc = "Highlight P (atm)" },
  },

  events = {},
  create = function() return {} end,
  update = function() end,
  destroy = function() end,
  tick = function() end,

  render = function(node, c, opacity)
    local props = node.props or {}
    local compound = props.compound or "H2O"
    local data = PHASE_DATA[compound]

    local x, y, w, h = c.x, c.y, c.w, c.h
    local margin = 48
    local plotX = x + margin
    local plotY = y + 20
    local plotW = w - margin - 16
    local plotH = h - margin - 24

    if plotW <= 0 or plotH <= 0 then return end

    love.graphics.push("all")

    if not data then
      love.graphics.setColor(0.5, 0.5, 0.5, opacity)
      local font = love.graphics.getFont()
      local msg = "No phase data for " .. compound
      love.graphics.print(msg, x + w / 2 - font:getWidth(msg) / 2, y + h / 2)
      love.graphics.pop()
      return
    end

    local tRange = data.tRange
    local pRange = data.pRange

    local function tToX(t) return linMap(t, tRange[1], tRange[2], plotX, plotX + plotW) end
    local function pToY(p) return logMap(p, pRange[2], pRange[1], plotY, plotY + plotH) end

    -- Background
    love.graphics.setColor(0.06, 0.06, 0.08, opacity)
    love.graphics.rectangle("fill", plotX, plotY, plotW, plotH)

    -- Phase region labels
    love.graphics.setColor(0.25, 0.35, 0.55, opacity * 0.4)
    local font = love.graphics.getFont()
    local function drawRegionLabel(label, t, p)
      local lx = tToX(t)
      local ly = pToY(p)
      love.graphics.print(label, lx - font:getWidth(label) / 2, ly - 6)
    end

    -- Approximate region centers
    local midT = (tRange[1] + tRange[2]) / 2
    drawRegionLabel("SOLID", tRange[1] + (data.tripleT - tRange[1]) * 0.4, math.sqrt(pRange[1] * pRange[2]) * 3)
    drawRegionLabel("LIQUID", (data.tripleT + data.critT) / 2, data.critP * 0.3)
    drawRegionLabel("GAS", (data.critT + tRange[2]) / 2, pRange[1] * 10)

    -- Draw boundary curves
    local function drawCurve(pts, r, g, b)
      if #pts < 2 then return end
      love.graphics.setColor(r, g, b, opacity)
      love.graphics.setLineWidth(2)
      for i = 2, #pts do
        local x1, y1 = tToX(pts[i-1][1]), pToY(pts[i-1][2])
        local x2, y2 = tToX(pts[i][1]),   pToY(pts[i][2])
        love.graphics.line(x1, y1, x2, y2)
      end
    end

    drawCurve(data.solidLiquid, 0.4, 0.7, 1.0)  -- Blue: solid-liquid
    drawCurve(data.liquidGas,   0.4, 1.0, 0.5)   -- Green: liquid-gas
    drawCurve(data.solidGas,    1.0, 0.7, 0.3)    -- Orange: solid-gas

    -- Triple point
    if props.showTriplePoint ~= false then
      local tx, ty = tToX(data.tripleT), pToY(data.tripleP)
      love.graphics.setColor(1, 1, 0, opacity)
      love.graphics.circle("fill", tx, ty, 5)
      love.graphics.setColor(0.9, 0.9, 0.5, opacity * 0.8)
      love.graphics.print("Triple Point", tx + 8, ty - 6)
      local info = string.format("%.1f K, %.3f atm", data.tripleT, data.tripleP)
      love.graphics.setColor(0.6, 0.6, 0.4, opacity * 0.7)
      love.graphics.print(info, tx + 8, ty + 6)
    end

    -- Critical point
    if props.showCriticalPoint ~= false then
      local cx_pt, cy_pt = tToX(data.critT), pToY(data.critP)
      love.graphics.setColor(1, 0.3, 0.3, opacity)
      love.graphics.circle("fill", cx_pt, cy_pt, 5)
      love.graphics.setColor(0.9, 0.5, 0.5, opacity * 0.8)
      love.graphics.print("Critical Point", cx_pt + 8, cy_pt - 6)
      local info = string.format("%.1f K, %.1f atm", data.critT, data.critP)
      love.graphics.setColor(0.6, 0.4, 0.4, opacity * 0.7)
      love.graphics.print(info, cx_pt + 8, cy_pt + 6)
    end

    -- Highlight crosshair
    local hlT = props.temperature or -1
    local hlP = props.pressure or -1
    if hlT > 0 and hlP > 0 then
      local hx, hy = tToX(hlT), pToY(hlP)
      love.graphics.setColor(1, 1, 1, opacity * 0.3)
      love.graphics.setLineWidth(1)
      love.graphics.line(hx, plotY, hx, plotY + plotH)
      love.graphics.line(plotX, hy, plotX + plotW, hy)
      love.graphics.setColor(1, 1, 1, opacity)
      love.graphics.circle("fill", hx, hy, 4)
    end

    -- Axes
    love.graphics.setColor(0.5, 0.5, 0.5, opacity)
    love.graphics.setLineWidth(1)
    love.graphics.line(plotX, plotY, plotX, plotY + plotH)
    love.graphics.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH)

    -- X axis (Temperature) tick labels
    love.graphics.setColor(0.5, 0.5, 0.5, opacity * 0.8)
    for i = 0, 5 do
      local t = tRange[1] + (tRange[2] - tRange[1]) * i / 5
      local gx = tToX(t)
      local txt = tostring(math.floor(t))
      love.graphics.print(txt, gx - font:getWidth(txt) / 2, plotY + plotH + 4)
    end

    -- X label
    local xLabel = "Temperature (K)"
    love.graphics.print(xLabel, plotX + plotW / 2 - font:getWidth(xLabel) / 2, y + h - 14)

    -- Y axis (Pressure, log scale) tick labels
    local pLo = math.floor(math.log10(pRange[1]))
    local pHi = math.ceil(math.log10(pRange[2]))
    for exp = pLo, pHi do
      local p = math.pow(10, exp)
      if p >= pRange[1] and p <= pRange[2] then
        local gy = pToY(p)
        local txt
        if exp >= 0 then txt = tostring(math.floor(p))
        else txt = string.format("%.0e", p) end
        love.graphics.print(txt, plotX - font:getWidth(txt) - 4, gy - 6)
        -- Grid line
        love.graphics.setColor(0.2, 0.2, 0.25, opacity * 0.3)
        love.graphics.line(plotX, gy, plotX + plotW, gy)
        love.graphics.setColor(0.5, 0.5, 0.5, opacity * 0.8)
      end
    end

    -- Y label
    love.graphics.push()
    love.graphics.translate(x + 4, plotY + plotH / 2 + font:getWidth("Pressure (atm)") / 2)
    love.graphics.rotate(-math.pi / 2)
    love.graphics.print("Pressure (atm)", 0, 0)
    love.graphics.pop()

    -- Title
    love.graphics.setColor(0.8, 0.8, 0.8, opacity)
    local title = (data.name or compound) .. " Phase Diagram"
    love.graphics.print(title, plotX + 4, plotY + 4)

    love.graphics.pop()
  end,
})
