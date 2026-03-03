--[[
  events.lua -- Hit testing and event dispatch

  Provides hit testing against the retained element tree (walks children in
  reverse paint order so the topmost node wins) and tracks hovered-node state
  for pointer enter/leave events.

  Paint order accounts for zIndex (sorted ascending, so reverse iteration
  checks highest zIndex first) and scroll containers (mouse coordinates are
  adjusted by the scroll offset when entering a scrollable node).
]]

local ZIndex = require("lua.zindex")
local Log = require("lua.debug_log")

local Events = {}

local treeModule = nil
local widgetsModule = nil
local capabilitiesModule = nil

-- Non-widget Lua-owned types that are always hittable.
-- Widget types (Slider, Fader, etc.) are checked dynamically via widgetsModule.
local LUA_HITTABLE = {
  TextEditor = true, TextInput = true, CodeBlock = true,
  Video = true, VideoPlayer = true, ContextMenu = true,
  Scene3D = true, Map2D = true, GameCanvas = true,
}

function Events.setTreeModule(tree)
  treeModule = tree
end

function Events.setWidgetsModule(w)
  widgetsModule = w
end

function Events.setCapabilitiesModule(c)
  capabilitiesModule = c
end

-- ============================================================================
-- State
-- ============================================================================

-- Pointer state for hit testing, hover tracking, and drag detection
local defaultState = {
  hoveredNode = nil,
  pressedNode = nil,
  dragState = {
    active = false,
    targetId = nil,
    startX = 0, startY = 0,
    lastX = 0, lastY = 0,
    thresholdCrossed = false,
  },
}

local DRAG_THRESHOLD = 5  -- pixels of movement needed to trigger drag

-- Get the current pointer state table
local function getState()
  return defaultState
end

-- ============================================================================
-- Hit testing
-- ============================================================================

--- Walk the tree to find the topmost node under (mx, my) that has event
--- handlers registered on the JS side (node.hasHandlers == true).
--- Uses reverse paint order (highest zIndex first) and adjusts coordinates
--- for scroll containers.
--- Returns the hit node or nil.
function Events.hitTest(node, mx, my)
  if not node or not node.computed then return nil end
  local s = node.style or {}
  local c = node.computed

  -- display:none nodes are not hittable
  if s.display == "none" then return nil end

  -- Point outside this node's bounding box (in screen space)
  if mx < c.x or mx > c.x + c.w or my < c.y or my > c.y + c.h then
    return nil
  end

  -- If this is a scroll container, adjust mouse coordinates by scroll offset
  -- so that children (which are laid out in content space) match screen hits
  local childMx, childMy = mx, my
  local isScroll = s.overflow == "scroll" or s.overflow == "auto"
  if isScroll and node.scrollState then
    childMx = mx + (node.scrollState.scrollX or 0)
    childMy = my + (node.scrollState.scrollY or 0)
  end

  -- Get children in paint order (sorted by zIndex), then iterate in reverse
  -- so that the topmost (highest zIndex / last-painted) is checked first
  local children = node.children or {}
  local paintOrder = ZIndex.getSortedChildren(children)
  for i = #paintOrder, 1, -1 do
    local hit = Events.hitTest(paintOrder[i], childMx, childMy)
    if hit then return hit end
  end

  -- Return this node if it has JS event handlers
  if node.hasHandlers then
    Log.log("events", "hitTest (%d,%d) -> id=%s type=%s (hasHandlers)", mx, my, tostring(node.id), tostring(node.type))
    return node
  end
  -- Nodes with hoverStyle/activeStyle are hittable for Lua-side interaction
  if node.props and (node.props.hoverStyle or node.props.activeStyle) then return node end
  -- Nodes with a tooltip prop are hittable for Lua-side tooltip rendering
  if node.props and node.props.tooltip then return node end
  -- Also return scroll containers so wheel events can scroll them
  -- even when no JS handler is attached
  if isScroll then return node end
  -- Lua-owned interactive nodes are always hittable
  if LUA_HITTABLE[node.type] then return node end
  if widgetsModule and widgetsModule.isLuaInteractive(node.type) then return node end
  -- Visual capabilities with hittable=true are interactive (can receive focus)
  if capabilitiesModule and capabilitiesModule.isHittable(node.type) then return node end
  return nil
