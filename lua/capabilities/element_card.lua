--[[
  capabilities/element_card.lua — Full element property card

  All properties at a glance: symbol badge, mass, group, period, phase,
  valence electrons, EN, melting/boiling point, density, electron config.

  React usage:
    <ElementCard element={26} />
    <ElementCard element="Fe" />

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

local PHASE_COLORS = {
  solid   = "#69db7c",
  liquid  = "#4dabf7",
  gas     = "#ffd43b",
  unknown = "#868e96",
}

local function getThemeColors()
  local theme = ReactJIT and ReactJIT.getTheme and ReactJIT.getTheme()
  return (theme and theme.colors) or {}
end

local function drawRow(font, x, y, w, label, value, opacity, labelColor, valueColor, valueOverrideColor)
  love.graphics.setColor(labelColor[1], labelColor[2], labelColor[3], opacity)
  love.graphics.print(label, x, y)
  local vc = valueOverrideColor or valueColor
  love.graphics.setColor(vc[1], vc[2], vc[3], opacity)
  local vw = font:getWidth(value)
  love.graphics.print(value, x + w - vw, y)
end

Capabilities.register("ElementCard", {
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
    local lineH = font:getHeight() + 2

    -- Background
    local ebr, ebg, ebb = Color.parse(tc.bgElevated or "#363a4f")
    love.graphics.setColor(ebr or 0.2, ebg or 0.2, ebb or 0.25, opacity)
    love.graphics.rectangle("fill", x, y, w, h, 8, 8)

    -- Category color border
    local bgHex = CATEGORY_COLORS[el.category] or "#868e96"
    local br, bg_, bb = Color.parse(bgHex)
    love.graphics.setColor(br or 0.5, bg_ or 0.5, bb or 0.5, opacity)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", x, y, w, h, 8, 8)

    -- Symbol badge
    local badgeSize = 44
    local bx, by = x + 12, y + 12
    love.graphics.setColor(br or 0.5, bg_ or 0.5, bb or 0.5, opacity)
    love.graphics.rectangle("fill", bx, by, badgeSize, badgeSize, 6, 6)

    love.graphics.setColor(0, 0, 0, 0.6 * opacity)
    local numStr = tostring(el.number)
    local numW = font:getWidth(numStr)
    love.graphics.print(numStr, bx + (badgeSize - numW) / 2, by + 2)

    love.graphics.setColor(0, 0, 0, opacity)
    local symW = font:getWidth(el.symbol)
    love.graphics.print(el.symbol, bx + (badgeSize - symW) / 2, by + 14)

    -- Name + category
    local textX = bx + badgeSize + 10
    local tr, tg, tb = Color.parse(tc.text or "#cad3f5")
    love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
    love.graphics.print(el.name, textX, by + 2)

    local dr, dg, db = Color.parse(tc.textDim or "#a5adcb")
    love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
    love.graphics.print(el.category:gsub("-", " "), textX, by + lineH + 2)

    -- Property rows
    local rowX = x + 12
    local rowW = w - 24
    local rowY = by + badgeSize + 12
    local labelColor = {dr or 0.6, dg or 0.6, db or 0.7}
    local valueColor = {tr or 0.8, tg or 0.8, tb or 0.85}

    local valence = Chemistry.valenceElectrons(el.number)

    local rows = {
      {"Atomic Mass", string.format("%.3f u", el.mass)},
      {"Group", tostring(el.group)},
      {"Period", tostring(el.period)},
      {"Phase", el.phase, PHASE_COLORS[el.phase]},
      {"Valence Electrons", tostring(valence)},
      {"Electronegativity", el.electronegativity and tostring(el.electronegativity) or "\u{2014}"},
      {"Melting Point", el.meltingPoint and string.format("%.0f K", el.meltingPoint) or "\u{2014}"},
      {"Boiling Point", el.boilingPoint and string.format("%.0f K", el.boilingPoint) or "\u{2014}"},
      {"Density", el.density and string.format("%.3f g/cm\u{00B3}", el.density) or "\u{2014}"},
      {"Electron Config", el.electronConfig or ""},
    }

    for _, row in ipairs(rows) do
      if rowY + lineH > y + h then break end
      local overrideColor = nil
      if row[3] then
        local pr, pg, pb = Color.parse(row[3])
        if pr then overrideColor = {pr, pg, pb} end
      end
      drawRow(font, rowX, rowY, rowW, row[1], row[2], opacity, labelColor, valueColor, overrideColor)
      rowY = rowY + lineH
    end
  end,
})
