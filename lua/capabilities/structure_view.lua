--[[
  capabilities/structure_view.lua — 2D/3D molecular structure renderer

  2D: Skeletal formula from SMILES via Indigo FFI + Love2D line/circle drawing.
  3D: Ball-and-stick model — atom spheres + bond cylinders via g3d.
  Right-click toggles between 2D and 3D. Mode broadcast via latch.

  React usage:
    <StructureView smiles="CCO" />
    <StructureView smiles="c1ccccc1" showLabels view3d />
    <StructureView smiles="CC(=O)O" showHydrogens={false} />

  Props:
    smiles         string   SMILES notation
    showLabels     boolean  Show element labels on heteroatoms (default: true)
    showHydrogens  boolean  Show explicit H atoms (default: false)
    bondColor      string   Bond line color hex (default: "#aaaaaa")
    atomScale      number   Atom circle scale factor (default: 1.0)
    view3d         boolean  Start in 3D mode (default: false)

  Requires: libindigo (apt install libindigo0d libindigo-dev)
]]

local Capabilities = require("lua.capabilities")
local Indigo = require("lua.indigo")
local cap3d = require("lua.cap3d")
local Latches = require("lua.latches")

-- ============================================================================
-- CPK colors for common elements (R, G, B)
-- ============================================================================

local CPK = {
  H  = {1.00, 1.00, 1.00},
  C  = {0.45, 0.45, 0.45},
  N  = {0.19, 0.31, 0.97},
  O  = {1.00, 0.05, 0.05},
  F  = {0.56, 0.88, 0.31},
  Cl = {0.12, 0.94, 0.12},
  Br = {0.65, 0.16, 0.16},
  I  = {0.58, 0.00, 0.58},
  S  = {1.00, 1.00, 0.19},
  P  = {1.00, 0.50, 0.00},
  B  = {1.00, 0.71, 0.71},
  Si = {0.94, 0.78, 0.63},
  Fe = {0.88, 0.40, 0.20},
  Na = {0.67, 0.36, 0.95},
  K  = {0.56, 0.25, 0.83},
  Ca = {0.24, 1.00, 0.00},
  Mg = {0.54, 1.00, 0.00},
  Zn = {0.49, 0.50, 0.69},
  Cu = {0.78, 0.50, 0.20},
}
local CPK_DEFAULT = {0.75, 0.00, 0.75}

local function getAtomColor(symbol)
  return CPK[symbol] or CPK_DEFAULT
end

-- ============================================================================
-- Helpers
-- ============================================================================

local function hexToRgb(hex)
  if not hex or type(hex) ~= "string" then return 0.67, 0.67, 0.67 end
  hex = hex:gsub("#", "")
  if #hex ~= 6 then return 0.67, 0.67, 0.67 end
  return tonumber(hex:sub(1,2), 16) / 255,
         tonumber(hex:sub(3,4), 16) / 255,
         tonumber(hex:sub(5,6), 16) / 255
end

-- ============================================================================
-- 3D model lifecycle
-- ============================================================================

local function releaseModels3D(state)
  if state.atomModel3D then state.atomModel3D.mesh:release(); state.atomModel3D = nil end
  if state.bondModel3D then state.bondModel3D.mesh:release(); state.bondModel3D = nil end
end

