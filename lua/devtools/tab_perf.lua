--[[
  devtools/tab_perf.lua — Perf tab: frame budget, sparkline, node timing, mutations, memory

  Extracted from devtools/main.lua. Displays frame timing, budget bar,
  sparkline history, mutation stats, memory usage, and costliest-node
  rankings.

  Usage:
    local PerfTab = require("lua.devtools.tab_perf")

    -- Per-frame recording:
    PerfTab.recordFrame(ctx, layoutMs, paintMs)

    -- Drawing and input:
    PerfTab.draw(ctx, region)
    PerfTab.mousepressed(ctx, x, y, button)
    PerfTab.wheelmoved(ctx, x, y)

  The `ctx` table must provide:
    ctx.getFont          — function() returning a Love2D font (size 11)
    ctx.tree             — tree module (getNodes, getMutationStats)
    ctx.inspector        — inspector module (getPerfData)
    ctx.drawScrollbar    — function(rx, ry, rw, rh, scrollY, contentH)
]]

local Style = require("lua.devtools.style")

local M = {}

-- ============================================================================
-- Constants
-- ============================================================================

-- Frame history ring buffer (120 entries = ~2s at 60fps)
local PERF_HISTORY_SIZE = 120

-- Display refresh throttle presets
local PERF_RATE_PRESETS = { 0, 0.1, 0.25, 0.5, 1.0, 2.0 }  -- seconds (0 = realtime)
local PERF_RATE_LABELS  = { "RT", "100ms", "250ms", "500ms", "1s", "2s" }

-- ============================================================================
-- Module-local state
-- ============================================================================

local perfHistory    = {}    -- array of { layoutMs, paintMs, totalMs }
local perfHistoryIdx = 0     -- next write index (wraps)
local perfScrollY    = 0

-- Mutation stats accumulator (polled per frame)
local lastMutationStats = { total = 0, creates = 0, updates = 0, removes = 0 }

-- Display refresh throttle state
local perfRateIdx            = 4  -- default 500ms
local perfLastDisplayUpdate  = 0  -- love.timer timestamp of last snapshot
local perfDisplaySnapshot    = nil  -- frozen copy of perf data for display

-- Perf rate selector region (for click detection)
local perfRateRegion = nil  -- { x, y, w, h, segW }

-- Stored for scrollbar interaction
local perfRegion          = nil
local perfContentHStored  = 0

-- ============================================================================
-- Internal helpers
-- ============================================================================

--- Record a frame's timing data into the ring buffer.
function M.recordFrame(ctx, layoutMs, paintMs)
  perfHistoryIdx = (perfHistoryIdx % PERF_HISTORY_SIZE) + 1
  perfHistory[perfHistoryIdx] = {
    layoutMs = layoutMs or 0,
    paintMs = paintMs or 0,
    totalMs = (layoutMs or 0) + (paintMs or 0),
  }
  -- Poll mutation stats
  local tree = ctx.tree
  if tree and tree.getMutationStats then
    lastMutationStats = tree.getMutationStats()
  end
end

