--[[
  Micro Test — Isolate the grow distribution bug.

  Two cases:
    Case A: wrapper has AUTO width (flex child, no explicit width)
    Case B: wrapper has EXPLICIT width (400px)

  Both have the same internal structure:
    wrapper (row)
      col1 (flexGrow=1, flexBasis=0)
      col2 (flexGrow=1, flexBasis=0)

  We instrument layout.lua to print the 5 diagnostic numbers:
    1. mainSize (wrapper's inner width for flex distribution)
    2. totalBasis (sum of children's basis)
    3. remainingFreeSpace (mainSize - totalBasis - gaps)
    4. totalGrow
    5. each child's computed width after grow
]]

local Layout = require("lua.layout")
local Measure = require("lua.measure")

local _id = 0
local function nextId() _id = _id + 1; return _id end

local function makeNode(type_, style, children, tag)
  local n = {
    id = nextId(), type = type_, style = style or {},
    props = {}, children = children or {}, parent = nil,
    computed = nil, tag = tag,
  }
  for _, c in ipairs(n.children) do c.parent = n end
  return n
end

local function makeText(text, style, tag)
  local tc = { id = nextId(), type = "__TEXT__", text = text, style = {},
               props = {}, children = {}, parent = nil, computed = nil }
  local tn = makeNode("Text", style, { tc }, tag)
  tc.parent = tn
  tn.props = { children = text }
  return tn
end

-- ── Build test trees ──

local function buildMicroTree(wrapperWidth, label)
  _id = 0

  -- Col1 and Col2: the canonical pattern
  local col1 = makeNode("View", { flexGrow = 1, flexBasis = 0, height = 50 }, {}, "col1")
  local col2 = makeNode("View", { flexGrow = 1, flexBasis = 0, height = 50 }, {}, "col2")

  -- Wrapper: row container
  local wrapperStyle = { flexDirection = "row" }
  if wrapperWidth then
    wrapperStyle.width = wrapperWidth
  end
  local wrapper = makeNode("View", wrapperStyle, { col1, col2 }, "wrapper")

  -- Card row: gives wrapper its allocated width via flex
  local leftFixed = makeNode("View", { width = 200, height = 100 }, {}, "left")
  local divider = makeNode("View", { width = 1, flexShrink = 0, height = 100 }, {}, "div")

  local cardStyle = {
    width = 800, height = "fit-content",
    flexDirection = "row", justifyContent = "space-around",
    alignItems = "stretch", gap = 14,
  }
  local card = makeNode("View", cardStyle, { leftFixed, divider, wrapper }, "card")

  -- Root
  local root = makeNode("View", { width = 800, height = 600 }, { card })

  return root, card, wrapper, col1, col2, label
end

-- ── Instrument layout.lua ──

-- Hook into the flex distribution to capture the 5 numbers
local origLayoutNode = Layout.layoutNode
local capturedData = {}

function Layout.layoutNode(node, px, py, pw, ph)
  origLayoutNode(node, px, py, pw, ph)

  -- After layout, capture the flex distribution data if this is a tagged wrapper
  if node.tag == "wrapper" and node.computed and node.computed.flexInfo then
    local fi = node.computed.flexInfo
    local data = {
      nodeW = node.computed.w,
      mainSize = fi.mainSize,
      isRow = fi.isRow,
      gap = fi.gap,
      lines = fi.lines,
    }
    capturedData[#capturedData + 1] = data
  end
end

-- ── Run tests ──

function love.load()
  Layout.init({ measure = Measure })

  local cases = {
    { nil, "Case A: wrapper AUTO width (flex child, no explicit width)" },
    { 400, "Case B: wrapper EXPLICIT width (400px)" },
  }

  for _, case in ipairs(cases) do
    local wrapperWidth, label = case[1], case[2]
    capturedData = {}

    local root, card, wrapper, col1, col2 = buildMicroTree(wrapperWidth, label)
    Layout.layout(root, 0, 0, 800, 600)

    print("")
    print("═══════════════════════════════════════════════════════════════")
    print("  " .. label)
    print("═══════════════════════════════════════════════════════════════")
    print("")

    -- Print computed rects
    print(string.format("  Card:    (%d,%d) %dx%d  wSrc=%s",
      card.computed.x, card.computed.y, card.computed.w, card.computed.h,
      card.computed.wSource or "?"))
    print(string.format("  Wrapper: (%d,%d) %dx%d  wSrc=%s",
      wrapper.computed.x, wrapper.computed.y, wrapper.computed.w, wrapper.computed.h,
      wrapper.computed.wSource or "?"))
    print(string.format("  Col1:    (%d,%d) %dx%d  wSrc=%s",
      col1.computed.x, col1.computed.y, col1.computed.w, col1.computed.h,
      col1.computed.wSource or "?"))
    print(string.format("  Col2:    (%d,%d) %dx%d  wSrc=%s",
      col2.computed.x, col2.computed.y, col2.computed.w, col2.computed.h,
      col2.computed.wSource or "?"))
    print("")

    -- Print the 5 diagnostic numbers from flex distribution
    if #capturedData > 0 then
      local d = capturedData[1]
      print("  ── Flex Distribution (wrapper's own flex pass) ──")
      print(string.format("  1. mainSize (innerW):      %s", tostring(d.mainSize)))
      print(string.format("  2. gap:                    %s", tostring(d.gap)))

      if d.lines and d.lines[1] then
        local line = d.lines[1]
        print(string.format("  3. totalBasis:             %s", tostring(line.totalBasis)))
        print(string.format("  4. totalGrow:              %s", tostring(line.totalFlex)))
        print(string.format("  5. freeSpace:              %s", tostring(line.freeSpace)))

        if line.items then
          for j, item in ipairs(line.items) do
            print(string.format("     child[%d]: origBasis=%.1f → finalBasis=%.1f  grow=%s  delta=%.1f",
              j, item.origBasis, item.finalBasis, tostring(item.grow), item.delta))
          end
        end
      else
        print("  (no flex line data captured)")
      end
    else
      print("  (no flex distribution data captured — wrapper may not have flexInfo)")
    end

    print("")

    -- The key question: what width did the wrapper resolve to?
    print("  ── Key Question ──")
    local expectedColW = (wrapper.computed.w) / 2
    print(string.format("  Wrapper width: %d", wrapper.computed.w))
    print(string.format("  Expected each col: %.1f (wrapper/2)", expectedColW))
    print(string.format("  Actual col1: %d, col2: %d", col1.computed.w, col2.computed.w))
    local ok = col1.computed.w > 10 and col2.computed.w > 10
      and math.abs(col1.computed.w - col2.computed.w) < 5
    print(string.format("  VERDICT: %s", ok and "PASS — equal columns" or "FAIL — columns broken"))
    print("")
  end

  -- ── Case C: Same as A but with text children (to test min-content interference) ──
  capturedData = {}
  _id = 0

  local col1c = makeNode("View", { flexGrow = 1, flexBasis = 0 }, {
    makeNode("View", { flexDirection = "row" }, {
      makeText("style", { fontSize = 9 }),
      makeText("ViewStyle", { fontSize = 9 }),
    }),
    makeNode("View", { flexDirection = "row" }, {
      makeText("accessibilityLabel", { fontSize = 9 }),
      makeText("string", { fontSize = 9 }),
    }),
  }, "col1")

  local col2c = makeNode("View", { flexGrow = 1, flexBasis = 0 }, {
    makeNode("View", { flexDirection = "row" }, {
      makeText("onPress", { fontSize = 9 }),
      makeText("() => void", { fontSize = 9 }),
    }),
    makeNode("View", { flexDirection = "row" }, {
      makeText("children", { fontSize = 9 }),
      makeText("ReactNode", { fontSize = 9 }),
    }),
  }, "col2")

  local wrapperC = makeNode("View", { flexDirection = "row" }, { col1c, col2c }, "wrapper")
  local leftC = makeNode("View", { width = 200, height = 100 }, {})
  local divC = makeNode("View", { width = 1, flexShrink = 0, height = 100 }, {})
  local cardC = makeNode("View", {
    width = 800, height = "fit-content",
    flexDirection = "row", justifyContent = "space-around",
    alignItems = "stretch", gap = 14,
  }, { leftC, divC, wrapperC })
  local rootC = makeNode("View", { width = 800, height = 600 }, { cardC })

  Layout.layout(rootC, 0, 0, 800, 600)

  print("═══════════════════════════════════════════════════════════════")
  print("  Case C: wrapper AUTO width + TEXT children (min-content test)")
  print("═══════════════════════════════════════════════════════════════")
  print("")
  print(string.format("  Card:    (%d,%d) %dx%d  wSrc=%s",
    cardC.computed.x, cardC.computed.y, cardC.computed.w, cardC.computed.h,
    cardC.computed.wSource or "?"))
  print(string.format("  Wrapper: (%d,%d) %dx%d  wSrc=%s",
    wrapperC.computed.x, wrapperC.computed.y, wrapperC.computed.w, wrapperC.computed.h,
    wrapperC.computed.wSource or "?"))
  print(string.format("  Col1:    (%d,%d) %dx%d  wSrc=%s",
    col1c.computed.x, col1c.computed.y, col1c.computed.w, col1c.computed.h,
    col1c.computed.wSource or "?"))
  print(string.format("  Col2:    (%d,%d) %dx%d  wSrc=%s",
    col2c.computed.x, col2c.computed.y, col2c.computed.w, col2c.computed.h,
    col2c.computed.wSource or "?"))
  print("")

  if #capturedData > 0 then
    local d = capturedData[1]
    print("  ── Flex Distribution ──")
    print(string.format("  1. mainSize:    %s", tostring(d.mainSize)))
    print(string.format("  2. gap:         %s", tostring(d.gap)))
    if d.lines and d.lines[1] then
      local line = d.lines[1]
      print(string.format("  3. totalBasis:  %s", tostring(line.totalBasis)))
      print(string.format("  4. totalGrow:   %s", tostring(line.totalFlex)))
      print(string.format("  5. freeSpace:   %s", tostring(line.freeSpace)))
      if line.items then
        for j, item in ipairs(line.items) do
          print(string.format("     child[%d]: origBasis=%.1f → final=%.1f  grow=%s  delta=%.1f",
            j, item.origBasis, item.finalBasis, tostring(item.grow), item.delta))
        end
      end
    end
  end

  print("")
  local okC = col1c.computed.w > 10 and col2c.computed.w > 10
    and math.abs(col1c.computed.w - col2c.computed.w) < 20
  print(string.format("  VERDICT: %s", okC and "PASS — equal columns with text" or "FAIL — columns broken with text"))
  print("")

  love.event.quit(0)
end

function love.draw() end
function love.update() end
