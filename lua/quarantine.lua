--[[
  quarantine.lua — Crypto miner detection and silent capability blocking

  Scans JavaScript source and native binaries for known crypto mining patterns.
  When detected, activates quarantine mode via permit.quarantine() which silently
  makes all capability checks return false. The miner code runs but is neutered:
  no network, no storage, no IPC. It can't reach a pool or submit hashes.

  Defense in depth:
    - Loads patterns from lua/miner_signatures.lua (updateable, versionable)
    - Embeds hardcoded fallback patterns that can't be removed by file tampering
    - Scans JS source at Bridge:eval() time
    - Scans .so binaries at ffi.load() time (CartridgeOS)

  Usage:
    local quarantine = require("lua.quarantine")
    quarantine.init({ permit = permit, audit = audit })

    -- In bridge eval:
    local result = quarantine.scanJS(source)
    if result.detected then
      quarantine.activate("crypto_miner_detected", result.matches)
    end

    -- In ffi.load:
    local result = quarantine.scanBinary("/app/libsomething.so")
    if result.detected then
      quarantine.activate("mining_binary_detected", result.matches)
    end
]]

local Quarantine = {}

-- ---------------------------------------------------------------------------
-- Internal state
-- ---------------------------------------------------------------------------

local _permit = nil     -- reference to permit module
local _audit = nil      -- reference to audit module
local _active = false   -- quarantine triggered
local _matches = {}     -- what was detected (forensic detail)
local _signatures = nil -- loaded from miner_signatures.lua

