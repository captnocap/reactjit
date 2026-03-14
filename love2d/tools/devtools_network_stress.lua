--[[
  devtools_network_stress.lua

  Synthetic stress validation for Network DevTools capture limits.
  Verifies:
    1) Ring buffer stays bounded.
    2) Dropped-event synthetic rows are emitted under burst load.
    3) Memory stays within a stable envelope after steady-state load.
]]

local function fail(msg)
  io.stderr:write("[FAIL] " .. tostring(msg) .. "\n")
  os.exit(1)
end

local ok, DevTools = pcall(require, "lua.devtools")
if not ok then
  fail("require lua.devtools: " .. tostring(DevTools))
end

local function spamFrame(frameIdx, eventsPerFrame, uniqueTraceIds)
  for i = 1, eventsPerFrame do
    local trace
    if uniqueTraceIds then
      trace = "ws:" .. tostring(frameIdx) .. ":" .. tostring(i)
    else
      trace = "ws:" .. tostring((i % 64) + 1)
    end
    DevTools.recordNetworkEvent({
      traceId = trace,
      origin = "runtime",
      transport = "ws",
      direction = "in",
      phase = "message",
      status = "ok",
      target = "ws://stress.local/socket?token=abcdef0123456789",
      payloadPreview = "msg-" .. tostring(frameIdx) .. "-" .. tostring(i),
      size = 24,
    })
  end
  DevTools.beginFrame(1 / 60)
end

DevTools.clearNetworkEvents()
collectgarbage("collect")
local mem0 = collectgarbage("count")

for frame = 1, 120 do
  spamFrame(frame, 500, false)
end
collectgarbage("collect")
local mem1 = collectgarbage("count")

for frame = 121, 240 do
  spamFrame(frame, 500, false)
end
collectgarbage("collect")
local mem2 = collectgarbage("count")

local snap = DevTools.getNetworkSnapshotForChild(20000)
local count = #snap.events
if count > 1600 then
  fail("ring buffer exceeded max size: " .. tostring(count))
end

local droppedRows = 0
for _, evt in ipairs(snap.events) do
  if evt.origin == "devtools" and evt.phase == "dropped" then
    droppedRows = droppedRows + 1
  end
end
if droppedRows == 0 then
  fail("no synthetic dropped-event rows were emitted")
end

local driftKB = math.abs(mem2 - mem1)
if driftKB > 1536 then
  fail(string.format("memory drift too high after steady-state load: %.1f KB", driftKB))
end

for frame = 241, 310 do
  spamFrame(frame, 500, true)
end
collectgarbage("collect")
local stats = DevTools.getNetworkDebugStats and DevTools.getNetworkDebugStats() or {}
local traceMetaCount = tonumber(stats.traceMetaCount) or 0
local traceRefCount = tonumber(stats.traceRefCount) or 0
if traceMetaCount > 1700 or traceRefCount > 1700 then
  fail(string.format("trace metadata exceeded bounds: meta=%d refs=%d", traceMetaCount, traceRefCount))
end

io.write(string.format(
  "[OK] events=%d droppedRows=%d mem0=%.1fKB mem1=%.1fKB mem2=%.1fKB drift=%.1fKB traces(meta=%d refs=%d) newestId=%d\n",
  count,
  droppedRows,
  mem0,
  mem1,
  mem2,
  driftKB,
  traceMetaCount,
  traceRefCount,
  snap.newestEventId or 0
))
