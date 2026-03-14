--[[
  rsigauge.lua -- Lua-owned RSI gauge renderer
]]

local Color = require("lua.color")

local RSIGauge = {}

local Measure = nil

function RSIGauge.init(config)
  Measure = config and config.measure or nil
end

local function parseColor(value, fallback)
  local r, g, b, a = Color.parse(value)
  if r ~= nil then return r, g, b, a end
  if fallback ~= nil then
    local fr, fg, fb, fa = Color.parse(fallback)
    if fr ~= nil then return fr, fg, fb, fa end
  end
  return 1, 1, 1, 1
end

local function clamp(v, minv, maxv)
  if v < minv then return minv end
  if v > maxv then return maxv end
  return v
end

local function getFont(size, weight)
  if Measure and Measure.getFont then
    local font = select(1, Measure.getFont(size, nil, weight))
    if font then return font end
  end
  return love.graphics.getFont()
end

local function zoneColorAndLabel(value, textColor, overboughtColor, oversoldColor)
  if value >= 70 then return overboughtColor, "Overbought" end
  if value <= 30 then return oversoldColor, "Oversold" end
  return textColor, "Neutral"
end

function RSIGauge.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local props = node.props or {}
  local value = tonumber(props.value) or 50
  local pct = clamp(value, 0, 100) * 0.01

  local textColor = props.textColor or "#e2e8f0"
  local mutedColor = props.mutedColor or "#94a3b8"
  local barBgColor = props.barBgColor or "#334155"
  local overboughtColor = props.overboughtColor or "#ef4444"
  local oversoldColor = props.oversoldColor or "#22c55e"
  local gaugeColor, zone = zoneColorAndLabel(value, textColor, overboughtColor, oversoldColor)

  local alpha = effectiveOpacity or 1

  local labelFont = getFont(10)
  local valueFont = getFont(11, "bold")
  local zoneFont = getFont(9)

  local pad = 2
  local y = c.y + pad

  love.graphics.setFont(labelFont)
  local mr, mg, mb, ma = parseColor(mutedColor, "#94a3b8")
  love.graphics.setColor(mr, mg, mb, ma * alpha)
  love.graphics.print("RSI(14)", c.x, y)

  love.graphics.setFont(valueFont)
  local cr, cg, cb, ca = parseColor(gaugeColor, "#e2e8f0")
  love.graphics.setColor(cr, cg, cb, ca * alpha)
  love.graphics.printf(string.format("%.1f", value), c.x, y, c.w, "right")
  y = y + math.max(labelFont:getHeight(), valueFont:getHeight()) + 3

  local barH = 6
  local bgr, bgg, bgb, bga = parseColor(barBgColor, "#334155")
  love.graphics.setColor(bgr, bgg, bgb, bga * alpha)
  love.graphics.rectangle("fill", c.x, y, c.w, barH, 3, 3)

  love.graphics.setColor(cr, cg, cb, ca * alpha)
  love.graphics.rectangle("fill", c.x, y, c.w * pct, barH, 3, 3)
  y = y + barH + 3

  love.graphics.setFont(zoneFont)
  love.graphics.setColor(cr, cg, cb, ca * alpha)
  love.graphics.print(zone, c.x, y)
end

return RSIGauge
