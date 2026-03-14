--[[
  capabilities/bohr_model.lua — Animated Bohr model visualization (2D + 3D)

  Renders an interactive Bohr model for any element (Z=1-118).
  2D mode: nucleus with CPK color, tilted orbital ellipses, animated electrons.
  3D mode: true 3D spheres, torus orbits, orbiting electron spheres (via g3d).
  Right-click toggles between 2D and 3D. Mode broadcast via latch.

  React usage:
    <BohrModel element={26} />
    <BohrModel element="Fe" animated speed={2} />
    <BohrModel element={6} showLabel view3d />

  Props:
    element    number|string  Atomic number (1-118) or element symbol
    animated   boolean        Animate electron orbits (default: true)
    speed      number         Animation speed multiplier (default: 1.0)
    showLabel  boolean        Show element symbol + name (default: true)
    view3d     boolean        Start in 3D mode (default: false)
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")
local cap3d = require("lua.cap3d")
local Latches = require("lua.latches")

-- ============================================================================
-- Visual constants for shell rendering
-- ============================================================================

local SHELL_TILTS = { 0.15, 0.45, 0.65, 0.75, 0.80, 0.83, 0.85 }
local SHELL_ROTATIONS = { 0, 1.05, 2.09, 0.52, 1.57, 2.62, 0.79 }
local SHELL_COLORS = {
  {0.40, 0.76, 1.00},
  {0.30, 0.90, 0.50},
  {1.00, 0.75, 0.20},
  {1.00, 0.40, 0.40},
  {0.75, 0.40, 1.00},
  {0.40, 0.90, 0.90},
  {1.00, 0.60, 0.80},
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
-- 3D model lifecycle
-- ============================================================================

local function releaseModels3D(state)
  if state.nucleusModel then state.nucleusModel.mesh:release(); state.nucleusModel = nil end
  if state.electronModel then state.electronModel.mesh:release(); state.electronModel = nil end
  if state.torusModels then
    for _, m in ipairs(state.torusModels) do m.mesh:release() end
    state.torusModels = nil
  end
end

local function buildModels3D(state, elem)
  if not elem then return end
  local g = cap3d.getG3D()
  if not g then return end

  releaseModels3D(state)

  local shells = elem.shells or {}
  local numShells = #shells
  local maxR = 1.5
  local nucleusR = math.max(0.08, maxR * 0.05 + numShells * 0.005)

  -- Nucleus sphere
  local nr, ng, nb = hexToRgb(elem.cpkColor)
  state.nucleusModel = g.newModel(cap3d.sphere(nucleusR, 24, 16), cap3d.rgbTexture(nr, ng, nb))

  -- Torus ring per shell
  state.torusModels = {}
  for i = 1, numShells do
    local shellR = nucleusR + (maxR - nucleusR) * i / (numShells + 0.5)
    local tilt = SHELL_TILTS[i] or 0.85
    local rot = SHELL_ROTATIONS[i] or (i * 0.5)
    local col = SHELL_COLORS[i] or {0.5, 0.5, 0.5}

    local m = g.newModel(cap3d.torus(shellR, 0.012, 32, 12), cap3d.rgbTexture(col[1], col[2], col[3]))
    m:setRotation(tilt, 0, rot)
    state.torusModels[i] = m
  end

  -- Shared electron sphere (repositioned per electron each frame)
  state.electronModel = g.newModel(cap3d.sphere(0.04, 8, 6), cap3d.rgbTexture(1, 1, 1))
end

local function syncElementFromProps(state, props)
  local key = props.element
  if key ~= state.prevElement then
    state.prevElement = key
    state.elementData = Chemistry.getElement(key)
    state.time = 0
    if state.view3d and state.elementData then
      buildModels3D(state, state.elementData)
    else
      releaseModels3D(state)
    end
  end
end

-- ============================================================================
-- 3D render path
-- ============================================================================

local function render3D(node, c, opacity, state)
  local elem = state.elementData
  if not elem or not state.nucleusModel then return end

  local x, y, w, h = c.x, c.y, c.w, c.h
  local shells = elem.shells or {}
  local numShells = #shells
  local maxR = 1.5
  local nucleusR = math.max(0.08, maxR * 0.05 + numShells * 0.005)
  local t = state.time

  cap3d.renderTo(node.id, w, h, { 0.02, 0.02, 0.05, 1 }, function(g3d)
    cap3d.applyOrbitCamera(state, 3.5)

    local lightOpts = {
      lightDir = { 1, -0.5, 0.7 },
      lightColor = { 0.9, 0.85, 0.8 },
      ambientColor = { 0.15, 0.15, 0.2 },
      camPos = g3d.camera.position,
    }

    -- Nucleus
    cap3d.drawLit(state.nucleusModel, lightOpts)

    -- Orbital rings (semi-transparent)
    for _, torusModel in ipairs(state.torusModels) do
      cap3d.drawLit(torusModel, {
        lightDir = lightOpts.lightDir,
        lightColor = lightOpts.lightColor,
        ambientColor = lightOpts.ambientColor,
        camPos = lightOpts.camPos,
        opacity = 0.35,
        specular = 8,
      })
    end

    -- Electrons on orbits
    for i = 1, numShells do
      local shellR = nucleusR + (maxR - nucleusR) * i / (numShells + 0.5)
      local tilt = SHELL_TILTS[i] or 0.85
      local rot = SHELL_ROTATIONS[i] or (i * 0.5)
      local nElectrons = shells[i] or 0
      local orbSpeed = 1.0 / (0.5 + i * 0.4)

      local cosT, sinT = math.cos(tilt), math.sin(tilt)
      local cosR, sinR = math.cos(rot), math.sin(rot)

      for j = 0, nElectrons - 1 do
        local angle = 2 * math.pi * j / math.max(1, nElectrons) + t * orbSpeed
        local ex = shellR * math.cos(angle)
        local ey = shellR * math.sin(angle)
        -- Rx(tilt): rotate around X
        local ey2 = ey * cosT
        local ez2 = ey * sinT
        -- Rz(rot): rotate around Z
        local ex3 = ex * cosR - ey2 * sinR
        local ey3 = ex * sinR + ey2 * cosR

        state.electronModel:setTranslation(ex3, ey3, ez2)
        cap3d.drawLit(state.electronModel, {
          lightDir = lightOpts.lightDir,
          lightColor = { 1, 1, 0.95 },
          ambientColor = { 0.3, 0.3, 0.35 },
          camPos = lightOpts.camPos,
          specular = 64,
        })
      end
    end
  end)

  -- Composite canvas
  local canvas = cap3d.getCanvas(node.id)
  if canvas then
    love.graphics.setColor(1, 1, 1, opacity)
    love.graphics.draw(canvas, x, y)
  end

  -- Label overlay (2D, on top of 3D canvas)
  local props = node.props or {}
  if props.showLabel ~= false then
    local font = love.graphics.getFont()
    local sym = elem.symbol or ""
    local tw = font:getWidth(sym)
    love.graphics.setColor(1, 1, 1, 0.9 * opacity)
    love.graphics.print(sym, x + w / 2 - tw / 2, y + h - 24)
    local info = (elem.name or "") .. " (" .. (elem.number or "?") .. ")"
    local iw = font:getWidth(info)
    love.graphics.setColor(0.7, 0.7, 0.7, 0.6 * opacity)
    love.graphics.print(info, x + w / 2 - iw / 2, y + h - 12)
  end
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("BohrModel", {
  visual = true,

  schema = {
    element   = { type = "number", default = 1,     desc = "Atomic number (1-118) or symbol string" },
    animated  = { type = "bool",   default = true,   desc = "Animate electron orbits" },
    speed     = { type = "number", default = 1.0,    desc = "Animation speed multiplier" },
    showLabel = { type = "bool",   default = true,   desc = "Show element symbol and name" },
    view3d    = { type = "bool",   default = false,  desc = "Start in 3D mode (right-click toggles)" },
  },

  events = {},

  create = function(nodeId, props)
    local state = {
      time = 0,
      elementData = nil,
      prevElement = nil,
      -- 3D state
      view3d = props.view3d or false,
      orbitRotX = 0.4,
      orbitRotY = 0.3,
      orbitPrevMX = nil,
      orbitPrevMY = nil,
      screenRect = nil,
      togglePrev = false,
      nucleusModel = nil,
      torusModels = nil,
      electronModel = nil,
    }
    syncElementFromProps(state, props)
    return state
  end,

  update = function(nodeId, props, prev, state)
    syncElementFromProps(state, props)

    -- Sync view3d from prop
    if props.view3d ~= nil and (props.view3d and true or false) ~= state.view3d then
      state.view3d = props.view3d and true or false
      if state.view3d and state.elementData then
        buildModels3D(state, state.elementData)
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
    -- Animation
    if props.animated ~= false then
      state.time = state.time + dt * (props.speed or 1.0)
    end

    -- Right-click toggle
    if cap3d.checkToggle(state) then
      if state.view3d and state.elementData then
        buildModels3D(state, state.elementData)
      elseif not state.view3d then
        releaseModels3D(state)
      end
    end

    -- Orbit controls (3D mode only)
    if state.view3d then
      cap3d.updateOrbit(state)
    end

    -- Broadcast mode via latch
    Latches.set("bohrmodel:" .. nodeId .. ":view3d", state.view3d and 1 or 0)
  end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    -- Store screen rect for orbit/toggle hit testing (used next frame)
    state.screenRect = { x = c.x, y = c.y, w = c.w, h = c.h }

    local elem = state.elementData
    if not elem then return end

    -- 3D branch
    if state.view3d and state.nucleusModel then
      render3D(node, c, opacity, state)
      return
    end

    -- ══════════════════════════════════════════════════════════════
    -- 2D render (original, unchanged)
    -- ══════════════════════════════════════════════════════════════

    local x, y, w, h = c.x, c.y, c.w, c.h
    local cx, cy = x + w / 2, y + h / 2
    local maxR = math.min(w, h) / 2 - 12
    local shells = elem.shells or {}
    local numShells = #shells
    local t = state.time

    local nucleusR = math.max(5, maxR * 0.07 + numShells * 0.5)

    -- Back halves of orbital rings
    for i = 1, numShells do
      local r = nucleusR + (maxR - nucleusR) * i / (numShells + 0.5)
      local tilt = SHELL_TILTS[i] or 0.85
      local rot = SHELL_ROTATIONS[i] or (i * 0.5)
      local col = SHELL_COLORS[i] or {0.5, 0.5, 0.5}

      love.graphics.push()
      love.graphics.translate(cx, cy)
      love.graphics.rotate(rot)
      love.graphics.setColor(col[1], col[2], col[3], 0.18 * opacity)
      love.graphics.setLineWidth(1)
      love.graphics.ellipse("line", 0, 0, r, r * math.cos(tilt))
      love.graphics.pop()
    end

    -- Nucleus
    love.graphics.setColor(1.0, 1.0, 1.0, 0.08 * opacity)
    love.graphics.circle("fill", cx, cy, nucleusR * 2.5)

    local nr, ng, nb = hexToRgb(elem.cpkColor)
    love.graphics.setColor(nr, ng, nb, opacity)
    love.graphics.circle("fill", cx, cy, nucleusR)

    love.graphics.setColor(nr * 0.5, ng * 0.5, nb * 0.5, 0.3 * opacity)
    love.graphics.setLineWidth(1.5)
    love.graphics.circle("line", cx, cy, nucleusR)

    love.graphics.setColor(1, 1, 1, 0.35 * opacity)
    love.graphics.circle("fill", cx - nucleusR * 0.25, cy - nucleusR * 0.25, nucleusR * 0.35)

    -- Electrons on orbits
    for i = 1, numShells do
      local r = nucleusR + (maxR - nucleusR) * i / (numShells + 0.5)
      local tilt = SHELL_TILTS[i] or 0.85
      local rot = SHELL_ROTATIONS[i] or (i * 0.5)
      local col = SHELL_COLORS[i] or {0.5, 0.5, 0.5}
      local nElectrons = shells[i] or 0
      local orbSpeed = 1.0 / (0.5 + i * 0.4)
      local cr, sr = math.cos(rot), math.sin(rot)

      for j = 0, nElectrons - 1 do
        local angle = (2 * math.pi * j / math.max(1, nElectrons)) + t * orbSpeed
        local ex = r * math.cos(angle)
        local ey = r * math.sin(angle) * math.cos(tilt)
        local px = cx + ex * cr - ey * sr
        local py = cy + ex * sr + ey * cr

        love.graphics.setColor(col[1], col[2], col[3], 0.25 * opacity)
        love.graphics.circle("fill", px, py, 5)
        love.graphics.setColor(col[1], col[2], col[3], 0.9 * opacity)
        love.graphics.circle("fill", px, py, 2.5)
        love.graphics.setColor(1, 1, 1, 0.7 * opacity)
        love.graphics.circle("fill", px, py, 1.0)
      end
    end

    -- Label
    local props = node.props or {}
    if props.showLabel ~= false then
      local font = love.graphics.getFont()
      local sym = elem.symbol or ""
      local tw = font:getWidth(sym)
      love.graphics.setColor(1, 1, 1, 0.9 * opacity)
      love.graphics.print(sym, cx - tw / 2, y + h - 24)
      local info = (elem.name or "") .. " (" .. (elem.number or "?") .. ")"
      local iw = font:getWidth(info)
      love.graphics.setColor(0.7, 0.7, 0.7, 0.6 * opacity)
      love.graphics.print(info, cx - iw / 2, y + h - 12)
    end
  end,
})
