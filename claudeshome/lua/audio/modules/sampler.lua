--[[
  sampler.lua — Multi-Slot Sample Player

  Loads audio files (.wav, .ogg, .mp3) into up to 16 slots.
  Plays them back on MIDI note triggers with pitch shifting and velocity.

  Slot assignment:
    MIDI note 36 = slot 1, note 37 = slot 2, ..., note 51 = slot 16
    (GM drum map starting at C2)

  Pitch shifting:
    Base pitch is the original sample rate. MIDI note 60 (C4) plays at 1x.
    Higher notes play faster (higher pitch), lower notes play slower.
    Pitch = 2^((note - 60) / 12) relative to base rate.

  Modes:
    "oneshot" — plays through once then stops (default)
    "loop"    — loops until noteOff

  Samples can be loaded via RPC (audio:loadSample) or injected directly
  from the recording system (Engine.recordIntoSlot).
]]

local Module = require("lua.audio.module")

local SAMPLE_RATE = Module.SAMPLE_RATE
local MAX_SLOTS   = 16
local BASE_NOTE   = 36   -- MIDI note for slot 1
local PITCH_NOTE  = 60   -- MIDI note that plays at original pitch

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "sampler",

  ports = {
    audio_out = { type = "audio", direction = "out" },
  },

  params = {
    gain = { type = "float", min = 0, max = 2, default = 1 },
  },

  init = function(self)
    -- slots[1..16] = { soundData, sampleCount, sampleRate, name, mode } or nil
    self._state.slots  = {}
    -- Active playback voices: list of { slot, position, rate, velocity, active, looping }
    self._state.voices = {}
  end,

  process = function(self, numSamples, inputs, outputs)
    local buf    = outputs.audio_out
    if not buf then return end

    local gain   = self.params.gain
    local slots  = self._state.slots
    local voices = self._state.voices

    -- Clear output
    Module.clearBuffer(buf, numSamples)

    -- No active voices? done.
    if #voices == 0 then return end

    local deadVoices = nil

    for v = 1, #voices do
      local voice = voices[v]
      if voice.active then
        local slot = slots[voice.slot]
        if not slot or not slot.soundData then
          voice.active = false
        else
          local sd         = slot.soundData
          local sc         = slot.sampleCount
          local rate       = voice.rate
          local vel        = voice.velocity
          local pos        = voice.position

          for i = 0, numSamples - 1 do
            local idx = math.floor(pos)

            if idx >= sc then
              if voice.looping then
                pos = pos - sc
                idx = math.floor(pos)
              else
                voice.active = false
                break
              end
            end

            -- Linear interpolation between samples
            local frac = pos - idx
            local s0 = sd:getSample(idx)
            local s1 = (idx + 1 < sc) and sd:getSample(idx + 1) or s0
            local sample = s0 + (s1 - s0) * frac

            buf[i] = buf[i] + sample * vel * gain

            pos = pos + rate
          end

          voice.position = pos
        end
      end

      if not voice.active then
        if not deadVoices then deadVoices = {} end
        deadVoices[#deadVoices + 1] = v
      end
    end

    -- Remove dead voices (iterate in reverse to keep indices valid)
    if deadVoices then
      for i = #deadVoices, 1, -1 do
        table.remove(voices, deadVoices[i])
      end
    end
  end,

  onMidiNote = function(self, note, velocity, on)
    local slotNum = note - BASE_NOTE + 1
    if slotNum < 1 or slotNum > MAX_SLOTS then return end

    local slot = self._state.slots[slotNum]
    if not slot or not slot.soundData then return end

    if on then
      -- Calculate playback rate: pitch shift + sample rate conversion
      local pitchRatio = 2 ^ ((note - PITCH_NOTE) / 12)
      local rateRatio  = slot.sampleRate / SAMPLE_RATE
      local rate       = pitchRatio * rateRatio

      local voice = {
        slot     = slotNum,
        position = 0,
        rate     = rate,
        velocity = velocity / 127,
        active   = true,
        looping  = (slot.mode == "loop"),
        note     = note,
      }

      self._state.voices[#self._state.voices + 1] = voice
    else
      -- Note off: stop looping voices for this slot
      for _, voice in ipairs(self._state.voices) do
        if voice.slot == slotNum and voice.looping and voice.active then
          voice.active = false
        end
      end
    end
  end,

  -- Custom state for React UI
  getState = function(self)
    local slotInfo = {}
    for i = 1, MAX_SLOTS do
      local slot = self._state.slots[i]
      if slot then
        slotInfo[i] = {
          name       = slot.name,
          duration   = slot.sampleCount / slot.sampleRate,
          sampleRate = slot.sampleRate,
          mode       = slot.mode,
        }
      end
    end

    local voiceInfo = {}
    for _, voice in ipairs(self._state.voices) do
      if voice.active then
        local slot = self._state.slots[voice.slot]
        local duration = slot and (slot.sampleCount / slot.sampleRate) or 0
        voiceInfo[#voiceInfo + 1] = {
          slot     = voice.slot,
          position = voice.position / SAMPLE_RATE,
          duration = duration,
        }
      end
    end

    return {
      sampler = {
        slots  = slotInfo,
        voices = voiceInfo,
      },
    }
  end,
})
