--[[
  portfolio_card.lua -- Lua-owned portfolio summary card renderer
]]

local Color = require("lua.color")

local PortfolioCard = {}

local Measure = nil

function PortfolioCard.init(config)
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

local function drawHoldingRow(x, y, w, holding, palette, currency, alpha)
  local symbol = tostring(holding.symbol or "N/A")
  local quantity = tonumber(holding.quantity) or 0
  local avgCost = tonumber(holding.avgCost) or 0
  local currentPrice = tonumber(holding.currentPrice) or 0
  local totalCost = quantity * avgCost
  local marketValue = quantity * currentPrice
  local pnl = marketValue - totalCost
  local pnlPercent = totalCost > 0 and (pnl * (totalCost ^ -1) * 100) or 0
  local pnlColor = pnl >= 0 and palette.gain or palette.loss

  local symbolFont = getFont(11, "bold")
  local detailFont = getFont(9)
  local valueFont = getFont(11)
  local pnlFont = getFont(9)

  local tr, tg, tb, ta = parseColor(palette.text, "#e2e8f0")
  local mr, mg, mb, ma = parseColor(palette.muted, "#94a3b8")
  local pr, pg, pb, pa = parseColor(pnlColor, "#22c55e")

  love.graphics.setFont(symbolFont)
  love.graphics.setColor(tr, tg, tb, ta * alpha)
  love.graphics.print(symbol, x, y)

  love.graphics.setFont(detailFont)
  love.graphics.setColor(mr, mg, mb, ma * alpha)
  love.graphics.print(string.format("%g @ %s", quantity, formatMoney(avgCost, currency)), x + 46, y + 1)

  love.graphics.setFont(valueFont)
  love.graphics.setColor(tr, tg, tb, ta * alpha)
  love.graphics.printf(formatMoney(marketValue, currency), x, y, w, "right")

  love.graphics.setFont(pnlFont)
  love.graphics.setColor(pr, pg, pb, pa * alpha)
  love.graphics.printf(
    string.format("%s (%s)", formatMoney(pnl, currency), formatPercent(pnlPercent)),
    x, y + 11, w, "right"
  )
end

function PortfolioCard.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local props = node.props or {}
  local snapshot = type(props.snapshot) == "table" and props.snapshot or {}
  local holdings = type(snapshot.holdings) == "table" and snapshot.holdings or {}
  local currency = tostring(props.currency or "$")
  local alpha = effectiveOpacity or 1

  local palette = {
    text = props.textColor or "#e2e8f0",
    muted = props.mutedColor or "#94a3b8",
    surface = props.surfaceColor or "#0f172a",
    border = props.borderColor or "#334155",
    gain = props.gainColor or "#22c55e",
    loss = props.lossColor or "#ef4444",
  }

  local sr, sg, sb, sa = parseColor(palette.surface, "#0f172a")
  local br, bg, bb, ba = parseColor(palette.border, "#334155")
  local tr, tg, tb, ta = parseColor(palette.text, "#e2e8f0")
  local mr, mg, mb, ma = parseColor(palette.muted, "#94a3b8")
  local pr, pg, pb, pa = parseColor((tonumber(snapshot.pnl) or 0) >= 0 and palette.gain or palette.loss, palette.gain)

  local pad = 12
  love.graphics.setColor(sr, sg, sb, sa * alpha)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, 8, 8)
  love.graphics.setColor(br, bg, bb, ba * alpha)
  love.graphics.rectangle("line", c.x, c.y, c.w, c.h, 8, 8)

  local titleFont = getFont(11)
  local valueFont = getFont(18, "bold")
  local smallLabelFont = getFont(10)
  local smallValueFont = getFont(13, "bold")

  local x = c.x + pad
  local y = c.y + pad
  local w = c.w - pad * 2

  love.graphics.setFont(titleFont)
  love.graphics.setColor(mr, mg, mb, ma * alpha)
  love.graphics.print("Portfolio Value", x, y)

  love.graphics.setFont(valueFont)
  love.graphics.setColor(tr, tg, tb, ta * alpha)
  love.graphics.printf(formatMoney(snapshot.totalValue or 0, currency), x, y - 2, w, "right")
  y = y + 24

  local colW = w * (1 / 3)
  local labels = { "P&L", "Return", "Cost Basis" }
  local values = {
    formatMoney(snapshot.pnl or 0, currency),
    formatPercent(snapshot.pnlPercent or 0),
    formatMoney(snapshot.totalCost or 0, currency),
  }

  for i = 1, 3 do
    local cx = x + (i - 1) * colW
    love.graphics.setFont(smallLabelFont)
    love.graphics.setColor(mr, mg, mb, ma * alpha)
    love.graphics.print(labels[i], cx, y)

    love.graphics.setFont(smallValueFont)
    if i <= 2 then
      love.graphics.setColor(pr, pg, pb, pa * alpha)
    else
      love.graphics.setColor(tr, tg, tb, ta * alpha)
    end
    love.graphics.print(values[i], cx, y + 11)
  end
  y = y + 28

  if #holdings > 0 then
    y = y + 8
    local rowH = 28
    for i = 1, #holdings do
      local ry = y + (i - 1) * rowH
      if ry + rowH > c.y + c.h - pad then break end
      if i > 1 then
        love.graphics.setColor(br, bg, bb, ba * alpha)
        love.graphics.line(x, ry - 2, x + w, ry - 2)
      end
      drawHoldingRow(x, ry, w, holdings[i], palette, currency, alpha)
    end
  end
end

return PortfolioCard
