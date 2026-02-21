--[[
  capabilities/window.lua — Multi-window support via SDL2

  React usage:
    <Window title="Inspector" width={400} height={600}>
      <InspectorPanel data={appState} />
    </Window>

    <Window title="Feeds" width={800} height={600} x={820} y={100}
            onClose={() => setShowFeeds(false)}>
      <CameraGrid />
    </Window>

  Children of <Window> are rendered in a separate OS window. All windows
  share the same React tree, so state flows naturally via props and context.

  Props:
    title    string   Window title (default: "iLoveReact")
    width    number   Window width in pixels (default: 640)
    height   number   Window height in pixels (default: 480)
    x        number   Window x position (default: centered)
    y        number   Window y position (default: centered)

  Events:
    onClose   {}                  Fires when the user closes the window
    onResize  { width, height }   Fires when the window is resized
    onFocus   {}                  Fires when the window gains focus
    onBlur    {}                  Fires when the window loses focus
]]

local Capabilities = require("lua.capabilities")
local WM = require("lua.window_manager")

Capabilities.register("Window", {
  -- Window is visual in its OWN surface, but should be skipped by the
  -- parent window's layout/paint pass. We use a custom flag for this.
  visual = false,
  rendersInOwnSurface = true,

  schema = {
    title  = { type = "string", default = "iLoveReact", desc = "Window title" },
    width  = { type = "number", default = 640, desc = "Window width in pixels" },
    height = { type = "number", default = 480, desc = "Window height in pixels" },
    x      = { type = "number", desc = "Window x position (centered if omitted)" },
    y      = { type = "number", desc = "Window y position (centered if omitted)" },
  },

  events = { "onClose", "onResize", "onFocus", "onBlur" },

  create = function(nodeId, props)
    local win = WM.create({
      title      = props.title or "iLoveReact",
      width      = props.width or 640,
      height     = props.height or 480,
      x          = props.x,
      y          = props.y,
      rootNodeId = nodeId,
    })

    if not win then
      io.write("[window capability] failed to create window for node " .. tostring(nodeId) .. "\n")
      io.flush()
      return { windowId = nil }
    end

    io.write("[window capability] created window #" .. win.id .. " for node " .. tostring(nodeId) .. "\n")
    io.flush()
    return { windowId = win.id }
  end,

  update = function(nodeId, props, prev, state)
    if not state.windowId then return end
    local win = WM.get(state.windowId)
    if not win then return end

    if props.title and props.title ~= prev.title then
      WM.setTitle(win, props.title)
    end

    if (props.width and props.width ~= prev.width) or
       (props.height and props.height ~= prev.height) then
      WM.setSize(win, props.width or win.width, props.height or win.height)
    end

    if (props.x and props.x ~= prev.x) or
       (props.y and props.y ~= prev.y) then
      WM.setPosition(win, props.x or 0, props.y or 0)
    end
  end,

  destroy = function(nodeId, state)
    if state.windowId then
      io.write("[window capability] destroying window #" .. state.windowId .. " for node " .. tostring(nodeId) .. "\n")
      io.flush()
      WM.destroy(state.windowId)
    end
  end,
})