end

--- Hit test specifically for Text nodes (used by text selection).
--- Only returns Text/__TEXT__ nodes, ignoring interactive ancestors.
--- This is separate from hitTest so that Pressable clicks aren't intercepted.
function Events.textHitTest(node, mx, my)
  if not node or not node.computed then return nil end
  local s = node.style or {}
  local c = node.computed

  if s.display == "none" then return nil end
  if mx < c.x or mx > c.x + c.w or my < c.y or my > c.y + c.h then
    return nil
  end

  local childMx, childMy = mx, my
  local isScroll = s.overflow == "scroll" or s.overflow == "auto"
  if isScroll and node.scrollState then
    childMx = mx + (node.scrollState.scrollX or 0)
    childMy = my + (node.scrollState.scrollY or 0)
  end

  -- Check children first (deepest text node wins)
  local children = node.children or {}
  local paintOrder = ZIndex.getSortedChildren(children)
  for i = #paintOrder, 1, -1 do
    local hit = Events.textHitTest(paintOrder[i], childMx, childMy)
    if hit then return hit end
  end

  -- Return this node only if it's a Text/CodeBlock node and selectable
  if node.type == "Text" and s.userSelect ~= "none" then
    return node
  end
  if node.type == "CodeBlock" and s.userSelect ~= "none" then
    return node
  end
  if node.type == "__TEXT__" then
    local ps = (node.parent and node.parent.style) or {}
    if s.userSelect ~= "none" and ps.userSelect ~= "none" then
      return node
    end
  end

  return nil
end

--- Convert screen coordinates to content-space coordinates for a node.
--- Walks up the parent chain accumulating scroll offsets.
function Events.screenToContent(node, sx, sy)
  local cx, cy = sx, sy
  local current = node.parent
  while current do
    local cs = current.style or {}
    if (cs.overflow == "scroll" or cs.overflow == "auto") and current.scrollState then
      cx = cx + (current.scrollState.scrollX or 0)
      cy = cy + (current.scrollState.scrollY or 0)
    end
    current = current.parent
  end
  return cx, cy
end

