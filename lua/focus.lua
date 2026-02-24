--[[
  focus.lua -- Focus management for controller navigation and Lua-owned primitives

  Supports:
    - Input mode switching (mouse vs controller)
    - Auto-focusable detection (nodes with interactive handlers)
    - Spatial navigation (D-pad / left stick)
    - FocusGroup: scoped focus regions with per-controller routing
    - Restore last focus on mode switch
    - Per-joystick stick state for multi-controller
    - Scroll-into-view on focus change
    - Player-based ring colors (P1 blue, P2 red, P3 green, P4 yellow)
]]

local Log = require("lua.debug_log")

local Focus = {}

-- ============================================================================
-- Constants
-- ============================================================================

local STICK_DEADZONE = 0.3
local REPEAT_INITIAL = 0.4      -- seconds before first repeat
local REPEAT_RATE = 0.15        -- seconds between repeats

local PLAYER_COLORS = {
  { 0.3, 0.6, 1.0, 0.9 },     -- P1: blue
  { 1.0, 0.3, 0.3, 0.9 },     -- P2: red
  { 0.3, 1.0, 0.5, 0.9 },     -- P3: green
  { 1.0, 0.8, 0.2, 0.9 },     -- P4: yellow
}

-- ============================================================================
-- State
-- ============================================================================

local inputMode = "mouse"       -- "mouse" | "controller"
local treeModule = nil          -- injected via Focus.init()
local pushEventFn = nil         -- injected via Focus.init() for focus/blur events

-- Ring animation speed (exponential smoothing factor per second)
local RING_SMOOTHING = 0.0001  -- lower = faster (reaches target sooner)

-- Default group: the implicit global group (no FocusGroup wrapper)
local defaultGroup = {
  focusedNode = nil,
  lastFocused = nil,
  focusableNodes = {},
  controller = nil,             -- nil = any controller
  ringColor = nil,              -- nil = default blue
  ring = nil,                   -- animated ring: { x, y, w, h } or nil
}

-- Named focus groups keyed by their FocusGroup node's ID
local focusGroups = {}          -- { [nodeId] = group }

-- Per-joystick stick state for multi-controller
local stickStates = {}          -- { [joystickId] = { x, y, repeat = { dir, timer } } }

-- ============================================================================
-- Init
-- ============================================================================

--- Initialize with tree module reference and optional event push callback.
function Focus.init(tree, pushEvent)
  treeModule = tree
  pushEventFn = pushEvent
end

-- ============================================================================
-- Focus event emitter
-- ============================================================================

--- Emit blur/focus events when focus changes within a group.
local function emitFocusChange(oldNode, newNode)
  if not pushEventFn then return end
  if oldNode == newNode then return end
  if oldNode then
    pushEventFn({
      type = "blur",
      payload = { type = "blur", targetId = oldNode.id },
    })
  end
  if newNode then
    pushEventFn({
      type = "focus",
      payload = { type = "focus", targetId = newNode.id },
    })
  end
end

-- ============================================================================
-- Basic focus API (backwards-compatible)
-- ============================================================================

--- Set focus to a node. Returns the previously focused node.
function Focus.set(node)
  local prev = defaultGroup.focusedNode
  Log.log("focus", "set id=%s type=%s (prev=%s)", tostring(node and node.id), tostring(node and node.type), tostring(prev and prev.id or "nil"))
  if node == nil and prev ~= nil then
    io.write("[focus:set(nil)] NULLIFYING focus from " .. tostring(prev.type) .. " id=" .. tostring(prev.id) .. "\n")
    io.write("[focus:set(nil)] traceback: " .. debug.traceback("", 2) .. "\n")
    io.flush()
  end
  defaultGroup.focusedNode = node
  return prev
end

--- Clear focus. Returns the previously focused node.
function Focus.clear()
  local prev = defaultGroup.focusedNode
  Log.log("focus", "clear (prev=%s)", tostring(prev and prev.id or "nil"))
  if prev then
    io.write("[focus:clear] CLEARING focus from " .. tostring(prev.type) .. " id=" .. tostring(prev.id) .. "\n")
    io.write("[focus:clear] traceback: " .. debug.traceback("", 2) .. "\n")
    io.flush()
  end
  defaultGroup.focusedNode = nil
  return prev
