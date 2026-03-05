--[[
  latex_layout.lua -- Math box layout engine

  Walks a LaTeX AST (from latex_parser.lua) and produces a positioned
  box tree ready for rendering. Each box has:
    x, y      -- position relative to parent (y=0 is baseline)
    width     -- horizontal extent
    height    -- ascent above baseline (positive)
    depth     -- descent below baseline (positive)
    glyphs    -- array of { text, x, y, fontSize, italic }
    rules     -- array of { x, y, width, height } (fraction bars, etc.)
    children  -- nested boxes
]]

local Measure = nil

local Layout = {}

-- ============================================================================
-- Constants (heuristic, tuned for Latin Modern Math)
-- ============================================================================

local SCRIPT_SCALE     = 0.70   -- super/subscript size relative to parent
local SCRIPTSCRIPT_SCALE = 0.55 -- double-nested scripts
local FRAC_SCALE       = 0.85   -- numerator/denominator size relative to parent
local FRAC_RULE_HEIGHT = 0.5    -- fraction bar thickness in pixels (scaled)
local FRAC_GAP         = 2      -- gap between fraction bar and num/den

local SUP_SHIFT        = 0.45   -- fraction of base height to shift up
local SUB_SHIFT        = 0.20   -- fraction of base height to shift down
local SUP_DROP         = 0.35   -- superscript baseline relative to base top

local DELIM_EXTRA      = 0.10   -- extra height for delimiters beyond content
local MATRIX_COL_GAP   = 12     -- gap between matrix columns
local MATRIX_ROW_GAP   = 4      -- gap between matrix rows

local THIN_SPACE       = 0.167  -- 3mu / 18mu
local MEDIUM_SPACE     = 0.222  -- 4mu / 18mu
local THICK_SPACE      = 0.278  -- 5mu / 18mu

-- ============================================================================
-- Helpers
-- ============================================================================

local function getMeasure()
  if not Measure then
    Measure = require("lua.measure")
  end
  return Measure
end

local function getFont(fontSize)
  return getMeasure().getFont(fontSize, "fonts/math/latinmodern-math.otf", nil)
end

local function getTextFont(fontSize, bold)
  local weight = bold and "bold" or nil
  return getMeasure().getFont(fontSize, nil, weight)
end

local function measureChar(char, fontSize)
  local font = getFont(fontSize)
  local w = font:getWidth(char)
  local h = font:getHeight()
  local asc = h - font:getDescent()
  local desc = font:getDescent()
  return w, math.abs(asc), math.abs(desc)
end

local function measureText(text, fontSize, bold)
  local font = bold and getTextFont(fontSize, true) or getTextFont(fontSize, false)
  local w = font:getWidth(text)
  local h = font:getHeight()
  local asc = h - font:getDescent()
  local desc = font:getDescent()
  return w, math.abs(asc), math.abs(desc)
end

--- Create an empty box
local function newBox()
  return {
    x = 0, y = 0,
    width = 0, height = 0, depth = 0,
    glyphs = nil, rules = nil, children = nil,
  }
end

