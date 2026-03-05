--[[
  geo.lua — Coordinate math & projection library

  Pure math, no Love2D or framework dependencies. Provides:
    - Web Mercator projection (EPSG:3857) for slippy map tiles
    - Tile coordinate math (ZXY scheme)
    - Haversine distance & bearing
    - Bounds utilities
    - Pluggable projections for game/custom worlds

  Usage:
    local Geo = require("lua.geo")
    local px, py = Geo.latlngToPixel(51.505, -0.09, 13)
    local tx, ty = Geo.latlngToTile(51.505, -0.09, 13)
    local dist = Geo.distance(51.505, -0.09, 48.856, 2.352)  -- London → Paris
]]

local Geo = {}

-- ============================================================================
-- Constants
-- ============================================================================

local TILE_SIZE = 256
local PI = math.pi
local RAD = PI / 180
local DEG = 180 / PI
local EARTH_RADIUS = 6378137  -- WGS84 equatorial radius in meters
local MAX_LAT = 85.0511287798 -- atan(sinh(π)) in degrees — Mercator cutoff

-- ============================================================================
-- Web Mercator Projection (EPSG:3857)
-- ============================================================================

--- Total pixel size of the world at a given zoom level.
--- @param zoom number  Zoom level (can be fractional)
--- @return number  World size in pixels
function Geo.worldSize(zoom)
  return TILE_SIZE * math.pow(2, zoom)
end

--- Number of tiles along one axis at a given zoom level.
--- @param zoom number  Integer zoom level
--- @return number  2^zoom
function Geo.tileCount(zoom)
  return math.pow(2, math.floor(zoom))
end

--- Tile size in pixels (always 256 for standard slippy maps).
--- @return number
function Geo.tileSize()
  return TILE_SIZE
end

--- Convert latitude/longitude to pixel coordinates at a given zoom.
--- Origin (0,0) is top-left of the world.
--- @param lat number  Latitude in degrees (-85.05 to 85.05)
--- @param lng number  Longitude in degrees (-180 to 180)
--- @param zoom number  Zoom level (can be fractional)
--- @return number px, number py  Pixel coordinates
function Geo.latlngToPixel(lat, lng, zoom)
  local worldSize = Geo.worldSize(zoom)

  -- Clamp latitude to Mercator range
  lat = math.max(-MAX_LAT, math.min(MAX_LAT, lat))

  local x = (lng + 180) / 360 * worldSize
  local sinLat = math.sin(lat * RAD)
  local y = (0.5 - math.log((1 + sinLat) / (1 - sinLat)) / (4 * PI)) * worldSize

  return x, y
end

--- Convert pixel coordinates back to latitude/longitude at a given zoom.
--- @param px number  Pixel X
--- @param py number  Pixel Y
--- @param zoom number  Zoom level (can be fractional)
--- @return number lat, number lng
function Geo.pixelToLatlng(px, py, zoom)
  local worldSize = Geo.worldSize(zoom)

  local lng = px / worldSize * 360 - 180
  local n = PI - 2 * PI * py / worldSize
  local lat = DEG * math.atan(0.5 * (math.exp(n) - math.exp(-n)))  -- atan(sinh(n))

  return lat, lng
end

--- Convert latitude/longitude to tile indices at a given zoom.
--- @param lat number  Latitude in degrees
--- @param lng number  Longitude in degrees
--- @param zoom number  Integer zoom level
--- @return number tx, number ty  Tile indices (0-based)
function Geo.latlngToTile(lat, lng, zoom)
  local px, py = Geo.latlngToPixel(lat, lng, zoom)
  return math.floor(px / TILE_SIZE), math.floor(py / TILE_SIZE)
end

--- Convert tile indices to the lat/lng of the tile's NW corner.
--- @param tx number  Tile X index (0-based)
--- @param ty number  Tile Y index (0-based)
--- @param zoom number  Integer zoom level
--- @return number lat, number lng
function Geo.tileToLatlng(tx, ty, zoom)
  return Geo.pixelToLatlng(tx * TILE_SIZE, ty * TILE_SIZE, zoom)
