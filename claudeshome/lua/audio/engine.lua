--[[
  engine.lua — Audio engine: QueueableSource + graph execution

  Manages:
    - QueueableSource for streaming audio to Love2D
    - Module registry (built-in + custom module definitions)
    - Graph execution loop (fill buffers → topo sort → process → queue)
    - State push to bridge at ~30fps for UI meters/display
    - MIDI polling and dispatch

  The engine is initialized lazily: audio starts when the first module is added.
  Gracefully degrades if audio hardware isn't available (headless mode).
]]

local Module = require("lua.audio.module")
local Graph  = require("lua.audio.graph")

local Engine = {}

-- ============================================================================
-- Constants
-- ============================================================================

local SAMPLE_RATE   = Module.SAMPLE_RATE  -- 44100
local BUFFER_SIZE   = Module.BUFFER_SIZE  -- 512
local BUFFER_COUNT  = 4
local BIT_DEPTH     = 16
local CHANNELS      = 1

local STATE_INTERVAL = 1 / 30  -- push state to bridge at ~30fps

-- ============================================================================
-- State
-- ============================================================================

local source         = nil    -- QueueableSource (nil if headless)
local graph          = nil    -- RackGraph instance
local initialized    = false
local audioAvailable = false

local stateThrottle  = 0
local bridge         = nil    -- set by init(), used for state push and RPC

-- Module type registry: typeName -> Module definition
local moduleRegistry = {}

-- MIDI subsystem (loaded lazily)
local midi = nil
local midiAvailable = false

-- MIDI learn state
local midiLearnTarget = nil  -- { moduleId, param }

-- MIDI CC mappings: { channel, cc } -> { moduleId, param }
local midiMappings = {}

-- Recording state
local recordingDevice  = nil   -- Love2D RecordingDevice object
local recordingState   = {     -- pushed to React via getState()
  active   = false,
  moduleId = nil,
  slot     = nil,
  device   = nil,
  startTime = 0,
}

-- ============================================================================
-- Module registry
-- ============================================================================

--- Register a built-in module definition.
--- @param typeName string e.g. "oscillator", "filter"
--- @param def table Module definition (passed to Module.define)
function Engine.registerModule(typeName, def)
  def.type = typeName
  moduleRegistry[typeName] = Module.define(def)
end

--- Load all built-in modules from lua/audio/modules/.
local function loadBuiltinModules()
  local builtins = {
    "oscillator", "filter", "amplifier", "envelope",
    "lfo", "delay", "mixer", "polysynth",
    "sampler", "clock", "sequencer",
  }
  for _, name in ipairs(builtins) do
    local ok, mod = pcall(require, "lua.audio.modules." .. name)
    if ok and mod then
      if mod._type then
        -- Already a Module definition
        moduleRegistry[name] = mod
      elseif mod.register then
        -- Has a register function
        mod.register(Engine)
      end
    else
      io.write("[audio] Built-in module '" .. name .. "' not loaded: " .. tostring(mod) .. "\n")
      io.flush()
    end
  end
end

-- ============================================================================
-- Initialization
-- ============================================================================

--- Initialize the audio engine.
--- @param config? table { sampleRate?, bufferSize?, bufferCount?, bridge? }
function Engine.init(config)
  config = config or {}

  bridge = config.bridge

  -- Create the graph
  graph = Graph.new()

  -- Load built-in modules
  loadBuiltinModules()

  -- Try to initialize audio
  local ok, src = pcall(
    love.audio.newQueueableSource,
    SAMPLE_RATE, BIT_DEPTH, CHANNELS, BUFFER_COUNT
  )
  if ok and src then
    source = src
    audioAvailable = true
    io.write("[audio] Engine initialized: " .. SAMPLE_RATE .. "Hz, "
      .. BUFFER_SIZE .. " samples/buffer, " .. BUFFER_COUNT .. " buffers\n")
    io.flush()
  else
    io.write("[audio] Audio not available (headless?) — running without sound\n")
    io.flush()
    if not ok then
      io.write("[audio] Error: " .. tostring(src) .. "\n")
      io.flush()
    end
  end

  -- Try to initialize MIDI
  local midiOk, midiMod = pcall(require, "lua.audio.midi")
  if midiOk and midiMod and midiMod.available then
    midi = midiMod
    midiAvailable = true
    midi.init()
    io.write("[audio] MIDI initialized\n"); io.flush()
  else
    io.write("[audio] MIDI not available\n"); io.flush()
  end

  initialized = true
