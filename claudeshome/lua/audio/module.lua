--[[
  module.lua — Base class for audio modules

  Every audio component (oscillator, filter, delay, etc.) is a Module with:
    - ports:   named audio/control/midi I/O connections
    - params:  knobs/toggles that control DSP behavior
    - process: DSP function called per buffer chunk

  Port types:
    "audio"   — sample-rate buffers (float arrays, BUFFER_SIZE samples)
    "control" — per-buffer single values (frequency, gain, etc.)
    "midi"    — note/CC event streams

  Port directions:
    "in"  — receives data from upstream modules
    "out" — sends data to downstream modules

  Param types:
    "float" — numeric with min/max/default
    "enum"  — string from a set of values
    "bool"  — true/false toggle
]]

local Module = {}
Module.__index = Module

-- ============================================================================
-- Constants
-- ============================================================================

local SAMPLE_RATE = 44100
local BUFFER_SIZE = 512
local TWO_PI      = 2 * math.pi

Module.SAMPLE_RATE = SAMPLE_RATE
Module.BUFFER_SIZE = BUFFER_SIZE
Module.TWO_PI      = TWO_PI

-- ============================================================================
-- Constructor
-- ============================================================================

--- Create a new module definition (a "class" that can be instantiated).
---
--- @param def table { type, ports, params, process, onMidiNote?, onMidiCC?, init? }
--- @return table Module definition (call :instantiate(id) to create instances)
function Module.define(def)
  assert(def.type, "Module.define: 'type' is required")
  assert(def.ports, "Module.define: 'ports' is required")
  assert(def.process, "Module.define: 'process' function is required")

  local modDef = setmetatable({}, { __index = Module })
  modDef._type       = def.type
  modDef._portDefs   = def.ports
  modDef._paramDefs  = def.params or {}
  modDef._process    = def.process
  modDef._onMidiNote = def.onMidiNote
  modDef._onMidiCC   = def.onMidiCC
  modDef._getState   = def.getState
  modDef._init       = def.init

  return modDef
end

--- Instantiate a module definition with a unique ID.
--- Returns a live module instance with buffers and param values.
---
--- @param id string Unique module ID (e.g. "osc1", "filt1")
--- @param initialParams? table Override default param values
--- @return table Module instance
function Module.instantiate(modDef, id, initialParams)
  assert(id, "Module:instantiate: 'id' is required")

  local instance = {
    id       = id,
    type     = modDef._type,
    ports    = {},    -- portName -> { type, direction, buffer? }
    params   = {},    -- paramName -> current value
    _def     = modDef,
    _state   = {},    -- private per-instance state (phase, filter memory, etc.)
  }

  -- Initialize ports with buffers for output audio ports
  for name, portDef in pairs(modDef._portDefs) do
    local port = {
      type      = portDef.type,
      direction = portDef.direction,
      buffer    = nil,
      value     = 0,   -- for control ports: single value per buffer
    }

    -- Audio output ports get their own buffer
    if portDef.type == "audio" and portDef.direction == "out" then
      local buf = {}
      for i = 0, BUFFER_SIZE - 1 do buf[i] = 0 end
      port.buffer = buf
    end

    -- Control output ports start at default or 0
    if portDef.type == "control" and portDef.direction == "out" then
      port.value = 0
    end

    instance.ports[name] = port
  end

  -- Initialize params with defaults, then apply overrides
  for name, paramDef in pairs(modDef._paramDefs) do
    instance.params[name] = paramDef.default
  end
  if initialParams then
    for name, value in pairs(initialParams) do
      if modDef._paramDefs[name] then
        instance.params[name] = value
      end
    end
  end

  -- Call custom init if defined
  if modDef._init then
    modDef._init(instance)
  end

  return instance
end

-- ============================================================================
-- Instance methods (called on instances, not definitions)
-- ============================================================================

--- Process a chunk of audio samples.
--- The graph calls this after routing input buffers.
---
--- @param instance table Module instance
--- @param numSamples number Number of samples to generate (usually BUFFER_SIZE)
--- @param inputs table { portName -> buffer or value }
--- @param outputs table { portName -> buffer or value }
function Module.process(instance, numSamples, inputs, outputs)
  instance._def._process(instance, numSamples, inputs, outputs)
