--[[
  layout.lua -- Flexbox layout engine

  Computes {x, y, w, h} for every node in the retained tree.
  Supports:
    - Absolute units, percentages, vw/vh
    - flexDirection row/column
    - flexWrap: nowrap (default), wrap
    - flexGrow, flexBasis
    - justifyContent: start, center, end, space-between, space-around, space-evenly
    - alignItems: stretch (default), start, center, end
    - alignSelf: auto, start, center, end, stretch (per-child override)
    - padding (all sides + per-side)
    - margin (all sides + per-side)
    - gap (applies between items on a line AND between lines when wrapping)
    - display: flex (default), none (skip node entirely)
    - position: relative (default), absolute (out-of-flow, positioned via top/left/right/bottom)
    - minWidth / maxWidth / minHeight / maxHeight clamping
    - Intrinsic text measurement for Text/__TEXT__ nodes
    - Padding-aware text wrapping (inner width used as constraint)
    - Re-measurement of text height after flex distribution
    - Nested Text node content resolution
    - Custom font family inheritance for text measurement
    - lineHeight, letterSpacing, numberOfLines text properties
]]

local Log = require("lua.debug_log")

local Measure = nil  -- Injected at init time via Layout.init()
local CodeBlockModule = nil  -- Lazy-loaded for CodeBlock measurement

-- Frame budget: max layoutNode calls per layout pass.
-- Empirical: 5,000-node tree ≈ 5,000 calls. 10,000 is generous headroom.
-- An infinite loop hits this in microseconds. A legitimate tree never will.
local _layoutBudget = 100000
local _layoutCount = 0
local CapabilitiesModule = nil  -- Lazy-loaded for visual capability measurement

local Layout = {}
Layout._debugPrint = false  -- set true to enable [STRETCH-DBG] / [LAYOUT-DBG] prints
Layout._profilingEnabled = false
Layout._activeProfile = nil
Layout._profileLastPass = nil
Layout._profileTotals = nil
Layout._profilePassSeq = 0

--- Check if a dimension value is "fit-content" (or the shorthand "fit").
local function isFitContent(v)
  return v == "fit-content" or v == "fit"
end

local function profileNow()
  if love and love.timer and love.timer.getTime then
    return love.timer.getTime()
  end
  return os.clock()
end

local function profileDeepCopy(value)
  if type(value) ~= "table" then return value end
  local out = {}
  for k, v in pairs(value) do
    out[k] = profileDeepCopy(v)
  end
  return out
end

local function profileMergeMap(dst, src)
  if not src then return end
  for k, v in pairs(src) do
    dst[k] = (dst[k] or 0) + v
  end
end

local function profileCount(name, delta)
  local pass = Layout._activeProfile
  if not pass then return end
  local counters = pass.counters
  counters[name] = (counters[name] or 0) + (delta or 1)
end

local function profileSectionStart(_)
  if not Layout._activeProfile then return nil end
  return profileNow()
end

local function profileSectionEnd(name, t0)
  if not t0 then return end
  local pass = Layout._activeProfile
  if not pass then return end
  local ms = (profileNow() - t0) * 1000
  local sections = pass.sections
  sections[name] = (sections[name] or 0) + ms
end

