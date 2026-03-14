--[[
  debug_log.lua -- Channel-based debug logging with runtime toggles

  All channels are OFF by default. Toggle at runtime via the devtools console
  (:log command) or at startup via the REACTJIT_DEBUG environment variable.

  Usage from other modules:
    local Log = require("lua.debug_log")
    Log.log("layout", "layoutNode id=%s type=%s avail=%dx%d", id, typ, w, h)

  Console commands:
    :log                Show all channels and their on/off state
    :log <channel>      Toggle a specific channel
    :log <ch> on|off    Explicit on/off
    :log all            Enable all channels
    :log none           Disable all channels
    :log ch1 ch2        Toggle multiple channels at once

  Environment variable (for startup debugging):
    REACTJIT_DEBUG=tree,layout love love
    REACTJIT_DEBUG=all love love
]]

local Log = {}

-- ============================================================================
-- Channel definitions
-- ============================================================================

Log.CHANNELS = {
  layout   = { color = {0.55, 0.85, 0.55, 1}, desc = "Flexbox layout passes" },
  tree     = { color = {0.65, 0.55, 0.90, 1}, desc = "Tree mutations (CREATE/APPEND/UPDATE/REMOVE)" },
  events   = { color = {0.38, 0.65, 0.98, 1}, desc = "Hit testing, hover, bubbling, dispatch" },
  paint    = { color = {0.90, 0.75, 0.40, 1}, desc = "Paint calls and draw operations" },
  bridge   = { color = {0.85, 0.55, 0.65, 1}, desc = "JS<>Lua bridge traffic (commands, events)" },
  recon    = { color = {0.70, 0.85, 0.55, 1}, desc = "React reconciler (createInstance, commitUpdate, flush)" },
  dispatch = { color = {0.55, 0.75, 0.90, 1}, desc = "TS event dispatcher routing" },
  focus    = { color = {0.90, 0.65, 0.55, 1}, desc = "Focus management and navigation" },
  animate  = { color = {0.75, 0.55, 0.90, 1}, desc = "Transitions and animations" },
  capsync  = { color = {0.55, 0.90, 0.75, 1}, desc = "Capability tree sync (node discovery, registry)" },
}

-- ============================================================================
-- State
-- ============================================================================

local channels = {}       -- channel_name -> true/false
local frameNum = 0        -- incremented each frame for log correlation
local consoleOutput = nil -- function(text, color) injected by console.lua

-- Initialize all channels to off
for name in pairs(Log.CHANNELS) do
  channels[name] = false
end

-- ============================================================================
-- Core API
-- ============================================================================

--- Log a message on a channel. No-op if the channel is off.
--- Uses string.format when extra args are provided.
--- @param channel string  Channel name (must exist in Log.CHANNELS)
--- @param fmt string      Format string (or plain message if no varargs)
--- @param ... any         Format arguments
function Log.log(channel, fmt, ...)
  if not channels[channel] then return end

  local msg
  if select("#", ...) > 0 then
    local ok, formatted = pcall(string.format, fmt, ...)
    msg = ok and formatted or (fmt .. " [fmt error]")
  else
    msg = fmt
  end

  local line = string.format("[F:%d %s] %s", frameNum, channel, msg)

  -- Always write to stdout
  io.write(line .. "\n")
  io.flush()

  -- Mirror to console panel if available
  if consoleOutput then
    local chDef = Log.CHANNELS[channel]
    local color = chDef and chDef.color or {0.6, 0.6, 0.6, 1}
    consoleOutput(line, color)
  end
end

--- Increment the frame counter. Call once per frame from init.lua update().
function Log.frame()
  frameNum = frameNum + 1
end

--- Get current frame number (for external callers that want to include it).
function Log.getFrame()
  return frameNum
end

--- Enable a channel.
function Log.on(channel)
  if Log.CHANNELS[channel] then
    channels[channel] = true
  end
end

--- Disable a channel.
function Log.off(channel)
  if Log.CHANNELS[channel] then
    channels[channel] = false
  end
end

--- Toggle a channel. Returns the new state.
function Log.toggle(channel)
  if Log.CHANNELS[channel] then
    channels[channel] = not channels[channel]
    return channels[channel]
  end
  return nil
end

--- Enable or disable all channels.
function Log.all(enable)
  for name in pairs(Log.CHANNELS) do
    channels[name] = enable
  end
end

--- Check if a channel is on.
function Log.isOn(channel)
  return channels[channel] == true
end

--- Get a snapshot of all channel states. Returns { name = true/false, ... }.
function Log.getStates()
  local states = {}
  for name in pairs(Log.CHANNELS) do
    states[name] = channels[name] == true
  end
  return states
end

--- Inject the console panel output function.
--- Called by console.lua during init to wire up panel mirroring.
--- @param fn function(text: string, color: table)
function Log.setConsoleOutput(fn)
  consoleOutput = fn
end

-- ============================================================================
-- Environment variable bootstrap
-- ============================================================================

local envDebug = os.getenv("REACTJIT_DEBUG")
if envDebug and envDebug ~= "" then
  if envDebug == "all" then
    Log.all(true)
    io.write("[debug_log] All channels enabled via REACTJIT_DEBUG=all\n"); io.flush()
  else
    local enabled = {}
    for name in envDebug:gmatch("[^,]+") do
      name = name:match("^%s*(.-)%s*$") -- trim whitespace
      if Log.CHANNELS[name] then
        channels[name] = true
        enabled[#enabled + 1] = name
      end
    end
    if #enabled > 0 then
      io.write("[debug_log] Channels enabled via REACTJIT_DEBUG: " .. table.concat(enabled, ", ") .. "\n"); io.flush()
    end
  end
end

return Log
