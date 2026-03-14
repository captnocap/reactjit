--[[
  tooltips.lua — Unified Lua-owned tooltip system

  Three placement types: cursor, anchor, corner
  Four layout formats: compact, descriptive, dense, table
  One draw path. One set of rules. One visual style.

  Usage from init.lua:
    tooltips.update(hoveredNode, dt, mx, my)   -- each frame
    tooltips.draw(windowW, windowH)            -- after all tree painting

  Usage from TextEditor (manual mode):
    tooltips.showManual(text, x, y, config)    -- bypass node hover
]]

local Measure = nil
local Color   = require("lua.color")

local Tooltips = {}

-- ============================================================================
-- Theme
-- ============================================================================

local currentTheme = nil

local fallbackColors = {
  bg     = { 0.03, 0.03, 0.05, 0.92 },
  text   = { 0.82, 0.84, 0.88, 1 },
  title  = { 0.88, 0.90, 0.95, 1 },
  dim    = { 0.55, 0.58, 0.65, 1 },
  border = { 0.25, 0.25, 0.30, 0.8 },
}

local function themeColor(key, fallback)
  if currentTheme and currentTheme.colors and currentTheme.colors[key] then
    return Color.toTable(currentTheme.colors[key], fallback)
  end
  return fallback
end

local function resolveColors()
  return {
    bg     = themeColor("bgElevated", fallbackColors.bg),
    text   = themeColor("text", fallbackColors.text),
    title  = themeColor("text", fallbackColors.title),
    dim    = themeColor("textDim", fallbackColors.dim),
    border = themeColor("border", fallbackColors.border),
  }
end

function Tooltips.setTheme(theme)
  currentTheme = theme
end

function Tooltips.setMeasure(m)
  Measure = m
end

-- ============================================================================
-- State
-- ============================================================================

local state = {
  hoveredNode = nil,
  parsed = nil,
  timer = 0,
  visible = false,
  mouseX = 0,
  mouseY = 0,
  -- Manual mode (TextEditor etc)
  manual = false,
  manualText = nil,
  manualX = 0,
  manualY = 0,
  manualConfig = nil,
}

-- ============================================================================
-- Prop parsing
-- ============================================================================

local DEFAULTS = {
  type = "cursor",
  layout = "compact",
  delay = 0.4,
  truncate = false,
  maxLines = 3,
  prefer = "above",
  anchor = "top",
  corner = "bottom-left",
}

--- Parse a tooltip prop into a normalized config table.
--- Caches the result on the node to avoid reparsing.
local function parseTooltip(prop, node)
  if node and node._tooltipParsed and node._tooltipPropRef == prop then
    return node._tooltipParsed
  end

  local cfg
  if type(prop) == "string" then
    cfg = {
      content = prop,
      type = DEFAULTS.type,
      layout = DEFAULTS.layout,
      delay = DEFAULTS.delay,
      truncate = DEFAULTS.truncate,
      maxLines = DEFAULTS.maxLines,
      prefer = DEFAULTS.prefer,
      anchor = DEFAULTS.anchor,
      corner = DEFAULTS.corner,
    }
  elseif type(prop) == "table" then
    cfg = {
      content = prop.content or "",
      type = prop.type or DEFAULTS.type,
      layout = prop.layout or DEFAULTS.layout,
      delay = prop.delay or DEFAULTS.delay,
      truncate = prop.truncate or DEFAULTS.truncate,
      maxLines = prop.maxLines or DEFAULTS.maxLines,
      prefer = prop.prefer or DEFAULTS.prefer,
      anchor = prop.anchor or DEFAULTS.anchor,
      corner = prop.corner or DEFAULTS.corner,
      style = prop.style,
    }
  else
    return nil
  end

  if cfg.content == "" then return nil end

  if node then
    node._tooltipParsed = cfg
    node._tooltipPropRef = prop
  end
  return cfg
end

-- ============================================================================
-- Layout formatters
-- ============================================================================

-- Each formatter returns: { lines = { {text=, font=, color=}, ... }, width, height }

local function getFont(size, family, weight)
  if Measure then
    return Measure.getFont(size, family, weight)
  end
  return love.graphics.getFont(), false
end

