--[[
  map.lua — Slippy map engine for Love2D

  A from-scratch port of Leaflet's rendering model into Lua/Love2D.
  React declares <MapContainer>, <TileLayer>, <Marker>, etc. as tree nodes.
  This module reads those nodes, owns all state, renders to off-screen canvases,
  and handles interaction (pan, zoom, click) at zero latency.

  Public API (called by init.lua and painter.lua):
    Map.init()                          -- one-time setup
    Map.syncWithTree(treeNodes)         -- scan tree for Map2D nodes each frame
    Map.renderAll()                     -- render all maps to off-screen canvases
    Map.get(nodeId)                     -- return canvas for painter to composite
    Map.isMapChildType(nodeType)        -- painter skips map children
    Map.handleMousePressed(node, mx, my, button)
    Map.handleMouseMoved(node, mx, my)
    Map.handleMouseReleased(node, mx, my, button)
    Map.handleWheel(node, dx, dy)
    Map.handleRPC(method, args)
    Map.drainEvents()
    Map.hasMaps()
    Map.cleanup(nodeId)

  Dependencies: lua/geo.lua, lua/tilecache.lua
]]

local Map = {}

-- ============================================================================
-- Dependencies (lazy-loaded in init)
-- ============================================================================

local Geo       -- lua/geo.lua   (projection math)
local TileCache -- lua/tilecache.lua (tile fetching + cache)
local Color = require("lua.color")

local initialized = false
local globalCache = nil  -- shared TileCache handle

-- ============================================================================
-- State
-- ============================================================================

local maps = {}          -- nodeId -> map state table
local pendingEvents = {} -- queued for bridge

-- All node types that live inside a Map2D and should be skipped by the painter
Map.CHILD_TYPES = {
  MapTileLayer      = true,
  MapMarker         = true,
  MapPopup          = true,
  MapTooltip        = true,
  MapPolyline       = true,
  MapPolygon        = true,
  MapCircle         = true,
  MapCircleMarker   = true,
  MapRectangle      = true,
  MapGeoJSON        = true,
  MapImageOverlay   = true,
  MapLayerGroup     = true,
  MapFeatureGroup   = true,
  MapPane           = true,
  MapZoomControl    = true,
  MapScaleControl   = true,
  MapAttributionControl = true,
}

-- ============================================================================
-- Helpers
-- ============================================================================

local function queueEvent(nodeId, eventType, payload)
  pendingEvents[#pendingEvents + 1] = {
    nodeId = nodeId,
    type = eventType,
    payload = payload,
  }
end

local function parseColor(hex, alpha)
  if not hex or type(hex) ~= "string" then return 1, 1, 1, alpha or 1 end
  local r, g, b, a = Color.parse(hex)
  if r then return r, g, b, alpha or a or 1 end
  return 1, 1, 1, alpha or 1
end

--- Normalize a LatLng from various formats to (lat, lng).
local function toLatLng(v)
  if not v then return 0, 0 end
  if type(v) == "table" then
    if v.lat then return v.lat, v.lng end
    return v[1] or 0, v[2] or 0
  end
  return 0, 0
end

-- ============================================================================
-- Initialization
-- ============================================================================

function Map.init()
  if initialized then return end
  initialized = true

  Geo = require("lua.geo")
  TileCache = require("lua.tilecache")
  globalCache = TileCache.open("tilecache.db")
end

-- ============================================================================
-- Map state constructor
-- ============================================================================

local function createMapState()
  return {
    -- View
    centerLat = 0,
    centerLng = 0,
    zoom = 2,
    bearing = 0,
    pitch = 0,
    minZoom = 0,
    maxZoom = 19,

    -- Canvas
    canvas = nil,
    width = 0,
    height = 0,

    -- Interaction
    isDragging = false,
    dragStartX = 0,
    dragStartY = 0,
    dragStartLat = 0,
    dragStartLng = 0,
    scrollWheelZoom = true,
    draggingEnabled = true,

    -- Zoom animation
    zoomAnimating = false,
    zoomFrom = 0,
    zoomTo = 0,
    zoomT = 0,
    zoomDuration = 0.3,

    -- Pan animation (for flyTo)
    panAnimating = false,
    panFromLat = 0, panFromLng = 0,
    panToLat = 0, panToLng = 0,
    panT = 0,
    panDuration = 0.5,

    -- Screen position (absolute, for hit testing)
    screenX = 0,
    screenY = 0,

    -- Collected children (rebuilt each frame from tree)
    tileLayers = {},
    markers = {},
    popups = {},
    tooltips = {},
    polylines = {},
    polygons = {},
    circles = {},
    circleMarkers = {},
    rectangles = {},
    geojsonLayers = {},
    imageOverlays = {},
    controls = { zoom = nil, scale = nil, attribution = nil },

    -- Popup state
    openPopupId = nil,   -- which popup is currently open
    hoveredMarkerId = nil,

    -- Dirty flag for emitting viewchange events
    viewDirty = false,

    -- Last React-provided prop values (for change detection)
    _lastPropsCenter = nil,  -- {lat, lng} or nil
    _lastPropsZoom = nil,
    _lastPropsBearing = nil,
    _lastPropsPitch = nil,
  }
end

local function getOrCreate(nodeId)
  if maps[nodeId] then return maps[nodeId] end
  maps[nodeId] = createMapState()
  return maps[nodeId]
end

-- ============================================================================
-- Projection: lat/lng -> canvas pixel
-- ============================================================================

--- Project lat/lng to pixel coordinates on the map canvas.
--- Returns x, y relative to the canvas (0,0 = top-left of canvas).
local function project(m, lat, lng)
  local intZoom = math.floor(m.zoom)
  local fracScale = math.pow(2, m.zoom - intZoom)

  local cx, cy = Geo.latlngToPixel(m.centerLat, m.centerLng, intZoom)
  local px, py = Geo.latlngToPixel(lat, lng, intZoom)

  local dx = (px - cx) * fracScale
  local dy = (py - cy) * fracScale

  return m.width / 2 + dx, m.height / 2 + dy
end

--- Convert canvas pixel back to lat/lng.
local function unproject(m, canvasX, canvasY)
  local intZoom = math.floor(m.zoom)
  local fracScale = math.pow(2, m.zoom - intZoom)

  local cx, cy = Geo.latlngToPixel(m.centerLat, m.centerLng, intZoom)
  local px = cx + (canvasX - m.width / 2) / fracScale
  local py = cy + (canvasY - m.height / 2) / fracScale

  return Geo.pixelToLatlng(px, py, intZoom)
end

