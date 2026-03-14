--[[
  envelope.lua — ADSR Envelope Generator

  Outputs a control signal (0..1) based on ADSR stages.
  Triggered by MIDI note on/off or manual gate.

  Stages:
    Attack  — ramp from 0 to 1
    Decay   — ramp from 1 to sustain level
    Sustain — hold at sustain level while gate is on
    Release — ramp from current level to 0 after gate off
]]

local Module = require("lua.audio.module")

local SAMPLE_RATE = Module.SAMPLE_RATE

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "envelope",

  ports = {
    control_out = { type = "control", direction = "out" },
    audio_out   = { type = "audio", direction = "out" },
  },

  params = {
    attack  = { type = "float", min = 0.001, max = 10, default = 0.01 },
    decay   = { type = "float", min = 0.001, max = 10, default = 0.15 },
    sustain = { type = "float", min = 0, max = 1, default = 0.6 },
    release = { type = "float", min = 0.001, max = 10, default = 0.4 },
  },

  init = function(self)
    self._state.stage    = "idle"   -- idle, attack, decay, sustain, release
    self._state.level    = 0        -- current envelope value
    self._state.time     = 0        -- time within current stage
    self._state.releaseLevel = 0    -- level when release started
    self._state.gate     = false    -- note is held
  end,

  process = function(self, numSamples, inputs, outputs)
    local outBuf = outputs.audio_out
    local ctrlOut = outputs.control_out

    local a = self.params.attack
    local d = self.params.decay
    local s = self.params.sustain
    local r = self.params.release
    local st = self._state
    local invSR = 1 / SAMPLE_RATE

    for i = 0, numSamples - 1 do
      local level = st.level

      if st.stage == "attack" then
        st.time = st.time + invSR
        if st.time >= a then
          level = 1
          st.stage = "decay"
          st.time = 0
        else
          level = st.time / a
        end

      elseif st.stage == "decay" then
        st.time = st.time + invSR
        if st.time >= d then
          level = s
          st.stage = "sustain"
          st.time = 0
        else
          level = 1 - (1 - s) * (st.time / d)
        end

      elseif st.stage == "sustain" then
        level = s

      elseif st.stage == "release" then
        st.time = st.time + invSR
        if st.time >= r then
          level = 0
          st.stage = "idle"
          st.time = 0
        else
          level = st.releaseLevel * (1 - st.time / r)
        end

      else -- idle
        level = 0
      end

      st.level = level

      -- Write to audio output (envelope as audio signal for AM/etc)
      if outBuf then
        outBuf[i] = level
      end
    end

    -- Write final level to control output
    if ctrlOut then
      ctrlOut.value = st.level
    end
  end,

  onMidiNote = function(self, note, velocity, on)
    local st = self._state
    if on then
      st.stage = "attack"
      st.time = 0
      st.gate = true
    else
      if st.gate then
        st.releaseLevel = st.level
        st.stage = "release"
        st.time = 0
        st.gate = false
      end
    end
  end,
})
