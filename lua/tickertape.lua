--[[
  tickertape.lua -- Lua-owned horizontal ticker tape

  Renders symbol / sparkline / price / change in Lua and handles drag-scroll
  directly for low-latency interaction under high-frequency updates.
]]

local Color = require("lua.color")

local TickerTape = {}

local Measure = nil
local pendingEvents = {}

function TickerTape.init(config)
  Measure = config and config.measure or nil
end

local function getState(node)
  if not node._tickertape then
    node._tickertape = {
      scrollX = 0,
      contentWidth = 0,
      itemRects = {},
      isDragging = false,
      dragAnchorX = 0,
      dragStartScroll = 0,
      moved = false,
      pressCandidate = nil,
    }
  end
  return node._tickertape
end

local function queueEvent(nodeId, eventType, value)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    value = value,
  }
end

local function clamp(v, minv, maxv)
  if v < minv then return minv end
  if v > maxv then return maxv end
  return v
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

  local minv = points[1]
  local maxv = points[1]
  for i = 2, #points do
    local v = tonumber(points[i]) or points[1]
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

local function normalizeItem(item, idx)
  if type(item) ~= "table" then
    return {
      symbol = "N/A",
      price = 0,
      change = 0,
      sparkline = nil,
      index = idx,
    }
  end

  return {
    symbol = tostring(item.symbol or "N/A"),
    price = tonumber(item.price) or 0,
    change = tonumber(item.change) or 0,
    sparkline = type(item.sparkline) == "table" and item.sparkline or nil,
    index = idx,
  }
end

local function getProps(node)
  local props = node.props or {}
  local gap = math.floor(tonumber(props.gap) or 20)
  local height = math.floor(tonumber(props.height) or 24)
  local symbolSize = math.floor(tonumber(props.symbolSize) or 11)
  local priceSize = math.floor(tonumber(props.priceSize) or 11)
  local changeSize = math.floor(tonumber(props.changeSize) or 10)

  if gap < 4 then gap = 4 end
  if height < 16 then height = 16 end
  if symbolSize < 8 then symbolSize = 8 end
  if priceSize < 8 then priceSize = 8 end
  if changeSize < 8 then changeSize = 8 end

  return {
    items = props.items or {},
    gap = gap,
    height = height,
    symbolSize = symbolSize,
    priceSize = priceSize,
    changeSize = changeSize,
    textColor = props.textColor or "#e2e8f0",
    bgColor = props.bgColor or "#020617",
    borderColor = props.borderColor or "#1e293b",
    upColor = props.upColor or "#22c55e",
    downColor = props.downColor or "#ef4444",
    showSparkline = props.showSparkline ~= false,
  }
end

local function maxScroll(state, c)
  local m = state.contentWidth - c.w
  if m < 0 then return 0 end
  return m
end