end

--- Convert tile indices to the lat/lng bounds of the tile.
--- @param tx number  Tile X index
--- @param ty number  Tile Y index
--- @param zoom number  Integer zoom level
--- @return table  { swLat, swLng, neLat, neLng }
function Geo.tileBounds(tx, ty, zoom)
  local neLat, neLng = Geo.tileToLatlng(tx, ty, zoom)       -- NW corner = north edge
  local swLat, swLng = Geo.tileToLatlng(tx + 1, ty + 1, zoom) -- SE corner = south edge
  -- Note: tile Y increases downward (south), so NW is (tx, ty), SE is (tx+1, ty+1)
  -- Swap to get proper sw/ne ordering
  return { swLat = swLat, swLng = neLng, neLat = neLat, neLng = swLng }
end

--- Wrap tile X to valid range (world wraps horizontally).
--- @param tx number  Tile X index (may be negative or > tileCount)
--- @param zoom number  Integer zoom level
--- @return number  Wrapped tile X (0 to tileCount-1)
function Geo.wrapTileX(tx, zoom)
  local count = Geo.tileCount(zoom)
  return ((tx % count) + count) % count
end

-- ============================================================================
-- Distance & Bearing (Haversine)
-- ============================================================================

--- Calculate the great-circle distance between two points.
--- @param lat1 number  Start latitude in degrees
--- @param lng1 number  Start longitude in degrees
--- @param lat2 number  End latitude in degrees
--- @param lng2 number  End longitude in degrees
--- @return number  Distance in meters
function Geo.distance(lat1, lng1, lat2, lng2)
  local dLat = (lat2 - lat1) * RAD
  local dLng = (lng2 - lng1) * RAD
  local a = math.sin(dLat / 2) * math.sin(dLat / 2)
           + math.cos(lat1 * RAD) * math.cos(lat2 * RAD)
           * math.sin(dLng / 2) * math.sin(dLng / 2)
  local c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
  return EARTH_RADIUS * c
end

--- Calculate the initial bearing from point 1 to point 2.
--- @param lat1 number  Start latitude in degrees
--- @param lng1 number  Start longitude in degrees
--- @param lat2 number  End latitude in degrees
--- @param lng2 number  End longitude in degrees
--- @return number  Bearing in degrees (0-360, 0 = north, 90 = east)
function Geo.bearing(lat1, lng1, lat2, lng2)
  local dLng = (lng2 - lng1) * RAD
  local y = math.sin(dLng) * math.cos(lat2 * RAD)
  local x = math.cos(lat1 * RAD) * math.sin(lat2 * RAD)
           - math.sin(lat1 * RAD) * math.cos(lat2 * RAD) * math.cos(dLng)
  local brng = math.atan2(y, x) * DEG
  return (brng + 360) % 360
end

--- Calculate the destination point given a start, bearing, and distance.
--- @param lat number  Start latitude in degrees
--- @param lng number  Start longitude in degrees
--- @param bearing number  Bearing in degrees
--- @param dist number  Distance in meters
--- @return number lat2, number lng2  Destination coordinates
function Geo.destination(lat, lng, bearing, dist)
  local d = dist / EARTH_RADIUS  -- angular distance in radians
  local brng = bearing * RAD
  local lat1 = lat * RAD
  local lng1 = lng * RAD

  local sinLat1 = math.sin(lat1)
  local cosLat1 = math.cos(lat1)
  local sinD = math.sin(d)
  local cosD = math.cos(d)

  local lat2 = math.asin(sinLat1 * cosD + cosLat1 * sinD * math.cos(brng))
  local lng2 = lng1 + math.atan2(
    math.sin(brng) * sinD * cosLat1,
    cosD - sinLat1 * math.sin(lat2)
  )

  return lat2 * DEG, ((lng2 * DEG) + 540) % 360 - 180  -- normalize lng to [-180, 180]
end

-- ============================================================================
-- Bounds
-- ============================================================================

