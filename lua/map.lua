--[[
  map.lua — Lua-owned 2D/3D map rendering engine

  Manages interactive map viewports that participate in the 2D layout tree.
  Each Map2D node renders to an off-screen Love2D Canvas. The 2D painter
  composites the Canvas at the node's computed position.

  Follows the scene3d.lua pattern:
    1. syncWithTree() scans the tree for Map2D nodes each frame
    2. renderAll() renders each map to its Canvas
    3. get(nodeId) returns the Canvas for the painter to draw

  Lua owns ALL interaction (pan, zoom, tilt, bearing) for zero-latency response.
  React declares what's on the map; Lua decides how it renders.

  Child node types:
    - MapTileLayer: tile source configuration
    - MapMarker: positioned overlay at lat/lng
    - MapPolyline: line path through lat/lng points
    - MapPolygon: filled area from lat/lng points
    - MapGeoJSON: rendered GeoJSON features

  Requires: lua/geo.lua, lua/tilecache.lua
]]

local Map = {}

-- ============================================================================
-- Dependencies (lazy-loaded)
-- ============================================================================

local Geo = nil
local TileCache = nil
local g3d = nil           -- lazy-loaded for 3D rendering (pitch > 0)
local mapShader = nil     -- MVP + Canvas Y-flip shader for 3D tiles
local sharedQuad = nil    -- reusable unit quad model for tile rendering
local missingTileTexture = nil

-- ============================================================================
-- State
-- ============================================================================

local maps = {}          -- nodeId → map state
local initialized = false
local globalCache = nil  -- shared TileCache handle for all maps

-- Map child types that should not be painted by the 2D painter
Map.CHILD_TYPES = {
  MapTileLayer = true,
  MapMarker = true,
  MapPolyline = true,
  MapPolygon = true,
  MapGeoJSON = true,
}

-- ============================================================================
-- Pending events (queued for bridge → React)
-- ============================================================================

local pendingEvents = {}

local function queueEvent(nodeId, eventType, payload)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    payload = payload,
  }
end

-- ============================================================================
-- Initialization
-- ============================================================================

function Map.init()
  if initialized then return end
  initialized = true

  Geo = require("lua.geo")
  TileCache = require("lua.tilecache")

  -- Open a shared tile cache database
  globalCache = TileCache.open("tilecache.db")

  -- Add built-in tile sources
  TileCache.addSource(globalCache, "osm", {})

  -- Initialize g3d for 3D map rendering (pitch > 0)
  local ok, g3dMod = pcall(require, "lua.g3d")
  if ok then
    g3d = g3dMod

    -- Shader: MVP transform + Canvas Y-flip (no lighting — tiles are pre-rendered)
    mapShader = love.graphics.newShader([[
      uniform mat4 projectionMatrix;
      uniform mat4 viewMatrix;
      uniform mat4 modelMatrix;
      uniform bool isCanvasEnabled;
      attribute vec3 VertexNormal;

      vec4 position(mat4 transformProjection, vec4 vertexPosition) {
        vec4 pos = projectionMatrix * viewMatrix * modelMatrix * vertexPosition;
        if (isCanvasEnabled) {
          pos.y *= -1.0;
        }
        return pos;
      }
    ]])

    -- Shared unit quad on XY plane (Y goes negative = south, UV matches tile image)
    -- Winding: CCW from +Z (front face points up)
    local verts = {
      -- Triangle 1: NW → SE → NE
      {0,  0, 0,   0, 0,   0, 0, 1},
      {1, -1, 0,   1, 1,   0, 0, 1},
      {1,  0, 0,   1, 0,   0, 0, 1},
      -- Triangle 2: NW → SW → SE
      {0,  0, 0,   0, 0,   0, 0, 1},
      {0, -1, 0,   0, 1,   0, 0, 1},
      {1, -1, 0,   1, 1,   0, 0, 1},
    }
    local dummyData = love.image.newImageData(1, 1)
    dummyData:setPixel(0, 0, 1, 1, 1, 1)
    local dummyTex = love.graphics.newImage(dummyData)
    missingTileTexture = dummyTex
    sharedQuad = g3d.newModel(verts, dummyTex, {0,0,0}, {0,0,0}, {1,1,1})
  end
end

-- ============================================================================
-- Hex color parsing
-- ============================================================================

local function parseHexColor(hex, alpha)
  if not hex or type(hex) ~= "string" then return 1, 1, 1, alpha or 1 end
  hex = hex:gsub("#", "")
  -- Handle 8-char hex (with alpha)
  if #hex == 8 then
    return tonumber(hex:sub(1, 2), 16) / 255,
           tonumber(hex:sub(3, 4), 16) / 255,
           tonumber(hex:sub(5, 6), 16) / 255,
           tonumber(hex:sub(7, 8), 16) / 255
  elseif #hex == 6 then
    return tonumber(hex:sub(1, 2), 16) / 255,
           tonumber(hex:sub(3, 4), 16) / 255,
           tonumber(hex:sub(5, 6), 16) / 255,
           alpha or 1
  end
  return 1, 1, 1, alpha or 1
end

-- ============================================================================
-- Map state management
-- ============================================================================

local function getOrCreateMap(nodeId)
  if maps[nodeId] then return maps[nodeId] end

  local m = {
    -- View state
    centerLat = 0,
    centerLng = 0,
    zoom = 2,
    bearing = 0,         -- degrees, 0 = north up
    pitch = 0,           -- degrees, 0 = top-down
    projection = "mercator",
    minZoom = 0,
    maxZoom = 19,

    -- Canvas
    canvas = nil,
    width = 0,
    height = 0,

    -- Interaction state (Lua-owned, zero-latency)
    isDragging = false,
    dragStartX = nil,
    dragStartY = nil,
    dragStartCenterLat = nil,
    dragStartCenterLng = nil,

    -- Zoom animation
    zoomAnimating = false,
    zoomFrom = 0,
    zoomTo = 0,
    zoomT = 0,
    zoomDuration = 0.3,

    -- Children (synced from tree each frame)
    tileLayers = {},     -- ordered list of tile layer configs
    markers = {},        -- nodeId → { lat, lng, anchor, children, ... }
    polylines = {},      -- nodeId → { positions, color, width, ... }
    polygons = {},       -- nodeId → { positions, fillColor, strokeColor, ... }
    geojsonLayers = {},  -- nodeId → { data, style }

    -- Screen position (for bounds checking pointer events)
    screenX = 0,
    screenY = 0,

    -- Track whether view changed (to emit events)
    viewDirty = false,
  }

  maps[nodeId] = m
  return m
end

-- ============================================================================
-- Sync with tree
-- ============================================================================

