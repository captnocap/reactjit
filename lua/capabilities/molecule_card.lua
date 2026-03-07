--[[
  capabilities/molecule_card.lua — Molecule information card

  Displays formula, name, molar mass, geometry, polarity, atom composition.
  Calls chemistry.lua directly — no RPC round-trip through JS.

  React usage:
    <MoleculeCard formula="H2O" />
    <MoleculeCard formula="C6H12O6" showBonds />

  Props:
    formula    string   Chemical formula or compound name
    showBonds  boolean  Show bond information (default: false)
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")
local Color = require("lua.color")

local function getThemeColors()
  local theme = ReactJIT and ReactJIT.getTheme and ReactJIT.getTheme()
  return (theme and theme.colors) or {}
end

Capabilities.register("MoleculeCard", {
  visual = true,

  schema = {
    formula   = { type = "string", default = "H2O", desc = "Chemical formula or compound name" },
    showBonds = { type = "bool",   default = false,  desc = "Show bond information" },
  },

  events = {},

  create = function(nodeId, props)
    return {
      molecule = nil,
      prevFormula = nil,
    }
  end,

  update = function(nodeId, props, prev, state)
    if props.formula ~= state.prevFormula then
      state.prevFormula = props.formula
      state.molecule = Chemistry.buildMolecule(props.formula)
    end
  end,

  destroy = function(nodeId, state) end,
  tick = function(nodeId, state, dt, pushEvent, props) end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    local mol = state.molecule
    if not mol then return end

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

    -- Formula + name header
    local tr, tg, tb = Color.parse(tc.text or "#cad3f5")
    love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
    love.graphics.print(mol.formula or "?", padX, curY)

    if mol.name then
      local dr, dg, db = Color.parse(tc.textDim or "#a5adcb")
      love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
      local nameX = padX + font:getWidth(mol.formula or "?") + 10
      love.graphics.print(mol.name, nameX, curY)
    end
    curY = curY + lineH + 4

    -- Info chips row
    local chipX = padX
    local chipGap = 8
    local sr, sg, sb = Color.parse(tc.surface or "#363a4f")
    local dr, dg, db = Color.parse(tc.textDim or "#a5adcb")

    local function drawChip(label, value)
      local lw = font:getWidth(label)
      local vw = font:getWidth(value)
      local cw = math.max(lw, vw) + 12
      local ch = lineH * 2 + 2

      love.graphics.setColor(sr or 0.2, sg or 0.2, sb or 0.25, opacity)
      love.graphics.rectangle("fill", chipX, curY, cw, ch, 4, 4)

      love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
      love.graphics.print(label, chipX + 6, curY + 1)

      love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
      love.graphics.print(value, chipX + 6, curY + lineH)

      chipX = chipX + cw + chipGap
      if chipX + 40 > x + w then
        chipX = padX
        curY = curY + ch + chipGap
      end
    end

    drawChip("Molar Mass", string.format("%.3f g/mol", mol.molarMass or 0))
    if mol.geometry then drawChip("Geometry", mol.geometry) end
    if mol.polarity then drawChip("Polarity", mol.polarity) end

    -- Atom count
    local totalAtoms = 0
    if mol.atoms then
      for _, a in ipairs(mol.atoms) do totalAtoms = totalAtoms + a.count end
    end
    drawChip("Atoms", tostring(totalAtoms))

    curY = curY + lineH * 2 + 8

    -- Composition by mass
    if mol.atoms and mol.molarMass and mol.molarMass > 0 then
      love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, opacity)
      love.graphics.print("Composition by mass", padX, curY)
      curY = curY + lineH + 2

      local compX = padX
      for _, a in ipairs(mol.atoms) do
        local el = Chemistry.getElement(a.symbol)
        if el then
          local pct = math.floor((el.mass * a.count / mol.molarMass) * 10000 + 0.5) / 100

          -- CPK color dot
          local cr, cg, cb = Color.parse(el.cpkColor or "#888888")
          love.graphics.setColor(cr or 0.5, cg or 0.5, cb or 0.5, opacity)
          love.graphics.circle("fill", compX + 6, curY + font:getHeight() / 2, 5)

          -- Symbol + percentage
          love.graphics.setColor(tr or 0.8, tg or 0.8, tb or 0.85, opacity)
          local txt = string.format("%s %.1f%%", a.symbol, pct)
          love.graphics.print(txt, compX + 14, curY)

          compX = compX + font:getWidth(txt) + 22
          if compX + 40 > x + w then
            compX = padX
            curY = curY + lineH
          end
        end
      end
      curY = curY + lineH
    end

    -- IUPAC name
    if mol.iupac then
      love.graphics.setColor(dr or 0.6, dg or 0.6, db or 0.7, 0.7 * opacity)
      love.graphics.print("IUPAC: " .. mol.iupac, padX, curY + 4)
    end
  end,
})
