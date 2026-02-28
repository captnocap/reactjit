--[[
  audit.lua — Structured audit logger for the permit system

  Logs every capability check (blocked or allowed-but-noteworthy) with
  timestamp, category, details, and Lua traceback.  Keeps an in-memory
  ring buffer (capped) for inspector queries.  Blocked attempts also
  print to stdout for immediate visibility.

  Usage:
    local audit = require("lua.audit")
    audit.log("blocked", "clipboard", { attempted = "read" }, { declared = false })
    audit.log("blocked", "network",  { host = "8.8.8.8", port = 443 }, { declared = {"18081"} })

    local entries = audit.getLog()        -- full ring buffer
    local n       = audit.getBlockedCount()
    audit.clear()                          -- reset (sandbox re-runs)
]]

local Audit = {}

-- ---------------------------------------------------------------------------
-- Ring buffer
-- ---------------------------------------------------------------------------

local MAX_ENTRIES = 1000
local entries = {}
local head = 0          -- next write index (0-based, wraps)
local count = 0         -- total entries stored (≤ MAX_ENTRIES)
local blockedCount = 0  -- running tally of blocked verdicts

-- ---------------------------------------------------------------------------
-- Public API
-- ---------------------------------------------------------------------------

--- Record an audit entry.
--- @param verdict   string   "blocked" | "allowed"
--- @param category  string   permit category (e.g. "network", "clipboard")
--- @param details   table    what was attempted (free-form)
--- @param context   table|nil  optional extra context (what was declared, etc.)
function Audit.log(verdict, category, details, context)
  local entry = {
    timestamp = os.time(),
    category  = category,
    details   = details or {},
    context   = context or {},
    traceback = debug.traceback("", 2),
    verdict   = verdict,
  }

  -- Write into ring buffer
  head = (head % MAX_ENTRIES) + 1   -- 1-based Lua index
  entries[head] = entry
  if count < MAX_ENTRIES then count = count + 1 end

  if verdict == "blocked" then
    blockedCount = blockedCount + 1

    -- Print to stdout for immediate visibility
    local detail_str = ""
    if details then
      local parts = {}
      for k, v in pairs(details) do
        parts[#parts + 1] = tostring(k) .. "=" .. tostring(v)
      end
      detail_str = table.concat(parts, ", ")
    end
    io.write(string.format(
      "[PERMIT] blocked: %s (%s)\n",
      category, detail_str
    ))
    io.flush()
  end
end

--- Return the full audit log as an ordered array (oldest → newest).
--- @return table[]
function Audit.getLog()
  if count == 0 then return {} end

  local result = {}
  if count < MAX_ENTRIES then
    -- Buffer hasn't wrapped yet — entries[1..count] in order
    for i = 1, count do
      result[#result + 1] = entries[i]
    end
  else
    -- Buffer has wrapped — read from (head+1) around to head
    for i = 1, MAX_ENTRIES do
      local idx = ((head + i - 1) % MAX_ENTRIES) + 1
      result[#result + 1] = entries[idx]
    end
  end
  return result
end

--- Return count of blocked attempts.
--- @return number
function Audit.getBlockedCount()
  return blockedCount
end

--- Return total entry count.
--- @return number
function Audit.getCount()
  return count
end

--- Clear the log (for sandbox re-runs).
function Audit.clear()
  entries = {}
  head = 0
  count = 0
  blockedCount = 0
end

--- RPC handlers for React-side queries.
--- @return table  { method -> handler }
function Audit.getHandlers()
  return {
    ["audit:log"] = function()
      return Audit.getLog()
    end,
    ["audit:blocked"] = function()
      return Audit.getBlockedCount()
    end,
    ["audit:clear"] = function()
      Audit.clear()
      return true
    end,
  }
end

return Audit
