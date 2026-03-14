--[[
  MCW Debug — Verify measureMinContentWidth fix, then run full Layout1 tree.
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

local COL1 = { {"style","ViewStyle"}, {"bg","string"}, {"radius","number"}, {"padding","number"},
               {"tooltip","TooltipConfig"}, {"onPress","() => void"}, {"onHoverIn","() => void"} }
local COL2 = { {"onHoverOut","() => void"}, {"onLayout","(e) => void"}, {"children","ReactNode"},
               {"testId","string"}, {"pointerEvents","enum"}, {"accessibilityLabel","string"} }

local function buildPropRows(props)
  local rows = {}
  for _, p in ipairs(props) do
    rows[#rows + 1] = makeNode("View", { flexDirection = "row", gap = 4 }, {
      makeText(p[1], { fontSize = 9, textAlign = "left", flexShrink = 0 }),
      makeText(p[2], { fontSize = 9, textAlign = "left", flexShrink = 0 }),
    })
  end
  return rows
end

local function buildFullTree()
  _id = 0

  local s1 = makeNode("View", { justifyContent = "center", gap = 6 }, {
    makeText("Box", { fontSize = 20, fontWeight = "bold", textAlign = "left" }),
    makeNode("View", { borderWidth = 1, borderRadius = 4,
      paddingLeft = 8, paddingRight = 8, paddingTop = 4, paddingBottom = 4 }, {
      makeText('<Box bg="#3b82f6" radius={8} padding={16} />', { fontSize = 10, textAlign = "left" }),
    }),
    makeText("The most primitive visual element. A rectangle that contains other rectangles.", { fontSize = 10, textAlign = "left" }),
    makeNode("View", { width = 130, height = 24, borderRadius = 6,
      justifyContent = "center", alignItems = "center" }, {
      makeText("Playground Mode Toggle", { fontSize = 9, textAlign = "center" }),
    }),
  }, "s1")

  local div1 = makeNode("View", { width = 1, flexShrink = 0, alignSelf = "stretch" })
  local div2 = makeNode("View", { width = 1, flexShrink = 0, alignSelf = "stretch" })

  local pinkBox = makeNode("View", { borderRadius = 8, padding = 20,
    justifyContent = "center", alignItems = "center" }, {
    makeNode("View", {}),
  })
  local s2 = makeNode("View", { flexGrow = 1, justifyContent = "center",
    alignItems = "center" }, { pinkBox }, "s2")

  local col1 = makeNode("View", { flexGrow = 1, flexBasis = 0, gap = 2,
    justifyContent = "center" }, buildPropRows(COL1), "s3_col")
  local col2 = makeNode("View", { flexGrow = 1, flexBasis = 0, gap = 2,
    justifyContent = "center" }, buildPropRows(COL2), "s3_col")

  local s3 = makeNode("View", { flexDirection = "row", flexWrap = "wrap", gap = 12 },
    { col1, col2 }, "s3_wrapper")

  local card = makeNode("View", {
    width = "100%", height = "fit-content",
    flexDirection = "row", justifyContent = "space-around",
    alignItems = "stretch", borderRadius = 12, borderWidth = 1,
    padding = 14, gap = 14,
  }, { s1, div1, s2, div2, s3 }, "card")

  local inner = makeNode("View", {
    minWidth = "fit-content", maxWidth = "80%",
    height = "100%", justifyContent = "center",
  }, { card })

  local page = makeNode("View", {
    width = "100%", height = "100%",
    justifyContent = "center", alignItems = "center",
  }, { inner })

  return page, card, s3, col1, col2
end

function love.load()
  Layout.init({ measure = Measure })
  Layout.setMcwDebug(true)

  -- Quick sanity check on MCW values
  print("── MCW sanity check ──")
  local testWords = {"style", "ViewStyle", "accessibilityLabel", "() => void"}
  for _, w in ipairs(testWords) do
    local mcw = Measure.measureMinContentWidth(w, 9)
    print(string.format("  %-25s MCW = %.1f", w, mcw))
  end

  print("\n── Full Layout1 tree ──\n")
  local page, card, s3, col1, col2 = buildFullTree()
  Layout.layout(page, 0, 0, 800, 600)

  Layout.setMcwDebug(false)

  print("\n── RESULTS ──\n")
  print(string.format("  Card:  (%d,%d) %dx%d", card.computed.x, card.computed.y, card.computed.w, card.computed.h))
  print(string.format("  S3:    (%d,%d) %dx%d", s3.computed.x, s3.computed.y, s3.computed.w, s3.computed.h))
  print(string.format("  Col1:  (%d,%d) %dx%d", col1.computed.x, col1.computed.y, col1.computed.w, col1.computed.h))
  print(string.format("  Col2:  (%d,%d) %dx%d", col2.computed.x, col2.computed.y, col2.computed.w, col2.computed.h))

  local sameLine = math.abs(col1.computed.y - col2.computed.y) <= 1
  print(string.format("\n  Same line: %s (col1.y=%d col2.y=%d)", sameLine and "YES" or "NO", col1.computed.y, col2.computed.y))
  print(string.format("  VERDICT: %s", sameLine and col1.computed.w > 10 and col2.computed.w > 10 and "PASS" or "FAIL"))

  love.event.quit(0)
end

function love.draw() end
function love.update() end
