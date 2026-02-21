--[[
  test_cart_main.lua — Test cart main.lua (Option C)
  Replaces main.lua in a test .cart for end-to-end sandbox validation.
  Runs inside the real CartridgeOS (QEMU), prints PASS/FAIL to stdout
  (which goes to serial), then halts the system.

  This tests the sandbox from INSIDE the cart — the real init.c extracts
  the cart, the real sandbox.lua applies restrictions, and this file
  exercises them. No mocking, no path patching — the real deal.
]]

local ffi = require("ffi")

-- ── Test framework ─────────────────────────────────────────────────────────

local pass, fail = 0, 0

local function test(name, condition)
  if condition then
    pass = pass + 1
    io.write("  PASS  " .. name .. "\n")
  else
    fail = fail + 1
    io.write("  FAIL  " .. name .. "\n")
  end
end

local function test_error(name, fn_to_test)
  local ok, err = pcall(fn_to_test)
  if not ok then
    pass = pass + 1
    io.write("  PASS  " .. name .. "\n")
  else
    fail = fail + 1
    io.write("  FAIL  " .. name .. " (expected error, got success)\n")
  end
end

io.write("\n")
io.write("========================================\n")
io.write("  CartridgeOS Sandbox Tests (in-cart)\n")
io.write("========================================\n\n")

-- ── CART_BOOT ──────────────────────────────────────────────────────────────
io.write("-- CART_BOOT --\n")
test("CART_BOOT exists",                   CART_BOOT ~= nil)
test("CART_BOOT.facts exists",             CART_BOOT and CART_BOOT.facts ~= nil)
test("CART_BOOT.verdict is string",        CART_BOOT and type(CART_BOOT.verdict) == "string")
test("CART_BOOT.manifest exists",          CART_BOOT and CART_BOOT.manifest ~= nil)
test("CART_BOOT.manifest.name correct",    CART_BOOT and CART_BOOT.manifest.name == "sandbox-test-cart")
test("CART_BOOT.caps exists",              CART_BOOT and CART_BOOT.caps ~= nil)
test("CART_BOOT.has is function",          CART_BOOT and type(CART_BOOT.has) == "function")
test("CART_BOOT.eval is function",         CART_BOOT and type(CART_BOOT.eval) == "function")

-- ── Pre-read facts ─────────────────────────────────────────────────────────
io.write("\n-- Pre-read system facts --\n")
local facts = CART_BOOT and CART_BOOT.facts or {}
test("kernel populated",                  facts.kernel ~= nil and facts.kernel ~= "")
test("uptime populated",                  facts.uptime ~= nil)
io.write("  INFO  kernel=" .. tostring(facts.kernel) .. "\n")
io.write("  INFO  uptime=" .. tostring(facts.uptime) .. "\n")
io.write("  INFO  dri=" .. tostring(facts.dri) .. "\n")

-- ── Namespace attestation (Layer 2) ──────────────────────────────────────
io.write("\n-- Namespace attestation --\n")
local ns = facts.namespaces or ""
test("namespaces fact exists",             facts.namespaces ~= nil)
test("net namespace active",               ns:find("net") ~= nil)
test("mnt namespace active",               ns:find("mnt") ~= nil)
test("pid namespace active",               ns:find("pid") ~= nil)
io.write("  INFO  namespaces=" .. tostring(facts.namespaces) .. "\n")

-- Mount namespace: /etc should be invisible (no bind mount for it)
local fh_ns, err_ns = io.open("/etc/passwd", "r")
if fh_ns then
  -- The Lua sandbox may block this first, but if mount ns is active
  -- and Lua sandbox is bypassed, /etc/passwd simply wouldn't exist.
  -- Either way, we should NOT get a valid file handle.
  fh_ns:close()
  test("mount ns: /etc/passwd invisible", false)
else
  test("mount ns: /etc/passwd invisible", true)
  io.write("  INFO  /etc/passwd error: " .. tostring(err_ns) .. "\n")
end

