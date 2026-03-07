--[[
  capabilities/periodic_table.lua — Interactive periodic table grid

  Paints 118 element tiles in standard periodic table layout.
  Click to select an element — fires onSelect with the full element table.
  All rendering and hit testing in Lua — zero JS compute.

  React usage:
    <PeriodicTable onSelect={(el) => setSelected(el)} selected={42} />
    <PeriodicTable tileSize={40} colorBy="phase" />

  Props:
    selected   number|nil   Atomic number of highlighted element
    tileSize   number       Tile width in pixels (default: 40)
    colorBy    string       "category" | "phase" | "electronegativity" | "density"
]]

local Capabilities = require("lua.capabilities")
local Chemistry = require("lua.capabilities.chemistry")
local Color = require("lua.color")

-- Standard periodic table layout: [row][col] -> atomic number (0 = empty)
local TABLE_LAYOUT = {
  {1, 0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0, 2},
  {3, 4, 0,0,0,0,0,0,0,0,0,0, 5, 6, 7, 8, 9, 10},
  {11,12, 0,0,0,0,0,0,0,0,0,0, 13,14,15,16,17,18},
  {19,20, 21,22,23,24,25,26,27,28,29,30, 31,32,33,34,35,36},
  {37,38, 39,40,41,42,43,44,45,46,47,48, 49,50,51,52,53,54},
  {55,56, 0, 72,73,74,75,76,77,78,79,80, 81,82,83,84,85,86},
  {87,88, 0, 104,105,106,107,108,109,110,111,112, 113,114,115,116,117,118},
  {0, 0, 57,58,59,60,61,62,63,64,65,66,67,68,69,70,71, 0},
  {0, 0, 89,90,91,92,93,94,95,96,97,98,99,100,101,102,103, 0},
}

local TABLE_COLUMNS = 18
local TABLE_ROWS = #TABLE_LAYOUT
local TILE_HEIGHT_RATIO = 36 / 32

-- Precompute occupied cells
local TABLE_CELLS = {}
for rowIdx, row in ipairs(TABLE_LAYOUT) do
  for colIdx, atomicNumber in ipairs(row) do
    if atomicNumber ~= 0 then
      TABLE_CELLS[#TABLE_CELLS + 1] = {
        z = atomicNumber,
        row = rowIdx - 1,
        col = colIdx - 1,
      }
    end
  end
end

-- Category color map
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

local function getCategoryColor(el, colorBy)
  if colorBy == "phase" then
    return PHASE_COLORS[el.phase] or "#868e96"
  end
  if colorBy == "electronegativity" then
    if not el.electronegativity then return "#868e96" end
    local t = el.electronegativity / 4.0
    local r = math.floor(255 * t)
    local b = math.floor(255 * (1 - t))
    return string.format("rgb(%d, 80, %d)", r, b)
  end
  if colorBy == "density" then
    if not el.density then return "#868e96" end
    local t = math.min(el.density / 23, 1)
    local r = math.floor(255 * t)
    return string.format("rgb(%d, %d, %d)", r, math.floor(100 * (1 - t)), math.floor(200 * (1 - t)))
  end
  return CATEGORY_COLORS[el.category] or "#868e96"
end

Capabilities.register("PeriodicTable", {
  visual = true,

  schema = {
    selected = { type = "number", default = 0,    desc = "Atomic number of highlighted element (0 = none)" },
    tileSize = { type = "number", default = 40,   desc = "Tile width in pixels" },
    colorBy  = { type = "string", default = "category", desc = "Color mode: category, phase, electronegativity, density" },
  },

  events = { "onSelect" },

  create = function(nodeId, props)
    return {
      screenX = 0,
      screenY = 0,
      wasPressed = false,
    }
  end,

  update = function(nodeId, props, prev, state) end,
  destroy = function(nodeId, state) end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not love.mouse then return end

    local pressed = love.mouse.isDown(1)
    local justClicked = state.wasPressed and not pressed
    state.wasPressed = pressed

    if not justClicked or not pushEvent then return end

    local mx, my = love.mouse.getPosition()
    local lx = mx - state.screenX
    local ly = my - state.screenY

    local tileSize = props.tileSize or 40
    local tileW = tileSize
    local tileH = tileSize * TILE_HEIGHT_RATIO
    local gap = math.max(1, math.floor(tileW / 20 + 0.5))
    local cellW = tileW + gap
    local cellH = tileH + gap

    if lx < 0 or ly < 0 then return end

    local col = math.floor(lx / cellW)
    local row = math.floor(ly / cellH)

    if row < 0 or row >= TABLE_ROWS or col < 0 or col >= TABLE_COLUMNS then return end

    -- Check within tile bounds (not in gap)
    local inTileX = lx - col * cellW
    local inTileY = ly - row * cellH
    if inTileX > tileW or inTileY > tileH then return end

    local layoutRow = TABLE_LAYOUT[row + 1]
    if not layoutRow then return end
    local z = layoutRow[col + 1]
    if not z or z == 0 then return end

    local el = Chemistry.getElement(z)
    if el then
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onSelect",
          number = el.number,
          symbol = el.symbol,
          name = el.name,
          mass = el.mass,
          category = el.category,
          group = el.group,
          period = el.period,
          phase = el.phase,
        },
      })
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

    local tileSize = props.tileSize or 40
    local tileW = tileSize
    local tileH = tileSize * TILE_HEIGHT_RATIO
    local gap = math.max(1, math.floor(tileW / 20 + 0.5))
    local selected = props.selected or 0
    local colorBy = props.colorBy or "category"
    local s = tileSize / 32
    local font = love.graphics.getFont()

    for _, cell in ipairs(TABLE_CELLS) do
      local el = Chemistry.getElement(cell.z)
      if el then
        local tx = x + cell.col * (tileW + gap)
        local ty = y + cell.row * (tileH + gap)
        local bg = getCategoryColor(el, colorBy)
        local isSelected = (el.number == selected)

        -- Tile background
        local br, bg_, bb = Color.parse(bg)
        if isSelected then
          love.graphics.setColor(br or 0.5, bg_ or 0.5, bb or 0.5, opacity)
        else
          love.graphics.setColor(br or 0.5, bg_ or 0.5, bb or 0.5, 0.25 * opacity)
        end
        love.graphics.rectangle("fill", tx, ty, tileW, tileH, 2 * s, 2 * s)

        -- Border
        love.graphics.setColor(br or 0.5, bg_ or 0.5, bb or 0.5, 0.6 * opacity)
        love.graphics.setLineWidth(isSelected and 2 or 1)
        love.graphics.rectangle("line", tx, ty, tileW, tileH, 2 * s, 2 * s)

        -- Atomic number (top)
        love.graphics.setColor(br or 0.5, bg_ or 0.5, bb or 0.5, 0.8 * opacity)
        local numStr = tostring(el.number)
        love.graphics.print(numStr, tx + 2 * s, ty + 1 * s)

        -- Symbol (center, larger)
        love.graphics.setColor(1, 1, 1, 0.95 * opacity)
        local symW = font:getWidth(el.symbol)
        love.graphics.print(el.symbol, tx + (tileW - symW) / 2, ty + tileH * 0.3)

        -- Mass (bottom)
        love.graphics.setColor(0.7, 0.7, 0.7, 0.5 * opacity)
        local massStr = string.format("%.1f", el.mass)
        local massW = font:getWidth(massStr)
        love.graphics.print(massStr, tx + (tileW - massW) / 2, ty + tileH - 10 * s)
      end
    end
  end,
})
