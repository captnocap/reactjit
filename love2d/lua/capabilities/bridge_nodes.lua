--[[
  bridge_nodes.lua — Non-visual node types managed by the JS reconciler

  BridgeEvent and Hotkey subscriptions are managed entirely in JS
  (by the reconciler's subscription manager). They have no Lua-side
  lifecycle. We only register them here so layout/painter skip them.
]]

local Capabilities = require("lua.capabilities")

Capabilities.register("BridgeEvent", {
  visual = false,
  schema = {},
  events = {},
})

Capabilities.register("Hotkey", {
  visual = false,
  schema = {},
  events = {},
})
