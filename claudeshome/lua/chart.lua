--[[
  chart.lua -- Native chart rendering for ReactJit

  Receives props from `<Chart2D>` in TypeScript containing layout bounds and `data`.
  Processes dataset loops natively to draw Lines, Bars, Pies, and Candlesticks,
  vastly outperforming the previous TS Layout-Box rendering method.
]]

local Chart = {}
local ColorUtils = require("lua.color") -- helper to parse Hex/RGBA from TS to Lua array

function Chart.draw(props, x, y, width, height)
  if not props or not props.data or not props.chartType then return end
  local data = props.data
  local len = #data
  if len == 0 then return end
  
  -- Prevent drawing outside the box.
  -- Use transformPoint so scissor is correct inside scroll containers
  -- (setScissor operates in screen space, not content space).
  love.graphics.push("all")
  local psx, psy, psw, psh = love.graphics.getScissor()
  local sx, sy = love.graphics.transformPoint(x, y)
  local sx2, sy2 = love.graphics.transformPoint(x + width, y + height)
  local sw, sh = math.max(0, sx2 - sx), math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)
  
  if props.chartType == "bar" then
    local gap = props.gap or 8
    local barWidth = props.barWidth or ((width - (gap * (len - 1))) / len)
    local maxValue = data[1].value
    for i=2, len do if data[i].value > maxValue then maxValue = data[i].value end end
    if maxValue <= 0 then maxValue = 1 end
    
    local cx = x
    for i=1, len do
      local val = data[i].value
      local bh = math.max(1, (val / maxValue) * height)
      local clr = data[i].color or props.color or "#3b82f6"
      ColorUtils.set(clr)
      love.graphics.rectangle("fill", cx, y + height - bh, barWidth, bh)
      cx = cx + barWidth + gap
    end
    
  elseif props.chartType == "line" then
    local minVal = data[1].value
    local maxVal = data[1].value
    for i=2, len do
      if data[i].value < minVal then minVal = data[i].value end
      if data[i].value > maxVal then maxVal = data[i].value end
    end
    local range = maxVal - minVal
    if range == 0 then range = 1 end
    
    local points = {}
    local stepX = width / math.max(1, len - 1)
    
    -- Gather vertices
    for i=1, len do
      local px = x + ((i - 1) * stepX)
      local norm = (data[i].value - minVal) / range
      local py = y + height - (norm * height)
      table.insert(points, px)
      table.insert(points, py)
    end
    
    ColorUtils.set(props.color or "#3b82f6")
    
    if len >= 2 then
      love.graphics.setLineWidth(2)
      love.graphics.line(points)
    end
    
  elseif props.chartType == "pie" then
    local total = 0
    for i=1, len do total = total + data[i].value end
    if total == 0 then total = 1 end
    
    local cx = x + (width / 2)
    local cy = y + (height / 2)
    local radius = math.min(width, height) / 2
    local startAngle = -math.pi / 2
    
    for i=1, len do
      local slice = (data[i].value / total) * math.pi * 2
      ColorUtils.set(data[i].color or "#ffffff")
      love.graphics.arc("fill", cx, cy, radius, startAngle, startAngle + slice)
      startAngle = startAngle + slice
    end
    
  elseif props.chartType == "candlestick" then
    local maxHigh = data[1].high
    local minLow = data[1].low
    for i=2, len do
      if data[i].high > maxHigh then maxHigh = data[i].high end
      if data[i].low < minLow then minLow = data[i].low end
    end
    local range = maxHigh - minLow
    if range == 0 then range = 1 end
    
    local gap = 4
    local candleWidth = math.max(1, (width - (gap * (len - 1))) / len)
    local cx = x
    local bullClr = ColorUtils.toTable(props.bullColor or "#22c55e", {0,0.77,0.35,1})
    local bearClr = ColorUtils.toTable(props.bearColor or "#ef4444", {0.94,0.27,0.27,1})
    local wickClr = ColorUtils.toTable(props.wickColor or "#94a3b8", {0.58,0.64,0.72,1})

    for i=1, len do
      local d = data[i]
      local wx = cx + (candleWidth / 2)

      -- Wick
      local topY = y + height - (((d.high - minLow) / range) * height)
      local botY = y + height - (((d.low - minLow) / range) * height)
      love.graphics.setColor(wickClr[1], wickClr[2], wickClr[3], wickClr[4])
      love.graphics.setLineWidth(1)
      love.graphics.line(wx, topY, wx, botY)

      -- Body
      local isBull = d.close >= d.open
      local bodyTopY = y + height - (((math.max(d.open, d.close) - minLow) / range) * height)
      local bodyBotY = y + height - (((math.min(d.open, d.close) - minLow) / range) * height)
      local bodyHeight = math.max(1, bodyBotY - bodyTopY)

      local bc = isBull and bullClr or bearClr
      love.graphics.setColor(bc[1], bc[2], bc[3], bc[4])

      love.graphics.rectangle("fill", cx, bodyTopY, candleWidth, bodyHeight)
      cx = cx + candleWidth + gap
    end
  end
  
  love.graphics.pop()
end

return Chart
