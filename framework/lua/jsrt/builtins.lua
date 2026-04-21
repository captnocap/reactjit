-- JS global built-ins: Object, Array, String, Math, Number, JSON, Error,
-- Map, Set, WeakMap, Symbol, console, and their prototype methods.
--
-- Every entry here is a JS-language built-in. Nothing framework-specific.
-- React is a JS program; it calls the same `Array.prototype.map` that any other
-- JS program calls. There is no special case here for React.

local Values = require("framework.lua.jsrt.values")

local M = {}

-- Invoke a JS function value. Uses a lazy require on evaluator to avoid a
-- load-time circular dependency; by the time these prototype methods run, the
-- evaluator module is already in the package.loaded cache.
local function callJs(fn, args, thisVal)
  local Evaluator = require("framework.lua.jsrt.evaluator")
  return Evaluator.callFunction(fn, args, thisVal or Values.UNDEFINED)
end

-- ── Array.prototype ────────────────────────────────────────

M.arrayPrototype = {}

M.arrayPrototype.reduce = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local acc = args[2]
  local start = 1
  if acc == nil then
    acc = thisVal[1]
    start = 2
  end
  local n = thisVal.length or 0
  for i = start, n do
    acc = callJs(fn, { acc, thisVal[i], i - 1, thisVal })
  end
  return acc
end)

M.arrayPrototype.map = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = thisVal.length or 0
  local result = Values.newArray()
  for i = 1, n do
    result[i] = callJs(fn, { thisVal[i], i - 1, thisVal })
  end
  result.length = n
  return result
end)

M.arrayPrototype.filter = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = thisVal.length or 0
  local result = Values.newArray()
  local j = 0
  for i = 1, n do
    if Values.truthy(callJs(fn, { thisVal[i], i - 1, thisVal })) then
      j = j + 1
      result[j] = thisVal[i]
    end
  end
  result.length = j
  return result
end)

M.arrayPrototype.forEach = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = thisVal.length or 0
  for i = 1, n do
    callJs(fn, { thisVal[i], i - 1, thisVal })
  end
  return Values.UNDEFINED
end)

M.arrayPrototype.push = Values.newNativeFunction(function(args, thisVal)
  local n = thisVal.length or 0
  for i = 1, #args do
    n = n + 1
    thisVal[n] = args[i]
  end
  thisVal.length = n
  return n
end)

M.arrayPrototype.join = Values.newNativeFunction(function(args, thisVal)
  local sep = args[1]
  if sep == nil or sep == Values.UNDEFINED then sep = "," end
  local parts = {}
  for i = 1, thisVal.length or 0 do
    local v = thisVal[i]
    if v == Values.UNDEFINED or v == Values.NULL then
      parts[i] = ""
    else
      parts[i] = tostring(v)
    end
  end
  return table.concat(parts, sep)
end)

-- ── install ────────────────────────────────────────────────

-- ── Error ─────────────────────────────────────────────────
-- `new Error(msg)` creates an object with .message and .name.
-- JS's error hierarchy (TypeError, RangeError, etc.) can be added as targets
-- require them — same shape, different `name`.

local function makeErrorCtor(name)
  local ctor = Values.newNativeFunction(function(args, thisVal)
    local msg = args[1]
    if msg == nil or msg == Values.UNDEFINED then
      thisVal.message = ""
    else
      thisVal.message = tostring(msg)
    end
    thisVal.name = name
    return thisVal
  end)
  local proto = Values.newObject()
  proto.constructor = ctor
  proto.name = name
  proto.message = ""
  ctor.prototype = proto
  return ctor
end

-- ── Map ──────────────────────────────────────────────────
-- Insertion-ordered, keyed by raw Lua equality (close enough to JS
-- SameValueZero for primitives and identity for objects). `.size` is a live
-- field rather than a getter — JS distinguishes these but nothing in React
-- depends on the distinction.

