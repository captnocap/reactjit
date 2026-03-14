--[[
  capabilities/game_server.lua — Declarative game server hosting

  Manages the full lifecycle of a game server process:
  1. Config resolution (JSON file path or inline table from React)
  2. Config file generation (server.properties / server.cfg / autoexec.cfg)
  3. Process spawning (java -jar / srcds_run / hlds_run / cs2)
  4. RCON connection for remote admin
  5. Source Query Protocol for live status polling
  6. Stdout log parsing for player join/leave/chat events

  Valve engine generations:
    GoldSrc (gen 1): HL1, CS 1.6, TFC, DoD          — hlds_run, RCON (legacy), A2S query
    Source  (gen 2): CS:S, TF2, GMod, L4D2, HL2:DM   — srcds_run, RCON v2, A2S query
    Source2 (gen 3): CS2, Deadlock                    — cs2 binary, RCON v2, A2S query

  React usage:
    <GameServer type="source" config={{ port: 27015, game: "cstrike", map: "de_dust2" }} />
    <GameServer type="source2" config={{ port: 27015, game: "cs2", map: "de_dust2" }} />
    <GameServer type="goldsrc" config={{ port: 27015, game: "cstrike", map: "de_dust2" }} />
    <GameServer type="minecraft" config={{ port: 25565, maxPlayers: 20, difficulty: "normal" }} />

  RPC:
    gameserver:status    → { state, status: { online, name, map, players, maxPlayers, ... } }
    gameserver:players   → { players: [ { id, name, score, duration } ], maxPlayers }
    gameserver:logs      → { logs: [ { timestamp, level, message } ] }
    gameserver:rcon      → { response } (send an RCON command)
    gameserver:control   → { ok } (start, stop, restart, clear_logs)
]]

local Capabilities = require("lua.capabilities")
local _M = {}

-- Lazy-load submodules (they may not exist yet during development)
local RCON, SourceQuery, Config, Installer

local function ensureModules()
  if not RCON then
    local ok1, m1 = pcall(require, "lua.capabilities.game_server.rcon")
    if ok1 then RCON = m1 end
  end
  if not SourceQuery then
    local ok2, m2 = pcall(require, "lua.capabilities.game_server.source_query")
    if ok2 then SourceQuery = m2 end
  end
  if not Config then
    local ok3, m3 = pcall(require, "lua.capabilities.game_server.config")
    if ok3 then Config = m3 end
  end
  if not Installer then
    local ok4, m4 = pcall(require, "lua.capabilities.game_server.installer")
    if ok4 then Installer = m4 end
  end
end

-- ── Constants ───────────────────────────────────────────────────────────────

local MAX_LOGS = 1000
local QUERY_INTERVAL = 2.0   -- seconds between Source Query polls
local RCON_RETRY_INTERVAL = 5.0  -- seconds between RCON reconnect attempts

-- Default ports by engine type
local DEFAULT_PORTS = {
  goldsrc   = 27015,
  source    = 27015,
  source2   = 27015,
  minecraft = 25565,
}

local DEFAULT_RCON_PORTS = {
  goldsrc   = 27015,  -- same as game port
  source    = 27015,  -- same as game port
  source2   = 27015,  -- same as game port
  minecraft = 25575,  -- separate RCON port
}

-- ── Process management helpers ──────────────────────────────────────────────

