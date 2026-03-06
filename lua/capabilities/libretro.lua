--[[
  capabilities/libretro.lua — libretro core compatibility layer

  Loads any libretro-compatible emulator core (.so/.dylib) and renders its
  output as a visual capability. Supports video (all pixel formats), audio
  (via QueueableSource), keyboard + gamepad input, SRAM save persistence,
  and save states.

  React usage:
    <Libretro core="/usr/lib/libretro/snes9x_libretro.so" rom="zelda.sfc" running />
    <Libretro core="cores/mgba_libretro.so" rom="pokemon.gba" volume={0.6} />

  Props:
    core     string   Path to libretro core shared library
    rom      string   Path to ROM file (Love2D VFS or absolute OS path)
    running  boolean  Run/pause emulation (default: true)
    volume   number   Audio volume 0-1 (default: 1)
    speed    number   Emulation speed multiplier (default: 1)
    muted    boolean  Mute audio (default: false)

  Events:
    onLoaded  { coreName, coreVersion, romPath }
    onError   { message }
    onReset   {}
]]

local ffi = require("ffi")
local bit = require("bit")
local Capabilities = require("lua.capabilities")

-- ============================================================================
-- FFI Declarations
-- ============================================================================

if not _G._libretro_ffi_declared then
  _G._libretro_ffi_declared = true
  ffi.cdef[[
    /* Structs */
    struct retro_system_info {
      const char *library_name;
      const char *library_version;
      const char *valid_extensions;
      bool        need_fullpath;
      bool        block_extract;
    };

    struct retro_game_geometry {
      unsigned base_width;
      unsigned base_height;
      unsigned max_width;
      unsigned max_height;
      float    aspect_ratio;
    };

    struct retro_system_timing {
      double fps;
      double sample_rate;
    };

    struct retro_system_av_info {
      struct retro_game_geometry geometry;
      struct retro_system_timing timing;
    };

    struct retro_game_info {
      const char *path;
      const void *data;
      size_t      size;
      const char *meta;
    };

    struct retro_variable {
      const char *key;
      const char *value;
    };

    struct retro_message {
      const char *msg;
      unsigned    frames;
    };

    struct retro_input_descriptor {
      unsigned    port;
      unsigned    device;
      unsigned    index;
      unsigned    id;
      const char *description;
    };

    /* Callback typedefs */
    typedef bool    (*retro_environment_t)(unsigned cmd, void *data);
    typedef void    (*retro_video_refresh_t)(const void *data, unsigned width,
                                             unsigned height, size_t pitch);
    typedef void    (*retro_audio_sample_t)(int16_t left, int16_t right);
    typedef size_t  (*retro_audio_sample_batch_t)(const int16_t *data,
                                                  size_t frames);
    typedef void    (*retro_input_poll_t)(void);
    typedef int16_t (*retro_input_state_t)(unsigned port, unsigned device,
                                           unsigned index, unsigned id);

    /* Core API — resolved per .so via ffi.load */
    void retro_init(void);
    void retro_deinit(void);
    unsigned retro_api_version(void);
    void retro_get_system_info(struct retro_system_info *info);
    void retro_get_system_av_info(struct retro_system_av_info *info);
    bool retro_load_game(const struct retro_game_info *game);
    void retro_unload_game(void);
    void retro_run(void);
    void retro_reset(void);
    void retro_set_environment(retro_environment_t);
    void retro_set_video_refresh(retro_video_refresh_t);
    void retro_set_audio_sample(retro_audio_sample_t);
    void retro_set_audio_sample_batch(retro_audio_sample_batch_t);
    void retro_set_input_poll(retro_input_poll_t);
    void retro_set_input_state(retro_input_state_t);
    size_t retro_serialize_size(void);
    bool   retro_serialize(void *data, size_t size);
    bool   retro_unserialize(const void *data, size_t size);
    size_t retro_get_memory_size(unsigned id);
    void  *retro_get_memory_data(unsigned id);
    void retro_set_controller_port_device(unsigned port, unsigned device);
  ]]
