--[[
  capabilities/step_sequencer.lua — Interactive step sequencer

  A Lua-native, click-to-toggle step grid with instant visual feedback.
  All state lives in Lua; pattern updates are immediate.

  React usage:
    <StepSequencer
      steps={16}
      tracks={4}
      pattern={[[true, false, ...], ...]}
      currentStep={2}
      onStepToggle={(track, step, active) => ...}
      trackLabels={['KICK', 'SNARE', 'HAT', 'PERC']}
      trackColors={['#6366f1', '#22c55e', '#f59e0b', '#ec4899']}
    />

  Props:
    steps        number          Number of steps per track (default: 16)
    tracks       number          Number of tracks (default: 1)
    pattern      boolean[][]     2D array [track][step] of active states
    currentStep  number          Highlighted playhead position
    trackLabels  string[]        Label per track
    trackColors  string[]        Hex color per track (default: color wheel)
    stepSize     number          Size of each step box in pixels (default: 24)

  Events:
    onStepToggle  { track, step, active }  User clicked a step
]]

local Capabilities = require("lua.capabilities")
local Color = require("lua.color")
local GL = require("lua.sdl2_gl")

local DEFAULT_COLORS = {
  '#6366f1', '#22c55e', '#f59e0b', '#ec4899',
  '#06b6d4', '#ef4444', '#8b5cf6', '#14b8a6',
}

