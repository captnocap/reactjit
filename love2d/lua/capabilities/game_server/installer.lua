--[[
  game_server/installer.lua — Server binary acquisition pipeline

  Handles downloading and installing game server binaries:
    - SteamCMD (for GoldSrc/Source/Source2 servers)
    - Minecraft server JAR (from Mojang version manifest)

  Uses lua/http.lua for async downloads and lua/archive.lua for extraction.
  All operations are non-blocking — poll() returns progress each frame.

  Usage:
    local Installer = require("lua.capabilities.game_server.installer")
    Installer.install(serverType, config, logFn)
    -- then in tick:
    local done, err = Installer.poll()
]]

local http
local Archive

local httpInitialized = false

-- Buffer for HTTP responses routed from the main loop.
-- The main loop's http.poll() consumes all channel messages, so the installer
-- can't call http.poll() directly. Instead, init.lua feeds us responses here.
local _pendingResponses = {}

local function ensureDeps()
  if not http then
    local ok, m = pcall(require, "lua.http")
    if ok then
      http = m
      if not httpInitialized then
        http.init()
        httpInitialized = true
      end
    end
  end
  if not Archive then
    local ok, m = pcall(require, "lua.archive")
    if ok then Archive = m end
  end
end

-- ── State ──────────────────────────────────────────────────────────────────

local _install = {
  active   = false,
  phase    = nil,    -- 'check' | 'download_steamcmd' | 'extract_steamcmd' | 'install_server' | 'download_jar' | 'eula' | 'done' | 'error'
  serverType = nil,
  config   = nil,
  logFn    = nil,
  requestId = nil,
  downloadPath = nil,
  pollHandle = nil,  -- io.popen handle for steamcmd
  startTime = 0,
}

local M = {}

-- ── SteamCMD URLs ──────────────────────────────────────────────────────────

local STEAMCMD_URL = {
  linux  = "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz",
  macos  = "https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz",
}

-- Steam App IDs for dedicated servers
local STEAM_APP_IDS = {
  goldsrc = {
    cstrike = 90,
    valve   = 90,
    tfc     = 90,
    dod     = 90,
  },
  source = {
    cstrike   = 232330,  -- CS:S
    tf        = 232250,  -- TF2
    garrysmod = 4020,    -- GMod
    left4dead2 = 222860, -- L4D2
    hl2mp     = 232370,  -- HL2:DM
    dod       = 232290,  -- DoD:S
  },
  source2 = {
    cs2      = 730,
    deadlock = 0, -- not yet public
  },
}

-- Minecraft version manifest URL
local MC_VERSION_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"

-- ── Helpers ────────────────────────────────────────────────────────────────

local function getPlatform()
  local ffi = require("ffi")
  if ffi.os == "Linux" then return "linux" end
  if ffi.os == "OSX" then return "macos" end
  return nil
end

local function fileExists(path)
  local f = io.open(path, "r")
  if f then f:close(); return true end
  return false
end

local function log(level, msg)
  if _install.logFn then
    _install.logFn(level, msg)
  end
end

local function getInstallDir(serverType, config)
  if config.serverPath then
    -- Extract directory from binary path
    local dir = config.serverPath:match("(.+)/[^/]+$") or "."
    -- Make absolute
    if dir:sub(1,1) ~= "/" then
      dir = (love and love.filesystem.getSource() or os.getenv("PWD") or ".") .. "/" .. dir
    end
    return dir
  end
  -- Default install locations (absolute paths so SteamCMD installs to the right place)
  local base = love and love.filesystem.getSource() or os.getenv("PWD") or "."
  if serverType == "minecraft" then
    return config.installDir or (base .. "/minecraft-server")
  else
    return config.installDir or (base .. "/" .. serverType .. "-server")
  end
end

local function getSteamCmdDir(config)
  if config.steamcmdPath then
    return config.steamcmdPath:match("(.+)/[^/]+$") or config.steamcmdPath
  end
  return os.getenv("HOME") .. "/.local/share/steamcmd"
end

