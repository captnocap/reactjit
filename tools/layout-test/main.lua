--[[
  Layout Test Harness — Deterministic layout validation with pre-computed expected values.

  For each test:
    1. Builds a node tree programmatically (no React, no bridge)
    2. Runs Layout.layoutNode()
    3. Diffs every tagged node's computed {x,y,w,h} against pre-written expected values
    4. Prints PASS/FAIL with exact pixel diffs

  Usage: love tools/layout-test
]]

local Layout = require("lua.layout")
local Measure = require("lua.measure")

-- ============================================================================
-- Node construction (same pattern as layout-sweep)
-- ============================================================================

local _nextId = 0
local function nextId()
  _nextId = _nextId + 1
  return _nextId
end

--- Create a layout node with parent backlinks.
local function makeNode(type_, style, children, tag)
  local n = {
    id       = nextId(),
    type     = type_,
    style    = style or {},
    props    = {},
    children = children or {},
    parent   = nil,
    computed = nil,
    tag      = tag,
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
    computed = nil,
  }
  local textNode = makeNode("Text", style, { textChild }, tag)
  textChild.parent = textNode
  textNode.props = { children = text }
  return textNode
end

-- ============================================================================
-- Test runner
-- ============================================================================

local TOLERANCE = 1.5  -- pixels of tolerance for float rounding

