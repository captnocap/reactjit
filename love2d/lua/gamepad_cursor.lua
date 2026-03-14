--[[
  gamepad_cursor.lua — Virtual gamepad cursor (per-controller)

  A free-moving cursor controlled by the left stick. Acts like a mouse pointer:
  - Left stick moves the cursor (velocity-based with acceleration)
  - Confirm button press/release for click, hold+move for drag
  - Right stick scrolls the scroll container under the cursor
  - Edge-scroll: cursor near scroll container edges auto-scrolls
  - Hover tracking fires pointerEnter/pointerLeave as cursor moves
  - Rendered as a small arrow with player color

  Coexists with spatial D-pad navigation: D-pad still hops between focusable
  nodes, cursor gives free-aim for everything else.
]]

local GamepadCursor = {}

-- ============================================================================
-- Constants
-- ============================================================================

local CURSOR_SPEED       = 600   -- pixels/sec at full deflection
local CURSOR_ACCEL       = 2.0   -- acceleration exponent (>1 = ease-in curve)
local STICK_DEADZONE     = 0.15  -- tighter deadzone than focus nav for smooth movement
local SCROLL_SPEED       = 12    -- pixels/frame per unit stick deflection
local SCROLL_DEADZONE    = 0.20
local EDGE_SCROLL_MARGIN = 40    -- pixels from edge to trigger auto-scroll
local EDGE_SCROLL_SPEED  = 200   -- pixels/sec when cursor is at the very edge

-- Player colors (match focus.lua)
local PLAYER_COLORS = {
  { 0.3, 0.6, 1.0, 1.0 },     -- P1: blue
  { 1.0, 0.3, 0.3, 1.0 },     -- P2: red
  { 0.3, 1.0, 0.5, 1.0 },     -- P3: green
  { 1.0, 0.8, 0.2, 1.0 },     -- P4: yellow
}

-- Cursor arrow polygon (pointing up-left, 16px tall)
local CURSOR_POLY = {
  0, 0,         -- tip
  0, 16,        -- left edge bottom
  4, 12,        -- notch
  10, 18,       -- arrow tail right
  12, 16,       -- arrow tail right (inner)
  7, 10,        -- notch inner
  12, 10,       -- right wing
}

-- ============================================================================
-- State
-- ============================================================================

-- Per-joystick cursor state
local cursors = {}

-- Module refs (injected via init)
local eventsModule = nil
local treeModule = nil
local pushEventFn = nil

-- ============================================================================
-- Init
-- ============================================================================

function GamepadCursor.init(events, tree, pushEvent)
  eventsModule = events
  treeModule = tree
  pushEventFn = pushEvent
end

-- ============================================================================
-- Per-joystick cursor access
-- ============================================================================

local function getCursor(joystickId)
  local id = joystickId or 1
  if not cursors[id] then
    local w, h = 800, 600
    if love and love.graphics then
      w = love.graphics.getWidth()
      h = love.graphics.getHeight()
    end
    cursors[id] = {
      x = w / 2,
      y = h / 2,
      stickX = 0,
      stickY = 0,
      scrollX = 0,
      scrollY = 0,
      visible = false,
      hoveredNode = nil,
      -- Press/drag state
      pressed = false,        -- confirm button is held
      pressedNode = nil,      -- node that was under cursor on press
      pressX = 0, pressY = 0, -- where the press started
      dragging = false,       -- crossed drag threshold
    }
  end
  return cursors[id]
end

--- Get cursor position for a joystick.
function GamepadCursor.getPosition(joystickId)
  local c = getCursor(joystickId)
  return c.x, c.y
end

--- Check if cursor is visible for any joystick.
function GamepadCursor.isVisible()
  for _, c in pairs(cursors) do
    if c.visible then return true end
  end
  return false
end

--- Hide all cursors (e.g. when switching to mouse mode).
function GamepadCursor.hideAll()
  for _, c in pairs(cursors) do
    c.visible = false
    c.hoveredNode = nil
    c.pressed = false
    c.pressedNode = nil
    c.dragging = false
  end
end

--- Show cursor for a joystick.
function GamepadCursor.show(joystickId)
  local c = getCursor(joystickId)
  c.visible = true
