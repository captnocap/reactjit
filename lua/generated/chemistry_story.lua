--[[
  capabilities/chemistry_story.lua — Auto-generated from ChemistryStory.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/ChemistryStory.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
local Elements = require("lua.generated.chemistry.elements")
local Formulas = require("lua.generated.chemistry.formulas")

local function computeData(props, state)
  local el = Elements.getElement(state.selected)
  local valence = (el and Elements.valenceElectrons(el.number) or 0)
  local DEMO_FORMULAS = {
    "H2O",
    "CO2",
    "C6H12O6",
    "C8H10N4O2",
    "NaCl",
    "CH4",
    "NH3",
    "C2H5OH",
  }
  local DEMO_REACTIONS = {
    "H2 + O2 -> H2O",
    "CH4 + O2 -> CO2 + H2O",
    "N2 + H2 -> NH3",
    "Fe2O3 + CO -> Fe + CO2",
    "C3H8 + O2 -> CO2 + H2O",
    "CaCO3 -> CaO + CO2",
  }
  local TABS = {
    { id = "table", label = "Periodic Table" },
    { id = "molecules", label = "Molecules" },
    { id = "reactions", label = "Reactions" },
  }
  local QUICK_ELEMENTS = {
    { n = 1, sym = "H" },
    { n = 6, sym = "C" },
    { n = 7, sym = "N" },
    { n = 8, sym = "O" },
    { n = 26, sym = "Fe" },
    { n = 29, sym = "Cu" },
    { n = 47, sym = "Ag" },
    { n = 79, sym = "Au" },
    { n = 92, sym = "U" },
  }
  return {
    el = el,
    valence = valence,
    DEMO_FORMULAS = DEMO_FORMULAS,
    DEMO_REACTIONS = DEMO_REACTIONS,
    TABS = TABS,
    QUICK_ELEMENTS = QUICK_ELEMENTS,
  }
end
local function rebuildList_0(wrapperNodeId, items, data, state, refresh)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, tab in ipairs(items) do
    tmpl[#tmpl + 1] =
    -- rjit-ignore-next-line
    { type = "View", key = "li_0_" .. _i, style = { paddingTop = 6, paddingBottom = 6, paddingLeft = 12, paddingRight = 12, borderRadius = 6, backgroundColor = (state.activeTab == tab.id) and "#10b981" or "#363a4f" }, handlers = { onPress = function() state.activeTab = tab.id; refresh() end }, children = {
      { type = "Text", key = "li_0_1_" .. _i, style = { fontSize = 12, color = (state.activeTab == tab.id) and "#000000" or "#a5adcb" }, children = {
        { type = "__TEXT__", key = "li_0_1_e2_" .. _i, text = tab.label or "" }
        } }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function rebuildList_1(wrapperNodeId, items, data, state, refresh)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, e in ipairs(items) do
    tmpl[#tmpl + 1] =
    -- rjit-ignore-next-line
    { type = "View", key = "li_0_" .. _i, style = { paddingTop = 4, paddingBottom = 4, paddingLeft = 8, paddingRight = 8, borderRadius = 4, backgroundColor = (state.selected == e.n) and "#10b981" or "#363a4f" }, handlers = { onPress = function() state.selected = e.n; refresh() end }, children = {
      { type = "Text", key = "li_0_1_" .. _i, style = { fontSize = 11, color = (state.selected == e.n) and "#000000" or "#cad3f5" }, children = {
        { type = "__TEXT__", key = "li_0_1_e2_" .. _i, text = e.sym or "" }
        } }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function rebuildList_2(wrapperNodeId, items, data, state, refresh)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, f in ipairs(items) do
    tmpl[#tmpl + 1] =
    -- rjit-ignore-next-line
    { type = "View", key = "li_0_" .. _i, style = { paddingTop = 4, paddingBottom = 4, paddingLeft = 8, paddingRight = 8, borderRadius = 4, backgroundColor = (state.selectedFormula == f) and "#10b981" or "#363a4f" }, handlers = { onPress = function() state.selectedFormula = f; refresh() end }, children = {
      { type = "Text", key = "li_0_1_" .. _i, style = { fontSize = 11, color = (state.selectedFormula == f) and "#000000" or "#cad3f5" }, children = {
        { type = "__TEXT__", key = "li_0_1_e2_" .. _i, text = f or "" }
        } }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function rebuildList_3(wrapperNodeId, items, data, state, refresh)
  Tree.removeDeclaredChildren(wrapperNodeId)
  if not items or #items == 0 then return end
  local tmpl = {}
  for _i, eq in ipairs(items) do
    tmpl[#tmpl + 1] =
    -- rjit-ignore-next-line
    { type = "View", key = "li_0_" .. _i, style = { paddingTop = 6, paddingBottom = 6, paddingLeft = 10, paddingRight = 10, borderRadius = 4, backgroundColor = (state.selectedReaction == eq) and "rgba(16,185,129,0.15)" or "#363a4f" }, handlers = { onPress = function() state.selectedReaction = eq; refresh() end }, children = {
      { type = "Text", key = "li_0_1_" .. _i, style = { fontSize = 12, color = (state.selectedReaction == eq) and "#10b981" or "#a5adcb" }, children = {
        { type = "__TEXT__", key = "li_0_1_e2_" .. _i, text = eq or "" }
        } }
      } }
  end
  Tree.declareChildren(wrapperNodeId, tmpl)
end

local function buildTemplate()
  return {
    { type = "ScrollView", key = "n0", style = { width = "100%", height = "100%" }, children = {
      { type = "View", key = "n0_1_1", style = { paddingTop = 24, paddingBottom = 24, paddingLeft = 24, paddingRight = 24, gap = 20 }, children = {
        { type = "View", key = "n0_1_1_3_2", children = {
          { type = "Text", key = "n0_1_1_3_2_1_3", style = { fontSize = 24, color = "#cad3f5" }, children = {
            { type = "__TEXT__", key = "n0_1_1_3_2_1_3_0_t", text = "Chemistry" },
            } },
          { type = "Text", key = "n0_1_1_3_2_3_4", style = { fontSize = 13, color = "#a5adcb", marginTop = 4 }, children = {
            { type = "__TEXT__", key = "n0_1_1_3_2_3_4_0_t", text = "Periodic table, molecules, reactions — all composed from Box + Text" },
            } },
          } },
        { type = "View", key = "n0_1_1_7_5", style = { flexDirection = "row", gap = 4 }, children = {
          { type = "View", key = "n0_1_1_7_5_1_list_0", style = { flexDirection = "row", gap = 4 } },
          } },
        { type = "View", key = "n0_1_1_11_6", style = { gap = 16, display = "none" }, children = {
          { type = "TslxPeriodicTable", key = "n0_1_1_11_6_1_7", props = { tileSize = 32 } },
          { type = "View", key = "n0_1_1_11_6_5_8", style = { flexDirection = "row", gap = 12, display = "none" }, children = {
            { type = "View", key = "n0_1_1_11_6_5_8_1_9", style = { flexGrow = 1, flexBasis = 0 }, children = {
              { type = "TslxElementCard", key = "n0_1_1_11_6_5_8_1_9_1_10" },
              } },
            { type = "View", key = "n0_1_1_11_6_5_8_3_11", style = { flexGrow = 1, flexBasis = 0 }, children = {
              { type = "TslxElementDetail", key = "n0_1_1_11_6_5_8_3_11_1_12" },
              } },
            } },
          { type = "View", key = "n0_1_1_11_6_9_13", style = { flexDirection = "row", gap = 4, flexWrap = "wrap" }, children = {
            { type = "View", key = "n0_1_1_11_6_9_13_1_list_1", style = { flexDirection = "row", flexWrap = "wrap", gap = 4 } },
            } },
          } },
        { type = "View", key = "n0_1_1_15_14", style = { gap = 12, display = "none" }, children = {
          { type = "View", key = "n0_1_1_15_14_3_15", style = { flexDirection = "row", gap = 4, flexWrap = "wrap" }, children = {
            { type = "View", key = "n0_1_1_15_14_3_15_1_list_2", style = { flexDirection = "row", flexWrap = "wrap", gap = 4 } },
            } },
          { type = "TslxMoleculeCard", key = "n0_1_1_15_14_7_16" },
          } },
        { type = "View", key = "n0_1_1_19_17", style = { gap = 12, display = "none" }, children = {
          { type = "View", key = "n0_1_1_19_17_3_18", style = { gap = 4 }, children = {
            { type = "View", key = "n0_1_1_19_17_3_18_1_list_3", style = { gap = 4 } },
            } },
          { type = "TslxReactionView", key = "n0_1_1_19_17_7_19" },
          } },
        } },
      } },
  }
end

local function updateTree(handles, props, state, refresh)
  local data = computeData(props, state)
  Tree.updateChildProps(handles["n0_1_1_11_6_5_8"], { style = { display = (data.el) and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_1_1_11_6"], { style = { display = (state.activeTab == "table") and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_1_1_15_14"], { style = { display = (state.activeTab == "molecules") and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_1_1_19_17"], { style = { display = (state.activeTab == "reactions") and "flex" or "none" } })
  Tree.updateChildProps(handles["n0_1_1_11_6_1_7"], { selected = state.selected or "" })
  Tree.updateChildProps(handles["n0_1_1_11_6_5_8_1_9_1_10"], { element = state.selected or "" })
  Tree.updateChildProps(handles["n0_1_1_11_6_5_8_3_11_1_12"], { element = state.selected or "" })
  Tree.updateChildProps(handles["n0_1_1_15_14_7_16"], { formula = state.selectedFormula or "" })
  Tree.updateChildProps(handles["n0_1_1_19_17_7_19"], { equation = state.selectedReaction or "" })
  rebuildList_0(handles["n0_1_1_7_5_1_list_0"], data.TABS, data, state, refresh)
  rebuildList_1(handles["n0_1_1_11_6_9_13_1_list_1"], data.QUICK_ELEMENTS, data, state, refresh)
  rebuildList_2(handles["n0_1_1_15_14_3_15_1_list_2"], data.DEMO_FORMULAS, data, state, refresh)
  rebuildList_3(handles["n0_1_1_19_17_3_18_1_list_3"], data.DEMO_REACTIONS, data, state, refresh)
end

Capabilities.register("TslxChemistryStory", {
  visual = false,

  schema = {
    selectedElement = { type = "number", default = 26, desc = "Currently selected atomic number" },
  },

  events = {},

  create = function(nodeId, props)
    -- Capability node fills its parent (like a React fragment)
    local node = Tree.getNodes()[nodeId]
    if node then
      if not node.style then node.style = {} end
      node.style.width = "100%"
      node.style.height = "100%"
    end
    local state = {
    selected = 26,
    activeTab = "table",
    selectedFormula = "H2O",
    selectedReaction = "CH4 + O2 -> CO2 + H2O",
  }
    local capState = { state = state, props = props }
    local function refresh()
      updateTree(capState.handles, capState.props, capState.state, refresh)
    end
    capState.handles = Tree.declareChildren(nodeId, buildTemplate())
    capState.refresh = refresh
    updateTree(capState.handles, props, state, refresh)
    return capState
  end,

  update = function(nodeId, props, prev, capState)
    capState.props = props
    updateTree(capState.handles, props, capState.state, capState.refresh)
  end,

  destroy = function(nodeId, capState)
    Tree.removeDeclaredChildren(nodeId)
  end,

  tick = function() end,
})

--- Would write to: /home/siah/creative/reactjit/examples/tslx-demo/lua/capabilities/chemistry_story.lua ---