local function buildMap()
  local ctor = Values.newNativeFunction(function(args, thisVal)
    thisVal.__map_keys = {}
    thisVal.__map_vals = {}
    thisVal.__map_lookup = {}
    thisVal.size = 0
    return thisVal
  end)
  local proto = Values.newObject()
  proto.constructor = ctor
  ctor.prototype = proto

  proto.set = Values.newNativeFunction(function(args, thisVal)
    local key, value = args[1], args[2]
    local idx = thisVal.__map_lookup[key]
    if idx then
      thisVal.__map_vals[idx] = value
    else
      local n = thisVal.size + 1
      thisVal.__map_keys[n] = key
      thisVal.__map_vals[n] = value
      thisVal.__map_lookup[key] = n
      thisVal.size = n
    end
    return thisVal
  end)

  proto.get = Values.newNativeFunction(function(args, thisVal)
    local idx = thisVal.__map_lookup[args[1]]
    if idx then return thisVal.__map_vals[idx] end
    return Values.UNDEFINED
  end)

  proto.has = Values.newNativeFunction(function(args, thisVal)
    return thisVal.__map_lookup[args[1]] ~= nil
  end)

  proto.delete = Values.newNativeFunction(function(args, thisVal)
    local idx = thisVal.__map_lookup[args[1]]
    if not idx then return false end
    -- Shift entries down. O(n); fine for small maps and React's Map usage.
    for i = idx, thisVal.size - 1 do
      thisVal.__map_keys[i] = thisVal.__map_keys[i + 1]
      thisVal.__map_vals[i] = thisVal.__map_vals[i + 1]
      thisVal.__map_lookup[thisVal.__map_keys[i]] = i
    end
    thisVal.__map_keys[thisVal.size] = nil
    thisVal.__map_vals[thisVal.size] = nil
    thisVal.__map_lookup[args[1]] = nil
    thisVal.size = thisVal.size - 1
    return true
  end)

  return ctor
end

-- ── Set ──────────────────────────────────────────────────

local function buildSet()
  local ctor = Values.newNativeFunction(function(args, thisVal)
    thisVal.__set_items = {}
    thisVal.size = 0
    return thisVal
  end)
  local proto = Values.newObject()
  proto.constructor = ctor
  ctor.prototype = proto

  proto.add = Values.newNativeFunction(function(args, thisVal)
    local v = args[1]
    if thisVal.__set_items[v] == nil then
      thisVal.__set_items[v] = true
      thisVal.size = thisVal.size + 1
    end
    return thisVal
  end)

  proto.has = Values.newNativeFunction(function(args, thisVal)
    return thisVal.__set_items[args[1]] == true
  end)

  proto.delete = Values.newNativeFunction(function(args, thisVal)
    if thisVal.__set_items[args[1]] then
      thisVal.__set_items[args[1]] = nil
      thisVal.size = thisVal.size - 1
      return true
    end
    return false
  end)

  return ctor
end

-- ── Object ───────────────────────────────────────────────

