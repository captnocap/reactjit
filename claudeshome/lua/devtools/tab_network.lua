--[[
  devtools/tab_network.lua — Network tab: HTTP/WS observability timeline

  Extracted from devtools/main.lua. Displays network events in a scrollable
  table with trace grouping, filtering, detail pane, curl export, and JSON
  export.

  Usage:
    local NetworkTab = require("lua.devtools.tab_network")

    -- Per-frame bookkeeping:
    NetworkTab.beginFrame(ctx, dt)

    -- Record an event from the runtime:
    NetworkTab.recordNetworkEvent(ctx, rawEvent)

    -- Drawing and input:
    NetworkTab.draw(ctx, region)
    NetworkTab.mousepressed(ctx, x, y, button, region)
    NetworkTab.wheelmoved(ctx, x, y)

  The `ctx` table must provide:
    ctx.state            — devtools shared state table (netCapturedThisFrame, etc.)
    ctx.getFont          — function() returning a Love2D font (size 11)
    ctx.drawScrollbar    — function(rx, ry, rw, rh, scrollY, contentH)
    ctx.getScrollbarGeometry — function(region, scrollY, contentH)
    ctx.nowSec           — function() returning current time in seconds
    ctx.trimTo           — function(s, n) truncating string s to n chars
    ctx.copyTable        — function(src) shallow-copy a table
]]

local Style = require("lua.devtools.style")
local json  = require("lua.json")

local M = {}

-- ============================================================================
-- Constants
-- ============================================================================

local NET_MAX_EVENTS   = 1600
local NET_MAX_PER_TICK = 220
local NET_MAX_HEADERS  = 24
local NET_MAX_PREVIEW  = 240

-- ============================================================================
-- Module-local state (ring buffer, trace metadata, UI state)
-- ============================================================================

local netEvents          = {}
local netHead            = 0
local netCount           = 0
local netNextEventId     = 1
local netNewestEventId   = 0
local netSeqByTrace      = {}
local netTraceRefs       = {}
local netTraceMeta       = {}
local netSelectedEventId = nil
local netScrollY         = 0
local netRegion          = nil
local netContentHStored  = 0
local netHitRects        = {}
local netGroupByTrace    = true
local netExpanded        = {}
local netFilterTransport = "all"   -- all | http | ws | peer
local netFilterStatus    = "all"   -- all | errors | blocked
local netStatusMessage   = ""
local netStatusMessageTimer = 0

-- ============================================================================
-- Sanitisation helpers (network-specific)
-- ============================================================================

local SENSITIVE_KEYS = {
  ["authorization"]       = true,
  ["proxy-authorization"] = true,
  ["cookie"]              = true,
  ["set-cookie"]          = true,
  ["x-api-key"]           = true,
  ["x-amz-signature"]     = true,
}

local function isSensitiveKey(key)
  local k = tostring(key or ""):lower()
  if SENSITIVE_KEYS[k] then return true end
  if k:find("token", 1, true) then return true end
  if k:find("secret", 1, true) then return true end
  if k:find("key", 1, true) then return true end
  if k:find("password", 1, true) then return true end
  return false
end

