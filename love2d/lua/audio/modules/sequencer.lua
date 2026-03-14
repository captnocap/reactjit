--[[
  sequencer.lua — Step Sequencer

  Driven by a clock module's gate output. Steps through a pattern grid
  and triggers notes on target modules via the engine's event system.

  Pattern structure:
    pattern[track][step] = { active, note, velocity }

  Each track has a target module ID. When a step is active, the sequencer
  emits a noteOn event for that track's target. Previous step's notes
  get noteOff events on the next tick.

  Connect clock gate_out → sequencer clock_in to drive stepping.
]]

local Module = require("lua.audio.module")

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "sequencer",

  ports = {
    clock_in = { type = "control", direction = "in" },
    gate_out = { type = "control", direction = "out" },
  },

  params = {
    steps  = { type = "float", min = 1,  max = 64, default = 16 },
    tracks = { type = "float", min = 1,  max = 8,  default = 4 },
  },

  init = function(self)
    -- pattern[track][step] = { active = bool, note = int, velocity = int }
    -- Steps and tracks are 0-indexed internally
    self._state.pattern      = {}
    self._state.trackTargets = {}  -- track (0-indexed) → moduleId
    self._state.currentStep  = 0
    self._state.lastGate     = 0   -- previous gate value (for edge detection)
    self._state.prevNotes    = {}  -- track → { target, note } for pending noteOffs
    self._state.events       = {}
  end,

  process = function(self, numSamples, inputs, outputs)
    local gateIn = inputs.clock_in
    local st     = self._state

    -- Read gate value (control ports are single values)
    local gate = 0
    if type(gateIn) == "number" then
      gate = gateIn
    elseif type(gateIn) == "table" and gateIn.value then
      gate = gateIn.value
    end

    local ticked = false

    -- Rising edge detection: was <= 0.5, now > 0.5
    if gate > 0.5 and st.lastGate <= 0.5 then
      ticked = true

      local steps  = math.floor(self.params.steps)
      local tracks = math.floor(self.params.tracks)

      -- Send noteOff for previous step's active notes
      for track, prev in pairs(st.prevNotes) do
        st.events[#st.events + 1] = {
          type     = "noteOff",
          target   = prev.target,
          note     = prev.note,
          velocity = 0,
        }
      end
      st.prevNotes = {}

      -- Advance step
      st.currentStep = st.currentStep + 1
      if st.currentStep >= steps then
        st.currentStep = 0
      end

      -- Trigger active steps
      for track = 0, tracks - 1 do
        local target = st.trackTargets[track]
        if target then
          local trackPattern = st.pattern[track]
          if trackPattern then
            local stepData = trackPattern[st.currentStep]
            if stepData and stepData.active then
              local note     = stepData.note or 36
              local velocity = stepData.velocity or 100

              st.events[#st.events + 1] = {
                type     = "noteOn",
                target   = target,
                note     = note,
                velocity = velocity,
              }

              -- Remember for noteOff on next tick
              st.prevNotes[track] = { target = target, note = note }
            end
          end
        end
      end
    end

    st.lastGate = gate

    -- Pass gate through to downstream
    if outputs.gate_out then
      outputs.gate_out.value = ticked and 1 or 0
    end
  end,

  -- Custom state for React UI
  getState = function(self)
    local st = self._state

    -- Serialize pattern (convert numeric keys to strings for JSON)
    local pattern = {}
    for track, steps in pairs(st.pattern) do
      pattern[tostring(track)] = {}
      for step, data in pairs(steps) do
        pattern[tostring(track)][tostring(step)] = {
          active   = data.active,
          note     = data.note,
          velocity = data.velocity,
        }
      end
    end

    local targets = {}
    for track, moduleId in pairs(st.trackTargets) do
      targets[tostring(track)] = moduleId
    end

    return {
      sequencer = {
        pattern      = pattern,
        currentStep  = st.currentStep,
        trackTargets = targets,
      },
    }
  end,
})