--- Create a bounds object.
--- @param swLat number  Southwest latitude
--- @param swLng number  Southwest longitude
--- @param neLat number  Northeast latitude
--- @param neLng number  Northeast longitude
--- @return table  Bounds { swLat, swLng, neLat, neLng }
function Geo.Bounds(swLat, swLng, neLat, neLng)
  return { swLat = swLat, swLng = swLng, neLat = neLat, neLng = neLng }
end

--- Check if a point is inside bounds.
--- @param bounds table  Bounds object
--- @param lat number  Latitude
--- @param lng number  Longitude
--- @return boolean
function Geo.boundsContains(bounds, lat, lng)
  return lat >= bounds.swLat and lat <= bounds.neLat
     and lng >= bounds.swLng and lng <= bounds.neLng
end

--- Check if two bounds intersect.
--- @param b1 table  First bounds
--- @param b2 table  Second bounds
--- @return boolean
function Geo.boundsIntersects(b1, b2)
  return not (b1.neLat < b2.swLat or b1.swLat > b2.neLat
           or b1.neLng < b2.swLng or b1.swLng > b2.neLng)
end

--- Compute the bounds that enclose a tile range.
--- @param tx1 number  Min tile X
--- @param ty1 number  Min tile Y
--- @param tx2 number  Max tile X (exclusive)
--- @param ty2 number  Max tile Y (exclusive)
--- @param zoom number  Zoom level
--- @return table  Bounds
function Geo.boundsFromTiles(tx1, ty1, tx2, ty2, zoom)
  local neLat, swLng = Geo.tileToLatlng(tx1, ty1, zoom)
  local swLat, neLng = Geo.tileToLatlng(tx2, ty2, zoom)
  return Geo.Bounds(swLat, swLng, neLat, neLng)
end

--- Expand bounds to include a point.
--- @param bounds table|nil  Existing bounds (nil to create new)
--- @param lat number  Latitude
--- @param lng number  Longitude
--- @return table  Updated bounds
function Geo.boundsExtend(bounds, lat, lng)
  if not bounds then
    return Geo.Bounds(lat, lng, lat, lng)
  end
  return Geo.Bounds(
    math.min(bounds.swLat, lat),
    math.min(bounds.swLng, lng),
    math.max(bounds.neLat, lat),
    math.max(bounds.neLng, lng)
  )
end

--- Get the center point of bounds.
--- @param bounds table  Bounds object
--- @return number lat, number lng
function Geo.boundsCenter(bounds)
  return (bounds.swLat + bounds.neLat) / 2,
         (bounds.swLng + bounds.neLng) / 2
end

-- ============================================================================
-- Visible Tile Range
-- ============================================================================

--- Compute the range of tiles visible in a viewport.
--- @param centerLat number  Center latitude
--- @param centerLng number  Center longitude
--- @param zoom number  Zoom level (integer for tile indices)
--- @param viewWidth number  Viewport width in pixels
--- @param viewHeight number  Viewport height in pixels
--- @return number minTx, number minTy, number maxTx, number maxTy
function Geo.visibleTiles(centerLat, centerLng, zoom, viewWidth, viewHeight)
  local intZoom = math.floor(zoom)
  local centerPx, centerPy = Geo.latlngToPixel(centerLat, centerLng, intZoom)

  -- Half viewport in pixels, with a 1-tile buffer for smooth scrolling
  local halfW = viewWidth / 2 + TILE_SIZE
  local halfH = viewHeight / 2 + TILE_SIZE

  local minTx = math.floor((centerPx - halfW) / TILE_SIZE)
  local maxTx = math.floor((centerPx + halfW) / TILE_SIZE)
  local minTy = math.floor((centerPy - halfH) / TILE_SIZE)
  local maxTy = math.floor((centerPy + halfH) / TILE_SIZE)

  -- Clamp Y to valid range (no wrapping vertically)
  local tileCount = Geo.tileCount(intZoom)
  minTy = math.max(0, minTy)
  maxTy = math.min(tileCount - 1, maxTy)

  return minTx, minTy, maxTx, maxTy
