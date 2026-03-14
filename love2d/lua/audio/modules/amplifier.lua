--[[
  amplifier.lua — VCA: Voltage Controlled Amplifier

  Gain control with optional panning.
  Control input for envelope/LFO modulation of amplitude.
]]

local Module = require("lua.audio.module")

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "amplifier",

  ports = {
    audio_in  = { type = "audio", direction = "in" },
    audio_out = { type = "audio", direction = "out" },
    gain_in   = { type = "control", direction = "in" },
  },

  params = {
    gain = { type = "float", min = 0, max = 2, default = 1 },
    pan  = { type = "float", min = -1, max = 1, default = 0 },
  },

  process = function(self, numSamples, inputs, outputs)
    local inBuf  = inputs.audio_in
    local outBuf = outputs.audio_out
    if not outBuf then return end

    local gain = self.params.gain

    -- Apply control input to gain if connected (multiplied)
    local gainIn = inputs.gain_in
    if type(gainIn) == "number" then
      gain = gain * math.max(0, gainIn)
    end

    for i = 0, numSamples - 1 do
      local sample = inBuf and inBuf[i] or 0
      outBuf[i] = sample * gain
    end
  end,

  onMidiCC = function(self, cc, value)
    -- CC7 (volume) → gain
    if cc == 7 then
      self.params.gain = value / 127
    -- CC10 (pan) → pan
    elseif cc == 10 then
      self.params.pan = (value / 63.5) - 1  -- 0→-1, 64→0, 127→1
    end
  end,
})
