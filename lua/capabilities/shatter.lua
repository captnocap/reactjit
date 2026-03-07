--[[
  capabilities/shatter.lua — Shatter button animation behavior

  Composes spring + time + math into per-block transforms.
  Writes all animated values as latches. React reads them straight into style.

  React usage:
    <Native type="ShatterButton" id="btn1" trigger={n} hueBase={258} />

  Props:
    id        string   Latch namespace (e.g. "btn1")
    trigger   number   Increment to fire the animation (from React press handler)
    hueBase   number   HSL hue base for block colors (default: 0)

  Latches written (ns = "shatter:" .. id):
    ns:animating          1 while animating, 0 at rest
    ns:buttonOp           opacity of the solid button (crossfades with blocks)
    ns:textOp             opacity of the scatter-phase text overlay
    ns:block:N:x          left position of block N
    ns:block:N:y          top position of block N
    ns:block:N:rot        rotation of block N (degrees)
    ns:block:N:op         opacity of block N
    ns:block:N:sz         size of block N (px)
    ns:block:N:hue        HSL hue of block N
    ns:block:N:lit        HSL lightness of block N
]]

local Capabilities = require("lua.capabilities")
local Latches      = require("lua.latches")

-- Button grid constants (must match React side)
local SH_W   = 160
local SH_H   = 40
local SH_BS  = 20
local SH_COLS = SH_W / SH_BS   -- 8
local SH_ROWS = SH_H / SH_BS   -- 2
local N_BLOCKS = SH_COLS * SH_ROWS  -- 16

-- Deterministic pseudo-random (mirrors JS srand)
local function srand(s)
  local x = math.sin(s + 1) * 10000
  return x - math.floor(x)
end

-- Precompute static block data (home + scatter positions, stagger delay)
local BLOCKS = {}
for r = 0, SH_ROWS - 1 do
  for c = 0, SH_COLS - 1 do
    local i = r * SH_COLS + c
    local hx = c * SH_BS
    local hy = r * SH_BS
    local dx = (hx + SH_BS / 2 - SH_W / 2) / (SH_W / 2)
    BLOCKS[i + 1] = {
      hx = hx, hy = hy,
      sx = hx + dx * (40 + srand(i * 3 + 1) * 60),
      sy = hy + 30 + srand(i * 3 + 2) * 70,
      sr = (srand(i * 3 + 3) - 0.5) * 400,
      d  = 0.02 + srand(i * 7) * 0.13,
    }
  end
end

-- Spring constants
local STIFFNESS = 120
local DAMPING   = 10
local AUTO_RESET_SEC = 1.4

Capabilities.register("ShatterButton", {
  visual = false,

  schema = {
    id      = { type = "string", desc = "Latch namespace" },
    trigger = { type = "number", default = 0, desc = "Increment to fire animation" },
    hueBase = { type = "number", default = 0, desc = "HSL hue base for block colors" },
  },

  create = function(nodeId, props)
    return {
      pos      = 0,    -- spring position
      vel      = 0,    -- spring velocity
      active   = false,
      timer    = 0,
      prevTrigger = props.trigger or 0,
    }
  end,

  update = function(nodeId, props, prev, state)
    -- Fire animation when trigger increments
    local trigger = props.trigger or 0
    if trigger ~= state.prevTrigger then
      state.prevTrigger = trigger
      if not state.active then
        state.active = true
        state.timer  = 0
      end
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local id = props.id or tostring(nodeId)
    local ns = "shatter:" .. id
    io.write("[shatter] tick nodeId=" .. tostring(nodeId) .. " id=" .. tostring(id) .. " active=" .. tostring(state.active) .. " pos=" .. string.format("%.3f", state.pos) .. "\n")
    io.flush()

    -- Auto-reset timer
    if state.active then
      state.timer = state.timer + dt
      if state.timer >= AUTO_RESET_SEC then
        state.active = false
        state.timer  = 0
      end
    end

    -- Semi-implicit Euler spring integration
    local target = state.active and 1 or 0
    local force  = STIFFNESS * (target - state.pos) - DAMPING * state.vel
    state.vel    = state.vel + force * dt
    state.pos    = state.pos + state.vel * dt

    local prog     = state.pos
    local animating = prog > 0.005

    -- Global latches
    Latches.set(ns .. ":animating", animating and 1 or 0)
    Latches.set(ns .. ":buttonOp", math.max(0, 1 - prog * 10))
    Latches.set(ns .. ":textOp",   state.active and math.max(0, 1 - prog * 5) or 0)

    -- Per-block latches
    local blockOp = math.min(1, prog * 10)
    local hueBase = props.hueBase or 0

    for i, b in ipairs(BLOCKS) do
      local bp  = math.max(0, math.min(1, (prog - b.d) / (1 - b.d)))
      local x   = b.hx + (b.sx - b.hx) * bp
      local y   = b.hy + (b.sy - b.hy) * bp
      local rot = b.sr * bp
      local lit = 55 + bp * 15
      local sz  = bp < 0.08 and SH_BS or (SH_BS - 1)
      local hue = hueBase + ((i - 1) / N_BLOCKS) * 30
      local prefix = ns .. ":block:" .. i
      Latches.set(prefix .. ":x",   x)
      Latches.set(prefix .. ":y",   y)
      Latches.set(prefix .. ":rot", rot)
      Latches.set(prefix .. ":op",  animating and blockOp or 0)
      Latches.set(prefix .. ":sz",  sz)
      Latches.set(prefix .. ":hue", hue)
      Latches.set(prefix .. ":lit", lit)
    end
  end,

  destroy = function(nodeId, state) end,
})