end

-- ============================================================================
-- Graph operations (called via RPC from React)
-- ============================================================================

--- Add a module to the graph.
--- @param typeName string Module type from registry
--- @param id string Unique instance ID
--- @param params? table Initial parameter overrides
--- @return table { id } on success
function Engine.addModule(typeName, id, params)
  if not graph then error("Audio engine not initialized") end

  local modDef = moduleRegistry[typeName]
  if not modDef then error("Unknown module type: " .. typeName) end

  local instance = Module.instantiate(modDef, id, params)
  graph:addModule(instance)

  io.write("[audio] Added module: " .. typeName .. " (" .. id .. ")\n"); io.flush()
  return { id = id }
end

--- Remove a module from the graph.
--- @param id string Module instance ID
function Engine.removeModule(id)
  if not graph then error("Audio engine not initialized") end
  graph:removeModule(id)
  io.write("[audio] Removed module: " .. id .. "\n"); io.flush()
  return true
end

--- Connect two ports.
function Engine.connect(fromId, fromPort, toId, toPort)
  if not graph then error("Audio engine not initialized") end
  local ok, err = graph:connect(fromId, fromPort, toId, toPort)
  if not ok then error(err) end
  io.write("[audio] Connected: " .. fromId .. "." .. fromPort
    .. " → " .. toId .. "." .. toPort .. "\n"); io.flush()
  return true
end

--- Disconnect two ports.
function Engine.disconnect(fromId, fromPort, toId, toPort)
  if not graph then error("Audio engine not initialized") end
  graph:disconnect(fromId, fromPort, toId, toPort)
  return true
end

--- Send a MIDI note event to a specific module (or all modules).
--- @param moduleId string|nil Target module ID (nil = broadcast to all)
--- @param note number MIDI note number
--- @param velocity number Velocity (0 = note off)
--- @param on boolean true = note on, false = note off
function Engine.noteOn(moduleId, note, velocity, on)
  if not graph then return end
  if moduleId then
    local instance = graph:getModule(moduleId)
    if instance then
      Module.midiNote(instance, note, velocity, on)
    end
  else
    -- Broadcast to all modules
    for _, id in ipairs(graph:getOrder()) do
      local instance = graph:getModule(id)
      if instance then
        Module.midiNote(instance, note, velocity, on)
      end
    end
  end
  return true
end

