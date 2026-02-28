--[[
  graph.lua — RackGraph: module routing DAG

  Manages a directed acyclic graph of audio modules. Handles:
    - Adding/removing module instances
    - Connecting/disconnecting ports between modules
    - Topological sort for correct execution order
    - Buffer routing: before each process(), copy upstream output buffers
      to downstream input buffers

  Connections are between ports:
    { fromId, fromPort, toId, toPort }

  Only valid connections:
    - audio out → audio in
    - control out → control in
    - Types must match between from and to
    - No cycles allowed
]]

local Module = require("lua.audio.module")

local Graph = {}
Graph.__index = Graph

local BUFFER_SIZE = Module.BUFFER_SIZE

-- ============================================================================
-- Constructor
-- ============================================================================

function Graph.new()
  local self = setmetatable({}, Graph)
  self.modules     = {}    -- id -> module instance
  self.connections  = {}    -- list of { fromId, fromPort, toId, toPort }
  self.order        = {}    -- topological execution order (list of ids)
  self._dirty       = true  -- needs re-sort
  self._inputBuffers = {}   -- moduleId.portName -> buffer (allocated on demand)
  return self
end

-- ============================================================================
-- Module management
-- ============================================================================

--- Add a module instance to the graph.
--- @param instance table Module instance (from Module.instantiate)
function Graph:addModule(instance)
  assert(instance.id, "Graph:addModule: instance must have an id")
  assert(not self.modules[instance.id], "Graph:addModule: duplicate id '" .. instance.id .. "'")
  self.modules[instance.id] = instance
  self._dirty = true
end