local function buildModels3D(state)
  local g = cap3d.getG3D()
  local geom = state.geometry
  if not g or not geom or not geom.atoms then return end

  releaseModels3D(state)

  local atoms = geom.atoms
  local bonds = geom.bonds

  -- Bounding box
  local minX, minY, maxX, maxY = math.huge, math.huge, -math.huge, -math.huge
  local atomCount = 0
  for _, a in pairs(atoms) do
    if a.x < minX then minX = a.x end
    if a.y < minY then minY = a.y end
    if a.x > maxX then maxX = a.x end
    if a.y > maxY then maxY = a.y end
    atomCount = atomCount + 1
  end
  if atomCount == 0 then return end

  local rangeX = math.max(maxX - minX, 0.001)
  local rangeY = math.max(maxY - minY, 0.001)
  local scale = 3.0 / math.max(rangeX, rangeY)
  scale = math.min(scale, 2.0)
  local centerX = (minX + maxX) / 2
  local centerY = (minY + maxY) / 2

  -- Unit sphere for stamping
  local unitSphere = cap3d.sphere(1.0, 10, 8)

  -- Combined atom mesh (per-vertex colors)
  local allAtomVerts = {}
  local atomR = 0.15

  for _, atom in pairs(atoms) do
    local ax = (atom.x - centerX) * scale
    local ay = (atom.y - centerY) * scale
    local col = getAtomColor(atom.symbol)
    local isCarbon = (atom.symbol == "C")
    local r = isCarbon and atomR * 0.5 or atomR

    for _, v in ipairs(unitSphere) do
      allAtomVerts[#allAtomVerts + 1] = {
        v[1] * r + ax, v[2] * r + ay, v[3] * r,
        v[4], v[5], v[6], v[7], v[8],
        col[1], col[2], col[3], 1,
      }
    end
  end

  if #allAtomVerts > 0 then
    state.atomModel3D = g.newModel(allAtomVerts, cap3d.rgbTexture(1, 1, 1))
  end

  -- Combined bond mesh (grey)
  local allBondVerts = {}
  local bondR = 0.04

  for _, bond in ipairs(bonds) do
    local a1 = atoms[bond.source]
    local a2 = atoms[bond.dest]
    if a1 and a2 then
      local p1 = { (a1.x - centerX) * scale, (a1.y - centerY) * scale, 0 }
      local p2 = { (a2.x - centerX) * scale, (a2.y - centerY) * scale, 0 }
      local bondVerts = cap3d.bond(p1, p2, bondR, 6)
      for _, v in ipairs(bondVerts) do
        allBondVerts[#allBondVerts + 1] = {
          v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8],
          0.55, 0.55, 0.55, 1,
        }
      end
    end
  end

  if #allBondVerts > 0 then
    state.bondModel3D = g.newModel(allBondVerts, cap3d.rgbTexture(1, 1, 1))
  end
end

local function syncGeometryFromProps(state, props)
  local smiles = props.smiles or ""
  local showH = props.showHydrogens or false

  if smiles ~= state.prevSmiles or showH ~= state.prevShowH then
    state.prevSmiles = smiles
    state.prevShowH = showH

    if smiles ~= "" and Indigo.available then
      local geom, err = Indigo.parseAndExtract(smiles, not showH)
      state.geometry = geom
      state.error = err
    else
      state.geometry = nil
      state.error = not Indigo.available and "libindigo not available" or nil
    end

    if state.view3d and state.geometry then
      buildModels3D(state)
    else
      releaseModels3D(state)
    end
  end
end

-- ============================================================================
-- 3D render path
-- ============================================================================

