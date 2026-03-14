--[[
  chart.lua -- Native chart rendering for ReactJit

  Receives props from `<Chart2D>` in TypeScript containing layout bounds and `data`.
  Processes dataset loops natively to draw Lines, Bars, Pies, and Candlesticks,
  vastly outperforming the previous TS Layout-Box rendering method.
]]

local Chart = {}
local ColorUtils = require("lua.color") -- helper to parse Hex/RGBA from TS to Lua array

local function val(item)
  if type(item) == "number" then return item end
  return item.value
end

local function clr(item, fallback)
  if type(item) == "table" and item.color then return item.color end
  return fallback
end

local function normalizeDepthLevel(level)
  if type(level) ~= "table" then return nil end
  local price = tonumber(level.price) or tonumber(level[1])
  local size = tonumber(level.size) or tonumber(level[2])
  if not price or not size then return nil end
  return { price = price, size = size }
end

local function collectDepthLevels(levels, descending)
  local out = {}
  if type(levels) ~= "table" then return out end

  for i = 1, #levels do
    local normalized = normalizeDepthLevel(levels[i])
    if normalized then
      out[#out + 1] = normalized
    end
  end

  table.sort(out, function(a, b)
    if descending then return a.price > b.price end
    return a.price < b.price
  end)

  return out
end

function Chart.draw(props, x, y, width, height)
  if not props or not props.chartType or width <= 0 or height <= 0 then return end
  local chartType = props.chartType
  local data = props.data or {}
  local len = #data
  if chartType == "depth" then
    local bids = collectDepthLevels(props.bids, true)
    local asks = collectDepthLevels(props.asks, false)
    if #bids == 0 and #asks == 0 then return end
  elseif len == 0 then
    return
  end
  
  -- Prevent drawing outside the box.
  -- Use transformPoint so scissor is correct inside scroll containers
  -- (setScissor operates in screen space, not content space).
  love.graphics.push("all")
  local psx, psy, psw, psh = love.graphics.getScissor()
  local sx, sy = love.graphics.transformPoint(x, y)
  local sx2, sy2 = love.graphics.transformPoint(x + width, y + height)
  local sw, sh = math.max(0, sx2 - sx), math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)
  
  if chartType == "bar" then
    local gap = props.gap or 8
    local barWidth = props.barWidth or ((width - (gap * (len - 1))) / len)
    local maxValue = val(data[1])
    for i=2, len do if val(data[i]) > maxValue then maxValue = val(data[i]) end end
    if maxValue <= 0 then maxValue = 1 end

    local cx = x
    for i=1, len do
      local v = val(data[i])
      local bh = math.max(1, (v / maxValue) * height)
      ColorUtils.set(clr(data[i], props.color or "#3b82f6"))
      love.graphics.rectangle("fill", cx, y + height - bh, barWidth, bh)
      cx = cx + barWidth + gap
    end
    
  elseif chartType == "line" then
    local minVal = val(data[1])
    local maxVal = val(data[1])
    for i=2, len do
      local v = val(data[i])
      if v < minVal then minVal = v end
      if v > maxVal then maxVal = v end
    end
    local range = maxVal - minVal
    if range == 0 then range = 1 end

    local points = {}
    local stepX = width / math.max(1, len - 1)

    -- Gather vertices
    for i=1, len do
      local px = x + ((i - 1) * stepX)
      local norm = (val(data[i]) - minVal) / range
      local py = y + height - (norm * height)
      table.insert(points, px)
      table.insert(points, py)
    end
    
    ColorUtils.set(props.color or "#3b82f6")
    
    if len >= 2 then
      love.graphics.setLineWidth(2)
      love.graphics.line(points)
    end
    
  elseif chartType == "pie" then
    local total = 0
    for i=1, len do total = total + val(data[i]) end
    if total == 0 then total = 1 end

    local cx = x + (width / 2)
    local cy = y + (height / 2)
    local radius = math.min(width, height) / 2
    local startAngle = -math.pi / 2

    for i=1, len do
      local slice = (val(data[i]) / total) * math.pi * 2
      ColorUtils.set(clr(data[i], "#ffffff"))
      love.graphics.arc("fill", cx, cy, radius, startAngle, startAngle + slice)
      startAngle = startAngle + slice
    end
    
  elseif chartType == "candlestick" then
    -- Window the chart to the newest candles that can actually fit, so the
    -- latest candle stays visible instead of overflowing the right edge.
    local horizontalPadding = math.min(6, math.max(2, math.floor(width * 0.02)))
    local verticalPadding = math.min(8, math.max(2, math.floor(height * 0.04)))
    local plotX = x + horizontalPadding
    local plotY = y + verticalPadding
    local plotWidth = math.max(1, width - horizontalPadding * 2)
    local plotHeight = math.max(1, height - verticalPadding * 2)
    local minSlotWidth = math.max(3, tonumber(props.minSlotWidth) or 6)
    local maxVisible = math.max(1, math.floor(plotWidth / minSlotWidth))
    local visibleLen = math.min(len, maxVisible)
    local startIndex = math.max(1, len - visibleLen + 1)
    local endIndex = startIndex + visibleLen - 1
    local slotWidth = plotWidth / visibleLen
    local candleWidth = math.max(1, slotWidth * 0.72)
    if candleWidth > slotWidth then candleWidth = slotWidth end
    local candleInset = (slotWidth - candleWidth) / 2

    local maxHigh = data[startIndex].high
    local minLow = data[startIndex].low
    for i = startIndex + 1, endIndex do
      if data[i].high > maxHigh then maxHigh = data[i].high end
      if data[i].low < minLow then minLow = data[i].low end
    end
    local range = maxHigh - minLow
    if range == 0 then
      local flatPad = math.max(0.01, math.abs(maxHigh) * 0.01)
      maxHigh = maxHigh + flatPad
      minLow = minLow - flatPad
      range = maxHigh - minLow
    end
    local pricePadding = range * 0.08
    maxHigh = maxHigh + pricePadding
    minLow = minLow - pricePadding
    range = maxHigh - minLow

    local function priceToY(price)
      return plotY + plotHeight - (((price - minLow) / range) * plotHeight)
    end

    local bullClr = ColorUtils.toTable(props.bullColor or "#22c55e", {0,0.77,0.35,1})
    local bearClr = ColorUtils.toTable(props.bearColor or "#ef4444", {0.94,0.27,0.27,1})
    local wickClr = ColorUtils.toTable(props.wickColor or "#94a3b8", {0.58,0.64,0.72,1})

    for i = startIndex, endIndex do
      local d = data[i]
      local visibleIndex = i - startIndex
      local cx = plotX + visibleIndex * slotWidth + candleInset
      local wx = plotX + visibleIndex * slotWidth + (slotWidth / 2)

      -- Wick
      local topY = priceToY(d.high)
      local botY = priceToY(d.low)
      love.graphics.setColor(wickClr[1], wickClr[2], wickClr[3], wickClr[4])
      love.graphics.setLineWidth(1)
      love.graphics.line(wx, topY, wx, botY)

      -- Body
      local isBull = d.close >= d.open
      local bodyTopY = priceToY(math.max(d.open, d.close))
      local bodyBotY = priceToY(math.min(d.open, d.close))
      local bodyHeight = math.max(1, bodyBotY - bodyTopY)

      local bc = isBull and bullClr or bearClr
      love.graphics.setColor(bc[1], bc[2], bc[3], bc[4])
      love.graphics.rectangle("fill", cx, bodyTopY, candleWidth, bodyHeight)
    end

    -- Overlays: line indicators drawn on top of candles
    -- Each overlay = { values = number[], color = "#hex", lineWidth = N, style = "solid"|"dashed" }
    local overlays = props.overlays
    if overlays then
      for oi = 1, #overlays do
        local ov = overlays[oi]
        local vals = ov.values
        if vals and #vals > 0 then
          local ovClr = ColorUtils.toTable(ov.color or "#3b82f6", {0.23,0.51,0.96,1})
          love.graphics.setColor(ovClr[1], ovClr[2], ovClr[3], ovClr[4] * (ov.opacity or 1))
          love.graphics.setLineWidth(ov.lineWidth or 1.5)

          -- Band overlays: upper + lower lines with optional fill
          if ov.upper and ov.lower then
            local upperPts = {}
            local lowerPts = {}
            local bandEnd = math.min(endIndex, #ov.upper, #ov.lower)
            for i = startIndex, bandEnd do
              local uv = ov.upper[i]
              local lv = ov.lower[i]
              if uv and lv and uv == uv and lv == lv then -- NaN check
                local px = plotX + (i - startIndex) * slotWidth + slotWidth / 2
                local uy = priceToY(uv)
                local ly = priceToY(lv)
                table.insert(upperPts, px)
                table.insert(upperPts, uy)
                table.insert(lowerPts, px)
                table.insert(lowerPts, ly)
              end
            end
            -- Fill the band area
            if ov.fillColor and #upperPts >= 4 then
              local fillClr = ColorUtils.toTable(ov.fillColor, {0.5,0.5,0.5,0.1})
              love.graphics.setColor(fillClr[1], fillClr[2], fillClr[3], fillClr[4])
              -- Build polygon: upper left→right, then lower right→left
              local poly = {}
              for i = 1, #upperPts do poly[i] = upperPts[i] end
              for i = #lowerPts, 1, -2 do
                table.insert(poly, lowerPts[i - 1])
                table.insert(poly, lowerPts[i])
              end
              if #poly >= 6 then
                local ok, err = pcall(love.graphics.polygon, "fill", poly)
                -- polygon may fail with degenerate shapes; just skip
              end
            end
            -- Draw band lines
            love.graphics.setColor(ovClr[1], ovClr[2], ovClr[3], ovClr[4] * (ov.opacity or 0.6))
            love.graphics.setLineWidth(ov.lineWidth or 1)
            if #upperPts >= 4 then love.graphics.line(upperPts) end
            if #lowerPts >= 4 then love.graphics.line(lowerPts) end
            -- Middle line from vals
            local midPts = {}
            local midEnd = math.min(endIndex, #vals)
            for i = startIndex, midEnd do
              local v = vals[i]
              if v and v == v then
                local px = plotX + (i - startIndex) * slotWidth + slotWidth / 2
                local py = priceToY(v)
                table.insert(midPts, px)
                table.insert(midPts, py)
              end
            end
            love.graphics.setColor(ovClr[1], ovClr[2], ovClr[3], ovClr[4] * (ov.opacity or 1))
            love.graphics.setLineWidth(ov.lineWidth or 1.5)
            if #midPts >= 4 then love.graphics.line(midPts) end
          else
            -- Simple line overlay
            local pts = {}
            local valueEnd = math.min(endIndex, #vals)
            for i = startIndex, valueEnd do
              local v = vals[i]
              if v and v == v then -- NaN check
                local px = plotX + (i - startIndex) * slotWidth + slotWidth / 2
                local py = priceToY(v)
                table.insert(pts, px)
                table.insert(pts, py)
              end
            end
            if ov.style == "dashed" and #pts >= 4 then
              local dashLen = 6
              local gapLen = 4
              for i = 1, #pts - 2, 2 do
                local x1, y1, x2, y2 = pts[i], pts[i+1], pts[i+2], pts[i+3]
                local dx, dy = x2 - x1, y2 - y1
                local segLen = math.sqrt(dx*dx + dy*dy)
                if segLen > 0 then
                  local nx, ny = dx / segLen, dy / segLen
                  local drawn = 0
                  while drawn < segLen do
                    local dashEnd = math.min(drawn + dashLen, segLen)
                    love.graphics.line(
                      x1 + nx * drawn, y1 + ny * drawn,
                      x1 + nx * dashEnd, y1 + ny * dashEnd
                    )
                    drawn = dashEnd + gapLen
                  end
                end
              end
            elseif #pts >= 4 then
              love.graphics.line(pts)
            end
          end
        end
      end
    end

  elseif chartType == "depth" then
    -- Depth chart: cumulative bid/ask area chart
    -- data format: { bids = {{price, size},...}, asks = {{price, size},...} }
    local bids = collectDepthLevels(props.bids, true)
    local asks = collectDepthLevels(props.asks, false)
    local bidClr = ColorUtils.toTable(props.bidColor or "#22c55e", {0,0.77,0.35,1})
    local askClr = ColorUtils.toTable(props.askColor or "#ef4444", {0.94,0.27,0.27,1})
    local bidFill = ColorUtils.toTable(props.bidFillColor or "rgba(34,197,94,0.15)", {0.13,0.77,0.37,0.15})
    local askFill = ColorUtils.toTable(props.askFillColor or "rgba(239,68,68,0.15)", {0.94,0.27,0.27,0.15})

    -- Find price range and cumulative max
    local priceMin = math.huge
    local priceMax = -math.huge
    for i = 1, #bids do
      if bids[i].price < priceMin then priceMin = bids[i].price end
      if bids[i].price > priceMax then priceMax = bids[i].price end
    end
    for i = 1, #asks do
      if asks[i].price < priceMin then priceMin = asks[i].price end
      if asks[i].price > priceMax then priceMax = asks[i].price end
    end
    if priceMin >= priceMax then priceMin = 0; priceMax = 1 end
    local priceRange = priceMax - priceMin
    local padding = priceRange * 0.05
    priceMin = priceMin - padding
    priceMax = priceMax + padding
    priceRange = priceMax - priceMin

    -- Build cumulative volumes
    local bidCum = {}
    local cumVol = 0
    for i = 1, #bids do
      cumVol = cumVol + bids[i].size
      bidCum[i] = { price = bids[i].price, cumVol = cumVol }
    end

    local askCum = {}
    cumVol = 0
    for i = 1, #asks do
      cumVol = cumVol + asks[i].size
      askCum[i] = { price = asks[i].price, cumVol = cumVol }
    end

    local maxCumVol = 1
    if #bidCum > 0 and bidCum[#bidCum].cumVol > maxCumVol then maxCumVol = bidCum[#bidCum].cumVol end
    if #askCum > 0 and askCum[#askCum].cumVol > maxCumVol then maxCumVol = askCum[#askCum].cumVol end

    -- Helper: price → x, cumVol → y
    local function priceToX(p) return x + ((p - priceMin) / priceRange) * width end
    local function volToY(v) return y + height - (v / maxCumVol) * height end

    -- Draw bid area (right to left = highest bid → lowest)
    if #bidCum >= 1 then
      local poly = {}
      -- Start at baseline at the highest bid price
      table.insert(poly, priceToX(bidCum[1].price))
      table.insert(poly, y + height)
      for i = 1, #bidCum do
        table.insert(poly, priceToX(bidCum[i].price))
        table.insert(poly, volToY(bidCum[i].cumVol))
      end
      -- Close back to baseline
      table.insert(poly, priceToX(bidCum[#bidCum].price))
      table.insert(poly, y + height)

      if #poly >= 6 then
        love.graphics.setColor(bidFill[1], bidFill[2], bidFill[3], bidFill[4])
        pcall(love.graphics.polygon, "fill", poly)
      end

      -- Bid line
      local pts = {}
      for i = 1, #bidCum do
        table.insert(pts, priceToX(bidCum[i].price))
        table.insert(pts, volToY(bidCum[i].cumVol))
      end
      if #pts >= 4 then
        love.graphics.setColor(bidClr[1], bidClr[2], bidClr[3], bidClr[4])
        love.graphics.setLineWidth(2)
        love.graphics.line(pts)
      end
    end

    -- Draw ask area (left to right = lowest ask → highest)
    if #askCum >= 1 then
      local poly = {}
      table.insert(poly, priceToX(askCum[1].price))
      table.insert(poly, y + height)
      for i = 1, #askCum do
        table.insert(poly, priceToX(askCum[i].price))
        table.insert(poly, volToY(askCum[i].cumVol))
      end
      table.insert(poly, priceToX(askCum[#askCum].price))
      table.insert(poly, y + height)

      if #poly >= 6 then
        love.graphics.setColor(askFill[1], askFill[2], askFill[3], askFill[4])
        pcall(love.graphics.polygon, "fill", poly)
      end

      local pts = {}
      for i = 1, #askCum do
        table.insert(pts, priceToX(askCum[i].price))
        table.insert(pts, volToY(askCum[i].cumVol))
      end
      if #pts >= 4 then
        love.graphics.setColor(askClr[1], askClr[2], askClr[3], askClr[4])
        love.graphics.setLineWidth(2)
        love.graphics.line(pts)
      end
    end

    -- Midpoint line
    if #bidCum > 0 and #askCum > 0 then
      local midPrice = (bidCum[1].price + askCum[1].price) / 2
      local midX = priceToX(midPrice)
      love.graphics.setColor(0.6, 0.7, 0.8, 0.4)
      love.graphics.setLineWidth(1)
      love.graphics.line(midX, y, midX, y + height)
    end
  end
  
  love.graphics.pop()
end

return Chart
