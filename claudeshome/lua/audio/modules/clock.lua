--[[
  clock.lua — Sample-Accurate BPM Clock

  Outputs gate pulses at a configurable tempo and division.
  Tracks beat/bar/step position for UI display.

  Ports:
    gate_out  (control) — 1.0 on tick buffer, 0.0 between
    audio_out (audio)   — sample-accurate gate (1.0 at exact tick sample)

  Swing delays even-numbered ticks by a fraction of the step duration.
  Responds to MIDI start/stop/clock for external sync.
]]

local Module = require("lua.audio.module")

local SAMPLE_RATE = Module.SAMPLE_RATE

-- Division name → beats multiplier (quarter note = 1 beat)
local DIVISIONS = {
  ["1/1"]  = 4,
  ["1/2"]  = 2,
  ["1/4"]  = 1,
  ["1/8"]  = 0.5,
  ["1/16"] = 0.25,
  ["1/32"] = 0.125,
}

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "clock",

  ports = {
    gate_out  = { type = "control", direction = "out" },
    audio_out = { type = "audio",   direction = "out" },
  },

  params = {
    bpm      = { type = "float", min = 20,  max = 300, default = 120 },
    division = { type = "enum",  values = { "1/4", "1/8", "1/16", "1/32", "1/2", "1/1" }, default = "1/8" },
    swing    = { type = "float", min = 0,   max = 1,   default = 0 },
    running  = { type = "bool",  default = false },
  },

  init = function(self)
    self._state.samplePos  = 0     -- cumulative sample position since start
    self._state.tickCount  = 0     -- total ticks fired
    self._state.phase      = 0     -- 0–1 within current tick
    self._state.events     = {}    -- event emission buffer
  end,

  process = function(self, numSamples, inputs, outputs)
    local gateBuf = outputs.audio_out
    local running = self.params.running
    local st      = self._state

    -- Clear audio gate buffer
    if gateBuf then
      Module.clearBuffer(gateBuf, numSamples)
    end

    if not running then
      -- Not running — output silence, gate stays 0
      if outputs.gate_out then
        outputs.gate_out.value = 0
      end
      return
    end

    local bpm      = self.params.bpm
    local division = DIVISIONS[self.params.division] or 0.25
    local swing    = self.params.swing

    -- Samples per tick (one division step)
    local beatsPerSecond = bpm / 60
    local ticksPerSecond = beatsPerSecond / division
    local samplesPerTick = SAMPLE_RATE / ticksPerSecond

    local ticked = false

    for i = 0, numSamples - 1 do
      -- Current tick threshold (with swing on even ticks)
      local currentTick = st.tickCount
      local isEvenTick  = (currentTick % 2 == 0)
      local swingOffset = 0
      if not isEvenTick and swing > 0 then
        swingOffset = swing * samplesPerTick * 0.5
      end

      local tickStart    = currentTick * samplesPerTick + swingOffset
      local nextTickEven = ((currentTick + 1) % 2 == 0)
      local nextSwing    = 0
      if not nextTickEven and swing > 0 then
        nextSwing = swing * samplesPerTick * 0.5
      end
      local nextTickStart = (currentTick + 1) * samplesPerTick + nextSwing

      -- Check if we crossed a tick boundary
      if st.samplePos >= nextTickStart then
        st.tickCount = st.tickCount + 1
        ticked = true

        -- Mark exact sample in audio-rate gate
        if gateBuf then
          gateBuf[i] = 1
        end
      end

      -- Update phase (fractional position within current tick)
      local effectiveSPT = nextTickStart - tickStart
      if effectiveSPT > 0 then
        st.phase = (st.samplePos - tickStart) / effectiveSPT
        if st.phase < 0 then st.phase = 0 end
        if st.phase > 1 then st.phase = 1 end
      end

      st.samplePos = st.samplePos + 1
    end

    -- Control-rate gate: 1 if any tick occurred this buffer, 0 otherwise
    if outputs.gate_out then
      outputs.gate_out.value = ticked and 1 or 0
    end

    -- Push clock tick event to bridge for React
    if ticked then
      local division_val = DIVISIONS[self.params.division] or 0.25
      local stepsPerBeat = 1 / division_val
      local totalStep    = st.tickCount
      local beat         = math.floor(totalStep / stepsPerBeat) % 4
      local bar          = math.floor(totalStep / (stepsPerBeat * 4))
      local step         = totalStep % math.floor(stepsPerBeat * 4)

      st.events[#st.events + 1] = {
        bridge = {
          type = "clock:tick",
          payload = {
            beat = beat,
            bar  = bar,
            step = step,
            bpm  = self.params.bpm,
          },
        },
      }
    end
  end,

  -- Custom state for React UI (beat/bar/step/phase)
  getState = function(self)
    local st = self._state
    local division = DIVISIONS[self.params.division] or 0.25
    local stepsPerBeat = 1 / division
    local totalStep    = st.tickCount
    local beat         = math.floor(totalStep / stepsPerBeat) % 4
    local bar          = math.floor(totalStep / (stepsPerBeat * 4))
    local step         = totalStep % math.floor(stepsPerBeat * 4)

    return {
      clock = {
        beat    = beat,
        bar     = bar,
        step    = step,
        phase   = st.phase,
        running = self.params.running,
      },
    }
  end,

  onMidiNote = function(self, note, velocity, on)
    -- MIDI note can start/stop the clock
    if on then
      self.params.running = true
    end
  end,
})
