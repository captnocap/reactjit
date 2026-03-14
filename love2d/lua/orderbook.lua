--[[
  orderbook.lua -- Lua-owned order book panel component

  Renders bid/ask depth rows in Lua to avoid per-row React tree churn under
  high-frequency updates. Optional level click events are buffered and drained
  once per frame (orderbook:select).
]]

local Color = require("lua.color")

local OrderBook = {}

local Measure = nil
local pendingEvents = {}

function OrderBook.init(config)
  Measure = config and config.measure or nil
end

local function getState(node)
  if not node._orderbook then
    node._orderbook = { rows = {} }
  end
  return node._orderbook
end

local function queueEvent(nodeId, eventType, value)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    value = value,
  }
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

local function compactNumber(v)
  local av = math.abs(v)
  if av >= 1e9 then return string.format("%.1fB", v * 1e-9) end
  if av >= 1e6 then return string.format("%.1fM", v * 1e-6) end
  if av >= 1e3 then return string.format("%.1fK", v * 1e-3) end
  return string.format("%.0f", v)
end

local function formatPrice(v)
  return string.format("%.2f", v)
end

local function formatBps(v)
  return string.format("%.2f bps", v)
end

local function normalizeLevel(level)
  if type(level) ~= "table" then return nil end
  local price = tonumber(level.price) or tonumber(level[1])
  local size = tonumber(level.size) or tonumber(level[2])
  if not price or not size then return nil end
  return { price = price, size = size }
end

