--[[
  commands.lua — Command dictionary + tab completion
  CartridgeOS console command system.

  Unknown input NEVER falls through to Lua.
  Lua eval requires explicit !! prefix or sticky Lua mode.
]]

local EventBus = require("eventbus")

local Commands = {}
local registry = {}  -- name -> {desc, usage, exec, complete}

--- Register a command
function Commands.register(name, def)
  registry[name] = {
    desc     = def.desc or "",
    usage    = def.usage or name,
    exec     = def.exec,
    complete = def.complete,
  }
end

--- Execute a command string. Returns {type, data} or error table.
function Commands.execute(input)
  local trimmed = input:match("^%s*(.-)%s*$")
  if trimmed == "" then return nil end

  -- Split into command + args
  local cmd, argstr = trimmed:match("^(%S+)%s*(.*)")
  cmd = cmd:lower()

  local entry = registry[cmd]
  if not entry then
    return {
      type = "error",
      data = "unknown command: " .. cmd .. "  (try `help`)",
    }
  end

  EventBus.emit("console", cmd .. " " .. argstr)
  local ok, result = pcall(entry.exec, argstr)
  if not ok then
    return {
      type = "error",
      data = "command error: " .. tostring(result),
    }
  end
  return result
end

--- Tab-complete. Returns list of candidate strings.
function Commands.complete(input)
  local trimmed = input:match("^%s*(.-)%s*$")

  -- If no space yet, complete command names
  if not trimmed:find("%s") then
    local matches = {}
    for name in pairs(registry) do
      if name:sub(1, #trimmed) == trimmed then
        table.insert(matches, name)
      end
    end
    table.sort(matches)
    return matches
  end

  -- Has a space — delegate to command's completer
  local cmd, argstr = trimmed:match("^(%S+)%s*(.*)")
  cmd = cmd:lower()
  local entry = registry[cmd]
  if entry and entry.complete then
    local ok, result = pcall(entry.complete, argstr)
    if ok and result then return result end
  end
  return {}
end

--- Get list of all command names (sorted)
function Commands.list()
  local names = {}
  for name in pairs(registry) do
    table.insert(names, name)
  end
  table.sort(names)
  return names
end

--- Get command info
function Commands.info(name)
  return registry[name]
end

-- ── Built-in commands ──────────────────────────────────────────────────────

Commands.register("help", {
  desc = "List available commands or show detail for one",
  usage = "help [command]",
  exec = function(args)
    local target = args:match("^(%S+)")
    if target then
      local info = Commands.info(target:lower())
      if info then
        return {
          type = "lines",
          data = {
            { text = info.usage,  color = {1, 1, 1} },
            { text = info.desc,   color = {0.7, 0.7, 0.8} },
          },
        }
      else
        return { type = "error", data = "unknown command: " .. target }
      end
    end

    -- List all commands
    local lines = {}
    local names = Commands.list()
    for _, name in ipairs(names) do
      local info = Commands.info(name)
      local pad = string.rep(" ", 12 - #name)
      table.insert(lines, {
        text = "  " .. name .. pad .. info.desc,
        color = {0.8, 0.8, 0.9},
      })
    end
    return { type = "lines", data = lines }
  end,
  complete = function(partial)
    local matches = {}
    for name in pairs(registry) do
      if name:sub(1, #partial) == partial then
        table.insert(matches, "help " .. name)
      end
    end
    table.sort(matches)
    return matches
  end,
})

Commands.register("clear", {
  desc = "Clear console output",
  usage = "clear",
  exec = function()
    return { type = "clear" }
  end,
})

Commands.register("files", {
  desc = "List directory contents (default: /app)",
  usage = "files [path]",
  exec = function(args)
    local path = args:match("^(%S+)") or "/app"

    -- Sanitize: strip quotes, reject shell metacharacters
    path = path:gsub('"', ''):gsub("'", '')
    if path:find("[;|&$`]") then
      return { type = "error", data = "invalid path" }
    end

    -- /app is always allowed; everything else requires filesystem capability
    local boot = CART_BOOT or {}
    if not path:match("^/app") and not (boot.has and boot.has("filesystem")) then
      return { type = "error", data = "blocked (requires filesystem): " .. path }
    end

    -- Use io.popen if available (requires process cap), otherwise error for non-/app
    local p = io.popen('ls -1p "' .. path .. '" 2>&1')
    if not p then
      return { type = "error", data = "cannot list (requires process capability): " .. path }
    end

    local lines = {}
    table.insert(lines, { text = "  " .. path .. "/", color = {0.5, 0.5, 0.7} })

    for entry in p:lines() do
      if entry == "" then goto continue end
      -- Color directories differently
      local isDir = entry:sub(-1) == "/"
      local color = isDir and {0.4, 0.7, 1.0} or {0.7, 0.8, 0.7}
      table.insert(lines, { text = "    " .. entry, color = color })
      ::continue::
    end
    p:close()

    if #lines <= 1 then
      return { type = "error", data = "empty or not found: " .. path }
    end
    return { type = "lines", data = lines }
  end,
  complete = function(partial)
    local p = io.popen and io.popen('ls -1 "/app/" 2>/dev/null')
    if not p then return {} end
    local prefix = partial:match("([^/]*)$") or ""
    local matches = {}
    for entry in p:lines() do
      if entry:sub(1, #prefix) == prefix then
        table.insert(matches, "files /app/" .. entry)
      end
    end
    p:close()
    return matches
  end,
})

Commands.register("status", {
  desc = "System status (kernel, uptime, GPU, memory)",
  usage = "status",
  exec = function()
    local boot = CART_BOOT or {}
    if not (boot.has and boot.has("sysmon")) then
      return { type = "error", data = "blocked (requires sysmon capability)" }
    end

    local lines = {}

    -- Kernel
    local vf = io.open("/proc/version", "r")
    if vf then
      local ver = vf:read("*l"):match("Linux version (%S+)") or "unknown"
      vf:close()
      table.insert(lines, { text = "  kernel   " .. ver, color = {0.7, 0.8, 1.0} })
    end

    -- Uptime
    local uf = io.open("/proc/uptime", "r")
    if uf then
      local secs = tonumber(uf:read("*l"):match("^(%S+)")) or 0
      uf:close()
      local mins = math.floor(secs / 60)
      local s = math.floor(secs % 60)
      table.insert(lines, {
        text = string.format("  uptime   %dm %ds", mins, s),
        color = {0.7, 0.8, 1.0},
      })
    end

    -- Memory
    local mf = io.open("/proc/meminfo", "r")
    if mf then
      local total, avail
      for line in mf:lines() do
        if not total then total = line:match("^MemTotal:%s+(%d+)") end
        if not avail then avail = line:match("^MemAvailable:%s+(%d+)") end
        if total and avail then break end
      end
      mf:close()
      if total and avail then
        local tMB = math.floor(tonumber(total) / 1024)
        local aMB = math.floor(tonumber(avail) / 1024)
        table.insert(lines, {
          text = string.format("  memory   %dM / %dM available", aMB, tMB),
          color = {0.7, 0.8, 1.0},
        })
      end
    end

    -- GPU (read /sys/class/drm to avoid needing process capability)
    local dri_str = "unknown"
    local df = io.open("/sys/class/drm/version", "r")
    if df then
      local ver = df:read("*l") or "?"
      df:close()
      dri_str = ver
    end
    table.insert(lines, {
      text = "  gpu      kmsdrm",
      color = {0.7, 0.8, 1.0},
    })

    return { type = "lines", data = lines }
  end,
})

Commands.register("events", {
  desc = "Show recent event history",
  usage = "events [channel] [count]",
  exec = function(args)
    local channel, countStr = args:match("^(%S+)%s*(%d*)")
    if not channel or channel == "" then channel = nil end
    local count = tonumber(countStr) or 20

    local filter = { count = count }
    if channel then filter.channel = channel end
    local evts = EventBus.history(filter)

    if #evts == 0 then
      return { type = "lines", data = {
        { text = "  no events" .. (channel and (" for channel: " .. channel) or ""), color = {0.5, 0.5, 0.5} },
      }}
    end

    local lines = {}
    for _, evt in ipairs(evts) do
      local r, g, b = EventBus.channelColor(evt.channel)
      local ts = string.format("%.1f", evt.timestamp)
      table.insert(lines, {
        text = string.format("  [%s] %s  (%ss)", evt.channel, evt.summary, ts),
        color = {r, g, b},
      })
    end
    return { type = "lines", data = lines }
  end,
  complete = function(partial)
    local matches = {}
    for _, ch in ipairs(EventBus.channels()) do
      if ch:sub(1, #partial) == partial then
        table.insert(matches, "events " .. ch)
      end
    end
    return matches
  end,
})

Commands.register("debug", {
  desc = "Toggle debug event channels",
  usage = "debug <channel> [on|off]",
  exec = function(args)
    local channel, toggle = args:match("^(%S+)%s*(%S*)")
    if not channel or channel == "" then
      -- Show current debug state
      local lines = {}
      for _, ch in ipairs(EventBus.channels()) do
        local state = EventBus.getDebug(ch) and "on" or "off"
        table.insert(lines, {
          text = "  " .. ch .. "  " .. state,
          color = EventBus.getDebug(ch) and {0.5, 1, 0.5} or {0.4, 0.4, 0.4},
        })
      end
      return { type = "lines", data = lines }
    end

    if toggle == "on" then
      EventBus.setDebug(channel, true)
    elseif toggle == "off" then
      EventBus.setDebug(channel, false)
    else
      EventBus.setDebug(channel, not EventBus.getDebug(channel))
    end

    local state = EventBus.getDebug(channel) and "on" or "off"
    return {
      type = "lines",
      data = {{ text = "  debug " .. channel .. ": " .. state, color = {0.6, 0.8, 0.6} }},
    }
  end,
  complete = function(partial)
    local matches = {}
    for _, ch in ipairs(EventBus.channels()) do
      if ch:sub(1, #partial) == partial then
        table.insert(matches, "debug " .. ch)
      end
    end
    return matches
  end,
})

Commands.register("version", {
  desc = "CartridgeOS version info",
  usage = "version",
  exec = function()
    return {
      type = "lines",
      data = {
        { text = "  CartridgeOS v0.1.0", color = {0.4, 0.3, 1.0} },
        { text = "  iLoveReact — no X11, no Wayland, no display server", color = {0.5, 0.5, 0.7} },
        { text = "  kernel -> kmsdrm -> SDL2 -> OpenGL -> LuaJIT", color = {0.4, 0.4, 0.6} },
      },
    }
  end,
})

Commands.register("theme", {
  desc = "Show/cycle console theme",
  usage = "theme",
  exec = function()
    return {
      type = "lines",
      data = {
        { text = "  current: dark (default)", color = {0.6, 0.6, 0.7} },
        { text = "  themes are coming soon", color = {0.4, 0.4, 0.5} },
      },
    }
  end,
})

Commands.register("sandbox", {
  desc = "Show sandbox state and granted capabilities",
  usage = "sandbox",
  exec = function()
    local boot = CART_BOOT or {}
    local caps = boot.caps or {}
    local lines = {}

    table.insert(lines, { text = "  Sandbox: active", color = {0.3, 0.85, 0.4} })
    table.insert(lines, { text = "  Verdict: " .. (boot.verdict or "unknown"), color = {0.6, 0.7, 0.8} })
    if boot.verdictKeyId and boot.verdictKeyId ~= "" then
      table.insert(lines, { text = "  Key ID:  " .. boot.verdictKeyId, color = {0.5, 0.5, 0.6} })
    end
    table.insert(lines, { text = "", color = {0,0,0} })

    -- List all capabilities with grant status
    local order = {"gpu","keyboard","mouse","usb","storage","network","filesystem","clipboard","process","browse","ipc","sysmon"}
    for _, cap in ipairs(order) do
      local val = caps[cap]
      local status, color
      if val and val ~= false then
        status = "granted"
        color = {0.3, 0.85, 0.4}
      else
        status = "denied"
        color = {0.5, 0.3, 0.3}
      end
      local pad = string.rep(" ", 14 - #cap)
      table.insert(lines, { text = "  " .. cap .. pad .. status, color = color })
    end

    table.insert(lines, { text = "", color = {0,0,0} })

    -- Show what's blocked
    local blocked = {}
    if not loadstring then blocked[#blocked+1] = "loadstring" end
    if not loadfile  then blocked[#blocked+1] = "loadfile" end
    if not load      then blocked[#blocked+1] = "load" end
    if not debug     then blocked[#blocked+1] = "debug" end
    if not dofile    then blocked[#blocked+1] = "dofile" end
    if #blocked > 0 then
      table.insert(lines, { text = "  Blocked globals: " .. table.concat(blocked, ", "), color = {0.6, 0.4, 0.4} })
    end

    return { type = "lines", data = lines }
  end,
})

return Commands
