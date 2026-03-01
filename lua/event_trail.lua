--[[
  event_trail.lua — Ring buffer of recent Love2D events

  Records the last N events with timestamps for crash diagnostics.
  When a crash occurs, the trail is frozen (no new events) so the
  crash report shows exactly what happened leading up to the error.

  Usage:
    local trail = require("lua.event_trail")
    trail.record("mousemoved", "412, 300")
    trail.record("keypressed", "f12")
    -- On crash:
    trail.freeze()
    local events = trail.getTrail()
    local text = trail.format()
]]

local Trail = {}

local MAX_EVENTS = 50
local buffer = {}
local frozen = false
local startTime = nil

--- Record an event into the trail.
--- @param eventType string  The Love2D callback name (e.g. "mousemoved")
--- @param argsStr string    Stringified arguments (e.g. "412, 300")
function Trail.record(eventType, argsStr)
  if frozen then return end
  if not startTime then startTime = love.timer.getTime() end

  -- Rolling buffer: remove oldest when full
  if #buffer >= MAX_EVENTS then
    table.remove(buffer, 1)
  end

  buffer[#buffer + 1] = {
    type = eventType,
    args = argsStr or "",
    time = love.timer.getTime() - startTime,
  }
end

--- Freeze the trail — no new events will be recorded.
--- Call this when a crash occurs so the trail stays intact.
function Trail.freeze()
  frozen = true
end

--- Unfreeze the trail (e.g. after recovery/reload).
function Trail.unfreeze()
  frozen = false
end

--- Clear the trail and unfreeze.
function Trail.clear()
  buffer = {}
  frozen = false
end

--- Get the raw trail buffer (array of {type, args, time}).
--- Most recent event is last.
function Trail.getTrail()
  return buffer
end

--- Format the trail as a human-readable string for clipboard/display.
--- Shows most recent events first (reverse chronological).
--- @param limit number|nil  Max events to include (default 30)
function Trail.format(limit)
  limit = limit or 30
  local lines = {}
  local start = math.max(1, #buffer - limit + 1)

  lines[#lines + 1] = "EVENT TRAIL (" .. #buffer .. " events, last " .. math.min(limit, #buffer) .. " shown)"
  lines[#lines + 1] = string.rep("-", 60)

  for i = #buffer, start, -1 do
    local e = buffer[i]
    local timeStr = string.format("%8.3fs", e.time)
    local argsPart = e.args ~= "" and ("  " .. e.args) or ""
    lines[#lines + 1] = timeStr .. "  " .. e.type .. argsPart
  end

  return table.concat(lines, "\n")
end

return Trail
