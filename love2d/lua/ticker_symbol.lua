--[[
  ticker_symbol.lua -- Lua-owned ticker symbol renderer
]]

local Color = require("lua.color")

local TickerSymbol = {}

local Measure = nil

function TickerSymbol.init(config)
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

local function getFont(size, weight)
  if Measure and Measure.getFont then
    local font = select(1, Measure.getFont(size, nil, weight))
    if font then return font end
  end
  return love.graphics.getFont()
end

local function formatPrice(v)
  local av = math.abs(v)
  if av >= 1 then return string.format("$%.2f", v) end
  if av >= 0.01 then return string.format("$%.4f", v) end
  return string.format("$%.6f", v)
end

local function formatPercent(v)
  if v >= 0 then return string.format("+%.2f%%", v) end
  return string.format("%.2f%%", v)
end

local function drawSparkline(points, x, y, w, h, color, alpha)
  if type(points) ~= "table" or #points < 2 then return end

  local minv = tonumber(points[1]) or 0
  local maxv = minv
  for i = 2, #points do
    local v = tonumber(points[i]) or minv
    if v < minv then minv = v end
    if v > maxv then maxv = v end
  end
  local range = maxv - minv
  local invRange = range > 0 and (range ^ -1) or 0
  local invCount = (#points > 1) and ((#points - 1) ^ -1) or 0

  local r, g, b, a = parseColor(color, "#22c55e")
  love.graphics.setColor(r, g, b, a * alpha)
  love.graphics.setLineWidth(1)

  local prevX, prevY = nil, nil
  for i = 1, #points do
    local raw = tonumber(points[i]) or minv
    local norm = range > 0 and ((raw - minv) * invRange) or 0.5
    local px = x + (i - 1) * invCount * (w - 1)
    local py = y + (1 - norm) * (h - 1)
    if prevX ~= nil then
      love.graphics.line(prevX, prevY, px, py)
    end
    prevX, prevY = px, py
  end
end

function TickerSymbol.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local props = node.props or {}
  local item = type(props.item) == "table" and props.item or {}
  local symbol = tostring(item.symbol or "N/A")
  local price = tonumber(item.price) or 0
  local change = tonumber(item.change) or 0
  local sparkline = type(item.sparkline) == "table" and item.sparkline or nil

  local showSparkline = props.showSparkline ~= false
  local symbolSize = math.floor(tonumber(props.symbolSize) or 11)
  local priceSize = math.floor(tonumber(props.priceSize) or 11)
  local changeSize = math.floor(tonumber(props.changeSize) or 10)
  local textColor = props.textColor or "#e2e8f0"
  local moveColor = change >= 0 and (props.upColor or "#22c55e") or (props.downColor or "#ef4444")
  local alpha = effectiveOpacity or 1

  local symbolFont = getFont(symbolSize, "bold")
  local priceFont = getFont(priceSize)
  local changeFont = getFont(changeSize)

  local sparkW = (showSparkline and sparkline and #sparkline > 1) and 32 or 0
  local sparkGap = sparkW > 0 and 6 or 0
  local priceText = formatPrice(price)
  local changeText = formatPercent(change)

  local symbolH = symbolFont:getHeight()
  local priceH = priceFont:getHeight()
  local changeH = changeFont:getHeight()
  local textH = math.max(symbolH, math.max(priceH, changeH))
  local y = c.y + (c.h - textH) * 0.5
  local x = c.x

  local tr, tg, tb, ta = parseColor(textColor, "#e2e8f0")
  local mr, mg, mb, ma = parseColor(moveColor, "#22c55e")

  love.graphics.setFont(symbolFont)
  love.graphics.setColor(tr, tg, tb, ta * alpha)
  love.graphics.print(symbol, x, y + (textH - symbolH) * 0.5)
  x = x + symbolFont:getWidth(symbol)

  if sparkW > 0 then
    x = x + sparkGap
    drawSparkline(sparkline, x, c.y + (c.h - 12) * 0.5, sparkW, 12, moveColor, alpha)
    x = x + sparkW
  end

  x = x + 6
  love.graphics.setFont(priceFont)
  love.graphics.setColor(mr, mg, mb, ma * alpha)
  love.graphics.print(priceText, x, y + (textH - priceH) * 0.5)
  x = x + priceFont:getWidth(priceText) + 6

  love.graphics.setFont(changeFont)
  love.graphics.setColor(mr, mg, mb, ma * alpha)
  love.graphics.print(changeText, x, y + (textH - changeH) * 0.5)
end

return TickerSymbol