--- Convert a radius in meters to pixels at a given lat/lng.
local function metersToPixels(m, lat, meters)
  local mpp = Geo.metersPerPixel(lat, m.zoom)
  if mpp <= 0 then return 0 end
  return meters / mpp
end

-- ============================================================================
-- Tree sync — read Map2D nodes and their children each frame
-- ============================================================================

local function collectChildren(parent, m)
  for _, child in ipairs(parent.children or {}) do
    local cp = child.props or {}
    local t = child.type

    if t == "MapTileLayer" then
      -- Register tile source if needed
      local url = cp.url or ""
      local sourceName = url  -- use URL as source key
      if url ~= "" and globalCache and not globalCache.sources[sourceName] then
        TileCache.addSource(globalCache, sourceName, {
          urlTemplate = url,
          minZoom = cp.minZoom or 0,
          maxZoom = cp.maxZoom or 19,
          tileSize = cp.tileSize or 256,
          attribution = cp.attribution or "",
          headers = cp.headers or {},
        })
      end
      m.tileLayers[#m.tileLayers + 1] = {
        source = sourceName,
        opacity = cp.opacity or 1,
        minZoom = cp.minZoom or 0,
        maxZoom = cp.maxZoom or 19,
        attribution = cp.attribution,
        zIndex = cp.zIndex or 0,
      }

    elseif t == "MapMarker" then
      local lat, lng = toLatLng(cp.position)
      m.markers[child.id] = {
        lat = lat, lng = lng,
        icon = cp.icon,
        draggable = cp.draggable or false,
        opacity = cp.opacity or 1,
        hasHandlers = child.hasHandlers,
        children = child.children,
      }

    elseif t == "MapPopup" then
      local lat, lng
      if cp.position then
        lat, lng = toLatLng(cp.position)
      end
      m.popups[child.id] = {
        lat = lat, lng = lng,
        text = cp.text or "",
        maxWidth = cp.maxWidth or 300,
        closeButton = cp.closeButton ~= false,
        parentId = parent.type == "MapMarker" and parent.id or nil,
      }

    elseif t == "MapTooltip" then
      local lat, lng
      if cp.position then
        lat, lng = toLatLng(cp.position)
      end
      m.tooltips[child.id] = {
        lat = lat, lng = lng,
        text = cp.text or "",
        direction = cp.direction or "auto",
        permanent = cp.permanent or false,
        opacity = cp.opacity or 0.9,
        parentId = parent.type == "MapMarker" and parent.id or nil,
      }

    elseif t == "MapPolyline" then
      m.polylines[child.id] = {
        positions = cp.positions or {},
        color = cp.color or "#3388ff",
        weight = cp.weight or 3,
        opacity = cp.opacity or 1,
        dashArray = cp.dashArray,
        stroke = cp.stroke ~= false,
      }

    elseif t == "MapPolygon" then
      m.polygons[child.id] = {
        positions = cp.positions or {},
        color = cp.color or "#3388ff",
        weight = cp.weight or 3,
        opacity = cp.opacity or 1,
        fillColor = cp.fillColor or cp.color or "#3388ff",
        fillOpacity = cp.fillOpacity or 0.2,
        fill = cp.fill ~= false,
        stroke = cp.stroke ~= false,
      }

    elseif t == "MapCircle" then
      local lat, lng = toLatLng(cp.center)
      m.circles[child.id] = {
        lat = lat, lng = lng,
        radius = cp.radius or 100,  -- meters
        color = cp.color or "#3388ff",
        weight = cp.weight or 3,
        opacity = cp.opacity or 1,
        fillColor = cp.fillColor or cp.color or "#3388ff",
        fillOpacity = cp.fillOpacity or 0.2,
        fill = cp.fill ~= false,
        stroke = cp.stroke ~= false,
      }

    elseif t == "MapCircleMarker" then
      local lat, lng = toLatLng(cp.center)
      m.circleMarkers[child.id] = {
        lat = lat, lng = lng,
        radius = cp.radius or 10,  -- pixels (fixed)
        color = cp.color or "#3388ff",
        weight = cp.weight or 3,
        opacity = cp.opacity or 1,
        fillColor = cp.fillColor or cp.color or "#3388ff",
        fillOpacity = cp.fillOpacity or 0.2,
        fill = cp.fill ~= false,
        stroke = cp.stroke ~= false,
      }

    elseif t == "MapRectangle" then
      local bounds = cp.bounds or {{0,0},{0,0}}
      local swLat, swLng = toLatLng(bounds[1])
      local neLat, neLng = toLatLng(bounds[2])
      m.rectangles[child.id] = {
        swLat = swLat, swLng = swLng,
        neLat = neLat, neLng = neLng,
        color = cp.color or "#3388ff",
        weight = cp.weight or 3,
        opacity = cp.opacity or 1,
        fillColor = cp.fillColor or cp.color or "#3388ff",
        fillOpacity = cp.fillOpacity or 0.2,
        fill = cp.fill ~= false,
        stroke = cp.stroke ~= false,
      }

    elseif t == "MapGeoJSON" then
      m.geojsonLayers[child.id] = {
        data = cp.data,
        style = cp.style,
        filter = cp.filter,
      }

    elseif t == "MapImageOverlay" then
      local bounds = cp.bounds or {{0,0},{0,0}}
      local swLat, swLng = toLatLng(bounds[1])
      local neLat, neLng = toLatLng(bounds[2])
      m.imageOverlays[child.id] = {
        url = cp.url or "",
        swLat = swLat, swLng = swLng,
        neLat = neLat, neLng = neLng,
        opacity = cp.opacity or 1,
        image = nil,  -- loaded lazily
      }

    elseif t == "MapZoomControl" then
      m.controls.zoom = {
        position = cp.position or "topleft",
        zoomInText = cp.zoomInText or "+",
        zoomOutText = cp.zoomOutText or "-",
      }

    elseif t == "MapScaleControl" then
      m.controls.scale = {
        position = cp.position or "bottomleft",
        maxWidth = cp.maxWidth or 100,
        metric = cp.metric ~= false,
        imperial = cp.imperial or false,
      }

    elseif t == "MapAttributionControl" then
      m.controls.attribution = {
        position = cp.position or "bottomright",
        prefix = cp.prefix,
      }

    elseif t == "MapLayerGroup" or t == "MapFeatureGroup" or t == "MapPane" then
      -- Container nodes: recurse into children
      collectChildren(child, m)
    end

    -- Recurse into marker children (for Popup/Tooltip attached to markers)
    if t == "MapMarker" then
      collectChildren(child, m)
    end
  end
end