end

-- ============================================================================
-- Stick input (called from gamepadaxis handler)
-- ============================================================================

function GamepadCursor.setStickInput(axis, value, joystickId)
  local c = getCursor(joystickId)
  if axis == "leftx" or axis == "cursor_x" then c.stickX = value end
  if axis == "lefty" or axis == "cursor_y" then c.stickY = value end
end

function GamepadCursor.setScrollInput(axis, value, joystickId)
  local c = getCursor(joystickId)
  if axis == "rightx" or axis == "scroll_x" then c.scrollX = value end
  if axis == "righty" or axis == "scroll_y" then c.scrollY = value end
end

-- ============================================================================
-- Edge-scroll helper
-- ============================================================================

-- Track the last scroll container ID the cursor was inside, per joystick.
-- Stored as ID (not node reference) so it survives tree rebuilds.
local lastScrollNodeId = {}  -- { [joystickId] = nodeId }

--- Look up a scroll node by ID from the current tree.
local function getScrollNodeById(nodeId)
  if not nodeId or not treeModule then return nil end
  local nodes = treeModule.getNodes()
  if not nodes then return nil end
  local node = nodes[nodeId]
  if node and node.scrollState then return node end
  return nil
end

--- Compute edge-scroll based on screen edges (not scroll container edges).
--- Uses the scroll container under the cursor, or the last known one if
--- cursor has moved into a non-scrollable area (header/footer).
--- Returns scrollNode, scrollDX, scrollDY
local function computeEdgeScroll(c, joystickId, dt)
  if not eventsModule or not treeModule then return nil, 0, 0 end

  local w, h = 800, 600
  if love and love.graphics then
    w = love.graphics.getWidth()
    h = love.graphics.getHeight()
  end

  -- Try to find scroll container under cursor and remember its ID
  local root = treeModule.getTree()
  if root then
    local hit = eventsModule.hitTest(root, c.x, c.y)
    if hit then
      local sc = eventsModule.findScrollContainer(hit, c.x, c.y)
      if sc and sc.scrollState then
        lastScrollNodeId[joystickId] = sc.id
      end
    end
  end

  -- Resolve scroll node: last known ID → fallback to any scroll node
  local scrollNode = getScrollNodeById(lastScrollNodeId[joystickId])
  if not scrollNode then
    if root then scrollNode = GamepadCursor._findAnyScrollNode(root) end
    if scrollNode then lastScrollNodeId[joystickId] = scrollNode.id end
  end
  if not scrollNode or not scrollNode.scrollState then return nil, 0, 0 end

  local dx, dy = 0, 0

  -- Distance from cursor to screen edges
  local distTop = c.y
  local distBottom = h - c.y
  local distLeft = c.x
  local distRight = w - c.x

  -- Scroll when cursor is near screen edges
  if distBottom < EDGE_SCROLL_MARGIN then
    local t = 1 - (distBottom / EDGE_SCROLL_MARGIN)
    dy = EDGE_SCROLL_SPEED * t * dt
  elseif distTop < EDGE_SCROLL_MARGIN then
    local t = 1 - (distTop / EDGE_SCROLL_MARGIN)
    dy = -EDGE_SCROLL_SPEED * t * dt
  end

  if distRight < EDGE_SCROLL_MARGIN then
    local t = 1 - (distRight / EDGE_SCROLL_MARGIN)
    dx = EDGE_SCROLL_SPEED * t * dt
  elseif distLeft < EDGE_SCROLL_MARGIN then
    local t = 1 - (distLeft / EDGE_SCROLL_MARGIN)
    dx = -EDGE_SCROLL_SPEED * t * dt
  end

  return scrollNode, dx, dy
end

-- ============================================================================
-- Update (called once per frame from love.update)
-- ============================================================================

