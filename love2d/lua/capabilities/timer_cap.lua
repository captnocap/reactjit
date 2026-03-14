--[[
  timer_cap.lua — Timer as a tree node (capability)

  Replaces useLuaInterval / useEffect + setInterval patterns.
  Timer ticks happen in love.update(dt) — frame-perfect, zero JS jitter.

  Usage:
    <Timer interval={1000} onTick={() => setCount(c => c + 1)} />
    <Timer interval={16} running={isPlaying} onTick={animate} />
]]

local Capabilities = require("lua.capabilities")

Capabilities.register("Timer", {
  visual = false,

  schema = {
    interval = { type = "number", min = 1, desc = "Tick interval in milliseconds" },
    running  = { type = "bool", default = true, desc = "Whether the timer is active" },
    ["repeat"] = { type = "bool", default = true, desc = "Keep firing (false = one-shot)" },
    fireOnMount = { type = "bool", default = false, desc = "Fire onTick immediately on mount" },
  },

  events = { "onTick" },

  create = function(nodeId, props)
    local state = { elapsed = 0, count = 0 }
    if props.fireOnMount then
      -- Will fire on the first tick call
      state.elapsed = props.interval or 1000
    end
    return state
  end,

  update = function(nodeId, props, prev, state)
    -- Reset accumulator when interval changes
    if props.interval ~= prev.interval then
      state.elapsed = 0
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if props.running == false then return end
    if state.stopped then return end

    local interval = props.interval or 1000
    state.elapsed = state.elapsed + dt * 1000

    while state.elapsed >= interval do
      state.elapsed = state.elapsed - interval
      state.count = state.count + 1
      pushEvent({
        type = "capability",
        payload = {
          targetId = nodeId,
          handler = "onTick",
          count = state.count,
        },
      })
      -- One-shot: stop after first fire
      if props["repeat"] == false then
        state.stopped = true
        return
      end
    end
  end,

  destroy = function(nodeId, state)
    -- Nothing to clean up
  end,
})
