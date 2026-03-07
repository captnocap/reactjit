--[[
  capabilities/element_tile.lua — Single element tile with flip animation

  Compact periodic table cell that flips to reveal properties on click.
  Flip animation is a Lua spring — zero JS compute.

  React usage:
    <ElementTile element={26} />
    <ElementTile element="Fe" selected size={64} />

  Props:
    element   number|string  Atomic number or symbol
    selected  boolean        Highlight border
    flipped   boolean        Force flip state (nil = toggle on click)
    size      number         Tile width (default: 64)
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")
local Color = require("lua.color")

-- Category colors (same as periodic_table.lua)
local CATEGORY_COLORS = {
  ["alkali-metal"]         = "#7b6faa",
  ["alkaline-earth"]       = "#9a9cc4",
  ["transition-metal"]     = "#de9a9a",
  ["post-transition-metal"]= "#8fbc8f",
  ["metalloid"]            = "#c8c864",
  ["nonmetal"]             = "#59b5e6",
  ["halogen"]              = "#d4a844",
  ["noble-gas"]            = "#c87e4a",
  ["lanthanide"]           = "#c45879",
  ["actinide"]             = "#d4879a",
}

local PHASE_COLORS = {
  solid   = "#69db7c",
  liquid  = "#4dabf7",
  gas     = "#ffd43b",
  unknown = "#868e96",
}

-- Simple spring solver
local function springStep(current, target, velocity, dt, stiffness, damping)
  local force = -stiffness * (current - target)
  local drag  = -damping * velocity
  velocity = velocity + (force + drag) * dt
  current  = current + velocity * dt
  return current, velocity
end

Capabilities.register("ElementTile", {
  visual = true,

  schema = {
    element  = { type = "number", default = 1,     desc = "Atomic number or symbol" },
    selected = { type = "bool",   default = false,  desc = "Highlight border" },
    flipped  = { type = "bool",   default = nil,    desc = "Force flip state" },
    size     = { type = "number", default = 64,     desc = "Tile width in pixels" },
  },

  events = { "onPress" },

  create = function(nodeId, props)
    return {
      screenX = 0, screenY = 0,
      flipProgress = 0,
      flipVelocity = 0,
      flipTarget = 0,
      internalFlipped = false,
      wasPressed = false,
      elementData = nil,
      prevElement = nil,
    }
  end,

  update = function(nodeId, props, prev, state)
    local key = props.element
    if key ~= state.prevElement then
      state.prevElement = key
      state.elementData = Chemistry.getElement(key)
    end
    -- External flip control
    if props.flipped ~= nil then
      state.flipTarget = props.flipped and 1 or 0
    end
  end,

  destroy = function(nodeId, state) end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Animate flip spring
    state.flipProgress, state.flipVelocity = springStep(
      state.flipProgress, state.flipTarget, state.flipVelocity,
      dt, 200, 18
    )
    -- Clamp near targets
    if math.abs(state.flipProgress - state.flipTarget) < 0.001 and math.abs(state.flipVelocity) < 0.01 then
      state.flipProgress = state.flipTarget
      state.flipVelocity = 0
    end

    -- Click detection
    if not love.mouse then return end
    local pressed = love.mouse.isDown(1)
    local justClicked = state.wasPressed and not pressed
    state.wasPressed = pressed

    if justClicked then
      local mx, my = love.mouse.getPosition()
      local lx = mx - state.screenX
      local ly = my - state.screenY
      local size = props.size or 64
      local h = size * (36 / 32)
      if lx >= 0 and lx <= size and ly >= 0 and ly <= h then
        -- Toggle internal flip if not externally controlled
        if props.flipped == nil then
          state.internalFlipped = not state.internalFlipped
          state.flipTarget = state.internalFlipped and 1 or 0
        end
        -- Fire onPress
        if pushEvent and state.elementData then
          local el = state.elementData
          pushEvent({
            type = "capability",
            payload = {
              targetId = nodeId,
              handler = "onPress",
              number = el.number,
              symbol = el.symbol,
              name = el.name,
              mass = el.mass,
              category = el.category,
            },
          })
        end
      end
    end
  end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    local props = node.props or {}
    local x, y, w, h = c.x, c.y, c.w, c.h
    state.screenX = x
    state.screenY = y

    local el = state.elementData
    if not el then return end

    local size = props.size or 64
    local tileH = size * (36 / 32)
    local s = size / 32
    local prog = state.flipProgress
    local scaleX = math.abs(math.cos(prog * math.pi))
    local showBack = prog > 0.5

    local bgHex = CATEGORY_COLORS[el.category] or "#868e96"
    local br, bg_, bb = Color.parse(bgHex)
    br = br or 0.5; bg_ = bg_ or 0.5; bb = bb or 0.5

    local font = love.graphics.getFont()

    -- Apply horizontal scale transform
    love.graphics.push()
    love.graphics.translate(x + size / 2, y)
    love.graphics.scale(math.max(0.01, scaleX), 1)
    love.graphics.translate(-size / 2, 0)

    local tx, ty = 0, 0

    if showBack then
      -- Back face: colored background with properties
      love.graphics.setColor(br, bg_, bb, opacity)
      love.graphics.rectangle("fill", tx, ty, size, tileH, 3 * s, 3 * s)

      -- Symbol
      love.graphics.setColor(0, 0, 0, opacity)
      local symW = font:getWidth(el.symbol)
      love.graphics.print(el.symbol, tx + (size - symW) / 2, ty + 2 * s)

      -- Properties
      local propY = ty + 10 * s
      local props_data = {
        {"Grp",   tostring(el.group)},
        {"Per",   tostring(el.period)},
        {"Phase", el.phase},
        {el.electronegativity and "EN" or nil, el.electronegativity and tostring(el.electronegativity) or nil},
        {"Mass",  string.format("%.1f", el.mass)},
      }
      for _, p in ipairs(props_data) do
        if p[1] then
          love.graphics.setColor(0, 0, 0, 0.5 * opacity)
          love.graphics.print(p[1], tx + 2 * s, propY)
          love.graphics.setColor(0, 0, 0, opacity)
          local vw = font:getWidth(p[2])
          love.graphics.print(p[2], tx + size - vw - 2 * s, propY)
          propY = propY + font:getHeight() + 1
        end
      end
    else
      -- Front face: surface background with symbol
      -- Get theme surface color
      local theme = ReactJIT and ReactJIT.getTheme and ReactJIT.getTheme()
      local colors = theme and theme.colors or {}
      local sr, sg, sb = Color.parse(colors.surface or "#2a2a3a")
      love.graphics.setColor(sr or 0.15, sg or 0.15, sb or 0.2, opacity)
      love.graphics.rectangle("fill", tx, ty, size, tileH, 3 * s, 3 * s)

      -- Border
      love.graphics.setColor(br, bg_, bb, 0.8 * opacity)
      love.graphics.setLineWidth(props.selected and 2 or 1)
      love.graphics.rectangle("line", tx, ty, size, tileH, 3 * s, 3 * s)

      -- Atomic number
      love.graphics.setColor(br, bg_, bb, 0.7 * opacity)
      local numStr = tostring(el.number)
      local numW = font:getWidth(numStr)
      love.graphics.print(numStr, tx + (size - numW) / 2, ty + 2 * s)

      -- Symbol
      love.graphics.setColor(1, 1, 1, 0.95 * opacity)
      local symW = font:getWidth(el.symbol)
      love.graphics.print(el.symbol, tx + (size - symW) / 2, ty + tileH * 0.35)

      -- Mass
      love.graphics.setColor(0.6, 0.6, 0.6, 0.6 * opacity)
      local massStr = string.format("%.2f", el.mass)
      local massW = font:getWidth(massStr)
      love.graphics.print(massStr, tx + (size - massW) / 2, ty + tileH - font:getHeight() - 2 * s)
    end

    love.graphics.pop()
  end,
})
