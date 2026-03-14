--[[
  axis_overlay.lua -- Center-axis alignment debug overlay

  For every node in the tree, draws a crosshair through its center:
    - A horizontal line spanning the full container width  (X axis)
    - A vertical line spanning the full container height   (Y axis)
    - A small dot at the center intersection

  Each nesting depth gets a distinct color so you can immediately see
  which axis belongs to which container level. Leaf nodes (no children)
  render at reduced opacity so container axes dominate visually.

  Toggle: Ctrl+Shift+X

  Usage:
    local axisOverlay = require("lua.axis_overlay")
    -- In draw, after painting the app:
    if axisOverlay.active then axisOverlay.draw(root) end
]]

local AxisOverlay = {}

AxisOverlay.active = false

-- 8-color depth palette (distinct hues, high saturation).
-- Cycles when depth exceeds 7.
local DEPTH_COLORS = {
  { 0.95, 0.25, 0.25 },  -- 0: red
  { 0.25, 0.55, 0.98 },  -- 1: blue
  { 0.20, 0.85, 0.40 },  -- 2: green
  { 0.98, 0.85, 0.15 },  -- 3: yellow
  { 0.75, 0.28, 0.98 },  -- 4: purple
  { 0.15, 0.88, 0.88 },  -- 5: cyan
  { 0.98, 0.55, 0.15 },  -- 6: orange
  { 0.98, 0.38, 0.75 },  -- 7: pink
}

local ALPHA_CONTAINER = 0.75  -- nodes with children (containers)
local ALPHA_LEAF      = 0.25  -- leaf nodes (reduced so containers dominate)

local LINE_W_CONTAINER = 1.5
local LINE_W_LEAF      = 1.0
local DOT_RADIUS       = 2.5

local function drawNode(node, depth)
  local c = node.computed
  if not c or c.w <= 2 or c.h <= 2 then return end

  local s = node.style or {}
  if s.display == "none" then return end

  local isContainer = node.children and #node.children > 0
  local col   = DEPTH_COLORS[(depth % #DEPTH_COLORS) + 1]
  local alpha = isContainer and ALPHA_CONTAINER or ALPHA_LEAF
  local lw    = isContainer and LINE_W_CONTAINER or LINE_W_LEAF

  local cx = c.x + c.w * 0.5
  local cy = c.y + c.h * 0.5

  love.graphics.setColor(col[1], col[2], col[3], alpha)
  love.graphics.setLineWidth(lw)

  -- Horizontal center line (full container width)
  love.graphics.line(c.x, cy, c.x + c.w, cy)

  -- Vertical center line (full container height)
  love.graphics.line(cx, c.y, cx, c.y + c.h)

  -- Center dot
  love.graphics.setColor(col[1], col[2], col[3], math.min(alpha + 0.2, 1.0))
  love.graphics.circle("fill", cx, cy, DOT_RADIUS)

  if node.children then
    for _, child in ipairs(node.children) do
      drawNode(child, depth + 1)
    end
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

function AxisOverlay.toggle()
  AxisOverlay.active = not AxisOverlay.active
end

function AxisOverlay.draw(root)
  if not AxisOverlay.active or not root then return end

  love.graphics.push("all")
  love.graphics.origin()
  love.graphics.setScissor()
  love.graphics.setLineStyle("smooth")

  drawNode(root, 0)

  love.graphics.pop()
end

return AxisOverlay
