#!/usr/bin/env luajit
-- link.lua — LuaJIT linker for ReactJIT carts
-- DO NOT TOUCH THIS FILE. DO NOT "IMPROVE" IT. DO NOT ADD BACK .a LINKING.
--
-- Two steps:
--   1. zig build-obj  source.zig → .o  (Zig x86 backend, no LLVM)
--   2. zig cc          .o + engine .so → native binary
--
-- Usage: luajit scripts/link.lua <generated_app.zig> [app-name]

-- ── Paths ───────────────────────────────────────────────────────────
local SCRIPT_DIR = arg[0]:match("(.*/)") or "./"
local TSZ_DIR = SCRIPT_DIR:match("(.-)scripts/") or "./"
local REPO_ROOT = TSZ_DIR .. "../"

local ENGINE_SO = TSZ_DIR .. "zig-out/lib/libreactjit-core.so"
local QJS_INCLUDE = REPO_ROOT .. "love2d/quickjs"
local FFI_INCLUDE = TSZ_DIR .. "ffi"

-- ── Args ────────────────────────────────────────────────────────────
local source = arg[1]
if not source then
    io.stderr:write("Usage: luajit scripts/link.lua <generated_app.zig> [app-name]\n")
    os.exit(1)
end

local name = arg[2]
if not name then
    name = source:match("generated_(.+)%.zig$") or source:match("([^/]+)%.zig$") or "app"
end

local outdir = TSZ_DIR .. "zig-out/bin"
-- zig build-obj outputs basename.o in cwd, not next to source
local obj_name = source:match("([^/]+)%.zig$"):gsub("%.zig$", "") .. ".o"
local binary = outdir .. "/" .. name

-- ── Helpers ─────────────────────────────────────────────────────────
local function run(cmd)
    local ok = os.execute(cmd)
    if ok ~= 0 then return false end
    return true
end

local function file_exists(path)
    local f = io.open(path, "r")
    if f then f:close(); return true end
    return false
end

local function now_ms()
    local f = io.popen("date +%s%3N")
    local t = tonumber(f:read("*l"))
    f:close()
    return t
end

-- ── Preflight ───────────────────────────────────────────────────────
if not file_exists(ENGINE_SO) then
    io.stderr:write("[link] Engine .so not found at " .. ENGINE_SO .. "\n")
    io.stderr:write("[link] Build it: zig build core-so -Doptimize=ReleaseFast\n")
    os.exit(1)
end

os.execute("mkdir -p " .. outdir)

-- ── Step 1: Compile cart .zig → .o ──────────────────────────────────
local t0 = now_ms()

local compile_cmd = table.concat({
    "zig build-obj",
    source,
    "-I " .. QJS_INCLUDE,
    "-I " .. FFI_INCLUDE,
    "-I /usr/include/x86_64-linux-gnu",
    "-lc",
    "-ODebug", "-fstrip",
}, " ")

io.write("[link] compile " .. source .. "... ")
io.flush()
if not run(compile_cmd .. " 2>&1") then
    io.write("FAILED\n")
    os.exit(1)
end
local t1 = now_ms()
io.write(tostring(t1 - t0) .. "ms\n")

-- ── Step 2: Link .o + engine .so → binary ───────────────────────────
-- $ORIGIN/lib lets the self-extracting package find the bundled .so
-- Single-quote the -Wl arg so the shell doesn't expand $ORIGIN
local link_cmd = table.concat({
    "zig cc",
    "-o " .. binary,
    obj_name,
    ENGINE_SO,
    "'-Wl,-rpath,$ORIGIN/lib'",
    "-lm -lpthread -ldl",
}, " ")

io.write("[link] link → " .. binary .. "... ")
io.flush()
if not run(link_cmd .. " 2>&1") then
    io.write("FAILED\n")
    os.exit(1)
end
local t2 = now_ms()
io.write(tostring(t2 - t1) .. "ms\n")

-- ── Cleanup ─────────────────────────────────────────────────────────
run("strip " .. binary .. " 2>/dev/null")
os.remove(obj_name)

io.write("[link] total: " .. tostring(t2 - t0) .. "ms → " .. binary .. "\n")
