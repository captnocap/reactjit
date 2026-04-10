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

-- Detect platform
local is_macos = io.popen("uname -s"):read("*l") == "Darwin"
local ENGINE_EXT = is_macos and ".dylib" or ".so"
local ENGINE_SO = TSZ_DIR .. "zig-out/lib/libreactjit-core" .. ENGINE_EXT
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
local ZIG_LOCAL_CACHE = TSZ_DIR .. "zig-cache/link-local"
local ZIG_GLOBAL_CACHE = TSZ_DIR .. "zig-cache/link-global"
local ZIG_ENV = "ZIG_LOCAL_CACHE_DIR=" .. ZIG_LOCAL_CACHE .. " ZIG_GLOBAL_CACHE_DIR=" .. ZIG_GLOBAL_CACHE .. " "

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
    if is_macos then
        -- macOS date doesn't support %N; use python or perl for ms precision
        local f = io.popen("perl -MTime::HiRes=time -e 'printf \"%d\", time()*1000'")
        local t = tonumber(f:read("*l"))
        f:close()
        return t or 0
    else
        local f = io.popen("date +%s%3N")
        local t = tonumber(f:read("*l"))
        f:close()
        return t or 0
    end
end

-- ── Preflight ───────────────────────────────────────────────────────
if not file_exists(ENGINE_SO) then
    io.stderr:write("[link] Engine .so not found at " .. ENGINE_SO .. "\n")
    io.stderr:write("[link] Build it: zig build core-so -Doptimize=ReleaseFast\n")
    os.exit(1)
end

os.execute("mkdir -p " .. outdir)
os.execute("mkdir -p " .. ZIG_LOCAL_CACHE)
os.execute("mkdir -p " .. ZIG_GLOBAL_CACHE)

-- ── Step 1: Compile cart .zig → .o ──────────────────────────────────
local t0 = now_ms()

local include_flags = {
    ZIG_ENV .. "zig build-obj",
    source,
    "-I " .. QJS_INCLUDE,
    "-I " .. FFI_INCLUDE,
}
if is_macos then
    table.insert(include_flags, "-I /opt/homebrew/include")
    table.insert(include_flags, "-I /opt/homebrew/include/luajit-2.1")
    table.insert(include_flags, "-I /opt/homebrew/include/freetype2")
else
    table.insert(include_flags, "-I /usr/include/x86_64-linux-gnu")
end
table.insert(include_flags, "-lc")
table.insert(include_flags, "-OReleaseFast")
if not os.getenv("TSZ_GDB") then table.insert(include_flags, "-fstrip") end
local compile_cmd = table.concat(include_flags, " ")

io.write("[link] compile " .. source .. "... ")
io.flush()
if not run(compile_cmd .. " 2>&1") then
    io.write("FAILED\n")
    os.exit(1)
end
local t1 = now_ms()
io.write(tostring(t1 - t0) .. "ms\n")

-- ── Step 2: Link .o + engine .so (+ resolved deps) → binary ─────────
-- TSZ_LINK_EXTRA_SOS: space-separated .so paths from dep resolver
-- TSZ_LINK_EXTRA_LIBS: space-separated library names (for -l flags)
local extra_sos = os.getenv("TSZ_LINK_EXTRA_SOS") or ""
local extra_libs = os.getenv("TSZ_LINK_EXTRA_LIBS") or ""

local link_cmd
if is_macos then
    local parts = {
        ZIG_ENV .. "zig cc",
        "-o " .. binary,
        obj_name,
        ENGINE_SO,
        "-L/opt/homebrew/lib",
        "-L/opt/homebrew/opt/libarchive/lib",
        "'-Wl,-rpath,@executable_path/../Frameworks'",
        "'-Wl,-headerpad_max_install_names'",
    }
    for so in extra_sos:gmatch("%S+") do
        io.write("[link] + " .. so:match("[^/]+$") .. "\n")
        table.insert(parts, so)
    end
    for lib in extra_libs:gmatch("%S+") do
        table.insert(parts, "-l" .. lib)
    end
    link_cmd = table.concat(parts, " ")
else
    -- $ORIGIN/lib lets the self-extracting package find the bundled .so
    -- Single-quote the -Wl arg so the shell doesn't expand $ORIGIN
    local parts = {
        ZIG_ENV .. "zig cc",
        "-o " .. binary,
        obj_name,
        ENGINE_SO,
        "'-Wl,-rpath,$ORIGIN/lib'",
        "-lm -lpthread -ldl",
    }
    for so in extra_sos:gmatch("%S+") do
        io.write("[link] + " .. so:match("[^/]+$") .. "\n")
        table.insert(parts, so)
    end
    for lib in extra_libs:gmatch("%S+") do
        table.insert(parts, "-l" .. lib)
    end
    link_cmd = table.concat(parts, " ")
end

io.write("[link] link → " .. binary .. "... ")
io.flush()
if not run(link_cmd .. " 2>&1") then
    io.write("FAILED\n")
    os.remove(obj_name)
    os.remove(TSZ_DIR .. obj_name)
    os.exit(1)
end
local t2 = now_ms()
io.write(tostring(t2 - t1) .. "ms\n")

-- ── Cleanup ─────────────────────────────────────────────────────────
if not os.getenv("TSZ_GDB") then run("strip " .. binary .. " 2>/dev/null") end
os.remove(obj_name)
-- Also try TSZ_DIR in case zig dropped the .o relative to the source
os.remove(TSZ_DIR .. obj_name)

io.write("[link] total: " .. tostring(t2 - t0) .. "ms → " .. binary .. "\n")
