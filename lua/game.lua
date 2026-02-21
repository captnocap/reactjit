--[[
  game.lua — Game module system for iLoveReact

  Manages Lua game modules that render into off-screen canvases.
  The painter composites these canvases at layout positions, and
  React children render as UI overlay on top.

  Follows the Scene3D pattern:
    syncWithTree() → updateAll() → renderAll() → painter composites

  Key design decisions:
  - Modules are singletons: multiple GameCanvas nodes with the same
    module name share one game instance (same state, one update/frame)
  - Each canvas can use a different draw mode: "original" calls
    drawWithUI() (game + love.graphics UI), "react" calls draw()
    (game only, React handles UI)
  - Input routes by focus: keyboard goes to focused GameCanvas,
    mouse hit-tests against canvas bounds
  - State emission is batched: modules mark dirty, game.lua emits
    once per frame after updateAll() — never inside game logic
]]

local Game = {}
local loadedModules = {}  -- moduleName -> module instance (singleton)
local canvases = {}       -- nodeId -> { moduleName, instanceKey, mode, canvas, width, height, bounds }
local focusedNodeId = nil -- which GameCanvas receives keyboard input

function Game.init() end

-- Load a module once (singleton). Multiple canvases share the same instance.
local function ensureModule(moduleName)
  if loadedModules[moduleName] then return loadedModules[moduleName] end
  local ok, mod = pcall(require, "lua.game." .. moduleName)
  if not ok then
    io.write("[game] Failed to load module: " .. moduleName .. " — " .. tostring(mod) .. "\n"); io.flush()
    return nil
  end
  loadedModules[moduleName] = mod
  if mod.load then mod.load() end
  io.write("[game] Loaded module: " .. moduleName .. "\n"); io.flush()
  return mod
end

--- Called per-frame from init.lua (like scene3d.syncWithTree).
--- Discovers GameCanvas nodes in the React tree, loads their modules,
--- manages canvases, and cleans up removed nodes.
function Game.syncWithTree(nodes)
  local seen = {}
  for id, node in pairs(nodes) do
    if node.type == "GameCanvas" then
      seen[id] = true
      local moduleName = node.props and node.props.module
      local instanceKey = node.props and node.props.instanceKey
      local mode = node.props and node.props.mode or "react"
      if moduleName and not canvases[id] then
        local mod = ensureModule(moduleName)
        if mod then
          canvases[id] = { moduleName = moduleName, instanceKey = instanceKey, mode = mode, canvas = nil, width = 0, height = 0, bounds = nil }
          -- Auto-focus first GameCanvas
          if not focusedNodeId then focusedNodeId = id end
        end
      end
      local entry = canvases[id]
      if entry then
        entry.instanceKey = instanceKey
        entry.mode = mode
        local c = node.computed
        local w = math.floor(c and c.w or 0)
        local h = math.floor(c and c.h or 0)
        if w > 0 and h > 0 and (entry.width ~= w or entry.height ~= h) then
          if entry.canvas then entry.canvas:release() end
          entry.canvas = love.graphics.newCanvas(w, h)
          entry.width = w
          entry.height = h
          -- Notify module of resize
          local mod = loadedModules[entry.moduleName]
          if mod and mod.resize then mod.resize(w, h) end
        end
        entry.bounds = c and { x = c.x or 0, y = c.y or 0, w = w, h = h } or nil
      end
    end
  end

  -- Clean up canvases whose nodes were removed from the tree
  for id, entry in pairs(canvases) do
    if not seen[id] then
      if entry.canvas then entry.canvas:release() end
      canvases[id] = nil
      if focusedNodeId == id then focusedNodeId = nil end
    end
  end

  -- Unload modules with zero canvases referencing them
  for name, mod in pairs(loadedModules) do
    local refCount = 0
    for _, e in pairs(canvases) do
      if e.moduleName == name then refCount = refCount + 1 end
    end
    if refCount == 0 then
      io.write("[game] Unloading module: " .. name .. "\n"); io.flush()
      if mod.unload then mod.unload() end
      loadedModules[name] = nil
    end
  end
end

--- Called per-frame: update each loaded module ONCE, then batch-emit dirty state.
--- @param dt number Delta time
--- @param pushEvent function The event push function from init.lua
function Game.updateAll(dt, pushEvent)
  for name, mod in pairs(loadedModules) do
    if mod.update then mod.update(dt) end

    -- Batch emit: module marks dirty, we emit once per frame per module
    if pushEvent and mod.getState and mod.isDirty and mod.isDirty() then
      local state = mod.getState()
      -- Emit to all canvases referencing this module
      for nodeId, entry in pairs(canvases) do
        if entry.moduleName == name then
          pushEvent({
            type = "game:event",
            payload = {
              nodeId = nodeId,
              module = name,
              instanceKey = entry.instanceKey,
              name = "state",
              data = state
            }
          })
        end
      end
      mod.clearDirty()
    end
  end
end