function GamepadCursor.update(dt)
  local w, h = 800, 600
  if love and love.graphics then
    w = love.graphics.getWidth()
    h = love.graphics.getHeight()
  end

  for joystickId, c in pairs(cursors) do
    if not c.visible then goto continue end

    -- === Cursor movement ===
    local sx, sy = c.stickX, c.stickY
    if math.abs(sx) < STICK_DEADZONE then sx = 0 end
    if math.abs(sy) < STICK_DEADZONE then sy = 0 end

    local moved = false
    if sx ~= 0 or sy ~= 0 then
      local mag = math.sqrt(sx * sx + sy * sy)
      if mag > 1 then mag = 1 end
      local accelMag = math.pow(mag, CURSOR_ACCEL)
      local nx, ny = sx / mag, sy / mag

      local speed = CURSOR_SPEED * accelMag * dt
      c.x = c.x + nx * speed
      c.y = c.y + ny * speed

      c.x = math.max(0, math.min(w, c.x))
      c.y = math.max(0, math.min(h, c.y))
      moved = true
    end

    -- === Drag tracking (while confirm is held and cursor moves) ===
    if c.pressed and moved and pushEventFn and eventsModule then
      local DRAG_THRESHOLD = 5
      local tdx = c.x - c.pressX
      local tdy = c.y - c.pressY
      local dist = math.sqrt(tdx * tdx + tdy * tdy)

      if not c.dragging and dist >= DRAG_THRESHOLD then
        c.dragging = true
        -- Fire dragstart
        if c.pressedNode then
          pushEventFn(eventsModule.createDragEvent(
            "dragstart", c.pressedNode.id,
            c.x, c.y, 0, 0, c.pressX, c.pressY
          ))
        end
      end

      if c.dragging and c.pressedNode then
        pushEventFn(eventsModule.createDragEvent(
          "drag", c.pressedNode.id,
          c.x, c.y, sx * dt, sy * dt, c.pressX, c.pressY
        ))
      end
    end

    -- === Track hovered node (for scroll container detection) ===
    -- NOTE: We do NOT fire pointerEnter/pointerLeave from the cursor.
    -- Those are already handled by the mouse hover system in init.lua.
    -- Firing them here would conflict and cause blank-page bugs.
    if eventsModule and treeModule then
      local root = treeModule.getTree()
      if root then
        c.hoveredNode = eventsModule.hitTest(root, c.x, c.y)
      end
    end

    -- === Scroll via right stick ===
    local scx, scy = c.scrollX, c.scrollY
    if math.abs(scx) < SCROLL_DEADZONE then scx = 0 end
    if math.abs(scy) < SCROLL_DEADZONE then scy = 0 end

    if (scx ~= 0 or scy ~= 0) and treeModule and eventsModule then
      local root = treeModule.getTree()
      if root then
        local hit = eventsModule.hitTest(root, c.x, c.y)
        local scrollNode = nil
        if hit then
          scrollNode = eventsModule.findScrollContainer(hit, c.x, c.y)
        end
        if not scrollNode then
          scrollNode = GamepadCursor._findAnyScrollNode(root)
        end
        if scrollNode and scrollNode.scrollState then
          local ss = scrollNode.scrollState
          treeModule.setScroll(scrollNode.id,
            (ss.scrollX or 0) + scx * SCROLL_SPEED,
            (ss.scrollY or 0) + scy * SCROLL_SPEED)
          GamepadCursor._emitScrollEvent(scrollNode)
        end
      end
    end

    -- === Edge-scroll: auto-scroll when cursor is near scroll container edges ===
    if moved then
      local scrollNode, edgeDX, edgeDY = computeEdgeScroll(c, joystickId, dt)
      if scrollNode and (edgeDX ~= 0 or edgeDY ~= 0) then
        local ss = scrollNode.scrollState
        treeModule.setScroll(scrollNode.id,
          (ss.scrollX or 0) + edgeDX,
          (ss.scrollY or 0) + edgeDY)
        GamepadCursor._emitScrollEvent(scrollNode)
      end
    end

    ::continue::
  end
end

