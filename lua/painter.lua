--[[
  painter.lua -- Love2D draw calls for the retained element tree

  Walks the tree produced by tree.lua (after layout.lua has computed positions)
  and issues Love2D graphics calls to render each node.

  Supports:
    - View/box: backgroundColor, borderRadius, borderWidth, borderColor, opacity
    - Text/__TEXT__: color, textAlign, fontSize (with font cache), opacity
    - Custom font families via fontFamily (path to .ttf/.otf)
    - Text truncation with ellipsis (textOverflow, numberOfLines)
    - lineHeight override (manual line-by-line rendering when set)
    - letterSpacing (character-by-character rendering -- known to be expensive)
    - Image: actual image rendering with scaling, opacity, and borderRadius
    - Video: libmpv-backed playback with objectFit, play/pause/loop/volume control
    - Opacity propagation: nested opacity values multiply down the tree
    - overflow:hidden with borderRadius > 0: stencil-based clipping with nesting support
    - overflow:hidden with borderRadius = 0: scissor-based rectangular clipping
    - zIndex: explicit stacking order for children (paint-order only, no layout effect)
    - overflow:scroll: scrollable containers with scissor clipping and scroll transform
    - Box shadows: drop shadow with blur simulation
    - Gradients: linear gradient backgrounds (horizontal, vertical, diagonal)
    - Transforms: translate, rotate, scale with transform origin
]]

local Measure = nil  -- Injected at init time via Painter.init()
local Images = nil   -- Injected at init time via Painter.init()
local Videos = nil   -- Injected at init time via Painter.init()
local Scene3DModule = nil -- Injected at init time via Painter.init()
local MapModule = nil     -- Injected at init time via Painter.init()
local GeoScene3DModule = nil -- Injected at init time via Painter.init()
local ChartModule = nil   -- Lazy-loaded to avoid circular deps
local GameModule = nil    -- Injected at init time via Painter.init()
local EmulatorModule = nil -- Injected at init time via Painter.init()
local RenderSourceModule = nil -- Injected at init time via Painter.init()
local EffectsModule = nil  -- Injected at init time via Painter.init()
local MasksModule = nil    -- Injected at init time via Painter.init()
local CapabilitiesModule = nil  -- Lazy-loaded on first use
local ZIndex = require("lua.zindex")
local Color = require("lua.color")
local Log = require("lua.debug_log")

-- Frame budget: max paintNode calls per paint pass.
local _paintBudget = 100000
local _paintCount = 0
local TextEditorModule = nil  -- Lazy-loaded to avoid circular deps
local TextInputModule = nil   -- Lazy-loaded to avoid circular deps
local CodeBlockModule = nil   -- Lazy-loaded to avoid circular deps
local LatexModule = nil       -- Lazy-loaded to avoid circular deps
local VideoPlayerModule = nil -- Lazy-loaded to avoid circular deps
local SliderModule = nil     -- Lazy-loaded to avoid circular deps
local FaderModule = nil      -- Lazy-loaded to avoid circular deps
local KnobModule = nil       -- Lazy-loaded to avoid circular deps
local SwitchModule = nil     -- Lazy-loaded to avoid circular deps
local CheckboxModule = nil   -- Lazy-loaded to avoid circular deps
local RadioModule = nil      -- Lazy-loaded to avoid circular deps
local SelectModule = nil     -- Lazy-loaded to avoid circular deps
local PianoKeyboardModule = nil  -- Lazy-loaded to avoid circular deps
local StepSequencerModule = nil  -- Lazy-loaded to avoid circular deps
local XYPadModule = nil
local PitchWheelModule = nil
local TickerTapeModule = nil
local OrderBookModule = nil
local TextSelectionModule = nil  -- Lazy-loaded to avoid circular deps
local ok_utf8, utf8lib = pcall(function() return utf8 end)
if not ok_utf8 or not utf8lib then
  local ok_require, mod = pcall(require, "utf8")
  if ok_require then
    utf8lib = mod
  else
    utf8lib = nil
  end
end

local Painter = {}

-- Set during Painter.init() from the injected measure module
local getFont = nil

-- Theme reference (set by init.lua via Painter.setTheme())
local currentTheme = nil

--- Update the active theme reference. Called by init.lua on theme switch.
function Painter.setTheme(theme)
  currentTheme = theme
end

--- Initialize the painter with target-specific dependencies.
--- Must be called before any paint operations.
--- @param config table  { measure = MeasureModule, images = ImagesModule }
function Painter.init(config)
  config = config or {}
  Measure = config.measure
  Images = config.images
  Videos = config.videos
  Scene3DModule = config.scene3d
  MapModule = config.map
  GeoScene3DModule = config.geoscene3d
  GameModule = config.game
  EmulatorModule = config.emulator
  RenderSourceModule = config.render_source
  EffectsModule = config.effects
  MasksModule = config.masks
  getFont = Measure.getFont
end

-- ============================================================================
-- Color helpers
-- ============================================================================

--- Set the active Love2D drawing color.
--- Delegates to lua/color.lua for parsing (hex, named, rgb(), hsl(), tables).
Painter.setColor = Color.set

--- Apply opacity multiplier to the current drawing color.
--- Call this after setColor to apply inherited/effective opacity.
--- @param opacity number between 0 and 1
function Painter.applyOpacity(opacity)
  if opacity >= 1 then return end
  local r, g, b, a = love.graphics.getColor()
  love.graphics.setColor(r, g, b, a * opacity)
end

-- ============================================================================
-- Text truncation helpers
-- ============================================================================

local ELLIPSIS = "..."

--- Truncate a single line of text so that the text + ellipsis fits within maxWidth.
--- Uses a binary search over character positions for efficiency.
--- @param font    love.Font  The font used for width measurement.
--- @param text    string     The full text to truncate.
--- @param maxWidth number    The maximum pixel width available.
--- @param letterSpacing number|nil  Extra space between characters (included in width calc).
--- @return string  The truncated text ending with "..." (or original if it fits).
function Painter.truncateWithEllipsis(font, text, maxWidth, letterSpacing)
  local textWidth = Measure.getWidthWithSpacing(font, text, letterSpacing)
  if textWidth <= maxWidth then
    return text
  end

  local ellipsisW = Measure.getWidthWithSpacing(font, ELLIPSIS, letterSpacing)
  local available = maxWidth - ellipsisW
  if available <= 0 then
    return ELLIPSIS
  end

  -- Binary search for the longest prefix that fits within `available`
  local lo, hi = 0, #text
  while lo < hi do
    local mid = math.floor((lo + hi + 1) / 2)
    local prefix = text:sub(1, mid)
    local pw = Measure.getWidthWithSpacing(font, prefix, letterSpacing)
    if pw <= available then
      lo = mid
    else
      hi = mid - 1
    end
  end

  if lo == 0 then
    return ELLIPSIS
  end

  return text:sub(1, lo) .. ELLIPSIS
end

--- Apply numberOfLines truncation to text that will be rendered within maxWidth.
--- Returns the (possibly truncated) list of wrapped lines.
--- @param font          love.Font  The font used for wrapping/measurement.
--- @param text          string     The full text content.
--- @param maxWidth      number     The wrapping width constraint.
--- @param numberOfLines number|nil Max number of visible lines.
--- @param textOverflow  string|nil "ellipsis" to add "..." on the last truncated line.
--- @param letterSpacing number|nil Extra space between characters.
--- @return table  Array of line strings ready to render.
function Painter.getVisibleLines(font, text, maxWidth, numberOfLines, textOverflow, letterSpacing)
  -- Normalize line endings (Windows \r\n → \n)
  text = text:gsub("\r\n", "\n"):gsub("\r", "\n")
  -- When letterSpacing is set, reduce the wrap width to approximate wider characters
  local wrapConstraint = maxWidth
  if letterSpacing and letterSpacing ~= 0 then
    local avgCharW = font:getWidth("M")
    if avgCharW > 0 then
      local ratio = avgCharW / (avgCharW + letterSpacing)
      wrapConstraint = maxWidth * ratio
    end
  end

  local _, lines = font:getWrap(text, wrapConstraint)
  if #lines == 0 then
    lines = { "" }
  end

  -- If no line limit or text fits, return all lines
  if not numberOfLines or numberOfLines <= 0 or #lines <= numberOfLines then
    return lines
  end

  -- Truncate to numberOfLines
  local visible = {}
  for i = 1, numberOfLines do
    visible[i] = lines[i]
  end

  -- If ellipsis mode, truncate the last visible line with "..."
  if textOverflow == "ellipsis" and numberOfLines > 0 then
    local lastLine = visible[numberOfLines]
    visible[numberOfLines] = Painter.truncateWithEllipsis(font, lastLine, maxWidth, letterSpacing)
  end

  return visible
end

-- ============================================================================
-- Text rendering helpers
-- ============================================================================

local drawLineNormal  -- forward declaration (used by drawLineWithSpacing fallback)