end

--- Get the currently focused node (default group, backwards-compatible).
function Focus.get()
  return defaultGroup.focusedNode
end

--- Check if a specific node has focus in any group.
function Focus.isFocused(node)
  if defaultGroup.focusedNode == node then return true end
  for _, group in pairs(focusGroups) do
    if group.focusedNode == node then return true end
  end
  return false
end

-- ============================================================================
-- Input mode
-- ============================================================================

--- Get current input mode ("mouse" or "controller").
function Focus.getInputMode()
  return inputMode
end

--- Switch to controller mode. Restores or initializes focus for all groups.
function Focus.setControllerMode()
  if inputMode ~= "controller" then
    inputMode = "controller"
    restoreGroupFocus(defaultGroup)
    for _, group in pairs(focusGroups) do
      restoreGroupFocus(group)
    end
  end
end

--- Switch to mouse mode. Remembers focus for all groups.
function Focus.setMouseMode()
  if inputMode == "controller" then
    if defaultGroup.focusedNode then
      defaultGroup.lastFocused = defaultGroup.focusedNode
    end
    for _, group in pairs(focusGroups) do
      if group.focusedNode then
        group.lastFocused = group.focusedNode
      end
    end
  end
  inputMode = "mouse"
end

-- ============================================================================
-- Focusable detection
-- ============================================================================

--- Determine if a node is focusable.
local _capabilities = nil
local function isFocusable(node)
  if not node or not node.computed then return false end
  local s = node.style or {}
  if s.display == "none" then return false end
  if s.visibility == "hidden" then return false end

  local props = node.props or {}
  if props.focusable == true then return true end
  if props.focusable == false then return false end

  if node.hasHandlers then return true end

  -- Hittable capabilities (e.g. ClaudeCanvas) are focusable even without React handlers
  if not _capabilities then
    local ok, cap = pcall(require, "lua.capabilities")
    if ok then _capabilities = cap end
  end
  if _capabilities and node.type and _capabilities.isHittable(node.type) then return true end

  return false
end

-- ============================================================================
-- FocusGroup helpers
-- ============================================================================

--- Walk up from a node to find the nearest FocusGroup ancestor.
local function findFocusGroupAncestor(node)
  local current = node.parent
  while current do
    if current.props and current.props.focusGroup then
      return current
    end
    current = current.parent
  end
  return nil
end

--- Restore or initialize focus for a group when switching to controller mode.
function restoreGroupFocus(group)
  if not group.focusedNode then
    if group.lastFocused then
      local found = false
      for _, n in ipairs(group.focusableNodes) do
        if n == group.lastFocused then found = true; break end
      end
      if found then
        group.focusedNode = group.lastFocused
      else
        group.lastFocused = nil
        if #group.focusableNodes > 0 then
          group.focusedNode = group.focusableNodes[1]
        end
      end
    elseif #group.focusableNodes > 0 then
      group.focusedNode = group.focusableNodes[1]
    end
  end
end

--- Validate that a group's focused node still exists in its focusable list.
local function validateGroupFocus(group)
  if group.focusedNode then
    local found = false
    for _, n in ipairs(group.focusableNodes) do
      if n == group.focusedNode then found = true; break end
    end
    if not found then group.focusedNode = nil end
  end
end

-- ============================================================================
-- Scroll-into-view
-- ============================================================================

local function scrollIntoView(node)
  local current = node.parent
  while current do
    if current.style and current.style.overflow == "scroll" and current.scrollState then
      local sc = current.computed
      local nc = node.computed
      local ss = current.scrollState

      local nodeTop = nc.y - sc.y + (ss.scrollY or 0)
      local nodeBottom = nodeTop + nc.h
      local viewHeight = sc.h

      if nodeTop < (ss.scrollY or 0) then
        ss.scrollY = nodeTop
      elseif nodeBottom > (ss.scrollY or 0) + viewHeight then
        ss.scrollY = nodeBottom - viewHeight
      end

      local nodeLeft = nc.x - sc.x + (ss.scrollX or 0)
      local nodeRight = nodeLeft + nc.w
      local viewWidth = sc.w

      if nodeLeft < (ss.scrollX or 0) then
        ss.scrollX = nodeLeft
      elseif nodeRight > (ss.scrollX or 0) + viewWidth then
        ss.scrollX = nodeRight - viewWidth
      end

      break
    end
    current = current.parent
  end