-- PID namespace: we should be PID 1 (or at least a low PID)
-- Can't easily test this without /proc (no sysmon cap), so just check the fact
test("pid namespace in boot-facts",        ns:find("pid") ~= nil)

-- ── Nil'd globals ──────────────────────────────────────────────────────────
io.write("\n-- Nil'd globals --\n")
test("loadstring nil",                    loadstring == nil)
test("loadfile nil",                      loadfile == nil)
test("load nil",                          load == nil)
test("debug nil",                         debug == nil)
test("package nil",                       package == nil)
test("getfenv nil",                       getfenv == nil)
test("setfenv nil",                       setfenv == nil)
test("newproxy nil",                      newproxy == nil)
test("module nil",                        module == nil)
test("collectgarbage nil",                collectgarbage == nil)

-- ── _G write lock ──────────────────────────────────────────────────────────
io.write("\n-- _G write lock --\n")
test_error("loadstring = x",             function() loadstring = function() end end)
test_error("debug = x",                  function() debug = {} end)
test_error("package = x",               function() package = {} end)
test_error("collectgarbage = x",         function() collectgarbage = function() end end)

-- New globals should work
local ok = pcall(function() _G.__test_var = 42 end)
test("new globals work",                 ok and _G.__test_var == 42)

-- ── Protected tables ───────────────────────────────────────────────────────
io.write("\n-- Protected tables --\n")
test_error("rawset(ffi, ..)",            function() rawset(ffi, "x", 1) end)
test_error("rawset(io, ..)",             function() rawset(io, "x", 1) end)
test_error("rawset(os, ..)",             function() rawset(os, "x", 1) end)
test_error("rawset(CART_BOOT, ..)",      function() rawset(CART_BOOT, "x", 1) end)
test_error("rawset(_G, 'io', ..)",       function() rawset(_G, "io", {}) end)
test_error("rawget(ffi, ..)",            function() rawget(ffi, "cdef") end)
test_error("rawget(io, ..)",             function() rawget(io, "open") end)
test_error("setmetatable(ffi, ..)",      function() setmetatable(ffi, {}) end)
test_error("setmetatable(io, ..)",       function() setmetatable(io, {}) end)
test_error("setmetatable(os, ..)",       function() setmetatable(os, {}) end)
test_error("setmetatable(CART_BOOT, ..)", function() setmetatable(CART_BOOT, {}) end)

test("getmetatable(ffi) == false",       getmetatable(ffi) == false)
test("getmetatable(io) == false",        getmetatable(io) == false)
test("getmetatable(os) == false",        getmetatable(os) == false)
test("getmetatable(CART_BOOT) == false", getmetatable(CART_BOOT) == false)
test("getmetatable('') == false",        getmetatable("") == false)

-- ── FFI sandbox ────────────────────────────────────────────────────────────
io.write("\n-- FFI sandbox --\n")
test("ffi exists",                       ffi ~= nil)
test("ffi.cdef exists",                  type(ffi.cdef) == "function")
test("ffi.new exists",                   type(ffi.new) == "function")
test_error("ffi.C blocked",             function() local _ = ffi.C end)
test_error("ffi.cast int-to-ptr",        function() ffi.cast("uint8_t*", 42) end)
test_error("ffi.load('libc')",           function() ffi.load("libc") end)
test_error("ffi table immutable",        function() ffi.evil = true end)

-- Pointer-to-pointer cast should work
ok = pcall(function()
  local buf = ffi.new("uint8_t[4]", 1, 2, 3, 4)
  local vp = ffi.cast("void*", buf)
  local bp = ffi.cast("uint8_t*", vp)
  assert(bp[0] == 1)
end)
test("ffi.cast ptr-to-ptr works",       ok)

-- ffi.load whitelist (SDL2, GL should work in the real OS)
local sdl_ok = pcall(function() ffi.load("SDL2") end)
test("ffi.load('SDL2') works",          sdl_ok)
local gl_ok = pcall(function() ffi.load("GL") end)
test("ffi.load('GL') works",            gl_ok)

