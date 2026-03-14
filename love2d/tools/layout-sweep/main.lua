--[[
  Layout Sweep — Brute-force CSS flex property combination tester.

  Constructs the exact Layout1Story card tree in pure Lua (no React, no bridge),
  enumerates every meaningful combination of flex properties on Section 3,
  runs the layout engine for each combo, and reports which ones fit.

  Usage: love tools/layout-sweep
]]

local Layout = require("lua.layout")
local Measure = require("lua.measure")

-- ============================================================================
-- Node construction
-- ============================================================================

local _nextId = 0
local function nextId()
  _nextId = _nextId + 1
  return _nextId
end

--- Create a layout node. Sets parent backlinks on children.
local function makeNode(type_, style, children, tag)
  local n = {
    id       = nextId(),
    type     = type_,
    style    = style or {},
    props    = {},
    children = children or {},
    parent   = nil,
    computed  = nil,
    tag      = tag,  -- our sweep tag: "s3_wrapper", "s3_col", "s3_row", "s3_text"
  }
  for _, child in ipairs(n.children) do
    child.parent = n
  end
  return n
end

--- Create a Text node with a __TEXT__ child (matches reconciler output).
local function makeText(text, style, tag)
  local textChild = {
    id       = nextId(),
    type     = "__TEXT__",
    text     = text,
    style    = {},
    props    = {},
    children = {},
    parent   = nil,
    computed  = nil,
  }
  local textNode = makeNode("Text", style, { textChild }, tag)
  textChild.parent = textNode
  -- Text node needs props.children for nested text resolution
  textNode.props = { children = text }
  return textNode
end

-- ============================================================================
-- Real content from Layout1Story
-- ============================================================================

local COL1_PROPS = {
  { "style",     "ViewStyle" },
  { "bg",        "string" },
  { "radius",    "number" },
  { "padding",   "number" },
  { "tooltip",   "TooltipConfig" },
  { "onPress",   "() => void" },
  { "onHoverIn", "() => void" },
}

local COL2_PROPS = {
  { "onHoverOut",          "() => void" },
  { "onLayout",            "(e) => void" },
  { "children",            "ReactNode" },
  { "testId",              "string" },
  { "pointerEvents",       "enum" },
  { "accessibilityLabel",  "string" },
}

-- ============================================================================
-- Tree builder — fixed sections + variable Section 3
-- ============================================================================