--- BFS fallback: find any scroll node in tree.
function GamepadCursor._findAnyScrollNode(root)
  if not root then return nil end
  local queue = { root }
  local head = 1
  while head <= #queue do
    local node = queue[head]
    head = head + 1
    local s = node.style or {}
    if (s.overflow == "scroll" or s.overflow == "auto") and node.scrollState then
      return node
    end
    if node.children then
      for _, child in ipairs(node.children) do
        queue[#queue + 1] = child
      end
    end
  end
  return nil
end

--- Emit scroll event for a scroll node.
function GamepadCursor._emitScrollEvent(scrollNode)
  if not pushEventFn or not eventsModule then return end
  local sc = scrollNode.computed
  local ss = scrollNode.scrollState
  pushEventFn(eventsModule.createScrollEvent(
    scrollNode.id,
    ss.scrollX or 0, ss.scrollY or 0,
    ss.contentW or (sc and sc.w or 0),
    ss.contentH or (sc and sc.h or 0),
    sc and sc.w or 0, sc and sc.h or 0,
    eventsModule.buildBubblePath(scrollNode)
  ))
end

-- ============================================================================
-- Press / release / click at cursor position
-- ============================================================================

--- Called on confirm press: mousedown at cursor, start tracking for drag.
function GamepadCursor.press(joystickId)
  local c = getCursor(joystickId)
  if not c.visible then return nil end
  if not eventsModule or not treeModule or not pushEventFn then return nil end

  local root = treeModule.getTree()
  if not root then return nil end

  local hit = eventsModule.hitTest(root, c.x, c.y)
  c.pressed = true
  c.pressX = c.x
  c.pressY = c.y
  c.pressedNode = hit
  c.dragging = false

  if hit then
    local bubblePath = eventsModule.buildBubblePath(hit)
    pushEventFn(eventsModule.createEvent("click", hit.id, c.x, c.y, 1, bubblePath))
    eventsModule.setPressedNode(hit)
  end
  return hit
end

--- Called on confirm release: mouseup, end drag if active.
function GamepadCursor.release(joystickId)
  local c = getCursor(joystickId)
  if not c.visible then return nil end
  if not eventsModule or not treeModule or not pushEventFn then return nil end

  local root = treeModule.getTree()
  local hit = root and eventsModule.hitTest(root, c.x, c.y) or nil

  -- End drag if active
  if c.dragging and c.pressedNode then
    pushEventFn(eventsModule.createDragEvent(
      "dragend", c.pressedNode.id,
      c.x, c.y, 0, 0, c.pressX, c.pressY
    ))
  end

  eventsModule.clearPressedNode()

  if hit then
    local bubblePath = eventsModule.buildBubblePath(hit)
    pushEventFn(eventsModule.createEvent("release", hit.id, c.x, c.y, 1, bubblePath))
  end

  -- Reset press state
  c.pressed = false
  c.pressedNode = nil
  c.dragging = false

  return hit
end

--- Legacy: instant click (press+release). Used when drag not needed.
function GamepadCursor.click(joystickId)
  local node = GamepadCursor.press(joystickId)
  -- Don't immediately release — let gamepadreleased handle it
  return node
end

--- Get the node currently under the cursor.
function GamepadCursor.getHoveredNode(joystickId)
  local c = getCursor(joystickId)
  return c.hoveredNode
end

--- Check if a drag is active.
function GamepadCursor.isDragging(joystickId)
  local c = getCursor(joystickId)
  return c.dragging
end

-- ============================================================================
-- Draw (called from love.draw, after focus rings)
-- ============================================================================

function GamepadCursor.draw()
  for joystickId, c in pairs(cursors) do
    if not c.visible then goto skip end

    local color = PLAYER_COLORS[((joystickId - 1) % 4) + 1]
    local x, y = c.x, c.y

    -- Build transformed polygon
    local poly = {}
    for i = 1, #CURSOR_POLY, 2 do
      poly[#poly + 1] = x + CURSOR_POLY[i]
      poly[#poly + 1] = y + CURSOR_POLY[i + 1]
    end

    -- Fill
    love.graphics.setColor(color[1], color[2], color[3], 0.9)
    love.graphics.polygon("fill", poly)

    -- Outline
    love.graphics.setColor(0, 0, 0, 0.8)
    love.graphics.setLineWidth(1.5)
    love.graphics.polygon("line", poly)
    love.graphics.setLineWidth(1)

    -- Dot at tip for precision
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.circle("fill", x, y, 2)

    -- Visual feedback when pressed
    if c.pressed then
      love.graphics.setColor(color[1], color[2], color[3], 0.3)
      love.graphics.circle("fill", x, y, 8)
    end

    ::skip::
  end
end

return GamepadCursor
