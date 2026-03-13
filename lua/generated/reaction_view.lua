--[[
  capabilities/reaction_view.lua — Auto-generated from ReactionView.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/ReactionView.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
local Formulas = require("lua.generated.chemistry.formulas")

local __tsl = require("lua.tsl_stdlib")

local function computeData(props)
  if not props.equation or props.equation == "" then
    return { rxn = nil }
  end
  -- ── Balancer (scoped to this component) ──────────────────────────
  local ENTHALPIES = {
    ["2H2 + O2 -> 2H2O"] = -571.6,
    ["C + O2 -> CO2"] = -393.5,
    ["CH4 + 2O2 -> CO2 + 2H2O"] = -890.4,
    ["N2 + 3H2 -> 2NH3"] = -92.2,
    ["C3H8 + 5O2 -> 3CO2 + 4H2O"] = -2220,
    ["2C2H6 + 7O2 -> 4CO2 + 6H2O"] = -3120,
    ["CaCO3 -> CaO + CO2"] = 178.1,
    ["2H2O -> 2H2 + O2"] = 571.6,
    ["Fe2O3 + 3CO -> 2Fe + 3CO2"] = -24.8,
    ["2Na + Cl2 -> 2NaCl"] = -822.2,
    ["C6H12O6 + 6O2 -> 6CO2 + 6H2O"] = -2803,
  }
  local function parseSide(side)
    local terms = {}
    for _, raw in ipairs(__tsl.split(side, "+")) do
      local term = raw:match("^%s*(.-)%s*$")
      local m = string.match(term, "^(%d+)%s*(.+)$")
      if m then
        table.insert(terms, { coefficient = tonumber(m[2]), formula = m[3] })
      else
        table.insert(terms, { coefficient = 1, formula = term })
      end
    end
    return terms
  end
  local function atomCounts(sides, coeffs, offset)
    local counts = {}
    for i = 1, #sides do
      local coef = coeffs[offset + i]
      for _, a in ipairs(Formulas.parseFormula(sides[i].formula)) do
        counts[a.symbol] = (counts[a.symbol] or 0) + a.count * coef
      end
    end
    return counts
  end
  local function countsMatch(r, p)
    for k, _ in pairs(r) do
      if (p[k] or 0) ~= r[k] then
        return false
      end
    end
    for k, _ in pairs(p) do
      if (r[k] or 0) ~= p[k] then
        return false
      end
    end
    return true
  end
  local function classifyReaction(reactants, products)
    local rn = #reactants
    local pn = #products
    local hasO2 = false
    local hasCO2 = false
    local hasH2O = false
    for _, s in ipairs(reactants) do
      if s.formula == "O2" then
        hasO2 = true
      end
    end
    for _, s in ipairs(products) do
      if s.formula == "CO2" then
        hasCO2 = true
      end
    end
    for _, s in ipairs(products) do
      if s.formula == "H2O" then
        hasH2O = true
      end
    end
    if hasO2 and hasCO2 and hasH2O then
      return "combustion"
    end
    if rn >= 2 and pn == 1 then
      return "synthesis"
    end
    if rn == 1 and pn >= 2 then
      return "decomposition"
    end
    if rn == 2 and pn == 2 then
      local r1 = Formulas.parseFormula(reactants[1].formula)
      local r2 = Formulas.parseFormula(reactants[2].formula)
      if #r1 == 1 or #r2 == 1 then
        return "single-replacement"
      end
      return "double-replacement"
    end
    return nil
  end
  local function formatEquation(reactants, products)
    local function fmtSide(sides)
      return table.concat(__tsl.map(sides, function(s) return ((s.coefficient > 1 and tostring(s.coefficient) or "")) .. s.formula end), " + ")
    end
    return fmtSide(reactants) .. " -> " .. fmtSide(products)
  end
  local function balanceEquation(equation)
    local eq = string.gsub(equation, "%s+", " "):match("^%s*(.-)%s*$")
    eq = string.gsub(eq, "→", " -> ")
    eq = string.gsub(eq, "%s*[=\\-]+>%s*", " -> ")
    eq = string.gsub(eq, "%s+", " ")
    local parts = __tsl.split(eq, "->")
    if #parts ~= 2 then
      return {
        equation = equation,
        balanced = equation,
        reactants = {},
        products = {},
        isBalanced = false,
      }
    end
    local reactants = parseSide(parts[1])
    local products = parseSide(parts[2])
    local r0 = atomCounts(reactants, __tsl.map(reactants, function(r) return r.coefficient end), 0)
    local p0 = atomCounts(products, __tsl.map(products, function(p) return p.coefficient end), 0)
    if countsMatch(r0, p0) then
      local balanced = formatEquation(reactants, products)
      return {
        equation = equation,
        balanced = balanced,
        reactants = reactants,
        products = products,
        type = classifyReaction(reactants, products),
        isBalanced = true,
        enthalpy = ENTHALPIES[balanced],
      }
    end
    local n = #reactants + #products
    local maxCoeff = 10
    local coeffs = __tsl.arrayFill(n, 1)
    local found = false
    local function search(idx)
      if idx >= n then
        local r = atomCounts(reactants, coeffs, 0)
        local p = atomCounts(products, coeffs, #reactants)
        if countsMatch(r, p) then
          found = true
          return true
        end
        return false
      end
      for c = 1, maxCoeff do
        coeffs[idx] = c
        if search(idx + 1) then
          return true
        end
      end
      return false
    end
    search(0)
    if found then
      local bReactants = __tsl.map(reactants, function(s, i) return ({ coefficient = coeffs[i], formula = s.formula }) end)
      local bProducts = __tsl.map(products, function(s, i) return ({
        coefficient = coeffs[#reactants + i],
        formula = s.formula,
      }) end)
      local balanced = formatEquation(bReactants, bProducts)
      return {
        equation = equation,
        balanced = balanced,
        reactants = bReactants,
        products = bProducts,
        type = classifyReaction(bReactants, bProducts),
        isBalanced = true,
        enthalpy = ENTHALPIES[balanced],
      }
    end
    return {
      equation = equation,
      balanced = equation,
      reactants = reactants,
      products = products,
      isBalanced = false,
    }
  end
  -- ── Use the balancer ─────────────────────────────────────────────
  local rxn = balanceEquation(props.equation)
  if not rxn then
    return { rxn = nil }
  end
  local renderParts = {}
  if rxn.reactants then
    for i = 1, #rxn.reactants do
      if i > 0 then
        table.insert(renderParts, { text = " + ", color = "#a5adcb" })
      end
      local r = rxn.reactants[i]
      if r.coefficient > 1 then
        table.insert(renderParts, {
          text = tostring(r.coefficient),
          color = "#8aadf4",
        })
      end
      table.insert(renderParts, { text = r.formula, color = "#cad3f5" })
    end
  end
  table.insert(renderParts, { text = " → ", color = "#8aadf4" })
  if rxn.products then
    for i = 1, #rxn.products do
      if i > 0 then
        table.insert(renderParts, { text = " + ", color = "#a5adcb" })
      end
      local p = rxn.products[i]
      if p.coefficient > 1 then
        table.insert(renderParts, {
          text = tostring(p.coefficient),
          color = "#8aadf4",
        })
      end
      table.insert(renderParts, { text = p.formula, color = "#cad3f5" })
    end
  end
  local chips = {}
  table.insert(chips, {
    label = (rxn.isBalanced and "Balanced" or "Unbalanced"),
    bgColor = (rxn.isBalanced and "rgba(43,138,62,0.15)" or "rgba(224,56,56,0.15)"),
    textColor = (rxn.isBalanced and "#2b8a3e" or "#e03838"),
  })
  if rxn.type then
    table.insert(chips, { label = rxn.type, bgColor = "#2a2a3a", textColor = "#a5adcb" })
  end
  local enthalpyChip = nil
  if props.showEnergy ~= false and rxn.enthalpy then
    local isExo = rxn.enthalpy < 0
    enthalpyChip = {
      label = (isExo and "Exothermic" or "Endothermic"),
      value = string.format("ΔH = %.1f kJ/mol", rxn.enthalpy),
      bgColor = (isExo and "rgba(23,100,171,0.15)" or "rgba(201,33,0,0.15)"),
    }
  end
  return {
    rxn = rxn,
    parts = renderParts,
    chips = chips,
    enthalpyChip = enthalpyChip,
  }
end
local function rebuildList_0(wrapperNodeId, items, data)
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

local function rebuildList_1(wrapperNodeId, items, data)
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
  if data.enthalpyChip then
    Tree.updateChildProps(handles["n0_7_2_3_3"], { style = { backgroundColor = data.enthalpyChip.bgColor } })
    Tree.updateChildProps(handles["n0_7_2_3_3_1_4_0_t"], { text = data.enthalpyChip.label or "" })
    Tree.updateChildProps(handles["n0_7_2_3_3_3_5_0_t"], { text = data.enthalpyChip.value or "" })
  end
  rebuildList_0(handles["n0_3_1_1_list_0"], data.parts, data)
  rebuildList_1(handles["n0_7_2_1_list_1"], data.chips, data)
end

Capabilities.register("TslxReactionView", {
  visual = false,

  schema = {
    equation = { type = "string", default = "", desc = "Chemical equation to balance" },
    showEnergy = { type = "bool", default = true, desc = "Show enthalpy" },
    animated = { type = "bool", default = false, desc = "Reserved for animation" },
  },

  events = {},

  create = function(nodeId, props)
    -- Capability node fills its parent (like a React fragment)
    local node = Tree.getNodes()[nodeId]
    if node then
      if not node.style then node.style = {} end
    end
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
