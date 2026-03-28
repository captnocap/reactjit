-- LuaJIT payload digestion benchmark
-- Standalone: luajit payload_bench.lua <payload_file> <function> <iterations>
local ffi = require("ffi")

ffi.cdef[[
    struct timeval { long tv_sec; long tv_usec; };
    int gettimeofday(struct timeval *tv, void *tz);
    struct rusage {
        struct timeval ru_utime; struct timeval ru_stime;
        long ru_maxrss; long ru_ixrss; long ru_idrss; long ru_isrss;
        long ru_minflt; long ru_majflt; long ru_nswap;
        long ru_inblock; long ru_oublock; long ru_msgsnd; long ru_msgrcv;
        long ru_nsignals; long ru_nvcsw; long ru_nivcsw;
    };
    int getrusage(int who, struct rusage *usage);
]]

local function get_time_us()
    local tv = ffi.new("struct timeval")
    ffi.C.gettimeofday(tv, nil)
    return tonumber(tv.tv_sec) * 1000000 + tonumber(tv.tv_usec)
end

local function get_rss_kb()
    local usage = ffi.new("struct rusage")
    ffi.C.getrusage(0, usage)
    return tonumber(usage.ru_maxrss)
end

-- Add our dir to path
local script_dir = arg[0]:match("(.*/)")
if script_dir then
    package.path = script_dir .. "?.lua;" .. package.path
end

local json = require("json")

-- Read file
local function read_file(path)
    local f = io.open(path, "rb")
    if not f then error("Cannot open: " .. path) end
    local data = f:read("*a")
    f:close()
    return data
end

local payload_path = arg[1]
local func_name = arg[2]
local iterations = tonumber(arg[3])

if not payload_path or not func_name or not iterations then
    io.stderr:write("Usage: luajit payload_bench.lua <payload_file> <function> <iterations>\n")
    io.stderr:write("  function: parse|extract|validate|total|serialize\n")
    os.exit(1)
end

local payload = read_file(payload_path)

-- Define benchmark functions
local function bench_parse()
    return json.parse(payload)
end

local function bench_extract()
    local obj = json.parse(payload)
    return {
        id = obj.id,
        name = obj.user and obj.user.name,
        city = obj.user and obj.user.address and obj.user.address.city,
        item_count = obj.items and #obj.items or 0,
        total = obj.metadata and obj.metadata.total or 0,
    }
end

local user_schema = {
    id = "number",
    user = "table",
    items = "table",
}

local function bench_validate()
    local obj = json.parse(payload)
    if not json.validate(obj, user_schema) then return false end
    if type(obj.user.name) ~= "string" then return false end
    if type(obj.user.email) ~= "string" then return false end
    if obj.items then
        for i = 1, #obj.items do
            local item = obj.items[i]
            if type(item.id) ~= "number" then return false end
            if type(item.name) ~= "string" then return false end
            if type(item.price) ~= "number" then return false end
        end
    end
    return true
end

local function bench_total()
    local obj = json.parse(payload)
    local total = 0
    if obj.items then
        for i = 1, #obj.items do
            total = total + obj.items[i].price
        end
    end
    return total
end

-- Minimal JSON serializer for the serialize bench
local function serialize_value(v)
    local t = type(v)
    if t == "string" then
        return '"' .. v:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n') .. '"'
    elseif t == "number" then
        return tostring(v)
    elseif t == "boolean" then
        return v and "true" or "false"
    elseif t == "table" then
        local parts = {}
        -- Check if array
        if #v > 0 then
            for i = 1, #v do
                parts[i] = serialize_value(v[i])
            end
            return "[" .. table.concat(parts, ",") .. "]"
        else
            for k, val in pairs(v) do
                parts[#parts + 1] = '"' .. tostring(k) .. '":' .. serialize_value(val)
            end
            return "{" .. table.concat(parts, ",") .. "}"
        end
    else
        return "null"
    end
end

local function bench_serialize()
    local obj = json.parse(payload)
    local result = {
        user_name = obj.user and obj.user.name or "",
        item_count = obj.items and #obj.items or 0,
        total_price = 0,
    }
    if obj.items then
        for i = 1, #obj.items do
            result.total_price = result.total_price + obj.items[i].price
        end
    end
    return serialize_value(result)
end

local funcs = {
    parse = bench_parse,
    extract = bench_extract,
    validate = bench_validate,
    total = bench_total,
    serialize = bench_serialize,
}

local fn = funcs[func_name]
if not fn then
    io.stderr:write("Unknown function: " .. func_name .. "\n")
    os.exit(1)
end

-- Warmup
local warmup = math.max(10, math.floor(iterations / 10))
for _ = 1, warmup do fn() end

-- Benchmark (no bridge — LuaJIT does everything in-process)
local rss_before = get_rss_kb()
local start = get_time_us()
for _ = 1, iterations do fn() end
local elapsed = get_time_us() - start
local rss_after = get_rss_kb()

-- Bridge cost: for LuaJIT, this is the FFI string copy cost
-- Simulate: copy payload from C buffer, parse, extract result back to C buffer
local bridge_start = get_time_us()
for _ = 1, iterations do
    -- Simulate Zig→LuaJIT: ffi.string from a C pointer
    local c_buf = ffi.new("char[?]", #payload + 1)
    ffi.copy(c_buf, payload)
    local lua_str = ffi.string(c_buf, #payload)
    -- Parse
    local result = fn()
    -- Simulate LuaJIT→Zig: convert result to C string
    if type(result) == "string" then
        local out = ffi.new("char[?]", #result + 1)
        ffi.copy(out, result)
    elseif type(result) == "number" then
        local out = ffi.new("double[1]", result)
        local _ = out[0]
    end
end
local bridge_elapsed = get_time_us() - bridge_start

-- Output: func payload_size iters elapsed_us bridge_us rss_kb
io.write(string.format("%s\t%d\t%d\t%d\t%d\t%d\n",
    func_name, #payload, iterations,
    elapsed, bridge_elapsed,
    math.max(rss_before, rss_after)))
