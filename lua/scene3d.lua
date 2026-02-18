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
  segments = segments or 48
  rings = rings or 32
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
-- Procedural texture generators
-- ============================================================================

-- Simple hash-based noise (no bit library needed)
local function hashNoise(x, y, seed)
  local n = x * 374761393 + y * 668265263 + (seed or 0) * 1013904223
  n = math.abs(n)
  n = (n % 65537) / 65537
  -- Extra scramble
  n = math.sin(n * 12345.6789) * 0.5 + 0.5
  return n
end

-- Smoothed noise with bilinear interpolation
local function smoothNoise(x, y, seed)
  local ix = math.floor(x)
  local iy = math.floor(y)
  local fx = x - ix
  local fy = y - iy
  -- Smoothstep
  fx = fx * fx * (3 - 2 * fx)
  fy = fy * fy * (3 - 2 * fy)

  local n00 = hashNoise(ix, iy, seed)
  local n10 = hashNoise(ix + 1, iy, seed)
  local n01 = hashNoise(ix, iy + 1, seed)
  local n11 = hashNoise(ix + 1, iy + 1, seed)

  local nx0 = n00 + (n10 - n00) * fx
  local nx1 = n01 + (n11 - n01) * fx
  return nx0 + (nx1 - nx0) * fy
end

-- Multi-octave fractal noise
local function fbm(x, y, octaves, seed)
  local value = 0
  local amplitude = 0.5
  local frequency = 1
  local total = 0
  for _ = 1, (octaves or 5) do
    value = value + smoothNoise(x * frequency, y * frequency, seed) * amplitude
    total = total + amplitude
    amplitude = amplitude * 0.5
    frequency = frequency * 2
  end
  return value / total
end

--- Generate a procedural planet texture (equirectangular projection)
local function generatePlanetTexture(seed)
  seed = seed or 42
  local tw, th = 512, 256
  local imgData = love.image.newImageData(tw, th)

  for py = 0, th - 1 do
    local v = py / th             -- 0=north pole, 1=south pole
    local lat = (v - 0.5) * math.pi  -- -pi/2 to pi/2

    for px = 0, tw - 1 do
      local u = px / tw           -- 0-1 longitude

      -- Sample terrain height from noise
      local nx = u * 6
      local ny = v * 3
      local terrain = fbm(nx, ny, 6, seed)

      -- Add continental-scale features
      local continent = fbm(nx * 0.5, ny * 0.5, 3, seed + 100)

      local h = terrain * 0.6 + continent * 0.4
      local seaLevel = 0.45

      local r, g, b

      -- Ice caps at poles
      local absLat = math.abs(lat)
      if absLat > 1.25 then
        -- Polar ice
        local iceBlend = (absLat - 1.25) / 0.3
        iceBlend = math.min(iceBlend, 1)
        local snowNoise = fbm(nx * 2, ny * 2, 3, seed + 200) * 0.15
        r = 0.85 + snowNoise
        g = 0.88 + snowNoise
        b = 0.92 + snowNoise
        -- Blend with underlying terrain at edges
        if iceBlend < 1 and h > seaLevel then
          r = r * iceBlend + (0.25 + h * 0.3) * (1 - iceBlend)
          g = g * iceBlend + (0.4 + h * 0.25) * (1 - iceBlend)
          b = b * iceBlend + 0.15 * (1 - iceBlend)
        end
      elseif h < seaLevel then
        -- Ocean: deep blue with depth variation
        local depth = (seaLevel - h) / seaLevel
        r = 0.04 + depth * 0.03
        g = 0.10 + depth * 0.06
        b = 0.35 + depth * 0.25
        -- Shallow water near coastlines
        if h > seaLevel - 0.05 then
          local shallow = 1 - (seaLevel - h) / 0.05
          r = r + shallow * 0.05
          g = g + shallow * 0.12
          b = b - shallow * 0.05
        end
      else
        -- Land: varies by altitude and latitude
        local elevation = (h - seaLevel) / (1 - seaLevel)
        local tropicness = 1 - math.abs(lat) / (math.pi * 0.4)
        tropicness = math.max(0, math.min(1, tropicness))

        if elevation > 0.6 then
          -- Mountains/highlands (grey-brown)
          local rock = fbm(nx * 4, ny * 4, 3, seed + 300) * 0.1
          r = 0.45 + rock
          g = 0.40 + rock
          b = 0.35 + rock
        elseif elevation > 0.35 then
          -- Hills (brown-green transition)
          local mix = (elevation - 0.35) / 0.25
          r = 0.25 * (1 - mix) + 0.40 * mix
          g = 0.40 * (1 - mix) + 0.35 * mix
          b = 0.12 * (1 - mix) + 0.20 * mix
        else
          -- Lowlands: tropical=lush green, temperate=green, arid=tan
          local moisture = fbm(nx * 1.5 + 50, ny * 1.5 + 50, 4, seed + 400)
          if moisture > 0.5 and tropicness > 0.5 then
            -- Lush tropical
            r = 0.10 + elevation * 0.15
            g = 0.35 + elevation * 0.20
            b = 0.08
          elseif moisture > 0.35 then
            -- Temperate green
            r = 0.18 + elevation * 0.12
            g = 0.32 + elevation * 0.18
            b = 0.10
          else
            -- Arid/desert
            r = 0.55 + elevation * 0.15
            g = 0.45 + elevation * 0.10
            b = 0.25
          end
        end
      end

      -- Clamp
      r = math.max(0, math.min(1, r))
      g = math.max(0, math.min(1, g))
      b = math.max(0, math.min(1, b))

      imgData:setPixel(px, py, r, g, b, 1)
    end
  end

  local img = love.graphics.newImage(imgData)
  img:setFilter("linear", "linear")
  img:setWrap("repeat", "clamp")
  return img
