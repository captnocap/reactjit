--[[
  record_session.lua — Record a CLI session for SemanticTerminal playback

  Spawns a PTY, pipes everything through the session recorder, and saves
  a .rec.lua file when the process exits.

  Usage (from monorepo root, inside Love2D):
    love tools/record_session.lua              -- records bash
    love tools/record_session.lua claude       -- records claude
    love tools/record_session.lua bash 40 120  -- custom rows/cols

  Or via luajit (if PTY FFI works outside Love):
    luajit tools/record_session.lua [command] [rows] [cols]

  Output: saves to storybook/data/<command>_session.rec.lua

  The recording is raw PTY bytes — classifier-independent. You can replay
  it through any classifier at playback time.
]]

-- Add project root to package.path so requires work
local script_dir = arg and arg[0] and arg[0]:match("(.*/)")  or "./"
local project_root = script_dir .. "../"
package.path = project_root .. "lua/?.lua;" .. project_root .. "?.lua;" .. package.path

local PTY      = require("lua.pty")
local Recorder = require("lua.session_recorder")

local command = arg and arg[1] or "bash"
local rows    = tonumber(arg and arg[2]) or 40
local cols    = tonumber(arg and arg[3]) or 120

local output_path = project_root .. "storybook/data/" .. command:gsub("[/%.%s]", "_") .. "_session.rec.lua"

print("=== SemanticTerminal Recorder ===")
print("  Command: " .. command)
print("  Size:    " .. rows .. "x" .. cols)
print("  Output:  " .. output_path)
print("  Press Ctrl+D or exit the shell to stop recording.")
print("")

-- Spawn PTY
local pty, err = PTY.open({
  shell = command,
  rows  = rows,
  cols  = cols,
})

if not pty then
  print("ERROR: Failed to open PTY: " .. tostring(err))
  os.exit(1)
end

-- Start recorder
local rec = Recorder.new({
  cli  = command,
  rows = rows,
  cols = cols,
})

-- Main loop: drain PTY, feed recorder, echo to stdout
local socket = require("socket") -- for sleep (luasocket)
local has_socket = pcall(require, "socket")

local function sleep(s)
  if love and love.timer then
    love.timer.sleep(s)
  elseif has_socket then
    socket.sleep(s)
  else
    os.execute("sleep " .. s)
  end
end

-- Forward stdin to PTY (non-blocking read from stdin is hard in plain Lua,
-- so this recorder is best used via Love2D which has the event loop)
print("[Recording... process output will appear below]")
print("")

while pty:alive() do
  local data = pty:read()
  if data and #data > 0 then
    rec:capture(data)
    io.write(data)
    io.flush()
  else
    sleep(0.016) -- ~60fps poll
  end
end

-- Save recording
local ok, save_err = rec:save(output_path)
if ok then
  print("")
  print("=== Recording saved ===")
  print("  Path:   " .. output_path)
  print("  Frames: " .. rec.meta.frameCount)
  print("  Duration: " .. string.format("%.1fs", rec.meta.duration))
else
  print("ERROR: " .. tostring(save_err))
end

pty:close()