end

-- ============================================================================
-- Constants
-- ============================================================================

local PIXEL_0RGB1555 = 0
local PIXEL_XRGB8888 = 1
local PIXEL_RGB565   = 2

local MEMORY_SAVE_RAM = 0

-- Joypad button IDs
local JP = {
  B=0, Y=1, SELECT=2, START=3, UP=4, DOWN=5, LEFT=6, RIGHT=7,
  A=8, X=9, L=10, R=11, L2=12, R2=13, L3=14, R3=15,
}

-- Keyboard → joypad
local KEY_TO_JP = {
  up = JP.UP, down = JP.DOWN, left = JP.LEFT, right = JP.RIGHT,
  z = JP.A, x = JP.B, a = JP.X, s = JP.Y,
  ["return"] = JP.START, rshift = JP.SELECT,
  q = JP.L, w = JP.R,
}

-- Love2D gamepad button → libretro joypad
local GP_TO_JP = {
  a = JP.A, b = JP.B, x = JP.X, y = JP.Y,
  start = JP.START, back = JP.SELECT,
  leftshoulder = JP.L, rightshoulder = JP.R,
  leftstick = JP.L3, rightstick = JP.R3,
  dpup = JP.UP, dpdown = JP.DOWN, dpleft = JP.LEFT, dpright = JP.RIGHT,
}

-- Environment commands we handle
local ENV = {
  SET_ROTATION           = 1,
  GET_OVERSCAN           = 2,
  GET_CAN_DUPE           = 3,
  SET_MESSAGE             = 6,
  SHUTDOWN               = 7,
  SET_PERFORMANCE_LEVEL  = 8,
  GET_SYSTEM_DIRECTORY   = 9,
  SET_PIXEL_FORMAT       = 10,
  SET_INPUT_DESCRIPTORS  = 11,
  GET_VARIABLE           = 15,
  SET_VARIABLES          = 16,
  GET_VARIABLE_UPDATE    = 17,
  SET_SUPPORT_NO_GAME    = 18,
  GET_INPUT_DEVICE_CAPS  = 24,
  GET_LOG_INTERFACE      = 27,
  GET_SAVE_DIRECTORY     = 31,
  SET_CONTROLLER_INFO    = 35,
  SET_GEOMETRY           = 37,
  GET_LANGUAGE           = 39,
  GET_CORE_OPTIONS_VER   = 52,
}

-- ============================================================================
-- Directories (created lazily)
-- ============================================================================

local saveDirC, systemDirC
local dirsInitialized = false

