--[[
  android_vm.lua — ADB-based Android VM control capability

  Provides Puppeteer-like control of Android VMs spawned by <Render source="*.iso" />.
  Connects via ADB over the forwarded port and exposes shell, input, and app management.

  React usage:
    const vm = useAndroidVM()
    await vm.connect(5556)
    await vm.tap(500, 300)
    await vm.type("hello")
    await vm.launch("com.android.chrome")
    await vm.install("/path/to/app.apk")
    const output = await vm.shell("getprop sys.boot_completed")
]]

local Log = require("lua.debug_log")

local rpc = {}

-- Track connected devices: { [port] = { host, port, serial } }
local devices = {}

-- ── Helpers ────────────────────────────────────────────────────────────────

local function adb(serial, ...)
  local parts = { "adb" }
  if serial then
    parts[#parts + 1] = "-s"
    parts[#parts + 1] = serial
  end
  for i = 1, select("#", ...) do
    parts[#parts + 1] = select(i, ...)
  end
  local cmd = table.concat(parts, " ")
  Log.log("adb", "exec: %s", cmd)
  local handle = io.popen(cmd .. " 2>&1")
  if not handle then
    return nil, "failed to run adb"
  end
  local output = handle:read("*a")
  local ok = handle:close()
  return output, ok and nil or "adb command failed"
end

local function getSerial(args)
  local port = args.port or 5556
  local dev = devices[port]
  if dev then return dev.serial end
  return "localhost:" .. port
end

-- ── RPC Handlers ───────────────────────────────────────────────────────────

-- Connect to VM via ADB
-- args: { port?: number, host?: string }
rpc["adb:connect"] = function(args)
  local host = args.host or "localhost"
  local port = args.port or 5556
  local serial = host .. ":" .. port

  local out, err = adb(nil, "connect", serial)
  if err then return { error = err, output = out } end

  if out and (out:match("connected") or out:match("already connected")) then
    devices[port] = { host = host, port = port, serial = serial }
    Log.log("adb", "Connected to %s", serial)
    return { ok = true, serial = serial, output = out:gsub("%s+$", "") }
  end

  return { error = "Connection failed", output = out }
end

-- Disconnect from VM
-- args: { port?: number }
rpc["adb:disconnect"] = function(args)
  local serial = getSerial(args)
  local out = adb(nil, "disconnect", serial)
  devices[args.port or 5556] = nil
  return { ok = true, output = out }
end

-- Run a shell command
-- args: { command: string, port?: number }
rpc["adb:shell"] = function(args)
  if not args.command then return { error = "command required" } end
  local serial = getSerial(args)
  -- Escape the command for shell
  local escaped = args.command:gsub("'", "'\\''")
  local out, err = adb(serial, "shell", "'" .. escaped .. "'")
  if err then return { error = err, output = out } end
  return { output = out and out:gsub("%s+$", "") or "" }
end

-- Tap at (x, y) coordinates
-- args: { x: number, y: number, port?: number }
rpc["adb:tap"] = function(args)
  if not args.x or not args.y then return { error = "x and y required" } end
  local serial = getSerial(args)
  local out, err = adb(serial, "shell", "input", "tap",
    tostring(math.floor(args.x)), tostring(math.floor(args.y)))
  if err then return { error = err } end
  return { ok = true }
end

-- Long press at (x, y)
-- args: { x: number, y: number, duration?: number, port?: number }
rpc["adb:longpress"] = function(args)
  if not args.x or not args.y then return { error = "x and y required" } end
  local serial = getSerial(args)
  local dur = args.duration or 1000
  local out, err = adb(serial, "shell", "input", "swipe",
    tostring(math.floor(args.x)), tostring(math.floor(args.y)),
    tostring(math.floor(args.x)), tostring(math.floor(args.y)),
    tostring(dur))
  if err then return { error = err } end
  return { ok = true }
end

-- Swipe from (x1,y1) to (x2,y2)
-- args: { x1, y1, x2, y2, duration?: number, port?: number }
rpc["adb:swipe"] = function(args)
  if not (args.x1 and args.y1 and args.x2 and args.y2) then
    return { error = "x1, y1, x2, y2 required" }
  end
  local serial = getSerial(args)
  local dur = args.duration or 300
  local out, err = adb(serial, "shell", "input", "swipe",
    tostring(math.floor(args.x1)), tostring(math.floor(args.y1)),
    tostring(math.floor(args.x2)), tostring(math.floor(args.y2)),
    tostring(dur))
  if err then return { error = err } end
  return { ok = true }
end

-- Type text
-- args: { text: string, port?: number }
rpc["adb:type"] = function(args)
  if not args.text then return { error = "text required" } end
  local serial = getSerial(args)
  -- Escape spaces and special chars for adb shell input text
  local escaped = args.text:gsub(" ", "%%s"):gsub("'", "\\'")
  local out, err = adb(serial, "shell", "input", "text", "'" .. escaped .. "'")
  if err then return { error = err } end
  return { ok = true }
end

-- Press a key (keycode name or number)
-- args: { key: string, port?: number }
rpc["adb:key"] = function(args)
  if not args.key then return { error = "key required" } end
  local serial = getSerial(args)
  local keycode = args.key
  -- If it's a friendly name, map to KEYCODE_
  if not keycode:match("^%d+$") and not keycode:match("^KEYCODE_") then
    keycode = "KEYCODE_" .. keycode:upper()
  end
  local out, err = adb(serial, "shell", "input", "keyevent", keycode)
  if err then return { error = err } end
  return { ok = true }
end

-- Launch an app by package/activity
-- args: { package: string, activity?: string, port?: number }
rpc["adb:launch"] = function(args)
  if not args.package then return { error = "package required" } end
  local serial = getSerial(args)
  local target = args.package
  if args.activity then
    target = target .. "/" .. args.activity
  end
  -- Use monkey to launch by package if no activity specified
  if not args.activity then
    local out, err = adb(serial, "shell", "monkey", "-p", target,
      "-c", "android.intent.category.LAUNCHER", "1")
    if err then return { error = err, output = out } end
    return { ok = true, output = out }
  else
    local out, err = adb(serial, "shell", "am", "start", "-n", target)
    if err then return { error = err, output = out } end
    return { ok = true, output = out }
  end
end

-- Install an APK
-- args: { path: string, port?: number }
rpc["adb:install"] = function(args)
  if not args.path then return { error = "path required" } end
  local serial = getSerial(args)
  local out, err = adb(serial, "install", "-r", args.path)
  if err then return { error = err, output = out } end
  if out and out:match("Success") then
    return { ok = true, output = out }
  end
  return { error = "Install failed", output = out }
end

-- Uninstall a package
-- args: { package: string, port?: number }
rpc["adb:uninstall"] = function(args)
  if not args.package then return { error = "package required" } end
  local serial = getSerial(args)
  local out, err = adb(serial, "uninstall", args.package)
  if err then return { error = err, output = out } end
  return { ok = true, output = out }
end

-- Take a screenshot and return it as a file path
-- args: { output?: string, port?: number }
rpc["adb:screenshot"] = function(args)
  local serial = getSerial(args)
  local remotePath = "/sdcard/screenshot_rjit.png"
  local localPath = args.output or "/tmp/android_screenshot.png"

  local out, err = adb(serial, "shell", "screencap", "-p", remotePath)
  if err then return { error = err, output = out } end

  out, err = adb(serial, "pull", remotePath, localPath)
  if err then return { error = err, output = out } end

  -- Cleanup remote file
  adb(serial, "shell", "rm", remotePath)

  return { ok = true, path = localPath }
end

-- Get device properties
-- args: { property?: string, port?: number }
rpc["adb:getprop"] = function(args)
  local serial = getSerial(args)
  if args.property then
    local out, err = adb(serial, "shell", "getprop", args.property)
    if err then return { error = err } end
    return { value = out and out:gsub("%s+$", "") or "" }
  else
    -- Return all properties as a table
    local out, err = adb(serial, "shell", "getprop")
    if err then return { error = err } end
    local props = {}
    for line in (out or ""):gmatch("[^\n]+") do
      local key, val = line:match("^%[(.-)%]:%s*%[(.-)%]$")
      if key then props[key] = val end
    end
    return { properties = props }
  end
end

-- List installed packages
-- args: { port?: number }
rpc["adb:packages"] = function(args)
  local serial = getSerial(args)
  local out, err = adb(serial, "shell", "pm", "list", "packages")
  if err then return { error = err } end
  local pkgs = {}
  for line in (out or ""):gmatch("[^\n]+") do
    local pkg = line:match("^package:(.+)$")
    if pkg then pkgs[#pkgs + 1] = pkg:gsub("%s+$", "") end
  end
  return { packages = pkgs }
end

-- List connected devices
rpc["adb:devices"] = function()
  local out, err = adb(nil, "devices", "-l")
  if err then return { error = err } end
  local devs = {}
  for line in (out or ""):gmatch("[^\n]+") do
    if not line:match("^List") and line:match("%S") then
      local serial, state = line:match("^(%S+)%s+(%S+)")
      if serial then
        devs[#devs + 1] = {
          serial = serial,
          state = state,
          info = line,
        }
      end
    end
  end
  return { devices = devs }
end

-- Wait for device to be booted (polls sys.boot_completed)
-- args: { port?: number, timeout?: number }
rpc["adb:wait-boot"] = function(args)
  local serial = getSerial(args)
  local timeout = args.timeout or 120
  local start = os.time()

  while os.time() - start < timeout do
    local out = adb(serial, "shell", "getprop", "sys.boot_completed")
    if out and out:gsub("%s+$", "") == "1" then
      return { ok = true, bootTime = os.time() - start }
    end
    -- Sleep 2s between checks (os.execute is blocking but this is an RPC)
    os.execute("sleep 2")
  end

  return { error = "Boot timeout after " .. timeout .. "s" }
end

-- Push a file to the device
-- args: { local: string, remote: string, port?: number }
rpc["adb:push"] = function(args)
  if not args.local or not args.remote then return { error = "local and remote paths required" } end
  local serial = getSerial(args)
  local out, err = adb(serial, "push", args["local"], args.remote)
  if err then return { error = err, output = out } end
  return { ok = true, output = out }
end

-- Pull a file from the device
-- args: { remote: string, local: string, port?: number }
rpc["adb:pull"] = function(args)
  if not args.remote or not args["local"] then return { error = "remote and local paths required" } end
  local serial = getSerial(args)
  local out, err = adb(serial, "pull", args.remote, args["local"])
  if err then return { error = err, output = out } end
  return { ok = true, output = out }
end

-- ── Register with capability system ────────────────────────────────────────

local Caps = require("lua.capabilities")
local _origGet = Caps.getHandlers
Caps.getHandlers = function()
  local h = _origGet()
  for method, fn in pairs(rpc) do h[method] = fn end
  return h
end

Log.log("adb", "Android VM capability loaded (%d RPC handlers)", 0)
-- Count handlers
local count = 0
for _ in pairs(rpc) do count = count + 1 end
Log.log("adb", "Android VM capability loaded (%d RPC handlers)", count)

return rpc