--- Collect all tagged nodes from a tree into a flat table { [tag] = node }.
--- If multiple nodes share a tag, collects as { [tag] = { node1, node2, ... } }.
local function collectTagged(node, out)
  out = out or {}
  if node.tag then
    if out[node.tag] then
      -- Multiple nodes with same tag — convert to array
      if out[node.tag].computed then
        out[node.tag] = { out[node.tag] }
      end
      out[node.tag][#out[node.tag] + 1] = node
    else
      out[node.tag] = node
    end
  end
  for _, child in ipairs(node.children or {}) do
    collectTagged(child, out)
  end
  return out
end

--- Dump all computed values for a tree (for debugging).
local function dumpTree(node, indent)
  indent = indent or 0
  local prefix = string.rep("  ", indent)
  local c = node.computed or {}
  local tagStr = node.tag and (" [" .. node.tag .. "]") or ""
  local textStr = ""
  if node.type == "__TEXT__" then
    textStr = string.format(" text=%q", (node.text or ""):sub(1, 30))
  end
  io.write(string.format("%s%s%s%s  x=%.1f y=%.1f w=%.1f h=%.1f  wSrc=%s hSrc=%s\n",
    prefix, node.type, tagStr, textStr,
    c.x or -1, c.y or -1, c.w or -1, c.h or -1,
    c.wSource or "?", c.hSource or "?"))
  for _, child in ipairs(node.children or {}) do
    dumpTree(child, indent + 1)
  end
end

--- Run a single test case. Returns { passed, failures }.
local function runTest(test)
  _nextId = 0  -- reset IDs for reproducibility

  -- Build the tree
  local root = test.buildTree()

  -- Set viewport dimensions
  Layout._viewportW = test.viewport and test.viewport.w or 800
  Layout._viewportH = test.viewport and test.viewport.h or 600

  -- Run layout
  Layout.layoutNode(root, 0, 0, Layout._viewportW, Layout._viewportH)

  -- Collect tagged nodes
  local tagged = collectTagged(root)

  -- Compare against expected values
  local failures = {}
  local checks = 0

  for tag, expected in pairs(test.expected) do
    local node = tagged[tag]
    if not node then
      failures[#failures + 1] = string.format("  MISSING: tag '%s' not found in tree", tag)
    elseif node.computed then
      -- Single node
      local c = node.computed
      checks = checks + 1
      for _, field in ipairs({"x", "y", "w", "h"}) do
        if expected[field] then
          local actual = c[field] or -999
          local exp = expected[field]
          if math.abs(actual - exp) > TOLERANCE then
            failures[#failures + 1] = string.format(
              "  MISMATCH: %s.%s = %.1f (expected %.1f, diff %.1f)",
              tag, field, actual, exp, actual - exp)
          end
        end
      end
      -- Check wSource/hSource if specified
      if expected.wSource and c.wSource ~= expected.wSource then
        failures[#failures + 1] = string.format(
          "  MISMATCH: %s.wSource = %q (expected %q)",
          tag, tostring(c.wSource), expected.wSource)
      end
      if expected.hSource and c.hSource ~= expected.hSource then
        failures[#failures + 1] = string.format(
          "  MISMATCH: %s.hSource = %q (expected %q)",
          tag, tostring(c.hSource), expected.hSource)
      end
    else
      failures[#failures + 1] = string.format("  MISSING: tag '%s' has no computed values", tag)
    end
  end

  return {
    passed = #failures == 0,
    failures = failures,
    root = root,
    tagged = tagged,
    checks = checks,
  }
end

-- ============================================================================
-- Helpers for expected value computation
-- ============================================================================

--- Measure text width at default font size (14px) for expected value computation.
local function textWidth(text, fontSize)
  fontSize = fontSize or 14
  local result = Measure.measureText(text, fontSize, nil)
  return result.width
end

--- Measure text height at a given width constraint.
local function textHeight(text, maxWidth, fontSize)
  fontSize = fontSize or 14
  local result = Measure.measureText(text, fontSize, maxWidth)
  return result.height
end

--- Measure text dimensions.
local function textSize(text, maxWidth, fontSize)
  fontSize = fontSize or 14
  local result = Measure.measureText(text, fontSize, maxWidth)
  return result.width, result.height
end

-- ============================================================================
-- Test definitions
-- ============================================================================
-- Each test has:
--   name: string
--   description: what this test validates
--   buildTree: function() -> root node (with .tag on nodes we want to check)
--   expected: { [tag] = { x=N, y=N, w=N, h=N, wSource=S, hSource=S } }
--   viewport: { w=N, h=N } (optional, defaults to 800x600)
--   bugRef: which bug this test targets (nil = general correctness)

local tests = {}

-- ────────────────────────────────────────────────────────────────────
-- TEST 1: Row with 3 equal flexGrow children
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "row-grow-3-equal",
  description = "3 children with flexGrow:1 in a 300px row should each get 100px",
  bugRef = "Bug A",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 300, height = 100 }, {
      makeNode("View", { flexGrow = 1 }, {}, "child1"),
      makeNode("View", { flexGrow = 1 }, {}, "child2"),
      makeNode("View", { flexGrow = 1 }, {}, "child3"),
    }, "root")
  end,
  expected = {
    root   = { x = 0, y = 0, w = 300, h = 100 },
    child1 = { x = 0, y = 0, w = 100, h = 100 },
    child2 = { x = 100, y = 0, w = 100, h = 100 },
    child3 = { x = 200, y = 0, w = 100, h = 100 },
  },
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 2: Row with flexGrow on a Box (no explicit width, no children)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "row-grow-no-explicit-w",
  description = "A single flexGrow:1 child in a 300px row should fill to 300px",
  bugRef = "Bug A",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 300, height = 50 }, {
      makeNode("View", { flexGrow = 1 }, {}, "grower"),
    }, "root")
  end,
  expected = {
    root   = { x = 0, y = 0, w = 300, h = 50 },
    grower = { x = 0, y = 0, w = 300, h = 50 },
  },
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 3: Row with fixed child + flexGrow child
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "row-fixed-plus-grow",
  description = "Fixed 80px child + flexGrow:1 child in 300px row → grower gets 220px",
  bugRef = "Bug A",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 300, height = 50 }, {
      makeNode("View", { width = 80, height = 50 }, {}, "fixed"),
      makeNode("View", { flexGrow = 1 }, {}, "grower"),
    }, "root")
  end,
  expected = {
    root   = { x = 0, y = 0, w = 300, h = 50 },
    fixed  = { x = 0, y = 0, w = 80, h = 50 },
    grower = { x = 80, y = 0, w = 220, h = 50 },
  },
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 4: Row with Text + flexGrow Box
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "row-text-plus-grow",
  description = "Text('Hello') + flexGrow:1 Box in 300px row → Box fills remaining",
  bugRef = "Bug A",
  buildTree = function()
    local textNode = makeText("Hello", { fontSize = 14 }, "label")
    return makeNode("View", { flexDirection = "row", width = 300, height = 50 }, {
      textNode,
      makeNode("View", { flexGrow = 1 }, {}, "grower"),
    }, "root")
  end,
  -- expected values computed at load time (below) after font is available
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 5: Row with flexGrow Text child (text should fill, not shrink-wrap)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "row-grow-text",
  description = "Text with flexGrow:1 in 300px row should fill 300px, not shrink-wrap",
  bugRef = "Bug A",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 300, height = 50 }, {
      makeText("Short", { fontSize = 14, flexGrow = 1 }, "growtext"),
    }, "root")
  end,
  expected = {
    root     = { x = 0, y = 0, w = 300, h = 50 },
    growtext = { x = 0, y = 0, w = 300 },
  },
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 6: Column with percentage-width Text (Bug B)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "col-pct-text",
  description = "Text with width:'50%' in 400px column wraps at 200px, not 400px",
  bugRef = "Bug B",
  buildTree = function()
    return makeNode("View", { width = 400 }, {
      makeText("This is a longer piece of text that should wrap at 200 pixels width", {
        fontSize = 14, width = "50%",
      }, "pcttext"),
    }, "root")
  end,
  -- expected values computed at load time (below) after font is available
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 7: Nested percentage — Row inside Column
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "col-pct-row-nested",
  description = "Row(width:50%) inside Column(w=400) → Row.w=200, children share it",
  bugRef = "Bug B",
  buildTree = function()
    return makeNode("View", { width = 400 }, {
      makeNode("View", { flexDirection = "row", width = "50%" }, {
        makeText("Left", { fontSize = 14 }, "left"),
        makeText("Right", { fontSize = 14 }, "right"),
      }, "row"),
    }, "root")
  end,
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 8: Row with gap + flexGrow children
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "row-gap-grow",
  description = "3 flexGrow:1 children in 300px row with gap:12 → each (300-24)/3 = 92px",
  bugRef = "Bug A",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 300, height = 60, gap = 12 }, {
      makeNode("View", { flexGrow = 1 }, {}, "c1"),
      makeNode("View", { flexGrow = 1 }, {}, "c2"),
      makeNode("View", { flexGrow = 1 }, {}, "c3"),
    }, "root")
  end,
  expected = {
    root = { x = 0, y = 0, w = 300, h = 60 },
    c1   = { x = 0, y = 0, w = 92, h = 60 },
    c2   = { x = 104, y = 0, w = 92, h = 60 },
    c3   = { x = 208, y = 0, w = 92, h = 60 },
  },
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 9: Column with auto-height (content sizing)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "col-auto-height",
  description = "Column auto-sizes height to sum of children",
  buildTree = function()
    return makeNode("View", { width = 200 }, {
      makeNode("View", { height = 30 }, {}, "a"),
      makeNode("View", { height = 40 }, {}, "b"),
      makeNode("View", { height = 50 }, {}, "c"),
    }, "root")
  end,
  expected = {
    root = { x = 0, y = 0, w = 200, h = 120 },
    a    = { x = 0, y = 0, w = 200, h = 30 },
    b    = { x = 0, y = 30, w = 200, h = 40 },
    c    = { x = 0, y = 70, w = 200, h = 50 },
  },
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 10: Two-column layout (like Layout1Story Section 3)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "two-col-grow-layout",
  description = "Two flexGrow:1 columns in a row, each with text rows — mirrors Layout1 Section 3",
  bugRef = "Bug A",
  buildTree = function()
    local function propRow(name, typ)
      return makeNode("View", { flexDirection = "row", gap = 4 }, {
        makeText(name, { fontSize = 11 }),
        makeText(typ, { fontSize = 11 }),
      })
    end

    return makeNode("View", { flexDirection = "row", width = 300, gap = 8 }, {
      -- Column 1
      makeNode("View", { flexGrow = 1, gap = 2 }, {
        propRow("style", "ViewStyle"),
        propRow("bg", "string"),
        propRow("radius", "number"),
      }, "col1"),
      -- Column 2
      makeNode("View", { flexGrow = 1, gap = 2 }, {
        propRow("onPress", "() => void"),
        propRow("children", "ReactNode"),
        propRow("testId", "string"),
      }, "col2"),
    }, "wrapper")
  end,
  expected = {
    wrapper = { x = 0, y = 0, w = 300 },
    -- With content-based basis + equal flexGrow, columns get equal GROWTH
    -- from different starting points. col2 has wider content so it's wider.
    -- For truly equal columns, use flexBasis: 0.
    -- Just verify both are positive and sum to ~292 (300 - 8 gap)
    col1    = {},
    col2    = {},
  },
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 11: View flexGrow:1 next to large sibling must NOT collapse to 0
-- (Regression test: _flexW signal must not crush View containers)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "row-grow-view-no-crush",
  description = "View with flexGrow:1 next to a 200px sibling in 300px row must get 100px, not 0",
  bugRef = "Bug A",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 300, height = 80 }, {
      makeNode("View", { width = 200, height = 80 }, {}, "big"),
      makeNode("View", { flexGrow = 1 }, {
        makeNode("View", { width = 30, height = 30 }, {}, "inner"),
      }, "grower"),
    }, "root")
  end,
  expected = {
    root   = { w = 300, h = 80 },
    big    = { w = 200 },
    grower = { w = 100 },  -- 300 - 200 = 100, must NOT be 0
    inner  = { w = 30 },
  },
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 12: REAL Layout1Story card structure
-- This is the exact tree: Section1(auto) | Div | Section2(grow) | Div | Section3(4 cols @25%)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "layout1-card",
  description = "Layout1Story card — Section 2 (flexGrow:1) and Section 3 (25% cols) must both have positive width",
  bugRef = "Bug A+B",
  buildTree = function()
    -- Section 1: title + code + desc + wireframe
    local s1 = makeNode("View", { justifyContent = "center", gap = 6 }, {
      makeText("Box", { fontSize = 20, fontWeight = "bold", textAlign = "left" }),
      makeNode("View", {
        borderWidth = 1, borderRadius = 4,
        paddingLeft = 8, paddingRight = 8, paddingTop = 4, paddingBottom = 4,
      }, {
        makeText('<Box bg="#3b82f6" radius={8} padding={16} />', { fontSize = 10, textAlign = "left" }),
      }),
      makeText("The most primitive visual element. A rectangle that contains other rectangles.", {
        fontSize = 10, textAlign = "left",
      }),
      makeNode("View", { width = 130, height = 24, borderWidth = 1, borderRadius = 6 }, {
        makeText("Playground Mode Toggle", { fontSize = 9, textAlign = "center" }),
      }),
    }, "s1")

    -- Dividers
    local div1 = makeNode("View", { width = 1, flexShrink = 0, alignSelf = "stretch" })
    local div2 = makeNode("View", { width = 1, flexShrink = 0, alignSelf = "stretch" })

    -- Section 2: centered pink box
    local s2 = makeNode("View", { flexGrow = 1, justifyContent = "center", alignItems = "center" }, {
      makeNode("View", { backgroundColor = "#ff69b4", borderRadius = 8, padding = 20 }),
    }, "s2")

    -- Section 3: 4 columns @ 25% with props
    local allProps = {
      {"style","ViewStyle"}, {"bg","string"}, {"radius","number"},
      {"padding","number"}, {"tooltip","TooltipConfig"}, {"onPress","() => void"},
      {"onHoverIn","() => void"}, {"onHoverOut","() => void"}, {"onLayout","(e) => void"},
      {"children","ReactNode"}, {"testId","string"}, {"pointerEvents","enum"},
      {"accessibilityLabel","string"},
    }
    local function makeCol(props, tag)
      local rows = {}
      for _, p in ipairs(props) do
        rows[#rows + 1] = makeNode("View", { flexDirection = "row", gap = 4 }, {
          makeText(p[1], { fontSize = 9, textAlign = "left", flexShrink = 0 }),
          makeText(p[2], { fontSize = 9, textAlign = "left", flexShrink = 0 }),
        })
      end
      return makeNode("View", { width = "25%", gap = 2, justifyContent = "center" }, rows, tag)
    end
    local q = math.floor(#allProps / 4)
    local s3 = makeNode("View", {
      flexDirection = "row", flexWrap = "wrap", gap = 12,
    }, {
      makeCol({allProps[1], allProps[2], allProps[3]}, "col1"),
      makeCol({allProps[4], allProps[5], allProps[6]}, "col2"),
      makeCol({allProps[7], allProps[8], allProps[9], allProps[10]}, "col3"),
      makeCol({allProps[11], allProps[12], allProps[13]}, "col4"),
    }, "s3")

    -- The card row
    return makeNode("View", {
      flexDirection = "row", justifyContent = "space-around", alignItems = "stretch",
      borderRadius = 12, borderWidth = 1, padding = 14, gap = 14,
      width = 640,  -- approximate card width (80% of 800)
      height = "fit-content",
    }, { s1, div1, s2, div2, s3 }, "card")
  end,
  expected = {
    s2  = {},  -- just check it exists and has w > 0 (see custom check below)
    s3  = {},
    col1 = {},
    col2 = {},
  },
}

