--[[
  capabilities/timer.lua — Declarative timer

  React usage:
    <Timer interval={1000} onTick={() => setCount(c => c + 1)} />
    <Timer interval={5000} repeat={false} onTick={() => showTimeout()} />

  Props:
    interval  number   Interval in milliseconds
    repeat    boolean  Keep firing after first tick (default: true)
    running   boolean  Start/stop the timer (default: true)

  Events:
    onTick    { count, elapsed }  Fires each interval
]]

local Capabilities = require("lua.capabilities")

Capabilities.register("Timer", {
  visual = false,

  schema = {
    interval = { type = "number", min = 1, desc = "Interval in milliseconds" },
    ["repeat"] = { type = "bool", default = true, desc = "Keep firing after first tick" },
    running  = { type = "bool", default = true, desc = "Start or stop the timer" },
  },

  events = { "onTick" },

  create = function(nodeId, props)
    return {
      elapsed = 0,
      count = 0,
      fired = false,
      prevInterval = props.interval,
    }
  end,

  update = function(nodeId, props, prev, state)
    -- Reset accumulator if interval changed
    if props.interval ~= state.prevInterval then
      state.elapsed = 0
      state.prevInterval = props.interval
    end
    -- Re-enable if turned back on
    if (props.running ~= false) and (prev.running == false) then
      state.fired = false
      state.elapsed = 0
    end
  end,

  destroy = function(nodeId, state)
    -- Nothing to clean up
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end
    if props.running == false then return end
    if state.fired and props["repeat"] == false then return end

    local intervalSec = (props.interval or 1000) / 1000
    state.elapsed = state.elapsed + dt

    while state.elapsed >= intervalSec do
      state.elapsed = state.elapsed - intervalSec
      state.count = state.count + 1

      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onTick", count = state.count, elapsed = state.count * intervalSec },
      })

      if props["repeat"] == false then
        state.fired = true
        state.elapsed = 0
        return
      end
    end
  end,
})