-- ---------------------------------------------------------------------------
-- Hardcoded fallback patterns (can't be removed by tampering with signatures file)
-- These are the absolute minimum that must always be checked.
-- ---------------------------------------------------------------------------

local FALLBACK_LIBRARIES = {
  "coinhive", "coin-hive", "coinimp", "crypto-loot", "deepminer",
  "monerominer", "xmr-miner", "webmr", "mineralt", "cryptonight-wasm",
}

local FALLBACK_POOL_DOMAINS = {
  "coinhive.com", "coin-hive.com", "moneroocean.stream", "supportxmr.com",
  "minexmr.com", "hashvault.pro", "herominers.com", "crypto-loot.com",
  "authedmine.com", "webassembly.stream",
}

local FALLBACK_PROTOCOL_MARKERS = {
  "stratum+tcp://", "stratum+ssl://", "stratum://",
  "mining.notify", "mining.submit", "mining.subscribe",
}

local FALLBACK_BEHAVIORAL = {
  "CryptoNight", "cryptonight", "RandomX", "randomx",
  "hashrate", "hashRate", "hash_rate",
}

local FALLBACK_SYMBOL_NAMES = {
  "rx_slow_hash", "cn_slow_hash", "cryptonight_hash",
  "randomx_create_vm", "randomx_calculate_hash",
  "randomx_init_cache", "randomx_init_dataset",
  "stratum_connect", "submit_share", "mining_submit",
}

-- ---------------------------------------------------------------------------
-- SHA-256 via FFI (for binary hash checking)
-- ---------------------------------------------------------------------------

local _sha256_available = false
local _libcrypto = nil

local function init_sha256()
  local ffi_ok, ffi = pcall(require, "ffi")
  if not ffi_ok then return false end

  -- Try to load libcrypto (OpenSSL)
  local ok, lib = pcall(ffi.load, "crypto")
  if not ok then
    -- Try explicit paths
    ok, lib = pcall(ffi.load, "libcrypto.so.3")
    if not ok then
      ok, lib = pcall(ffi.load, "libcrypto.so.1.1")
      if not ok then return false end
    end
  end

  -- Declare SHA256 functions
  pcall(ffi.cdef, [[
    unsigned char *SHA256(const unsigned char *d, size_t n, unsigned char *md);
  ]])

  _libcrypto = lib
  _sha256_available = true
  return true
end

--- Compute SHA-256 hash of a string/buffer.
--- @param data string  The data to hash
--- @return string|nil  Hex-encoded SHA-256 hash, or nil if unavailable
local function sha256(data)
  if not _sha256_available then return nil end

  local ffi = require("ffi")
  local md = ffi.new("unsigned char[32]")
  _libcrypto.SHA256(data, #data, md)

  local hex = {}
  for i = 0, 31 do
    hex[#hex + 1] = string.format("%02x", md[i])
  end
  return table.concat(hex)
end

-- ---------------------------------------------------------------------------
-- JS source scanning
-- ---------------------------------------------------------------------------

--- Scan JavaScript source for crypto miner patterns.
--- @param source string  The JavaScript source code
--- @return table  { detected = bool, matches = { { category, pattern } ... } }
function Quarantine.scanJS(source)
  if _active then
    return { detected = true, matches = _matches }
  end

  if type(source) ~= "string" or #source == 0 then
    return { detected = false, matches = {} }
  end

  local matches = {}
  local lower = source:lower()

  -- Helper: check a list of patterns against lowercased source
  local function checkPatterns(patterns, category)
    for _, pattern in ipairs(patterns) do
      local lp = pattern:lower()
      if lower:find(lp, 1, true) then
        matches[#matches + 1] = { category = category, pattern = pattern }
      end
    end
  end

  -- Helper: check Lua patterns (not plain string find)
  local function checkLuaPatterns(patterns, category)
    for _, pattern in ipairs(patterns) do
      local lp = pattern:lower()
      if lower:find(lp) then
        matches[#matches + 1] = { category = category, pattern = pattern }
      end
    end
  end

  -- Check hardcoded fallback patterns first (always present)
  checkPatterns(FALLBACK_LIBRARIES, "library")
  checkPatterns(FALLBACK_POOL_DOMAINS, "pool_domain")
  checkPatterns(FALLBACK_PROTOCOL_MARKERS, "protocol")
  checkPatterns(FALLBACK_BEHAVIORAL, "behavioral")

  -- Check signatures file patterns (if loaded)
  if _signatures then
    if _signatures.libraries then
      checkPatterns(_signatures.libraries, "library")
    end
    if _signatures.pool_domains then
      checkPatterns(_signatures.pool_domains, "pool_domain")
    end
    if _signatures.protocol_markers then
      checkPatterns(_signatures.protocol_markers, "protocol")
    end
    if _signatures.behavioral_patterns then
      checkLuaPatterns(_signatures.behavioral_patterns, "behavioral")
    end
  end

  -- Deduplicate matches (fallback and file may overlap)
  local seen = {}
  local unique = {}
  for _, m in ipairs(matches) do
    local key = m.category .. ":" .. m.pattern
    if not seen[key] then
      seen[key] = true
      unique[#unique + 1] = m
    end
  end

  return {
    detected = #unique > 0,
    matches = unique,
  }
end

-- ---------------------------------------------------------------------------
-- Binary scanning (.so files)
-- ---------------------------------------------------------------------------

--- Scan a native binary for crypto miner patterns.
--- Checks against known binary hashes (SHA-256) and scans for mining
--- function names in the ELF string table.
---
--- @param path string  Path to the .so file
--- @return table  { detected = bool, matches = { { category, pattern } ... } }
function Quarantine.scanBinary(path)
  if _active then
    return { detected = true, matches = _matches }
  end

  local matches = {}

  -- Read the binary file
  local f = io.open(path, "rb")
  if not f then
    return { detected = false, matches = {} }
  end
  local data = f:read("*a")
  f:close()

  if not data or #data == 0 then
    return { detected = false, matches = {} }
  end

  -- 1. Check full-file SHA-256 against known mining binary hashes
  if _sha256_available then
    local hash = sha256(data)
    if hash then
      -- Check hardcoded hashes (none yet — populated by Gemini research)
      -- Check signature file hashes
      if _signatures and _signatures.binary_hashes and _signatures.binary_hashes[hash] then
        local info = _signatures.binary_hashes[hash]
        matches[#matches + 1] = {
          category = "binary_hash",
          pattern = hash,
          name = info.name,
          source = info.source,
        }
      end
    end
  end

  -- 2. Scan for mining symbol names in the binary's string sections
  -- ELF binaries contain null-terminated strings in .strtab, .dynstr, .rodata
  -- We can find them with simple string.find on the raw bytes
  local lower_data = data:lower()

  -- Check hardcoded fallback symbol names
  for _, sym in ipairs(FALLBACK_SYMBOL_NAMES) do
    local lsym = sym:lower()
    if lower_data:find(lsym, 1, true) then
      matches[#matches + 1] = { category = "symbol_name", pattern = sym }
    end
  end

  -- Check signature file symbol names
  if _signatures and _signatures.symbol_names then
    for _, sym in ipairs(_signatures.symbol_names) do
      local lsym = sym:lower()
      if lower_data:find(lsym, 1, true) then
        matches[#matches + 1] = { category = "symbol_name", pattern = sym }
      end
    end
  end

  -- 3. Check for algorithm constants (string markers)
  if _signatures and _signatures.algorithm_constants then
    for _, ac in ipairs(_signatures.algorithm_constants) do
      if ac.string_values then
        for _, sv in ipairs(ac.string_values) do
          if data:find(sv, 1, true) then
            matches[#matches + 1] = {
              category = "algorithm_constant",
              pattern = sv,
              name = ac.name,
            }
          end
        end
      end
    end
  end

  -- 4. Check for mining pool domains in the binary (hardcoded URLs)
  for _, domain in ipairs(FALLBACK_POOL_DOMAINS) do
    if lower_data:find(domain:lower(), 1, true) then
      matches[#matches + 1] = { category = "embedded_pool_domain", pattern = domain }
    end
  end
  if _signatures and _signatures.pool_domains then
    for _, domain in ipairs(_signatures.pool_domains) do
      if lower_data:find(domain:lower(), 1, true) then
        matches[#matches + 1] = { category = "embedded_pool_domain", pattern = domain }
      end
    end
  end

  -- 5. Check for stratum protocol strings in the binary
  for _, marker in ipairs(FALLBACK_PROTOCOL_MARKERS) do
    if lower_data:find(marker:lower(), 1, true) then
      matches[#matches + 1] = { category = "embedded_protocol", pattern = marker }
    end
  end

  -- Deduplicate
  local seen = {}
  local unique = {}
  for _, m in ipairs(matches) do
    local key = m.category .. ":" .. m.pattern
    if not seen[key] then
      seen[key] = true
      unique[#unique + 1] = m
    end
  end

  return {
    detected = #unique > 0,
    matches = unique,
  }
end

-- ---------------------------------------------------------------------------
-- Network URL scanning
-- ---------------------------------------------------------------------------

--- Scan a URL (WebSocket or fetch target) for mining pool indicators.
--- Called from the bridge's network polyfills.
---
--- @param url string  The URL being connected to
--- @return table  { detected = bool, matches = { { category, pattern } ... } }
function Quarantine.scanURL(url)
  if _active then
    return { detected = true, matches = _matches }
  end

  if type(url) ~= "string" or #url == 0 then
    return { detected = false, matches = {} }
  end

  local matches = {}
  local lower = url:lower()

  -- Check pool domains
  for _, domain in ipairs(FALLBACK_POOL_DOMAINS) do
    if lower:find(domain:lower(), 1, true) then
      matches[#matches + 1] = { category = "pool_url", pattern = domain }
    end
  end
  if _signatures and _signatures.pool_domains then
    for _, domain in ipairs(_signatures.pool_domains) do
      if lower:find(domain:lower(), 1, true) then
        matches[#matches + 1] = { category = "pool_url", pattern = domain }
      end
    end
  end

  -- Check protocol markers
  for _, marker in ipairs(FALLBACK_PROTOCOL_MARKERS) do
    if lower:find(marker:lower(), 1, true) then
      matches[#matches + 1] = { category = "pool_protocol", pattern = marker }
    end
  end
  if _signatures and _signatures.protocol_markers then
    for _, marker in ipairs(_signatures.protocol_markers) do
      if lower:find(marker:lower(), 1, true) then
        matches[#matches + 1] = { category = "pool_protocol", pattern = marker }
      end
    end
  end

  -- Check network-specific indicators
  if _signatures and _signatures.network_patterns then
    if _signatures.network_patterns.ws_indicators then
      for _, ind in ipairs(_signatures.network_patterns.ws_indicators) do
        if lower:find(ind:lower(), 1, true) then
          matches[#matches + 1] = { category = "ws_indicator", pattern = ind }
        end
      end
    end
  end

  -- Deduplicate
  local seen = {}
  local unique = {}
  for _, m in ipairs(matches) do
    local key = m.category .. ":" .. m.pattern
    if not seen[key] then
      seen[key] = true
      unique[#unique + 1] = m
    end
  end

  return {
    detected = #unique > 0,
    matches = unique,
  }
end

-- ---------------------------------------------------------------------------
-- Quarantine activation
-- ---------------------------------------------------------------------------

--- Activate quarantine mode. All permit.check() calls will silently return false.
--- Logs to audit system but produces no stdout/stderr output.
---
--- @param reason string  Why quarantine was triggered
--- @param matches table  List of { category, pattern } matches that triggered it
function Quarantine.activate(reason, matches)
  if _active then return end  -- already quarantined, no-op

  _active = true
  _matches = matches or {}

  -- Set the master kill switch on the permit system
  if _permit then
    _permit.quarantine(reason)
  end

  -- Log to audit (silent — audit doesn't print for non-blocked verdicts)
  if _audit then
    local match_summary = {}
    for _, m in ipairs(_matches) do
      match_summary[#match_summary + 1] = m.category .. ": " .. m.pattern
    end
    _audit.log("blocked", "quarantine", {
      reason = reason,
      match_count = #_matches,
      matches = match_summary,
    })
  end

  -- Intentionally NO io.write or print — completely silent
end

--- Check whether quarantine mode is active.
--- @return boolean
function Quarantine.isActive()
  return _active
end

--- Get forensic details of what triggered quarantine.
--- @return table  { active = bool, matches = { ... } }
function Quarantine.getMatches()
  return {
    active = _active,
    matches = _matches,
  }
end

-- ---------------------------------------------------------------------------
-- Initialization
-- ---------------------------------------------------------------------------

--- Initialize the quarantine module.
--- @param deps table  { permit = <permit module>, audit = <audit module> }
function Quarantine.init(deps)
  _permit = deps.permit
  _audit = deps.audit

  -- Try to load the signatures file (graceful if missing)
  local ok, sigs = pcall(require, "lua.miner_signatures")
  if ok and type(sigs) == "table" then
    _signatures = sigs
  end

  -- Try to initialize SHA-256 for binary hash checking
  init_sha256()
end

--- RPC handlers for React-side queries (inspector/system panel).
--- @return table  { method -> handler }
function Quarantine.getHandlers()
  return {
    ["quarantine:status"] = function()
      return {
        active = _active,
        match_count = #_matches,
        matches = _matches,
        sha256_available = _sha256_available,
        signatures_loaded = _signatures ~= nil,
      }
    end,
  }
end

return Quarantine
