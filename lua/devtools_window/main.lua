--[[
  devtools_window/main.lua — Child Love2D process for pop-out devtools

  Spawned by the main process when devtools are popped out.
  Receives the full tree over TCP, runs layout, and renders devtools
  (inspector tree, detail panel, console, logs, status bar) full-screen.

  Sends interaction events (node selection, tab switches) back to main.
]]

local source = love.filesystem.getSource()
local luaDir = source .. "/.."
local repoRoot = source .. "/../.."
package.path = package.path
  .. ";" .. repoRoot .. "/?.lua"
  .. ";" .. repoRoot .. "/?/init.lua"
  .. ";" .. luaDir .. "/?.lua"

local json      = require("lua.json")
local IPC       = require("lua.window_ipc")
local Tree      = require("lua.tree")
local Layout    = require("lua.layout")
local Measure   = require("lua.measure")
local inspector = require("lua.inspector")
local console   = require("lua.console")
local DevTools  = require("lua.devtools")

local conn
local port
local windowW, windowH
local mainW, mainH         -- main app window dimensions (for layout accuracy)
local treeDirty    = true
local connected    = false
local shuttingDown = false

-- ============================================================================
-- love.load — connect to parent, receive initial tree
-- ============================================================================

function love.load()
  port = tonumber(os.getenv("REACTJIT_IPC_PORT"))
  windowW = love.graphics.getWidth()
  windowH = love.graphics.getHeight()

  love.graphics.setBackgroundColor(0.05, 0.05, 0.10)

  Tree.init()
  Layout.init({ measure = Measure })

  -- Init devtools in child mode (no bridge, no tree module ref — we manage our own)
  inspector.init()
  inspector.enable()
  console.init({})
  DevTools.init({
    inspector = inspector,
    console   = console,
    tree      = Tree,
  })
  -- Force devtools open
  DevTools.forceOpen()

  if not port then
    io.write("[devtools_window] ERROR: REACTJIT_IPC_PORT not set\n"); io.flush()
    return
  end

  conn = IPC.connect(port)
  if not conn then
    io.write("[devtools_window] ERROR: failed to connect to parent\n"); io.flush()
    return
  end

  connected = true
  IPC.send(conn, { type = "ready" })

  -- Block briefly to receive the init message (full tree)
  local socket = require("socket")
  local deadline = socket.gettime() + 5.0
  while socket.gettime() < deadline do
    local msgs = IPC.poll(conn)
    for _, msg in ipairs(msgs) do
      if msg.type == "init" and msg.commands then
        io.write("[devtools_window] received init with " .. #msg.commands .. " commands\n"); io.flush()
        Tree.applyCommands(msg.commands)
        -- Use main window dimensions for layout so computed values match
        mainW = msg.mainWidth or windowW
        mainH = msg.mainHeight or windowH
        treeDirty = true
        return
      end
    end
    socket.sleep(0.001)
  end

  io.write("[devtools_window] WARNING: timed out waiting for init\n"); io.flush()
end

-- ============================================================================
-- love.update — poll for mutations + state updates, relayout
-- ============================================================================

function love.update(dt)
  if not connected then return end

  local msgs, dead = IPC.poll(conn)
  if dead then
    io.write("[devtools_window] parent connection lost, exiting\n"); io.flush()
    shuttingDown = true
    love.event.quit()
    return
  end

  for _, msg in ipairs(msgs) do
    if msg.type == "mutations" and msg.commands then
      Tree.applyCommands(msg.commands)
      treeDirty = true
    elseif msg.type == "devtools_state" then
      -- Sync inspector state from main (selected node, perf data)
      if msg.selectedNodeId then
        local nodes = Tree.getNodes()
        local node = nodes and nodes[msg.selectedNodeId]
        if node then
          inspector.selectNode(node)
        end
      elseif msg.selectedNodeId == false then
        inspector.clearSelection()
      end
      if msg.perf then
        inspector.setPerfData(msg.perf)
      end
    elseif msg.type == "quit" then
      shuttingDown = true
      love.event.quit()
      return
    end
  end

  if treeDirty then
    local root = Tree.getTree()
    if root then
      -- Layout with main window dimensions so computed values are accurate
      Layout.layout(root, nil, nil, mainW or windowW, mainH or windowH)
    end
    treeDirty = false
  end

  inspector.update(dt)
end

-- ============================================================================
-- love.draw — render devtools full-screen
-- ============================================================================

function love.draw()
  local root = Tree.getTree()
  DevTools.drawInWindow(root)
end

-- ============================================================================
-- Input events — handle locally + send selections back to parent
-- ============================================================================

local function sendEvent(payload)
  if not connected then return end
  IPC.send(conn, payload)
end

function love.mousepressed(x, y, button)
  -- Route to devtools panel (the whole window IS the panel)
  DevTools.mousepressed(x, y, button)
  -- If a node was selected, tell the parent
  local sel = inspector.getSelectedNode()
  if sel then
    sendEvent({ type = "devtools_select", nodeId = sel.id })
  end
end

function love.mousereleased(x, y, button)
  DevTools.mousereleased(x, y, button)
end

function love.mousemoved(x, y, dx, dy)
  DevTools.mousemoved(x, y)
end

function love.wheelmoved(wx, wy)
  DevTools.wheelmoved(wx, wy)
end

function love.keypressed(key, scancode, isrepeat)
  DevTools.keypressed(key)
end

function love.keyreleased(key, scancode)
end

function love.textinput(text)
  DevTools.textinput(text)
end

function love.resize(w, h)
  windowW = w
  windowH = h
  treeDirty = true
end

function love.quit()
  if shuttingDown then
    IPC.cleanup(conn)
    return false
  end
  -- User clicked X — tell parent to dock back
  sendEvent({ type = "windowEvent", handler = "onClose" })
  return true -- block close, wait for parent to send "quit"
end
