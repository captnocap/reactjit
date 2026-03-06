--[[
  macd_panel.lua -- Lua-owned MACD histogram panel
]]

local Color = require("lua.color")

local MACDPanel = {}

local Measure = nil

function MACDPanel.init(config)
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

local function getFont(size)
  if Measure and Measure.getFont then
    local font = select(1, Measure.getFont(size))
    if font then return font end
  end
  return love.graphics.getFont()
end

local function normalizePoints(points)
  local out = {}
  if type(points) ~= "table" then return out end
  for i = 1, #points do
    local p = points[i]
    if type(p) == "table" then
      local hist = tonumber(p.histogram)
      if hist and hist == hist then
        out[#out + 1] = hist
      end
    end
  end
  return out
end

function MACDPanel.draw(node, effectiveOpacity)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local props = node.props or {}
  local values = normalizePoints(props.points)
  local alpha = effectiveOpacity or 1

  local textColor = props.textColor or "#94a3b8"
  local positiveColor = props.positiveColor or "#22c55e"
  local negativeColor = props.negativeColor or "#ef4444"

  local labelFont = getFont(10)
  love.graphics.setFont(labelFont)

  local tr, tg, tb, ta = parseColor(textColor, "#94a3b8")
  love.graphics.setColor(tr, tg, tb, ta * alpha)
  love.graphics.print("MACD", c.x, c.y)

  local topPad = labelFont:getHeight() + 4
  local chartX = c.x
  local chartY = c.y + topPad
  local chartW = c.w
  local chartH = c.h - topPad
  if chartH <= 1 or chartW <= 1 then return end

  if #values == 0 then return end

  local maxAbs = 0
  for i = 1, #values do
    local av = math.abs(values[i])
    if av > maxAbs then maxAbs = av end
  end
  if maxAbs <= 0 then return end

  local barGap = 1
  local n = #values
  local barW = ((chartW - barGap * (n - 1)) * (n ^ -1))
  if barW < 1 then barW = 1 end
  local invMax = maxAbs ^ -1

  for i = 1, n do
    local v = values[i]
    local h = math.max(1, math.abs(v) * invMax * (chartH - 1))
    local x = chartX + (i - 1) * (barW + barGap)
    local y = chartY + chartH - h
    local cr, cg, cb, ca = parseColor(v >= 0 and positiveColor or negativeColor, "#22c55e")
    love.graphics.setColor(cr, cg, cb, ca * alpha)
    love.graphics.rectangle("fill", x, y, barW, h)
  end
end

return MACDPanel