local function buildCommand(serverType, config)
  if serverType == "minecraft" then
    local java = config.javaPath or "java"
    local mem = config.memory or "2G"
    local jar = config.jar or "server.jar"
    return string.format('%s -Xmx%s -Xms%s -jar %s nogui', java, mem, mem, jar)

  elseif serverType == "goldsrc" then
    local binary = config.serverPath or "./hlds_run"
    local game = config.game or "cstrike"
    local port = config.port or DEFAULT_PORTS.goldsrc
    local maxp = config.maxPlayers or 16
    local map = config.map or "de_dust2"
    local rconPw = config.rconPassword or ""
    return string.format('%s -game %s -port %d -maxplayers %d +map %s +rcon_password "%s" -console',
      binary, game, port, maxp, map, rconPw)

  elseif serverType == "source" then
    local binary = config.serverPath or "./srcds_run"
    local game = config.game or "cstrike"
    local port = config.port or DEFAULT_PORTS.source
    local maxp = config.maxPlayers or 24
    local map = config.map or "de_dust2"
    local tickrate = config.tickrate or 64
    local rconPw = config.rconPassword or ""
    local rconPart = rconPw ~= "" and string.format(' +rcon_password "%s"', rconPw) or ""
    return string.format('%s -game %s -console -usercon +ip 0.0.0.0 +port %d +maxplayers %d +map %s -tickrate %d +log on +sv_logfile 1 +sv_log_onefile 1 +sv_logecho 1 +mp_logdetail 3%s',
      binary, game, port, maxp, map, tickrate, rconPart)

  elseif serverType == "source2" then
    local binary = config.serverPath or "./cs2"
    local game = config.game or "cs2"
    local port = config.port or DEFAULT_PORTS.source2
    local maxp = config.maxPlayers or 24
    local map = config.map or "de_dust2"
    local tickrate = config.tickrate or 128
    local rconPw = config.rconPassword or ""
    local rconPart = rconPw ~= "" and string.format(' +rcon_password "%s"', rconPw) or ""
    return string.format('%s -dedicated -console -usercon +ip 0.0.0.0 +port %d +maxplayers %d +map %s -tickrate %d%s',
      binary, port, maxp, map, tickrate, rconPart)
  end

  return nil
end

-- ── Log parser patterns ─────────────────────────────────────────────────────

-- Source/GoldSrc/Source2 log patterns
local SOURCE_PLAYER_JOIN   = '"([^"]+)<(%d+)><([^>]+)><([^>]*)>" entered the game'
local SOURCE_PLAYER_LEAVE  = '"([^"]+)<(%d+)><([^>]+)><([^>]*)>" disconnected'
local SOURCE_PLAYER_SAY    = '"([^"]+)<(%d+)><([^>]+)><([^>]*)>" say "([^"]*)"'
local SOURCE_MAP_CHANGE    = 'Loading map "([^"]+)"'

-- Minecraft log patterns
local MC_PLAYER_JOIN   = '%[.-%]: ([%w_]+) joined the game'
local MC_PLAYER_LEAVE  = '%[.-%]: ([%w_]+) left the game'
local MC_PLAYER_SAY    = '%[.-%]: <([%w_]+)> (.+)'
local MC_SERVER_READY  = '%[.-%]: Done %('

local function parseLine(serverType, line)
  if serverType == "minecraft" then
    local name = line:match(MC_PLAYER_JOIN)
    if name then return "player_join", { player = name } end

    name = line:match(MC_PLAYER_LEAVE)
    if name then return "player_leave", { player = name } end

    local speaker, msg = line:match(MC_PLAYER_SAY)
    if speaker then return "player_message", { player = speaker, message = msg } end

    if line:match(MC_SERVER_READY) then return "server_ready", {} end

  else
    -- GoldSrc / Source / Source2 share similar log formats
    local name = line:match(SOURCE_PLAYER_JOIN)
    if name then return "player_join", { player = name } end

    name = line:match(SOURCE_PLAYER_LEAVE)
    if name then return "player_leave", { player = name } end

    local speaker, _, _, _, msg = line:match(SOURCE_PLAYER_SAY)
    if speaker then return "player_message", { player = speaker, message = msg } end

    local map = line:match(SOURCE_MAP_CHANGE)
    if map then return "map_change", { map = map } end
  end

  return nil, nil
end

-- ── Singleton state (one server at a time) ──────────────────────────────────

local _state = {
  serverState = "stopped",  -- stopped | starting | running | stopping | error
  serverType  = nil,
  config      = nil,
  process     = nil,         -- io.popen handle or pid
  processCmd  = nil,
  rcon        = nil,         -- RCON client instance
  query       = nil,         -- SourceQuery client instance
  status      = nil,         -- last polled ServerStatus
  players     = {},          -- last polled player list
  logs        = {},          -- circular log buffer
  logReadBuf  = "",          -- partial line buffer from stdout
  lastQueryTime = 0,
  lastRconRetry = 0,
  rconConnected = false,
  nodeId      = nil,
}

local function addLog(level, message)
  local entry = {
    timestamp = os.time() * 1000,
    level = level,
    message = message,
  }
  table.insert(_state.logs, 1, entry)
  -- Trim to MAX_LOGS
  while #_state.logs > MAX_LOGS do
    table.remove(_state.logs)
  end