local function render3D(node, c, opacity, state)
  local x, y, w, h = c.x, c.y, c.w, c.h

  cap3d.renderTo(node.id, w, h, { 0.04, 0.04, 0.07, 1 }, function(g3d)
    cap3d.applyOrbitCamera(state, 4.0)

    local lightOpts = {
      lightDir = { 1, -0.5, 0.7 },
      lightColor = { 0.85, 0.85, 0.8 },
      ambientColor = { 0.18, 0.18, 0.22 },
      camPos = g3d.camera.position,
    }

    -- Bonds first (behind atoms)
    if state.bondModel3D then
      cap3d.drawLit(state.bondModel3D, lightOpts)
    end

    -- Atoms
    if state.atomModel3D then
      cap3d.drawLit(state.atomModel3D, {
        lightDir = lightOpts.lightDir,
        lightColor = lightOpts.lightColor,
        ambientColor = lightOpts.ambientColor,
        camPos = lightOpts.camPos,
        specular = 48,
      })
    end
  end)

  -- Composite canvas
  local canvas = cap3d.getCanvas(node.id)
  if canvas then
    love.graphics.setColor(1, 1, 1, opacity)
    love.graphics.draw(canvas, x, y)
  end

  -- Formula label overlay
  local geom = state.geometry
  if geom and geom.formula and geom.formula ~= "" then
    local font = love.graphics.getFont()
    love.graphics.setColor(0.6, 0.6, 0.6, 0.5 * opacity)
    local fw = font:getWidth(geom.formula)
    love.graphics.print(geom.formula, x + (w - fw) / 2, y + h - 14)
  end
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("StructureView", {
  visual = true,

  schema = {
    smiles        = { type = "string", default = "",        desc = "SMILES notation" },
    showLabels    = { type = "bool",   default = true,      desc = "Show element labels on heteroatoms" },
    showHydrogens = { type = "bool",   default = false,     desc = "Show explicit hydrogen atoms" },
    bondColor     = { type = "string", default = "#aaaaaa", desc = "Bond line color (hex)" },
    atomScale     = { type = "number", default = 1.0,       desc = "Atom circle scale factor" },
    view3d        = { type = "bool",   default = false,     desc = "Start in 3D mode (right-click toggles)" },
  },

  events = {},

  create = function(nodeId, props)
    local state = {
      geometry = nil,
      prevSmiles = nil,
      prevShowH = nil,
      error = nil,
      -- 3D state
      view3d = props.view3d or false,
      orbitRotX = 0.4,
      orbitRotY = 0.3,
      orbitPrevMX = nil,
      orbitPrevMY = nil,
      screenRect = nil,
      togglePrev = false,
      atomModel3D = nil,
      bondModel3D = nil,
    }
    syncGeometryFromProps(state, props)
    return state
  end,

  update = function(nodeId, props, prev, state)
    syncGeometryFromProps(state, props)

    -- Sync view3d from prop
    if props.view3d ~= nil and (props.view3d and true or false) ~= state.view3d then
      state.view3d = props.view3d and true or false
      if state.view3d and state.geometry then
        buildModels3D(state)
      elseif not state.view3d then
        releaseModels3D(state)
      end
    end
  end,

  destroy = function(nodeId, state)
    releaseModels3D(state)
    cap3d.releaseCanvas(nodeId)
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Right-click toggle
    if cap3d.checkToggle(state) then
      if state.view3d and state.geometry then
        buildModels3D(state)
      elseif not state.view3d then
        releaseModels3D(state)
      end
    end

    -- Orbit controls (3D mode only)
    if state.view3d then
      cap3d.updateOrbit(state)
    end

    -- Broadcast mode via latch
    Latches.set("structureview:" .. nodeId .. ":view3d", state.view3d and 1 or 0)
  end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    state.screenRect = { x = c.x, y = c.y, w = c.w, h = c.h }

    local props = node.props or {}

    -- Error state
    if state.error then
      love.graphics.setColor(0.8, 0.3, 0.3, opacity)
      local font = love.graphics.getFont()
      local msg = "Error: " .. tostring(state.error)
      local tw = font:getWidth(msg)
      love.graphics.print(msg, c.x + (c.w - tw) / 2, c.y + c.h / 2 - 6)
      return
    end

    -- 3D branch
    if state.view3d and (state.atomModel3D or state.bondModel3D) then
      render3D(node, c, opacity, state)
      return
    end

    -- ══════════════════════════════════════════════════════════════
    -- 2D render (original, unchanged)
    -- ══════════════════════════════════════════════════════════════

    local x, y, w, h = c.x, c.y, c.w, c.h
    local geom = state.geometry
    if not geom or not geom.atoms then return end

    local atoms = geom.atoms
    local bonds = geom.bonds

    local minX, minY, maxX, maxY = math.huge, math.huge, -math.huge, -math.huge
    local atomCount = 0
    for _, a in pairs(atoms) do
      if a.x < minX then minX = a.x end
      if a.y < minY then minY = a.y end
      if a.x > maxX then maxX = a.x end
      if a.y > maxY then maxY = a.y end
      atomCount = atomCount + 1
    end
    if atomCount == 0 then return end

    -- Single atom
    if atomCount == 1 then
      local a
      for _, at in pairs(atoms) do a = at; break end
      if a then
        local col = getAtomColor(a.symbol)
        local cx, cy = x + w / 2, y + h / 2
        love.graphics.setColor(col[1], col[2], col[3], opacity)
        love.graphics.circle("fill", cx, cy, 12 * (props.atomScale or 1))
        if props.showLabels ~= false then
          love.graphics.setColor(1, 1, 1, opacity)
          local font = love.graphics.getFont()
          local tw = font:getWidth(a.symbol)
          love.graphics.print(a.symbol, cx - tw / 2, cy - 6)
        end
      end
      return
    end

    local rangeX = maxX - minX
    local rangeY = maxY - minY
    if rangeX < 0.001 then rangeX = 1 end
    if rangeY < 0.001 then rangeY = 1 end

    local padding = 24
    local availW = w - padding * 2
    local availH = h - padding * 2
    local scale = math.min(availW / math.max(0.001, rangeX), availH / math.max(0.001, rangeY))
    scale = math.min(scale, 40)

    local centerX = (minX + maxX) / 2
    local centerY = (minY + maxY) / 2
    local offsetX = x + w / 2
    local offsetY = y + h / 2

    local function toScreen(mx, my)
      return offsetX + (mx - centerX) * scale,
             offsetY + (my - centerY) * scale
    end

    local br, bg, bb = hexToRgb(props.bondColor)

    -- Draw bonds
    love.graphics.setLineWidth(2)
    for _, bond in ipairs(bonds) do
      local a1 = atoms[bond.source]
      local a2 = atoms[bond.dest]
      if a1 and a2 then
        local x1, y1 = toScreen(a1.x, a1.y)
        local x2, y2 = toScreen(a2.x, a2.y)
        local order = bond.order or 1

        if order == 1 then
          love.graphics.setColor(br, bg, bb, opacity)
          love.graphics.line(x1, y1, x2, y2)
        elseif order == 2 then
          local dx, dy = x2 - x1, y2 - y1
          local len = math.sqrt(dx * dx + dy * dy)
          if len > 0 then
            local nx, ny = -dy / len * 3, dx / len * 3
            love.graphics.setColor(br, bg, bb, opacity)
            love.graphics.line(x1 + nx, y1 + ny, x2 + nx, y2 + ny)
            love.graphics.line(x1 - nx, y1 - ny, x2 - nx, y2 - ny)
          end
        elseif order == 3 then
          local dx, dy = x2 - x1, y2 - y1
          local len = math.sqrt(dx * dx + dy * dy)
          if len > 0 then
            local nx, ny = -dy / len * 3.5, dx / len * 3.5
            love.graphics.setColor(br, bg, bb, opacity)
            love.graphics.line(x1, y1, x2, y2)
            love.graphics.line(x1 + nx, y1 + ny, x2 + nx, y2 + ny)
            love.graphics.line(x1 - nx, y1 - ny, x2 - nx, y2 - ny)
          end
        elseif order == 4 then
          local dx, dy = x2 - x1, y2 - y1
          local len = math.sqrt(dx * dx + dy * dy)
          if len > 0 then
            local nx, ny = -dy / len * 3, dx / len * 3
            love.graphics.setColor(br, bg, bb, opacity)
            love.graphics.line(x1 + nx, y1 + ny, x2 + nx, y2 + ny)
            love.graphics.setColor(br, bg, bb, 0.5 * opacity)
            local segments = 5
            for s = 0, segments - 1, 2 do
              local t1 = s / segments
              local t2 = (s + 1) / segments
              local sx1 = x1 - nx + (x2 - x1 - nx * 0 + nx * 0) * t1
              local sy1 = y1 - ny + (y2 - y1) * t1
              local sx2 = x1 - nx + (x2 - x1) * t2
              local sy2 = y1 - ny + (y2 - y1) * t2
              love.graphics.line(sx1, sy1, sx2, sy2)
            end
          end
        end
      end
    end

    -- Draw atoms
    local atomR = 4 * (props.atomScale or 1)
    local showLabels = props.showLabels ~= false
    local font = love.graphics.getFont()

    for _, atom in pairs(atoms) do
      local sx, sy = toScreen(atom.x, atom.y)
      local col = getAtomColor(atom.symbol)
      local isCarbon = (atom.symbol == "C")

      if isCarbon then
        love.graphics.setColor(col[1], col[2], col[3], 0.4 * opacity)
        love.graphics.circle("fill", sx, sy, atomR * 0.5)
      else
        love.graphics.setColor(0.08, 0.08, 0.12, 0.9 * opacity)
        love.graphics.circle("fill", sx, sy, atomR * 2)
        love.graphics.setColor(col[1], col[2], col[3], opacity)
        love.graphics.circle("fill", sx, sy, atomR * 1.5)

        if showLabels then
          love.graphics.setColor(1, 1, 1, opacity)
          local tw = font:getWidth(atom.symbol)
          local th = font:getHeight()
          love.graphics.print(atom.symbol, sx - tw / 2, sy - th / 2)
        end
      end
    end

    -- Formula label
    if geom.formula and geom.formula ~= "" then
      love.graphics.setColor(0.6, 0.6, 0.6, 0.5 * opacity)
      local fw = font:getWidth(geom.formula)
      love.graphics.print(geom.formula, x + (w - fw) / 2, y + h - 14)
    end
  end,
})
