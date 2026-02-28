--[[
  midi.lua — ALSA Sequencer MIDI Input via LuaJIT FFI

  Provides MIDI device enumeration and event polling using the ALSA
  sequencer API (snd_seq_*). Same pattern as dragdrop.lua and sqlite.lua:
  graceful degradation if ALSA isn't available (macOS, headless, etc.).

  Events returned by poll():
    { type = "note_on",  note = 60, velocity = 100, channel = 0, device = "..." }
    { type = "note_off", note = 60, velocity = 0,   channel = 0, device = "..." }
    { type = "cc",       cc = 74,   value = 100,    channel = 0, device = "..." }
    { type = "clock" }
    { type = "start" }
    { type = "stop" }

  Linux-only. Returns a stub with .available = false on other platforms.
]]

local ffi = require("ffi")

local MIDI = {}
MIDI.available = false

-- ============================================================================
-- State
-- ============================================================================

local seq       = nil   -- snd_seq_t*
local portId    = -1    -- our input port
local alsaLib   = nil   -- ffi.load("asound")
local devices   = {}    -- list of { id, name, connected }
local lastScan  = 0     -- for periodic device re-enumeration

-- ============================================================================
-- FFI declarations
-- ============================================================================

local function tryInit()
  if ffi.os ~= "Linux" then
    io.write("[midi] Not Linux, skipping ALSA MIDI\n"); io.flush()
    return false
  end

  -- Declare ALSA sequencer types and functions
  local ok, err = pcall(ffi.cdef, [[
    // Opaque handle
    typedef struct snd_seq snd_seq_t;

    // Event type constants
    enum {
      SND_SEQ_EVENT_NOTEON      = 6,
      SND_SEQ_EVENT_NOTEOFF     = 7,
      SND_SEQ_EVENT_CONTROLLER  = 10,
      SND_SEQ_EVENT_PGMCHANGE   = 11,
      SND_SEQ_EVENT_PITCHBEND   = 13,
      SND_SEQ_EVENT_CLOCK       = 36,
      SND_SEQ_EVENT_START       = 40,
      SND_SEQ_EVENT_STOP        = 42,
      SND_SEQ_EVENT_PORT_SUBSCRIBED   = 66,
      SND_SEQ_EVENT_PORT_UNSUBSCRIBED = 67
    };

    // Open mode
    enum {
      SND_SEQ_OPEN_INPUT  = 2,
      SND_SEQ_NONBLOCK    = 1
    };

    // Port capabilities
    enum {
      SND_SEQ_PORT_CAP_WRITE       = 0x02,
      SND_SEQ_PORT_CAP_SUBS_WRITE  = 0x40,
      SND_SEQ_PORT_CAP_READ        = 0x01,
      SND_SEQ_PORT_CAP_SUBS_READ   = 0x20
    };

    // Port type
    enum {
      SND_SEQ_PORT_TYPE_MIDI_GENERIC = 0x02,
      SND_SEQ_PORT_TYPE_APPLICATION  = 0x100000
    };

    // Event structure (simplified — we only read type + note/CC fields)
    // The actual struct is 28 bytes on 64-bit, but we use the accessor API.
    typedef struct snd_seq_event {
      unsigned char type;
      unsigned char flags;
      unsigned char tag;
      unsigned char queue;
      int           time_tick;     // simplified: union tick/real
      int           time_pad;
      unsigned char source_client;
      unsigned char source_port;
      unsigned char dest_client;
      unsigned char dest_port;
      // Union data — we access note/cc via offset
      unsigned char data[12];
    } snd_seq_event_t;

    // Core API
    int snd_seq_open(snd_seq_t** handle, const char* name, int streams, int mode);
    int snd_seq_close(snd_seq_t* handle);
    int snd_seq_set_client_name(snd_seq_t* handle, const char* name);
    int snd_seq_client_id(snd_seq_t* handle);

    // Port
    int snd_seq_create_simple_port(snd_seq_t* handle, const char* name,
      unsigned int caps, unsigned int type);

    // Subscription (connect to all MIDI outputs)
    int snd_seq_connect_from(snd_seq_t* handle, int myport, int src_client, int src_port);
    int snd_seq_disconnect_from(snd_seq_t* handle, int myport, int src_client, int src_port);

    // Event input
    int snd_seq_event_input(snd_seq_t* handle, snd_seq_event_t** ev);
    int snd_seq_event_input_pending(snd_seq_t* handle, int fetch_sequencer);

    // Client/port enumeration
    typedef struct snd_seq_client_info snd_seq_client_info_t;
    typedef struct snd_seq_port_info snd_seq_port_info_t;

    size_t snd_seq_client_info_sizeof(void);
    size_t snd_seq_port_info_sizeof(void);

    void snd_seq_client_info_set_client(snd_seq_client_info_t* info, int client);
    int  snd_seq_client_info_get_client(const snd_seq_client_info_t* info);
    const char* snd_seq_client_info_get_name(const snd_seq_client_info_t* info);

    void snd_seq_port_info_set_client(snd_seq_port_info_t* info, int client);
    void snd_seq_port_info_set_port(snd_seq_port_info_t* info, int port);
    int  snd_seq_port_info_get_port(const snd_seq_port_info_t* info);
    const char* snd_seq_port_info_get_name(const snd_seq_port_info_t* info);
    unsigned int snd_seq_port_info_get_capability(const snd_seq_port_info_t* info);
    unsigned int snd_seq_port_info_get_type(const snd_seq_port_info_t* info);

    int snd_seq_query_next_client(snd_seq_t* handle, snd_seq_client_info_t* info);
    int snd_seq_query_next_port(snd_seq_t* handle, snd_seq_port_info_t* info);
  ]])

  if not ok then
    -- Structs might already be declared from another module
    io.write("[midi] ALSA cdef: " .. tostring(err) .. "\n"); io.flush()
  end

  -- Load libasound
  local loadOk
  loadOk, alsaLib = pcall(ffi.load, "asound")
  if not loadOk then
    io.write("[midi] Cannot load libasound: " .. tostring(alsaLib) .. "\n"); io.flush()
    return false
  end

  -- Open ALSA sequencer in non-blocking input mode
  local seqPtr = ffi.new("snd_seq_t*[1]")
  local ret = alsaLib.snd_seq_open(seqPtr, "default", 2, 1)  -- SND_SEQ_OPEN_INPUT, SND_SEQ_NONBLOCK
  if ret < 0 then
    io.write("[midi] snd_seq_open failed: " .. ret .. "\n"); io.flush()
    return false
  end
  seq = seqPtr[0]

  alsaLib.snd_seq_set_client_name(seq, "ReactJIT Audio")

  -- Create an input port
  local caps = 0x02 + 0x40  -- WRITE + SUBS_WRITE (we receive MIDI)
  local ptype = 0x02 + 0x100000  -- MIDI_GENERIC + APPLICATION
  portId = alsaLib.snd_seq_create_simple_port(seq, "MIDI In", caps, ptype)
  if portId < 0 then
    io.write("[midi] Failed to create port: " .. portId .. "\n"); io.flush()
    alsaLib.snd_seq_close(seq)
    seq = nil
    return false
  end

  io.write("[midi] ALSA sequencer opened, port " .. portId .. "\n"); io.flush()
  return true