local function ensureDirs()
  if dirsInitialized then return end
  dirsInitialized = true
  love.filesystem.createDirectory("libretro")
  love.filesystem.createDirectory("libretro/saves")
  love.filesystem.createDirectory("libretro/system")
  local base = love.filesystem.getSaveDirectory()
  local sd = base .. "/libretro/saves"
  local syd = base .. "/libretro/system"
  saveDirC = ffi.new("char[?]", #sd + 1)
  ffi.copy(saveDirC, sd)
  systemDirC = ffi.new("char[?]", #syd + 1)
  ffi.copy(systemDirC, syd)
end

-- ============================================================================
-- Active instance (set before retro_run, cleared after)
-- ============================================================================

local activeState = nil

-- ============================================================================
-- Audio buffer (shared across instances, drained after each retro_run)
-- ============================================================================

local AUDIO_BUF_MAX = 16384  -- max stereo frames per tick
local audioBuf = ffi.new("int16_t[?]", AUDIO_BUF_MAX * 2)
local audioBufPos = 0

-- ============================================================================
-- Pixel format converters (src → RGBA8888 for Love2D ImageData)
-- ============================================================================

local function convertXRGB8888(src, dst, w, h, pitch)
  local band, rsh, lsh, bor = bit.band, bit.rshift, bit.lshift, bit.bor
  for y = 0, h - 1 do
    local srcRow = ffi.cast("const uint32_t*", ffi.cast("const uint8_t*", src) + y * pitch)
    local dstRow = ffi.cast("uint32_t*", dst + y * w * 4)
    for x = 0, w - 1 do
      local px = srcRow[x]
      local r = band(rsh(px, 16), 0xFF)
      local g = band(rsh(px, 8), 0xFF)
      local b = band(px, 0xFF)
      dstRow[x] = bor(r, lsh(g, 8), lsh(b, 16), 0xFF000000)
    end
  end
end

local function convertRGB565(src, dst, w, h, pitch)
  local band, rsh, lsh, bor = bit.band, bit.rshift, bit.lshift, bit.bor
  for y = 0, h - 1 do
    local srcRow = ffi.cast("const uint16_t*", ffi.cast("const uint8_t*", src) + y * pitch)
    local dstRow = ffi.cast("uint32_t*", dst + y * w * 4)
    for x = 0, w - 1 do
      local px = srcRow[x]
      local r = lsh(rsh(px, 11), 3)
      local g = lsh(band(rsh(px, 5), 0x3F), 2)
      local b = lsh(band(px, 0x1F), 3)
      dstRow[x] = bor(r, lsh(g, 8), lsh(b, 16), 0xFF000000)
    end
  end
end

local function convert0RGB1555(src, dst, w, h, pitch)
  local band, rsh, lsh, bor = bit.band, bit.rshift, bit.lshift, bit.bor
  for y = 0, h - 1 do
    local srcRow = ffi.cast("const uint16_t*", ffi.cast("const uint8_t*", src) + y * pitch)
    local dstRow = ffi.cast("uint32_t*", dst + y * w * 4)
    for x = 0, w - 1 do
      local px = srcRow[x]
      local r = lsh(band(rsh(px, 10), 0x1F), 3)
      local g = lsh(band(rsh(px, 5), 0x1F), 3)
      local b = lsh(band(px, 0x1F), 3)
      dstRow[x] = bor(r, lsh(g, 8), lsh(b, 16), 0xFF000000)
    end
  end
end

-- ============================================================================
-- Utility
-- ============================================================================

local function toCStr(s)
  local buf = ffi.new("char[?]", #s + 1)
  ffi.copy(buf, s)
  return buf
end

local function readFile(path)
  -- Try Love2D VFS first
  if love.filesystem.getInfo(path) then
    local ok, data = pcall(love.filesystem.read, "data", path)
    if ok and data then return data end
  end
  -- Absolute OS path fallback
  local f = io.open(path, "rb")
  if not f then return nil, "Cannot open: " .. tostring(path) end
  local data = f:read("*a")
  f:close()
  return data
end

-- ============================================================================
-- Libretro callbacks
-- ============================================================================

local function envCallback(cmd, data)
  local c = tonumber(cmd)
  local st = activeState

  if c == ENV.SET_PIXEL_FORMAT then
    if st then st.pixelFormat = tonumber(ffi.cast("unsigned*", data)[0]) end
    return true

  elseif c == ENV.GET_CAN_DUPE then
    ffi.cast("bool*", data)[0] = true
    return true

  elseif c == ENV.GET_SYSTEM_DIRECTORY then
    ensureDirs()
    ffi.cast("const char**", data)[0] = systemDirC
    return true

  elseif c == ENV.GET_SAVE_DIRECTORY then
    ensureDirs()
    ffi.cast("const char**", data)[0] = saveDirC
    return true

  elseif c == ENV.SET_PIXEL_FORMAT then
    if st then st.pixelFormat = tonumber(ffi.cast("unsigned*", data)[0]) end
    return true

  elseif c == ENV.SET_VARIABLES then
    if st and data ~= nil then
      local vars = ffi.cast("struct retro_variable*", data)
      st.variables = {}
      local i = 0
      while vars[i].key ~= nil do
        local key = ffi.string(vars[i].key)
        local val = ffi.string(vars[i].value)
        local desc, opts = val:match("(.+);%s*(.+)")
        local default = opts and opts:match("^([^|]+)") or ""
        st.variables[key] = { desc = desc, value = default, options = opts }
        i = i + 1
      end
    end
    return true

  elseif c == ENV.GET_VARIABLE then
    if st and data ~= nil then
      local var = ffi.cast("struct retro_variable*", data)
      if var.key ~= nil then
        local key = ffi.string(var.key)
        if st.variables and st.variables[key] then
          local val = st.variables[key].value
          if not st.varStrings then st.varStrings = {} end
          st.varStrings[key] = toCStr(val)
          var.value = st.varStrings[key]
          return true
        end
      end
    end
    return false

  elseif c == ENV.GET_VARIABLE_UPDATE then
    if data ~= nil then ffi.cast("bool*", data)[0] = false end
    return true

  elseif c == ENV.GET_OVERSCAN then
    if data ~= nil then ffi.cast("bool*", data)[0] = false end
    return true

  elseif c == ENV.SET_INPUT_DESCRIPTORS then return true
  elseif c == ENV.SET_CONTROLLER_INFO then return true
  elseif c == ENV.SET_PERFORMANCE_LEVEL then return true
  elseif c == ENV.SET_SUPPORT_NO_GAME then return true
  elseif c == ENV.SET_ROTATION then return true

  elseif c == ENV.GET_INPUT_DEVICE_CAPS then
    if data ~= nil then ffi.cast("uint64_t*", data)[0] = 2 end  -- bit 1 = joypad
    return true

  elseif c == ENV.GET_LOG_INTERFACE then
    return false  -- variadic callback, can't implement in LuaJIT

  elseif c == ENV.GET_CORE_OPTIONS_VER then
    if data ~= nil then ffi.cast("unsigned*", data)[0] = 0 end
    return true

  elseif c == ENV.SET_GEOMETRY then
    if st and data ~= nil then
      local geom = ffi.cast("struct retro_game_geometry*", data)
      st.baseWidth = tonumber(geom.base_width)
      st.baseHeight = tonumber(geom.base_height)
    end
    return true

  elseif c == ENV.GET_LANGUAGE then
    if data ~= nil then ffi.cast("unsigned*", data)[0] = 0 end  -- English
    return true

  elseif c == ENV.SET_MESSAGE then
    if data ~= nil then
      local msg = ffi.cast("struct retro_message*", data)
      if msg.msg ~= nil then
        io.write("[libretro] " .. ffi.string(msg.msg) .. "\n"); io.flush()
      end
    end
    return true

  elseif c == ENV.SHUTDOWN then
    if st then st.shutdownRequested = true end
    return true
  end

  return false
end

local function videoCallback(data, width, height, pitch)
  if not activeState or data == nil then return end  -- frame dupe
  local st = activeState
  local w = tonumber(width)
  local h = tonumber(height)

  -- Resize buffers if needed
  if st.fbWidth ~= w or st.fbHeight ~= h then
    st.fbWidth = w
    st.fbHeight = h
    if st.imageData then st.imageData:release() end
    st.imageData = love.image.newImageData(w, h)
    if st.image then st.image:release(); st.image = nil end
  end

  local dst = ffi.cast("uint8_t*", st.imageData:getFFIPointer())
  if st.pixelFormat == PIXEL_XRGB8888 then
    convertXRGB8888(data, dst, w, h, tonumber(pitch))
  elseif st.pixelFormat == PIXEL_RGB565 then
    convertRGB565(data, dst, w, h, tonumber(pitch))
  else
    convert0RGB1555(data, dst, w, h, tonumber(pitch))
  end
  st.videoDirty = true
end

local function audioSampleCallback(left, right)
  if not activeState then return end
  if audioBufPos + 2 <= AUDIO_BUF_MAX * 2 then
    audioBuf[audioBufPos] = left
    audioBuf[audioBufPos + 1] = right
    audioBufPos = audioBufPos + 2
  end
end

local function audioBatchCallback(data, frames)
  if not activeState then return frames end
  local n = tonumber(frames) * 2
  local remaining = AUDIO_BUF_MAX * 2 - audioBufPos
  local toCopy = math.min(n, remaining)
  if toCopy > 0 then
    ffi.copy(audioBuf + audioBufPos, data, toCopy * 2)
    audioBufPos = audioBufPos + toCopy
  end
  return frames
end

local function inputPollCallback() end

local function inputStateCallback(port, device, index, id)
  if not activeState then return 0 end
  if tonumber(device) ~= 1 then return 0 end  -- RETRO_DEVICE_JOYPAD only
  local portN = tonumber(port)
  local idN = tonumber(id)

  -- Keyboard (player 1 only)
  if portN == 0 and activeState.buttons[idN] then return 1 end

  -- Gamepad
  local joysticks = love.joystick.getJoysticks()
  local js = joysticks[portN + 1]
  if js and js:isGamepad() then
    -- D-pad buttons
    local btn = GP_TO_JP[idN]  -- reverse lookup not needed; check by ID
    for gpName, jpId in pairs(GP_TO_JP) do
      if jpId == idN and js:isGamepadDown(gpName) then return 1 end
    end
    -- Analog stick as d-pad
    if idN == JP.LEFT  and js:getGamepadAxis("leftx") < -0.5 then return 1 end
    if idN == JP.RIGHT and js:getGamepadAxis("leftx") >  0.5 then return 1 end
    if idN == JP.UP    and js:getGamepadAxis("lefty") < -0.5 then return 1 end
    if idN == JP.DOWN  and js:getGamepadAxis("lefty") >  0.5 then return 1 end
    -- Triggers
    if idN == JP.L2 and js:getGamepadAxis("triggerleft")  > 0.3 then return 1 end
    if idN == JP.R2 and js:getGamepadAxis("triggerright") > 0.3 then return 1 end
  end

  return 0
end

-- Cast callbacks once (kept alive as upvalues, never GC'd)
local envCb         = ffi.cast("retro_environment_t",          envCallback)
local videoCb       = ffi.cast("retro_video_refresh_t",        videoCallback)
local audioSmpCb    = ffi.cast("retro_audio_sample_t",         audioSampleCallback)
local audioBatchCb  = ffi.cast("retro_audio_sample_batch_t",   audioBatchCallback)
local inputPollCb   = ffi.cast("retro_input_poll_t",           inputPollCallback)
local inputStateCb  = ffi.cast("retro_input_state_t",          inputStateCallback)

-- ============================================================================
-- SRAM persistence
-- ============================================================================

local function sramPath(state)
  return "libretro/saves/" .. (state.saveName or "unknown") .. ".srm"
end

local function saveSRAM(state)
  if not state.core or not state.gameLoaded then return end
  local size = tonumber(state.core.retro_get_memory_size(MEMORY_SAVE_RAM))
  if size == 0 then return end
  local ptr = state.core.retro_get_memory_data(MEMORY_SAVE_RAM)
  if ptr == nil then return end
  local data = ffi.string(ffi.cast("const char*", ptr), size)
  love.filesystem.write(sramPath(state), data)
end

local function loadSRAM(state)
  if not state.core or not state.gameLoaded then return end
  local size = tonumber(state.core.retro_get_memory_size(MEMORY_SAVE_RAM))
  if size == 0 then return end
  local ptr = state.core.retro_get_memory_data(MEMORY_SAVE_RAM)
  if ptr == nil then return end
  local path = sramPath(state)
  if not love.filesystem.getInfo(path) then return end
  local ok, data = pcall(love.filesystem.read, "data", path)
  if ok and data and #data == size then
    ffi.copy(ptr, data, size)
  end
end

-- ============================================================================
-- Core loader
-- ============================================================================

local function loadCore(corePath)
  -- Resolve to absolute path if needed
  local libpath = corePath
  if not corePath:match("^/") then
    local source = love.filesystem.getSource()
    if source then
      local isFused = love.filesystem.isFused and love.filesystem.isFused()
      local isLoveFile = source:match("%.love$")
      if isFused or isLoveFile then
        source = source:match("(.+)/[^/]+$") or source
      end
      libpath = source .. "/" .. corePath
    end
  end

  local ok, lib = pcall(ffi.load, libpath)
  if not ok then
    return nil, "Failed to load core: " .. tostring(lib)
  end
  return lib
end

-- ============================================================================
-- Capability registration
-- ============================================================================

Capabilities.register("Libretro", {
  visual = true,
  hittable = true,

  schema = {
    core    = { type = "string", desc = "Path to libretro core .so/.dylib" },
    rom     = { type = "string", desc = "Path to ROM file" },
    running = { type = "bool",   default = true,  desc = "Run or pause emulation" },
    volume  = { type = "number", min = 0, max = 1, default = 1, desc = "Audio volume" },
    speed   = { type = "number", min = 0.25, max = 4, default = 1, desc = "Emulation speed" },
    muted   = { type = "bool",   default = false, desc = "Mute audio" },
  },

  events = { "onLoaded", "onError", "onReset" },

  create = function(nodeId, props)
    ensureDirs()

    local state = {
      core = nil,
      gameLoaded = false,
      pixelFormat = PIXEL_0RGB1555,
      fbWidth = 0,
      fbHeight = 0,
      baseWidth = 0,
      baseHeight = 0,
      fps = 60,
      sampleRate = 44100,
      imageData = nil,
      image = nil,
      videoDirty = false,
      audioSource = nil,
      buttons = {},
      variables = {},
      varStrings = {},
      timeAccum = 0,
      running = props.running ~= false,
      volume = props.volume or 1,
      coreName = "",
      coreVersion = "",
      saveName = nil,
      shutdownRequested = false,
      _loadError = nil,
      _loaded = false,
      romBuf = nil,   -- prevent GC of ROM data
      romPathC = nil,  -- C string for need_fullpath cores
    }

    -- Initialize all joypad buttons to false
    for _, id in pairs(JP) do state.buttons[id] = false end

    if not props.core then
      state._loadError = "No core specified"
      return state
    end

    -- Load core .so
    local core, err = loadCore(props.core)
    if not core then
      state._loadError = err
      return state
    end
    state.core = core

    -- Set environment callback FIRST (cores call it during retro_init)
    activeState = state
    core.retro_set_environment(envCb)
    core.retro_init()

    -- Get system info
    local sysInfo = ffi.new("struct retro_system_info")
    core.retro_get_system_info(sysInfo)
    state.coreName = sysInfo.library_name ~= nil and ffi.string(sysInfo.library_name) or "unknown"
    state.coreVersion = sysInfo.library_version ~= nil and ffi.string(sysInfo.library_version) or ""
    local needFullpath = sysInfo.need_fullpath

    -- Set remaining callbacks
    core.retro_set_video_refresh(videoCb)
    core.retro_set_audio_sample(audioSmpCb)
    core.retro_set_audio_sample_batch(audioBatchCb)
    core.retro_set_input_poll(inputPollCb)
    core.retro_set_input_state(inputStateCb)

    -- Load ROM
    if props.rom then
      local romData, romErr = readFile(props.rom)
      if not romData then
        state._loadError = romErr or ("Cannot read ROM: " .. tostring(props.rom))
        activeState = nil
        return state
      end

      -- Derive save name from ROM filename
      local romFilename = props.rom:match("([^/\\]+)$") or props.rom
      state.saveName = romFilename:gsub("%.[^.]+$", "")

      local gameInfo = ffi.new("struct retro_game_info")
      if needFullpath then
        -- Core wants to open the file itself — provide OS path
        local osPath = props.rom
        if not props.rom:match("^/") and love.filesystem.getInfo(props.rom) then
          osPath = love.filesystem.getRealDirectory(props.rom) .. "/" .. props.rom
        end
        state.romPathC = toCStr(osPath)
        gameInfo.path = state.romPathC
        gameInfo.data = nil
        gameInfo.size = 0
      else
        -- Pass ROM data in memory
        state.romBuf = ffi.new("uint8_t[?]", #romData)
        ffi.copy(state.romBuf, romData, #romData)
        state.romPathC = toCStr(props.rom)
        gameInfo.path = state.romPathC
        gameInfo.data = state.romBuf
        gameInfo.size = #romData
      end
      gameInfo.meta = nil

      if not core.retro_load_game(gameInfo) then
        state._loadError = "Core rejected ROM: " .. tostring(props.rom)
        activeState = nil
        return state
      end
      state.gameLoaded = true

      -- Get AV info
      local avInfo = ffi.new("struct retro_system_av_info")
      core.retro_get_system_av_info(avInfo)
      state.fps = avInfo.timing.fps > 0 and avInfo.timing.fps or 60
      state.sampleRate = avInfo.timing.sample_rate > 0 and avInfo.timing.sample_rate or 44100
      state.baseWidth = tonumber(avInfo.geometry.base_width)
      state.baseHeight = tonumber(avInfo.geometry.base_height)
      state.fbWidth = state.baseWidth
      state.fbHeight = state.baseHeight

      -- Create video buffers
      state.imageData = love.image.newImageData(state.fbWidth, state.fbHeight)

      -- Create audio source
      local aok, src = pcall(love.audio.newQueueableSource, state.sampleRate, 16, 2, 8)
      if aok and src then
        state.audioSource = src
        src:setVolume(state.volume)
      end

      -- Load SRAM if exists
      loadSRAM(state)

      state._loaded = true
      io.write("[libretro] Loaded " .. state.coreName .. " v" .. state.coreVersion
               .. " — " .. romFilename .. " (" .. state.fbWidth .. "x" .. state.fbHeight
               .. " @ " .. string.format("%.1f", state.fps) .. "fps)\n")
      io.flush()
    end

    activeState = nil
    return state
  end,

  update = function(nodeId, props, prev, state)
    -- Running state
    state.running = props.running ~= false

    -- Volume
    if props.volume ~= prev.volume or props.muted ~= prev.muted then
      state.volume = props.volume or 1
      if state.audioSource then
        state.audioSource:setVolume(props.muted and 0 or state.volume)
      end
    end
  end,

  destroy = function(nodeId, state)
    -- Save SRAM before cleanup
    if state.gameLoaded then
      activeState = state
      saveSRAM(state)
      activeState = nil
    end

    -- Unload game and deinit core
    if state.core then
      activeState = state
      if state.gameLoaded then
        pcall(function() state.core.retro_unload_game() end)
      end
      pcall(function() state.core.retro_deinit() end)
      activeState = nil
    end

    -- Release Love2D resources
    if state.imageData then state.imageData:release() end
    if state.image then state.image:release() end
    if state.audioSource then
      state.audioSource:stop()
      state.audioSource:release()
    end

    io.write("[libretro] Destroyed instance " .. tostring(nodeId) .. "\n"); io.flush()
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Fire deferred events
    if state._loadError and pushEvent then
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", message = state._loadError },
      })
      state._loadError = nil
    end

    if state._loaded and pushEvent then
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId, handler = "onLoaded",
          coreName = state.coreName, coreVersion = state.coreVersion,
          romPath = props.rom or "",
        },
      })
      state._loaded = false
    end

    if state.shutdownRequested then
      state.running = false
      state.shutdownRequested = false
    end

    if not state.running or not state.gameLoaded then return end

    -- Time accumulator with speed multiplier
    local speed = props.speed or 1
    state.timeAccum = state.timeAccum + dt * speed
    local frameTime = 1.0 / state.fps

    -- Run up to 4 frames per tick to prevent spiral of death
    local maxFrames = 4
    local framesRun = 0

    activeState = state
    audioBufPos = 0

    while state.timeAccum >= frameTime and framesRun < maxFrames do
      state.core.retro_run()
      state.timeAccum = state.timeAccum - frameTime
      framesRun = framesRun + 1
    end

    -- Clamp accumulator to prevent runaway
    if state.timeAccum > frameTime * 2 then
      state.timeAccum = 0
    end

    activeState = nil

    -- Flush audio
    if audioBufPos > 0 and state.audioSource and not (props.muted == true) then
      local frameCount = math.floor(audioBufPos / 2)
      if frameCount > 0 then
        local ok, sd = pcall(love.sound.newSoundData, frameCount, state.sampleRate, 16, 2)
        if ok and sd then
          ffi.copy(sd:getFFIPointer(), audioBuf, frameCount * 2 * 2)
          state.audioSource:queue(sd)
          sd:release()
          if not state.audioSource:isPlaying() then
            state.audioSource:play()
          end
        end
      end
    end

    -- Update image from video buffer
    if state.videoDirty and state.imageData then
      state.videoDirty = false
      if state.image then
        state.image:replacePixels(state.imageData)
      else
        state.image = love.graphics.newImage(state.imageData)
        state.image:setFilter("nearest", "nearest")
      end
    end

    -- Auto-save SRAM every 30 seconds
    state._sramTimer = (state._sramTimer or 0) + dt
    if state._sramTimer >= 30 then
      state._sramTimer = 0
      activeState = state
      saveSRAM(state)
      activeState = nil
    end
  end,

  render = function(node, computed, opacity)
    local state = Capabilities.getInstance(node.id)
    if not state or not state.image then return end

    local c = computed
    if c.w <= 0 or c.h <= 0 then return end

    -- Scale to fit, maintaining aspect ratio (pixel-perfect)
    local imgW = state.fbWidth
    local imgH = state.fbHeight
    if imgW <= 0 or imgH <= 0 then return end

    local scaleX = c.w / imgW
    local scaleY = c.h / imgH
    local scale = math.min(scaleX, scaleY)
    local drawW = imgW * scale
    local drawH = imgH * scale
    local ox = math.floor((c.w - drawW) / 2)
    local oy = math.floor((c.h - drawH) / 2)

    love.graphics.setColor(1, 1, 1, opacity)
    love.graphics.draw(state.image, c.x + ox, c.y + oy, 0, scale, scale)
  end,

  handleKeyPressed = function(nodeId, key, scancode, isrepeat)
    local state = Capabilities.getInstance(nodeId)
    if not state or not state.gameLoaded then return false end
    local btn = KEY_TO_JP[key]
    if btn then
      state.buttons[btn] = true
      return true
    end
    -- Save state: F5, Load state: F8
    if key == "f5" then
      activeState = state
      local size = tonumber(state.core.retro_serialize_size())
      if size > 0 then
        local buf = ffi.new("uint8_t[?]", size)
        if state.core.retro_serialize(buf, size) then
          local data = ffi.string(buf, size)
          love.filesystem.write("libretro/saves/" .. (state.saveName or "unknown") .. ".state", data)
          io.write("[libretro] Save state written\n"); io.flush()
        end
      end
      activeState = nil
      return true
    end
    if key == "f9" then
      activeState = state
      local path = "libretro/saves/" .. (state.saveName or "unknown") .. ".state"
      if love.filesystem.getInfo(path) then
        local ok, data = pcall(love.filesystem.read, "data", path)
        if ok and data then
          local size = tonumber(state.core.retro_serialize_size())
          if #data == size then
            state.core.retro_unserialize(data, size)
            io.write("[libretro] Save state loaded\n"); io.flush()
          end
        end
      end
      activeState = nil
      return true
    end
    -- Reset: F6
    if key == "f6" then
      activeState = state
      state.core.retro_reset()
      activeState = nil
      io.write("[libretro] Reset\n"); io.flush()
      return true
    end
    return false
  end,

  handleKeyReleased = function(nodeId, key, scancode)
    local state = Capabilities.getInstance(nodeId)
    if not state then return false end
    local btn = KEY_TO_JP[key]
    if btn then
      state.buttons[btn] = false
      return true
    end
    return false
  end,
})
