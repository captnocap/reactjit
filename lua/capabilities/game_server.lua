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

-- Lazy-load submodules (they may not exist yet during development)
local RCON, SourceQuery, Config

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
end

-- ── Constants ───────────────────────────────────────────────────────────────

local MAX_LOGS = 200
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
    return string.format('%s -game %s -console -usercon +game_port %d +maxplayers %d +map %s -tickrate %d',
      binary, game, port, maxp, map, tickrate)

  elseif serverType == "source2" then
    local binary = config.serverPath or "./cs2"
    local game = config.game or "cs2"
    local port = config.port or DEFAULT_PORTS.source2
    local maxp = config.maxPlayers or 24
    local map = config.map or "de_dust2"
    local tickrate = config.tickrate or 128
    return string.format('%s -dedicated -console -usercon +game_port %d +maxplayers %d +map %s -tickrate %d',
      binary, port, maxp, map, tickrate)
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
    timestamp = love and love.timer and love.timer.getTime() or os.clock(),
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

  -- Kill process
  if _state.process then
    pcall(function() _state.process:close() end)
    _state.process = nil
  end

  _state.serverState = "stopped"
  _state.status = nil
  _state.players = {}
  addLog("info", "Server stopped")
end

local function startServer(serverType, config)
  ensureModules()

  if _state.serverState == "running" or _state.serverState == "starting" then
    stopServer()
  end

  _state.serverType = serverType
  _state.config = config
  _state.serverState = "starting"
  _state.logs = {}
  _state.players = {}
  _state.status = nil
  _state.rconConnected = false

  addLog("info", string.format("Starting %s server...", serverType))

  -- Generate config files if Config module available
  if Config then
    local ok, err = pcall(function()
      if serverType == "minecraft" then
        Config.generateMinecraft(config, "server.properties")
      elseif serverType == "goldsrc" or serverType == "source" or serverType == "source2" then
        Config.generateSource(config, "server.cfg")
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

  -- Launch via io.popen for stdout capture
  local ok, handle = pcall(io.popen, cmd .. " 2>&1", "r")
  if not ok or not handle then
    _state.serverState = "error"
    addLog("error", "Failed to start process: " .. tostring(handle))
    return
  end

  _state.process = handle
  _state.serverState = "running"
  addLog("info", "Process started")

  -- Initialize RCON client
  if RCON then
    local rconHost = "127.0.0.1"
    local rconPort = config.rconPort or DEFAULT_RCON_PORTS[serverType] or 27015
    local rconPw = config.rconPassword or ""
    if rconPw ~= "" then
      _state.rcon = RCON.new(rconHost, rconPort)
      addLog("info", string.format("RCON client initialized (port %d)", rconPort))
    end
  end

  -- Initialize Source Query client (for Valve engines)
  if SourceQuery and serverType ~= "minecraft" then
    local queryPort = config.port or DEFAULT_PORTS[serverType] or 27015
    _state.query = SourceQuery.new("127.0.0.1", queryPort)
    addLog("info", string.format("Source Query initialized (port %d)", queryPort))
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

    startServer(serverType, config)
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
    if _state.serverState ~= "running" then return end

    local now = love and love.timer and love.timer.getTime() or os.clock()

    -- Read stdout from process (non-blocking via select or limited read)
    if _state.process then
      -- Note: io.popen:read is blocking. In production we'd use luaposix or
      -- a non-blocking pipe. For now, read a line if available.
      -- TODO: Replace with non-blocking IO via love.thread or luaposix
    end

    -- RCON connection management
    if _state.rcon and not _state.rconConnected then
      if now - _state.lastRconRetry > RCON_RETRY_INTERVAL then
        _state.lastRconRetry = now
        local rconPw = _state.config and _state.config.rconPassword or ""
        if rconPw ~= "" then
          local ok = pcall(function()
            _state.rcon:connect()
            _state.rcon:auth(rconPw)
          end)
          if ok then
            _state.rconConnected = true
            addLog("info", "RCON connected")
          end
        end
      end
    end

    -- Poll RCON for pending responses
    if _state.rcon then
      pcall(function() _state.rcon:poll() end)
    end

    -- Source Query polling
    if _state.query and now - _state.lastQueryTime > QUERY_INTERVAL then
      _state.lastQueryTime = now
      pcall(function()
        _state.query:queryInfo()
        _state.query:queryPlayers()
      end)
    end

    -- Process query responses
    if _state.query then
      pcall(function()
        _state.query:poll()
        local info = _state.query:getInfo()
        if info then
          _state.status = {
            online = true,
            name = info.name,
            map = info.map,
            players = info.players or 0,
            maxPlayers = info.maxPlayers or 0,
            bots = info.bots or 0,
            game = info.game,
            version = info.version,
          }
        end

        local playerList = _state.query:getPlayers()
        if playerList then
          _state.players = playerList
        end
      end)
    end
  end,

  destroy = function(nodeId, state)
    stopServer()
    _state.nodeId = nil
  end,
})

-- ── RPC handlers ────────────────────────────────────────────────────────────

local bridge = require("lua.bridge_quickjs")

bridge.registerHandler("gameserver:status", function(args)
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
end)

bridge.registerHandler("gameserver:players", function(args)
  return {
    players = _state.players,
    maxPlayers = _state.config and _state.config.maxPlayers or 0,
  }
end)

bridge.registerHandler("gameserver:logs", function(args)
  return { logs = _state.logs }
end)

bridge.registerHandler("gameserver:rcon", function(args)
  if not _state.rcon or not _state.rconConnected then
    return { error = "RCON not connected" }
  end
  local cmd = args and args.command
  if not cmd then
    return { error = "No command provided" }
  end
  local ok, response = pcall(function()
    return _state.rcon:command(cmd)
  end)
  if ok then
    addLog("info", "RCON> " .. cmd)
    if response then
      addLog("info", "RCON< " .. tostring(response))
    end
    return { response = response }
  else
    addLog("error", "RCON error: " .. tostring(response))
    return { error = tostring(response) }
  end
end)

bridge.registerHandler("gameserver:control", function(args)
  local action = args and args.action
  if action == "start" then
    if _state.serverType and _state.config then
      startServer(_state.serverType, _state.config)
    end
    return { ok = true }
  elseif action == "stop" then
    stopServer()
    return { ok = true }
  elseif action == "restart" then
    local t, c = _state.serverType, _state.config
    stopServer()
    if t and c then startServer(t, c) end
    return { ok = true }
  elseif action == "clear_logs" then
    _state.logs = {}
    return { ok = true }
  end
  return { error = "Unknown action: " .. tostring(action) }
end)
