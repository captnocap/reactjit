--[[
  capabilities/reagent_test.lua — Reagent color-change test visualization

  Renders a circular "well" that transitions through color intermediates
  in real time, exactly like a physical spot test. Each reagent type has
  its own color database keyed by compound name.

  React usage:
    <ReagentTest type="marquis" sample="MDMA" />
    <ReagentTest type="ehrlich" sample="LSD" animated showMechanism />
    <ReagentTest type="simons" sample="Methamphetamine"
      onReactionComplete={(e) => console.log(e.color, e.description)} />

  Props:
    type          string   Reagent name: marquis, mecke, mandelin, simons, ehrlich, etc.
    sample        string   Compound to test
    animated      boolean  Animate color transition (default: true)
    speed         number   Animation speed multiplier (default: 1.0)

  Events:
    onReactionStart     { reagent, sample }
    onReactionComplete  { reagent, sample, color, description, confidence }
]]

local Capabilities = require("lua.capabilities")
local ColorUtils = require("lua.color")

-- ============================================================================
-- Color reaction databases
-- Each: compound -> { final, description, timeMs, intermediates[] }
-- ============================================================================

local MARQUIS = {
  MDMA            = { final = {0.10,0.04,0.18,1}, desc = "Deep purple to black", timeMs = 3000, inters = {{0.96,0.96,0.86,1},{0.58,0.44,0.86,1},{0.29,0.00,0.51,1},{0.10,0.04,0.18,1}} },
  MDA             = { final = {0.10,0.04,0.18,1}, desc = "Black/dark purple",    timeMs = 2500, inters = {{0.96,0.96,0.86,1},{0.55,0.00,0.55,1},{0.18,0.00,0.28,1},{0.10,0.04,0.18,1}} },
  Amphetamine     = { final = {0.55,0.27,0.07,1}, desc = "Orange to reddish-brown", timeMs = 4000, inters = {{0.96,0.96,0.86,1},{1.00,0.65,0.00,1},{1.00,0.39,0.28,1},{0.55,0.27,0.07,1}} },
  Methamphetamine = { final = {1.00,0.27,0.00,1}, desc = "Orange to dark orange",   timeMs = 3500, inters = {{0.96,0.96,0.86,1},{1.00,0.84,0.00,1},{1.00,0.55,0.00,1},{1.00,0.27,0.00,1}} },
  Heroin          = { final = {0.50,0.00,0.50,1}, desc = "Purple",                  timeMs = 2000, inters = {{0.96,0.96,0.86,1},{0.87,0.63,0.87,1},{0.60,0.20,0.80,1},{0.50,0.00,0.50,1}} },
  Morphine        = { final = {0.50,0.00,0.50,1}, desc = "Deep purple",             timeMs = 2500, inters = {{0.96,0.96,0.86,1},{0.85,0.44,0.84,1},{0.58,0.00,0.83,1},{0.50,0.00,0.50,1}} },
  Codeine         = { final = {0.50,0.00,0.50,1}, desc = "Deep purple",             timeMs = 3000, inters = {{0.96,0.96,0.86,1},{0.93,0.51,0.93,1},{0.60,0.20,0.80,1},{0.50,0.00,0.50,1}} },
  Cocaine         = { final = {0.96,0.96,0.86,1}, desc = "No reaction",             timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
  LSD             = { final = {0.50,0.50,0.00,1}, desc = "Olive to black",          timeMs = 5000, inters = {{0.96,0.96,0.86,1},{0.74,0.72,0.42,1},{0.50,0.50,0.00,1},{0.18,0.31,0.31,1}} },
  Aspirin         = { final = {1.00,0.39,0.28,1}, desc = "Reddish",                 timeMs = 2000, inters = {{0.96,0.96,0.86,1},{1.00,0.63,0.48,1},{1.00,0.39,0.28,1}} },
  Sugar           = { final = {0.96,0.96,0.86,1}, desc = "No significant reaction", timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
  Caffeine        = { final = {0.96,0.96,0.86,1}, desc = "No significant reaction", timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
}

local MECKE = {
  MDMA            = { final = {0.00,0.39,0.00,1}, desc = "Blue-green to dark green", timeMs = 3000, inters = {{0.96,0.96,0.86,1},{0.13,0.70,0.67,1},{0.00,0.50,0.50,1},{0.00,0.39,0.00,1}} },
  MDA             = { final = {0.00,0.39,0.00,1}, desc = "Green to blue-green",      timeMs = 2500, inters = {{0.96,0.96,0.86,1},{0.24,0.70,0.44,1},{0.18,0.55,0.34,1},{0.00,0.39,0.00,1}} },
  Heroin          = { final = {0.00,0.39,0.00,1}, desc = "Deep blue-green",          timeMs = 2000, inters = {{0.96,0.96,0.86,1},{0.40,0.80,0.67,1},{0.18,0.55,0.34,1},{0.00,0.39,0.00,1}} },
  Morphine        = { final = {0.00,0.39,0.00,1}, desc = "Deep green",               timeMs = 2500, inters = {{0.96,0.96,0.86,1},{0.56,0.93,0.56,1},{0.13,0.55,0.13,1},{0.00,0.39,0.00,1}} },
  Cocaine         = { final = {0.50,0.50,0.00,1}, desc = "Slow olive green",         timeMs = 8000, inters = {{0.96,0.96,0.86,1},{0.74,0.72,0.42,1},{0.50,0.50,0.00,1}} },
  Amphetamine     = { final = {0.96,0.96,0.86,1}, desc = "No reaction",              timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
  Methamphetamine = { final = {0.96,0.96,0.86,1}, desc = "No reaction",              timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
  LSD             = { final = {0.55,0.27,0.07,1}, desc = "Brownish-black",           timeMs = 4000, inters = {{0.96,0.96,0.86,1},{0.82,0.71,0.55,1},{0.65,0.32,0.17,1},{0.55,0.27,0.07,1}} },
}

local MANDELIN = {
  MDMA            = { final = {0.10,0.04,0.18,1}, desc = "Black",                    timeMs = 2000, inters = {{0.96,0.96,0.86,1},{0.41,0.41,0.41,1},{0.18,0.18,0.18,1},{0.10,0.04,0.18,1}} },
  MDA             = { final = {0.10,0.04,0.18,1}, desc = "Black to dark green",      timeMs = 2500, inters = {{0.96,0.96,0.86,1},{0.33,0.42,0.18,1},{0.18,0.31,0.31,1},{0.10,0.04,0.18,1}} },
  Amphetamine     = { final = {0.00,0.39,0.00,1}, desc = "Dark green",               timeMs = 3000, inters = {{0.96,0.96,0.86,1},{0.56,0.74,0.56,1},{0.18,0.55,0.34,1},{0.00,0.39,0.00,1}} },
  Methamphetamine = { final = {0.00,0.39,0.00,1}, desc = "Green",                    timeMs = 3500, inters = {{0.96,0.96,0.86,1},{0.56,0.93,0.56,1},{0.20,0.80,0.20,1},{0.00,0.39,0.00,1}} },
  Cocaine         = { final = {1.00,0.55,0.00,1}, desc = "Orange",                   timeMs = 2000, inters = {{0.96,0.96,0.86,1},{1.00,0.84,0.00,1},{1.00,0.55,0.00,1}} },
  Ketamine        = { final = {1.00,0.27,0.00,1}, desc = "Orange",                   timeMs = 2000, inters = {{0.96,0.96,0.86,1},{1.00,0.65,0.00,1},{1.00,0.27,0.00,1}} },
}

local SIMONS = {
  MDMA            = { final = {0.00,0.00,0.55,1}, desc = "Blue (secondary amine)",   timeMs = 1500, inters = {{0.96,0.96,0.86,1},{0.53,0.81,0.92,1},{0.25,0.41,0.88,1},{0.00,0.00,0.55,1}} },
  Methamphetamine = { final = {0.00,0.00,0.55,1}, desc = "Blue (secondary amine)",   timeMs = 1500, inters = {{0.96,0.96,0.86,1},{0.53,0.81,0.92,1},{0.25,0.41,0.88,1},{0.00,0.00,0.55,1}} },
  MDA             = { final = {0.96,0.96,0.86,1}, desc = "No reaction (primary amine)", timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
  Amphetamine     = { final = {0.96,0.96,0.86,1}, desc = "No reaction (primary amine)", timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
}

local EHRLICH = {
  LSD             = { final = {0.50,0.00,0.50,1}, desc = "Purple (indole ring)",     timeMs = 5000, inters = {{0.96,0.96,0.86,1},{0.87,0.63,0.87,1},{0.73,0.33,0.83,1},{0.50,0.00,0.50,1}} },
  Psilocybin      = { final = {0.50,0.00,0.50,1}, desc = "Purple (indole ring)",     timeMs = 8000, inters = {{0.96,0.96,0.86,1},{0.93,0.51,0.93,1},{0.60,0.20,0.80,1},{0.50,0.00,0.50,1}} },
  DMT             = { final = {0.50,0.00,0.50,1}, desc = "Purple to pink-purple",    timeMs = 3000, inters = {{0.96,0.96,0.86,1},{1.00,0.41,0.71,1},{0.78,0.08,0.52,1},{0.50,0.00,0.50,1}} },
  Tryptophan      = { final = {0.87,0.63,0.87,1}, desc = "Light purple (indole)",    timeMs = 6000, inters = {{0.96,0.96,0.86,1},{0.90,0.90,0.98,1},{0.87,0.63,0.87,1}} },
  MDMA            = { final = {0.96,0.96,0.86,1}, desc = "No reaction (no indole)",  timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
  Cocaine         = { final = {0.96,0.96,0.86,1}, desc = "No reaction",              timeMs = 1000, inters = {{0.96,0.96,0.86,1}} },
}

local REAGENT_DBS = {
  marquis  = MARQUIS,
  mecke    = MECKE,
  mandelin = MANDELIN,
  simons   = SIMONS,
  ehrlich  = EHRLICH,
}

-- ============================================================================
-- Color interpolation (RGBA lerp)
-- ============================================================================

local function lerpColor(a, b, t)
  return {
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
    a[4] + (b[4] - a[4]) * t,
  }
end

local function getAnimColor(inters, progress)
  local n = #inters
  if n == 0 then return {0.96, 0.96, 0.86, 1} end
  if n == 1 or progress <= 0 then return inters[1] end
  if progress >= 1 then return inters[n] end

  local segment = progress * (n - 1)
  local idx = math.floor(segment)
  local frac = segment - idx
  local a = inters[idx + 1]
  local b = inters[math.min(idx + 2, n)]
  return lerpColor(a, b, frac)
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("ReagentTest", {
  visual = true,

  schema = {
    type     = { type = "string", default = "marquis", desc = "Reagent type: marquis, mecke, mandelin, simons, ehrlich" },
    sample   = { type = "string", default = "", desc = "Compound name to test" },
    animated = { type = "bool",   default = true, desc = "Animate color transition" },
    speed    = { type = "number", default = 1.0, desc = "Animation speed multiplier" },
  },

  events = { "onReactionStart", "onReactionComplete" },

  create = function(nodeId, props)
    local db = REAGENT_DBS[props.type]
    local reaction = db and db[props.sample] or nil
    return {
      elapsed = 0,
      started = false,
      completed = false,
      currentColor = {0.96, 0.96, 0.86, 1}, -- baseline beige
      reaction = reaction,
      prevType = props.type,
      prevSample = props.sample,
    }
  end,

  update = function(nodeId, props, prev, state)
    -- Reset animation when reagent or sample changes
    if props.type ~= state.prevType or props.sample ~= state.prevSample then
      state.elapsed = 0
      state.started = false
      state.completed = false
      state.currentColor = {0.96, 0.96, 0.86, 1}
      state.prevType = props.type
      state.prevSample = props.sample

      local db = REAGENT_DBS[props.type]
      state.reaction = db and db[props.sample] or nil
    end
  end,

  destroy = function(nodeId, state) end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local rxn = state.reaction
    if not rxn then return end
    if state.completed then return end

    local speed = props.speed or 1.0
    local animated = props.animated ~= false

    -- Fire start event
    if not state.started and pushEvent then
      state.started = true
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onReactionStart", reagent = props.type, sample = props.sample },
      })
    end

    -- Advance animation
    if animated then
      state.elapsed = state.elapsed + dt * speed * 1000
    else
      state.elapsed = rxn.timeMs
    end

    local progress = math.min(state.elapsed / rxn.timeMs, 1.0)
    state.currentColor = getAnimColor(rxn.inters, progress)

    -- Fire complete event
    if progress >= 1.0 and not state.completed and pushEvent then
      state.completed = true
      local noReaction = (#rxn.inters <= 1)
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onReactionComplete",
          reagent = props.type,
          sample = props.sample,
          color = string.format("#%02x%02x%02x",
            math.floor(rxn.final[1] * 255),
            math.floor(rxn.final[2] * 255),
            math.floor(rxn.final[3] * 255)),
          description = rxn.desc,
          confidence = noReaction and 0 or 0.65,
        },
      })
    end
  end,

  render = function(node, c, opacity)
    local state = Capabilities._instances and Capabilities._instances[node.id]
    if not state then return end
    state = state.state

    local x, y, w, h = c.x, c.y, c.w, c.h
    local cx, cy = x + w / 2, y + h / 2
    local radius = math.min(w, h) / 2 - 4

    -- Well shadow
    love.graphics.setColor(0, 0, 0, 0.3 * opacity)
    love.graphics.circle("fill", cx + 2, cy + 2, radius)

    -- Well background (white ceramic)
    love.graphics.setColor(0.95, 0.95, 0.92, opacity)
    love.graphics.circle("fill", cx, cy, radius)

    -- Reaction liquid
    local col = state.currentColor
    if col then
      -- Inner liquid circle (slightly smaller)
      love.graphics.setColor(col[1], col[2], col[3], col[4] * opacity)
      love.graphics.circle("fill", cx, cy, radius * 0.85)

      -- Subtle radial gradient effect: darker center
      love.graphics.setColor(col[1] * 0.7, col[2] * 0.7, col[3] * 0.7, 0.3 * opacity)
      love.graphics.circle("fill", cx, cy, radius * 0.4)
    end

    -- Well rim
    love.graphics.setColor(0.6, 0.6, 0.58, opacity)
    love.graphics.setLineWidth(2)
    love.graphics.circle("line", cx, cy, radius)

    -- Label below
    local props = node.props or {}
    local label = (props.type or ""):upper()
    if label ~= "" then
      love.graphics.setColor(0.7, 0.7, 0.7, opacity)
      local font = love.graphics.getFont()
      local tw = font:getWidth(label)
      love.graphics.print(label, cx - tw / 2, y + h - 14)
    end
  end,
})
