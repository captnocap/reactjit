--[[
  terrain3d.lua -- Heightmap terrain mesh generation for GeoScene3D

  Converts elevation tile ImageData (Mapbox Terrain-RGB encoding) into
  g3d mesh vertex data. Each tile becomes a grid mesh with vertices at
  decoded elevations, UV-mapped for satellite/map imagery overlay.

  Terrain-RGB decoding:
    height = -10000 + ((R*256*256 + G*256 + B) * 0.1)
  where R, G, B are 0-255 integer channel values.

  Usage:
    local Terrain = require("lua.terrain3d")
    local verts = Terrain.generateMesh(elevationImageData, {
      originX = 0, originY = 0,    -- local 3D position of tile SW corner
      tileWidth = 600,              -- tile width in meters
      tileHeight = 600,             -- tile height in meters
      resolution = 32,              -- grid divisions per axis
      heightScale = 1,              -- vertical exaggeration
    })
]]

local Terrain = {}

-- ============================================================================
-- Terrain-RGB height decoding
-- ============================================================================

--- Decode a Mapbox Terrain-RGB pixel to height in meters.
--- @param r number  Red channel (0-1 float from Love2D)
--- @param g number  Green channel (0-1 float from Love2D)
--- @param b number  Blue channel (0-1 float from Love2D)
--- @return number  Height in meters
function Terrain.decodeHeight(r, g, b)
  local R = math.floor(r * 255 + 0.5)
  local G = math.floor(g * 255 + 0.5)
  local B = math.floor(b * 255 + 0.5)
  return -10000 + (R * 256 * 256 + G * 256 + B) * 0.1
end

-- ============================================================================
-- Height grid extraction
-- ============================================================================

--- Extract a 2D height grid from elevation ImageData.
--- @param imageData love.ImageData  Terrain-RGB encoded tile
--- @param resolution number  Grid size (e.g. 32 means 33x33 samples)
--- @param heightScale number  Vertical exaggeration (1.0 = real meters)
--- @return table  2D array [row][col] of height values in meters
function Terrain.extractHeightGrid(imageData, resolution, heightScale)
  heightScale = heightScale or 1
  resolution = resolution or 32
  local w = imageData:getWidth()
  local h = imageData:getHeight()
  local grid = {}

  for row = 0, resolution do
    grid[row] = {}
    local py = math.min(math.floor(row / resolution * (h - 1)), h - 1)
    for col = 0, resolution do
      local px = math.min(math.floor(col / resolution * (w - 1)), w - 1)
      local r, g, b = imageData:getPixel(px, py)
      grid[row][col] = Terrain.decodeHeight(r, g, b) * heightScale
    end
  end

  return grid
end

-- ============================================================================
-- Mesh generation
-- ============================================================================

