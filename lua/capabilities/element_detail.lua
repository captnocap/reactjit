--[[
  capabilities/element_detail.lua — Compact element detail with info chips

  Shows element symbol badge + info chips for key properties.
  Slightly more compact than ElementCard.

  React usage:
    <ElementDetail element={26} />
    <ElementDetail element="Fe" />

  Props:
    element   number|string  Atomic number or symbol
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")
local Color = require("lua.color")

local CATEGORY_COLORS = {
  ["alkali-metal"]         = "#7b6faa",
  ["alkaline-earth"]       = "#9a9cc4",
  ["transition-metal"]     = "#de9a9a",
  ["post-transition-metal"]= "#8fbc8f",
  ["metalloid"]            = "#c8c864",
  ["nonmetal"]             = "#59b5e6",
  ["halogen"]              = "#d4a844",
  ["noble-gas"]            = "#c87e4a",
  ["lanthanide"]           = "#c45879",
  ["actinide"]             = "#d4879a",
}

local function getThemeColors()
  local theme = ReactJIT and ReactJIT.getTheme and ReactJIT.getTheme()
  return (theme and theme.colors) or {}
end

local function drawChip(font, x, y, label, value, opacity, tc)
  local sr, sg, sb = Color.parse(tc.surface or "#363a4f")
  local dr, dg, db = Color.parse(tc.textDim or "#a5adcb")
  local tr, tg, tb = Color.parse(tc.text or "#cad3f5")

  local labelW = font:getWidth(label)
  local valueW = font:getWidth(value)
  local chipW = math.max(labelW, valueW) + 12
  local chipH = font:getHeight() * 2 + 6

  love.graphics.setColor(sr or 0.2, sg or 0.2, sb or 0.25, opacity)
  love.graphics.rectangle("fill", x, y, chipW, chipH, 4, 4)

  love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
  love.graphics.print(label, x + 6, y + 2)

  love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
  love.graphics.print(value, x + 6, y + font:getHeight() + 2)

  return chipW
end

Capabilities.register("ElementDetail", {
  visual = true,

  schema = {
    element = { type = "number", default = 1, desc = "Atomic number or symbol" },
  },

  events = {},

  create = function(nodeId, props)
    return { elementData = nil, prevElement = nil }
  end,

  update = function(nodeId, props, prev, state)
    if props.element ~= state.prevElement then
      state.prevElement = props.element
      state.elementData = Chemistry.getElement(props.element)
    end
  end,

  destroy = function(nodeId, state) end,
  tick = function(nodeId, state, dt, pushEvent, props) end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    local el = state.elementData
    if not el then return end

    local x, y, w, h = c.x, c.y, c.w, c.h
    local tc = getThemeColors()
    local font = love.graphics.getFont()

    -- Background
    local ebr, ebg, ebb = Color.parse(tc.bgElevated or "#363a4f")
    love.graphics.setColor(ebr or 0.2, ebg or 0.2, ebb or 0.25, opacity)
    love.graphics.rectangle("fill", x, y, w, h, 8, 8)

    -- Symbol badge
    local bgHex = CATEGORY_COLORS[el.category] or "#868e96"
    local br, bg_, bb = Color.parse(bgHex)
    local badgeSize = 56
    local bx, by = x + 12, y + 12
    love.graphics.setColor(br or 0.5, bg_ or 0.5, bb or 0.5, opacity)
    love.graphics.rectangle("fill", bx, by, badgeSize, badgeSize, 8, 8)

    love.graphics.setColor(0, 0, 0, 0.6 * opacity)
    local numStr = tostring(el.number)
    local numW = font:getWidth(numStr)
    love.graphics.print(numStr, bx + (badgeSize - numW) / 2, by + 3)

    love.graphics.setColor(0, 0, 0, opacity)
    local symW = font:getWidth(el.symbol)
    love.graphics.print(el.symbol, bx + (badgeSize - symW) / 2, by + 18)

    -- Name + mass + category
    local textX = bx + badgeSize + 12
    local tr, tg, tb = Color.parse(tc.text or "#cad3f5")
    love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
    love.graphics.print(el.name, textX, by + 2)

    local dr, dg, db = Color.parse(tc.textDim or "#a5adcb")
    love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
    love.graphics.print(string.format("%.3f u", el.mass), textX, by + font:getHeight() + 2)
    love.graphics.print(el.category:gsub("-", " "), textX, by + font:getHeight() * 2 + 2)

    -- Info chips
    local chipY = by + badgeSize + 10
    local chipX = x + 12
    local chipGap = 8
    local valence = Chemistry.valenceElectrons(el.number)

    local chips = {
      {"Group", tostring(el.group)},
      {"Period", tostring(el.period)},
      {"Phase", el.phase},
      {"Valence e-", tostring(valence)},
    }
    if el.electronegativity then
      chips[#chips + 1] = {"EN", tostring(el.electronegativity)}
    end
    if el.meltingPoint then
      chips[#chips + 1] = {"MP", string.format("%.0f K", el.meltingPoint)}
    end
    if el.boilingPoint then
      chips[#chips + 1] = {"BP", string.format("%.0f K", el.boilingPoint)}
    end
    if el.density then
      chips[#chips + 1] = {"Density", string.format("%.2f g/cm\u{00B3}", el.density)}
    end

    for _, chip in ipairs(chips) do
      local cw = drawChip(font, chipX, chipY, chip[1], chip[2], opacity, tc)
      chipX = chipX + cw + chipGap
      if chipX + 40 > x + w then
        chipX = x + 12
        chipY = chipY + font:getHeight() * 2 + chipGap + 4
      end
    end

    -- Electron config at bottom
    if el.electronConfig then
      love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, 0.7 * opacity)
      love.graphics.print(el.electronConfig, x + 12, chipY + font:getHeight() * 2 + 12)
    end
  end,
})
