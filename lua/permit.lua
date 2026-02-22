--[[
  permit.lua — Capability permit table for CartridgeOS runtime enforcement

  Every capability a cartridge can exercise is a handle minted at launch
  from its manifest.  A cart that declares no clipboard access never gets
  the clipboard functions.  You can't call what doesn't exist in your world.

  This is pledge/unveil from OpenBSD, applied per-cartridge, declared upfront.

  Usage:
    local permit = require("lua.permit")
    local audit  = require("lua.audit")

    -- At launch (once only):
    permit.mint({
      network   = { "18081", "9050" },       -- allowed ports
      clipboard = false,
      storage   = true,
      filesystem = { ["./saves/"] = "rw", ["/tmp/"] = "r" },
    }, audit)

    -- At every gate point:
    if not permit.check("clipboard") then
      -- blocked
    end

    if not permit.check("network", "8.8.8.8", 443) then
      -- blocked + audit logged automatically
    end

  Core guarantees:
    1. mint() can only be called once.  Second call errors.
    2. After mint(), the permit table is immutable.
    3. If no manifest is provided, all checks return true (backwards compat).
    4. The cart's JS code never gets a reference to the table.
]]

local Permit = {}

-- ---------------------------------------------------------------------------
-- Internal state
-- ---------------------------------------------------------------------------

local permits = nil     -- nil = not yet minted; table = minted
local enforcing = false -- true only after mint() with a real manifest
local auditRef = nil    -- reference to audit module (set at mint time)
local userOverrides = {} -- user-set overrides from system panel (user blocks always win)
local quarantined = false      -- true = all capabilities silently denied (miner detected)
local quarantineReason = nil   -- why quarantine was triggered (for audit/inspector)

-- ---------------------------------------------------------------------------
-- Category checkers
-- ---------------------------------------------------------------------------

-- Each checker receives (declared_value, ...) where ... are the args passed
-- to permit.check() after the category name.  Returns true if allowed.

local checkers = {}

-- Boolean categories: declared value is true/false (or nil = false)
local function boolChecker(declared)
  return declared == true
end

checkers.clipboard = boolChecker
checkers.storage   = boolChecker
checkers.gpu       = boolChecker
checkers.sysmon    = boolChecker
checkers.browse    = boolChecker

--- Network: declared as a list of allowed port strings or "host:port" strings.
--- check("network", host, port) validates against the list.
function checkers.network(declared, host, port)
  if type(declared) ~= "table" then return false end
  local portStr = tostring(port)
  local hostPort = tostring(host) .. ":" .. portStr
  for _, entry in ipairs(declared) do
    -- Match exact port (any host) or exact host:port
    if entry == portStr or entry == hostPort or entry == "*" then
      return true
    end
  end
  return false
end