--- Trigger a keyboard key as a note (using the polysynth key map).
--- Routes through the polysynth module's internal voice system.
--- @param moduleId string Target polysynth module ID
--- @param key string Keyboard key (e.g. "a", "z", "2")
function Engine.keyNoteOn(moduleId, key)
  if not graph then return false end
  local instance = graph:getModule(moduleId)
  if not instance then return false end

  -- Access the polysynth's internal key map and voice system
  local keyMap = instance._state.keyMap
  if not keyMap then return false end

  local baseNote = keyMap[key]
  if not baseNote then return false end

  local note = baseNote + (instance.params.octaveShift or 0)
  local voices = instance._state.voices
  voices[key] = {
    note           = note,
    freq           = Module.midiToFreq(note),
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

--- Release a keyboard key on a polysynth module.
function Engine.keyNoteOff(moduleId, key)
  if not graph then return false end
  local instance = graph:getModule(moduleId)
  if not instance then return false end

  local voices = instance._state.voices
  if not voices then return false end

  local voice = voices[key]
  if voice and not voice.released then
    voice.released = true
    voice.releaseTime = voice.time
    voice.releaseEnvelope = voice.envelope
  end
  return true
end

--- Set a parameter on a module.
function Engine.setParam(moduleId, param, value)
  if not graph then error("Audio engine not initialized") end
  local instance = graph:getModule(moduleId)
  if not instance then error("Module not found: " .. moduleId) end
  Module.setParam(instance, param, value)
  return true
end

--- Get the full rack state.
function Engine.getState()
  if not graph then return { modules = {}, connections = {}, midi = {} } end

  local state = graph:getState()

  -- Add MIDI info
  state.midi = {
    available = midiAvailable,
    devices   = midi and midi.getDevices() or {},
    mappings  = {},
    learning  = midiLearnTarget,
  }

  for key, mapping in pairs(midiMappings) do
    state.midi.mappings[#state.midi.mappings + 1] = {
      channel  = mapping.channel,
      cc       = mapping.cc,
      moduleId = mapping.moduleId,
      param    = mapping.param,
    }
  end

  -- Add recording info
  state.recording = {
    active   = recordingState.active,
    moduleId = recordingState.moduleId,
    slot     = recordingState.slot,
    device   = recordingState.device,
    duration = recordingState.active
      and (love.timer.getTime() - recordingState.startTime) or 0,
  }

  return state
end

-- ============================================================================
-- MIDI learn / mapping
-- ============================================================================

--- Start MIDI learn mode: next CC message maps to this param.
function Engine.midiLearn(moduleId, param)
  midiLearnTarget = { moduleId = moduleId, param = param }
  io.write("[audio] MIDI learn: waiting for CC → " .. moduleId .. "." .. param .. "\n")
  io.flush()
  return true
end

--- Manually map a MIDI CC to a param.
function Engine.midiMap(moduleId, param, channel, cc)
  local key = channel .. ":" .. cc
  midiMappings[key] = {
    channel  = channel,
    cc       = cc,
    moduleId = moduleId,
    param    = param,
  }
  return true
end

--- Remove a MIDI CC mapping.
function Engine.midiUnmap(moduleId, param)
  local toRemove = {}
  for key, mapping in pairs(midiMappings) do
    if mapping.moduleId == moduleId and mapping.param == param then
      toRemove[#toRemove + 1] = key
    end
  end
  for _, key in ipairs(toRemove) do
    midiMappings[key] = nil
  end
  return true
end

-- ============================================================================
-- MIDI dispatch
-- ============================================================================

local function dispatchMidiEvents()
  if not midi or not midiAvailable then return end

  local events = midi.poll()
  for _, evt in ipairs(events) do
    if evt.type == "note_on" or evt.type == "note_off" then
      local isOn = evt.type == "note_on" and evt.velocity > 0

      -- Dispatch to all modules that accept MIDI
      for _, id in ipairs(graph:getOrder()) do
        local instance = graph:getModule(id)
        if instance then
          Module.midiNote(instance, evt.note, evt.velocity, isOn)
        end
      end

      -- Push to bridge for React event dispatch
      if bridge then
        bridge:pushEvent({
          type = "midi:note",
          payload = {
            note     = evt.note,
            velocity = evt.velocity,
            on       = isOn,
            channel  = evt.channel,
            device   = evt.device,
          },
        })
      end

    elseif evt.type == "cc" then
      -- Check MIDI learn
      if midiLearnTarget then
        local key = evt.channel .. ":" .. evt.cc
        midiMappings[key] = {
          channel  = evt.channel,
          cc       = evt.cc,
          moduleId = midiLearnTarget.moduleId,
          param    = midiLearnTarget.param,
        }
        io.write("[audio] MIDI learned: CC" .. evt.cc .. " ch" .. evt.channel
          .. " → " .. midiLearnTarget.moduleId .. "." .. midiLearnTarget.param .. "\n")
        io.flush()
        midiLearnTarget = nil
      end

      -- Apply CC mappings
      local key = evt.channel .. ":" .. evt.cc
      local mapping = midiMappings[key]
      if mapping then
        local instance = graph and graph:getModule(mapping.moduleId)
        if instance then
          -- Normalize CC value (0-127) to param range
          local paramDef = instance._def._paramDefs[mapping.param]
          if paramDef and paramDef.type == "float" then
            local normalized = evt.value / 127
            local value = paramDef.min + normalized * (paramDef.max - paramDef.min)
            Module.setParam(instance, mapping.param, value)
          end
        end
      end

      -- Dispatch to modules that handle CC
      for _, id in ipairs(graph:getOrder()) do
        local instance = graph:getModule(id)
        if instance then
          Module.midiCC(instance, evt.cc, evt.value)
        end
      end

      -- Push to bridge
      if bridge then
        bridge:pushEvent({
          type = "midi:cc",
          payload = {
            cc      = evt.cc,
            value   = evt.value,
            channel = evt.channel,
            device  = evt.device,
          },
        })
      end
    end
  end
end

-- ============================================================================
-- Audio generation loop
-- ============================================================================

--- Generate audio buffers and feed QueueableSource.
--- Call this every frame in the update loop.
--- @param dt number Delta time
function Engine.update(dt)
  if not initialized then return end

  -- 1. Poll MIDI
  dispatchMidiEvents()

  -- 2. Fill audio buffers
  if source and graph then
    local queued = false

    while source:getFreeBufferCount() > 0 do
      -- Process the graph for one buffer chunk
      graph:process(BUFFER_SIZE)

      -- Drain module events (sequencer noteOn/noteOff, clock ticks, etc.)
      local order = graph:getOrder()
      for _, id in ipairs(order) do
        local instance = graph:getModule(id)
        if instance and instance._state.events then
          for _, evt in ipairs(instance._state.events) do
            if evt.type == "noteOn" then
              Engine.noteOn(evt.target, evt.note, evt.velocity, true)
            elseif evt.type == "noteOff" then
              Engine.noteOn(evt.target, evt.note, 0, false)
            end
            -- Forward bridge events (clock ticks, etc.)
            if evt.bridge and bridge then
              bridge:pushEvent(evt.bridge)
            end
          end
          instance._state.events = {}
        end
      end

      -- Find the output module (last audio output in the chain)
      -- Convention: module with type "output" or the last module with audio_out
      local outputBuf = nil

      -- Walk the order in reverse to find the final output
      for i = #order, 1, -1 do
        local instance = graph:getModule(order[i])
        if instance then
          -- Check for an audio output port
          for _, port in pairs(instance.ports) do
            if port.type == "audio" and port.direction == "out" and port.buffer then
              outputBuf = port.buffer
              break
            end
          end
          if outputBuf then break end
        end
      end

      -- Write to SoundData
      local soundData = love.sound.newSoundData(BUFFER_SIZE, SAMPLE_RATE, BIT_DEPTH, CHANNELS)
      if outputBuf then
        for i = 0, BUFFER_SIZE - 1 do
          local s = outputBuf[i]
          -- Soft clamp
          if s > 1 then s = 1 elseif s < -1 then s = -1 end
          soundData:setSample(i, s)
        end
      end
      -- If no output module, soundData stays silent (zeroes)

      source:queue(soundData)
      queued = true
    end

    -- Ensure playing (recovers from underruns)
    if queued and not source:isPlaying() then
      source:play()
    end
  end

  -- 3. Push state to bridge at ~30fps
  if bridge then
    stateThrottle = stateThrottle + dt
    if stateThrottle >= STATE_INTERVAL then
      stateThrottle = stateThrottle - STATE_INTERVAL
      bridge:pushEvent({
        type = "audio:state",
        payload = Engine.getState(),
      })
    end
  end
end

-- ============================================================================
-- Sample loading
-- ============================================================================

--- Load an audio file into a sampler module's slot.
--- @param moduleId string Sampler module ID
--- @param slot number Slot number (1-16)
--- @param path string File path (relative to Love2D filesystem)
--- @param mode? string "oneshot" or "loop" (default: "oneshot")
function Engine.loadSample(moduleId, slot, path, mode)
  if not graph then error("Audio engine not initialized") end
  local instance = graph:getModule(moduleId)
  if not instance then error("Module not found: " .. moduleId) end
  if instance.type ~= "sampler" then error("Module is not a sampler: " .. moduleId) end

  local ok, sd = pcall(love.sound.newSoundData, path)
  if not ok then error("Failed to load sample: " .. tostring(sd)) end

  instance._state.slots[slot] = {
    soundData   = sd,
    sampleCount = sd:getSampleCount(),
    sampleRate  = sd:getSampleRate(),
    name        = path:match("([^/]+)$") or path,
    mode        = mode or "oneshot",
  }

  io.write("[audio] Loaded sample into " .. moduleId .. " slot " .. slot .. ": " .. path .. "\n")
  io.flush()
  return true
end

--- Clear a sampler slot.
function Engine.clearSample(moduleId, slot)
  if not graph then error("Audio engine not initialized") end
  local instance = graph:getModule(moduleId)
  if not instance then error("Module not found: " .. moduleId) end
  if instance.type ~= "sampler" then error("Module is not a sampler: " .. moduleId) end

  instance._state.slots[slot] = nil
  io.write("[audio] Cleared sample slot " .. slot .. " on " .. moduleId .. "\n")
  io.flush()
  return true
end

-- ============================================================================
-- Recording
-- ============================================================================

--- List available recording devices.
function Engine.listRecordingDevices()
  local ok, devices = pcall(love.audio.getRecordingDevices)
  if not ok or not devices then return { devices = {} } end

  local result = {}
  for i, dev in ipairs(devices) do
    result[#result + 1] = {
      index = i,
      name  = dev:getName(),
    }
  end
  return { devices = result }
end

--- Start recording audio from a device into a sampler slot.
--- @param moduleId string Target sampler module ID
--- @param slot number Slot to record into (1-16)
--- @param deviceIndex? number Recording device index (default: 1 = system default)
function Engine.startRecording(moduleId, slot, deviceIndex)
  if not graph then error("Audio engine not initialized") end
  if recordingState.active then error("Already recording") end

  local instance = graph:getModule(moduleId)
  if not instance then error("Module not found: " .. moduleId) end
  if instance.type ~= "sampler" then error("Module is not a sampler: " .. moduleId) end

  local ok, devices = pcall(love.audio.getRecordingDevices)
  if not ok or not devices or #devices == 0 then
    error("No recording devices available")
  end

  local devIdx = deviceIndex or 1
  local device = devices[devIdx]
  if not device then error("Recording device not found: " .. devIdx) end

  -- Start recording: 44100 Hz, 16-bit, mono, 30s buffer (max)
  local bufferSize = SAMPLE_RATE * 30  -- 30 seconds
  local startOk = device:start(SAMPLE_RATE, BIT_DEPTH, CHANNELS, bufferSize)
  if not startOk then error("Failed to start recording on device: " .. device:getName()) end

  recordingDevice = device
  recordingState = {
    active    = true,
    moduleId  = moduleId,
    slot      = slot,
    device    = device:getName(),
    startTime = love.timer.getTime(),
  }

  io.write("[audio] Recording started: " .. device:getName()
    .. " → " .. moduleId .. " slot " .. slot .. "\n")
  io.flush()
  return true
end

--- Stop recording and store the captured audio in the target sampler slot.
function Engine.stopRecording()
  if not recordingState.active or not recordingDevice then
    error("Not currently recording")
  end

  local sd = recordingDevice:getData()
  recordingDevice:stop()

  if sd and sd:getSampleCount() > 0 then
    local instance = graph:getModule(recordingState.moduleId)
    if instance and instance.type == "sampler" then
      instance._state.slots[recordingState.slot] = {
        soundData   = sd,
        sampleCount = sd:getSampleCount(),
        sampleRate  = sd:getSampleRate(),
        name        = "recording",
        mode        = "oneshot",
      }
      io.write("[audio] Recording saved: " .. sd:getSampleCount() .. " samples → "
        .. recordingState.moduleId .. " slot " .. recordingState.slot .. "\n")
      io.flush()
    end
  else
    io.write("[audio] Recording stopped but no data captured\n")
    io.flush()
  end

  recordingDevice = nil
  recordingState = {
    active   = false,
    moduleId = nil,
    slot     = nil,
    device   = nil,
    startTime = 0,
  }
  return true
end

-- ============================================================================
-- Sequencer pattern editing
-- ============================================================================

--- Set a step in a sequencer's pattern.
function Engine.setStep(moduleId, track, step, active, note, velocity)
  if not graph then error("Audio engine not initialized") end
  local instance = graph:getModule(moduleId)
  if not instance then error("Module not found: " .. moduleId) end
  if instance.type ~= "sequencer" then error("Module is not a sequencer: " .. moduleId) end

  local pattern = instance._state.pattern
  if not pattern[track] then pattern[track] = {} end
  pattern[track][step] = {
    active   = active,
    note     = note or 36,
    velocity = velocity or 100,
  }
  return true
end

--- Set which module a sequencer track triggers.
function Engine.setTrackTarget(moduleId, track, target)
  if not graph then error("Audio engine not initialized") end
  local instance = graph:getModule(moduleId)
  if not instance then error("Module not found: " .. moduleId) end
  if instance.type ~= "sequencer" then error("Module is not a sequencer: " .. moduleId) end

  instance._state.trackTargets[track] = target
  return true
end

--- Clear all steps in a sequencer's pattern.
function Engine.clearPattern(moduleId)
  if not graph then error("Audio engine not initialized") end
  local instance = graph:getModule(moduleId)
  if not instance then error("Module not found: " .. moduleId) end
  if instance.type ~= "sequencer" then error("Module is not a sequencer: " .. moduleId) end

  instance._state.pattern = {}
  return true
end

-- ============================================================================
-- RPC handler registration
-- ============================================================================

--- Get all RPC handlers for registration in init.lua.
--- @return table { method -> handler }
function Engine.getHandlers()
  return {
    ["audio:init"] = function(args)
      Engine.init(args)
      return true
    end,

    ["audio:addModule"] = function(args)
      return Engine.addModule(args.type, args.id, args.params)
    end,

    ["audio:removeModule"] = function(args)
      return Engine.removeModule(args.id)
    end,

    ["audio:connect"] = function(args)
      return Engine.connect(args.fromId, args.fromPort, args.toId, args.toPort)
    end,

    ["audio:disconnect"] = function(args)
      return Engine.disconnect(args.fromId, args.fromPort, args.toId, args.toPort)
    end,

    ["audio:setParam"] = function(args)
      return Engine.setParam(args.moduleId, args.param, args.value)
    end,

    ["audio:getState"] = function()
      return Engine.getState()
    end,

    ["audio:midiLearn"] = function(args)
      return Engine.midiLearn(args.moduleId, args.param)
    end,

    ["audio:midiMap"] = function(args)
      return Engine.midiMap(args.moduleId, args.param, args.channel, args.cc)
    end,

    ["audio:midiUnmap"] = function(args)
      return Engine.midiUnmap(args.moduleId, args.param)
    end,

    ["audio:noteOn"] = function(args)
      return Engine.noteOn(args.moduleId, args.note, args.velocity or 127, true)
    end,

    ["audio:noteOff"] = function(args)
      return Engine.noteOn(args.moduleId, args.note, 0, false)
    end,

    ["audio:keyNoteOn"] = function(args)
      return Engine.keyNoteOn(args.moduleId, args.key)
    end,

    ["audio:keyNoteOff"] = function(args)
      return Engine.keyNoteOff(args.moduleId, args.key)
    end,

    ["audio:shiftOctave"] = function(args)
      return Engine.setParam(args.moduleId, "octaveShift",
        (graph:getModule(args.moduleId).params.octaveShift or 0) + args.direction * 12)
    end,

    -- Sampler RPCs
    ["audio:loadSample"] = function(args)
      return Engine.loadSample(args.moduleId, args.slot, args.path, args.mode)
    end,

    ["audio:clearSample"] = function(args)
      return Engine.clearSample(args.moduleId, args.slot)
    end,

    -- Recording RPCs
    ["audio:listRecordingDevices"] = function()
      return Engine.listRecordingDevices()
    end,

    ["audio:startRecording"] = function(args)
      return Engine.startRecording(args.moduleId, args.slot, args.device)
    end,

    ["audio:stopRecording"] = function()
      return Engine.stopRecording()
    end,

    -- Sequencer RPCs
    ["audio:setStep"] = function(args)
      return Engine.setStep(args.moduleId, args.track, args.step,
        args.active, args.note, args.velocity)
    end,

    ["audio:setTrackTarget"] = function(args)
      return Engine.setTrackTarget(args.moduleId, args.track, args.target)
    end,

    ["audio:clearPattern"] = function(args)
      return Engine.clearPattern(args.moduleId)
    end,
  }
end

--- Check if audio hardware is available.
function Engine.isAvailable()
  return audioAvailable
end

--- Check if MIDI is available.
function Engine.isMidiAvailable()
  return midiAvailable
end

--- Get the graph (for advanced use / testing).
function Engine.getGraph()
  return graph
end

return Engine
