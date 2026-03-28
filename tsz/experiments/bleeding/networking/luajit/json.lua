-- Minimal JSON parser for LuaJIT — no dependencies
-- Handles objects, arrays, strings, numbers, booleans, null
-- Designed for benchmarking, not production use

local ffi = require("ffi")

local M = {}

-- State
local str, pos

local function skip_ws()
    while pos <= #str do
        local c = str:byte(pos)
        if c == 32 or c == 9 or c == 10 or c == 13 then
            pos = pos + 1
        else
            break
        end
    end
end

local function peek()
    return str:byte(pos)
end

local function advance()
    pos = pos + 1
end

local parse_value -- forward decl

local function parse_string()
    assert(peek() == 34) -- "
    advance()
    local start = pos
    while pos <= #str do
        local c = str:byte(pos)
        if c == 92 then -- backslash
            pos = pos + 2 -- skip escape
        elseif c == 34 then
            local result = str:sub(start, pos - 1)
            advance()
            -- Handle basic escapes
            result = result:gsub("\\n", "\n"):gsub("\\t", "\t"):gsub("\\\"", "\""):gsub("\\\\", "\\")
            return result
        else
            pos = pos + 1
        end
    end
    error("unterminated string")
end

local function parse_number()
    local start = pos
    if peek() == 45 then advance() end -- minus
    while pos <= #str and peek() >= 48 and peek() <= 57 do advance() end
    if pos <= #str and peek() == 46 then
        advance()
        while pos <= #str and peek() >= 48 and peek() <= 57 do advance() end
    end
    if pos <= #str and (peek() == 101 or peek() == 69) then
        advance()
        if pos <= #str and (peek() == 43 or peek() == 45) then advance() end
        while pos <= #str and peek() >= 48 and peek() <= 57 do advance() end
    end
    return tonumber(str:sub(start, pos - 1))
end

local function parse_object()
    assert(peek() == 123) -- {
    advance()
    skip_ws()
    local obj = {}
    if peek() == 125 then advance(); return obj end
    while true do
        skip_ws()
        local key = parse_string()
        skip_ws()
        assert(peek() == 58) -- :
        advance()
        skip_ws()
        obj[key] = parse_value()
        skip_ws()
        if peek() == 125 then advance(); return obj end
        assert(peek() == 44) -- ,
        advance()
    end
end

local function parse_array()
    assert(peek() == 91) -- [
    advance()
    skip_ws()
    local arr = {}
    if peek() == 93 then advance(); return arr end
    while true do
        skip_ws()
        arr[#arr + 1] = parse_value()
        skip_ws()
        if peek() == 93 then advance(); return arr end
        assert(peek() == 44) -- ,
        advance()
    end
end

parse_value = function()
    skip_ws()
    local c = peek()
    if c == 34 then return parse_string()
    elseif c == 123 then return parse_object()
    elseif c == 91 then return parse_array()
    elseif c == 116 then -- true
        pos = pos + 4; return true
    elseif c == 102 then -- false
        pos = pos + 5; return false
    elseif c == 110 then -- null
        pos = pos + 4; return nil
    else
        return parse_number()
    end
end

function M.parse(input)
    str = input
    pos = 1
    return parse_value()
end

-- Schema validation: check that obj has expected keys with expected types
-- schema = { key = "string"|"number"|"boolean"|"table", ... }
function M.validate(obj, schema)
    if type(obj) ~= "table" then return false end
    for key, expected_type in pairs(schema) do
        local val = obj[key]
        if val == nil then return false end
        if type(val) ~= expected_type then return false end
    end
    return true
end

-- Extract nested field: M.extract(obj, "user.address.city")
function M.extract(obj, path)
    local current = obj
    for part in path:gmatch("[^.]+") do
        if type(current) ~= "table" then return nil end
        current = current[part]
    end
    return current
end

return M
