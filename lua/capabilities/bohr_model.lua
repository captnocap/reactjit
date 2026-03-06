--[[
  capabilities/bohr_model.lua — Animated 3D Bohr model visualization

  Renders an interactive Bohr model for any element (Z=1-118).
  Nucleus with CPK color, tilted orbital ellipses, animated electrons.
  All computation and rendering in Lua — zero frame delay.

  React usage:
    <BohrModel element={26} />
    <BohrModel element="Fe" animated speed={2} />
    <BohrModel element={6} showLabel />

  Props:
    element    number|string  Atomic number (1-118) or element symbol
    animated   boolean        Animate electron orbits (default: true)
    speed      number         Animation speed multiplier (default: 1.0)
    showLabel  boolean        Show element symbol + name (default: true)
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")

-- ============================================================================
-- Visual constants for shell rendering
-- ============================================================================

-- Tilt angle per shell (radians) — creates 3D perspective illusion
local SHELL_TILTS = { 0.15, 0.45, 0.65, 0.75, 0.80, 0.83, 0.85 }

-- Rotation offset per shell (radians) — spreads orbits visually
local SHELL_ROTATIONS = { 0, 1.05, 2.09, 0.52, 1.57, 2.62, 0.79 }

-- Color per shell level (soft rainbow)
local SHELL_COLORS = {
  {0.40, 0.76, 1.00},  -- shell 1: sky blue
  {0.30, 0.90, 0.50},  -- shell 2: green
  {1.00, 0.75, 0.20},  -- shell 3: amber
  {1.00, 0.40, 0.40},  -- shell 4: red
  {0.75, 0.40, 1.00},  -- shell 5: violet
  {0.40, 0.90, 0.90},  -- shell 6: teal
  {1.00, 0.60, 0.80},  -- shell 7: pink
}

-- ============================================================================
-- Helpers
-- ============================================================================

local function hexToRgb(hex)
  if not hex or type(hex) ~= "string" then return 0.5, 0.5, 0.5 end
  hex = hex:gsub("#", "")
  if #hex ~= 6 then return 0.5, 0.5, 0.5 end
  return tonumber(hex:sub(1,2), 16) / 255,
         tonumber(hex:sub(3,4), 16) / 255,
         tonumber(hex:sub(5,6), 16) / 255
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("BohrModel", {
  visual = true,

  schema = {
    element   = { type = "number", default = 1,    desc = "Atomic number (1-118) or symbol string" },
    animated  = { type = "bool",   default = true,  desc = "Animate electron orbits" },
    speed     = { type = "number", default = 1.0,   desc = "Animation speed multiplier" },
    showLabel = { type = "bool",   default = true,  desc = "Show element symbol and name" },
  },

  events = {},

  create = function(nodeId, props)
    return {
      time = 0,
      elementData = nil,
      prevElement = nil,
    }
  end,

  update = function(nodeId, props, prev, state)
    local key = props.element
    if key ~= state.prevElement then
      state.prevElement = key
      state.elementData = Chemistry.getElement(key)
      state.time = 0
    end
  end,

  destroy = function(nodeId, state) end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if props.animated ~= false then
      state.time = state.time + dt * (props.speed or 1.0)
    end
  end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    local elem = state.elementData
    if not elem then return end

    local x, y, w, h = c.x, c.y, c.w, c.h
    local cx, cy = x + w / 2, y + h / 2
    local maxR = math.min(w, h) / 2 - 12
    local shells = elem.shells or {}
    local numShells = #shells
    local t = state.time

    -- Nucleus sizing (proportional, with minimum)
    local nucleusR = math.max(5, maxR * 0.07 + numShells * 0.5)

    -- ── Back halves of orbital rings ──────────────────────────────────

    for i = 1, numShells do
      local r = nucleusR + (maxR - nucleusR) * i / (numShells + 0.5)
      local tilt = SHELL_TILTS[i] or 0.85
      local rot = SHELL_ROTATIONS[i] or (i * 0.5)
      local col = SHELL_COLORS[i] or {0.5, 0.5, 0.5}

      -- Draw the back half of the orbit (behind nucleus)
      love.graphics.push()
      love.graphics.translate(cx, cy)
      love.graphics.rotate(rot)

      -- Full orbit ring (faint)
      love.graphics.setColor(col[1], col[2], col[3], 0.18 * opacity)
      love.graphics.setLineWidth(1)
      love.graphics.ellipse("line", 0, 0, r, r * math.cos(tilt))

      love.graphics.pop()
    end

    -- ── Nucleus ──────────────────────────────────────────────────────

    -- Soft glow behind nucleus
    love.graphics.setColor(1.0, 1.0, 1.0, 0.08 * opacity)
    love.graphics.circle("fill", cx, cy, nucleusR * 2.5)

    -- Nucleus body (CPK colored)
    local nr, ng, nb = hexToRgb(elem.cpkColor)
    love.graphics.setColor(nr, ng, nb, opacity)
    love.graphics.circle("fill", cx, cy, nucleusR)

    -- Nucleus shadow (darker ring)
    love.graphics.setColor(nr * 0.5, ng * 0.5, nb * 0.5, 0.3 * opacity)
    love.graphics.setLineWidth(1.5)
    love.graphics.circle("line", cx, cy, nucleusR)

    -- Specular highlight
    love.graphics.setColor(1, 1, 1, 0.35 * opacity)
    love.graphics.circle("fill", cx - nucleusR * 0.25, cy - nucleusR * 0.25, nucleusR * 0.35)

    -- ── Electrons on orbits ──────────────────────────────────────────

    for i = 1, numShells do
      local r = nucleusR + (maxR - nucleusR) * i / (numShells + 0.5)
      local tilt = SHELL_TILTS[i] or 0.85
      local rot = SHELL_ROTATIONS[i] or (i * 0.5)
      local col = SHELL_COLORS[i] or {0.5, 0.5, 0.5}
      local nElectrons = shells[i] or 0

      -- Inner shells orbit faster
      local orbSpeed = 1.0 / (0.5 + i * 0.4)
      local cr, sr = math.cos(rot), math.sin(rot)

      for j = 0, nElectrons - 1 do
        local angle = (2 * math.pi * j / math.max(1, nElectrons)) + t * orbSpeed

        -- Position on tilted ellipse
        local ex = r * math.cos(angle)
        local ey = r * math.sin(angle) * math.cos(tilt)

        -- Apply rotation
        local px = cx + ex * cr - ey * sr
        local py = cy + ex * sr + ey * cr

        -- Electron glow
        love.graphics.setColor(col[1], col[2], col[3], 0.25 * opacity)
        love.graphics.circle("fill", px, py, 5)

        -- Electron body
        love.graphics.setColor(col[1], col[2], col[3], 0.9 * opacity)
        love.graphics.circle("fill", px, py, 2.5)

        -- Bright center
        love.graphics.setColor(1, 1, 1, 0.7 * opacity)
        love.graphics.circle("fill", px, py, 1.0)
      end
    end

    -- ── Label ────────────────────────────────────────────────────────

    local props = node.props or {}
    if props.showLabel ~= false then
      local font = love.graphics.getFont()

      -- Symbol (bold, larger)
      local sym = elem.symbol or ""
      local tw = font:getWidth(sym)
      love.graphics.setColor(1, 1, 1, 0.9 * opacity)
      love.graphics.print(sym, cx - tw / 2, y + h - 24)

      -- Name + atomic number (smaller, dimmer)
      local info = (elem.name or "") .. " (" .. (elem.number or "?") .. ")"
      local iw = font:getWidth(info)
      love.graphics.setColor(0.7, 0.7, 0.7, 0.6 * opacity)
      love.graphics.print(info, cx - iw / 2, y + h - 12)
    end
  end,
})
