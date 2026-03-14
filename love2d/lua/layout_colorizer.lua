--[[
  layout_colorizer.lua -- Visual layout debugging overlay

  Paints every node in the instance tree with a distinct semi-transparent
  color so you can instantly see flex boundaries, overflow, and sizing
  issues. Each depth level gets a different hue, and siblings cycle
  through saturation variants so adjacent boxes are always distinguishable.

  Toggle: Ctrl+Shift+L  (registered in devtools.lua keypressed)

  Usage:
    local colorizer = require("lua.layout_colorizer")
    -- In draw, after painting the app:
    if colorizer.active then colorizer.draw(root) end
]]

local Colorizer = {}

Colorizer.active = false

-- ============================================================================
-- Color generation
-- ============================================================================

-- Golden-angle hue rotation ensures max visual distance between siblings.
-- Each node gets a unique hue based on a running counter.
local nodeCounter = 0

local function hslToRgb(h, s, l)
  if s == 0 then return l, l, l end
  local function hue2rgb(p, q, t)
    if t < 0 then t = t + 1 end
    if t > 1 then t = t - 1 end
    if t < 1/6 then return p + (q - p) * 6 * t end
    if t < 1/2 then return q end
    if t < 2/3 then return p + (q - p) * (2/3 - t) * 6 end
    return p
  end
  local q = l < 0.5 and l * (1 + s) or l + s - l * s
  local p = 2 * l - q
  return hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3)
end

local function nodeColor(index, depth)
  -- Golden angle (~137.5°) ensures siblings never share a hue
  local hue = (index * 0.618033988749895) % 1.0
  -- Deeper nodes are slightly more saturated/lighter
  local sat = 0.6 + math.min(depth, 6) * 0.04
  local lit = 0.45 + math.min(depth, 6) * 0.03
  local r, g, b = hslToRgb(hue, sat, lit)
  return r, g, b
end

-- ============================================================================
-- Tree walker
-- ============================================================================

local ALPHA_FILL   = 0.12  -- semi-transparent fill
local ALPHA_BORDER = 0.5   -- visible border
local BORDER_WIDTH = 1

local function drawNode(node, depth)
  local c = node.computed
  if not c or c.w <= 0 or c.h <= 0 then return end

  local s = node.style or {}
  if s.display == "none" then return end

  local r, g, b = nodeColor(nodeCounter, depth)
  nodeCounter = nodeCounter + 1

  -- Fill
  love.graphics.setColor(r, g, b, ALPHA_FILL)
  love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)

  -- Border
  love.graphics.setColor(r, g, b, ALPHA_BORDER)
  love.graphics.setLineWidth(BORDER_WIDTH)
  love.graphics.rectangle("line", c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1)

  -- Recurse into children
  if node.children then
    for _, child in ipairs(node.children) do
      drawNode(child, depth + 1)
    end
  end
end

-- ============================================================================
-- Public API
-- ============================================================================

function Colorizer.toggle()
  Colorizer.active = not Colorizer.active
end

function Colorizer.draw(root)
  if not Colorizer.active or not root then return end

  love.graphics.push("all")
  love.graphics.origin()
  love.graphics.setScissor()

  nodeCounter = 0
  drawNode(root, 0)

  love.graphics.pop()
end

return Colorizer
