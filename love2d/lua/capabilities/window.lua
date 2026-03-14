--[[
  capabilities/window.lua — Multi-window via subprocess

  React usage:
    <Window title="Inspector" width={400} height={600}>
      <InspectorPanel data={appState} />
    </Window>

  Each <Window> spawns a separate Love2D child process. The main process
  forwards tree mutations to the child over TCP. The child renders with its
  own Love2D renderer at full framerate. Events flow back over the same pipe.

  Props:
    title    string   Window title (default: "ReactJIT")
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
local IPC = require("lua.window_ipc")
local json = require("lua.json")
local processRegistry = require("lua.process_registry")

-- Active child windows: windowId → { server, conn, port, nodeId, width, height }
local children = {}
local nextWindowId = 1

-- Resolve the child_window directory path (relative to this file's location)
local childWindowPath
do
  -- This file is at lua/capabilities/window.lua
  -- child_window/ is at lua/child_window/
  local info = debug.getinfo(1, "S")
  local thisFile = info and info.source and info.source:gsub("^@", "") or ""
  local luaDir = thisFile:match("(.*/lua)/") or thisFile:match("(.*\\lua)\\")
  if luaDir then
    childWindowPath = luaDir .. "/child_window"
  else
    -- Fallback: try relative to working directory
    childWindowPath = "lua/child_window"
  end
end

--- Get the display index the parent window is currently on.
local function getParentDisplay()
  local ok, x, y, d = pcall(love.window.getPosition)
  if ok and d and d > 0 then return d end
  return 1
end

--- Spawn a child Love2D process with the given config.
local function spawnChild(title, width, height, ipcPort, opts)
  opts = opts or {}
  local envParts = {
    string.format('REACTJIT_WINDOW_TITLE=%q', title),
    string.format('REACTJIT_WINDOW_WIDTH=%d', width),
    string.format('REACTJIT_WINDOW_HEIGHT=%d', height),
    string.format('REACTJIT_IPC_PORT=%d', ipcPort),
  }
  if opts.borderless then
    envParts[#envParts + 1] = 'REACTJIT_WINDOW_BORDERLESS=1'
  end
  if opts.alwaysOnTop then
    envParts[#envParts + 1] = 'REACTJIT_WINDOW_ALWAYS_ON_TOP=1'
  end
  if opts.x then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_X=%d', opts.x)
  end
  if opts.y then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_Y=%d', opts.y)
  end
  if opts.display then
    envParts[#envParts + 1] = string.format('REACTJIT_WINDOW_DISPLAY=%d', opts.display)
  end
  local baseCmd = table.concat(envParts, ' ') .. ' love ' .. childWindowPath
  io.write("[window] spawning child: " .. baseCmd .. "\n"); io.flush()
  local pidHandle = io.popen(baseCmd .. " & echo $!")
  if pidHandle then
    local pid = pidHandle:read("*l")
    pidHandle:close()
    if pid and pid:match("%d+") then
      processRegistry.register(pid)
      return pid
    end
  end
end

Capabilities.register("Window", {
  visual = false,
  rendersInOwnSurface = true,

  schema = {
    title       = { type = "string",  default = "ReactJIT", desc = "Window title" },
    width       = { type = "number",  default = 640, desc = "Window width in pixels" },
    height      = { type = "number",  default = 480, desc = "Window height in pixels" },
    x           = { type = "number",  desc = "Window x position (centered if omitted)" },
    y           = { type = "number",  desc = "Window y position (centered if omitted)" },
    display     = { type = "number",  default = 0, desc = "Monitor index (1-based). 0 = same as parent window." },
    borderless  = { type = "boolean", default = false, desc = "Remove window decorations" },
    alwaysOnTop = { type = "boolean", default = false, desc = "Keep window above all others" },
  },

  events = { "onClose", "onResize", "onFocus", "onBlur" },

  create = function(nodeId, props)
    local title  = props.title  or "ReactJIT"
    local width  = props.width  or 640
    local height = props.height or 480

    -- Create TCP server for IPC
    local server, port = IPC.createServer()
    if not server then
      io.write("[window] failed to create IPC server for node " .. tostring(nodeId) .. "\n"); io.flush()
      return { windowId = nil }
    end

    local windowId = nextWindowId
    nextWindowId = nextWindowId + 1

    children[windowId] = {
      server     = server,
      conn       = nil,      -- set when child connects
      port       = port,
      nodeId     = nodeId,
      width      = width,
      height     = height,
      initSent   = false,    -- set after initial subtree is sent
    }

    -- Resolve display: explicit prop > parent window's display
    local displayIndex = props.display
    if not displayIndex or displayIndex <= 0 then
      displayIndex = getParentDisplay()
    end
    local displayCount = love.window.getDisplayCount()
    if displayIndex > displayCount then displayIndex = 1 end

    -- Spawn the child Love2D process
    local childPid = spawnChild(title, width, height, port, {
      borderless  = props.borderless,
      alwaysOnTop = props.alwaysOnTop,
      x           = props.x,
      y           = props.y,
      display     = displayIndex,
    })
    children[windowId].pid = childPid

    io.write("[window] created child window #" .. windowId .. " for node " .. tostring(nodeId) .. " (port " .. port .. ")\n"); io.flush()
    return { windowId = windowId }
  end,

  update = function(nodeId, props, prev, state)
    if not state.windowId then return end
    local child = children[state.windowId]
    if not child or not child.conn then return end

    -- Forward resize to child
    if (props.width and props.width ~= prev.width) or
       (props.height and props.height ~= prev.height) then
      local w = props.width  or child.width
      local h = props.height or child.height
      child.width  = w
      child.height = h
      IPC.send(child.conn, { type = "resize", width = w, height = h })
    end

    -- Title changes require respawning (Love2D sets title at load)
    -- For now, just log it. Could be solved with love.window.setTitle in child.
    if props.title and props.title ~= prev.title then
      io.write("[window] title change not yet forwarded to child (would need setTitle IPC)\n"); io.flush()
    end
  end,

  destroy = function(nodeId, state)
    if not state.windowId then return end
    local child = children[state.windowId]
    if not child then return end

    io.write("[window] destroying child window #" .. state.windowId .. "\n"); io.flush()

    -- Send quit to child
    if child.conn then
      IPC.send(child.conn, { type = "quit" })
      IPC.cleanup(child.conn)
    end
    if child.server then
      pcall(function() child.server:close() end)
    end
    if child.pid then
      processRegistry.unregister(child.pid)
    end

    children[state.windowId] = nil
  end,

  --- tick is called every frame by Capabilities.syncWithTree.
  --- We use it to:
  ---   1. Accept pending child connections
  ---   2. Send initial subtree once connected
  ---   3. Poll for events from children
  tick = function(nodeId, state, dt, pushEvent, props)
    if not state.windowId then return end
    local child = children[state.windowId]
    if not child then return end

    -- Debug: log tick activity for first 10 ticks
    if not child._tickCount then child._tickCount = 0 end
    child._tickCount = child._tickCount + 1
    if child._tickCount <= 10 then
      io.write(string.format("[WINDOW-DBG] tick#%d windowId=%d nodeId=%s conn=%s initSent=%s\n",
        child._tickCount, state.windowId, tostring(nodeId),
        child.conn and "yes" or "no", tostring(child.initSent)))
      io.flush()
    end

    -- 1. Accept pending connection
    if not child.conn then
      child.conn = IPC.accept(child.server)
      if child.conn then
        io.write("[window] child #" .. state.windowId .. " connected\n"); io.flush()
      end
    end

    -- 2. Send initial subtree once connected (and not yet sent)
    if child.conn and not child.initSent then
      -- Get the Window node from the tree to serialize its children
      local tree = package.loaded["lua.tree"]
      if tree then
        local nodes = tree.getNodes()
        local windowNode = nodes and nodes[nodeId]
        if windowNode then
          io.write(string.format("[WINDOW-DBG] initSend: windowNode id=%s children=%d\n",
            tostring(nodeId), #(windowNode.children or {})))
          io.flush()
        end
        if windowNode and windowNode.children and #windowNode.children > 0 then
          local commands = IPC.serializeSubtree(windowNode)
          IPC.send(child.conn, { type = "init", commands = commands })
          child.initSent = true
          io.write("[window] sent init to child #" .. state.windowId .. " (" .. #commands .. " commands)\n"); io.flush()
        end
      end
    end

    -- 3. Poll for events from child
    if child.conn then
      local msgs = IPC.poll(child.conn)
      for _, msg in ipairs(msgs) do
        if msg.type == "event" and msg.payload then
          -- Forward input event to React via bridge
          pushEvent({
            type    = msg.payload.type,
            payload = msg.payload,
          })
        elseif msg.type == "windowEvent" and msg.handler then
          -- Forward window lifecycle event to React capability handler
          pushEvent({
            type = "capability",
            payload = {
              targetId = nodeId,
              handler  = msg.handler,
              data     = msg.data,
            },
          })
        elseif msg.type == "ready" then
          io.write("[window] child #" .. state.windowId .. " reports ready\n"); io.flush()
        end
      end
    end
  end,
})

-- ============================================================================
-- Public API for mutation routing from init.lua
-- ============================================================================

local WindowCapability = {}

--- Get all active child windows (for mutation routing).
--- Returns array of { windowId, nodeId, conn, initSent }.
function WindowCapability.getChildren()
  local result = {}
  for id, child in pairs(children) do
    if child.conn and child.initSent then
      result[#result + 1] = {
        windowId = id,
        nodeId   = child.nodeId,
        conn     = child.conn,
      }
    end
  end
  return result
end

--- Forward a batch of mutations to a specific child.
function WindowCapability.sendMutations(windowId, commands)
  local child = children[windowId]
  if not child or not child.conn then return end
  IPC.send(child.conn, { type = "mutations", commands = commands })
end

-- Store as package.loaded so init.lua can access it
package.loaded["lua.capabilities.window_api"] = WindowCapability