--- Render a single line of text with letter spacing by drawing each character
--- individually. This is expensive and should only be used when letterSpacing ~= 0.
--- NOTE: Character-by-character rendering has a known performance cost. Only
--- activated when letterSpacing is explicitly set to a non-zero value.
--- @param font          love.Font
--- @param text          string
--- @param x             number      Draw X origin.
--- @param y             number      Draw Y origin.
--- @param letterSpacing number      Extra pixels between characters.
--- @param align         string      "left", "center", or "right".
--- @param maxWidth      number      Available width for alignment.
local function drawLineWithSpacing(font, text, x, y, letterSpacing, align, maxWidth)
  if text == "" then return end

  local totalW = Measure.getWidthWithSpacing(font, text, letterSpacing)

  -- Calculate starting X based on alignment
  local startX = x
  if align == "center" then
    startX = x + (maxWidth - totalW) / 2
  elseif align == "right" then
    startX = x + maxWidth - totalW
  end

  local ok, err = pcall(function()
    local cx = startX
    if utf8lib and utf8lib.codes and utf8lib.char then
      for _, codepoint in utf8lib.codes(text) do
        local ch = utf8lib.char(codepoint)
        love.graphics.print(ch, cx, y)
        cx = cx + font:getWidth(ch) + letterSpacing
      end
    else
      for i = 1, #text do
        local ch = text:sub(i, i)
        love.graphics.print(ch, cx, y)
        cx = cx + font:getWidth(ch) + letterSpacing
      end
    end
  end)

  -- Defensive fallback: invalid UTF-8 should not crash the entire frame.
  if not ok then
    print("[painter] drawLineWithSpacing UTF-8 error: " .. tostring(err))
    drawLineNormal(font, text, x, y, align, maxWidth)
  end
end

--- Render a single line of text without letter spacing.
--- Uses love.graphics.printf for alignment support.
--- @param font     love.Font
--- @param text     string
--- @param x        number
--- @param y        number
--- @param align    string   "left", "center", or "right"
--- @param maxWidth number
drawLineNormal = function(font, text, x, y, align, maxWidth)
  love.graphics.printf(text, x, y, maxWidth, align)
end

--- Render a single line without wrapping. maxWidth is used only for alignment.
local function drawLineNoWrap(font, text, x, y, align, maxWidth)
  local textW = font:getWidth(text)
  local drawX = x
  if align == "center" then
    drawX = x + (maxWidth - textW) / 2
  elseif align == "right" then
    drawX = x + maxWidth - textW
  end
  love.graphics.print(text, drawX, y)
end

-- ============================================================================
-- Resolve text style properties (inheriting from parent Text for __TEXT__)
-- ============================================================================

--- Resolve fontFamily, inheriting from parent Text node for __TEXT__ children.
local function resolveFontFamily(node)
  local s = node.style or {}
  if s.fontFamily then return s.fontFamily end
  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.fontFamily then return ps.fontFamily end
  end
  return nil
end

--- Resolve lineHeight, inheriting from parent Text node for __TEXT__ children.
local function resolveLineHeight(node)
  local s = node.style or {}
  if s.lineHeight then return s.lineHeight end
  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.lineHeight then return ps.lineHeight end
  end
  return nil
end

--- Resolve letterSpacing, inheriting from parent Text node for __TEXT__ children.
local function resolveLetterSpacing(node)
  local s = node.style or {}
  if s.letterSpacing then return s.letterSpacing end
  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.letterSpacing then return ps.letterSpacing end
  end
  return nil
end

--- Resolve textOverflow, inheriting from parent Text node for __TEXT__ children.
local function resolveTextOverflow(node)
  local s = node.style or {}
  if s.textOverflow then return s.textOverflow end
  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.textOverflow then return ps.textOverflow end
  end
  return nil
end

--- Resolve text wrapping mode. Supports whiteSpace/textWrap aliases.
local function resolveTextNoWrap(node)
  local s = node.style or {}
  if s.textWrap == "nowrap" or s.whiteSpace == "nowrap" then return true end
  if s.textWrap == "wrap" or s.whiteSpace == "normal" then return false end

  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.textWrap == "nowrap" or ps.whiteSpace == "nowrap" then return true end
    if ps.textWrap == "wrap" or ps.whiteSpace == "normal" then return false end
  end

  return false
end

--- Resolve numberOfLines, inheriting from parent Text node for __TEXT__ children.
local function resolveNumberOfLines(node)
  local p = node.props or {}
  if p.numberOfLines then return p.numberOfLines end
  if node.type == "__TEXT__" and node.parent then
    local pp = node.parent.props or {}
    if pp.numberOfLines then return pp.numberOfLines end
  end
  return nil
end

-- ============================================================================
-- Box shadow helper
-- ============================================================================

--- Draw a box shadow by rendering multiple slightly larger rectangles
--- with progressively fading opacity to simulate blur.
--- @param x number Left edge of the box
--- @param y number Top edge of the box
--- @param w number Width of the box
--- @param h number Height of the box
--- @param borderRadius number Border radius for rounded corners
--- @param shadowColor table Shadow color
--- @param offsetX number Horizontal shadow offset
--- @param offsetY number Vertical shadow offset
--- @param blur number Blur radius (approximate)
--- @param effectiveOpacity number Combined opacity from parent chain
local function drawBoxShadow(x, y, w, h, borderRadius, shadowColor, offsetX, offsetY, blur, effectiveOpacity)
  if not shadowColor or blur <= 0 then return end

  -- Cap blur steps for performance
  local blurSteps = math.ceil(blur)
  if blurSteps > 10 then blurSteps = 10 end
  if blurSteps < 1 then blurSteps = 1 end

  -- Parse shadow color and apply effective opacity
  Painter.setColor(shadowColor)
  local r, g, b, a = love.graphics.getColor()
  local baseAlpha = a * effectiveOpacity

  -- Draw multiple rectangles from outermost to innermost, fading out
  for i = blurSteps, 1, -1 do
    local expand = i
    local alpha = (baseAlpha / blurSteps) * (blurSteps - i + 1)
    love.graphics.setColor(r, g, b, alpha)

    local sx = x + offsetX - expand
    local sy = y + offsetY - expand
    local sw = w + expand * 2
    local sh = h + expand * 2
    local sr = borderRadius + expand

    love.graphics.rectangle("fill", sx, sy, sw, sh, sr, sr)
  end
end

-- ============================================================================
-- Gradient background helper
-- ============================================================================

--- Draw a gradient background using Love2D's mesh API.
--- @param x number Left edge
--- @param y number Top edge
--- @param w number Width
--- @param h number Height
--- @param direction string 'horizontal', 'vertical', or 'diagonal'
--- @param color1 table Start color
--- @param color2 table End color
--- @param effectiveOpacity number Combined opacity from parent chain
local function drawGradient(x, y, w, h, direction, color1, color2, effectiveOpacity)
  -- Parse colors
  Painter.setColor(color1)
  local r1, g1, b1, a1 = love.graphics.getColor()
  a1 = a1 * effectiveOpacity

  Painter.setColor(color2)
  local r2, g2, b2, a2 = love.graphics.getColor()
  a2 = a2 * effectiveOpacity

  -- Create gradient vertices based on direction
  local vertices
  if direction == "horizontal" then
    vertices = {
      {x, y, 0, 0, r1, g1, b1, a1},       -- top-left
      {x + w, y, 1, 0, r2, g2, b2, a2},   -- top-right
      {x + w, y + h, 1, 1, r2, g2, b2, a2}, -- bottom-right
      {x, y + h, 0, 1, r1, g1, b1, a1},   -- bottom-left
    }
  elseif direction == "diagonal" then
    vertices = {
      {x, y, 0, 0, r1, g1, b1, a1},       -- top-left
      {x + w, y, 0.5, 0, r1 * 0.5 + r2 * 0.5, g1 * 0.5 + g2 * 0.5, b1 * 0.5 + b2 * 0.5, (a1 + a2) * 0.5},
      {x + w, y + h, 1, 1, r2, g2, b2, a2}, -- bottom-right
      {x, y + h, 0.5, 1, r1 * 0.5 + r2 * 0.5, g1 * 0.5 + g2 * 0.5, b1 * 0.5 + b2 * 0.5, (a1 + a2) * 0.5},
    }
  else  -- vertical (default)
    vertices = {
      {x, y, 0, 0, r1, g1, b1, a1},       -- top-left
      {x + w, y, 1, 0, r1, g1, b1, a1},   -- top-right
      {x + w, y + h, 1, 1, r2, g2, b2, a2}, -- bottom-right
      {x, y + h, 0, 1, r2, g2, b2, a2},   -- bottom-left
    }
  end

  -- Create and draw mesh
  local mesh = love.graphics.newMesh(vertices, "fan", "static")
  love.graphics.setColor(1, 1, 1, 1)  -- Reset to white so mesh colors show correctly
  love.graphics.draw(mesh)
end

-- ============================================================================
-- Arc sector / polygon helpers (for PieChart, RadarChart, etc.)
-- ============================================================================