--- Build the bubble path from a hit node up to the root.
--- Returns array of node IDs where hasHandlers == true,
--- starting with the target and walking up via parent pointers.
function Events.buildBubblePath(node)
  local path = {}
  local current = node
  while current do
    if current.hasHandlers then
      path[#path + 1] = current.id
    end
    current = current.parent
  end
  Log.log("events", "bubblePath from id=%s: [%s]", tostring(node.id), table.concat(path, ","))
  return path
end

--- Find the nearest scroll container ancestor that contains the point (mx, my).
--- Walks up from a hit node checking if any ancestor is a scroll container.
--- Returns the scroll container node or nil.
function Events.findScrollContainer(node, mx, my)
  if not node then return nil end

  local current = node
  while current do
    local s = current.style or {}
    if (s.overflow == "scroll" or s.overflow == "auto") and current.scrollState then
      Log.log("events", "findScrollContainer from id=%s -> scroll id=%s", tostring(node.id), tostring(current.id))
      return current
    end
    current = current.parent
  end

  Log.log("events", "findScrollContainer from id=%s -> nil", tostring(node.id))
  return nil
end

--- Resolve enabled scroll axes for a scroll container.
--- ScrollView sets props.horizontal explicitly:
---   true  => horizontal-only
---   false => vertical-only
--- Other overflow:scroll nodes (e.g. Box) keep two-axis scrolling.
local function getScrollAxisFlags(node)
  local props = node and node.props
  if props and props.horizontal == true then
    return true, false
  end
  if props and props.horizontal == false then
    return false, true
  end
  return true, true
end

--- Normalize wheel deltas for a specific scroll container.
--- For horizontal-only containers, map vertical wheel delta to horizontal
--- when no horizontal wheel delta is provided (typical mouse wheel).
--- @param node table Scroll container node
--- @param dx number
--- @param dy number
--- @return number, number
function Events.resolveScrollWheelDeltas(node, dx, dy)
  local allowX, allowY = getScrollAxisFlags(node)

  local wheelX = dx or 0
  local wheelY = dy or 0

  -- Horizontal-only container: map vertical wheel to horizontal
  if allowX and not allowY and wheelX == 0 and wheelY ~= 0 then
    wheelX = wheelY
    wheelY = 0
  end

  -- Vertical-only container: map horizontal tilt to vertical scroll
  -- This handles left/right scroll wheel tilt acting as page up/down
  if allowY and not allowX and wheelY == 0 and wheelX ~= 0 then
    wheelY = wheelX
    wheelX = 0
  end

  if not allowX then wheelX = 0 end
  if not allowY then wheelY = 0 end

  return wheelX, wheelY
end

--- Find the nearest scroll container that can consume a wheel delta.
--- Walks from hit node upward and skips saturated scroll containers so wheel
--- input can chain to parent containers naturally.
--- @param node table|nil
--- @param dx number Wheel delta X from love.wheelmoved
--- @param dy number Wheel delta Y from love.wheelmoved
--- @return table|nil
function Events.findScrollableContainer(node, dx, dy)
  if not node then return nil end

  local current = node
  local fallback = nil

  while current do
    local s = current.style or {}
    if (s.overflow == "scroll" or s.overflow == "auto") and current.scrollState and current.computed then
      local wheelX, wheelY = Events.resolveScrollWheelDeltas(current, dx, dy)
      local ss = current.scrollState
      local c = current.computed
      local maxX = math.max(0, (ss.contentW or c.w or 0) - (c.w or 0))
      local maxY = math.max(0, (ss.contentH or c.h or 0) - (c.h or 0))
      local sx = ss.scrollX or 0
      local sy = ss.scrollY or 0

      local canScrollX = false
      local canScrollY = false

      -- x > 0 means scrolling left (decreasing scrollX)
      -- x < 0 means scrolling right (increasing scrollX)
      if wheelX > 0 then
        canScrollX = sx > 0
      elseif wheelX < 0 then
        canScrollX = sx < maxX
      end

      -- y > 0 means scrolling up (decreasing scrollY)
      -- y < 0 means scrolling down (increasing scrollY)
      if wheelY > 0 then
        canScrollY = sy > 0
      elseif wheelY < 0 then
        canScrollY = sy < maxY
      end

      if canScrollX or canScrollY then
        return current
      end

      if not fallback then
        fallback = current
      end
    end
    current = current.parent
  end

  -- Preserve previous behavior when no container can scroll further.
  return fallback
end

--- Walk up from a node to find the nearest ContextMenu ancestor.
--- Returns the ContextMenu node or nil.
function Events.findContextMenuAncestor(node)
  if not node then return nil end
  local current = node
  while current do
    if current.type == "ContextMenu" then return current end
    current = current.parent
  end
  return nil
end

-- ============================================================================
-- Event creation
-- ============================================================================

--- Build a structured event table suitable for sending to the JS bridge.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createEvent(eventType, targetId, x, y, button, bubblePath)
  return {
    type = eventType,
    payload = {
      type = eventType,
      targetId = targetId,
      x = x,
      y = y,
      button = button,
      bubblePath = bubblePath,
    }
  }
end

--- Build a keyboard event for keydown/keyup.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createKeyEvent(eventType, key, scancode, isRepeat, modifiers)
  local ctrl, shift, alt, meta
  if modifiers then
    ctrl  = modifiers.ctrl  or false
    shift = modifiers.shift or false
    alt   = modifiers.alt   or false
    meta  = modifiers.meta  or false
  elseif love then
    ctrl  = love.keyboard.isDown("lctrl", "rctrl")
    shift = love.keyboard.isDown("lshift", "rshift")
    alt   = love.keyboard.isDown("lalt", "ralt")
    meta  = love.keyboard.isDown("lgui", "rgui")
  else
    ctrl, shift, alt, meta = false, false, false, false
  end
  return {
    type = eventType,
    payload = {
      type = eventType,
      key = key,
      scancode = scancode,
      isRepeat = isRepeat or false,
      ctrl = ctrl, shift = shift, alt = alt, meta = meta,
    }
  }
end

--- Build a text input event.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createTextInputEvent(text)
  return {
    type = "textinput",
    payload = {
      type = "textinput",
      text = text,
    }
  }
end

--- Build a wheel event for scroll input.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createWheelEvent(targetId, x, y, dx, dy, bubblePath)
  return {
    type = "wheel",
    payload = {
      type = "wheel",
      targetId = targetId,
      x = x,
      y = y,
      deltaX = dx,
      deltaY = dy,
      bubblePath = bubblePath,
    }
  }
end

--- Build a scroll event for ScrollView updates.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createScrollEvent(targetId, scrollX, scrollY, contentWidth, contentHeight, viewportWidth, viewportHeight, bubblePath)
  return {
    type = "scroll",
    payload = {
      type = "scroll",
      targetId = targetId,
      scrollX = scrollX or 0,
      scrollY = scrollY or 0,
      contentWidth = contentWidth or 0,
      contentHeight = contentHeight or 0,
      viewportWidth = viewportWidth or 0,
      viewportHeight = viewportHeight or 0,
      bubblePath = bubblePath,
    }
  }
end

--- Build a layout event for node geometry updates.
--- Emitted when a node with onLayout changes computed bounds.
function Events.createLayoutEvent(targetId, x, y, width, height)
  return {
    type = "layout",
    payload = {
      type = "layout",
      targetId = targetId,
      x = x or 0,
      y = y or 0,
      width = width or 0,
      height = height or 0,
    }
  }
end

--- Build a touch event for touch input.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createTouchEvent(eventType, targetId, touchId, x, y, dx, dy, pressure, bubblePath)
  return {
    type = eventType,
    payload = {
      type = eventType,
      targetId = targetId,
      touchId = touchId,
      x = x,
      y = y,
      dx = dx,
      dy = dy,
      pressure = pressure,
      bubblePath = bubblePath,
    }
  }
end

--- Build a gamepad button event for gamepad button press/release.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createGamepadButtonEvent(eventType, button, joystickId)
  return {
    type = eventType,
    payload = {
      type = eventType,
      gamepadButton = button,
      joystickId = joystickId,
    }
  }
end

--- Build a gamepad axis event for gamepad stick/trigger movement.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createGamepadAxisEvent(axis, value, joystickId)
  return {
    type = "gamepadaxis",
    payload = {
      type = "gamepadaxis",
      axis = axis,
      axisValue = value,
      joystickId = joystickId,
    }
  }
end

--- Build a drag event for drag interactions.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createDragEvent(eventType, targetId, x, y, deltaX, deltaY, startX, startY)
  local bubblePath = nil
  if treeModule then
    local nodes = treeModule.getNodes()
    local node = nodes[targetId]
    if node then
      bubblePath = Events.buildBubblePath(node)
    end
  end
  return {
    type = eventType,
    payload = {
      type = eventType,
      targetId = targetId,
      x = x,
      y = y,
      deltaX = deltaX,  -- delta from LAST position
      deltaY = deltaY,
      startX = startX,  -- where drag began
      startY = startY,
      totalDeltaX = x - startX,  -- total delta from start
      totalDeltaY = y - startY,
      bubblePath = bubblePath,
    }
  }
end

--- Build a file drop event for drag-and-drop file/directory input.
--- Format matches BridgeEvent: { type: string, payload: any }
function Events.createFileDropEvent(eventType, targetId, x, y, filePath, fileSize, bubblePath, extraPayload)
  local payload = {
    type = eventType,
    targetId = targetId,
    x = x,
    y = y,
    filePath = filePath,
    fileSize = fileSize,
    bubblePath = bubblePath,
  }
  if type(extraPayload) == "table" then
    for k, v in pairs(extraPayload) do
      payload[k] = v
    end
  end
  return {
    type = eventType,
    payload = payload,
  }
end

-- ============================================================================
-- Pointer enter / leave tracking
-- ============================================================================

--- Update hover tracking. Call from love.mousemoved.
--- Returns a list of events to dispatch (may be empty, or contain
--- a pointerLeave and/or pointerEnter event).
function Events.updateHover(tree, mx, my)
  local hit = Events.hitTest(tree, mx, my)
  local eventsOut = {}
  local st = getState()

  if hit ~= st.hoveredNode then
    Log.log("events", "hover change: %s -> %s at (%d,%d)",
      st.hoveredNode and tostring(st.hoveredNode.id) or "nil",
      hit and tostring(hit.id) or "nil", mx, my)
    if st.hoveredNode then
      eventsOut[#eventsOut + 1] = Events.createEvent(
        "pointerLeave", st.hoveredNode.id, mx, my, nil
      )
    end
    if hit then
      eventsOut[#eventsOut + 1] = Events.createEvent(
        "pointerEnter", hit.id, mx, my, nil
      )
    end
    st.hoveredNode = hit
  end

  return eventsOut
end

--- Return the currently hovered node (or nil).
function Events.getHoveredNode()
  return getState().hoveredNode
end

--- Reset hover state (e.g. on tree rebuild).
function Events.clearHover()
  getState().hoveredNode = nil
end

-- ============================================================================
-- Pressed (active) node tracking
-- ============================================================================

--- Set the currently pressed node.
--- Called from mousepressed when a node is hit.
function Events.setPressedNode(node)
  getState().pressedNode = node
end

--- Return the currently pressed node (or nil).
function Events.getPressedNode()
  return getState().pressedNode
end

--- Clear pressed node state.
--- Called from mousereleased.
function Events.clearPressedNode()
  getState().pressedNode = nil
end

-- ============================================================================
-- Drag tracking
-- ============================================================================

--- Start tracking a potential drag operation.
--- Called from mousepressed when a node is hit.
function Events.startDrag(targetId, x, y)
  local ds = getState().dragState
  ds.active = true
  ds.targetId = targetId
  ds.startX = x
  ds.startY = y
  ds.lastX = x
  ds.lastY = y
  ds.thresholdCrossed = false
end

--- Update drag tracking during mouse movement.
--- Returns a drag event if the threshold has been crossed, nil otherwise.
--- Also returns a dragstart event on the first movement past threshold.
function Events.updateDrag(x, y)
  local ds = getState().dragState
  if not ds.active then return nil end

  local dx = x - ds.lastX
  local dy = y - ds.lastY
  local eventsOut = {}

  -- Check if we've crossed the drag threshold
  if not ds.thresholdCrossed then
    local totalDx = x - ds.startX
    local totalDy = y - ds.startY
    local distance = math.sqrt(totalDx * totalDx + totalDy * totalDy)

    if distance >= DRAG_THRESHOLD then
      ds.thresholdCrossed = true

      -- Fire dragstart event
      eventsOut[#eventsOut + 1] = Events.createDragEvent(
        "dragstart",
        ds.targetId,
        x,
        y,
        dx,
        dy,
        ds.startX,
        ds.startY
      )

      -- Immediately fire drag event with current position
      eventsOut[#eventsOut + 1] = Events.createDragEvent(
        "drag",
        ds.targetId,
        x,
        y,
        dx,
        dy,
        ds.startX,
        ds.startY
      )

      ds.lastX = x
      ds.lastY = y
    end
  else
    -- Threshold already crossed, continue firing drag events
    eventsOut[#eventsOut + 1] = Events.createDragEvent(
      "drag",
      ds.targetId,
      x,
      y,
      dx,
      dy,
      ds.startX,
      ds.startY
    )

    ds.lastX = x
    ds.lastY = y
  end

  return eventsOut
end

--- End drag tracking.
--- Returns a dragend event if the threshold was crossed, nil otherwise.
function Events.endDrag(x, y)
  local ds = getState().dragState
  if not ds.active then return nil end

  local event = nil
  if ds.thresholdCrossed then
    local dx = x - ds.lastX
    local dy = y - ds.lastY

    event = Events.createDragEvent(
      "dragend",
      ds.targetId,
      x,
      y,
      dx,
      dy,
      ds.startX,
      ds.startY
    )
  end

  -- Reset drag state
  ds.active = false
  ds.targetId = nil
  ds.thresholdCrossed = false

  return event
end

--- Cancel an active drag without emitting any events.
--- Used when text selection takes over from a normal drag.
function Events.cancelDrag()
  local ds = getState().dragState
  ds.active = false
  ds.targetId = nil
  ds.thresholdCrossed = false
end

--- Check if a drag is currently active.
function Events.isDragging()
  return getState().dragState.active
end

--- Check if the drag threshold has been crossed.
function Events.isDragThresholdCrossed()
  return getState().dragState.thresholdCrossed
end

return Events
