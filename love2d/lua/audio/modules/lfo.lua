--[[
  lfo.lua — Low Frequency Oscillator

  Outputs a control signal for modulating other module params.
  Waveforms: sine, saw, square, triangle, random (S&H)
  Rate is in Hz (typically 0.1 - 20 Hz).
  Output range controlled by amount param.
]]

local Module = require("lua.audio.module")

local SAMPLE_RATE = Module.SAMPLE_RATE
local TWO_PI      = Module.TWO_PI

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "lfo",

  ports = {
    control_out = { type = "control", direction = "out" },
    audio_out   = { type = "audio", direction = "out" },
  },

  params = {
    waveform = { type = "enum", values = { "sine", "triangle", "saw", "square", "random" }, default = "sine" },
    rate     = { type = "float", min = 0.01, max = 100, default = 1 },
    amount   = { type = "float", min = 0, max = 1, default = 1 },
    bipolar  = { type = "bool", default = true },
  },

  init = function(self)
    self._state.phase   = 0
    self._state.shValue = 0  -- sample-and-hold value for random
  end,

  process = function(self, numSamples, inputs, outputs)
    local outBuf = outputs.audio_out
    local ctrlOut = outputs.control_out

    local wf     = self.params.waveform
    local rate   = self.params.rate
    local amount = self.params.amount
    local bipolar = self.params.bipolar
    local phase  = self._state.phase
    local invSR  = 1 / SAMPLE_RATE
    local shVal  = self._state.shValue

    for i = 0, numSamples - 1 do
      local value

      if wf == "sine" then
        value = math.sin(phase * TWO_PI)
      elseif wf == "triangle" then
        value = 4 * math.abs(phase - math.floor(phase + 0.5)) - 1
      elseif wf == "saw" then
        value = 2 * (phase - math.floor(phase + 0.5))
      elseif wf == "square" then
        value = (phase % 1) < 0.5 and 1 or -1
      elseif wf == "random" then
        -- Sample-and-hold: new random value each cycle
        local oldPhase = phase
        phase = phase + rate * invSR
        if math.floor(phase) > math.floor(oldPhase) then
          shVal = math.random() * 2 - 1
        end
        value = shVal
        -- Skip the normal phase advance below
        if phase >= 1 then phase = phase - math.floor(phase) end
        self._state.phase = phase
        self._state.shValue = shVal

        value = value * amount
        if not bipolar then value = (value + 1) * 0.5 end
        if outBuf then outBuf[i] = value end
        goto continue
      end

      phase = phase + rate * invSR
      if phase >= 1 then phase = phase - math.floor(phase) end

      value = value * amount
      if not bipolar then value = (value + 1) * 0.5 end

      if outBuf then outBuf[i] = value end

      ::continue::
    end

    self._state.phase = phase
    self._state.shValue = shVal

    -- Control output: last computed value
    if ctrlOut then
      local lastVal
      if outBuf then
        lastVal = outBuf[numSamples - 1]
      else
        lastVal = 0
      end
      ctrlOut.value = lastVal
    end
  end,
})
