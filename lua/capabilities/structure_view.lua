--[[
  capabilities/structure_view.lua — 2D molecular structure renderer

  Renders 2D structural formulas from SMILES strings using the Indigo
  cheminformatics library (FFI) for parsing and coordinate generation,
  and Love2D for rendering. All computation in Lua — zero frame delay.

  React usage:
    <StructureView smiles="CCO" />
    <StructureView smiles="c1ccccc1" showLabels />
    <StructureView smiles="CC(=O)O" showHydrogens={false} />

  Props:
    smiles         string   SMILES notation
    showLabels     boolean  Show element labels on heteroatoms (default: true)
    showHydrogens  boolean  Show explicit H atoms (default: false)
    bondColor      string   Bond line color hex (default: "#aaaaaa")
    atomScale      number   Atom circle scale factor (default: 1.0)

  Requires: libindigo (apt install libindigo0d libindigo-dev)
]]

local Capabilities = require("lua.capabilities")
local Indigo = require("lua.indigo")

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
-- Capability registration
-- ============================================================================

Capabilities.register("StructureView", {
  visual = true,

  schema = {
    smiles        = { type = "string", default = "",       desc = "SMILES notation" },
    showLabels    = { type = "bool",   default = true,     desc = "Show element labels on heteroatoms" },
    showHydrogens = { type = "bool",   default = false,    desc = "Show explicit hydrogen atoms" },
    bondColor     = { type = "string", default = "#aaaaaa", desc = "Bond line color (hex)" },
    atomScale     = { type = "number", default = 1.0,      desc = "Atom circle scale factor" },
  },

  events = {},

  create = function(nodeId, props)
    return {
      geometry = nil,
      prevSmiles = nil,
      prevShowH = nil,
      error = nil,
    }
  end,

  update = function(nodeId, props, prev, state)
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
    end
  end,

  destroy = function(nodeId, state) end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Static rendering — no animation needed
  end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    local x, y, w, h = c.x, c.y, c.w, c.h
    local props = node.props or {}

    -- Error state
    if state.error then
      love.graphics.setColor(0.8, 0.3, 0.3, opacity)
      local font = love.graphics.getFont()
      local msg = "Error: " .. tostring(state.error)
      local tw = font:getWidth(msg)
      love.graphics.print(msg, x + (w - tw) / 2, y + h / 2 - 6)
      return
    end

    local geom = state.geometry
    if not geom or not geom.atoms then return end

    local atoms = geom.atoms
    local bonds = geom.bonds

    -- Find bounding box of atom coordinates
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

    -- Single atom case
    if atomCount == 1 then
      local a = next(atoms) and atoms[next(atoms)] or nil
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

    -- Scale and center the molecule in the rendering area
    local rangeX = maxX - minX
    local rangeY = maxY - minY
    if rangeX < 0.001 then rangeX = 1 end
    if rangeY < 0.001 then rangeY = 1 end

    local padding = 24
    local availW = w - padding * 2
    local availH = h - padding * 2
    local scale = math.min(availW / math.max(0.001, rangeX), availH / math.max(0.001, rangeY))
    scale = math.min(scale, 40) -- cap scale for very small molecules

    local centerX = (minX + maxX) / 2
    local centerY = (minY + maxY) / 2
    local offsetX = x + w / 2
    local offsetY = y + h / 2

    -- Transform function: molecule coords → screen coords
    local function toScreen(mx, my)
      return offsetX + (mx - centerX) * scale,
             offsetY + (my - centerY) * scale
    end

    -- Bond color
    local br, bg, bb = hexToRgb(props.bondColor)

    -- ── Draw bonds ──────────────────────────────────────────────────

    love.graphics.setLineWidth(2)
    for _, bond in ipairs(bonds) do
      local a1 = atoms[bond.source]
      local a2 = atoms[bond.dest]
      if a1 and a2 then
        local x1, y1 = toScreen(a1.x, a1.y)
        local x2, y2 = toScreen(a2.x, a2.y)

        local order = bond.order or 1

        if order == 1 then
          -- Single bond
          love.graphics.setColor(br, bg, bb, opacity)
          love.graphics.line(x1, y1, x2, y2)

        elseif order == 2 then
          -- Double bond: two parallel lines
          local dx, dy = x2 - x1, y2 - y1
          local len = math.sqrt(dx * dx + dy * dy)
          if len > 0 then
            local nx, ny = -dy / len * 3, dx / len * 3
            love.graphics.setColor(br, bg, bb, opacity)
            love.graphics.line(x1 + nx, y1 + ny, x2 + nx, y2 + ny)
            love.graphics.line(x1 - nx, y1 - ny, x2 - nx, y2 - ny)
          end

        elseif order == 3 then
          -- Triple bond: three parallel lines
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
          -- Aromatic bond: solid + dashed
          local dx, dy = x2 - x1, y2 - y1
          local len = math.sqrt(dx * dx + dy * dy)
          if len > 0 then
            local nx, ny = -dy / len * 3, dx / len * 3
            love.graphics.setColor(br, bg, bb, opacity)
            love.graphics.line(x1 + nx, y1 + ny, x2 + nx, y2 + ny)
            -- Dashed inner line
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

    -- ── Draw atoms ──────────────────────────────────────────────────

    local atomR = 4 * (props.atomScale or 1)
    local showLabels = props.showLabels ~= false
    local font = love.graphics.getFont()

    for _, atom in pairs(atoms) do
      local sx, sy = toScreen(atom.x, atom.y)
      local col = getAtomColor(atom.symbol)
      local isCarbon = (atom.symbol == "C")

      -- Atom circle (heteroatoms get a filled circle, carbon gets a dot)
      if isCarbon then
        -- Carbon: small dot or nothing (skeletal formula style)
        love.graphics.setColor(col[1], col[2], col[3], 0.4 * opacity)
        love.graphics.circle("fill", sx, sy, atomR * 0.5)
      else
        -- Heteroatom: visible circle with background
        love.graphics.setColor(0.08, 0.08, 0.12, 0.9 * opacity)
        love.graphics.circle("fill", sx, sy, atomR * 2)
        love.graphics.setColor(col[1], col[2], col[3], opacity)
        love.graphics.circle("fill", sx, sy, atomR * 1.5)

        -- Label
        if showLabels then
          love.graphics.setColor(1, 1, 1, opacity)
          local tw = font:getWidth(atom.symbol)
          local th = font:getHeight()
          love.graphics.print(atom.symbol, sx - tw / 2, sy - th / 2)
        end
      end
    end

    -- ── Formula label ───────────────────────────────────────────────

    if geom.formula and geom.formula ~= "" then
      love.graphics.setColor(0.6, 0.6, 0.6, 0.5 * opacity)
      local fw = font:getWidth(geom.formula)
      love.graphics.print(geom.formula, x + (w - fw) / 2, y + h - 14)
    end
  end,
})