--- Called per-frame: render each canvas using its module's draw function + mode.
function Game.renderAll()
  for _, entry in pairs(canvases) do
    local mod = loadedModules[entry.moduleName]
    if entry.canvas and mod then
      love.graphics.push("all")
      love.graphics.setCanvas(entry.canvas)
      love.graphics.clear(0, 0, 0, 1)
      -- "original" mode draws game + old love.graphics UI
      -- "react" mode draws game only, React handles UI
      if entry.mode == "original" and mod.drawWithUI then
        mod.drawWithUI()
      elseif mod.draw then
        mod.draw()
      end
      love.graphics.pop()
    end
  end
end

--- Get the pre-rendered canvas for a specific node (called by painter).
--- @param nodeId number
--- @return love.Canvas|nil
function Game.get(nodeId)
  local entry = canvases[nodeId]
  return entry and entry.canvas
end

--- Check if a node type is a game-specific child that the 2D painter should skip.
function Game.isGameChildType(nodeType)
  return false  -- GameCanvas has no special child types (unlike Scene3D's Mesh3D etc.)
end

-- ============================================================================
-- Input routing
-- ============================================================================

--- Focus-based keyboard routing: only the focused GameCanvas gets keyboard events.
function Game.keypressed(key, scancode, isrepeat)
  if focusedNodeId and canvases[focusedNodeId] then
    local mod = loadedModules[canvases[focusedNodeId].moduleName]
    if mod and mod.keypressed then mod.keypressed(key, scancode, isrepeat) end
  end
end

function Game.keyreleased(key, scancode)
  if focusedNodeId and canvases[focusedNodeId] then
    local mod = loadedModules[canvases[focusedNodeId].moduleName]
    if mod and mod.keyreleased then mod.keyreleased(key, scancode) end
  end
end

--- Mouse events: hit-test against canvas bounds. Click to focus.
--- Coordinates are translated to be relative to the canvas origin.
function Game.mousepressed(x, y, button)
  io.write("[game] mousepressed x=" .. math.floor(x) .. " y=" .. math.floor(y) .. " canvases=" .. tostring(next(canvases) ~= nil) .. "\n"); io.flush()
  for nodeId, entry in pairs(canvases) do
    local b = entry.bounds
    io.write("[game]   canvas " .. nodeId .. " bounds=" .. (b and (math.floor(b.x) .. "," .. math.floor(b.y) .. " " .. math.floor(b.w) .. "x" .. math.floor(b.h)) or "nil") .. " mode=" .. entry.mode .. "\n"); io.flush()
    if b and x >= b.x and x < b.x + b.w and y >= b.y and y < b.y + b.h then
      io.write("[game]   -> HIT! relative=" .. math.floor(x - b.x) .. "," .. math.floor(y - b.y) .. "\n"); io.flush()
      focusedNodeId = nodeId
      local mod = loadedModules[entry.moduleName]
      if mod and mod.mousepressed then
        mod.mousepressed(x - b.x, y - b.y, button)
      end
      return true  -- consumed
    end
  end
  return false
end

function Game.mousereleased(x, y, button)
  for _, entry in pairs(canvases) do
    local b = entry.bounds
    if b and x >= b.x and x < b.x + b.w and y >= b.y and y < b.y + b.h then
      local mod = loadedModules[entry.moduleName]
      if mod and mod.mousereleased then
        mod.mousereleased(x - b.x, y - b.y, button)
      end
      return true
    end
  end
  return false
end

local _mmLogCount = 0
function Game.mousemoved(x, y, dx, dy)
  for _, entry in pairs(canvases) do
    local b = entry.bounds
    if b and x >= b.x and x < b.x + b.w and y >= b.y and y < b.y + b.h then
      if _mmLogCount < 3 then
        _mmLogCount = _mmLogCount + 1
        io.write("[game] mousemoved hit canvas, relative=" .. math.floor(x - b.x) .. "," .. math.floor(y - b.y) .. " W=" .. b.w .. " H=" .. b.h .. "\n"); io.flush()
      end
      local mod = loadedModules[entry.moduleName]
      if mod and mod.mousemoved then
        mod.mousemoved(x - b.x, y - b.y, dx, dy)
      end
    end
  end
end

-- ============================================================================
-- Command routing (JS → Lua via RPC)
-- ============================================================================

--- Route a command from JS to the correct module.
--- Tries nodeId first, falls back to module name.
--- @param args table { nodeId?, module?, command, args }
function Game.handleCommand(args)
  if not args or not args.command then return nil end

  -- Try routing by nodeId
  local entry = args.nodeId and canvases[args.nodeId] or nil
  if entry then
    local mod = loadedModules[entry.moduleName]
    if mod and mod.onCommand then
      return mod.onCommand(args.command, args.args)
    end
  end

  -- Fallback: route by module + instanceKey
  if args.module and args.instanceKey then
    for _, e in pairs(canvases) do
      if e.moduleName == args.module and e.instanceKey == args.instanceKey then
        local mod = loadedModules[e.moduleName]
        if mod and mod.onCommand then
          return mod.onCommand(args.command, args.args)
        end
      end
    end
  end

  -- Fallback: route by module name
  if args.module then
    local mod = loadedModules[args.module]
    if mod and mod.onCommand then
      return mod.onCommand(args.command, args.args)
    end
  end
end

return Game