local function collectAndSort(levels, depth, descending)
  local out = {}
  if type(levels) ~= "table" then return out end

  for i = 1, #levels do
    local n = normalizeLevel(levels[i])
    if n then out[#out + 1] = n end
  end

  table.sort(out, function(a, b)
    if descending then return a.price > b.price end
    return a.price < b.price
  end)

  if #out > depth then
    for i = #out, depth + 1, -1 do
      out[i] = nil
    end
  end
  return out
end

local function getProps(node)
  local props = node.props or {}
  local depth = math.floor(tonumber(props.depth) or 10)
  local rowHeight = math.floor(tonumber(props.rowHeight) or 18)
  local fontSize = math.floor(tonumber(props.fontSize) or 10)
  if depth < 1 then depth = 1 end
  if rowHeight < 12 then rowHeight = 12 end
  if fontSize < 8 then fontSize = 8 end
  return {
    bids = props.bids or {},
    asks = props.asks or {},
    depth = depth,
    rowHeight = rowHeight,
    fontSize = fontSize,
    showHeader = props.showHeader ~= false,
    title = tostring(props.title or "Order Book"),
    textColor = props.textColor or "#e2e8f0",
    mutedColor = props.mutedColor or "#94a3b8",
    bidColor = props.bidColor or "#22c55e",
    askColor = props.askColor or "#ef4444",
    bidTextColor = props.bidTextColor or "#86efac",
    askTextColor = props.askTextColor or "#fca5a5",
    bidBarColor = props.bidBarColor or "#22c55e",
    askBarColor = props.askBarColor or "#ef4444",
  }
end

local function drawRowText(x, y, w, price, size, priceColor, sizeColor, alpha)
  local pr, pg, pb, pa = parseColor(priceColor, "#ffffff")
  love.graphics.setColor(pr, pg, pb, pa * alpha)
  love.graphics.print(formatPrice(price), x + 4, y + 2)

  local sr, sg, sb, sa = parseColor(sizeColor, "#94a3b8")
  love.graphics.setColor(sr, sg, sb, sa * alpha)
  love.graphics.printf(compactNumber(size), x, y + 2, w - 4, "right")
end

local function drawLevelRow(x, y, w, h, level, maxSize, alignRight, barColor, priceColor, sizeColor, alpha)
  local frac = 0
  if maxSize > 0 then
    frac = clamp(level.size / maxSize, 0, 1)
  end

  local barW = w * frac
  local barX = alignRight and (x + w - barW) or x
  local br, bg, bb, ba = parseColor(barColor, "#64748b")
  love.graphics.setColor(br, bg, bb, ba * alpha * 0.18)
  love.graphics.rectangle("fill", barX, y, barW, h, 2, 2)

  drawRowText(x, y, w, level.price, level.size, priceColor, sizeColor, alpha)
end

function OrderBook.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  state.rows = {}

  local p = getProps(node)
  local bids = collectAndSort(p.bids, p.depth, true)
  local asks = collectAndSort(p.asks, p.depth, false)

  local maxSize = 1
  for i = 1, #bids do
    if bids[i].size > maxSize then maxSize = bids[i].size end
  end
  for i = 1, #asks do
    if asks[i].size > maxSize then maxSize = asks[i].size end
  end

  local bestBid = bids[1] and bids[1].price or 0
  local bestAsk = asks[1] and asks[1].price or 0
  local spread = bestAsk - bestBid
  local mid = (bestAsk + bestBid) * 0.5
  local spreadBps = (mid > 0) and (spread * (mid ^ -1) * 10000) or 0

  local font = Measure and Measure.getFont and Measure.getFont(p.fontSize) or nil
  if font then
    love.graphics.setFont(font)
  end

  local pad = 4
  local colGap = 8
  local colW = (c.w - pad * 2 - colGap) / 2
  local xBid = c.x + pad
  local xAsk = xBid + colW + colGap
  local y = c.y + pad

  local alpha = effectiveOpacity or 1

  if p.showHeader then
    local hr, hg, hb, ha = parseColor(p.textColor, "#e2e8f0")
    love.graphics.setColor(hr, hg, hb, ha * alpha)
    love.graphics.print(p.title, c.x + pad, y)
    local tr, tg, tb, ta = parseColor(p.mutedColor, "#94a3b8")
    love.graphics.setColor(tr, tg, tb, ta * alpha)
    love.graphics.printf(
      string.format("Spread %.2f (%s)", spread, formatBps(spreadBps)),
      c.x + pad, y, c.w - pad * 2, "right"
    )
    y = y + p.fontSize + 4
  end

  do
    local br, bg, bb, ba = parseColor(p.bidColor, "#22c55e")
    local ar, ag, ab, aa = parseColor(p.askColor, "#ef4444")
    love.graphics.setColor(br, bg, bb, ba * alpha)
    love.graphics.print("Bids", xBid, y)
    love.graphics.setColor(ar, ag, ab, aa * alpha)
    love.graphics.print("Asks", xAsk, y)
  end
  y = y + p.fontSize + 4

  local usableBottom = c.y + c.h - pad
  local maxRowsByHeight = math.floor((usableBottom - y) / p.rowHeight)
  local rowsToDraw = math.min(p.depth, math.max(0, maxRowsByHeight))

  for i = 1, rowsToDraw do
    local ry = y + (i - 1) * p.rowHeight
    local bid = bids[i]
    local ask = asks[i]

    if bid then
      drawLevelRow(xBid, ry, colW, p.rowHeight - 1, bid, maxSize, false, p.bidBarColor, p.bidTextColor, p.mutedColor, alpha)
      state.rows[#state.rows + 1] = {
        x = xBid, y = ry, w = colW, h = p.rowHeight,
        side = "bid", price = bid.price, size = bid.size, index = i,
      }
    end

    if ask then
      drawLevelRow(xAsk, ry, colW, p.rowHeight - 1, ask, maxSize, true, p.askBarColor, p.askTextColor, p.mutedColor, alpha)
      state.rows[#state.rows + 1] = {
        x = xAsk, y = ry, w = colW, h = p.rowHeight,
        side = "ask", price = ask.price, size = ask.size, index = i,
      }
    end
  end
end

function OrderBook.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  local state = getState(node)
  local rows = state.rows or {}
  for i = 1, #rows do
    local row = rows[i]
    if mx >= row.x and mx <= row.x + row.w and my >= row.y and my <= row.y + row.h then
      queueEvent(node.id, "orderbook:select", {
        side = row.side,
        price = row.price,
        size = row.size,
        index = row.index,
      })
      return true
    end
  end
  return false
end

function OrderBook.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return OrderBook