Capabilities.register("StepSequencer", {
  visual = true,

  schema = {
    steps       = { type = "number", default = 16,  min = 1,   max = 64,  desc = "Number of steps" },
    tracks      = { type = "number", default = 1,   min = 1,   max = 16,  desc = "Number of tracks" },
    pattern     = { type = "table",   desc = "2D array [track][step]" },
    currentStep = { type = "number",  desc = "Playhead position (0-indexed)" },
    trackLabels = { type = "table",   desc = "Array of track label strings" },
    trackColors = { type = "table",   desc = "Array of hex color strings" },
    stepSize    = { type = "number",  default = 24,  min = 8,   max = 64,  desc = "Step box size in pixels" },
  },

  events = { "onStepToggle" },

  create = function(nodeId, props)
    return {
      -- Local copy of pattern for fast access
      localPattern = {},
      -- Hit test cache for click routing
      stepBounds = {},  -- [track][step] = {x, y, w, h}
    }
  end,

  update = function(nodeId, props, prev, state)
    -- Sync pattern from props into local state
    if props.pattern then
      state.localPattern = {}
      for t, track in pairs(props.pattern) do
        state.localPattern[t] = {}
        for s, active in pairs(track) do
          state.localPattern[t][s] = active or false
        end
      end
    end
  end,

  destroy = function(nodeId, state)
    -- Nothing to clean up
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Nothing to do each frame (rendering is handled by painter)
  end,

  -- ── Hit testing ──────────────────────────────────────

  handleClick = function(nodeId, state, mx, my, props, pushEvent)
    if not props.pattern then return false end

    local steps = tonumber(props.steps) or 16
    local tracks = tonumber(props.tracks) or 1
    local node = state._node  -- injected by framework

    if not node or not state.stepBounds then return false end

    -- Check each step's bounds
    for track = 0, tracks - 1 do
      for step = 0, steps - 1 do
        local key = track .. "," .. step
        local bounds = state.stepBounds[key]

        if bounds and mx >= bounds.x and mx < bounds.x + bounds.w
           and my >= bounds.y and my < bounds.y + bounds.h then
          -- Clicked this step
          local trackIndex = track + 1
          local stepIndex = step + 1
          local wasActive = props.pattern[trackIndex] and props.pattern[trackIndex][stepIndex]
          local newActive = not wasActive

          -- Update local pattern immediately (instant feedback)
          if not state.localPattern[trackIndex] then
            state.localPattern[trackIndex] = {}
          end
          state.localPattern[trackIndex][stepIndex] = newActive

          -- Fire event to React
          pushEvent({
            type = "capability",
            payload = {
              targetId = nodeId,
              handler = "onStepToggle",
              track = track,
              step = step,
              active = newActive,
            },
          })

          return true
        end
      end
    end

    return false
  end,

  -- ── Rendering via GL ───────────────────────────────────

  draw = function(nodeId, state, props, c, opacity)
    if not c or c.w <= 0 or c.h <= 0 then return end

    local x, y, w, h = c.x, c.y, c.w, c.h
    local steps = tonumber(props.steps) or 16
    local tracks = tonumber(props.tracks) or 1
    local stepSize = tonumber(props.stepSize) or 24
    local gap = 2

    local labelW = 40
    local pattern = state.localPattern or {}
    local currentStep = tonumber(props.currentStep)

    -- Save GL state
    GL.glPushMatrix()
    GL.glTranslatef(x, y, 0)

    -- Track layout
    local trackX = 0
    local trackY = 0

    for track = 0, tracks - 1 do
      -- Track label color
      local trackColor = props.trackColors and props.trackColors[track + 1]
        or DEFAULT_COLORS[(track % #DEFAULT_COLORS) + 1]
      local trackLabel = props.trackLabels and props.trackLabels[track + 1] or ("T" .. (track + 1))
      local r, g, b, a = Color.parse(trackColor)

      -- Steps for this track
      local stepX = trackX + labelW + gap
      for step = 0, steps - 1 do
        local isActive = pattern[track + 1] and pattern[track + 1][step + 1]
        local isCurrent = currentStep == step
        local isBeat = step % 4 == 0

        -- Determine colors
        local bgR, bgG, bgB, bgA
        if isActive then
          if isCurrent then
            bgR, bgG, bgB, bgA = 1, 0.75, 0.14, 1  -- #fbbf24
          else
            bgR, bgG, bgB, bgA = r, g, b, 1  -- track color
          end
        else
          if isCurrent then
            bgR, bgG, bgB, bgA = 1, 0.75, 0.14, 0.25  -- #fbbf2440
          else
            bgR, bgG, bgB, bgA = 0.12, 0.125, 0.188, 1  -- #1e2030
          end
        end

        -- Draw step box background
        GL.glColor4f(bgR, bgG, bgB, bgA)
        GL.glBegin(GL.QUADS)
          GL.glVertex2f(stepX, trackY)
          GL.glVertex2f(stepX + stepSize, trackY)
          GL.glVertex2f(stepX + stepSize, trackY + stepSize)
          GL.glVertex2f(stepX, trackY + stepSize)
        GL.glEnd()

        -- Draw step box border
        if isCurrent then
          GL.glColor4f(1, 0.75, 0.14, 1)  -- #fbbf24
        elseif isBeat then
          GL.glColor4f(0.18, 0.20, 0.282, 1)  -- #2e3348
        else
          GL.glColor4f(0, 0, 0, 0)  -- transparent
        end
        GL.glLineWidth(1)
        GL.glBegin(GL.LINE_LOOP)
          GL.glVertex2f(stepX, trackY)
          GL.glVertex2f(stepX + stepSize, trackY)
          GL.glVertex2f(stepX + stepSize, trackY + stepSize)
          GL.glVertex2f(stepX, trackY + stepSize)
        GL.glEnd()

        -- Draw beat indicator (small dot on beat steps if not active)
        if isBeat and not isActive then
          GL.glColor4f(0.18, 0.20, 0.282, 1)
          GL.glBegin(GL.TRIANGLE_FAN)
            local cx = stepX + stepSize / 2
            local cy = trackY + stepSize / 2
            local radius = 2
            for i = 0, 7 do
              local angle = (i / 8) * 6.283185
              GL.glVertex2f(cx + radius * math.cos(angle), cy + radius * math.sin(angle))
            end
          GL.glEnd()
        end

        -- Cache bounds for hit testing
        local key = track .. "," .. step
        state.stepBounds[key] = {
          x = x + stepX,
          y = y + trackY,
          w = stepSize,
          h = stepSize,
        }

        stepX = stepX + stepSize + gap
      end

      trackY = trackY + stepSize + gap
    end

    GL.glPopMatrix()
  end,
})
