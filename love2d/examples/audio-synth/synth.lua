--[[
  synth.lua — Real-time polyphonic synthesizer for Love2D

  Uses QueueableSource for streaming audio generation.
  Supports sine, sawtooth, square, and triangle waveforms
  with per-voice ADSR envelopes.

  Keyboard mapping follows the standard two-row piano layout:
    Bottom row (Z-M):  C3–B3 white keys
    Middle row (A-K):  C4–C5 white keys
    Sharps on W,E,T,Y,U and 2,3,5,6,7
]]

local Synth = {}

-- ============================================================================
-- Constants
-- ============================================================================

local SAMPLE_RATE  = 44100
local BUFFER_SIZE  = 512    -- ~11.6ms per buffer
local BUFFER_COUNT = 4      -- total latency ~46ms worst case
local BIT_DEPTH    = 16
local CHANNELS     = 1

local TWO_PI = 2 * math.pi

-- ============================================================================
-- State
-- ============================================================================

local source       = nil    -- QueueableSource
local voices       = {}     -- key -> voice table
local waveform     = "saw"  -- sine, saw, square, triangle
local masterVolume = 0.5
local octaveShift  = 0      -- semitones added (in multiples of 12)

local adsr = {
  attack  = 0.01,
  decay   = 0.15,
  sustain = 0.6,
  release = 0.4,
}

-- ============================================================================
-- Key → MIDI note mapping (base octave, before octaveShift)
-- ============================================================================

-- White keys: bottom row = C3..B3, middle row = C4..C5
-- Black keys: number row sharps + QWERTY row sharps
local KEY_MAP = {
  -- Bottom row: C3 (48) through B3 (59), white keys only
  z = 48,  x = 50,  c = 52,  v = 53,  b = 55,  n = 57,  m = 59,

  -- Middle row: C4 (60) through C5 (72), white keys only
  a = 60,  s = 62,  d = 64,  f = 65,  g = 67,  h = 69,  j = 71,  k = 72,

  -- Black keys for bottom row (QWERTY row)
  w = 49,  e = 51,  t = 54,  y = 56,  u = 58,

  -- Black keys for middle row (number row)
  ["2"] = 61,  ["3"] = 63,  ["5"] = 66,  ["6"] = 68,  ["7"] = 70,
}