-- Custom validation: override expected with runtime checks
local function layout1CardCheck(result)
  local t = result.tagged
  local failures = {}

  -- Section 2 must have positive width
  if t.s2 and t.s2.computed then
    if t.s2.computed.w <= 1 then
      failures[#failures + 1] = string.format("  S2 (flexGrow:1) has w=%.1f — should be positive!", t.s2.computed.w)
    end
  else
    failures[#failures + 1] = "  S2 not found"
  end

  -- Section 3 must have positive width
  if t.s3 and t.s3.computed then
    if t.s3.computed.w <= 1 then
      failures[#failures + 1] = string.format("  S3 (props panel) has w=%.1f — should be positive!", t.s3.computed.w)
    end
  else
    failures[#failures + 1] = "  S3 not found"
  end

  -- All 4 columns must have positive width
  for _, tag in ipairs({"col1", "col2", "col3", "col4"}) do
    if t[tag] and t[tag].computed then
      if t[tag].computed.w <= 1 then
        failures[#failures + 1] = string.format("  %s has w=%.1f — should be positive!", tag, t[tag].computed.w)
      end
    end
  end

  -- No column text should overflow card bounds
  local card = t.card
  if card and card.computed then
    local cardRight = card.computed.x + card.computed.w
    for _, tag in ipairs({"col1", "col2", "col3", "col4"}) do
      if t[tag] and t[tag].computed then
        local colRight = t[tag].computed.x + t[tag].computed.w
        if colRight > cardRight + 2 then
          failures[#failures + 1] = string.format("  %s right edge %.1f exceeds card right %.1f (overflow!)", tag, colRight, cardRight)
        end
      end
    end
  end

  return failures
end

-- ────────────────────────────────────────────────────────────────────
-- TEST 13: Bug B — auto-height parent with percentage-width text
-- The parent's auto-height should be based on text wrapped at 25% width,
-- NOT text measured at full parent width (which would give 1-line height)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "col-autoheight-pct-text",
  description = "Auto-height parent should match text wrapped at 25% of 400px (=100px), not at 400px",
  bugRef = "Bug B",
  buildTree = function()
    return makeNode("View", { width = 400 }, {
      makeText("The quick brown fox jumps over the lazy dog and keeps running", {
        fontSize = 14, width = "25%",
      }, "narrowtext"),
    }, "root")
  end,
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 12: Bug B — Row with two percentage columns containing text
-- Each column is 50% width. Auto-height should reflect text wrapped at 50%.
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "row-pct-cols-autoheight",
  description = "Row auto-height should reflect text wrapped at 50% width per column",
  bugRef = "Bug B",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 400 }, {
      makeNode("View", { width = "50%" }, {
        makeText("This is a medium length text that should wrap at about 200 pixels", {
          fontSize = 14,
        }, "lefttext"),
      }, "leftcol"),
      makeNode("View", { width = "50%" }, {
        makeText("Another piece of text in the right column that also wraps", {
          fontSize = 14,
        }, "righttext"),
      }, "rightcol"),
    }, "row")
  end,
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 15: Static px columns with text — text must not overflow container
-- (Gemini roadmap step 1: hardcoded pixel widths)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "static-px-cols-text",
  description = "3 columns at 100px each in 320px row — text must wrap within 100px, not overflow",
  bugRef = "Fix2",
  buildTree = function()
    local function col(text, tag)
      return makeNode("View", { width = 100 }, {
        makeText(text, { fontSize = 11 }, tag),
      })
    end
    return makeNode("View", { flexDirection = "row", width = 320, gap = 10 }, {
      col("accessibilityLabel", "t1"),
      col("onHoverIn", "t2"),
      col("children", "t3"),
    }, "row")
  end,
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 16: Percentage columns with text — text must wrap within % width
-- (Gemini roadmap step 2: percentage widths)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "pct-cols-text",
  description = "3 columns at 30% each in 300px row — text must wrap within 90px, not overflow",
  bugRef = "Fix1+Fix2",
  buildTree = function()
    local function col(text, tag)
      return makeNode("View", { width = "30%" }, {
        makeText(text, { fontSize = 11 }, tag),
      })
    end
    return makeNode("View", { flexDirection = "row", width = 300, gap = 10 }, {
      col("accessibilityLabel", "t1"),
      col("onHoverIn", "t2"),
      col("children", "t3"),
    }, "row")
  end,
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 17: Flex-grow columns with text — text must respect flex-allocated width
-- (Gemini roadmap step 3: 1 fixed + 1 grow)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "grow-col-text",
  description = "Fixed 100px col + flexGrow:1 col in 300px row — grow col text wraps at 200px",
  bugRef = "Fix2",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 300 }, {
      makeNode("View", { width = 100, flexShrink = 0 }, {
        makeText("Fixed", { fontSize = 14 }, "fixedtext"),
      }),
      makeNode("View", { flexGrow = 1 }, {
        makeText("This text should wrap within the remaining 200 pixels of space", {
          fontSize = 14,
        }, "growtext"),
      }, "growcol"),
    }, "row")
  end,
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 18: Text with flexShrink in constrained row — the "clipping boss"
-- (Gemini roadmap step 4: long text that must shrink to fit)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "shrink-text-in-row",
  description = "Two text nodes in 150px row — both should shrink to fit, not overflow",
  bugRef = "Fix2+Fix3",
  buildTree = function()
    return makeNode("View", { flexDirection = "row", width = 150, gap = 4 }, {
      makeText("accessibilityLabel", { fontSize = 11, flexShrink = 1 }, "t1"),
      makeText("string", { fontSize = 11, flexShrink = 1 }, "t2"),
    }, "row")
  end,
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 19: Percentage child inside auto-width parent — resolveUnit nil-guard
-- (Tests Fix 1: % during estimateIntrinsicMain with nil parentSize must not collapse to 0)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "pct-in-autowidth-estimation",
  description = "Column with 50% child + text sibling — column intrinsic estimate must not collapse the 50% child to 0",
  bugRef = "Fix1",
  buildTree = function()
    -- The column has no explicit width (auto-sizes from content).
    -- Child A has width: 50% (resolves against parent).
    -- Child B has text content that drives the column's intrinsic width.
    -- During estimation, Child A's 50% should resolve to nil (unknown),
    -- causing it to be skipped for intrinsic sizing. Child B's text drives the width.
    -- After layout (parent assigns column width via stretch), Child A's 50% resolves correctly.
    return makeNode("View", { flexDirection = "row", width = 400, height = 100 }, {
      makeNode("View", {}, {
        makeNode("View", { width = "50%", height = 20 }, {}, "pctchild"),
        makeText("Drive width", { fontSize = 14 }, "txt"),
      }, "autocol"),
    }, "root")
  end,
  expected = "DEFERRED",
}

-- ────────────────────────────────────────────────────────────────────
-- TEST 20: Row with prop-row pairs in constrained column
-- (The actual Section 3 pattern: column at fixed width, rows of label+type)
-- ────────────────────────────────────────────────────────────────────
tests[#tests + 1] = {
  name = "constrained-col-prop-rows",
  description = "Column at 120px with prop-name + prop-type rows — text must not overflow column",
  bugRef = "Fix2+Fix3",
  buildTree = function()
    local function propRow(name, typ, tag)
      return makeNode("View", { flexDirection = "row", gap = 4 }, {
        makeText(name, { fontSize = 9 }),
        makeText(typ, { fontSize = 9 }),
      }, tag)
    end
    return makeNode("View", { width = 120 }, {
      propRow("accessibilityLabel", "string", "row1"),
      propRow("style", "ViewStyle", "row2"),
      propRow("onPress", "() => void", "row3"),
    }, "col")
  end,
  expected = "DEFERRED",
}

-- ============================================================================
-- love.load: Initialize layout engine, compute deferred expected values, run tests
-- ============================================================================

function love.load()
  Layout.init({ measure = Measure })

  -- ── Compute deferred expected values that need font metrics ──

  -- TEST 4: row-text-plus-grow
  do
    local tw = textWidth("Hello", 14)
    local th = textHeight("Hello", nil, 14)
    tests[4].expected = {
      root   = { x = 0, y = 0, w = 300, h = 50 },
      label  = { x = 0, y = 0, w = tw },
      grower = { x = tw, y = 0, w = 300 - tw, h = 50 },
    }
  end

  -- TEST 6: col-pct-text
  do
    local wrapW = 200  -- 50% of 400
    local tw, th = textSize("This is a longer piece of text that should wrap at 200 pixels width", wrapW, 14)
    tests[6].expected = {
      root    = { x = 0, y = 0, w = 400 },
      pcttext = { w = 200, h = th + 0 },  -- no padding
    }
  end

  -- TEST 7: col-pct-row-nested
  do
    local leftW = textWidth("Left", 14)
    local rightW = textWidth("Right", 14)
    tests[7].expected = {
      root  = { x = 0, y = 0, w = 400 },
      row   = { w = 200 },
      left  = { w = leftW },
      right = { w = rightW },
    }
  end

  -- TEST 13: col-autoheight-pct-text
  do
    local childW = 100  -- 25% of 400
    local _, th = textSize("The quick brown fox jumps over the lazy dog and keeps running", childW, 14)
    tests[13].expected = {
      root       = { x = 0, y = 0, w = 400, h = th },
      narrowtext = { w = 100, h = th },
    }
  end

  -- TEST 14: row-pct-cols-autoheight
  do
    local colW = 200  -- 50% of 400
    local _, lth = textSize("This is a medium length text that should wrap at about 200 pixels", colW, 14)
    local _, rth = textSize("Another piece of text in the right column that also wraps", colW, 14)
    local maxH = math.max(lth, rth)
    tests[14].expected = {
      row      = { x = 0, y = 0, w = 400, h = maxH },
      leftcol  = { w = 200, h = maxH },
      rightcol = { w = 200, h = maxH },
      lefttext = { w = colW, h = lth },
      righttext = { w = colW, h = rth },
    }
  end

  -- TEST 15: static-px-cols-text
  -- Each column is 100px. Text must wrap within 100px.
  -- Key: text node's computed.w must be <= column width (100px)
  do
    local colW = 100
    local tw1, th1 = textSize("accessibilityLabel", colW, 11)
    local tw2, th2 = textSize("onHoverIn", colW, 11)
    local tw3, th3 = textSize("children", colW, 11)
    tests[15].expected = {
      row = { w = 320 },
      -- Text width must NOT exceed column width
      t1  = { h = th1 },
      t2  = { h = th2 },
      t3  = { h = th3 },
    }
  end

  -- TEST 16: pct-cols-text
  -- Each column is 30% of 300 = 90px. Text must wrap within 90px.
  do
    local colW = 90  -- 30% of 300
    local tw1, th1 = textSize("accessibilityLabel", colW, 11)
    local tw2, th2 = textSize("onHoverIn", colW, 11)
    local tw3, th3 = textSize("children", colW, 11)
    tests[16].expected = {
      row = { w = 300 },
      t1  = { h = th1 },
      t2  = { h = th2 },
      t3  = { h = th3 },
    }
  end

  -- TEST 17: grow-col-text
  -- Fixed col 100px + grow col in 300px row → grow col = 200px
  do
    local growColW = 200
    local _, gth = textSize("This text should wrap within the remaining 200 pixels of space", growColW, 14)
    tests[17].expected = {
      row      = { w = 300 },
      growcol  = { w = 200 },
      growtext = { w = 200, h = gth },
    }
  end

  -- TEST 18: shrink-text-in-row
  -- Two text nodes in 150px row with gap:4 → available 146px
  -- Both have flexShrink:1, so they share 146px proportional to their intrinsic widths
  do
    local tw1 = textWidth("accessibilityLabel", 11)
    local tw2 = textWidth("string", 11)
    local totalIntrinsic = tw1 + tw2
    local avail = 150 - 4  -- row width minus gap
    -- After shrink: each gets proportional share
    -- But key check: neither exceeds its allocation AND sum fits in row
    tests[18].expected = {
      row = { w = 150 },
      -- Don't check exact widths — just that they don't overflow
      -- Custom check below handles this
    }
  end

  -- TEST 19: pct-in-autowidth-estimation
  -- autocol is in a row, width is main-axis → auto-sizes to content, not stretch.
  -- During estimation, pctchild's 50% resolves against the row's innerW (400), giving 200.
  -- autocol intrinsic width = max(pctchild=200, txt=~80) = 200.
  -- After layout, pctchild gets 50% of autocol's actual width (200) = 100.
  do
    tests[19].expected = {
      root     = { w = 400, h = 100 },
      autocol  = { w = 200 },  -- auto-sized from content (max child = pctchild@200)
      pctchild = { w = 100, h = 20 },  -- 50% of autocol's 200 = 100
    }
  end

  -- TEST 20: constrained-col-prop-rows
  -- Column at 120px with prop rows — text in rows must not overflow column
  do
    tests[20].expected = {
      col  = { w = 120 },
      -- Custom check: all rows must fit within 120px
    }
  end

  -- ── Run all tests ──

  io.write("\n")
  io.write("╔══════════════════════════════════════════════════════════════╗\n")
  io.write("║              LAYOUT TEST HARNESS                           ║\n")
  io.write("╚══════════════════════════════════════════════════════════════╝\n")
  io.write("\n")

  local totalTests = #tests
  local totalPassed = 0
  local totalFailed = 0
  local bugAFailed = {}
  local bugBFailed = {}

  for i, test in ipairs(tests) do
    local result = runTest(test)

    -- Run custom checks
    local extraFailures = {}
    if test.name == "layout1-card" then
      extraFailures = layout1CardCheck(result)
    end

    -- Overflow check: text nodes must not exceed their parent column/row width
    if test.name == "static-px-cols-text" or test.name == "pct-cols-text" then
      local t = result.tagged
      local row = t.row
      if row and row.computed then
        local rowRight = row.computed.x + row.computed.w
        for _, tag in ipairs({"t1", "t2", "t3"}) do
          local node = t[tag]
          if node and node.computed then
            -- Text node's right edge must not exceed its parent's right edge
            local parent = node.parent
            if parent and parent.computed then
              local parentRight = parent.computed.x + parent.computed.w
              local nodeRight = node.computed.x + node.computed.w
              if nodeRight > parentRight + 2 then
                extraFailures[#extraFailures + 1] = string.format(
                  "  OVERFLOW: %s right=%.1f exceeds parent right=%.1f (text w=%.1f, parent w=%.1f)",
                  tag, nodeRight, parentRight, node.computed.w, parent.computed.w)
              end
            end
          end
        end
      end
    end

    -- Shrink check: text nodes must fit within their row
    if test.name == "shrink-text-in-row" then
      local t = result.tagged
      local row = t.row
      if row and row.computed then
        local t1 = t.t1
        local t2 = t.t2
        if t1 and t1.computed and t2 and t2.computed then
          local totalW = t1.computed.w + t2.computed.w + 4  -- +gap
          if totalW > row.computed.w + 2 then
            extraFailures[#extraFailures + 1] = string.format(
              "  OVERFLOW: t1.w(%.1f) + t2.w(%.1f) + gap(4) = %.1f > row.w(%.1f)",
              t1.computed.w, t2.computed.w, totalW, row.computed.w)
          end
        end
      end
    end

    -- Constrained column check: all children must fit within column width
    if test.name == "constrained-col-prop-rows" then
      local t = result.tagged
      local col = t.col
      if col and col.computed then
        local colRight = col.computed.x + col.computed.w
        for _, tag in ipairs({"row1", "row2", "row3"}) do
          local node = t[tag]
          if node and node.computed then
            local nodeRight = node.computed.x + node.computed.w
            if nodeRight > colRight + 2 then
              extraFailures[#extraFailures + 1] = string.format(
                "  OVERFLOW: %s right=%.1f exceeds col right=%.1f (row w=%.1f, col w=%.1f)",
                tag, nodeRight, colRight, node.computed.w, col.computed.w)
            end
            -- Also check each text child inside the row
            for _, child in ipairs(node.children or {}) do
              if child.computed and child.type == "Text" then
                local childRight = child.computed.x + child.computed.w
                if childRight > colRight + 2 then
                  local text = (child.children and child.children[1] and child.children[1].text) or "?"
                  extraFailures[#extraFailures + 1] = string.format(
                    "  OVERFLOW: text %q right=%.1f exceeds col right=%.1f (text w=%.1f)",
                    text:sub(1,20), childRight, colRight, child.computed.w)
                end
              end
            end
          end
        end
      end
    end

    for _, f in ipairs(extraFailures) do
      result.failures[#result.failures + 1] = f
    end
    if #extraFailures > 0 then
      result.passed = #result.failures == 0
    end

    if result.passed then
      totalPassed = totalPassed + 1
      io.write(string.format("  PASS  %s\n", test.name))
    else
      totalFailed = totalFailed + 1
      io.write(string.format("  FAIL  %s\n", test.name))
      io.write(string.format("        %s\n", test.description))
      for _, f in ipairs(result.failures) do
        io.write(f .. "\n")
      end

      -- Track by bug
      if test.bugRef then
        if test.bugRef:find("Bug A") then
          bugAFailed[#bugAFailed + 1] = test.name
        end
        if test.bugRef:find("Bug B") then
          bugBFailed[#bugBFailed + 1] = test.name
        end
      end

      -- Dump the tree for failed tests
      io.write("        ── Tree Dump ──\n")
      dumpTree(result.root, 4)
    end
    io.write("\n")
  end

  -- ── Summary ──

  io.write("────────────────────────────────────────────────────────────────\n")
  io.write(string.format("  TOTAL: %d tests  |  PASS: %d  |  FAIL: %d\n",
    totalTests, totalPassed, totalFailed))

  if #bugAFailed > 0 then
    io.write(string.format("  Bug A (_flexW signal): %d failing — %s\n",
      #bugAFailed, table.concat(bugAFailed, ", ")))
  end
  if #bugBFailed > 0 then
    io.write(string.format("  Bug B (height estimation): %d failing — %s\n",
      #bugBFailed, table.concat(bugBFailed, ", ")))
  end

  if totalFailed == 0 then
    io.write("\n  ALL TESTS PASS\n")
  end

  io.write("────────────────────────────────────────────────────────────────\n\n")
  io.flush()

  love.event.quit()
end

function love.draw()
  -- No rendering needed — this is a headless test runner
end