local function profileBuildTopRevisits(seenNodeIds, limit)
  local rows = {}
  for id, visits in pairs(seenNodeIds) do
    if visits > 1 then
      rows[#rows + 1] = { id = id, visits = visits }
    end
  end
  table.sort(rows, function(a, b) return a.visits > b.visits end)
  if #rows > limit then
    local trimmed = {}
    for i = 1, limit do
      trimmed[i] = rows[i]
    end
    return trimmed
  end
  return rows
end

local function profileFinishPass(pass)
  pass.passMs = (profileNow() - pass._startT) * 1000
  pass.revisitVisits = pass.nodeVisits - pass.uniqueNodes
  pass.topRevisitedNodes = profileBuildTopRevisits(pass._seenNodeIds, 10)
  pass._startT = nil
  pass._seenNodeIds = nil
  return pass
end

function Layout.setProfilingEnabled(v)
  Layout._profilingEnabled = not not v
  if not Layout._profilingEnabled then
    Layout._activeProfile = nil
  end
end

function Layout.resetProfilingData()
  Layout._profileLastPass = nil
  Layout._profileTotals = nil
  Layout._profilePassSeq = 0
  if Layout._activeProfile then
    Layout._activeProfile = nil
  end
end

function Layout.getProfilingData()
  return {
    enabled = Layout._profilingEnabled,
    lastPass = profileDeepCopy(Layout._profileLastPass),
    totals = profileDeepCopy(Layout._profileTotals),
  }
end

-- ============================================================================
-- Proportional surface fallback
-- ============================================================================
-- "Surface" node types are visual canvases (boxes, images, video) that should
-- occupy proportional space when unsized, rather than collapsing to zero.
-- Interactive elements (buttons, inputs, text) size from their content instead.
-- When a surface has no explicit dimensions and no children to measure from,
-- it falls back to parent_height / 4, cascading recursively so nested unsized
-- surfaces shrink proportionally with their container.
-- Applied in layoutNode after auto-height resolves (ph is definite at that point).

local SURFACE_TYPES = {
  View     = true,
  Image    = true,
  Video    = true,
  VideoPlayer = true,
  Scene3D  = true,
  Emulator = true,
}

--- Check if a node is a visual surface (eligible for proportional fallback).
--- Excludes scroll containers (they intentionally need explicit height).
local function isSurface(node)
  if SURFACE_TYPES[node.type] then
    local s = node.style or {}
    if s.overflow == "scroll" or s.overflow == "auto" then return false end
    return true
  end
  -- Standalone effects (not background mode) are visual surfaces too.
  if Layout._effects and Layout._effects.isEffect(node.type) then
    local props = node.props or {}
    if not props.background then return true end
  end
  return false
end


--- Initialize the layout engine with target-specific dependencies.
--- Must be called before any layout operations.
--- @param config table  { measure = MeasureModule }
function Layout.init(config)
  config = config or {}
  Measure = config.measure
end

-- ============================================================================
-- Unit resolution
-- ============================================================================

--- Resolve a style value to a pixel number.
--- Handles: plain number, "50%", "10vw", "5vh", bare numeric strings.
--- Returns nil when value is nil or unparseable.
function Layout.resolveUnit(value, parentSize)
  if value == nil then return nil end
  if value == "fit-content" or value == "fit" then return nil end
  if type(value) == "number" then return value end
  if type(value) ~= "string" then return nil end

  -- calc(X% ± Ypx) support
  local cpct, csign, cpx = value:match("^calc%(([%d%.]+)%% ([%+%-]) ([%d%.]+)px%)$")
  if cpct then
    -- When parentSize is unknown (nil), percentage-based values are unresolvable.
    -- Return nil so callers treat the dimension as "unknown" and fall through to
    -- content-based sizing, instead of returning 0 which Lua treats as truthy
    -- and masquerades as a known explicit dimension of zero.
    if not parentSize then return nil end
    local base = (tonumber(cpct) / 100) * parentSize
    local px   = tonumber(cpx) or 0
    return csign == "+" and base + px or base - px
  end

  local num, unit = value:match("^([%d%.]+)(.*)$")
  num = tonumber(num)
  if not num then return nil end

  if unit == "%" then
    if not parentSize then return nil end
    return (num / 100) * parentSize
  elseif unit == "vw" then
    return (num / 100) * (Layout._viewportW or (love and love.graphics and love.graphics.getWidth() or 1280))
  elseif unit == "vh" then
    return (num / 100) * (Layout._viewportH or (love and love.graphics and love.graphics.getHeight() or 720))
  end

  -- bare number or unknown unit -- treat as pixels
  return num
end

-- ============================================================================
-- Text content resolution
-- ============================================================================

--- Recursively collect text content from a node and its descendants.
--- Handles nested Text nodes (e.g. <Text>Hello <Text>World</Text></Text>)
--- by concatenating all text from __TEXT__ and nested Text children.
local function collectTextContent(node)
  if node.type == "__TEXT__" then
    return node.text or ""
  end

  local children = node.children or {}
  if #children > 0 then
    local parts = {}
    for _, child in ipairs(children) do
      if child.type == "__TEXT__" and child.text then
        parts[#parts + 1] = child.text
      elseif child.type == "Text" then
        local nested = collectTextContent(child)
        if nested and nested ~= "" then
          parts[#parts + 1] = nested
        end
      end
    end
    if #parts > 0 then
      return table.concat(parts)
    end
  end

  return nil
end

--- Resolve the text content for a node, matching painter.lua's logic.
--- For __TEXT__ nodes, returns node.text.
--- For Text nodes, concatenates __TEXT__ and nested Text children.
--- Returns nil for non-text nodes.
local function resolveTextContent(node)
  if node.type == "__TEXT__" then
    return node.text or ""
  end

  if node.type == "Text" then
    -- Try collecting from children first (handles nested Text nodes)
    local collected = collectTextContent(node)
    if collected then return collected end

    -- Fall back to props.children (direct string content)
    local text = node.text or (node.props and node.props.children) or nil
    if type(text) == "table" then text = table.concat(text) end
    if text then return tostring(text) end
  end

  return nil
end

--- Get the fontSize for a text node, checking the node's own style
--- and walking up to parent Text node if this is a __TEXT__ child.
local function resolveFontSize(node)
  local s = node.style or {}
  if s.fontSize then return s.fontSize end

  -- __TEXT__ nodes inherit fontSize from their parent Text node
  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.fontSize then return ps.fontSize end
  end

  return 14  -- default
end

--- Get the fontWeight for a text node, checking the node's own style
--- and walking up to parent Text node if this is a __TEXT__ child.
--- Returns nil when not set.
local function resolveFontWeight(node)
  local s = node.style or {}
  if s.fontWeight then return s.fontWeight end

  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.fontWeight then return ps.fontWeight end
  end

  return nil
end

--- Get the fontFamily for a text node, checking the node's own style
--- and walking up to parent Text node if this is a __TEXT__ child.
--- Returns nil for default font.
local function resolveFontFamily(node)
  local s = node.style or {}
  if s.fontFamily then return s.fontFamily end

  -- __TEXT__ nodes inherit fontFamily from their parent Text node
  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.fontFamily then return ps.fontFamily end
  end

  return nil
end

--- Get the lineHeight for a text node, checking the node's own style
--- and walking up to parent Text node if this is a __TEXT__ child.
--- Returns nil to use font's natural line height.
local function resolveLineHeight(node)
  local s = node.style or {}
  if s.lineHeight then return s.lineHeight end

  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.lineHeight then return ps.lineHeight end
  end

  return nil
end

--- Get the letterSpacing for a text node, checking the node's own style
--- and walking up to parent Text node if this is a __TEXT__ child.
--- Returns nil when not set.
local function resolveLetterSpacing(node)
  local s = node.style or {}
  if s.letterSpacing then return s.letterSpacing end

  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    if ps.letterSpacing then return ps.letterSpacing end
  end

  return nil
end

--- Resolve text wrapping mode for a text node.
--- Supports CSS-like whiteSpace:'nowrap' and textWrap:'nowrap' aliases.
local function resolveTextNoWrap(node)
  local s = node.style or {}
  local wrap = s.textWrap
  local ws = s.whiteSpace
  if wrap == "nowrap" or ws == "nowrap" then return true end
  if wrap == "wrap" or ws == "normal" then return false end

  if node.type == "__TEXT__" and node.parent then
    local ps = node.parent.style or {}
    local pWrap = ps.textWrap
    local pWs = ps.whiteSpace
    if pWrap == "nowrap" or pWs == "nowrap" then return true end
    if pWrap == "wrap" or pWs == "normal" then return false end
  end

  return false
end

--- Get the numberOfLines for a text node, checking node props
--- and walking up to parent Text node if this is a __TEXT__ child.
--- Returns nil when not set.
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
-- Intrinsic text measurement
-- ============================================================================

--- Measure a text node's intrinsic size given an available width constraint.
--- Returns measuredW, measuredH or nil, nil if the node is not a text node.
local function measureTextNode(node, availW)
  profileCount("measureTextInvocations")
  local text = resolveTextContent(node)
  if not text then return nil, nil end

  local ts = Measure.resolveTextScale(node)
  local fontSize = math.floor(resolveFontSize(node) * ts)
  local fontFamily = resolveFontFamily(node)
  local fontWeight = resolveFontWeight(node)
  local lineHeight = resolveLineHeight(node)
  if lineHeight then lineHeight = math.floor(lineHeight * ts) end
  local letterSpacing = resolveLetterSpacing(node)
  local numberOfLines = resolveNumberOfLines(node)
  local noWrap = resolveTextNoWrap(node)

  local result = Measure.measureText(text, fontSize, availW, fontFamily, lineHeight, letterSpacing, numberOfLines, fontWeight, noWrap)
  return result.width, result.height
end

-- ============================================================================
-- Size clamping
-- ============================================================================

--- Clamp a dimension value using min/max constraints.
--- Returns the clamped value.
local function clampDim(value, minVal, maxVal)
  if minVal and value < minVal then value = minVal end
  if maxVal and value > maxVal then value = maxVal end
  return value
end

-- ============================================================================
-- Min-content size (CSS min-width: auto floor for flex items)
-- ============================================================================

--- Compute the min-content width of a node.
--- For text: the width of the longest word (measure with availW=0).
--- For row containers: sum of children min-content + gaps.
--- For column containers: max of children min-content.
local _mcwDebug = false
-- Expose so external tools can enable MCW debug:
function Layout.setMcwDebug(v) _mcwDebug = v end
local function computeMinContentW(node, depth)
  depth = depth or 0
  local ru = Layout.resolveUnit
  local s = node.style or {}
  local pad = ru(s.padding, 0) or 0
  local padL = ru(s.paddingLeft, 0) or pad
  local padR = ru(s.paddingRight, 0) or pad

  if node.type == "Text" or node.type == "__TEXT__" then
    local text = resolveTextContent(node)
    if not text then return 0 end
    local ts = Measure.resolveTextScale(node)
    local fontSize = math.floor(resolveFontSize(node) * ts)
    local fontFamily = resolveFontFamily(node)
    local fontWeight = resolveFontWeight(node)
    local letterSpacing = resolveLetterSpacing(node)
    local mw = Measure.measureMinContentWidth(text, fontSize, fontFamily, letterSpacing, fontWeight)
    if _mcwDebug then
      io.write(string.format("[MCW]%s type=%s text=%q mw=%s pad=%s+%s\n",
        string.rep("  ", depth), node.type, tostring(text or ""):sub(1,30), tostring(mw), tostring(padL), tostring(padR)))
      io.flush()
    end
    if mw then return mw + padL + padR end
    return 0
  end

  local children = node.children or {}
  if #children == 0 then
    if _mcwDebug then
      io.write(string.format("[MCW]%s type=%s EMPTY → 0\n", string.rep("  ", depth), node.type))
      io.flush()
    end
    return 0
  end

  local childIsRow = (s.flexDirection == "row" or s.flexDirection == "row-reverse")
  local gap = ru(s.gap, 0) or 0

  local minW = 0
  local visCount = 0
  for _, child in ipairs(children) do
    local cs = child.style or {}
    if cs.display ~= "none" and cs.position ~= "absolute" then
      local childMin = computeMinContentW(child, depth + 1)
      if childIsRow then
        minW = minW + childMin
        visCount = visCount + 1
      else
        if childMin > minW then minW = childMin end
      end
    end
  end

  if childIsRow and visCount > 1 then
    minW = minW + (visCount - 1) * gap
  end

  local result = minW + padL + padR
  if _mcwDebug then
    io.write(string.format("[MCW]%s type=%s dir=%s kids=%d minW=%.1f pad=%s+%s → %.1f\n",
      string.rep("  ", depth), node.type, childIsRow and "row" or "col", visCount, minW, tostring(padL), tostring(padR), result))
    io.flush()
  end
  return result
end

-- ============================================================================
-- Cross-axis alignment helper
-- ============================================================================

--- Determine the effective cross-axis alignment for a child.
--- Uses child's alignSelf if set (and not "auto"), else falls back to
--- the parent's alignItems value.
--- Normalize CSS flex alignment values to simple keywords.
--- "flex-start" → "start", "flex-end" → "end", etc.
local function normalizeAlign(val)
  if val == "flex-start" then return "start" end
  if val == "flex-end" then return "end" end
  return val
end

local function effectiveAlign(parentAlign, childStyle)
  local selfAlign = childStyle and childStyle.alignSelf
  if selfAlign and selfAlign ~= "auto" then
    return normalizeAlign(selfAlign)
  end
  return normalizeAlign(parentAlign)
end

-- ============================================================================
-- Intrinsic size estimation (auto-sizing)
-- ============================================================================

--- Estimate intrinsic (content-based) size of a container.
--- Recursively measures children bottom-up, then adds padding/gaps.
--- Used for auto-sizing containers when no explicit dimensions are set.
---
--- @param node table  The node to measure
--- @param isRow boolean  true = measure width, false = measure height
--- @param pw number|nil  Parent width (for percentage resolution)
--- @param ph number|nil  Parent height (for percentage resolution)
--- @return number  Estimated size in pixels
local function estimateIntrinsicMain(node, isRow, pw, ph)
  profileCount("intrinsicEstimateInvocations")
  local s = node.style or {}
  local ru = Layout.resolveUnit

  -- 1. Calculate padding along the measurement axis
  local pad = ru(s.padding, isRow and pw or ph) or 0
  local padStart = isRow and (ru(s.paddingLeft, pw) or pad)
                          or (ru(s.paddingTop, ph) or pad)
  local padEnd = isRow and (ru(s.paddingRight, pw) or pad)
                        or (ru(s.paddingBottom, ph) or pad)
  local padMain = padStart + padEnd

  -- 2. Text nodes: measure with font metrics
  local isTextNode = (node.type == "Text" or node.type == "__TEXT__")
  if isTextNode then
    local text = resolveTextContent(node)
    if text and text ~= "" then
      local ts = Measure.resolveTextScale(node)
      local fontSize = math.floor(resolveFontSize(node) * ts)
      local fontFamily = resolveFontFamily(node)
      local fontWeight = resolveFontWeight(node)
      local lineHeight = resolveLineHeight(node)
      if lineHeight then lineHeight = math.floor(lineHeight * ts) end
      local letterSpacing = resolveLetterSpacing(node)
      local numberOfLines = resolveNumberOfLines(node)
      local noWrap = resolveTextNoWrap(node)

      -- When measuring height (not isRow), use pw as wrap constraint so
      -- multi-line text produces the correct wrapped height instead of
      -- being measured as a single line.
      local wrapWidth = nil
      if not isRow and pw then
        local hPad = ru(s.padding, pw) or 0
        local hPadL = ru(s.paddingLeft, pw) or hPad
        local hPadR = ru(s.paddingRight, pw) or hPad
        wrapWidth = pw - hPadL - hPadR
        if wrapWidth < 0 then wrapWidth = nil end
      end
      local result = Measure.measureText(text, fontSize, wrapWidth, fontFamily,
                                        lineHeight, letterSpacing, numberOfLines, fontWeight, noWrap)
      return (isRow and result.width or result.height) + padMain
    end
    return padMain  -- Empty text
  end

  -- 2b. TextInput nodes: intrinsic height from font metrics (opaque leaf, no children)
  if node.type == "TextInput" then
    if not isRow then
      local ts = Measure.resolveTextScale(node)
      local fontSize = math.floor((s.fontSize or 14) * ts)
      local font = Measure.getFont(fontSize, s.fontFamily or nil, s.fontWeight or nil)
      return font:getHeight() + padMain
    end
    return padMain  -- width: let parent provide
  end

  -- 2c. CodeBlock nodes: intrinsic size from code content (opaque leaf, no children)
  if node.type == "CodeBlock" then
    if not CodeBlockModule then
      CodeBlockModule = require("lua.codeblock")
    end
    local measured = CodeBlockModule.measure(node, isRow)
    if measured then
      if isRow then
        return measured.width + padMain
      end
      return measured.height + padMain
    end
    return padMain
  end

  -- 3. Container nodes: recursively estimate from children
  local children = node.children or {}
  if #children == 0 then
    return padMain  -- Empty container
  end

  local gap = ru(s.gap, isRow and pw or ph) or 0
  local direction = s.flexDirection or "column"
  local containerIsRow = (direction == "row")

  -- When measuring height, children need the container's inner width
  -- (after horizontal padding) so text nodes wrap at the correct width.
  local childPw = pw
  if not isRow and pw then
    local hPad = ru(s.padding, pw) or 0
    local hPadL = ru(s.paddingLeft, pw) or hPad
    local hPadR = ru(s.paddingRight, pw) or hPad
    childPw = pw - hPadL - hPadR
    if childPw < 0 then childPw = 0 end
  end

  -- 4. Sum (main axis) or max (cross axis) children, skipping hidden and absolute nodes
  local visibleCount = 0

  if (isRow and containerIsRow) or (not isRow and not containerIsRow) then
    -- Main axis: sum children + gaps
    local sum = 0
    for _, child in ipairs(children) do
      local cs = child.style or {}
      if cs.display ~= "none" and cs.position ~= "absolute" then
        visibleCount = visibleCount + 1

        -- Account for child margins along measurement axis
        local cmar = ru(cs.margin, isRow and pw or ph) or 0
        local marStart = isRow and (ru(cs.marginLeft, pw) or cmar)
                                or (ru(cs.marginTop, ph) or cmar)
        local marEnd = isRow and (ru(cs.marginRight, pw) or cmar)
                              or (ru(cs.marginBottom, ph) or cmar)

        local explicitMain = isRow and ru(cs.width, pw) or ru(cs.height, ph)
        if explicitMain then
          sum = sum + explicitMain + marStart + marEnd
        else
          sum = sum + estimateIntrinsicMain(child, isRow, childPw, ph) + marStart + marEnd
        end
      end
    end
    local totalGaps = math.max(0, visibleCount - 1) * gap
    return padMain + sum + totalGaps
  else
    -- Cross axis: take max of children
    local max = 0
    for _, child in ipairs(children) do
      local cs = child.style or {}
      if cs.display ~= "none" and cs.position ~= "absolute" then
        -- Account for child margins along measurement axis
        local cmar = ru(cs.margin, isRow and pw or ph) or 0
        local marStart = isRow and (ru(cs.marginLeft, pw) or cmar)
                                or (ru(cs.marginTop, ph) or cmar)
        local marEnd = isRow and (ru(cs.marginRight, pw) or cmar)
                              or (ru(cs.marginBottom, ph) or cmar)

        -- Check explicit dimension first (mirrors main-axis branch).
        -- Without this, percentage widths like "100%" are ignored and we
        -- recurse into grandchildren, collapsing the cross-axis estimate.
        local explicitCross = isRow and ru(cs.width, pw) or ru(cs.height, ph)
        local size
        if explicitCross then
          size = explicitCross + marStart + marEnd
        else
          size = estimateIntrinsicMain(child, isRow, childPw, ph) + marStart + marEnd
        end
        if size > max then max = size end
      end
    end
    return padMain + max
  end
end

-- ============================================================================
-- Recursive layout
-- ============================================================================

--- Lay out a single node and all of its descendants.
--- px, py  = parent's content origin (top-left)
--- pw, ph  = available width and height from parent
function Layout.layoutNode(node, px, py, pw, ph, depth)
  if not node then return end
  depth = depth or 0
  _layoutCount = _layoutCount + 1
  if _layoutCount > _layoutBudget then
    error(string.format(
      "[BUDGET] Layout pass exceeded %d nodes (last node: id=%s type=%s debugName=%s). Likely infinite loop.",
      _layoutBudget, tostring(node.id), tostring(node.type), tostring(node.debugName or "?")))
  end
  local activeProfile = Layout._activeProfile
  if activeProfile then
    activeProfile.nodeVisits = activeProfile.nodeVisits + 1
    if depth > activeProfile.maxDepth then
      activeProfile.maxDepth = depth
    end
    local nodeKey = tostring(node.id or node.debugName or node.type or "<unknown>")
    local seen = activeProfile._seenNodeIds
    local visits = (seen[nodeKey] or 0) + 1
    seen[nodeKey] = visits
    if visits == 1 then
      activeProfile.uniqueNodes = activeProfile.uniqueNodes + 1
    end
  end
  local _lt0 = profileNow()
  local s = node.style or {}
  Log.log("layout", "layoutNode id=%s type=%s debugName=%s avail=%sx%s", tostring(node.id), tostring(node.type), tostring(node.debugName or "-"), tostring(pw), tostring(ph))

  -- ==================================================================
  -- display:none -- skip this node entirely, give it zero-size computed rect.
  -- Its children are NOT laid out.
  -- ==================================================================
  if s.display == "none" then
    Log.log("layout", "  skip display:none id=%s", tostring(node.id))
    node.computed = { x = px, y = py, w = 0, h = 0, wSource = "none", hSource = "none", layoutMs = 0 }
    return
  end

  -- Non-visual capability nodes (Audio, Timer, etc.) have no layout.
  -- Capabilities that render in their own surface (Window) also skip layout
  -- when they appear as children in a parent's layout pass — but NOT when
  -- they are the root of their own window's layout pass (px==0 and py==0
  -- and pw > 0 indicates a root-level call from the window manager).
  if not Layout._capabilities then
    local ok, mod = pcall(require, "lua.capabilities")
    if ok then Layout._capabilities = mod end
  end
  if Layout._capabilities then
    if Layout._capabilities.isNonVisual(node.type)
       and not Layout._capabilities.rendersInOwnSurface(node.type) then
      if not Layout._layoutDbgSeen then Layout._layoutDbgSeen = {} end
      Layout._layoutDbgSeen[node.type] = (Layout._layoutDbgSeen[node.type] or 0) + 1
      if Layout._debugPrint and Layout._layoutDbgSeen[node.type] <= 3 then
        io.write(string.format("[LAYOUT-DBG] non-visual skip: type=%s id=%s → 0x0\n", node.type, tostring(node.id))); io.flush()
      end
      node.computed = { x = px, y = py, w = 0, h = 0 }
      return
    end
    if Layout._capabilities.rendersInOwnSurface(node.type)
       and not node._isWindowRoot then
      if not Layout._layoutDbgSeen then Layout._layoutDbgSeen = {} end
      Layout._layoutDbgSeen[node.type] = (Layout._layoutDbgSeen[node.type] or 0) + 1
      if Layout._debugPrint and Layout._layoutDbgSeen[node.type] <= 3 then
        io.write(string.format("[LAYOUT-DBG] ownSurface skip: type=%s id=%s → 0x0\n", node.type, tostring(node.id))); io.flush()
      end
      node.computed = { x = px, y = py, w = 0, h = 0 }
      return
    end
  end

  -- Background-mode effects (e.g. <Spirograph background />) skip layout entirely.
  if not Layout._effects then
    local ok, mod = pcall(require, "lua.effects")
    if ok then Layout._effects = mod end
  end
  if Layout._effects and Layout._effects.isBackgroundEffect(node) then
    node.computed = { x = px, y = py, w = 0, h = 0 }
    return
  end

  -- Mask nodes (e.g. <CRT mask />) skip layout — they are post-processing overlays.
  if not Layout._masks then
    local ok, mod = pcall(require, "lua.masks")
    if ok then Layout._masks = mod end
  end
  if Layout._masks and Layout._masks.isMask(node) then
    node.computed = { x = px, y = py, w = 0, h = 0 }
    return
  end

  local ru = Layout.resolveUnit

  -- Percentage dimensions resolve against the PARENT's inner dimensions,
  -- not the node's own allocated size (pw/ph). The parent sets _parentInnerW/H
  -- before calling layoutNode. For the root node (no parent), pw/ph IS the
  -- viewport and is correct.
  local pctW = node._parentInnerW or pw
  local pctH = node._parentInnerH or ph
  node._parentInnerW = nil
  node._parentInnerH = nil

  -- Resolve min/max constraints
  local minW = ru(s.minWidth, pctW)
  local maxW = ru(s.maxWidth, pctW)
  local minH = ru(s.minHeight, pctH)
  local maxH = ru(s.maxHeight, pctH)

  -- Own dimensions
  local explicitW = ru(s.width, pctW)
  local explicitH = ru(s.height, pctH)
  local fitW = isFitContent(s.width)
  local fitH = isFitContent(s.height)

  local w, h
  local wSource, hSource  -- provenance: why this dimension has its value

  -- Width resolution with auto-sizing
  if explicitW then
    w = explicitW
    wSource = "explicit"
  elseif fitW then
    local _tIntrinsic = profileSectionStart("intrinsicEstimateMs")
    w = estimateIntrinsicMain(node, true, pw, ph)
    profileSectionEnd("intrinsicEstimateMs", _tIntrinsic)
    profileCount("intrinsicEstimateCalls")
    wSource = "fit-content"
  elseif pw then
    w = pw  -- Use parent's available width
    wSource = "parent"
  else
    -- No explicit width and no parent width: auto-size from content
    local _tIntrinsic = profileSectionStart("intrinsicEstimateMs")
    w = estimateIntrinsicMain(node, true, pw, ph)
    profileSectionEnd("intrinsicEstimateMs", _tIntrinsic)
    profileCount("intrinsicEstimateCalls")
    wSource = "content"
  end

  -- Height resolution - use existing deferred auto-height behavior
  -- (computed later after laying out children, lines 864-890)
  h = explicitH
  if h then hSource = "explicit"
  elseif fitH then hSource = "fit-content"
  end

  -- aspectRatio: compute missing dimension from the other
  local ar = s.aspectRatio
  if ar and ar > 0 then
    if explicitW and not h then
      h = explicitW / ar
      hSource = "aspect-ratio"
    elseif h and not explicitW then
      w = h * ar
      wSource = "aspect-ratio"
    end
  end

  -- Flex-adjusted width: if parent's flex algorithm (grow/shrink) assigned
  -- a different main-axis size, use it instead of explicitW so the child
  -- respects the flex distribution.
  local parentAssignedW = false
  if node._flexW then
    w = node._flexW
    wSource = node._rootAutoW and "root" or "flex"
    node._flexW = nil
    node._rootAutoW = nil
    parentAssignedW = true
    profileCount("parentAssignedWidthNodes")
  end

  -- Flex-stretch: if parent assigned a cross-axis dimension, use it
  -- so innerH is correct for children and auto-sizing doesn't override it.
  if h == nil and node._stretchH then
    h = node._stretchH
    if node._rootAutoH then
      hSource = "root"
    elseif node._flexGrowH then
      hSource = "flex"
    else
      hSource = "stretch"
    end
  end
  node._stretchH = nil
  node._rootAutoH = nil
  node._flexGrowH = nil

  -- Resolve padding early so text measurement can use inner width.
  -- We use the outer width for percentage-based padding resolution.
  local pad  = ru(s.padding, w) or 0
  local padL = ru(s.paddingLeft, w)   or pad
  local padR = ru(s.paddingRight, w)  or pad
  local padT = ru(s.paddingTop, h)    or pad
  local padB = ru(s.paddingBottom, h) or pad

  -- For text nodes and code blocks without explicit dimensions, measure intrinsic size.
  -- Use inner width (after padding) as the wrap constraint so the text
  -- wraps correctly inside the padding box.
  local isTextNode = (node.type == "Text" or node.type == "__TEXT__")
  local isCodeBlock = (node.type == "CodeBlock")
  local isTextInput = (node.type == "TextInput")

  if isTextNode then
    if not explicitW or not explicitH then
      -- The wrap constraint is the inner width (outer minus padding)
      local outerConstraint = explicitW or pw or 0

      -- When maxWidth is set and no explicit width, clamp the constraint
      if not explicitW and maxW then
        outerConstraint = math.min(outerConstraint, maxW)
      end

      local constrainW = outerConstraint - padL - padR
      if constrainW < 0 then constrainW = 0 end

      local _tMeasure = profileSectionStart("textMeasureInitialMs")
      local mw, mh = measureTextNode(node, constrainW)
      profileSectionEnd("textMeasureInitialMs", _tMeasure)
      profileCount("textMeasureInitialCalls")
      Log.log("layout", "  measureText id=%s constraint=%s -> %sx%s text=%q", tostring(node.id), tostring(constrainW), tostring(mw), tostring(mh), tostring(resolveTextContent(node) or ""):sub(1, 40))
      if mw and mh then
        if not explicitW and not parentAssignedW then
          -- Node width = measured text width + padding
          w = mw + padL + padR
          wSource = "text"
        end
        if not explicitH then
          -- Node height = measured text height + padding
          h = mh + padT + padB
          hSource = "text"
        end
      end
    end
  elseif isCodeBlock then
    -- Measure CodeBlock via codeblock.lua
    -- Width: shrink-wrap to content (like <pre><code> on the web).
    -- Height: auto-size to content if not explicit.
    -- CodeBlock.measure returns content-only dimensions (no padding),
    -- matching the Text pattern where the layout adds padding.
    if not explicitW or not explicitH then
      if not CodeBlockModule then
        CodeBlockModule = require("lua.codeblock")
      end
      local measured = CodeBlockModule.measure(node, true)
      if measured then
        if not explicitW then
          local contentW = math.max(50, measured.width + padL + padR)
          if parentAssignedW and w then
            -- Shrink-wrap to content but never exceed parent bounds
            w = math.min(contentW, w)
          elseif not w then
            w = contentW
          end
          wSource = "text"
        end
        if not explicitH and h == nil then
          h = measured.height + padT + padB
          hSource = "text"
        end
      end
    end
  elseif isTextInput then
    -- TextInput is a Lua-owned opaque leaf node (no children to auto-size from).
    -- Intrinsic height = font line height + vertical padding.
    if not explicitH then
      local ts = Measure.resolveTextScale(node)
      local fontSize = math.floor((s.fontSize or 14) * ts)
      local font = Measure.getFont(fontSize, s.fontFamily or nil, s.fontWeight or nil)
      h = font:getHeight() + padT + padB
      hSource = "text"
    end
  else
    -- Generic visual capability measurement: capabilities with visual=true
    -- and a measure method get auto-sized here.
    if not CapabilitiesModule then
      local ok, mod = pcall(require, "lua.capabilities")
      if ok then CapabilitiesModule = mod end
    end
    if CapabilitiesModule then
      local capDef = CapabilitiesModule.getDefinition(node.type)
      if capDef and capDef.visual and capDef.measure then
        if not h then
          local measured = capDef.measure(node)
          if measured then
            h = measured.height
            hSource = "text"
          end
        end
      end
    end
  end

  -- Apply min/max width clamping.
  -- If clamping width changes a text node's width, re-measure height.
  local wBefore = w
  w = clampDim(w, minW, maxW)
  if isTextNode and w ~= wBefore and not explicitH then
    local innerConstraint = w - padL - padR
    if innerConstraint < 0 then innerConstraint = 0 end
    local _tRemeasure = profileSectionStart("textRemeasureClampMs")
    local _, mh = measureTextNode(node, innerConstraint)
    profileSectionEnd("textRemeasureClampMs", _tRemeasure)
    profileCount("textRemeasureClampCalls")
    if mh then
      h = mh + padT + padB
    end
  end

  -- Apply min/max height clamping
  if h then
    h = clampDim(h, minH, maxH)
  end

  Log.log("layout", "  resolved id=%s w=%s h=%s explicitW=%s explicitH=%s", tostring(node.id), tostring(w), tostring(h or "auto"), tostring(explicitW), tostring(explicitH))

  -- Margin (all four sides)
  local mar  = ru(s.margin, pw) or 0
  local marL = ru(s.marginLeft, pw)  or mar
  local marR = ru(s.marginRight, pw) or mar
  local marT = ru(s.marginTop, ph)   or mar
  local marB = ru(s.marginBottom, ph) or mar

  local x = px + marL
  local y = py + marT
  local innerW = w - padL - padR
  local innerH = (h or 9999) - padT - padB

  -- Flex properties
  local isRow   = s.flexDirection == "row"
  local gap     = ru(s.gap, isRow and innerW or innerH) or 0
  local justify = normalizeAlign(s.justifyContent or "start")
  local align   = s.alignItems or "stretch"
  local wrap    = s.flexWrap == "wrap"

  local mainSize  = isRow and innerW or innerH

  -- Debug: print sizing info for debugLayout nodes
  if node.props and node.props.debugLayout then
    io.write(string.format("[FLEX-ENTRY] id=%s w=%.1f h=%s innerW=%.1f mainSize=%.1f isRow=%s wrap=%s wSource=%s\n",
      tostring(node.id), w, tostring(h), innerW, mainSize, tostring(isRow), tostring(wrap), tostring(wSource)))
    io.flush()
  end

  -- ====================================================================
  -- Filter visible children and measure them
  -- ====================================================================
  -- Scene3D and Emulator nodes are opaque leaf boxes in the 2D layout.
  -- Their children use non-flex coordinates, so we skip them entirely.
  local isOpaqueLeaf = (node.type == "Scene3D" or node.type == "Emulator")
  local allChildren = isOpaqueLeaf and {} or (node.children or {})
  local visibleIndices = {}  -- list of indices into allChildren for visible kids
  local absoluteIndices = {} -- list of indices for position:absolute children
  local childInfos = {}      -- keyed by index in allChildren

  local _tChildCollect = profileSectionStart("childCollectMs")
  for i, child in ipairs(allChildren) do
    local cs = child.style or {}

    -- display:none children are completely skipped from layout
    if cs.display == "none" then
      child.computed = { x = 0, y = 0, w = 0, h = 0, wSource = "none", hSource = "none" }
    elseif cs.position == "absolute" then
      -- Absolute children are removed from flex flow and positioned separately
      absoluteIndices[#absoluteIndices + 1] = i
    else
      visibleIndices[#visibleIndices + 1] = i

      local cw   = ru(cs.width, innerW)
      local ch   = ru(cs.height, innerH)
      local grow   = cs.flexGrow or 0
      local shrink = cs.flexShrink

      -- Save explicit dimensions before intrinsic estimation may set them
      -- to 0 for empty nodes. aspectRatio needs the originals because Lua
      -- treats 0 as truthy — "ch and not cw" fails when cw is 0 from
      -- estimateIntrinsicMain, even though no width was actually specified.
      local explicitChildW = cw
      local explicitChildH = ch

      -- Resolve child min/max constraints
      local cMinW = ru(cs.minWidth, innerW)
      local cMaxW = ru(cs.maxWidth, innerW)
      local cMinH = ru(cs.minHeight, innerH)
      local cMaxH = ru(cs.maxHeight, innerH)

      -- Resolve child padding for text measurement
      local childIsText = (child.type == "Text" or child.type == "__TEXT__")
      local cpad  = ru(cs.padding, innerW) or 0
      local cpadL = ru(cs.paddingLeft, innerW)  or cpad
      local cpadR = ru(cs.paddingRight, innerW) or cpad
      local cpadT = ru(cs.paddingTop, innerH)   or cpad
      local cpadB = ru(cs.paddingBottom, innerH) or cpad

      -- For text children without explicit dimensions, measure intrinsic size
      if childIsText and (not cw or not ch) then
        local childFitW = isFitContent(cs.width)

        if childFitW then
          -- fit-content: measure unconstrained (natural single-line width)
          local _tMeasure = profileSectionStart("textMeasureInitialMs")
          local mw, mh = measureTextNode(child, nil)
          profileSectionEnd("textMeasureInitialMs", _tMeasure)
          profileCount("textMeasureInitialCalls")
          if mw and mh then
            if not cw then cw = mw + cpadL + cpadR end
            if not ch then ch = mh + cpadT + cpadB end
          end
        else
          local outerConstraint = cw or innerW

          -- When maxWidth is set and no explicit width, clamp the constraint
          if not cw and cMaxW then
            outerConstraint = math.min(outerConstraint, cMaxW)
          end

          local constrainW = outerConstraint - cpadL - cpadR
          if constrainW < 0 then constrainW = 0 end

          local _tMeasure = profileSectionStart("textMeasureInitialMs")
          local mw, mh = measureTextNode(child, constrainW)
          profileSectionEnd("textMeasureInitialMs", _tMeasure)
          profileCount("textMeasureInitialCalls")
          if mw and mh then
            if not cw then cw = mw + cpadL + cpadR end
            if not ch then ch = mh + cpadT + cpadB end
          end
        end
      end

      -- For container children without explicit dimensions, estimate
      -- intrinsic size from their content (recursive bottom-up measurement).
      -- This is what lets <Box> inside <Row> auto-size from its children
      -- instead of collapsing to zero — same as a browser <div>.
      -- Exception: explicit scroll containers should NOT auto-size to content
      -- height, as they are meant to constrain their viewport and scroll
      -- overflow.  overflow:auto containers DO auto-size (scroll only kicks
      -- in when an external constraint is smaller than content).
      local childIsScroll = cs.overflow == "scroll"
      if not childIsText and (not cw or not ch) then
        -- Scroll containers skip intrinsic sizing — they need explicit
        -- dimensions or flex-grow to define their viewport.
        local skipIntrinsicW = childIsScroll
        local skipIntrinsicH = childIsScroll
        if not cw and not skipIntrinsicW then
          local estW = isFitContent(cs.width) and nil or innerW
          local _tIntrinsic = profileSectionStart("intrinsicEstimateMs")
          cw = estimateIntrinsicMain(child, true, estW, innerH)
          profileSectionEnd("intrinsicEstimateMs", _tIntrinsic)
          profileCount("intrinsicEstimateCalls")
        end
        if not ch and not skipIntrinsicH then
          -- Use the child's own resolved width (cw) for height estimation so
          -- text wraps at the child's actual width, not the parent's full width.
          -- This prevents the parent from baking in a too-short height based on
          -- text measured at the parent's width when the child is narrower (e.g.
          -- width: '50%'). Falls back to innerW if cw is not yet known.
          local estPwForH = cw or innerW
          local _tIntrinsic = profileSectionStart("intrinsicEstimateMs")
          ch = estimateIntrinsicMain(child, false, estPwForH, innerH)
          profileSectionEnd("intrinsicEstimateMs", _tIntrinsic)
          profileCount("intrinsicEstimateCalls")
        end
      end

      -- aspectRatio: compute missing dimension from the other.
      -- Uses the original explicit dimensions (pre-estimation) because
      -- estimateIntrinsicMain returns 0 for empty boxes, and Lua treats
      -- 0 as truthy — which prevents "ch and not cw" from firing.
      -- Runs before min/max clamping so derived dimensions get clamped too.
      local car = cs.aspectRatio
      if car and car > 0 then
        if explicitChildW and not explicitChildH then
          ch = explicitChildW / car
        elseif explicitChildH and not explicitChildW then
          cw = explicitChildH * car
        elseif not explicitChildW and not explicitChildH then
          -- Neither explicit: derive from estimated values (check > 0
          -- since Lua treats 0 as truthy)
          if (cw or 0) > 0 and (ch or 0) <= 0 then
            ch = cw / car
          elseif (ch or 0) > 0 and (cw or 0) <= 0 then
            cw = ch * car
          end
        end
      end

      -- Apply min/max width clamping to child.
      -- If clamping width changes a text node's width, re-measure height.
      if cw then
        local cwBefore = cw
        cw = clampDim(cw, cMinW, cMaxW)
        if childIsText and cw ~= cwBefore and not ru(cs.height, innerH) then
          local constrainW = cw - cpadL - cpadR
          if constrainW < 0 then constrainW = 0 end
          local _tRemeasure = profileSectionStart("textRemeasureClampMs")
          local _, mh = measureTextNode(child, constrainW)
          profileSectionEnd("textRemeasureClampMs", _tRemeasure)
          profileCount("textRemeasureClampCalls")
          if mh then
            ch = mh + cpadT + cpadB
          end
        end
      end

      -- Apply min/max height clamping to child
      if ch then
        ch = clampDim(ch, cMinH, cMaxH)
      end

      -- Resolve child margins
      local cmar  = ru(cs.margin, isRow and innerW or innerH) or 0
      local cmarL = ru(cs.marginLeft, innerW)  or cmar
      local cmarR = ru(cs.marginRight, innerW) or cmar
      local cmarT = ru(cs.marginTop, innerH)   or cmar
      local cmarB = ru(cs.marginBottom, innerH) or cmar

      -- Main-axis margins
      local mainMarginStart, mainMarginEnd
      if isRow then
        mainMarginStart = cmarL
        mainMarginEnd   = cmarR
      else
        mainMarginStart = cmarT
        mainMarginEnd   = cmarB
      end

      -- Determine basis: flexBasis takes priority over width/height
      local basis
      local fbRaw = cs.flexBasis
      if fbRaw ~= nil and fbRaw ~= "auto" then
        local mainParentSize = isRow and innerW or innerH
        -- Gap-aware percentage flexBasis: a plain percentage in a wrapping row
        -- with gap overestimates each item's width (percentage is relative to
        -- full container width, but gap eats into available space). Auto-correct
        -- so that items with percentage spans always fit their row exactly.
        -- Formula: corrected = p * W - gap * (1-p)  (works for any mix of spans)
        local pctStr = wrap and gap > 0 and type(fbRaw) == "string" and fbRaw:match("^([%d%.]+)%%$")
        if pctStr then
          local p = tonumber(pctStr) / 100
          basis = p * mainParentSize - gap * (1 - p)
        else
          basis = ru(fbRaw, mainParentSize) or 0
        end
      else
        -- "auto" or not set: fall back to width/height
        basis = isRow and (cw or 0) or (ch or 0)
      end

      -- CSS min-width: auto — compute min-content floor when no explicit minWidth
      local minContent = nil
      if isRow and not cMinW then
        local wasDebug = _mcwDebug
        if node.props and node.props.debugLayout then _mcwDebug = true end
        local _tMinContent = profileSectionStart("minContentFloorMs")
        minContent = computeMinContentW(child)
        profileSectionEnd("minContentFloorMs", _tMinContent)
        profileCount("minContentFloorCalls")
        _mcwDebug = wasDebug
      end

      childInfos[i] = {
        w = cw, h = ch, grow = grow, shrink = shrink, basis = basis,
        marL = cmarL, marR = cmarR, marT = cmarT, marB = cmarB,
        mainMarginStart = mainMarginStart, mainMarginEnd = mainMarginEnd,
        isText = childIsText,
        explicitH = ru(cs.height, innerH),
        fitContentH = isFitContent(cs.height),
        padL = cpadL, padR = cpadR, padT = cpadT, padB = cpadB,
        minW = cMinW, maxW = cMaxW, minH = cMinH, maxH = cMaxH,
        minContent = minContent,
      }
    end
  end
  profileSectionEnd("childCollectMs", _tChildCollect)

  local numVisible = #visibleIndices

  -- ====================================================================
  -- Split children into flex lines
  -- ====================================================================
  -- Each line is a list of indices into allChildren (visible only).
  -- When flexWrap is "nowrap" (default), all visible children go on one line.

  local lines = {}

  if not wrap or numVisible == 0 then
    -- Single line (nowrap): all visible children on one line
    local line = {}
    for _, idx in ipairs(visibleIndices) do
      line[#line + 1] = idx
    end
    lines[1] = line
  else
    -- Wrap mode: split children into lines based on available main-axis space
    local currentLine = {}
    local lineMain = 0  -- accumulated main-axis usage on current line

    for _, idx in ipairs(visibleIndices) do
      local ci = childInfos[idx]
      local floor = ci.minContent or ci.minW or 0
      local itemMain = math.max(floor, ci.basis) + ci.mainMarginStart + ci.mainMarginEnd

      -- Debug: print wrap decision for debugLayout nodes only
      if node.props and node.props.debugLayout then
        io.write(string.format("[WRAP] id=%s mainSize=%.1f lineMain=%.1f itemMain=%.1f floor=%.1f basis=%.1f minContent=%s gap=%.1f wouldWrap=%s\n",
          tostring(node.id), mainSize, lineMain, itemMain, floor, ci.basis,
          tostring(ci.minContent), gap,
          tostring(#currentLine > 0 and (lineMain + (#currentLine > 0 and gap or 0) + itemMain) > mainSize)))
        io.flush()
      end

      -- Add gap if this isn't the first item on the line
      local gapBefore = (#currentLine > 0) and gap or 0

      if #currentLine > 0 and (lineMain + gapBefore + itemMain) > mainSize then
        -- This item overflows -- start a new line
        lines[#lines + 1] = currentLine
        currentLine = { idx }
        lineMain = itemMain
      else
        currentLine[#currentLine + 1] = idx
        lineMain = lineMain + gapBefore + itemMain
      end
    end

    -- Don't forget the last line
    if #currentLine > 0 then
      lines[#lines + 1] = currentLine
    end
  end

  -- ====================================================================
  -- Process each flex line: distribute, re-measure, justify, position
  -- ====================================================================
  node.computed = node.computed or {}  -- ensure exists for flexInfo persistence
  local crossCursor = 0  -- tracks position along the cross axis across lines
  local contentMainEnd = 0   -- furthest main-axis extent (for auto-sizing)
  local contentCrossEnd = 0  -- furthest cross-axis extent (for auto-sizing)

  for lineIdx, line in ipairs(lines) do
    local lineCount = #line
    profileCount("flexLinesProcessed")

    -- ----------------------------------------------------------------
    -- Flex-grow / flex-shrink distribution within this line
    -- ----------------------------------------------------------------
    local _tFlexDistribute = profileSectionStart("flexDistributeMs")
    local lineTotalBasis = 0
    local lineTotalFlex = 0
    local lineTotalMarginMain = 0

    -- Snapshot each child's pre-distribution basis for flex pressure viz
    for _, idx in ipairs(line) do
      childInfos[idx]._origBasis = childInfos[idx].basis
    end

    for _, idx in ipairs(line) do
      local ci = childInfos[idx]
      lineTotalMarginMain = lineTotalMarginMain + ci.mainMarginStart + ci.mainMarginEnd
      lineTotalBasis = lineTotalBasis + ci.basis
      if ci.grow > 0 then
        lineTotalFlex = lineTotalFlex + ci.grow
      end
    end
    profileSectionEnd("flexDistributeMs", _tFlexDistribute)

    local lineGaps = math.max(0, lineCount - 1) * gap
    local lineAvail = mainSize - lineTotalBasis - lineGaps - lineTotalMarginMain

    Log.log("layout", "  flex line %d: %d items basis=%s gaps=%s avail=%s totalFlex=%s", lineIdx, lineCount, tostring(lineTotalBasis), tostring(lineGaps), tostring(lineAvail), tostring(lineTotalFlex))

    -- Tagged node diagnostic (debugLayout only)
    if node.props and node.props.debugLayout then
      io.write(string.format("[DIAG] node.tag=%s id=%s mainSize=%.1f totalBasis=%.1f gaps=%.1f margins=%.1f freeSpace=%.1f totalGrow=%.1f lineCount=%d\n",
        tostring(node.tag), tostring(node.id), mainSize, lineTotalBasis, lineGaps, lineTotalMarginMain, lineAvail, lineTotalFlex, lineCount))
      for _, idx in ipairs(line) do
        local ci = childInfos[idx]
        local child = allChildren[idx]
        io.write(string.format("[DIAG]   child id=%s basis=%.1f grow=%s shrink=%s w=%s\n",
          tostring(child.id), ci.basis, tostring(ci.grow), tostring(ci.shrink), tostring(ci.w)))
      end
      io.flush()
    end

    if lineAvail > 0 and lineTotalFlex > 0 then
      -- Positive free space: distribute to flex-grow items
      for _, idx in ipairs(line) do
        local ci = childInfos[idx]
        if ci.grow > 0 then
          ci.basis = ci.basis + (ci.grow / lineTotalFlex) * lineAvail
        end
      end
    elseif lineAvail < 0 then
      -- Negative free space: shrink items proportional to flexShrink * basis
      -- Default flexShrink is 1 (CSS spec) unless explicitly set to 0
      local totalShrinkScaled = 0
      for _, idx in ipairs(line) do
        local ci = childInfos[idx]
        local sh = ci.shrink
        if sh == nil then sh = 1 end  -- CSS default
        totalShrinkScaled = totalShrinkScaled + sh * ci.basis
      end
      if totalShrinkScaled > 0 then
        local overflow = -lineAvail
        for _, idx in ipairs(line) do
          local ci = childInfos[idx]
          local sh = ci.shrink
          if sh == nil then sh = 1 end
          local shrinkAmount = (sh * ci.basis / totalShrinkScaled) * overflow
          ci.basis = ci.basis - shrinkAmount
        end
      end
    end

    -- ----------------------------------------------------------------
    -- Persist flex distribution data for devtools pressure visualization
    -- ----------------------------------------------------------------
    if not node.computed.flexInfo then
      node.computed.flexInfo = { lines = {}, isRow = isRow, gap = gap, mainSize = mainSize }
    end
    local flexLine = { totalBasis = lineTotalBasis, totalFlex = lineTotalFlex, freeSpace = lineAvail, items = {} }
    for _, idx in ipairs(line) do
      local ci = childInfos[idx]
      local child = allChildren[idx]
      flexLine.items[#flexLine.items + 1] = {
        id = child.id,
        origBasis = ci._origBasis,
        finalBasis = ci.basis,
        grow = ci.grow,
        shrink = ci.shrink,
        delta = ci.basis - ci._origBasis,
      }
    end
    node.computed.flexInfo.lines[lineIdx] = flexLine

    -- ----------------------------------------------------------------
    -- Re-measure text nodes after flex distribution
    -- ----------------------------------------------------------------
    -- Flex distribution (grow OR shrink) may have changed a text node's
    -- width. If the node has no explicit height, re-measure with the new
    -- width so the wrapped height is correct. Previously only checked
    -- grow > 0, which missed shrunk text nodes that wrap to more lines
    -- and need a taller height for correct lineCrossSize calculation.
    -- Save original intrinsic widths BEFORE remeasure — the _flexW
    -- signaling below needs to compare against pre-remeasure values.
    for _, idx in ipairs(line) do
      childInfos[idx]._origIntrinsicW = childInfos[idx].w
    end
    local _tTextRemeasure = profileSectionStart("textRemeasureFlexMs")
    for _, idx in ipairs(line) do
      local child = allChildren[idx]
      local ci = childInfos[idx]
      if ci.isText and not ci.explicitH then
        profileCount("textRemeasureFlexCandidates")
        local finalW
        if isRow then
          finalW = ci.basis
        else
          finalW = ci.w or innerW
        end

        -- Apply min/max clamping to the final width
        finalW = clampDim(finalW, ci.minW, ci.maxW)

        local prevW = ci.w or 0
        if math.abs(finalW - prevW) > 0.5 then
          local constrainW = finalW - ci.padL - ci.padR
          if constrainW < 0 then constrainW = 0 end
          profileCount("textRemeasureFlexCalls")
          local _, mh = measureTextNode(child, constrainW)
          if mh then
            local newH = mh + ci.padT + ci.padB
            newH = clampDim(newH, ci.minH, ci.maxH)
            ci.h = newH
            ci.w = finalW
            -- In column layout, update the basis to reflect new height
            if not isRow then
              ci.basis = newH
            end
          end
        end
      end
    end
    profileSectionEnd("textRemeasureFlexMs", _tTextRemeasure)

    -- ----------------------------------------------------------------
    -- Re-estimate container heights after flex distribution (row only).
    -- Flex-grow/shrink changes a container's width, which affects how
    -- text wraps inside it. Re-estimate height with the new width so
    -- lineCrossSize (computed next) reflects the correct content height.
    -- ----------------------------------------------------------------
    if isRow then
      local _tContainerRemeasure = profileSectionStart("containerRemeasureFlexMs")
      for _, idx in ipairs(line) do
        local child = allChildren[idx]
        local ci = childInfos[idx]
        if not ci.isText and not ci.explicitH then
          local finalW = ci.basis
          finalW = clampDim(finalW, ci.minW, ci.maxW)
          local prevW = ci.w or 0
          if math.abs(finalW - prevW) > 0.5 then
            local _tIntrinsic = profileSectionStart("intrinsicEstimateMs")
            local newH = estimateIntrinsicMain(child, false, finalW, innerH)
            profileSectionEnd("intrinsicEstimateMs", _tIntrinsic)
            profileCount("intrinsicEstimateCalls")
            profileCount("containerRemeasureFlexCalls")
            newH = clampDim(newH, ci.minH, ci.maxH)
            ci.h = newH
            ci.w = finalW
          end
        end
      end
      profileSectionEnd("containerRemeasureFlexMs", _tContainerRemeasure)
    end

    -- ----------------------------------------------------------------
    -- Compute the cross-axis size for this line
    -- (maximum cross-axis extent of all children on this line)
    -- ----------------------------------------------------------------
    local lineCrossSize = 0
    for _, idx in ipairs(line) do
      local ci = childInfos[idx]
      local childCross
      if isRow then
        childCross = (ci.h or 0) + ci.marT + ci.marB
      else
        childCross = (ci.w or 0) + ci.marL + ci.marR
      end
      if childCross > lineCrossSize then
        lineCrossSize = childCross
      end
    end

    -- For single-line (nowrap), the line cross size is the full cross-axis
    -- available space, so that alignItems stretch/center/end work relative
    -- to the container, not just the tallest child.
    -- Only when the cross-axis has a definite size (not the 9999 fallback).
    if not wrap then
      local fullCross
      if isRow and h then
        -- Row: cross-axis is height; only use if h is definite (not auto)
        fullCross = innerH
      elseif not isRow then
        -- Column: cross-axis is width; always definite (falls back to pw)
        fullCross = innerW
      end
      if fullCross then
        lineCrossSize = fullCross
      end
    end

    -- ----------------------------------------------------------------
    -- JustifyContent: compute main-axis offset and extra gap for this line
    -- ----------------------------------------------------------------
    local lineUsedMain = 0
    for _, idx in ipairs(line) do
      local ci = childInfos[idx]
      lineUsedMain = lineUsedMain + ci.basis + ci.mainMarginStart + ci.mainMarginEnd
    end
    local lineFreeMain = mainSize - lineUsedMain - lineGaps
    local lineMainOff, lineExtraGap = 0, 0

    -- Only apply justifyContent distribution when the main axis has a
    -- definite size. For auto-sized containers (h == nil in column layout,
    -- or explicitW == nil in row layout), centering/spacing is meaningless
    -- because the container will shrink-wrap to its content. Without this
    -- guard, the 9999 auto-height fallback produces enormous offsets that
    -- push content off-screen.
    -- NOTE: check h (resolved height) not explicitH — flex-grow and stretch
    -- assign a definite height that isn't from style.height but is still real.
    local hasDefiniteMainAxis = isRow or (h ~= nil)

    if hasDefiniteMainAxis then
      if justify == "center" then
        lineMainOff = lineFreeMain / 2
      elseif justify == "end" then
        lineMainOff = lineFreeMain
      elseif justify == "space-between" and lineCount > 1 then
        lineExtraGap = lineFreeMain / (lineCount - 1)
      elseif justify == "space-around" and lineCount > 0 then
        lineExtraGap = lineFreeMain / lineCount
        lineMainOff = lineExtraGap / 2
      elseif justify == "space-evenly" and lineCount > 0 then
        lineExtraGap = lineFreeMain / (lineCount + 1)
        lineMainOff = lineExtraGap
      end
    end

    -- ----------------------------------------------------------------
    -- Position children on this line
    -- ----------------------------------------------------------------
    local cursor = lineMainOff

    for _, idx in ipairs(line) do
      local child = allChildren[idx]
      local ci = childInfos[idx]
      local cs = child.style or {}
      local cx, cy, cw_final, ch_final

      -- Determine effective alignment for this child (alignSelf or parent alignItems)
      local childAlign = effectiveAlign(align, cs)

      -- NOTE: Do NOT add mainMarginStart to cursor here. layoutNode adds
      -- margins itself (x = px + marL, y = py + marT). Adding them here
      -- would double-count. Instead, cursor tracks the content edge and
      -- we advance by mainMarginStart + actualSize + mainMarginEnd after layout.

      if isRow then
        cx = x + padL + cursor
        cw_final = ci.basis
        ch_final = ci.h or lineCrossSize

        -- Apply min/max clamping to final dimensions
        cw_final = clampDim(cw_final, ci.minW, ci.maxW)
        ch_final = clampDim(ch_final, ci.minH, ci.maxH)

        -- Cross-axis margins reduce the available space for alignment
        local crossAvail = lineCrossSize - ci.marT - ci.marB

        if childAlign == "center" then
          cy = y + padT + crossCursor + ci.marT + (crossAvail - ch_final) / 2
        elseif childAlign == "end" then
          cy = y + padT + crossCursor + ci.marT + crossAvail - ch_final
        elseif childAlign == "stretch" then
          cy = y + padT + crossCursor + ci.marT
          if ci.explicitH == nil then
            local stretchBefore = ch_final
            ch_final = clampDim(crossAvail, ci.minH, ci.maxH)
            if Layout._debugPrint then
              io.write(string.format("[STRETCH-DBG] id=%s h=%s→%s lineCross=%s crossAvail=%s innerH=%s cardH=%s padT=%s padB=%s gap=%s\n",
                tostring(child.id), tostring(stretchBefore), tostring(ch_final),
                tostring(lineCrossSize), tostring(crossAvail), tostring(innerH),
                tostring(h), tostring(padT), tostring(padB), tostring(gap))); io.flush()
            end
          end
        else  -- "start" or default
          cy = y + padT + crossCursor + ci.marT
        end
      else
        cy = y + padT + cursor
        ch_final = ci.basis
        cw_final = ci.w or lineCrossSize

        -- Apply min/max clamping to final dimensions
        cw_final = clampDim(cw_final, ci.minW, ci.maxW)
        ch_final = clampDim(ch_final, ci.minH, ci.maxH)

        -- Cross-axis margins reduce the available space for alignment
        local crossAvail = lineCrossSize - ci.marL - ci.marR

        if childAlign == "center" then
          cx = x + padL + crossCursor + ci.marL + (crossAvail - cw_final) / 2
        elseif childAlign == "end" then
          cx = x + padL + crossCursor + ci.marL + crossAvail - cw_final
        elseif childAlign == "stretch" then
          cx = x + padL + crossCursor + ci.marL
          cw_final = clampDim(crossAvail, ci.minW, ci.maxW)
        else  -- "start" or default
          cx = x + padL + crossCursor + ci.marL
        end
      end

      -- Signal flex-adjusted main-axis size to child so its layoutNode
      -- uses the flex-distributed size instead of its own explicit dimension.
      -- Row: flex adjusts width; Column: flex adjusts height.
      if isRow then
        local explicitChildW = ru(cs.width, innerW)
        if explicitChildW and cw_final ~= explicitChildW then
          child._flexW = cw_final
          profileCount("flexSignalTotal")
          profileCount("flexSignalExplicitWidth")
        elseif not explicitChildW and cs.aspectRatio and cs.aspectRatio > 0 then
          -- aspectRatio children without explicit width: signal flex-adjusted
          -- width so layoutNode respects flex distribution (e.g. flex-shrink)
          -- instead of self-computing w = h * ar which ignores the constraint.
          local arW = (ci.h or 0) * cs.aspectRatio
          if arW > 0 and math.abs(cw_final - arW) > 0.5 then
            child._flexW = cw_final
            profileCount("flexSignalTotal")
            profileCount("flexSignalAspectRatio")
          end
        elseif not explicitChildW then
          -- Auto-width children: signal flex-distributed width when it differs
          -- from intrinsic width. Covers grow (cw_final > intrinsic), shrink
          -- (cw_final < intrinsic), and any flex redistribution. This ensures:
          --   - Text nodes get parentAssignedW=true, preventing shrink-wrap
          --     at line 742 from overriding the flex allocation
          --   - View containers use the flex allocation as innerW for their
          --     children, instead of auto-sizing from content
          -- Use _origIntrinsicW (pre-remeasure) because the remeasure step
          -- may have updated ci.w to match cw_final, masking the difference.
          local intrinsicW = ci._origIntrinsicW or ci.w or 0
          if math.abs(cw_final - intrinsicW) > 0.5 then
            child._flexW = cw_final
            profileCount("flexSignalTotal")
            profileCount("flexSignalAutoWidth")
            if child.type == "CodeBlock" then
              io.write(string.format("[LAYOUT-DEBUG] CodeBlock _flexW set: cw_final=%.1f intrinsicW=%.1f delta=%.1f id=%s\n",
                cw_final, intrinsicW, cw_final - intrinsicW, tostring(child.id or "?")))
              io.flush()
            end
          end
        end
      else
        local explicitChildH = ru(cs.height, innerH)
        if explicitChildH and ch_final ~= explicitChildH then
          child._stretchH = ch_final
        end
        -- Column cross-axis: signal stretched width so text nodes
        -- keep the parent-assigned width instead of shrinking to content.
        if childAlign == "stretch" and not ru(cs.width, innerW) then
          child._flexW = cw_final
          profileCount("flexSignalTotal")
          profileCount("flexSignalColumnStretch")
        end
      end

      -- Signal parent-determined height to child so its layoutNode uses it
      -- instead of auto-sizing (which would give 0 for scroll containers, etc.)
      -- Covers: row cross-axis stretch, column main-axis flex-grow,
      -- and empty surface nodes whose proportional basis would be lost
      -- if the child self-sized to zero in its own layoutNode.
      if ci.explicitH == nil and not ci.fitContentH then
        if isRow and childAlign == "stretch" then
          child._stretchH = ch_final
        elseif not isRow and ci.grow > 0 then
          child._stretchH = ch_final
          child._flexGrowH = true
        end
      end

      child.computed = { x = cx, y = cy, w = cw_final, h = ch_final }
      -- Pass parent's inner dimensions so child resolves percentages correctly
      child._parentInnerW = innerW
      child._parentInnerH = innerH
      local _tChildLayout = profileSectionStart("childLayoutMs")
      profileCount("childLayoutCalls")
      Layout.layoutNode(child, cx, cy, cw_final, ch_final, depth + 1)
      profileSectionEnd("childLayoutMs", _tChildLayout)

      -- Use actual computed size after layout (handles auto-sized containers
      -- whose basis was 0 because content size wasn't known pre-layout)
      local actualMainSize
      if isRow then
        actualMainSize = child.computed and child.computed.w or ci.basis
      else
        actualMainSize = child.computed and child.computed.h or ci.basis
      end

      -- Advance cursor past the child's margins + content + gap
      cursor = cursor + ci.mainMarginStart + actualMainSize + ci.mainMarginEnd + gap + lineExtraGap

      -- Track content extents for auto-sizing (use actual computed position)
      local cc = child.computed
      if isRow then
        local mainEnd = (cc.x - x) + cc.w + ci.marR
        local crossEnd = crossCursor + cc.h + ci.marT + ci.marB
        if mainEnd > contentMainEnd then contentMainEnd = mainEnd end
        if crossEnd > contentCrossEnd then contentCrossEnd = crossEnd end
      else
        local mainEnd = (cc.y - y) + cc.h + ci.marB
        local crossEnd = crossCursor + cc.w + ci.marL + ci.marR
        if mainEnd > contentMainEnd then contentMainEnd = mainEnd end
        if crossEnd > contentCrossEnd then contentCrossEnd = crossEnd end
      end
    end

    -- Advance cross cursor past this line + inter-line gap
    crossCursor = crossCursor + lineCrossSize
    if lineIdx < #lines then
      crossCursor = crossCursor + gap
    end
  end

  -- ====================================================================
  -- Auto-height: shrink to content
  -- ====================================================================
  -- For explicit scroll containers with no explicit height, do NOT auto-size
  -- to content (that defeats scrolling). Default to 0 so the container must
  -- get its height from an explicit value or flex-grow.
  -- overflow:auto containers auto-size to content normally but get scroll
  -- state when constrained (explicit dimensions or flex-grow limits).
  local isScrollContainer = s.overflow == "scroll" or s.overflow == "auto"
  local isExplicitScroll  = s.overflow == "scroll"

  if h == nil then
    if isExplicitScroll then
      -- Explicit scroll containers without explicit height default to 0.
      -- They need an explicit height or flex-grow to have visible area.
      h = 0
      hSource = "scroll-default"
    elseif isRow then
      -- Row direction: main axis is horizontal, cross axis is vertical.
      -- Auto height = total cross-axis extent (sum of line heights + gaps).
      h = crossCursor + padT + padB
      hSource = "content"
    else
      -- Column direction: main axis is vertical.
      -- Auto height = furthest main-axis child end.
      -- contentMainEnd already includes padT (from cc.y - y), so only add padB.
      h = contentMainEnd + padB
      hSource = "content"
    end
  end

  -- Proportional surface fallback:
  -- Empty surface nodes (Box, Image, Video, Scene3D) that resolved to zero
  -- height get a fallback of parent_height / 4, cascading recursively.
  -- Using ph (the definite, fully-resolved parent height at this point in
  -- layout) means nested unsized surfaces shrink proportionally with their
  -- container rather than all pinning to viewport/4 regardless of depth.
  -- Fallback chain: 800px window → 200px → 50px → 12px …
  if not isScrollContainer and isSurface(node) and h < 1
     and (s.flexGrow or 0) <= 0
     and not explicitH then
    local vH = Layout._viewportH or 600
    h = (ph or vH) / 4
    hSource = "surface-fallback"
  end

  -- Final min/max height clamping for auto-height
  h = clampDim(h, minH, maxH)

  Log.log("layout", "  final id=%s computed x=%d y=%d w=%d h=%d", tostring(node.id), x, y, w, h)
  -- Debug: log layout results for capability types
  if Layout._capabilities and node.type ~= "View" and node.type ~= "__TEXT__" then
    if Layout._debugPrint then
      if not Layout._layoutResultDbg then Layout._layoutResultDbg = {} end
      Layout._layoutResultDbg[node.type] = (Layout._layoutResultDbg[node.type] or 0) + 1
      if Layout._layoutResultDbg[node.type] <= 5 then
        io.write(string.format("[LAYOUT-DBG] RESULT type=%s id=%s → %dx%d@(%d,%d) wSrc=%s hSrc=%s flexGrow=%s\n",
          node.type, tostring(node.id), w, h, x, y,
          tostring(wSource), tostring(hSource),
          tostring(node.style and node.style.flexGrow)))
        io.flush()
      end
    end
  end
  -- Build sizing detail tables for inspector math chain
  local wDetail, hDetail
  local ws = wSource or "unknown"
  local hs = hSource or "unknown"
  if ws == "parent" then
    wDetail = { parentW = pw, padL = padL, padR = padR }
  elseif ws == "flex" then
    -- Look up this node's flex info from parent's flexInfo
    local pfi = node.parent and node.parent.computed and node.parent.computed.flexInfo
    if pfi then
      for _, fl in ipairs(pfi.lines or {}) do
        for _, item in ipairs(fl.items or {}) do
          if item.id == node.id then
            wDetail = {
              parentMainSize = pfi.mainSize,
              origBasis = item.origBasis,
              finalBasis = item.finalBasis,
              grow = item.grow,
              shrink = item.shrink,
              delta = item.delta,
              freeSpace = fl.freeSpace,
              totalGrow = fl.totalFlex,
              siblingCount = #fl.items,
              gap = pfi.gap,
            }
            break
          end
        end
        if wDetail then break end
      end
    end
  elseif ws == "content" then
    local nc = node.children and #node.children or 0
    wDetail = { childCount = nc, innerW = innerW }
  elseif ws == "explicit" then
    wDetail = { styleValue = s.width }
  elseif ws == "surface-fallback" then
    wDetail = { parentW = pw, viewportW = Layout._viewportW or 800 }
  elseif ws == "stretch" then
    local parentW2 = node.parent and node.parent.computed and node.parent.computed.w
    wDetail = { parentW = parentW2, padL = padL, padR = padR }
  end

  if hs == "parent" then
    hDetail = { parentH = ph, padT = padT, padB = padB }
  elseif hs == "flex" then
    local pfi = node.parent and node.parent.computed and node.parent.computed.flexInfo
    if pfi and not pfi.isRow then
      for _, fl in ipairs(pfi.lines or {}) do
        for _, item in ipairs(fl.items or {}) do
          if item.id == node.id then
            hDetail = {
              parentMainSize = pfi.mainSize,
              origBasis = item.origBasis,
              finalBasis = item.finalBasis,
              grow = item.grow,
              shrink = item.shrink,
              delta = item.delta,
              freeSpace = fl.freeSpace,
              totalGrow = fl.totalFlex,
              siblingCount = #fl.items,
              gap = pfi.gap,
            }
            break
          end
        end
        if hDetail then break end
      end
    end
  elseif hs == "content" then
    local nc = node.children and #node.children or 0
    hDetail = { childCount = nc, innerH = innerH }
  elseif hs == "explicit" then
    hDetail = { styleValue = s.height }
  elseif hs == "stretch" then
    local parentH2 = node.parent and node.parent.computed and node.parent.computed.h
    hDetail = { parentH = parentH2, padT = padT, padB = padB }
  elseif hs == "surface-fallback" then
    hDetail = { parentH = ph, viewportH = Layout._viewportH or 600 }
  elseif hs == "text" then
    hDetail = { fontSize = s.fontSize }
  end

  node.computed = { x = x, y = y, w = w, h = h, wSource = ws, hSource = hs, wDetail = wDetail, hDetail = hDetail }

  -- ====================================================================
  -- Absolute positioning: lay out position:absolute children
  -- ====================================================================
  -- These children are removed from flex flow and positioned relative to
  -- the parent's padding box using top/left/right/bottom offsets.
  -- They use intrinsic sizing (content-based) unless explicit dimensions
  -- are provided, or both opposing offsets define the size.
  local _tAbsoluteLayout = profileSectionStart("absoluteLayoutMs")
  for _, idx in ipairs(absoluteIndices) do
    local child = allChildren[idx]
    local cs = child.style or {}

    -- Resolve explicit dimensions
    local cw = ru(cs.width, w)
    local ch = ru(cs.height, h)

    -- Resolve offsets relative to parent dimensions
    local offTop    = ru(cs.top, h)
    local offBottom = ru(cs.bottom, h)
    local offLeft   = ru(cs.left, w)
    local offRight  = ru(cs.right, w)

    -- Resolve margins
    local cmar  = ru(cs.margin, w) or 0
    local cmarL = ru(cs.marginLeft, w)  or cmar
    local cmarR = ru(cs.marginRight, w) or cmar
    local cmarT = ru(cs.marginTop, h)   or cmar
    local cmarB = ru(cs.marginBottom, h) or cmar

    -- Determine width: explicit > left+right derivation > intrinsic
    if not cw then
      if offLeft and offRight then
        cw = w - padL - padR - offLeft - offRight - cmarL - cmarR
        if cw < 0 then cw = 0 end
      else
        local _tIntrinsic = profileSectionStart("intrinsicEstimateMs")
        cw = estimateIntrinsicMain(child, true, w, h)
        profileSectionEnd("intrinsicEstimateMs", _tIntrinsic)
        profileCount("intrinsicEstimateCalls")
      end
    end

    -- Determine height: explicit > top+bottom derivation > intrinsic
    if not ch then
      if offTop and offBottom then
        ch = h - padT - padB - offTop - offBottom - cmarT - cmarB
        if ch < 0 then ch = 0 end
      else
        local _tIntrinsic = profileSectionStart("intrinsicEstimateMs")
        ch = estimateIntrinsicMain(child, false, w, h)
        profileSectionEnd("intrinsicEstimateMs", _tIntrinsic)
        profileCount("intrinsicEstimateCalls")
      end
    end

    -- Resolve min/max constraints
    cw = clampDim(cw, ru(cs.minWidth, w), ru(cs.maxWidth, w))
    ch = clampDim(ch, ru(cs.minHeight, h), ru(cs.maxHeight, h))

    -- Horizontal positioning
    local cx
    if offLeft then
      cx = x + padL + offLeft + cmarL
    elseif offRight then
      cx = x + w - padR - offRight - cmarR - cw
    else
      -- No horizontal offset: use alignSelf for cross-axis centering
      local selfAlign = normalizeAlign(cs.alignSelf or align)
      if selfAlign == "center" then
        cx = x + (w - cw) / 2
      elseif selfAlign == "end" then
        cx = x + w - padR - cmarR - cw
      else
        cx = x + padL + cmarL
      end
    end

    -- Vertical positioning
    local cy
    if offTop then
      cy = y + padT + offTop + cmarT
    elseif offBottom then
      cy = y + h - padB - offBottom - cmarB - ch
    else
      -- No vertical offset: default to top of padding box
      cy = y + padT + cmarT
    end

    Log.log("layout", "  absolute id=%s pos=(%d,%d) size=%dx%d", tostring(child.id), cx, cy, cw, ch)
    child.computed = { x = cx, y = cy, w = cw, h = ch }
    -- Pass parent's inner dimensions so child resolves percentages correctly
    child._parentInnerW = innerW
    child._parentInnerH = innerH
    local _tAbsoluteChild = profileSectionStart("absoluteChildLayoutMs")
    profileCount("absoluteChildLayoutCalls")
    Layout.layoutNode(child, cx, cy, cw, ch, depth + 1)
    profileSectionEnd("absoluteChildLayoutMs", _tAbsoluteChild)
  end
  profileSectionEnd("absoluteLayoutMs", _tAbsoluteLayout)

  -- ====================================================================
  -- Scroll state: track content dimensions for scroll containers
  -- ====================================================================
  if isScrollContainer then
    -- Compute total content dimensions (bounding box of all children)
    local contentW, contentH
    if isRow then
      -- contentMainEnd already includes padL (from cc.x - x), so only add padR.
      contentW = contentMainEnd + padR
      contentH = contentCrossEnd + padT + padB
    else
      contentW = contentCrossEnd + padL + padR
      -- contentMainEnd already includes padT (from cc.y - y), so only add padB.
      contentH = contentMainEnd + padB
    end

    -- Preserve existing scroll position, or initialize from style props
    local prevState = node.scrollState
    local scrollX = prevState and prevState.scrollX or (s.scrollX or 0)
    local scrollY = prevState and prevState.scrollY or (s.scrollY or 0)

    -- If style has explicit scroll values, use those (controlled mode)
    if s.scrollX then scrollX = s.scrollX end
    if s.scrollY then scrollY = s.scrollY end

    -- Clamp scroll positions
    local maxScrollX = math.max(0, contentW - w)
    local maxScrollY = math.max(0, contentH - h)

    local horizontalMode = node.props and node.props.horizontal
    if horizontalMode == true then
      maxScrollY = 0
      scrollY = 0
    elseif horizontalMode == false then
      maxScrollX = 0
      scrollX = 0
    end

    scrollX = math.max(0, math.min(scrollX, maxScrollX))
    scrollY = math.max(0, math.min(scrollY, maxScrollY))

    node.scrollState = {
      scrollX = scrollX,
      scrollY = scrollY,
      contentW = contentW,
      contentH = contentH,
    }
  end
  -- Per-node layout timing (inclusive — includes children)
  if node.computed then
    node.computed.layoutMs = (profileNow() - _lt0) * 1000
  end
end

-- ============================================================================
-- Convenience entry point
-- ============================================================================

--- Lay out the entire tree starting from the root node.
--- x, y default to 0; w, h default to the window dimensions.
---
--- Smart default: the root node fills the viewport when it has no
--- explicit width or height.  This eliminates the requirement to write
--- `width: '100%', height: '100%'` on the outermost container.
function Layout.layout(node, x, y, w, h)
  _layoutCount = 0  -- reset per pass
  x = x or 0
  y = y or 0
  w = w or love.graphics.getWidth()
  h = h or love.graphics.getHeight()
  Log.log("layout", "=== layout pass === viewport=%dx%d root.type=%s", w, h, tostring(node.type))

  local activePass = nil
  if Layout._profilingEnabled then
    Layout._profilePassSeq = Layout._profilePassSeq + 1
    activePass = {
      passId = Layout._profilePassSeq,
      viewportW = w,
      viewportH = h,
      nodeVisits = 0,
      uniqueNodes = 0,
      revisitVisits = 0,
      maxDepth = 0,
      sections = {},
      counters = {},
      _seenNodeIds = {},
      _startT = profileNow(),
    }
    Layout._activeProfile = activePass
  else
    Layout._activeProfile = nil
  end

  -- Store viewport dimensions for the proportional surface fallback.
  -- Used by layoutNode to give empty surfaces a sensible default size
  -- without relying on the estimation chain (which propagates the root's
  -- dimensions to every depth, giving wrong results for nested nodes).
  Layout._viewportW = w
  Layout._viewportH = h

  -- Root auto-fill: if the root has no explicit dimensions, tell
  -- layoutNode to use the viewport size via the same signals that the
  -- flex algorithm uses for parent-determined sizing.
  local s = node.style or {}
  if not s.width  then node._flexW = w; node._rootAutoW = true end
  if not s.height then node._stretchH = h; node._rootAutoH = true end

  -- Font metrics dump — press F9 to trigger
  if Layout._dumpFontMetrics then
    Layout._dumpFontMetrics = false
    local sizes = {9, 10, 14, 16, 20}
    io.write("\n[FONT-METRICS] === Love2D font measurements ===\n")
    for _, sz in ipairs(sizes) do
      local font = Measure.getFont(sz)
      local boldFont = Measure.getFont(sz, nil, "bold")
      io.write(string.format("[FONT-METRICS] fontSize=%d  getHeight=%d  ascent=%d  descent=%d  lineHeight=%d\n",
        sz, font:getHeight(), font:getAscent(), font:getDescent(), font:getLineHeight() * font:getHeight()))
      io.write(string.format("[FONT-METRICS] fontSize=%d (bold)  getHeight=%d\n", sz, boldFont:getHeight()))
    end
    -- Measure actual strings from Layout1Story
    local texts = {
      { "Box", 20, "bold" },
      { '<Box bg="#3b82f6" radius={8} padding={16} />', 10, nil },
      { "The most primitive visual element. A rectangle that contains other rectangles.", 10, nil },
      { "Playground Mode Toggle", 9, nil },
    }
    io.write("[FONT-METRICS] --- Actual text measurements (no wrap constraint) ---\n")
    for _, t in ipairs(texts) do
      local result = Measure.measureText(t[1], t[2], nil, nil, nil, nil, nil, t[3])
      io.write(string.format("[FONT-METRICS] \"%s\" @ %dpx%s → w=%d h=%d\n",
        t[1]:sub(1,40), t[2], t[3] and " bold" or "", result.width, result.height))
    end
    io.write("[FONT-METRICS] ================================================\n\n")
    io.flush()
  end

  Layout.layoutNode(node, x, y, w, h, 0)

  if activePass then
    local finishedPass = profileFinishPass(activePass)
    Layout._profileLastPass = finishedPass

    if not Layout._profileTotals then
      Layout._profileTotals = {
        passCount = 0,
        totalMs = 0,
        nodeVisits = 0,
        uniqueNodes = 0,
        revisitVisits = 0,
        maxDepth = 0,
        sections = {},
        counters = {},
      }
    end

    local totals = Layout._profileTotals
    totals.passCount = totals.passCount + 1
    totals.totalMs = totals.totalMs + finishedPass.passMs
    totals.nodeVisits = totals.nodeVisits + finishedPass.nodeVisits
    totals.uniqueNodes = totals.uniqueNodes + finishedPass.uniqueNodes
    totals.revisitVisits = totals.revisitVisits + finishedPass.revisitVisits
    if finishedPass.maxDepth > totals.maxDepth then
      totals.maxDepth = finishedPass.maxDepth
    end
    profileMergeMap(totals.sections, finishedPass.sections)
    profileMergeMap(totals.counters, finishedPass.counters)

    Layout._activeProfile = nil
  end
end

return Layout
