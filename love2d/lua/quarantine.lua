--[[
  quarantine.lua — Crypto miner detection and silent capability blocking

  Scans JavaScript source, native binaries, and network URLs for known crypto
  mining patterns. When detected, activates quarantine mode via permit.quarantine()
  which silently makes all capability checks return false. The miner code runs but
  is neutered: no network, no storage, no IPC. It can't reach a pool or submit hashes.

  Confidence model:
    - HARD triggers quarantine on a single match.
      These are unambiguous indicators: exact binary/WASM hashes, known miner
      library imports, pool domain connections, stratum protocol URIs, mining
      symbol names in binaries.
    - COMPOSITE triggers require 2+ matches from DIFFERENT categories.
      These are patterns that could appear in legitimate code individually
      (algorithm names in docs, config tokens in parsers, crypto primitives
      in security research) but become damning in combination.

  JS source scanning (scanJS) uses HARD triggers ONLY.  Composite matching
  was removed from JS scanning because substring matching on bundled code
  produces too many false positives (e.g. "setHashes" matching "ethash",
  "result" matching stratum fields, "scrypt" matching a mining algorithm).
  Composite matching remains active in scanBinary() and scanWSFrame() where
  it operates on structured data with far fewer false positives.

  Defense in depth:
    - Loads patterns from lua/miner_signatures.lua (updateable, versionable)
    - Embeds hardcoded fallback patterns that can't be removed by file tampering
    - Scans JS source at Bridge:eval() time
    - Scans .so binaries at ffi.load() time (CartridgeOS)
    - Scans URLs at ws:connect / http:request time

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
-- Confidence classification
-- ---------------------------------------------------------------------------
-- Each match is tagged as "hard" or "composite". Hard triggers quarantine
-- immediately on a single hit. Composite triggers only quarantine when 2+
-- matches come from different composite categories.

local HARD = "hard"
local COMPOSITE = "composite"

-- Categories and their trigger levels:
--   hard: library, pool_domain, protocol, binary_hash, malware_hash,
--         wasm_hash, symbol_name, stratum_method, pool_url, pool_protocol
--   composite: behavioral, config_token, randomx_personalization,
--              algorithm_constant, ws_indicator

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

-- NOTE: Behavioral fallback patterns (CryptoNight, RandomX, hashrate, etc.)
-- were removed from JS source scanning — too many false positives from
-- substring matching on bundled code.  These patterns remain in
-- miner_signatures.lua for use by scanBinary() and scanWSFrame().

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

  -- Try to load libcrypto (OpenSSL) — platform-aware paths
  local isLinux = ffi.os == "Linux"
  local cryptoPaths
  if isLinux then
    cryptoPaths = { "crypto", "libcrypto.so.3", "libcrypto.so.1.1" }
  else
    -- macOS 15.4+ aborts if you load the unversioned system libcrypto.dylib
    -- ("Invalid dylib load. Clients should not load the unversioned libcrypto
    -- dylib as it does not have a stable ABI.") Use Homebrew's OpenSSL instead.
    cryptoPaths = {
      "/opt/homebrew/opt/openssl/lib/libcrypto.dylib",
      "/usr/local/opt/openssl/lib/libcrypto.dylib",
      "libcrypto.3.dylib",
      "libcrypto.1.1.dylib",
    }
  end
  local ok, lib = false, nil
  for _, path in ipairs(cryptoPaths) do
    ok, lib = pcall(ffi.load, path)
    if ok then break end
  end
  if not ok then return false end

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
-- Detection evaluation — confidence scoring
-- ---------------------------------------------------------------------------

--- Evaluate a list of categorized matches and determine if quarantine triggers.
--- Hard matches trigger on a single hit. Composite matches require 2+ hits
--- from different categories.
---
--- @param matches table  List of { category, pattern, trigger, ... }
--- @return boolean  Whether quarantine should activate
local function should_quarantine(matches)
  if #matches == 0 then return false end

  -- Any hard trigger = immediate quarantine
  for _, m in ipairs(matches) do
    if m.trigger == HARD then
      return true
    end
  end

  -- Count distinct composite categories
  local composite_categories = {}
  for _, m in ipairs(matches) do
    if m.trigger == COMPOSITE then
      composite_categories[m.category] = true
    end
  end

  local count = 0
  for _ in pairs(composite_categories) do
    count = count + 1
  end

  -- 2+ distinct composite categories = quarantine
  return count >= 2
end

-- ---------------------------------------------------------------------------
-- Deduplication helper
-- ---------------------------------------------------------------------------

local function deduplicate(matches)
  local seen = {}
  local unique = {}
  for _, m in ipairs(matches) do
    local key = m.category .. ":" .. m.pattern
    if not seen[key] then
      seen[key] = true
      unique[#unique + 1] = m
    end
  end
  return unique
end

-- ---------------------------------------------------------------------------
-- JS source scanning
-- ---------------------------------------------------------------------------

--- Scan JavaScript source for crypto miner patterns.
--- Uses confidence scoring: hard triggers quarantine on single match,
--- composite triggers require 2+ matches from different categories.
---
--- @param source string  The JavaScript source code
--- @return table  { detected = bool, matches = { { category, pattern, trigger } ... } }
function Quarantine.scanJS(source)
  if _active then
    return { detected = true, matches = _matches }
  end

  if type(source) ~= "string" or #source == 0 then
    return { detected = false, matches = {} }
  end

  local matches = {}
  local lower = source:lower()

  -- Helper: check a list of patterns (plain string find)
  local function checkPlain(patterns, category, trigger)
    for _, pattern in ipairs(patterns) do
      local lp = pattern:lower()
      if lower:find(lp, 1, true) then
        matches[#matches + 1] = { category = category, pattern = pattern, trigger = trigger }
      end
    end
  end

  -- ===== HARD triggers only (single match = quarantine) =====
  -- Composite triggers were removed from JS scanning — see note below.

  -- Known mining libraries — unambiguous
  checkPlain(FALLBACK_LIBRARIES, "library", HARD)
  if _signatures and _signatures.libraries then
    checkPlain(_signatures.libraries, "library", HARD)
  end

  -- Mining pool domains — unambiguous
  checkPlain(FALLBACK_POOL_DOMAINS, "pool_domain", HARD)
  if _signatures and _signatures.pool_domains then
    checkPlain(_signatures.pool_domains, "pool_domain", HARD)
  end

  -- Stratum protocol markers — unambiguous
  checkPlain(FALLBACK_PROTOCOL_MARKERS, "protocol", HARD)
  if _signatures and _signatures.protocol_markers then
    checkPlain(_signatures.protocol_markers, "protocol", HARD)
  end

  -- Stratum JSON-RPC agent strings (e.g. "XMRig/")
  if _signatures and _signatures.stratum_json_rpc and _signatures.stratum_json_rpc.agent_patterns then
    checkPlain(_signatures.stratum_json_rpc.agent_patterns, "stratum_agent", HARD)
  end

  -- WASM export names (mining-specific function exports)
  if _signatures and _signatures.wasm_patterns and _signatures.wasm_patterns.export_names then
    checkPlain(_signatures.wasm_patterns.export_names, "wasm_export", HARD)
  end

  -- NOTE: Composite triggers (behavioral patterns, config tokens, stratum
  -- fields, algorithm constants) were removed from JS source scanning.
  -- Substring matching on bundled JS is too noisy — legitimate code
  -- routinely contains "nonce", "result", "scrypt", "setHashes" (which
  -- substring-matches "ethash"), etc.  Two false-positive composite
  -- categories = quarantine on innocent apps.
  --
  -- These composite checks remain active in scanBinary() and scanWSFrame()
  -- where they operate on structured data with far fewer false positives.
  -- The JS scan now only fires on HARD triggers: known miner libraries,
  -- pool domains, stratum protocol URIs, agent strings, and WASM exports.

  local unique = deduplicate(matches)
  return {
    detected = should_quarantine(unique),
    matches = unique,
  }
end

-- ---------------------------------------------------------------------------
-- Binary scanning (.so files)
-- ---------------------------------------------------------------------------

--- Scan a native binary for crypto miner patterns.
--- Checks against known binary hashes (SHA-256), malware sample hashes,
--- mining function names, algorithm constants, and embedded strings.
---
--- @param path string  Path to the .so file
--- @return table  { detected = bool, matches = { { category, pattern, trigger } ... } }
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

  -- ===== HARD triggers =====

  -- 1. Full-file SHA-256 against known mining binary hashes
  if _sha256_available then
    local hash = sha256(data)
    if hash then
      -- Check official release hashes
      if _signatures and _signatures.binary_hashes and _signatures.binary_hashes[hash] then
        local info = _signatures.binary_hashes[hash]
        matches[#matches + 1] = {
          category = "binary_hash",
          pattern = hash,
          trigger = HARD,
          name = info.name,
          source = info.source,
        }
      end

      -- Check known malware sample hashes
      if _signatures and _signatures.malware_sample_hashes and _signatures.malware_sample_hashes[hash] then
        local info = _signatures.malware_sample_hashes[hash]
        matches[#matches + 1] = {
          category = "malware_hash",
          pattern = hash,
          trigger = HARD,
          name = info.name,
          source = info.source,
        }
      end

      -- Check WASM hashes (in case a .so wraps a WASM module)
      if _signatures and _signatures.wasm_hashes and _signatures.wasm_hashes[hash] then
        local info = _signatures.wasm_hashes[hash]
        matches[#matches + 1] = {
          category = "wasm_hash",
          pattern = hash,
          trigger = HARD,
          name = info.name,
          source = info.source,
        }
      end
    end
  end

  -- 2. Mining symbol names in the binary (ELF .strtab/.dynstr/.rodata)
  local lower_data = data:lower()

  for _, sym in ipairs(FALLBACK_SYMBOL_NAMES) do
    local lsym = sym:lower()
    if lower_data:find(lsym, 1, true) then
      matches[#matches + 1] = { category = "symbol_name", pattern = sym, trigger = HARD }
    end
  end

  if _signatures and _signatures.symbol_names then
    for _, sym in ipairs(_signatures.symbol_names) do
      local lsym = sym:lower()
      if lower_data:find(lsym, 1, true) then
        matches[#matches + 1] = { category = "symbol_name", pattern = sym, trigger = HARD }
      end
    end
  end

  -- 3. Embedded pool domains (hardcoded URLs in the binary)
  for _, domain in ipairs(FALLBACK_POOL_DOMAINS) do
    if lower_data:find(domain:lower(), 1, true) then
      matches[#matches + 1] = { category = "embedded_pool_domain", pattern = domain, trigger = HARD }
    end
  end
  if _signatures and _signatures.pool_domains then
    for _, domain in ipairs(_signatures.pool_domains) do
      if lower_data:find(domain:lower(), 1, true) then
        matches[#matches + 1] = { category = "embedded_pool_domain", pattern = domain, trigger = HARD }
      end
    end
  end

  -- 4. Stratum protocol strings in the binary
  for _, marker in ipairs(FALLBACK_PROTOCOL_MARKERS) do
    if lower_data:find(marker:lower(), 1, true) then
      matches[#matches + 1] = { category = "embedded_protocol", pattern = marker, trigger = HARD }
    end
  end

  -- ===== COMPOSITE triggers =====

  -- 5. Miner config tokens (CLI flags, user-agent fragments)
  if _signatures and _signatures.miner_config_tokens then
    for _, token in ipairs(_signatures.miner_config_tokens) do
      if lower_data:find(token:lower(), 1, true) then
        matches[#matches + 1] = { category = "config_token", pattern = token, trigger = COMPOSITE }
      end
    end
  end

  -- 6. RandomX personalization strings
  if _signatures and _signatures.randomx_personalization then
    for _, ps in ipairs(_signatures.randomx_personalization) do
      if data:find(ps, 1, true) then
        matches[#matches + 1] = { category = "randomx_personalization", pattern = ps, trigger = COMPOSITE }
      end
    end
  end

  -- 7. Algorithm constants (string values)
  if _signatures and _signatures.algorithm_constants then
    for _, ac in ipairs(_signatures.algorithm_constants) do
      if ac.string_values then
        for _, sv in ipairs(ac.string_values) do
          if data:find(sv, 1, true) then
            matches[#matches + 1] = {
              category = "algorithm_constant",
              pattern = sv,
              trigger = COMPOSITE,
              name = ac.name,
            }
          end
        end
      end
    end
  end

  -- 8. Stratum JSON-RPC agent patterns in binary strings
  if _signatures and _signatures.stratum_json_rpc and _signatures.stratum_json_rpc.agent_patterns then
    for _, agent in ipairs(_signatures.stratum_json_rpc.agent_patterns) do
      if data:find(agent, 1, true) then
        matches[#matches + 1] = { category = "stratum_agent", pattern = agent, trigger = HARD }
      end
    end
  end

  local unique = deduplicate(matches)
  return {
    detected = should_quarantine(unique),
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
--- @return table  { detected = bool, matches = { { category, pattern, trigger } ... } }
function Quarantine.scanURL(url)
  if _active then
    return { detected = true, matches = _matches }
  end

  if type(url) ~= "string" or #url == 0 then
    return { detected = false, matches = {} }
  end

  local matches = {}
  local lower = url:lower()

  -- ===== HARD triggers =====

  -- Pool domains — connecting to a pool is unambiguous
  for _, domain in ipairs(FALLBACK_POOL_DOMAINS) do
    if lower:find(domain:lower(), 1, true) then
      matches[#matches + 1] = { category = "pool_url", pattern = domain, trigger = HARD }
    end
  end
  if _signatures and _signatures.pool_domains then
    for _, domain in ipairs(_signatures.pool_domains) do
      if lower:find(domain:lower(), 1, true) then
        matches[#matches + 1] = { category = "pool_url", pattern = domain, trigger = HARD }
      end
    end
  end

  -- Protocol markers — stratum:// in a URL is unambiguous
  for _, marker in ipairs(FALLBACK_PROTOCOL_MARKERS) do
    if lower:find(marker:lower(), 1, true) then
      matches[#matches + 1] = { category = "pool_protocol", pattern = marker, trigger = HARD }
    end
  end
  if _signatures and _signatures.protocol_markers then
    for _, marker in ipairs(_signatures.protocol_markers) do
      if lower:find(marker:lower(), 1, true) then
        matches[#matches + 1] = { category = "pool_protocol", pattern = marker, trigger = HARD }
      end
    end
  end

  -- ===== COMPOSITE triggers =====

  -- Generic network indicators (words like "mining", "pool" in URLs)
  if _signatures and _signatures.network_patterns then
    if _signatures.network_patterns.ws_indicators then
      for _, ind in ipairs(_signatures.network_patterns.ws_indicators) do
        if lower:find(ind:lower(), 1, true) then
          matches[#matches + 1] = { category = "ws_indicator", pattern = ind, trigger = COMPOSITE }
        end
      end
    end

    -- Mining port detection
    if _signatures.network_patterns.mining_ports then
      for _, port in ipairs(_signatures.network_patterns.mining_ports) do
        -- Match :PORT at end of host or before path
        local port_str = ":" .. tostring(port)
        if lower:find(port_str .. "$") or lower:find(port_str .. "/") or lower:find(port_str .. "?") then
          matches[#matches + 1] = {
            category = "mining_port",
            pattern = port_str,
            trigger = COMPOSITE,
          }
        end
      end
    end
  end

  local unique = deduplicate(matches)
  return {
    detected = should_quarantine(unique),
    matches = unique,
  }
end

-- ---------------------------------------------------------------------------
-- WebSocket frame scanning (for Stratum JSON-RPC detection)
-- ---------------------------------------------------------------------------

--- Scan a WebSocket message payload for Stratum JSON-RPC patterns.
--- Called from the bridge's WebSocket onmessage path.
---
--- @param payload string  The WebSocket message text
--- @return table  { detected = bool, matches = { { category, pattern, trigger } ... } }
function Quarantine.scanWSFrame(payload)
  if _active then
    return { detected = true, matches = _matches }
  end

  if type(payload) ~= "string" or #payload == 0 then
    return { detected = false, matches = {} }
  end

  local matches = {}
  local lower = payload:lower()

  -- Look for JSON-RPC mining patterns in the frame
  -- A Stratum login message looks like:
  --   {"method":"login","params":{"login":"wallet","pass":"x","agent":"XMRig/6.25.0"}}
  -- A job notification looks like:
  --   {"method":"job","params":{"job_id":"...","blob":"...","target":"..."}}

  -- Check for Stratum method + distinctive fields together
  local has_method = false
  local has_job_id = lower:find('"job_id"', 1, true) ~= nil
  local has_nonce = lower:find('"nonce"', 1, true) ~= nil

  if _signatures and _signatures.stratum_json_rpc then
    -- Check method names in JSON context
    if _signatures.stratum_json_rpc.methods then
      for _, method in ipairs(_signatures.stratum_json_rpc.methods) do
        local pat = '"method":%s*"' .. method:lower() .. '"'
        if lower:find(pat) then
          has_method = true
          matches[#matches + 1] = {
            category = "stratum_rpc_method",
            pattern = method,
            trigger = COMPOSITE,
          }
        end
      end
    end

    -- Agent strings are hard triggers (miner self-identifying)
    if _signatures.stratum_json_rpc.agent_patterns then
      for _, agent in ipairs(_signatures.stratum_json_rpc.agent_patterns) do
        if lower:find(agent:lower(), 1, true) then
          matches[#matches + 1] = {
            category = "stratum_agent",
            pattern = agent,
            trigger = HARD,
          }
        end
      end
    end
  end

  -- Stratum method + job_id/nonce = hard trigger (this IS mining traffic)
  if has_method and (has_job_id or has_nonce) then
    matches[#matches + 1] = {
      category = "stratum_traffic",
      pattern = "method+" .. (has_job_id and "job_id" or "nonce"),
      trigger = HARD,
    }
  end

  -- Pool domains in the payload
  for _, domain in ipairs(FALLBACK_POOL_DOMAINS) do
    if lower:find(domain:lower(), 1, true) then
      matches[#matches + 1] = { category = "pool_domain", pattern = domain, trigger = HARD }
    end
  end

  local unique = deduplicate(matches)
  return {
    detected = should_quarantine(unique),
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
--- @param matches table  List of { category, pattern, trigger } matches that triggered it
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
      local entry = m.category .. ": " .. m.pattern .. " [" .. (m.trigger or "?") .. "]"
      match_summary[#match_summary + 1] = entry
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
        confidence_model = "hard+composite",
      }
    end,
  }
end

return Quarantine