local function buildObject()
  local Object = Values.newNativeFunction(function(args, thisVal)
    -- Object(x) coerces to object. For our purposes, returning x when already
    -- table is fine; primitives would box, but we don't box yet.
    local v = args[1]
    if v == nil or v == Values.UNDEFINED or v == Values.NULL then
      return Values.newObject()
    end
    return v
  end)

  Object.keys = Values.newNativeFunction(function(args)
    local obj = args[1]
    local arr = Values.newArray()
    local n = 0
    if type(obj) == "table" then
      for k in pairs(obj) do
        if type(k) == "string" and k:sub(1, 2) ~= "__" then
          n = n + 1
          arr[n] = k
        end
      end
    end
    arr.length = n
    return arr
  end)

  Object.values = Values.newNativeFunction(function(args)
    local obj = args[1]
    local arr = Values.newArray()
    local n = 0
    if type(obj) == "table" then
      for k, v in pairs(obj) do
        if type(k) == "string" and k:sub(1, 2) ~= "__" then
          n = n + 1
          arr[n] = v
        end
      end
    end
    arr.length = n
    return arr
  end)

  Object.entries = Values.newNativeFunction(function(args)
    local obj = args[1]
    local arr = Values.newArray()
    local n = 0
    if type(obj) == "table" then
      for k, v in pairs(obj) do
        if type(k) == "string" and k:sub(1, 2) ~= "__" then
          n = n + 1
          local pair = Values.newArray()
          pair[1] = k
          pair[2] = v
          pair.length = 2
          arr[n] = pair
        end
      end
    end
    arr.length = n
    return arr
  end)

  Object.assign = Values.newNativeFunction(function(args)
    local target = args[1]
    if type(target) ~= "table" then return target end
    for i = 2, #args do
      local src = args[i]
      if type(src) == "table" then
        for k, v in pairs(src) do
          if type(k) == "string" and k:sub(1, 2) ~= "__" then
            target[k] = v
          end
        end
      end
    end
    return target
  end)

  Object.freeze = Values.newNativeFunction(function(args)
    -- No-op freeze — we don't enforce immutability. Object.freeze callers
    -- typically use it as an optimization hint, not a correctness check.
    return args[1]
  end)

  Object.isFrozen = Values.newNativeFunction(function() return false end)

  Object.create = Values.newNativeFunction(function(args)
    local proto = args[1]
    local obj = Values.newObject()
    if type(proto) == "table" then obj.__proto__ = proto end
    return obj
  end)

  -- We don't track enumerability — treat getOwnPropertyNames the same as keys.
  Object.getOwnPropertyNames = Object.keys
  Object.getOwnPropertyDescriptor = Values.newNativeFunction(function(args)
    local target, key = args[1], args[2]
    if type(target) ~= "table" then return Values.UNDEFINED end
    local v = rawget(target, key)
    if v == nil then return Values.UNDEFINED end
    local desc = Values.newObject()
    desc.value = v
    desc.writable = true
    desc.enumerable = true
    desc.configurable = true
    return desc
  end)

  Object.getPrototypeOf = Values.newNativeFunction(function(args)
    local v = args[1]
    if type(v) ~= "table" then return Values.NULL end
    return rawget(v, "__proto__") or Values.NULL
  end)

  Object.setPrototypeOf = Values.newNativeFunction(function(args)
    local v, p = args[1], args[2]
    if type(v) == "table" then v.__proto__ = p end
    return v
  end)

  Object.defineProperty = Values.newNativeFunction(function(args)
    -- Simplified: just set the value from the descriptor. Accessors / writable
    -- flags aren't supported; React's use is typically "assign a value" anyway.
    local target, key, descriptor = args[1], args[2], args[3]
    if type(target) == "table" and type(descriptor) == "table" then
      if descriptor.value ~= nil then
        target[tostring(key)] = descriptor.value
      end
    end
    return target
  end)

  return Object
end

-- ── Math ─────────────────────────────────────────────────

local function buildMath()
  local M_obj = Values.newObject()
  M_obj.PI       = math.pi
  M_obj.E        = math.exp(1)
  M_obj.LN2      = math.log(2)
  M_obj.LN10     = math.log(10)
  M_obj.LOG2E    = 1 / math.log(2)
  M_obj.LOG10E   = 1 / math.log(10)
  M_obj.SQRT2    = math.sqrt(2)

  local function wrap1(fn)
    return Values.newNativeFunction(function(args)
      local v = tonumber(args[1])
      if v == nil then return 0/0 end
      return fn(v)
    end)
  end

  M_obj.abs   = wrap1(math.abs)
  M_obj.floor = wrap1(math.floor)
  M_obj.ceil  = wrap1(math.ceil)
  M_obj.sqrt  = wrap1(math.sqrt)
  M_obj.log   = wrap1(math.log)
  M_obj.exp   = wrap1(math.exp)
  M_obj.sin   = wrap1(math.sin)
  M_obj.cos   = wrap1(math.cos)
  M_obj.tan   = wrap1(math.tan)
  M_obj.trunc = Values.newNativeFunction(function(args)
    local v = tonumber(args[1]) or 0
    if v >= 0 then return math.floor(v) end
    return math.ceil(v)
  end)
  M_obj.sign = Values.newNativeFunction(function(args)
    local v = tonumber(args[1])
    if v == nil or v ~= v then return 0/0 end
    if v > 0 then return 1 end
    if v < 0 then return -1 end
    return 0
  end)
  M_obj.round = Values.newNativeFunction(function(args)
    local v = tonumber(args[1]) or 0
    return math.floor(v + 0.5)
  end)
  M_obj.max = Values.newNativeFunction(function(args)
    if #args == 0 then return -math.huge end
    local m = tonumber(args[1]) or (0/0)
    for i = 2, #args do
      local v = tonumber(args[i]) or (0/0)
      if v > m or v ~= v then m = v end
    end
    return m
  end)
  M_obj.min = Values.newNativeFunction(function(args)
    if #args == 0 then return math.huge end
    local m = tonumber(args[1]) or (0/0)
    for i = 2, #args do
      local v = tonumber(args[i]) or (0/0)
      if v < m or v ~= v then m = v end
    end
    return m
  end)
  M_obj.pow = Values.newNativeFunction(function(args)
    local a = tonumber(args[1]) or 0
    local b = tonumber(args[2]) or 0
    return a ^ b
  end)
  M_obj.random = Values.newNativeFunction(function() return math.random() end)
  return M_obj