end

-- ============================================================================
-- Spatial navigation algorithm
-- ============================================================================

--- Find the best navigation target from a node within a set of candidates.
--- @param fromNode table The node to navigate from
--- @param candidates table List of candidate nodes
--- @param direction string "up" | "down" | "left" | "right"
--- @return table|nil The best target node
local function spatialNavigate(fromNode, candidates, direction)
  local fc = fromNode.computed
  local cx = fc.x + fc.w / 2
  local cy = fc.y + fc.h / 2

  local best = nil
  local bestScore = math.huge

  for _, node in ipairs(candidates) do
    if node ~= fromNode then
      local nc = node.computed
      local nx = nc.x + nc.w / 2
      local ny = nc.y + nc.h / 2
      local dx = nx - cx
      local dy = ny - cy

      local aligned = false
      if direction == "right" and dx > 0 then aligned = true end
      if direction == "left"  and dx < 0 then aligned = true end
      if direction == "down"  and dy > 0 then aligned = true end
      if direction == "up"    and dy < 0 then aligned = true end

      if aligned then
        local mainDist, crossDist
        if direction == "left" or direction == "right" then
          mainDist = math.abs(dx)
          crossDist = math.abs(dy)
        else
          mainDist = math.abs(dy)
          crossDist = math.abs(dx)
        end
        local score = mainDist + crossDist * 3

        if score < bestScore then
          bestScore = score
          best = node
        end
      end
    end
  end

  return best
end

-- ============================================================================
-- Rebuild focusable list (called after layout)
-- ============================================================================

--- Rebuild the flat list of focusable nodes, sorting them into groups.
function Focus.rebuildFocusableList(root)
  -- Reset all groups
  defaultGroup.focusableNodes = {}
  for _, group in pairs(focusGroups) do
    group.focusableNodes = {}
  end

  -- Discover FocusGroup nodes and register/update them
  local activeGroupIds = {}
  local function discoverGroups(node)
    if not node or not node.computed then return end
    local s = node.style or {}
    if s.display == "none" then return end
    if node.props and node.props.focusGroup then
      local id = node.id
      activeGroupIds[id] = true
      if not focusGroups[id] then
        focusGroups[id] = {
          node = node,
          controller = node.props.focusGroupController,
          ringColor = node.props.focusGroupRingColor,
          focusedNode = nil,
          lastFocused = nil,
          focusableNodes = {},
          ring = nil,
        }
      else
        focusGroups[id].node = node
        focusGroups[id].controller = node.props.focusGroupController
        focusGroups[id].ringColor = node.props.focusGroupRingColor
      end
    end
    if node.children then
      for _, child in ipairs(node.children) do
        discoverGroups(child)
      end
    end
  end
  discoverGroups(root)

  -- Remove stale groups
  for id in pairs(focusGroups) do
    if not activeGroupIds[id] then
      focusGroups[id] = nil
    end
  end

  -- Sort focusable nodes into their groups
  local function walk(node)
    if not node or not node.computed then return end
    local s = node.style or {}
    if s.display == "none" then return end
    if isFocusable(node) then
      local groupAncestor = findFocusGroupAncestor(node)
      if groupAncestor and focusGroups[groupAncestor.id] then
        table.insert(focusGroups[groupAncestor.id].focusableNodes, node)
      else
        table.insert(defaultGroup.focusableNodes, node)
      end
    end
    if node.children then
      for _, child in ipairs(node.children) do
        walk(child)
      end
    end
  end
  walk(root)

  -- Validate focused nodes still exist
  validateGroupFocus(defaultGroup)
  for _, group in pairs(focusGroups) do
    validateGroupFocus(group)
  end
end

-- ============================================================================
-- Controller-aware group resolution
-- ============================================================================

--- Find groups that accept input from a given joystick ID.
--- If no FocusGroup claims this controller, returns the default group
--- and any unclaimed groups.
function Focus.getGroupsForController(joystickId)
  local groups = {}

  -- Check for groups that explicitly claim this controller
  for _, group in pairs(focusGroups) do
    if group.controller == joystickId then
      table.insert(groups, group)
    end
  end

  -- If a group explicitly claimed this controller, use only those
  if #groups > 0 then return groups end

  -- Otherwise: default group + any unclaimed groups
  table.insert(groups, defaultGroup)
  for _, group in pairs(focusGroups) do
    if not group.controller then
      table.insert(groups, group)
    end
  end
  return groups
