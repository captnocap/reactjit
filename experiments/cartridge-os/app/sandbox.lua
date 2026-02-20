--[[
  sandbox.lua — CartridgeOS capability sandbox
  Lives at /os/sandbox.lua in the OS rootfs, NOT in the cart.
  Loaded by init.c as the LuaJIT entry point, BEFORE main.lua.

  The cart cannot replace or modify this file. init.c runs:
    execv("/usr/bin/luajit", "/os/sandbox.lua")
  NOT /app/sandbox.lua. The jailer is part of the OS, not the payload.

  Saves references to real APIs, reads manifest + boot facts + verdict pipe,
  replaces globals with capability-gated wrappers, then runs main.lua.
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
-- TRUST MODEL: FFI is available because carts are Ed25519-signed by a trusted
-- key. The sandbox gates capabilities (gpu, filesystem, etc.) as a UX layer,
-- but FFI + /app/*.so means a signed cart has full native access if it wants.
-- For untrusted carts: remove FFI entirely (_G.ffi = nil) and provide narrow
-- OS APIs instead. That's Phase 2 Layer 3 (kernel cage + seccomp).
--
-- Current hardening: block ffi.C, block integer-to-pointer casts, whitelist
-- ffi.load to SDL2/GL + cart's own .so files.

local ffi_lib_whitelist = {
  SDL2 = true, GL = true, ["libGL.so.1"] = true,
}

-- Wrap ffi.cast to block integer-to-pointer forgery.
-- Allowed: pointer-to-pointer casts (e.g. ffi.cast("SDL_MouseMotionEvent*", event))
-- Blocked: integer-to-pointer (e.g. ffi.cast("uint8_t*", 0x7fff0000) = arbitrary memory)
local real_ffi_cast = real_ffi.cast
local function safe_ffi_cast(ct, val)
  -- If val is a Lua number (not cdata), block it — that's integer-to-pointer
  if real_type(val) == "number" then
    real_error("[sandbox] ffi.cast blocked: integer-to-pointer cast (use cdata pointers only)", 2)
  end
  return real_ffi_cast(ct, val)
end

local sandboxed_ffi = {
  cdef     = real_ffi.cdef,
  new      = real_ffi.new,
  cast     = safe_ffi_cast,
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
  -- Allow only FD 3 (verdict pipe) — not the full /proc/self/fd/ namespace.
  -- Other FDs could leak device nodes, sockets, or privileged handles.
  if path == "/proc/self/fd/3" then return true end
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

-- Remove package from globals. Cart code cannot mutate package.path,
-- package.loaded, package.preload, or package.searchers. Our custom
-- require above is the only module entry point.
_G.package = nil

-- ── Block code eval + debug ──────────────────────────────────────────────────

_G.loadstring = nil
_G.loadfile   = nil
_G.load       = nil
_G.debug      = nil
-- dofile is nil'd after we use it to launch main.lua

-- ── Block environment manipulation (Lua 5.1 / LuaJIT escape hatches) ────────

_G.getfenv   = nil
_G.setfenv   = nil
_G.newproxy  = nil
_G.module    = nil

-- ── Protect string metatable ────────────────────────────────────────────────
-- getmetatable("") returns the string metatable. An attacker can poison it
-- to inject code into every string operation. Lock it down.

local string_mt = getmetatable("")
if string_mt then
  -- __metatable on the string metatable itself: getmetatable("") returns this
  -- value instead of the real table. Setting to false hides it.
  string_mt.__metatable = false

  -- Freeze the table: prevent adding/replacing methods on the string metatable.
  -- We set a meta-metatable with __newindex blocked.
  real_setmetatable(string_mt, {
    __newindex = function()
      real_error("[sandbox] cannot modify string metatable", 2)
    end,
  })
end

-- ── Restricted metatable / raw access ────────────────────────────────────────
-- Full rawset/rawget/setmetatable/getmetatable let cart code bypass our frozen
-- metatables. We provide restricted versions that block access to protected
-- tables but allow normal Lua patterns (e.g. json.lua needs rawget, gl.lua
-- needs setmetatable for lazy dispatch).

local real_rawset       = rawset
local real_rawget       = rawget
local real_getmetatable = getmetatable

-- Tables that cart code must not modify or inspect
local protected_tables = {}
protected_tables[sandboxed_ffi] = true
-- string metatable is already hidden via __metatable = false

_G.rawget = real_rawget  -- rawget on non-protected tables is safe (read-only)

_G.rawset = function(t, k, v)
  if protected_tables[t] then
    real_error("[sandbox] rawset blocked on protected table", 2)
  end
  return real_rawset(t, k, v)
end

_G.setmetatable = function(t, mt)
  if protected_tables[t] then
    real_error("[sandbox] setmetatable blocked on protected table", 2)
  end
  return real_setmetatable(t, mt)
end

_G.getmetatable = function(obj)
  -- getmetatable respects __metatable field, so protected objects that set
  -- __metatable = false will return false. This is safe.
  return real_getmetatable(obj)
end

-- ── Block collectgarbage (DoS vector) ───────────────────────────────────────

_G.collectgarbage = nil

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