end

-- ── Number ───────────────────────────────────────────────

local function buildNumber()
  local Number = Values.newNativeFunction(function(args)
    return tonumber(args[1]) or 0/0
  end)
  Number.isNaN = Values.newNativeFunction(function(args)
    local v = args[1]
    return type(v) == "number" and v ~= v
  end)
  Number.isFinite = Values.newNativeFunction(function(args)
    local v = args[1]
    return type(v) == "number" and v == v and v ~= math.huge and v ~= -math.huge
  end)
  Number.isInteger = Values.newNativeFunction(function(args)
    local v = args[1]
    return type(v) == "number" and v == v and v == math.floor(v) and v ~= math.huge and v ~= -math.huge
  end)
  Number.MAX_SAFE_INTEGER = 9007199254740991
  Number.MIN_SAFE_INTEGER = -9007199254740991
  Number.MAX_VALUE = 1.7976931348623157e308
  Number.MIN_VALUE = 5e-324
  Number.EPSILON = 2.220446049250313e-16
  Number.POSITIVE_INFINITY = math.huge
  Number.NEGATIVE_INFINITY = -math.huge
  Number.NaN = 0/0
  return Number
end

-- ── JSON ─────────────────────────────────────────────────

local function jsonStringify(v, seen)
  seen = seen or {}
  if v == Values.NULL then return "null" end
  if v == Values.UNDEFINED or v == nil then return nil end  -- omitted in arrays/objects in ES, caller handles
  if type(v) == "boolean" then return v and "true" or "false" end
  if type(v) == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    return tostring(v)
  end
  if type(v) == "string" then
    return '"' .. v:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n'):gsub('\r', '\\r'):gsub('\t', '\\t') .. '"'
  end
  if type(v) == "table" then
    if seen[v] then return '"[Circular]"' end
    seen[v] = true
    if v.__kind == "array" then
      local parts = {}
      for i = 1, v.length or 0 do
        parts[#parts + 1] = jsonStringify(v[i], seen) or "null"
      end
      seen[v] = nil
      return "[" .. table.concat(parts, ",") .. "]"
    else
      local parts = {}
      for k, val in pairs(v) do
        if type(k) == "string" and k:sub(1, 2) ~= "__" then
          local s = jsonStringify(val, seen)
          if s then
            parts[#parts + 1] = '"' .. k .. '":' .. s
          end
        end
      end
      seen[v] = nil
      return "{" .. table.concat(parts, ",") .. "}"
    end
  end
  return nil
end

local function buildJSON()
  local JSON = Values.newObject()
  JSON.stringify = Values.newNativeFunction(function(args)
    local s = jsonStringify(args[1])
    if s == nil then return Values.UNDEFINED end
    return s
  end)
  JSON.parse = Values.newNativeFunction(function(args)
    -- Punt on a full JSON parser — if targets need it, add later.
    error("JSON.parse not implemented yet", 0)
  end)
  return JSON
end

-- ── console ──────────────────────────────────────────────

local function buildConsole()
  local function stringify(args)
    local parts = {}
    for i = 1, #args do
      local v = args[i]
      if v == Values.UNDEFINED then parts[i] = "undefined"
      elseif v == Values.NULL then parts[i] = "null"
      elseif type(v) == "table" then parts[i] = jsonStringify(v) or "[object]"
      else parts[i] = tostring(v)
      end
    end
    return table.concat(parts, " ")
  end
  local console = Values.newObject()
  console.log = Values.newNativeFunction(function(args)
    io.write(stringify(args), "\n"); io.flush()
    return Values.UNDEFINED
  end)
  console.warn = Values.newNativeFunction(function(args)
    io.write("[warn] ", stringify(args), "\n"); io.flush()
    return Values.UNDEFINED
  end)
  console.error = Values.newNativeFunction(function(args)
    io.write("[error] ", stringify(args), "\n"); io.flush()
    return Values.UNDEFINED
  end)
  console.info = console.log
  console.debug = console.log
  return console
end

-- ── WeakMap (minimal; backed by weak-valued Lua table) ──

local function buildWeakMap()
  local ctor = Values.newNativeFunction(function(args, thisVal)
    thisVal.__weak_storage = setmetatable({}, { __mode = "k" })
    return thisVal
  end)
  local proto = Values.newObject()
  proto.constructor = ctor
  ctor.prototype = proto

  proto.set = Values.newNativeFunction(function(args, thisVal)
    thisVal.__weak_storage[args[1]] = args[2]
    return thisVal
  end)
  proto.get = Values.newNativeFunction(function(args, thisVal)
    local v = thisVal.__weak_storage[args[1]]
    if v == nil then return Values.UNDEFINED end
    return v
  end)
  proto.has = Values.newNativeFunction(function(args, thisVal)
    return thisVal.__weak_storage[args[1]] ~= nil
  end)
  proto.delete = Values.newNativeFunction(function(args, thisVal)
    if thisVal.__weak_storage[args[1]] ~= nil then
      thisVal.__weak_storage[args[1]] = nil
      return true
    end
    return false
  end)
  return ctor
end

-- ── Symbol (minimal) ─────────────────────────────────────

local function buildSymbol()
  local Symbol = Values.newNativeFunction(function(args)
    local desc = args[1]
    return setmetatable({ __kind = "symbol", description = desc and tostring(desc) or nil },
      { __tostring = function(s) return "Symbol(" .. (s.description or "") .. ")" end })
  end)
  -- Symbol.iterator is a canonical sentinel. Identity is what matters.
  Symbol.iterator = setmetatable({ __kind = "symbol", description = "Symbol.iterator" }, {})
  Symbol.asyncIterator = setmetatable({ __kind = "symbol", description = "Symbol.asyncIterator" }, {})
  Symbol.for_ = Values.newNativeFunction(function(args)
    -- Typically Symbol.for interns globally by key; here a fresh symbol is fine.
    return setmetatable({ __kind = "symbol", description = tostring(args[1] or "") }, {})
  end)
  -- JS spelling is Symbol.for, not for_
  Symbol["for"] = Symbol.for_
  return Symbol
end

function M.install(scope)
  -- Primitive-ish globals.
  scope:define("undefined", Values.UNDEFINED)
  scope:define("NaN",       0/0)
  scope:define("Infinity",  math.huge)

  -- Legacy globals.
  scope:define("parseInt", Values.newNativeFunction(function(args)
    local s = args[1]
    local radix = tonumber(args[2]) or 10
    if type(s) ~= "string" then s = tostring(s) end
    local n = tonumber(s, radix)
    if n then return math.floor(n) end
    return 0/0
  end))
  scope:define("parseFloat", Values.newNativeFunction(function(args)
    return tonumber(tostring(args[1])) or 0/0
  end))
  scope:define("isNaN", Values.newNativeFunction(function(args)
    local v = tonumber(args[1])
    return v == nil or v ~= v
  end))
  scope:define("isFinite", Values.newNativeFunction(function(args)
    local v = tonumber(args[1])
    return v ~= nil and v == v and v ~= math.huge and v ~= -math.huge
  end))

  -- Error hierarchy.
  scope:define("Error",       makeErrorCtor("Error"))
  scope:define("TypeError",   makeErrorCtor("TypeError"))
  scope:define("RangeError",  makeErrorCtor("RangeError"))
  scope:define("SyntaxError", makeErrorCtor("SyntaxError"))

  -- Collections.
  scope:define("Map",     buildMap())
  scope:define("Set",     buildSet())
  scope:define("WeakMap", buildWeakMap())

  -- Reflection + namespaces.
  scope:define("Object",  buildObject())
  scope:define("Math",    buildMath())
  scope:define("Number",  buildNumber())
  scope:define("JSON",    buildJSON())
  scope:define("Symbol",  buildSymbol())
  scope:define("console", buildConsole())
end

return M
