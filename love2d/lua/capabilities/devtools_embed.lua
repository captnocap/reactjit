--[[
  capabilities/devtools_embed.lua — Embed the live devtools panel in the React tree

  React usage:
    <DevToolsEmbed style={{ width: '100%', height: 300 }} />

  Renders the actual F12 devtools panel (tab bar, active tab content,
  status bar) into the node's computed bounds. This is the real panel —
  same rendering code, same data, same interaction — just drawn into
  a React-owned rect instead of the bottom dock.

  The embedded panel shares state with the main F12 panel: switching
  tabs here switches them there too. It's the same singleton.
]]

local Capabilities = require("lua.capabilities")

Capabilities.register("DevToolsEmbed", {
  visual = true,

  schema = {},
  events = {},

  create = function(nodeId, props)
    return {}
  end,

  update = function(nodeId, props, prev, state)
  end,

  destroy = function(nodeId, st)
    local ok, devtools = pcall(require, "lua.devtools")
    if ok and devtools and devtools.clearEmbedRegion then
      devtools.clearEmbedRegion()
    end
  end,

  tick = function(nodeId, state, dt, pushEvent)
  end,

  render = function(node, c, opacity)
    -- c = computed layout: { x, y, w, h }
    if c.w <= 0 or c.h <= 0 then return end

    local ok, devtools = pcall(require, "lua.devtools")
    if not ok or not devtools then return end

    if not devtools.drawInRegion then return end

    devtools.drawInRegion({ x = c.x, y = c.y, w = c.w, h = c.h })
  end,
})
