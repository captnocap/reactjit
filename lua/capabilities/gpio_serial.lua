--[[
  capabilities/gpio_serial.lua — Declarative serial port (UART)

  Polls the serial port each frame for incoming data. Fires events
  when lines or raw bytes arrive — perfect for Arduino, ESP32, Pico,
  or any device that talks over /dev/ttyUSB* or /dev/ttyACM*.

  React usage:
    <SerialPort port="/dev/ttyUSB0" baud={115200}
      onLine={(e) => console.log(e.line)} />

    <SerialPort port="/dev/ttyACM0" baud={9600}
      onData={(e) => handleRaw(e.data)}
      onLine={(e) => setSensorValue(e.line)} />

  Props:
    port        string   Device path (required, e.g. "/dev/ttyUSB0")
    baud        number   Baud rate (default: 9600)
    dataBits    number   5, 6, 7, or 8 (default: 8)
    stopBits    number   1 or 2 (default: 1)
    parity      string   "none", "even", "odd" (default: "none")
    flowControl string   "none" or "hardware" (default: "none")

  Events:
    onLine   { line, port }       Fires when a complete line arrives (\n terminated)
    onData   { data, port, len }  Fires on any raw data (non-line-buffered)
    onError  { error, port }      Fires on read/write errors
]]

local Capabilities = require("lua.capabilities")

local serialMod = nil
local function ensureSerial()
  if not serialMod then
    serialMod = require("lua.gpio.serial")
  end
  return serialMod
end

Capabilities.register("SerialPort", {
  visual = false,

  schema = {
    port        = { type = "string", desc = "Device path, e.g. /dev/ttyUSB0" },
    baud        = { type = "number", default = 9600, desc = "Baud rate" },
    dataBits    = { type = "number", default = 8, desc = "Data bits (5-8)" },
    stopBits    = { type = "number", default = 1, desc = "Stop bits (1 or 2)" },
    parity      = { type = "string", default = "none", desc = "none, even, or odd" },
    flowControl = { type = "string", default = "none", desc = "none or hardware" },
  },

  events = { "onLine", "onData", "onError" },

  create = function(nodeId, props)
    local s = ensureSerial()
    local handle = s.open(props.port, props.baud or 9600, {
      dataBits    = props.dataBits or 8,
      stopBits    = props.stopBits or 1,
      parity      = props.parity or "none",
      flowControl = props.flowControl or "none",
    })

    return {
      handle = handle,
      port = props.port,
    }
  end,

  update = function(nodeId, props, prev, state)
    -- If port or baud changed, re-open
    local needReopen = props.port ~= prev.port
      or props.baud ~= prev.baud
      or props.dataBits ~= prev.dataBits
      or props.stopBits ~= prev.stopBits
      or props.parity ~= prev.parity
      or props.flowControl ~= prev.flowControl

    if needReopen then
      local s = ensureSerial()
      s.close(state.handle)

      state.handle = s.open(props.port, props.baud or 9600, {
        dataBits    = props.dataBits or 8,
        stopBits    = props.stopBits or 1,
        parity      = props.parity or "none",
        flowControl = props.flowControl or "none",
      })
      state.port = props.port
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end

    local s = ensureSerial()

    -- Read raw data first (for onData)
    local ok, raw = pcall(s.read, state.handle)
    if not ok then
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onError",
          error = tostring(raw),
          port = state.port,
        },
      })
      return
    end

    if raw then
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onData",
          data = raw,
          port = state.port,
          len = #raw,
        },
      })
    end

    -- Read complete lines (for onLine)
    -- readLine uses its own internal buffer, but since we already
    -- consumed raw data above, we need to feed it back.
    -- Actually, serial.read and serial.readLine share the same handle
    -- and line buffer. The raw read above consumed bytes from the fd,
    -- but readLine also calls serial.read internally and appends to
    -- handle.lineBuf. So we should NOT call both — choose one path.
    --
    -- Strategy: read raw, manually check for newlines, fire both events.

    -- We already have raw data (or nil). Append to lineBuf and extract lines.
    if raw then
      state.handle.lineBuf = state.handle.lineBuf .. raw

      while true do
        local nlPos = state.handle.lineBuf:find("\n")
        if not nlPos then break end

        local line = state.handle.lineBuf:sub(1, nlPos - 1)
        -- Strip trailing \r (Windows / Arduino line endings)
        if line:sub(-1) == "\r" then
          line = line:sub(1, -2)
        end
        state.handle.lineBuf = state.handle.lineBuf:sub(nlPos + 1)

        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId,
            handler = "onLine",
            line = line,
            port = state.port,
          },
        })
      end
    end
  end,

  destroy = function(nodeId, state)
    local ok, s = pcall(ensureSerial)
    if ok and s and state.handle then
      s.close(state.handle)
    end
  end,
})