end

--- Get the focused node for a specific controller.
function Focus.getForController(joystickId)
  local groups = Focus.getGroupsForController(joystickId)
  for _, group in ipairs(groups) do
    if group.focusedNode then return group.focusedNode end
  end
  return nil
end

--- Get the ring color for a controller's focused group.
--- Auto-assigns player colors based on joystick ID if no custom color set.
function Focus.getRingColorForController(joystickId)
  local groups = Focus.getGroupsForController(joystickId)
  for _, group in ipairs(groups) do
    if group.focusedNode then
      if group.ringColor then return group.ringColor end
      if group.controller then
        return PLAYER_COLORS[((group.controller - 1) % 4) + 1]
      end
      return nil  -- default blue
    end
  end
  return nil
end

-- ============================================================================
-- Navigation
-- ============================================================================

--- Spatial navigation within the correct group(s) for a controller.
function Focus.navigate(direction, joystickId)
  Log.log("focus", "navigate direction=%s joystick=%s", tostring(direction), tostring(joystickId or "default"))
  local groups
  if joystickId then
    groups = Focus.getGroupsForController(joystickId)
  else
    groups = { defaultGroup }
  end

  for _, group in ipairs(groups) do
    if #group.focusableNodes > 0 then
      local oldNode = group.focusedNode
      if not group.focusedNode then
        group.focusedNode = group.focusableNodes[1]
        scrollIntoView(group.focusedNode)
        emitFocusChange(oldNode, group.focusedNode)
        Log.log("focus", "  initial focus -> id=%s", tostring(group.focusedNode.id))
      else
        local best = spatialNavigate(group.focusedNode, group.focusableNodes, direction)
        if best then
          group.focusedNode = best
          scrollIntoView(best)
          emitFocusChange(oldNode, best)
          Log.log("focus", "  navigated %s -> id=%s", direction, tostring(best.id))
        else
          Log.log("focus", "  navigate %s: no target found", direction)
        end
      end
    end
  end
end

--- Sequential navigation (Tab/Shift+Tab) within the correct group(s).
--- @param direction string "next" or "prev"
--- @param joystickId number|nil Optional controller ID
function Focus.navigateSequential(direction, joystickId)
  local groups
  if joystickId then
    groups = Focus.getGroupsForController(joystickId)
  else
    groups = { defaultGroup }
  end

  for _, group in ipairs(groups) do
    local nodes = group.focusableNodes
    if #nodes > 0 then
      local oldNode = group.focusedNode
      if not group.focusedNode then
        group.focusedNode = nodes[1]
        scrollIntoView(group.focusedNode)
        emitFocusChange(oldNode, group.focusedNode)
      else
        -- Find current index
        local idx = nil
        for i, n in ipairs(nodes) do
          if n == group.focusedNode then idx = i; break end
        end
        if not idx then
          group.focusedNode = nodes[1]
        elseif direction == "next" then
          idx = idx + 1
          if idx > #nodes then idx = 1 end
          group.focusedNode = nodes[idx]
        elseif direction == "prev" then
          idx = idx - 1
          if idx < 1 then idx = #nodes end
          group.focusedNode = nodes[idx]
        end
        scrollIntoView(group.focusedNode)
        emitFocusChange(oldNode, group.focusedNode)
      end
    end
  end
end

-- ============================================================================
-- All focused nodes (for rendering multiple focus rings)
-- ============================================================================

--- Get all focused nodes across all groups with their ring colors.
function Focus.getAllFocused()
  local result = {}
  if defaultGroup.focusedNode then
    table.insert(result, { node = defaultGroup.focusedNode, ringColor = defaultGroup.ringColor })
  end
  for _, group in pairs(focusGroups) do
    if group.focusedNode then
      local color = group.ringColor
      if not color and group.controller then
        color = PLAYER_COLORS[((group.controller - 1) % 4) + 1]
      end
      table.insert(result, { node = group.focusedNode, ringColor = color })
    end
  end
  return result
