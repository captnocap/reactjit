--[[
  window_ipc.lua — IPC protocol for subprocess multi-window

  Provides TCP-based communication between the main Love2D process and
  child window processes. Uses LuaSocket for TCP, NDJSON for framing.

  Used by both parent (capabilities/window.lua) and child (child_window/main.lua).

  Protocol:
    Parent → Child:
      {"type":"init","commands":[...]}         -- Initial subtree
      {"type":"mutations","commands":[...]}    -- Incremental updates
      {"type":"resize","width":N,"height":N}   -- Window resized
      {"type":"quit"}                          -- Shutdown

    Child → Parent:
      {"type":"event","payload":{...}}         -- Input event for React
      {"type":"windowEvent","handler":"onClose"} -- Window lifecycle
      {"type":"ready"}                         -- Connection established
]]

local json = require("lua.json")

local IPC = {}

-- ============================================================================
-- TCP Server (parent side)
-- ============================================================================

--- Create a TCP server on localhost, random port. Returns server socket and port.
function IPC.createServer()
  local socket = require("socket")
  local server, err = socket.bind("127.0.0.1", 0)
  if not server then
    io.write("[window_ipc] bind failed: " .. tostring(err) .. "\n"); io.flush()
    return nil, nil
  end
  server:settimeout(0) -- non-blocking accept
  local _, port = server:getsockname()
  io.write("[window_ipc] server listening on 127.0.0.1:" .. port .. "\n"); io.flush()
  return server, port
end

--- Non-blocking accept on server. Returns client socket or nil.
function IPC.accept(server)
  if not server then return nil end
  local client, err = server:accept()
  if client then
    client:settimeout(0)
    client:setoption("tcp-nodelay", true)
    io.write("[window_ipc] client connected\n"); io.flush()
  end
  return client
end

-- ============================================================================
-- TCP Client (child side)
-- ============================================================================

--- Connect to parent's TCP server. Blocks until connected or timeout.
function IPC.connect(port, timeoutSec)
  local socket = require("socket")
  local conn, err = socket.connect("127.0.0.1", port)
  if not conn then
    io.write("[window_ipc] connect failed: " .. tostring(err) .. "\n"); io.flush()
    return nil
  end
  conn:settimeout(0)
  conn:setoption("tcp-nodelay", true)
  io.write("[window_ipc] connected to parent on port " .. port .. "\n"); io.flush()
  return conn
end

-- ============================================================================
-- Message Send / Receive (NDJSON)
-- ============================================================================

-- Per-connection receive buffer (connection → partial line buffer)
local recvBuffers = {}

