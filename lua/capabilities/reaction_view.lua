--[[
  capabilities/reaction_view.lua — Balanced equation display

  Balances equations in LuaJIT, renders with coefficients, reaction type,
  and enthalpy. No RPC round-trip.

  React usage:
    <ReactionView equation="N2 + H2 -> NH3" />
    <ReactionView equation="CH4 + O2 -> CO2 + H2O" showEnergy />

  Props:
    equation    string   Unbalanced equation (e.g. "H2 + O2 -> H2O")
    showEnergy  boolean  Show enthalpy if available (default: true)
    animated    boolean  Reserved for future animation (default: false)
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")
local Color = require("lua.color")

local function getThemeColors()
  local theme = ReactJIT and ReactJIT.getTheme and ReactJIT.getTheme()
  return (theme and theme.colors) or {}
end

Capabilities.register("ReactionView", {
  visual = true,

  schema = {
    equation   = { type = "string", default = "",    desc = "Chemical equation to balance" },
    showEnergy = { type = "bool",   default = true,  desc = "Show enthalpy" },
    animated   = { type = "bool",   default = false, desc = "Reserved for animation" },
  },

  events = {},

  create = function(nodeId, props)
    return {
      reaction = nil,
      prevEquation = nil,
    }
  end,

  update = function(nodeId, props, prev, state)
    if props.equation ~= state.prevEquation then
      state.prevEquation = props.equation
      if props.equation and props.equation ~= "" then
        state.reaction = Chemistry.balanceEquation(props.equation)
      else
        state.reaction = nil
      end
    end
  end,

  destroy = function(nodeId, state) end,
  tick = function(nodeId, state, dt, pushEvent, props) end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    local rxn = state.reaction
    if not rxn then return end

    local x, y, w, h = c.x, c.y, c.w, c.h
    local tc = getThemeColors()
    local font = love.graphics.getFont()
    local lineH = font:getHeight() + 2

    -- Background
    local ebr, ebg, ebb = Color.parse(tc.bgElevated or "#363a4f")
    love.graphics.setColor(ebr or 0.2, ebg or 0.2, ebb or 0.25, opacity)
    love.graphics.rectangle("fill", x, y, w, h, 8, 8)

    local padX = x + 12
    local curY = y + 12

    -- Balanced equation line
    local tr, tg, tb = Color.parse(tc.text or "#cad3f5")
    local dr, dg, db = Color.parse(tc.textDim or "#a5adcb")
    local pr, pg, pb = Color.parse(tc.primary or "#8aadf4")

    local eqX = padX

    -- Reactants
    if rxn.reactants then
      for i, r in ipairs(rxn.reactants) do
        if i > 1 then
          love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
          love.graphics.print("+", eqX, curY)
          eqX = eqX + font:getWidth("+ ")
        end
        -- Coefficient
        if r.coefficient > 1 then
          love.graphics.setColor(pr or 0.5, pg or 0.6, pb or 0.9, opacity)
          local coefStr = tostring(r.coefficient)
          love.graphics.print(coefStr, eqX, curY)
          eqX = eqX + font:getWidth(coefStr)
        end
        -- Formula
        love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
        love.graphics.print(r.formula, eqX, curY)
        eqX = eqX + font:getWidth(r.formula .. " ")
      end
    end

    -- Arrow
    love.graphics.setColor(pr or 0.5, pg or 0.6, pb or 0.9, opacity)
    local arrow = "\u{2192}"
    love.graphics.print(arrow, eqX, curY)
    eqX = eqX + font:getWidth(arrow .. " ")

    -- Products
    if rxn.products then
      for i, p in ipairs(rxn.products) do
        if i > 1 then
          love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
          love.graphics.print("+", eqX, curY)
          eqX = eqX + font:getWidth("+ ")
        end
        if p.coefficient > 1 then
          love.graphics.setColor(pr or 0.5, pg or 0.6, pb or 0.9, opacity)
          local coefStr = tostring(p.coefficient)
          love.graphics.print(coefStr, eqX, curY)
          eqX = eqX + font:getWidth(coefStr)
        end
        love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
        love.graphics.print(p.formula, eqX, curY)
        eqX = eqX + font:getWidth(p.formula .. " ")
      end
    end

    curY = curY + lineH + 6

    -- Metadata chips
    local chipX = padX
    local chipGap = 8

    -- Balanced/unbalanced badge
    if rxn.isBalanced then
      love.graphics.setColor(0.17, 0.54, 0.24, 0.15 * opacity)
      local bw = font:getWidth("Balanced") + 12
      love.graphics.rectangle("fill", chipX, curY, bw, lineH + 4, 4, 4)
      love.graphics.setColor(0.17, 0.54, 0.24, opacity)
      love.graphics.print("Balanced", chipX + 6, curY + 2)
      chipX = chipX + bw + chipGap
    else
      love.graphics.setColor(0.88, 0.22, 0.22, 0.15 * opacity)
      local bw = font:getWidth("Unbalanced") + 12
      love.graphics.rectangle("fill", chipX, curY, bw, lineH + 4, 4, 4)
      love.graphics.setColor(0.88, 0.22, 0.22, opacity)
      love.graphics.print("Unbalanced", chipX + 6, curY + 2)
      chipX = chipX + bw + chipGap
    end

    -- Reaction type chip
    if rxn.type then
      local sr, sg, sb = Color.parse(tc.surface or "#363a4f")
      local typeW = font:getWidth(rxn.type) + 12
      love.graphics.setColor(sr or 0.2, sg or 0.2, sb or 0.25, opacity)
      love.graphics.rectangle("fill", chipX, curY, typeW, lineH + 4, 4, 4)

      love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
      love.graphics.print("Type", chipX + 6, curY - lineH + 2)
      love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
      love.graphics.print(rxn.type, chipX + 6, curY + 2)
      chipX = chipX + typeW + chipGap
    end

    -- Enthalpy chip
    local props = node.props or {}
    if props.showEnergy ~= false and rxn.enthalpy then
      local isExo = rxn.enthalpy < 0
      local label = isExo and "Exothermic" or "Endothermic"
      local value = string.format("\u{0394}H = %.1f kJ/mol", rxn.enthalpy)
      local maxW = math.max(font:getWidth(label), font:getWidth(value)) + 12
      local chipH = lineH * 2 + 4

      if isExo then
        love.graphics.setColor(0.09, 0.39, 0.67, 0.15 * opacity)
      else
        love.graphics.setColor(0.79, 0.13, 0.00, 0.15 * opacity)
      end
      love.graphics.rectangle("fill", chipX, curY, maxW, chipH, 4, 4)

      love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
      love.graphics.print(label, chipX + 6, curY + 2)
      love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
      love.graphics.print(value, chipX + 6, curY + lineH + 2)
    end
  end,
})
