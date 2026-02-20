--[[
  sandbox.lua — CartridgeOS capability sandbox
  Loaded by init.c as the LuaJIT entry point, BEFORE main.lua.

  Saves references to real APIs, reads manifest + boot facts + verdict pipe,
  replaces globals with capability-gated wrappers, then runs main.lua.

  This file is packed into the .cart and verified by Ed25519 signature.
  Tamper with it → payload hash breaks → init.c rejects the cart.
]]

-- ── Save real APIs before sandboxing ─────────────────────────────────────────

local real_ffi       = require("ffi")
local real_io        = io
local real_os        = os
local real_require   = require
local real_dofile    = dofile
local real_loadstring = loadstring
local real_load      = load
local real_package   = package
local real_print     = print
local real_type      = type
local real_pairs     = pairs
local real_ipairs    = ipairs
local real_tostring  = tostring
local real_error     = error
local real_pcall     = pcall
local real_table     = table
local real_string    = string
local real_math      = math
local real_setmetatable = setmetatable

-- ── Read manifest ────────────────────────────────────────────────────────────

real_package.path = "/app/?.lua"
local json = real_dofile("/app/json.lua")

local manifest = {}
local mf = real_io.open("/app/manifest.json", "r")
if mf then
  local ok, result = real_pcall(json.decode, mf:read("*a"))
  if ok then manifest = result end
  mf:close()
end

local caps = manifest.capabilities or {}

local function has(cap)
  local v = caps[cap]
  return v and v ~= false
end

-- ── Read boot facts ──────────────────────────────────────────────────────────

local bootFacts = {}
local bf = real_io.open("/run/boot-facts", "r")
if bf then
  for line in bf:lines() do
    local k, v = line:match("^([%w_]+)=(.+)$")
    if k then bootFacts[k] = v end
  end
  bf:close()
end

-- ── Read verdict pipe (FD 3) ─────────────────────────────────────────────────

local verdictCode, verdictKeyId, verdictName = 0, "", "unknown"
local vf = real_io.open("/proc/self/fd/3", "rb")
if vf then
  local data = vf:read(17)
  vf:close()
  if data and #data >= 17 then
    verdictCode = data:byte(1)
    verdictKeyId = ""
    for i = 2, 9 do
      verdictKeyId = verdictKeyId .. string.format("%02x", data:byte(i))
    end
  end
end

local verdictNames = {
  [0] = "unsigned", [1] = "verified", [2] = "bad_sig",
  [3] = "bad_hash", [4] = "bad_format", [5] = "no_cart",
}
verdictName = verdictNames[verdictCode] or ("unknown:" .. verdictCode)

-- ── Expose boot info as read-only global ─────────────────────────────────────

CART_BOOT = {
  facts     = bootFacts,
  verdict   = verdictName,
  verdictCode = verdictCode,
  verdictKeyId = verdictKeyId,
  manifest  = manifest,
  caps      = caps,
  has       = has,
}

-- ── FFI sandbox ──────────────────────────────────────────────────────────────

local ffi_lib_whitelist = {
  SDL2 = true, GL = true, ["libGL.so.1"] = true,
}

