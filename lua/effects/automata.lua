--[[
  effects/automata.lua — Cellular automata (Game of Life variants)

  A grid of cells evolves via configurable birth/survival rules.
  Rules shift over time creating different "ecosystems" —
  from mitosis to worms to mazes.

  React usage:
    <Automata />
    <Automata speed={1.5} />
    <Automata reactive background />
]]

local Effects = require("lua.effects")
local Util = require("lua.effects.util")

local sin, pi = math.sin, math.pi
local random, floor, min, max = math.random, math.floor, math.min, math.max

local Automata = {}

local CELL_SIZE = 4

-- Classic patterns
local PATTERNS = {
  glider = {{0,1,0}, {0,0,1}, {1,1,1}},
  blinker = {{1,1,1}},
  block = {{1,1}, {1,1}},
  beacon = {{1,1,0,0}, {1,0,0,0}, {0,0,0,1}, {0,0,1,1}},
}

function Automata.create(w, h, props)
  local cols = floor(w / CELL_SIZE)
  local rows = floor(h / CELL_SIZE)
  local size = cols * rows

  -- Initialize grids (1-indexed Lua tables)
  local grid = {}
  local nextGrid = {}
  local colors = {} -- {r, g, b} per cell (0-1 range)

  for i = 1, size do
    grid[i] = 0
    nextGrid[i] = 0
    colors[i] = {0.5, 0.5, 0.5}
  end

  -- Seed random initial state
  for i = 1, size do
    if random() < 0.15 then
      grid[i] = 1
      local h = random()
      local r, g, b = Util.hslToRgb(h, 0.6, 0.7)
      colors[i] = {r, g, b}
    end
  end

  return {
    time = 0,
    grid = grid,
    nextGrid = nextGrid,
    colors = colors,
    cols = cols,
    rows = rows,
    birthMin = 3,
    birthMax = 3,
    surviveMin = 2,
    surviveMax = 3,
    frameCount = 0,
    updateInterval = 3,
    hue = random(),
    reactiveIntensity = 0,
    spawnAccum = 0,
  }
end

local function countNeighbors(state, x, y)
  local count = 0
  local cols, rows = state.cols, state.rows
  for dy = -1, 1 do
    for dx = -1, 1 do
      if not (dx == 0 and dy == 0) then
        local nx = ((x - 1 + dx) % cols) + 1
        local ny = ((y - 1 + dy) % rows) + 1
        local idx = (ny - 1) * cols + nx
        count = count + state.grid[idx]
      end
    end
  end
  return count
end

local function getNeighborAvgColor(state, x, y)
  local r, g, b, count = 0, 0, 0, 0
  local cols, rows = state.cols, state.rows
  for dy = -1, 1 do
    for dx = -1, 1 do
      if not (dx == 0 and dy == 0) then
        local nx = ((x - 1 + dx) % cols) + 1
        local ny = ((y - 1 + dy) % rows) + 1
        local idx = (ny - 1) * cols + nx
        if state.grid[idx] == 1 then
          local c = state.colors[idx]
          r = r + c[1]
          g = g + c[2]
          b = b + c[3]
          count = count + 1
        end
      end
    end
  end
  if count == 0 then return {0.5, 0.5, 0.5} end
  return {r / count, g / count, b / count}
end

local function seedPattern(state, cx, cy, pattern, hue)
  local cols, rows = state.cols, state.rows
  local r, g, b = Util.hslToRgb(hue, 0.7, 0.7)
  for dy, row in ipairs(pattern) do
    for dx, val in ipairs(row) do
      if val == 1 then
        local x = ((cx + dx - 2) % cols) + 1
        local y = ((cy + dy - 2) % rows) + 1
        local idx = (y - 1) * cols + x
        state.grid[idx] = 1
        state.colors[idx] = {r, g, b}
      end
    end
  end
end