--- Draw a filled pie/donut slice.
--- @param c     table  Computed rect {x, y, w, h}
--- @param arc   table  { startAngle, endAngle, innerRadius? }
local function drawArcSector(c, arc)
  local cx = c.x + c.w * 0.5
  local cy = c.y + c.h * 0.5
  local r  = math.min(c.w, c.h) * 0.5
  local ir = arc.innerRadius or 0
  local a0 = arc.startAngle
  local a1 = arc.endAngle

  -- Enough steps for a smooth curve (≥ 1 step per ~2px of arc length)
  local span  = math.abs(a1 - a0)
  local steps = math.max(8, math.floor(span * r * 0.5))

  local verts = {}
  if ir > 0 then
    -- Annular sector: outer arc forward, inner arc backward
    for i = 0, steps do
      local a = a0 + (a1 - a0) * (i / steps)
      verts[#verts + 1] = cx + math.cos(a) * r
      verts[#verts + 1] = cy + math.sin(a) * r
    end
    for i = steps, 0, -1 do
      local a = a0 + (a1 - a0) * (i / steps)
      verts[#verts + 1] = cx + math.cos(a) * ir
      verts[#verts + 1] = cy + math.sin(a) * ir
    end
  else
    -- Solid slice: fan from center
    verts[1] = cx
    verts[2] = cy
    for i = 0, steps do
      local a = a0 + (a1 - a0) * (i / steps)
      verts[#verts + 1] = cx + math.cos(a) * r
      verts[#verts + 1] = cy + math.sin(a) * r
    end
  end

  if #verts >= 6 then
    love.graphics.polygon("fill", verts)
  end
end

--- Draw a filled polygon from a flat [x0,y0,x1,y1,...] list relative to box origin.
--- @param c    table   Computed rect {x, y, w, h}
--- @param pts  table   Flat array of coordinates
local function drawPolygon(c, pts)
  if #pts < 6 then return end
  local verts = {}
  for i = 1, #pts, 2 do
    verts[#verts + 1] = c.x + pts[i]
    verts[#verts + 1] = c.y + pts[i + 1]
  end
  love.graphics.polygon("fill", verts)
end

--- Draw stroked polyline paths scaled from a 24x24 viewBox to box dimensions.
--- Used for vector icon rendering (Lucide icons etc.).
--- @param c           table     Computed rect {x, y, w, h}
--- @param paths       table     Array of polyline arrays, each [x0,y0,x1,y1,...]
--- @param strokeWidth number    Line thickness before scaling (default 2)
local function drawStrokePaths(c, paths, strokeWidth)
  local sx = c.w / 24
  local sy = c.h / 24
  local scale = math.min(sx, sy)
  love.graphics.setLineWidth((strokeWidth or 2) * scale)
  -- Love build in this repo accepts only: none/miter/bevel.
  love.graphics.setLineJoin("bevel")
  love.graphics.setLineStyle("smooth")
  for _, path in ipairs(paths) do
    if #path >= 4 then
      local scaled = {}
      for i = 1, #path, 2 do
        scaled[#scaled + 1] = c.x + path[i] * sx
        scaled[#scaled + 1] = c.y + path[i + 1] * sy
      end
      love.graphics.line(scaled)
    end
  end
  love.graphics.setLineWidth(1)
  love.graphics.setLineStyle("rough")
end

-- ============================================================================
-- Per-corner border radius helper
-- ============================================================================

--- Draw a filled or stroked rectangle with per-corner border radii.
--- Uses arc segments for each corner and polygon fill for the body.
--- Falls back to love.graphics.rectangle() when all radii are equal.
--- @param mode string "fill" or "line"
--- @param x number Left edge
--- @param y number Top edge
--- @param w number Width
--- @param h number Height
--- @param tl number Top-left radius
--- @param tr number Top-right radius
--- @param bl number Bottom-left radius
--- @param br number Bottom-right radius
local function drawRoundedRect(mode, x, y, w, h, tl, tr, bl, br)
  -- Clamp radii to half the shortest dimension
  local maxR = math.min(w, h) / 2
  tl = math.min(tl, maxR)
  tr = math.min(tr, maxR)
  bl = math.min(bl, maxR)
  br = math.min(br, maxR)

  -- If all corners are the same, use Love2D's built-in (faster)
  if tl == tr and tr == bl and bl == br then
    love.graphics.rectangle(mode, x, y, w, h, tl, tl)
    return
  end

  -- Build polygon vertices: top-left arc, top-right arc, bottom-right arc, bottom-left arc
  local segments = 8  -- arc segments per corner
  local vertices = {}
  local function addArc(cx, cy, r, startAngle, endAngle)
    if r <= 0 then
      vertices[#vertices + 1] = cx
      vertices[#vertices + 1] = cy
      return
    end
    for i = 0, segments do
      local angle = startAngle + (endAngle - startAngle) * (i / segments)
      vertices[#vertices + 1] = cx + math.cos(angle) * r
      vertices[#vertices + 1] = cy + math.sin(angle) * r
    end
  end

  -- Top-left corner (arc from pi to 3pi/2)
  addArc(x + tl, y + tl, tl, math.pi, math.pi * 1.5)
  -- Top-right corner (arc from 3pi/2 to 2pi)
  addArc(x + w - tr, y + tr, tr, math.pi * 1.5, math.pi * 2)
  -- Bottom-right corner (arc from 0 to pi/2)
  addArc(x + w - br, y + h - br, br, 0, math.pi * 0.5)
  -- Bottom-left corner (arc from pi/2 to pi)
  addArc(x + bl, y + h - bl, bl, math.pi * 0.5, math.pi)

  if mode == "fill" then
    love.graphics.polygon("fill", vertices)
  else
    love.graphics.polygon("line", vertices)
  end
end

--- Resolve per-corner border radii from style properties.
--- Returns tl, tr, bl, br (top-left, top-right, bottom-left, bottom-right).
--- Per-corner properties override the uniform borderRadius.
--- @param s table The node's style table
--- @return number, number, number, number
local function resolveCornerRadii(s)
  local uniform = s.borderRadius or 0
  local tl = s.borderTopLeftRadius or uniform
  local tr = s.borderTopRightRadius or uniform
  local bl = s.borderBottomLeftRadius or uniform
  local br = s.borderBottomRightRadius or uniform
  return tl, tr, bl, br
end

--- Check if a node has non-uniform per-corner border radii.
local function hasPerCornerRadius(s)
  return s.borderTopLeftRadius or s.borderTopRightRadius
      or s.borderBottomLeftRadius or s.borderBottomRightRadius
end

-- ============================================================================
-- Transform helper
-- ============================================================================

--- Apply Love2D transform stack operations for a node's transform property.
--- Returns true if a transform was applied (caller must pop after painting).
--- NOTE: Transforms are visual only and do not affect layout positions or hit testing.
--- This matches CSS behavior but means rotated/scaled elements will still use their
--- original layout rectangles for pointer events.
--- @param transform table The transform style property
--- @param c table The computed rect {x, y, w, h}
--- @return boolean Whether a transform was applied
local function applyTransform(transform, c)
  if not transform then return false end

  -- Check if any transform is actually set
  local hasTransform = transform.translateX or transform.translateY or
                       transform.rotate or transform.scaleX or transform.scaleY or
                       transform.skewX or transform.skewY
  if not hasTransform then return false end

  love.graphics.push()

  -- Compute transform origin (default center)
  local originX = transform.originX or 0.5
  local originY = transform.originY or 0.5
  local ox = c.x + originX * c.w
  local oy = c.y + originY * c.h

  -- Move to transform origin
  love.graphics.translate(ox, oy)

  -- Apply rotation
  if transform.rotate then
    love.graphics.rotate(math.rad(transform.rotate))
  end

  -- Apply scale
  if transform.scaleX or transform.scaleY then
    love.graphics.scale(transform.scaleX or 1, transform.scaleY or 1)
  end

  -- Apply skew (shear)
  if transform.skewX or transform.skewY then
    local kx = transform.skewX and math.tan(math.rad(transform.skewX)) or 0
    local ky = transform.skewY and math.tan(math.rad(transform.skewY)) or 0
    love.graphics.shear(kx, ky)
  end

  -- Move back from origin
  love.graphics.translate(-ox, -oy)

  -- Apply additional translation
  if transform.translateX or transform.translateY then
    love.graphics.translate(transform.translateX or 0, transform.translateY or 0)
  end

  return true
end

-- ============================================================================
-- Video frame helper (shared by Video, backgroundVideo, hoverVideo)
-- ============================================================================

--- Draw a video canvas frame at a given rect with objectFit and optional borderRadius clipping.
--- @param canvas love.Canvas  The video frame canvas
--- @param src string          Video source key (for dimension lookup)
--- @param c table             Computed rect {x, y, w, h}
--- @param objectFit string    "fill", "contain", or "cover"
--- @param borderRadius number Clip radius (0 = no clipping)
--- @param stencilDepth number Current stencil nesting depth
--- @param effectiveOpacity number Combined opacity
local function drawVideoFrame(canvas, src, c, objectFit, borderRadius, stencilDepth, effectiveOpacity)
  local vidW, vidH = Videos.getDimensions(src)
  if not vidW then vidW, vidH = canvas:getWidth(), canvas:getHeight() end

  local scaleX, scaleY, drawX, drawY
  objectFit = objectFit or "cover"

  if objectFit == "contain" then
    local scale = math.min(c.w / vidW, c.h / vidH)
    scaleX, scaleY = scale, scale
    drawX = c.x + (c.w - vidW * scale) / 2
    drawY = c.y + (c.h - vidH * scale) / 2
  elseif objectFit == "cover" then
    local scale = math.max(c.w / vidW, c.h / vidH)
    scaleX, scaleY = scale, scale
    drawX = c.x + (c.w - vidW * scale) / 2
    drawY = c.y + (c.h - vidH * scale) / 2
  else -- "fill"
    scaleX = c.w / vidW
    scaleY = c.h / vidH
    drawX = c.x
    drawY = c.y
  end

  -- Stencil clip for border radius
  local needClip = borderRadius > 0
  if needClip then
    local stencilValue = stencilDepth + 1
    love.graphics.stencil(function()
      love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
    end, "replace", stencilValue, stencilDepth > 0)
    love.graphics.setStencilTest("greater", stencilDepth)
  end

  love.graphics.setColor(1, 1, 1, effectiveOpacity)
  love.graphics.draw(canvas, drawX, drawY, 0, scaleX, scaleY)

  if needClip then
    if stencilDepth > 0 then
      love.graphics.setStencilTest("greater", stencilDepth - 1)
    else
      love.graphics.setStencilTest()
    end
  end
end

-- ============================================================================
-- Node painter (recursive)
-- ============================================================================

--- Paint a single node and recurse into its children.
--- @param node table The node to paint
--- @param inheritedOpacity number Accumulated opacity from parent chain (default 1)
--- @param stencilDepth number Current stencil nesting depth (default 0)
-- Debug: log first N frames of paint decisions for each node type
local _paintDbgEnabled = false  -- flip to true to re-enable PAINT-DBG spam
local _paintDbgCount = 0
local _paintDbgSeen = {}  -- type -> count

function Painter.paintNode(node, inheritedOpacity, stencilDepth)
  if not node or not node.computed then return end
  _paintCount = _paintCount + 1
  if _paintCount > _paintBudget then
    error(string.format(
      "[BUDGET] Paint pass exceeded %d nodes (last node: id=%s type=%s). Likely infinite loop.",
      _paintBudget, tostring(node.id), tostring(node.type)))
  end
  local _pt0 = love.timer.getTime()

  -- Debug logging for first 3 encounters of each type (set to true to re-enable)
  local dbgType = node.type or "nil"
  _paintDbgSeen[dbgType] = (_paintDbgSeen[dbgType] or 0) + 1
  local dbgN = _paintDbgSeen[dbgType]
  local dbgLog = _paintDbgEnabled and dbgN <= 3
  if dbgLog then
    local c = node.computed
    io.write(string.format("[PAINT-DBG] type=%s id=%s computed=%dx%d@(%d,%d) children=%d\n",
      dbgType, tostring(node.id), c.w or 0, c.h or 0, c.x or 0, c.y or 0,
      #(node.children or {})))
    io.flush()
  end

  -- Non-visual capability nodes (Audio, Timer, etc.) are managed by capabilities.lua.
  -- They don't paint anything — skip entirely.
  if not CapabilitiesModule then
    local ok, mod = pcall(require, "lua.capabilities")
    if ok then CapabilitiesModule = mod end
  end
  if CapabilitiesModule and CapabilitiesModule.isNonVisual(node.type)
     and not CapabilitiesModule.rendersInOwnSurface(node.type) then
    if dbgLog then io.write(string.format("[PAINT-DBG] SKIP non-visual: %s\n", dbgType)); io.flush() end
    return
  end

  -- Nodes that render in their own surface (Window capability) are painted in a
  -- separate pass by the multi-window paint loop in init.lua. Skip them here
  -- unless they are the active window root being painted right now.
  if CapabilitiesModule and CapabilitiesModule.rendersInOwnSurface(node.type)
     and not node._isWindowRoot then
    if dbgLog then io.write(string.format("[PAINT-DBG] SKIP rendersInOwnSurface: %s (isWindowRoot=%s)\n", dbgType, tostring(node._isWindowRoot))); io.flush() end
    return
  end

  -- 3D child nodes (Mesh3D, Camera3D, Light3D, etc.) are rendered by scene3d.lua,
  -- not by the 2D painter. Skip them entirely.
  if Scene3DModule and Scene3DModule.is3DChildType(node.type) then return end

  -- Map child nodes (MapTileLayer, MapMarker, etc.) are rendered by map.lua,
  -- not by the 2D painter. Skip them entirely.
  if MapModule and MapModule.isMapChildType(node.type) then return end

  -- GeoScene3D child nodes are rendered by geoscene3d.lua.
  if GeoScene3DModule and GeoScene3DModule.isGeoChildType(node.type) then return end

  inheritedOpacity = inheritedOpacity or 1
  stencilDepth = stencilDepth or 0

  local c = node.computed
  local s = node.style or {}

  -- display:none -- skip this node and all its children entirely
  if s.display == "none" then return end

  -- visibility:hidden -- layout occupies space but skip painting (children still paint)
  local isHidden = s.visibility == "hidden"

  -- Calculate effective opacity for this node
  local nodeOpacity = s.opacity or 1
  local effectiveOpacity = nodeOpacity * inheritedOpacity

  -- Early exit optimization: skip rendering entirely if fully transparent
  if effectiveOpacity <= 0 then return end

  -- Apply transform (affects this node and all children)
  local didTransform = applyTransform(s.transform, c)

  -- Resolve border radii (per-corner or uniform)
  local tl, tr, bl, br = resolveCornerRadii(s)
  local borderRadius = s.borderRadius or 0
  local hasRoundedCorners = tl > 0 or tr > 0 or bl > 0 or br > 0
  local isPerCorner = hasPerCornerRadius(s)
  local isScroll = s.overflow == "scroll" or s.overflow == "auto"
  local needsClipping = s.overflow == "hidden" or isScroll
  local useStencil = needsClipping and hasRoundedCorners
  local useScissor = needsClipping and not hasRoundedCorners
  local prevScissor
  local prevStencilDepth = stencilDepth  -- save before any modification

  -- Apply stencil clipping for rounded corners
  if useStencil then
    local stencilValue = stencilDepth + 1
    love.graphics.stencil(function()
      if isPerCorner then
        drawRoundedRect("fill", c.x, c.y, c.w, c.h, tl, tr, bl, br)
      else
        love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
      end
    end, "replace", stencilValue, stencilDepth > 0)
    love.graphics.setStencilTest("greater", stencilDepth)
    stencilDepth = stencilValue
  elseif useScissor then
    -- Scissor clipping for rectangular overflow:hidden or scroll.
    -- Save previous scissor and intersect so nested clips stack correctly
    -- (e.g., overflow:scroll inside a scaled transform inside overflow:hidden).
    prevScissor = {love.graphics.getScissor()}
    local sx, sy = love.graphics.transformPoint(c.x, c.y)
    local sx2, sy2 = love.graphics.transformPoint(c.x + c.w, c.y + c.h)
    local sw, sh = math.max(0, sx2 - sx), math.max(0, sy2 - sy)
    love.graphics.intersectScissor(sx, sy, sw, sh)
  end

  -- Mask canvas capture: if this node has a mask child, redirect all rendering
  -- to a temporary canvas so the mask can post-process the full content.
  local maskTempCanvas = nil
  local maskCaptureX, maskCaptureY = c.x, c.y
  if MasksModule and MasksModule.hasMask(node.id) then
    local tc, tw, th, capX, capY = MasksModule.getTempCanvas(node.id)
    if tc and tw > 0 and th > 0 then
      maskTempCanvas = tc
      maskCaptureX = capX or c.x
      maskCaptureY = capY or c.y
      -- Isolate capture from any inherited scissor/stencil state that could clip
      -- the off-screen render target.
      love.graphics.push("all")
      love.graphics.setCanvas({maskTempCanvas, stencil = true})
      love.graphics.setScissor()
      love.graphics.setStencilTest()
      love.graphics.setBlendMode("alpha")
      love.graphics.clear(0, 0, 0, 0)
      -- Translate so content at capture origin renders at (0, 0) in the temp canvas.
      love.graphics.translate(-maskCaptureX, -maskCaptureY)
    end
  end

  if not isHidden and (node.type == "View" or node.type == "box") then
    -- Draw box shadow BEFORE background (so it appears behind)
    if s.shadowColor and s.shadowBlur and s.shadowBlur > 0 then
      local offsetX = s.shadowOffsetX or 0
      local offsetY = s.shadowOffsetY or 0
      drawBoxShadow(c.x, c.y, c.w, c.h, borderRadius, s.shadowColor, offsetX, offsetY, s.shadowBlur, effectiveOpacity)
    end

    -- Background: gradient takes precedence over solid color
    if s.backgroundGradient then
      local grad = s.backgroundGradient
      -- Apply borderRadius clipping if needed (stencil for rounded gradients)
      if hasRoundedCorners then
        local gradStencilValue = stencilDepth + 1
        love.graphics.stencil(function()
          if isPerCorner then
            drawRoundedRect("fill", c.x, c.y, c.w, c.h, tl, tr, bl, br)
          else
            love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
          end
        end, "replace", gradStencilValue, stencilDepth > 0)
        love.graphics.setStencilTest("greater", stencilDepth)

        drawGradient(c.x, c.y, c.w, c.h, grad.direction, grad.colors[1], grad.colors[2], effectiveOpacity)

        -- Restore stencil test
        if stencilDepth > 0 then
          love.graphics.setStencilTest("greater", stencilDepth - 1)
        else
          love.graphics.setStencilTest()
        end
      else
        drawGradient(c.x, c.y, c.w, c.h, grad.direction, grad.colors[1], grad.colors[2], effectiveOpacity)
      end
    elseif s.backgroundColor and s.backgroundColor ~= "transparent" then
      -- Solid background fill
      Painter.setColor(s.backgroundColor)
      Painter.applyOpacity(effectiveOpacity)
      if s.arcShape then
        drawArcSector(c, s.arcShape)
      elseif s.polygonPoints and #s.polygonPoints >= 6 then
        drawPolygon(c, s.polygonPoints)
      elseif isPerCorner then
        drawRoundedRect("fill", c.x, c.y, c.w, c.h, tl, tr, bl, br)
      else
        love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
      end
    end

    -- Stroked vector paths (icons)
    if s.strokePaths and #s.strokePaths > 0 then
      if s.strokeColor then
        Painter.setColor(s.strokeColor)
      elseif s.color then
        Painter.setColor(s.color)
      else
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
      end
      Painter.applyOpacity(effectiveOpacity)
      drawStrokePaths(c, s.strokePaths, s.strokeWidth)
    end

    -- Border stroke
    local bwT = s.borderTopWidth or s.borderWidth or 0
    local bwR = s.borderRightWidth or s.borderWidth or 0
    local bwB = s.borderBottomWidth or s.borderWidth or 0
    local bwL = s.borderLeftWidth or s.borderWidth or 0
    local hasUniformBorder = s.borderWidth and s.borderWidth > 0
        and not s.borderTopWidth and not s.borderRightWidth
        and not s.borderBottomWidth and not s.borderLeftWidth
    local hasPerSideBorder = (bwT > 0 or bwR > 0 or bwB > 0 or bwL > 0) and not hasUniformBorder

    if hasUniformBorder then
      -- Fast path: uniform border via rectangle stroke
      Painter.setColor(s.borderColor or { 0.5, 0.5, 0.5, 1 })
      Painter.applyOpacity(effectiveOpacity)
      love.graphics.setLineWidth(s.borderWidth)
      if isPerCorner then
        drawRoundedRect("line", c.x, c.y, c.w, c.h, tl, tr, bl, br)
      else
        love.graphics.rectangle("line", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
      end
    elseif hasPerSideBorder then
      -- Per-side borders: draw individual lines with per-side colors
      local defaultColor = s.borderColor or { 0.5, 0.5, 0.5, 1 }
      if bwT > 0 then
        Painter.setColor(s.borderTopColor or defaultColor)
        Painter.applyOpacity(effectiveOpacity)
        love.graphics.setLineWidth(bwT)
        love.graphics.line(c.x, c.y + bwT/2, c.x + c.w, c.y + bwT/2)
      end
      if bwB > 0 then
        Painter.setColor(s.borderBottomColor or defaultColor)
        Painter.applyOpacity(effectiveOpacity)
        love.graphics.setLineWidth(bwB)
        love.graphics.line(c.x, c.y + c.h - bwB/2, c.x + c.w, c.y + c.h - bwB/2)
      end
      if bwL > 0 then
        Painter.setColor(s.borderLeftColor or defaultColor)
        Painter.applyOpacity(effectiveOpacity)
        love.graphics.setLineWidth(bwL)
        love.graphics.line(c.x + bwL/2, c.y, c.x + bwL/2, c.y + c.h)
      end
      if bwR > 0 then
        Painter.setColor(s.borderRightColor or defaultColor)
        Painter.applyOpacity(effectiveOpacity)
        love.graphics.setLineWidth(bwR)
        love.graphics.line(c.x + c.w - bwR/2, c.y, c.x + c.w - bwR/2, c.y + c.h)
      end
    end

    -- Outline (drawn outside the border box)
    if s.outlineWidth and s.outlineWidth > 0 then
      local outlineOffset = s.outlineOffset or 0
      local ox = c.x - s.outlineWidth - outlineOffset
      local oy = c.y - s.outlineWidth - outlineOffset
      local ow = c.w + (s.outlineWidth + outlineOffset) * 2
      local oh = c.h + (s.outlineWidth + outlineOffset) * 2
      Painter.setColor(s.outlineColor or { 1, 1, 1, 1 })
      Painter.applyOpacity(effectiveOpacity)
      love.graphics.setLineWidth(s.outlineWidth)
      if isPerCorner then
        local orad = s.outlineWidth + outlineOffset
        drawRoundedRect("line", ox, oy, ow, oh, tl + orad, tr + orad, bl + orad, br + orad)
      else
        local or_ = borderRadius > 0 and (borderRadius + s.outlineWidth + outlineOffset) or 0
        love.graphics.rectangle("line", ox, oy, ow, oh, or_, or_)
      end
    end

    -- Background video (renders behind children, always playing + looped + muted)
    if Videos and node.props and node.props.backgroundVideo then
      local bgSrc = node.props.backgroundVideo
      if bgSrc ~= "" then
        local bgStatus = Videos.getStatus(bgSrc)
        if bgStatus == "ready" then
          Videos.setPaused(bgSrc, false)
          Videos.setLoop(bgSrc, true)
          Videos.setMuted(bgSrc, true)
          Videos.setVolume(bgSrc, 0)
          local bgCanvas = Videos.get(bgSrc)
          if bgCanvas then
            local fit = node.props.backgroundVideoFit or "cover"
            drawVideoFrame(bgCanvas, bgSrc, c, fit, borderRadius, stencilDepth, effectiveOpacity)
          end
        end
      end
    end

    -- Background effect canvas (renders behind children, from child effect with background=true)
    if EffectsModule then
      local bgCanvas = EffectsModule.getBackground(node.id)
      if bgCanvas then
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        local cw, ch = bgCanvas:getDimensions()
        love.graphics.draw(bgCanvas, c.x, c.y, 0, c.w / cw, c.h / ch)
      end
    end

  elseif not isHidden and (node.type == "Text" or node.type == "__TEXT__") then
    -- Draw text selection highlight BEFORE text (so text renders on top)
    if not TextSelectionModule then
      local ok, mod = pcall(require, "lua.textselection")
      if ok then TextSelectionModule = mod end
    end
    if TextSelectionModule then
      TextSelectionModule.drawHighlight(node)
    end

    -- Resolve text style properties (with inheritance for __TEXT__ children)
    local fontSize = s.fontSize or 14
    local fontFamily = resolveFontFamily(node)
    local fontWeight = s.fontWeight
    local lineHeight = resolveLineHeight(node)
    local letterSpacing = resolveLetterSpacing(node)
    local textOverflow = resolveTextOverflow(node)
    local noWrap = resolveTextNoWrap(node)
    local numberOfLines = resolveNumberOfLines(node)
    local textDecorationLine = s.textDecorationLine

    -- If this is a __TEXT__ child, inherit from parent Text node
    if node.type == "__TEXT__" and node.parent then
      local ps = node.parent.style or {}
      if not s.fontSize and ps.fontSize then fontSize = ps.fontSize end
      if not fontWeight then fontWeight = ps.fontWeight end
      if not textDecorationLine then textDecorationLine = ps.textDecorationLine end
    end

    -- Apply text scale (respects per-subtree textScale override)
    local ts = Measure.resolveTextScale(node)
    fontSize = math.floor(fontSize * ts)
    if lineHeight then lineHeight = math.floor(lineHeight * ts) end

    local font, isBold = getFont(fontSize, fontFamily, fontWeight)
    love.graphics.setFont(font)

    -- Resolve text content (needed for both shadow and main draw)
    local text = node.text or (node.props and node.props.children) or ""
    if type(text) == "table" then text = table.concat(text) end
    text = tostring(text)
    if noWrap then
      text = text:gsub("\r\n", "\n"):gsub("\r", "\n"):gsub("\n", " ")
    end

    -- Resolve textAlign (inherit from parent Text for __TEXT__ children)
    local align = s.textAlign
    if not align and node.type == "__TEXT__" and node.parent then
      align = (node.parent.style or {}).textAlign
    end
    align = align or "left"
    local hasCustomLineHeight = lineHeight and lineHeight ~= font:getHeight()
    local hasLetterSpacing = letterSpacing and letterSpacing ~= 0

    -- Determine rendering strategy:
    -- 1. If numberOfLines is set, textOverflow is "ellipsis", or noWrap is set, we need line control
    -- 2. If lineHeight is custom, we must render line-by-line
    -- 3. If letterSpacing is set, we must render character-by-character
    -- 4. Otherwise, use love.graphics.printf (fastest path)
    local needsLineControl = numberOfLines or textOverflow == "ellipsis" or noWrap
    local needsManualRendering = hasCustomLineHeight or hasLetterSpacing or needsLineControl

    -- Text shadow: draw text first with offset and shadow color
    local shadowColor = s.textShadowColor
    if not shadowColor and node.type == "__TEXT__" and node.parent then
      shadowColor = (node.parent.style or {}).textShadowColor
    end
    if shadowColor then
      local sox = s.textShadowOffsetX or 0
      local soy = s.textShadowOffsetY or 0
      if not sox and node.type == "__TEXT__" and node.parent then
        sox = (node.parent.style or {}).textShadowOffsetX or 0
      end
      if not soy and node.type == "__TEXT__" and node.parent then
        soy = (node.parent.style or {}).textShadowOffsetY or 0
      end

      Painter.setColor(shadowColor)
      Painter.applyOpacity(effectiveOpacity)

      if not needsManualRendering then
        love.graphics.printf(text, c.x + sox, c.y + soy, c.w, align)
        if isBold then
          love.graphics.printf(text, c.x + sox + 0.8, c.y + soy, c.w, align)
        end
      else
        local effectiveLineH = lineHeight or font:getHeight()
        if noWrap then
          local oneLine = text
          if textOverflow == "ellipsis" then
            oneLine = Painter.truncateWithEllipsis(font, oneLine, c.w, letterSpacing)
          end
          if hasLetterSpacing then
            drawLineWithSpacing(font, oneLine, c.x + sox, c.y + soy, letterSpacing, align, c.w)
          else
            drawLineNoWrap(font, oneLine, c.x + sox, c.y + soy, align, c.w)
          end
        elseif textOverflow == "ellipsis" and not numberOfLines then
          local truncated = Painter.truncateWithEllipsis(font, text, c.w, letterSpacing)
          if hasLetterSpacing then
            drawLineWithSpacing(font, truncated, c.x + sox, c.y + soy, letterSpacing, align, c.w)
          else
            drawLineNormal(font, truncated, c.x + sox, c.y + soy, align, c.w)
          end
        else
          local lines = Painter.getVisibleLines(font, text, c.w, numberOfLines, textOverflow, letterSpacing)
          for i, line in ipairs(lines) do
            local ly = c.y + (i - 1) * effectiveLineH + soy
            if hasLetterSpacing then
              drawLineWithSpacing(font, line, c.x + sox, ly, letterSpacing, align, c.w)
            else
              drawLineNormal(font, line, c.x + sox, ly, align, c.w)
            end
          end
        end
      end
    end

    -- Text color with opacity (inherit from parent Text for __TEXT__ children)
    local textColor = s.color
    if not textColor and node.type == "__TEXT__" and node.parent then
      textColor = (node.parent.style or {}).color
    end
    local defaultTextColor = (currentTheme and currentTheme.colors and currentTheme.colors.text) or { 1, 1, 1, 1 }
    Painter.setColor(textColor or defaultTextColor)
    Painter.applyOpacity(effectiveOpacity)

    if not needsManualRendering then
      -- Fast path: standard Love2D text rendering
      love.graphics.printf(text, c.x, c.y, c.w, align)
      -- Bold simulation: draw again offset by 1px (faux-bold)
      if isBold then
        love.graphics.printf(text, c.x + 0.8, c.y, c.w, align)
      end
    else
      -- Manual rendering path: get wrapped/truncated lines, draw each
      local effectiveLineH = lineHeight or font:getHeight()

      if noWrap then
        local oneLine = text
        if textOverflow == "ellipsis" then
          oneLine = Painter.truncateWithEllipsis(font, oneLine, c.w, letterSpacing)
        end
        if hasLetterSpacing then
          drawLineWithSpacing(font, oneLine, c.x, c.y, letterSpacing, align, c.w)
          if isBold then drawLineWithSpacing(font, oneLine, c.x + 0.8, c.y, letterSpacing, align, c.w) end
        else
          drawLineNoWrap(font, oneLine, c.x, c.y, align, c.w)
          if isBold then drawLineNoWrap(font, oneLine, c.x + 0.8, c.y, align, c.w) end
        end
      -- Single-line ellipsis (textOverflow = "ellipsis", no numberOfLines)
      elseif textOverflow == "ellipsis" and not numberOfLines then
        local truncated = Painter.truncateWithEllipsis(font, text, c.w, letterSpacing)
        if hasLetterSpacing then
          drawLineWithSpacing(font, truncated, c.x, c.y, letterSpacing, align, c.w)
          if isBold then drawLineWithSpacing(font, truncated, c.x + 0.8, c.y, letterSpacing, align, c.w) end
        else
          drawLineNormal(font, truncated, c.x, c.y, align, c.w)
          if isBold then drawLineNormal(font, truncated, c.x + 0.8, c.y, align, c.w) end
        end
      else
        -- Multi-line path: get visible lines (possibly truncated)
        local lines = Painter.getVisibleLines(font, text, c.w, numberOfLines, textOverflow, letterSpacing)

        for i, line in ipairs(lines) do
          local ly = c.y + (i - 1) * effectiveLineH
          if hasLetterSpacing then
            drawLineWithSpacing(font, line, c.x, ly, letterSpacing, align, c.w)
            if isBold then drawLineWithSpacing(font, line, c.x + 0.8, ly, letterSpacing, align, c.w) end
          else
            drawLineNormal(font, line, c.x, ly, align, c.w)
            if isBold then drawLineNormal(font, line, c.x + 0.8, ly, align, c.w) end
          end
        end
      end
    end

    -- Text decoration (underline, line-through)
    if textDecorationLine and textDecorationLine ~= "none" then
      local fontH = font:getHeight()
      local textW = c.w -- full width for decoration line
      if textDecorationLine == "underline" then
        local baselineY = c.y + fontH - font:getDescent()
        love.graphics.setLineWidth(1)
        love.graphics.line(c.x, baselineY, c.x + textW, baselineY)
      elseif textDecorationLine == "line-through" then
        local midY = c.y + fontH * 0.45
        love.graphics.setLineWidth(1)
        love.graphics.line(c.x, midY, c.x + textW, midY)
      end
    end

  elseif not isHidden and node.type == "Image" then
    local src = node.props and node.props.src
    if src then
      local image = Images.get(src)
      if image then
        local objectFit = s.objectFit or "fill"

        local imgW = image:getWidth()
        local imgH = image:getHeight()
        local scaleX, scaleY, drawX, drawY, drawW, drawH

        -- Calculate scaling and positioning based on objectFit mode
        if objectFit == "contain" then
          -- Scale to fit inside bounds while maintaining aspect ratio
          local scale = math.min(c.w / imgW, c.h / imgH)
          scaleX = scale
          scaleY = scale
          drawW = imgW * scale
          drawH = imgH * scale
          drawX = c.x + (c.w - drawW) / 2
          drawY = c.y + (c.h - drawH) / 2

        elseif objectFit == "cover" then
          -- Scale to cover bounds while maintaining aspect ratio
          local scale = math.max(c.w / imgW, c.h / imgH)
          scaleX = scale
          scaleY = scale
          drawW = imgW * scale
          drawH = imgH * scale
          drawX = c.x + (c.w - drawW) / 2
          drawY = c.y + (c.h - drawH) / 2

        elseif objectFit == "none" then
          -- No scaling, center the image
          scaleX = 1
          scaleY = 1
          drawW = imgW
          drawH = imgH
          drawX = c.x + (c.w - imgW) / 2
          drawY = c.y + (c.h - imgH) / 2

        else
          -- "fill" (default): stretch to fill bounds
          scaleX = c.w / imgW
          scaleY = c.h / imgH
          drawX = c.x
          drawY = c.y
          drawW = c.w
          drawH = c.h
        end

        -- Apply borderRadius clipping if needed (and not already in a stencil clip)
        local imageStencil = borderRadius > 0
        if imageStencil then
          local stencilValue = stencilDepth + 1
          love.graphics.stencil(function()
            love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
          end, "replace", stencilValue, stencilDepth > 0)
          love.graphics.setStencilTest("greater", stencilDepth)
        end

        -- Draw the image with effective opacity (inherited * node)
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        love.graphics.draw(image, drawX, drawY, 0, scaleX, scaleY)

        -- Restore stencil test to parent level
        if imageStencil then
          if stencilDepth > 0 then
            love.graphics.setStencilTest("greater", stencilDepth - 1)
          else
            love.graphics.setStencilTest()
          end
        end
      else
        -- Fallback: draw a placeholder rectangle if image failed to load
        love.graphics.setColor(0.5, 0.5, 0.5, 0.3 * effectiveOpacity)
        love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)
        love.graphics.setColor(1, 0, 0, 0.8 * effectiveOpacity)
        love.graphics.rectangle("line", c.x, c.y, c.w, c.h)
      end
    end

  elseif not isHidden and node.type == "Video" and Videos then
    local src = node.props and node.props.src
    if src then
      local status = Videos.getStatus(src)

      if status == "ready" then
        local canvas = Videos.get(src)
        if canvas then
          -- Control playback via mpv property API
          Videos.setPaused(src, node.props.paused)
          Videos.setMuted(src, node.props.muted)
          Videos.setVolume(src, node.props.volume or 1)
          Videos.setLoop(src, node.props.loop)

          -- Calculate scaling using same objectFit logic as Image
          local objectFit = s.objectFit or "fill"
          local vidW, vidH = Videos.getDimensions(src)
          if not vidW then vidW, vidH = canvas:getWidth(), canvas:getHeight() end
          local scaleX, scaleY, drawX, drawY, drawW, drawH

          if objectFit == "contain" then
            local scale = math.min(c.w / vidW, c.h / vidH)
            scaleX = scale
            scaleY = scale
            drawW = vidW * scale
            drawH = vidH * scale
            drawX = c.x + (c.w - drawW) / 2
            drawY = c.y + (c.h - drawH) / 2
          elseif objectFit == "cover" then
            local scale = math.max(c.w / vidW, c.h / vidH)
            scaleX = scale
            scaleY = scale
            drawW = vidW * scale
            drawH = vidH * scale
            drawX = c.x + (c.w - drawW) / 2
            drawY = c.y + (c.h - drawH) / 2
          elseif objectFit == "none" then
            scaleX = 1
            scaleY = 1
            drawW = vidW
            drawH = vidH
            drawX = c.x + (c.w - vidW) / 2
            drawY = c.y + (c.h - vidH) / 2
          else
            -- "fill" (default)
            scaleX = c.w / vidW
            scaleY = c.h / vidH
            drawX = c.x
            drawY = c.y
            drawW = c.w
            drawH = c.h
          end

          -- Apply borderRadius clipping if needed
          local videoStencil = borderRadius > 0
          if videoStencil then
            local stencilValue = stencilDepth + 1
            love.graphics.stencil(function()
              love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
            end, "replace", stencilValue, stencilDepth > 0)
            love.graphics.setStencilTest("greater", stencilDepth)
          end

          -- Draw the video frame (Canvas is drawable just like Video)
          love.graphics.setColor(1, 1, 1, effectiveOpacity)
          love.graphics.draw(canvas, drawX, drawY, 0, scaleX, scaleY)

          -- Restore stencil
          if videoStencil then
            if stencilDepth > 0 then
              love.graphics.setStencilTest("greater", stencilDepth - 1)
            else
              love.graphics.setStencilTest()
            end
          end
        end

      else
        -- Loading / error / no video: neutral dark surface with film icon
        love.graphics.setColor(0.10, 0.11, 0.14, effectiveOpacity)
        love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
        love.graphics.setColor(0.20, 0.22, 0.28, 0.5 * effectiveOpacity)
        love.graphics.rectangle("line", c.x, c.y, c.w, c.h, borderRadius, borderRadius)

        -- Play triangle icon in center
        local iconSize = math.min(c.w, c.h) * 0.15
        if iconSize > 6 then
          local cx = c.x + c.w / 2
          local cy = c.y + c.h / 2
          love.graphics.setColor(0.30, 0.33, 0.40, 0.5 * effectiveOpacity)
          love.graphics.polygon("fill",
            cx - iconSize * 0.4, cy - iconSize * 0.5,
            cx - iconSize * 0.4, cy + iconSize * 0.5,
            cx + iconSize * 0.5, cy)
        end
      end
    end

  elseif not isHidden and node.type == "VideoPlayer" then
    -- Lua-owned video player with controls: delegate entirely to videoplayer.lua
    if not VideoPlayerModule then
      VideoPlayerModule = require("lua.videoplayer")
    end
    -- Skip normal paint if fullscreen (init.lua draws it on top of everything)
    local vpState = node._vp
    if not (vpState and vpState.isFullscreen) then
      VideoPlayerModule.draw(node, effectiveOpacity)
    end

  elseif not isHidden and node.type == "TextEditor" then
    -- Lua-owned text editor: delegate rendering entirely to texteditor.lua
    if not TextEditorModule then
      TextEditorModule = require("lua.texteditor")
    end
    TextEditorModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "TextInput" then
    -- Lua-owned text input: delegate rendering entirely to textinput.lua
    if not TextInputModule then
      TextInputModule = require("lua.textinput")
    end
    TextInputModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "CodeBlock" then
    -- Lua-owned code block: delegate rendering entirely to codeblock.lua
    if not CodeBlockModule then
      CodeBlockModule = require("lua.codeblock")
    end
    local c = node.computed
    if c and c.w > 0 and c.h > 0 then
      CodeBlockModule.render(node, c, effectiveOpacity)
    end

  elseif not isHidden and node.type == "Math" then
    -- Lua-owned LaTeX math: delegate rendering entirely to latex.lua
    if not LatexModule then
      LatexModule = require("lua.latex")
    end
    local c = node.computed
    if c and c.w > 0 and c.h > 0 then
      LatexModule.render(node, c, effectiveOpacity)
    end

  elseif not isHidden and node.type == "Scene3D" then
    -- 3D viewport: draw the pre-rendered Canvas from scene3d.lua
    if Scene3DModule then
      local canvas = Scene3DModule.get(node.id)
      if canvas then
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        love.graphics.draw(canvas, c.x, c.y)
      end
    end

  elseif not isHidden and node.type == "Map2D" then
    -- Map viewport: draw the pre-rendered Canvas from map.lua
    if MapModule then
      local canvas = MapModule.get(node.id)
      if canvas then
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        love.graphics.draw(canvas, c.x, c.y)
      end
    end

  elseif not isHidden and node.type == "GeoScene3D" then
    -- 3D geo viewport: draw the pre-rendered Canvas from geoscene3d.lua
    if GeoScene3DModule then
      local canvas = GeoScene3DModule.get(node.id)
      if canvas then
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        love.graphics.draw(canvas, c.x, c.y)
      end
    end

  elseif not isHidden and node.type == "Chart2D" then
    if not ChartModule then
      ChartModule = require("lua.chart")
    end
    if c and c.w > 0 and c.h > 0 then
      ChartModule.draw(node.props, c.x, c.y, c.w, c.h)
    end

  elseif not isHidden and node.type == "GameCanvas" then
    -- Game viewport: draw the pre-rendered Canvas from game.lua
    if GameModule then
      local canvas = GameModule.get(node.id)
      if canvas then
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        love.graphics.draw(canvas, c.x, c.y)
      end
    end
    -- Note: children (React UI overlay) are painted by the normal child recursion below

  elseif not isHidden and node.type == "Emulator" then
    -- NES emulator viewport: draw the pre-rendered Canvas from emulator.lua
    if EmulatorModule then
      local canvas = EmulatorModule.get(node.id)
      if canvas then
        -- Scale NES native resolution (256x240) to layout size
        local scaleX = (c.w or 256) / 256
        local scaleY = (c.h or 240) / 240
        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        love.graphics.draw(canvas, c.x, c.y, 0, scaleX, scaleY)
      end
    end

  elseif not isHidden and node.type == "Render" then
    -- External capture source: draw the live Image from render_source.lua
    if RenderSourceModule then
      local img = RenderSourceModule.get(node.id)
      if img then
        local objectFit = s.objectFit or (node.props and node.props.objectFit) or "contain"
        local srcW, srcH = img:getWidth(), img:getHeight()
        local scaleX, scaleY, drawX, drawY

        if objectFit == "contain" then
          local scale = math.min(c.w / srcW, c.h / srcH)
          scaleX = scale
          scaleY = scale
          local drawW = srcW * scale
          local drawH = srcH * scale
          drawX = c.x + (c.w - drawW) / 2
          drawY = c.y + (c.h - drawH) / 2
        elseif objectFit == "cover" then
          local scale = math.max(c.w / srcW, c.h / srcH)
          scaleX = scale
          scaleY = scale
          local drawW = srcW * scale
          local drawH = srcH * scale
          drawX = c.x + (c.w - drawW) / 2
          drawY = c.y + (c.h - drawH) / 2
        else
          -- "fill" (default)
          scaleX = c.w / srcW
          scaleY = c.h / srcH
          drawX = c.x
          drawY = c.y
        end

        -- Apply borderRadius clipping if needed
        local renderStencil = borderRadius > 0
        if renderStencil then
          local stencilValue = stencilDepth + 1
          love.graphics.stencil(function()
            love.graphics.rectangle("fill", c.x, c.y, c.w, c.h, borderRadius, borderRadius)
          end, "replace", stencilValue, stencilDepth > 0)
          love.graphics.setStencilTest("greater", stencilDepth)
        end

        love.graphics.setColor(1, 1, 1, effectiveOpacity)
        love.graphics.draw(img, drawX, drawY, 0, scaleX, scaleY)

        if renderStencil then
          if stencilDepth > 0 then
            love.graphics.setStencilTest("greater", stencilDepth - 1)
          else
            love.graphics.setStencilTest()
          end
        end
      else
        -- No frame yet: draw placeholder
        love.graphics.setColor(0.1, 0.1, 0.15, effectiveOpacity)
        love.graphics.rectangle("fill", c.x, c.y, c.w, c.h)
        if getFont then
          local font = getFont(14)
          if font then
            love.graphics.setFont(font)
            love.graphics.setColor(0.5, 0.5, 0.6, effectiveOpacity)
            local status = RenderSourceModule.getStatus(node.id) or "connecting"
            local label = "Capture: " .. status
            love.graphics.printf(label, c.x, c.y + c.h / 2 - 7, c.w, "center")
          end
        end
      end
    end

  elseif MasksModule and MasksModule.isMask(node) then
    -- Mask nodes don't render standalone — they are applied as post-processing
    -- by the parent's paintNode via the canvas capture path above.
    return

  elseif not isHidden and EffectsModule and EffectsModule.isEffect(node.type) then
    -- Generative effect viewport: draw the pre-rendered Canvas from effects.lua
    local canvas = EffectsModule.get(node.id)
    if canvas then
      local cw, ch = canvas:getDimensions()
      love.graphics.setColor(1, 1, 1, effectiveOpacity)
      love.graphics.draw(canvas, c.x, c.y, 0, c.w / cw, c.h / ch)
    end

  elseif not isHidden and node.type == "Slider" then
    if not SliderModule then
      SliderModule = require("lua.slider")
    end
    SliderModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "Fader" then
    if not FaderModule then
      FaderModule = require("lua.fader")
    end
    FaderModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "Knob" then
    if not KnobModule then
      KnobModule = require("lua.knob")
    end
    KnobModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "Switch" then
    if not SwitchModule then
      SwitchModule = require("lua.switch")
    end
    SwitchModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "Checkbox" then
    if not CheckboxModule then
      CheckboxModule = require("lua.checkbox")
    end
    CheckboxModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "Radio" then
    if not RadioModule then
      RadioModule = require("lua.radio")
    end
    RadioModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "Select" then
    if not SelectModule then
      SelectModule = require("lua.select")
    end
    SelectModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "PianoKeyboard" then
    if not PianoKeyboardModule then
      PianoKeyboardModule = require("lua.piano_keyboard")
    end
    PianoKeyboardModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "StepSequencer" then
    if not StepSequencerModule then
      StepSequencerModule = require("lua.step_sequencer")
    end
    StepSequencerModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "XYPad" then
    if not XYPadModule then
      XYPadModule = require("lua.xypad")
    end
    XYPadModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "PitchWheel" then
    if not PitchWheelModule then
      PitchWheelModule = require("lua.pitchwheel")
    end
    PitchWheelModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "TickerTape" then
    if not TickerTapeModule then
      TickerTapeModule = require("lua.tickertape")
    end
    TickerTapeModule.draw(node, effectiveOpacity)

  elseif not isHidden and node.type == "OrderBook" then
    if not OrderBookModule then
      OrderBookModule = require("lua.orderbook")
    end
    OrderBookModule.draw(node, effectiveOpacity)

  elseif not isHidden then
    -- Generic visual capability dispatch: any registered capability with
    -- visual=true and a render method gets painted here automatically.
    if CapabilitiesModule then
      local capDef = CapabilitiesModule.getDefinition(node.type)
      if dbgLog then
        io.write(string.format("[PAINT-DBG] capDispatch type=%s capDef=%s visual=%s render=%s c=%dx%d isHidden=%s\n",
          dbgType,
          capDef and "yes" or "nil",
          capDef and tostring(capDef.visual) or "n/a",
          capDef and capDef.render and "yes" or "nil",
          c.w or 0, c.h or 0,
          tostring(isHidden)))
        io.flush()
      end
      if capDef and capDef.visual and capDef.render then
        if c.w > 0 and c.h > 0 then
          if dbgLog then io.write(string.format("[PAINT-DBG] RENDERING %s %dx%d\n", dbgType, c.w, c.h)); io.flush() end
          capDef.render(node, c, effectiveOpacity)
        else
          if dbgLog then io.write(string.format("[PAINT-DBG] SKIPPED %s — zero size %dx%d\n", dbgType, c.w, c.h)); io.flush() end
        end
      end
    end
  end

  -- Determine paint order: sort children by zIndex (stable, ascending)
  local children = node.children or {}
  local paintOrder = ZIndex.getSortedChildren(children)

  -- Apply scroll transform if this is a scroll container
  local scrollX, scrollY = 0, 0
  if isScroll and node.scrollState then
    scrollX = node.scrollState.scrollX or 0
    scrollY = node.scrollState.scrollY or 0
  end

  if isScroll and (scrollX ~= 0 or scrollY ~= 0) then
    love.graphics.push()
    love.graphics.translate(-scrollX, -scrollY)
  end

  -- Paint children with propagated opacity and stencil depth
  if isScroll and node.scrollState then
    -- Viewport culling: skip children entirely outside the scroll viewport.
    -- This is the transparent virtual scrolling optimization — developers just
    -- use ScrollView with any number of children and offscreen subtrees are
    -- automatically skipped, no FlatList or virtualization API needed.
    local viewT = c.y + scrollY
    local viewB = viewT + c.h
    local viewL = c.x + scrollX
    local viewR = viewL + c.w
    for _, child in ipairs(paintOrder) do
      local cc = child.computed
      if cc then
        -- Never cull children with transforms (visual pos may differ from computed)
        local cs = child.style
        if (cs and cs.transform)
           or (cc.y + cc.h > viewT and cc.y < viewB
               and cc.x + cc.w > viewL and cc.x < viewR) then
          Painter.paintNode(child, effectiveOpacity, stencilDepth)
        end
      end
    end
  else
    for _, child in ipairs(paintOrder) do
      Painter.paintNode(child, effectiveOpacity, stencilDepth)
    end
  end

  -- Restore scroll transform
  if isScroll and (scrollX ~= 0 or scrollY ~= 0) then
    love.graphics.pop()
  end

  -- Draw scrollbar indicators for scroll containers
  if isScroll and node.scrollState then
    Painter.drawScrollbars(node, effectiveOpacity)
  end

  -- Hover video overlay (renders ON TOP of children when mouse is inside bounds)
  if not isHidden and (node.type == "View" or node.type == "box")
     and Videos and node.props and node.props.hoverVideo then
    local hvSrc = node.props.hoverVideo
    if hvSrc ~= "" and Videos.getStatus(hvSrc) == "ready" then
      local mx, my = love.mouse.getPosition()
      local isHovered = mx >= c.x and mx < c.x + c.w and my >= c.y and my < c.y + c.h

      -- Play on hover, freeze (pause) when not — frozen frame stays visible
      Videos.setPaused(hvSrc, not isHovered)
      Videos.setLoop(hvSrc, true)
      Videos.setMuted(hvSrc, true)
      Videos.setVolume(hvSrc, 0)

      -- Always draw the frame (frozen first-frame when not hovered, playing when hovered)
      local hvCanvas = Videos.get(hvSrc)
      if hvCanvas then
        local fit = node.props.hoverVideoFit or "cover"
        drawVideoFrame(hvCanvas, hvSrc, c, fit, borderRadius, stencilDepth, effectiveOpacity)
      end
    end
  end

  -- Apply mask: if we were capturing to a temp canvas, finalize and draw the result
  if maskTempCanvas then
    -- Restore pre-capture graphics state (main canvas, clip, blend, transform).
    love.graphics.pop()
    local outputCanvas = MasksModule.applyMask(node.id, maskTempCanvas)
    if outputCanvas then
      love.graphics.setColor(1, 1, 1, effectiveOpacity)
      love.graphics.draw(outputCanvas, maskCaptureX, maskCaptureY)
    end
  end

  -- Restore clipping state
  if useStencil then
    -- Restore stencil test to what it was before this node entered.
    -- prevStencilDepth is the original parameter before modification.
    if prevStencilDepth > 0 then
      love.graphics.setStencilTest("greater", prevStencilDepth - 1)
    else
      love.graphics.setStencilTest()
    end
  elseif useScissor then
    if prevScissor and prevScissor[1] then
      love.graphics.setScissor(prevScissor[1], prevScissor[2], prevScissor[3], prevScissor[4])
    else
      love.graphics.setScissor()
    end
  end

  -- Restore transform state
  if didTransform then
    love.graphics.pop()
  end
  -- Per-node paint timing (inclusive — includes children)
  node.computed.paintMs = (love.timer.getTime() - _pt0) * 1000
end

-- ============================================================================
-- Scrollbar rendering
-- ============================================================================

--- Draw scrollbar indicators for a scroll container.
--- Only shown when content actually overflows the viewport.
--- @param node table The scroll container node
--- @param opacity number Effective opacity to apply
function Painter.drawScrollbars(node, opacity)
  local c = node.computed
  local ss = node.scrollState
  if not c or not ss then return end
  local props = node.props or {}
  local horizontalMode = props.horizontal
  local allowX = true
  local allowY = true
  if horizontalMode == true then
    allowY = false
  elseif horizontalMode == false then
    allowX = false
  end

  local viewportW = c.w
  local viewportH = c.h
  local contentW = ss.contentW or viewportW
  local contentH = ss.contentH or viewportH
  local scrollX = ss.scrollX or 0
  local scrollY = ss.scrollY or 0

  local barThickness = 4
  local barRadius = 2
  local barColor = { 1, 1, 1, 0.3 * opacity }

  -- Vertical scrollbar (right edge)
  if allowY and contentH > viewportH then
    local trackH = viewportH
    local thumbH = math.max(20, (viewportH / contentH) * trackH)
    local maxScroll = contentH - viewportH
    local thumbY = c.y + (scrollY / maxScroll) * (trackH - thumbH)
    local thumbX = c.x + viewportW - barThickness - 1

    love.graphics.setColor(barColor)
    love.graphics.rectangle("fill", thumbX, thumbY, barThickness, thumbH, barRadius, barRadius)
  end

  -- Horizontal scrollbar (bottom edge)
  if allowX and contentW > viewportW then
    local trackW = viewportW
    local thumbW = math.max(20, (viewportW / contentW) * trackW)
    local maxScroll = contentW - viewportW
    local thumbX = c.x + (scrollX / maxScroll) * (trackW - thumbW)
    local thumbY = c.y + viewportH - barThickness - 1

    love.graphics.setColor(barColor)
    love.graphics.rectangle("fill", thumbX, thumbY, thumbW, barThickness, barRadius, barRadius)
  end
end

-- ============================================================================
-- Focus ring (controller mode)
-- ============================================================================

--- Draw focus ring from interpolated rect data (controller mode only).
--- Called from init.lua after paint, before overlays.
--- @param ring table { x, y, w, h, ringColor, borderRadius }
function Painter.drawFocusRing(ring)
  if not ring then return end

  local x = ring.x
  local y = ring.y
  local w = ring.w
  local h = ring.h
  local r = ring.borderRadius or 0
  local width = 2    -- ring thickness

  local color = ring.ringColor or { 0.3, 0.6, 1.0, 0.9 }
  love.graphics.setColor(color[1], color[2], color[3], color[4] or 0.9)
  love.graphics.setLineWidth(width)

  if r > 0 then
    love.graphics.rectangle("line", x, y, w, h, r, r)
  else
    love.graphics.rectangle("line", x, y, w, h)
  end

  love.graphics.setLineWidth(1)
  love.graphics.setColor(1, 1, 1, 1)
end

--- Draw a controller connection toast at the bottom center of the screen.
--- @param text string The toast message
--- @param timer number Seconds remaining before auto-dismiss
--- @param fadeStart number Start fading when timer drops below this value
function Painter.drawControllerToast(text, timer, fadeStart)
  local font = getFont(14)
  local textW = font:getWidth(text)
  local textH = font:getHeight()
  local padX, padY = 16, 10
  local boxW = textW + padX * 2
  local boxH = textH + padY * 2
  local screenW, screenH = love.graphics.getDimensions()
  local x = (screenW - boxW) / 2
  local y = screenH - boxH - 24

  -- Fade alpha when timer < fadeStart
  local alpha = 1.0
  if timer < fadeStart then
    alpha = timer / fadeStart
  end

  -- Background pill
  love.graphics.setColor(0.12, 0.12, 0.15, 0.85 * alpha)
  love.graphics.rectangle("fill", x, y, boxW, boxH, 8, 8)

  -- Border
  love.graphics.setColor(0.3, 0.6, 1.0, 0.6 * alpha)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", x, y, boxW, boxH, 8, 8)

  -- Text
  love.graphics.setFont(font)
  love.graphics.setColor(0.9, 0.9, 0.95, alpha)
  love.graphics.print(text, x + padX, y + padY)

  love.graphics.setColor(1, 1, 1, 1)
end

-- ============================================================================
-- Public entry point
-- ============================================================================

--- Paint the entire tree. Resets color to white after painting.
function Painter.paint(node)
  if not node then return end
  _paintCount = 0  -- reset per pass
  Log.log("paint", "paint pass root=%s children=%d", tostring(node.type), #(node.children or {}))
  Painter.paintNode(node)

  -- Search highlight overlay (drawn after the full tree so it's on top)
  local ok, Search = pcall(require, "lua.search")
  if ok then
    local hl = Search.getHighlight()
    if hl and hl.node and hl.node.computed then
      local c = hl.node.computed
      love.graphics.setColor(0.23, 0.51, 0.96, hl.alpha * 0.3)
      love.graphics.rectangle("fill", c.x - 2, c.y - 2, c.w + 4, c.h + 4, 4)
      love.graphics.setColor(0.23, 0.51, 0.96, hl.alpha * 0.8)
      love.graphics.setLineWidth(2)
      love.graphics.rectangle("line", c.x - 2, c.y - 2, c.w + 4, c.h + 4, 4)
      love.graphics.setLineWidth(1)
    end
  end

  love.graphics.setColor(1, 1, 1, 1)
end

return Painter
