--[[
  capabilities/physics.lua — Box2D physics via love.physics

  Declarative 2D physics engine. React components create nodes with
  capability types (PhysicsWorld, RigidBody, Collider, joints).
  This module manages the Box2D lifecycle and syncs positions back
  to the instance tree each frame.

  React usage:
    <PhysicsWorld gravity={[0, 980]}>
      <RigidBody type="dynamic">
        <Collider shape="rectangle" width={40} height={40} />
        <Box style={{ width: 40, height: 40, backgroundColor: 'red' }} />
      </RigidBody>
      <RigidBody type="static" x={400} y={500}>
        <Collider shape="rectangle" width={800} height={20} />
        <Box style={{ width: 800, height: 20, backgroundColor: '#4a3' }} />
      </RigidBody>
    </PhysicsWorld>
]]

local Capabilities = require("lua.capabilities")

-- ============================================================================
-- Debug logging — always-on for diagnosis
-- ============================================================================
local PHYS_DEBUG = true
local _plogFile = io.open("/tmp/physics_debug.log", "w")
local function plog(fmt, ...)
  if not PHYS_DEBUG then return end
  local msg
  if select("#", ...) > 0 then
    local ok, s = pcall(string.format, fmt, ...)
    msg = ok and s or (fmt .. " [fmt error]")
  else
    msg = fmt
  end
  if _plogFile then
    _plogFile:write("[physics] " .. msg .. "\n")
    _plogFile:flush()
  end
end

plog("=== physics.lua loading ===")
plog("love.physics = %s", tostring(love.physics))

if not love.physics then
  -- Physics module not loaded — register stubs so React nodes don't error
  local noop = function() return {} end
  for _, typeName in ipairs({
    "PhysicsWorld", "RigidBody", "Collider", "Sensor",
    "RevoluteJoint", "DistanceJoint", "PrismaticJoint",
    "WeldJoint", "RopeJoint", "MouseJoint",
  }) do
    Capabilities.register(typeName, {
      visual = false,
      create = function(nodeId, props)
        io.write("[physics] love.physics not available — " .. typeName .. " is a no-op\n")
        io.flush()
        return {}
      end,
    })
  end
  return
end

-- love.physics uses meters internally. Set a sensible scale.
love.physics.setMeter(64)

-- ============================================================================
-- Module state
-- ============================================================================

-- worldId -> { world, bodies={bodyNodeId->body}, contacts={} }
local worlds = {}

-- bodyNodeId -> worldNodeId (so RigidBody can find its world)
local bodyWorldMap = {}

-- bodyNodeId -> love.Body
local bodyObjects = {}

-- colliderNodeId -> love.Fixture
local fixtureObjects = {}

-- jointNodeId -> love.Joint
local jointObjects = {}

-- bodyNodeId -> { origX, origY } (layout position at create time)
local bodyOrigins = {}

-- Optional stable body aliases:
-- alias string -> bodyNodeId, and reverse map for cleanup.
local bodyAliasMap = {}
local bodyAliasByNode = {}

-- Log gating for retryable create paths (avoid per-frame spam while pending)
local rigidMissingWorldLogged = {}
local colliderMissingBodyLogged = {}
local jointMissingBodyLogged = {}

-- Lazy-loaded tree module for node access
local Tree = nil
local function getTreeNodes()
  if not Tree then Tree = require("lua.tree") end
  return Tree.getNodes()
end

-- ============================================================================
-- Helpers
-- ============================================================================

--- Walk up node.parent chain to find an ancestor of a given type.
local function findAncestor(node, typeName)
  local p = node and node.parent
  if p and type(p) ~= "table" then
    p = getTreeNodes()[p]
  end
  if not p and node and node.parentId then
    p = getTreeNodes()[node.parentId]
  end
  while p do
    if p.type == typeName then return p end
    p = p.parent
    if p and type(p) ~= "table" then
      p = getTreeNodes()[p]
    end
  end
  return nil
end

local function copyProps(props)
  local out = {}
  for k, v in pairs(props or {}) do out[k] = v end
  return out
end

--- Recursively shift node.computed.x/y for a node and all descendants.
local function shiftComputed(node, dx, dy)
  if not node or not node.computed then return end
  node.computed.x = node.computed.x + dx
  node.computed.y = node.computed.y + dy
  if node.children then
    for _, child in ipairs(node.children) do
      shiftComputed(child, dx, dy)
    end
  end
end

--- Get center position of a node from its computed layout.
local function getNodeCenter(node)
  if not node or not node.computed then return 0, 0 end
  local c = node.computed
  return c.x + c.w * 0.5, c.y + c.h * 0.5
end

--- Get width/height of a node from computed layout.
local function getNodeSize(node)
  if not node or not node.computed then return 32, 32 end
  return node.computed.w, node.computed.h
end

local function clearBodyAlias(nodeId)
  local alias = bodyAliasByNode[nodeId]
  if alias and bodyAliasMap[alias] == nodeId then
    bodyAliasMap[alias] = nil
  end
  bodyAliasByNode[nodeId] = nil
end

local function setBodyAlias(nodeId, props)
  local alias = props and (props.bodyId or props.id)
  if alias == nil then
    clearBodyAlias(nodeId)
    return
  end

  alias = tostring(alias)
  local prevAlias = bodyAliasByNode[nodeId]
  if prevAlias and prevAlias ~= alias and bodyAliasMap[prevAlias] == nodeId then
    bodyAliasMap[prevAlias] = nil
  end

  bodyAliasByNode[nodeId] = alias
  bodyAliasMap[alias] = nodeId
end

--- Resolve a body reference from either:
--- - internal node ID (number/string)
--- - explicit RigidBody alias (bodyId/id)
local function resolveBodyRef(ref)
  if ref == nil then return nil end

  local body = bodyObjects[ref]
  if body then return body end

  local asNumber = tonumber(ref)
  if asNumber then
    body = bodyObjects[asNumber]
    if body then return body end
  end

  local aliasNodeId = bodyAliasMap[tostring(ref)]
  if aliasNodeId then
    return bodyObjects[aliasNodeId]
  end

  return nil
end

-- ============================================================================
-- PhysicsWorld
-- ============================================================================

