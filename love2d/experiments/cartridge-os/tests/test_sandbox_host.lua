--[[
  test_sandbox_host.lua — Host-side sandbox test harness (Option A)
  Run with: luajit tests/test_sandbox_host.lua
  From:     experiments/cartridge-os/

  Loads sandbox.lua on the host with mocked paths, then exercises
  every sandbox protection. No QEMU needed — runs in under a second.
]]

local real_io        = io
local real_os        = os
local real_print     = print
local real_loadstring = loadstring
local real_dofile    = dofile
local real_tostring  = tostring

-- ── Setup mock filesystem ──────────────────────────────────────────────────

local TEST_DIR = "/tmp/cart-sandbox-test"

os.execute("rm -rf " .. TEST_DIR)
os.execute("mkdir -p " .. TEST_DIR .. "/app")
os.execute("mkdir -p " .. TEST_DIR .. "/run")

-- Mock manifest — gpu, keyboard, mouse granted; NO filesystem, sysmon, process
local f = real_io.open(TEST_DIR .. "/app/manifest.json", "w")
f:write('{"name":"sandbox-test","version":"0.1.0","capabilities":{"gpu":true,"keyboard":true,"mouse":true}}')
f:close()

-- Copy json.lua (sandbox needs it to parse manifest)
local SCRIPT_DIR = arg[0]:match("(.*/)")
if not SCRIPT_DIR then SCRIPT_DIR = "./" end
-- We're run from experiments/cartridge-os/
os.execute("cp app/json.lua " .. TEST_DIR .. "/app/")

-- Mock boot-facts
f = real_io.open(TEST_DIR .. "/run/boot-facts", "w")
f:write("kernel=6.1.0-test\n")
f:write("uptime=42\n")
f:write("manifest_hash=abc123\n")
f:write("namespaces=net,mnt,pid\n")
f:close()

-- Mock verdict pipe: open verdict data on FD 3 so sandbox.lua can read it
-- via real_ffi.C.read(3, ...) just like in the real boot.
f = real_io.open(TEST_DIR .. "/verdict", "wb")
f:write(string.char(1))                          -- verdict code 1 = verified
f:write(string.char(0xDE, 0xAD, 0xBE, 0xEF,     -- key_id bytes
                     0xCA, 0xFE, 0xBA, 0xBE))
f:write(string.rep(string.char(0), 8))            -- padding
f:close()

-- Place the verdict data on FD 3 so the FFI-based read works
local ffi_setup = require("ffi")
ffi_setup.cdef[[
  int open(const char *path, int flags);
  int dup2(int oldfd, int newfd);
  int close(int fd);
]]
local vfd = ffi_setup.C.open(TEST_DIR .. "/verdict", 0)  -- O_RDONLY = 0
if vfd >= 0 then
  ffi_setup.C.dup2(vfd, 3)
  if vfd ~= 3 then ffi_setup.C.close(vfd) end
end

-- ── Load and patch sandbox.lua ─────────────────────────────────────────────

local sf = real_io.open("app/sandbox.lua", "r")
if not sf then
  print("ERROR: run from experiments/cartridge-os/ directory")
  os.exit(1)
end
local src = sf:read("*a")
sf:close()

-- Surgically redirect only the SETUP reads (not the path_allowed rules).
-- The sandbox's path_allowed function keeps its original /app/, /proc/, /sys/
-- checks so we can test them properly.

-- Manifest read
src = src:gsub(
  'real_io%.open%("/app/manifest%.json", "r"%)',
  'real_io.open("' .. TEST_DIR .. '/app/manifest.json", "r")')

-- json.lua load
src = src:gsub(
  'real_dofile%("/app/json%.lua"%)',
  'real_dofile("' .. TEST_DIR .. '/app/json.lua")')

-- Boot-facts read
src = src:gsub(
  'real_io%.open%("/run/boot%-facts", "r"%)',
  'real_io.open("' .. TEST_DIR .. '/run/boot-facts", "r")')

-- Verdict pipe: no longer needs patching — sandbox reads FD 3 directly via FFI,
-- and we placed the mock data on FD 3 above.

-- package.path setup (both occurrences)
src = src:gsub(
  'real_package%.path = "/app/%?%.lua"',
  'real_package.path = "' .. TEST_DIR .. '/app/?.lua"')
