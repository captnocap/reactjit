--[[
  capabilities/hello_card.lua — Auto-generated from HelloCard.tslx
  DO NOT EDIT — regenerate with: node scripts/tslx_compile.mjs tslx/HelloCard.tslx
]]

local Capabilities = require("lua.capabilities")
local Tree = require("lua.tree")

local function buildTemplate()
  return {
    { type = "Text", key = "c1_0", style = { fontSize = 24, color = "#88c0d0" }, children = {
      { type = "__TEXT__", key = "c1_0_0_t", text = "" },
      } },
    { type = "Text", key = "c3_1", style = { fontSize = 14, color = "#d8dee9" }, children = {
      { type = "__TEXT__", key = "c3_1_0_t", text = "" },
      } },
  }
end

local function updateTree(handles, props)
  Tree.updateChildProps(handles["c1_0_0_t"], { text = props.title or "" })
  Tree.updateChildProps(handles["c3_1_0_t"], { text = props.subtitle or "" })
end

Capabilities.register("HelloCard", {
  visual = false,

  schema = {
    title = { type = "string", default = "Hello", desc = "Card title" },
    subtitle = { type = "string", default = "", desc = "Card subtitle" },
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