end

-- Cache for procedural textures
local proceduralTextureCache = {}

--- Get a procedural texture by name
local function getProceduralTexture(name, seed)
  local key = name .. ":" .. tostring(seed or 0)
  if not proceduralTextureCache[key] then
    if name == "planet" then
      proceduralTextureCache[key] = generatePlanetTexture(seed)
    end
  end
  return proceduralTextureCache[key]
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
uniform float gridLines;  // 0 = edge-only mode, >0 = grid with N divisions

vec4 effect(vec4 color, Image tex, vec2 texture_coords, vec2 screen_coords) {
    vec4 texColor = Texel(tex, texture_coords);
    vec4 baseColor = texColor * color;

    float u = texture_coords.x;
    float v = texture_coords.y;
    float edgeMask = 0.0;

    if (gridLines > 0.0) {
        // Grid mode: draw lines at regular UV intervals
        float gu = fract(u * gridLines);
        float gv = fract(v * gridLines);
        float lineW = edgeWidth * gridLines;
        if (gu < lineW || gu > 1.0 - lineW ||
            gv < lineW || gv > 1.0 - lineW) {
            edgeMask = 1.0;
        }
    } else {
        // Edge-only mode: lines at UV boundaries (0 and 1)
        if (u < edgeWidth || u > 1.0 - edgeWidth ||
            v < edgeWidth || v > 1.0 - edgeWidth) {
            edgeMask = 1.0;
        }
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

-- ============================================================================
-- Lighting shader (Blinn-Phong)
-- ============================================================================

local lightingShader = nil

local lightingShaderVert = [[
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform bool isCanvasEnabled;

attribute vec3 VertexNormal;

varying vec3 fragWorldPos;
varying vec3 fragNormal;

vec4 position(mat4 transformProjection, vec4 vertexPosition) {
    vec4 worldPos = modelMatrix * vertexPosition;
    fragWorldPos = worldPos.xyz;

    // Normal transform (correct for uniform scale; re-normalize in frag)
    fragNormal = mat3(modelMatrix) * VertexNormal;

    vec4 screenPos = projectionMatrix * viewMatrix * worldPos;
    if (isCanvasEnabled) {
        screenPos.y *= -1.0;
    }
    return screenPos;
}
]]

local lightingShaderFrag = [[
uniform vec3 ambientColor;
uniform vec3 lightDirection;   // normalized, points TOWARD the light
uniform vec3 lightColor;
uniform vec3 cameraPosition;

uniform float specularPower;   // shininess (32-128 typical)
uniform float fresnelPower;    // 0 = disabled, 3-5 = atmosphere rim
uniform float meshOpacity;     // overall alpha

varying vec3 fragWorldPos;
varying vec3 fragNormal;

vec4 effect(vec4 color, Image tex, vec2 texture_coords, vec2 screen_coords) {
    vec4 texColor = Texel(tex, texture_coords);
    vec3 baseColor = texColor.rgb * color.rgb;

    vec3 N = normalize(fragNormal);
    vec3 L = normalize(lightDirection);
    vec3 V = normalize(cameraPosition - fragWorldPos);

    // Diffuse (Lambert)
    float diff = max(dot(N, L), 0.0);

    // Specular (Blinn-Phong)
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), specularPower);

    // Combine
    vec3 ambient = ambientColor * baseColor;
    vec3 diffuse = lightColor * baseColor * diff;
    vec3 specular = lightColor * spec * 0.4;

    vec3 finalColor = ambient + diffuse + specular;

    // Fresnel rim
    float alpha = meshOpacity;
    if (fresnelPower > 0.0) {
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), fresnelPower);
        alpha *= fresnel;
    }

    return vec4(finalColor, alpha * texColor.a);
}
]]