end

local function stopServer()
  if _state.serverState == "stopped" then return end
  _state.serverState = "stopping"
  addLog("info", "Stopping server...")

  -- Send quit via RCON if connected
  if _state.rcon and _state.rconConnected then
    pcall(function()
      if _state.serverType == "minecraft" then
        _state.rcon:command("stop")
      else
        _state.rcon:command("quit")
      end
    end)
  end

  -- Close RCON
  if _state.rcon then
    pcall(function() _state.rcon:close() end)
    _state.rcon = nil
    _state.rconConnected = false
  end

  -- Close query
  if _state.query then
    pcall(function() _state.query:close() end)
    _state.query = nil
  end

  -- Kill background server process by binary name (robust across restarts)
  local binaries = { goldsrc = "hlds_linux", source = "srcds_linux", source2 = "cs2", minecraft = "java" }
  local binName = binaries[_state.serverType]
  if binName then
    os.execute(string.format("pkill -f %s 2>/dev/null", binName))
  end
  -- Also kill by command pattern as fallback
  if _state.processCmd then
    os.execute(string.format("pkill -f %q 2>/dev/null", _state.processCmd))
  end
  _state.process = nil
  _state._logFile = nil
  _state._logFilePos = 0
  _state._gameLogFile = nil
  _state._gameLogPos = 0

  _state.serverState = "stopped"
  _state.status = nil
  _state.players = {}
  addLog("info", "Server stopped")
end

-- Check if a binary exists on the system
local function binaryExists(name)
  local handle = io.popen("which " .. name .. " 2>/dev/null")
  if not handle then return false end
  local result = handle:read("*a")
  handle:close()
  return result and result:match("%S") ~= nil
end

local function startServer(serverType, config)
  ensureModules()

  if _state.serverState == "running" or _state.serverState == "starting" then
    stopServer()
  end

  _state.serverType = serverType
  _state.config = config
  _state.serverState = "starting"
  _state.players = {}
  _state.status = nil
  _state.rconConnected = false

  -- Kill any leftover server processes before starting (prevents port conflicts)
  local binaries = { goldsrc = "hlds_linux", source = "srcds_linux", source2 = "cs2", minecraft = "java" }
  local binName = binaries[serverType]
  if binName then
    os.execute(string.format("pkill -f %s 2>/dev/null", binName))
    -- Brief pause to let ports release
    os.execute("sleep 0.5")
  end

  addLog("info", string.format("Starting %s server...", serverType))

  -- Validate prerequisites before attempting launch
  if serverType == "minecraft" then
    local java = config.javaPath or "java"
    if not binaryExists(java) then
      _state.serverState = "error"
      addLog("error", string.format("Java not found: '%s' is not installed or not in PATH.", java))
      addLog("error", "Install Java: sudo apt install openjdk-21-jre-headless")
      return
    end
    local jar = config.jar or "server.jar"
    local f = io.open(jar, "r")
    if not f then
      local base = love and love.filesystem.getSource() or os.getenv("PWD") or "."
      local installJar = base .. "/minecraft-server/server.jar"
      f = io.open(installJar, "r")
      if f then
        jar = installJar
        config.jar = installJar
        addLog("info", "Found installed JAR: " .. installJar)
      end
    end
    if not f then
      _state.serverState = "error"
      addLog("error", string.format("Server JAR not found: '%s'", jar))
      addLog("error", "Click Install to download from Mojang")
      return
    end
    f:close()
    addLog("info", string.format("Java: %s | JAR: %s | Memory: %s", java, jar, config.memory or "2G"))

  elseif serverType == "goldsrc" or serverType == "source" or serverType == "source2" then
    local defaultBinaries = {
      goldsrc = "hlds_run",
      source  = "srcds_run",
      source2 = "cs2",
    }
    local binaryName = defaultBinaries[serverType] or "srcds_run"
    local binary = config.serverPath or ("./" .. binaryName)

    -- If default path doesn't exist, check the standard install directory
    local f = io.open(binary, "r")
    if not f then
      local base = love and love.filesystem.getSource() or os.getenv("PWD") or "."
      local installBinary = base .. "/" .. serverType .. "-server/" .. binaryName
      f = io.open(installBinary, "r")
      if f then
        binary = installBinary
        config.serverPath = installBinary
        addLog("info", "Found installed binary: " .. installBinary)
      end
    end

    if not f then
      _state.serverState = "error"
      addLog("error", string.format("%s binary not found: '%s'", binaryName, binary))
      addLog("error", "Click Install to download via SteamCMD")
      return
    end
    f:close()
  end

  -- Generate config files if Config module available
  if Config then
    local ok, err = pcall(function()
      if serverType == "minecraft" then
        Config.generateMinecraft(config, "server.properties")
        addLog("info", "Generated server.properties")
      elseif serverType == "goldsrc" or serverType == "source" or serverType == "source2" then
        Config.generateSource(config, "server.cfg")
        addLog("info", "Generated server.cfg")
      end
    end)
    if not ok then
      addLog("warn", "Config generation failed: " .. tostring(err))
    end
  end

  -- Build and launch the command
  local cmd = buildCommand(serverType, config)
  if not cmd then
    _state.serverState = "error"
    addLog("error", "Unknown server type: " .. tostring(serverType))
    return
  end

  addLog("info", "Command: " .. cmd)
  _state.processCmd = cmd

  -- Launch in background (detached) — monitor via RCON/Source Query, not stdout.
  -- io.popen blocks the main thread on read, so we use os.execute with & instead.
  local base = love and love.filesystem.getSource() or os.getenv("PWD") or "."
  local logFile = base .. "/server.log"
  local bgCmd = string.format("cd %s && %s > %s 2>&1 &", base, cmd, logFile)
  local exitCode = os.execute(bgCmd)
  if exitCode ~= 0 and exitCode ~= true then
    _state.serverState = "error"
    addLog("error", "Failed to start process (exit code: " .. tostring(exitCode) .. ")")
    return
  end

  _state.process = nil  -- no handle, process is detached
  _state._logFile = logFile
  _state._logFilePos = 0
  _state.serverState = "running"
  _state.status = {
    online = true,
    players = 0,
    maxPlayers = config.maxPlayers or 0,
    map = config.map or nil,
    name = config.name or nil,
  }
  addLog("info", "Process launched in background")
  addLog("info", "Server log: " .. logFile)

  -- RCON and Source Query require async TCP — not yet implemented.
  -- Commands are sent via detached processes in the rcon handler.
  local rconPort = config.rconPort or DEFAULT_RCON_PORTS[serverType] or 27015
  if config.rconPassword and config.rconPassword ~= "" then
    addLog("info", string.format("RCON available on port %d", rconPort))
  end
