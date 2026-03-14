--[[
  environments.lua — Process environment management for ReactJIT

  Creates, stores, and manages isolated environments (Python venvs, Node
  node_modules, Conda envs, custom shell setups) and spawns processes inside
  them with full PTY I/O piped back through the bridge.

  Environments persist as JSON configs in ~/.reactjit/environments/.
  Each env type has its own activation strategy:
    - python:  venv + pip
    - node:    nvm use / system node + npm/yarn/pnpm
    - conda:   conda activate
    - rust:    cargo (no activation needed, just PATH)
    - docker:  docker run with bind mounts
    - custom:  arbitrary setup commands sourced before exec

  RPC methods:
    env:create   { name, type, packages?, cwd?, env?, setup?, ... }
    env:get      { name }
    env:list     {}
    env:destroy  { name }
    env:install  { name, packages }
    env:run      { envName, command, cwd?, env?, pty?, rows?, cols? }
    env:process:send   { processId, data }
    env:process:resize { processId, rows, cols }
    env:process:kill   { processId, signal? }

  Bridge events (pushed per-frame):
    env:ready      { name, path, packages }
    env:error      { name, error }
    env:installing  { name }
    env:stdout     { processId, data }
    env:stderr     { processId, data }
    env:exit       { processId, exitCode }
    env:destroyed  { name }
]]

local PTY = require("lua.pty")
local json = require("lib.json")
local processRegistry = require("lua.process_registry")

-- ============================================================================
-- Persistent storage
-- ============================================================================

local HOME = os.getenv("HOME") or "/tmp"
local ENV_DIR = HOME .. "/.reactjit/environments"
local ENV_INDEX = ENV_DIR .. "/index.json"

local function ensureDir(path)
  os.execute('mkdir -p "' .. path:gsub('"', '\\"') .. '"')
end