local sandboxed_ffi = {
  cdef     = real_ffi.cdef,
  new      = real_ffi.new,
  cast     = real_ffi.cast,
  string   = real_ffi.string,
  fill     = real_ffi.fill,
  sizeof   = real_ffi.sizeof,
  typeof   = real_ffi.typeof,
  gc       = real_ffi.gc,
  metatype = real_ffi.metatype,
  istype   = real_ffi.istype,
  abi      = real_ffi.abi,
  load     = function(name)
    if ffi_lib_whitelist[name] then
      return real_ffi.load(name)
    end
    -- Allow .so files from /app/ (cart's own native code)
    if real_type(name) == "string" then
      -- Bare filename (no path separator) — resolves from LD_LIBRARY_PATH which includes /app
      if not name:find("/") and name:match("%.so") then
        return real_ffi.load(name)
      end
      -- Explicit /app/ path
      if name:match("^/app/") then
        return real_ffi.load(name)
      end
    end
    real_error("[sandbox] ffi.load blocked: " .. real_tostring(name), 2)
  end,
}

real_setmetatable(sandboxed_ffi, {
  __index = function(_, k)
    if k == "C" then
      real_error("[sandbox] ffi.C is blocked — use ffi.load() for approved libraries", 2)
    end
    return nil
  end,
  __newindex = function()
    real_error("[sandbox] cannot modify ffi table", 2)
  end,
})

_G.ffi = sandboxed_ffi

-- ── IO sandbox ───────────────────────────────────────────────────────────────

local function path_allowed(path, mode)
  if not path then return false end
  mode = mode or "r"

  -- Always allow: boot attestation
  if path == "/run/boot-facts" then return true end
  -- Always allow: verdict pipe
  if path:match("^/proc/self/fd/") then return true end
  -- Always allow: cart's own files
  if path:match("^/app/") then return true end
  -- Always allow: font files (read-only)
  if path:match("^/usr/share/fonts/") and (mode == "r" or mode == "rb") then return true end

  -- /proc, /sys require sysmon
  if path:match("^/proc/") or path:match("^/sys/") then
    return has("sysmon")
  end

  -- Everything else requires filesystem
  return has("filesystem")
end

_G.io = {
  write  = real_io.write,
  flush  = real_io.flush,
  stderr = real_io.stderr,
  stdout = real_io.stdout,
  read   = real_io.read,
  open   = function(path, mode)
    if path_allowed(path, mode) then
      return real_io.open(path, mode)
    end
    -- Determine which capability is missing
    local needed = "filesystem"
    if path and (path:match("^/proc/") or path:match("^/sys/")) then
      needed = "sysmon"
    end
    return nil, "[sandbox] blocked (requires " .. needed .. "): " .. real_tostring(path)
  end,
  popen = function(cmd)
    if has("process") then
      return real_io.popen(cmd)
    end
    return nil, "[sandbox] io.popen blocked (requires process capability)"
  end,
}

-- ── OS sandbox ───────────────────────────────────────────────────────────────

_G.os = {
  clock    = real_os.clock,
  time     = real_os.time,
  date     = real_os.date,
  difftime = real_os.difftime,
  execute  = function(cmd)
    if has("process") then
      return real_os.execute(cmd)
    end
    return nil, "[sandbox] os.execute blocked (requires process capability)"
  end,
}

-- ── Package / require sandbox ────────────────────────────────────────────────

package.path  = "/app/?.lua"
package.cpath = ""
package.loadlib = nil

-- Cache modules that are already loaded or need special handling
local mod_cache = {
  ffi = sandboxed_ffi,
  bit = real_require("bit"),
}

_G.require = function(name)
  if mod_cache[name] then return mod_cache[name] end
  -- Only allow loading from /app/
  if real_type(name) == "string" and name:match("^[%w_%.%-]+$") then
    local result = real_require(name)
    mod_cache[name] = result
    return result
  end
  real_error("[sandbox] require blocked: " .. real_tostring(name), 2)
end

-- ── Block code eval + debug ──────────────────────────────────────────────────

_G.loadstring = nil
_G.loadfile   = nil
_G.load       = nil
_G.debug      = nil
-- dofile is nil'd after we use it to launch main.lua

-- ── Log sandbox activation ───────────────────────────────────────────────────

local granted = {}
for k, v in real_pairs(caps) do
  if v and v ~= false then granted[#granted + 1] = k end
end
real_table.sort(granted)

real_io.write("[sandbox] active — " .. #granted .. " capabilities granted")
if #granted > 0 then
  real_io.write(": " .. real_table.concat(granted, ", "))
end
real_io.write("\n")
real_io.write("[sandbox] verdict: " .. verdictName .. "\n")
real_io.flush()

-- ── Launch the cart ──────────────────────────────────────────────────────────

real_dofile("/app/main.lua")

-- After main.lua exits, nil dofile too (no further code loading)
_G.dofile = nil