--- Merge a child box into a parent at offset (ox, oy)
local function addChild(parent, child, ox, oy)
  if not child then return end
  child.x = ox
  child.y = oy
  if not parent.children then parent.children = {} end
  parent.children[#parent.children + 1] = child
end

--- Add a glyph to a box
local function addGlyph(box, text, x, y, fontSize, italic, useTextFont, bold)
  if not box.glyphs then box.glyphs = {} end
  box.glyphs[#box.glyphs + 1] = {
    text = text, x = x, y = y, fontSize = fontSize,
    italic = italic, useTextFont = useTextFont, bold = bold,
  }
end

--- Add a rule (horizontal/vertical line) to a box
local function addRule(box, x, y, w, h)
  if not box.rules then box.rules = {} end
  box.rules[#box.rules + 1] = { x = x, y = y, width = w, height = h }
end

-- ============================================================================
-- Layout functions (one per AST node type)
-- ============================================================================

--- Layout a single AST node at a given font size.
--- Returns a box with {width, height, depth, glyphs, rules, children}.
function Layout.layoutNode(node, fontSize)
  if not node then return newBox() end

  local t = node.type

  if t == "literal" then
    return Layout.layoutLiteral(node, fontSize)
  elseif t == "group" then
    return Layout.layoutGroup(node, fontSize)
  elseif t == "super" then
    return Layout.layoutSuper(node, fontSize)
  elseif t == "sub" then
    return Layout.layoutSub(node, fontSize)
  elseif t == "supsub" then
    return Layout.layoutSupSub(node, fontSize)
  elseif t == "frac" then
    return Layout.layoutFrac(node, fontSize)
  elseif t == "sqrt" then
    return Layout.layoutSqrt(node, fontSize)
  elseif t == "func" then
    return Layout.layoutFunc(node, fontSize)
  elseif t == "bigop" then
    return Layout.layoutBigOp(node, fontSize)
  elseif t == "accent" then
    return Layout.layoutAccent(node, fontSize)
  elseif t == "delimited" then
    return Layout.layoutDelimited(node, fontSize)
  elseif t == "matrix" then
    return Layout.layoutMatrix(node, fontSize)
  elseif t == "text" then
    return Layout.layoutText(node, fontSize)
  elseif t == "spacing" then
    return Layout.layoutSpacing(node, fontSize)
  elseif t == "newline" then
    return newBox() -- newlines are handled at matrix level
  elseif t == "error" then
    return Layout.layoutLiteral({ type = "literal", text = "?" }, fontSize)
  else
    return newBox()
  end
end

function Layout.layoutLiteral(node, fontSize)
  local text = node.text or ""
  if text == "" then return newBox() end

  local w, asc, desc = measureChar(text, fontSize)
  local box = newBox()
  box.width = w
  box.height = asc
  box.depth = desc
  addGlyph(box, text, 0, 0, fontSize, node.italic)
  return box
end

function Layout.layoutGroup(node, fontSize)
  local children = node.children
  if not children or #children == 0 then return newBox() end

  local box = newBox()
  local x = 0
  local maxAsc, maxDesc = 0, 0

  for _, child in ipairs(children) do
    local childBox = Layout.layoutNode(child, fontSize)
    addChild(box, childBox, x, 0)
    x = x + childBox.width
    if childBox.height > maxAsc then maxAsc = childBox.height end
    if childBox.depth > maxDesc then maxDesc = childBox.depth end
  end

  box.width = x
  box.height = maxAsc
  box.depth = maxDesc
  return box
end

function Layout.layoutSuper(node, fontSize)
  local box = newBox()
  local baseBox = Layout.layoutNode(node.base, fontSize)
  local scriptSize = math.max(6, math.floor(fontSize * SCRIPT_SCALE))
  local scriptBox = Layout.layoutNode(node.script, scriptSize)

  -- Position: base at origin, script raised
  addChild(box, baseBox, 0, 0)
  local supShift = math.max(baseBox.height * SUP_SHIFT, scriptBox.depth + 2)
  addChild(box, scriptBox, baseBox.width + 1, -supShift)

  box.width = baseBox.width + 1 + scriptBox.width
  box.height = math.max(baseBox.height, supShift + scriptBox.height)
  box.depth = baseBox.depth
  return box
end

function Layout.layoutSub(node, fontSize)
  local box = newBox()
  local baseBox = Layout.layoutNode(node.base, fontSize)
  local scriptSize = math.max(6, math.floor(fontSize * SCRIPT_SCALE))
  local scriptBox = Layout.layoutNode(node.script, scriptSize)

  addChild(box, baseBox, 0, 0)
  local subShift = math.max(baseBox.depth + SUB_SHIFT * baseBox.height, 2)
  addChild(box, scriptBox, baseBox.width + 1, subShift)

  box.width = baseBox.width + 1 + scriptBox.width
  box.height = baseBox.height
  box.depth = math.max(baseBox.depth, subShift + scriptBox.depth)
  return box
end

function Layout.layoutSupSub(node, fontSize)
  local box = newBox()
  local baseBox = Layout.layoutNode(node.base, fontSize)
  local scriptSize = math.max(6, math.floor(fontSize * SCRIPT_SCALE))
  local supBox = Layout.layoutNode(node.sup, scriptSize)
  local subBox = Layout.layoutNode(node.sub, scriptSize)

  addChild(box, baseBox, 0, 0)

  local supShift = math.max(baseBox.height * SUP_SHIFT, supBox.depth + 2)
  local subShift = math.max(baseBox.depth + SUB_SHIFT * baseBox.height, 2)

  -- Ensure sup and sub don't overlap
  local gap = (supShift - supBox.depth) - (subShift - subBox.height)
  if gap < 2 then
    local adjust = (2 - gap) / 2
    supShift = supShift + adjust
    subShift = subShift + adjust
  end

  addChild(box, supBox, baseBox.width + 1, -supShift)
  addChild(box, subBox, baseBox.width + 1, subShift)

  local scriptW = math.max(supBox.width, subBox.width)
  box.width = baseBox.width + 1 + scriptW
  box.height = math.max(baseBox.height, supShift + supBox.height)
  box.depth = math.max(baseBox.depth, subShift + subBox.depth)
  return box
end

function Layout.layoutFrac(node, fontSize)
  local box = newBox()
  local fracSize = math.max(6, math.floor(fontSize * FRAC_SCALE))
  local numBox = Layout.layoutNode(node.num, fracSize)
  local denBox = Layout.layoutNode(node.den, fracSize)

  local contentW = math.max(numBox.width, denBox.width)
  local barW = contentW + 4 -- 2px padding each side
  local ruleH = math.max(0.5, fontSize * 0.04)

  -- Numerator: centered above bar
  local numX = (barW - numBox.width) / 2
  local numY = -(numBox.depth + FRAC_GAP + ruleH / 2)
  addChild(box, numBox, numX, numY)

  -- Denominator: centered below bar
  local denX = (barW - denBox.width) / 2
  local denY = denBox.height + FRAC_GAP + ruleH / 2
  addChild(box, denBox, denX, denY)

  -- Fraction bar at baseline
  addRule(box, 0, -ruleH / 2, barW, ruleH)

  box.width = barW
  box.height = numBox.height + numBox.depth + FRAC_GAP + ruleH / 2
  box.depth = denBox.height + denBox.depth + FRAC_GAP + ruleH / 2
  return box
end

function Layout.layoutSqrt(node, fontSize)
  local box = newBox()
  local bodyBox = Layout.layoutNode(node.body, fontSize)

  local totalH = bodyBox.height + bodyBox.depth
  local radicalW = fontSize * 0.55 -- width of radical sign
  local barPad = 2 -- gap between radical and body top
  local overlineY = -(bodyBox.height + barPad)

  -- Radical symbol (√)
  local radicalChar = "\226\136\154" -- √
  local rw, rasc, rdesc = measureChar(radicalChar, fontSize)
  addGlyph(box, radicalChar, 0, 0, fontSize)

  -- Body offset to the right of radical
  local bodyX = radicalW
  addChild(box, bodyBox, bodyX, 0)

  -- Overline bar
  local ruleH = math.max(0.5, fontSize * 0.04)
  addRule(box, bodyX - 1, overlineY, bodyBox.width + 2, ruleH)

  -- Index (nth root)
  if node.index then
    local idxSize = math.max(6, math.floor(fontSize * SCRIPTSCRIPT_SCALE))
    local idxBox = Layout.layoutNode(node.index, idxSize)
    addChild(box, idxBox, 0, -(totalH * 0.6))
  end

  box.width = radicalW + bodyBox.width + 2
  box.height = bodyBox.height + barPad + ruleH
  box.depth = bodyBox.depth
  return box
end

function Layout.layoutFunc(node, fontSize)
  local box = newBox()
  local name = node.name or "f"
  local w, asc, desc = measureText(name, fontSize, false)

  -- Function names are upright (not italic)
  addGlyph(box, name, 0, 0, fontSize, false, true)
  box.width = w + fontSize * THIN_SPACE -- thin space after function name
  box.height = asc
  box.depth = desc
  return box
end

function Layout.layoutBigOp(node, fontSize)
  local box = newBox()
  local symbol = node.symbol or "\226\136\145"

  -- Big operators render at larger size
  local opSize = math.floor(fontSize * 1.4)
  local w, asc, desc = measureChar(symbol, opSize)

  addGlyph(box, symbol, 0, 0, opSize)
  box.width = w + fontSize * THIN_SPACE
  box.height = asc
  box.depth = desc
  return box
end

function Layout.layoutAccent(node, fontSize)
  local box = newBox()
  local bodyBox = Layout.layoutNode(node.body, fontSize)
  addChild(box, bodyBox, 0, 0)

  local kind = node.kind
  box.width = bodyBox.width
  box.depth = bodyBox.depth

  if kind == "overline" then
    local ruleH = math.max(0.5, fontSize * 0.04)
    addRule(box, 0, -(bodyBox.height + 2), bodyBox.width, ruleH)
    box.height = bodyBox.height + 2 + ruleH + 1
  elseif kind == "underline" then
    local ruleH = math.max(0.5, fontSize * 0.04)
    addRule(box, 0, bodyBox.depth + 1, bodyBox.width, ruleH)
    box.depth = bodyBox.depth + 1 + ruleH + 1
    box.height = bodyBox.height
  else
    -- Accent character above body (hat, bar, vec, dot, tilde, etc.)
    local accentChars = {
      hat = "\204\130", bar = "\204\132", vec = "\226\131\151",
      dot = "\204\135", ddot = "\204\136", tilde = "\204\131",
      acute = "\204\129", grave = "\204\128", breve = "\204\134",
      check = "\204\140",
    }
    local accentChar = accentChars[kind]
    if accentChar then
      local accentW = measureChar(accentChar, fontSize)
      local ax = (bodyBox.width - accentW) / 2
      addGlyph(box, accentChar, ax, -(bodyBox.height + 1), fontSize)
      box.height = bodyBox.height + fontSize * 0.3
    else
      box.height = bodyBox.height
    end
  end

  return box
end

function Layout.layoutDelimited(node, fontSize)
  local box = newBox()
  local bodyBox = Layout.layoutNode(node.body, fontSize)

  local totalH = bodyBox.height + bodyBox.depth
  local delimH = totalH * (1 + DELIM_EXTRA)

  -- Scale delimiter font to match content height
  local delimSize = math.max(fontSize, math.floor(fontSize * (delimH / fontSize)))
  delimSize = math.min(delimSize, fontSize * 3) -- cap at 3x

  local leftW, rightW = 0, 0
  local leftDelim = node.left or "."
  local rightDelim = node.right or "."

  local pad = fontSize * 0.1

  if leftDelim ~= "." then
    local w = measureChar(leftDelim, delimSize)
    leftW = w + pad
    addGlyph(box, leftDelim, 0, 0, delimSize)
  end

  addChild(box, bodyBox, leftW, 0)

  if rightDelim ~= "." then
    local w = measureChar(rightDelim, delimSize)
    addGlyph(box, rightDelim, leftW + bodyBox.width + pad, 0, delimSize)
    rightW = w + pad
  end

  box.width = leftW + bodyBox.width + pad + rightW
  box.height = math.max(bodyBox.height, delimH / 2)
  box.depth = math.max(bodyBox.depth, delimH / 2)
  return box
end

function Layout.layoutMatrix(node, fontSize)
  local box = newBox()
  local rows = node.rows
  if not rows or #rows == 0 then return box end

  -- First pass: layout all cells and measure column widths / row heights
  local cellBoxes = {}
  local numCols = 0
  for r, row in ipairs(rows) do
    cellBoxes[r] = {}
    if #row > numCols then numCols = #row end
    for c, cell in ipairs(row) do
      cellBoxes[r][c] = Layout.layoutNode(cell, fontSize)
    end
  end

  local colWidths = {}
  for c = 1, numCols do colWidths[c] = 0 end

  local rowHeights = {}
  local rowDepths = {}
  for r = 1, #rows do
    rowHeights[r] = 0
    rowDepths[r] = 0
    for c = 1, numCols do
      local cb = cellBoxes[r] and cellBoxes[r][c]
      if cb then
        if cb.width > (colWidths[c] or 0) then colWidths[c] = cb.width end
        if cb.height > rowHeights[r] then rowHeights[r] = cb.height end
        if cb.depth > rowDepths[r] then rowDepths[r] = cb.depth end
      end
    end
  end

  -- Second pass: position cells
  local y = 0
  local totalW = 0
  for c = 1, numCols do
    totalW = totalW + colWidths[c]
  end
  totalW = totalW + (numCols - 1) * MATRIX_COL_GAP

  -- Center vertically: first row starts at top, baseline in middle
  local totalH = 0
  for r = 1, #rows do
    totalH = totalH + rowHeights[r] + rowDepths[r]
  end
  totalH = totalH + (#rows - 1) * MATRIX_ROW_GAP
  local startY = -totalH / 2

  y = startY
  for r, row in ipairs(rows) do
    y = y + rowHeights[r] -- move to baseline of this row
    local x = 0
    for c = 1, numCols do
      local cb = cellBoxes[r] and cellBoxes[r][c]
      if cb then
        -- Center cell within column
        local cx = x + (colWidths[c] - cb.width) / 2
        addChild(box, cb, cx, y - rowHeights[r] + cb.height)
      end
      x = x + colWidths[c] + MATRIX_COL_GAP
    end
    y = y + rowDepths[r] + MATRIX_ROW_GAP
  end

  box.width = totalW
  box.height = totalH / 2
  box.depth = totalH / 2
  return box
end

function Layout.layoutText(node, fontSize)
  local box = newBox()
  local text = ""

  -- Extract text from body
  local function extractText(n)
    if not n then return end
    if n.type == "literal" then
      text = text .. (n.text or "")
    elseif n.type == "group" and n.children then
      for _, child in ipairs(n.children) do
        extractText(child)
      end
    end
  end
  extractText(node.body)

  if text == "" then return box end

  local bold = node.bold or false
  local w, asc, desc = measureText(text, fontSize, bold)
  addGlyph(box, text, 0, 0, fontSize, false, true, bold)
  box.width = w
  box.height = asc
  box.depth = desc
  return box
end

function Layout.layoutSpacing(node, fontSize)
  local box = newBox()
  local em = fontSize
  local size = node.size

  if size == "thin" then
    box.width = em * THIN_SPACE
  elseif size == "medium" then
    box.width = em * MEDIUM_SPACE
  elseif size == "thick" then
    box.width = em * THICK_SPACE
  elseif size == "neg" then
    box.width = -em * THIN_SPACE
  elseif size == "quad" then
    box.width = em
  elseif size == "qquad" then
    box.width = em * 2
  end

  return box
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Layout a parsed AST into a positioned box tree.
--- @param ast table  AST from latex_parser.parse()
--- @param fontSize number  base font size in pixels
--- @return table  root box with {width, height, depth, glyphs, rules, children}
function Layout.layout(ast, fontSize)
  return Layout.layoutNode(ast, fontSize)
end

return Layout
