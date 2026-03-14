--[[
  capabilities/gpio_pin.lua — Declarative GPIO digital pin

  React usage:
    <Pin pin={17} mode="output" value={ledOn} />
    <Pin pin={4} mode="input" pull="up" edge="both"
      onChange={(e) => setButton(e.value)} />

  Props:
    chip      string   GPIO chip path (default: /dev/gpiochip0)
    pin       number   GPIO line offset (required)
    mode      string   "input" or "output" (default: "input")
    value     boolean  Output value, ignored for input (default: false)
    pull      string   "none", "up", "down" (default: "none")
    edge      string   "none", "rising", "falling", "both" (default: "none")
    activeLow boolean  Invert logic level (default: false)

  Events:
    onChange   { value, pin }           Fires on any edge
    onRising   { value, pin, timestamp } Fires on rising edge
    onFalling  { value, pin, timestamp } Fires on falling edge
]]

local Capabilities = require("lua.capabilities")

-- Lazy-load gpiod to avoid errors on systems without libgpiod
local gpiod = nil
local function ensureGpiod()
  if not gpiod then
    gpiod = require("lua.gpio.gpiod")
  end
  return gpiod
end

Capabilities.register("Pin", {
  visual = false,

  schema = {
    chip      = { type = "string", default = "/dev/gpiochip0", desc = "GPIO chip device path" },
    pin       = { type = "number", desc = "GPIO line offset (not physical pin number)" },
    mode      = { type = "string", default = "input", desc = "input or output" },
    value     = { type = "bool", default = false, desc = "Output value (ignored for input mode)" },
    pull      = { type = "string", default = "none", desc = "none, up, or down" },
    edge      = { type = "string", default = "none", desc = "none, rising, falling, or both" },
    activeLow = { type = "bool", default = false, desc = "Invert logic level" },
  },

  events = { "onChange", "onRising", "onFalling" },

  create = function(nodeId, props)
    local g = ensureGpiod()
    local chip = g.open(props.chip or "/dev/gpiochip0")
    local request
    local eventBuffer

    if props.mode == "output" then
      request = g.requestOutput(chip, props.pin, "reactjit-pin-" .. nodeId, props.value and 1 or 0)
    else
      request = g.requestInput(chip, props.pin, "reactjit-pin-" .. nodeId, {
        edge = props.edge or "none",
        bias = props.pull or "none",
        activeLow = props.activeLow,
      })
      if props.edge and props.edge ~= "none" then
        eventBuffer = g.createEventBuffer(16)
      end
    end

    return {
      chip = chip,
      request = request,
      eventBuffer = eventBuffer,
      lastValue = props.value and 1 or 0,
      mode = props.mode or "input",
      pin = props.pin,
    }
  end,

  update = function(nodeId, props, prev, state)
    local g = ensureGpiod()

    -- If mode, pin, or chip changed, we need to re-request (destroy + create)
    if props.mode ~= prev.mode or props.pin ~= prev.pin or props.chip ~= prev.chip then
      -- Release old request
      g.release(state.request)
      if state.eventBuffer then g.freeEventBuffer(state.eventBuffer) end
      g.close(state.chip)

      -- Re-create
      local chip = g.open(props.chip or "/dev/gpiochip0")
      local request, eventBuffer

      if props.mode == "output" then
        request = g.requestOutput(chip, props.pin, "reactjit-pin-" .. nodeId, props.value and 1 or 0)
      else
        request = g.requestInput(chip, props.pin, "reactjit-pin-" .. nodeId, {
          edge = props.edge or "none",
          bias = props.pull or "none",
          activeLow = props.activeLow,
        })
        if props.edge and props.edge ~= "none" then
          eventBuffer = g.createEventBuffer(16)
        end
      end

      state.chip = chip
      state.request = request
      state.eventBuffer = eventBuffer
      state.mode = props.mode or "input"
      state.pin = props.pin
      return
    end

    -- Output mode: update value if changed
    if state.mode == "output" and props.value ~= prev.value then
      g.write(state.request, state.pin, props.value and 1 or 0)
      state.lastValue = props.value and 1 or 0
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end
    if state.mode ~= "input" then return end
    if not state.eventBuffer then return end

    local g = ensureGpiod()
    local events = g.pollEdges(state.request, state.eventBuffer)

    for _, ev in ipairs(events) do
      local val = ev.type == "rising" and 1 or 0

      -- onChange fires for any edge
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onChange",
          value = val,
          pin = ev.pin,
          edgeType = ev.type,
        },
      })

      -- Specific edge handlers
      if ev.type == "rising" then
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId,
            handler = "onRising",
            value = 1,
            pin = ev.pin,
            timestamp = ev.timestamp_ns,
          },
        })
      elseif ev.type == "falling" then
        pushEvent({
          type = "capability",
          payload = {
            targetId = nodeId,
            handler = "onFalling",
            value = 0,
            pin = ev.pin,
            timestamp = ev.timestamp_ns,
          },
        })
      end

      state.lastValue = val
    end
  end,

  destroy = function(nodeId, state)
    local ok, g = pcall(ensureGpiod)
    if ok and g then
      if state.eventBuffer then g.freeEventBuffer(state.eventBuffer) end
      if state.request then g.release(state.request) end
      if state.chip then g.close(state.chip) end
    end
  end,
})