-- Reverse lookup: MIDI note -> list of keys (for UI state)
local NOTE_KEYS = {}
for key, note in pairs(KEY_MAP) do
  if not NOTE_KEYS[note] then NOTE_KEYS[note] = {} end
  NOTE_KEYS[note][#NOTE_KEYS[note] + 1] = key
end

-- ============================================================================
-- Helpers
-- ============================================================================

--- Convert MIDI note number to frequency in Hz.
local function midiToFreq(note)
  return 440 * 2 ^ ((note - 69) / 12)
end

--- Generate a single sample for the given phase (0..1 repeating).
local function generateSample(phase, wf)
  if wf == "sine" then
    return math.sin(phase * TWO_PI)
  elseif wf == "saw" then
    -- Naive sawtooth: ramps from -1 to +1
    return 2 * (phase - math.floor(phase + 0.5))
  elseif wf == "square" then
    return (phase % 1) < 0.5 and 1 or -1
  elseif wf == "triangle" then
    return 4 * math.abs(phase - math.floor(phase + 0.5)) - 1
  end
  return 0
end

--- Compute ADSR envelope value for a voice.
--- Returns (envelope, isDead).
local function getEnvelope(voice)
  local t = voice.time
  local a, d, s, r = adsr.attack, adsr.decay, adsr.sustain, adsr.release

  if voice.released then
    local rt = voice.time - voice.releaseTime
    if rt >= r then
      return 0, true  -- voice is dead
    end
    -- Fade from whatever envelope level we had at release
    return voice.releaseEnvelope * (1 - rt / r), false
  end

  -- Attack phase
  if t < a then
    return t / a, false
  end

  -- Decay phase
  if t < a + d then
    return 1 - (1 - s) * ((t - a) / d), false
  end

  -- Sustain phase
  return s, false
end

-- ============================================================================
-- Public API
-- ============================================================================

function Synth.init()
  local ok, src = pcall(love.audio.newQueueableSource, SAMPLE_RATE, BIT_DEPTH, CHANNELS, BUFFER_COUNT)
  if ok and src then
    source = src
    -- Don't play yet — play after first buffers are queued in update()
    print("[synth] Audio initialized: " .. SAMPLE_RATE .. "Hz, " .. BUFFER_SIZE .. " samples/buffer, " .. BUFFER_COUNT .. " buffers")
  else
    print("[synth] Audio not available (headless mode?) — running without sound")
    if not ok then print("[synth] Error: " .. tostring(src)) end
  end
end

--- Trigger a note from a keyboard key.
function Synth.noteOn(key)
  local baseNote = KEY_MAP[key]
  if not baseNote then return false end

  local note = baseNote + octaveShift

  -- If this key is already sounding, restart it
  voices[key] = {
    note           = note,
    freq           = midiToFreq(note),
    phase          = 0,
    time           = 0,
    velocity       = 1.0,
    released       = false,
    releaseTime    = 0,
    releaseEnvelope = 0,
    envelope       = 0,
  }

  return true
end

--- Release a note.
function Synth.noteOff(key)
  local voice = voices[key]
  if voice and not voice.released then
    voice.released = true
    voice.releaseTime = voice.time
    voice.releaseEnvelope = voice.envelope
  end
end

--- Generate audio buffers and feed them to the QueueableSource.
--- Call this every frame in love.update().
function Synth.update(dt)
  if not source then return end

  local wf = waveform
  local vol = masterVolume
  local invSR = 1 / SAMPLE_RATE
  local queued = false

  while source:getFreeBufferCount() > 0 do
    local soundData = love.sound.newSoundData(BUFFER_SIZE, SAMPLE_RATE, BIT_DEPTH, CHANNELS)

    for i = 0, BUFFER_SIZE - 1 do
      local sample = 0
      local deadKeys = nil

      for key, voice in pairs(voices) do
        local env, dead = getEnvelope(voice)

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

      -- Remove dead voices
      if deadKeys then
        for _, key in ipairs(deadKeys) do
          voices[key] = nil
        end
      end

      -- Soft clamp and write
      sample = sample * vol
      if sample > 1 then sample = 1
      elseif sample < -1 then sample = -1 end
      soundData:setSample(i, sample)
    end

    source:queue(soundData)
    queued = true
  end

  -- Ensure the source is playing after we've queued buffers.
  -- play() is a no-op when already playing, but recovers from underruns.
  if queued and not source:isPlaying() then
    source:play()
  end
end

--- Set the active waveform ("sine", "saw", "square", "triangle").
function Synth.setWaveform(wf)
  if wf == "sine" or wf == "saw" or wf == "square" or wf == "triangle" then
    waveform = wf
  end
end

--- Set ADSR envelope parameters.
function Synth.setADSR(a, d, s, r)
  if a then adsr.attack  = math.max(0.001, a) end
  if d then adsr.decay   = math.max(0.001, d) end
  if s then adsr.sustain  = math.max(0, math.min(1, s)) end
  if r then adsr.release = math.max(0.001, r) end
end

--- Set master volume (0..1).
function Synth.setVolume(v)
  masterVolume = math.max(0, math.min(1, v))
end

--- Shift octave up or down.
function Synth.shiftOctave(direction)
  octaveShift = octaveShift + (direction * 12)
  -- Clamp to reasonable range (C1..C7)
  if octaveShift < -36 then octaveShift = -36 end
  if octaveShift > 36 then octaveShift = 36 end
end

--- Get the current state for UI display.
--- Returns a table suitable for JSON serialization.
function Synth.getState()
  local activeNotes = {}
  for key, voice in pairs(voices) do
    activeNotes[key] = {
      note     = voice.note,
      envelope = voice.envelope,
    }
  end

  return {
    waveform    = waveform,
    attack      = adsr.attack,
    decay       = adsr.decay,
    sustain     = adsr.sustain,
    release     = adsr.release,
    volume      = masterVolume,
    octaveShift = octaveShift,
    activeNotes = activeNotes,
  }
end

--- Get the key map (for UI to know which keys map to which notes).
function Synth.getKeyMap()
  return KEY_MAP
end

return Synth