--- Build the full card tree. Section 3 styles come from the sweep params.
local function buildTree(wrapperStyle, colStyle, rowStyle, textStyle)
  _nextId = 0  -- reset IDs for each combo

  -- ── Section 1: Title + code + desc + wireframe ──
  local s1 = makeNode("View", { justifyContent = "center", gap = 6 }, {
    makeText("Box", { fontSize = 20, fontWeight = "bold", textAlign = "left" }),
    makeNode("View", {
      borderWidth = 1, borderRadius = 4,
      paddingLeft = 8, paddingRight = 8, paddingTop = 4, paddingBottom = 4,
    }, {
      makeText('<Box bg="#3b82f6" radius={8} padding={16} />', { fontSize = 10, textAlign = "left" }),
    }),
    makeText("The most primitive visual element. A rectangle that contains other rectangles.", { fontSize = 10, textAlign = "left" }),
    makeNode("View", { width = 130, height = 24, borderRadius = 6, justifyContent = "center", alignItems = "center" }, {
      makeText("Playground Mode Toggle", { fontSize = 9, textAlign = "center" }),
    }),
  })

  -- ── Dividers ──
  local div1 = makeNode("View", { width = 1, flexShrink = 0, alignSelf = "stretch" })
  local div2 = makeNode("View", { width = 1, flexShrink = 0, alignSelf = "stretch" })

  -- ── Section 2: Center stage, flexGrow ──
  local pinkBox = makeNode("View", { borderRadius = 8, padding = 20, justifyContent = "center", alignItems = "center" }, {
    makeNode("View", {}),  -- empty child (surface fallback)
  })
  local s2 = makeNode("View", { flexGrow = 1, justifyContent = "center", alignItems = "center" }, { pinkBox })

  -- ── Section 3: THE VARIABLE PART ──

  -- Build prop rows for a column
  local function buildRows(propList)
    local rows = {}
    for _, pair in ipairs(propList) do
      local propName, propType = pair[1], pair[2]
      -- Merge row base style with sweep's rowStyle
      local rStyle = { flexDirection = "row" }
      for k, v in pairs(rowStyle) do rStyle[k] = v end

      -- Merge text base style with sweep's textStyle
      local tStyle1 = { fontSize = 9, textAlign = "left" }
      for k, v in pairs(textStyle) do tStyle1[k] = v end
      local tStyle2 = { fontSize = 9, textAlign = "left" }
      for k, v in pairs(textStyle) do tStyle2[k] = v end

      local row = makeNode("View", rStyle, {
        makeText(propName, tStyle1, "s3_text"),
        makeText(propType, tStyle2, "s3_text"),
      }, "s3_row")
      rows[#rows + 1] = row
    end
    return rows
  end

  -- Build columns — both get the same colStyle
  local col1Style = { justifyContent = "center" }
  for k, v in pairs(colStyle) do col1Style[k] = v end
  local col2Style = { justifyContent = "center" }
  for k, v in pairs(colStyle) do col2Style[k] = v end

  local col1 = makeNode("View", col1Style, buildRows(COL1_PROPS), "s3_col")
  local col2 = makeNode("View", col2Style, buildRows(COL2_PROPS), "s3_col")

  -- Build wrapper — merge with sweep's wrapperStyle
  local wStyle = { flexDirection = "row" }
  for k, v in pairs(wrapperStyle) do wStyle[k] = v end
  local s3 = makeNode("View", wStyle, { col1, col2 }, "s3_wrapper")

  -- ── Card (the outermost container we test) ──
  local card = makeNode("View", {
    width = "100%",
    height = "fit-content",
    flexDirection = "row",
    justifyContent = "space-around",
    alignItems = "stretch",
    borderRadius = 12,
    borderWidth = 1,
    padding = 14,
    gap = 14,
  }, { s1, div1, s2, div2, s3 })

  -- ── Inner container (80% max width, centered) ──
  local inner = makeNode("View", {
    minWidth = "fit-content",
    maxWidth = "80%",
    height = "100%",
    justifyContent = "center",
  }, { card })

  -- ── Page (full viewport) ──
  local page = makeNode("View", {
    width = "100%",
    height = "100%",
    justifyContent = "center",
    alignItems = "center",
  }, { inner })

  return page, card, s3, col1, col2
end

-- ============================================================================
-- Fitness check
-- ============================================================================

--- Recursively collect all leaf nodes under a subtree.
local function collectLeaves(node, out)
  out = out or {}
  if not node.children or #node.children == 0 then
    out[#out + 1] = node
    return out
  end
  for _, child in ipairs(node.children) do
    collectLeaves(child, out)
  end
  return out
end

--- Check if Section 3 fits within the card bounds.
--- Wrapping is allowed. The only requirement is NO OVERFLOW.
--- Returns true, reason_string
local function checkFit(card, s3, col1, col2)
  local cc = card.computed
  if not cc or not cc.w or cc.w <= 0 then return false, "card has no width" end

  local sc = s3.computed
  if not sc or not sc.w or sc.w <= 0 then return false, "s3 has no width" end
  if not sc.h or sc.h <= 0 then return false, "s3 has no height" end

  local c1c = col1.computed
  local c2c = col2.computed
  if not c1c or not c1c.w or c1c.w <= 0 then return false, "col1 has no width" end
  if not c2c or not c2c.w or c2c.w <= 0 then return false, "col2 has no width" end

  -- Card bounds
  local cardRight  = cc.x + cc.w
  local cardBottom = cc.y + cc.h

  -- Check all leaves in Section 3 — nothing can overflow the card
  local leaves = collectLeaves(s3)
  for _, leaf in ipairs(leaves) do
    local lc = leaf.computed
    if not lc then return false, "leaf has no computed" end
    if lc.w <= 0 then return false, "leaf w<=0" end
    if lc.h <= 0 then return false, "leaf h<=0" end
    -- Allow 1px tolerance for rounding
    if lc.x + lc.w > cardRight + 1 then
      return false, string.format("overflow-right: leaf %.0f+%.0f=%.0f > card_right=%.0f", lc.x, lc.w, lc.x+lc.w, cardRight)
    end
    if lc.y + lc.h > cardBottom + 1 then
      return false, string.format("overflow-bottom: leaf %.0f+%.0f=%.0f > card_bottom=%.0f", lc.y, lc.h, lc.y+lc.h, cardBottom)
    end
  end

  -- Columns must not overlap horizontally (if on same line)
  local sameLine = math.abs(c1c.y - c2c.y) <= 1
  if sameLine and c2c.x < c1c.x + c1c.w - 1 then
    return false, string.format("columns overlap: col1_right=%.0f > col2_left=%.0f", c1c.x + c1c.w, c2c.x)
  end

  -- Neither column can be zero-width
  if c1c.w < 5 then return false, "col1 too narrow" end
  if c2c.w < 5 then return false, "col2 too narrow" end

  return true, "ok"
end

-- ============================================================================
-- Style description helpers
-- ============================================================================

local function descStyle(label, tbl)
  local parts = { label .. ":" }
  local keys = {}
  for k in pairs(tbl) do keys[#keys + 1] = k end
  table.sort(keys)
  for _, k in ipairs(keys) do
    local v = tbl[k]
    if v == NIL then
      parts[#parts + 1] = k .. "=nil"
    elseif type(v) == "string" then
      parts[#parts + 1] = k .. "='" .. v .. "'"
    else
      parts[#parts + 1] = k .. "=" .. tostring(v)
    end
  end
  return table.concat(parts, " ")
end

-- ============================================================================
-- Enumeration values
-- ============================================================================

-- Sentinel for "property not set" (Lua nil breaks ipairs)
local NIL = "__NIL__"
local function resolve(v) if v == NIL then return nil else return v end end

-- s3_wrapper (must be flexDirection=row)
local W_WRAP     = { "wrap", "nowrap" }
local W_WIDTH    = { NIL, "fit-content" }
local W_JUSTIFY  = { "start", "center", "space-between", "space-around" }
local W_ALIGN    = { "stretch", "start", "center" }
local W_GAP      = { 0, 8, 12 }

-- s3_col (must be column direction)
local C_GROW     = { 0, 1 }
local C_BASIS    = { 0, NIL }
local C_SHRINK   = { 0, 1 }
local C_WIDTH    = { NIL, "fit-content", "50%" }
local C_GAP      = { 0, 2 }
local C_MINW     = { NIL, 0 }

-- s3_row (must be flexDirection=row)
local R_WIDTH    = { NIL, "fit-content" }
local R_GAP      = { 0, 4 }
local R_WRAP     = { "nowrap", "wrap" }

-- s3_text
local T_SHRINK   = { 0, 1 }

-- ============================================================================
-- Main sweep
-- ============================================================================

function love.load()
  Layout.init({ measure = Measure })

  local VW, VH = 800, 600

  local totalCombos = 0
  local winners = {}
  local failReasons = {}  -- tally of fail reasons

  local t0 = love.timer.getTime()

  for _, wWrap in ipairs(W_WRAP) do
  for _, wWidth in ipairs(W_WIDTH) do
  for _, wJustify in ipairs(W_JUSTIFY) do
  for _, wAlign in ipairs(W_ALIGN) do
  for _, wGap in ipairs(W_GAP) do

  for _, cGrow in ipairs(C_GROW) do
  for _, cBasis in ipairs(C_BASIS) do
  for _, cShrink in ipairs(C_SHRINK) do
  for _, cWidth in ipairs(C_WIDTH) do
  for _, cGap in ipairs(C_GAP) do
  for _, cMinW in ipairs(C_MINW) do

  for _, rWidth in ipairs(R_WIDTH) do
  for _, rGap in ipairs(R_GAP) do
  for _, rWrap in ipairs(R_WRAP) do

  for _, tShrink in ipairs(T_SHRINK) do

    totalCombos = totalCombos + 1

    -- Build style tables (resolve NIL sentinels to actual nil)
    local wrapperStyle = {
      flexWrap       = resolve(wWrap),
      width          = resolve(wWidth),
      justifyContent = resolve(wJustify),
      alignItems     = resolve(wAlign),
      gap            = resolve(wGap),
    }
    local colStyle = {
      flexGrow   = resolve(cGrow),
      flexBasis  = resolve(cBasis),
      flexShrink = resolve(cShrink),
      width      = resolve(cWidth),
      gap        = resolve(cGap),
      minWidth   = resolve(cMinW),
    }
    local rowStyle = {
      width    = resolve(rWidth),
      gap      = resolve(rGap),
      flexWrap = resolve(rWrap),
    }
    local textStyle = {
      flexShrink = resolve(tShrink),
    }

    -- Build tree and run layout
    local page, card, s3, col1, col2 = buildTree(wrapperStyle, colStyle, rowStyle, textStyle)
    Layout.layout(page, 0, 0, VW, VH)

    -- Check fitness
    local ok, reason = checkFit(card, s3, col1, col2)
    if ok then
      -- Store raw sentinel values for reporting (resolved nils would vanish from tables)
      winners[#winners + 1] = {
        wrapper = { flexWrap = wWrap, width = wWidth, justifyContent = wJustify, alignItems = wAlign, gap = wGap },
        col     = { flexGrow = cGrow, flexBasis = cBasis, flexShrink = cShrink, width = cWidth, gap = cGap, minWidth = cMinW },
        row     = { width = rWidth, gap = rGap, flexWrap = rWrap },
        text    = { flexShrink = tShrink },
        card    = card.computed,
        s3      = s3.computed,
        col1    = col1.computed,
        col2    = col2.computed,
      }
    else
      failReasons[reason] = (failReasons[reason] or 0) + 1
    end

  end end end end end end end end end end end end end end end

  local elapsed = (love.timer.getTime() - t0) * 1000

  -- ── Report ──
  print("")
  print("═══════════════════════════════════════════════════════════════")
  print("  LAYOUT SWEEP RESULTS")
  print("═══════════════════════════════════════════════════════════════")
  print(string.format("  Combinations tested: %d", totalCombos))
  print(string.format("  Winners:             %d", #winners))
  print(string.format("  Time:                %.1f ms", elapsed))
  print("═══════════════════════════════════════════════════════════════")
  print("")

  if #winners > 0 then
    -- Show all winners (or cap at 50 if too many)
    local showCount = math.min(#winners, 50)
    for i = 1, showCount do
      local w = winners[i]
      print(string.format("--- WINNER #%d ---", i))
      print("  " .. descStyle("s3_wrapper", w.wrapper))
      print("  " .. descStyle("s3_col    ", w.col))
      print("  " .. descStyle("s3_row    ", w.row))
      print("  " .. descStyle("s3_text   ", w.text))
      print(string.format("  Card: (%.0f,%.0f) %.0fx%.0f", w.card.x, w.card.y, w.card.w, w.card.h))
      print(string.format("  S3:   (%.0f,%.0f) %.0fx%.0f", w.s3.x, w.s3.y, w.s3.w, w.s3.h))
      print(string.format("  Col1: (%.0f,%.0f) %.0fx%.0f  |  Col2: (%.0f,%.0f) %.0fx%.0f",
        w.col1.x, w.col1.y, w.col1.w, w.col1.h,
        w.col2.x, w.col2.y, w.col2.w, w.col2.h))
      print("")
    end
    if #winners > showCount then
      print(string.format("  ... and %d more winners (showing first %d)", #winners - showCount, showCount))
      print("")
    end

    -- Pattern analysis: which properties are shared by ALL winners?
    print("─── PATTERN ANALYSIS ───────────────────────────────────────")
    print("Properties shared by ALL winners:")
    -- Check each wrapper prop
    local function analyzeField(fieldName, getter)
      local vals = {}
      for _, w in ipairs(winners) do
        local v = getter(w)
        vals[tostring(v)] = true
      end
      local count = 0
      local only = nil
      for v in pairs(vals) do count = count + 1; only = v end
      if count == 1 then
        print(string.format("  %s = %s (unanimous)", fieldName, only))
      end
    end
    analyzeField("wrapper.flexWrap",       function(w) return w.wrapper.flexWrap end)
    analyzeField("wrapper.width",          function(w) return w.wrapper.width end)
    analyzeField("wrapper.justifyContent", function(w) return w.wrapper.justifyContent end)
    analyzeField("wrapper.alignItems",     function(w) return w.wrapper.alignItems end)
    analyzeField("wrapper.gap",            function(w) return w.wrapper.gap end)
    analyzeField("col.flexGrow",           function(w) return w.col.flexGrow end)
    analyzeField("col.flexBasis",          function(w) return w.col.flexBasis end)
    analyzeField("col.flexShrink",         function(w) return w.col.flexShrink end)
    analyzeField("col.width",              function(w) return w.col.width end)
    analyzeField("col.gap",                function(w) return w.col.gap end)
    analyzeField("col.minWidth",           function(w) return w.col.minWidth end)
    analyzeField("row.width",              function(w) return w.row.width end)
    analyzeField("row.gap",                function(w) return w.row.gap end)
    analyzeField("row.flexWrap",           function(w) return w.row.flexWrap end)
    analyzeField("text.flexShrink",        function(w) return w.text.flexShrink end)
    print("")
  else
    print("  *** NO WINNERS ***")
    print("  No combination of CSS flex properties produced a layout")
    print("  where Section 3 fits within the card bounds at 800x600.")
    print("  This indicates a layout engine bug, not a styling issue.")
    print("")
  end

  -- Fail reason breakdown
  print("─── FAIL REASONS ───────────────────────────────────────────")
  local sortedReasons = {}
  for reason, count in pairs(failReasons) do
    sortedReasons[#sortedReasons + 1] = { reason = reason, count = count }
  end
  table.sort(sortedReasons, function(a, b) return a.count > b.count end)
  for _, r in ipairs(sortedReasons) do
    print(string.format("  %6d  %s", r.count, r.reason))
  end
  print("")
  print("═══════════════════════════════════════════════════════════════")

  love.event.quit(0)
end

function love.draw() end
function love.update() end