local function readJSON(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local data = f:read("*a")
  f:close()
  local ok, result = pcall(json.decode, data)
  if ok then return result end
  return nil
end

local function writeJSON(path, data)
  ensureDir(path:match("(.+)/[^/]+$") or ".")
  local f = io.open(path, "w")
  if not f then return false end
  f:write(json.encode(data))
  f:close()
  return true
end

-- ============================================================================
-- Environment registry (in-memory + disk)
-- ============================================================================

local _envs = {}       -- name -> config table
local _envPaths = {}   -- name -> resolved env path (venv dir, etc.)
local _loaded = false

local function loadIndex()
  if _loaded then return end
  _loaded = true
  local index = readJSON(ENV_INDEX)
  if not index then return end
  for name, cfg in pairs(index) do
    _envs[name] = cfg
    _envPaths[name] = cfg._path
  end
end

local function saveIndex()
  local index = {}
  for name, cfg in pairs(_envs) do
    local entry = {}
    for k, v in pairs(cfg) do entry[k] = v end
    entry._path = _envPaths[name]
    index[name] = entry
  end
  writeJSON(ENV_INDEX, index)
end

-- ============================================================================
-- Activation scripts per type
-- ============================================================================

--- Build the shell preamble that activates an environment before running a command.
--- Returns a string of shell commands to source/eval.
local function activationScript(config)
  local lines = {}
  local envType = config.type or "custom"
  local envPath = _envPaths[config.name]

  -- Environment variables from config
  if config.env then
    for k, v in pairs(config.env) do
      if v == false then
        lines[#lines + 1] = 'unset ' .. k
      else
        lines[#lines + 1] = 'export ' .. k .. '=' .. string.format("%q", tostring(v))
      end
    end
  end

  -- Working directory
  if config.cwd then
    lines[#lines + 1] = 'cd ' .. string.format("%q", config.cwd)
  end

  -- Type-specific activation
  if envType == "python" then
    if envPath then
      lines[#lines + 1] = 'source ' .. string.format("%q", envPath .. "/bin/activate")
    end

  elseif envType == "node" then
    if config.node then
      -- Try nvm first, fallback to system
      lines[#lines + 1] = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"'
      lines[#lines + 1] = '[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" && nvm use ' .. config.node .. ' 2>/dev/null || true'
    end
    -- Add local node_modules/.bin to PATH
    if config.cwd then
      lines[#lines + 1] = 'export PATH="' .. config.cwd .. '/node_modules/.bin:$PATH"'
    end

  elseif envType == "conda" then
    local condaName = config.condaEnv or config.name
    lines[#lines + 1] = 'eval "$(conda shell.bash hook 2>/dev/null)"'
    lines[#lines + 1] = 'conda activate ' .. string.format("%q", condaName)

  elseif envType == "rust" then
    lines[#lines + 1] = 'source "$HOME/.cargo/env" 2>/dev/null || true'
  end

  -- Custom setup commands (always last, can override anything)
  if config.setup then
    for _, cmd in ipairs(config.setup) do
      lines[#lines + 1] = cmd
    end
  end

  return table.concat(lines, "\n")
end

-- ============================================================================
-- Environment creation
-- ============================================================================

--- Build the shell command that creates/bootstraps an environment.
--- Returns command string, or nil if no setup needed.
local function creationCommand(config)
  local envType = config.type or "custom"
  local name = config.name

  if envType == "python" then
    local envDir = ENV_DIR .. "/venvs/" .. name
    _envPaths[name] = envDir
    local python = "python3"
    if config.python then
      python = "python" .. config.python
    end
    local cmd = python .. ' -m venv ' .. string.format("%q", envDir)
    -- Install packages if specified
    if config.packages and #config.packages > 0 then
      cmd = cmd .. ' && source ' .. string.format("%q", envDir .. "/bin/activate")
      cmd = cmd .. ' && pip install ' .. table.concat(config.packages, " ")
    end
    return cmd

  elseif envType == "node" then
    if config.cwd and config.packages and #config.packages > 0 then
      local pm = config.packageManager or "npm"
      local cmd = 'cd ' .. string.format("%q", config.cwd)
      if pm == "npm" then
        cmd = cmd .. ' && npm install ' .. table.concat(config.packages, " ")
      elseif pm == "yarn" then
        cmd = cmd .. ' && yarn add ' .. table.concat(config.packages, " ")
      elseif pm == "pnpm" then
        cmd = cmd .. ' && pnpm add ' .. table.concat(config.packages, " ")
      end
      _envPaths[name] = config.cwd
      return cmd
    end
    _envPaths[name] = config.cwd
    return nil

  elseif envType == "conda" then
    local condaName = config.condaEnv or name
    local cmd = 'eval "$(conda shell.bash hook 2>/dev/null)" && conda create -y -n ' .. string.format("%q", condaName)
    if config.python then
      cmd = cmd .. ' python=' .. config.python
    end
    if config.packages and #config.packages > 0 then
      cmd = cmd .. ' ' .. table.concat(config.packages, " ")
    end
    _envPaths[name] = condaName
    return cmd

  elseif envType == "rust" then
    _envPaths[name] = config.cwd
    if config.packages and #config.packages > 0 then
      return 'cargo install ' .. table.concat(config.packages, " ")
    end
    return nil

  elseif envType == "docker" then
    _envPaths[name] = config.image
    if config.image then
      return 'docker pull ' .. string.format("%q", config.image)
    end
    return nil

  else -- custom
    _envPaths[name] = config.cwd or ENV_DIR .. "/custom/" .. name
    ensureDir(_envPaths[name] or "")
    return nil
  end
end

-- ============================================================================
-- Process management
-- ============================================================================

local _processes = {}   -- processId -> { pty, envName, alive }
local _nextProcId = 1
local _pendingEvents = {}

local function genProcessId(envName)
  local id = "proc_" .. envName .. "_" .. _nextProcId .. "_" .. os.time()
  _nextProcId = _nextProcId + 1
  return id
end

--- Spawn a process inside an activated environment.
local function spawnInEnv(envName, command, opts)
  loadIndex()
  local config = _envs[envName]
  if not config then
    return nil, "Environment not found: " .. tostring(envName)
  end

  opts = opts or {}
  local rows = opts.rows or 24
  local cols = opts.cols or 80

  -- Build the full command: activation + user command
  local activation = activationScript(config)
  local fullCmd = activation
  if #fullCmd > 0 then
    fullCmd = fullCmd .. "\n"
  end
  fullCmd = fullCmd .. command

  -- Merge env vars
  local env = {}
  if config.env then
    for k, v in pairs(config.env) do env[k] = v end
  end
  if opts.env then
    for k, v in pairs(opts.env) do env[k] = v end
  end

  local usePty = opts.pty ~= false

  if usePty then
    local pty, err = PTY.open({
      shell = "bash",
      args  = { "--norc", "--noprofile", "-c", fullCmd },
      cwd   = opts.cwd or config.cwd,
      env   = env,
      rows  = rows,
      cols  = cols,
    })
    if not pty then
      return nil, "Failed to spawn: " .. tostring(err)
    end

    local processId = genProcessId(envName)
    _processes[processId] = {
      pty     = pty,
      envName = envName,
      alive   = true,
      usePty  = true,
    }

    io.write(string.format("[environments] spawned %s in env '%s': %s\n", processId, envName, command))
    io.flush()

    return processId, nil
  else
    -- Pipe mode: use io.popen for simple stdout capture
    local pipe = io.popen(
      'bash --norc --noprofile -c ' .. string.format("%q", fullCmd) .. ' 2>&1',
      "r"
    )
    if not pipe then
      return nil, "Failed to spawn pipe process"
    end

    local processId = genProcessId(envName)
    _processes[processId] = {
      pipe    = pipe,
      envName = envName,
      alive   = true,
      usePty  = false,
    }

    return processId, nil
  end
end

-- ============================================================================
-- Per-frame polling
-- ============================================================================

local function pollProcesses()
  for processId, proc in pairs(_processes) do
    if not proc.alive then goto nextProc end

    if proc.usePty and proc.pty then
      -- Read PTY output
      local data = proc.pty:read()
      if data and #data > 0 then
        _pendingEvents[#_pendingEvents + 1] = {
          type = "env:stdout",
          processId = processId,
          data = data,
        }
      end

      -- Check liveness
      if not proc.pty:alive() then
        local code = proc.pty:exitCode()
        proc.alive = false
        proc.pty:close()
        _pendingEvents[#_pendingEvents + 1] = {
          type = "env:exit",
          processId = processId,
          exitCode = code or -1,
        }
      end
    elseif proc.pipe then
      -- Non-blocking pipe read (best-effort — io.popen is blocking on Linux)
      -- For pipe mode we read in chunks; this is inherently less responsive than PTY
      local data = proc.pipe:read(4096)
      if data then
        _pendingEvents[#_pendingEvents + 1] = {
          type = "env:stdout",
          processId = processId,
          data = data,
        }
      else
        -- EOF — process exited
        proc.pipe:close()
        proc.alive = false
        _pendingEvents[#_pendingEvents + 1] = {
          type = "env:exit",
          processId = processId,
          exitCode = 0,
        }
      end
    end

    ::nextProc::
  end

  local events = _pendingEvents
  _pendingEvents = {}
  return events
end

-- ============================================================================
-- Async env creation (spawns a setup process, fires env:ready when done)
-- ============================================================================

local _setupProcesses = {}  -- name -> { pty, config }

local function pollSetupProcesses()
  for name, setup in pairs(_setupProcesses) do
    if setup.pty then
      -- Drain output (log it)
      local data = setup.pty:read()
      if data then
        _pendingEvents[#_pendingEvents + 1] = {
          type = "env:stdout",
          processId = "setup_" .. name,
          data = data,
        }
      end

      if not setup.pty:alive() then
        local code = setup.pty:exitCode()
        setup.pty:close()
        _setupProcesses[name] = nil

        if code == 0 then
          -- Mark env as ready
          _pendingEvents[#_pendingEvents + 1] = {
            type = "env:ready",
            name = name,
            path = _envPaths[name],
            packages = setup.config.packages or {},
          }
          saveIndex()
        else
          _pendingEvents[#_pendingEvents + 1] = {
            type = "env:error",
            name = name,
            error = "Setup exited with code " .. tostring(code),
          }
        end
      end
    end
  end
end

-- ============================================================================
-- Module API
-- ============================================================================

local _M = {}

function _M.create(config)
  loadIndex()
  local name = config.name
  if not name then return { error = "Missing environment name" } end

  -- Check if already exists and is ready
  if _envs[name] and _envPaths[name] then
    -- Update config but keep existing path
    _envs[name] = config
    saveIndex()
    return {
      ready    = true,
      name     = name,
      path     = _envPaths[name],
      packages = config.packages or {},
    }
  end

  -- Store config
  _envs[name] = config

  -- Build creation command
  local cmd = creationCommand(config)

  if not cmd then
    -- No setup needed — mark as ready immediately
    saveIndex()
    return {
      ready    = true,
      name     = name,
      path     = _envPaths[name],
      packages = config.packages or {},
    }
  end

  -- Async setup: spawn in background
  _pendingEvents[#_pendingEvents + 1] = {
    type = "env:installing",
    name = name,
  }

  local pty, err = PTY.open({
    shell = "bash",
    args  = { "--norc", "--noprofile", "-c", cmd },
    cwd   = config.cwd,
    rows  = 24,
    cols  = 80,
  })

  if not pty then
    return { error = "Failed to start setup: " .. tostring(err) }
  end

  _setupProcesses[name] = { pty = pty, config = config }
  saveIndex()

  io.write(string.format("[environments] creating '%s' (%s)...\n", name, config.type or "custom"))
  io.flush()

  return { ready = false, name = name, installing = true }
end

function _M.get(name)
  loadIndex()
  local config = _envs[name]
  if not config then return { error = "Not found: " .. tostring(name) } end
  return {
    config   = config,
    ready    = _setupProcesses[name] == nil,
    path     = _envPaths[name],
    packages = config.packages or {},
  }
end

function _M.list()
  loadIndex()
  local envs = {}
  for name, config in pairs(_envs) do
    envs[#envs + 1] = {
      config   = config,
      ready    = _setupProcesses[name] == nil,
      path     = _envPaths[name],
      packages = config.packages or {},
    }
  end
  return { environments = envs }
end

function _M.destroy(name)
  loadIndex()
  local config = _envs[name]
  if not config then return { error = "Not found: " .. tostring(name) } end

  local envType = config.type or "custom"
  local envPath = _envPaths[name]

  -- Kill any running setup
  if _setupProcesses[name] then
    _setupProcesses[name].pty:kill()
    _setupProcesses[name].pty:close()
    _setupProcesses[name] = nil
  end

  -- Kill any running processes in this env
  for procId, proc in pairs(_processes) do
    if proc.envName == name and proc.alive then
      if proc.pty then proc.pty:kill(); proc.pty:close() end
      if proc.pipe then proc.pipe:close() end
      proc.alive = false
    end
  end

  -- Remove from disk
  if envType == "python" and envPath then
    os.execute('rm -rf ' .. string.format("%q", envPath))
  elseif envType == "conda" then
    os.execute('conda env remove -y -n ' .. string.format("%q", envPath or name) .. ' 2>/dev/null')
  end

  _envs[name] = nil
  _envPaths[name] = nil
  saveIndex()

  _pendingEvents[#_pendingEvents + 1] = {
    type = "env:destroyed",
    name = name,
  }

  io.write(string.format("[environments] destroyed '%s'\n", name))
  io.flush()

  return { ok = true }
end

function _M.install(name, packages)
  loadIndex()
  local config = _envs[name]
  if not config then return { error = "Not found: " .. tostring(name) } end

  local envType = config.type or "custom"
  local cmd

  if envType == "python" then
    local envPath = _envPaths[name]
    if envPath then
      cmd = 'source ' .. string.format("%q", envPath .. "/bin/activate") ..
            ' && pip install ' .. table.concat(packages, " ")
    end
  elseif envType == "node" then
    local pm = config.packageManager or "npm"
    cmd = 'cd ' .. string.format("%q", config.cwd or ".")
    if pm == "npm" then
      cmd = cmd .. ' && npm install ' .. table.concat(packages, " ")
    elseif pm == "yarn" then
      cmd = cmd .. ' && yarn add ' .. table.concat(packages, " ")
    elseif pm == "pnpm" then
      cmd = cmd .. ' && pnpm add ' .. table.concat(packages, " ")
    end
  elseif envType == "conda" then
    local condaName = config.condaEnv or name
    cmd = 'eval "$(conda shell.bash hook 2>/dev/null)" && conda activate ' ..
          string.format("%q", condaName) ..
          ' && conda install -y ' .. table.concat(packages, " ")
  elseif envType == "rust" then
    cmd = 'cargo install ' .. table.concat(packages, " ")
  end

  if not cmd then
    return { error = "Package installation not supported for type: " .. envType }
  end

  -- Update stored packages
  config.packages = config.packages or {}
  for _, pkg in ipairs(packages) do
    config.packages[#config.packages + 1] = pkg
  end
  saveIndex()

  _pendingEvents[#_pendingEvents + 1] = {
    type = "env:installing",
    name = name,
  }

  local pty, err = PTY.open({
    shell = "bash",
    args  = { "--norc", "--noprofile", "-c", cmd },
    cwd   = config.cwd,
    rows  = 24,
    cols  = 80,
  })

  if not pty then
    return { error = "Failed to start install: " .. tostring(err) }
  end

  _setupProcesses[name] = { pty = pty, config = config }
  return { ok = true, installing = true }
end

function _M.run(envName, command, opts)
  local processId, err = spawnInEnv(envName, command, opts)
  if not processId then
    return { error = err }
  end
  return { processId = processId }
end

function _M.processSend(processId, data)
  local proc = _processes[processId]
  if not proc then return { error = "Process not found" } end
  if not proc.alive then return { error = "Process not running" } end
  if proc.pty then
    proc.pty:write(data)
  end
  return { ok = true }
end

function _M.processResize(processId, rows, cols)
  local proc = _processes[processId]
  if not proc then return { error = "Process not found" } end
  if proc.pty then
    proc.pty:resize(rows, cols)
  end
  return { ok = true }
end

function _M.processKill(processId, signal)
  local proc = _processes[processId]
  if not proc then return { error = "Process not found" } end
  if proc.pty then
    proc.pty:kill(signal)
  elseif proc.pipe then
    proc.pipe:close()
    proc.alive = false
  end
  return { ok = true }
end

--- Poll all processes and setup tasks. Returns pending events for the bridge.
function _M.pollAll()
  pollSetupProcesses()
  return pollProcesses()
end

--- Clean up all processes on shutdown.
function _M.shutdown()
  for _, proc in pairs(_processes) do
    if proc.alive then
      if proc.pty then proc.pty:kill(); proc.pty:close() end
      if proc.pipe then proc.pipe:close() end
      proc.alive = false
    end
  end
  for _, setup in pairs(_setupProcesses) do
    if setup.pty then setup.pty:kill(); setup.pty:close() end
  end
  _setupProcesses = {}
end

--- RPC handler table (registered in init.lua).
function _M.getHandlers()
  return {
    ["env:create"] = function(args)
      return _M.create(args)
    end,
    ["env:get"] = function(args)
      return _M.get(args.name)
    end,
    ["env:list"] = function()
      return _M.list()
    end,
    ["env:destroy"] = function(args)
      return _M.destroy(args.name)
    end,
    ["env:install"] = function(args)
      return _M.install(args.name, args.packages)
    end,
    ["env:run"] = function(args)
      return _M.run(args.envName, args.command, {
        cwd  = args.cwd,
        env  = args.env,
        pty  = args.pty,
        rows = args.rows,
        cols = args.cols,
      })
    end,
    ["env:process:send"] = function(args)
      return _M.processSend(args.processId, args.data)
    end,
    ["env:process:resize"] = function(args)
      return _M.processResize(args.processId, args.rows, args.cols)
    end,
    ["env:process:kill"] = function(args)
      return _M.processKill(args.processId, args.signal)
    end,
  }
end

return _M
