--[[
  capabilities/scene3d.lua — 3D scene rendering capability (SDL2 target)

  Registers Scene3D as a visual capability that renders 3D scenes to an FBO
  and composites the result into the 2D layout tree.

  Also registers child types (Mesh3D, Camera3D, lights) as non-visual
  capabilities so the painter skips them.

  React usage:
    <Scene3D style={{ flexGrow: 1 }} backgroundColor="#111122" orbitControls>
      <Camera3D position={[0, -3, 2]} lookAt={[0, 0, 0]} fov={Math.PI/3} />
      <AmbientLight3D color="#1a1a2e" intensity={0.15} />
      <DirectionalLight3D direction={[-1, 0.5, -0.3]} color="#ffffff" intensity={1} />
      <Mesh3D geometry="sphere" color="#89b4fa" position={[0, 0, 0]} />
    </Scene3D>
]]

local Capabilities = require("lua.capabilities")

-- Only load on SDL2 target (scene3d.lua handles Love2D via its own module)
local isSDL2 = not love or not love.graphics or not love.graphics.newCanvas
if not isSDL2 then
  -- On Love2D, scene3d.lua is loaded directly by init.lua — don't register
  -- capabilities that would conflict. But we still need the child type dummies.
  -- Actually, on Love2D the painter handles these via Scene3DModule injection,
  -- so we skip everything here.
  return
end

local Scene3DRenderer = require("lua.sdl2_scene3d")
local Images = require("lua.sdl2_images")
local tree = require("lua.tree")

-- ============================================================================
-- Scene3D visual capability
-- ============================================================================

Capabilities.register("Scene3D", {
  visual = true,

  schema = {
    backgroundColor = { type = "string", default = "#111122", desc = "Scene background color (hex or 'transparent')" },
    stars           = { type = "bool",   default = false,      desc = "Show procedural starfield" },
    orbitControls   = { type = "bool",   default = false,      desc = "Enable click-drag orbit rotation" },
  },

  events = {},

  create = function(nodeId, props)
    return { synced = false }
  end,

  update = function(nodeId, props, prev, state)
    -- Re-sync on next tick
    state.synced = false
  end,

  destroy = function(nodeId, state)
    Scene3DRenderer.destroyScene(nodeId)
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Find the Scene3D node in the tree and sync its children
    local nodes = tree.getNodes()
    local node = nodes[nodeId]
    if not node then return end

    Scene3DRenderer.syncScene(nodeId, node)
    state.synced = true
  end,

  draw = function(nodeId, state, props, c, opacity)
    if not c or c.w <= 0 or c.h <= 0 then return end

    -- Render 3D scene to FBO
    Scene3DRenderer.renderScene(nodeId)

    -- Composite FBO texture into the 2D scene
    local texId = Scene3DRenderer.getTexture(nodeId)
    if texId then
      -- The FBO texture is rendered with Y=0 at bottom (OpenGL convention)
      -- but the 2D painter expects Y=0 at top. We need to flip the texture.
      -- Use Images.drawTexture but with flipped tex coords.
      local GL = require("lua.sdl2_gl")
      GL.glEnable(GL.TEXTURE_2D)
      GL.glEnable(GL.BLEND)
      GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)
      GL.glBindTexture(GL.TEXTURE_2D, texId)
      GL.glColor4f(1, 1, 1, opacity or 1)

      -- Flip V: top of quad gets v=1, bottom gets v=0
      GL.glBegin(GL.QUADS)
        GL.glTexCoord2f(0, 1); GL.glVertex2f(c.x,       c.y)
        GL.glTexCoord2f(1, 1); GL.glVertex2f(c.x + c.w, c.y)
        GL.glTexCoord2f(1, 0); GL.glVertex2f(c.x + c.w, c.y + c.h)
        GL.glTexCoord2f(0, 0); GL.glVertex2f(c.x,       c.y + c.h)
      GL.glEnd()

      GL.glBindTexture(GL.TEXTURE_2D, 0)
      GL.glDisable(GL.TEXTURE_2D)
    end
  end,
})

-- ============================================================================
-- Child type dummies (non-visual, just so painter skips them)
-- ============================================================================

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
