--[[
  child_window/main.lua — Child Love2D process for multi-window

  Spawned by the parent Love2D process when a <Window> component mounts.
  Receives tree mutations over TCP from the parent, renders using the same
  tree → layout → painter pipeline. Sends input events back to parent.

  No QuickJS, no bridge, no capabilities. Just: tree + layout + painter.
]]

-- Resolve paths: child_window/ is inside lua/, repo root is two levels up
local source = love.filesystem.getSource()
local luaDir = source .. "/.."
local repoRoot = source .. "/../.."
package.path = package.path
  .. ";" .. repoRoot .. "/?.lua"
  .. ";" .. repoRoot .. "/?/init.lua"
  .. ";" .. luaDir .. "/?.lua"

local json    = require("lua.json")
local IPC     = require("lua.window_ipc")
local Tree    = require("lua.tree")
local Layout  = require("lua.layout")
local Measure = require("lua.measure")
local Painter = require("lua.painter")
local Events  = require("lua.events")

local conn         -- TCP connection to parent
local port         -- Parent's TCP port
local windowW, windowH
local treeDirty    = true
local connected    = false
local shuttingDown = false  -- true when parent sent "quit" (clean exit, no onClose)

-- ============================================================================
-- love.load — connect to parent, receive initial subtree
-- ============================================================================

function love.load()
  port = tonumber(os.getenv("REACTJIT_IPC_PORT"))
  windowW = love.graphics.getWidth()
  windowH = love.graphics.getHeight()

  love.graphics.setBackgroundColor(0.04, 0.04, 0.06)

  -- Initialize modules (child has no images/videos/animations)
  Tree.init()
  Layout.init({ measure = Measure })
  Painter.init({ measure = Measure })

  if not port then
    io.write("[child_window] ERROR: REACTJIT_IPC_PORT not set\n"); io.flush()
    return
  end

  conn = IPC.connect(port)
  if not conn then
    io.write("[child_window] ERROR: failed to connect to parent\n"); io.flush()
    return
  end

  connected = true
  IPC.send(conn, { type = "ready" })

  -- Block briefly to receive the init message (subtree data)
  local socket = require("socket")
  local deadline = socket.gettime() + 5.0 -- 5 second timeout
  while socket.gettime() < deadline do
    local msgs = IPC.poll(conn)
    for _, msg in ipairs(msgs) do
      if msg.type == "init" and msg.commands then
        io.write("[child_window] received init with " .. #msg.commands .. " commands\n"); io.flush()
        Tree.applyCommands(msg.commands)
        treeDirty = true
        return -- done with load
      end
    end
    socket.sleep(0.001) -- 1ms poll
  end

  io.write("[child_window] WARNING: timed out waiting for init message\n"); io.flush()
end

-- ============================================================================
-- love.update — poll for mutations, relayout
-- ============================================================================

function love.update(dt)
  if not connected then return end

  -- Poll for messages from parent
  local msgs, dead = IPC.poll(conn)
  if dead then
    io.write("[child_window] parent connection lost, exiting\n"); io.flush()
    shuttingDown = true
    love.event.quit()
    return
  end
  for _, msg in ipairs(msgs) do
    if msg.type == "mutations" and msg.commands then
      Tree.applyCommands(msg.commands)
      treeDirty = true
    elseif msg.type == "resize" then
      windowW = msg.width or windowW
      windowH = msg.height or windowH
      treeDirty = true
    elseif msg.type == "quit" then
      shuttingDown = true
      love.event.quit()
      return
    end
  end

  -- Relayout if tree changed
  if treeDirty then
    local root = Tree.getTree()
    if root then
      Layout.layout(root, nil, nil, windowW, windowH)
    end
    treeDirty = false
  end
end

-- ============================================================================
-- love.draw — paint the tree
-- ============================================================================

function love.draw()
  local root = Tree.getTree()
  if root then
    Painter.paint(root)
  end
end

-- ============================================================================
-- Input events — hit test locally, send to parent
-- ============================================================================

local function sendEvent(payload)
  if not connected then return end
  IPC.send(conn, { type = "event", payload = payload })
end

local function sendWindowEvent(handler, data)
  if not connected then return end
  IPC.send(conn, { type = "windowEvent", handler = handler, data = data })
end

function love.mousepressed(x, y, button)
  local root = Tree.getTree()
  if not root then return end

  local hit = Events.hitTest(root, x, y)
  if hit and hit.hasHandlers then
    local bubblePath = Events.buildBubblePath(hit)
    sendEvent({
      type       = "click",
      targetId   = hit.id,
      x          = x,
      y          = y,
      button     = button,
      bubblePath = bubblePath,
    })
  end
end

function love.mousereleased(x, y, button)
  local root = Tree.getTree()
  if not root then return end
  local hit = Events.hitTest(root, x, y)
  if hit and hit.hasHandlers then
    local bubblePath = Events.buildBubblePath(hit)
    sendEvent({
      type       = "release",
      targetId   = hit.id,
      x          = x,
      y          = y,
      button     = button,
      bubblePath = bubblePath,
    })
  end
end

function love.mousemoved(x, y, dx, dy)
  -- Hover events could be forwarded here if needed
end

function love.wheelmoved(wx, wy)
  -- Handle scroll locally (same as main process)
  local root = Tree.getTree()
  if not root then return end

  local mx, my = love.mouse.getPosition()
  local hit = Events.hitTest(root, mx, my)
  if not hit then return end

  -- Walk up from hit to find a scroll container
  local scrollNode = Events.findScrollContainer(hit, mx, my)
  if scrollNode then
    local sx = (scrollNode.scrollState and scrollNode.scrollState.scrollX or 0) - wx * 40
    local sy = (scrollNode.scrollState and scrollNode.scrollState.scrollY or 0) - wy * 40
    Tree.setScroll(scrollNode.id, sx, sy)
    treeDirty = true
    return
  end

  -- No scroll container — forward wheel event to parent for React handlers
  if hit.hasHandlers then
    local bubblePath = Events.buildBubblePath(hit)
    sendEvent({
      type       = "wheel",
      targetId   = hit.id,
      x          = mx,
      y          = my,
      dx         = wx,
      dy         = wy,
      bubblePath = bubblePath,
    })
  end
end

function love.keypressed(key, scancode, isrepeat)
  sendEvent({
    type     = "keydown",
    key      = key,
    scancode = scancode,
    isrepeat = isrepeat,
  })
end

function love.keyreleased(key, scancode)
  sendEvent({
    type     = "keyup",
    key      = key,
    scancode = scancode,
  })
end

function love.textinput(text)
  sendEvent({
    type = "textinput",
    text = text,
  })
end

function love.resize(w, h)
  windowW = w
  windowH = h
  treeDirty = true
  sendWindowEvent("onResize", { width = w, height = h })
end

function love.focus(hasFocus)
  if hasFocus then
    sendWindowEvent("onFocus", {})
  else
    sendWindowEvent("onBlur", {})
  end
end

function love.quit()
  if shuttingDown then
    -- Parent told us to quit (React already unmounted the <Window>)
    IPC.cleanup(conn)
    return false -- actually exit
  end
  -- User clicked X on this window — ask parent (React's onClose handler decides)
  sendWindowEvent("onClose", {})
  return true -- block close, wait for parent to send "quit"
end