local function syncMap(node)
  if not Geo then return end

  local c = node.computed
  if not c then return end

  local w = math.floor(c.w or 0)
  local h = math.floor(c.h or 0)
  if w <= 0 or h <= 0 then return end

  local m = getOrCreateMap(node.id)
  local props = node.props or {}

  -- Update view from React props (only if not being dragged)
  if not m.isDragging then
    if props.center then
      local lat = props.center[1] or props.center.lat or 0
      local lng = props.center[2] or props.center.lng or 0
      if lat ~= m.centerLat or lng ~= m.centerLng then
        m.centerLat = lat
        m.centerLng = lng
      end
    end
    if props.zoom ~= nil and not m.zoomAnimating then
      m.zoom = props.zoom
    end
    if props.bearing ~= nil then m.bearing = props.bearing end
    if props.pitch ~= nil then m.pitch = props.pitch end
  end

  if props.projection ~= nil then m.projection = props.projection end
  if props.minZoom ~= nil then m.minZoom = props.minZoom end
  if props.maxZoom ~= nil then m.maxZoom = props.maxZoom end

  -- Update screen position
  m.screenX = c.x or 0
  m.screenY = c.y or 0

  -- Recreate canvas if dimensions changed
  if m.width ~= w or m.height ~= h then
    if m.canvas then m.canvas:release() end
    m.canvas = love.graphics.newCanvas(w, h)
    m.width = w
    m.height = h
  end

  -- Walk children to collect tile layers, markers, polylines, polygons
  m.tileLayers = {}
  m.markers = {}
  m.polylines = {}
  m.polygons = {}
  m.geojsonLayers = {}

  if props.markers then
    for i, marker in ipairs(props.markers) do
      m.markers["prop_" .. i] = {
        lat = marker.lat or marker[1] or 0,
        lng = marker.lng or marker[2] or 0,
        anchor = marker.anchor or "bottom-center",
        draggable = marker.draggable or false,
      }
    end
  end

  if props.polylines then
    for i, poly in ipairs(props.polylines) do
      m.polylines["prop_" .. i] = {
        positions = poly.positions or {},
        color = poly.color or "#3498db",
        width = poly.width or 2,
        dashArray = poly.dashArray,
        animated = poly.animated or false,
        arrowheads = poly.arrowheads or false,
      }
    end
  end

  local function walkChildren(parent)
    for _, child in ipairs(parent.children or {}) do
      local cp = child.props or {}

      if child.type == "MapTileLayer" then
        -- Ensure the source is registered
        local sourceName = cp.source or "osm"
        if cp.urlTemplate and not globalCache.sources[sourceName] then
          TileCache.addSource(globalCache, sourceName, {
            urlTemplate = cp.urlTemplate,
            type = cp.type or "raster",
            minZoom = cp.minZoom or 0,
            maxZoom = cp.maxZoom or 19,
            tileSize = cp.tileSize or 256,
            attribution = cp.attribution or "",
            headers = cp.headers or {},
          })
        elseif not globalCache.sources[sourceName] then
          -- Built-in source alias
          TileCache.addSource(globalCache, sourceName, {})
        end

        m.tileLayers[#m.tileLayers + 1] = {
          source = sourceName,
          opacity = cp.opacity or 1,
          minZoom = cp.minZoom or 0,
          maxZoom = cp.maxZoom or 19,
        }

      elseif child.type == "MapMarker" then
        local pos = cp.position or { 0, 0 }
        m.markers[child.id] = {
          lat = pos[1] or 0,
          lng = pos[2] or 0,
          anchor = cp.anchor or "bottom-center",
          draggable = cp.draggable or false,
          children = child.children,
          hasHandlers = child.hasHandlers,
        }

      elseif child.type == "MapPolyline" then
        m.polylines[child.id] = {
          positions = cp.positions or {},
          color = cp.color or "#3498db",
          width = cp.width or 2,
          dashArray = cp.dashArray,
          animated = cp.animated or false,
          arrowheads = cp.arrowheads or false,
        }

      elseif child.type == "MapPolygon" then
        m.polygons[child.id] = {
          positions = cp.positions or {},
          fillColor = cp.fillColor or "#3498db40",
          strokeColor = cp.strokeColor or "#3498db",
          strokeWidth = cp.strokeWidth or 2,
          extrude = cp.extrude or 0,
        }

      elseif child.type == "MapGeoJSON" then
        m.geojsonLayers[child.id] = {
          data = cp.data,
          style = cp.style,
        }
      end
    end
  end

  walkChildren(node)
end

-- ============================================================================
-- Rendering
-- ============================================================================

--- Project a lat/lng to pixel position relative to the map canvas.
--- @return number x, number y  Pixel coordinates on the canvas
local function projectToCanvas(m, lat, lng)
  local intZoom = math.floor(m.zoom)
  local centerPx, centerPy = Geo.latlngToPixel(m.centerLat, m.centerLng, intZoom)
  local pointPx, pointPy = Geo.latlngToPixel(lat, lng, intZoom)

  -- Fractional zoom: scale from integer tile coordinates
  local fracScale = math.pow(2, m.zoom - intZoom)

  local dx = (pointPx - centerPx) * fracScale
  local dy = (pointPy - centerPy) * fracScale

  return m.width / 2 + dx, m.height / 2 + dy
end

--- Render tile layers onto the map canvas.
local function renderTileLayers(m)
  local intZoom = math.floor(m.zoom)
  local fracScale = math.pow(2, m.zoom - intZoom)
  local tileSize = Geo.tileSize()
  local scaledTileSize = tileSize * fracScale

  local centerPx, centerPy = Geo.latlngToPixel(m.centerLat, m.centerLng, intZoom)

  -- Compute visible tile range
  local minTx, minTy, maxTx, maxTy = Geo.visibleTiles(
    m.centerLat, m.centerLng, m.zoom, m.width, m.height
  )

  for _, layer in ipairs(m.tileLayers) do
    if layer.source and intZoom >= layer.minZoom and intZoom <= layer.maxZoom then
      love.graphics.setColor(1, 1, 1, layer.opacity)

      for ty = minTy, maxTy do
        for tx = minTx, maxTx do
          local wrappedTx = Geo.wrapTileX(tx, intZoom)
          local img = TileCache.getTile(globalCache, layer.source, intZoom, wrappedTx, ty)

          -- Tile pixel position relative to canvas
          local tilePxX = tx * tileSize
          local tilePxY = ty * tileSize
          local drawX = (tilePxX - centerPx) * fracScale + m.width / 2
          local drawY = (tilePxY - centerPy) * fracScale + m.height / 2

          if img then
            love.graphics.draw(img, drawX, drawY, 0,
              scaledTileSize / tileSize, scaledTileSize / tileSize)
          else
            -- Placeholder: light gray tile with border
            love.graphics.setColor(0.85, 0.85, 0.85, layer.opacity * 0.3)
            love.graphics.rectangle("fill", drawX, drawY, scaledTileSize, scaledTileSize)
            love.graphics.setColor(0.7, 0.7, 0.7, layer.opacity * 0.2)
            love.graphics.rectangle("line", drawX, drawY, scaledTileSize, scaledTileSize)
            love.graphics.setColor(1, 1, 1, layer.opacity)
          end
        end
      end
    end
  end
end

