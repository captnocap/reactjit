--[[
  scene3d.lua -- 3D scene rendering via g3d

  Manages 3D viewports that participate in the 2D layout tree.
  Each Scene3D node renders to an off-screen Love2D Canvas with a depth buffer.
  The 2D painter composites the Canvas at the node's computed position.

  Follows the videos.lua pattern:
    1. syncWithTree() scans the tree for Scene3D nodes each frame
    2. renderAll() renders each scene to its Canvas
    3. get(nodeId) returns the Canvas for the painter to draw

  3D children (Mesh3D, Camera3D, Light3D) live in the same tree as 2D nodes
  but are skipped by the layout engine. Their props (position, rotation, scale)
  are interpreted as 3D world-space coordinates by this module.
]]

local Scene3D = {}

-- ============================================================================
-- State
-- ============================================================================

local g3d = nil           -- lazy-loaded g3d library
local scenes = {}         -- nodeId -> scene state
local initialized = false

-- 3D node types that should not be painted by the 2D painter
Scene3D.CHILD_TYPES = {
  Mesh3D = true,
  Camera3D = true,
  AmbientLight3D = true,
  PointLight3D = true,
  DirectionalLight3D = true,
  SpotLight3D = true,
  Group3D = true,
}

-- ============================================================================
-- Built-in primitive geometry
-- ============================================================================

