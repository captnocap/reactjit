--[[
  capabilities/gpio_pwm.lua — Software PWM via GPIO

  Implements PWM by toggling a GPIO pin in the tick loop. This is software
  PWM — timing is tied to the frame rate. For precise PWM (servos, motor
  control), use hardware PWM channels instead.

  Good for: LEDs, buzzers, simple motor speed, visual indicators.
  Not ideal for: servo positioning, audio generation.

  React usage:
    <PWM pin={18} duty={brightness} />
    <PWM pin={18} frequency={500} duty={0.5} enabled={motorOn} />

  Props:
    chip       string   GPIO chip path (default: /dev/gpiochip0)
    pin        number   GPIO line offset (required)
    frequency  number   PWM frequency in Hz (default: 1000)
    duty       number   Duty cycle 0.0-1.0 (default: 0)
    enabled    boolean  Enable/disable PWM (default: true)
]]

local Capabilities = require("lua.capabilities")

local gpiod = nil
local function ensureGpiod()
  if not gpiod then
    gpiod = require("lua.gpio.gpiod")
  end
  return gpiod
end

Capabilities.register("PWM", {
  visual = false,

  schema = {
    chip      = { type = "string", default = "/dev/gpiochip0", desc = "GPIO chip device path" },
    pin       = { type = "number", desc = "GPIO line offset" },
    frequency = { type = "number", default = 1000, min = 1, max = 100000, desc = "Frequency in Hz" },
    duty      = { type = "number", default = 0, min = 0, max = 1, desc = "Duty cycle 0.0 to 1.0" },
    enabled   = { type = "bool", default = true, desc = "Enable or disable PWM output" },
  },

  events = {},

  create = function(nodeId, props)
    local g = ensureGpiod()
    local chip = g.open(props.chip or "/dev/gpiochip0")
    local request = g.requestOutput(chip, props.pin, "reactjit-pwm-" .. nodeId, 0)

    return {
      chip = chip,
      request = request,
      pin = props.pin,
      phase = 0,          -- current position in the PWM cycle (0-1)
      currentOutput = 0,  -- current pin state (0 or 1)
    }
  end,

  update = function(nodeId, props, prev, state)
    -- If pin or chip changed, re-request
    if props.pin ~= prev.pin or props.chip ~= prev.chip then
      local g = ensureGpiod()
      g.release(state.request)
      g.close(state.chip)

      local chip = g.open(props.chip or "/dev/gpiochip0")
      state.chip = chip
      state.request = g.requestOutput(chip, props.pin, "reactjit-pwm-" .. nodeId, 0)
      state.pin = props.pin
      state.phase = 0
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local g = ensureGpiod()

    if not props.enabled then
      -- Disabled: hold low
      if state.currentOutput ~= 0 then
        g.write(state.request, state.pin, 0)
        state.currentOutput = 0
      end
      return
    end

    local duty = props.duty or 0
    local freq = props.frequency or 1000

    -- Advance phase
    state.phase = state.phase + dt * freq
    if state.phase >= 1 then
      state.phase = state.phase - math.floor(state.phase)
    end

    -- Determine output: HIGH if phase < duty, LOW otherwise
    local target = (state.phase < duty) and 1 or 0

    -- Only write if state changed (avoid unnecessary FFI calls)
    if target ~= state.currentOutput then
      g.write(state.request, state.pin, target)
      state.currentOutput = target
    end
  end,

  destroy = function(nodeId, state)
    local ok, g = pcall(ensureGpiod)
    if ok and g then
      -- Set pin low before releasing
      pcall(function() g.write(state.request, state.pin, 0) end)
      if state.request then g.release(state.request) end
      if state.chip then g.close(state.chip) end
    end
  end,
})
