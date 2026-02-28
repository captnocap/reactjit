--[[
  emulator.lua — NES emulation via Agnes for ReactJIT

  Manages NES emulator instances that render into off-screen canvases.
  The painter composites these canvases at layout positions.

  Follows the game.lua pattern:
    syncWithTree() → updateAll() → renderAll() → painter composites

  React usage:
    <Emulator src="game.nes" playing />

  Key design decisions:
  - Each Emulator node gets its own agnes instance (no sharing)
  - ROM is loaded from Love2D filesystem (relative path)
  - Input routes by focus: keyboard goes to focused Emulator
  - Canvas is NES native resolution (256x240), painter scales to layout size
]]

local ffi = require("ffi")

-- Agnes FFI declarations
ffi.cdef[[
  typedef struct agnes agnes_t;
  typedef struct { bool a, b, select, start, up, down, left, right; } agnes_input_t;
  typedef struct { uint8_t r, g, b, a; } agnes_color_t;
  typedef struct agnes_state agnes_state_t;
  agnes_t* agnes_make(void);
  void agnes_destroy(agnes_t*);
  bool agnes_load_ines_data(agnes_t*, void*, size_t);
  void agnes_set_input(agnes_t*, const agnes_input_t*, const agnes_input_t*);
  bool agnes_next_frame(agnes_t*);
  agnes_color_t agnes_get_screen_pixel(const agnes_t*, int, int);
  void agnes_get_screen_buffer(const agnes_t*, uint8_t*);
  size_t agnes_state_size(void);
  void agnes_dump_state(const agnes_t*, agnes_state_t*);
  bool agnes_restore_state(agnes_t*, const agnes_state_t*);
]]

-- Load the agnes shared library from lua/emulator/
-- Uses the same dlopen path resolution as bridge_quickjs.lua:
-- ffi.load uses dlopen which resolves relative to process CWD, not Love2D's
-- game directory. Resolve to absolute path using love.filesystem.getSource().
local agnesLib = nil
local agnesLoadAttempted = false
local function loadAgnes()
  if agnesLib then return agnesLib end
  if agnesLoadAttempted then return nil end
  agnesLoadAttempted = true

  local libExt = ffi.os == "OSX" and ".dylib" or ".so"
  local libpath = "lua/emulator/libagnes" .. libExt

  if love and love.filesystem then
    local source = love.filesystem.getSource()
    if source then
      local isFused = love.filesystem.isFused and love.filesystem.isFused()
      local isLoveFile = source:match("%.love$")
      if isFused or isLoveFile then
        source = source:match("(.+)/[^/]+$") or source
      end
      libpath = source .. "/" .. libpath
    end
  end

  local ok, lib = pcall(ffi.load, libpath)
  if ok then
    agnesLib = lib
    if _G._reactjit_verbose then io.write("[emulator] Loaded libagnes from " .. libpath .. "\n"); io.flush() end
    return agnesLib
  end

  io.write("[emulator] ERROR: Could not load libagnes from " .. libpath .. "\n"); io.flush()
  return nil
end

local NES_W = 256
local NES_H = 240
local NES_FRAME_TIME = 1 / 60.0988  -- NTSC NES frame period (~16.64ms)

local Emulator = {}
local instances = {}     -- nodeId -> { agnes, canvas, imageData, image, src, playing, input1, input2, bounds }
local focusedNodeId = nil
local rgbaBuf = nil      -- Shared RGBA buffer (256*240*4 bytes) — reused across instances

-- Keyboard state (updated by keypressed/keyreleased)
local keyState = {}

function Emulator.init()
  loadAgnes()
  rgbaBuf = ffi.new("uint8_t[?]", NES_W * NES_H * 4)
end

-- Map keyboard state to agnes input struct
local function buildInput()
  local input = ffi.new("agnes_input_t")
  input.up     = keyState["up"]     or false
  input.down   = keyState["down"]   or false
  input.left   = keyState["left"]   or false
  input.right  = keyState["right"]  or false
  input.a      = keyState["z"]      or false
  input.b      = keyState["x"]      or false
  input.start  = keyState["return"] or false
  input.select = keyState["rshift"] or keyState["lshift"] or false
  return input
end