end

-- ============================================================================
-- Device enumeration
-- ============================================================================

local function scanDevices()
  if not seq then return end

  devices = {}
  local myClient = alsaLib.snd_seq_client_id(seq)

  -- Allocate info structs on stack
  local clientInfoSize = alsaLib.snd_seq_client_info_sizeof()
  local portInfoSize = alsaLib.snd_seq_port_info_sizeof()
  local clientInfo = ffi.new("char[?]", clientInfoSize)
  local portInfo = ffi.new("char[?]", portInfoSize)

  -- Zero-fill
  ffi.fill(clientInfo, clientInfoSize)
  ffi.fill(portInfo, portInfoSize)

  -- Set client to -1 to start enumeration
  local ci = ffi.cast("snd_seq_client_info_t*", clientInfo)
  local pi = ffi.cast("snd_seq_port_info_t*", portInfo)
  alsaLib.snd_seq_client_info_set_client(ci, -1)

  while alsaLib.snd_seq_query_next_client(seq, ci) >= 0 do
    local clientId = alsaLib.snd_seq_client_info_get_client(ci)
    if clientId ~= myClient then
      local clientName = ffi.string(alsaLib.snd_seq_client_info_get_name(ci))

      -- Enumerate ports for this client
      ffi.fill(portInfo, portInfoSize)
      alsaLib.snd_seq_port_info_set_client(pi, clientId)
      alsaLib.snd_seq_port_info_set_port(pi, -1)

      while alsaLib.snd_seq_query_next_port(seq, pi) >= 0 do
        local caps = alsaLib.snd_seq_port_info_get_capability(pi)
        -- We want ports that can READ (output MIDI events to us)
        local canRead = bit.band(caps, 0x01 + 0x20) == (0x01 + 0x20)
        if canRead then
          local portNum = alsaLib.snd_seq_port_info_get_port(pi)
          local portName = ffi.string(alsaLib.snd_seq_port_info_get_name(pi))

          devices[#devices + 1] = {
            id        = clientId .. ":" .. portNum,
            name      = clientName .. " - " .. portName,
            client    = clientId,
            port      = portNum,
            connected = false,
          }
        end
      end
    end
  end

  -- Auto-connect to all MIDI output devices
  for _, dev in ipairs(devices) do
    local ret = alsaLib.snd_seq_connect_from(seq, portId, dev.client, dev.port)
    if ret >= 0 then
      dev.connected = true
    end
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