Capabilities.register("PhysicsWorld", {
  visual = true,
  hittable = false,

  schema = {
    gravity   = { type = "array",  default = {0, 980}, desc = "Gravity vector [x, y] in pixels/sec²" },
    debug     = { type = "bool",   default = false, desc = "Draw debug wireframes" },
    timeScale = { type = "number", default = 1, desc = "Physics time multiplier" },
    sleeping  = { type = "bool",   default = true, desc = "Allow bodies to sleep" },
  },

  events = { "onCollide", "onCollideEnd" },

  create = function(nodeId, props)
    plog("PhysicsWorld.create id=%s gravity=%s debug=%s", tostring(nodeId), tostring(props.gravity and table.concat(props.gravity, ",")), tostring(props.debug))
    local gx = (props.gravity and props.gravity[1]) or 0
    local gy = (props.gravity and props.gravity[2]) or 980
    local sleeping = props.sleeping ~= false

    local world = love.physics.newWorld(gx, gy, sleeping)
    plog("PhysicsWorld.create id=%s world=%s gx=%s gy=%s", tostring(nodeId), tostring(world), tostring(gx), tostring(gy))

    local state = {
      world = world,
      bodies = {},       -- bodyNodeId -> true
      contacts = {},     -- for collision events
      pushEvent = nil,   -- set each tick
      screenX = 0,       -- actual screen position (set during render)
      screenY = 0,
    }

    local function pushCollisionEvent(handler, targetId, bodyAId, bodyBId, nx, ny)
      if not targetId or not state.pushEvent then return end
      state.pushEvent({
        type = "capability",
        payload = {
          targetId = targetId,
          handler = handler,
          bodyA = bodyAId,
          bodyB = bodyBId,
          normalX = nx,
          normalY = ny,
        },
      })
    end

    -- Collision callbacks
    world:setCallbacks(
      -- beginContact
      function(a, b, contact)
        local bodyA = a:getBody()
        local bodyB = b:getBody()
        local idA = bodyA:getUserData()
        local idB = bodyB:getUserData()
        local fixtureIdA = a:getUserData()
        local fixtureIdB = b:getUserData()
        if idA and idB and state.pushEvent then
          local nx, ny = contact:getNormal()
          pushCollisionEvent("onCollide", idA, idA, idB, nx, ny)
          pushCollisionEvent("onCollide", idB, idB, idA, -nx, -ny)
          -- Also emit to fixture node IDs so Sensor/Collider handlers can fire.
          if fixtureIdA and fixtureIdA ~= idA then
            pushCollisionEvent("onCollide", fixtureIdA, idA, idB, nx, ny)
          end
          if fixtureIdB and fixtureIdB ~= idB then
            pushCollisionEvent("onCollide", fixtureIdB, idB, idA, -nx, -ny)
          end
        end
      end,
      -- endContact
      function(a, b, contact)
        local bodyA = a:getBody()
        local bodyB = b:getBody()
        local idA = bodyA:getUserData()
        local idB = bodyB:getUserData()
        local fixtureIdA = a:getUserData()
        local fixtureIdB = b:getUserData()
        if idA and idB and state.pushEvent then
          pushCollisionEvent("onCollideEnd", idA, idA, idB, nil, nil)
          pushCollisionEvent("onCollideEnd", idB, idB, idA, nil, nil)
          if fixtureIdA and fixtureIdA ~= idA then
            pushCollisionEvent("onCollideEnd", fixtureIdA, idA, idB, nil, nil)
          end
          if fixtureIdB and fixtureIdB ~= idB then
            pushCollisionEvent("onCollideEnd", fixtureIdB, idB, idA, nil, nil)
          end
        end
      end,
      nil, nil -- preSolve, postSolve
    )

    worlds[nodeId] = state
    plog("PhysicsWorld.create id=%s DONE — world stored", tostring(nodeId))
    return state
  end,

  update = function(nodeId, props, prev, state)
    if not state.world then return end
    -- Update gravity
    if props.gravity then
      state.world:setGravity(props.gravity[1] or 0, props.gravity[2] or 980)
    end
    -- Update sleeping
    if props.sleeping ~= nil then
      state.world:setSleepingAllowed(props.sleeping ~= false)
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not state.world then
      plog("PhysicsWorld.tick id=%s — NO WORLD, skipping", tostring(nodeId))
      return
    end
    state.pushEvent = pushEvent

    -- Step the physics world
    local timeScale = props.timeScale or 1
    state.world:update(dt * timeScale)

    -- Log body count once
    if not state._tickLogged then
      state._tickLogged = true
      local bodyCount = 0
      for _ in pairs(state.bodies) do bodyCount = bodyCount + 1 end
      plog("PhysicsWorld.tick id=%s FIRST TICK — %d bodies registered, dt=%.4f timeScale=%s", tostring(nodeId), bodyCount, dt, tostring(timeScale))
    end

    -- Periodic body state log (every ~120 frames)
    state._tickCount = (state._tickCount or 0) + 1
    if state._tickCount % 120 == 1 then
      local bodyCount = 0
      for bodyNodeId in pairs(state.bodies) do
        bodyCount = bodyCount + 1
        local body = bodyObjects[bodyNodeId]
        local node = getTreeNodes()[bodyNodeId]
        if body and not body:isDestroyed() then
          local bx, by = body:getPosition()
          local vx, vy = body:getLinearVelocity()
          local hasOrig = bodyOrigins[bodyNodeId] and "yes" or "NO"
          local hasComputed = (node and node.computed) and "yes" or "NO"
          plog("tick#%d body=%s pos=(%.1f,%.1f) vel=(%.1f,%.1f) type=%s orig=%s computed=%s",
            state._tickCount, tostring(bodyNodeId), bx, by, vx, vy, body:getType(), hasOrig, hasComputed)
        else
          plog("tick#%d body=%s MISSING/DESTROYED bodyObj=%s", state._tickCount, tostring(bodyNodeId), tostring(body))
        end
      end
      plog("tick#%d world=%s totalBodies=%d", state._tickCount, tostring(nodeId), bodyCount)
    end

    -- Update positions for all bodies in this world
    -- Box2D body positions are in world-local coords (origin = PhysicsWorld top-left).
    -- Convert to absolute screen coords using the PhysicsWorld's computed position.
    local worldNode = getTreeNodes()[nodeId]
    local worldX = (worldNode and worldNode.computed) and worldNode.computed.x or 0
    local worldY = (worldNode and worldNode.computed) and worldNode.computed.y or 0

    for bodyNodeId in pairs(state.bodies) do
      local body = bodyObjects[bodyNodeId]
      local node = getTreeNodes()[bodyNodeId]
      if body and node and node.computed and not body:isDestroyed() then
        local bx, by = body:getPosition()
        local nw = node.computed.w
        local nh = node.computed.h

        -- Set style.left/top so the layout engine positions bodies correctly
        -- (avoids flicker from layout resetting computed positions each frame)
        local leftVal = bx - nw * 0.5
        local topVal = by - nh * 0.5
        if not node.style then node.style = {} end
        node.style.left = leftVal
        node.style.top = topVal

        -- Also update computed directly for immediate rendering this frame
        local targetX = worldX + leftVal
        local targetY = worldY + topVal
        local curDx = targetX - node.computed.x
        local curDy = targetY - node.computed.y
        if math.abs(curDx) > 0.01 or math.abs(curDy) > 0.01 then
          shiftComputed(node, curDx, curDy)
        end

        -- One-time position comparison log
        if not node._posLogged then
          node._posLogged = true
          plog("POS-COMPARE body=%s b2d=(%.1f,%.1f) nodeSize=%dx%d target=(%.1f,%.1f) actual=(%.1f,%.1f) world=(%.1f,%.1f) wireCenter=(%.1f,%.1f)",
            tostring(bodyNodeId), bx, by, nw, nh,
            targetX, targetY,
            node.computed.x, node.computed.y,
            worldX, worldY,
            worldX + bx, worldY + by)
        end

        -- Track in/out of world bounds
        local worldW = (worldNode and worldNode.computed) and worldNode.computed.w or 0
        local worldH = (worldNode and worldNode.computed) and worldNode.computed.h or 0
        local inBounds = bx >= 0 and bx <= worldW and by >= 0 and by <= worldH
        if not node._wasInBounds and inBounds then
          plog("ENTERED bounds: body=%s pos=(%.1f,%.1f) world=%s bounds=%dx%d", tostring(bodyNodeId), bx, by, tostring(nodeId), worldW, worldH)
          node._wasInBounds = true
        elseif node._wasInBounds and not inBounds then
          plog("LEFT bounds: body=%s pos=(%.1f,%.1f) world=%s bounds=%dx%d", tostring(bodyNodeId), bx, by, tostring(nodeId), worldW, worldH)
          node._wasInBounds = false
        elseif node._wasInBounds == nil then
          node._wasInBounds = inBounds
          plog("INIT bounds: body=%s pos=(%.1f,%.1f) %s world=%s bounds=%dx%d", tostring(bodyNodeId), bx, by, inBounds and "IN" or "OUT", tostring(nodeId), worldW, worldH)
        end

        -- Apply rotation via style.transform
        local angle = body:getAngle()
        if math.abs(angle) > 0.001 then
          if not node.style then node.style = {} end
          if not node.style.transform then node.style.transform = {} end
          node.style.transform.rotate = math.deg(angle)
        elseif node.style and node.style.transform then
          node.style.transform.rotate = nil
        end
      end
    end
  end,

  render = function(node, c, effectiveOpacity)
    if not node._physRenderLogged then
      node._physRenderLogged = true
      plog("PhysicsWorld.render id=%s debug=%s", tostring(node.id), tostring(node.props and node.props.debug))
      plog("  render 'c' param: x=%s y=%s w=%s h=%s", tostring(c.x), tostring(c.y), tostring(c.w), tostring(c.h))
      if node.computed then
        plog("  node.computed:    x=%s y=%s w=%s h=%s", tostring(node.computed.x), tostring(node.computed.y), tostring(node.computed.w), tostring(node.computed.h))
      else
        plog("  node.computed: NIL")
      end
      -- Check parent node (node.parent is the parent node object, not an ID)
      local parentNode = node.parent
      if parentNode and parentNode.computed then
        plog("  parent(id=%s).computed: x=%s y=%s w=%s h=%s type=%s", tostring(parentNode.id), tostring(parentNode.computed.x), tostring(parentNode.computed.y), tostring(parentNode.computed.w), tostring(parentNode.computed.h), tostring(parentNode.type))
      else
        plog("  parent: %s (computed=%s)", tostring(parentNode and parentNode.id or "NIL"), tostring(parentNode and parentNode.computed and "yes" or "no"))
      end
      -- Check style
      if node.style then
        plog("  node.style: w=%s h=%s pos=%s", tostring(node.style.width), tostring(node.style.height), tostring(node.style.position))
      end
    end
    -- Always update screen position (needed for MouseJoint coord conversion)
    local state = worlds[node.id]
    if state then
      local sx, sy = love.graphics.transformPoint(c.x, c.y)
      state.screenX = sx
      state.screenY = sy
    end

    if not node or not node.props or not node.props.debug then return end
    if not state or not state.world then return end

    local gx, gy = c.x, c.y
    local gw, gh = c.w, c.h

    -- Draw debug background so we can see the full world bounds
    love.graphics.setColor(0.2, 0, 0, 0.9 * effectiveOpacity)
    love.graphics.rectangle("fill", gx, gy, gw, gh)

    -- Draw blue grid
    love.graphics.setColor(0.15, 0.25, 0.8, 0.3 * effectiveOpacity)
    love.graphics.setLineWidth(1)
    -- Vertical lines every 40px
    for lx = 0, gw, 40 do
      love.graphics.line(gx + lx, gy, gx + lx, gy + gh)
    end
    -- Horizontal lines every 40px
    for ly = 0, gh, 40 do
      love.graphics.line(gx, gy + ly, gx + gw, gy + ly)
    end
    -- Border (bright blue)
    love.graphics.setColor(0.2, 0.4, 1.0, 0.8 * effectiveOpacity)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", gx + 1, gy + 1, gw - 2, gh - 2)
    -- Center crosshair
    love.graphics.setColor(0.3, 0.5, 1.0, 0.5 * effectiveOpacity)
    love.graphics.line(gx + gw * 0.5, gy, gx + gw * 0.5, gy + gh)
    love.graphics.line(gx, gy + gh * 0.5, gx + gw, gy + gh * 0.5)

    -- Translate so Box2D world-local coords map to screen coords
    love.graphics.push()
    love.graphics.translate(gx, gy)

    love.graphics.setColor(0, 1, 0, 0.6 * effectiveOpacity)
    love.graphics.setLineWidth(1)

    -- Draw all fixtures in this world
    local bodies = state.world:getBodies()
    for _, body in ipairs(bodies) do
      local fixtures = body:getFixtures()
      for _, fixture in ipairs(fixtures) do
        local shape = fixture:getShape()
        local shapeType = shape:getType()

        if fixture:isSensor() then
          love.graphics.setColor(1, 1, 0, 0.4 * effectiveOpacity)
        else
          love.graphics.setColor(0, 1, 0, 0.6 * effectiveOpacity)
        end

        if shapeType == "circle" then
          local cx, cy = body:getWorldPoint(shape:getPoint())
          local r = shape:getRadius()
          love.graphics.circle("line", cx, cy, r)
          -- Draw direction indicator
          local angle = body:getAngle()
          love.graphics.line(cx, cy, cx + r * math.cos(angle), cy + r * math.sin(angle))
        elseif shapeType == "polygon" then
          love.graphics.polygon("line", body:getWorldPoints(shape:getPoints()))
        elseif shapeType == "edge" then
          love.graphics.line(body:getWorldPoints(shape:getPoints()))
        elseif shapeType == "chain" then
          love.graphics.line(body:getWorldPoints(shape:getPoints()))
        end
      end
    end

    -- Draw joints
    love.graphics.setColor(0, 0.7, 1, 0.6 * effectiveOpacity)
    local joints = state.world:getJoints()
    for _, joint in ipairs(joints) do
      local x1, y1, x2, y2 = joint:getAnchors()
      if x1 and y1 and x2 and y2 then
        love.graphics.line(x1, y1, x2, y2)
        love.graphics.circle("fill", x1, y1, 3)
        love.graphics.circle("fill", x2, y2, 3)
      end
    end

    love.graphics.pop()
    love.graphics.setColor(1, 1, 1, 1)
  end,

  destroy = function(nodeId, state)
    if state.world and not state.world:isDestroyed() then
      state.world:destroy()
    end
    worlds[nodeId] = nil
  end,
})

