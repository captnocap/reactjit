--[[
  tsl_stdlib.lua — Standard library for TSL (TypeScript-to-Lua) transpiled code

  Provides idiomatic Lua implementations of JavaScript array/object/string
  methods that don't have direct 1:1 Lua equivalents. Auto-required by the
  TSL transpiler when any of these functions appear in the output.

  All functions are designed for LuaJIT performance:
  - No unnecessary table creation in hot paths
  - Local upvalues for builtins
  - Simple iteration patterns that trace well
]]

local pairs, ipairs, type = pairs, ipairs, type
local tinsert, tremove, tconcat = table.insert, table.remove, table.concat
local sfind, ssub, slen = string.find, string.sub, string.len

local __tsl = {}

-- ── Table merge (object spread) ─────────────────────────────

--- Merge multiple tables into a new table. Later keys win.
--- Used for: { ...a, ...b }, Object.assign()
function __tsl.merge(...)
  local result = {}
  for i = 1, select("#", ...) do
    local t = select(i, ...)
    if t then
      for k, v in pairs(t) do
        result[k] = v
      end
    end
  end
  return result
end

-- ── Array methods ───────────────────────────────────────────

--- arr.map(fn) → new array with fn applied to each element
function __tsl.map(arr, fn)
  local result = {}
  for i = 1, #arr do
    result[i] = fn(arr[i], i, arr)
  end
  return result
end

--- arr.filter(fn) → new array with elements where fn returns truthy
function __tsl.filter(arr, fn)
  local result = {}
  local j = 1
  for i = 1, #arr do
    if fn(arr[i], i, arr) then
      result[j] = arr[i]
      j = j + 1
    end
  end
  return result
end

--- arr.forEach(fn) → call fn for each element, no return
function __tsl.forEach(arr, fn)
  for i = 1, #arr do
    fn(arr[i], i, arr)
  end
end

--- arr.indexOf(value) → 1-based index or -1 if not found
--- (JS returns 0-based; TSL is 1-based so we return 1-based or -1)
function __tsl.indexOf(arr, value)
  for i = 1, #arr do
    if arr[i] == value then return i end
  end
  return -1
end

--- arr.reverse() → reverse array in-place, return it
function __tsl.reverse(arr)
  local n = #arr
  for i = 1, math.floor(n / 2) do
    arr[i], arr[n - i + 1] = arr[n - i + 1], arr[i]
  end
  return arr
end

--- arr.find(fn) → first element where fn returns truthy, or nil
function __tsl.find(arr, fn)
  for i = 1, #arr do
    if fn(arr[i], i, arr) then return arr[i] end
  end
  return nil
end

--- arr.findIndex(fn) → 1-based index of first match, or -1
function __tsl.findIndex(arr, fn)
  for i = 1, #arr do
    if fn(arr[i], i, arr) then return i end
  end
  return -1
end

--- arr.some(fn) → true if fn returns truthy for any element
function __tsl.some(arr, fn)
  for i = 1, #arr do
    if fn(arr[i], i, arr) then return true end
  end
  return false
end

--- arr.every(fn) → true if fn returns truthy for all elements
function __tsl.every(arr, fn)
  for i = 1, #arr do
    if not fn(arr[i], i, arr) then return false end
  end
  return true
end

--- arr.reduce(fn, init) → accumulated value
function __tsl.reduce(arr, fn, init)
  local acc = init
  local start = 1
  if acc == nil then
    acc = arr[1]
    start = 2
  end
  for i = start, #arr do
    acc = fn(acc, arr[i], i, arr)
  end
  return acc
end

--- arr.flat() → shallow flatten (one level)
function __tsl.flat(arr)
  local result = {}
  local j = 1
  for i = 1, #arr do
    local v = arr[i]
    if type(v) == "table" then
      for k = 1, #v do
        result[j] = v[k]
        j = j + 1
      end
    else
      result[j] = v
      j = j + 1
    end
  end
  return result
end

-- ── Object methods ──────────────────────────────────────────

--- Object.keys(obj) → array of keys
function __tsl.keys(obj)
  local result = {}
  local i = 1
  for k in pairs(obj) do
    result[i] = k
    i = i + 1
  end
  return result
end

--- Object.values(obj) → array of values
function __tsl.values(obj)
  local result = {}
  local i = 1
  for _, v in pairs(obj) do
    result[i] = v
    i = i + 1
  end
  return result
end

--- Object.entries(obj) → array of {key, value} pairs
function __tsl.entries(obj)
  local result = {}
  local i = 1
  for k, v in pairs(obj) do
    result[i] = {k, v}
    i = i + 1
  end
  return result
end

-- ── String methods ──────────────────────────────────────────

--- str.split(sep) → array of substrings
function __tsl.split(str, sep)
  if sep == nil or sep == "" then
    -- Split into characters
    local result = {}
    for i = 1, slen(str) do
      result[i] = ssub(str, i, i)
    end
    return result
  end
  local result = {}
  local i = 1
  local pos = 1
  while true do
    local s, e = sfind(str, sep, pos, true)
    if not s then
      result[i] = ssub(str, pos)
      break
    end
    result[i] = ssub(str, pos, s - 1)
    i = i + 1
    pos = e + 1
  end
  return result
end

return __tsl
