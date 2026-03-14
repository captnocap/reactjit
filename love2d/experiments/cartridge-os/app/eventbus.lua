--[[
  eventbus.lua — Structured event bus with channels
  CartridgeOS console event system.

  Channels: os, input, gpu, route, app, usb, console, debug
  Each event: {channel, summary, detail, timestamp}
  System events always show. Debug events are opt-in per channel.
]]

local EventBus = {}

-- Channel definitions: color {r,g,b} and default level
local channels = {
  os      = { color = {0.4, 0.8, 1.0},  level = "system" },
  input   = { color = {0.5, 0.9, 0.5},  level = "system" },
  gpu     = { color = {1.0, 0.7, 0.3},  level = "system" },
  route   = { color = {0.8, 0.5, 1.0},  level = "system" },
  app     = { color = {0.3, 0.8, 0.9},  level = "system" },
  usb     = { color = {0.9, 0.6, 0.4},  level = "system" },
  console = { color = {0.6, 0.6, 0.7},  level = "system" },
  debug   = { color = {0.5, 0.5, 0.5},  level = "debug"  },
}

-- Per-channel debug visibility toggle
local debugEnabled = {}

-- Circular history buffer
local HISTORY_SIZE = 200
local history = {}
local historyHead = 0  -- next write index (0-based)
local historyCount = 0

-- Subscribers: channel -> {callback, callback, ...}
local subscribers = {}

--- Get channel color
function EventBus.channelColor(channel)
  local ch = channels[channel]
  if ch then return ch.color[1], ch.color[2], ch.color[3] end
  return 0.5, 0.5, 0.5
end

--- Check if a channel's events should be visible
function EventBus.isVisible(channel)
  local ch = channels[channel]
  if not ch then return false end
  if ch.level == "system" then return true end
  return debugEnabled[channel] == true
end

--- Toggle debug visibility for a channel
function EventBus.setDebug(channel, on)
  debugEnabled[channel] = on
end

function EventBus.getDebug(channel)
  return debugEnabled[channel] == true
end

--- Emit an event
function EventBus.emit(channel, summary, detail)
  local event = {
    channel   = channel,
    summary   = summary,
    detail    = detail,
    timestamp = os.clock(),
  }

  -- Write to circular buffer
  history[historyHead] = event
  historyHead = (historyHead + 1) % HISTORY_SIZE
  if historyCount < HISTORY_SIZE then
    historyCount = historyCount + 1
  end

  -- Notify subscribers
  local subs = subscribers[channel]
  if subs then
    for i = 1, #subs do
      subs[i](event)
    end
  end
  -- Also notify wildcard subscribers
  local wild = subscribers["*"]
  if wild then
    for i = 1, #wild do
      wild[i](event)
    end
  end
end

--- Subscribe to a channel (or "*" for all)
function EventBus.subscribe(channel, callback)
  if not subscribers[channel] then
    subscribers[channel] = {}
  end
  table.insert(subscribers[channel], callback)
end

--- Query history. filter is optional: {channel=str, count=int}
function EventBus.history(filter)
  local results = {}
  local count = filter and filter.count or historyCount
  local channelFilter = filter and filter.channel

  -- Read from oldest to newest
  local start = historyCount < HISTORY_SIZE and 0 or historyHead
  local collected = 0
  for i = 0, historyCount - 1 do
    local idx = (start + i) % HISTORY_SIZE
    local evt = history[idx]
    if evt then
      if not channelFilter or evt.channel == channelFilter then
        table.insert(results, evt)
        collected = collected + 1
      end
    end
  end

  -- Trim to requested count (return most recent N)
  if count and #results > count then
    local trimmed = {}
    for i = #results - count + 1, #results do
      table.insert(trimmed, results[i])
    end
    return trimmed
  end

  return results
end

--- Get list of all channel names
function EventBus.channels()
  local names = {}
  for k in pairs(channels) do
    table.insert(names, k)
  end
  table.sort(names)
  return names
end

return EventBus
