--[[
  holding_row.lua -- Lua-owned holding row renderer
]]

local Color = require("lua.color")

local HoldingRow = {}

local Measure = nil

function HoldingRow.init(config)
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

local function formatMoney(value, currency)
  return string.format("%s%.2f", currency or "$", tonumber(value) or 0)
end

local function formatPercent(value)
  local n = tonumber(value) or 0
  if n >= 0 then return string.format("+%.2f%%", n) end
  return string.format("%.2f%%", n)
end

function HoldingRow.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local props = node.props or {}
  local holding = type(props.holding) == "table" and props.holding or {}
  local currency = tostring(props.currency or "$")

  local symbol = tostring(holding.symbol or "N/A")
  local quantity = tonumber(holding.quantity) or 0
  local avgCost = tonumber(holding.avgCost) or 0
  local currentPrice = tonumber(holding.currentPrice) or 0
  local totalCost = quantity * avgCost
  local marketValue = quantity * currentPrice
  local pnl = marketValue - totalCost
  local pnlPercent = totalCost > 0 and (pnl * (totalCost ^ -1) * 100) or 0
  local pnlColor = pnl >= 0 and (props.gainColor or "#22c55e") or (props.lossColor or "#ef4444")

  local textColor = props.textColor or "#e2e8f0"
  local mutedColor = props.mutedColor or "#94a3b8"
  local alpha = effectiveOpacity or 1

  local symbolFont = getFont(12, "bold")
  local detailFont = getFont(10)
  local valueFont = getFont(12)
  local pnlFont = getFont(10)

  local leftW = 50
  local pad = 2
  local leftX = c.x + pad
  local midX = c.x + leftW + 8
  local rightX = c.x + c.w - pad
  local yTop = c.y + 2
  local yBot = c.y + c.h - pnlFont:getHeight() - 2

  local tr, tg, tb, ta = parseColor(textColor, "#e2e8f0")
  local mr, mg, mb, ma = parseColor(mutedColor, "#94a3b8")
  local pr, pg, pb, pa = parseColor(pnlColor, "#22c55e")

  love.graphics.setFont(symbolFont)
  love.graphics.setColor(tr, tg, tb, ta * alpha)
  love.graphics.print(symbol, leftX, yTop)

  love.graphics.setFont(detailFont)
  love.graphics.setColor(mr, mg, mb, ma * alpha)
  love.graphics.print(string.format("%g @ %s", quantity, formatMoney(avgCost, currency)), midX, yTop + 2)

  love.graphics.setFont(valueFont)
  love.graphics.setColor(tr, tg, tb, ta * alpha)
  love.graphics.printf(formatMoney(marketValue, currency), c.x, yTop, rightX - c.x, "right")

  love.graphics.setFont(pnlFont)
  love.graphics.setColor(pr, pg, pb, pa * alpha)
  love.graphics.printf(
    string.format("%s (%s)", formatMoney(pnl, currency), formatPercent(pnlPercent)),
    c.x, yBot, rightX - c.x, "right"
  )
end

return HoldingRow