function TickerTape.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local state = getState(node)
  local p = getProps(node)

  local alpha = effectiveOpacity or 1
  local bgr, bgg, bgb, bga = parseColor(p.bgColor, "#020617")
  local bor, bog, bob, boa = parseColor(p.borderColor, "#1e293b")

  love.graphics.setColor(bgr, bgg, bgb, bga * alpha)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)
  love.graphics.setColor(bor, bog, bob, boa * alpha)
  love.graphics.line(c.x, c.y + c.h - 0.5, c.x + c.w, c.y + c.h - 0.5)

  local oldSX, oldSY, oldSW, oldSH = love.graphics.getScissor()
  love.graphics.setScissor(c.x, c.y, c.w, c.h)

  local symbolFont = getFont(p.symbolSize, "bold")
  local priceFont = getFont(p.priceSize)
  local changeFont = getFont(p.changeSize)
  local textR, textG, textB, textA = parseColor(p.textColor, "#e2e8f0")

  local x = c.x + 8 - state.scrollX
  local contentWidth = 16
  state.itemRects = {}

  local symbolH = symbolFont:getHeight()
  local priceH = priceFont:getHeight()
  local changeH = changeFont:getHeight()
  local textH = math.max(symbolH, math.max(priceH, changeH))
  local rowY = c.y + (c.h - textH) * 0.5
  local sparkH = 12
  local sparkY = c.y + (c.h - sparkH) * 0.5

  for i = 1, #p.items do
    local item = normalizeItem(p.items[i], i)
    local priceText = formatPrice(item.price)
    local changeText = formatPercent(item.change)
    local up = item.change >= 0
    local moveColor = up and p.upColor or p.downColor
    local sparkW = (p.showSparkline and item.sparkline and #item.sparkline > 1) and 32 or 0
    local sparkGap = sparkW > 0 and 6 or 0

    local symbolW = symbolFont:getWidth(item.symbol)
    local priceW = priceFont:getWidth(priceText)
    local changeW = changeFont:getWidth(changeText)

    local itemW = symbolW + sparkGap + sparkW + 6 + priceW + 6 + changeW
    state.itemRects[#state.itemRects + 1] = {
      x = x - 2, y = c.y, w = itemW + 4, h = c.h,
      symbol = item.symbol,
      price = item.price,
      change = item.change,
      index = item.index,
    }

    love.graphics.setFont(symbolFont)
    love.graphics.setColor(textR, textG, textB, textA * alpha)
    love.graphics.print(item.symbol, x, rowY + (textH - symbolH) * 0.5)

    local drawX = x + symbolW
    if sparkW > 0 then
      drawX = drawX + sparkGap
      drawSparkline(item.sparkline, drawX, sparkY, sparkW, sparkH, moveColor, alpha)
      drawX = drawX + sparkW
    end

    local mr, mg, mb, ma = parseColor(moveColor, "#22c55e")
    love.graphics.setFont(priceFont)
    love.graphics.setColor(mr, mg, mb, ma * alpha)
    love.graphics.print(priceText, drawX + 6, rowY + (textH - priceH) * 0.5)

    love.graphics.setFont(changeFont)
    love.graphics.setColor(mr, mg, mb, ma * alpha)
    love.graphics.print(changeText, drawX + 6 + priceW + 6, rowY + (textH - changeH) * 0.5)

    x = x + itemW + p.gap
    contentWidth = contentWidth + itemW + p.gap
  end

  if #p.items > 0 then
    contentWidth = contentWidth - p.gap
  end
  state.contentWidth = contentWidth
  state.scrollX = clamp(state.scrollX, 0, maxScroll(state, c))

  if oldSX then
    love.graphics.setScissor(oldSX, oldSY, oldSW, oldSH)
  else
    love.graphics.setScissor()
  end
end

function TickerTape.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  local c = node.computed
  if not c then return false end
  if mx < c.x or mx > c.x + c.w or my < c.y or my > c.y + c.h then return false end

  local state = getState(node)
  state.isDragging = true
  state.dragAnchorX = mx
  state.dragStartScroll = state.scrollX
  state.moved = false
  state.pressCandidate = nil

  local rects = state.itemRects or {}
  for i = 1, #rects do
    local rect = rects[i]
    if mx >= rect.x and mx <= rect.x + rect.w and my >= rect.y and my <= rect.y + rect.h then
      state.pressCandidate = rect
      break
    end
  end

  return true
end

function TickerTape.handleMouseMoved(node, mx, my)
  local state = getState(node)
  if not state.isDragging then return false end

  local c = node.computed
  if not c then return false end

  local dx = mx - state.dragAnchorX
  if math.abs(dx) > 2 then
    state.moved = true
  end

  local nextScroll = state.dragStartScroll - dx
  state.scrollX = clamp(nextScroll, 0, maxScroll(state, c))
  return true
end

function TickerTape.handleMouseReleased(node, mx, my, button)
  if button ~= 1 then return false end
  local state = getState(node)
  if not state.isDragging then return false end

  state.isDragging = false
  local candidate = state.pressCandidate
  local wasTap = (not state.moved) and candidate ~= nil
  state.pressCandidate = nil

  if wasTap then
    queueEvent(node.id, "tickertape:select", {
      symbol = candidate.symbol,
      price = candidate.price,
      change = candidate.change,
      index = candidate.index,
    })
  end

  return true
end

function TickerTape.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

return TickerTape
