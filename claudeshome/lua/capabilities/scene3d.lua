--[[
  capabilities/scene3d.lua — DEPRECATED (SDL2 target removed)

  This capability required raw OpenGL via the SDL2 target.
  The Love2D target handles Scene3D via Scene3DModule injection in init.lua,
  so this registration file is no longer needed.
  It will be fully ported to Love2D's drawing API in a future release.
]]

local Capabilities = require("lua.capabilities")

Capabilities.register("Scene3D", {
  visual = false,
  schema = {},
  create = function(nodeId, props)
    io.write("[scene3d] DEPRECATED: this capability requires the SDL2 target which has been removed\n")
    io.flush()
    return {}
  end,
  update = function() end,
  destroy = function() end,
})

-- Child type dummies (non-visual, so painter skips them)
-- These are still needed so the reconciler doesn't error on child nodes.
local childTypes = {
  "Mesh3D", "Camera3D", "AmbientLight3D", "DirectionalLight3D",
  "PointLight3D", "SpotLight3D", "Group3D",
}

for _, typeName in ipairs(childTypes) do
  Capabilities.register(typeName, {
    visual = false,
    schema = {},
    events = {},
    create  = function() return {} end,
    destroy = function() end,
  })
end