src = src:gsub(
  'package%.path  = "/app/%?%.lua"',
  'package.path = "' .. TEST_DIR .. '/app/?.lua"')

-- Skip DRI listing (no /dev/dri on host)
src = src:gsub(
  'real_io%.popen%("ls /dev/dri/ 2>/dev/null"%)',
  'nil')

-- Skip main.lua launch
src = src:gsub(
  'real_dofile%("/app/main%.lua"%)',
  '-- [test] skip main.lua launch')

-- Skip the post-main dofile nil (would trigger __newindex block for dofile)
src = src:gsub(
  '_G%.dofile = nil',
  '-- [test] skip dofile nil')

-- ── Run the sandbox ────────────────────────────────────────────────────────

local fn, err = real_loadstring(src, "sandbox.lua")
if not fn then
  print("FAIL: sandbox.lua failed to load: " .. tostring(err))
  os.exit(1)
end

fn()

-- ── Test framework ─────────────────────────────────────────────────────────
-- We're now in the sandboxed environment. io.write, pcall, tostring work.

local pass, fail, skip = 0, 0, 0

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
    local short = tostring(err)
    if #short > 70 then short = short:sub(1, 70) .. "..." end
    io.write("  PASS  " .. name .. "\n")
  else
    fail = fail + 1
    io.write("  FAIL  " .. name .. " (expected error, got success)\n")
  end
end

local function test_nil_return(name, fn_to_test)
  local ok, result = pcall(fn_to_test)
  if ok and result == nil then
    pass = pass + 1
    io.write("  PASS  " .. name .. "\n")
  elseif ok then
    fail = fail + 1
    io.write("  FAIL  " .. name .. " (expected nil, got: " .. tostring(result) .. ")\n")
  else
    fail = fail + 1
    io.write("  FAIL  " .. name .. " (unexpected error: " .. tostring(result) .. ")\n")
  end
end

-- ── Tests ──────────────────────────────────────────────────────────────────

io.write("\n=== CartridgeOS Sandbox Tests (host) ===\n\n")

