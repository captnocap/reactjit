--[[
  capabilities/element_card.lua — Auto-generated from ElementCard.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/ElementCard.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
local Chemistry = require("lua.generated.chemistry.elements")

local function computeData(props)
  local el = Chemistry.getElement(props.element)
  if not el then
    return { el = { symbol = "?", number = 0, mass = 0, name = "Unknown", category = "unknown" }, bg = "#868e96", valence = 0 }
  end
  local valence = Chemistry.valenceElectrons(el.number)
  local CATEGORY_COLORS = {
    ["alkali-metal"] = "#7b6faa",
    ["alkaline-earth"] = "#9a9cc4",
    ["transition-metal"] = "#de9a9a",
    ["post-transition-metal"] = "#8fbc8f",
    ["metalloid"] = "#c8c864",
    ["nonmetal"] = "#59b5e6",
    ["halogen"] = "#d4a844",
    ["noble-gas"] = "#c87e4a",
    ["lanthanide"] = "#c45879",
    ["actinide"] = "#d4879a",
  }
  local PHASE_COLORS = {
    solid = "#69db7c",
    liquid = "#4dabf7",
    gas = "#ffd43b",
    unknown = "#868e96",
  }
  local catColor = CATEGORY_COLORS[el.category] or "#868e96"
  local phaseColor = PHASE_COLORS[el.phase] or "#868e96"
  local rows = {
    {
    label = "Atomic Mass",
    value = string.format("%.3f u", el.mass),
  },
    { label = "Group", value = tostring(el.group) },
    { label = "Period", value = tostring(el.period) },
    { label = "Phase", value = el.phase, color = phaseColor },
    { label = "Valence Electrons", value = tostring(valence) },
    {
    label = "Electronegativity",
    value = (el.electronegativity and tostring(el.electronegativity) or "—"),
  },
    {
    label = "Melting Point",
    value = (el.meltingPoint and string.format("%.0f K", el.meltingPoint) or "—"),
  },
    {
    label = "Boiling Point",
    value = (el.boilingPoint and string.format("%.0f K", el.boilingPoint) or "—"),
  },
    {
    label = "Density",
    value = (el.density and string.format("%.3f g/cm³", el.density) or "—"),
  },
    {
    label = "Electron Config",
    value = el.electronConfig or "",
  },
  }
  local categoryLabel = string.gsub(el.category, "-", " ")
  return {
    el = el,
    catColor = catColor,
    rows = rows,
    categoryLabel = categoryLabel,
  }
end
local function rebuildList_0(wrapperNodeId, items, data)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, row in ipairs(items) do
    tmpl[#tmpl + 1] =
    { type = "View", key = "li_0_" .. _i, style = { flexDirection = "row", justifyContent = "space-between" }, children = {
      { type = "Text", key = "li_0_1_" .. _i, style = { fontSize = 12, color = "#a5adcb" }, children = {
        { type = "__TEXT__", key = "li_0_1_e2_" .. _i, text = row.label or "" }
        } },
      { type = "Text", key = "li_0_3_" .. _i, style = { fontSize = 12, color = (row.color) or ("#cad3f5") }, children = {
        { type = "__TEXT__", key = "li_0_3_e4_" .. _i, text = row.value or "" }
        } }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function buildTemplate()
  return {
    { type = "View", key = "n0", style = { borderRadius = 8, backgroundColor = "#363a4f", paddingTop = 12, paddingBottom = 12, paddingLeft = 12, paddingRight = 12, borderWidth = 2, width = "100%" }, children = {
      { type = "View", key = "n0_3_1", style = { flexDirection = "row", gap = 10, marginBottom = 12 }, children = {
        { type = "View", key = "n0_3_1_1_2", style = { width = 44, height = 44, borderRadius = 6, alignItems = "center", justifyContent = "center" }, children = {
          { type = "Text", key = "n0_3_1_1_2_1_3", style = { fontSize = 10, color = "rgba(0,0,0,0.6)" }, children = {
            { type = "__TEXT__", key = "n0_3_1_1_2_1_3_0_t", text = "" },
            } },
          { type = "Text", key = "n0_3_1_1_2_3_4", style = { fontSize = 16, color = "#000000" }, children = {
            { type = "__TEXT__", key = "n0_3_1_1_2_3_4_0_t", text = "" },
            } },
          } },
        { type = "View", key = "n0_3_1_3_5", style = { justifyContent = "center" }, children = {
          { type = "Text", key = "n0_3_1_3_5_1_6", style = { fontSize = 14, color = "#cad3f5" }, children = {
            { type = "__TEXT__", key = "n0_3_1_3_5_1_6_0_t", text = "" },
            } },
          { type = "Text", key = "n0_3_1_3_5_3_7", style = { fontSize = 12, color = "#a5adcb" }, children = {
            { type = "__TEXT__", key = "n0_3_1_3_5_3_7_0_t", text = "" },
            } },
          } },
        } },
      { type = "View", key = "n0_7_list_0" },
      } },
  }
end

local function updateTree(handles, props)
  local data = computeData(props)
  Tree.updateChildProps(handles["n0_3_1_1_2"], { style = { backgroundColor = data.catColor } })
  Tree.updateChildProps(handles["n0"], { style = { borderColor = data.catColor } })
  Tree.updateChildProps(handles["n0_3_1_1_2_1_3_0_t"], { text = data.el.number or "" })
  Tree.updateChildProps(handles["n0_3_1_1_2_3_4_0_t"], { text = data.el.symbol or "" })
  Tree.updateChildProps(handles["n0_3_1_3_5_1_6_0_t"], { text = data.el.name or "" })
  Tree.updateChildProps(handles["n0_3_1_3_5_3_7_0_t"], { text = data.categoryLabel or "" })
  rebuildList_0(handles["n0_7_list_0"], data.rows, data)
end

Capabilities.register("TslxElementCard", {
  visual = false,

  schema = {
    element = { type = "number", default = 1, desc = "Atomic number or symbol" },
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

--- Would write to: /home/siah/creative/reactjit/examples/tslx-demo/lua/capabilities/element_card.lua ---