local function syncMap(node)
  if not Geo then return end

  local c = node.computed
  if not c then return end

  local w = math.floor(c.w or 0)
  local h = math.floor(c.h or 0)
  if w <= 0 or h <= 0 then return end

  local m = getOrCreate(node.id)
  local props = node.props or {}

  -- Update view from React props — only apply when React actually changes the value.
  -- Without this check, unchanged React props overwrite Lua-owned state every frame,
  -- causing scroll-wheel zoom to rubber-band and drag-panning to snap back.
  if props.center then
    local lat, lng = toLatLng(props.center)
    local prev = m._lastPropsCenter
    if not prev or prev[1] ~= lat or prev[2] ~= lng then
      m._lastPropsCenter = { lat, lng }
      if not m.isDragging and not m.panAnimating then
        m.centerLat = lat
        m.centerLng = lng
      end
    end
  end
  if props.zoom ~= nil then
    if m._lastPropsZoom ~= props.zoom then
      m._lastPropsZoom = props.zoom
      if not m.isDragging and not m.zoomAnimating then
        m.zoom = props.zoom
      end
    end
  end
  if props.bearing ~= nil then
    if m._lastPropsBearing ~= props.bearing then
      m._lastPropsBearing = props.bearing
      m.bearing = props.bearing
    end
  end
  if props.pitch ~= nil then
    if m._lastPropsPitch ~= props.pitch then
      m._lastPropsPitch = props.pitch
      m.pitch = props.pitch
    end
  end

  if props.minZoom ~= nil then m.minZoom = props.minZoom end
  if props.maxZoom ~= nil then m.maxZoom = props.maxZoom end
  if props.scrollWheelZoom ~= nil then m.scrollWheelZoom = props.scrollWheelZoom end
  if props.dragging ~= nil then m.draggingEnabled = props.dragging end

  -- Screen position for hit testing
  m.screenX = c.x or 0
  m.screenY = c.y or 0

  -- Recreate canvas if size changed
  if m.width ~= w or m.height ~= h then
    if m.canvas then m.canvas:release() end
    m.canvas = love.graphics.newCanvas(w, h)
    m.width = w
    m.height = h
  end

  -- Rebuild children from tree
  m.tileLayers = {}
  m.markers = {}
  m.popups = {}
  m.tooltips = {}
  m.polylines = {}
  m.polygons = {}
  m.circles = {}
  m.circleMarkers = {}
  m.rectangles = {}
  m.geojsonLayers = {}
  m.imageOverlays = {}
  m.controls = { zoom = nil, scale = nil, attribution = nil }

  collectChildren(node, m)

  -- Default: if no explicit attribution control but we have tile layers, render one
  if not m.controls.attribution and #m.tileLayers > 0 then
    m.controls.attribution = { position = "bottomright" }
  end
end

-- ============================================================================
-- Rendering: Tiles
-- ============================================================================

local function renderTiles(m)
  local intZoom = math.floor(m.zoom)
  local fracScale = math.pow(2, m.zoom - intZoom)
  local tileSize = Geo.tileSize()
  local scaledTile = tileSize * fracScale

  local cx, cy = Geo.latlngToPixel(m.centerLat, m.centerLng, intZoom)

  local minTx, minTy, maxTx, maxTy = Geo.visibleTiles(
    m.centerLat, m.centerLng, m.zoom, m.width, m.height
  )

  for _, layer in ipairs(m.tileLayers) do
    if layer.source ~= "" and intZoom >= layer.minZoom and intZoom <= layer.maxZoom then
      love.graphics.setColor(1, 1, 1, layer.opacity)

      for ty = minTy, maxTy do
        for tx = minTx, maxTx do
          local wtx = Geo.wrapTileX(tx, intZoom)
          local img = TileCache.getTile(globalCache, layer.source, intZoom, wtx, ty)

          local drawX = (tx * tileSize - cx) * fracScale + m.width / 2
          local drawY = (ty * tileSize - cy) * fracScale + m.height / 2

          if img then
            love.graphics.draw(img, drawX, drawY, 0,
              scaledTile / tileSize, scaledTile / tileSize)
          else
            -- Placeholder tile
            love.graphics.setColor(0.90, 0.90, 0.88, layer.opacity * 0.4)
            love.graphics.rectangle("fill", drawX, drawY, scaledTile, scaledTile)
            love.graphics.setColor(0.80, 0.80, 0.78, layer.opacity * 0.3)
            love.graphics.rectangle("line", drawX, drawY, scaledTile, scaledTile)
            love.graphics.setColor(1, 1, 1, layer.opacity)
          end
        end
      end
    end
  end
end

-- ============================================================================
-- Rendering: Polylines
-- ============================================================================

