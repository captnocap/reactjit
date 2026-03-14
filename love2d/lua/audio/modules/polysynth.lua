--[[
  polysynth.lua — Polyphonic Synthesizer Module

  All-in-one polyphonic synth with:
    - Per-voice ADSR envelopes
    - 4 waveforms (sine, saw, square, triangle)
    - Polyphony via keyboard key → voice mapping
    - Octave shift

  This is the "instrument-level" module — contrast with the individual
  oscillator/envelope/amplifier modules which are for modular patching.
  Use this when you want a ready-to-play keyboard synth.
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
-- ADSR envelope
-- ============================================================================

local function getEnvelope(voice, a, d, s, r)
  local t = voice.time

  if voice.released then
    local rt = voice.time - voice.releaseTime
    if rt >= r then
      return 0, true  -- voice is dead
    end
    return voice.releaseEnvelope * (1 - rt / r), false
  end

  if t < a then
    return t / a, false
  end

  if t < a + d then
    return 1 - (1 - s) * ((t - a) / d), false
  end

  return s, false
end

-- ============================================================================
-- Key → MIDI note mapping
-- ============================================================================

local KEY_MAP = {
  z = 48,  x = 50,  c = 52,  v = 53,  b = 55,  n = 57,  m = 59,
  a = 60,  s = 62,  d = 64,  f = 65,  g = 67,  h = 69,  j = 71,  k = 72,
  w = 49,  e = 51,  t = 54,  y = 56,  u = 58,
  ["2"] = 61,  ["3"] = 63,  ["5"] = 66,  ["6"] = 68,  ["7"] = 70,
}

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "polysynth",

  ports = {
    audio_out = { type = "audio", direction = "out" },
  },

  params = {
    waveform    = { type = "enum", values = { "sine", "saw", "square", "triangle" }, default = "saw" },
    attack      = { type = "float", min = 0.001, max = 10, default = 0.01 },
    decay       = { type = "float", min = 0.001, max = 10, default = 0.15 },
    sustain     = { type = "float", min = 0, max = 1, default = 0.6 },
    release     = { type = "float", min = 0.001, max = 10, default = 0.4 },
    volume      = { type = "float", min = 0, max = 1, default = 0.5 },
    octaveShift = { type = "float", min = -36, max = 36, default = 0 },
  },

  init = function(self)
    self._state.voices = {}       -- key -> voice table
    self._state.keyMap = KEY_MAP
  end,

  process = function(self, numSamples, inputs, outputs)
    local buf = outputs.audio_out
    if not buf then return end

    local wf  = self.params.waveform
    local vol = self.params.volume
    local a   = self.params.attack
    local d   = self.params.decay
    local s   = self.params.sustain
    local r   = self.params.release
    local voices = self._state.voices
    local invSR = 1 / SAMPLE_RATE

    for i = 0, numSamples - 1 do
      local sample = 0
      local deadKeys = nil

      for key, voice in pairs(voices) do
        local env, dead = getEnvelope(voice, a, d, s, r)

        if dead then
          if not deadKeys then deadKeys = {} end
          deadKeys[#deadKeys + 1] = key
        else
          voice.envelope = env
          sample = sample + generateSample(voice.phase, wf) * env * voice.velocity
          voice.phase = voice.phase + voice.freq * invSR
          voice.time = voice.time + invSR
        end
      end

      if deadKeys then
        for _, key in ipairs(deadKeys) do
          voices[key] = nil
        end
      end

      sample = sample * vol
      if sample > 1 then sample = 1
      elseif sample < -1 then sample = -1 end
      buf[i] = sample
    end
  end,

  onMidiNote = function(self, note, velocity, on)
    local voices = self._state.voices
    -- Use note as key for MIDI polyphony
    local key = "midi:" .. note
    if on then
      voices[key] = {
        note           = note,
        freq           = Module.midiToFreq(note),
        phase          = 0,
        time           = 0,
        velocity       = velocity / 127,
        released       = false,
        releaseTime    = 0,
        releaseEnvelope = 0,
        envelope       = 0,
      }
    else
      local voice = voices[key]
      if voice and not voice.released then
        voice.released = true
        voice.releaseTime = voice.time
        voice.releaseEnvelope = voice.envelope
      end
    end
  end,
})
