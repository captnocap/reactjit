--[[
  capabilities/element_tile.lua — Auto-generated from ElementTile.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/ElementTile.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
local Chemistry = require("lua.generated.chemistry.elements")

local function computeData(props)
  local el = Chemistry.getElement(props.element)
  if not el then
    return { el = { symbol = "?", number = 0, mass = 0, name = "Unknown", category = "unknown" }, bg = "#868e96", massStr = "0.00" }
  end
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
  local bg = CATEGORY_COLORS[el.category] or "#868e96"
  local massStr = string.format("%.2f", el.mass)
  return { el = el, bg = bg, massStr = massStr }
end
local function buildTemplate(h)
  return {
    { type = "View", key = "n0", props = { animation = "cardFlip" }, handlers = { onPress = h.__push_onPress }, children = {
      { type = "View", key = "n0_1_1", style = { flexGrow = 1, borderRadius = 3, backgroundColor = "#2a2a3a", alignItems = "center", justifyContent = "center", paddingTop = 4, paddingBottom = 4 }, children = {
        { type = "Text", key = "n0_1_1_1_2", style = { fontSize = 10 }, children = {
          { type = "__TEXT__", key = "n0_1_1_1_2_0_t", text = "" },
          } },
        { type = "Text", key = "n0_1_1_3_3", style = { color = "#ffffff", fontSize = 16 }, children = {
          { type = "__TEXT__", key = "n0_1_1_3_3_0_t", text = "" },
          } },
        { type = "Text", key = "n0_1_1_5_4", style = { color = "#999999", fontSize = 9 }, children = {
          { type = "__TEXT__", key = "n0_1_1_5_4_0_t", text = "" },
          } },
        } },
      } },
  }
end

local function updateTree(handles, props)
  local data = computeData(props)
  local size = props.size or 64
  local s = size / 64
  local numFontSize = math.max(7, math.floor(10 * s + 0.5))
  local symFontSize = math.max(10, math.floor(16 * s + 0.5))
  local massFontSize = math.max(7, math.floor(9 * s + 0.5))
  local pad = math.max(1, math.floor(2 * s + 0.5))
  Tree.updateChildProps(handles["n0_1_1_1_2"], { style = { color = data.bg, fontSize = numFontSize } })
  Tree.updateChildProps(handles["n0_1_1"], { style = { borderWidth = (props.selected) and 2 or 1, borderColor = data.bg, paddingTop = pad, paddingBottom = pad, overflow = "hidden", gap = 0 } })
  Tree.updateChildProps(handles["n0"], { style = { width = size, height = size * 36 / 32 } })
  Tree.updateChildProps(handles["n0_1_1_3_3"], { style = { color = "#ffffff", fontSize = symFontSize } })
  Tree.updateChildProps(handles["n0_1_1_5_4"], { style = { color = "#999999", fontSize = massFontSize } })
  Tree.updateChildProps(handles["n0_1_1_1_2_0_t"], { text = data.el.number or "" })
  Tree.updateChildProps(handles["n0_1_1_3_3_0_t"], { text = data.el.symbol or "" })
  Tree.updateChildProps(handles["n0_1_1_5_4_0_t"], { text = data.massStr or "" })
end

Capabilities.register("TslxElementTile", {
  visual = false,

  schema = {
    element = { type = "number", default = 1, desc = "Atomic number or symbol" },
    selected = { type = "bool", default = false, desc = "Highlight border" },
    size = { type = "number", default = 64, desc = "Tile width in pixels" },
  },

  events = { "onPress" },

  create = function(nodeId, props)
    -- Capability node fills its parent (like a React fragment)
    local node = Tree.getNodes()[nodeId]
    if node then
      if not node.style then node.style = {} end
    end
    local capState = { props = props }
    local h = {}
    h.__push_onPress = function()
      local data = computeData(capState.props)
      if Capabilities._pushEventFn then
        Capabilities._pushEventFn({
          type = "onPress",
          payload = { number = data.el.number, symbol = data.el.symbol, name = data.el.name, mass = data.el.mass, category = data.el.category }
        })
      end
    end
    capState.handles = Tree.declareChildren(nodeId, buildTemplate(h))
    updateTree(capState.handles, props)
    return capState
  end,

  update = function(nodeId, props, prev, capState)
    capState.props = props
    updateTree(capState.handles, props)
  end,

  destroy = function(nodeId, capState)
    Tree.removeDeclaredChildren(nodeId)
  end,

  tick = function() end,
})

--- Would write to: /home/siah/creative/reactjit/examples/tslx-demo/lua/capabilities/element_tile.lua ---
