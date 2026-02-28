--[[
  convert_script_recording.lua — Convert `script` timing+output to .rec.lua

  Usage:
    1. Record with:
       script --timing=/tmp/claude_timing.txt -q /tmp/claude_output.txt
       claude
       # ... do your session ...
       exit
       exit

    2. Convert:
       luajit tools/convert_script_recording.lua /tmp/claude_timing.txt /tmp/claude_output.txt

    Output: storybook/data/claude_session.rec.lua
]]

local timing_path = arg[1] or "/tmp/claude_timing.txt"
local output_path = arg[2] or "/tmp/claude_output.txt"
local dest_path   = arg[3] or "storybook/data/claude_session.rec.lua"

-- Read timing file: each line is "delay bytes\n"
local timing_file = io.open(timing_path, "r")
if not timing_file then
  print("ERROR: Cannot open timing file: " .. timing_path)
  print("")
  print("Record first with:")
  print("  script --timing=/tmp/claude_timing.txt -q /tmp/claude_output.txt")
  os.exit(1)
end

local timings = {}
for line in timing_file:lines() do
  local delay, bytes = line:match("^([%d%.]+)%s+(%d+)")
  if delay and bytes then
    timings[#timings + 1] = { delay = tonumber(delay), bytes = tonumber(bytes) }
  end
end
timing_file:close()

-- Read output file as raw bytes
local out_file = io.open(output_path, "rb")
if not out_file then
  print("ERROR: Cannot open output file: " .. output_path)
  os.exit(1)
end
local raw = out_file:read("*a")
out_file:close()

-- Build frames from timing + raw data
local frames = {}
local pos = 1
local t = 0

for _, entry in ipairs(timings) do
  t = t + entry.delay
  local chunk = raw:sub(pos, pos + entry.bytes - 1)
  pos = pos + entry.bytes

  if #chunk > 0 then
    -- Coalesce tiny frames within 16ms of each other
    if #frames > 0 and (t - frames[#frames].t) < 0.016 then
      frames[#frames].data = frames[#frames].data .. chunk
    else
      frames[#frames + 1] = { t = t, data = chunk }
    end
  end
end

local duration = t

-- Serialize
local function escapeStr(s)
  return string.format("%q", s)
end

local f = io.open(dest_path, "w")
if not f then
  print("ERROR: Cannot write to: " .. dest_path)
  os.exit(1)
end

f:write("-- SemanticTerminal recording: claude (" .. os.date("!%Y-%m-%dT%H:%M:%SZ") .. ")\n")
f:write(string.format("-- Duration: %.1fs, Frames: %d\n", duration, #frames))
f:write("return {\n")
f:write("  meta = {\n")
f:write('    cli = "claude",\n')
f:write("    rows = 40,\n")
f:write("    cols = 120,\n")
f:write('    recorded = "' .. os.date("!%Y-%m-%dT%H:%M:%SZ") .. '",\n')
f:write(string.format("    duration = %.6f,\n", duration))
f:write(string.format("    frameCount = %d,\n", #frames))
f:write("  },\n")
f:write("  frames = {\n")

for i, frame in ipairs(frames) do
  f:write(string.format("    { t = %.6f, data = %s },\n", frame.t, escapeStr(frame.data)))
end

f:write("  },\n")
f:write("}\n")
f:close()

print("=== Converted ===")
print("  Timing entries: " .. #timings)
print("  Frames:         " .. #frames)
print(string.format("  Duration:        %.1fs", duration))
print(string.format("  Raw size:        %.1f KB", #raw / 1024))
print("  Output:          " .. dest_path)