--- Build a comprehensive offender entry from a node.
local function buildOffenderInfo(node)
  local info = {
    node = node,
    name = node.debugName or nil,
    luaType = node.type or "?",
    id = node.id,
    renderCount = node.renderCount or 0,
    layoutMs = (node.computed and node.computed.layoutMs) or 0,
    paintMs = (node.computed and node.computed.paintMs) or 0,
    w = node.computed and math.floor(node.computed.w) or 0,
    h = node.computed and math.floor(node.computed.h) or 0,
    props = {},
    source = node.debugSource,
    handlerCount = 0,
  }
  -- Key style props
  local s = node.style or {}
  if s.flexGrow and s.flexGrow > 0 then info.props[#info.props + 1] = "flexGrow=" .. s.flexGrow end
  if s.flexDirection == "row" then info.props[#info.props + 1] = "row" end
  if s.width then info.props[#info.props + 1] = "w=" .. tostring(s.width) end
  if s.height then info.props[#info.props + 1] = "h=" .. tostring(s.height) end
  if s.overflow then info.props[#info.props + 1] = "overflow=" .. s.overflow end
  -- Handlers
  if node.handlerMeta and type(node.handlerMeta) == "table" then
    for _ in pairs(node.handlerMeta) do info.handlerCount = info.handlerCount + 1 end
  end
  -- Total cost
  info.totalMs = info.layoutMs + info.paintMs
  return info
end

--- Get top offenders sorted by actual time cost (layout + paint), with full info.
local function getTopOffenders(tree, maxCount)
  if not tree then return {} end
  local allNodes = tree.getNodes()
  if not allNodes then return {} end

  local list = {}
  for _, node in pairs(allNodes) do
    if node.type ~= "__TEXT__" and node.computed then
      local cost = (node.computed.layoutMs or 0) + (node.computed.paintMs or 0)
      local rc = node.renderCount or 0
      -- Include if it has measurable cost OR re-renders
      if cost > 0.01 or rc > 1 then
        list[#list + 1] = buildOffenderInfo(node)
      end
    end
  end

  -- Sort by total time cost (highest first)
  table.sort(list, function(a, b) return a.totalMs > b.totalMs end)

  local result = {}
  for i = 1, math.min(maxCount, #list) do
    result[i] = list[i]
  end
  return result
end

--- Draw a labeled value pair inline. Returns new x position.
local function drawLV(font, x, y, label, value, labelCol, valueCol)
  love.graphics.setColor(labelCol)
  love.graphics.print(label, x, y)
  x = x + font:getWidth(label)
  love.graphics.setColor(valueCol)
  love.graphics.print(value, x, y)
  return x + font:getWidth(value) + 16
end

-- ============================================================================
-- M.draw(ctx, region)
-- ============================================================================

function M.draw(ctx, region)
  local font = ctx.getFont()
  local inspector = ctx.inspector
  local tree = ctx.tree
  local drawScrollbar = ctx.drawScrollbar

  love.graphics.setFont(font)
  love.graphics.setScissor(region.x, region.y, region.w, region.h)

  love.graphics.setColor(Style.perf.bg)
  love.graphics.rectangle("fill", region.x, region.y, region.w, region.h)

  local fh = font:getHeight()
  local pad = 16
  local x0 = region.x + pad
  local y = region.y + pad - perfScrollY
  local contentW = region.w - pad * 2

  -- == Refresh Rate Selector ==
  local rateBarH = 20
  local rateBarW = #PERF_RATE_PRESETS * 44
  local rateX = region.x + region.w - pad - rateBarW
  local rateY = y

  love.graphics.setColor(Style.perf.label)
  love.graphics.print("Refresh", x0, rateY + math.floor((rateBarH - fh) / 2))

  love.graphics.setColor(Style.perf.budgetBg)
  love.graphics.rectangle("fill", rateX, rateY, rateBarW, rateBarH, 3, 3)

  local segW = rateBarW / #PERF_RATE_PRESETS
  for i, label in ipairs(PERF_RATE_LABELS) do
    local sx = rateX + (i - 1) * segW
    if i == perfRateIdx then
      love.graphics.setColor(Style.perf.sparkLine[1], Style.perf.sparkLine[2], Style.perf.sparkLine[3], 0.25)
      love.graphics.rectangle("fill", sx, rateY, segW, rateBarH, 3, 3)
      love.graphics.setColor(Style.perf.value)
    else
      love.graphics.setColor(Style.perf.label)
    end
    local lw = font:getWidth(label)
    love.graphics.print(label, sx + math.floor((segW - lw) / 2), rateY + math.floor((rateBarH - fh) / 2))
  end

  -- Store in screen coords (rateY already accounts for scroll)
  perfRateRegion = { x = rateX, y = rateY, w = rateBarW, h = rateBarH, segW = segW }
  y = y + rateBarH + 10

  -- == Throttled display snapshot ==
  local now = love.timer.getTime()
  local interval = PERF_RATE_PRESETS[perfRateIdx]
  local livePerf = inspector and inspector.getPerfData()

  if interval == 0 or not perfDisplaySnapshot or (now - perfLastDisplayUpdate) >= interval then
    if livePerf then
      perfDisplaySnapshot = {
        layoutMs = livePerf.layoutMs,
        paintMs = livePerf.paintMs,
        fps = livePerf.fps,
        nodeCount = livePerf.nodeCount,
      }
      perfLastDisplayUpdate = now
    end
  end

  -- == Frame Budget Bar ==
  local perf = perfDisplaySnapshot
  if perf then
    love.graphics.setColor(Style.perf.header)
    love.graphics.print("Frame Budget", x0, y)
    y = y + fh + 6

    local frameMs = perf.layoutMs + perf.paintMs
    local budgetMs = 16.6
    local pct = math.min(frameMs / budgetMs, 1.5)

    local barH = 18
    love.graphics.setColor(Style.perf.budgetBg)
    love.graphics.rectangle("fill", x0, y, contentW, barH, 4, 4)

    local fillW = math.min(pct, 1.0) * contentW
    local barColor = Style.perf.budgetFill
    if pct > 0.8 then barColor = Style.perf.budgetWarn end
    if pct > 1.0 then barColor = Style.perf.budgetCrit end
    love.graphics.setColor(barColor)
    love.graphics.rectangle("fill", x0, y, fillW, barH, 4, 4)

    love.graphics.setColor(Style.perf.value)
    love.graphics.print(string.format("%.1fms / %.1fms  (%.0f%%)", frameMs, budgetMs, pct * 100), x0 + 8, y + math.floor((barH - fh) / 2))
    y = y + barH + 6

    -- Stats row 1: timing + FPS
    local nx = x0
    nx = drawLV(font, nx, y, "Layout ", string.format("%.2fms", perf.layoutMs), Style.perf.label, Style.perf.value)
    nx = drawLV(font, nx, y, "Paint ", string.format("%.2fms", perf.paintMs), Style.perf.label, Style.perf.value)
    local fpsColor = perf.fps >= 55 and Style.perf.budgetFill or (perf.fps >= 30 and Style.perf.budgetWarn or Style.perf.budgetCrit)
    nx = drawLV(font, nx, y, "FPS ", tostring(perf.fps), Style.perf.label, fpsColor)
    drawLV(font, nx, y, "Nodes ", tostring(perf.nodeCount), Style.perf.label, Style.perf.value)
    y = y + fh + 4

    -- Stats row 2: memory + mutations
    local memKB = collectgarbage("count")
    nx = x0
    nx = drawLV(font, nx, y, "Memory ", string.format("%.1f MB", memKB / 1024), Style.perf.label, Style.perf.value)
    nx = drawLV(font, nx, y, "Mutations ", tostring(lastMutationStats.total) .. "/frame", Style.perf.label, Style.perf.value)
    if lastMutationStats.total > 0 then
      local parts = {}
      if lastMutationStats.creates > 0 then parts[#parts + 1] = "+" .. lastMutationStats.creates end
      if lastMutationStats.updates > 0 then parts[#parts + 1] = "~" .. lastMutationStats.updates end
      if lastMutationStats.removes > 0 then parts[#parts + 1] = "-" .. lastMutationStats.removes end
      love.graphics.setColor(Style.perf.dim)
      love.graphics.print("(" .. table.concat(parts, " ") .. ")", nx, y)
    end
    y = y + fh + 16
  end

  -- == Frame Time Sparkline ==
  local histCount = math.min(#perfHistory, PERF_HISTORY_SIZE)
  if histCount > 1 then
    love.graphics.setColor(Style.perf.header)
    love.graphics.print("Frame Time", x0, y)
    y = y + fh + 6

    local sparkH = 60
    local sparkW = contentW

    love.graphics.setColor(Style.perf.budgetBg)
    love.graphics.rectangle("fill", x0, y, sparkW, sparkH, 4, 4)

    local maxMs = 20
    local threshY = y + sparkH - (16.6 / maxMs) * sparkH
    love.graphics.setColor(Style.perf.sparkThresh)
    love.graphics.setLineWidth(1)
    love.graphics.line(x0, threshY, x0 + sparkW, threshY)

    local stepW = sparkW / (PERF_HISTORY_SIZE - 1)
    local points = {}
    local fillPoints = {}

    for i = 1, histCount do
      local idx = ((perfHistoryIdx - histCount + i - 1) % PERF_HISTORY_SIZE) + 1
      local entry = perfHistory[idx]
      local ms = entry and entry.totalMs or 0
      local ptx = x0 + (i - 1) * stepW
      local pty = y + sparkH - math.min(ms / maxMs, 1.0) * sparkH
      points[#points + 1] = ptx
      points[#points + 1] = pty
      fillPoints[#fillPoints + 1] = ptx
      fillPoints[#fillPoints + 1] = pty
    end

    if #fillPoints >= 4 then
      fillPoints[#fillPoints + 1] = fillPoints[#fillPoints - 1]
      fillPoints[#fillPoints + 1] = y + sparkH
      fillPoints[#fillPoints + 1] = fillPoints[1]
      fillPoints[#fillPoints + 1] = y + sparkH
      love.graphics.setColor(Style.perf.sparkFill)
      pcall(love.graphics.polygon, "fill", fillPoints)
    end
    if #points >= 4 then
      love.graphics.setColor(Style.perf.sparkLine)
      love.graphics.setLineWidth(1.5)
      love.graphics.line(points)
      love.graphics.setLineWidth(1)
    end

    love.graphics.setColor(Style.perf.label)
    love.graphics.print("16.6ms", x0 + 4, threshY - fh - 2)
    y = y + sparkH + 16
  end

  -- == Top Offenders (by actual cost) ==
  love.graphics.setColor(Style.perf.header)
  love.graphics.print("Costliest Nodes (layout + paint time)", x0, y)
  y = y + fh + 8

  local offenders = getTopOffenders(tree, 20)
  if #offenders == 0 then
    love.graphics.setColor(Style.perf.label)
    love.graphics.print("Waiting for frame data...", x0, y)
  else
    for i, info in ipairs(offenders) do
      -- Row 1: rank, component name, lua type, dimensions, total cost
      local rc = info.renderCount
      local rowColor = Style.perf.static
      if rc > 20 then rowColor = Style.perf.hotspot
      elseif rc > 1 then rowColor = Style.perf.reactive end

      -- Rank
      love.graphics.setColor(Style.perf.label)
      love.graphics.print(string.format("%2d.", i), x0, y)
      local nx = x0 + font:getWidth("00. ")

      -- Component name (bright) or lua type
      if info.name then
        love.graphics.setColor(Style.perf.comp)
        love.graphics.print(info.name, nx, y)
        nx = nx + font:getWidth(info.name)
        -- Lua type as dim badge
        love.graphics.setColor(Style.perf.dim)
        love.graphics.print(" [" .. info.luaType .. "]", nx, y)
        nx = nx + font:getWidth(" [" .. info.luaType .. "]")
      else
        love.graphics.setColor(Style.perf.value)
        love.graphics.print(info.luaType, nx, y)
        nx = nx + font:getWidth(info.luaType)
      end

      -- #id
      love.graphics.setColor(Style.perf.dim)
      love.graphics.print(" #" .. info.id, nx, y)
      nx = nx + font:getWidth(" #" .. info.id)

      -- Right side: total cost
      local costStr = string.format("%.2fms", info.totalMs)
      local costW = font:getWidth(costStr)
      love.graphics.setColor(rowColor)
      love.graphics.print(costStr, x0 + contentW - costW, y)

      y = y + fh + 2

      -- Row 2: detailed breakdown
      nx = x0 + font:getWidth("00. ")
      love.graphics.setColor(Style.perf.dim)

      local details = {}
      details[#details + 1] = info.w .. "x" .. info.h
      details[#details + 1] = "layout:" .. string.format("%.2fms", info.layoutMs)
      details[#details + 1] = "paint:" .. string.format("%.2fms", info.paintMs)
      details[#details + 1] = "renders:" .. rc
      if info.handlerCount > 0 then
        details[#details + 1] = "handlers:" .. info.handlerCount
      end
      if #info.props > 0 then
        details[#details + 1] = table.concat(info.props, " ")
      end

      local detailStr = table.concat(details, "  ")
      love.graphics.print(detailStr, nx, y)

      -- Row 3: source file (if available)
      if info.source and info.source.fileName then
        y = y + fh + 1
        love.graphics.setColor(Style.perf.dim)
        local srcStr = info.source.fileName
        if info.source.lineNumber then
          srcStr = srcStr .. ":" .. info.source.lineNumber
        end
        -- Truncate long paths — show last 2 segments
        local parts = {}
        for part in srcStr:gmatch("[^/]+") do parts[#parts + 1] = part end
        if #parts > 2 then
          srcStr = ".../" .. parts[#parts - 1] .. "/" .. parts[#parts]
        end
        love.graphics.print(srcStr, nx, y)
      end

      y = y + fh + 6
    end
  end

  local perfContentH = (y - region.y) + perfScrollY
  -- Store for scrollbar interaction
  perfRegion = region
  perfContentHStored = perfContentH
  drawScrollbar(region.x, region.y, region.w, region.h, perfScrollY, perfContentH)
  love.graphics.setScissor()
end

-- ============================================================================
-- M.mousepressed(ctx, x, y, button)
-- ============================================================================

function M.mousepressed(ctx, x, y, button)
  -- Rate selector click (screen coords from last draw)
  if perfRateRegion and button == 1 then
    local pr = perfRateRegion
    if x >= pr.x and x < pr.x + pr.w and y >= pr.y and y < pr.y + pr.h then
      local idx = math.floor((x - pr.x) / pr.segW) + 1
      if idx >= 1 and idx <= #PERF_RATE_PRESETS then
        perfRateIdx = idx
        perfDisplaySnapshot = nil  -- force immediate refresh
      end
      return true
    end
  end
  return true
end

-- ============================================================================
-- M.wheelmoved(ctx, x, y)
-- ============================================================================

function M.wheelmoved(ctx, x, y)
  -- Map horizontal tilt to vertical scroll (page-like) when no vertical input
  local dy = y
  if dy == 0 and x ~= 0 then dy = x end
  perfScrollY = math.max(0, perfScrollY - dy * 20)
  return true
end

-- ============================================================================
-- Scroll state accessors (for scrollbar drag in main.lua)
-- ============================================================================

--- Returns the current scroll position and stored region/content height
--- so main.lua can wire scrollbar drag without reaching into module locals.
function M.getScrollState()
  return {
    scrollY = perfScrollY,
    region = perfRegion,
    contentH = perfContentHStored,
  }
end

--- Set scroll position (used by scrollbar drag in main.lua).
function M.setScrollY(value)
  perfScrollY = value
end

--- Reset scroll to top (used by refresh button in main.lua).
function M.resetScroll()
  perfScrollY = 0
end

return M
