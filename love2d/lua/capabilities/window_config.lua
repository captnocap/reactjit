--[[
  window_config.lua — Window configuration as a tree node (capability)

  Replaces useWindowSize / useWindowPosition / useWindowAlwaysOnTop hooks.
  Props are declarative — the reconciler diffs them, Lua applies changes.
  Revert-on-unmount is automatic via the destroy callback.

  Usage:
    <WindowConfig width={800} height={600} />
    <WindowConfig x={100} y={200} alwaysOnTop />
    <WindowConfig width={800} height={600} revert />
]]

local Capabilities = require("lua.capabilities")

Capabilities.register("WindowConfig", {
  visual = false,

  schema = {
    width      = { type = "number", desc = "Window width in pixels" },
    height     = { type = "number", desc = "Window height in pixels" },
    x          = { type = "number", desc = "Window x position" },
    y          = { type = "number", desc = "Window y position" },
    alwaysOnTop = { type = "bool", default = false, desc = "Pin window on top" },
    revert     = { type = "bool", default = false, desc = "Revert to previous values on unmount" },
    animate    = { type = "bool", default = false, desc = "Animate transitions" },
    duration   = { type = "number", default = 300, desc = "Animation duration in ms" },
    windowId   = { type = "number", default = 0, desc = "Target window ID (0 = main)" },
  },

  events = {},

  create = function(nodeId, props)
    local state = {
      prevWidth = nil,
      prevHeight = nil,
      prevX = nil,
      prevY = nil,
      prevOnTop = nil,
    }

    -- Capture previous values for revert
    if props.revert then
      state.prevWidth, state.prevHeight = love.window.getMode()
      state.prevX, state.prevY = love.window.getPosition()
      -- alwaysOnTop not queryable in standard Love2D, skip
    end

    -- Apply initial config
    if props.width and props.height then
      love.window.setMode(props.width, props.height)
    end
    if props.x and props.y then
      love.window.setPosition(props.x, props.y)
    end

    return state
  end,

  update = function(nodeId, props, prev, state)
    if (props.width ~= prev.width or props.height ~= prev.height)
        and props.width and props.height then
      love.window.setMode(props.width, props.height)
    end
    if (props.x ~= prev.x or props.y ~= prev.y)
        and props.x and props.y then
      love.window.setPosition(props.x, props.y)
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- No per-frame work needed
  end,

  destroy = function(nodeId, state)
    -- Revert to previous values on unmount
    if state.prevWidth and state.prevHeight then
      love.window.setMode(state.prevWidth, state.prevHeight)
    end
    if state.prevX and state.prevY then
      love.window.setPosition(state.prevX, state.prevY)
    end
  end,
})
