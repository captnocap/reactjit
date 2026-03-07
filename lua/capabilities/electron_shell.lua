--[[
  capabilities/electron_shell.lua — 2D electron shell diagram

  Concentric rings with electron dots at angular positions.
  All trig in LuaJIT. Distinct from BohrModel (which has tilted 3D orbits).

  React usage:
    <ElectronShell element={26} />
    <ElectronShell element="Fe" animated />

  Props:
    element   number|string  Atomic number or symbol
    animated  boolean        Animate electron orbit positions (default: false)
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")
local Color = require("lua.color")

local TWO_PI = math.pi * 2

Capabilities.register("ElectronShell", {
  visual = true,

  schema = {
    element  = { type = "number", default = 1,     desc = "Atomic number or symbol" },
    animated = { type = "bool",   default = false,  desc = "Animate electron positions" },
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
    if props.animated then
      state.time = state.time + dt
    end
  end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    local el = state.elementData
    if not el then return end

    local x, y, w, h = c.x, c.y, c.w, c.h
    local cx = x + w / 2
    local cy = y + h / 2
    local shells = el.shells or {}
    local numShells = #shells
    local t = state.time

    local ringSpacing = math.min(18, (math.min(w, h) / 2 - 24) / math.max(1, numShells))
    local centerSize = 32
    local maxR = centerSize / 2 + numShells * ringSpacing

    -- Get theme colors
    local theme = ReactJIT and ReactJIT.getTheme and ReactJIT.getTheme()
    local tc = (theme and theme.colors) or {}
    local br, bg_, bb = Color.parse(tc.border or "#494d64")
    local pr, pg, pb = Color.parse(tc.primary or "#8aadf4")

    -- Nucleus
    local nr, ng, nb = Color.parse(el.cpkColor or "#888888")
    love.graphics.setColor(nr or 0.5, ng or 0.5, nb or 0.5, opacity)
    love.graphics.circle("fill", cx, cy, centerSize / 2)

    -- Nucleus label
    love.graphics.setColor(0, 0, 0, opacity)
    local font = love.graphics.getFont()
    local symW = font:getWidth(el.symbol)
    love.graphics.print(el.symbol, cx - symW / 2, cy - font:getHeight() / 2)

    -- Shell rings + electrons
    for i = 1, numShells do
      local radius = i * ringSpacing + centerSize / 2
      local electrons = shells[i] or 0

      -- Ring
      love.graphics.setColor(br or 0.3, bg_ or 0.3, bb or 0.4, 0.5 * opacity)
      love.graphics.setLineWidth(1)
      love.graphics.circle("line", cx, cy, radius)

      -- Electron count label at top of ring
      love.graphics.setColor(pr or 0.5, pg or 0.6, pb or 0.9, 0.9 * opacity)
      local countStr = tostring(electrons)
      local countW = font:getWidth(countStr)
      love.graphics.print(countStr, cx - countW / 2, cy - radius - font:getHeight())

      -- Electron dots
      local orbSpeed = t / (0.5 + i * 0.4)
      for j = 0, electrons - 1 do
        local angle = (j / math.max(1, electrons)) * TWO_PI - math.pi / 2 + orbSpeed
        local dotX = cx + math.cos(angle) * radius
        local dotY = cy + math.sin(angle) * radius

        -- Dot glow
        love.graphics.setColor(pr or 0.5, pg or 0.6, pb or 0.9, 0.3 * opacity)
        love.graphics.circle("fill", dotX, dotY, 5)

        -- Dot body
        love.graphics.setColor(pr or 0.5, pg or 0.6, pb or 0.9, 0.9 * opacity)
        love.graphics.circle("fill", dotX, dotY, 3)
      end
    end
  end,
})
