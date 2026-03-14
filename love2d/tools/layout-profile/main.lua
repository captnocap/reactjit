--[[
  Layout Profile Harness

  Builds deterministic stress trees at multiple scales, runs layout repeatedly,
  and reports per-pass averages using Layout's built-in profiling snapshot.

  Usage:
    love tools/layout-profile
]]

local Layout = require("lua.layout")
local Measure = require("lua.measure")

local _nextId = 0
local function nextId()
  _nextId = _nextId + 1
  return _nextId
end

local function makeNode(type_, style, children)
  local node = {
    id = nextId(),
    type = type_,
    style = style or {},
    props = {},
    children = children or {},
    parent = nil,
    computed = nil,
  }
  for _, child in ipairs(node.children) do
    child.parent = node
  end
  return node
end

local function makeText(text, style)
  local textChild = {
    id = nextId(),
    type = "__TEXT__",
    text = text,
    style = {},
    props = {},
    children = {},
    parent = nil,
    computed = nil,
  }
  local textNode = makeNode("Text", style, { textChild })
  textChild.parent = textNode
  textNode.props = { children = text }
  return textNode
end

local function countNodes(node)
  if not node then return 0 end
  local total = 1
  local children = node.children or {}
  for _, child in ipairs(children) do
    total = total + countNodes(child)
  end
  return total
end

local function buildPropRow(idx)
  local left = makeText("property_" .. tostring(idx), {
    fontSize = 10,
    textAlign = "left",
    flexShrink = 1,
  })
  local right = makeText("veryLongTypeNameWithWrapping_" .. tostring(idx), {
    fontSize = 10,
    textAlign = "left",
    flexShrink = 1,
  })

  return makeNode("View", {
    flexDirection = "row",
    gap = 8,
  }, { left, right })
end

