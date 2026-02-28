--[[
  mixer.lua — Audio Mixer

  Sums up to 8 audio inputs to a single output.
  Each input has an independent gain control.
  Also serves as the final output stage (the last module in the chain).
]]

local Module = require("lua.audio.module")

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "mixer",

  ports = {
    input_1   = { type = "audio", direction = "in" },
    input_2   = { type = "audio", direction = "in" },
    input_3   = { type = "audio", direction = "in" },
    input_4   = { type = "audio", direction = "in" },
    input_5   = { type = "audio", direction = "in" },
    input_6   = { type = "audio", direction = "in" },
    input_7   = { type = "audio", direction = "in" },
    input_8   = { type = "audio", direction = "in" },
    audio_out = { type = "audio", direction = "out" },
  },

  params = {
    gain_1  = { type = "float", min = 0, max = 2, default = 1 },
    gain_2  = { type = "float", min = 0, max = 2, default = 1 },
    gain_3  = { type = "float", min = 0, max = 2, default = 1 },
    gain_4  = { type = "float", min = 0, max = 2, default = 1 },
    gain_5  = { type = "float", min = 0, max = 2, default = 1 },
    gain_6  = { type = "float", min = 0, max = 2, default = 1 },
    gain_7  = { type = "float", min = 0, max = 2, default = 1 },
    gain_8  = { type = "float", min = 0, max = 2, default = 1 },
    master  = { type = "float", min = 0, max = 2, default = 1 },
  },

  process = function(self, numSamples, inputs, outputs)
    local outBuf = outputs.audio_out
    if not outBuf then return end

    local master = self.params.master

    for i = 0, numSamples - 1 do
      local sample = 0

      for ch = 1, 8 do
        local inBuf = inputs["input_" .. ch]
        if inBuf then
          sample = sample + inBuf[i] * self.params["gain_" .. ch]
        end
      end

      -- Apply master gain and soft clamp
      sample = sample * master
      if sample > 1 then sample = 1
      elseif sample < -1 then sample = -1 end

      outBuf[i] = sample
    end
  end,
})