function MIDI.init()
  MIDI.available = tryInit()
  if MIDI.available then
    scanDevices()
    io.write("[midi] Found " .. #devices .. " MIDI device(s)\n"); io.flush()
    for _, dev in ipairs(devices) do
      io.write("[midi]   " .. dev.name .. (dev.connected and " (connected)" or " (failed)") .. "\n")
      io.flush()
    end
  end
end

--- Poll for MIDI events. Returns a list of events.
--- Call this every frame.
--- @return table[] List of { type, note?, velocity?, cc?, value?, channel?, device? }
function MIDI.poll()
  if not seq then return {} end

  local events = {}
  local evPtr = ffi.new("snd_seq_event_t*[1]")

  -- Check for pending events (non-blocking)
  while alsaLib.snd_seq_event_input_pending(seq, 1) > 0 do
    local ret = alsaLib.snd_seq_event_input(seq, evPtr)
    if ret < 0 then break end

    local ev = evPtr[0]
    local evType = ev.type

    -- Note data is at data[0..4]: channel, note, velocity, off_velocity, duration
    -- CC data is at data[0..4]: channel, unused, unused, param, value
    local deviceName = ev.source_client .. ":" .. ev.source_port

    -- Check if this device is blocked by the user via system panel
    local _sp = package.loaded["lua.system_panel"]
    if _sp and _sp.isDeviceBlocked and _sp.isDeviceBlocked("midi", deviceName) then
      goto continue_poll
    end

    if evType == 6 then  -- NOTEON
      local channel  = ev.data[0]
      local note     = ev.data[1]
      local velocity = ev.data[2]
      if velocity == 0 then
        events[#events + 1] = {
          type = "note_off", note = note, velocity = 0,
          channel = channel, device = deviceName,
        }
      else
        events[#events + 1] = {
          type = "note_on", note = note, velocity = velocity,
          channel = channel, device = deviceName,
        }
      end
    elseif evType == 7 then  -- NOTEOFF
      local channel  = ev.data[0]
      local note     = ev.data[1]
      events[#events + 1] = {
        type = "note_off", note = note, velocity = 0,
        channel = channel, device = deviceName,
      }
    elseif evType == 10 then  -- CONTROLLER
      local channel = ev.data[0]
      -- param at bytes 4-7 (uint32), value at bytes 8-11 (int32)
      -- But for single-byte MIDI CC, data layout varies.
      -- Safe approach: use byte offsets for the controller event
      local param = ev.data[4] + ev.data[5] * 256
      local value = ev.data[8] + ev.data[9] * 256
      -- Clamp to 7-bit range
      if param > 127 then param = param % 128 end
      if value > 127 then value = value % 128 end
      events[#events + 1] = {
        type = "cc", cc = param, value = value,
        channel = channel, device = deviceName,
      }
    elseif evType == 36 then  -- CLOCK
      events[#events + 1] = { type = "clock" }
    elseif evType == 40 then  -- START
      events[#events + 1] = { type = "start" }
    elseif evType == 42 then  -- STOP
      events[#events + 1] = { type = "stop" }
    end
    ::continue_poll::
  end

  -- Periodic device re-scan (every ~5 seconds)
  local now = love and love.timer and love.timer.getTime() or os.clock()
  if now - lastScan > 5 then
    lastScan = now
    scanDevices()
  end

  return events
end

--- Get list of detected MIDI devices.
--- @return table[] List of { id, name, connected }
function MIDI.getDevices()
  local result = {}
  for _, dev in ipairs(devices) do
    result[#result + 1] = {
      id        = dev.id,
      name      = dev.name,
      connected = dev.connected,
    }
  end
  return result
end

--- Clean up ALSA resources.
function MIDI.shutdown()
  if seq then
    alsaLib.snd_seq_close(seq)
    seq = nil
  end
end

return MIDI
