#!/usr/bin/env luajit
-- link.lua — LuaJIT linker for ReactJIT carts
--
-- Replaces `zig build cart-fast`. Calls zig build-obj + zig cc directly.
-- No build system overhead. No DAG evaluation. Just compile and link.
--
-- Usage: luajit scripts/link.lua <generated_app.zig> [app-name]

local ffi = require("ffi")

-- ── Paths ───────────────────────────────────────────────────────────
local SCRIPT_DIR = arg[0]:match("(.*/)" ) or "./"
local TSZ_DIR = SCRIPT_DIR:match("(.-)scripts/") or "./"
local REPO_ROOT = TSZ_DIR .. "../"

local ENGINE_SO   = TSZ_DIR .. "zig-out/lib/libreactjit-core.so"
local ENGINE_A    = TSZ_DIR .. "zig-out/lib/libreactjit-core.current.a"
local BLEND2D_A   = REPO_ROOT .. "blend2d/build/libblend2d_full.a"
local VELLO_A     = REPO_ROOT .. "deps/vello_ffi/target/release/libvello_ffi_stripped.a"
local QJS_INCLUDE = REPO_ROOT .. "love2d/quickjs"
local FFI_INCLUDE = TSZ_DIR .. "ffi"

-- Find wgpu_native.a — use the one the engine was built against
local function find_wgpu()
    local f = io.popen("ls -t ~/.cache/zig/p/*/lib/libwgpu_native.a 2>/dev/null")
    if not f then return nil end
    -- Pick the one matching the engine build (embedded in .a as archive member)
    local grep = io.popen("strings " .. ENGINE_A .. " 2>/dev/null | grep -o '/home/.*libwgpu_native.a' | head -1")
    if grep then
        local path = grep:read("*l")
        grep:close()
        if path and path ~= "" then
            local check = io.open(path, "r")
            if check then check:close(); f:close(); return path end
        end
    end
    -- Fallback: most recent
    local path = f:read("*l")
    f:close()
    return path
end

local WGPU_A = find_wgpu()

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
local obj = source:gsub("%.zig$", ".o")
local binary = outdir .. "/" .. name

-- ── Helpers ─────────────────────────────────────────────────────────
local function run(cmd)
    local ok = os.execute(cmd)
    -- Lua 5.1 (LuaJIT): os.execute returns exit code directly
    if ok ~= 0 then return false end
    return true
end

local function file_exists(path)
    local f = io.open(path, "r")
    if f then f:close(); return true end
    return false
end

local function elapsed(start)
    local f = io.popen("date +%s%3N")
    local now = tonumber(f:read("*l"))
    f:close()
    return now - start
end

local function now_ms()
    local f = io.popen("date +%s%3N")
    local t = tonumber(f:read("*l"))
    f:close()
    return t
end

-- ── Preflight ───────────────────────────────────────────────────────
if not file_exists(ENGINE_A) then
    io.stderr:write("[link] Engine .a not found at " .. ENGINE_A .. "\n")
    io.stderr:write("[link] Run: rjit core\n")
    os.exit(1)
end

if not WGPU_A or not file_exists(WGPU_A) then
    io.stderr:write("[link] wgpu_native.a not found in zig cache\n")
    os.exit(1)
end

os.execute("mkdir -p " .. outdir)

