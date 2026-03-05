--[[
  geoscene3d.lua -- 3D geographic scene rendering

  Bridges @reactjit/geo and @reactjit/3d: renders real-world terrain, buildings,
  roads, and markers as a traversable 3D scene using g3d + Love2D.

  Follows the scene3d.lua / map.lua pattern:
    1. syncWithTree() scans for GeoScene3D nodes each frame
    2. renderAll() renders each scene to its off-screen Canvas
    3. get(nodeId) returns the Canvas for the painter to composite

  Coordinate system:
    - Center lat/lng = origin (0, 0, 0)
    - X = east (meters), Y = north (meters), Z = up (elevation meters)
    - Camera tracked in both 3D (x,y,z) and geo (lat,lng,alt)

  Child node types (skipped by layout/painter):
    GeoTerrainLayer   — elevation tiles + imagery overlay
    GeoBuildingLayer  — GeoJSON polygon extrusion
    GeoPath3D         — polyline ribbon on terrain
    GeoMarker3D       — 3D object at lat/lng
    GeoSky3D          — atmosphere / sky dome
]]

local GeoScene3D = {}

-- ============================================================================
-- State
-- ============================================================================

local g3d = nil            -- lazy-loaded g3d library
local Geo = nil            -- lua/geo.lua
local Terrain = nil        -- lua/terrain3d.lua
local TileCache = nil      -- lua/tilecache.lua
local Color = require("lua.color")

local scenes = {}          -- nodeId -> scene state
local initialized = false

-- 3D child types (skipped by 2D painter + layout)
GeoScene3D.CHILD_TYPES = {
  GeoTerrainLayer = true,
  GeoBuildingLayer = true,
  GeoPath3D = true,
  GeoMarker3D = true,
  GeoSky3D = true,
}

-- ============================================================================
-- Shaders
-- ============================================================================

local terrainShaderVert = [[
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
    fragNormal = mat3(modelMatrix) * VertexNormal;

    vec4 screenPos = projectionMatrix * viewMatrix * worldPos;
    if (isCanvasEnabled) {
        screenPos.y *= -1.0;
    }
    return screenPos;
}
]]

local terrainShaderFrag = [[
uniform vec3 ambientColor;
uniform vec3 lightDirection;
uniform vec3 lightColor;
uniform vec3 cameraPosition;
uniform float fogDensity;
uniform vec3 fogColor;

varying vec3 fragWorldPos;
varying vec3 fragNormal;

vec4 effect(vec4 color, Image tex, vec2 texture_coords, vec2 screen_coords) {
    vec4 texColor = Texel(tex, texture_coords);
    vec3 baseColor = texColor.rgb * color.rgb;

    vec3 N = normalize(fragNormal);
    vec3 L = normalize(lightDirection);

    // Diffuse (Lambert)
    float diff = max(dot(N, L), 0.0);

    vec3 ambient = ambientColor * baseColor;
    vec3 diffuse = lightColor * baseColor * diff;
    vec3 finalColor = ambient + diffuse;

    // Distance fog
    if (fogDensity > 0.0) {
        float dist = length(fragWorldPos - cameraPosition);
        float fogFactor = 1.0 - exp(-fogDensity * dist);
        fogFactor = clamp(fogFactor, 0.0, 1.0);
        finalColor = mix(finalColor, fogColor, fogFactor);
    }

    return vec4(finalColor, texColor.a);
}
]]

local terrainShader = nil

local function getTerrainShader()
  if not terrainShader then
    terrainShader = love.graphics.newShader(terrainShaderVert, terrainShaderFrag)
  end
  return terrainShader
end

-- Unlit shader for buildings (colored, no texture)
local buildingShaderVert = [[
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
    fragNormal = mat3(modelMatrix) * VertexNormal;

    vec4 screenPos = projectionMatrix * viewMatrix * worldPos;
    if (isCanvasEnabled) {
        screenPos.y *= -1.0;
    }
    return screenPos;
}
]]

