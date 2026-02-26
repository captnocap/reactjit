--[[
  effects.lua — Generative canvas effect registry and lifecycle manager

  Manages off-screen canvases for procedural visual effects that can render
  standalone (as their own visual surface) or as a living background texture
  on any parent element.

  Follows the GameCanvas pattern: syncWithTree → updateAll → renderAll → painter composites.

  Usage (standalone — fills its own layout box):
    <Spirograph />
    <Spirograph speed={1.5} decay={0.02} />

  Usage (background — lives behind parent's children, no layout, no input):
    <Card>
      <Spirograph background />
      <Text fontSize={18}>Hello</Text>
    </Card>
]]

local Effects = {}

-- Registry: typeName -> effect module { create, update, draw }
local registry = {}

-- Live instances: nodeId -> { type, state, canvas, width, height, background, parentId }
local instances = {}

-- Reverse lookup: parentId -> nodeId (for background effects, so painter can find them)
local backgroundByParent = {}

-- ============================================================================
-- Registration
-- ============================================================================

--- Register an effect type.
--- @param typeName string  The node type React will CREATE (e.g. "Spirograph")
--- @param mod table  Effect module with create(w, h, props), update(state, dt, props, w, h), draw(state, w, h)
function Effects.register(typeName, mod)
  assert(typeName, "Effects.register: typeName required")
  assert(type(mod) == "table", "Effects.register: mod must be a table")
  assert(mod.create, "Effects.register: mod.create required")
  assert(mod.update, "Effects.register: mod.update required")
  assert(mod.draw, "Effects.register: mod.draw required")
  registry[typeName] = mod
end

--- Check if a node type is a registered effect.
function Effects.isEffect(typeName)
  return registry[typeName] ~= nil
end

--- Check if a specific node is a background-mode effect (for layout skip).
--- @param node table  The tree node
function Effects.isBackgroundEffect(node)
  if not registry[node.type] then return false end
  local props = node.props or {}
  return props.background == true
end

-- ============================================================================
-- Tree sync (called per-frame from init.lua)
-- ============================================================================

--- Shallow prop comparison. Returns true if different.
local function propsChanged(a, b)
  if a == b then return false end
  if a == nil or b == nil then return true end
  for k, v in pairs(a) do
    if b[k] ~= v then return true end
  end
  for k in pairs(b) do
    if a[k] == nil then return true end
  end
  return false
end

--- Sync effects with the React tree. Discovers effect nodes, manages canvases.
function Effects.syncWithTree(nodes)
  local seen = {}

  for id, node in pairs(nodes) do
    local mod = registry[node.type]
    if mod then
      seen[id] = true
      local props = node.props or {}
      local isBackground = props.background == true

      if not instances[id] then
        -- New effect: create instance (canvas created on first render when dimensions known)
        instances[id] = {
          type = node.type,
          state = nil,
          canvas = nil,
          width = 0,
          height = 0,
          background = isBackground,
          parentId = node.parent and node.parent.id or nil,
          props = props,
          needsInit = true,
        }
        if isBackground and node.parent then
          backgroundByParent[node.parent.id] = id
        end
      else
        -- Existing: update props reference
        local inst = instances[id]
        if inst.type ~= node.type then
          local oldMod = registry[inst.type]
          if oldMod and oldMod.destroy then
            oldMod.destroy(inst.state)
          end
          inst.type = node.type
          inst.state = nil
          inst.needsInit = true
        end
        inst.props = props
        local parentId = node.parent and node.parent.id or nil
        -- Update background parent mapping. Re-assert mapping each sync so a
        -- transient removal cannot leave backgroundByParent stale or nil.
        if isBackground and parentId then
          if inst.parentId and inst.parentId ~= parentId and backgroundByParent[inst.parentId] == id then
            backgroundByParent[inst.parentId] = nil
          end
          backgroundByParent[parentId] = id
        elseif inst.parentId and backgroundByParent[inst.parentId] == id then
          backgroundByParent[inst.parentId] = nil
        end
        inst.background = isBackground
        inst.parentId = parentId
      end

      -- Resolve target dimensions: parent's for background, own for standalone
      local c
      if isBackground and node.parent then
        c = node.parent.computed
      else
        c = node.computed
      end

      if c then
        local w = math.floor(c.w or 0)
        local h = math.floor(c.h or 0)
        local inst = instances[id]

        -- Store screen-space origin for mouse hit-testing
        inst.screenX = c.x or 0
        inst.screenY = c.y or 0

        if w > 0 and h > 0 and (inst.width ~= w or inst.height ~= h) then
          -- Canvas size changed: recreate
          if inst.canvas then inst.canvas:release() end
          inst.canvas = love.graphics.newCanvas(w, h)
          inst.width = w
          inst.height = h
          inst.needsInit = true
        end
      end
    end
  end

  -- Cleanup: destroy instances whose nodes were removed
  for id, inst in pairs(instances) do
    if not seen[id] then
      if inst.canvas then inst.canvas:release() end
      if inst.background and inst.parentId and backgroundByParent[inst.parentId] == id then
        backgroundByParent[inst.parentId] = nil
      end
      local mod = registry[inst.type]
      if mod and mod.destroy then
        mod.destroy(inst.state)
      end
      instances[id] = nil
    end
  end
end

-- ============================================================================
-- Mouse tracking (polled once per frame, resolved per-instance)
-- ============================================================================

local lastMx, lastMy = 0, 0
local mouseDx, mouseDy = 0, 0
local mouseSpeed = 0
local mouseIdleTime = 0

--- Poll global mouse state once per frame.
local function pollMouse(dt)
  local mx, my = love.mouse.getPosition()
  mouseDx = mx - lastMx
  mouseDy = my - lastMy
  mouseSpeed = math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy) / math.max(dt, 0.001)
  if math.abs(mouseDx) > 0.5 or math.abs(mouseDy) > 0.5 then
    mouseIdleTime = 0
  else
    mouseIdleTime = mouseIdleTime + dt
  end
  lastMx, lastMy = mx, my