local function buildColumn(rowCount)
  local rows = {}
  for i = 1, rowCount do
    rows[#rows + 1] = buildPropRow(i)
  end
  return makeNode("View", {
    flexGrow = 1,
    flexBasis = 0,
    gap = 2,
    justifyContent = "center",
  }, rows)
end

local function buildTree(rowCount)
  _nextId = 0

  local leftRail = makeNode("View", {
    width = 220,
    gap = 8,
    justifyContent = "center",
  }, {
    makeText("Layout Profiler", { fontSize = 20, fontWeight = "bold" }),
    makeText("Measuring pass behavior under increasing node counts", { fontSize = 10 }),
  })

  local divider = makeNode("View", { width = 1, alignSelf = "stretch", flexShrink = 0 })

  local col1 = buildColumn(rowCount)
  local col2 = buildColumn(rowCount)

  local tableWrapper = makeNode("View", {
    flexDirection = "row",
    flexWrap = "wrap",
    gap = 10,
    alignItems = "stretch",
  }, { col1, col2 })

  local card = makeNode("View", {
    width = "100%",
    height = "fit-content",
    flexDirection = "row",
    justifyContent = "space-around",
    alignItems = "stretch",
    padding = 12,
    gap = 12,
  }, {
    leftRail,
    divider,
    tableWrapper,
  })

  local inner = makeNode("View", {
    maxWidth = "90%",
    height = "100%",
    justifyContent = "center",
  }, { card })

  local root = makeNode("View", {
    width = "100%",
    height = "100%",
    justifyContent = "center",
    alignItems = "center",
  }, { inner })

  return root
end

local function avgMap(map, n)
  local out = {}
  for k, v in pairs(map or {}) do
    out[k] = v / n
  end
  return out
end

local function printSectionAverages(avgSections)
  local keys = {
    "childCollectMs",
    "flexDistributeMs",
    "textMeasureInitialMs",
    "textRemeasureClampMs",
    "textRemeasureFlexMs",
    "containerRemeasureFlexMs",
    "intrinsicEstimateMs",
    "childLayoutMs",
    "absoluteLayoutMs",
    "absoluteChildLayoutMs",
    "minContentFloorMs",
  }
  for _, key in ipairs(keys) do
    local v = avgSections[key]
    if v and v > 0 then
      print(string.format("    %-24s %.3f ms", key .. ":", v))
    end
  end
end

local function printCounterAverages(avgCounters)
  local keys = {
    "measureTextInvocations",
    "intrinsicEstimateInvocations",
    "textMeasureInitialCalls",
    "textRemeasureClampCalls",
    "textRemeasureFlexCandidates",
    "textRemeasureFlexCalls",
    "containerRemeasureFlexCalls",
    "parentAssignedWidthNodes",
    "flexSignalTotal",
    "flexSignalExplicitWidth",
    "flexSignalAspectRatio",
    "flexSignalAutoWidth",
    "flexSignalColumnStretch",
    "childLayoutCalls",
    "absoluteChildLayoutCalls",
  }
  for _, key in ipairs(keys) do
    local v = avgCounters[key]
    if v and v > 0 then
      print(string.format("    %-24s %.2f", key .. ":", v))
    end
  end
end

local function runCase(rowCount, passes, viewportW, viewportH)
  local root = buildTree(rowCount)
  local nodeCount = countNodes(root)

  -- Warmup for caches (fonts / measurements / allocations)
  for _ = 1, 5 do
    Layout.layout(root, 0, 0, viewportW, viewportH)
  end

  Layout.resetProfilingData()
  Layout.setProfilingEnabled(true)

  for _ = 1, passes do
    Layout.layout(root, 0, 0, viewportW, viewportH)
  end

  local profile = Layout.getProfilingData()
  local totals = profile.totals or {}
  local lastPass = profile.lastPass or {}
  local passCount = math.max(1, totals.passCount or 0)

  local avgPassMs = (totals.totalMs or 0) / passCount
  local avgNodeVisits = (totals.nodeVisits or 0) / passCount
  local avgUniqueNodes = (totals.uniqueNodes or 0) / passCount
  local avgRevisits = (totals.revisitVisits or 0) / passCount
  local avgSections = avgMap(totals.sections or {}, passCount)
  local avgCounters = avgMap(totals.counters or {}, passCount)

  print("")
  print(string.format("CASE rows=%d nodes=%d passes=%d", rowCount, nodeCount, passCount))
  print(string.format("  avg pass ms:      %.3f", avgPassMs))
  print(string.format("  avg node visits:  %.1f", avgNodeVisits))
  print(string.format("  avg unique nodes: %.1f", avgUniqueNodes))
  print(string.format("  avg revisit hits: %.1f", avgRevisits))
  print(string.format("  max depth seen:   %d", totals.maxDepth or 0))

  if lastPass and lastPass.topRevisitedNodes and #lastPass.topRevisitedNodes > 0 then
    print("  top revisits (last pass):")
    for i = 1, math.min(#lastPass.topRevisitedNodes, 5) do
      local row = lastPass.topRevisitedNodes[i]
      print(string.format("    id=%s visits=%d", tostring(row.id), row.visits))
    end
  end

  print("  avg sections:")
  printSectionAverages(avgSections)
  print("  avg counters:")
  printCounterAverages(avgCounters)

  return {
    rowCount = rowCount,
    nodeCount = nodeCount,
    avgPassMs = avgPassMs,
    avgNodeVisits = avgNodeVisits,
    avgUniqueNodes = avgUniqueNodes,
    avgRevisits = avgRevisits,
  }
end

function love.load()
  Layout.init({ measure = Measure })

  local viewportW, viewportH = 1280, 720
  local passes = 40
  local rowCounts = { 8, 20, 40, 80, 160 }

  print("\n=== Layout Profile Sweep ===")
  print(string.format("viewport=%dx%d passes=%d", viewportW, viewportH, passes))

  local results = {}
  for _, rowCount in ipairs(rowCounts) do
    results[#results + 1] = runCase(rowCount, passes, viewportW, viewportH)
  end

  print("\n=== Scaling Summary ===")
  for i = 1, #results do
    local r = results[i]
    local perNode = r.avgPassMs / math.max(1, r.avgNodeVisits)
    print(string.format("nodes=%4d  avg=%.3fms  ms/visit=%.5f  revisits=%.1f",
      r.nodeCount,
      r.avgPassMs,
      perNode,
      r.avgRevisits
    ))
  end

  print("\nIf avg pass time scales roughly with node visits and revisit hits stay near 0, behavior is linear.")
  print("If revisit hits or ms/visit rises sharply at larger sizes, inspect the dominant phase above.")

  love.event.quit(0)
end

function love.update() end
function love.draw() end
