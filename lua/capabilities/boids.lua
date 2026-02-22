--[[
  capabilities/boids.lua — Boids flocking simulation capability

  This is the canonical example of a TSL-powered capability:

    1. The simulation logic lives in storybook/src/tsl/boids.tsl (TypeScript-like)
    2. `reactjit tsl storybook/src/tsl/boids.tsl -o lua/tsl/boids.lua` transpiles it
    3. This capability loads the generated Lua and uses it in the tick loop
    4. The painter draws every boid as a triangle pointing in its heading direction

  React usage:
    <Boids count={60} speed={1.0} />
    <Boids count={80} speed={1.4} separation={1.2} alignment={0.9} cohesion={1.0} style={{ flexGrow: 1 }} />

  Props:
    count        number   Number of boids (default: 60)
    speed        number   Speed multiplier 0.1–3.0 (default: 1.0)
    separation   number   Separation weight 0–3 (default: 1.5)
    alignment    number   Alignment weight 0–3 (default: 1.0)
    cohesion     number   Cohesion weight 0–3 (default: 1.0)
    running      boolean  Pause/resume (default: true)
    color        table    Boid color {r,g,b,a} or hex string (default: {0.4,0.8,1,0.9})
]]

local Capabilities = require("lua.capabilities")
local GL           = require("lua.sdl2_gl")

-- Load the TSL-transpiled simulation module
local ok, Sim = pcall(require, "lua.tsl.boids")
if not ok then
  io.write("[boids] WARNING: lua/tsl/boids.lua not found — run `reactjit tsl` to generate it\n")
  io.flush()
  Sim = nil
end

-- ── Color parsing ────────────────────────────────────────

local function parseColor(c)
  if not c then return 0.4, 0.8, 1.0, 0.9 end
  if type(c) == "table" then return c[1] or 0.4, c[2] or 0.8, c[3] or 1.0, c[4] or 0.9 end
  if type(c) == "string" and c:sub(1,1) == "#" then
    local function hb(s, i) return tonumber(s:sub(i, i+1), 16) / 255 end
    if #c == 7 then return hb(c,2), hb(c,4), hb(c,6), 1.0 end
    if #c == 9 then return hb(c,2), hb(c,4), hb(c,6), hb(c,8) end
  end
  return 0.4, 0.8, 1.0, 0.9
end

-- ── GL triangle drawing ──────────────────────────────────

-- Draw a small arrow triangle at (bx, by) pointing toward (bx+vx, by+vy).
-- Size is the half-length of the boid body.
local SIZE = 7  -- pixels, half-body length

local function drawBoid(bx, by, vx, vy, r, g, b, a)
  local len = math.sqrt(vx*vx + vy*vy)
  if len < 0.001 then return end
  local nx = vx / len   -- forward unit vector
  local ny = vy / len
  -- Perpendicular
  local px = -ny
  local py =  nx

  -- Triangle: tip = forward, two base corners = back ± perp
  local tx = bx + nx * SIZE
  local ty = by + ny * SIZE
  local lx = bx - nx * (SIZE * 0.5) + px * (SIZE * 0.5)
  local ly = by - ny * (SIZE * 0.5) + py * (SIZE * 0.5)
  local rx = bx - nx * (SIZE * 0.5) - px * (SIZE * 0.5)
  local ry = by - ny * (SIZE * 0.5) - py * (SIZE * 0.5)

  GL.glColor4f(r, g, b, a)
  GL.glBegin(GL.TRIANGLES)
    GL.glVertex2f(tx, ty)
    GL.glVertex2f(lx, ly)
    GL.glVertex2f(rx, ry)
  GL.glEnd()
end

-- ── Capability registration ──────────────────────────────

Capabilities.register("Boids", {
  visual = true,

  schema = {
    count      = { type = "number", default = 60,  min = 1,   max = 500, desc = "Number of boids" },
    speed      = { type = "number", default = 1.0, min = 0.1, max = 3.0, desc = "Speed multiplier" },
    separation = { type = "number", default = 1.5, min = 0,   max = 3.0, desc = "Separation force weight" },
    alignment  = { type = "number", default = 1.0, min = 0,   max = 3.0, desc = "Alignment force weight" },
    cohesion   = { type = "number", default = 1.0, min = 0,   max = 3.0, desc = "Cohesion force weight" },
    running    = { type = "bool",   default = true,              desc = "Pause or resume simulation" },
    color      = { type = "color",  default = "#66CCFF",         desc = "Boid color" },
  },

  events = {},

  create = function(nodeId, props)
    local w = 400  -- will be updated when we know the node's computed size
    local h = 300
    local count = tonumber(props.count) or 60
    local boids = Sim and Sim.init(count, w, h) or {}
    return {
      boids = boids,
      w = w,
      h = h,
      prevCount = count,
    }
  end,

  update = function(nodeId, props, prev, state)
    -- If count changed, reinitialise
    local count = tonumber(props.count) or 60
    if count ~= state.prevCount then
      local boids = Sim and Sim.init(count, state.w, state.h) or {}
      state.boids = boids
      state.prevCount = count
    end
  end,

  destroy = function(nodeId, state)
    state.boids = nil
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if props.running == false then return end
    if not Sim then return end
    if not state.boids or #state.boids == 0 then return end

    -- Keep canvas dimensions in sync with the node's computed layout
    -- (painter sets state.w / state.h before tick, but we also fall back)
    local w = state.w or 400
    local h = state.h or 300

    Sim.update(
      state.boids, dt, w, h,
      tonumber(props.speed)      or 1.0,
      tonumber(props.separation) or 1.5,
      tonumber(props.alignment)  or 1.0,
      tonumber(props.cohesion)   or 1.0
    )
  end,

  -- Called by sdl2_painter.lua after layout is resolved.
  -- nodeId: string, state: capability state, props: data props, c: computed layout rect, opacity: float
  draw = function(nodeId, state, props, c, opacity)
    if not state.boids then return end
    if not c or c.w <= 0 or c.h <= 0 then return end

    -- Sync canvas size so tick() uses correct wrap boundaries
    state.w = c.w
    state.h = c.h

    -- Reinit if canvas changed drastically (window resize)
    -- (boids that were positioned off-screen will wrap naturally, skip reinit)

    local r, g, b, a = parseColor(props.color)
    a = a * (opacity or 1)

    -- Enable blending for smooth alpha
    GL.glEnable(GL.BLEND)
    GL.glBlendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA)

    -- Draw each boid as a filled triangle at its absolute screen position
    for i = 1, #state.boids do
      local boid = state.boids[i]
      drawBoid(c.x + boid.x, c.y + boid.y, boid.vx, boid.vy, r, g, b, a)
    end

    -- Restore default color
    GL.glColor4f(1, 1, 1, 1)
  end,
})