--- Send a message (Lua table) as a JSON line. Returns true on success.
function IPC.send(conn, msg)
  if not conn then return false end
  local line = json.encode(msg) .. "\n"
  local sent, err, lastSent = conn:send(line)
  if not sent then
    -- Partial send or error
    if err == "timeout" then
      -- Partial send: LuaSocket sent some bytes but not all
      -- For simplicity, log and move on — message may be lost
      io.write("[window_ipc] partial send (" .. tostring(lastSent) .. "/" .. #line .. " bytes)\n"); io.flush()
      return false
    end
    io.write("[window_ipc] send error: " .. tostring(err) .. "\n"); io.flush()
    return false
  end
  return true
end

--- Non-blocking poll for messages. Returns array of parsed messages, plus a
--- boolean `dead` flag: true when the connection is closed/broken.
--- Usage: local msgs, dead = IPC.poll(conn)
function IPC.poll(conn)
  if not conn then return {}, true end
  local msgs = {}
  local dead = false

  -- Initialize receive buffer for this connection if needed
  if not recvBuffers[conn] then
    recvBuffers[conn] = ""
  end

  -- Read all available data
  while true do
    local data, err, partial = conn:receive(8192)
    local chunk = data or partial
    if chunk and #chunk > 0 then
      recvBuffers[conn] = recvBuffers[conn] .. chunk
    end
    if err == "closed" then
      dead = true
      break
    end
    if not data then break end -- no more data available (timeout)
  end

  -- Parse complete lines from buffer
  local buf = recvBuffers[conn]
  while true do
    local nlPos = buf:find("\n", 1, true)
    if not nlPos then break end
    local line = buf:sub(1, nlPos - 1)
    buf = buf:sub(nlPos + 1)
    if #line > 0 then
      local ok, parsed = pcall(json.decode, line)
      if ok and parsed then
        msgs[#msgs + 1] = parsed
      else
        io.write("[window_ipc] JSON parse error: " .. tostring(line:sub(1, 100)) .. "\n"); io.flush()
      end
    end
  end
  recvBuffers[conn] = buf

  return msgs, dead
end

--- Clean up receive buffer for a closed connection.
function IPC.cleanup(conn)
  if conn then
    recvBuffers[conn] = nil
    pcall(function() conn:close() end)
  end
end

-- ============================================================================
-- Subtree Serialization (parent side)
-- ============================================================================

--- Serialize a Window node's subtree into CREATE/APPEND commands
--- that a child process can replay to build its own tree.
function IPC.serializeSubtree(windowNode)
  local commands = {}

  local function walk(node, isDirectChild)
    -- CREATE or CREATE_TEXT
    if node.type == "__TEXT__" then
      commands[#commands + 1] = {
        op   = "CREATE_TEXT",
        id   = node.id,
        text = node.text,
      }
    else
      commands[#commands + 1] = {
        op          = "CREATE",
        id          = node.id,
        type        = node.type,
        props       = node.props or {},
        hasHandlers = node.hasHandlers or false,
      }
    end

    -- APPEND: direct children of the Window node become root-level in child
    if isDirectChild then
      commands[#commands + 1] = { op = "APPEND_TO_ROOT", childId = node.id }
    end

    -- Recurse children
    for _, child in ipairs(node.children or {}) do
      walk(child, false)
      commands[#commands + 1] = { op = "APPEND", parentId = node.id, childId = child.id }
    end
  end

  for _, child in ipairs(windowNode.children or {}) do
    walk(child, true)
  end

  return commands
end

-- ============================================================================
-- Node Ownership Tracking (parent side)
-- ============================================================================

local nodeOwner = {}  -- nodeId → childWindowId (nil = main window)

--- Rebuild the nodeOwner map by walking from each Window capability node.
--- @param windowEntries table  Array of { rootNodeId, id } (from window_manager)
--- @param allNodes table  The full node table from tree.getNodes()
function IPC.rebuildOwnership(windowEntries, allNodes)
  nodeOwner = {}
  for _, win in ipairs(windowEntries) do
    if win.rootNodeId then
      local rootNode = allNodes[win.rootNodeId]
      if rootNode then
        local function mark(node)
          for _, child in ipairs(node.children or {}) do
            nodeOwner[child.id] = win.id
            mark(child)
          end
        end
        mark(rootNode)
      end
    end
  end
end

--- Get the child window ID that owns a given node (nil = main window).
function IPC.getNodeOwner(nodeId)
  return nodeOwner[nodeId]
end

--- Filter a batch of mutations and route them to child windows.
--- Returns a table: childWindowId → array of commands for that child.
--- Commands targeting nodes in the main window are ignored (they stay local).
--- @param commands table  Array of mutation commands from tree
--- @param windowRootNodeIds table  Set of { [windowNodeId] = childWindowId }
function IPC.routeMutations(commands, windowRootNodeIds)
  local buckets = {} -- childWindowId → { cmd, cmd, ... }

  for _, cmd in ipairs(commands) do
    local nodeId = cmd.id or cmd.childId
    local parentId = cmd.parentId
    local owner = nil

    -- Check if the targeted node belongs to a child window
    if nodeId then
      owner = nodeOwner[nodeId]
    end

    -- For APPEND/REMOVE: if parentId is a Window root node, this is a
    -- direct child of the window → transform to root-level operation
    if not owner and parentId and windowRootNodeIds[parentId] then
      owner = windowRootNodeIds[parentId]
      -- Transform APPEND → APPEND_TO_ROOT, REMOVE → REMOVE_FROM_ROOT
      if cmd.op == "APPEND" then
        cmd = { op = "APPEND_TO_ROOT", childId = cmd.childId }
      elseif cmd.op == "REMOVE" then
        cmd = { op = "REMOVE_FROM_ROOT", childId = cmd.childId }
      end
      -- Also mark the child node as owned by this window going forward
      if cmd.childId then
        nodeOwner[cmd.childId] = owner
      end
    end

    -- For APPEND: if parentId is owned by a window, the child being appended
    -- also belongs to that window
    if not owner and parentId then
      owner = nodeOwner[parentId]
      if owner and cmd.childId then
        nodeOwner[cmd.childId] = owner
      end
    end

    if owner then
      if not buckets[owner] then buckets[owner] = {} end
      buckets[owner][#buckets[owner] + 1] = cmd
    end
  end

  return buckets
end

return IPC