local function sanitizeURL(url)
  local s = tostring(url or "")
  local base, query = s:match("^([^?]+)%?(.*)$")
  if not base then return s end
  local parts = {}
  for chunk in query:gmatch("[^&]+") do
    local k, v = chunk:match("^([^=]+)=(.*)$")
    if not k then
      parts[#parts + 1] = chunk
    elseif isSensitiveKey(k) then
      parts[#parts + 1] = k .. "=<redacted>"
    else
      parts[#parts + 1] = k .. "=" .. v
    end
  end
  return base .. "?" .. table.concat(parts, "&")
end

local function sanitizeHeaders(headers, trimTo)
  if type(headers) ~= "table" then return {} end
  local out = {}
  local count = 0
  for k, v in pairs(headers) do
    count = count + 1
    if count > NET_MAX_HEADERS then break end
    local key = tostring(k)
    if isSensitiveKey(key) then
      out[key] = "<redacted>"
    else
      out[key] = trimTo(v, 120)
    end
  end
  return out
end

local function sanitizePreview(value, trimTo)
  local s
  if type(value) == "string" then
    s = value
  elseif type(value) == "table" then
    local ok, encoded = pcall(json.encode, value)
    s = ok and encoded or tostring(value)
  else
    s = tostring(value or "")
  end

  s = s:gsub("eyJ[%w%-_]+%.[%w%-_]+%.[%w%-_]+", "<redacted-jwt>")
  s = s:gsub("Bearer%s+[A-Za-z0-9%._%-]+", "Bearer <redacted>")
  s = s:gsub("([A-Za-z0-9%+/_%-=]+)", function(tok)
    if #tok >= 40 then return "<redacted-token>" end
    return tok
  end)
  return trimTo(s, NET_MAX_PREVIEW)
end

-- ============================================================================
-- Trace / iteration helpers
-- ============================================================================

local function traceOf(evt)
  if evt.traceId then return tostring(evt.traceId) end
  return "event:" .. tostring(evt.eventId or 0)
end

local function updateTraceMeta(evt)
  local traceId = traceOf(evt)
  local m = netTraceMeta[traceId]
  if not m then
    m = { traceId = traceId, firstSeen = evt.ts, lastSeen = evt.ts }
    netTraceMeta[traceId] = m
  end
  m.firstSeen = math.min(m.firstSeen or evt.ts, evt.ts)
  m.lastSeen  = math.max(m.lastSeen or evt.ts, evt.ts)
  if evt.phase == "queued" then m.queuedTs = math.min(m.queuedTs or evt.ts, evt.ts) end
  if evt.phase == "sent" then m.sentTs = math.min(m.sentTs or evt.ts, evt.ts) end
  if evt.phase == "firstByte" or evt.phase == "open" then
    m.firstByteTs = math.min(m.firstByteTs or evt.ts, evt.ts)
  end
  if evt.phase == "done" or evt.phase == "close" or evt.phase == "error" or evt.phase == "blocked" then
    m.doneTs = math.max(m.doneTs or evt.ts, evt.ts)
  end
  if evt.method and not m.method then m.method = evt.method end
  if evt.target and not m.target then m.target = evt.target end
  if evt.status then m.status = evt.status end
end

local function iterNetworkEvents(fn)
  for i = 1, netCount do
    local idx = ((netHead - netCount + i - 1) % NET_MAX_EVENTS) + 1
    local evt = netEvents[idx]
    if evt then fn(evt) end
  end
end

local function getEventById(eventId)
  if not eventId then return nil end
  local found = nil
  iterNetworkEvents(function(evt)
    if evt.eventId == eventId then found = evt end
  end)
  return found
end

-- ============================================================================
-- Ring buffer push / normalize
-- ============================================================================

local function pushNetworkEvent(evt, fromSync, ctxState)
  if not fromSync then
    if ctxState.netCapturedThisFrame >= NET_MAX_PER_TICK then
      ctxState.netDroppedThisFrame = ctxState.netDroppedThisFrame + 1
      ctxState.netRecentDropped    = ctxState.netRecentDropped + 1
      return false
    end
    ctxState.netCapturedThisFrame = ctxState.netCapturedThisFrame + 1
  end

  local replaced = nil
  netHead = (netHead % NET_MAX_EVENTS) + 1
  if netCount == NET_MAX_EVENTS then replaced = netEvents[netHead] end
  netEvents[netHead] = evt
  if netCount < NET_MAX_EVENTS then netCount = netCount + 1 end
  if replaced then
    local replacedTrace = traceOf(replaced)
    local nextCount = (netTraceRefs[replacedTrace] or 0) - 1
    if nextCount <= 0 then
      netTraceRefs[replacedTrace]  = nil
      netTraceMeta[replacedTrace]  = nil
      netSeqByTrace[replacedTrace] = nil
      netExpanded[replacedTrace]   = nil
    else
      netTraceRefs[replacedTrace] = nextCount
    end
  end
  local traceId = traceOf(evt)
  netTraceRefs[traceId] = (netTraceRefs[traceId] or 0) + 1
  if replaced and replaced.eventId == netSelectedEventId then
    netSelectedEventId = nil
  end
  netNewestEventId = math.max(netNewestEventId, evt.eventId or 0)
  ctxState.netRecentEvents = ctxState.netRecentEvents + 1
  if evt.status == "error" then ctxState.netLastErrorTs = evt.ts end
  updateTraceMeta(evt)
  return true
end

local function normalizeNetworkEvent(raw, fromSync, ctx)
  if type(raw) ~= "table" then return nil end
  local copyTable = ctx.copyTable
  local trimTo    = ctx.trimTo
  local nowSec    = ctx.nowSec

  local evt = copyTable(raw)
  local traceId = evt.traceId and tostring(evt.traceId) or nil
  if not evt.eventId then
    evt.eventId = netNextEventId
  end
  netNextEventId = math.max(netNextEventId, (evt.eventId or 0) + 1)
  if evt.eventId <= netNewestEventId and fromSync then
    return nil
  end

  if not traceId then
    traceId = "event:" .. tostring(evt.eventId)
  end
  evt.traceId = traceId

  if not evt.seq then
    local nextSeq = (netSeqByTrace[traceId] or 0) + 1
    netSeqByTrace[traceId] = nextSeq
    evt.seq = nextSeq
  else
    netSeqByTrace[traceId] = math.max(netSeqByTrace[traceId] or 0, tonumber(evt.seq) or 0)
  end

  evt.ts             = tonumber(evt.ts) or nowSec()
  evt.origin         = evt.origin or "runtime"
  evt.transport      = evt.transport or "http"
  evt.direction      = evt.direction or "out"
  evt.phase          = evt.phase or "info"
  evt.status         = evt.status or "ok"
  evt.target         = sanitizeURL(evt.target or evt.url or "")
  evt.method         = evt.method and tostring(evt.method):upper() or nil
  evt.message        = evt.message and trimTo(evt.message, 140) or nil
  evt.error          = evt.error and trimTo(evt.error, 180) or nil
  evt.blockedReason  = evt.blockedReason and trimTo(evt.blockedReason, 100) or nil
  evt.payloadPreview = sanitizePreview(evt.payloadPreview or evt.payload or "", trimTo)
  evt.requestBody    = sanitizePreview(evt.requestBody or evt.body or "", trimTo)
  evt.headers        = sanitizeHeaders(evt.headers, trimTo)
  evt.responseHeaders = sanitizeHeaders(evt.responseHeaders, trimTo)
  evt.size           = tonumber(evt.size) or nil
  evt.code           = tonumber(evt.code) or nil
  evt.durationMs     = tonumber(evt.durationMs) or nil
  return evt
end

-- ============================================================================
-- Drawing helpers
-- ============================================================================

local function netSetStatus(msg)
  netStatusMessage      = tostring(msg or "")
  netStatusMessageTimer = 3.0
end

local function netClipboardWrite(text)
  if love.system and love.system.setClipboardText then
    local ok = pcall(love.system.setClipboardText, tostring(text or ""))
    if ok then
      netSetStatus("Copied to clipboard.")
    else
      netSetStatus("Clipboard write failed.")
    end
  else
    netSetStatus("Clipboard not available in this target.")
  end
end

local function netShellQuote(s)
  s = tostring(s or "")
  return "'" .. s:gsub("'", "'\\''") .. "'"
end

local function netGetTraceEvents(traceId)
  local list = {}
  if not traceId then return list end
  iterNetworkEvents(function(evt)
    if traceOf(evt) == traceId then list[#list + 1] = evt end
  end)
  table.sort(list, function(a, b)
    if a.ts == b.ts then return (a.seq or 0) < (b.seq or 0) end
    return a.ts < b.ts
  end)
  return list
end

local function netBuildCurl(traceId)
  local events = netGetTraceEvents(traceId)
  local req = nil
  for _, evt in ipairs(events) do
    if evt.transport == "http" and evt.direction == "out" and evt.target and evt.target ~= "" then
      req = evt
      break
    end
  end
  if not req then return nil end
  local method = req.method or "GET"
  local parts = { "curl", "-X", method }
  local keys = {}
  for k in pairs(req.headers or {}) do keys[#keys + 1] = k end
  table.sort(keys)
  for _, k in ipairs(keys) do
    local v = req.headers[k]
    parts[#parts + 1] = "-H"
    parts[#parts + 1] = netShellQuote(k .. ": " .. tostring(v))
  end
  if req.requestBody and req.requestBody ~= "" then
    parts[#parts + 1] = "--data"
    parts[#parts + 1] = netShellQuote(req.requestBody)
  end
  parts[#parts + 1] = netShellQuote(req.target)
  return table.concat(parts, " ")
end

local function netExportTrace(traceId, nowSec)
  local events = netGetTraceEvents(traceId)
  local payload = {
    traceId    = traceId,
    exportedAt = nowSec(),
    events     = events,
  }
  local ok, encoded = pcall(json.encode, payload)
  if not ok then return nil end
  return encoded
end

local function netEventBadge(evt)
  if evt.phase == "dropped" then return "DROP", Style.network.warn end
  if evt.origin == "quarantine" then return "QUAR", Style.network.warn end
  if evt.status == "blocked" or evt.phase == "blocked" then return "BLOCK", Style.network.warn end
  if evt.status == "error" or evt.phase == "error" then return "ERR", Style.network.err end
  return "", Style.network.quiet
end

local function netEventSummary(evt, trimTo)
  local target = tostring(evt.target or "")
  local _, host, path = target:match("^([%w+%-%.]+)://([^/%?]+)([^%?]*)")
  if host then
    target = host .. ((path and path ~= "") and path or "/")
  elseif target == "" then
    target = "-"
  end
  if evt.transport == "http" then
    return (evt.method or "HTTP") .. " " .. target
  elseif evt.transport == "ws" then
    return (evt.phase or "ws") .. " " .. target
  elseif evt.transport == "peer" then
    local c = evt.clientId and ("#" .. tostring(evt.clientId) .. " ") or ""
    return c .. (evt.phase or "peer") .. " " .. target
  end
  return trimTo(evt.message or evt.phase or "event", 56)
end

local function netMatchesFilters(evt)
  if netFilterTransport ~= "all" and evt.transport ~= netFilterTransport then return false end
  if netFilterStatus == "errors" then
    return evt.status == "error" or evt.phase == "error"
  elseif netFilterStatus == "blocked" then
    return evt.status == "blocked" or evt.phase == "blocked" or evt.origin == "quarantine"
  end
  return true
end

local function netButton(x, y, label, active, kind, value, font)
  local h = 18
  local w = font:getWidth(label) + 14
  love.graphics.setColor(active and Style.network.buttonOn or Style.network.buttonBg)
  love.graphics.rectangle("fill", x, y, w, h, 4, 4)
  love.graphics.setColor(active and Style.network.value or Style.network.dim)
  love.graphics.print(label, x + 7, y + math.floor((h - font:getHeight()) / 2))
  netHitRects[#netHitRects + 1] = { x = x, y = y, w = w, h = h, kind = kind, value = value }
  return w + 6
end

-- ============================================================================
-- M.draw(ctx, region)
-- ============================================================================

function M.draw(ctx, region)
  local font = ctx.getFont()
  local trimTo = ctx.trimTo
  local nowSec = ctx.nowSec
  local drawScrollbar = ctx.drawScrollbar

  love.graphics.setFont(font)
  love.graphics.setScissor(region.x, region.y, region.w, region.h)

  love.graphics.setColor(Style.network.bg)
  love.graphics.rectangle("fill", region.x, region.y, region.w, region.h)
  netHitRects = {}

  local pad = 10
  local lineH = font:getHeight() + 4
  local controlsH = 52
  local tableHeaderH = lineH + 6
  local detailH = netSelectedEventId and 156 or 0
  local headerY = region.y + controlsH
  local rowsY = headerY + tableHeaderH
  local rowsH = math.max(40, region.h - controlsH - tableHeaderH - detailH - 4)
  local detailY = rowsY + rowsH + 4
  local colTimeX   = region.x + pad
  local colBadgeX  = colTimeX + 54
  local colTypeX   = colBadgeX + 48
  local colDirX    = colTypeX + 44
  local colOriginX = colDirX + 50
  local colNameX   = colOriginX + 58

  local function trimWidth(s, maxW)
    s = tostring(s or "")
    if maxW <= 12 then return "..." end
    if font:getWidth(s) <= maxW then return s end
    local out = s
    while #out > 1 and font:getWidth(out .. "...") > maxW do
      out = out:sub(1, -2)
    end
    return out .. "..."
  end

  local function statusText(evt)
    local statusStr = evt.code and (tostring(evt.status) .. ":" .. tostring(evt.code)) or tostring(evt.status or "")
    if evt.durationMs then statusStr = statusStr .. string.format(" %.1fms", evt.durationMs) end
    return statusStr
  end

  -- Controls row
  love.graphics.setColor(Style.network.header)
  love.graphics.print("Network", region.x + pad, region.y + 7)
  local cx = region.x + pad + font:getWidth("Network") + 12
  cx = cx + netButton(cx, region.y + 6, netGroupByTrace and "Grouped" or "Flat", netGroupByTrace, "toggle_group", nil, font)
  cx = cx + netButton(cx, region.y + 6, "All", netFilterTransport == "all", "filter_transport", "all", font)
  cx = cx + netButton(cx, region.y + 6, "HTTP", netFilterTransport == "http", "filter_transport", "http", font)
  cx = cx + netButton(cx, region.y + 6, "WS", netFilterTransport == "ws", "filter_transport", "ws", font)
  cx = cx + netButton(cx, region.y + 6, "Peer", netFilterTransport == "peer", "filter_transport", "peer", font)

  local sx = region.x + pad
  sx = sx + netButton(sx, region.y + 28, "Any", netFilterStatus == "all", "filter_status", "all", font)
  sx = sx + netButton(sx, region.y + 28, "Errors", netFilterStatus == "errors", "filter_status", "errors", font)
  sx = sx + netButton(sx, region.y + 28, "Blocked", netFilterStatus == "blocked", "filter_status", "blocked", font)
  if netGroupByTrace then
    sx = sx + netButton(sx, region.y + 28, "Expand", false, "expand_all", nil, font)
    sx = sx + netButton(sx, region.y + 28, "Collapse", false, "collapse_all", nil, font)
  end
  sx = sx + netButton(sx, region.y + 28, "Clear", false, "clear", nil, font)
  sx = sx + netButton(sx, region.y + 28, "Copy curl", false, "copy_curl", nil, font)
  sx = sx + netButton(sx, region.y + 28, "Export JSON", false, "export_json", nil, font)
  sx = sx + 8  -- gap before test button
  sx = sx + netButton(sx, region.y + 28, "Ping Tor", false, "ping_tor", nil, font)

  local fillPct = math.floor((netCount / NET_MAX_EVENTS) * 100)
  local health = string.format(
    "evt/s %.1f  drop/s %.1f  fill %d%%",
    ctx.state.netEventsPerSec or 0,
    ctx.state.netDroppedPerSec or 0,
    fillPct
  )
  if ctx.state.netLastErrorTs then
    health = health .. string.format("  last err %.1fs ago", math.max(0, nowSec() - ctx.state.netLastErrorTs))
  end
  love.graphics.setColor(Style.network.dim)
  local hw = font:getWidth(health)
  love.graphics.print(health, region.x + region.w - hw - pad, region.y + 30)

  if netStatusMessage ~= "" then
    love.graphics.setColor(Style.network.warn)
    love.graphics.print(netStatusMessage, region.x + region.w - font:getWidth(netStatusMessage) - pad, region.y + 8)
  end

  -- Column header
  love.graphics.setColor(Style.network.rowHover)
  love.graphics.rectangle("fill", region.x, headerY, region.w, tableHeaderH)
  love.graphics.setColor(Style.palette.border)
  love.graphics.rectangle("fill", region.x, headerY + tableHeaderH - 1, region.w, 1)
  love.graphics.setColor(Style.network.header)
  local hdrY = headerY + 3
  love.graphics.print("Time",   colTimeX,   hdrY)
  love.graphics.print("Flag",   colBadgeX,  hdrY)
  love.graphics.print("Type",   colTypeX,   hdrY)
  love.graphics.print("Dir",    colDirX,    hdrY)
  love.graphics.print("Origin", colOriginX, hdrY)
  love.graphics.print("Name",   colNameX,   hdrY)
  local statusLabel = "Status"
  love.graphics.print(statusLabel, region.x + region.w - pad - font:getWidth(statusLabel), hdrY)

  -- Build filtered rows
  local filtered = {}
  iterNetworkEvents(function(evt)
    if netMatchesFilters(evt) then filtered[#filtered + 1] = evt end
  end)

  local rows = {}
  if netGroupByTrace then
    local groupMap   = {}
    local groupOrder = {}
    for _, evt in ipairs(filtered) do
      local tid = traceOf(evt)
      local g = groupMap[tid]
      if not g then
        g = { traceId = tid, events = {} }
        groupMap[tid] = g
        groupOrder[#groupOrder + 1] = g
      end
      g.events[#g.events + 1] = evt
      g.last = evt
    end
    table.sort(groupOrder, function(a, b)
      local aId = a.last and a.last.eventId or 0
      local bId = b.last and b.last.eventId or 0
      return aId > bId
    end)
    for _, g in ipairs(groupOrder) do
      rows[#rows + 1] = { kind = "group", group = g }
      if netExpanded[g.traceId] then
        for i = #g.events, 1, -1 do
          rows[#rows + 1] = { kind = "event", evt = g.events[i], depth = 1 }
        end
      end
    end
  else
    for i = #filtered, 1, -1 do
      rows[#rows + 1] = { kind = "event", evt = filtered[i], depth = 0 }
    end
  end

  -- Scrollable rows area
  netRegion = { x = region.x, y = rowsY, w = region.w, h = rowsH }
  love.graphics.setScissor(netRegion.x, netRegion.y, netRegion.w, netRegion.h)

  local y = rowsY + 4 - netScrollY
  for _, row in ipairs(rows) do
    if y + lineH >= rowsY and y <= rowsY + rowsH then
      if row.kind == "group" then
        local g = row.group
        local open = netExpanded[g.traceId] == true
        love.graphics.setColor(Style.network.rowHover)
        love.graphics.rectangle("fill", region.x + 2, y - 1, region.w - 10, lineH + 2, 3, 3)
        love.graphics.setColor(Style.network.value)
        local prefix = open and "- " or "+ "
        local label = prefix .. trimTo(g.traceId, 34) .. " (" .. tostring(#g.events) .. ")"
        local summary = g.last and netEventSummary(g.last, trimTo) or ""
        love.graphics.print(label, colTimeX, y)
        love.graphics.setColor(Style.network.dim)
        local right = region.x + region.w - 12
        local groupStatus = g.last and statusText(g.last) or ""
        local groupStatusW = font:getWidth(groupStatus)
        local nameW = math.max(40, right - groupStatusW - 8 - colNameX)
        love.graphics.print(trimWidth(summary, nameW), colNameX, y)
        if groupStatus ~= "" then
          love.graphics.print(groupStatus, right - groupStatusW, y)
        end
        netHitRects[#netHitRects + 1] = {
          x = region.x + 2, y = y - 1, w = region.w - 10, h = lineH + 2,
          kind = "toggle_trace", value = g.traceId
        }
      else
        local evt = row.evt
        local isSel = evt.eventId == netSelectedEventId
        love.graphics.setColor(isSel and Style.network.rowSel or Style.network.bg)
        love.graphics.rectangle("fill", region.x + 2, y - 1, region.w - 10, lineH + 2, 3, 3)
        local badge, badgeCol = netEventBadge(evt)
        local depthX = (row.depth or 0) * 14
        local right = region.x + region.w - 12
        local statusStr = statusText(evt)
        local statusW = font:getWidth(statusStr)
        local nameW = math.max(40, right - statusW - 8 - (colNameX + depthX))
        love.graphics.setColor(Style.network.dim)
        love.graphics.print(string.format("%.3f", evt.ts % 1000), colTimeX + depthX, y)
        love.graphics.setColor(badgeCol)
        love.graphics.print(badge, colBadgeX + depthX, y)
        love.graphics.setColor(Style.network.dim)
        love.graphics.print(trimTo(evt.transport or "-", 6), colTypeX + depthX, y)
        love.graphics.print(trimTo(evt.direction or "-", 8), colDirX + depthX, y)
        love.graphics.print(trimTo(evt.origin or "-", 8), colOriginX + depthX, y)
        love.graphics.setColor(Style.network.value)
        love.graphics.print(trimWidth(netEventSummary(evt, trimTo), nameW), colNameX + depthX, y)
        love.graphics.setColor(Style.network.dim)
        love.graphics.print(statusStr, right - statusW, y)
        netHitRects[#netHitRects + 1] = {
          x = region.x + 2, y = y - 1, w = region.w - 10, h = lineH + 2,
          kind = "select_event", value = evt.eventId
        }
      end
    end
    y = y + lineH + 2
  end

  netContentHStored = (y - rowsY) + netScrollY + 6
  drawScrollbar(netRegion.x, netRegion.y, netRegion.w, netRegion.h, netScrollY, netContentHStored)
  love.graphics.setScissor()

  -- Detail pane
  love.graphics.setColor(Style.network.rowHover)
  love.graphics.rectangle("fill", region.x, detailY, region.w, detailH)
  love.graphics.setColor(Style.palette.border)
  love.graphics.rectangle("fill", region.x, detailY, region.w, 1)

  local selected = getEventById(netSelectedEventId)
  local dx = region.x + pad
  local dy = detailY + 6
  if selected then
    local traceId = traceOf(selected)
    local meta = netTraceMeta[traceId]
    love.graphics.setColor(Style.network.header)
    love.graphics.print("Trace " .. traceId, dx, dy)
    dy = dy + lineH
    love.graphics.setColor(Style.network.value)
    love.graphics.print(selected.phase .. "  " .. netEventSummary(selected, trimTo), dx, dy)
    dy = dy + lineH

    love.graphics.setColor(Style.network.dim)
    local eventMeta = string.format(
      "event #%d  seq %s  parent %s  origin %s",
      selected.eventId or 0,
      tostring(selected.seq or "-"),
      tostring(selected.parentId or "-"),
      tostring(selected.origin or "-")
    )
    love.graphics.print(trimWidth(eventMeta, region.w - pad * 2), dx, dy)
    dy = dy + lineH + 2

    local barW = math.max(80, region.w - pad * 2)
    local queued = meta and meta.queuedTs or nil
    local sent   = meta and meta.sentTs or nil
    local first  = meta and meta.firstByteTs or nil
    local done   = meta and meta.doneTs or nil
    local startTs = queued or sent or selected.ts
    local endTs   = done or (meta and meta.lastSeen) or selected.ts
    if startTs then
      if not endTs or endTs < startTs then endTs = startTs end
      local span = math.max(0.001, endTs - startTs)
      local function marker(ts)
        return dx + ((ts - startTs) / span) * barW
      end
      love.graphics.setColor(Style.network.dim)
      love.graphics.rectangle("fill", dx, dy + 8, barW, 2)
      if queued then
        local px = marker(queued)
        love.graphics.setColor(Style.network.dim)
        love.graphics.rectangle("fill", px - 1, dy + 5, 3, 8, 1, 1)
        love.graphics.print("Q", px - 3, dy - font:getHeight())
      end
      if sent then
        local px = marker(sent)
        love.graphics.setColor(Style.network.value)
        love.graphics.rectangle("fill", px - 1, dy + 5, 3, 8, 1, 1)
        love.graphics.print("S", px - 3, dy - font:getHeight())
      end
      if first then
        local px = marker(first)
        love.graphics.setColor(Style.network.warn)
        love.graphics.rectangle("fill", px - 1, dy + 5, 3, 8, 1, 1)
        love.graphics.print("F", px - 3, dy - font:getHeight())
      end
      if done then
        local px = marker(done)
        love.graphics.setColor(selected.status == "error" and Style.network.err or Style.network.good)
        love.graphics.rectangle("fill", px - 1, dy + 5, 3, 8, 1, 1)
        love.graphics.print("D", px - 3, dy - font:getHeight())
      end

      local timingParts = {}
      if queued and first then
        timingParts[#timingParts + 1] = string.format("ttfb %.1fms", (first - queued) * 1000)
      end
      if queued and done then
        timingParts[#timingParts + 1] = string.format("total %.1fms", (done - queued) * 1000)
      elseif selected.durationMs then
        timingParts[#timingParts + 1] = string.format("total %.1fms", selected.durationMs)
      end
      if #timingParts > 0 then
        local timing = table.concat(timingParts, "  ")
        love.graphics.setColor(Style.network.dim)
        love.graphics.print(timing, dx + math.max(0, barW - font:getWidth(timing)), dy + 12)
      end
      dy = dy + 30
    end
    dy = dy + 2

    if selected.error then
      love.graphics.setColor(Style.network.err)
      love.graphics.print(trimWidth("error: " .. selected.error, region.w - pad * 2), dx, dy)
      dy = dy + lineH
    elseif selected.message then
      love.graphics.setColor(Style.network.dim)
      love.graphics.print(trimWidth("message: " .. selected.message, region.w - pad * 2), dx, dy)
      dy = dy + lineH
    end

    if selected.payloadPreview and selected.payloadPreview ~= "" then
      love.graphics.setColor(Style.network.dim)
      love.graphics.print(trimWidth("payload: " .. selected.payloadPreview, region.w - pad * 2), dx, dy)
      dy = dy + lineH
    end
  else
    love.graphics.setColor(Style.network.dim)
    love.graphics.print("Select a row to inspect details.", dx, dy)
  end

  love.graphics.setScissor()
end

-- ============================================================================
-- M.mousepressed(ctx, x, y, button, region)
-- ============================================================================

function M.mousepressed(ctx, x, y, button, region)
  if button ~= 1 then return false end
  if x < region.x or x > region.x + region.w then return false end
  if y < region.y or y > region.y + region.h then return false end

  local nowSec = ctx.nowSec
  local trimTo = ctx.trimTo

  for i = #netHitRects, 1, -1 do
    local r = netHitRects[i]
    if x >= r.x and x < r.x + r.w and y >= r.y and y < r.y + r.h then
      if r.kind == "toggle_group" then
        netGroupByTrace = not netGroupByTrace
      elseif r.kind == "filter_transport" then
        netFilterTransport = r.value or "all"
      elseif r.kind == "filter_status" then
        netFilterStatus = r.value or "all"
      elseif r.kind == "expand_all" then
        netExpanded = {}
        iterNetworkEvents(function(evt)
          if netMatchesFilters(evt) then netExpanded[traceOf(evt)] = true end
        end)
      elseif r.kind == "collapse_all" then
        netExpanded = {}
      elseif r.kind == "clear" then
        M.clearNetworkEvents(ctx)
      elseif r.kind == "copy_curl" then
        local selected = getEventById(netSelectedEventId)
        local traceId = selected and traceOf(selected) or nil
        local curl = netBuildCurl(traceId)
        if curl then
          netClipboardWrite(curl)
        else
          netSetStatus("No HTTP request selected for curl.")
        end
      elseif r.kind == "export_json" then
        local selected = getEventById(netSelectedEventId)
        local traceId = selected and traceOf(selected) or nil
        local exported = netExportTrace(traceId, nowSec)
        if exported then
          netClipboardWrite(exported)
        else
          netSetStatus("No trace selected for JSON export.")
        end
      elseif r.kind == "ping_tor" then
        ctx.state.netPingSeq = ctx.state.netPingSeq + 1
        local pingId = "devtools_ping_" .. ctx.state.netPingSeq
        local traceId = "http:" .. pingId
        local url = "https://check.torproject.org/"
        M.recordNetworkEvent(ctx, {
          traceId   = traceId,
          origin    = "devtools",
          transport = "http",
          direction = "out",
          phase     = "queued",
          status    = "ok",
          method    = "GET",
          target    = url,
        })
        local http = require("lua.http")
        if http and http.request then
          M.recordNetworkEvent(ctx, {
            traceId   = traceId,
            origin    = "devtools",
            transport = "http",
            direction = "out",
            phase     = "sent",
            status    = "ok",
            method    = "GET",
            target    = url,
          })
          http.request(pingId, { url = url, method = "GET" })
          netSetStatus("Ping sent \226\134\146 check.torproject.org")
        else
          M.recordNetworkEvent(ctx, {
            traceId   = traceId,
            origin    = "devtools",
            transport = "http",
            direction = "out",
            phase     = "error",
            status    = "error",
            error     = "http module not available",
            target    = url,
          })
          netSetStatus("HTTP module not available.")
        end
      elseif r.kind == "toggle_trace" then
        netExpanded[r.value] = not netExpanded[r.value]
      elseif r.kind == "select_event" then
        netSelectedEventId = r.value
        if netGroupByTrace then
          local selected = getEventById(netSelectedEventId)
          if selected then netExpanded[traceOf(selected)] = true end
        end
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
  local dy = y
  if dy == 0 and x ~= 0 then dy = x end
  netScrollY = math.max(0, netScrollY - dy * 20)
  if netRegion and netContentHStored > 0 then
    local maxScroll = math.max(0, netContentHStored - netRegion.h)
    netScrollY = math.min(netScrollY, maxScroll)
  end
  return true
end

-- ============================================================================
-- M.beginFrame(ctx, dt)
-- ============================================================================

function M.beginFrame(ctx, dt)
  local nowSec = ctx.nowSec

  ctx.state.netCapturedThisFrame = 0
  if ctx.state.netDroppedThisFrame > 0 then
    local dropped = ctx.state.netDroppedThisFrame
    ctx.state.netDroppedThisFrame = 0
    local seq = (netSeqByTrace["devtools:drops"] or 0) + 1
    netSeqByTrace["devtools:drops"] = seq
    pushNetworkEvent({
      eventId         = netNextEventId,
      traceId         = "devtools:drops",
      parentId        = nil,
      seq             = seq,
      ts              = nowSec(),
      origin          = "devtools",
      transport       = "synthetic",
      direction       = "internal",
      phase           = "dropped",
      status          = "warn",
      message         = "Dropped " .. tostring(dropped) .. " network events this frame (rate limit).",
      payloadPreview  = "",
      headers         = {},
      responseHeaders = {},
    }, true, ctx.state)
    netNextEventId = netNextEventId + 1
  end

  ctx.state.netStatsTimer = ctx.state.netStatsTimer + (dt or 0)
  if ctx.state.netStatsTimer >= 1 then
    local window = ctx.state.netStatsTimer
    ctx.state.netEventsPerSec  = ctx.state.netRecentEvents / window
    ctx.state.netDroppedPerSec = ctx.state.netRecentDropped / window
    ctx.state.netRecentEvents  = 0
    ctx.state.netRecentDropped = 0
    ctx.state.netStatsTimer    = 0
  end

  if netStatusMessageTimer > 0 then
    netStatusMessageTimer = netStatusMessageTimer - (dt or 0)
    if netStatusMessageTimer <= 0 then netStatusMessage = "" end
  end
end

-- ============================================================================
-- M.recordNetworkEvent(ctx, raw)
-- ============================================================================

function M.recordNetworkEvent(ctx, raw)
  local evt = normalizeNetworkEvent(raw, false, ctx)
  if not evt then return false end
  return pushNetworkEvent(evt, false, ctx.state)
end

-- ============================================================================
-- M.clearNetworkEvents(ctx)
-- ============================================================================

function M.clearNetworkEvents(ctx)
  netEvents          = {}
  netHead            = 0
  netCount           = 0
  netNextEventId     = 1
  netNewestEventId   = 0
  netTraceRefs       = {}
  netTraceMeta       = {}
  netSeqByTrace      = {}
  netExpanded        = {}
  netSelectedEventId = nil
  netScrollY         = 0
  ctx.state.netCapturedThisFrame = 0
  ctx.state.netDroppedThisFrame  = 0
  ctx.state.netStatsTimer        = 0
  ctx.state.netRecentEvents      = 0
  ctx.state.netRecentDropped     = 0
  ctx.state.netEventsPerSec      = 0
  ctx.state.netDroppedPerSec     = 0
  ctx.state.netLastErrorTs       = nil
  ctx.state.forceNetSnapshot     = true
end

-- ============================================================================
-- M.getLatestNetworkEventId()
-- ============================================================================

function M.getLatestNetworkEventId()
  return netNewestEventId
end

-- ============================================================================
-- M.getNetworkDebugStats()
-- ============================================================================

function M.getNetworkDebugStats()
  local traces = 0
  local metas  = 0
  local seqs   = 0
  for _ in pairs(netTraceRefs) do traces = traces + 1 end
  for _ in pairs(netTraceMeta) do metas  = metas + 1 end
  for _ in pairs(netSeqByTrace) do seqs  = seqs + 1 end
  return {
    eventCount     = netCount,
    maxEvents      = NET_MAX_EVENTS,
    traceRefCount  = traces,
    traceMetaCount = metas,
    seqMapCount    = seqs,
    newestEventId  = netNewestEventId,
  }
end

-- ============================================================================
-- M.getNetworkSnapshotForChild(limit)
-- ============================================================================

function M.getNetworkSnapshotForChild(limit)
  local out = {}
  local maxCount = math.max(0, tonumber(limit) or 300)
  local start = math.max(1, netCount - maxCount + 1)
  local n = 0
  local sentUpTo = 0
  iterNetworkEvents(function(evt)
    n = n + 1
    if n >= start then
      out[#out + 1] = evt
      sentUpTo = evt.eventId
    end
  end)
  return {
    mode            = "snapshot",
    events          = out,
    newestEventId   = netNewestEventId,
    sentUpToEventId = sentUpTo,
    startEventId    = out[1] and out[1].eventId or (netNewestEventId + 1),
  }
end

-- ============================================================================
-- M.getNetworkDeltaForChild(lastEventId, maxEvents)
-- ============================================================================

function M.getNetworkDeltaForChild(lastEventId, maxEvents)
  local out = {}
  local minId = tonumber(lastEventId) or 0
  local budget = math.max(1, tonumber(maxEvents) or 200)
  local sentUpTo = minId
  iterNetworkEvents(function(evt)
    if evt.eventId > minId and #out < budget then
      out[#out + 1] = evt
      sentUpTo = evt.eventId
    end
  end)
  return {
    mode            = "delta",
    events          = out,
    newestEventId   = netNewestEventId,
    sentUpToEventId = sentUpTo,
    startEventId    = out[1] and out[1].eventId or (minId + 1),
  }
end

-- ============================================================================
-- M.ingestNetworkDelta(payload)
-- ============================================================================

function M.ingestNetworkDelta(payload, ctx)
  if type(payload) ~= "table" or type(payload.events) ~= "table" then return end
  if payload.mode == "snapshot" then
    netEvents          = {}
    netHead            = 0
    netCount           = 0
    netTraceRefs       = {}
    netTraceMeta       = {}
    netSeqByTrace      = {}
    netExpanded        = {}
    netSelectedEventId = nil
    netScrollY         = 0
    netNewestEventId   = 0
  end
  for _, raw in ipairs(payload.events) do
    local evt = normalizeNetworkEvent(raw, true, ctx)
    if evt then
      pushNetworkEvent(evt, true, ctx.state)
    end
  end
  local newest = tonumber(payload.newestEventId)
  if newest then
    netNewestEventId = math.max(netNewestEventId, newest)
    netNextEventId   = math.max(netNextEventId, netNewestEventId + 1)
  end
end

-- ============================================================================
-- Expose internal accessors needed by main.lua scrollbar drag logic
-- ============================================================================

--- Returns the current scroll position and stored region/content height
--- so main.lua can wire scrollbar drag without reaching into module locals.
function M.getScrollState()
  return {
    scrollY = netScrollY,
    region = netRegion,
    contentH = netContentHStored,
  }
end

--- Set scroll position (used by scrollbar drag in main.lua).
function M.setScrollY(value)
  netScrollY = value
end

return M
