-- tsl_stdlib: JS array/object/string methods for LuaJIT
-- Auto-loaded by luajit_runtime. Used by compiler Lua output.
__tsl = {}

function __tsl.map(arr, fn)
  local result = {}
  for i = 1, #arr do result[i] = fn(arr[i], i, arr) end
  return result
end

function __tsl.filter(arr, fn)
  local result, j = {}, 1
  for i = 1, #arr do
    if fn(arr[i], i, arr) then result[j] = arr[i]; j = j + 1 end
  end
  return result
end

function __tsl.find(arr, fn)
  for i = 1, #arr do if fn(arr[i], i, arr) then return arr[i] end end
  return nil
end

function __tsl.forEach(arr, fn)
  for i = 1, #arr do fn(arr[i], i, arr) end
end

function __tsl.indexOf(arr, value)
  for i = 1, #arr do if arr[i] == value then return i end end
  return -1
end

function __tsl.merge(...)
  local result = {}
  for i = 1, select("#", ...) do
    local t = select(i, ...)
    if t then for k, v in pairs(t) do result[k] = v end end
  end
  return result
end

function __tsl.push(arr, val)
  arr[#arr+1] = val
  return #arr
end

function __tsl.join(arr, sep)
  return table.concat(arr, sep or ",")
end

function __tsl.slice(arr, from, to)
  local result = {}
  from = from or 1
  to = to or #arr
  for i = from, to do result[#result+1] = arr[i] end
  return result
end

function __tsl.includes(arr, val)
  for i = 1, #arr do if arr[i] == val then return true end end
  return false
end

function __tsl.reduce(arr, fn, init)
  local acc = init
  local start = 1
  if acc == nil then acc = arr[1]; start = 2 end
  for i = start, #arr do acc = fn(acc, arr[i], i, arr) end
  return acc
end

function __tsl.keys(obj)
  local result = {}
  for k in pairs(obj) do result[#result+1] = k end
  return result
end

function __tsl.values(obj)
  local result = {}
  for _, v in pairs(obj) do result[#result+1] = v end
  return result
end

-- String methods
function __tsl.split(s, sep)
  local result = {}
  for part in s:gmatch("[^" .. (sep or ",") .. "]+") do
    result[#result+1] = part
  end
  return result
end

function __tsl.trim(s) return s:match("^%s*(.-)%s*$") end
function __tsl.startsWith(s, prefix) return s:sub(1, #prefix) == prefix end
function __tsl.endsWith(s, suffix) return s:sub(-#suffix) == suffix end
function __tsl.toUpperCase(s) return s:upper() end
function __tsl.toLowerCase(s) return s:lower() end