end

-- ── Capability registration ─────────────────────────────────────────────────

Capabilities.register("GameServer", {
  visual = false,

  schema = {
    engineType    = { type = "string", desc = "Engine type: goldsrc, source, source2, minecraft" },
    config        = { type = "any", desc = "Server config (JSON path string or inline table)" },
  },

  events = {
    "onReady", "onError", "onStopped",
    "onPlayerJoin", "onPlayerLeave", "onPlayerMessage",
    "onMapChange", "onLog",
  },

  create = function(nodeId, props)
    ensureModules()
    _state.nodeId = nodeId

    local serverType = props.engineType or "source"
    local config = props.config

    -- Resolve config
    if Config and type(config) == "string" then
      local ok, resolved = pcall(Config.resolve, config)
      if ok then config = resolved
      else addLog("error", "Config resolution failed: " .. tostring(resolved))
      end
    end

    if type(config) ~= "table" then
      config = {}
    end

    -- Store config but do NOT auto-start. Let the user click Start.
    _state.serverType = serverType
    _state.config = config
    _state.serverState = "stopped"
    addLog("info", string.format("GameServer capability registered (%s)", serverType))
    addLog("info", string.format("Port: %d | Max players: %d",
      config.port or DEFAULT_PORTS[serverType] or 0,
      config.maxPlayers or 0))
    if config.map then
      addLog("info", "Map: " .. config.map)
    end
    if config.name then
      addLog("info", "Server name: " .. config.name)
    end
    addLog("info", "Ready — click Start to launch the server process.")
    return {}
  end,

  update = function(nodeId, props, prevProps, state)
    -- If type or config changed, restart
    local configChanged = false

    if props.engineType ~= prevProps.engineType then
      configChanged = true
    end

    -- Deep compare config would be too expensive per-frame,
    -- but the capability system already does propsChanged checks.
    -- If we got here, something changed.
    if not configChanged then
      -- Check if config reference changed
      if props.config ~= prevProps.config then
        configChanged = true
      end
    end

    if configChanged then
      local serverType = props.engineType or "source"
      local config = props.config

      if Config and type(config) == "string" then
        local ok, resolved = pcall(Config.resolve, config)
        if ok then config = resolved end
      end

      if type(config) ~= "table" then config = {} end

      stopServer()
      startServer(serverType, config)
    end
  end,

  tick = function(nodeId, state, dt, pushEvent, props)
    -- Poll installer if active (runs regardless of server state)
    if Installer and Installer.isActive() then
      local done, err = Installer.poll()
      if done then
        if err then
          _state.serverState = "error"
          addLog("error", err)
        else
          _state.serverState = "stopped"
          -- Update config with installed binary path so Start finds it
          if _state.config and _state.serverType then
            local base = love and love.filesystem.getSource() or os.getenv("PWD") or "."
            local installDir = _state.config.installDir
            if not installDir then
              if _state.serverType == "minecraft" then
                installDir = base .. "/minecraft-server"
              else
                installDir = base .. "/" .. _state.serverType .. "-server"
              end
            end
            local binaries = {
              goldsrc = "hlds_run",
              source  = "srcds_run",
              source2 = "cs2",
            }
            if _state.serverType == "minecraft" then
              _state.config.jar = installDir .. "/" .. (_state.config.jar or "server.jar")
            else
              _state.config.serverPath = installDir .. "/" .. (binaries[_state.serverType] or "srcds_run")
            end
          end
          addLog("info", "Server binaries installed. Click Start to launch.")
        end
      end
    end

    if _state.serverState ~= "running" then return end

    local now = love and love.timer and love.timer.getTime() or os.clock()

    -- Tail the server log file for new output
    if _state._logFile then
      local f = io.open(_state._logFile, "r")
      if f then
        f:seek("set", _state._logFilePos or 0)
        local linesRead = 0
        while linesRead < 20 do  -- cap per frame to avoid blocking
          local line = f:read("*l")
          if not line then break end
          linesRead = linesRead + 1
          addLog("info", line)
          -- Parse for game events
          local eventType, eventData = parseLine(_state.serverType, line)
          if eventType then
            if pushEvent then
              pushEvent({ type = "gameserver:" .. eventType, payload = eventData })
            end
            -- Update live state from parsed events
            if eventType == "map_change" and eventData.map then
              if not _state.status then
                _state.status = {
                  online = true,
                  players = #_state.players,
                  maxPlayers = _state.config and _state.config.maxPlayers or 0,
                  name = _state.config and _state.config.name or nil,
                }
              end
              _state.status.map = eventData.map
            elseif eventType == "player_join" and eventData.player then
              -- Add player to list (avoid duplicates by name)
              local found = false
              for _, p in ipairs(_state.players) do
                if p.name == eventData.player then found = true; break end
              end
              if not found then
                table.insert(_state.players, {
                  id = #_state.players + 1,
                  name = eventData.player,
                  score = 0,
                  duration = 0,
                  _joinTime = os.time(),
                })
              end
              if _state.status then
                _state.status.players = #_state.players
              end
            elseif eventType == "player_leave" and eventData.player then
              -- Remove player from list
              for i, p in ipairs(_state.players) do
                if p.name == eventData.player then
                  table.remove(_state.players, i)
                  break
                end
              end
              if _state.status then
                _state.status.players = #_state.players
              end
            end
          end
        end
        _state._logFilePos = f:seek()
        f:close()
      end
    end

    -- Discover and tail the Source engine game log (player joins/leaves/chat)
    if not _state._gameLogFile and _state.config and _state.config.serverPath then
      local installDir = _state.config.serverPath:match("(.+)/[^/]+$") or "."
      local game = _state.config.game or "cstrike"
      local logsDir = installDir .. "/" .. game .. "/logs"
      -- Find the most recent log file
      local handle = io.popen('ls -t "' .. logsDir .. '"/*.log 2>/dev/null | head -1')
      if handle then
        local path = handle:read("*l")
        handle:close()
        if path and path ~= "" then
          _state._gameLogFile = path
          _state._gameLogPos = 0
          -- Start from end of file (don't replay old logs)
          local f = io.open(path, "r")
          if f then
            f:seek("end")
            _state._gameLogPos = f:seek()
            f:close()
          end
        end
      end
    end

    if _state._gameLogFile then
      local f = io.open(_state._gameLogFile, "r")
      if f then
        f:seek("set", _state._gameLogPos or 0)
        local linesRead = 0
        while linesRead < 20 do
          local line = f:read("*l")
          if not line then break end
          linesRead = linesRead + 1
          -- Parse for game events (player join/leave/chat/map change)
          local eventType, eventData = parseLine(_state.serverType, line)
          if eventType then
            addLog("info", "[game] " .. line)
            if pushEvent then
              pushEvent({ type = "gameserver:" .. eventType, payload = eventData })
            end
            if eventType == "player_join" and eventData.player then
              local found = false
              for _, p in ipairs(_state.players) do
                if p.name == eventData.player then found = true; break end
              end
              if not found then
                table.insert(_state.players, {
                  id = #_state.players + 1,
                  name = eventData.player,
                  score = 0,
                  duration = 0,
                  _joinTime = os.time(),
                })
              end
              if _state.status then _state.status.players = #_state.players end
            elseif eventType == "player_leave" and eventData.player then
              for i, p in ipairs(_state.players) do
                if p.name == eventData.player then
                  table.remove(_state.players, i)
                  break
                end
              end
              if _state.status then _state.status.players = #_state.players end
            elseif eventType == "map_change" and eventData.map then
              if _state.status then _state.status.map = eventData.map end
            end
          end
        end
        _state._gameLogPos = f:seek()
        f:close()
      else
        -- Log file might have been rotated, re-discover next tick
        _state._gameLogFile = nil
      end
    end

    -- Tail RCON response log
    if _state._rconLogFile then
      local f = io.open(_state._rconLogFile, "r")
      if f then
        f:seek("set", _state._rconLogPos or 0)
        while true do
          local line = f:read("*l")
          if not line then break end
          addLog("info", "RCON< " .. line)
        end
        _state._rconLogPos = f:seek()
        f:close()
      end
    end

    -- Update player durations
    local nowSec = os.time()
    for _, p in ipairs(_state.players) do
      if p._joinTime then
        p.duration = nowSec - p._joinTime
      end
    end
  end,

  destroy = function(nodeId, state)
    stopServer()
    _state.nodeId = nil
  end,
})

-- ── RPC handlers ────────────────────────────────────────────────────────────

-- Helper: snapshot current state for immediate feedback in RPC responses
local function stateSnapshot()
  return {
    ok = true,
    state = _state.serverState,
    logs = _state.logs,
    status = _state.status or {
      online = _state.serverState == "running",
      players = #_state.players,
      maxPlayers = _state.config and _state.config.maxPlayers or 0,
      map = _state.config and _state.config.map or nil,
      name = _state.config and _state.config.name or nil,
    },
  }
end

local handlers = {}

handlers["gameserver:status"] = function(args)
  return {
    state = _state.serverState,
    status = _state.status or {
      online = _state.serverState == "running",
      players = #_state.players,
      maxPlayers = _state.config and _state.config.maxPlayers or 0,
      map = _state.config and _state.config.map or nil,
      name = _state.config and _state.config.name or nil,
    },
  }
end

handlers["gameserver:players"] = function(args)
  return {
    players = _state.players,
    maxPlayers = _state.config and _state.config.maxPlayers or 0,
  }
end

handlers["gameserver:logs"] = function(args)
  return { logs = _state.logs }
end

handlers["gameserver:maps"] = function(args)
  -- Scan the server's maps/ directory for .bsp files
  local maps = {}
  if _state.config then
    local serverPath = _state.config.serverPath or ""
    local installDir = serverPath:match("(.+)/[^/]+$") or "."
    local game = _state.config.game or "cstrike"
    local mapsDir = installDir .. "/" .. game .. "/maps"

    -- Minecraft doesn't have map files in the same way
    if _state.serverType == "minecraft" then
      return { maps = {} }
    end

    local handle = io.popen('ls "' .. mapsDir .. '"/*.bsp 2>/dev/null')
    if handle then
      local output = handle:read("*a")
      handle:close()
      for file in output:gmatch("[^\n]+") do
        local mapName = file:match("([^/]+)%.bsp$")
        if mapName then
          maps[#maps + 1] = mapName
        end
      end
      table.sort(maps)
    end
  end
  return { maps = maps }
end

handlers["gameserver:rcon"] = function(args)
  local cmd = args and args.command
  if not cmd then
    return { error = "No command provided" }
  end

  if _state.serverState ~= "running" then
    return { error = "Server not running" }
  end

  addLog("info", "RCON> " .. cmd)

  -- Update status immediately for known commands
  local mapArg = cmd:match("^changelevel%s+(%S+)")
  if mapArg then
    if not _state.status then
      _state.status = {
        online = true,
        players = #_state.players,
        maxPlayers = _state.config and _state.config.maxPlayers or 0,
        name = _state.config and _state.config.name or nil,
      }
    end
    _state.status.map = mapArg
  end

  -- Send RCON command via a detached one-shot process to avoid blocking.
  -- Uses rcon-cli pattern: connect, send, disconnect — all in background.
  local serverType = _state.serverType
  local config = _state.config or {}
  local rconPw = config.rconPassword or ""
  local rconPort = config.rconPort or DEFAULT_RCON_PORTS[serverType] or 27015

  if rconPw == "" then
    addLog("warn", "No RCON password configured — cannot send commands")
    return { error = "No RCON password" }
  end

  -- Send RCON via background Python process (Source RCON protocol over TCP).
  -- Response is appended to a file we tail in tick.
  local base = love and love.filesystem.getSource() or os.getenv("PWD") or "."
  local rconLog = base .. "/rcon_response.log"

  local pyScript = string.format([[
import socket, struct, sys
def rcon(host, port, pw, cmd):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    try:
        s.connect((host, port))
        # Auth packet (type 3)
        payload = pw.encode('utf-8') + b'\x00\x00'
        pkt = struct.pack('<iii', 10+len(pw), 1, 3) + payload
        s.sendall(pkt)
        s.recv(4096)
        # Command packet (type 2)
        payload = cmd.encode('utf-8') + b'\x00\x00'
        pkt = struct.pack('<iii', 10+len(cmd), 2, 2) + payload
        s.sendall(pkt)
        resp = s.recv(4096)
        if len(resp) >= 12:
            body = resp[12:].split(b'\x00')[0].decode('utf-8', errors='replace')
            if body:
                print(body)
    except Exception as e:
        print('RCON error: ' + str(e))
    finally:
        s.close()
rcon('127.0.0.1', %d, %q, %q)
]], rconPort, rconPw, cmd)

  local escaped = pyScript:gsub("'", "'\\''")
  local bgCmd = string.format("python3 -c '%s' >> %q 2>&1 &", escaped, rconLog)
  os.execute(bgCmd)

  -- Set up tailing for RCON responses
  if not _state._rconLogFile then
    _state._rconLogFile = rconLog
    _state._rconLogPos = 0
    -- Clear old responses
    local f = io.open(rconLog, "w")
    if f then f:close() end
  end

  return { ok = true }
end

handlers["gameserver:control"] = function(args)
  local action = args and args.action
  if action == "start" then
    if _state.serverType and _state.config then
      startServer(_state.serverType, _state.config)
    else
      addLog("error", "Cannot start: no server type or config registered. Mount a <GameServer> component first.")
    end
    return stateSnapshot()
  elseif action == "stop" then
    stopServer()
    return stateSnapshot()
  elseif action == "restart" then
    local t, c = _state.serverType, _state.config
    stopServer()
    if t and c then startServer(t, c) end
    return stateSnapshot()
  elseif action == "install" then
    ensureModules()
    if not Installer then
      addLog("error", "Installer module not available")
      return stateSnapshot()
    end
    if Installer.isActive() then
      addLog("warn", "Installation already in progress")
      return stateSnapshot()
    end
    if _state.serverType and _state.config then
      _state.serverState = "installing"
      Installer.install(_state.serverType, _state.config, addLog)
    else
      addLog("error", "Cannot install: no server type or config. Mount a <GameServer> component first.")
    end
    return stateSnapshot()
  elseif action == "clear_logs" then
    _state.logs = {}
    return stateSnapshot()
  end
  return { error = "Unknown action: " .. tostring(action) }
end

--- Return all RPC handlers for registration in init.lua
function _M.getHandlers()
  return handlers
end

return _M