local buildingShaderFrag = [[
uniform vec3 ambientColor;
uniform vec3 lightDirection;
uniform vec3 lightColor;
uniform vec3 cameraPosition;
uniform float fogDensity;
uniform vec3 fogColor;
uniform float meshOpacity;

varying vec3 fragWorldPos;
varying vec3 fragNormal;

vec4 effect(vec4 color, Image tex, vec2 texture_coords, vec2 screen_coords) {
    vec3 baseColor = color.rgb;

    vec3 N = normalize(fragNormal);
    vec3 L = normalize(lightDirection);
    vec3 V = normalize(cameraPosition - fragWorldPos);

    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0);

    vec3 ambient = ambientColor * baseColor;
    vec3 diffuse = lightColor * baseColor * diff;
    vec3 specular = lightColor * spec * 0.2;
    vec3 finalColor = ambient + diffuse + specular;

    if (fogDensity > 0.0) {
        float dist = length(fragWorldPos - cameraPosition);
        float fogFactor = 1.0 - exp(-fogDensity * dist);
        fogFactor = clamp(fogFactor, 0.0, 1.0);
        finalColor = mix(finalColor, fogColor, fogFactor);
    }

    return vec4(finalColor, meshOpacity);
}
]]

local buildingShader = nil

local function getBuildingShader()
  if not buildingShader then
    buildingShader = love.graphics.newShader(buildingShaderVert, buildingShaderFrag)
  end
  return buildingShader
end

-- ============================================================================
-- Initialization
-- ============================================================================

function GeoScene3D.init()
  if initialized then return end
  g3d = require("lua.g3d")
  Geo = require("lua.geo")
  Terrain = require("lua.terrain3d")
  -- TileCache is lazy-loaded when needed
  initialized = true
end

function GeoScene3D.isGeoChildType(nodeType)
  return GeoScene3D.CHILD_TYPES[nodeType] == true
end

-- ============================================================================
-- Tile cache management (shared across scenes)
-- ============================================================================

local globalCache = nil

local function getCache()
  if globalCache then return globalCache end
  if not TileCache then
    local ok, mod = pcall(require, "lua.tilecache")
    if ok then TileCache = mod end
  end
  if TileCache then
    globalCache = TileCache.open("geoscene3d_tiles.db")
  end
  return globalCache
end

-- ============================================================================
-- Color texture helper
-- ============================================================================

local colorTextureCache = {}

local function getColorTexture(hexColor)
  local key = hexColor or "__default__"
  if not colorTextureCache[key] then
    local r, g, b = 0.65, 0.7, 0.75
    if hexColor and type(hexColor) == "string" then
      local hex = hexColor:gsub("#", "")
      if #hex >= 6 then
        r = tonumber(hex:sub(1, 2), 16) / 255
        g = tonumber(hex:sub(3, 4), 16) / 255
        b = tonumber(hex:sub(5, 6), 16) / 255
      end
    end
    local imgData = love.image.newImageData(1, 1)
    imgData:setPixel(0, 0, r, g, b, 1)
    colorTextureCache[key] = love.graphics.newImage(imgData)
  end
  return colorTextureCache[key]
end

local function parseHexColor(hex)
  if not hex or type(hex) ~= "string" then return nil end
  hex = hex:gsub("#", "")
  if #hex >= 6 then
    return {
      tonumber(hex:sub(1, 2), 16) / 255,
      tonumber(hex:sub(3, 4), 16) / 255,
      tonumber(hex:sub(5, 6), 16) / 255,
    }
  end
  return nil
end

-- ============================================================================
-- Scene sync
-- ============================================================================