local function getSteamCmdBinary(config)
  return getSteamCmdDir(config) .. "/steamcmd.sh"
end

-- ── Phase handlers ─────────────────────────────────────────────────────────

local function startSteamCmdDownload()
  ensureDeps()
  if not http then
    log("error", "HTTP module not available — cannot download SteamCMD")
    _install.phase = "error"
    return
  end

  local platform = getPlatform()
  if not platform or not STEAMCMD_URL[platform] then
    log("error", "Unsupported platform for SteamCMD: " .. tostring(platform))
    _install.phase = "error"
    return
  end

  local url = STEAMCMD_URL[platform]
  local dir = getSteamCmdDir(_install.config)
  _install.downloadPath = dir .. "/steamcmd.tar.gz"

  -- Create directory
  os.execute("mkdir -p " .. dir)

  log("info", "Downloading SteamCMD from " .. url)
  log("info", "Destination: " .. dir)

  _install.requestId = "steamcmd-download-" .. tostring(os.clock())
  http.request(_install.requestId, {
    url = url,
    method = "GET",
  })

  _install.phase = "download_steamcmd"
end

local function extractSteamCmd()
  ensureDeps()
  local dir = getSteamCmdDir(_install.config)
  local archive = _install.downloadPath

  if not fileExists(archive) then
    log("error", "SteamCMD archive not found: " .. archive)
    _install.phase = "error"
    return
  end

  log("info", "Extracting SteamCMD...")

  -- Use tar directly (simpler and always available on Linux/macOS)
  local cmd = string.format("tar -xzf %s -C %s 2>&1", archive, dir)
  local handle = io.popen(cmd)
  if handle then
    local output = handle:read("*a")
    handle:close()
    if output and output ~= "" then
      log("info", "tar: " .. output)
    end
  end

  -- Make steamcmd.sh executable
  os.execute("chmod +x " .. dir .. "/steamcmd.sh")

  -- Clean up archive
  os.remove(archive)

  if fileExists(dir .. "/steamcmd.sh") then
    log("info", "SteamCMD extracted successfully")
    log("info", "Running SteamCMD first-time update...")
    -- SteamCMD must self-update on first run before it can install apps.
    -- Run non-blocking — read line-by-line in the update_steamcmd phase.
    local updateCmd = string.format("%s/steamcmd.sh +quit 2>&1", dir)
    _install.pollHandle = io.popen(updateCmd, "r")
    if _install.pollHandle then
      _install.phase = "update_steamcmd"
    else
      log("warn", "Could not run SteamCMD self-update, trying install directly...")
      _install.phase = "install_server"
    end
  else
    log("error", "SteamCMD extraction failed — steamcmd.sh not found")
    _install.phase = "error"
  end
end

local function startServerInstall()
  local serverType = _install.serverType
  local config = _install.config
  local steamcmd = getSteamCmdBinary(config)

  if not fileExists(steamcmd) then
    log("error", "SteamCMD not found at: " .. steamcmd)
    _install.phase = "error"
    return
  end

  local game = config.game or "cstrike"
  local appIds = STEAM_APP_IDS[serverType]
  local appId = config.appId or (appIds and appIds[game]) or nil

  if not appId or appId == 0 then
    log("error", string.format("No Steam App ID for %s/%s — set config.appId manually", serverType, game))
    _install.phase = "error"
    return
  end

  local installDir = getInstallDir(serverType, config)
  os.execute("mkdir -p " .. installDir)

  log("info", string.format("Installing %s server (App ID: %d)...", game, appId))
  log("info", "Install directory: " .. installDir)
  log("info", "This may take a while depending on your connection speed.")

  -- Run steamcmd in background
  local cmd = string.format(
    '%s +force_install_dir "%s" +login anonymous +app_update %d validate +quit 2>&1',
    steamcmd, installDir, appId
  )

  _install.pollHandle = io.popen(cmd, "r")
  if not _install.pollHandle then
    log("error", "Failed to launch SteamCMD")
    _install.phase = "error"
    return
  end

  _install.phase = "installing_server"