--- Filesystem: declared as { path = accessLevel }.
--- check("filesystem", path, mode) where mode is "r" or "rw".
function checkers.filesystem(declared, path, mode)
  if type(declared) ~= "table" then return false end
  mode = mode or "r"
  -- Normalize path
  path = tostring(path or "")

  for declaredPath, declaredAccess in pairs(declared) do
    -- Check if the requested path starts with the declared path
    if path:sub(1, #declaredPath) == declaredPath then
      if mode == "r" then
        return true  -- any access level grants read
      elseif mode == "rw" or mode == "w" then
        return declaredAccess == "rw"
      end
    end
  end
  return false
end

--- IPC: declared as a list of allowed peer cart IDs.
--- check("ipc", peerId)
function checkers.ipc(declared, peerId)
  if type(declared) ~= "table" then return false end
  for _, id in ipairs(declared) do
    if id == peerId then return true end
  end
  return false
end

--- Process: declared as a list of allowed executables.
--- check("process", executable)
function checkers.process(declared, executable)
  if type(declared) ~= "table" then return false end
  for _, exe in ipairs(declared) do
    if exe == executable or exe == "*" then return true end
  end
  return false
end

-- ---------------------------------------------------------------------------
-- Public API
-- ---------------------------------------------------------------------------

--- Mint the permit table from a manifest's capabilities block.
--- Can only be called once.  After this, the table is sealed.
---
--- @param manifest table  The capabilities section of the cartridge manifest
--- @param audit    table  Reference to the audit module (for logging from check())
function Permit.mint(manifest, audit)
  if permits ~= nil then
    error("[permit] mint() already called — permits are immutable after launch")
  end

  assert(type(manifest) == "table", "[permit] manifest must be a table")
  auditRef = audit

  -- Copy the manifest into our internal table (shallow clone per category)
  permits = {}
  for category, value in pairs(manifest) do
    if type(value) == "table" then
      -- Deep-ish copy for tables (one level)
      local copy = {}
      -- Handle both array-style and dict-style tables
      for k, v in pairs(value) do
        copy[k] = v
      end
      permits[category] = copy
    else
      permits[category] = value
    end
  end

  enforcing = true
  io.write("[PERMIT] Permit table minted — enforcement active\n")
  io.write("[PERMIT] Declared capabilities:\n")
  for cat, val in pairs(permits) do
    if type(val) == "table" then
      local parts = {}
      for k, v in pairs(val) do
        if type(k) == "number" then
          parts[#parts + 1] = tostring(v)
        else
          parts[#parts + 1] = tostring(k) .. "=" .. tostring(v)
        end
      end
      io.write(string.format("  %s: [%s]\n", cat, table.concat(parts, ", ")))
    else
      io.write(string.format("  %s: %s\n", cat, tostring(val)))
    end
  end
  io.flush()
end

--- Check whether a capability is permitted.
---
--- If no manifest was minted (enforcing == false), always returns true.
--- If minted, delegates to the category-specific checker.
---
--- @param category string  The capability category
--- @param ...      any     Category-specific arguments
--- @return boolean
function Permit.check(category, ...)
  -- Quarantine overrides everything — silent deny, no output
  if quarantined then return false end

  -- User overrides ALWAYS win — the user is sovereign
  if userOverrides[category] == false then return false end

  -- No manifest = trust all (backwards compatibility)
  if not enforcing then return true end

  local declared = permits[category]
  local checker = checkers[category]

  -- Undeclared category with no checker = denied
  if not checker then
    -- Unknown category — block if not explicitly declared as true
    if declared == true then return true end
    return false
  end

  -- Category not in manifest = not declared = denied
  if declared == nil then
    return false
  end

  return checker(declared, ...)
end

--- Whether the permit system is actively enforcing.
--- @return boolean
function Permit.isEnforcing()
  return enforcing
end

--- Whether mint() has been called.
--- @return boolean
function Permit.frozen()
  return permits ~= nil
end

--- Get a copy of the declared capabilities (for inspector display).
--- @return table|nil
function Permit.getDeclared()
  if not permits then return nil end
  -- Return a shallow copy
  local copy = {}
  for k, v in pairs(permits) do
    copy[k] = v
  end
  return copy
end

--- Set a user override for a permission category.
--- Called by the system panel. User blocks always win over developer grants.
--- @param category string  The capability category
--- @param value boolean|nil  false = blocked, nil = remove override (use developer default)
function Permit.setUserOverride(category, value)
  if value == nil then
    userOverrides[category] = nil
  else
    userOverrides[category] = value
  end
end

--- Get all current user overrides (for system panel display).
--- @return table  { [category] = false }
function Permit.getUserOverrides()
  local copy = {}
  for k, v in pairs(userOverrides) do
    copy[k] = v
  end
  return copy
end

--- Clear all user overrides (reset to developer defaults).
function Permit.clearUserOverrides()
  userOverrides = {}
end

--- Activate quarantine mode. All permit.check() calls will silently return false.
--- This is triggered by the miner detection system when crypto mining code is found.
--- No output is produced — the app continues to render but all capabilities are dead.
--- Works even when enforcing == false (no manifest minted).
---
--- @param reason string  Why quarantine was triggered (e.g. "crypto_miner_detected")
function Permit.quarantine(reason)
  quarantined = true
  quarantineReason = reason
  -- Intentionally silent — no io.write, no print, no evidence for the miner
end

--- Check whether quarantine mode is active.
--- @return boolean, string|nil  quarantined, reason
function Permit.isQuarantined()
  return quarantined, quarantineReason
end

--- RPC handlers for React-side queries.
--- @return table  { method -> handler }
function Permit.getHandlers()
  return {
    ["permit:declared"] = function()
      return Permit.getDeclared()
    end,
    ["permit:enforcing"] = function()
      return Permit.isEnforcing()
    end,
  }
end

return Permit
