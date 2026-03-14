--[[
  Hand-written Lua ElementTile using Tree.declareChildren (Box + Text).

  Same visual output as the compiled TSLX version and the pure React TSX
  version — all three produce identical Box/Text nodes through the layout
  engine. This one is just written by hand in Lua instead of compiled
  from .tslx or authored in React.

  Used by the TSLX Compare storybook page to demonstrate visual equivalence
  across all three authoring approaches.
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")
local Chemistry = require("lua.capabilities.chemistry")

local CATEGORY_COLORS = {
  ["alkali-metal"]          = "#7b6faa",
  ["alkaline-earth"]        = "#9a9cc4",
  ["transition-metal"]      = "#de9a9a",
  ["post-transition-metal"] = "#8fbc8f",
  ["metalloid"]             = "#c8c864",
  ["nonmetal"]              = "#59b5e6",
  ["halogen"]               = "#d4a844",
  ["noble-gas"]             = "#c87e4a",
  ["lanthanide"]            = "#c45879",
  ["actinide"]              = "#d4879a",
}

local function computeData(props)
  local el = Chemistry.getElement(props.element)
  if not el then
    return {
      el = { symbol = "?", number = 0, mass = 0, name = "Unknown", category = "unknown" },
      bg = "#868e96",
      massStr = "0.00",
    }
  end
  return {
    el = el,
    bg = CATEGORY_COLORS[el.category] or "#868e96",
    massStr = string.format("%.2f", el.mass),
  }
end

local function buildTemplate()
  return {
    { type = "View", key = "outer", children = {
      { type = "View", key = "inner", style = {
        flexGrow = 1, borderRadius = 3, backgroundColor = "#2a2a3a",
        alignItems = "center", justifyContent = "center",
        paddingTop = 4, paddingBottom = 4,
      }, children = {
        { type = "Text", key = "num_text", style = { fontSize = 10 }, children = {
          { type = "__TEXT__", key = "num_val", text = "" },
        }},
        { type = "Text", key = "sym_text", style = { color = "#ffffff", fontSize = 16 }, children = {
          { type = "__TEXT__", key = "sym_val", text = "" },
        }},
        { type = "Text", key = "mass_text", style = { color = "#999999", fontSize = 9 }, children = {
          { type = "__TEXT__", key = "mass_val", text = "" },
        }},
      }},
    }},
  }
end

local function updateTree(handles, props)
  local data = computeData(props)
  local size = props.size or 64
  local s = size / 64
  local numFontSize  = math.max(7, math.floor(10 * s + 0.5))
  local symFontSize  = math.max(10, math.floor(16 * s + 0.5))
  local massFontSize = math.max(7, math.floor(9 * s + 0.5))
  local pad = math.max(1, math.floor(2 * s + 0.5))

  Tree.updateChildProps(handles["outer"], {
    style = { width = size, height = size * 36 / 32 },
  })
  Tree.updateChildProps(handles["inner"], {
    style = {
      borderWidth = props.selected and 2 or 1,
      borderColor = data.bg,
      paddingTop = pad, paddingBottom = pad,
      overflow = "hidden", gap = 0,
    },
  })
  Tree.updateChildProps(handles["num_text"], { style = { color = data.bg, fontSize = numFontSize } })
  Tree.updateChildProps(handles["sym_text"], { style = { color = "#ffffff", fontSize = symFontSize } })
  Tree.updateChildProps(handles["mass_text"], { style = { color = "#999999", fontSize = massFontSize } })
  Tree.updateChildProps(handles["num_val"],  { text = data.el.number or "" })
  Tree.updateChildProps(handles["sym_val"],  { text = data.el.symbol or "" })
  Tree.updateChildProps(handles["mass_val"], { text = data.massStr or "" })
end

Capabilities.register("HandLuaElementTile", {
  visual = false,

  schema = {
    element  = { type = "number", default = 1,     desc = "Atomic number or symbol" },
    selected = { type = "bool",   default = false,  desc = "Highlight border" },
    size     = { type = "number", default = 64,     desc = "Tile width in pixels" },
  },

  events = { "onPress" },

  create = function(nodeId, props)
    local node = Tree.getNodes()[nodeId]
    if node then
      if not node.style then node.style = {} end
    end
    local capState = { props = props }
    capState.handles = Tree.declareChildren(nodeId, buildTemplate())
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
