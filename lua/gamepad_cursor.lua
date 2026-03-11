--[[
  gamepad_cursor.lua — Virtual gamepad cursor (per-controller)

  A free-moving cursor controlled by the left stick. Acts like a mouse pointer:
  - Left stick moves the cursor (velocity-based with acceleration)
  - Confirm button clicks whatever is under the cursor
  - Right stick scrolls the scroll container under the cursor
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

-- Player colors (match focus.lua)
local PLAYER_COLORS = {
  { 0.3, 0.6, 1.0, 1.0 },     -- P1: blue
  { 1.0, 0.3, 0.3, 1.0 },     -- P2: red
  { 0.3, 1.0, 0.5, 1.0 },     -- P3: green
  { 1.0, 0.8, 0.2, 1.0 },     -- P4: yellow
}

-- Cursor arrow polygon (pointing up-left, 16px tall)
-- Defined as offsets from cursor position
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
-- { [joystickId] = { x, y, stickX, stickY, scrollX, scrollY, visible, hoveredNode } }
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
    -- Start cursor at screen center
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
    }
  end
  return cursors[id]
end

--- Get cursor position for a joystick.
--- @return number, number x, y
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
  end
end

--- Show cursor for a joystick (called when controller input detected).
function GamepadCursor.show(joystickId)
  local c = getCursor(joystickId)
  c.visible = true
end

-- ============================================================================
-- Stick input (called from gamepadaxis handler)
-- ============================================================================

--- Store cursor stick input (left stick).
function GamepadCursor.setStickInput(axis, value, joystickId)
  local c = getCursor(joystickId)
  if axis == "leftx" or axis == "cursor_x" then c.stickX = value end
  if axis == "lefty" or axis == "cursor_y" then c.stickY = value end
end

--- Store scroll stick input (right stick).
function GamepadCursor.setScrollInput(axis, value, joystickId)
  local c = getCursor(joystickId)
  if axis == "rightx" or axis == "scroll_x" then c.scrollX = value end
  if axis == "righty" or axis == "scroll_y" then c.scrollY = value end
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
    -- Apply deadzone
    if math.abs(sx) < STICK_DEADZONE then sx = 0 end
    if math.abs(sy) < STICK_DEADZONE then sy = 0 end

    if sx ~= 0 or sy ~= 0 then
      -- Normalize and apply acceleration curve
      local mag = math.sqrt(sx * sx + sy * sy)
      if mag > 1 then mag = 1 end
      local accelMag = math.pow(mag, CURSOR_ACCEL)
      local nx, ny = sx / mag, sy / mag

      local speed = CURSOR_SPEED * accelMag * dt
      c.x = c.x + nx * speed
      c.y = c.y + ny * speed

      -- Clamp to screen
      c.x = math.max(0, math.min(w, c.x))
      c.y = math.max(0, math.min(h, c.y))
    end

    -- === Hover tracking ===
    if eventsModule and treeModule then
      local root = treeModule.getTree()
      if root then
        local hit = eventsModule.hitTest(root, c.x, c.y)
        if hit ~= c.hoveredNode then
          -- Fire pointerLeave / pointerEnter
          if pushEventFn then
            if c.hoveredNode then
              pushEventFn(eventsModule.createEvent(
                "pointerLeave", c.hoveredNode.id, c.x, c.y, nil
              ))
            end
            if hit then
              pushEventFn(eventsModule.createEvent(
                "pointerEnter", hit.id, c.x, c.y, nil
              ))
            end
          end
          c.hoveredNode = hit
        end
      end
    end

    -- === Scroll via right stick ===
    local scx, scy = c.scrollX, c.scrollY
    if math.abs(scx) < SCROLL_DEADZONE then scx = 0 end
    if math.abs(scy) < SCROLL_DEADZONE then scy = 0 end

    if (scx ~= 0 or scy ~= 0) and treeModule and eventsModule then
      local root = treeModule.getTree()
      if root then
        -- Find scroll container under cursor
        local hit = eventsModule.hitTest(root, c.x, c.y)
        local scrollNode = nil
        if hit then
          scrollNode = eventsModule.findScrollContainer(hit, c.x, c.y)
        end
        -- Fallback: find any scroll node if cursor isn't over one
        if not scrollNode then
          scrollNode = GamepadCursor._findAnyScrollNode(root)
        end
        if scrollNode and scrollNode.scrollState then
          local ss = scrollNode.scrollState
          local newX = (ss.scrollX or 0) + scx * SCROLL_SPEED
          local newY = (ss.scrollY or 0) + scy * SCROLL_SPEED
          treeModule.setScroll(scrollNode.id, newX, newY)
          -- Emit scroll event
          if pushEventFn then
            local sc = scrollNode.computed
            pushEventFn(eventsModule.createScrollEvent(
              scrollNode.id,
              scrollNode.scrollState.scrollX or 0,
              scrollNode.scrollState.scrollY or 0,
              scrollNode.scrollState.contentW or (sc and sc.w or 0),
              scrollNode.scrollState.contentH or (sc and sc.h or 0),
              sc and sc.w or 0,
              sc and sc.h or 0,
              eventsModule.buildBubblePath(scrollNode)
            ))
          end
        end
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

-- ============================================================================
-- Click / confirm at cursor position
-- ============================================================================

--- Synthesize a click at the cursor position for a joystick.
--- Returns the hit node (or nil if nothing was hit).
function GamepadCursor.click(joystickId)
  local c = getCursor(joystickId)
  if not c.visible then return nil end
  if not eventsModule or not treeModule or not pushEventFn then return nil end

  local root = treeModule.getTree()
  if not root then return nil end

  local hit = eventsModule.hitTest(root, c.x, c.y)
  if hit then
    local bubblePath = eventsModule.buildBubblePath(hit)
    pushEventFn(eventsModule.createEvent("click", hit.id, c.x, c.y, 1, bubblePath))
    eventsModule.setPressedNode(hit)
    return hit
  end
  return nil
end

--- Synthesize a release at the cursor position.
function GamepadCursor.release(joystickId)
  local c = getCursor(joystickId)
  if not c.visible then return nil end
  if not eventsModule or not treeModule or not pushEventFn then return nil end

  local root = treeModule.getTree()
  if not root then return nil end

  local hit = eventsModule.hitTest(root, c.x, c.y)
  eventsModule.clearPressedNode()
  if hit then
    local bubblePath = eventsModule.buildBubblePath(hit)
    pushEventFn(eventsModule.createEvent("release", hit.id, c.x, c.y, 1, bubblePath))
  end
  return hit
end

--- Get the node currently under the cursor.
function GamepadCursor.getHoveredNode(joystickId)
  local c = getCursor(joystickId)
  return c.hoveredNode
end

-- ============================================================================
-- Draw (called from love.draw, after focus rings)
-- ============================================================================

function GamepadCursor.draw()
  for joystickId, c in pairs(cursors) do
    if not c.visible then goto skip end

    local color = PLAYER_COLORS[((joystickId - 1) % 4) + 1]

    -- Draw arrow cursor
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

    -- Small dot at tip for precision
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.circle("fill", x, y, 2)

    ::skip::
  end
end

return GamepadCursor