-- ── Integrity check — verify generated .zig hasn't been hand-edited ──
local function check_integrity(path)
    local f = io.open(path, "r")
    if not f then return true end -- no file = skip check
    local first = f:read("*l")
    f:close()
    if not first or not first:match("^//! integrity:") then return true end -- no stamp = old file, ok
    local body_hash = first:match("body=(%x+)")
    if not body_hash then return true end

    -- Re-read file, strip the integrity lines, compute sha256 of the body
    f = io.open(path, "r")
    local content = f:read("*a")
    f:close()
    local body = content:gsub("^//! integrity:[^\n]*\n//! DO NOT EDIT[^\n]*\n", "")

    -- Use system sha256sum for cross-language consistency
    local tmp = os.tmpname()
    local tf = io.open(tmp, "w"); tf:write(body); tf:close()
    local pf = io.popen("sha256sum " .. tmp .. " 2>/dev/null")
    local computed = pf:read("*l"):match("^(%x+)")
    pf:close(); os.remove(tmp)
    -- Compare first 16 hex chars (64-bit prefix, matches Smith's stamp)
    computed = computed:sub(1, 16)

    if computed ~= body_hash then
        io.stderr:write("[link] INTEGRITY FAIL: " .. path .. " has been hand-edited!\n")
        io.stderr:write("[link] Expected body hash: " .. body_hash .. "\n")
        io.stderr:write("[link] Computed body hash: " .. computed .. "\n")
        io.stderr:write("[link] Re-run forge to regenerate from .tsz source.\n")
        io.stderr:write("[link] Use --force to override (you know what you're doing).\n")
        return false
    end
    return true
end

-- Check unless --force was passed (arg[3])
if arg[3] ~= "--force" and not check_integrity(source) then
    os.exit(1)
end

-- ── Step 1: Compile cart .zig → .o ──────────────────────────────────
local t0 = now_ms()

local compile_cmd = table.concat({
    "zig build-obj",
    source,
    "-I " .. QJS_INCLUDE,
    "-I " .. FFI_INCLUDE,
    "-I /usr/include/x86_64-linux-gnu",
    "-lc",
    -- Cart code is data declarations + thin handlers — doesn't need LLVM.
    -- Engine .a is already fully optimized. Debug uses Zig's fast x86 backend.
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

-- ── Step 2: Link .o + engine → binary ───────────────────────────────
-- Channel mode (default): launcher.c + dlopen — cart picks engine at runtime
-- Fallback: direct link against .a (fat static binary)
local LAUNCHER = TSZ_DIR .. "framework/launcher.c"
local use_channels = file_exists(LAUNCHER) and file_exists(TSZ_DIR .. "zig-out/lib/libreactjit-core.stable.so")
local link_cmd
if use_channels then
    -- Channel mode: launcher provides main(), cart exports main_cart()
    -- launcher.c dlopen's the right engine .so based on --engine= flag
    -- Link against stable.so for symbol resolution; dlopen overrides at runtime
    link_cmd = table.concat({
        "zig cc",
        "-o " .. binary,
        LAUNCHER,
        obj,
        TSZ_DIR .. "zig-out/lib/libreactjit-core.stable.so",
        "-Wl,-rpath,$ORIGIN/../lib",
        "-ldl -lm -lpthread",
    }, " ")
elseif file_exists(ENGINE_SO) then
    -- Direct .so link (no channel selector)
    link_cmd = table.concat({
        "zig cc",
        "-o " .. binary,
        obj,
        ENGINE_SO,
        "-Wl,-rpath," .. TSZ_DIR .. "zig-out/lib",
        "-lm -lpthread -ldl",
    }, " ")
else
    -- Static fallback
    link_cmd = table.concat({
        "zig cc",
        "-o " .. binary,
        obj,
        ENGINE_A,
        WGPU_A,
        BLEND2D_A,
        VELLO_A,
        "-lSDL3 -lfreetype -lluajit-5.1 -lX11",
        "-lbox2d -lsqlite3 -lvterm -lcurl -larchive",
        "-lm -lpthread -ldl -lstdc++",
    }, " ")
end

io.write("[link] link → " .. binary .. "... ")
io.flush()
if not run(link_cmd .. " 2>/dev/null") then
    io.write("FAILED\n")
    os.exit(1)
end
local t2 = now_ms()
io.write(tostring(t2 - t1) .. "ms\n")

-- ── Step 3: Strip debug info ────────────────────────────────────────
run("strip " .. binary .. " 2>/dev/null")

-- ── Done ────────────────────────────────────────────────────────────
io.write("[link] total: " .. tostring(t2 - t0) .. "ms → " .. binary .. "\n")

-- Cleanup .o
os.remove(obj)