--- Remove a module and all its connections.
--- @param id string Module ID
function Graph:removeModule(id)
  if not self.modules[id] then return false end

  -- Remove all connections involving this module
  local kept = {}
  for _, conn in ipairs(self.connections) do
    if conn.fromId ~= id and conn.toId ~= id then
      kept[#kept + 1] = conn
    end
  end
  self.connections = kept

  -- Clean up input buffers
  for key in pairs(self._inputBuffers) do
    if key:find("^" .. id .. "%.") then
      self._inputBuffers[key] = nil
    end
  end

  self.modules[id] = nil
  self._dirty = true
  return true
end

--- Get a module instance by ID.
--- @param id string Module ID
--- @return table|nil Module instance
function Graph:getModule(id)
  return self.modules[id]
end

-- ============================================================================
-- Connection management
-- ============================================================================

--- Connect an output port to an input port.
--- @param fromId string Source module ID
--- @param fromPort string Source port name
--- @param toId string Destination module ID
--- @param toPort string Destination port name
--- @return boolean success
--- @return string? error message
function Graph:connect(fromId, fromPort, toId, toPort)
  local fromMod = self.modules[fromId]
  local toMod = self.modules[toId]

  if not fromMod then return false, "Source module '" .. fromId .. "' not found" end
  if not toMod then return false, "Destination module '" .. toId .. "' not found" end

  local srcPort = fromMod.ports[fromPort]
  local dstPort = toMod.ports[toPort]

  if not srcPort then return false, "Source port '" .. fromPort .. "' not found on '" .. fromId .. "'" end
  if not dstPort then return false, "Destination port '" .. toPort .. "' not found on '" .. toId .. "'" end

  if srcPort.direction ~= "out" then return false, "Source port must be 'out'" end
  if dstPort.direction ~= "in" then return false, "Destination port must be 'in'" end
  if srcPort.type ~= dstPort.type then
    return false, "Port type mismatch: " .. srcPort.type .. " -> " .. dstPort.type
  end

  -- Check for duplicate connection
  for _, conn in ipairs(self.connections) do
    if conn.fromId == fromId and conn.fromPort == fromPort
       and conn.toId == toId and conn.toPort == toPort then
      return false, "Connection already exists"
    end
  end

  -- Add connection
  self.connections[#self.connections + 1] = {
    fromId   = fromId,
    fromPort = fromPort,
    toId     = toId,
    toPort   = toPort,
    type     = srcPort.type,
  }

  -- Allocate input buffer for audio connections
  if srcPort.type == "audio" then
    local key = toId .. "." .. toPort
    if not self._inputBuffers[key] then
      local buf = {}
      for i = 0, BUFFER_SIZE - 1 do buf[i] = 0 end
      self._inputBuffers[key] = buf
    end
  end

  self._dirty = true

  -- Verify no cycles
  local ok = self:_topoSort()
  if not ok then
    -- Remove the connection we just added (it creates a cycle)
    self.connections[#self.connections] = nil
    self._dirty = true
    self:_topoSort()  -- re-sort without the cycle
    return false, "Connection would create a cycle"
  end

  return true
end

--- Disconnect a specific connection.
--- @return boolean success
function Graph:disconnect(fromId, fromPort, toId, toPort)
  for i, conn in ipairs(self.connections) do
    if conn.fromId == fromId and conn.fromPort == fromPort
       and conn.toId == toId and conn.toPort == toPort then
      table.remove(self.connections, i)
      self._dirty = true
      return true
    end
  end
  return false
end

-- ============================================================================
-- Topological sort (Kahn's algorithm)
-- ============================================================================

--- Compute execution order. Returns true if acyclic, false if cycle detected.
function Graph:_topoSort()
  -- Build adjacency: which modules feed into which
  local inDegree = {}
  local adj = {}    -- fromId -> list of toIds

  for id in pairs(self.modules) do
    inDegree[id] = 0
    adj[id] = {}
  end

  -- Only count unique module-to-module edges (not per-port)
  local edges = {}  -- "fromId->toId" -> true
  for _, conn in ipairs(self.connections) do
    local key = conn.fromId .. "->" .. conn.toId
    if not edges[key] then
      edges[key] = true
      inDegree[conn.toId] = (inDegree[conn.toId] or 0) + 1
      adj[conn.fromId] = adj[conn.fromId] or {}
      adj[conn.fromId][#adj[conn.fromId] + 1] = conn.toId
    end
  end

  -- Kahn's algorithm
  local queue = {}
  for id, deg in pairs(inDegree) do
    if deg == 0 then
      queue[#queue + 1] = id
    end
  end
  -- Sort the initial queue for deterministic order
  table.sort(queue)

  local order = {}
  while #queue > 0 do
    local id = table.remove(queue, 1)
    order[#order + 1] = id

    for _, toId in ipairs(adj[id] or {}) do
      inDegree[toId] = inDegree[toId] - 1
      if inDegree[toId] == 0 then
        queue[#queue + 1] = toId
      end
    end
  end

  -- If not all modules are in the order, there's a cycle
  local moduleCount = 0
  for _ in pairs(self.modules) do moduleCount = moduleCount + 1 end

  if #order ~= moduleCount then
    return false
  end

  self.order = order
  self._dirty = false
  return true
end

--- Get the current execution order. Re-sorts if dirty.
--- @return table List of module IDs in execution order
function Graph:getOrder()
  if self._dirty then
    self:_topoSort()
  end
  return self.order
end

-- ============================================================================
-- Buffer routing
-- ============================================================================

--- Route buffers according to connections, then process all modules in order.
--- Called once per audio buffer chunk.
--- @param numSamples number Number of samples to process
function Graph:process(numSamples)
  if self._dirty then
    self:_topoSort()
  end

  for _, id in ipairs(self.order) do
    local instance = self.modules[id]
    if instance then
      -- Prepare input tables
      local inputs = {}
      local outputs = {}

      -- Collect inputs from upstream connections
      for _, conn in ipairs(self.connections) do
        if conn.toId == id then
          local srcMod = self.modules[conn.fromId]
          if srcMod then
            local srcPort = srcMod.ports[conn.fromPort]
            if conn.type == "audio" and srcPort and srcPort.buffer then
              -- For audio: provide the upstream output buffer directly
              -- If multiple sources connect to same input, we need to mix
              local key = id .. "." .. conn.toPort
              local inputBuf = self._inputBuffers[key]
              if inputBuf then
                if inputs[conn.toPort] then
                  -- Already have a buffer for this input — accumulate
                  Module.addBuffer(inputBuf, srcPort.buffer, numSamples)
                else
                  -- First connection to this input — copy
                  Module.copyBuffer(inputBuf, srcPort.buffer, numSamples)
                end
                inputs[conn.toPort] = inputBuf
              end
            elseif conn.type == "control" and srcPort then
              -- For control: pass the single value
              -- If multiple sources, use the last one (or sum?)
              inputs[conn.toPort] = srcPort.value
            end
          end
        end
      end

      -- Set up output buffer references
      for portName, port in pairs(instance.ports) do
        if port.direction == "out" then
          if port.type == "audio" and port.buffer then
            -- Clear the output buffer before processing
            Module.clearBuffer(port.buffer, numSamples)
            outputs[portName] = port.buffer
          elseif port.type == "control" then
            outputs[portName] = port  -- module writes port.value directly
          end
        end
      end

      -- Process this module
      Module.process(instance, numSamples, inputs, outputs)
    end
  end
end

-- ============================================================================
-- State serialization
-- ============================================================================

--- Get a snapshot of the entire graph for UI display.
--- @return table { modules: [...], connections: [...] }
function Graph:getState()
  local modules = {}
  for _, id in ipairs(self.order) do
    local instance = self.modules[id]
    if instance then
      modules[#modules + 1] = Module.getState(instance)
    end
  end

  local connections = {}
  for _, conn in ipairs(self.connections) do
    connections[#connections + 1] = {
      fromId   = conn.fromId,
      fromPort = conn.fromPort,
      toId     = conn.toId,
      toPort   = conn.toPort,
      type     = conn.type,
    }
  end

  return {
    modules     = modules,
    connections = connections,
  }
end

return Graph
