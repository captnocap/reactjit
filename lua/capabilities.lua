--[[
  capabilities.lua — Declarative native capability registry

  Lets Lua modules register themselves as React-controllable capabilities.
  The React side creates nodes with a capability type (e.g. "Audio", "Timer"),
  and this registry manages the lifecycle: create, update, tick, destroy.

  Usage (capability author):
    local Capabilities = require("lua.capabilities")

    Capabilities.register("Audio", {
      visual = false,
      schema = {
        src     = { type = "string", desc = "Audio file path" },
        playing = { type = "bool",   default = false },
        volume  = { type = "number", min = 0, max = 1, default = 1 },
      },
      events = { "onProgress", "onEnded", "onError" },
      create  = function(nodeId, props) return { source = nil } end,
      update  = function(nodeId, props, prev, state) ... end,
      destroy = function(nodeId, state) ... end,
      tick    = function(nodeId, state, dt, pushEvent) ... end,
    })

  Usage (end user / AI):
    <Audio src="beat.mp3" playing volume={0.8} />
]]

local Capabilities = {}

-- Registry: typeName -> capability definition
local registry = {}

-- Live instances: nodeId -> { type, state, props }
local instances = {}

-- ============================================================================
-- Registration
-- ============================================================================

--- Register a capability type.
--- @param typeName string  The node type that React will CREATE (e.g. "Audio")
--- @param def table  Capability definition with schema, lifecycle, events
function Capabilities.register(typeName, def)
  assert(typeName, "Capabilities.register: typeName is required")
  assert(type(def) == "table", "Capabilities.register: def must be a table")
  def.type = typeName
  def.visual = def.visual or false
  def.schema = def.schema or {}
  def.events = def.events or {}
  registry[typeName] = def
end

--- Check if a node type is a registered capability.
--- @param typeName string
--- @return boolean
function Capabilities.isCapability(typeName)
  return registry[typeName] ~= nil
end

--- Check if a node type is a non-visual capability (should skip paint/layout).
--- @param typeName string
--- @return boolean
function Capabilities.isNonVisual(typeName)
  local cap = registry[typeName]
  return cap ~= nil and not cap.visual
end

--- Check if a capability renders in its own surface (e.g. Window).
--- These nodes should be skipped by the parent window's paint/layout,
--- but their children are rendered in a separate window.
--- @param typeName string
--- @return boolean
function Capabilities.rendersInOwnSurface(typeName)
  local cap = registry[typeName]
  return cap ~= nil and cap.rendersInOwnSurface == true
end

-- ============================================================================
-- Tree sync (called per-frame from init.lua)
-- ============================================================================

--- Compare two prop tables (shallow). Returns true if different.
local function propsChanged(a, b)
  if a == b then return false end
  if a == nil or b == nil then return true end
  -- Check all keys in a
  for k, v in pairs(a) do
    if b[k] ~= v then return true end
  end
  -- Check for keys in b not in a
  for k in pairs(b) do
    if a[k] == nil then return true end
  end
  return false
end

--- Extract non-handler props from a node's props table.
--- Handlers (on*) stay on the JS side; we only see data props.
local function getDataProps(node)
  return node.props or {}
end

--- Sync capabilities with the React tree. Called every frame.
--- Discovers capability nodes, manages lifecycle, pushes events.
---
--- @param nodes table  The full node table from tree.lua (id -> node)
--- @param pushEvent function  Function to push events to the bridge
--- @param dt number  Delta time since last frame
function Capabilities.syncWithTree(nodes, pushEvent, dt)
  local seen = {}

  for id, node in pairs(nodes) do
    local cap = registry[node.type]
    if cap then
      seen[id] = true
      local props = getDataProps(node)

      if not instances[id] then
        -- New capability node: create
        local state = {}
        if cap.create then
          state = cap.create(id, props) or {}
        end
        instances[id] = { type = node.type, state = state, props = props }
      else
        -- Existing: check for prop changes
        local inst = instances[id]
        if propsChanged(inst.props, props) then
          if cap.update then
            cap.update(id, props, inst.props, inst.state)
          end
          inst.props = props
        end
      end

      -- Per-frame tick (optional) — receives props so capabilities don't need to cache them
      if cap.tick then
        cap.tick(id, instances[id].state, dt, pushEvent, props)
      end
    end
  end

  -- Cleanup: destroy instances whose nodes were removed from the tree
  for id, inst in pairs(instances) do
    if not seen[id] then
      local cap = registry[inst.type]
      if cap and cap.destroy then
        cap.destroy(id, inst.state)
      end
      instances[id] = nil
    end
  end
end

-- ============================================================================
-- Schema queries (for AI discovery via RPC)
-- ============================================================================

--- Get schemas for all registered capabilities.
--- @return table  { typeName -> { schema, events, visual } }
function Capabilities.getSchemas()
  local result = {}
  for typeName, cap in pairs(registry) do
    result[typeName] = {
      schema = cap.schema,
      events = cap.events,
      visual = cap.visual,
    }
  end
  return result
end

--- Get schema for a single capability.
--- @param typeName string
--- @return table|nil
function Capabilities.getSchema(typeName)
  local cap = registry[typeName]
  if not cap then return nil end
  return {
    schema = cap.schema,
    events = cap.events,
    visual = cap.visual,
  }
end

-- ============================================================================
-- RPC handlers (registered in init.lua)
-- ============================================================================

--- Get RPC handlers for registration in init.lua.
--- @return table  { method -> handler }
function Capabilities.getHandlers()
  return {
    ["capabilities:list"] = function()
      return Capabilities.getSchemas()
    end,

    ["capabilities:schema"] = function(args)
      return Capabilities.getSchema(args.type)
    end,
  }
end

-- ============================================================================
-- Auto-load capabilities from lua/capabilities/ directory
-- ============================================================================

--- Load all capability files from lua/capabilities/.
--- Each file should call Capabilities.register() when required.
--- Get the raw capability definition table (includes schema, draw, etc.).
--- @param typeName string
--- @return table|nil
function Capabilities.getDefinition(typeName)
  return registry[typeName]
end

--- Get the live instance for a node by ID.
--- Returns { type, state, props } or nil if not found.
--- @param id string
--- @return table|nil
function Capabilities.getInstance(id)
  return instances[id]
end

function Capabilities.loadAll()
  local files = {
    "audio",
    "timer",
    "llm_agent",
    "window",
    "boids",
    "image_select",
  }
  for _, name in ipairs(files) do
    local ok, err = pcall(require, "lua.capabilities." .. name)
    if ok then
      io.write("[capabilities] Loaded: " .. name .. "\n"); io.flush()
    else
      io.write("[capabilities] Failed to load " .. name .. ": " .. tostring(err) .. "\n"); io.flush()
    end
  end
end

return Capabilities