--- Generate vertex data for a unit box (centered at origin, size 1x1x1)
--- Each vertex: {x, y, z, u, v, nx, ny, nz}
local function generateBox(w, h, d)
  w = (w or 1) / 2
  h = (h or 1) / 2
  d = (d or 1) / 2

  local verts = {}
  local function face(v1, v2, v3, v4, nx, ny, nz)
    -- Two triangles: v1-v2-v3, v1-v3-v4
    verts[#verts + 1] = {v1[1], v1[2], v1[3], 0, 0, nx, ny, nz}
    verts[#verts + 1] = {v2[1], v2[2], v2[3], 1, 0, nx, ny, nz}
    verts[#verts + 1] = {v3[1], v3[2], v3[3], 1, 1, nx, ny, nz}
    verts[#verts + 1] = {v1[1], v1[2], v1[3], 0, 0, nx, ny, nz}
    verts[#verts + 1] = {v3[1], v3[2], v3[3], 1, 1, nx, ny, nz}
    verts[#verts + 1] = {v4[1], v4[2], v4[3], 0, 1, nx, ny, nz}
  end

  -- Front  (+Y)
  face({-w, h, -d}, { w, h, -d}, { w, h,  d}, {-w, h,  d},  0,  1,  0)
  -- Back   (-Y)
  face({ w,-h, -d}, {-w,-h, -d}, {-w,-h,  d}, { w,-h,  d},  0, -1,  0)
  -- Right  (+X)
  face({ w, h, -d}, { w,-h, -d}, { w,-h,  d}, { w, h,  d},  1,  0,  0)
  -- Left   (-X)
  face({-w,-h, -d}, {-w, h, -d}, {-w, h,  d}, {-w,-h,  d}, -1,  0,  0)
  -- Top    (+Z)
  face({-w, h,  d}, { w, h,  d}, { w,-h,  d}, {-w,-h,  d},  0,  0,  1)
  -- Bottom (-Z)
  face({-w,-h, -d}, { w,-h, -d}, { w, h, -d}, {-w, h, -d},  0,  0, -1)

  return verts
end

--- Generate vertex data for a UV sphere
local function generateSphere(radius, segments, rings)
  radius = radius or 0.5
  segments = segments or 16
  rings = rings or 12
  local verts = {}
  local pi = math.pi

  for i = 0, rings - 1 do
    local theta1 = pi * i / rings
    local theta2 = pi * (i + 1) / rings
    for j = 0, segments - 1 do
      local phi1 = 2 * pi * j / segments
      local phi2 = 2 * pi * (j + 1) / segments

      -- Four corners of the quad
      local function pt(theta, phi)
        local st = math.sin(theta)
        local x = radius * st * math.cos(phi)
        local y = radius * st * math.sin(phi)
        local z = radius * math.cos(theta)
        local nx, ny, nz = st * math.cos(phi), st * math.sin(phi), math.cos(theta)
        local u = phi / (2 * pi)
        local v = theta / pi
        return {x, y, z, u, v, nx, ny, nz}
      end

      local p1 = pt(theta1, phi1)
      local p2 = pt(theta1, phi2)
      local p3 = pt(theta2, phi2)
      local p4 = pt(theta2, phi1)

      -- Two triangles per quad
      verts[#verts + 1] = p1
      verts[#verts + 1] = p4
      verts[#verts + 1] = p3
      verts[#verts + 1] = p1
      verts[#verts + 1] = p3
      verts[#verts + 1] = p2
    end
  end

  return verts
end

--- Generate vertex data for a flat plane (XY, Z=0)
local function generatePlane(w, h)
  w = (w or 1) / 2
  h = (h or 1) / 2
  return {
    {-w, -h, 0, 0, 0, 0, 0, 1},
    { w, -h, 0, 1, 0, 0, 0, 1},
    { w,  h, 0, 1, 1, 0, 0, 1},
    {-w, -h, 0, 0, 0, 0, 0, 1},
    { w,  h, 0, 1, 1, 0, 0, 1},
    {-w,  h, 0, 0, 1, 0, 0, 1},
  }
end

-- Geometry generators by name
local geometryGenerators = {
  box = generateBox,
  cube = generateBox,
  sphere = generateSphere,
  plane = generatePlane,
}

-- ============================================================================
-- Texture helpers
-- ============================================================================

--- Create a solid-color 1x1 texture from a hex color string
local function colorTexture(hexColor)
  local r, g, b = 0.54, 0.70, 0.98  -- default: #89b4fa
  if hexColor and type(hexColor) == "string" then
    local hex = hexColor:gsub("#", "")
    if #hex == 6 then
      r = tonumber(hex:sub(1, 2), 16) / 255
      g = tonumber(hex:sub(3, 4), 16) / 255
      b = tonumber(hex:sub(5, 6), 16) / 255
    end
  end
  local imgData = love.image.newImageData(1, 1)
  imgData:setPixel(0, 0, r, g, b, 1)
  return love.graphics.newImage(imgData)
end

-- Cache for color textures
local colorTextureCache = {}
local function getColorTexture(hexColor)
  local key = hexColor or "__default__"
  if not colorTextureCache[key] then
    colorTextureCache[key] = colorTexture(hexColor)
  end
  return colorTextureCache[key]
end

-- ============================================================================
-- Edge shader (UV-based edge detection)
-- ============================================================================

local edgeShader = nil

local edgeShaderVert = [[
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform bool isCanvasEnabled;

vec4 position(mat4 transformProjection, vec4 vertexPosition) {
    vec4 screenPos = projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
    if (isCanvasEnabled) {
        screenPos.y *= -1.0;
    }
    return screenPos;
}
]]

local edgeShaderFrag = [[
uniform vec4 edgeColor;
uniform float edgeWidth;

vec4 effect(vec4 color, Image tex, vec2 texture_coords, vec2 screen_coords) {
    vec4 texColor = Texel(tex, texture_coords);
    vec4 baseColor = texColor * color;

    // Detect edges: UV near 0 or 1 on either axis
    float u = texture_coords.x;
    float v = texture_coords.y;
    float edgeMask = 0.0;
    if (u < edgeWidth || u > 1.0 - edgeWidth ||
        v < edgeWidth || v > 1.0 - edgeWidth) {
        edgeMask = 1.0;
    }

    return mix(baseColor, edgeColor, edgeMask);
}
]]

local function getEdgeShader()
  if not edgeShader then
    edgeShader = love.graphics.newShader(edgeShaderVert, edgeShaderFrag)
  end
  return edgeShader
end

--- Parse a hex color to {r, g, b, a} floats
local function parseHexColor(hex)
  if not hex or type(hex) ~= "string" then return nil end
  hex = hex:gsub("#", "")
  if #hex == 6 then
    return {
      tonumber(hex:sub(1, 2), 16) / 255,
      tonumber(hex:sub(3, 4), 16) / 255,
      tonumber(hex:sub(5, 6), 16) / 255,
      1,
    }
  end
  return nil
end

-- ============================================================================
-- Scene management
-- ============================================================================

--- Initialize the 3D module. Called once.
function Scene3D.init()
  if initialized then return end
  g3d = require("lua.g3d")
  initialized = true
end

--- Check if a node type is a 3D child type (should be skipped by painter/layout)
function Scene3D.is3DChildType(nodeType)
  return Scene3D.CHILD_TYPES[nodeType] == true
end

--- Apply camera props from a Camera3D node to g3d's camera
local function applyCamera(camNode, canvasW, canvasH)
  local props = camNode.props or {}
  local pos = props.position or {0, 2, -5}
  local lookAt = props.lookAt or {0, 0, 0}
  local fov = props.fov or (math.pi / 3)  -- 60 degrees default
  local near = props.near or 0.01
  local far = props.far or 1000

  g3d.camera.position = {pos[1] or 0, pos[2] or 0, pos[3] or 0}
  g3d.camera.target = {lookAt[1] or 0, lookAt[2] or 0, lookAt[3] or 0}
  g3d.camera.fov = fov
  g3d.camera.nearClip = near
  g3d.camera.farClip = far
  g3d.camera.aspectRatio = canvasW / canvasH
  g3d.camera.updateProjectionMatrix()
  g3d.camera.updateViewMatrix()
end

--- Create or update a g3d model for a Mesh3D node
local function ensureMeshModel(scene, meshNode)
  local props = meshNode.props or {}
  local meshId = meshNode.id

  local entry = scene.meshes[meshId]

  -- Determine geometry key
  local geometry = props.geometry or "box"
  local color = props.color

  local edgeColor = props.edgeColor
  local edgeWidth = props.edgeWidth or 0.03

  -- Check if we need to recreate the model
  local needsCreate = not entry
    or entry.geometry ~= geometry
    or entry.color ~= color

  if needsCreate then
    -- Generate or load vertices
    local generator = geometryGenerators[geometry]
    local verts
    if generator then
      verts = generator()
    else
      -- Unknown geometry, fall back to box
      verts = generateBox()
    end

    local texture = getColorTexture(color)
    local model = g3d.newModel(verts, texture)

    entry = {
      model = model,
      geometry = geometry,
      color = color,
    }
    scene.meshes[meshId] = entry
  end

  -- Update edge properties (cheap, every frame)
  entry.edgeColor = edgeColor and parseHexColor(edgeColor) or nil
  entry.edgeWidth = edgeWidth

  -- Apply transform from props (these are cheap to update every frame)
  local pos = props.position or {0, 0, 0}
  local rot = props.rotation or {0, 0, 0}
  local scl = props.scale

  if type(scl) == "number" then
    scl = {scl, scl, scl}
  end
  scl = scl or {1, 1, 1}

  entry.model:setTransform(
    {pos[1] or 0, pos[2] or 0, pos[3] or 0},
    {rot[1] or 0, rot[2] or 0, rot[3] or 0},
    {scl[1] or 1, scl[2] or 1, scl[3] or 1}
  )

  return entry
end

--- Sync a single Scene3D node: create/resize canvas, build mesh list
local function syncScene(node)
  local c = node.computed
  if not c then return end

  local w = math.floor(c.w or 0)
  local h = math.floor(c.h or 0)
  if w <= 0 or h <= 0 then return end

  local scene = scenes[node.id]
  if not scene then
    scene = {
      canvas = nil,
      width = 0,
      height = 0,
      meshes = {},   -- meshId -> { model, geometry, color }
      cameraNode = nil,
      bgColor = {0.07, 0.07, 0.11, 1},  -- dark background
    }
    scenes[node.id] = scene
  end

  -- Recreate canvas if dimensions changed
  if scene.width ~= w or scene.height ~= h then
    if scene.canvas then
      scene.canvas:release()
    end
    scene.canvas = love.graphics.newCanvas(w, h)
    scene.width = w
    scene.height = h
  end

  -- Parse background color from props
  local props = node.props or {}
  if props.backgroundColor then
    local hex = props.backgroundColor:gsub("#", "")
    if #hex == 6 then
      scene.bgColor = {
        tonumber(hex:sub(1, 2), 16) / 255,
        tonumber(hex:sub(3, 4), 16) / 255,
        tonumber(hex:sub(5, 6), 16) / 255,
        1,
      }
    end
  end

  -- Walk children to find Camera3D and Mesh3D nodes
  scene.cameraNode = nil
  local activeMeshIds = {}

  local function walkChildren(parent)
    for _, child in ipairs(parent.children or {}) do
      if child.type == "Camera3D" then
        scene.cameraNode = child
      elseif child.type == "Mesh3D" then
        ensureMeshModel(scene, child)
        activeMeshIds[child.id] = true
      elseif child.type == "Group3D" then
        -- Recurse into groups
        walkChildren(child)
      end
      -- Light nodes will be handled in Phase 3
    end
  end

  walkChildren(node)

  -- Prune meshes that are no longer in the tree
  for meshId, entry in pairs(scene.meshes) do
    if not activeMeshIds[meshId] then
      -- g3d models don't have an explicit release, but the mesh does
      if entry.model and entry.model.mesh then
        entry.model.mesh:release()
      end
      scene.meshes[meshId] = nil
    end
  end
end

-- ============================================================================
-- Rendering
-- ============================================================================

--- Render a single scene to its Canvas
local function renderScene(scene)
  if not scene.canvas then return end

  -- Save Love2D graphics state
  love.graphics.push("all")

  -- Set canvas with depth buffer for proper 3D rendering
  love.graphics.setCanvas({scene.canvas, depth = true})

  -- Enable depth testing (isolated to this canvas)
  love.graphics.setDepthMode("lequal", true)

  -- Clear color and depth
  love.graphics.clear(scene.bgColor[1], scene.bgColor[2], scene.bgColor[3], scene.bgColor[4])

  -- Reset color to white for textured rendering
  love.graphics.setColor(1, 1, 1, 1)

  -- Set up camera
  if scene.cameraNode then
    applyCamera(scene.cameraNode, scene.width, scene.height)
  else
    -- Default camera: look at origin from a reasonable angle
    g3d.camera.position = {0, -3, 2}
    g3d.camera.target = {0, 0, 0}
    g3d.camera.fov = math.pi / 3
    g3d.camera.nearClip = 0.01
    g3d.camera.farClip = 1000
    g3d.camera.aspectRatio = scene.width / scene.height
    g3d.camera.updateProjectionMatrix()
    g3d.camera.updateViewMatrix()
  end

  -- Draw all meshes
  for _, entry in pairs(scene.meshes) do
    if entry.model then
      if entry.edgeColor then
        -- Use edge shader for meshes with edge highlighting
        local shader = getEdgeShader()
        shader:send("edgeColor", entry.edgeColor)
        shader:send("edgeWidth", entry.edgeWidth)
        entry.model:draw(shader)
      else
        entry.model:draw()
      end
    end
  end

  -- Restore Love2D graphics state (canvas, depth mode, shader, etc.)
  love.graphics.pop()
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Scan the tree for Scene3D nodes and sync their state.
--- Called from love.update() after tree commands are applied.
function Scene3D.syncWithTree(treeNodes)
  if not initialized then return end

  local activeSceneIds = {}

  for id, node in pairs(treeNodes) do
    if node.type == "Scene3D" then
      syncScene(node)
      activeSceneIds[id] = true
    end
  end

  -- Clean up scenes that are no longer in the tree
  for id, scene in pairs(scenes) do
    if not activeSceneIds[id] then
      Scene3D.cleanup(id)
    end
  end
end

--- Render all active scenes to their Canvases.
--- Called from love.update() after syncWithTree.
function Scene3D.renderAll()
  if not initialized then return end

  for _, scene in pairs(scenes) do
    renderScene(scene)
  end
end

--- Return the Canvas for a Scene3D node. Painter draws this.
function Scene3D.get(nodeId)
  local scene = scenes[nodeId]
  return scene and scene.canvas or nil
end

--- Free resources for a Scene3D node.
function Scene3D.cleanup(nodeId)
  local scene = scenes[nodeId]
  if not scene then return end

  -- Release canvas
  if scene.canvas then
    scene.canvas:release()
  end

  -- Release mesh models
  for _, entry in pairs(scene.meshes) do
    if entry.model and entry.model.mesh then
      entry.model.mesh:release()
    end
  end

  scenes[nodeId] = nil
end

--- Check if any Scene3D nodes exist (for lazy init in init.lua)
function Scene3D.hasScenes()
  return next(scenes) ~= nil
end

return Scene3D