-- ── CART_BOOT structure ────────────────────────────────────────────────────
io.write("-- CART_BOOT structure --\n")
test("CART_BOOT exists",                   CART_BOOT ~= nil)
test("CART_BOOT.facts exists",             CART_BOOT.facts ~= nil)
test("CART_BOOT.verdict is 'verified'",    CART_BOOT.verdict == "verified")
test("CART_BOOT.verdictCode is 1",         CART_BOOT.verdictCode == 1)
test("CART_BOOT.verdictKeyId populated",   CART_BOOT.verdictKeyId ~= nil and #CART_BOOT.verdictKeyId > 0)
test("CART_BOOT.manifest exists",          CART_BOOT.manifest ~= nil)
test("CART_BOOT.manifest.name correct",    CART_BOOT.manifest.name == "sandbox-test")
test("CART_BOOT.caps.gpu is true",         CART_BOOT.caps.gpu == true)
test("CART_BOOT.caps.keyboard is true",    CART_BOOT.caps.keyboard == true)
test("CART_BOOT.has('gpu') works",         CART_BOOT.has("gpu") == true)
test("CART_BOOT.has('filesystem') false",  not CART_BOOT.has("filesystem"))
test("CART_BOOT.has('sysmon') false",      not CART_BOOT.has("sysmon"))
test("CART_BOOT.has('process') false",     not CART_BOOT.has("process"))
test("CART_BOOT.eval exists",              type(CART_BOOT.eval) == "function")

-- ── Pre-read system facts ──────────────────────────────────────────────────
io.write("\n-- Pre-read system facts --\n")
test("facts.kernel populated",            CART_BOOT.facts.kernel ~= nil)
-- uptime may or may not be populated depending on host /proc
test("facts.manifest_hash from file",     CART_BOOT.facts.manifest_hash == "abc123")

-- ── Nil'd globals ──────────────────────────────────────────────────────────
io.write("\n-- Nil'd globals --\n")
test("loadstring is nil",                 loadstring == nil)
test("loadfile is nil",                   loadfile == nil)
test("load is nil",                       load == nil)
test("debug is nil",                      debug == nil)
test("package is nil",                    package == nil)
test("getfenv is nil",                    getfenv == nil)
test("setfenv is nil",                    setfenv == nil)
test("newproxy is nil",                   newproxy == nil)
test("module is nil",                     module == nil)
test("collectgarbage is nil",             collectgarbage == nil)

-- ── _G write lock (re-introduction of blocked globals) ─────────────────────
io.write("\n-- _G write lock --\n")
test_error("_G.loadstring = x blocked",   function() loadstring = function() end end)
test_error("_G.debug = x blocked",        function() debug = {} end)
test_error("_G.package = x blocked",      function() package = {} end)
test_error("_G.load = x blocked",         function() load = function() end end)
test_error("_G.collectgarbage = x blocked", function() collectgarbage = function() end end)
-- New globals should still work
local new_global_ok = pcall(function() _G.myTestVar = 42 end)
test("new globals still work",            new_global_ok and _G.myTestVar == 42)

-- ── Protected tables ───────────────────────────────────────────────────────
io.write("\n-- Protected tables --\n")
test_error("rawset(ffi, ...) blocked",    function() rawset(ffi, "test", true) end)
test_error("rawset(io, ...) blocked",     function() rawset(io, "open", nil) end)
test_error("rawset(os, ...) blocked",     function() rawset(os, "execute", nil) end)
test_error("rawset(CART_BOOT, ..) blocked", function() rawset(CART_BOOT, "verdict", "hacked") end)
test_error("rawset(_G, 'io', ..) blocked", function() rawset(_G, "io", {}) end)

test_error("rawget(ffi, ...) blocked",    function() rawget(ffi, "cdef") end)
test_error("rawget(io, ...) blocked",     function() rawget(io, "open") end)
test_error("rawget(CART_BOOT, ..) blocked", function() rawget(CART_BOOT, "verdict") end)

test_error("setmetatable(ffi, ..) blocked",     function() setmetatable(ffi, {}) end)
test_error("setmetatable(io, ..) blocked",      function() setmetatable(io, {}) end)
test_error("setmetatable(os, ..) blocked",      function() setmetatable(os, {}) end)
test_error("setmetatable(CART_BOOT, ..) blocked", function() setmetatable(CART_BOOT, {}) end)

test("getmetatable(ffi) returns false",   getmetatable(ffi) == false)
test("getmetatable(io) returns false",    getmetatable(io) == false)
test("getmetatable(os) returns false",    getmetatable(os) == false)
test("getmetatable(CART_BOOT) returns false", getmetatable(CART_BOOT) == false)
test("getmetatable('') returns false",    getmetatable("") == false)

-- ── String metatable frozen ────────────────────────────────────────────────
io.write("\n-- String metatable --\n")
test("getmetatable('') is false",         getmetatable("") == false)
-- Can't directly test __newindex since we can't get the real metatable,
-- but that's the point — it's hidden.

-- ── FFI sandbox ────────────────────────────────────────────────────────────
io.write("\n-- FFI sandbox --\n")
test("ffi exists",                        ffi ~= nil)
test("ffi.cdef exists",                   type(ffi.cdef) == "function")
test("ffi.new exists",                    type(ffi.new) == "function")
test("ffi.cast exists",                   type(ffi.cast) == "function")
test("ffi.string exists",                 type(ffi.string) == "function")
test("ffi.sizeof exists",                 type(ffi.sizeof) == "function")
test_error("ffi.C blocked",              function() local _ = ffi.C end)
test_error("ffi.cast int-to-ptr blocked", function() ffi.cast("uint8_t*", 0x7fff0000) end)
test_error("ffi.load('libc') blocked",    function() ffi.load("libc") end)
test_error("ffi table immutable",         function() ffi.evil = true end)

-- Pointer-to-pointer cast should work
local ptr_cast_ok = pcall(function()
  local buf = ffi.new("uint8_t[4]", 1, 2, 3, 4)
  local vp = ffi.cast("void*", buf)
  local bp = ffi.cast("uint8_t*", vp)
  assert(bp[0] == 1)
end)
test("ffi.cast ptr-to-ptr works",        ptr_cast_ok)

-- ── IO sandbox ─────────────────────────────────────────────────────────────
io.write("\n-- IO sandbox --\n")
-- Blocked paths (no filesystem capability)
local fh, err = io.open("/etc/passwd", "r")
test("io.open /etc/passwd blocked",       fh == nil)
test("io.open error mentions filesystem", err and err:find("filesystem") ~= nil)

-- Blocked /proc (no sysmon capability)
fh, err = io.open("/proc/cpuinfo", "r")
test("io.open /proc/cpuinfo blocked",    fh == nil)
test("io.open error mentions sysmon",    err and err:find("sysmon") ~= nil)

-- Blocked /sys (no sysmon capability)
fh, err = io.open("/sys/class/drm", "r")
test("io.open /sys/class/drm blocked",   fh == nil)

-- Blocked FDs (only /proc/self/fd/3 allowed)
fh, err = io.open("/proc/self/fd/4", "r")
test("io.open /proc/self/fd/4 blocked",  fh == nil)

-- /app/ should be allowed
fh, err = io.open("/app/manifest.json", "r")
-- On host /app doesn't exist, so fh is nil but NOT from sandbox blocking
-- We can't test this properly on host — skip
io.write("  SKIP  io.open /app/* (no /app on host)\n")
skip = skip + 1

-- io.write and io.flush should always work
test("io.write works",                   io.write ~= nil)
test("io.flush works",                   io.flush ~= nil)

-- io.popen blocked (no process capability)
fh, err = io.popen("echo test")
test("io.popen blocked",                 fh == nil)
test("io.popen error mentions process",  err and err:find("process") ~= nil)

-- ── OS sandbox ─────────────────────────────────────────────────────────────
io.write("\n-- OS sandbox --\n")
test("os.clock works",                   type(os.clock) == "function" and os.clock() > 0)
test("os.time works",                    type(os.time) == "function" and os.time() > 0)
test("os.date works",                    type(os.date) == "function")

-- os.execute blocked (no process capability)
local result, err = os.execute("echo test")
test("os.execute blocked",               result == nil)
test("os.execute error mentions process", err and err:find("process") ~= nil)

-- Dangerous os functions removed
test("os.exit absent",                   os.exit == nil)
test("os.getenv absent",                 os.getenv == nil)
test("os.rename absent",                 os.rename == nil)
test("os.remove absent",                 os.remove == nil)

-- ── require sandbox ────────────────────────────────────────────────────────
io.write("\n-- require sandbox --\n")
test("require('ffi') returns sandboxed",  require("ffi") == ffi)
test("require('bit') works",             require("bit") ~= nil)
test_error("require with path chars",    function() require("../../etc/passwd") end)

-- ── CART_BOOT.eval ─────────────────────────────────────────────────────────
io.write("\n-- CART_BOOT.eval --\n")
-- Expression eval
local ok, result = CART_BOOT.eval("1 + 2")
test("eval expression works",            ok == true and result == "3")

-- Statement eval
ok, result = CART_BOOT.eval("local x = 42")
test("eval statement works",             ok == true)

-- Eval runs in sandboxed env
ok, result = CART_BOOT.eval("loadstring")
test("eval sees nil loadstring",          ok == true and result == "nil")

-- Eval catches errors
ok, result = CART_BOOT.eval("error('boom')")
test("eval catches errors",              ok == false and result:find("boom"))

-- Eval shows multi-return (nil holes)
ok, result = CART_BOOT.eval("io.open('/etc/passwd')")
test("eval shows sandbox block msg",     ok == true and result:find("sandbox"))

-- ── Namespace tests (Layer 2 — kernel-level, N/A on host) ────────────────

io.write("\n-- Namespace tests (SKIP: requires kernel namespaces) --\n")
io.write("  SKIP  net namespace active (requires CLONE_NEWNET)\n"); skip = skip + 1
io.write("  SKIP  mnt namespace active (requires CLONE_NEWNS)\n"); skip = skip + 1
io.write("  SKIP  pid namespace active (requires CLONE_NEWPID)\n"); skip = skip + 1
io.write("  SKIP  mount ns: /etc/passwd invisible (requires pivot_root)\n"); skip = skip + 1

-- But we CAN verify the boot-facts namespace field was parsed
test("boot-facts has namespaces",          CART_BOOT.facts.namespaces ~= nil)
test("boot-facts namespaces=net,mnt,pid",  CART_BOOT.facts.namespaces == "net,mnt,pid")

-- ── Summary ────────────────────────────────────────────────────────────────

io.write("\n=== Results: " .. pass .. " passed, " .. fail .. " failed, " .. skip .. " skipped ===\n\n")

-- Cleanup
real_os.execute("rm -rf " .. TEST_DIR)

if fail > 0 then
  real_os.exit(1)
else
  real_os.exit(0)
end