local function stepSimulation(state, mutationRate)
  local cols, rows = state.cols, state.rows
  local newHue = state.hue

  for y = 1, rows do
    for x = 1, cols do
      local idx = (y - 1) * cols + x
      local neighbors = countNeighbors(state, x, y)
      local alive = state.grid[idx]
      local nextState = 0

      if alive == 1 then
        if neighbors >= state.surviveMin and neighbors <= state.surviveMax then
          nextState = 1
        end
      else
        if neighbors >= state.birthMin and neighbors <= state.birthMax then
          nextState = 1
          local avg = getNeighborAvgColor(state, x, y)
          local ar, ag, ab = Util.hslToRgb(newHue, 0.7, 0.7)
          state.colors[idx] = {
            (avg[1] + ar) * 0.5,
            (avg[2] + ag) * 0.5,
            (avg[3] + ab) * 0.5,
          }
        end
      end

      -- Mutation
      if random() < mutationRate then
        nextState = nextState == 1 and 0 or 1
        if nextState == 1 then
          local r, g, b = Util.hslToRgb(random(), 0.7, 0.7)
          state.colors[idx] = {r, g, b}
        end
      end

      state.nextGrid[idx] = nextState
    end
  end

  -- Swap
  state.grid, state.nextGrid = state.nextGrid, state.grid
end

function Automata.update(state, dt, props, w, h, mouse)
  local speed = Util.prop(props, "speed", 1.0)
  local decay = Util.prop(props, "decay", 0.01)
  local beat = Util.boolProp(props, "beat", false)
  local reactive = Util.boolProp(props, "reactive", false)

  state.time = state.time + dt * speed
  local t = state.time

  -- Reactive
  if reactive and mouse then
    if mouse.inside and mouse.idle < 0.3 then
      state.reactiveIntensity = min(state.reactiveIntensity + dt * 3.0, 1.0)
    else
      state.reactiveIntensity = max(state.reactiveIntensity - dt * 1.0, 0)
    end
  end
  local reactMul = reactive and state.reactiveIntensity or 1.0

  -- Self-modulate rules over time
  local bass = (sin(t * 0.4) + 1) * 0.5
  local mid = (sin(t * 0.25 + 1.5) + 1) * 0.5
  local high = (sin(t * 0.6 + 3.0) + 1) * 0.5

  state.birthMin = floor(2 + (1 - bass) * 1.5)
  state.birthMax = floor(3 + bass)
  state.surviveMin = floor(1 + mid * 1.5)
  state.surviveMax = floor(3 + mid)

  local mutationRate = high * 0.002

  -- Update interval
  state.updateInterval = max(1, floor(4 - speed * 2))

  -- Beat seeding
  local isBeat = beat
  if not beat and not reactive then
    isBeat = sin(t * pi * 0.6) > 0.92
  end

  if isBeat and reactMul > 0.2 then
    local count = 1 + floor(bass * 2)
    for i = 1, count do
      local cx, cy
      if reactive and mouse and mouse.inside then
        cx = floor(mouse.x / CELL_SIZE) + 1
        cy = floor(mouse.y / CELL_SIZE) + 1
      else
        cx = floor(random() * state.cols) + 1
        cy = floor(random() * state.rows) + 1
      end
      local patNames = {"glider", "blinker", "block", "beacon"}
      local pat = PATTERNS[patNames[random(1, #patNames)]]
      seedPattern(state, cx, cy, pat, state.hue)
    end
  end

  -- Reactive: continuous seeding at mouse
  if reactive and mouse and mouse.inside and state.reactiveIntensity > 0.2 then
    state.spawnAccum = state.spawnAccum + dt * mouse.speed * 0.01 * state.reactiveIntensity
    while state.spawnAccum >= 1 do
      state.spawnAccum = state.spawnAccum - 1
      local cx = floor(mouse.x / CELL_SIZE) + 1
      local cy = floor(mouse.y / CELL_SIZE) + 1
      seedPattern(state, cx, cy, PATTERNS.glider, state.hue)
    end
  end

  -- Step simulation
  state.frameCount = state.frameCount + 1
  if state.frameCount % state.updateInterval == 0 then
    stepSimulation(state, mutationRate)
  end

  state.hue = (state.hue + dt * 0.01 * speed) % 1
end

function Automata.draw(state, w, h)
  -- Dark background
  love.graphics.setColor(0.04, 0.04, 0.04, 1)
  love.graphics.rectangle("fill", 0, 0, w, h)

  -- Draw cells
  local cols, rows = state.cols, state.rows
  local cs = CELL_SIZE

  for y = 1, rows do
    for x = 1, cols do
      local idx = (y - 1) * cols + x
      if state.grid[idx] == 1 then
        local c = state.colors[idx]
        love.graphics.setColor(c[1], c[2], c[3], 1)
        love.graphics.rectangle("fill", (x - 1) * cs, (y - 1) * cs, cs - 1, cs - 1)
      end
    end
  end
end

Effects.register("Automata", Automata)

return Automata
