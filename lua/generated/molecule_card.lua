--[[
  capabilities/molecule_card.lua — Auto-generated from MoleculeCard.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/MoleculeCard.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
local Elements = require("lua.generated.chemistry.elements")
local Compounds = require("lua.generated.chemistry.compounds")
local Formulas = require("lua.generated.chemistry.formulas")

local function computeData(props)
  // ── Molecule builder (scoped to this component) ──────────────────
  
      function buildMolecule(formulaOrName = string) {
        local formula = formulaOrName
        local info = Compounds.COMPOUNDS[formula]
        if (!info) {
          local byName = Compounds.BY_NAME[formulaOrName.toLowerCase()]
          if (byName) {
            formula = byName
            info = Compounds.COMPOUNDS[formula]
          }
        }
        local atoms = Formulas.parseFormula(formula)
        local mm = Formulas.molarMass(formula)
        return {
          formula,
          name = info ? info.name = null,
          iupac = info ? info.iupac = null,
          atoms,
          molarMass = mm,
          geometry = info ? info.geometry = null,
          polarity = info ? info.polarity = null,
        }
      }
  
      // ── Use it ───────────────────────────────────────────────────────
  
      local mol = buildMolecule(props.formula)
      if (!mol) return { mol = null, chips = {}, atoms = {}, totalAtoms = 0 }
  
      local chips = {
        { label = "Molar Mass", value = string.format("%.3f g/mol", mol.molarMass or 0) },
      }
      if (mol.geometry) chips.push({ label = "Geometry", value = mol.geometry })
      if (mol.polarity) chips.push({ label = "Polarity", value = mol.polarity })
  
      local totalAtoms = 0
      local atoms = {}
      if (mol.atoms) {
        for (local a of mol.atoms) {
          totalAtoms = totalAtoms + a.count
          local el = Elements.getElement(a.symbol)
          if (el and mol.molarMass > 0) {
            local pct = math.floor((el.mass * a.count / mol.molarMass) * 10000 + 0.5) / 100
            atoms.push({ symbol = a.symbol, pct, color = el.cpkColor or "#888888" })
          }
        }
      }
      chips.push({ label = "Atoms", value = tostring(totalAtoms) })
  
      return { mol = mol, chips = chips, atoms = atoms, totalAtoms = totalAtoms }
end
local function rebuildList_0(wrapperNodeId, items)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, chip in ipairs(items) do
    tmpl[#tmpl + 1] =
    { type = "View", key = "li_0_" .. _i, style = { backgroundColor = "#2a2a3a", borderRadius = 4, paddingTop = 2, paddingBottom = 2, paddingLeft = 6, paddingRight = 6 }, children = {
      { type = "Text", key = "li_0_1_" .. _i, style = { fontSize = 11, color = "#a5adcb" }, children = {
        { type = "__TEXT__", key = "li_0_1_e2_" .. _i, text = chip.label or "" }
        } },
      { type = "Text", key = "li_0_3_" .. _i, style = { fontSize = 12, color = "#cad3f5" }, children = {
        { type = "__TEXT__", key = "li_0_3_e4_" .. _i, text = chip.value or "" }
        } }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function rebuildList_1(wrapperNodeId, items)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, a in ipairs(items) do
    tmpl[#tmpl + 1] =
    { type = "View", key = "li_0_" .. _i, style = { flexDirection = "row", gap = 4, alignItems = "center" }, children = {
      { type = "View", key = "li_0_1_" .. _i, style = { width = 10, height = 10, borderRadius = 5, backgroundColor = a.color } },
      { type = "Text", key = "li_0_2_" .. _i, style = { fontSize = 12, color = "#cad3f5" }, children = {
        { type = "__TEXT__", key = "li_0_2_e3_" .. _i, text = `${a.symbol} ${string.format("%.1f%%", a.pct)}` or "" }
        } }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function buildTemplate()
  return {
    { type = "View", key = "n0", style = { backgroundColor = "#363a4f", borderRadius = 8, paddingTop = 12, paddingBottom = 12, paddingLeft = 12, paddingRight = 12, width = "100%", height = "100%" }, children = {
      { type = "View", key = "n0_3_1", style = { flexDirection = "row", gap = 10, marginBottom = 8 }, children = {
        { type = "Text", key = "n0_3_1_1_2", style = { fontSize = 14, color = "#cad3f5" }, children = {
          { type = "__TEXT__", key = "n0_3_1_1_2_0_t", text = "" },
          } },
        { type = "Text", key = "n0_3_1_3_3", style = { fontSize = 14, color = "#a5adcb", display = "none" }, children = {
          { type = "__TEXT__", key = "n0_3_1_3_3_0_t", text = "" },
          } },
        } },
      { type = "View", key = "n0_7_4", style = { flexDirection = "row", flexWrap = "wrap", gap = 8, marginBottom = 8 }, children = {
        { type = "View", key = "n0_7_4_1_list_0", style = { flexDirection = "row", flexWrap = "wrap", gap = 8 } },
        } },
      { type = "View", key = "n0_11_5", style = { display = "none" }, children = {
        { type = "Text", key = "n0_11_5_1_6", style = { fontSize = 12, color = "#a5adcb", marginBottom = 4 }, children = {
          { type = "__TEXT__", key = "n0_11_5_1_6_0_t", text = "Composition by mass" },
          } },
        { type = "View", key = "n0_11_5_3_7", style = { flexDirection = "row", flexWrap = "wrap", gap = 10 }, children = {
          { type = "View", key = "n0_11_5_3_7_1_list_1", style = { flexDirection = "row", flexWrap = "wrap", gap = 10 } },
          } },
        } },
      { type = "Text", key = "n0_15_8", style = { fontSize = 11, color = "#a5adcb", marginTop = 8, opacity = 0.7, display = "none" }, children = {
        { type = "__TEXT__", key = "n0_15_8_1_t", text = "" },
        } },
      } },
  }
end

local function updateTree(handles, props)
  local data = computeData(props)
  Tree.updateChildProps(handles["n0_3_1_3_3"], { style = { display = (data.mol.name) and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_11_5"], { style = { display = (data.atoms.length > 0) and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_15_8"], { style = { display = (data.mol.iupac) and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_3_1_1_2_0_t"], { text = data.mol.formula or "?" or "" })
  Tree.updateChildProps(handles["n0_3_1_3_3_0_t"], { text = data.mol.name or "" })
  Tree.updateChildProps(handles["n0_15_8_1_t"], { text = "IUPAC = " .. data.mol.iupac or "" })
  rebuildList_0(handles["n0_7_4_1_list_0"], data.chips)
  rebuildList_1(handles["n0_11_5_3_7_1_list_1"], data.atoms)
end

Capabilities.register("MoleculeCard", {
  visual = false,

  schema = {
    formula = { type = "string", default = "H2O", desc = "Chemical formula or compound name" },
    showBonds = { type = "bool", default = false, desc = "Show bond information" },
  },

  events = {},

  create = function(nodeId, props)
    local handles = Tree.declareChildren(nodeId, buildTemplate())
    updateTree(handles, props)
    return { handles = handles }
  end,

  update = function(nodeId, props, prev, state)
    updateTree(state.handles, props)
  end,

  destroy = function(nodeId, state)
    Tree.removeDeclaredChildren(nodeId)
  end,

  tick = function() end,
})

--- Would write to: /home/siah/creative/reactjit/examples/tslx-demo/lua/capabilities/molecule_card.lua ---
