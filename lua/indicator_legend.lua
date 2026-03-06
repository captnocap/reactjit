--[[
  indicator_legend.lua -- Lua-owned indicator legend renderer
]]

local Color = require("lua.color")

local IndicatorLegend = {}

local Measure = nil

function IndicatorLegend.init(config)
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

local function formatValue(value)
  local n = tonumber(value)
  if n == nil then return nil end
  return string.format("%.2f", n)
end

function IndicatorLegend.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local props = node.props or {}
  local items = type(props.items) == "table" and props.items or {}
  local alpha = effectiveOpacity or 1

  local textColor = props.textColor or "#94a3b8"
  local tr, tg, tb, ta = parseColor(textColor, "#94a3b8")
  local font = getFont(10)
  local boldFont = getFont(10, "bold")

  local x = c.x
  local y = c.y
  local rowH = 14
  local gapX = 12
  local dotSize = 8
  local maxX = c.x + c.w

  for i = 1, #items do
    local item = items[i]
    if type(item) == "table" then
      local label = tostring(item.label or "")
      local valueText = formatValue(item.value)

      love.graphics.setFont(font)
      local labelW = font:getWidth(label)
      local valueW = valueText and boldFont:getWidth(valueText) or 0
      local itemW = dotSize + 4 + labelW + (valueText and (4 + valueW) or 0)

      if x + itemW > maxX and x > c.x then
        x = c.x
        y = y + rowH
      end

      local cr, cg, cb, ca = parseColor(item.color, "#60a5fa")
      love.graphics.setColor(cr, cg, cb, ca * alpha)
      love.graphics.rectangle("fill", x, y + 1, dotSize, dotSize, 4, 4)

      love.graphics.setFont(font)
      love.graphics.setColor(tr, tg, tb, ta * alpha)
      love.graphics.print(label, x + dotSize + 4, y)

      if valueText then
        love.graphics.setFont(boldFont)
        love.graphics.setColor(cr, cg, cb, ca * alpha)
        love.graphics.print(valueText, x + dotSize + 4 + labelW + 4, y)
      end

      x = x + itemW + gapX
    end
  end
end

return IndicatorLegend