local function syncScene(node)
  local c = node.computed
  if not c then return end

  local w = math.floor(c.w or 0)
  local h = math.floor(c.h or 0)
  if w <= 0 or h <= 0 then return end

  local props = node.props or {}
  local scene = scenes[node.id]

  if not scene then
    scene = {
      canvas = nil,
      width = 0,
      height = 0,
      centerLat = 0,
      centerLng = 0,
      zoom = 15,
      -- Camera state
      camX = 0, camY = 0, camZ = 50,
      camDir = 0,
      camPitch = -0.2,
      cameraMode = "orbit",  -- "fps" or "orbit"
      orbitDist = 500,
      orbitAngle = 0,
      orbitPitch = -0.6,
      orbitPrevMX = nil,
      orbitPrevMY = nil,
      -- Terrain
      terrainTiles = {},     -- "z:x:y" -> { model, heightGrid, ... }
      terrainSource = nil,
      imagerySource = nil,
      heightScale = 1,
      terrainResolution = 32,
      -- Buildings
      buildingModels = {},   -- array of { model, color }
      buildingsDirty = true,
      -- Paths
      pathModels = {},       -- array of { model, color }
      -- Markers
      markerModels = {},     -- array of { model, position }
      -- Sky
      fogDensity = 0.0008,
      fogColor = {0.75, 0.82, 0.92},
      bgColor = {0.6, 0.72, 0.88, 1},
      -- Screen position for input
      screenX = 0,
      screenY = 0,
    }
    scenes[node.id] = scene
  end

  -- Recreate canvas if dimensions changed
  if scene.width ~= w or scene.height ~= h then
    if scene.canvas then scene.canvas:release() end
    scene.canvas = love.graphics.newCanvas(w, h)
    scene.width = w
    scene.height = h
  end

  -- Update from props
  local center = props.center
  if center and type(center) == "table" then
    scene.centerLat = center[1] or 0
    scene.centerLng = center[2] or 0
  end
  scene.zoom = props.zoom or 15
  scene.cameraMode = props.cameraMode or "orbit"
  scene.screenX = c.x or 0
  scene.screenY = c.y or 0

  -- Walk children
  scene.terrainSource = nil
  scene.imagerySource = nil
  scene._buildingData = nil
  scene._pathNodes = {}
  scene._markerNodes = {}
  scene._skyProps = nil

  local function walkChildren(parent)
    for _, child in ipairs(parent.children or {}) do
      local cp = child.props or {}
      if child.type == "GeoTerrainLayer" then
        scene.terrainSource = cp.elevation or ""
        scene.imagerySource = cp.imagery or ""
        scene.heightScale = cp.heightScale or 1
        scene.terrainResolution = cp.resolution or 32
      elseif child.type == "GeoBuildingLayer" then
        scene._buildingData = cp.data
        scene._buildingDefaultHeight = cp.defaultHeight or 12
        scene._buildingColor = cp.color
      elseif child.type == "GeoPath3D" then
        scene._pathNodes[#scene._pathNodes+1] = cp
      elseif child.type == "GeoMarker3D" then
        scene._markerNodes[#scene._markerNodes+1] = cp
      elseif child.type == "GeoSky3D" then
        scene._skyProps = cp
      end
    end
  end

  walkChildren(node)

  -- Apply sky props
  if scene._skyProps then
    scene.fogDensity = scene._skyProps.fog or 0.0008
    local fc = parseHexColor(scene._skyProps.fogColor)
    if fc then scene.fogColor = fc end
    local bc = parseHexColor(scene._skyProps.backgroundColor)
    if bc then scene.bgColor = {bc[1], bc[2], bc[3], 1} end
  end
end

-- ============================================================================
-- Terrain tile management
-- ============================================================================

local function ensureTerrainTiles(scene)
  if not scene.terrainSource or scene.terrainSource == "" then return end

  local cache = getCache()
  if not cache then return end

  -- Register sources if not done yet
  local elevKey = "elev:" .. scene.terrainSource:sub(1, 30)
  local imgKey = "img:" .. (scene.imagerySource or ""):sub(1, 30)

  if not cache.sources[elevKey] then
    TileCache.addSource(cache, elevKey, {
      urlTemplate = scene.terrainSource,
      minZoom = 0, maxZoom = 15, tileSize = 256,
    })
  end
  if scene.imagerySource and scene.imagerySource ~= "" and not cache.sources[imgKey] then
    TileCache.addSource(cache, imgKey, {
      urlTemplate = scene.imagerySource,
      minZoom = 0, maxZoom = 19, tileSize = 256,
    })
  end

  -- Determine which tiles to load based on center and zoom
  local intZoom = math.floor(scene.zoom)
  -- Load a 3x3 grid of tiles around center
  local centerTx, centerTy = Geo.latlngToTile(scene.centerLat, scene.centerLng, intZoom)

  local RADIUS = 1  -- tiles around center
  local tileCount = Geo.tileCount(intZoom)

  for dy = -RADIUS, RADIUS do
    for dx = -RADIUS, RADIUS do
      local tx = Geo.wrapTileX(centerTx + dx, intZoom)
      local ty = math.max(0, math.min(tileCount - 1, centerTy + dy))
      local key = intZoom .. ":" .. tx .. ":" .. ty

      if not scene.terrainTiles[key] then
        -- Try to get elevation data
        local elevData = TileCache.getTileImageData(cache, elevKey, intZoom, tx, ty)
        local imagery = TileCache.getTile(cache, imgKey, intZoom, tx, ty)

        if elevData then
          -- Compute tile bounds in local meters
          local tileLat1, tileLng1 = Geo.tileToLatlng(tx, ty, intZoom)
          local tileLat2, tileLng2 = Geo.tileToLatlng(tx + 1, ty + 1, intZoom)

          local x1, y1 = Geo.latlngToLocal(tileLat1, tileLng1, scene.centerLat, scene.centerLng)
          local x2, y2 = Geo.latlngToLocal(tileLat2, tileLng2, scene.centerLat, scene.centerLng)

          local tileW = math.abs(x2 - x1)
          local tileH = math.abs(y2 - y1)
          local originX = math.min(x1, x2)
          local originY = math.min(y1, y2)

          -- Generate height grid and mesh
          local heightGrid = Terrain.extractHeightGrid(elevData, scene.terrainResolution, scene.heightScale)
          local verts = Terrain.generateMesh(heightGrid, {
            originX = originX,
            originY = originY,
            tileWidth = tileW,
            tileHeight = tileH,
            resolution = scene.terrainResolution,
          })

          -- Use imagery or fallback color texture
          local texture = imagery or getColorTexture("#4a6741")
          local model = g3d.newModel(verts, texture)

          scene.terrainTiles[key] = {
            model = model,
            heightGrid = heightGrid,
            originX = originX,
            originY = originY,
            tileWidth = tileW,
            tileHeight = tileH,
          }
        else
          -- Not loaded yet — getTileImageData triggers fetch, will arrive next frame
          TileCache.poll(cache)
        end
      end
    end
  end

  -- Poll for async tile fetches
  TileCache.poll(cache)
end

-- ============================================================================
-- Building management
-- ============================================================================

local function ensureBuildings(scene)
  local data = scene._buildingData
  if not data then return end
  if not scene.buildingsDirty and #scene.buildingModels > 0 then return end

  -- Clear old
  for _, entry in ipairs(scene.buildingModels) do
    if entry.model and entry.model.mesh then
      pcall(function() entry.model.mesh:release() end)
    end
  end
  scene.buildingModels = {}

  local features = data.features or {}
  local defaultHeight = scene._buildingDefaultHeight or 12

  for _, feature in ipairs(features) do
    if feature.geometry and feature.geometry.type == "Polygon" then
      local coords = feature.geometry.coordinates
      if coords and coords[1] then
        local ring = coords[1]
        local localVerts = {}
        for _, coord in ipairs(ring) do
          local lng, lat = coord[1], coord[2]
          local x, y = Geo.latlngToLocal(lat, lng, scene.centerLat, scene.centerLng)
          localVerts[#localVerts+1] = {x, y}
        end

        local props = feature.properties or {}
        local height = props.height or props["building:height"] or defaultHeight
        local baseZ = 0  -- TODO: sample terrain height
        local topZ = baseZ + height

        local meshVerts = Terrain.extrudeBuilding(localVerts, baseZ, topZ)

        -- Color from properties
        local colorHex = props.fill or scene._buildingColor or "#8899aa"
        local colorTex = getColorTexture(colorHex)
        local model = g3d.newModel(meshVerts, colorTex)

        local c = parseHexColor(colorHex) or {0.55, 0.6, 0.67}
        scene.buildingModels[#scene.buildingModels+1] = { model = model, color = c }
      end
    end
  end

  scene.buildingsDirty = false
end

-- ============================================================================
-- Path management
-- ============================================================================

local function ensurePaths(scene)
  -- Clear old
  for _, entry in ipairs(scene.pathModels) do
    if entry.model and entry.model.mesh then
      pcall(function() entry.model.mesh:release() end)
    end
  end
  scene.pathModels = {}

  for _, pathProps in ipairs(scene._pathNodes) do
    local positions = pathProps.positions
    if positions and #positions >= 2 then
      local localPoints = {}
      for _, pos in ipairs(positions) do
        local lat = pos[1] or pos.lat or 0
        local lng = pos[2] or pos.lng or 0
        local x, y = Geo.latlngToLocal(lat, lng, scene.centerLat, scene.centerLng)
        localPoints[#localPoints+1] = {x, y, 0}  -- z=0, terrain sample TODO
      end

      local width = (pathProps.width or 3) / 2
      local verts = Terrain.generateRibbon(localPoints, width)
      if #verts > 0 then
        local colorHex = pathProps.color or "#f97316"
        local colorTex = getColorTexture(colorHex)
        local model = g3d.newModel(verts, colorTex)
        local c = parseHexColor(colorHex) or {0.98, 0.45, 0.09}
        scene.pathModels[#scene.pathModels+1] = { model = model, color = c }
      end
    end
  end
end

-- ============================================================================
-- Marker management
-- ============================================================================

local function ensureMarkers(scene)
  for _, entry in ipairs(scene.markerModels) do
    if entry.model and entry.model.mesh then
      pcall(function() entry.model.mesh:release() end)
    end
  end
  scene.markerModels = {}

  for _, markerProps in ipairs(scene._markerNodes) do
    local pos = markerProps.position
    if pos then
      local lat = pos[1] or pos.lat or 0
      local lng = pos[2] or pos.lng or 0
      local x, y = Geo.latlngToLocal(lat, lng, scene.centerLat, scene.centerLng)
      local z = (markerProps.altitude or 0) + 5  -- above ground

      local scale = markerProps.scale or 5
      local colorHex = markerProps.color or "#ef4444"
      local colorTex = getColorTexture(colorHex)

      -- Simple sphere marker
      local geom = markerProps.geometry or "sphere"
      local verts
      if geom == "box" or geom == "cube" then
        -- Inline box gen (small)
        local hs = 0.5
        verts = {}
        local function face(v1, v2, v3, v4, nx, ny, nz)
          verts[#verts+1] = {v1[1],v1[2],v1[3], 0,0, nx,ny,nz}
          verts[#verts+1] = {v2[1],v2[2],v2[3], 1,0, nx,ny,nz}
          verts[#verts+1] = {v3[1],v3[2],v3[3], 1,1, nx,ny,nz}
          verts[#verts+1] = {v1[1],v1[2],v1[3], 0,0, nx,ny,nz}
          verts[#verts+1] = {v3[1],v3[2],v3[3], 1,1, nx,ny,nz}
          verts[#verts+1] = {v4[1],v4[2],v4[3], 0,1, nx,ny,nz}
        end
        face({-hs,hs,-hs},{hs,hs,-hs},{hs,hs,hs},{-hs,hs,hs}, 0,1,0)
        face({hs,-hs,-hs},{-hs,-hs,-hs},{-hs,-hs,hs},{hs,-hs,hs}, 0,-1,0)
        face({hs,hs,-hs},{hs,-hs,-hs},{hs,-hs,hs},{hs,hs,hs}, 1,0,0)
        face({-hs,-hs,-hs},{-hs,hs,-hs},{-hs,hs,hs},{-hs,-hs,hs}, -1,0,0)
        face({-hs,hs,hs},{hs,hs,hs},{hs,-hs,hs},{-hs,-hs,hs}, 0,0,1)
        face({-hs,-hs,-hs},{hs,-hs,-hs},{hs,hs,-hs},{-hs,hs,-hs}, 0,0,-1)
      else
        -- Sphere (low poly)
        local seg, rng = 16, 12
        verts = {}
        local pi = math.pi
        for i = 0, rng - 1 do
          local t1, t2 = pi*i/rng, pi*(i+1)/rng
          for j = 0, seg - 1 do
            local p1, p2 = 2*pi*j/seg, 2*pi*(j+1)/seg
            local function pt(t, p)
              local st = math.sin(t)
              local xx = 0.5*st*math.cos(p)
              local yy = 0.5*st*math.sin(p)
              local zz = 0.5*math.cos(t)
              return {xx,yy,zz, p/(2*pi), t/pi, st*math.cos(p), st*math.sin(p), math.cos(t)}
            end
            local a,b,cc,d = pt(t1,p1), pt(t1,p2), pt(t2,p2), pt(t2,p1)
            verts[#verts+1]=a; verts[#verts+1]=d; verts[#verts+1]=cc
            verts[#verts+1]=a; verts[#verts+1]=cc; verts[#verts+1]=b
          end
        end
      end

      local model = g3d.newModel(verts, colorTex)
      model:setTransform({x, y, z}, {0, 0, 0}, {scale, scale, scale})

      local c = parseHexColor(colorHex) or {0.94, 0.27, 0.27}
      scene.markerModels[#scene.markerModels+1] = { model = model, color = c }
    end
  end
end

-- ============================================================================
-- Camera
-- ============================================================================

local function updateCamera(scene, dt)
  if scene.cameraMode == "fps" then
    -- First-person movement (WASD + mouselook done by input handlers)
    local speed = 50 * (dt or 1/60)
    local moved = false

    if love.keyboard.isDown("w") then
      scene.camX = scene.camX + math.cos(scene.camDir) * speed
      scene.camY = scene.camY + math.sin(scene.camDir) * speed
      moved = true
    end
    if love.keyboard.isDown("s") then
      scene.camX = scene.camX - math.cos(scene.camDir) * speed
      scene.camY = scene.camY - math.sin(scene.camDir) * speed
      moved = true
    end
    if love.keyboard.isDown("a") then
      scene.camX = scene.camX + math.cos(scene.camDir + math.pi/2) * speed
      scene.camY = scene.camY + math.sin(scene.camDir + math.pi/2) * speed
      moved = true
    end
    if love.keyboard.isDown("d") then
      scene.camX = scene.camX - math.cos(scene.camDir + math.pi/2) * speed
      scene.camY = scene.camY - math.sin(scene.camDir + math.pi/2) * speed
      moved = true
    end
    if love.keyboard.isDown("space") then
      scene.camZ = scene.camZ + speed
      moved = true
    end
    if love.keyboard.isDown("lshift") then
      scene.camZ = scene.camZ - speed
      moved = true
    end

    -- Terrain height clamping
    local minZ = 1.7  -- eye height
    -- TODO: sample terrain height at camera position
    if scene.camZ < minZ then scene.camZ = minZ end

    g3d.camera.position = {scene.camX, scene.camY, scene.camZ}
    local cosPitch = math.cos(scene.camPitch)
    g3d.camera.target = {
      scene.camX + math.cos(scene.camDir) * cosPitch,
      scene.camY + math.sin(scene.camDir) * cosPitch,
      scene.camZ + math.sin(scene.camPitch),
    }
  else
    -- Orbit mode: rotate around center
    local mx, my = love.mouse.getPosition()
    local mouseDown = love.mouse.isDown(1)

    if mouseDown then
      if scene.orbitPrevMX then
        local dx = mx - scene.orbitPrevMX
        local dy = my - scene.orbitPrevMY
        scene.orbitAngle = scene.orbitAngle + dx * 0.005
        scene.orbitPitch = math.max(-math.pi * 0.48, math.min(-0.05, scene.orbitPitch + dy * 0.005))
        scene.orbitPrevMX = mx
        scene.orbitPrevMY = my
      else
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

    -- Scroll wheel zoom
    -- (handled by handleWheel)

    local dist = scene.orbitDist
    local angle = scene.orbitAngle
    local pitch = scene.orbitPitch

    scene.camX = math.cos(angle) * math.cos(pitch) * dist
    scene.camY = math.sin(angle) * math.cos(pitch) * dist
    scene.camZ = -math.sin(pitch) * dist

    g3d.camera.position = {scene.camX, scene.camY, scene.camZ}
    g3d.camera.target = {0, 0, 0}
  end

  g3d.camera.fov = math.pi / 3
  g3d.camera.nearClip = 1
  g3d.camera.farClip = 5000
  g3d.camera.aspectRatio = scene.width / scene.height
  g3d.camera.updateProjectionMatrix()
  g3d.camera.updateViewMatrix()
end

-- ============================================================================
-- Rendering
-- ============================================================================

local function renderScene(scene, dt)
  if not scene.canvas then return end

  -- Drain any leaked push/pop frames
  for _ = 1, 64 do
    local ok = pcall(love.graphics.pop)
    if not ok then break end
  end

  love.graphics.push("all")

  local okRender, renderErr = xpcall(function()
    love.graphics.setCanvas({scene.canvas, depth = true})
    love.graphics.setDepthMode("lequal", true)
    love.graphics.clear(scene.bgColor[1], scene.bgColor[2], scene.bgColor[3], scene.bgColor[4])
    love.graphics.setColor(1, 1, 1, 1)

    -- Update camera
    updateCamera(scene, dt)

    -- Lighting
    local lightDir = {0.4, 0.3, 0.8}  -- sun direction
    local len = math.sqrt(lightDir[1]^2 + lightDir[2]^2 + lightDir[3]^2)
    lightDir = {lightDir[1]/len, lightDir[2]/len, lightDir[3]/len}
    local lightColor = {1.0, 0.95, 0.9}
    local ambientColor = {0.25, 0.28, 0.35}
    local camPos = g3d.camera.position

    -- Draw terrain tiles
    local shader = getTerrainShader()
    shader:send("ambientColor", ambientColor)
    shader:send("lightDirection", lightDir)
    shader:send("lightColor", lightColor)
    shader:send("cameraPosition", camPos)
    shader:send("fogDensity", scene.fogDensity)
    shader:send("fogColor", scene.fogColor)

    for _, tile in pairs(scene.terrainTiles) do
      if tile.model then
        tile.model:draw(shader)
      end
    end

    -- Draw buildings
    local bShader = getBuildingShader()
    bShader:send("ambientColor", ambientColor)
    bShader:send("lightDirection", lightDir)
    bShader:send("lightColor", lightColor)
    bShader:send("cameraPosition", camPos)
    bShader:send("fogDensity", scene.fogDensity)
    bShader:send("fogColor", scene.fogColor)
    bShader:send("meshOpacity", 0.9)

    for _, entry in ipairs(scene.buildingModels) do
      if entry.model then
        love.graphics.setColor(entry.color[1], entry.color[2], entry.color[3], 1)
        entry.model:draw(bShader)
      end
    end

    -- Draw paths
    for _, entry in ipairs(scene.pathModels) do
      if entry.model then
        love.graphics.setColor(entry.color[1], entry.color[2], entry.color[3], 1)
        entry.model:draw(bShader)
      end
    end

    -- Draw markers
    for _, entry in ipairs(scene.markerModels) do
      if entry.model then
        love.graphics.setColor(entry.color[1], entry.color[2], entry.color[3], 1)
        entry.model:draw(bShader)
      end
    end

    love.graphics.setColor(1, 1, 1, 1)
  end, debug.traceback)

  pcall(love.graphics.pop)
  love.graphics.setCanvas()

  for _ = 1, 64 do
    local ok = pcall(love.graphics.pop)
    if not ok then break end
  end

  if not okRender then
    -- Silently log, don't crash
    local Log = require("lua.debug_log")
    Log.warn("[GeoScene3D] render error: " .. tostring(renderErr))
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

function GeoScene3D.syncWithTree(treeNodes)
  if not initialized then return end

  local activeIds = {}

  for id, node in pairs(treeNodes) do
    if node.type == "GeoScene3D" then
      syncScene(node)
      activeIds[id] = true

      local scene = scenes[id]
      if scene then
        ensureTerrainTiles(scene)
        ensureBuildings(scene)
        ensurePaths(scene)
        ensureMarkers(scene)
      end
    end
  end

  -- Cleanup removed scenes
  for id in pairs(scenes) do
    if not activeIds[id] then
      GeoScene3D.cleanup(id)
    end
  end
end

function GeoScene3D.renderAll(dt)
  if not initialized then return end
  for _, scene in pairs(scenes) do
    renderScene(scene, dt)
  end
end

function GeoScene3D.get(nodeId)
  local scene = scenes[nodeId]
  return scene and scene.canvas or nil
end

function GeoScene3D.cleanup(nodeId)
  local scene = scenes[nodeId]
  if not scene then return end

  if scene.canvas then scene.canvas:release() end

  for _, tile in pairs(scene.terrainTiles) do
    if tile.model and tile.model.mesh then
      pcall(function() tile.model.mesh:release() end)
    end
  end
  for _, entry in ipairs(scene.buildingModels) do
    if entry.model and entry.model.mesh then
      pcall(function() entry.model.mesh:release() end)
    end
  end
  for _, entry in ipairs(scene.pathModels) do
    if entry.model and entry.model.mesh then
      pcall(function() entry.model.mesh:release() end)
    end
  end
  for _, entry in ipairs(scene.markerModels) do
    if entry.model and entry.model.mesh then
      pcall(function() entry.model.mesh:release() end)
    end
  end

  scenes[nodeId] = nil
end

function GeoScene3D.hasScenes()
  return next(scenes) ~= nil
end

function GeoScene3D.count()
  local n = 0
  for _ in pairs(scenes) do n = n + 1 end
  return n
end

--- Handle mouse wheel for orbit zoom
function GeoScene3D.handleWheel(node, dx, dy)
  local scene = scenes[node.id]
  if not scene then return end
  if scene.cameraMode == "orbit" then
    scene.orbitDist = math.max(50, math.min(3000, scene.orbitDist - dy * 50))
  end
end

return GeoScene3D
