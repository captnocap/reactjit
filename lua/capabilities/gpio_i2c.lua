--[[
  capabilities/gpio_i2c.lua — Declarative I2C device

  Polls an I2C register at a configurable interval and fires events
  with the data. Perfect for temperature sensors, accelerometers,
  ADCs, and any I2C peripheral.

  React usage:
    <I2CDevice bus={1} address={0x48} register={0x00} pollInterval={100}
      onData={(e) => setTemperature(e.value)} />

    <I2CDevice bus={1} address={0x68} register={0x3B} readLength={6}
      pollInterval={50} onData={(e) => handleAccel(e.bytes)} />

  Props:
    bus          number   I2C bus number (default: 1)
    address      number   7-bit device address (required)
    register     number   Register to poll (optional — raw read if omitted)
    readLength   number   Bytes to read per poll (default: 1, max 256)
    pollInterval number   Milliseconds between reads (default: 100)
    enabled      boolean  Enable/disable polling (default: true)

  Events:
    onData   { value, bytes, bus, address, register }  Fires on each poll
    onError  { error, bus, address }                   Fires on read errors
]]

local Capabilities = require("lua.capabilities")

local i2cMod = nil
local function ensureI2C()
  if not i2cMod then
    i2cMod = require("lua.gpio.i2c")
  end
  return i2cMod
end

Capabilities.register("I2CDevice", {
  visual = false,

  schema = {
    bus          = { type = "number", default = 1, desc = "I2C bus number" },
    address      = { type = "number", desc = "7-bit device address (e.g. 0x48)" },
    register     = { type = "number", desc = "Register to poll (nil for raw read)" },
    readLength   = { type = "number", default = 1, min = 1, max = 256, desc = "Bytes per read" },
    pollInterval = { type = "number", default = 100, min = 1, desc = "Milliseconds between polls" },
    enabled      = { type = "bool", default = true, desc = "Enable or disable polling" },
  },

  events = { "onData", "onError" },

  create = function(nodeId, props)
    local i2c = ensureI2C()
    local handle = i2c.open(props.bus or 1, props.address)

    return {
      handle = handle,
      bus = props.bus or 1,
      address = props.address,
      elapsed = 0,  -- time accumulator for poll interval
    }
  end,

  update = function(nodeId, props, prev, state)
    -- If bus or address changed, re-open
    if props.bus ~= prev.bus or props.address ~= prev.address then
      local i2c = ensureI2C()
      i2c.close(state.handle)

      state.handle = i2c.open(props.bus or 1, props.address)
      state.bus = props.bus or 1
      state.address = props.address
      state.elapsed = 0
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end
    if not props.enabled then return end

    local interval = (props.pollInterval or 100) / 1000  -- ms to seconds
    state.elapsed = state.elapsed + dt

    if state.elapsed < interval then return end
    state.elapsed = state.elapsed - interval

    local i2c = ensureI2C()
    local readLen = props.readLength or 1

    local ok, result
    if readLen == 1 then
      if props.register then
        ok, result = pcall(i2c.readRegister, state.handle, props.register)
      else
        ok, result = pcall(i2c.readByte, state.handle)
      end

      if ok then
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId,
            handler = "onData",
            value = result,
            bytes = { result },
            bus = state.bus,
            address = state.address,
            register = props.register,
          },
        })
      else
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId,
            handler = "onError",
            error = tostring(result),
            bus = state.bus,
            address = state.address,
          },
        })
      end
    else
      ok, result = pcall(i2c.readBytes, state.handle, props.register, readLen)

      if ok then
        -- First byte as convenience value
        local value = result[1] or 0
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId,
            handler = "onData",
            value = value,
            bytes = result,
            bus = state.bus,
            address = state.address,
            register = props.register,
          },
        })
      else
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId,
            handler = "onError",
            error = tostring(result),
            bus = state.bus,
            address = state.address,
          },
        })
      end
    end
  end,

  destroy = function(nodeId, state)
    local ok, i2c = pcall(ensureI2C)
    if ok and i2c and state.handle then
      i2c.close(state.handle)
    end
  end,
})