local function getLightingShader()
  if not lightingShader then
    lightingShader = love.graphics.newShader(lightingShaderVert, lightingShaderFrag)
  end
  return lightingShader
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
  local textureProp = props.texture
  local seed = props.seed

  local edgeColor = props.edgeColor
  local edgeWidth = props.edgeWidth or 0.03

  -- Check if we need to recreate the model
  local needsCreate = not entry
    or entry.geometry ~= geometry
    or entry.color ~= color
    or entry.textureProp ~= textureProp
    or entry.seed ~= seed

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

    -- Resolve texture: procedural name, or flat color
    local texture
    if textureProp and type(textureProp) == "string" then
      texture = getProceduralTexture(textureProp, seed)
    end
    if not texture then
      texture = getColorTexture(color)
    end

    local model = g3d.newModel(verts, texture)

    entry = {
      model = model,
      geometry = geometry,
      color = color,
      textureProp = textureProp,
      seed = seed,
    }
    scene.meshes[meshId] = entry
  end

  -- Update edge properties (cheap, every frame)
  entry.edgeColor = edgeColor and parseHexColor(edgeColor) or nil
  entry.edgeWidth = edgeWidth
  entry.wireframe = props.wireframe or false
  entry.gridLines = props.gridLines or 0

  -- Material properties
  entry.opacity = props.opacity or 1.0
  entry.specular = props.specular or 32
  entry.fresnel = props.fresnel or 0
  entry.unlit = props.unlit or false

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

  -- Stars prop
  scene.stars = props.stars or false
  scene.nodeId = node.id

  -- Orbit controls (Lua-side mouse polling, zero-latency rotation)
  scene.orbitControls = props.orbitControls or false
  scene.screenX = c.x or 0
  scene.screenY = c.y or 0
  -- Preserve orbit state across frames (don't reset)
  if scene.orbitRotX == nil then
    scene.orbitRotX = 0
    scene.orbitRotY = 0
    scene.orbitPrevMX = nil
    scene.orbitPrevMY = nil
  end

  -- Walk children to find Camera3D, Mesh3D, and Light nodes
  scene.cameraNode = nil
  scene.directionalLight = nil
  scene.ambientLight = nil
  local activeMeshIds = {}

  local function walkChildren(parent)
    for _, child in ipairs(parent.children or {}) do
      if child.type == "Camera3D" then
        scene.cameraNode = child
      elseif child.type == "Mesh3D" then
        ensureMeshModel(scene, child)
        activeMeshIds[child.id] = true
      elseif child.type == "DirectionalLight3D" then
        scene.directionalLight = child.props
      elseif child.type == "AmbientLight3D" then
        scene.ambientLight = child.props
      elseif child.type == "Group3D" then
        walkChildren(child)
      end
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

-- ============================================================================
-- Procedural starfield
-- ============================================================================

local starCache = {}  -- sceneId -> { points, colors }

local function getStars(sceneId, w, h)
  local key = sceneId .. ":" .. w .. "x" .. h
  if starCache[key] then return starCache[key] end

  local stars = {}
  local count = 300
  -- Seeded pseudo-random using the sceneId hash
  local seed = 12345
  for i = 1, count do
    seed = (seed * 1103515245 + 12345) % 2147483648
    local sx = (seed % w)
    seed = (seed * 1103515245 + 12345) % 2147483648
    local sy = (seed % h)
    seed = (seed * 1103515245 + 12345) % 2147483648
    local brightness = 0.3 + (seed % 700) / 1000  -- 0.3 to 1.0
    seed = (seed * 1103515245 + 12345) % 2147483648
    local size = 1 + (seed % 2)  -- 1 or 2 px
    stars[i] = { x = sx, y = sy, brightness = brightness, size = size }
  end

  starCache[key] = stars
  return stars
end

-- ============================================================================
-- Light helpers
-- ============================================================================

--- Parse a hex color string to {r, g, b} floats (0-1), with optional intensity multiplier
local function parseLightColor(hex, intensity)
  intensity = intensity or 1.0
  local r, g, b = 1, 1, 1
  if hex and type(hex) == "string" then
    hex = hex:gsub("#", "")
    if #hex == 6 then
      r = tonumber(hex:sub(1, 2), 16) / 255
      g = tonumber(hex:sub(3, 4), 16) / 255
      b = tonumber(hex:sub(5, 6), 16) / 255
    end
  end
  return { r * intensity, g * intensity, b * intensity }
end

--- Normalize a vec3 table
local function normalizeVec3(v)
  local x, y, z = v[1] or 0, v[2] or 0, v[3] or 0
  local len = math.sqrt(x*x + y*y + z*z)
  if len > 0.0001 then
    return { x/len, y/len, z/len }
  end
  return { 0, -1, 0 }
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

  -- Draw starfield (2D, before 3D)
  if scene.stars then
    love.graphics.setDepthMode()  -- disable depth for 2D stars
    love.graphics.setShader()
    local stars = getStars(scene.nodeId or "default", scene.width, scene.height)
    for _, star in ipairs(stars) do
      love.graphics.setColor(star.brightness, star.brightness, star.brightness * 0.95, 1)
      love.graphics.setPointSize(star.size)
      love.graphics.points(star.x, star.y)
    end
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.setDepthMode("lequal", true)  -- re-enable for 3D
  end

  -- Set up camera
  if scene.cameraNode then
    applyCamera(scene.cameraNode, scene.width, scene.height)
  else
    g3d.camera.position = {0, -3, 2}
    g3d.camera.target = {0, 0, 0}
    g3d.camera.fov = math.pi / 3
    g3d.camera.nearClip = 0.01
    g3d.camera.farClip = 1000
    g3d.camera.aspectRatio = scene.width / scene.height
    g3d.camera.updateProjectionMatrix()
    g3d.camera.updateViewMatrix()
  end

  -- Orbit controls: poll mouse directly for zero-latency rotation
  if scene.orbitControls then
    local mx, my = love.mouse.getPosition()
    local mouseDown = love.mouse.isDown(1)

    if mouseDown then
      if scene.orbitPrevMX then
        -- Already tracking: accumulate delta
        local dx = mx - scene.orbitPrevMX
        local dy = my - scene.orbitPrevMY
        scene.orbitRotY = scene.orbitRotY + dx * 0.008
        scene.orbitRotX = scene.orbitRotX + dy * 0.008
        scene.orbitPrevMX = mx
        scene.orbitPrevMY = my
      else
        -- Start tracking only if mouse is within scene bounds
        local inBounds = mx >= scene.screenX and mx <= scene.screenX + scene.width
                     and my >= scene.screenY and my <= scene.screenY + scene.height
        if inBounds then
          scene.orbitPrevMX = mx
          scene.orbitPrevMY = my
        end
      end
    else
      scene.orbitPrevMX = nil
      scene.orbitPrevMY = nil
    end

    -- Apply orbit rotation offset to all meshes
    if scene.orbitRotX ~= 0 or scene.orbitRotY ~= 0 then
      for _, entry in pairs(scene.meshes) do
        if entry.model then
          local r = entry.model.rotation
          entry.model:setRotation(r[1] + scene.orbitRotX, r[2] + scene.orbitRotY, r[3])
        end
      end
    end
  end

  -- Resolve lighting
  local dirLight = scene.directionalLight or {}
  local ambLight = scene.ambientLight or {}

  local lightDir = normalizeVec3(dirLight.direction or {-1, 0.5, -0.3})
  local lightColor = parseLightColor(dirLight.color, dirLight.intensity)
  local ambientColor = parseLightColor(ambLight.color or "#1a1a2e", ambLight.intensity or 0.15)
  local camPos = g3d.camera.position

  -- Separate opaque and transparent meshes
  local opaque = {}
  local transparent = {}
  for _, entry in pairs(scene.meshes) do
    if entry.model then
      if entry.opacity < 1.0 then
        transparent[#transparent + 1] = entry
      else
        opaque[#opaque + 1] = entry
      end
    end
  end

  -- Helper: draw a mesh with the appropriate shader
  local function drawMesh(entry)
    local useEdgeShader = entry.edgeColor or entry.wireframe

    if useEdgeShader then
      -- Edge/wireframe shader (no lighting)
      local shader = getEdgeShader()
      local ec = entry.edgeColor or {1, 1, 1, 0.6}
      local gl = entry.gridLines
      if entry.wireframe and gl == 0 then gl = 8 end
      shader:send("edgeColor", ec)
      shader:send("edgeWidth", entry.edgeWidth)
      shader:send("gridLines", gl)
      entry.model:draw(shader)
    elseif entry.unlit then
      -- Unlit: use lighting shader with full ambient, no diffuse/specular
      local shader = getLightingShader()
      shader:send("ambientColor", {1, 1, 1})
      shader:send("lightDirection", {0, 0, 0})
      shader:send("lightColor", {0, 0, 0})
      shader:send("cameraPosition", camPos)
      shader:send("specularPower", 1.0)
      shader:send("fresnelPower", entry.fresnel)
      shader:send("meshOpacity", entry.opacity)
      entry.model:draw(shader)
    else
      -- Lighting shader
      local shader = getLightingShader()
      shader:send("ambientColor", ambientColor)
      shader:send("lightDirection", lightDir)
      shader:send("lightColor", lightColor)
      shader:send("cameraPosition", camPos)
      shader:send("specularPower", entry.specular)
      shader:send("fresnelPower", entry.fresnel)
      shader:send("meshOpacity", entry.opacity)
      entry.model:draw(shader)
    end
  end

  -- Draw opaque meshes first
  for _, entry in ipairs(opaque) do
    drawMesh(entry)
  end

  -- Draw transparent meshes with depth write disabled
  if #transparent > 0 then
    love.graphics.setDepthMode("lequal", false)  -- test depth but don't write
    love.graphics.setBlendMode("alpha")
    for _, entry in ipairs(transparent) do
      drawMesh(entry)
    end
    love.graphics.setDepthMode("lequal", true)
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
