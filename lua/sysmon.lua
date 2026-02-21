--[[
  sysmon.lua — System monitoring module for iLoveReact.

  Gathers real-time system data from /proc, /sys, and standard tools.
  Maintains state between calls for delta-based metrics (CPU %, network rates, disk rates).
  All functions are safe — return sensible defaults if a source is unavailable.
]]

local sysmon = {}

-- ── State for delta-based metrics ───────────────────────────

local prevCpuStats = nil    -- previous /proc/stat readings
local prevCpuTime  = 0      -- os.clock() at last reading
local prevNetStats = nil    -- previous /proc/net/dev readings
local prevNetTime  = 0
local prevDiskStats = nil   -- previous /proc/diskstats readings
local prevDiskTime  = 0

-- ── Helpers ─────────────────────────────────────────────────

local function readFile(path)
  local f = io.open(path)
  if not f then return nil end
  local content = f:read("*a")
  f:close()
  return content
end

local function exec(cmd)
  local h = io.popen(cmd .. " 2>/dev/null")
  if not h then return nil end
  local out = h:read("*a")
  h:close()
  return out
end

local function execLine(cmd)
  local h = io.popen(cmd .. " 2>/dev/null")
  if not h then return nil end
  local out = h:read("*l")
  h:close()
  return out
end