--- Generate terrain mesh vertices from a height grid.
--- Returns vertex data suitable for g3d.newModel().
--- Each vertex: {x, y, z, u, v, nx, ny, nz}
---
--- @param heightGrid table  2D height array from extractHeightGrid
--- @param opts table  {
---   originX, originY: local 3D position of tile corner (meters)
---   tileWidth, tileHeight: tile size in meters
---   resolution: grid divisions (must match heightGrid)
--- }
--- @return table  Flat array of vertex tables for g3d
function Terrain.generateMesh(heightGrid, opts)
  local ox = opts.originX or 0
  local oy = opts.originY or 0
  local tw = opts.tileWidth or 600
  local th = opts.tileHeight or 600
  local res = opts.resolution or 32

  local verts = {}

  -- Helper to get position at grid (row, col)
  local function getPos(row, col)
    local u = col / res
    local v = row / res
    local x = ox + u * tw
    local y = oy + (1 - v) * th  -- flip V so row 0 = north = +Y
    local z = heightGrid[row][col] or 0
    return x, y, z, u, v
  end

  -- Helper to compute face normal from 3 points
  local function faceNormal(x1,y1,z1, x2,y2,z2, x3,y3,z3)
    local ax, ay, az = x2-x1, y2-y1, z2-z1
    local bx, by, bz = x3-x1, y3-y1, z3-z1
    local nx = ay*bz - az*by
    local ny = az*bx - ax*bz
    local nz = ax*by - ay*bx
    local len = math.sqrt(nx*nx + ny*ny + nz*nz)
    if len > 0.0001 then
      return nx/len, ny/len, nz/len
    end
    return 0, 0, 1
  end

  for row = 0, res - 1 do
    for col = 0, res - 1 do
      -- Quad corners
      local x0,y0,z0, u0,v0 = getPos(row, col)
      local x1,y1,z1, u1,v1 = getPos(row, col+1)
      local x2,y2,z2, u2,v2 = getPos(row+1, col+1)
      local x3,y3,z3, u3,v3 = getPos(row+1, col)

      -- Triangle 1: (0, 1, 2)
      local nx1, ny1, nz1 = faceNormal(x0,y0,z0, x1,y1,z1, x2,y2,z2)
      verts[#verts+1] = {x0, y0, z0, u0, v0, nx1, ny1, nz1}
      verts[#verts+1] = {x1, y1, z1, u1, v1, nx1, ny1, nz1}
      verts[#verts+1] = {x2, y2, z2, u2, v2, nx1, ny1, nz1}

      -- Triangle 2: (0, 2, 3)
      local nx2, ny2, nz2 = faceNormal(x0,y0,z0, x2,y2,z2, x3,y3,z3)
      verts[#verts+1] = {x0, y0, z0, u0, v0, nx2, ny2, nz2}
      verts[#verts+1] = {x2, y2, z2, u2, v2, nx2, ny2, nz2}
      verts[#verts+1] = {x3, y3, z3, u3, v3, nx2, ny2, nz2}
    end
  end

  return verts
end

-- ============================================================================
-- Building extrusion from GeoJSON
-- ============================================================================

--- Extrude a 2D polygon into a 3D building mesh.
--- Takes polygon vertices in local 3D coords (already converted from lat/lng)
--- and extrudes them to the given height.
--- @param vertices table  Array of {x, y} pairs (local meters, closed polygon)
--- @param baseZ number  Ground height
--- @param topZ number  Building top height
--- @param color table|nil  {r,g,b} 0-1 (used for vertex color or ignored)
--- @return table  Flat vertex array for g3d
function Terrain.extrudeBuilding(vertices, baseZ, topZ, color)
  local verts = {}
  local n = #vertices

  -- Ensure closed polygon
  if vertices[1][1] ~= vertices[n][1] or vertices[1][2] ~= vertices[n][2] then
    vertices[n+1] = {vertices[1][1], vertices[1][2]}
    n = n + 1
  end

  -- Side walls
  for i = 1, n - 1 do
    local x0, y0 = vertices[i][1], vertices[i][2]
    local x1, y1 = vertices[i+1][1], vertices[i+1][2]

    -- Wall normal (outward facing, assumes CCW polygon)
    local dx, dy = x1 - x0, y1 - y0
    local len = math.sqrt(dx*dx + dy*dy)
    local nx, ny = 0, 0
    if len > 0.001 then
      nx, ny = -dy/len, dx/len
    end

    -- Two triangles per wall segment
    -- Bottom-left, Bottom-right, Top-right
    verts[#verts+1] = {x0, y0, baseZ, 0, 0, nx, ny, 0}
    verts[#verts+1] = {x1, y1, baseZ, 1, 0, nx, ny, 0}
    verts[#verts+1] = {x1, y1, topZ,  1, 1, nx, ny, 0}

    -- Bottom-left, Top-right, Top-left
    verts[#verts+1] = {x0, y0, baseZ, 0, 0, nx, ny, 0}
    verts[#verts+1] = {x1, y1, topZ,  1, 1, nx, ny, 0}
    verts[#verts+1] = {x0, y0, topZ,  0, 1, nx, ny, 0}
  end

  -- Top face (simple fan triangulation from first vertex)
  for i = 2, n - 2 do
    verts[#verts+1] = {vertices[1][1], vertices[1][2], topZ, 0, 0, 0, 0, 1}
    verts[#verts+1] = {vertices[i][1], vertices[i][2], topZ, 0, 0, 0, 0, 1}
    verts[#verts+1] = {vertices[i+1][1], vertices[i+1][2], topZ, 0, 0, 0, 0, 1}
  end

  return verts
end

-- ============================================================================
-- Road ribbon generation
-- ============================================================================

--- Generate a flat ribbon mesh following a polyline on the terrain.
--- @param points table  Array of {x, y, z} in local coords
--- @param width number  Ribbon half-width in meters
--- @return table  Flat vertex array for g3d
function Terrain.generateRibbon(points, width)
  local verts = {}
  local n = #points
  if n < 2 then return verts end

  width = width or 2

  -- For each segment, compute perpendicular and extrude
  for i = 1, n - 1 do
    local p0 = points[i]
    local p1 = points[i+1]

    local dx = p1[1] - p0[1]
    local dy = p1[2] - p0[2]
    local len = math.sqrt(dx*dx + dy*dy)
    if len < 0.001 then len = 0.001 end

    -- Perpendicular (in XY plane)
    local px, py = -dy/len * width, dx/len * width

    local z0 = (p0[3] or 0) + 0.1  -- slight offset above terrain
    local z1 = (p1[3] or 0) + 0.1

    local u0 = 0
    local u1 = len / (width * 2)

    -- Two triangles per segment
    verts[#verts+1] = {p0[1]-px, p0[2]-py, z0, 0, u0, 0, 0, 1}
    verts[#verts+1] = {p0[1]+px, p0[2]+py, z0, 1, u0, 0, 0, 1}
    verts[#verts+1] = {p1[1]+px, p1[2]+py, z1, 1, u1, 0, 0, 1}

    verts[#verts+1] = {p0[1]-px, p0[2]-py, z0, 0, u0, 0, 0, 1}
    verts[#verts+1] = {p1[1]+px, p1[2]+py, z1, 1, u1, 0, 0, 1}
    verts[#verts+1] = {p1[1]-px, p1[2]-py, z1, 0, u1, 0, 0, 1}
  end

  return verts
end

--- Sample height from a height grid at a given local (x, y) position.
--- @param heightGrid table  2D height array
--- @param x number  Local X (meters from origin)
--- @param y number  Local Y (meters from origin)
--- @param originX number  Grid origin X
--- @param originY number  Grid origin Y
--- @param tileWidth number  Grid width in meters
--- @param tileHeight number  Grid height in meters
--- @param resolution number  Grid resolution
--- @return number  Interpolated height at position
function Terrain.sampleHeight(heightGrid, x, y, originX, originY, tileWidth, tileHeight, resolution)
  if not heightGrid then return 0 end

  local u = (x - originX) / tileWidth
  local v = 1 - (y - originY) / tileHeight  -- flip back from 3D Y to grid row

  if u < 0 or u > 1 or v < 0 or v > 1 then return 0 end

  local col = u * resolution
  local row = v * resolution

  local c0 = math.floor(col)
  local r0 = math.floor(row)
  local c1 = math.min(c0 + 1, resolution)
  local r1 = math.min(r0 + 1, resolution)

  local fc = col - c0
  local fr = row - r0

  -- Bilinear interpolation
  local h00 = heightGrid[r0] and heightGrid[r0][c0] or 0
  local h10 = heightGrid[r0] and heightGrid[r0][c1] or 0
  local h01 = heightGrid[r1] and heightGrid[r1][c0] or 0
  local h11 = heightGrid[r1] and heightGrid[r1][c1] or 0

  local h0 = h00 + (h10 - h00) * fc
  local h1 = h01 + (h11 - h01) * fc
  return h0 + (h1 - h0) * fr
end

return Terrain