--- Render polylines on the map.
local function renderPolylines(m, effectiveOpacity)
  for _, poly in pairs(m.polylines) do
    local positions = poly.positions
    if positions and #positions >= 2 then
      local r, g, b, a = parseHexColor(poly.color)
      love.graphics.setColor(r, g, b, a * effectiveOpacity)
      love.graphics.setLineWidth(poly.width or 2)

      -- Build flat point list
      local points = {}
      for i, pos in ipairs(positions) do
        local lat = pos[1] or 0
        local lng = pos[2] or 0
        local px, py = projectToCanvas(m, lat, lng)
        points[#points + 1] = px
        points[#points + 1] = py
      end

      if #points >= 4 then
        love.graphics.line(points)
      end

      -- Arrowheads along path
      if poly.arrowheads and #points >= 4 then
        local arrowSize = (poly.width or 2) * 3
        love.graphics.setColor(r, g, b, a * effectiveOpacity)
        -- Place an arrow every ~100 pixels
        local accumDist = 0
        for i = 3, #points, 2 do
          local x1, y1 = points[i - 2], points[i - 1]
          local x2, y2 = points[i], points[i + 1]
          local dx = x2 - x1
          local dy = y2 - y1
          local segLen = math.sqrt(dx * dx + dy * dy)
          accumDist = accumDist + segLen
          if accumDist >= 100 then
            accumDist = 0
            local angle = math.atan2(dy, dx)
            local mx = (x1 + x2) / 2
            local my = (y1 + y2) / 2
            -- Draw arrow triangle
            love.graphics.polygon("fill",
              mx + math.cos(angle) * arrowSize, my + math.sin(angle) * arrowSize,
              mx + math.cos(angle + 2.5) * arrowSize * 0.6, my + math.sin(angle + 2.5) * arrowSize * 0.6,
              mx + math.cos(angle - 2.5) * arrowSize * 0.6, my + math.sin(angle - 2.5) * arrowSize * 0.6
            )
          end
        end
      end

      love.graphics.setLineWidth(1)
    end
  end
end

--- Render polygons on the map.
local function renderPolygons(m, effectiveOpacity)
  for _, poly in pairs(m.polygons) do
    local positions = poly.positions
    if positions and #positions >= 3 then
      -- Build flat vertex list
      local verts = {}
      for _, pos in ipairs(positions) do
        local lat = pos[1] or 0
        local lng = pos[2] or 0
        local px, py = projectToCanvas(m, lat, lng)
        verts[#verts + 1] = px
        verts[#verts + 1] = py
      end

      if #verts >= 6 then
        -- Fill
        local fr, fg, fb, fa = parseHexColor(poly.fillColor)
        love.graphics.setColor(fr, fg, fb, fa * effectiveOpacity)
        -- Use triangulate for concave polygons
        local triangles = love.math.triangulate(verts)
        for _, tri in ipairs(triangles) do
          love.graphics.polygon("fill", tri)
        end

        -- Stroke
        local sr, sg, sb, sa = parseHexColor(poly.strokeColor)
        love.graphics.setColor(sr, sg, sb, sa * effectiveOpacity)
        love.graphics.setLineWidth(poly.strokeWidth or 2)
        -- Close the polygon
        local closedVerts = {}
        for i = 1, #verts do closedVerts[i] = verts[i] end
        closedVerts[#closedVerts + 1] = verts[1]
        closedVerts[#closedVerts + 1] = verts[2]
        love.graphics.line(closedVerts)
        love.graphics.setLineWidth(1)
      end
    end
  end
end

--- Render markers on the map.
local function renderMarkers(m, effectiveOpacity)
  for nodeId, marker in pairs(m.markers) do
    local px, py = projectToCanvas(m, marker.lat, marker.lng)

    -- Default marker: red circle with white border
    local markerW = 20
    local markerH = 20

    -- Anchor offset
    local ox, oy = 0, 0
    if marker.anchor == "bottom-center" then
      ox = -markerW / 2
      oy = -markerH
    elseif marker.anchor == "center" then
      ox = -markerW / 2
      oy = -markerH / 2
    elseif marker.anchor == "top-center" then
      ox = -markerW / 2
      oy = 0
    end

    -- Draw default marker (custom children are rendered by the tree/painter)
    love.graphics.setColor(0.91, 0.30, 0.24, effectiveOpacity) -- #e74c3c
    love.graphics.circle("fill", px + ox + markerW / 2, py + oy + markerH / 2, markerW / 2)
    love.graphics.setColor(1, 1, 1, effectiveOpacity)
    love.graphics.circle("line", px + ox + markerW / 2, py + oy + markerH / 2, markerW / 2)
  end
end

-- ============================================================================
-- GeoJSON rendering
-- ============================================================================

--- Extract features from a GeoJSON data table.
--- Handles FeatureCollection, single Feature, and raw Geometry objects.
--- GeoJSON coordinates are [longitude, latitude] (reversed from our convention).
local function extractGeoJSONFeatures(data)
  if not data then return {} end

  if data.type == "FeatureCollection" and data.features then
    return data.features
  elseif data.type == "Feature" then
    return { data }
  elseif data.type == "Point" or data.type == "LineString" or data.type == "Polygon"
      or data.type == "MultiPoint" or data.type == "MultiLineString" or data.type == "MultiPolygon" then
    -- Raw geometry → wrap as feature
    return {{ type = "Feature", geometry = data, properties = {} }}
  end

  return {}
end

--- Get style for a GeoJSON feature from its properties.
local function getFeatureStyle(feature)
  local props = feature.properties or {}
  return {
    fillColor   = props.fillColor   or props.fill        or "#3498db40",
    strokeColor = props.strokeColor or props.stroke      or "#333333",
    strokeWidth = props.strokeWidth or props["stroke-width"] or 1,
    extrude     = props.extrude     or props.height      or 0,
  }
end

--- Render a GeoJSON polygon ring in 2D.
local function renderGeoJSONRing2D(m, ring, style, effectiveOpacity)
  if not ring or #ring < 3 then return end

  local verts = {}
  for _, coord in ipairs(ring) do
    -- GeoJSON: [lng, lat]
    local px, py = projectToCanvas(m, coord[2], coord[1])
    verts[#verts + 1] = px
    verts[#verts + 1] = py
  end

  if #verts < 6 then return end

  -- Fill
  local fr, fg, fb, fa = parseHexColor(style.fillColor)
  love.graphics.setColor(fr, fg, fb, fa * effectiveOpacity)
  local ok, triangles = pcall(love.math.triangulate, verts)
  if ok and triangles then
    for _, tri in ipairs(triangles) do
      love.graphics.polygon("fill", tri)
    end
  end

  -- Stroke
  local sr, sg, sb, sa = parseHexColor(style.strokeColor)
  love.graphics.setColor(sr, sg, sb, sa * effectiveOpacity)
  love.graphics.setLineWidth(style.strokeWidth)
  local closed = {}
  for i = 1, #verts do closed[i] = verts[i] end
  closed[#closed + 1] = verts[1]
  closed[#closed + 1] = verts[2]
  love.graphics.line(closed)
  love.graphics.setLineWidth(1)
end

--- Render GeoJSON features in 2D mode.
local function renderGeoJSON(m, effectiveOpacity)
  for _, layer in pairs(m.geojsonLayers) do
    local features = extractGeoJSONFeatures(layer.data)

    for _, feature in ipairs(features) do
      local geom = feature.geometry
      if not geom then goto nextFeature end
      local style = getFeatureStyle(feature)

      if geom.type == "Point" then
        local coord = geom.coordinates
        if coord then
          local px, py = projectToCanvas(m, coord[2], coord[1])
          local fr, fg, fb, fa = parseHexColor(style.fillColor)
          love.graphics.setColor(fr, fg, fb, fa * effectiveOpacity)
          love.graphics.circle("fill", px, py, 5)
          local sr, sg, sb, sa = parseHexColor(style.strokeColor)
          love.graphics.setColor(sr, sg, sb, sa * effectiveOpacity)
          love.graphics.circle("line", px, py, 5)
        end

      elseif geom.type == "MultiPoint" then
        for _, coord in ipairs(geom.coordinates or {}) do
          local px, py = projectToCanvas(m, coord[2], coord[1])
          local fr, fg, fb, fa = parseHexColor(style.fillColor)
          love.graphics.setColor(fr, fg, fb, fa * effectiveOpacity)
          love.graphics.circle("fill", px, py, 5)
        end

      elseif geom.type == "LineString" then
        local points = {}
        for _, coord in ipairs(geom.coordinates or {}) do
          local px, py = projectToCanvas(m, coord[2], coord[1])
          points[#points + 1] = px
          points[#points + 1] = py
        end
        if #points >= 4 then
          local sr, sg, sb, sa = parseHexColor(style.strokeColor)
          love.graphics.setColor(sr, sg, sb, sa * effectiveOpacity)
          love.graphics.setLineWidth(style.strokeWidth)
          love.graphics.line(points)
          love.graphics.setLineWidth(1)
        end

      elseif geom.type == "MultiLineString" then
        for _, line in ipairs(geom.coordinates or {}) do
          local points = {}
          for _, coord in ipairs(line) do
            local px, py = projectToCanvas(m, coord[2], coord[1])
            points[#points + 1] = px
            points[#points + 1] = py
          end
          if #points >= 4 then
            local sr, sg, sb, sa = parseHexColor(style.strokeColor)
            love.graphics.setColor(sr, sg, sb, sa * effectiveOpacity)
            love.graphics.setLineWidth(style.strokeWidth)
            love.graphics.line(points)
            love.graphics.setLineWidth(1)
          end
        end

      elseif geom.type == "Polygon" then
        local ring = geom.coordinates and geom.coordinates[1]
        renderGeoJSONRing2D(m, ring, style, effectiveOpacity)

      elseif geom.type == "MultiPolygon" then
        for _, polygon in ipairs(geom.coordinates or {}) do
          local ring = polygon[1]
          renderGeoJSONRing2D(m, ring, style, effectiveOpacity)
        end
      end

      ::nextFeature::
    end
  end
end

-- ============================================================================
-- 3D Building Extrusion
-- ============================================================================

-- Shader for extruded buildings: MVP + Canvas flip + simple directional lighting
local buildingShader = nil

local function getBuildingShader()
  if buildingShader then return buildingShader end
  if not g3d then return mapShader end

  buildingShader = love.graphics.newShader([[
    // Vertex shader for extruded buildings with simple lighting
    uniform mat4 projectionMatrix;
    uniform mat4 viewMatrix;
    uniform mat4 modelMatrix;
    uniform bool isCanvasEnabled;

    attribute vec3 VertexNormal;

    varying vec3 fragNormal;
    varying vec3 fragPosition;

    vec4 position(mat4 transformProjection, vec4 vertexPosition) {
      vec4 worldPos = modelMatrix * vertexPosition;
      fragPosition = worldPos.xyz;

      // Transform normal to world space (simplified, no non-uniform scale)
      fragNormal = mat3(modelMatrix) * VertexNormal;

      vec4 pos = projectionMatrix * viewMatrix * worldPos;
      if (isCanvasEnabled) {
        pos.y *= -1.0;
      }
      return pos;
    }
  ]], [[
    // Fragment shader: ambient + directional diffuse lighting
    uniform vec3 lightDirection;
    uniform vec3 ambientColor;
    uniform vec3 lightColor;

    varying vec3 fragNormal;
    varying vec3 fragPosition;

    vec4 effect(vec4 vertColor, Image tex, vec2 texCoord, vec2 screenCoord) {
      vec3 normal = normalize(fragNormal);
      vec3 lightDir = normalize(lightDirection);

      // Diffuse lighting
      float diff = max(dot(normal, lightDir), 0.0);
      vec3 diffuse = lightColor * diff;

      vec3 finalColor = (ambientColor + diffuse) * vertColor.rgb;
      return vec4(finalColor, vertColor.a);
    }
  ]])

  return buildingShader
end

--- Cache for extruded building meshes: mapNodeId → { layers: { layerNodeId → { model, zoom, dataRef } } }
local buildingMeshCache = {}

--- Build a 3D extruded mesh for a set of polygon features.
--- Returns a g3d model positioned at the map center.
local function buildExtrusionModel(features, m)
  if not g3d then return nil end

  local intZoom = math.floor(m.zoom)
  local centerPx, centerPy = Geo.latlngToPixel(m.centerLat, m.centerLng, intZoom)
  local allVerts = {}

  for _, feature in ipairs(features) do
    local geom = feature.geometry
    if not geom then goto skip end
    local style = getFeatureStyle(feature)
    if style.extrude <= 0 then goto skip end

    local rings = {}
    if geom.type == "Polygon" then
      rings = { geom.coordinates and geom.coordinates[1] }
    elseif geom.type == "MultiPolygon" then
      for _, polygon in ipairs(geom.coordinates or {}) do
        rings[#rings + 1] = polygon[1]
      end
    end

    for _, ring in ipairs(rings) do
      if not ring or #ring < 3 then goto skipRing end

      -- Compute world-space ring positions
      local worldRing = {}
      local flatVerts2D = {}
      for _, coord in ipairs(ring) do
        local lat, lng = coord[2], coord[1]  -- GeoJSON: [lng, lat]
        local px, py = Geo.latlngToPixel(lat, lng, intZoom)
        local wx = px - centerPx
        local wy = -(py - centerPy)  -- Y-north
        worldRing[#worldRing + 1] = { wx, wy }
        flatVerts2D[#flatVerts2D + 1] = wx
        flatVerts2D[#flatVerts2D + 1] = wy
      end

      -- Extrusion height in pixels (rough: 1 meter ≈ metersPerPixel at this zoom)
      local mpp = Geo.metersPerPixel(m.centerLat, intZoom)
      local height = style.extrude / math.max(mpp, 0.001)

      -- Parse building color
      local cr, cg, cb, ca = parseHexColor(style.fillColor)
      local r8 = math.floor(cr * 255)
      local g8 = math.floor(cg * 255)
      local b8 = math.floor(cb * 255)
      local a8 = math.floor(ca * 255)

      -- Top face: triangulate the polygon at Z=height
      local okTri, triangles = pcall(love.math.triangulate, flatVerts2D)
      if okTri and triangles then
        for _, tri in ipairs(triangles) do
          -- tri is {x1,y1, x2,y2, x3,y3}
          allVerts[#allVerts + 1] = {tri[1], tri[2], height,  0, 0,  0, 0, 1,  r8, g8, b8, a8}
          allVerts[#allVerts + 1] = {tri[3], tri[4], height,  0, 0,  0, 0, 1,  r8, g8, b8, a8}
          allVerts[#allVerts + 1] = {tri[5], tri[6], height,  0, 0,  0, 0, 1,  r8, g8, b8, a8}
        end
      end

      -- Side walls: quads connecting top ring to ground
      -- Slightly darken sides for visual depth
      local sr8 = math.floor(cr * 200)
      local sg8 = math.floor(cg * 200)
      local sb8 = math.floor(cb * 200)

      for i = 1, #worldRing do
        local j = (i % #worldRing) + 1
        local x1, y1 = worldRing[i][1], worldRing[i][2]
        local x2, y2 = worldRing[j][1], worldRing[j][2]

        -- Wall normal (perpendicular to edge, horizontal)
        local edgeX = x2 - x1
        local edgeY = y2 - y1
        local edgeLen = math.sqrt(edgeX * edgeX + edgeY * edgeY)
        local nx, ny = 0, 0
        if edgeLen > 0 then
          nx = -edgeY / edgeLen
          ny = edgeX / edgeLen
        end

        -- Two triangles for the wall quad (CCW from outside)
        -- Bottom-left, top-left, top-right
        allVerts[#allVerts + 1] = {x1, y1, 0,       0, 0,  nx, ny, 0,  sr8, sg8, sb8, a8}
        allVerts[#allVerts + 1] = {x1, y1, height,   0, 0,  nx, ny, 0,  sr8, sg8, sb8, a8}
        allVerts[#allVerts + 1] = {x2, y2, height,   0, 0,  nx, ny, 0,  sr8, sg8, sb8, a8}
        -- Bottom-left, top-right, bottom-right
        allVerts[#allVerts + 1] = {x1, y1, 0,       0, 0,  nx, ny, 0,  sr8, sg8, sb8, a8}
        allVerts[#allVerts + 1] = {x2, y2, height,   0, 0,  nx, ny, 0,  sr8, sg8, sb8, a8}
        allVerts[#allVerts + 1] = {x2, y2, 0,       0, 0,  nx, ny, 0,  sr8, sg8, sb8, a8}
      end

      ::skipRing::
    end
    ::skip::
  end

  if #allVerts == 0 then return nil end

  -- Create the dummy white texture for vertex-colored rendering
  local dummyData = love.image.newImageData(1, 1)
  dummyData:setPixel(0, 0, 1, 1, 1, 1)
  local dummyTex = love.graphics.newImage(dummyData)

  return g3d.newModel(allVerts, dummyTex, {0, 0, 0}, {0, 0, 0}, {1, 1, 1})
end

local renderExtrudedBuildings3D  -- forward declaration (defined below)
local projectToWorld3D
local worldToScreen3D

--- Render GeoJSON features in 3D mode with building extrusion.
local function renderGeoJSON3D(m, effectiveOpacity)
  local hasExtruded = false

  -- First pass: render non-extruded features as screen-projected 2D overlays
  for _, layer in pairs(m.geojsonLayers) do
    local features = extractGeoJSONFeatures(layer.data)

    for _, feature in ipairs(features) do
      local geom = feature.geometry
      if not geom then goto nextFlat end
      local style = getFeatureStyle(feature)

      -- Skip extruded features (handled in second pass)
      if style.extrude > 0 then
        hasExtruded = true
        goto nextFlat
      end

      if geom.type == "Point" then
        local coord = geom.coordinates
        if coord then
          local wx, wy = projectToWorld3D(m, coord[2], coord[1])
          local sx, sy = worldToScreen3D(m, wx, wy, 0)
          if sx and sy then
            local fr, fg, fb, fa = parseHexColor(style.fillColor)
            love.graphics.setColor(fr, fg, fb, fa * effectiveOpacity)
            love.graphics.circle("fill", sx, sy, 5)
          end
        end

      elseif geom.type == "LineString" then
        local points = {}
        for _, coord in ipairs(geom.coordinates or {}) do
          local wx, wy = projectToWorld3D(m, coord[2], coord[1])
          local sx, sy = worldToScreen3D(m, wx, wy, 0)
          if sx and sy then
            points[#points + 1] = sx
            points[#points + 1] = sy
          end
        end
        if #points >= 4 then
          local sr, sg, sb, sa = parseHexColor(style.strokeColor)
          love.graphics.setColor(sr, sg, sb, sa * effectiveOpacity)
          love.graphics.setLineWidth(style.strokeWidth)
          love.graphics.line(points)
          love.graphics.setLineWidth(1)
        end

      elseif geom.type == "Polygon" then
        local ring = geom.coordinates and geom.coordinates[1]
        if ring and #ring >= 3 then
          local verts = {}
          for _, coord in ipairs(ring) do
            local wx, wy = projectToWorld3D(m, coord[2], coord[1])
            local sx, sy = worldToScreen3D(m, wx, wy, 0)
            if sx and sy then
              verts[#verts + 1] = sx
              verts[#verts + 1] = sy
            end
          end
          if #verts >= 6 then
            local fr, fg, fb, fa = parseHexColor(style.fillColor)
            love.graphics.setColor(fr, fg, fb, fa * effectiveOpacity)
            local ok2, triangles = pcall(love.math.triangulate, verts)
            if ok2 and triangles then
              for _, tri in ipairs(triangles) do
                love.graphics.polygon("fill", tri)
              end
            end
          end
        end
      end

      ::nextFlat::
    end
  end

  -- Second pass: render extruded buildings as 3D meshes (requires depth + shader)
  if hasExtruded and g3d then
    renderExtrudedBuildings3D(m, effectiveOpacity)
  end
end

--- Render extruded buildings using g3d meshes with lighting.
--- Called from renderGeoJSON3D when extruded features exist.
renderExtrudedBuildings3D = function(m, effectiveOpacity)
  local intZoom = math.floor(m.zoom)
  local fracScale = math.pow(2, m.zoom - intZoom)

  -- Get or create cached meshes
  local cache = buildingMeshCache[m] or {}
  buildingMeshCache[m] = cache

  for layerId, layer in pairs(m.geojsonLayers) do
    local features = extractGeoJSONFeatures(layer.data)

    -- Check if we need to rebuild (data changed or zoom changed)
    local cached = cache[layerId]
    if cached and cached.zoom == intZoom and cached.dataRef == layer.data then
      -- Use cached mesh
    else
      -- Rebuild mesh
      local model = buildExtrusionModel(features, m)
      if cached and cached.model then
        -- Release old mesh
        if cached.model.mesh then cached.model.mesh:release() end
      end
      cached = { model = model, zoom = intZoom, dataRef = layer.data }
      cache[layerId] = cached
    end

    if cached.model then
      -- Set transform: scale by fractional zoom, no rotation
      cached.model:setTransform(
        {0, 0, 0},
        {0, 0, 0},
        {fracScale, fracScale, fracScale}
      )

      -- Draw with building shader (lighting)
      local shader = getBuildingShader()
      if shader then
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        love.graphics.setDepthMode("lequal", true)

        -- Set lighting uniforms
        if shader ~= mapShader then
          shader:send("lightDirection", {0.5, 0.3, 0.8})
          shader:send("ambientColor", {0.35, 0.35, 0.40})
          shader:send("lightColor", {0.8, 0.75, 0.65})
        end

        cached.model:draw(shader)
        love.graphics.setDepthMode()
      end
    end
  end
end

-- ============================================================================
-- 3D Rendering (pitch > 0)
-- ============================================================================

--- Project lat/lng to 3D world coordinates.
--- Uses Y-north convention: +X=east, +Y=north, Z=up.
projectToWorld3D = function(m, lat, lng)
  local intZoom = math.floor(m.zoom)
  local fracScale = math.pow(2, m.zoom - intZoom)
  local centerPx, centerPy = Geo.latlngToPixel(m.centerLat, m.centerLng, intZoom)
  local pointPx, pointPy = Geo.latlngToPixel(lat, lng, intZoom)
  local worldX = (pointPx - centerPx) * fracScale
  local worldY = -((pointPy - centerPy) * fracScale)  -- flip Y: north = +Y
  return worldX, worldY
end

--- Project a 3D world point to canvas pixel coordinates using the current camera.
--- Returns nil, nil if the point is behind the camera.
worldToScreen3D = function(m, wx, wy, wz)
  wz = wz or 0

  -- Apply view matrix
  local vm = g3d.camera.viewMatrix
  local vx = vm[1]*wx  + vm[2]*wy  + vm[3]*wz  + vm[4]
  local vy = vm[5]*wx  + vm[6]*wy  + vm[7]*wz  + vm[8]
  local vz = vm[9]*wx  + vm[10]*wy + vm[11]*wz + vm[12]
  local vw = vm[13]*wx + vm[14]*wy + vm[15]*wz + vm[16]

  -- Apply projection matrix
  local pm = g3d.camera.projectionMatrix
  local cx = pm[1]*vx  + pm[2]*vy  + pm[3]*vz  + pm[4]*vw
  local cy = pm[5]*vx  + pm[6]*vy  + pm[7]*vz  + pm[8]*vw
  local cw = pm[13]*vx + pm[14]*vy + pm[15]*vz + pm[16]*vw

  -- Behind camera check
  if cw <= 0.001 then return nil, nil end

  -- Perspective divide + Canvas Y-flip (matches shader)
  local ndcX = cx / cw
  local ndcY = -cy / cw

  -- NDC to Love2D Canvas coordinates
  local screenX = (ndcX + 1) * 0.5 * m.width
  local screenY = (1 - ndcY) * 0.5 * m.height

  return screenX, screenY
end

--- Render tile layers in 3D using g3d textured quads.
local function renderTileLayers3D(m)
  local intZoom = math.floor(m.zoom)
  local fracScale = math.pow(2, m.zoom - intZoom)
  local tileSize = Geo.tileSize()
  local scaledTileSize = tileSize * fracScale
  local centerPx, centerPy = Geo.latlngToPixel(m.centerLat, m.centerLng, intZoom)

  -- Expand visible area for perspective (tiles near horizon must be loaded)
  local pitchRad = m.pitch * math.pi / 180
  local expandFactor = 1 + math.tan(pitchRad) * 2.5
  local minTx, minTy, maxTx, maxTy = Geo.visibleTiles(
    m.centerLat, m.centerLng, m.zoom,
    m.width * expandFactor, m.height * expandFactor
  )

  for _, layer in ipairs(m.tileLayers) do
    if layer.source and intZoom >= layer.minZoom and intZoom <= layer.maxZoom then
      for ty = minTy, maxTy do
        for tx = minTx, maxTx do
          local wrappedTx = Geo.wrapTileX(tx, intZoom)
          local img = TileCache.getTile(globalCache, layer.source, intZoom, wrappedTx, ty)

          if img then
            -- Tile world position (Y-north convention: flip pixel Y)
            local tilePxX = tx * tileSize
            local tilePxY = ty * tileSize
            local worldX = (tilePxX - centerPx) * fracScale
            local worldY = -((tilePxY - centerPy) * fracScale)

            -- Reuse shared quad: set texture and transform
            -- Quad spans (0,0) to (1,-1) in local space, scaled to tile size
            -- Translation places NW corner; scale stretches to full tile
            sharedQuad.mesh:setTexture(img)
            sharedQuad:setTransform(
              {worldX, worldY, 0},
              {0, 0, 0},
              {scaledTileSize, scaledTileSize, 1}
            )
            sharedQuad:draw(mapShader)
          elseif missingTileTexture then
            -- Keep 3D mode readable offline: render a faint ground tile when
            -- imagery is unavailable instead of leaving the canvas empty.
            local tilePxX = tx * tileSize
            local tilePxY = ty * tileSize
            local worldX = (tilePxX - centerPx) * fracScale
            local worldY = -((tilePxY - centerPy) * fracScale)

            sharedQuad.mesh:setTexture(missingTileTexture)
            sharedQuad:setTransform(
              {worldX, worldY, 0},
              {0, 0, 0},
              {scaledTileSize, scaledTileSize, 1}
            )
            love.graphics.setColor(0.80, 0.82, 0.86, 0.12 * layer.opacity)
            sharedQuad:draw(mapShader)
            love.graphics.setColor(1, 1, 1, 1)
          end
        end
      end
    end
  end
end

--- Render polylines projected to screen in 3D mode.
local function renderPolylines3D(m, effectiveOpacity)
  for _, poly in pairs(m.polylines) do
    local positions = poly.positions
    if positions and #positions >= 2 then
      local r, g, b, a = parseHexColor(poly.color)
      love.graphics.setColor(r, g, b, a * effectiveOpacity)
      love.graphics.setLineWidth(poly.width or 2)

      local points = {}
      for _, pos in ipairs(positions) do
        local wx, wy = projectToWorld3D(m, pos[1] or 0, pos[2] or 0)
        local sx, sy = worldToScreen3D(m, wx, wy, 0)
        if sx and sy then
          points[#points + 1] = sx
          points[#points + 1] = sy
        end
      end

      if #points >= 4 then
        love.graphics.line(points)
      end

      -- Arrowheads
      if poly.arrowheads and #points >= 4 then
        local arrowSize = (poly.width or 2) * 3
        love.graphics.setColor(r, g, b, a * effectiveOpacity)
        local accumDist = 0
        for i = 3, #points, 2 do
          local x1, y1 = points[i - 2], points[i - 1]
          local x2, y2 = points[i], points[i + 1]
          local dx = x2 - x1
          local dy = y2 - y1
          local segLen = math.sqrt(dx * dx + dy * dy)
          accumDist = accumDist + segLen
          if accumDist >= 100 then
            accumDist = 0
            local angle = math.atan2(dy, dx)
            local mx = (x1 + x2) / 2
            local my = (y1 + y2) / 2
            love.graphics.polygon("fill",
              mx + math.cos(angle) * arrowSize, my + math.sin(angle) * arrowSize,
              mx + math.cos(angle + 2.5) * arrowSize * 0.6, my + math.sin(angle + 2.5) * arrowSize * 0.6,
              mx + math.cos(angle - 2.5) * arrowSize * 0.6, my + math.sin(angle - 2.5) * arrowSize * 0.6
            )
          end
        end
      end

      love.graphics.setLineWidth(1)
    end
  end
end

--- Render polygons projected to screen in 3D mode.
local function renderPolygons3D(m, effectiveOpacity)
  for _, poly in pairs(m.polygons) do
    local positions = poly.positions
    if positions and #positions >= 3 then
      local verts = {}
      for _, pos in ipairs(positions) do
        local wx, wy = projectToWorld3D(m, pos[1] or 0, pos[2] or 0)
        local sx, sy = worldToScreen3D(m, wx, wy, 0)
        if sx and sy then
          verts[#verts + 1] = sx
          verts[#verts + 1] = sy
        end
      end

      if #verts >= 6 then
        -- Fill
        local fr, fg, fb, fa = parseHexColor(poly.fillColor)
        love.graphics.setColor(fr, fg, fb, fa * effectiveOpacity)
        local ok, triangles = pcall(love.math.triangulate, verts)
        if ok and triangles then
          for _, tri in ipairs(triangles) do
            love.graphics.polygon("fill", tri)
          end
        end

        -- Stroke
        local sr, sg, sb, sa = parseHexColor(poly.strokeColor)
        love.graphics.setColor(sr, sg, sb, sa * effectiveOpacity)
        love.graphics.setLineWidth(poly.strokeWidth or 2)
        local closedVerts = {}
        for i = 1, #verts do closedVerts[i] = verts[i] end
        closedVerts[#closedVerts + 1] = verts[1]
        closedVerts[#closedVerts + 1] = verts[2]
        love.graphics.line(closedVerts)
        love.graphics.setLineWidth(1)
      end
    end
  end
end

--- Render markers projected to screen in 3D mode.
local function renderMarkers3D(m, effectiveOpacity)
  for _, marker in pairs(m.markers) do
    local wx, wy = projectToWorld3D(m, marker.lat, marker.lng)
    local px, py = worldToScreen3D(m, wx, wy, 0)
    if not px or not py then goto continue end

    local markerW = 20
    local markerH = 20

    local ox, oy = 0, 0
    if marker.anchor == "bottom-center" then
      ox = -markerW / 2
      oy = -markerH
    elseif marker.anchor == "center" then
      ox = -markerW / 2
      oy = -markerH / 2
    elseif marker.anchor == "top-center" then
      ox = -markerW / 2
      oy = 0
    end

    love.graphics.setColor(0.91, 0.30, 0.24, effectiveOpacity)
    love.graphics.circle("fill", px + ox + markerW / 2, py + oy + markerH / 2, markerW / 2)
    love.graphics.setColor(1, 1, 1, effectiveOpacity)
    love.graphics.circle("line", px + ox + markerW / 2, py + oy + markerH / 2, markerW / 2)

    ::continue::
  end
end

--- Render a single map in 3D mode (pitch > 0).
local function renderMap3D(nodeId)
  local m = maps[nodeId]
  if not m or not m.canvas then return end

  -- Poll tile cache
  TileCache.poll(globalCache)
  TileCache.advanceDownloads(globalCache)

  -- Advance zoom animation
  if m.zoomAnimating then
    m.zoomT = m.zoomT + love.timer.getDelta() / m.zoomDuration
    if m.zoomT >= 1 then
      m.zoom = m.zoomTo
      m.zoomAnimating = false
    else
      local t = 1 - math.pow(1 - m.zoomT, 3)
      m.zoom = m.zoomFrom + (m.zoomTo - m.zoomFrom) * t
    end
  end

  -- Camera geometry from pitch/bearing/zoom
  local pitchRad = m.pitch * math.pi / 180
  local bearingRad = m.bearing * math.pi / 180
  local fov = math.pi / 3  -- 60 degrees

  -- Altitude: camera distance from ground that matches 2D viewport coverage
  local altitude = m.height / (2 * math.tan(fov / 2))

  -- Split altitude into horizontal + vertical distance based on pitch
  local hDist = altitude * math.sin(pitchRad)
  local vDist = altitude * math.cos(pitchRad)

  -- Camera orbits map center based on bearing (clockwise from north)
  -- bearing=0: camera south of center (-Y), looking north
  -- bearing=90: camera west of center (-X), looking east
  local camX = -hDist * math.sin(bearingRad)
  local camY = -hDist * math.cos(bearingRad)
  local camZ = vDist

  g3d.camera.position = {camX, camY, camZ}
  g3d.camera.target = {0, 0, 0}
  g3d.camera.up = {0, 0, 1}
  g3d.camera.fov = fov
  g3d.camera.nearClip = 1
  g3d.camera.farClip = altitude * 10
  g3d.camera.aspectRatio = m.width / m.height
  g3d.camera.updateProjectionMatrix()
  g3d.camera.updateViewMatrix()

  -- Begin 3D rendering to Canvas with depth buffer
  love.graphics.push("all")
  love.graphics.setCanvas({m.canvas, depth = true})
  love.graphics.setDepthMode("lequal", true)
  love.graphics.clear(0.93, 0.93, 0.90, 1)
  love.graphics.setColor(1, 1, 1, 1)

  -- Render tile layers as 3D textured quads on the ground plane
  renderTileLayers3D(m)

  -- Render GeoJSON (handles both flat overlays and extruded 3D buildings)
  -- Extruded buildings are rendered here with depth testing enabled
  love.graphics.setShader()
  love.graphics.setColor(1, 1, 1, 1)
  renderGeoJSON3D(m, 1)

  -- Switch to 2D for overlays (disable depth, clear shader)
  love.graphics.setDepthMode()
  love.graphics.setShader()
  love.graphics.setColor(1, 1, 1, 1)

  -- Render overlays projected to screen coordinates
  renderPolygons3D(m, 1)
  renderPolylines3D(m, 1)
  renderMarkers3D(m, 1)

  -- Attribution text (same as 2D)
  if #m.tileLayers > 0 then
    local attrText = ""
    for _, layer in ipairs(m.tileLayers) do
      local src = globalCache.sources[layer.source]
      if src and src.attribution and src.attribution ~= "" then
        if #attrText > 0 then attrText = attrText .. " | " end
        attrText = attrText .. src.attribution
      end
    end
    if #attrText > 0 then
      local font = love.graphics.getFont()
      local tw = font:getWidth(attrText)
      local th = font:getHeight()
      local padding = 4
      love.graphics.setColor(1, 1, 1, 0.8)
      love.graphics.rectangle("fill",
        m.width - tw - padding * 2, m.height - th - padding * 2,
        tw + padding * 2, th + padding * 2)
      love.graphics.setColor(0.2, 0.2, 0.2, 0.9)
      love.graphics.print(attrText, m.width - tw - padding, m.height - th - padding)
    end
  end

  love.graphics.pop()
end

--- Render a single map to its Canvas.
local function renderMap(nodeId)
  local m = maps[nodeId]
  if not m or not m.canvas then return end

  -- Use 3D rendering when pitch > 0 and g3d is available
  if m.pitch > 0 and g3d and sharedQuad and mapShader then
    renderMap3D(nodeId)
    return
  end

  -- Poll tile cache for completed fetches
  TileCache.poll(globalCache)
  TileCache.advanceDownloads(globalCache)

  -- Advance zoom animation
  if m.zoomAnimating then
    m.zoomT = m.zoomT + love.timer.getDelta() / m.zoomDuration
    if m.zoomT >= 1 then
      m.zoom = m.zoomTo
      m.zoomAnimating = false
    else
      -- Ease out
      local t = 1 - math.pow(1 - m.zoomT, 3)
      m.zoom = m.zoomFrom + (m.zoomTo - m.zoomFrom) * t
    end
  end

  -- Save Love2D graphics state
  love.graphics.push("all")
  love.graphics.setCanvas(m.canvas)

  -- Clear with a map background color
  love.graphics.clear(0.93, 0.93, 0.90, 1)  -- light beige (land placeholder)
  love.graphics.setColor(1, 1, 1, 1)

  -- Apply bearing rotation around center
  if m.bearing ~= 0 then
    love.graphics.translate(m.width / 2, m.height / 2)
    love.graphics.rotate(-m.bearing * math.pi / 180)
    love.graphics.translate(-m.width / 2, -m.height / 2)
  end

  -- Render tile layers
  renderTileLayers(m)

  -- Render overlays
  renderPolygons(m, 1)
  renderPolylines(m, 1)
  renderGeoJSON(m, 1)
  renderMarkers(m, 1)

  -- Attribution text (bottom-right)
  if #m.tileLayers > 0 then
    local attrText = ""
    for _, layer in ipairs(m.tileLayers) do
      local src = globalCache.sources[layer.source]
      if src and src.attribution and src.attribution ~= "" then
        if #attrText > 0 then attrText = attrText .. " | " end
        attrText = attrText .. src.attribution
      end
    end
    if #attrText > 0 then
      local font = love.graphics.getFont()
      local tw = font:getWidth(attrText)
      local th = font:getHeight()
      local padding = 4
      love.graphics.setColor(1, 1, 1, 0.8)
      love.graphics.rectangle("fill",
        m.width - tw - padding * 2, m.height - th - padding * 2,
        tw + padding * 2, th + padding * 2)
      love.graphics.setColor(0.2, 0.2, 0.2, 0.9)
      love.graphics.print(attrText, m.width - tw - padding, m.height - th - padding)
    end
  end

  -- Restore Love2D graphics state
  love.graphics.pop()
end

-- ============================================================================
-- Mouse/Pointer Interaction (Lua-owned, zero-latency)
-- ============================================================================

function Map.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  if not Geo then return false end

  local m = maps[node.id]
  if not m then return false end

  -- Start panning
  m.isDragging = true
  m.dragStartX = mx
  m.dragStartY = my
  m.dragStartCenterLat = m.centerLat
  m.dragStartCenterLng = m.centerLng

  return true
end

function Map.handleMouseMoved(node, mx, my)
  if not Geo then return false end

  local m = maps[node.id]
  if not m or not m.isDragging then return false end

  -- Compute pixel delta and convert to lat/lng delta
  local dx = mx - m.dragStartX
  local dy = my - m.dragStartY

  -- Apply bearing rotation to the drag vector
  if m.bearing ~= 0 then
    local angle = m.bearing * math.pi / 180
    local cosA = math.cos(angle)
    local sinA = math.sin(angle)
    local rdx = dx * cosA + dy * sinA
    local rdy = -dx * sinA + dy * cosA
    dx = rdx
    dy = rdy
  end

  -- Convert pixel offset to lat/lng offset at current zoom
  local startPx, startPy = Geo.latlngToPixel(m.dragStartCenterLat, m.dragStartCenterLng, m.zoom)
  local newLat, newLng = Geo.pixelToLatlng(startPx - dx, startPy - dy, m.zoom)

  m.centerLat = newLat
  m.centerLng = newLng
  m.viewDirty = true

  return true
end

function Map.handleMouseReleased(node, mx, my, button)
  local m = maps[node.id]
  if not m or not m.isDragging then return false end

  m.isDragging = false

  -- Emit final view change
  if m.viewDirty then
    m.viewDirty = false
    queueEvent(node.id, "map:viewchange", {
      center = { m.centerLat, m.centerLng },
      zoom = m.zoom,
      bearing = m.bearing,
      pitch = m.pitch,
    })
  end

  return true
end

function Map.handleWheel(node, dx, dy)
  if not Geo then return false end

  local m = maps[node.id]
  if not m then return false end

  -- Zoom in/out (dy > 0 = zoom in)
  local newZoom = m.zoom + dy * 0.5
  newZoom = math.max(m.minZoom, math.min(m.maxZoom, newZoom))

  if newZoom ~= m.zoom then
    -- Smooth zoom animation
    m.zoomFrom = m.zoom
    m.zoomTo = newZoom
    m.zoomT = 0
    m.zoomAnimating = true
    m.viewDirty = true
  end

  return true
end

-- ============================================================================
-- RPC handlers (called via bridge from React hooks)
-- ============================================================================

function Map.handleRPC(method, args)
  if method == "map:panTo" then
    local nodeId = args.nodeId
    local m = maps[nodeId]
    if m then
      m.centerLat = args.lat or m.centerLat
      m.centerLng = args.lng or m.centerLng
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:zoomTo" then
    local nodeId = args.nodeId
    local m = maps[nodeId]
    if m then
      local newZoom = math.max(m.minZoom, math.min(m.maxZoom, args.zoom or m.zoom))
      if args.animate then
        m.zoomFrom = m.zoom
        m.zoomTo = newZoom
        m.zoomT = 0
        m.zoomDuration = (args.duration or 300) / 1000
        m.zoomAnimating = true
      else
        m.zoom = newZoom
      end
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:flyTo" then
    local nodeId = args.nodeId
    local m = maps[nodeId]
    if m then
      m.centerLat = args.center and args.center[1] or m.centerLat
      m.centerLng = args.center and args.center[2] or m.centerLng
      if args.zoom then
        m.zoomFrom = m.zoom
        m.zoomTo = math.max(m.minZoom, math.min(m.maxZoom, args.zoom))
        m.zoomT = 0
        m.zoomDuration = (args.duration or 2000) / 1000
        m.zoomAnimating = true
      end
      if args.bearing ~= nil then m.bearing = args.bearing end
      if args.pitch ~= nil then m.pitch = args.pitch end
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:fitBounds" then
    local nodeId = args.nodeId
    local m = maps[nodeId]
    if m and args.bounds then
      local sw = args.bounds[1] or args.bounds.sw or { 0, 0 }
      local ne = args.bounds[2] or args.bounds.ne or { 0, 0 }

      -- Center on bounds midpoint
      m.centerLat = (sw[1] + ne[1]) / 2
      m.centerLng = (sw[2] + ne[2]) / 2

      -- Calculate zoom to fit bounds
      for z = m.maxZoom, m.minZoom, -1 do
        local swPx, swPy = Geo.latlngToPixel(sw[1], sw[2], z)
        local nePx, nePy = Geo.latlngToPixel(ne[1], ne[2], z)
        local boundsW = math.abs(nePx - swPx)
        local boundsH = math.abs(nePy - swPy)
        if boundsW <= m.width and boundsH <= m.height then
          m.zoom = z
          break
        end
      end

      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:setBearing" then
    local nodeId = args.nodeId
    local m = maps[nodeId]
    if m then
      m.bearing = args.bearing or 0
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:setPitch" then
    local nodeId = args.nodeId
    local m = maps[nodeId]
    if m then
      m.pitch = math.max(0, math.min(60, args.pitch or 0))
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:getView" then
    local nodeId = args.nodeId
    local m = maps[nodeId]
    if m then
      return {
        center = { m.centerLat, m.centerLng },
        zoom = m.zoom,
        bearing = m.bearing,
        pitch = m.pitch,
      }
    end
    return nil

  elseif method == "map:downloadRegion" then
    local nodeId = args.nodeId
    local m = maps[nodeId]
    if m and globalCache then
      local regionId = TileCache.downloadRegion(
        globalCache,
        args.source or "osm",
        Geo.Bounds(args.swLat, args.swLng, args.neLat, args.neLng),
        args.minZoom or 0,
        args.maxZoom or 15
      )
      return { regionId = regionId }
    end
    return { error = "map not found" }

  elseif method == "map:downloadProgress" then
    if globalCache then
      local progress = TileCache.getDownloadProgress(globalCache, args.regionId)
      return progress or { error = "region not found" }
    end
    return { error = "cache not available" }

  elseif method == "map:cacheStats" then
    if globalCache then
      return TileCache.cacheStats(globalCache)
    end
    return { memoryTiles = 0, dbTiles = 0, dbBytes = 0, sources = {} }
  end

  return nil
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Scan the tree for Map2D nodes and sync their state.
function Map.syncWithTree(treeNodes)
  if not initialized then return end

  local activeMapIds = {}

  for id, node in pairs(treeNodes) do
    if node.type == "Map2D" then
      syncMap(node)
      activeMapIds[id] = true
    end
  end

  -- Clean up maps no longer in the tree
  for id in pairs(maps) do
    if not activeMapIds[id] then
      Map.cleanup(id)
    end
  end
end

--- Render all active maps to their Canvases.
function Map.renderAll()
  if not initialized then return end

  for nodeId in pairs(maps) do
    renderMap(nodeId)
  end

  -- Emit pending view change events for maps that changed
  for nodeId, m in pairs(maps) do
    if m.viewDirty and not m.isDragging then
      m.viewDirty = false
      queueEvent(nodeId, "map:viewchange", {
        center = { m.centerLat, m.centerLng },
        zoom = m.zoom,
        bearing = m.bearing,
        pitch = m.pitch,
      })
    end
  end
end

--- Return the Canvas for a Map2D node. Painter draws this.
function Map.get(nodeId)
  local m = maps[nodeId]
  return m and m.canvas or nil
end

--- Free resources for a Map2D node.
function Map.cleanup(nodeId)
  local m = maps[nodeId]
  if not m then return end

  -- Release building mesh cache
  local cache = buildingMeshCache[m]
  if cache then
    for _, cached in pairs(cache) do
      if cached.model and cached.model.mesh then
        cached.model.mesh:release()
      end
    end
    buildingMeshCache[m] = nil
  end

  if m.canvas then m.canvas:release() end
  maps[nodeId] = nil
end

--- Check if any Map2D nodes exist.
function Map.hasMaps()
  return next(maps) ~= nil
end

--- Check if a node type is a map child type.
function Map.isMapChildType(nodeType)
  return Map.CHILD_TYPES[nodeType] or false
end

--- Drain events queued by interaction handlers.
function Map.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

--- Get the shared tile cache handle.
function Map.getCache()
  return globalCache
end

return Map