local function split(str, sep)
  local parts = {}
  for part in str:gmatch("[^" .. sep .. "]+") do
    parts[#parts + 1] = part
  end
  return parts
end

local function trim(s)
  return s:match("^%s*(.-)%s*$")
end

-- ── CPU usage (delta-based) ─────────────────────────────────

local function parseProcStat()
  local content = readFile("/proc/stat")
  if not content then return nil end
  local cores = {}
  for line in content:gmatch("[^\n]+") do
    local name, user, nice, system, idle, iowait, irq, softirq, steal =
      line:match("^(cpu%d*)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)")
    if name then
      user    = tonumber(user)
      nice    = tonumber(nice)
      system  = tonumber(system)
      idle    = tonumber(idle)
      iowait  = tonumber(iowait)
      irq     = tonumber(irq)
      softirq = tonumber(softirq)
      steal   = tonumber(steal)
      local total = user + nice + system + idle + iowait + irq + softirq + steal
      local busy  = total - idle - iowait
      cores[#cores + 1] = {
        name  = name,
        total = total,
        busy  = busy,
        user  = user,
        nice  = nice,
        system = system,
        idle  = idle,
        iowait = iowait,
        irq   = irq,
        softirq = softirq,
        steal = steal,
      }
    end
  end
  return cores
end

function sysmon.cpu()
  local now = parseProcStat()
  if not now then
    return { cores = {}, total = 0, loadAvg = { 0, 0, 0 } }
  end

  local cores = {}
  if prevCpuStats and #prevCpuStats == #now then
    for i, cur in ipairs(now) do
      local prev = prevCpuStats[i]
      local totalDelta = cur.total - prev.total
      local busyDelta  = cur.busy  - prev.busy
      local pct = 0
      if totalDelta > 0 then
        pct = (busyDelta / totalDelta) * 100
      end
      -- skip the aggregate "cpu" line (index 1), only include per-core
      if i > 1 then
        cores[#cores + 1] = {
          id      = i - 2,  -- 0-indexed core ID
          usage   = math.floor(pct * 10 + 0.5) / 10,
          user    = math.floor(((cur.user - prev.user) / (totalDelta > 0 and totalDelta or 1)) * 1000 + 0.5) / 10,
          system  = math.floor(((cur.system - prev.system) / (totalDelta > 0 and totalDelta or 1)) * 1000 + 0.5) / 10,
          iowait  = math.floor(((cur.iowait - prev.iowait) / (totalDelta > 0 and totalDelta or 1)) * 1000 + 0.5) / 10,
        }
      end
    end
  else
    -- First call — no delta available, return zeros
    for i = 2, #now do
      cores[#cores + 1] = { id = i - 2, usage = 0, user = 0, system = 0, iowait = 0 }
    end
  end
  prevCpuStats = now

  -- Aggregate total from first "cpu" line
  local total = 0
  if prevCpuStats and #now >= 1 and prevCpuStats then
    -- Use computed core averages
    local sum = 0
    for _, c in ipairs(cores) do sum = sum + c.usage end
    if #cores > 0 then total = math.floor((sum / #cores) * 10 + 0.5) / 10 end
  end

  -- Load average
  local loadAvg = { 0, 0, 0 }
  local lavg = readFile("/proc/loadavg")
  if lavg then
    local a, b, c = lavg:match("^(%S+)%s+(%S+)%s+(%S+)")
    loadAvg = { tonumber(a) or 0, tonumber(b) or 0, tonumber(c) or 0 }
  end

  return {
    cores   = cores,
    total   = total,
    loadAvg = loadAvg,
  }
end

-- ── Memory (detailed breakdown) ─────────────────────────────

function sysmon.memory()
  local content = readFile("/proc/meminfo")
  if not content then
    return { total = 0, used = 0, free = 0, available = 0, buffers = 0, cached = 0, swap = { total = 0, used = 0 }, unit = "GiB" }
  end

  local function getKB(key)
    return tonumber(content:match(key .. ":%s*(%d+)")) or 0
  end

  local totalKB     = getKB("MemTotal")
  local freeKB      = getKB("MemFree")
  local availableKB = getKB("MemAvailable")
  local buffersKB   = getKB("Buffers")
  local cachedKB    = getKB("Cached")
  local swapTotalKB = getKB("SwapTotal")
  local swapFreeKB  = getKB("SwapFree")

  local toGiB = 1 / (1024 * 1024)

  return {
    total     = math.floor(totalKB * toGiB * 100 + 0.5) / 100,
    used      = math.floor((totalKB - availableKB) * toGiB * 100 + 0.5) / 100,
    free      = math.floor(freeKB * toGiB * 100 + 0.5) / 100,
    available = math.floor(availableKB * toGiB * 100 + 0.5) / 100,
    buffers   = math.floor(buffersKB * toGiB * 100 + 0.5) / 100,
    cached    = math.floor(cachedKB * toGiB * 100 + 0.5) / 100,
    swap      = {
      total = math.floor(swapTotalKB * toGiB * 100 + 0.5) / 100,
      used  = math.floor((swapTotalKB - swapFreeKB) * toGiB * 100 + 0.5) / 100,
    },
    unit = "GiB",
  }
end

-- ── Processes ───────────────────────────────────────────────

function sysmon.processes(limit)
  limit = limit or 20
  local out = exec("ps aux --sort=-pcpu")
  if not out then return {} end

  local procs = {}
  local lineNum = 0
  for line in out:gmatch("[^\n]+") do
    lineNum = lineNum + 1
    if lineNum > 1 and #procs < limit then  -- skip header
      local parts = split(line, "%s")
      if #parts >= 11 then
        local cmd = table.concat(parts, " ", 11)
        procs[#procs + 1] = {
          user    = parts[1],
          pid     = tonumber(parts[2]) or 0,
          cpu     = tonumber(parts[3]) or 0,
          mem     = tonumber(parts[4]) or 0,
          vsz     = tonumber(parts[5]) or 0,
          rss     = tonumber(parts[6]) or 0,
          tty     = parts[7],
          stat    = parts[8],
          command = cmd,
        }
      end
    end
  end
  return procs
end

-- ── Task counts ─────────────────────────────────────────────

function sysmon.tasks()
  local content = readFile("/proc/stat")
  if not content then
    return { total = 0, running = 0, sleeping = 0, stopped = 0, zombie = 0 }
  end

  local running = tonumber(content:match("procs_running%s+(%d+)")) or 0
  local blocked = tonumber(content:match("procs_blocked%s+(%d+)")) or 0

  -- Get detailed counts from /proc
  local total, sleeping, stopped, zombie = 0, 0, 0, 0
  local out = exec("ps ax -o stat --no-header")
  if out then
    for line in out:gmatch("[^\n]+") do
      total = total + 1
      local s = trim(line):sub(1, 1)
      if s == "S" or s == "I" or s == "D" then sleeping = sleeping + 1
      elseif s == "T" or s == "t" then stopped = stopped + 1
      elseif s == "Z" then zombie = zombie + 1
      end
    end
  end

  return {
    total    = total,
    running  = running,
    sleeping = sleeping,
    stopped  = stopped,
    zombie   = zombie,
  }
end

-- ── GPU (NVIDIA via nvidia-smi, AMD via sysfs) ─────────────

function sysmon.gpu()
  local allGpus = {}

  -- Collect NVIDIA GPUs via nvidia-smi
  local nv = exec("nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,name --format=csv,noheader,nounits")
  if nv and nv ~= "" then
    for line in nv:gmatch("[^\n]+") do
      line = trim(line)
      if line ~= "" then
        local parts = split(line, ",")
        if #parts >= 6 then
          allGpus[#allGpus + 1] = {
            name        = trim(parts[6]),
            vendor      = "nvidia",
            utilization = tonumber(trim(parts[1])) or 0,
            memUsed     = tonumber(trim(parts[2])) or 0,
            memTotal    = tonumber(trim(parts[3])) or 0,
            memUnit     = "MiB",
            temperature = tonumber(trim(parts[4])) or 0,
            power       = tonumber(trim(parts[5])) or 0,
          }
        end
      end
    end
  end

  -- Scan sysfs for AMD and Intel GPUs
  for i = 0, 7 do
    local base = "/sys/class/drm/card" .. i .. "/device"
    local vendor = readFile(base .. "/vendor")
    if vendor then
      vendor = trim(vendor)
      if vendor == "0x1002" then
        -- AMD
        local busy = readFile(base .. "/gpu_busy_percent")
        if busy then
          local name = readFile(base .. "/product_name") or "AMD GPU"
          local temp = readFile(base .. "/hwmon/hwmon0/temp1_input")
          local tempC = temp and (tonumber(trim(temp)) or 0) / 1000 or 0
          local memUsed = readFile(base .. "/mem_info_vram_used")
          local memTotal = readFile(base .. "/mem_info_vram_total")
          allGpus[#allGpus + 1] = {
            name        = trim(name),
            vendor      = "amd",
            utilization = tonumber(trim(busy)) or 0,
            memUsed     = memUsed and math.floor((tonumber(trim(memUsed)) or 0) / (1024*1024)) or 0,
            memTotal    = memTotal and math.floor((tonumber(trim(memTotal)) or 0) / (1024*1024)) or 0,
            memUnit     = "MiB",
            temperature = math.floor(tempC * 10 + 0.5) / 10,
            power       = 0,
          }
        end
      elseif vendor == "0x8086" then
        -- Intel integrated
        local name = readFile(base .. "/product_name") or "Intel Graphics"
        -- find hwmon for temp
        local tempC = 0
        for h = 0, 4 do
          local t = readFile(base .. "/hwmon/hwmon" .. h .. "/temp1_input")
          if t then tempC = (tonumber(trim(t)) or 0) / 1000; break end
        end
        -- utilization via gt_act_freq_mhz / gt_max_freq_mhz as a rough proxy
        local actFreq  = readFile(base .. "/drm/card" .. i .. "/gt_act_freq_mhz") or
                         readFile("/sys/class/drm/card" .. i .. "/gt_act_freq_mhz")
        local maxFreq  = readFile(base .. "/drm/card" .. i .. "/gt_max_freq_mhz") or
                         readFile("/sys/class/drm/card" .. i .. "/gt_max_freq_mhz")
        local util = 0
        if actFreq and maxFreq then
          local a = tonumber(trim(actFreq)) or 0
          local m = tonumber(trim(maxFreq)) or 1
          util = m > 0 and math.floor(a / m * 100) or 0
        end
        allGpus[#allGpus + 1] = {
          name        = trim(name),
          vendor      = "intel",
          utilization = util,
          memUsed     = 0,
          memTotal    = 0,
          memUnit     = "MiB",
          temperature = math.floor(tempC * 10 + 0.5) / 10,
          power       = 0,
        }
      end
    end
  end

  return #allGpus > 0 and allGpus or nil
end

-- ── Network I/O (delta-based rates) ─────────────────────────

local function parseNetDev()
  local content = readFile("/proc/net/dev")
  if not content then return nil end
  local ifaces = {}
  for line in content:gmatch("[^\n]+") do
    local name, rxBytes, _, _, _, _, _, _, _, txBytes = line:match(
      "^%s*(%S+):%s*(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)"
    )
    if name and name ~= "lo" then
      ifaces[name] = {
        rxBytes = tonumber(rxBytes) or 0,
        txBytes = tonumber(txBytes) or 0,
      }
    end
  end
  return ifaces
end

function sysmon.network()
  local now = parseNetDev()
  local nowTime = os.clock()
  if not now then return {} end

  local result = {}
  local dt = nowTime - prevNetTime
  if dt <= 0 then dt = 1 end

  for name, cur in pairs(now) do
    local rxRate, txRate = 0, 0
    if prevNetStats and prevNetStats[name] then
      local prev = prevNetStats[name]
      rxRate = (cur.rxBytes - prev.rxBytes) / dt
      txRate = (cur.txBytes - prev.txBytes) / dt
    end
    result[#result + 1] = {
      name     = name,
      rxBytes  = cur.rxBytes,
      txBytes  = cur.txBytes,
      rxRate   = math.floor(rxRate + 0.5),      -- bytes/sec
      txRate   = math.floor(txRate + 0.5),
    }
  end
  prevNetStats = now
  prevNetTime  = nowTime

  -- Sort by name for stable ordering
  table.sort(result, function(a, b) return a.name < b.name end)
  return result
end

-- ── Disk I/O (delta-based rates) ────────────────────────────

local function parseDiskStats()
  local content = readFile("/proc/diskstats")
  if not content then return nil end
  local devs = {}
  for line in content:gmatch("[^\n]+") do
    local name, readsCompleted, _, sectorsRead, _, writesCompleted, _, sectorsWritten =
      line:match("^%s*%d+%s+%d+%s+(%S+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)%s+(%d+)")
    if name then
      -- Skip partitions (only keep whole disks like sda, nvme0n1, etc.)
      -- Include if it has no trailing digit, or if it's nvme*n* pattern
      local isWhole = not name:match("%d$") or name:match("^nvme%d+n%d+$") or name:match("^dm%-")
      if isWhole then
        devs[name] = {
          reads  = tonumber(readsCompleted) or 0,
          writes = tonumber(writesCompleted) or 0,
          sectorsRead    = tonumber(sectorsRead) or 0,
          sectorsWritten = tonumber(sectorsWritten) or 0,
        }
      end
    end
  end
  return devs
end

function sysmon.disk()
  local now = parseDiskStats()
  local nowTime = os.clock()
  if not now then return {} end

  local result = {}
  local dt = nowTime - prevDiskTime
  if dt <= 0 then dt = 1 end

  for name, cur in pairs(now) do
    local readRate, writeRate = 0, 0
    if prevDiskStats and prevDiskStats[name] then
      local prev = prevDiskStats[name]
      -- sectors are 512 bytes
      readRate  = ((cur.sectorsRead - prev.sectorsRead) * 512) / dt
      writeRate = ((cur.sectorsWritten - prev.sectorsWritten) * 512) / dt
    end
    result[#result + 1] = {
      name      = name,
      readRate  = math.floor(readRate + 0.5),    -- bytes/sec
      writeRate = math.floor(writeRate + 0.5),
      reads     = cur.reads,
      writes    = cur.writes,
    }
  end
  prevDiskStats = now
  prevDiskTime  = nowTime

  table.sort(result, function(a, b) return a.name < b.name end)
  return result
end

-- ── Ports ───────────────────────────────────────────────────

function sysmon.ports()
  local out = exec("ss -tlnp")
  if not out then return {} end

  local ports = {}
  local lineNum = 0
  for line in out:gmatch("[^\n]+") do
    lineNum = lineNum + 1
    if lineNum > 1 then  -- skip header
      local state, recvq, sendq, local_addr, peer_addr =
        line:match("^(%S+)%s+(%S+)%s+(%S+)%s+(%S+)%s+(%S+)")
      if local_addr then
        local host, port = local_addr:match("^(.+):(%d+)$")
        if not port then
          host, port = local_addr:match("^%[(.+)%]:(%d+)$")
        end
        port = tonumber(port) or 0

        -- Extract PID and process name from users:(("name",pid=123,fd=4))
        local processName, pid = line:match('"([^"]+)",pid=(%d+)')
        pid = tonumber(pid) or 0

        ports[#ports + 1] = {
          port     = port,
          host     = host or "0.0.0.0",
          pid      = pid,
          process  = processName or "",
          protocol = "tcp",
          state    = state or "",
        }
      end
    end
  end

  -- Also check UDP
  local udpOut = exec("ss -ulnp")
  if udpOut then
    lineNum = 0
    for line in udpOut:gmatch("[^\n]+") do
      lineNum = lineNum + 1
      if lineNum > 1 then
        local state, recvq, sendq, local_addr, peer_addr =
          line:match("^(%S+)%s+(%S+)%s+(%S+)%s+(%S+)%s+(%S+)")
        if local_addr then
          local host, port = local_addr:match("^(.+):(%d+)$")
          if not port then
            host, port = local_addr:match("^%[(.+)%]:(%d+)$")
          end
          port = tonumber(port) or 0
          local processName, pid = line:match('"([^"]+)",pid=(%d+)')
          pid = tonumber(pid) or 0

          ports[#ports + 1] = {
            port     = port,
            host     = host or "0.0.0.0",
            pid      = pid,
            process  = processName or "",
            protocol = "udp",
            state    = state or "",
          }
        end
      end
    end
  end

  -- Sort by port number
  table.sort(ports, function(a, b) return a.port < b.port end)
  return ports
end

-- ── Kill process ────────────────────────────────────────────

function sysmon.kill(pid, signal)
  signal = signal or "TERM"
  pid = tonumber(pid)
  if not pid or pid <= 0 then return false end
  local ok = os.execute("kill -" .. signal .. " " .. pid)
  return ok == true or ok == 0
end

-- ── Static system identity ──────────────────────────────────

function sysmon.info()
  local info = {}

  info.user = os.getenv("USER") or os.getenv("USERNAME") or "unknown"
  info.hostname = execLine("hostname") or "unknown"

  local rf = io.open("/etc/os-release")
  if rf then
    local content = rf:read("*a"); rf:close()
    info.os = content:match('PRETTY_NAME="(.-)"') or "Linux"
  else
    info.os = "Unknown OS"
  end

  info.kernel = execLine("uname -r") or "unknown"

  local sh = os.getenv("SHELL") or "unknown"
  info.shell = sh:match("([^/]+)$") or sh

  local cf = io.open("/proc/cpuinfo")
  if cf then
    local cpuinfo = cf:read("*a"); cf:close()
    local model = cpuinfo:match("model name%s*:%s*(.-)\n") or "unknown"
    model = model:gsub("%s+", " "):gsub("%(R%)", ""):gsub("%(TM%)", "")
    local cores = 0
    for _ in cpuinfo:gmatch("processor%s*:") do cores = cores + 1 end
    info.cpu = model .. " (" .. cores .. " cores)"
  else
    info.cpu = "unknown"
  end

  info.arch = execLine("uname -m") or "unknown"

  -- Memory (structured)
  local mf = io.open("/proc/meminfo")
  if mf then
    local meminfo = mf:read("*a"); mf:close()
    local totalKB     = tonumber(meminfo:match("MemTotal:%s*(%d+)")) or 0
    local availableKB = tonumber(meminfo:match("MemAvailable:%s*(%d+)")) or 0
    local usedKB = totalKB - availableKB
    info.memory = {
      used  = usedKB / (1024 * 1024),
      total = totalKB / (1024 * 1024),
      unit  = "GiB",
    }
  else
    info.memory = { used = 0, total = 0, unit = "GiB" }
  end

  -- Uptime (structured)
  local uf = io.open("/proc/uptime")
  if uf then
    local content = uf:read("*a"); uf:close()
    local secs = tonumber(content:match("^(%S+)")) or 0
    info.uptime = {
      days    = math.floor(secs / 86400),
      hours   = math.floor((secs % 86400) / 3600),
      minutes = math.floor((secs % 3600) / 60),
    }
  else
    info.uptime = { days = 0, hours = 0, minutes = 0 }
  end

  return info
end

-- ── Combined monitor (single RPC for everything) ────────────

function sysmon.monitor(opts)
  opts = opts or {}
  local result = {}
  result.cpu       = sysmon.cpu()
  result.memory    = sysmon.memory()
  result.tasks     = sysmon.tasks()
  result.processes = sysmon.processes(opts.processLimit or 20)
  result.gpu       = sysmon.gpu()
  result.network   = sysmon.network()
  result.disk      = sysmon.disk()
  return result
end

-- ── SysLog (append structured data to file) ─────────────────

function sysmon.syslog(path, data)
  local f = io.open(path, "a")
  if not f then return false end
  f:write(data .. "\n")
  f:close()
  return true
end

-- ── RPC handler registry ────────────────────────────────────

function sysmon.getHandlers()
  return {
    ["sys:info"]      = function()     return sysmon.info() end,
    ["sys:monitor"]   = function(args) return sysmon.monitor(args) end,
    ["sys:cpu"]       = function()     return sysmon.cpu() end,
    ["sys:memory"]    = function()     return sysmon.memory() end,
    ["sys:processes"] = function(args) return sysmon.processes(args and args.limit or 20) end,
    ["sys:tasks"]     = function()     return sysmon.tasks() end,
    ["sys:gpu"]       = function()     return sysmon.gpu() end,
    ["sys:network"]   = function()     return sysmon.network() end,
    ["sys:disk"]      = function()     return sysmon.disk() end,
    ["sys:ports"]     = function()     return sysmon.ports() end,
    ["sys:kill"]      = function(args) return sysmon.kill(args.pid, args.signal) end,
    ["sys:log"]       = function(args) return sysmon.syslog(args.path, args.data) end,
  }
end

return sysmon