-- ── IO sandbox ─────────────────────────────────────────────────────────────
io.write("\n-- IO sandbox --\n")

-- /app/ always allowed
local fh, err = io.open("/app/manifest.json", "r")
test("io.open /app/manifest.json works", fh ~= nil)
if fh then fh:close() end

-- Blocked: /etc (no filesystem cap)
fh, err = io.open("/etc/passwd", "r")
test("io.open /etc/passwd blocked",      fh == nil)
test("error mentions filesystem",        err and err:find("filesystem") ~= nil)

-- Blocked: /proc (no sysmon cap)
fh, err = io.open("/proc/cpuinfo", "r")
test("io.open /proc/cpuinfo blocked",   fh == nil)
test("error mentions sysmon",           err and err:find("sysmon") ~= nil)

-- Blocked: only fd/3 allowed, not fd/4
fh, err = io.open("/proc/self/fd/4", "r")
test("io.open /proc/self/fd/4 blocked", fh == nil)

-- io.popen blocked (no process cap)
fh, err = io.popen("echo test")
test("io.popen blocked",                fh == nil)
test("error mentions process",          err and err:find("process") ~= nil)

-- stdout always works
test("io.write exists",                 io.write ~= nil)
test("io.flush exists",                 io.flush ~= nil)

-- ── OS sandbox ─────────────────────────────────────────────────────────────
io.write("\n-- OS sandbox --\n")
test("os.clock works",                  type(os.clock) == "function")
test("os.time works",                   type(os.time) == "function")

local result, err = os.execute("echo test")
test("os.execute blocked",              result == nil)

test("os.exit absent",                  os.exit == nil)
test("os.getenv absent",                os.getenv == nil)

-- ── require sandbox ────────────────────────────────────────────────────────
io.write("\n-- require sandbox --\n")
test("require('ffi') = sandboxed ffi",  require("ffi") == ffi)
test("require('bit') works",            require("bit") ~= nil)
test_error("require path traversal",    function() require("../../etc/passwd") end)

-- ── CART_BOOT.eval ─────────────────────────────────────────────────────────
io.write("\n-- CART_BOOT.eval --\n")
local ok2, res = CART_BOOT.eval("1 + 2")
test("eval 1+2 = 3",                    ok2 and res == "3")

ok2, res = CART_BOOT.eval("loadstring")
test("eval sees nil loadstring",         ok2 and res == "nil")

ok2, res = CART_BOOT.eval("error('boom')")
test("eval catches errors",             not ok2 and res:find("boom"))

ok2, res = CART_BOOT.eval("io.open('/etc/passwd')")
test("eval io.open blocked",            ok2 and res:find("sandbox"))

-- ── Summary ────────────────────────────────────────────────────────────────
io.write("\n========================================\n")
io.write("  Results: " .. pass .. " passed, " .. fail .. " failed\n")
io.write("========================================\n")

if fail == 0 then
  io.write("  ALL TESTS PASSED\n")
else
  io.write("  SOME TESTS FAILED\n")
end
io.write("\n")
io.flush()

-- Signal completion via exit code on the serial line
-- In CartridgeOS, we can't os.exit (it's nil'd), so we write a sentinel
-- that the test runner can grep for, then loop forever.
io.write("TEST_COMPLETE:" .. (fail == 0 and "PASS" or "FAIL") .. "\n")
io.flush()

-- Halt: write to /proc/sysrq-trigger if we can, otherwise just spin
-- (The test runner will kill QEMU after seeing TEST_COMPLETE)
pcall(function()
  -- This needs filesystem cap which we don't have, but try anyway
  local f = io.open("/proc/sysrq-trigger", "w")
  if f then f:write("o"); f:close() end
end)

-- Spin — QEMU runner will kill us
while true do
  -- busy wait (os.execute is blocked, no sleep available)
  local t = os.clock()
  while os.clock() - t < 1 do end
end