end

-- ============================================================================
-- Ring animation
-- ============================================================================

--- Update a single group's ring animation toward its focused node.
local function updateGroupRing(group, dt)
  local node = group.focusedNode
  if not node or not node.computed then
    group.ring = nil
    return
  end

  local c = node.computed
  local s = node.style or {}
  local offset = 3
  local tx = c.x - offset
  local ty = c.y - offset
  local tw = c.w + offset * 2
  local th = c.h + offset * 2

  if not group.ring then
    -- First focus: snap immediately (no animation from nowhere)
    group.ring = { x = tx, y = ty, w = tw, h = th }
  else
    -- Exponential smoothing (frame-rate independent)
    local t = 1 - math.pow(RING_SMOOTHING, dt)
    local r = group.ring
    r.x = r.x + (tx - r.x) * t
    r.y = r.y + (ty - r.y) * t
    r.w = r.w + (tw - r.w) * t
    r.h = r.h + (th - r.h) * t
  end
end

--- Update all ring animations. Call once per frame from update().
function Focus.updateRings(dt)
  if inputMode ~= "controller" then return end
  updateGroupRing(defaultGroup, dt)
  for _, group in pairs(focusGroups) do
    updateGroupRing(group, dt)
  end
end

--- Get all animated ring rects for rendering.
--- Returns { { x, y, w, h, ringColor, borderRadius }, ... }
function Focus.getAllRings()
  local result = {}
  local function addRing(group, color)
    if group.ring and group.focusedNode then
      local s = group.focusedNode.style or {}
      local radius = s.borderRadius or 0
      table.insert(result, {
        x = group.ring.x,
        y = group.ring.y,
        w = group.ring.w,
        h = group.ring.h,
        ringColor = color,
        borderRadius = radius + 3,  -- offset matches ring offset
      })
    end
  end
  addRing(defaultGroup, defaultGroup.ringColor)
  for _, group in pairs(focusGroups) do
    local color = group.ringColor
    if not color and group.controller then
      color = PLAYER_COLORS[((group.controller - 1) % 4) + 1]
    end
    addRing(group, color)
  end
  return result
end

-- ============================================================================
-- Stick navigation (per-joystick)
-- ============================================================================

--- Get or create stick state for a joystick.
local function getStickState(joystickId)
  if not stickStates[joystickId] then
    stickStates[joystickId] = {
      x = 0, y = 0,
      repeatState = { dir = nil, timer = 0 },
    }
  end
  return stickStates[joystickId]
end

--- Store stick position (called from gamepadaxis handler).
function Focus.setStickInput(axis, value, joystickId)
  local state = getStickState(joystickId or 1)
  if axis == "leftx" then state.x = value end
  if axis == "lefty" then state.y = value end
end

--- Process all stick inputs for navigation with deadzone and repeat.
function Focus.updateStick(dt)
  if inputMode ~= "controller" then return end

  for joystickId, state in pairs(stickStates) do
    local x, y = state.x, state.y

    if math.abs(x) < STICK_DEADZONE then x = 0 end
    if math.abs(y) < STICK_DEADZONE then y = 0 end

    local dir = nil
    if math.abs(x) > math.abs(y) then
      if x > 0 then dir = "right" elseif x < 0 then dir = "left" end
    else
      if y > 0 then dir = "down" elseif y < 0 then dir = "up" end
    end

    local rep = state.repeatState
    if dir == nil then
      rep.dir = nil
      rep.timer = 0
    elseif dir ~= rep.dir then
      rep.dir = dir
      rep.timer = REPEAT_INITIAL
      Focus.navigate(dir, joystickId)
    else
      rep.timer = rep.timer - dt
      if rep.timer <= 0 then
        rep.timer = REPEAT_RATE
        Focus.navigate(dir, joystickId)
      end
    end
  end
end

-- ============================================================================
-- Debug / inspector access
-- ============================================================================

--- Get the list of all focusable nodes across all groups.
function Focus.getFocusableNodes()
  local all = {}
  for _, n in ipairs(defaultGroup.focusableNodes) do
    table.insert(all, n)
  end
  for _, group in pairs(focusGroups) do
    for _, n in ipairs(group.focusableNodes) do
      table.insert(all, n)
    end
  end
  return all
end

return Focus
