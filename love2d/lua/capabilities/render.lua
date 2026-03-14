--[[
  capabilities/render.lua — Display capture, virtual displays, VM rendering

  React usage:
    <Render source="screen:0" />                    -- screen capture (XShm fast path)
    <Render source="cam:0" fps={30} />              -- webcam via FFmpeg/v4l2
    <Render source="hdmi:0" interactive />           -- HDMI capture card
    <Render source="window:Firefox" interactive />   -- window capture
    <Render source="display" />                      -- virtual display (Xephyr/Xvfb)
    <Render source="debian.iso" interactive />       -- boot VM from ISO
    <Render source="vm:disk.qcow2" vmMemory={4096} /> -- VM from disk image

  Props:
    source       string   Source identifier (see above)
    fps          number   Capture framerate (default: 30)
    resolution   string   Capture resolution e.g. "1920x1080" (default: "1280x720")
    interactive  boolean  Enable mouse/keyboard input forwarding (default: false for capture, true for display/vm)
    muted        boolean  Suppress audio from source (default: true)
    objectFit    string   "fill" | "contain" | "cover" (default: "contain")
    vmMemory     number   VM RAM in MB (default: 2048) — only for VM sources
    vmCpus       number   VM CPU count (default: 2) — only for VM sources

  Events:
    onReady    {}                    Fires when capture starts producing frames
    onError    { message: string }   Fires if capture fails
    onFrame    { frameNumber }       Fires on each new frame (throttled)
]]

local Capabilities = require("lua.capabilities")

Capabilities.register("Render", {
  visual = true,
  hittable = true,  -- receives focus + keyboard for interactive mode

  schema = {
    source      = { type = "string", desc = "Source: screen:N, cam:N, hdmi:N, window:Title, display, vm:path, or file.iso" },
    fps         = { type = "number", default = 30, desc = "Capture framerate" },
    resolution  = { type = "string", default = "1280x720", desc = "Capture resolution (WxH)" },
    interactive = { type = "bool", default = false, desc = "Enable input forwarding to source" },
    muted       = { type = "bool", default = true, desc = "Suppress audio from source" },
    objectFit   = { type = "string", default = "contain", desc = "Scaling mode: fill, contain, cover" },
    vmMemory    = { type = "number", default = 2048, desc = "VM RAM in MB (VM sources only)" },
    vmCpus      = { type = "number", default = 2, desc = "VM CPU count (VM sources only)" },
    command     = { type = "string", desc = "Command to launch into virtual display (display source only)" },
  },

  events = { "onReady", "onError", "onFrame" },

  create = function(nodeId, props)
    -- Lifecycle managed by RenderSource module (syncWithTree)
    return { readyEmitted = false, errorEmitted = false, frameThrottle = 0 }
  end,

  update = function(nodeId, props, prev, state)
    -- Source changes handled by RenderSource.syncWithTree
  end,

  destroy = function(nodeId, state)
    -- Cleanup handled by RenderSource.syncWithTree
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not pushEvent then return end

    local RenderSource = require("lua.render_source")
    local status = RenderSource.getStatus(nodeId)

    -- Emit onReady once
    if status == "ready" and not state.readyEmitted then
      state.readyEmitted = true
      local payload = { targetId = nodeId, handler = "onReady" }
      -- Include display number for virtual display sources
      local displayNum = RenderSource.getDisplayNum(nodeId)
      if displayNum then payload.displayNumber = displayNum end
      -- Include VM info for VM sources
      local vmInfo = RenderSource.getVMInfo(nodeId)
      if vmInfo then payload.vmInfo = vmInfo end
      pushEvent({ type = "capability", payload = payload })
    end

    -- Emit onError once
    if status == "error" and not state.errorEmitted then
      state.errorEmitted = true
      pushEvent({
        type = "capability",
        payload = { targetId = nodeId, handler = "onError", message = "Capture failed" },
      })
    end

    -- Throttled frame count events (~5fps)
    state.frameThrottle = (state.frameThrottle or 0) + dt
    if state.frameThrottle >= 0.2 then
      state.frameThrottle = 0
      -- Frame events available if needed
    end
  end,

  -- Keyboard event forwarding for interactive mode
  -- Note: init.lua passes the full node object, not just nodeId
  handleKeyPressed = function(node, key, scancode, isrepeat)
    local nodeId = node.id
    local RenderSource = require("lua.render_source")
    if RenderSource.isInteractive(nodeId) then
      RenderSource.forwardKey(nodeId, "keypressed", key)
      return true  -- consumed
    end
    return false
  end,

  handleKeyReleased = function(node, key, scancode)
    local nodeId = node.id
    local RenderSource = require("lua.render_source")
    if RenderSource.isInteractive(nodeId) then
      RenderSource.forwardKey(nodeId, "keyreleased", key)
      return true
    end
    return false
  end,

  handleTextInput = function(node, text)
    local nodeId = node.id
    local RenderSource = require("lua.render_source")
    if RenderSource.isInteractive(nodeId) then
      RenderSource.forwardText(nodeId, text)
      return true
    end
    return false
  end,
})