end

-- ============================================================================
-- Meters-per-pixel (for scale bars, distance overlays)
-- ============================================================================

--- Calculate meters per pixel at a given latitude and zoom.
--- @param lat number  Latitude in degrees
--- @param zoom number  Zoom level
--- @return number  Meters per pixel
function Geo.metersPerPixel(lat, zoom)
  return math.cos(lat * RAD) * 2 * PI * EARTH_RADIUS / Geo.worldSize(zoom)
end

-- ============================================================================
-- Pluggable Projections (for game worlds / custom coordinate systems)
-- ============================================================================

local customProjections = {}

--- Register a custom projection for game/fictional worlds.
--- @param name string  Projection name (e.g. "my-game-world")
--- @param toPixel function(x, y, zoom) → px, py
--- @param fromPixel function(px, py, zoom) → x, y
function Geo.registerProjection(name, toPixel, fromPixel)
  customProjections[name] = { toPixel = toPixel, fromPixel = fromPixel }
end

--- Project coordinates to pixels using a named projection.
--- Falls back to Web Mercator if name is "mercator" or unknown.
--- @param name string  Projection name
--- @param x number  X coordinate (or latitude for mercator)
--- @param y number  Y coordinate (or longitude for mercator)
--- @param zoom number  Zoom level
--- @return number px, number py
function Geo.project(name, x, y, zoom)
  local proj = customProjections[name]
  if proj then
    return proj.toPixel(x, y, zoom)
  end
  -- Default: Web Mercator
  return Geo.latlngToPixel(x, y, zoom)
end

--- Unproject pixels to coordinates using a named projection.
--- @param name string  Projection name
--- @param px number  Pixel X
--- @param py number  Pixel Y
--- @param zoom number  Zoom level
--- @return number x, number y
function Geo.unproject(name, px, py, zoom)
  local proj = customProjections[name]
  if proj then
    return proj.fromPixel(px, py, zoom)
  end
  -- Default: Web Mercator
  return Geo.pixelToLatlng(px, py, zoom)
end

--- Register a simple linear projection (game worlds with pixel-based coordinates).
--- @param name string  Projection name
--- @param worldWidth number  World width in game units
--- @param worldHeight number  World height in game units
function Geo.registerLinearProjection(name, worldWidth, worldHeight)
  Geo.registerProjection(name,
    function(x, y, zoom)
      local scale = math.pow(2, zoom)
      return x * scale, y * scale
    end,
    function(px, py, zoom)
      local scale = math.pow(2, zoom)
      return px / scale, py / scale
    end
  )
end

-- ============================================================================
-- Local 3D coordinate conversion (lat/lng → meters from center)
-- ============================================================================

--- Convert a lat/lng to local XY coordinates in meters relative to a center point.
--- Uses equirectangular approximation (accurate within ~50km of center).
--- X = east, Y = north. Suitable for 3D scene coordinates.
--- @param lat number  Point latitude
--- @param lng number  Point longitude
--- @param centerLat number  Center latitude (origin)
--- @param centerLng number  Center longitude (origin)
--- @return number x, number y  Meters east and north from center
function Geo.latlngToLocal(lat, lng, centerLat, centerLng)
  local cosLat = math.cos(centerLat * RAD)
  local x = (lng - centerLng) * RAD * EARTH_RADIUS * cosLat
  local y = (lat - centerLat) * RAD * EARTH_RADIUS
  return x, y
end

--- Convert local XY meters back to lat/lng.
--- @param x number  Meters east from center
--- @param y number  Meters north from center
--- @param centerLat number  Center latitude (origin)
--- @param centerLng number  Center longitude (origin)
--- @return number lat, number lng
function Geo.localToLatlng(x, y, centerLat, centerLng)
  local cosLat = math.cos(centerLat * RAD)
  local lng = centerLng + (x / (EARTH_RADIUS * cosLat)) * DEG
  local lat = centerLat + (y / EARTH_RADIUS) * DEG
  return lat, lng
end

return Geo
