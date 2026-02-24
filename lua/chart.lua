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
  
  -- Prevent drawing outside the box
  love.graphics.push("all")
  love.graphics.setScissor(x, y, width, height)
  
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
      local c = data[i].color or props.color or "#3b82f6"
      local rgba = ColorUtils.parse(c)
      love.graphics.setColor(rgba[1], rgba[2], rgba[3], rgba[4] or 1)
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
    
    local c = props.color or "#3b82f6"
    local rgba = ColorUtils.parse(c)
    love.graphics.setColor(rgba[1], rgba[2], rgba[3], rgba[4] or 1)
    
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
      local rgba = ColorUtils.parse(data[i].color or "#ffffff")
      love.graphics.setColor(rgba[1], rgba[2], rgba[3], rgba[4] or 1)
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
    local bullColor = ColorUtils.parse(props.bullColor or "#22c55e")
    local bearColor = ColorUtils.parse(props.bearColor or "#ef4444")
    local wickColor = ColorUtils.parse(props.wickColor or "#94a3b8")
    
    for i=1, len do
      local d = data[i]
      local wx = cx + (candleWidth / 2)
      
      -- Wick
      local topY = y + height - (((d.high - minLow) / range) * height)
      local botY = y + height - (((d.low - minLow) / range) * height)
      love.graphics.setColor(wickColor[1], wickColor[2], wickColor[3], wickColor[4] or 1)
      love.graphics.setLineWidth(1)
      love.graphics.line(wx, topY, wx, botY)
      
      -- Body
      local isBull = d.close >= d.open
      local bodyTopY = y + height - (((math.max(d.open, d.close) - minLow) / range) * height)
      local bodyBotY = y + height - (((math.min(d.open, d.close) - minLow) / range) * height)
      local bodyHeight = math.max(1, bodyBotY - bodyTopY)
      
      if isBull then
        love.graphics.setColor(bullColor[1], bullColor[2], bullColor[3], bullColor[4] or 1)
      else
        love.graphics.setColor(bearColor[1], bearColor[2], bearColor[3], bearColor[4] or 1)
      end
      
      love.graphics.rectangle("fill", cx, bodyTopY, candleWidth, bodyHeight)
      cx = cx + candleWidth + gap
    end
  end
  
  love.graphics.pop()
end

return Chart