local function renderPolylines(m)
  for _, poly in pairs(m.polylines) do
    if not poly.stroke then goto continue end
    local positions = poly.positions
    if not positions or #positions < 2 then goto continue end

    local r, g, b = parseColor(poly.color)
    love.graphics.setColor(r, g, b, poly.opacity)
    love.graphics.setLineWidth(poly.weight)

    local pts = {}
    for _, pos in ipairs(positions) do
      local lat, lng = toLatLng(pos)
      local px, py = project(m, lat, lng)
      pts[#pts + 1] = px
      pts[#pts + 1] = py
    end

    if #pts >= 4 then
      love.graphics.line(pts)
    end

    love.graphics.setLineWidth(1)
    ::continue::
  end
end

-- ============================================================================
-- Rendering: Polygons
-- ============================================================================

local function renderPolygons(m)
  for _, poly in pairs(m.polygons) do
    local positions = poly.positions
    if not positions or #positions < 3 then goto continue end

    local verts = {}
    for _, pos in ipairs(positions) do
      local lat, lng = toLatLng(pos)
      local px, py = project(m, lat, lng)
      verts[#verts + 1] = px
      verts[#verts + 1] = py
    end

    if #verts < 6 then goto continue end

    -- Fill
    if poly.fill then
      local r, g, b = parseColor(poly.fillColor)
      love.graphics.setColor(r, g, b, poly.fillOpacity)
      local ok, triangles = pcall(love.math.triangulate, verts)
      if ok and triangles then
        for _, tri in ipairs(triangles) do
          love.graphics.polygon("fill", tri)
        end
      end
    end

    -- Stroke
    if poly.stroke then
      local r, g, b = parseColor(poly.color)
      love.graphics.setColor(r, g, b, poly.opacity)
      love.graphics.setLineWidth(poly.weight)
      -- Close the polygon
      local closed = {}
      for i = 1, #verts do closed[i] = verts[i] end
      closed[#closed + 1] = verts[1]
      closed[#closed + 1] = verts[2]
      love.graphics.line(closed)
      love.graphics.setLineWidth(1)
    end

    ::continue::
  end
end

-- ============================================================================
-- Rendering: Circles
-- ============================================================================

local function renderCircles(m)
  for _, c in pairs(m.circles) do
    local px, py = project(m, c.lat, c.lng)
    local radiusPx = metersToPixels(m, c.lat, c.radius)
    if radiusPx < 0.5 then goto continue end

    -- Fill
    if c.fill then
      local r, g, b = parseColor(c.fillColor)
      love.graphics.setColor(r, g, b, c.fillOpacity)
      love.graphics.circle("fill", px, py, radiusPx)
    end

    -- Stroke
    if c.stroke then
      local r, g, b = parseColor(c.color)
      love.graphics.setColor(r, g, b, c.opacity)
      love.graphics.setLineWidth(c.weight)
      love.graphics.circle("line", px, py, radiusPx)
      love.graphics.setLineWidth(1)
    end

    ::continue::
  end
end

-- ============================================================================
-- Rendering: CircleMarkers (fixed pixel radius)
-- ============================================================================

local function renderCircleMarkers(m)
  for _, c in pairs(m.circleMarkers) do
    local px, py = project(m, c.lat, c.lng)

    -- Fill
    if c.fill then
      local r, g, b = parseColor(c.fillColor)
      love.graphics.setColor(r, g, b, c.fillOpacity)
      love.graphics.circle("fill", px, py, c.radius)
    end

    -- Stroke
    if c.stroke then
      local r, g, b = parseColor(c.color)
      love.graphics.setColor(r, g, b, c.opacity)
      love.graphics.setLineWidth(c.weight)
      love.graphics.circle("line", px, py, c.radius)
      love.graphics.setLineWidth(1)
    end
  end
end

-- ============================================================================
-- Rendering: Rectangles
-- ============================================================================

local function renderRectangles(m)
  for _, rect in pairs(m.rectangles) do
    local x1, y1 = project(m, rect.neLat, rect.swLng)  -- top-left (NW)
    local x2, y2 = project(m, rect.swLat, rect.neLng)  -- bottom-right (SE)
    local rx = math.min(x1, x2)
    local ry = math.min(y1, y2)
    local rw = math.abs(x2 - x1)
    local rh = math.abs(y2 - y1)

    -- Fill
    if rect.fill then
      local r, g, b = parseColor(rect.fillColor)
      love.graphics.setColor(r, g, b, rect.fillOpacity)
      love.graphics.rectangle("fill", rx, ry, rw, rh)
    end

    -- Stroke
    if rect.stroke then
      local r, g, b = parseColor(rect.color)
      love.graphics.setColor(r, g, b, rect.opacity)
      love.graphics.setLineWidth(rect.weight)
      love.graphics.rectangle("line", rx, ry, rw, rh)
      love.graphics.setLineWidth(1)
    end
  end
end

-- ============================================================================
-- Rendering: GeoJSON
-- ============================================================================

local function extractFeatures(data)
  if not data then return {} end
  if data.type == "FeatureCollection" and data.features then
    return data.features
  elseif data.type == "Feature" then
    return { data }
  elseif data.type == "Point" or data.type == "LineString" or data.type == "Polygon"
      or data.type == "MultiPoint" or data.type == "MultiLineString" or data.type == "MultiPolygon" then
    return {{ type = "Feature", geometry = data, properties = {} }}
  end
  return {}
end

local function featureStyle(feature, layerStyle)
  local props = feature.properties or {}
  return {
    color       = props.stroke      or "#333333",
    weight      = props["stroke-width"] or 2,
    opacity     = props["stroke-opacity"] or 1,
    fillColor   = props.fill        or "#3388ff",
    fillOpacity = props["fill-opacity"] or 0.2,
  }
end

local function renderGeoJSONPoint(m, coord, style)
  local px, py = project(m, coord[2], coord[1])  -- GeoJSON: [lng, lat]
  local r, g, b = parseColor(style.fillColor)
  love.graphics.setColor(r, g, b, style.fillOpacity)
  love.graphics.circle("fill", px, py, 6)
  local sr, sg, sb = parseColor(style.color)
  love.graphics.setColor(sr, sg, sb, style.opacity)
  love.graphics.circle("line", px, py, 6)
end

local function renderGeoJSONLine(m, coords, style)
  if not coords or #coords < 2 then return end
  local pts = {}
  for _, coord in ipairs(coords) do
    local px, py = project(m, coord[2], coord[1])
    pts[#pts + 1] = px
    pts[#pts + 1] = py
  end
  if #pts >= 4 then
    local r, g, b = parseColor(style.color)
    love.graphics.setColor(r, g, b, style.opacity)
    love.graphics.setLineWidth(style.weight)
    love.graphics.line(pts)
    love.graphics.setLineWidth(1)
  end
end

local function renderGeoJSONRing(m, ring, style)
  if not ring or #ring < 3 then return end

  local verts = {}
  for _, coord in ipairs(ring) do
    local px, py = project(m, coord[2], coord[1])
    verts[#verts + 1] = px
    verts[#verts + 1] = py
  end
  if #verts < 6 then return end

  -- Fill
  local r, g, b = parseColor(style.fillColor)
  love.graphics.setColor(r, g, b, style.fillOpacity)
  local ok, triangles = pcall(love.math.triangulate, verts)
  if ok and triangles then
    for _, tri in ipairs(triangles) do
      love.graphics.polygon("fill", tri)
    end
  end

  -- Stroke
  local sr, sg, sb = parseColor(style.color)
  love.graphics.setColor(sr, sg, sb, style.opacity)
  love.graphics.setLineWidth(style.weight)
  local closed = {}
  for i = 1, #verts do closed[i] = verts[i] end
  closed[#closed + 1] = verts[1]
  closed[#closed + 1] = verts[2]
  love.graphics.line(closed)
  love.graphics.setLineWidth(1)
end

local function renderGeoJSON(m)
  for _, layer in pairs(m.geojsonLayers) do
    local features = extractFeatures(layer.data)
    for _, feature in ipairs(features) do
      local geom = feature.geometry
      if not geom then goto next end
      local style = featureStyle(feature, layer.style)

      if geom.type == "Point" then
        renderGeoJSONPoint(m, geom.coordinates, style)
      elseif geom.type == "MultiPoint" then
        for _, coord in ipairs(geom.coordinates or {}) do
          renderGeoJSONPoint(m, coord, style)
        end
      elseif geom.type == "LineString" then
        renderGeoJSONLine(m, geom.coordinates, style)
      elseif geom.type == "MultiLineString" then
        for _, line in ipairs(geom.coordinates or {}) do
          renderGeoJSONLine(m, line, style)
        end
      elseif geom.type == "Polygon" then
        renderGeoJSONRing(m, geom.coordinates and geom.coordinates[1], style)
      elseif geom.type == "MultiPolygon" then
        for _, polygon in ipairs(geom.coordinates or {}) do
          renderGeoJSONRing(m, polygon[1], style)
        end
      end

      ::next::
    end
  end
end

-- ============================================================================
-- Rendering: Image Overlays
-- ============================================================================

local imageOverlayCache = {}  -- url -> Love2D Image

local function renderImageOverlays(m)
  for _, ov in pairs(m.imageOverlays) do
    if ov.url == "" then goto continue end

    -- Load image (lazy)
    local img = imageOverlayCache[ov.url]
    if not img then
      local ok, loaded = pcall(love.graphics.newImage, ov.url)
      if ok then
        imageOverlayCache[ov.url] = loaded
        img = loaded
      end
    end
    if not img then goto continue end

    local x1, y1 = project(m, ov.neLat, ov.swLng)  -- NW
    local x2, y2 = project(m, ov.swLat, ov.neLng)  -- SE
    local rx = math.min(x1, x2)
    local ry = math.min(y1, y2)
    local rw = math.abs(x2 - x1)
    local rh = math.abs(y2 - y1)

    love.graphics.setColor(1, 1, 1, ov.opacity)
    love.graphics.draw(img, rx, ry, 0, rw / img:getWidth(), rh / img:getHeight())

    ::continue::
  end
end

-- ============================================================================
-- Rendering: Markers
-- ============================================================================

local MARKER_RADIUS = 12
local MARKER_STEM = 8

local function renderMarkers(m)
  for nodeId, marker in pairs(m.markers) do
    local px, py = project(m, marker.lat, marker.lng)

    love.graphics.setColor(1, 1, 1, marker.opacity)

    if marker.icon then
      -- Custom icon image
      local img = imageOverlayCache[marker.icon]
      if not img then
        local ok, loaded = pcall(love.graphics.newImage, marker.icon)
        if ok then imageOverlayCache[marker.icon] = loaded; img = loaded end
      end
      if img then
        local iw, ih = img:getWidth(), img:getHeight()
        love.graphics.draw(img, px - iw / 2, py - ih, 0, 1, 1)
      end
    else
      -- Default marker: teardrop shape
      -- Stem (triangle pointing down)
      love.graphics.setColor(0.85, 0.22, 0.20, marker.opacity)  -- #d93832
      love.graphics.polygon("fill",
        px, py,  -- tip
        px - MARKER_RADIUS * 0.6, py - MARKER_STEM,
        px + MARKER_RADIUS * 0.6, py - MARKER_STEM
      )
      -- Circle head
      love.graphics.circle("fill", px, py - MARKER_STEM - MARKER_RADIUS + 2, MARKER_RADIUS)
      -- White dot in center
      love.graphics.setColor(1, 1, 1, marker.opacity)
      love.graphics.circle("fill", px, py - MARKER_STEM - MARKER_RADIUS + 2, MARKER_RADIUS * 0.35)
      -- Border
      love.graphics.setColor(0.6, 0.12, 0.10, marker.opacity)
      love.graphics.setLineWidth(1.5)
      love.graphics.circle("line", px, py - MARKER_STEM - MARKER_RADIUS + 2, MARKER_RADIUS)
      love.graphics.setLineWidth(1)
    end
  end
end

-- ============================================================================
-- Rendering: Popups
-- ============================================================================

local function renderPopups(m)
  for popupId, popup in pairs(m.popups) do
    -- Only render if this popup is the open one, or it has an explicit position
    local isOpen = (m.openPopupId == popupId)
    local hasPosition = popup.lat ~= nil

    if not isOpen and not hasPosition then goto continue end

    local lat, lng = popup.lat, popup.lng
    -- If attached to a marker, use marker position
    if popup.parentId and m.markers[popup.parentId] then
      local marker = m.markers[popup.parentId]
      lat = marker.lat
      lng = marker.lng
    end
    if not lat then goto continue end

    local px, py = project(m, lat, lng)
    local text = popup.text
    if text == "" then goto continue end

    -- Measure text
    local font = love.graphics.getFont()
    local maxW = math.min(popup.maxWidth, m.width * 0.8)
    local _, wrappedLines = font:getWrap(text, maxW)
    local lineH = font:getHeight()
    local textH = #wrappedLines * lineH
    local textW = 0
    for _, line in ipairs(wrappedLines) do
      textW = math.max(textW, font:getWidth(line))
    end

    local pad = 8
    local boxW = textW + pad * 2
    local boxH = textH + pad * 2
    local tailH = 8

    -- Position above the point
    local bx = px - boxW / 2
    local by = py - MARKER_STEM - MARKER_RADIUS * 2 - tailH - boxH - 4

    -- Clamp to canvas bounds
    bx = math.max(2, math.min(m.width - boxW - 2, bx))
    by = math.max(2, by)

    -- Shadow
    love.graphics.setColor(0, 0, 0, 0.15)
    love.graphics.rectangle("fill", bx + 2, by + 2, boxW, boxH, 4, 4)

    -- Background
    love.graphics.setColor(1, 1, 1, 0.95)
    love.graphics.rectangle("fill", bx, by, boxW, boxH, 4, 4)

    -- Tail triangle
    local tailX = px
    local tailY = by + boxH
    love.graphics.setColor(1, 1, 1, 0.95)
    love.graphics.polygon("fill",
      tailX - 6, tailY,
      tailX + 6, tailY,
      tailX, tailY + tailH
    )

    -- Border
    love.graphics.setColor(0.75, 0.75, 0.75, 1)
    love.graphics.setLineWidth(1)
    love.graphics.rectangle("line", bx, by, boxW, boxH, 4, 4)

    -- Close button
    if popup.closeButton then
      local cbx = bx + boxW - 16
      local cby = by + 2
      love.graphics.setColor(0.5, 0.5, 0.5, 0.7)
      love.graphics.print("x", cbx, cby)
    end

    -- Text
    love.graphics.setColor(0.15, 0.15, 0.15, 1)
    love.graphics.printf(text, bx + pad, by + pad, maxW, "left")

    ::continue::
  end
end

-- ============================================================================
-- Rendering: Tooltips
-- ============================================================================

local function renderTooltips(m)
  for _, tooltip in pairs(m.tooltips) do
    -- Show if permanent, or if parent marker is hovered
    local show = tooltip.permanent
    if not show and tooltip.parentId and m.hoveredMarkerId == tooltip.parentId then
      show = true
    end
    if not show and tooltip.lat then
      show = true  -- has explicit position
    end
    if not show then goto continue end

    local lat, lng = tooltip.lat, tooltip.lng
    if tooltip.parentId and m.markers[tooltip.parentId] then
      local marker = m.markers[tooltip.parentId]
      lat = marker.lat
      lng = marker.lng
    end
    if not lat then goto continue end

    local px, py = project(m, lat, lng)
    local text = tooltip.text
    if text == "" then goto continue end

    local font = love.graphics.getFont()
    local tw = font:getWidth(text)
    local th = font:getHeight()
    local pad = 4

    -- Position based on direction
    local dir = tooltip.direction
    local bx, by
    if dir == "right" or dir == "auto" then
      bx = px + 14
      by = py - th / 2 - pad
    elseif dir == "left" then
      bx = px - tw - pad * 2 - 14
      by = py - th / 2 - pad
    elseif dir == "top" then
      bx = px - tw / 2 - pad
      by = py - th - pad * 2 - 14
    elseif dir == "bottom" then
      bx = px - tw / 2 - pad
      by = py + 14
    else
      bx = px + 14
      by = py - th / 2 - pad
    end

    -- Background
    love.graphics.setColor(1, 1, 1, tooltip.opacity)
    love.graphics.rectangle("fill", bx, by, tw + pad * 2, th + pad * 2, 3, 3)

    -- Border
    love.graphics.setColor(0.7, 0.7, 0.7, tooltip.opacity)
    love.graphics.rectangle("line", bx, by, tw + pad * 2, th + pad * 2, 3, 3)

    -- Text
    love.graphics.setColor(0.15, 0.15, 0.15, tooltip.opacity)
    love.graphics.print(text, bx + pad, by + pad)

    ::continue::
  end
end

-- ============================================================================
-- Rendering: Controls
-- ============================================================================

local function renderZoomControl(m)
  local ctrl = m.controls.zoom
  if not ctrl then return end

  local btnSize = 30
  local margin = 10
  local x, y

  if ctrl.position == "topleft" then
    x, y = margin, margin
  elseif ctrl.position == "topright" then
    x, y = m.width - btnSize - margin, margin
  elseif ctrl.position == "bottomleft" then
    x, y = margin, m.height - btnSize * 2 - margin
  else
    x, y = m.width - btnSize - margin, m.height - btnSize * 2 - margin
  end

  -- Store button rects for hit testing
  m._zoomInRect = { x = x + m.screenX, y = y + m.screenY, w = btnSize, h = btnSize }
  m._zoomOutRect = { x = x + m.screenX, y = y + btnSize + m.screenY, w = btnSize, h = btnSize }

  -- Zoom in button
  love.graphics.setColor(1, 1, 1, 0.9)
  love.graphics.rectangle("fill", x, y, btnSize, btnSize, 4, 4)
  love.graphics.setColor(0.3, 0.3, 0.3, 1)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", x, y, btnSize, btnSize, 4, 4)
  local font = love.graphics.getFont()
  local tw = font:getWidth(ctrl.zoomInText)
  local th = font:getHeight()
  love.graphics.print(ctrl.zoomInText, x + (btnSize - tw) / 2, y + (btnSize - th) / 2)

  -- Zoom out button
  love.graphics.setColor(1, 1, 1, 0.9)
  love.graphics.rectangle("fill", x, y + btnSize, btnSize, btnSize, 4, 4)
  love.graphics.setColor(0.3, 0.3, 0.3, 1)
  love.graphics.rectangle("line", x, y + btnSize, btnSize, btnSize, 4, 4)
  tw = font:getWidth(ctrl.zoomOutText)
  love.graphics.print(ctrl.zoomOutText, x + (btnSize - tw) / 2, y + btnSize + (btnSize - th) / 2)
end

local function renderScaleControl(m)
  local ctrl = m.controls.scale
  if not ctrl then return end

  local margin = 10
  local x, y
  local barMaxW = ctrl.maxWidth

  if ctrl.position == "bottomleft" then
    x = margin
    y = m.height - 30
  elseif ctrl.position == "bottomright" then
    x = m.width - barMaxW - margin
    y = m.height - 30
  elseif ctrl.position == "topleft" then
    x = margin
    y = margin
  else
    x = m.width - barMaxW - margin
    y = margin
  end

  -- Calculate scale: how many meters does maxWidth pixels represent?
  local mpp = Geo.metersPerPixel(m.centerLat, m.zoom)
  local maxMeters = barMaxW * mpp

  -- Round to a nice number
  local niceValues = {1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000}
  local niceMeters = niceValues[1]
  for _, v in ipairs(niceValues) do
    if v <= maxMeters then niceMeters = v end
  end

  local barW = niceMeters / mpp
  local label
  if ctrl.metric ~= false then
    if niceMeters >= 1000 then
      label = string.format("%d km", niceMeters / 1000)
    else
      label = string.format("%d m", niceMeters)
    end
  end
  if ctrl.imperial then
    local feet = niceMeters * 3.28084
    if feet >= 5280 then
      label = string.format("%.1f mi", feet / 5280)
    else
      label = string.format("%d ft", math.floor(feet))
    end
  end

  if label then
    local font = love.graphics.getFont()
    -- Bar
    love.graphics.setColor(1, 1, 1, 0.8)
    love.graphics.rectangle("fill", x - 2, y, barW + 4, 18)
    love.graphics.setColor(0.2, 0.2, 0.2, 0.9)
    love.graphics.setLineWidth(2)
    love.graphics.line(x, y + 16, x, y + 10, x + barW, y + 10, x + barW, y + 16)
    love.graphics.setLineWidth(1)
    -- Label
    love.graphics.setColor(0.15, 0.15, 0.15, 1)
    love.graphics.print(label, x + 2, y)
  end
end

local function renderAttribution(m)
  local ctrl = m.controls.attribution
  if not ctrl then return end

  -- Collect attribution strings from tile layers
  local parts = {}
  if ctrl.prefix ~= false then
    parts[#parts + 1] = ctrl.prefix or "ReactJIT"
  end
  for _, layer in ipairs(m.tileLayers) do
    if layer.attribution and layer.attribution ~= "" then
      parts[#parts + 1] = layer.attribution
    elseif globalCache and globalCache.sources[layer.source] then
      local src = globalCache.sources[layer.source]
      if src.attribution and src.attribution ~= "" then
        parts[#parts + 1] = src.attribution
      end
    end
  end

  local text = table.concat(parts, " | ")
  if text == "" then return end

  local font = love.graphics.getFont()
  local tw = font:getWidth(text)
  local th = font:getHeight()
  local pad = 4

  local x, y
  if ctrl.position == "bottomleft" then
    x, y = pad, m.height - th - pad * 2
  elseif ctrl.position == "topleft" then
    x, y = pad, pad
  elseif ctrl.position == "topright" then
    x, y = m.width - tw - pad * 2, pad
  else -- bottomright
    x, y = m.width - tw - pad * 2, m.height - th - pad * 2
  end

  love.graphics.setColor(1, 1, 1, 0.75)
  love.graphics.rectangle("fill", x, y, tw + pad * 2, th + pad * 2)
  love.graphics.setColor(0.25, 0.25, 0.25, 0.85)
  love.graphics.print(text, x + pad, y + pad)
end

-- ============================================================================
-- Main render function
-- ============================================================================

local function renderMap(nodeId)
  local m = maps[nodeId]
  if not m or not m.canvas then return end

  -- Poll tile cache
  if globalCache then
    TileCache.poll(globalCache)
    TileCache.advanceDownloads(globalCache)
  end

  -- Advance zoom animation
  if m.zoomAnimating then
    m.zoomT = m.zoomT + love.timer.getDelta() / m.zoomDuration
    if m.zoomT >= 1 then
      m.zoom = m.zoomTo
      m.zoomAnimating = false
    else
      local t = 1 - math.pow(1 - m.zoomT, 3)  -- ease-out cubic
      m.zoom = m.zoomFrom + (m.zoomTo - m.zoomFrom) * t
    end
    m.viewDirty = true
  end

  -- Advance pan animation (flyTo)
  if m.panAnimating then
    m.panT = m.panT + love.timer.getDelta() / m.panDuration
    if m.panT >= 1 then
      m.centerLat = m.panToLat
      m.centerLng = m.panToLng
      m.panAnimating = false
    else
      local t = 1 - math.pow(1 - m.panT, 3)
      m.centerLat = m.panFromLat + (m.panToLat - m.panFromLat) * t
      m.centerLng = m.panFromLng + (m.panToLng - m.panFromLng) * t
    end
    m.viewDirty = true
  end

  -- Render to off-screen canvas
  love.graphics.push("all")
  love.graphics.setCanvas(m.canvas)
  love.graphics.clear(0.93, 0.93, 0.90, 1)  -- light warm gray background
  love.graphics.setColor(1, 1, 1, 1)

  -- Apply bearing rotation
  if m.bearing ~= 0 then
    love.graphics.translate(m.width / 2, m.height / 2)
    love.graphics.rotate(-m.bearing * math.pi / 180)
    love.graphics.translate(-m.width / 2, -m.height / 2)
  end

  -- Layer order (matches Leaflet's pane z-ordering):
  -- 1. Tiles
  -- 2. Image overlays
  -- 3. Vector layers (polygons, rectangles, circles, polylines, GeoJSON)
  -- 4. Markers
  -- 5. Popups & tooltips
  -- 6. Controls

  renderTiles(m)
  renderImageOverlays(m)
  renderPolygons(m)
  renderRectangles(m)
  renderCircles(m)
  renderCircleMarkers(m)
  renderPolylines(m)
  renderGeoJSON(m)
  renderMarkers(m)
  renderTooltips(m)
  renderPopups(m)

  -- Reset rotation for controls (they render in screen space)
  if m.bearing ~= 0 then
    love.graphics.origin()
  end

  renderZoomControl(m)
  renderScaleControl(m)
  renderAttribution(m)

  love.graphics.pop()
end

-- ============================================================================
-- Mouse interaction
-- ============================================================================

function Map.handleMousePressed(node, mx, my, button)
  if button ~= 1 then return false end
  if not Geo then return false end

  local m = maps[node.id]
  if not m then return false end

  -- Convert to canvas-local coordinates
  local lx = mx - m.screenX
  local ly = my - m.screenY

  -- Check zoom control buttons
  if m._zoomInRect then
    local r = m._zoomInRect
    if mx >= r.x and mx <= r.x + r.w and my >= r.y and my <= r.y + r.h then
      local newZoom = math.min(m.maxZoom, math.floor(m.zoom) + 1)
      if newZoom ~= m.zoom then
        m.zoomFrom = m.zoom
        m.zoomTo = newZoom
        m.zoomT = 0
        m.zoomAnimating = true
        m.viewDirty = true
      end
      return true
    end
  end
  if m._zoomOutRect then
    local r = m._zoomOutRect
    if mx >= r.x and mx <= r.x + r.w and my >= r.y and my <= r.y + r.h then
      local newZoom = math.max(m.minZoom, math.floor(m.zoom) - 1)
      if newZoom ~= m.zoom then
        m.zoomFrom = m.zoom
        m.zoomTo = newZoom
        m.zoomT = 0
        m.zoomAnimating = true
        m.viewDirty = true
      end
      return true
    end
  end

  -- Check marker clicks
  for markerId, marker in pairs(m.markers) do
    local mpx, mpy = project(m, marker.lat, marker.lng)
    local dx = lx - mpx
    local dy = ly - (mpy - MARKER_STEM - MARKER_RADIUS + 2)
    if dx * dx + dy * dy <= MARKER_RADIUS * MARKER_RADIUS then
      -- Toggle popup for this marker
      local popupId = nil
      for pid, popup in pairs(m.popups) do
        if popup.parentId == markerId then popupId = pid; break end
      end
      if popupId then
        if m.openPopupId == popupId then
          m.openPopupId = nil
        else
          m.openPopupId = popupId
        end
      end

      -- Emit click event
      queueEvent(node.id, "marker:click", {
        markerId = markerId,
        latlng = { marker.lat, marker.lng },
      })
      return true
    end
  end

  -- Close open popup on map click
  if m.openPopupId then
    local popup = m.popups[m.openPopupId]
    if popup and popup.parentId then
      m.openPopupId = nil
    end
  end

  -- Emit map click event
  local clickLat, clickLng = unproject(m, lx, ly)
  queueEvent(node.id, "map:click", {
    latlng = { clickLat, clickLng },
    pixel = { lx, ly },
  })

  -- Start panning
  if m.draggingEnabled then
    m.isDragging = true
    m.dragStartX = mx
    m.dragStartY = my
    m.dragStartLat = m.centerLat
    m.dragStartLng = m.centerLng
  end

  return true
end

function Map.handleMouseMoved(node, mx, my)
  if not Geo then return false end

  local m = maps[node.id]
  if not m then return false end

  -- Update hovered marker for tooltip display
  local lx = mx - m.screenX
  local ly = my - m.screenY
  m.hoveredMarkerId = nil
  for markerId, marker in pairs(m.markers) do
    local mpx, mpy = project(m, marker.lat, marker.lng)
    local dx = lx - mpx
    local dy = ly - (mpy - MARKER_STEM - MARKER_RADIUS + 2)
    if dx * dx + dy * dy <= (MARKER_RADIUS + 4) * (MARKER_RADIUS + 4) then
      m.hoveredMarkerId = markerId
      break
    end
  end

  if not m.isDragging then return false end

  -- Pan: convert pixel delta to lat/lng
  local dx = mx - m.dragStartX
  local dy = my - m.dragStartY

  -- Apply bearing rotation to drag vector
  if m.bearing ~= 0 then
    local angle = m.bearing * math.pi / 180
    local cosA = math.cos(angle)
    local sinA = math.sin(angle)
    dx, dy = dx * cosA + dy * sinA, -dx * sinA + dy * cosA
  end

  local startPx, startPy = Geo.latlngToPixel(m.dragStartLat, m.dragStartLng, m.zoom)
  m.centerLat, m.centerLng = Geo.pixelToLatlng(startPx - dx, startPy - dy, m.zoom)
  m.viewDirty = true

  return true
end

function Map.handleMouseReleased(node, mx, my, button)
  local m = maps[node.id]
  if not m or not m.isDragging then return false end

  m.isDragging = false

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
  if not m.scrollWheelZoom then return false end

  local newZoom = m.zoom + dy * 0.5
  newZoom = math.max(m.minZoom, math.min(m.maxZoom, newZoom))

  if newZoom ~= m.zoom then
    m.zoomFrom = m.zoom
    m.zoomTo = newZoom
    m.zoomT = 0
    m.zoomAnimating = true
    m.viewDirty = true
  end

  return true
end

-- ============================================================================
-- RPC handlers (imperative control from React hooks)
-- ============================================================================

function Map.handleRPC(method, args)
  if method == "map:panTo" then
    local m = maps[args.nodeId]
    if m then
      local lat, lng = toLatLng(args.latlng or {args.lat, args.lng})
      if args.animate then
        m.panFromLat = m.centerLat
        m.panFromLng = m.centerLng
        m.panToLat = lat
        m.panToLng = lng
        m.panT = 0
        m.panDuration = (args.duration or 500) / 1000
        m.panAnimating = true
      else
        m.centerLat = lat
        m.centerLng = lng
      end
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:zoomTo" then
    local m = maps[args.nodeId]
    if m then
      local z = math.max(m.minZoom, math.min(m.maxZoom, args.zoom or m.zoom))
      if args.animate ~= false then
        m.zoomFrom = m.zoom
        m.zoomTo = z
        m.zoomT = 0
        m.zoomDuration = (args.duration or 300) / 1000
        m.zoomAnimating = true
      else
        m.zoom = z
      end
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:flyTo" then
    local m = maps[args.nodeId]
    if m then
      local duration = (args.duration or 2000) / 1000
      if args.center then
        local lat, lng = toLatLng(args.center)
        m.panFromLat = m.centerLat
        m.panFromLng = m.centerLng
        m.panToLat = lat
        m.panToLng = lng
        m.panT = 0
        m.panDuration = duration
        m.panAnimating = true
      end
      if args.zoom then
        m.zoomFrom = m.zoom
        m.zoomTo = math.max(m.minZoom, math.min(m.maxZoom, args.zoom))
        m.zoomT = 0
        m.zoomDuration = duration
        m.zoomAnimating = true
      end
      if args.bearing ~= nil then m.bearing = args.bearing end
      if args.pitch ~= nil then m.pitch = math.max(0, math.min(60, args.pitch)) end
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:fitBounds" then
    local m = maps[args.nodeId]
    if m and args.bounds then
      local sw, ne = args.bounds[1] or {0,0}, args.bounds[2] or {0,0}
      local swLat, swLng = toLatLng(sw)
      local neLat, neLng = toLatLng(ne)

      m.centerLat = (swLat + neLat) / 2
      m.centerLng = (swLng + neLng) / 2

      for z = m.maxZoom, m.minZoom, -1 do
        local swPx, swPy = Geo.latlngToPixel(swLat, swLng, z)
        local nePx, nePy = Geo.latlngToPixel(neLat, neLng, z)
        if math.abs(nePx - swPx) <= m.width and math.abs(nePy - swPy) <= m.height then
          m.zoom = z
          break
        end
      end
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:setBearing" then
    local m = maps[args.nodeId]
    if m then
      m.bearing = args.bearing or 0
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:setPitch" then
    local m = maps[args.nodeId]
    if m then
      m.pitch = math.max(0, math.min(60, args.pitch or 0))
      m.viewDirty = true
    end
    return { ok = true }

  elseif method == "map:getView" then
    local m = maps[args.nodeId]
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
    if globalCache then
      local bounds = Geo.Bounds(
        args.swLat or 0, args.swLng or 0,
        args.neLat or 0, args.neLng or 0
      )
      local regionId = TileCache.downloadRegion(
        globalCache, args.source or "", bounds,
        args.minZoom or 0, args.maxZoom or 15
      )
      return { regionId = regionId }
    end
    return { error = "cache not available" }

  elseif method == "map:downloadProgress" then
    if globalCache then
      return TileCache.getDownloadProgress(globalCache, args.regionId) or { error = "not found" }
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

function Map.syncWithTree(treeNodes)
  if not initialized then return end

  local active = {}
  for id, node in pairs(treeNodes) do
    if node.type == "Map2D" then
      syncMap(node)
      active[id] = true
    end
  end

  -- Cleanup removed maps
  for id in pairs(maps) do
    if not active[id] then
      Map.cleanup(id)
    end
  end
end

function Map.renderAll()
  if not initialized then return end
  for nodeId in pairs(maps) do
    renderMap(nodeId)
  end

  -- Emit viewchange for dirty maps that aren't being dragged
  for nodeId, m in pairs(maps) do
    if m.viewDirty and not m.isDragging then
      m.viewDirty = false
      queueEvent(nodeId, "viewchange", {
        center = { m.centerLat, m.centerLng },
        zoom = m.zoom,
        bearing = m.bearing,
        pitch = m.pitch,
      })
    end
  end
end

function Map.get(nodeId)
  local m = maps[nodeId]
  return m and m.canvas or nil
end

function Map.isMapChildType(nodeType)
  return Map.CHILD_TYPES[nodeType] or false
end

function Map.cleanup(nodeId)
  local m = maps[nodeId]
  if not m then return end
  if m.canvas then m.canvas:release() end
  maps[nodeId] = nil
end

function Map.hasMaps()
  return next(maps) ~= nil
end

function Map.drainEvents()
  if #pendingEvents == 0 then return nil end
  local events = pendingEvents
  pendingEvents = {}
  return events
end

function Map.getCache()
  return globalCache
end

return Map
