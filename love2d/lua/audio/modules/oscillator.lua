--[[
  oscillator.lua — VCO: Voltage Controlled Oscillator

  Waveforms: sine, saw, square, triangle
  Supports FM input, detune, and MIDI note control.
  Polyphonic via multiple instances (one osc per voice).
]]

local Module = require("lua.audio.module")

local SAMPLE_RATE = Module.SAMPLE_RATE
local TWO_PI      = Module.TWO_PI

-- ============================================================================
-- Waveform generators
-- ============================================================================

local function generateSample(phase, wf)
  if wf == "sine" then
    return math.sin(phase * TWO_PI)
  elseif wf == "saw" then
    return 2 * (phase - math.floor(phase + 0.5))
  elseif wf == "square" then
    return (phase % 1) < 0.5 and 1 or -1
  elseif wf == "triangle" then
    return 4 * math.abs(phase - math.floor(phase + 0.5)) - 1
  end
  return 0
end

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "oscillator",

  ports = {
    audio_out = { type = "audio", direction = "out" },
    freq_in   = { type = "control", direction = "in" },
    fm_in     = { type = "audio", direction = "in" },
  },

  params = {
    waveform  = { type = "enum", values = { "sine", "saw", "square", "triangle" }, default = "saw" },
    frequency = { type = "float", min = 20, max = 20000, default = 440 },
    detune    = { type = "float", min = -100, max = 100, default = 0 },
    gain      = { type = "float", min = 0, max = 1, default = 0.8 },
    fmAmount  = { type = "float", min = 0, max = 1000, default = 0 },
  },

  init = function(self)
    self._state.phase = 0
  end,

  process = function(self, numSamples, inputs, outputs)
    local buf = outputs.audio_out
    if not buf then return end

    local wf       = self.params.waveform
    local baseFreq = self.params.frequency
    local detune   = self.params.detune
    local gain     = self.params.gain
    local fmAmt    = self.params.fmAmount
    local phase    = self._state.phase
    local invSR    = 1 / SAMPLE_RATE

    -- Apply control input to frequency if connected
    local freqIn = inputs.freq_in
    if type(freqIn) == "number" and freqIn > 0 then
      baseFreq = freqIn
    end

    -- Detune in cents → frequency multiplier
    local detuneMultiplier = 2 ^ (detune / 1200)
    local freq = baseFreq * detuneMultiplier

    local fmBuf = inputs.fm_in  -- audio-rate FM input

    for i = 0, numSamples - 1 do
      local currentFreq = freq

      -- Apply FM modulation if connected
      if fmBuf then
        currentFreq = freq + fmBuf[i] * fmAmt
        if currentFreq < 0 then currentFreq = 0 end
      end

      buf[i] = generateSample(phase, wf) * gain
      phase = phase + currentFreq * invSR

      -- Keep phase in [0, 1) to avoid float precision loss
      if phase >= 1 then phase = phase - math.floor(phase) end
    end

    self._state.phase = phase
  end,

  onMidiNote = function(self, note, velocity, on)
    if on then
      self.params.frequency = Module.midiToFreq(note)
      self.params.gain = velocity / 127
    end
  end,

  onMidiCC = function(self, cc, value)
    -- CC1 (mod wheel) → FM amount
    if cc == 1 then
      self.params.fmAmount = value / 127 * 1000
    end
  end,
})
