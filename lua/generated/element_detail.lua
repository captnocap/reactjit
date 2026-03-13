--[[
  capabilities/element_detail.lua — Auto-generated from ElementDetail.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/ElementDetail.tslx
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
  local catColor = CATEGORY_COLORS[el.category] or "#868e96"
  local categoryLabel = string.gsub(el.category, "-", " ")
  local chips = {
    { label = "Group", value = tostring(el.group) },
    { label = "Period", value = tostring(el.period) },
    { label = "Phase", value = el.phase },
    { label = "Valence e-", value = tostring(valence) },
  }
  if el.electronegativity then
    table.insert(chips, {
      label = "EN",
      value = tostring(el.electronegativity),
    })
  end
  if el.meltingPoint then
    table.insert(chips, {
      label = "MP",
      value = string.format("%.0f K", el.meltingPoint),
    })
  end
  if el.boilingPoint then
    table.insert(chips, {
      label = "BP",
      value = string.format("%.0f K", el.boilingPoint),
    })
  end
  if el.density then
    table.insert(chips, {
      label = "Density",
      value = string.format("%.2f g/cm³", el.density),
    })
  end
  return {
    el = el,
    catColor = catColor,
    categoryLabel = categoryLabel,
    chips = chips,
  }
end
local function rebuildList_0(wrapperNodeId, items, data)
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

local function buildTemplate()
  return {
    { type = "View", key = "n0", style = { backgroundColor = "#363a4f", borderRadius = 8, paddingTop = 12, paddingBottom = 12, paddingLeft = 12, paddingRight = 12, width = "100%" }, children = {
      { type = "View", key = "n0_3_1", style = { flexDirection = "row", gap = 12, marginBottom = 10 }, children = {
        { type = "View", key = "n0_3_1_1_2", style = { width = 56, height = 56, borderRadius = 8, alignItems = "center", justifyContent = "center" }, children = {
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
          { type = "Text", key = "n0_3_1_3_5_5_8", style = { fontSize = 12, color = "#a5adcb" }, children = {
            { type = "__TEXT__", key = "n0_3_1_3_5_5_8_0_t", text = "" },
            } },
          } },
        } },
      { type = "View", key = "n0_7_9", style = { flexDirection = "row", flexWrap = "wrap", gap = 8 }, children = {
        { type = "View", key = "n0_7_9_1_list_0", style = { flexDirection = "row", flexWrap = "wrap", gap = 8 } },
        } },
      { type = "Text", key = "n0_11_10", style = { fontSize = 11, color = "#a5adcb", marginTop = 8, opacity = 0.7, display = "none" }, children = {
        { type = "__TEXT__", key = "n0_11_10_1_t", text = "" },
        } },
      } },
  }
end

local function updateTree(handles, props)
  local data = computeData(props)
  Tree.updateChildProps(handles["n0_11_10"], { style = { display = (data.el.electronConfig) and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_3_1_1_2"], { style = { backgroundColor = data.catColor } })
  Tree.updateChildProps(handles["n0_3_1_1_2_1_3_0_t"], { text = data.el.number or "" })
  Tree.updateChildProps(handles["n0_3_1_1_2_3_4_0_t"], { text = data.el.symbol or "" })
  Tree.updateChildProps(handles["n0_3_1_3_5_1_6_0_t"], { text = data.el.name or "" })
  Tree.updateChildProps(handles["n0_3_1_3_5_3_7_0_t"], { text = string.format("%.3f u", data.el.mass) or "" })
  Tree.updateChildProps(handles["n0_3_1_3_5_5_8_0_t"], { text = data.categoryLabel or "" })
  Tree.updateChildProps(handles["n0_11_10_1_t"], { text = data.el.electronConfig or "" })
  rebuildList_0(handles["n0_7_9_1_list_0"], data.chips, data)
end

Capabilities.register("TslxElementDetail", {
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

--- Would write to: /home/siah/creative/reactjit/examples/tslx-demo/lua/capabilities/element_detail.lua ---
