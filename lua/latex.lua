--[[
  latex.lua -- Main LaTeX math module (Lua-owned primitive)

  Provides:
    - Latex.measure(node, includeWidth?) -> { width, height }
    - Latex.render(node, c, effectiveOpacity)

  Follows the same pattern as codeblock.lua:
    - Weak-keyed per-node render cache
    - Content signature for identity-vs-content change detection
    - Churn detection (same thresholds as CodeBlock)
]]

local Parser  = require("lua.latex_parser")
local LayoutEngine = require("lua.latex_layout")
local Color   = require("lua.color")
local Measure = nil

local Latex = {}

-- Weak-keyed per-node cache
local renderCache = setmetatable({}, { __mode = "k" })

-- ============================================================================
-- Helpers
-- ============================================================================

local function getMeasure()
  if not Measure then
    Measure = require("lua.measure")
  end
  return Measure
end

local function setColorWithOpacity(color, opacity)
  love.graphics.setColor(color[1], color[2], color[3], (color[4] or 1) * opacity)
end

--- Cheap content signature: length + first 64 bytes.
local function contentSig(tex)
  local len = #tex
  if len <= 64 then return len .. ":" .. tex end
  return len .. ":" .. tex:sub(1, 64)
end

local function getNodeEntry(node)
  local entry = renderCache[node]
  if not entry then
    entry = {}
    renderCache[node] = entry
  end
  return entry
end

--- Get or compute the layout box tree for a node.
local function ensureLayout(node)
  local entry = getNodeEntry(node)
  local props = node.props or {}
  local tex = props.tex or ""
  local fontSize = getMeasure().scaleFontSize(props.fontSize or 16, node)

  -- Fast path: same string pointer
  if entry.layout and entry.texPtr == tex and entry.fontSize == fontSize then
    return entry.layout, entry.ast, fontSize
  end

  -- Content signature check
  local sig = contentSig(tex)
  if entry.layout and entry.texSig == sig and entry.fontSize == fontSize then
    entry.texPtr = tex
    return entry.layout, entry.ast, fontSize
  end

  -- Parse and layout
  local ast = Parser.parse(tex)
  local layoutBox = LayoutEngine.layout(ast, fontSize)

  entry.texPtr = tex
  entry.texSig = sig
  entry.fontSize = fontSize
  entry.ast = ast
  entry.layout = layoutBox
  return layoutBox, ast, fontSize
end

-- ============================================================================
-- Init
-- ============================================================================

function Latex.init(config)
  config = config or {}
  Measure = config.measure
end

-- ============================================================================
-- Measurement
-- ============================================================================

function Latex.measure(node, includeWidth)
  local layoutBox = ensureLayout(node)
  local props = node.props or {}
  local s = node.style or {}
  local padding = s.padding or 4

  local result = getNodeEntry(node)._measureResult
  if not result then
    result = { width = 0, height = 0 }
    getNodeEntry(node)._measureResult = result
  end

  local totalH = layoutBox.height + layoutBox.depth
  result.height = totalH + padding * 2

  if includeWidth then
    result.width = layoutBox.width + padding * 2
  else
    result.width = 0
  end

  return result
end

-- ============================================================================
-- Rendering
-- ============================================================================

--- Recursively render a layout box at absolute position (ax, ay).
--- ay corresponds to the baseline of this box.
local function renderBox(box, ax, ay, opacity, textColor)
  if not box then return end

  -- Render glyphs
  if box.glyphs then
    for _, g in ipairs(box.glyphs) do
      local gx = ax + box.x + g.x
      local gy = ay + box.y + g.y

      local font
      if g.useTextFont then
        local weight = g.bold and "bold" or nil
        font = getMeasure().getFont(g.fontSize, nil, weight)
      else
        font = getMeasure().getFont(g.fontSize, "fonts/math/latinmodern-math.otf", nil)
      end

      love.graphics.setFont(font)
      setColorWithOpacity(textColor, opacity)

      -- Adjust y so baseline aligns: Love2D draws from top-left of glyph
      local fontAsc = font:getHeight() - font:getDescent()
      love.graphics.print(g.text, gx, gy - fontAsc)
    end
  end

  -- Render rules (fraction bars, overlines, etc.)
  if box.rules then
    for _, r in ipairs(box.rules) do
      setColorWithOpacity(textColor, opacity)
      local rx = ax + box.x + r.x
      local ry = ay + box.y + r.y
      love.graphics.rectangle("fill", rx, ry, r.width, math.max(1, r.height))
    end
  end

  -- Render children
  if box.children then
    for _, child in ipairs(box.children) do
      renderBox(child, ax + box.x, ay + box.y, opacity, textColor)
    end
  end
end

function Latex.render(node, c, effectiveOpacity)
  local layoutBox, _, fontSize = ensureLayout(node)
  local props = node.props or {}
  local s = node.style or {}
  local padding = s.padding or 4

  -- Background
  if s.backgroundColor then
    local bgColor
    if type(s.backgroundColor) == "string" then
      bgColor = Color.toTable(s.backgroundColor)
    elseif type(s.backgroundColor) == "table" then
      bgColor = s.backgroundColor
    end
    if bgColor then
      setColorWithOpacity(bgColor, effectiveOpacity)
      local br = s.borderRadius or 0
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, br, br)
    end
  end

  -- Border
  if s.borderWidth and s.borderWidth > 0 and s.borderColor then
    local borderColor
    if type(s.borderColor) == "string" then
      borderColor = Color.toTable(s.borderColor)
    elseif type(s.borderColor) == "table" then
      borderColor = s.borderColor
    end
    if borderColor then
      setColorWithOpacity(borderColor, effectiveOpacity)
      love.graphics.setLineWidth(s.borderWidth)
      local br = s.borderRadius or 0
      love.graphics.rectangle("line", c.x, c.y, c.w, c.h, br, br)
    end
  end

  -- Resolve text color
  local textColor = { 1, 1, 1, 1 } -- default white
  local propColor = props.color or s.color
  if propColor then
    if type(propColor) == "string" then
      textColor = Color.toTable(propColor)
    elseif type(propColor) == "table" then
      textColor = propColor
    end
  end

  -- Scissor to content area
  local psx, psy, psw, psh = love.graphics.getScissor()
  local sx, sy = love.graphics.transformPoint(c.x, c.y)
  local sx2, sy2 = love.graphics.transformPoint(c.x + c.w, c.y + c.h)
  local sw, sh = math.max(0, sx2 - sx), math.max(0, sy2 - sy)
  love.graphics.intersectScissor(sx, sy, sw, sh)

  -- Position: center content in available space
  local contentW = layoutBox.width
  local contentH = layoutBox.height + layoutBox.depth

  -- Baseline position: padding + ascent
  local baselineX = c.x + padding
  local baselineY = c.y + padding + layoutBox.height

  -- Center vertically if allocated more space than needed
  local innerH = c.h - padding * 2
  if contentH < innerH then
    baselineY = c.y + padding + (innerH - contentH) / 2 + layoutBox.height
  end

  -- Center horizontally if allocated more space than needed
  local innerW = c.w - padding * 2
  if contentW < innerW then
    baselineX = c.x + padding + (innerW - contentW) / 2
  end

  -- Render the box tree
  renderBox(layoutBox, baselineX, baselineY, effectiveOpacity, textColor)

  -- Restore scissor
  if psx then
    love.graphics.setScissor(psx, psy, psw, psh)
  else
    love.graphics.setScissor()
  end
end

return Latex