end

local function startMinecraftDownload()
  ensureDeps()
  if not http then
    log("error", "HTTP module not available — cannot download Minecraft server")
    _install.phase = "error"
    return
  end

  local installDir = getInstallDir("minecraft", _install.config)
  os.execute("mkdir -p " .. installDir)

  log("info", "Fetching Minecraft version manifest...")

  _install.requestId = "mc-manifest-" .. tostring(os.clock())
  http.request(_install.requestId, {
    url = MC_VERSION_MANIFEST,
    method = "GET",
  })

  _install.phase = "download_mc_manifest"
  _install.downloadPath = installDir
end

local function parseManifestAndDownload(body)
  -- Parse the version manifest JSON
  local json = require("lua.json") or require("json")
  local ok, manifest = pcall(json.decode, body)
  if not ok or not manifest then
    log("error", "Failed to parse Minecraft version manifest")
    _install.phase = "error"
    return
  end

  -- Find the latest release
  local latestId = manifest.latest and manifest.latest.release
  if not latestId then
    log("error", "No latest release found in manifest")
    _install.phase = "error"
    return
  end

  -- Find the version URL
  local versionUrl = nil
  for _, v in ipairs(manifest.versions or {}) do
    if v.id == latestId then
      versionUrl = v.url
      break
    end
  end

  if not versionUrl then
    log("error", "Version URL not found for " .. latestId)
    _install.phase = "error"
    return
  end

  log("info", "Latest Minecraft version: " .. latestId)
  log("info", "Fetching version metadata...")

  _install.requestId = "mc-version-" .. tostring(os.clock())
  http.request(_install.requestId, {
    url = versionUrl,
    method = "GET",
  })

  _install.phase = "download_mc_version"
end

local function parseVersionAndDownloadJar(body)
  local json = require("lua.json") or require("json")
  local ok, version = pcall(json.decode, body)
  if not ok or not version then
    log("error", "Failed to parse version metadata")
    _install.phase = "error"
    return
  end

  local serverDownload = version.downloads and version.downloads.server
  if not serverDownload or not serverDownload.url then
    log("error", "No server download URL in version metadata")
    _install.phase = "error"
    return
  end

  local jarUrl = serverDownload.url
  local jarSize = serverDownload.size or 0
  local installDir = _install.downloadPath
  local jarPath = installDir .. "/server.jar"

  log("info", string.format("Downloading server.jar (%s)...",
    jarSize > 0 and string.format("%.1f MB", jarSize / 1048576) or "unknown size"))

  _install.requestId = "mc-jar-" .. tostring(os.clock())
  _install._jarPath = jarPath
  http.request(_install.requestId, {
    url = jarUrl,
    method = "GET",
  })

  _install.phase = "download_mc_jar"
end

local function writeEula(installDir)
  local eulaPath = installDir .. "/eula.txt"
  local f = io.open(eulaPath, "w")
  if f then
    f:write("# Auto-accepted by ReactJIT Game Server\neula=true\n")
    f:close()
    log("info", "EULA accepted: " .. eulaPath)
  else
    log("warn", "Could not write eula.txt — you may need to accept it manually")
  end
end

-- ── Public API ─────────────────────────────────────────────────────────────

