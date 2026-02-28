--[[
  delay.lua — Delay Line with Feedback

  Provides a simple delay effect with:
    - Delay time (in seconds, up to 2s)
    - Feedback (0-1, portion of output fed back to input)
    - Mix (dry/wet balance)
]]

local Module = require("lua.audio.module")

local SAMPLE_RATE = Module.SAMPLE_RATE

local MAX_DELAY_SAMPLES = SAMPLE_RATE * 2  -- 2 seconds max

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "delay",

  ports = {
    audio_in  = { type = "audio", direction = "in" },
    audio_out = { type = "audio", direction = "out" },
  },

  params = {
    time     = { type = "float", min = 0.001, max = 2, default = 0.3 },
    feedback = { type = "float", min = 0, max = 0.95, default = 0.4 },
    mix      = { type = "float", min = 0, max = 1, default = 0.5 },
  },

  init = function(self)
    -- Circular buffer for delay line
    local buf = {}
    for i = 0, MAX_DELAY_SAMPLES - 1 do buf[i] = 0 end
    self._state.buffer   = buf
    self._state.writePos = 0
  end,

  process = function(self, numSamples, inputs, outputs)
    local inBuf  = inputs.audio_in
    local outBuf = outputs.audio_out
    if not outBuf then return end

    local delayTime = self.params.time
    local feedback  = self.params.feedback
    local mix       = self.params.mix
    local st        = self._state
    local buf       = st.buffer
    local writePos  = st.writePos

    local delaySamples = math.floor(delayTime * SAMPLE_RATE)
    if delaySamples < 1 then delaySamples = 1 end
    if delaySamples >= MAX_DELAY_SAMPLES then delaySamples = MAX_DELAY_SAMPLES - 1 end

    for i = 0, numSamples - 1 do
      local dry = inBuf and inBuf[i] or 0

      -- Read from delay line
      local readPos = writePos - delaySamples
      if readPos < 0 then readPos = readPos + MAX_DELAY_SAMPLES end
      local wet = buf[readPos]

      -- Write to delay line (input + feedback)
      buf[writePos] = dry + wet * feedback

      -- Mix dry and wet
      outBuf[i] = dry * (1 - mix) + wet * mix

      -- Advance write position
      writePos = writePos + 1
      if writePos >= MAX_DELAY_SAMPLES then writePos = 0 end
    end

    st.writePos = writePos
  end,
})