--- Load ROM data into a fresh agnes instance.
--- IMPORTANT: agnes stores a pointer to the ROM data (does NOT copy it).
--- We must keep the data alive in a C allocation that won't be GC'd.
--- @param data string Raw ROM bytes
--- @param label string Display name for logging
--- @return agnes_t*|nil, cdata|nil romBuf (must be kept alive while agnes uses it)
local function loadROMData(data, label)
  local agnes = loadAgnes()
  if not agnes then return nil, nil end

  local emu = agnes.agnes_make()
  if emu == nil then
    io.write("[emulator] agnes_make() failed\n"); io.flush()
    return nil, nil
  end

  -- Copy ROM data into a C-allocated buffer that won't be GC'd by Lua.
  -- agnes_load_ines_data stores a pointer into this buffer — if the backing
  -- memory is freed (e.g. Lua string GC), mapper reads will segfault.
  local romBuf = ffi.new("uint8_t[?]", #data)
  ffi.copy(romBuf, data, #data)

  if not agnes.agnes_load_ines_data(emu, romBuf, #data) then
    io.write("[emulator] Failed to parse iNES data: " .. tostring(label) .. "\n"); io.flush()
    agnes.agnes_destroy(emu)
    return nil, nil
  end

  io.write("[emulator] Loaded ROM: " .. label .. " (" .. #data .. " bytes)\n"); io.flush()
  return emu, romBuf
end

--- Load a ROM from Love2D's virtual filesystem.
--- @param src string ROM path (relative to Love2D filesystem)
--- @return agnes_t*|nil, cdata|nil romBuf
local function loadROM(src)
  local ok, data = pcall(love.filesystem.read, "data", src)
  if not ok or not data then
    io.write("[emulator] Failed to read ROM: " .. tostring(src) .. " — " .. tostring(data) .. "\n"); io.flush()
    return nil, nil
  end
  return loadROMData(data, src)
end

--- Called per-frame from init.lua. Discovers Emulator nodes, loads ROMs, manages canvases.
function Emulator.syncWithTree(nodes)
  local seen = {}
  for id, node in pairs(nodes) do
    if node.type == "Emulator" then
      seen[id] = true
      local src = node.props and node.props.src
      local playing = node.props and node.props.playing ~= false  -- default: playing

      if not instances[id] then
        -- New emulator node: create instance (ROM may come later via file drop)
        local emu, romBuf = nil, nil
        if src then
          emu, romBuf = loadROM(src)
        end
        instances[id] = {
          agnes = emu,
          romBuf = romBuf,  -- prevent GC of ROM data (agnes stores a pointer into it)
          canvas = love.graphics.newCanvas(NES_W, NES_H),
          imageData = love.image.newImageData(NES_W, NES_H),
          image = nil,
          src = src or nil,
          playing = playing,
          bounds = nil,
          timeAccum = 0,    -- accumulates dt; agnes ticks when >= NES_FRAME_TIME
          dirty = false,    -- true when a new NES frame was produced (needs re-render)
        }
        instances[id].canvas:setFilter("nearest", "nearest")
        if not focusedNodeId then focusedNodeId = id end
        io.write("[emulator] Created instance for node " .. id .. (emu and "" or " (awaiting ROM)") .. "\n"); io.flush()
      end

      local entry = instances[id]
      if entry then
        entry.playing = playing

        -- Track layout bounds for input hit testing
        local c = node.computed
        if c then
          entry.bounds = { x = c.x or 0, y = c.y or 0, w = c.w or 0, h = c.h or 0 }
        end

        -- Handle ROM change
        if src and src ~= entry.src then
          local agnes = loadAgnes()
          if agnes and entry.agnes then
            agnes.agnes_destroy(entry.agnes)
          end
          entry.agnes, entry.romBuf = loadROM(src)
          entry.src = src
        end
      end
    end
  end

  -- Clean up removed nodes
  for id, entry in pairs(instances) do
    if not seen[id] then
      local agnes = loadAgnes()
      if agnes and entry.agnes then
        agnes.agnes_destroy(entry.agnes)
      end
      if entry.canvas then entry.canvas:release() end
      instances[id] = nil
      if focusedNodeId == id then focusedNodeId = nil end
      io.write("[emulator] Destroyed instance for node " .. id .. "\n"); io.flush()
    end
  end
end

--- Called per-frame: advance emulation for each playing instance.
--- Uses a time accumulator so the NES runs at ~60.0988 Hz regardless of app framerate.
function Emulator.updateAll(dt, pushEvent)
  local agnes = loadAgnes()
  if not agnes then return end

  local input1 = buildInput()
  local input2 = ffi.new("agnes_input_t")  -- Player 2: empty for now

  for id, entry in pairs(instances) do
    if entry.playing and entry.agnes ~= nil then
      agnes.agnes_set_input(entry.agnes, input1, input2)

      -- Accumulate real time; tick NES only when enough has passed
      entry.timeAccum = entry.timeAccum + dt
      while entry.timeAccum >= NES_FRAME_TIME do
        agnes.agnes_next_frame(entry.agnes)
        entry.timeAccum = entry.timeAccum - NES_FRAME_TIME
        entry.dirty = true
      end
    end
  end
end

--- Called per-frame: render each emulator's framebuffer to its canvas.
--- Only re-uploads pixels when a new NES frame was produced (dirty flag).
function Emulator.renderAll()
  local agnes = loadAgnes()
  if not agnes then return end

  for id, entry in pairs(instances) do
    if entry.agnes ~= nil and entry.canvas and entry.dirty then
      entry.dirty = false

      -- Bulk read framebuffer into RGBA buffer
      agnes.agnes_get_screen_buffer(entry.agnes, rgbaBuf)

      -- Copy RGBA data into Love2D ImageData
      local ptr = ffi.cast("uint8_t*", entry.imageData:getFFIPointer())
      ffi.copy(ptr, rgbaBuf, NES_W * NES_H * 4)

      -- Update or create Image from ImageData
      if entry.image then
        entry.image:replacePixels(entry.imageData)
      else
        entry.image = love.graphics.newImage(entry.imageData)
        entry.image:setFilter("nearest", "nearest")
      end

      -- Draw Image to Canvas
      love.graphics.push("all")
      love.graphics.setCanvas(entry.canvas)
      love.graphics.clear(0, 0, 0, 1)
      love.graphics.setColor(1, 1, 1, 1)
      love.graphics.draw(entry.image, 0, 0)
      love.graphics.pop()
    end
  end
end

--- Get the pre-rendered canvas for a node (called by painter).
--- @param nodeId number
--- @return love.Canvas|nil
function Emulator.get(nodeId)
  local entry = instances[nodeId]
  return entry and entry.canvas
end

-- ============================================================================
-- Input routing
-- ============================================================================

-- Keys that the NES emulator claims when it has focus + a loaded ROM.
local NES_KEYS = {
  up = true, down = true, left = true, right = true,
  z = true, x = true, ["return"] = true, rshift = true, lshift = true,
}

--- Returns true if the key was consumed (prevents propagation to React).
function Emulator.keypressed(key, scancode, isrepeat)
  keyState[key] = true
  -- Consume NES-mapped keys when we have a focused, running instance
  if NES_KEYS[key] and focusedNodeId then
    local entry = instances[focusedNodeId]
    if entry and entry.agnes then
      return true  -- consumed
    end
  end
  return false
end

--- Returns true if the key was consumed.
function Emulator.keyreleased(key, scancode)
  keyState[key] = false
  if NES_KEYS[key] and focusedNodeId then
    local entry = instances[focusedNodeId]
    if entry and entry.agnes then
      return true
    end
  end
  return false
end

function Emulator.mousepressed(x, y, button)
  -- Click to focus
  for nodeId, entry in pairs(instances) do
    local b = entry.bounds
    if b and x >= b.x and x < b.x + b.w and y >= b.y and y < b.y + b.h then
      focusedNodeId = nodeId
      return true
    end
  end
  return false
end

-- ============================================================================
-- File drop — hot-load ROMs directly from OS filesystem
-- ============================================================================

--- Hot-swap a ROM into an existing emulator instance.
--- Destroys the old agnes context and creates a fresh one.
local function hotSwapROM(entry, data, label)
  local agnes = loadAgnes()
  if not agnes then return false end

  -- Destroy old instance
  if entry.agnes then
    agnes.agnes_destroy(entry.agnes)
    entry.agnes = nil
    entry.romBuf = nil
  end

  -- Load new ROM
  entry.agnes, entry.romBuf = loadROMData(data, label)
  if entry.agnes then
    entry.src = label
    entry.playing = true
    entry.image = nil  -- force fresh Image on next render
    io.write("[emulator] Hot-swapped ROM: " .. label .. "\n"); io.flush()
    return true
  end
  return false
end

--- Called from init.lua's filedropped handler.
--- Receives the raw love.DroppedFile + mouse position.
--- Returns true if the emulator consumed the drop (suppresses React dispatch).
--- @param file love.DroppedFile
--- @param mx number Mouse X
--- @param my number Mouse Y
--- @param pushEvent function Event push function
--- @return boolean consumed
function Emulator.filedropped(file, mx, my, pushEvent)
  -- Only care about .nes files
  local path = file:getFilename()
  if not path or not path:match("%.nes$") then return false end

  -- Hit-test: did the file land on an Emulator node?
  local hitId = nil
  for nodeId, entry in pairs(instances) do
    local b = entry.bounds
    if b and mx >= b.x and mx < b.x + b.w and my >= b.y and my < b.y + b.h then
      hitId = nodeId
      break
    end
  end

  -- If no emulator was hit but we have any instance, load into the focused one
  if not hitId then
    if focusedNodeId and instances[focusedNodeId] then
      hitId = focusedNodeId
    else
      -- Pick the first instance
      for nodeId, _ in pairs(instances) do
        hitId = nodeId
        break
      end
    end
  end

  if not hitId then return false end

  -- Read file bytes from OS path
  local f = io.open(path, "rb")
  if not f then
    io.write("[emulator] filedropped: failed to open " .. path .. "\n"); io.flush()
    return false
  end
  local data = f:read("*a")
  f:close()

  if not data or #data == 0 then
    io.write("[emulator] filedropped: empty file " .. path .. "\n"); io.flush()
    return false
  end

  local entry = instances[hitId]
  local filename = path:match("([^/\\]+)$") or path

  if hotSwapROM(entry, data, filename) then
    focusedNodeId = hitId
    -- Notify React that a ROM was loaded
    if pushEvent then
      pushEvent({
        type = "capability",
        payload = {
          type = "capability",
          targetId = hitId,
          handler = "onROMLoaded",
          filename = filename,
          fileSize = #data,
          filePath = path,
        },
      })
    end
    return true
  end
  return false
end

return Emulator