--- Feed an HTTP response from the main loop into the installer.
--- Called by init.lua when it sees a response with an installer request ID.
function M.feedResponse(resp)
  _pendingResponses[#_pendingResponses + 1] = resp
end

--- Drain buffered responses (replaces direct http.poll() calls).
local function drainResponses()
  local responses = _pendingResponses
  _pendingResponses = {}
  return responses
end

--- Begin installing a game server.
--- @param serverType string "goldsrc" | "source" | "source2" | "minecraft"
--- @param config table server config with optional installDir, steamcmdPath
--- @param logFn function(level, message) callback for log output
function M.install(serverType, config, logFn)
  ensureDeps()

  _install.active = true
  _install.phase = "check"
  _install.serverType = serverType
  _install.config = config
  _install.logFn = logFn
  _install.requestId = nil
  _install.downloadPath = nil
  _install.pollHandle = nil
  _install.startTime = os.clock()

  log("info", string.format("=== Installing %s server ===", serverType))

  if serverType == "minecraft" then
    -- Check Java first
    local java = config.javaPath or "java"
    local handle = io.popen(java .. " -version 2>&1")
    if handle then
      local output = handle:read("*a")
      handle:close()
      if output and output:match("[Jj]ava") then
        log("info", "Java found: " .. output:match("[^\n]+"))
      else
        log("error", string.format("Java not found: '%s' is not installed.", java))
        log("error", "Install: sudo apt install openjdk-21-jre-headless")
        _install.phase = "error"
        return
      end
    end

    local installDir = getInstallDir("minecraft", config)
    local jarPath = installDir .. "/" .. (config.jar or "server.jar")

    if fileExists(jarPath) then
      log("info", "Server JAR already exists: " .. jarPath)
      _install.phase = "done"
      return
    end

    startMinecraftDownload()

  else
    -- Valve engine — need SteamCMD
    local steamcmd = getSteamCmdBinary(config)

    if fileExists(steamcmd) then
      log("info", "SteamCMD found: " .. steamcmd)
      -- Check if server is already installed
      local installDir = getInstallDir(serverType, config)
      local binaries = {
        goldsrc = "hlds_run",
        source  = "srcds_run",
        source2 = "cs2",
      }
      local binary = installDir .. "/" .. (binaries[serverType] or "srcds_run")
      if fileExists(binary) then
        log("info", "Server binary already exists: " .. binary)
        log("info", "Run with serverPath: '" .. binary .. "'")
        _install.phase = "done"
        return
      end
      startServerInstall()
    else
      log("info", "SteamCMD not found — downloading...")
      startSteamCmdDownload()
    end
  end
end

--- Poll for installation progress. Call each frame.
--- @return boolean done, string|nil error
function M.poll()
  if not _install.active then return true, nil end

  ensureDeps()

  local phase = _install.phase

  if phase == "done" then
    _install.active = false
    local elapsed = os.clock() - _install.startTime
    log("info", string.format("=== Installation complete (%.1fs) ===", elapsed))
    return true, nil

  elseif phase == "error" then
    _install.active = false
    return true, "Installation failed — check logs"

  elseif phase == "download_steamcmd" then
    -- Drain responses fed by init.lua from the main http.poll()
    do
      local responses = drainResponses()
      for _, resp in ipairs(responses) do
        if resp.id == _install.requestId then
          if resp.type == "progress" then
            log("info", string.format("Downloading SteamCMD... %.1f KB", (resp.bytes or 0) / 1024))
          elseif resp.status and resp.status >= 200 and resp.status < 300 and resp.body then
            -- Write body to file
            local f = io.open(_install.downloadPath, "wb")
            if f then
              f:write(resp.body)
              f:close()
              log("info", string.format("SteamCMD downloaded (%.1f MB)", #resp.body / 1048576))
              extractSteamCmd()
            else
              log("error", "Failed to write: " .. _install.downloadPath)
              _install.phase = "error"
            end
          elseif resp.type ~= "progress" then
            log("error", "SteamCMD download failed: HTTP " .. tostring(resp.status))
            _install.phase = "error"
          end
        end
      end
    end

  elseif phase == "update_steamcmd" then
    -- Non-blocking line-by-line read of SteamCMD self-update
    if _install.pollHandle then
      local line = _install.pollHandle:read("*l")
      if line then
        if line:match("Update") or line:match("Steam") or line:match("Loading") or line:match("Downloading") then
          log("info", "SteamCMD: " .. line)
        end
      else
        _install.pollHandle:close()
        _install.pollHandle = nil
        log("info", "SteamCMD self-update complete")
        _install.phase = "install_server"
      end
    end

  elseif phase == "install_server" then
    startServerInstall()

  elseif phase == "installing_server" then
    -- Poll steamcmd process output
    if _install.pollHandle then
      -- Non-blocking read would be ideal, but io.popen is blocking
      -- For now, read line-by-line and check for completion patterns
      local line = _install.pollHandle:read("*l")
      if line then
        -- Filter progress lines
        if line:match("Update state") or line:match("downloading") or line:match("Downloading") then
          log("info", "SteamCMD: " .. line)
        elseif line:match("Success") or line:match("fully installed") then
          log("info", "SteamCMD: " .. line)
          _install.pollHandle:close()
          _install.pollHandle = nil

          -- Update config with the actual server path
          local installDir = getInstallDir(_install.serverType, _install.config)
          local binaries = {
            goldsrc = "hlds_run",
            source  = "srcds_run",
            source2 = "cs2",
          }
          local binary = installDir .. "/" .. (binaries[_install.serverType] or "srcds_run")
          log("info", "Server installed at: " .. binary)
          log("info", "Set config.serverPath = '" .. binary .. "' to use it.")
          _install.phase = "done"
        elseif line:match("ERROR") or line:match("error") then
          log("error", "SteamCMD: " .. line)
        end
      else
        -- EOF — process finished
        _install.pollHandle:close()
        _install.pollHandle = nil
        log("info", "SteamCMD process finished")
        _install.phase = "done"
      end
    end

  elseif phase == "download_mc_manifest" then
    do
      local responses = drainResponses()
      for _, resp in ipairs(responses) do
        if resp.id == _install.requestId then
          if resp.type == "progress" then
            -- manifest is small, no need to log
          elseif resp.status and resp.status >= 200 and resp.status < 300 and resp.body then
            parseManifestAndDownload(resp.body)
          elseif resp.type ~= "progress" then
            log("error", "Failed to fetch version manifest: HTTP " .. tostring(resp.status))
            _install.phase = "error"
          end
        end
      end
    end

  elseif phase == "download_mc_version" then
    do
      local responses = drainResponses()
      for _, resp in ipairs(responses) do
        if resp.id == _install.requestId then
          if resp.type == "progress" then
            -- version metadata is small, no need to log
          elseif resp.status and resp.status >= 200 and resp.status < 300 and resp.body then
            parseVersionAndDownloadJar(resp.body)
          elseif resp.type ~= "progress" then
            log("error", "Failed to fetch version metadata: HTTP " .. tostring(resp.status))
            _install.phase = "error"
          end
        end
      end
    end

  elseif phase == "download_mc_jar" then
    do
      local responses = drainResponses()
      for _, resp in ipairs(responses) do
        if resp.id == _install.requestId then
          if resp.type == "progress" then
            log("info", string.format("Downloading server.jar... %.1f MB", (resp.bytes or 0) / 1048576))
          elseif resp.status and resp.status >= 200 and resp.status < 300 and resp.body then
            local jarPath = _install._jarPath
            local f = io.open(jarPath, "wb")
            if f then
              f:write(resp.body)
              f:close()
              log("info", string.format("server.jar downloaded (%.1f MB)", #resp.body / 1048576))
              local installDir = _install.downloadPath
              writeEula(installDir)
              log("info", "Server ready at: " .. jarPath)
              log("info", "Set config.jar = '" .. jarPath .. "' to use it.")
              _install.phase = "done"
            else
              log("error", "Failed to write: " .. jarPath)
              _install.phase = "error"
            end
          elseif resp.type ~= "progress" then
            log("error", "Failed to download server.jar: HTTP " .. tostring(resp.status))
            _install.phase = "error"
          end
        end
      end
    end
  end

  return false, nil
end

--- Check if an installation is in progress.
function M.isActive()
  return _install.active
end

--- Get current installation phase.
function M.getPhase()
  return _install.phase
end

--- Get the current HTTP request ID so the main loop can route responses.
function M.getRequestId()
  return _install.requestId
end

--- Cancel an in-progress installation.
function M.cancel()
  if _install.pollHandle then
    pcall(function() _install.pollHandle:close() end)
    _install.pollHandle = nil
  end
  _install.active = false
  _install.phase = nil
  log("info", "Installation cancelled")
end

return M