end

--- Build per-instance mouse table (local coords, inside check).
--- @param inst table  The effect instance
--- @return table  { x, y, dx, dy, speed, inside, idle }
local function instanceMouse(inst)
  -- Resolve bounding box from the node's computed layout
  -- For background mode, the bounds are the parent's; for standalone, the effect's own.
  local x, y, w, h = 0, 0, inst.width, inst.height
  -- We need the screen-space origin. The canvas is drawn at (c.x, c.y) by painter.
  -- We store it during syncWithTree from the computed layout.
  if inst.screenX then
    x = inst.screenX
    y = inst.screenY
  end

  local localX = lastMx - x
  local localY = lastMy - y
  local inside = localX >= 0 and localX <= w and localY >= 0 and localY <= h

  return {
    x = localX,
    y = localY,
    dx = mouseDx,
    dy = mouseDy,
    speed = mouseSpeed,
    inside = inside,
    idle = mouseIdleTime,
  }
end

--- Update all effect instances.
function Effects.updateAll(dt)
  pollMouse(dt)

  for id, inst in pairs(instances) do
    local mod = registry[inst.type]
    if mod and inst.canvas and inst.width > 0 and inst.height > 0 then
      if inst.needsInit then
        inst.state = mod.create(inst.width, inst.height, inst.props)
        inst.needsInit = false
      end
      local mouse = instanceMouse(inst)
      mod.update(inst.state, dt, inst.props, inst.width, inst.height, mouse)
    end
  end
end

--- Render all effect instances to their off-screen canvases.
function Effects.renderAll()
  for id, inst in pairs(instances) do
    local mod = registry[inst.type]
    if mod and inst.canvas and inst.state and inst.width > 0 and inst.height > 0 then
      love.graphics.push("all")
      love.graphics.setCanvas(inst.canvas)
      -- Do NOT clear — effects manage their own background (trails/accumulation)
      mod.draw(inst.state, inst.width, inst.height)
      love.graphics.pop()
    end
  end
end

-- ============================================================================
-- Canvas retrieval (called by painter)
-- ============================================================================

--- Get the pre-rendered canvas for a standalone effect node.
--- @param nodeId number
--- @return love.Canvas|nil
function Effects.get(nodeId)
  local inst = instances[nodeId]
  return inst and inst.canvas
end

--- Get the background effect canvas for a parent node.
--- @param parentNodeId number
--- @return love.Canvas|nil
function Effects.getBackground(parentNodeId)
  local effectNodeId = backgroundByParent[parentNodeId]
  if not effectNodeId then return nil end
  local inst = instances[effectNodeId]
  return inst and inst.canvas
end

-- ============================================================================
-- Auto-load effects from lua/effects/ directory
-- ============================================================================

function Effects.loadAll()
  local effectFiles = {
    "spirograph",
    "rings",
    "flowparticles",
    "mirror",
    "mandala",
    "cymatics",
    "constellation",
    "mycelium",
    "pipes",
    "stainedglass",
    "voronoi",
    "contours",
    "feedback",
    "pixelsort",
    "texteffect",
    "terrain",
    "automata",
    "combustion",
    "reactiondiffusion",
    "edgegravity",
    "orbits",
    "plotter",
    "lsystem",
  }
  local loaded, failed = {}, {}
  for _, name in ipairs(effectFiles) do
    local ok, err = pcall(require, "lua.effects." .. name)
    if ok then
      loaded[#loaded + 1] = name
    else
      failed[#failed + 1] = name
      io.write("[effects] WARNING: " .. name .. ": " .. tostring(err) .. "\n"); io.flush()
    end
  end
  io.write("[effects] " .. #loaded .. " effects registered\n"); io.flush()
end

return Effects