end

--- Handle a MIDI note event.
--- @param instance table Module instance
--- @param note number MIDI note number (0-127)
--- @param velocity number Velocity (0-127, 0 = note off)
--- @param on boolean true = note on, false = note off
function Module.midiNote(instance, note, velocity, on)
  if instance._def._onMidiNote then
    instance._def._onMidiNote(instance, note, velocity, on)
  end
end

--- Handle a MIDI CC event.
--- @param instance table Module instance
--- @param cc number Controller number (0-127)
--- @param value number Controller value (0-127)
function Module.midiCC(instance, cc, value)
  if instance._def._onMidiCC then
    instance._def._onMidiCC(instance, cc, value)
  end
end

--- Set a parameter value with validation.
--- @param instance table Module instance
--- @param name string Parameter name
--- @param value any New value
function Module.setParam(instance, name, value)
  local paramDef = instance._def._paramDefs[name]
  if not paramDef then return false end

  if paramDef.type == "float" then
    value = tonumber(value) or paramDef.default
    if paramDef.min then value = math.max(paramDef.min, value) end
    if paramDef.max then value = math.min(paramDef.max, value) end
  elseif paramDef.type == "enum" then
    local valid = false
    for _, v in ipairs(paramDef.values) do
      if v == value then valid = true; break end
    end
    if not valid then value = paramDef.default end
  elseif paramDef.type == "bool" then
    value = not not value
  end

  instance.params[name] = value
  return true
end

--- Get a snapshot of the module's state for UI display.
--- @param instance table Module instance
--- @return table Serializable state
function Module.getState(instance)
  local portInfo = {}
  for name, port in pairs(instance.ports) do
    portInfo[name] = {
      type      = port.type,
      direction = port.direction,
    }
  end

  local state = {
    id     = instance.id,
    type   = instance.type,
    params = instance.params,
    ports  = portInfo,
  }

  -- Include active voices for polysynth modules
  if instance._state.voices then
    local activeNotes = {}
    for key, voice in pairs(instance._state.voices) do
      activeNotes[key] = {
        note     = voice.note,
        envelope = voice.envelope or 0,
      }
    end
    state.activeNotes = activeNotes
  end

  -- Allow modules to report custom state fields
  if instance._def._getState then
    local custom = instance._def._getState(instance)
    if custom then
      for k, v in pairs(custom) do
        state[k] = v
      end
    end
  end

  return state
end

--- Get the param definitions for UI generation.
--- @param modDef table Module definition
--- @return table { paramName -> { type, min?, max?, default, values? } }
function Module.getParamDefs(modDef)
  return modDef._paramDefs
end

--- Get the port definitions.
--- @param modDef table Module definition
--- @return table { portName -> { type, direction } }
function Module.getPortDefs(modDef)
  return modDef._portDefs
end

-- ============================================================================
-- Helpers available to module DSP functions
-- ============================================================================

--- Convert MIDI note number to frequency in Hz.
function Module.midiToFreq(note)
  return 440 * 2 ^ ((note - 69) / 12)
end

--- Convert frequency to MIDI note number.
function Module.freqToMidi(freq)
  return 69 + 12 * math.log(freq / 440) / math.log(2)
end

--- Clear a buffer to zero.
function Module.clearBuffer(buf, numSamples)
  for i = 0, (numSamples or BUFFER_SIZE) - 1 do
    buf[i] = 0
  end
end

--- Copy one buffer to another.
function Module.copyBuffer(dst, src, numSamples)
  for i = 0, (numSamples or BUFFER_SIZE) - 1 do
    dst[i] = src[i]
  end
end

--- Add src buffer into dst buffer (accumulate).
function Module.addBuffer(dst, src, numSamples)
  for i = 0, (numSamples or BUFFER_SIZE) - 1 do
    dst[i] = dst[i] + src[i]
  end
end

--- Soft clamp a sample to [-1, 1].
function Module.clamp(x)
  if x > 1 then return 1
  elseif x < -1 then return -1
  else return x end
end

return Module