-- ============================================================================
-- RigidBody
-- ============================================================================

Capabilities.register("RigidBody", {
  visual = true,   -- must be visual so children (Box) get painted
  hittable = false,

  schema = {
    id             = { type = "string", desc = "Stable alias for this body (for joints/hooks)" },
    bodyId         = { type = "string", desc = "Stable alias for this body (same as id)" },
    bodyType       = { type = "string", default = "dynamic", desc = "Body type: dynamic, static, kinematic" },
    x              = { type = "number", desc = "Initial X position override (pixels)" },
    y              = { type = "number", desc = "Initial Y position override (pixels)" },
    angle          = { type = "number", default = 0, desc = "Initial angle (degrees)" },
    linearDamping  = { type = "number", default = 0, desc = "Linear velocity damping" },
    angularDamping = { type = "number", default = 0, desc = "Angular velocity damping" },
    fixedRotation  = { type = "bool",   default = false, desc = "Prevent rotation" },
    bullet         = { type = "bool",   default = false, desc = "Enable CCD for fast-moving bodies" },
    gravityScale   = { type = "number", default = 1, desc = "Gravity multiplier for this body" },
  },

  events = { "onCollide", "onCollideEnd" },

  create = function(nodeId, props)
    plog("RigidBody.create id=%s bodyType=%s x=%s y=%s bodyId=%s", tostring(nodeId), tostring(props.bodyType), tostring(props.x), tostring(props.y), tostring(props.bodyId or props.id))
    local node = getTreeNodes()[nodeId]
    if not node then
      plog("RigidBody.create id=%s — NODE NOT FOUND in tree", tostring(nodeId))
      return {}
    end
    plog("RigidBody.create id=%s — node found, type=%s, parent=%s parentType=%s", tostring(nodeId), tostring(node.type), tostring(node.parent and node.parent.id), tostring(node.parent and node.parent.type))

    -- Find parent PhysicsWorld
    local worldNode = findAncestor(node, "PhysicsWorld")
    if not worldNode then
      if not rigidMissingWorldLogged[nodeId] then
        rigidMissingWorldLogged[nodeId] = true
        -- Log the full ancestor chain for debugging
        local chain = {}
        local p = node.parent
        while p do
          chain[#chain + 1] = string.format("id=%s type=%s", tostring(p.id), tostring(p.type))
          p = p.parent
        end
        plog("RigidBody %s has no PhysicsWorld ancestor. Chain: %s", tostring(nodeId), #chain > 0 and table.concat(chain, " -> ") or "(empty — no parent)")
      end
      return {}
    end
    rigidMissingWorldLogged[nodeId] = nil

    local worldState = worlds[worldNode.id]
    if not worldState or not worldState.world then
      plog("RigidBody.create id=%s — found worldNode id=%s but worlds[%s] = %s", tostring(nodeId), tostring(worldNode.id), tostring(worldNode.id), tostring(worldState))
      return {}
    end

    -- Get position from props or from layout
    local cx, cy = getNodeCenter(node)
    if props.x then cx = props.x end
    if props.y then cy = props.y end

    -- Body type
    local bodyType = props.bodyType or "dynamic"

    plog("RigidBody.create id=%s — creating body at (%s, %s) type=%s in world=%s", tostring(nodeId), tostring(cx), tostring(cy), bodyType, tostring(worldNode.id))

    -- Create the body
    local body = love.physics.newBody(worldState.world, cx, cy, bodyType)
    body:setUserData(nodeId)

    -- Apply properties
    if props.angle then body:setAngle(math.rad(props.angle)) end
    if props.linearDamping then body:setLinearDamping(props.linearDamping) end
    if props.angularDamping then body:setAngularDamping(props.angularDamping) end
    if props.fixedRotation then body:setFixedRotation(props.fixedRotation) end
    if props.bullet then body:setBullet(props.bullet) end
    if props.gravityScale then body:setGravityScale(props.gravityScale) end

    -- Store
    bodyObjects[nodeId] = body
    bodyWorldMap[nodeId] = worldNode.id
    worldState.bodies[nodeId] = true

    -- Store layout origin for position delta computation
    if node.computed then
      bodyOrigins[nodeId] = {
        layoutX = node.computed.x,
        layoutY = node.computed.y,
        cx = cx,
        cy = cy,
      }
    end
    setBodyAlias(nodeId, props)

    plog("RigidBody.create id=%s DONE — body created, alias=%s", tostring(nodeId), tostring(props.bodyId or props.id or "none"))
    return { body = body, worldNodeId = worldNode.id }
  end,

  update = function(nodeId, props, prev, state)
    local body = bodyObjects[nodeId]
    if not body or body:isDestroyed() then
      -- Late mount ordering: body may be created before APPEND links are ready.
      local cap = Capabilities.getDefinition("RigidBody")
      if cap and cap.create then
        local newState = cap.create(nodeId, props)
        if newState.body then
          state.body = newState.body
          state.worldNodeId = newState.worldNodeId
          body = newState.body
        end
      end
      if not body or body:isDestroyed() then return end
    end

    if props.linearDamping and props.linearDamping ~= prev.linearDamping then
      body:setLinearDamping(props.linearDamping)
    end
    if props.angularDamping and props.angularDamping ~= prev.angularDamping then
      body:setAngularDamping(props.angularDamping)
    end
    if props.fixedRotation ~= nil and props.fixedRotation ~= prev.fixedRotation then
      body:setFixedRotation(props.fixedRotation)
    end
    if props.bullet ~= nil and props.bullet ~= prev.bullet then
      body:setBullet(props.bullet)
    end
    if props.gravityScale and props.gravityScale ~= prev.gravityScale then
      body:setGravityScale(props.gravityScale)
    end
    if props.bodyType and props.bodyType ~= prev.bodyType then
      body:setType(props.bodyType)
    end
    if props.id ~= prev.id or props.bodyId ~= prev.bodyId then
      setBodyAlias(nodeId, props)
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if bodyObjects[nodeId] and not bodyObjects[nodeId]:isDestroyed() then return end
    local cap = Capabilities.getDefinition("RigidBody")
    if cap and cap.create then
      local newState = cap.create(nodeId, props)
      if newState.body then
        state.body = newState.body
        state.worldNodeId = newState.worldNodeId
      end
    end
  end,

  destroy = function(nodeId, state)
    local body = bodyObjects[nodeId]
    if body and not body:isDestroyed() then
      body:destroy()
    end
    bodyObjects[nodeId] = nil
    bodyOrigins[nodeId] = nil

    -- Remove from world tracking
    local worldId = bodyWorldMap[nodeId]
    if worldId and worlds[worldId] then
      worlds[worldId].bodies[nodeId] = nil
    end
    bodyWorldMap[nodeId] = nil
    clearBodyAlias(nodeId)
    rigidMissingWorldLogged[nodeId] = nil
  end,
})

-- ============================================================================
-- Collider
-- ============================================================================

Capabilities.register("Collider", {
  visual = false,

  schema = {
    shape       = { type = "string", default = "rectangle", desc = "Shape: rectangle, circle, polygon, edge, chain" },
    width       = { type = "number", desc = "Rectangle width (pixels)" },
    height      = { type = "number", desc = "Rectangle height (pixels)" },
    radius      = { type = "number", desc = "Circle radius (pixels)" },
    points      = { type = "array",  desc = "Polygon/chain vertices [x1,y1,x2,y2,...]" },
    density     = { type = "number", default = 1, desc = "Fixture density (affects mass)" },
    friction    = { type = "number", default = 0.3, desc = "Surface friction (0-1)" },
    restitution = { type = "number", default = 0.1, desc = "Bounciness (0-1)" },
    sensor      = { type = "bool",   default = false, desc = "Trigger only, no physical response" },
  },

  create = function(nodeId, props)
    plog("Collider.create id=%s shape=%s w=%s h=%s r=%s", tostring(nodeId), tostring(props.shape), tostring(props.width), tostring(props.height), tostring(props.radius))
    local node = getTreeNodes()[nodeId]
    if not node then
      plog("Collider.create id=%s — NODE NOT FOUND", tostring(nodeId))
      return {}
    end

    -- Find parent RigidBody
    local bodyNode = findAncestor(node, "RigidBody")
    if not bodyNode then
      if not colliderMissingBodyLogged[nodeId] then
        colliderMissingBodyLogged[nodeId] = true
        plog("Collider %s has no RigidBody ancestor (parent=%s parentType=%s)", tostring(nodeId), tostring(node.parent and node.parent.id), tostring(node.parent and node.parent.type))
      end
      return {}
    end
    colliderMissingBodyLogged[nodeId] = nil

    local body = bodyObjects[bodyNode.id]
    if not body or body:isDestroyed() then
      plog("Collider.create id=%s — found bodyNode id=%s but no body object (bodyObjects[%s]=%s)", tostring(nodeId), tostring(bodyNode.id), tostring(bodyNode.id), tostring(bodyObjects[bodyNode.id]))
      return {}
    end

    -- Create shape
    local shape
    local shapeType = props.shape or "rectangle"

    if shapeType == "circle" then
      local r = props.radius or 16
      shape = love.physics.newCircleShape(r)
    elseif shapeType == "rectangle" then
      -- Auto-size from sibling visual node if width/height not specified
      local w = props.width
      local h = props.height
      if not w or not h then
        local bw, bh = getNodeSize(bodyNode)
        w = w or bw
        h = h or bh
      end
      shape = love.physics.newRectangleShape(w, h)
    elseif shapeType == "polygon" then
      if props.points and #props.points >= 6 then
        shape = love.physics.newPolygonShape(unpack(props.points))
      else
        shape = love.physics.newRectangleShape(32, 32)
      end
    elseif shapeType == "edge" then
      if props.points and #props.points >= 4 then
        shape = love.physics.newEdgeShape(unpack(props.points))
      end
    elseif shapeType == "chain" then
      if props.points and #props.points >= 4 then
        local loop = props.loop ~= false
        shape = love.physics.newChainShape(loop, unpack(props.points))
      end
    end

    if not shape then
      plog("Collider.create id=%s — failed to create shape (shapeType=%s)", tostring(nodeId), tostring(shapeType))
      return {}
    end

    -- Create fixture
    local fixture = love.physics.newFixture(body, shape, props.density or 1)
    fixture:setFriction(props.friction or 0.3)
    fixture:setRestitution(props.restitution or 0.1)
    fixture:setSensor(props.sensor == true)
    fixture:setUserData(nodeId)

    fixtureObjects[nodeId] = fixture
    plog("Collider.create id=%s DONE — fixture created on body %s (shape=%s)", tostring(nodeId), tostring(bodyNode.id), tostring(shapeType))
    return { fixture = fixture, bodyNodeId = bodyNode.id }
  end,

  update = function(nodeId, props, prev, state)
    local fixture = fixtureObjects[nodeId]
    if not fixture or fixture:isDestroyed() then
      local cap = Capabilities.getDefinition("Collider")
      if cap and cap.create then
        local newState = cap.create(nodeId, props)
        if newState.fixture then
          state.fixture = newState.fixture
          fixture = newState.fixture
        end
      end
      if not fixture or fixture:isDestroyed() then return end
    end

    if props.friction and props.friction ~= prev.friction then
      fixture:setFriction(props.friction)
    end
    if props.restitution and props.restitution ~= prev.restitution then
      fixture:setRestitution(props.restitution)
    end
    if props.sensor ~= nil and props.sensor ~= prev.sensor then
      fixture:setSensor(props.sensor == true)
    end
    if props.density and props.density ~= prev.density then
      fixture:setDensity(props.density)
      fixture:getBody():resetMassData()
    end

    -- If shape props changed, need to recreate fixture
    local shapeChanged = props.shape ~= prev.shape
      or props.width ~= prev.width
      or props.height ~= prev.height
      or props.radius ~= prev.radius
    -- points array comparison is shallow — skip for now
    if shapeChanged then
      -- Destroy old fixture and recreate
      local bodyNode = findAncestor(getTreeNodes()[nodeId], "RigidBody")
      if bodyNode and bodyObjects[bodyNode.id] then
        fixture:destroy()
        fixtureObjects[nodeId] = nil
        -- Re-run create logic
        local cap = Capabilities.getDefinition("Collider")
        if cap and cap.create then
          local newState = cap.create(nodeId, props)
          if newState.fixture then
            state.fixture = newState.fixture
          end
        end
      end
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local fixture = fixtureObjects[nodeId]
    if fixture and not fixture:isDestroyed() then return end
    local cap = Capabilities.getDefinition("Collider")
    if cap and cap.create then
      local newState = cap.create(nodeId, props)
      if newState.fixture then
        state.fixture = newState.fixture
      end
    end
  end,

  destroy = function(nodeId, state)
    local fixture = fixtureObjects[nodeId]
    if fixture and not fixture:isDestroyed() then
      fixture:destroy()
    end
    fixtureObjects[nodeId] = nil
    colliderMissingBodyLogged[nodeId] = nil
  end,
})

-- ============================================================================
-- Sensor (convenience — Collider with sensor=true forced)
-- ============================================================================

Capabilities.register("Sensor", {
  visual = false,

  schema = {
    shape   = { type = "string", default = "rectangle", desc = "Shape: rectangle, circle, polygon" },
    width   = { type = "number", desc = "Rectangle width" },
    height  = { type = "number", desc = "Rectangle height" },
    radius  = { type = "number", desc = "Circle radius" },
    points  = { type = "array",  desc = "Polygon vertices" },
  },

  events = { "onCollide", "onCollideEnd" },

  create = function(nodeId, props)
    -- Delegate to Collider with sensor=true
    local sensorProps = copyProps(props)
    sensorProps.sensor = true
    sensorProps.density = 0
    local cap = Capabilities.getDefinition("Collider")
    if cap and cap.create then
      return cap.create(nodeId, sensorProps)
    end
    return {}
  end,

  update = function(nodeId, props, prev, state)
    local sensorProps = copyProps(props)
    sensorProps.sensor = true
    sensorProps.density = 0
    local prevSensorProps = copyProps(prev)
    prevSensorProps.sensor = true
    prevSensorProps.density = 0
    local cap = Capabilities.getDefinition("Collider")
    if cap and cap.update then
      cap.update(nodeId, sensorProps, prevSensorProps, state)
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local fixture = fixtureObjects[nodeId]
    if fixture and not fixture:isDestroyed() then return end
    local sensorProps = copyProps(props)
    sensorProps.sensor = true
    sensorProps.density = 0
    local cap = Capabilities.getDefinition("Collider")
    if cap and cap.create then
      local newState = cap.create(nodeId, sensorProps)
      if newState.fixture then
        state.fixture = newState.fixture
      end
    end
  end,

  destroy = function(nodeId, state)
    local cap = Capabilities.getDefinition("Collider")
    if cap and cap.destroy then
      cap.destroy(nodeId, state)
    end
  end,
})

-- ============================================================================
-- Joints
-- ============================================================================

--- Helper: find body objects for bodyA/bodyB props (node IDs).
local function resolveJointBodies(nodeId, props)
  plog("resolveJointBodies id=%s bodyA=%s bodyB=%s", tostring(nodeId), tostring(props.bodyA), tostring(props.bodyB))
  local bodyA = resolveBodyRef(props.bodyA)
  local bodyB = resolveBodyRef(props.bodyB)
  plog("resolveJointBodies id=%s resolved bodyA=%s bodyB=%s", tostring(nodeId), tostring(bodyA), tostring(bodyB))
  if not bodyA or bodyA:isDestroyed() then
    if not jointMissingBodyLogged[nodeId] then
      jointMissingBodyLogged[nodeId] = true
      -- Dump alias map for debugging
      local aliases = {}
      for k, v in pairs(bodyAliasMap) do aliases[#aliases+1] = k .. "=" .. tostring(v) end
      plog("Joint %s: bodyA not found ref=%s. Aliases: %s", tostring(nodeId), tostring(props.bodyA), table.concat(aliases, ", "))
      io.write("[physics] Joint " .. tostring(nodeId) .. ": bodyA not found (" .. tostring(props.bodyA) .. ")\n")
      io.flush()
    end
    return nil, nil
  end
  if not bodyB or bodyB:isDestroyed() then
    if not jointMissingBodyLogged[nodeId] then
      jointMissingBodyLogged[nodeId] = true
      io.write("[physics] Joint " .. tostring(nodeId) .. ": bodyB not found (" .. tostring(props.bodyB) .. ")\n")
      io.flush()
    end
    return nil, nil
  end
  jointMissingBodyLogged[nodeId] = nil
  return bodyA, bodyB
end

-- RevoluteJoint (hinge)
Capabilities.register("RevoluteJoint", {
  visual = false,
  schema = {
    bodyA       = { type = "string", desc = "Node ID of first body" },
    bodyB       = { type = "string", desc = "Node ID of second body" },
    anchorX     = { type = "number", desc = "Anchor X in world coords" },
    anchorY     = { type = "number", desc = "Anchor Y in world coords" },
    motorSpeed  = { type = "number", desc = "Motor speed (rad/s)" },
    maxTorque   = { type = "number", desc = "Max motor torque" },
    enableMotor = { type = "bool", default = false },
    lowerAngle  = { type = "number", desc = "Lower angle limit (degrees)" },
    upperAngle  = { type = "number", desc = "Upper angle limit (degrees)" },
    enableLimit = { type = "bool", default = false },
  },

  create = function(nodeId, props)
    local bodyA, bodyB = resolveJointBodies(nodeId, props)
    if not bodyA or not bodyB then return {} end

    local ax = props.anchorX or bodyA:getX()
    local ay = props.anchorY or bodyA:getY()

    local joint = love.physics.newRevoluteJoint(bodyA, bodyB, ax, ay, props.collideConnected or false)

    if props.enableMotor then
      joint:setMotorEnabled(true)
      joint:setMotorSpeed(props.motorSpeed or 0)
      joint:setMaxMotorTorque(props.maxTorque or 0)
    end
    if props.enableLimit then
      joint:setLimitsEnabled(true)
      joint:setLimits(math.rad(props.lowerAngle or 0), math.rad(props.upperAngle or 0))
    end

    jointObjects[nodeId] = joint
    return { joint = joint }
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then return end
    local cap = Capabilities.getDefinition("RevoluteJoint")
    if cap and cap.create then
      local newState = cap.create(nodeId, props)
      if newState.joint then
        state.joint = newState.joint
      end
    end
  end,

  destroy = function(nodeId, state)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then joint:destroy() end
    jointObjects[nodeId] = nil
    jointMissingBodyLogged[nodeId] = nil
  end,
})

-- DistanceJoint (spring/bungee)
Capabilities.register("DistanceJoint", {
  visual = false,
  schema = {
    bodyA    = { type = "string", desc = "Node ID of first body" },
    bodyB    = { type = "string", desc = "Node ID of second body" },
    length   = { type = "number", desc = "Rest length (pixels). Default: current distance" },
    stiffness = { type = "number", default = 0, desc = "Spring stiffness (Hz)" },
    damping  = { type = "number", default = 0, desc = "Damping ratio" },
  },

  create = function(nodeId, props)
    local bodyA, bodyB = resolveJointBodies(nodeId, props)
    if not bodyA or not bodyB then return {} end

    local x1, y1 = bodyA:getPosition()
    local x2, y2 = bodyB:getPosition()

    local joint = love.physics.newDistanceJoint(bodyA, bodyB, x1, y1, x2, y2, props.collideConnected or false)

    if props.length then joint:setLength(props.length) end
    if props.stiffness and joint.setFrequency then joint:setFrequency(props.stiffness) end
    if props.damping and joint.setDampingRatio then joint:setDampingRatio(props.damping) end

    jointObjects[nodeId] = joint
    return { joint = joint }
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then return end
    local cap = Capabilities.getDefinition("DistanceJoint")
    if cap and cap.create then
      local newState = cap.create(nodeId, props)
      if newState.joint then
        state.joint = newState.joint
      end
    end
  end,

  destroy = function(nodeId, state)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then joint:destroy() end
    jointObjects[nodeId] = nil
    jointMissingBodyLogged[nodeId] = nil
  end,
})

-- PrismaticJoint (slider/piston)
Capabilities.register("PrismaticJoint", {
  visual = false,
  schema = {
    bodyA    = { type = "string", desc = "Node ID of first body" },
    bodyB    = { type = "string", desc = "Node ID of second body" },
    axisX    = { type = "number", default = 1, desc = "Slide axis X" },
    axisY    = { type = "number", default = 0, desc = "Slide axis Y" },
    enableLimit = { type = "bool", default = false },
    lowerTranslation = { type = "number", default = 0 },
    upperTranslation = { type = "number", default = 0 },
    enableMotor = { type = "bool", default = false },
    motorSpeed  = { type = "number", default = 0 },
    maxForce    = { type = "number", default = 0 },
  },

  create = function(nodeId, props)
    local bodyA, bodyB = resolveJointBodies(nodeId, props)
    if not bodyA or not bodyB then return {} end

    local ax, ay = bodyA:getPosition()
    local joint = love.physics.newPrismaticJoint(
      bodyA, bodyB, ax, ay,
      props.axisX or 1, props.axisY or 0,
      props.collideConnected or false
    )

    if props.enableLimit then
      joint:setLimitsEnabled(true)
      joint:setLimits(props.lowerTranslation or 0, props.upperTranslation or 0)
    end
    if props.enableMotor then
      joint:setMotorEnabled(true)
      joint:setMotorSpeed(props.motorSpeed or 0)
      joint:setMaxMotorForce(props.maxForce or 0)
    end

    jointObjects[nodeId] = joint
    return { joint = joint }
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then return end
    local cap = Capabilities.getDefinition("PrismaticJoint")
    if cap and cap.create then
      local newState = cap.create(nodeId, props)
      if newState.joint then
        state.joint = newState.joint
      end
    end
  end,

  destroy = function(nodeId, state)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then joint:destroy() end
    jointObjects[nodeId] = nil
    jointMissingBodyLogged[nodeId] = nil
  end,
})

-- WeldJoint (glue)
Capabilities.register("WeldJoint", {
  visual = false,
  schema = {
    bodyA    = { type = "string", desc = "Node ID of first body" },
    bodyB    = { type = "string", desc = "Node ID of second body" },
    anchorX  = { type = "number", desc = "Anchor X" },
    anchorY  = { type = "number", desc = "Anchor Y" },
    stiffness = { type = "number", default = 0 },
    damping  = { type = "number", default = 0 },
  },

  create = function(nodeId, props)
    local bodyA, bodyB = resolveJointBodies(nodeId, props)
    if not bodyA or not bodyB then return {} end

    local ax = props.anchorX or bodyA:getX()
    local ay = props.anchorY or bodyA:getY()

    local joint = love.physics.newWeldJoint(bodyA, bodyB, ax, ay, props.collideConnected or false)
    if props.stiffness and joint.setFrequency then joint:setFrequency(props.stiffness) end
    if props.damping and joint.setDampingRatio then joint:setDampingRatio(props.damping) end

    jointObjects[nodeId] = joint
    return { joint = joint }
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then return end
    local cap = Capabilities.getDefinition("WeldJoint")
    if cap and cap.create then
      local newState = cap.create(nodeId, props)
      if newState.joint then
        state.joint = newState.joint
      end
    end
  end,

  destroy = function(nodeId, state)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then joint:destroy() end
    jointObjects[nodeId] = nil
    jointMissingBodyLogged[nodeId] = nil
  end,
})

-- RopeJoint (max distance)
Capabilities.register("RopeJoint", {
  visual = false,
  schema = {
    bodyA     = { type = "string", desc = "Node ID of first body" },
    bodyB     = { type = "string", desc = "Node ID of second body" },
    maxLength = { type = "number", desc = "Maximum rope length (pixels)" },
  },

  create = function(nodeId, props)
    local bodyA, bodyB = resolveJointBodies(nodeId, props)
    if not bodyA or not bodyB then return {} end

    local x1, y1 = bodyA:getPosition()
    local x2, y2 = bodyB:getPosition()

    local joint = love.physics.newRopeJoint(bodyA, bodyB, x1, y1, x2, y2, props.maxLength or 100, props.collideConnected or false)

    jointObjects[nodeId] = joint
    return { joint = joint }
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then return end
    local cap = Capabilities.getDefinition("RopeJoint")
    if cap and cap.create then
      local newState = cap.create(nodeId, props)
      if newState.joint then
        state.joint = newState.joint
      end
    end
  end,

  destroy = function(nodeId, state)
    local joint = jointObjects[nodeId]
    if joint and not joint:isDestroyed() then joint:destroy() end
    jointObjects[nodeId] = nil
    jointMissingBodyLogged[nodeId] = nil
  end,
})

-- MouseJoint (drag interaction)
Capabilities.register("MouseJoint", {
  visual = false,
  hittable = false,

  schema = {
    stiffness = { type = "number", default = 5, desc = "Spring frequency (Hz)" },
    damping   = { type = "number", default = 0.7, desc = "Damping ratio" },
    maxForce  = { type = "number", desc = "Max force (default: 1000 * body mass)" },
  },

  create = function(nodeId, props)
    return {
      joint = nil,
      targetBody = nil,
      worldNodeId = nil,
    }
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    if not love.mouse then return end

    local node = getTreeNodes()[nodeId]
    if not node then return end

    local worldNode = findAncestor(node, "PhysicsWorld")
    if not worldNode then return end
    local worldState = worlds[worldNode.id]
    if not worldState or not worldState.world then return end

    local smx, smy = love.mouse.getPosition()
    local pressed = love.mouse.isDown(1)

    -- Convert screen coords → Box2D world-local coords using render-captured screen position
    local mx = smx - worldState.screenX
    local my = smy - worldState.screenY

    -- Check if mouse is within world bounds
    local wc = worldNode.computed
    local worldW = wc and wc.w or 0
    local worldH = wc and wc.h or 0
    local inBounds = mx >= 0 and mx <= worldW and my >= 0 and my <= worldH

    if pressed and not state.joint and inBounds then
      -- Find body under mouse (only start drag inside world)
      worldState.world:queryBoundingBox(mx - 4, my - 4, mx + 4, my + 4, function(fixture)
        if fixture:getBody():getType() == "dynamic" then
          local body = fixture:getBody()
          local joint = love.physics.newMouseJoint(body, mx, my)
          local mass = body:getMass()
          joint:setMaxForce(props.maxForce or (1000 * mass))
          if joint.setFrequency then joint:setFrequency(props.stiffness or 5) end
          if joint.setDampingRatio then joint:setDampingRatio(props.damping or 0.7) end
          state.joint = joint
          state.targetBody = body
          return false  -- stop query
        end
        return true  -- continue query
      end)
    elseif pressed and state.joint and not state.joint:isDestroyed() then
      if inBounds then
        -- Update target position while inside bounds
        state.joint:setTarget(mx, my)
      else
        -- Mouse left bounds — release the joint
        if not state.joint:isDestroyed() then state.joint:destroy() end
        state.joint = nil
        state.targetBody = nil
      end
    elseif not pressed and state.joint then
      -- Release
      if not state.joint:isDestroyed() then state.joint:destroy() end
      state.joint = nil
      state.targetBody = nil
    end
  end,

  destroy = function(nodeId, state)
    if state.joint and not state.joint:isDestroyed() then state.joint:destroy() end
    state.joint = nil
  end,
})

-- ============================================================================
-- RPC handlers for force/impulse/torque from React hooks
-- ============================================================================

plog("=== all physics capabilities registered ===")

local Physics = {}

--- Get physics-specific RPC handlers.
function Physics.getHandlers()
  return {
    ["physics:applyForce"] = function(args)
      local body = resolveBodyRef(args.bodyId)
      if body and not body:isDestroyed() then
        body:applyForce(args.fx or 0, args.fy or 0)
      end
      return true
    end,

    ["physics:applyImpulse"] = function(args)
      local body = resolveBodyRef(args.bodyId)
      if body and not body:isDestroyed() then
        body:applyLinearImpulse(args.ix or 0, args.iy or 0)
      end
      return true
    end,

    ["physics:applyTorque"] = function(args)
      local body = resolveBodyRef(args.bodyId)
      if body and not body:isDestroyed() then
        body:applyTorque(args.torque or 0)
      end
      return true
    end,

    ["physics:setVelocity"] = function(args)
      local body = resolveBodyRef(args.bodyId)
      if body and not body:isDestroyed() then
        body:setLinearVelocity(args.vx or 0, args.vy or 0)
      end
      return true
    end,

    ["physics:getVelocity"] = function(args)
      local body = resolveBodyRef(args.bodyId)
      if body and not body:isDestroyed() then
        local vx, vy = body:getLinearVelocity()
        return { vx = vx, vy = vy }
      end
      return { vx = 0, vy = 0 }
    end,
  }
end

return Physics
