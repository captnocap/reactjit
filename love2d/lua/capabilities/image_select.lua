--[[
  capabilities/image_select.lua — DEPRECATED (SDL2 target removed)

  This capability required raw OpenGL via the SDL2 target.
  It will be ported to Love2D's drawing API in a future release.
]]

local Capabilities = require("lua.capabilities")

Capabilities.register("ImageSelect", {
  visual = false,
  schema = {},
  create = function(nodeId, props)
    io.write("[image_select] DEPRECATED: this capability requires the SDL2 target which has been removed\n")
    io.flush()
    return {}
  end,
  update = function() end,
  destroy = function() end,
})
