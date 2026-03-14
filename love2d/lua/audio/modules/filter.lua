--[[
  filter.lua — VCF: Biquad Filter

  Modes: lowpass, highpass, bandpass
  Cutoff frequency with resonance (Q).
  Control input for cutoff modulation (envelope → filter sweep).
]]

local Module = require("lua.audio.module")

local SAMPLE_RATE = Module.SAMPLE_RATE
local TWO_PI      = Module.TWO_PI

-- ============================================================================
-- Biquad coefficient calculation
-- ============================================================================

local function computeCoeffs(mode, cutoff, resonance)
  -- Clamp cutoff to valid range
  cutoff = math.max(20, math.min(cutoff, SAMPLE_RATE * 0.49))
  resonance = math.max(0.1, math.min(resonance, 30))

  local omega = TWO_PI * cutoff / SAMPLE_RATE
  local sinW  = math.sin(omega)
  local cosW  = math.cos(omega)
  local alpha = sinW / (2 * resonance)

  local b0, b1, b2, a0, a1, a2

  if mode == "lowpass" then
    b0 = (1 - cosW) / 2
    b1 = 1 - cosW
    b2 = (1 - cosW) / 2
    a0 = 1 + alpha
    a1 = -2 * cosW
    a2 = 1 - alpha
  elseif mode == "highpass" then
    b0 = (1 + cosW) / 2
    b1 = -(1 + cosW)
    b2 = (1 + cosW) / 2
    a0 = 1 + alpha
    a1 = -2 * cosW
    a2 = 1 - alpha
  elseif mode == "bandpass" then
    b0 = alpha
    b1 = 0
    b2 = -alpha
    a0 = 1 + alpha
    a1 = -2 * cosW
    a2 = 1 - alpha
  else
    -- Passthrough
    return 1, 0, 0, 1, 0, 0
  end

  -- Normalize
  return b0/a0, b1/a0, b2/a0, 1, a1/a0, a2/a0
end

-- ============================================================================
-- Module definition
-- ============================================================================

return Module.define({
  type = "filter",

  ports = {
    audio_in   = { type = "audio", direction = "in" },
    audio_out  = { type = "audio", direction = "out" },
    cutoff_in  = { type = "control", direction = "in" },
  },

  params = {
    mode      = { type = "enum", values = { "lowpass", "highpass", "bandpass" }, default = "lowpass" },
    cutoff    = { type = "float", min = 20, max = 20000, default = 1000 },
    resonance = { type = "float", min = 0.1, max = 30, default = 1 },
  },

  init = function(self)
    -- Biquad state (two previous input/output samples)
    self._state.x1 = 0
    self._state.x2 = 0
    self._state.y1 = 0
    self._state.y2 = 0
    -- Cache coefficients
    self._state.b0 = 1
    self._state.b1 = 0
    self._state.b2 = 0
    self._state.a1 = 0
    self._state.a2 = 0
    self._state.lastCutoff = -1
    self._state.lastRes = -1
    self._state.lastMode = ""
  end,

  process = function(self, numSamples, inputs, outputs)
    local inBuf  = inputs.audio_in
    local outBuf = outputs.audio_out
    if not outBuf then return end

    local mode      = self.params.mode
    local cutoff    = self.params.cutoff
    local resonance = self.params.resonance

    -- Apply control input to cutoff if connected
    local cutoffIn = inputs.cutoff_in
    if type(cutoffIn) == "number" and cutoffIn > 0 then
      cutoff = cutoffIn
    end

    -- Recalculate coefficients if params changed
    local st = self._state
    if cutoff ~= st.lastCutoff or resonance ~= st.lastRes or mode ~= st.lastMode then
      st.b0, st.b1, st.b2, _, st.a1, st.a2 = computeCoeffs(mode, cutoff, resonance)
      st.lastCutoff = cutoff
      st.lastRes = resonance
      st.lastMode = mode
    end

    local b0, b1, b2 = st.b0, st.b1, st.b2
    local a1, a2 = st.a1, st.a2
    local x1, x2 = st.x1, st.x2
    local y1, y2 = st.y1, st.y2

    for i = 0, numSamples - 1 do
      local x = inBuf and inBuf[i] or 0

      -- Direct Form I biquad
      local y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2

      -- Prevent denormals
      if y > -1e-30 and y < 1e-30 then y = 0 end

      outBuf[i] = y

      x2, x1 = x1, x
      y2, y1 = y1, y
    end

    st.x1, st.x2 = x1, x2
    st.y1, st.y2 = y1, y2
  end,

  onMidiCC = function(self, cc, value)
    -- CC74 (brightness) → cutoff
    if cc == 74 then
      -- Map 0-127 to 20-20000 Hz logarithmically
      local normalized = value / 127
      self.params.cutoff = 20 * (1000 ^ normalized)
    end
  end,
})
