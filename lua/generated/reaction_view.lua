--[[
  capabilities/reaction_view.lua — Auto-generated from ReactionView.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/ReactionView.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
local Formulas = require("lua.generated.chemistry.formulas")

local function computeData(props)
  if (!props.equation or props.equation == "") return { rxn = null }
  
      // ── Balancer (scoped to this component) ──────────────────────────
  
      local ENTHALPIES = Record<string, number> = {
        {"2H2 + O2 -> 2H2O"} =              -571.6,
        {"C + O2 -> CO2"} =                 -393.5,
        {"CH4 + 2O2 -> CO2 + 2H2O"} =      -890.4,
        {"N2 + 3H2 -> 2NH3"} =             -92.2,
        {"C3H8 + 5O2 -> 3CO2 + 4H2O"} =    -2220,
        {"2C2H6 + 7O2 -> 4CO2 + 6H2O"} =   -3120,
        {"CaCO3 -> CaO + CO2"} =           178.1,
        {"2H2O -> 2H2 + O2"} =             571.6,
        {"Fe2O3 + 3CO -> 2Fe + 3CO2"} =    -24.8,
        {"2Na + Cl2 -> 2NaCl"} =           -822.2,
        {"C6H12O6 + 6O2 -> 6CO2 + 6H2O"} = -2803,
      }
  
      function parseSide(side = string) {
        local terms = { coefficient = number; formula = string }{} = {}
        for (local raw of side.split('+')) {
          local term = raw.trim()
          local m = term.match(/^(\d+)\s*(.+)$/)
          if (m) {
            terms.push({ coefficient = parseInt(m[1]), formula = m[2] })
          } else {
            terms.push({ coefficient = 1, formula = term })
          }
        }
        return terms
      }
  
      function atomCounts(sides = { formula = string }{}, coeffs = number[], offset = number) {
        local counts = Record<string, number> = {}
        for (local i = 0; i < sides.length; i++) {
          local coef = coeffs[offset + i]
          for (local a of Formulas.parseFormula(sides[i].formula)) {
            counts[a.symbol] = (counts[a.symbol] or 0) + a.count * coef
          }
        }
        return counts
      }
  
      function countsMatch(r = Record<string, number>, p = Record<string, number>) {
        for (local k in r) { if ((p[k] or 0) ~= r[k]) return false }
        for (local k in p) { if ((r[k] or 0) ~= p[k]) return false }
        return true
      }
  
      function classifyReaction(reactants = { formula = string }{}, products = { formula = string }{}) {
        local rn = reactants.length
        local pn = products.length
        local hasO2 = false, hasCO2 = false, hasH2O = false
        for (local s of reactants) { if (s.formula == 'O2') hasO2 = true }
        for (local s of products) { if (s.formula == 'CO2') hasCO2 = true }
        for (local s of products) { if (s.formula == 'H2O') hasH2O = true }
        if (hasO2 and hasCO2 and hasH2O) return 'combustion'
        if (rn >= 2 and pn == 1) return 'synthesis'
        if (rn == 1 and pn >= 2) return 'decomposition'
        if (rn == 2 and pn == 2) {
          local r1 = Formulas.parseFormula(reactants[0].formula)
          local r2 = Formulas.parseFormula(reactants[1].formula)
          if (r1.length == 1 or r2.length == 1) return 'single-replacement'
          return 'double-replacement'
        }
        return null
      }
  
      function formatEquation(reactants = { coefficient = number; formula = string }{},
                              products = { coefficient = number; formula = string }{}) {
        function fmtSide(sides = { coefficient = number; formula = string }{}) {
          return sides.map(s =(> (s.coefficient > 1) and String(s.coefficient) or '') + s.formula).join(' + ')
        }
        return fmtSide(reactants) + ' -> ' + fmtSide(products)
      }
  
      function balanceEquation(equation = string) {
        local eq = equation.replace(/\s+/g, ' ').trim()
        eq = eq.replace('\u{ 2192 = 2192 }', ' -> ')
        eq = eq.replace(/\s*{=\-}+>\s*/, ' -> ')
        eq = eq.replace(/\s+/g, ' ')
        local parts = eq.split('->')
        if (parts.length ~= 2) {
          return { equation, balanced = equation, reactants = {}, products = {}, isBalanced = false }
        }
        local reactants = parseSide(parts[0])
        local products = parseSide(parts[1])
        local r0 = atomCounts(reactants, reactants.map(r => r.coefficient), 0)
        local p0 = atomCounts(products, products.map(p => p.coefficient), 0)
        if (countsMatch(r0, p0)) {
          local balanced = formatEquation(reactants, products)
          return {
            equation, balanced, reactants, products,
            type = classifyReaction(reactants, products),
            isBalanced = true,
            enthalpy = ENTHALPIES[balanced],
          }
        }
        local n = reactants.length + products.length
        local maxCoeff = 10
        local coeffs = number[] = new Array(n).fill(1)
        local found = false
        function search(idx = number): boolean {
          if (idx >= n) {
            local r = atomCounts(reactants, coeffs, 0)
            local p = atomCounts(products, coeffs, reactants.length)
            if (countsMatch(r, p)) { found = true; return true }
            return false
          }
          for (local c = 1; c <= maxCoeff; c++) {
            coeffs[idx] = c
            if (search(idx + 1)) return true
          }
          return false
        }
        search(0)
        if (found) {
          local bReactants = reactants.map((s, i) => ({ coefficient = coeffs[i], formula = s.formula }))
          local bProducts = products.map((s, i) => ({ coefficient = coeffs[reactants.length + i], formula = s.formula }))
          local balanced = formatEquation(bReactants, bProducts)
          return {
            equation, balanced, reactants = bReactants, products = bProducts,
            type = classifyReaction(bReactants, bProducts),
            isBalanced = true,
            enthalpy = ENTHALPIES[balanced],
          }
        }
        return { equation, balanced = equation, reactants, products, isBalanced = false }
      }
  
      // ── Use the balancer ─────────────────────────────────────────────
  
      local rxn = balanceEquation(props.equation)
      if (!rxn) return { rxn = null }
  
      local renderParts = {}
      if (rxn.reactants) {
        for (local i = 0; i < rxn.reactants.length; i++) {
          if (i > 0) renderParts.push({ text = " + ", color = "#a5adcb" })
          local r = rxn.reactants[i]
          if (r.coefficient > 1) renderParts.push({ text = tostring(r.coefficient), color = "#8aadf4" })
          renderParts.push({ text = r.formula, color = "#cad3f5" })
        }
      }
      renderParts.push({ text = " \u{ 2192 = 2192 } ", color = "#8aadf4" })
      if (rxn.products) {
        for (local i = 0; i < rxn.products.length; i++) {
          if (i > 0) renderParts.push({ text = " + ", color = "#a5adcb" })
          local p = rxn.products[i]
          if (p.coefficient > 1) renderParts.push({ text = tostring(p.coefficient), color = "#8aadf4" })
          renderParts.push({ text = p.formula, color = "#cad3f5" })
        }
      }
  
      local chips = {}
      chips.push({
        label = rxn.isBalanced ? {"Balanced"} = "Unbalanced",
        bgColor = rxn.isBalanced ? {"rgba(43,138,62,0.15)"} = "rgba(224,56,56,0.15)",
        textColor = rxn.isBalanced ? {"#2b8a3e"} = "#e03838",
      })
      if (rxn.type) {
        chips.push({ label = rxn.type, bgColor = "#2a2a3a", textColor = "#a5adcb" })
      }
  
      local enthalpyChip = null
      if (props.showEnergy ~= false and rxn.enthalpy) {
        local isExo = rxn.enthalpy < 0
        enthalpyChip = {
          label = isExo ? {"Exothermic"} = "Endothermic",
          value = string.format("\u{ 0394 = 0394 }H = %.1f kJ/mol", rxn.enthalpy),
          bgColor = isExo ? {"rgba(23,100,171,0.15)"} = "rgba(201,33,0,0.15)",
        }
      }
  
      return { rxn, parts = renderParts, chips, enthalpyChip }
end
local function rebuildList_0(wrapperNodeId, items)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, part in ipairs(items) do
    tmpl[#tmpl + 1] =
    { type = "Text", key = "li_0_" .. _i, style = { fontSize = 14, color = part.color }, children = {
      { type = "__TEXT__", key = "li_0_e1_" .. _i, text = part.text or "" }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function rebuildList_1(wrapperNodeId, items)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, chip in ipairs(items) do
    tmpl[#tmpl + 1] =
    { type = "View", key = "li_0_" .. _i, style = { backgroundColor = chip.bgColor, borderRadius = 4, paddingTop = 2, paddingBottom = 2, paddingLeft = 6, paddingRight = 6 }, children = {
      { type = "Text", key = "li_0_1_" .. _i, style = { fontSize = 12, color = chip.textColor }, children = {
        { type = "__TEXT__", key = "li_0_1_e2_" .. _i, text = chip.label or "" }
        } }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function buildTemplate()
  return {
    { type = "View", key = "n0", style = { backgroundColor = "#363a4f", borderRadius = 8, paddingTop = 12, paddingBottom = 12, paddingLeft = 12, paddingRight = 12, width = "100%", height = "100%" }, children = {
      { type = "View", key = "n0_3_1", style = { flexDirection = "row", flexWrap = "wrap", marginBottom = 10 }, children = {
        { type = "View", key = "n0_3_1_1_list_0", style = { flexDirection = "row", flexWrap = "wrap" } },
        } },
      { type = "View", key = "n0_7_2", style = { flexDirection = "row", flexWrap = "wrap", gap = 8 }, children = {
        { type = "View", key = "n0_7_2_1_list_1", style = { flexDirection = "row", flexWrap = "wrap", gap = 8 } },
        { type = "View", key = "n0_7_2_3_3", style = { borderRadius = 4, paddingTop = 2, paddingBottom = 2, paddingLeft = 6, paddingRight = 6, display = "none" }, children = {
          { type = "Text", key = "n0_7_2_3_3_1_4", style = { fontSize = 11, color = "#a5adcb" }, children = {
            { type = "__TEXT__", key = "n0_7_2_3_3_1_4_0_t", text = "" },
            } },
          { type = "Text", key = "n0_7_2_3_3_3_5", style = { fontSize = 12, color = "#cad3f5" }, children = {
            { type = "__TEXT__", key = "n0_7_2_3_3_3_5_0_t", text = "" },
            } },
          } },
        } },
      } },
  }
end

local function updateTree(handles, props)
  local data = computeData(props)
  Tree.updateChildProps(handles["n0_7_2_3_3"], { style = { display = (data.enthalpyChip) and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_7_2_3_3"], { style = { backgroundColor = data.enthalpyChip.bgColor } })
  Tree.updateChildProps(handles["n0_7_2_3_3_1_4_0_t"], { text = data.enthalpyChip.label or "" })
  Tree.updateChildProps(handles["n0_7_2_3_3_3_5_0_t"], { text = data.enthalpyChip.value or "" })
  rebuildList_0(handles["n0_3_1_1_list_0"], data.parts)
  rebuildList_1(handles["n0_7_2_1_list_1"], data.chips)
end

Capabilities.register("ReactionView", {
  visual = false,

  schema = {
    equation = { type = "string", default = "", desc = "Chemical equation to balance" },
    showEnergy = { type = "bool", default = true, desc = "Show enthalpy" },
    animated = { type = "bool", default = false, desc = "Reserved for animation" },
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

--- Would write to: /home/siah/creative/reactjit/examples/tslx-demo/lua/capabilities/reaction_view.lua ---