local function wordWrap(text, font, maxW)
  local wrapped = {}
  for segment in text:gmatch("[^\n]+") do
    local words = {}
    for w in segment:gmatch("%S+") do words[#words + 1] = w end
    local line = ""
    for _, w in ipairs(words) do
      local test = line == "" and w or (line .. " " .. w)
      if font:getWidth(test) > maxW then
        if line ~= "" then wrapped[#wrapped + 1] = line end
        line = w
      else
        line = test
      end
    end
    if line ~= "" then wrapped[#wrapped + 1] = line end
  end
  if #wrapped == 0 then wrapped[1] = text end
  return wrapped
end

local function applyTruncation(lines, truncate, maxLines)
  if not truncate or #lines <= maxLines then return lines end
  local out = {}
  for i = 1, maxLines do
    out[i] = lines[i]
  end
  -- Append ellipsis to last visible line
  if out[maxLines] then
    out[maxLines] = out[maxLines] .. "..."
  end
  return out
end

--- compact: word-wrapped text block
local function formatCompact(content, cfg, colors)
  local fontSize = (cfg.style and cfg.style.fontSize) or 12
  local fontFamily = cfg.style and cfg.style.fontFamily
  if Measure then fontSize = Measure.scaleFontSize(fontSize) end
  local font = getFont(fontSize, fontFamily)
  local maxW = (cfg.style and cfg.style.maxWidth) or 300
  local padX = 8
  local textW = maxW - padX * 2

  local wrapped = wordWrap(content, font, textW)
  wrapped = applyTruncation(wrapped, cfg.truncate, cfg.maxLines)

  local fontH = font:getHeight()
  local lineH = math.floor(fontH * 1.3)
  local lines = {}
  local textColor = (cfg.style and cfg.style.color) or colors.text
  for _, txt in ipairs(wrapped) do
    lines[#lines + 1] = { text = txt, font = font, color = textColor }
  end

  -- Measure actual width
  local actualW = 0
  for _, l in ipairs(lines) do
    local w = l.font:getWidth(l.text)
    if w > actualW then actualW = w end
  end

  -- Height: inter-line spacing only between lines, not after last
  local contentH = #lines == 1 and fontH or ((#lines - 1) * lineH + fontH)

  return {
    lines = lines,
    lineH = lineH,
    width = math.min(actualW + padX * 2, maxW),
    height = contentH,
    padX = padX,
    padY = 6,
  }
end

--- descriptive: first line bold title, rest normal body
local function formatDescriptive(content, cfg, colors)
  local baseFontSize = (cfg.style and cfg.style.fontSize) or 12
  local fontFamily = cfg.style and cfg.style.fontFamily
  local titleSize = baseFontSize + 1
  local bodySize = baseFontSize - 1
  if Measure then
    titleSize = Measure.scaleFontSize(titleSize)
    bodySize = Measure.scaleFontSize(bodySize)
  end
  local titleFont = getFont(titleSize, fontFamily, "bold")
  local bodyFont = getFont(bodySize, fontFamily)
  local maxW = (cfg.style and cfg.style.maxWidth) or 300
  local padX = 8
  local textW = maxW - padX * 2

  local parts = {}
  for line in content:gmatch("([^\n]*)\n?") do
    if line ~= "" then parts[#parts + 1] = line end
  end

  local titleText = parts[1] or content
  local bodyParts = {}
  for i = 2, #parts do bodyParts[#bodyParts + 1] = parts[i] end
  local bodyText = table.concat(bodyParts, " ")

  local textColor = (cfg.style and cfg.style.color) or colors.text
  local lines = {}

  -- Title line
  local titleWrapped = wordWrap(titleText, titleFont, textW)
  for _, txt in ipairs(titleWrapped) do
    lines[#lines + 1] = { text = txt, font = titleFont, color = colors.title }
  end

  -- Body lines
  if bodyText ~= "" then
    local bodyWrapped = wordWrap(bodyText, bodyFont, textW)
    for _, txt in ipairs(bodyWrapped) do
      lines[#lines + 1] = { text = txt, font = bodyFont, color = textColor }
    end
  end

  lines = applyTruncation(lines, cfg.truncate, cfg.maxLines)

  local titleFontH = titleFont:getHeight()
  local bodyFontH = bodyFont:getHeight()
  local titleLineH = math.floor(titleFontH * 1.3)
  local bodyLineH = math.floor(bodyFontH * 1.3)

  local actualW = 0
  local totalH = 0
  for i, l in ipairs(lines) do
    local w = l.font:getWidth(l.text)
    if w > actualW then actualW = w end
    local isLast = (i == #lines)
    if i <= #titleWrapped then
      totalH = totalH + (isLast and titleFontH or titleLineH)
    else
      totalH = totalH + (isLast and bodyFontH or bodyLineH)
    end
  end

  return {
    lines = lines,
    lineH = bodyLineH,
    titleLineH = titleLineH,
    titleLineCount = math.min(#titleWrapped, #lines),
    width = math.min(actualW + padX * 2, maxW),
    height = totalH,
    padX = padX,
    padY = 6,
  }
end

--- dense: monospace rows, no wrapping, tight spacing
local function formatDense(content, cfg, colors)
  local fontSize = (cfg.style and cfg.style.fontSize) or 11
  if Measure then fontSize = Measure.scaleFontSize(fontSize) end
  local font = getFont(fontSize, "monospace")
  local padX = 8

  local rows = {}
  for line in content:gmatch("([^\n]*)\n?") do
    if line ~= "" then rows[#rows + 1] = line end
  end
  rows = applyTruncation(rows, cfg.truncate, cfg.maxLines)

  local fontH = font:getHeight()
  local lineH = math.floor(fontH * 1.15)
  local textColor = (cfg.style and cfg.style.color) or colors.text
  local lines = {}
  local actualW = 0
  for _, txt in ipairs(rows) do
    lines[#lines + 1] = { text = txt, font = font, color = textColor }
    local w = font:getWidth(txt)
    if w > actualW then actualW = w end
  end

  -- No trailing space after last line
  local contentH = #lines == 1 and fontH or ((#lines - 1) * lineH + fontH)

  return {
    lines = lines,
    lineH = lineH,
    width = actualW + padX * 2,
    height = contentH,
    padX = padX,
    padY = 5,
  }
end

--- table: two-column key:value, aligned
local function formatTable(content, cfg, colors)
  local fontSize = (cfg.style and cfg.style.fontSize) or 12
  if Measure then fontSize = Measure.scaleFontSize(fontSize) end
  local font = getFont(fontSize, nil)
  local padX = 8
  local colGap = 10

  local rows = {}
  for line in content:gmatch("([^\n]*)\n?") do
    if line ~= "" then
      -- Split on first : or tab
      local label, value = line:match("^([^:\t]+)[:\t]%s*(.*)$")
      if label and value then
        rows[#rows + 1] = { label = label, value = value }
      else
        rows[#rows + 1] = { label = line, value = "" }
      end
    end
  end

  -- Truncate rows
  if cfg.truncate and #rows > cfg.maxLines then
    local truncated = {}
    for i = 1, cfg.maxLines do truncated[i] = rows[i] end
    truncated[cfg.maxLines].value = truncated[cfg.maxLines].value .. "..."
    rows = truncated
  end

  -- Measure label column width
  local labelW = 0
  for _, r in ipairs(rows) do
    local w = font:getWidth(r.label)
    if w > labelW then labelW = w end
  end

  local fontH = font:getHeight()
  local lineH = math.floor(fontH * 1.3)
  local textColor = (cfg.style and cfg.style.color) or colors.text
  local lines = {}
  local maxRowW = 0
  for _, r in ipairs(rows) do
    local rowW = labelW + colGap + font:getWidth(r.value)
    if rowW > maxRowW then maxRowW = rowW end
    lines[#lines + 1] = {
      text = r.label,
      value = r.value,
      font = font,
      color = colors.dim,
      valueColor = textColor,
      labelW = labelW,
      colGap = colGap,
    }
  end

  local maxW = (cfg.style and cfg.style.maxWidth) or 400

  -- No trailing space after last row
  local contentH = #lines == 1 and fontH or ((#lines - 1) * lineH + fontH)

  return {
    lines = lines,
    lineH = lineH,
    width = math.min(maxRowW + padX * 2, maxW),
    height = contentH,
    padX = padX,
    padY = 6,
    isTable = true,
  }
end

local formatters = {
  compact = formatCompact,
  descriptive = formatDescriptive,
  dense = formatDense,
  table = formatTable,
}

-- ============================================================================
-- Positioning
-- ============================================================================

local MARGIN = 8
local BORDER_RADIUS = 6

--- Walk up the node tree and accumulate scroll offsets from ancestor ScrollViews.
--- node.computed gives content-space coordinates; the painter applies
--- love.graphics.translate(-scrollX, -scrollY) per scroll container.
--- We need to subtract those same offsets so the tooltip lands on-screen.
local function getScrollOffset(node)
  local ox, oy = 0, 0
  local cur = node and node.parent
  while cur do
    if cur.scrollState then
      ox = ox + (cur.scrollState.scrollX or 0)
      oy = oy + (cur.scrollState.scrollY or 0)
    end
    cur = cur.parent
  end
  return ox, oy
end

--- Compute tooltip position. Returns tooltipX, tooltipY after clamping.
local function computePosition(cfg, formatted, node, mx, my, windowW, windowH)
  local boxW = formatted.width
  local boxH = formatted.height + formatted.padY * 2
  local tx, ty

  if cfg.type == "corner" then
    local c = cfg.corner
    if c == "top-left" then
      tx = MARGIN
      ty = MARGIN
    elseif c == "top-right" then
      tx = windowW - boxW - MARGIN
      ty = MARGIN
    elseif c == "bottom-right" then
      tx = windowW - boxW - MARGIN
      ty = windowH - boxH - MARGIN
    else -- bottom-left (default)
      tx = MARGIN
      ty = windowH - boxH - MARGIN
    end

  elseif cfg.type == "anchor" and node and node.computed then
    local nc = node.computed
    local sox, soy = getScrollOffset(node)
    local nx, ny = nc.x - sox, nc.y - soy
    local a = cfg.anchor
    local gap = 6
    if a == "top" then
      tx = nx + nc.w / 2 - boxW / 2
      ty = ny - boxH - gap
    elseif a == "bottom" then
      tx = nx + nc.w / 2 - boxW / 2
      ty = ny + nc.h + gap
    elseif a == "left" then
      tx = nx - boxW - gap
      ty = ny
    elseif a == "right" then
      tx = nx + nc.w + gap
      ty = ny
    else
      tx = nx + nc.w / 2 - boxW / 2
      ty = ny - boxH - gap
    end

  else -- cursor (default)
    if node and node.computed then
      local nc = node.computed
      local sox, soy = getScrollOffset(node)
      local nx, ny = nc.x - sox, nc.y - soy
      tx = nx + nc.w / 2 - boxW / 2
      if cfg.prefer == "below" then
        ty = ny + nc.h + 6
        if ty + boxH > windowH - MARGIN then
          ty = ny - boxH - 6
        end
      else
        ty = ny - boxH - 6
        if ty < MARGIN then
          ty = ny + nc.h + 6
        end
      end
    else
      -- Fallback: position near mouse
      tx = mx + 12
      ty = my - boxH - 8
      if ty < MARGIN then ty = my + 16 end
    end
  end

  -- Universal clamp — no pixel outside the window, ever
  tx = math.max(MARGIN, math.min(tx, windowW - boxW - MARGIN))
  ty = math.max(MARGIN, math.min(ty, windowH - boxH - MARGIN))

  return tx, ty, boxW, boxH
end

-- ============================================================================
-- Public API: update
-- ============================================================================

function Tooltips.update(hoveredNode, dt, mx, my)
  -- Manual mode takes priority (TextEditor etc)
  if state.manual then return end

  if not hoveredNode then
    state.hoveredNode = nil
    state.parsed = nil
    state.timer = 0
    state.visible = false
    return
  end

  local prop = hoveredNode.props and hoveredNode.props.tooltip
  if not prop then
    state.hoveredNode = nil
    state.parsed = nil
    state.timer = 0
    state.visible = false
    return
  end

  local cfg = parseTooltip(prop, hoveredNode)
  if not cfg then
    state.hoveredNode = nil
    state.parsed = nil
    state.timer = 0
    state.visible = false
    return
  end

  if hoveredNode == state.hoveredNode then
    -- Same node — advance timer
    state.timer = state.timer + dt
    state.mouseX = mx
    state.mouseY = my
    if state.timer >= cfg.delay then
      state.visible = true
    end
  else
    -- New node — reset
    state.hoveredNode = hoveredNode
    state.parsed = cfg
    state.timer = 0
    state.visible = false
    state.mouseX = mx
    state.mouseY = my
  end
end

-- ============================================================================
-- Public API: showManual (for TextEditor, inspector, etc.)
-- ============================================================================

--- Show a tooltip at specific coordinates, bypassing node hover.
--- Call this from update(), then it renders in draw().
--- Pass nil to clear.
function Tooltips.showManual(text, x, y, config)
  if not text or text == "" then
    state.manual = false
    state.manualText = nil
    state.manualConfig = nil
    -- Don't clear node hover state — let it resume naturally
    return
  end
  state.manual = true
  state.manualText = text
  state.manualX = x
  state.manualY = y
  state.manualConfig = config or {}
  -- Manual mode means visible immediately (caller handles their own delay)
  state.visible = true
end

-- ============================================================================
-- Public API: draw
-- ============================================================================

function Tooltips.draw(windowW, windowH)
  if not state.visible then return end

  local cfg, node, mx, my

  if state.manual and state.manualText then
    -- Manual mode — build config from manual state
    cfg = {
      content = state.manualText,
      type = state.manualConfig.type or "cursor",
      layout = state.manualConfig.layout or "compact",
      truncate = state.manualConfig.truncate or false,
      maxLines = state.manualConfig.maxLines or 3,
      style = state.manualConfig.style,
      prefer = "above",
      anchor = "top",
      corner = "bottom-left",
    }
    node = nil
    mx = state.manualX
    my = state.manualY
  else
    cfg = state.parsed
    node = state.hoveredNode
    mx = state.mouseX
    my = state.mouseY
  end

  if not cfg or not cfg.content or cfg.content == "" then return end

  local colors = resolveColors()

  -- Apply bg color override
  local bgColor = (cfg.style and cfg.style.backgroundColor) or colors.bg

  -- Format content
  local formatter = formatters[cfg.layout] or formatCompact
  local formatted = formatter(cfg.content, cfg, colors)
  if not formatted or not formatted.lines or #formatted.lines == 0 then return end

  -- Position
  local tx, ty, boxW, boxH = computePosition(cfg, formatted, node, mx, my, windowW, windowH)

  -- ── DRAW ──────────────────────────────────────────────────────────
  -- Clear ALL scissors. The tooltip lives outside every clipping region.
  love.graphics.setScissor()

  -- Background
  love.graphics.setColor(bgColor)
  love.graphics.rectangle("fill", tx, ty, boxW, boxH, BORDER_RADIUS, BORDER_RADIUS)

  -- Border
  love.graphics.setColor(colors.border)
  love.graphics.setLineWidth(1)
  love.graphics.rectangle("line", tx, ty, boxW, boxH, BORDER_RADIUS, BORDER_RADIUS)

  -- Content
  local textY = ty + formatted.padY
  local padX = formatted.padX

  if formatted.isTable then
    -- Table layout: two columns
    for i, l in ipairs(formatted.lines) do
      love.graphics.setFont(l.font)
      -- Label (dim, left-aligned)
      love.graphics.setColor(l.color)
      love.graphics.print(l.text, tx + padX, textY)
      -- Value (bright, offset by labelW + gap)
      if l.value and l.value ~= "" then
        love.graphics.setColor(l.valueColor)
        love.graphics.print(l.value, tx + padX + l.labelW + l.colGap, textY)
      end
      textY = textY + formatted.lineH
    end
  elseif formatted.titleLineH then
    -- Descriptive layout: title lines use titleLineH, body uses lineH
    local titleCount = formatted.titleLineCount or 1
    for i, l in ipairs(formatted.lines) do
      love.graphics.setFont(l.font)
      love.graphics.setColor(l.color)
      love.graphics.print(l.text, tx + padX, textY)
      if i <= titleCount then
        textY = textY + formatted.titleLineH
      else
        textY = textY + formatted.lineH
      end
    end
  else
    -- Compact / dense: uniform line height
    for _, l in ipairs(formatted.lines) do
      love.graphics.setFont(l.font)
      love.graphics.setColor(l.color)
      love.graphics.print(l.text, tx + padX, textY)
      textY = textY + formatted.lineH
    end
  end
end

-- ============================================================================
-- Public API: clear (force hide)
-- ============================================================================

function Tooltips.clear()
  state.hoveredNode = nil
  state.parsed = nil
  state.timer = 0
  state.visible = false
  state.manual = false
  state.manualText = nil
  state.manualConfig = nil
end

--- Return whether a tooltip is currently visible (for external checks).
function Tooltips.isVisible()
  return state.visible
end

return Tooltips
