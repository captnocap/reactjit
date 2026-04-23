-- JS global built-ins: Object, Array, String, Math, Number, JSON, Error,
-- Map, Set, WeakMap, Symbol, console, and their prototype methods.
--
-- Every entry here is a JS-language built-in. Nothing framework-specific.
-- React is a JS program; it calls the same `Array.prototype.map` that any other
-- JS program calls. There is no special case here for React.

local Values = require("framework.lua.jsrt.values")

local M = {}

M.symbolRegistry = {}
local callJs
local timerSeq = 1
local timers = {}
local nowMs = 0
local microtasks = {}
local microtaskHead = 1
local microtaskTail = 0
local microtaskDraining = false
local microtaskTotalPumped = 0
local microtaskCounts = {}
local function debugFloodEnabled()
  return rawget(_G, "__debugFlood") == true
end

local function hostLog(msg)
  if not debugFloodEnabled() then
    return
  end
  local hl = rawget(_G, "__hostLog")
  if type(hl) == "function" then
    pcall(hl, 2, msg)
  end
end

local function hostNowMs()
  if type(getNowMs) == "function" then
    local v = tonumber(getNowMs())
    if v ~= nil then return v end
  end
  return nowMs
end

local function drainTimers()
  nowMs = hostNowMs()
  local due = {}
  for _, t in ipairs(timers) do
    if not t.cleared and t.due <= nowMs then
      due[#due + 1] = t
    end
  end
  for _, t in ipairs(due) do
    if not t.cleared then
      local ok, err = pcall(callJs, t.fn, {}, Values.UNDEFINED, "setTimeout callback id=" .. tostring(t.id))
      if not ok then
        local msg = tostring(err)
        local hl = rawget(_G, "__hostLog")
        if type(hl) == "function" then
          pcall(hl, 2, "[timer] error id=" .. tostring(t.id) .. ": " .. msg)
        end
      end
      if t.interval > 0 and not t.cleared then
        t.due = nowMs + t.interval
      else
        t.cleared = true
      end
    end
  end
  local compact = {}
  for _, t in ipairs(timers) do
    if not t.cleared then compact[#compact + 1] = t end
  end
  timers = compact
end

local function enqueueMicrotask(fn, origin)
  if type(fn) ~= "table" or fn.__kind ~= "function" then
    error("TypeError: queueMicrotask expects a function", 0)
  end
  hostLog("[microtask] enqueue " .. tostring(origin or "Promise microtask"))
  microtaskTail = microtaskTail + 1
  microtasks[microtaskTail] = {
    fn = fn,
    origin = origin or "Promise microtask",
  }
end

local function drainMicrotasks()
  if microtaskDraining then return end
  microtaskDraining = true
  while microtaskHead <= microtaskTail do
    local item = microtasks[microtaskHead]
    microtasks[microtaskHead] = nil
    microtaskHead = microtaskHead + 1
    local fn = item.fn
    local origin = item.origin
    microtaskTotalPumped = microtaskTotalPumped + 1
    microtaskCounts[origin] = (microtaskCounts[origin] or 0) + 1
    if microtaskTotalPumped <= 50 then
      hostLog(string.format("[microtask] #%d %s", microtaskTotalPumped, origin))
    elseif microtaskTotalPumped % 1000 == 0 then
      local distinct = 0
      local top_name, top_count = nil, 0
      for name, count in pairs(microtaskCounts) do
        distinct = distinct + 1
        if count > top_count then
          top_name, top_count = name, count
        end
      end
      hostLog(string.format("[microtask] total=%d distinct=%d top=%s count=%d", microtaskTotalPumped, distinct, tostring(top_name), top_count))
    end
    local ok, err = pcall(callJs, fn, {}, Values.UNDEFINED, origin)
    if not ok then
      local msg = tostring(err)
      hostLog("[microtask] error: " .. msg)
    end
  end
  if microtaskHead > microtaskTail then
    microtasks = {}
    microtaskHead = 1
    microtaskTail = 0
  end
  microtaskDraining = false
end

-- Invoke a JS function value. Uses a lazy require on evaluator to avoid a
-- load-time circular dependency; by the time these prototype methods run, the
-- evaluator module is already in the package.loaded cache.
callJs = function(fn, args, thisVal, origin)
  if type(fn) ~= "table" or fn.__kind ~= "function" then
    local hl = rawget(_G, "__hostLog")
    if type(hl) == "function" then
      pcall(hl, 2, "[callJs] non-function callback: origin=" .. tostring(origin) .. " type=" .. tostring(type(fn)) .. " kind=" .. tostring(type(fn) == "table" and fn.__kind or "n/a") .. " value=" .. tostring(fn))
    end
  end
  local Evaluator = require("framework.lua.jsrt.evaluator")
  return Evaluator.callFunction(fn, args, thisVal or Values.UNDEFINED, nil, origin)
end

local function isRegex(v)
  return type(v) == "table" and v.__kind == "regexp"
end

local function escapeLuaPattern(s)
  return (s:gsub("([%^%$%(%)%%%.%[%]%*%+%-%?])", "%%%1"))
end

local function toLuaPattern(search)
  if isRegex(search) then
    return search.lua_pattern or Values.regexToLuaPattern(search.source or ""), search.global
  end
  if type(search) == "string" then
    return escapeLuaPattern(search), false
  end
  local s = tostring(search or "")
  return escapeLuaPattern(s), false
end

local function toUint32Clamp(v)
  local n = tonumber(v) or 0
  if n ~= n or n == math.huge or n == -math.huge then
    return 0
  end
  n = math.floor(n)
  if n < 0 then n = 0 end
  if n > 4294967295 then n = 4294967295 end
  return n
end

local function arrayLikeLength(v)
  if type(v) ~= "table" then
    return 0
  end
  return toUint32Clamp(rawget(v, "length"))
end

local function arrayLikeGet(v, index0)
  if type(v) ~= "table" then
    return Values.UNDEFINED
  end
  local key = index0
  if rawget(v, "__kind") == "array" then
    key = index0 + 1
  end
  local item = rawget(v, key)
  if item == nil then
    return Values.UNDEFINED
  end
  return item
end

local function appendArrayLike(dst, src)
  local len = arrayLikeLength(src)
  for i = 0, len - 1 do
    dst[#dst + 1] = arrayLikeGet(src, i)
  end
end

local function newIterator(nextNative)
  local iterator = Values.newObject()
  iterator.next = Values.newNativeFunction(nextNative)
  return iterator
end

local function getSymbolIterator()
  local sym = M.symbolRegistry["Symbol.iterator"]
  if sym == nil then
    sym = setmetatable({ __kind = "symbol", description = "Symbol.iterator" }, {})
    M.symbolRegistry["Symbol.iterator"] = sym
  end
  return sym
end

local function attachIteratorSelf(iterator)
  local sym = getSymbolIterator()
  iterator[sym] = Values.newNativeFunction(function(args, thisVal)
    return thisVal
  end)
  iterator["@@iterator"] = iterator[sym]
  return iterator
end

local function newPromise(value, state)
  if value == nil then
    value = Values.UNDEFINED
  end
  local promise = Values.newObject()
  promise.__kind = "promise"
  promise.state = state or "pending"
  promise.value = value
  promise.handlers = {}
  return promise
end

local function isPromise(v)
  return type(v) == "table" and v.__kind == "promise"
end

local function fulfillPromise(promise, value)
  if not isPromise(promise) or promise.state ~= "pending" then
    return promise
  end
  promise.state = "fulfilled"
  promise.value = value
  local handlers = promise.handlers or {}
  promise.handlers = {}
  for i = 1, #handlers do
    local handler = handlers[i]
    enqueueMicrotask(Values.newNativeFunction(function()
      handler(value)
      return Values.UNDEFINED
    end), "Promise fulfill handler")
  end
  return promise
end

local function resolvePromise(promise, value)
  if isPromise(value) then
    if value.state == "fulfilled" then
      return fulfillPromise(promise, value.value)
    end
    if value.state == "pending" then
      value.handlers[#value.handlers + 1] = function(innerValue)
        resolvePromise(promise, innerValue)
      end
      return promise
    end
  end
  return fulfillPromise(promise, value)
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
    acc = callJs(fn, { acc, thisVal[i], i - 1, thisVal }, Values.UNDEFINED, "Array.prototype.reduce callback")
  end
  return acc
end)

M.arrayPrototype.map = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = arrayLikeLength(thisVal)
  local result = Values.newArray()
  for i = 0, n - 1 do
    result[i + 1] = callJs(fn, { arrayLikeGet(thisVal, i), i, thisVal }, Values.UNDEFINED, "Array.prototype.map callback")
  end
  result.length = n
  return result
end)

-- flat(depth?): flattens nested arrays up to `depth` levels (default 1).
M.arrayPrototype.flat = Values.newNativeFunction(function(args, thisVal)
  local depth = 1
  if args[1] ~= nil and args[1] ~= Values.UNDEFINED then
    local d = tonumber(args[1])
    if d ~= nil then depth = math.floor(d) end
  end
  local result = Values.newArray()
  local n = 0
  local function recurse(arr, remaining)
    local len = arrayLikeLength(arr)
    for i = 0, len - 1 do
      local v = arrayLikeGet(arr, i)
      if remaining > 0 and type(v) == "table" and v.__kind == "array" then
        recurse(v, remaining - 1)
      else
        n = n + 1
        result[n] = v
      end
    end
  end
  recurse(thisVal, depth)
  result.length = n
  return result
end)

-- flatMap(fn): map then flatten one level. Equivalent to map(fn).flat(1).
M.arrayPrototype.flatMap = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = arrayLikeLength(thisVal)
  local result = Values.newArray()
  local out = 0
  for i = 0, n - 1 do
    local mapped = callJs(fn, { arrayLikeGet(thisVal, i), i, thisVal }, Values.UNDEFINED, "Array.prototype.flatMap callback")
    if type(mapped) == "table" and mapped.__kind == "array" then
      local innerLen = arrayLikeLength(mapped)
      for j = 0, innerLen - 1 do
        out = out + 1
        result[out] = arrayLikeGet(mapped, j)
      end
    else
      out = out + 1
      result[out] = mapped
    end
  end
  result.length = out
  return result
end)

M.arrayPrototype.concat = Values.newNativeFunction(function(args, thisVal)
  local out = Values.newArray()
  local n = 0
  local function append(v)
    n = n + 1
    out[n] = v
  end
  local function appendArray(v)
    if type(v) == "table" and v.__kind == "array" then
      local len = arrayLikeLength(v)
      for i = 0, len - 1 do
        append(arrayLikeGet(v, i))
      end
      return true
    end
    return false
  end

  local baseLen = arrayLikeLength(thisVal)
  for i = 0, baseLen - 1 do
    append(arrayLikeGet(thisVal, i))
  end
  for i = 1, #args do
    local item = args[i]
    if not appendArray(item) then
      append(item)
    end
  end
  out.length = n
  return out
end)

M.arrayPrototype.unshift = Values.newNativeFunction(function(args, thisVal)
  local n = arrayLikeLength(thisVal)
  local add = #args
  if add > 0 then
    for i = n, 1, -1 do
      thisVal[i + add] = thisVal[i]
    end
    for i = 1, add do
      thisVal[i] = args[i]
    end
    n = n + add
    thisVal.length = n
  end
  return n
end)

M.arrayPrototype.splice = Values.newNativeFunction(function(args, thisVal)
  local len = arrayLikeLength(thisVal)
  local start = tonumber(args[1]) or 0
  if start < 0 then start = len + start end
  if start < 0 then start = 0 end
  if start > len then start = len end
  local deleteCount = tonumber(args[2])
  if deleteCount == nil or deleteCount == Values.UNDEFINED then
    deleteCount = len - start
  end
  deleteCount = math.max(0, math.min(deleteCount, len - start))

  local removed = Values.newArray()
  for i = 0, deleteCount - 1 do
    removed[i + 1] = arrayLikeGet(thisVal, start + i)
  end
  removed.length = deleteCount

  local insertCount = math.max(0, #args - 2)
  local tailStart = start + deleteCount
  local shift = insertCount - deleteCount

  if shift ~= 0 then
    if shift > 0 then
      for i = len - 1, tailStart, -1 do
        thisVal[i + shift + 1] = thisVal[i + 1]
      end
    else
      for i = tailStart, len - 1 do
        thisVal[i + shift + 1] = thisVal[i + 1]
      end
      for i = len + shift + 1, len do
        thisVal[i] = nil
      end
    end
  end

  for i = 1, insertCount do
    thisVal[start + i] = args[i + 2]
  end

  local newLen = len + shift
  if newLen < 0 then newLen = 0 end
  thisVal.length = newLen
  return removed
end)

M.arrayPrototype.filter = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = thisVal.length or 0
  local result = Values.newArray()
  local j = 0
  for i = 1, n do
    if Values.truthy(callJs(fn, { thisVal[i], i - 1, thisVal }, Values.UNDEFINED, "Array.prototype.filter callback")) then
      j = j + 1
      result[j] = thisVal[i]
    end
  end
  result.length = j
  return result
end)

M.arrayPrototype.forEach = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local n = arrayLikeLength(thisVal)
  for i = 0, n - 1 do
    callJs(fn, { arrayLikeGet(thisVal, i), i, thisVal }, Values.UNDEFINED, "Array.prototype.forEach callback")
  end
  return Values.UNDEFINED
end)

M.arrayPrototype.keys = Values.newNativeFunction(function(_args, thisVal)
  local index = 0
  local len = arrayLikeLength(thisVal)
  return attachIteratorSelf(newIterator(function()
    if index >= len then
      return Values.iteratorResult(Values.UNDEFINED, true)
    end
    local value = index
    index = index + 1
    return Values.iteratorResult(value, false)
  end))
end)

M.arrayPrototype.values = Values.newNativeFunction(function(_args, thisVal)
  local index = 0
  local len = arrayLikeLength(thisVal)
  return attachIteratorSelf(newIterator(function()
    if index >= len then
      return Values.iteratorResult(Values.UNDEFINED, true)
    end
    local value = arrayLikeGet(thisVal, index)
    index = index + 1
    return Values.iteratorResult(value, false)
  end))
end)

M.arrayPrototype.entries = Values.newNativeFunction(function(_args, thisVal)
  local index = 0
  local len = arrayLikeLength(thisVal)
  return attachIteratorSelf(newIterator(function()
    if index >= len then
      return Values.iteratorResult(Values.UNDEFINED, true)
    end
    local entry = Values.newArray()
    entry[1] = index
    entry[2] = arrayLikeGet(thisVal, index)
    entry.length = 2
    index = index + 1
    return Values.iteratorResult(entry, false)
  end))
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

M.arrayPrototype.pop = Values.newNativeFunction(function(_args, thisVal)
  local n = arrayLikeLength(thisVal)
  if n <= 0 then
    thisVal.length = 0
    return Values.UNDEFINED
  end
  local value = thisVal[n]
  thisVal[n] = nil
  thisVal.length = n - 1
  if value == nil then
    return Values.UNDEFINED
  end
  return value
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

M.arrayPrototype.slice = Values.newNativeFunction(function(args, thisVal)
  local len = arrayLikeLength(thisVal)
  local start = tonumber(args[1]) or 0
  local stop = tonumber(args[2])
  if start < 0 then start = len + start end
  if stop == nil or stop == Values.UNDEFINED then
    stop = len
  elseif stop < 0 then
    stop = len + stop
  end
  if start < 0 then start = 0 end
  if stop < start then stop = start end
  local out = Values.newArray()
  local n = 0
  for i = start, math.min(stop, len) - 1 do
    n = n + 1
    out[n] = arrayLikeGet(thisVal, i)
  end
  out.length = n
  return out
end)

M.arrayPrototype.indexOf = Values.newNativeFunction(function(args, thisVal)
  local search = args[1]
  local from = tonumber(args[2]) or 0
  local len = arrayLikeLength(thisVal)
  if from < 0 then from = math.max(len + from, 0) end
  for i = from, len - 1 do
    if arrayLikeGet(thisVal, i) == search then
      return i
    end
  end
  return -1
end)

M.arrayPrototype.lastIndexOf = Values.newNativeFunction(function(args, thisVal)
  local search = args[1]
  local len = arrayLikeLength(thisVal)
  local from = tonumber(args[2]) or (len - 1)
  if from < 0 then from = len + from end
  if from >= len then from = len - 1 end
  for i = from, 0, -1 do
    if arrayLikeGet(thisVal, i) == search then
      return i
    end
  end
  return -1
end)

M.arrayPrototype.includes = Values.newNativeFunction(function(args, thisVal)
  local search = args[1]
  local from = tonumber(args[2]) or 0
  local len = arrayLikeLength(thisVal)
  if from < 0 then from = math.max(len + from, 0) end
  for i = from, len - 1 do
    local v = arrayLikeGet(thisVal, i)
    if v == search then return true end
    -- NaN-sees-NaN semantics
    if type(v) == "number" and type(search) == "number" and v ~= v and search ~= search then
      return true
    end
  end
  return false
end)

M.arrayPrototype.find = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local len = arrayLikeLength(thisVal)
  for i = 0, len - 1 do
    local v = arrayLikeGet(thisVal, i)
    if Values.truthy(callJs(fn, { v, i, thisVal }, Values.UNDEFINED, "Array.prototype.find callback")) then
      return v
    end
  end
  return Values.UNDEFINED
end)

M.arrayPrototype.findIndex = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local len = arrayLikeLength(thisVal)
  for i = 0, len - 1 do
    local v = arrayLikeGet(thisVal, i)
    if Values.truthy(callJs(fn, { v, i, thisVal }, Values.UNDEFINED, "Array.prototype.findIndex callback")) then
      return i
    end
  end
  return -1
end)

M.arrayPrototype.findLast = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local len = arrayLikeLength(thisVal)
  for i = len - 1, 0, -1 do
    local v = arrayLikeGet(thisVal, i)
    if Values.truthy(callJs(fn, { v, i, thisVal }, Values.UNDEFINED, "Array.prototype.findLast callback")) then
      return v
    end
  end
  return Values.UNDEFINED
end)

M.arrayPrototype.findLastIndex = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local len = arrayLikeLength(thisVal)
  for i = len - 1, 0, -1 do
    local v = arrayLikeGet(thisVal, i)
    if Values.truthy(callJs(fn, { v, i, thisVal }, Values.UNDEFINED, "Array.prototype.findLastIndex callback")) then
      return i
    end
  end
  return -1
end)

M.arrayPrototype.some = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local len = arrayLikeLength(thisVal)
  for i = 0, len - 1 do
    if Values.truthy(callJs(fn, { arrayLikeGet(thisVal, i), i, thisVal }, Values.UNDEFINED, "Array.prototype.some callback")) then
      return true
    end
  end
  return false
end)

M.arrayPrototype.every = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local len = arrayLikeLength(thisVal)
  for i = 0, len - 1 do
    if not Values.truthy(callJs(fn, { arrayLikeGet(thisVal, i), i, thisVal }, Values.UNDEFINED, "Array.prototype.every callback")) then
      return false
    end
  end
  return true
end)

M.arrayPrototype.at = Values.newNativeFunction(function(args, thisVal)
  local len = arrayLikeLength(thisVal)
  local idx = tonumber(args[1]) or 0
  if idx < 0 then idx = len + idx end
  if idx < 0 or idx >= len then return Values.UNDEFINED end
  return arrayLikeGet(thisVal, idx)
end)

M.arrayPrototype.fill = Values.newNativeFunction(function(args, thisVal)
  local value = args[1]
  local len = arrayLikeLength(thisVal)
  local start = tonumber(args[2]) or 0
  local stop = tonumber(args[3])
  if stop == nil then stop = len end
  if start < 0 then start = math.max(len + start, 0) end
  if stop < 0 then stop = math.max(len + stop, 0) end
  if stop > len then stop = len end
  for i = start, stop - 1 do
    thisVal[i + 1] = value
  end
  return thisVal
end)

M.arrayPrototype.reverse = Values.newNativeFunction(function(_args, thisVal)
  local len = arrayLikeLength(thisVal)
  local lo, hi = 1, len
  while lo < hi do
    thisVal[lo], thisVal[hi] = thisVal[hi], thisVal[lo]
    lo = lo + 1
    hi = hi - 1
  end
  return thisVal
end)

M.arrayPrototype.sort = Values.newNativeFunction(function(args, thisVal)
  local comparator = args[1]
  local len = arrayLikeLength(thisVal)
  local items = {}
  for i = 1, len do items[i] = thisVal[i] end
  local cmp
  if type(comparator) == "table" and comparator.__kind == "function" then
    cmp = function(a, b)
      local r = callJs(comparator, { a, b }, Values.UNDEFINED, "Array.prototype.sort comparator")
      return (tonumber(r) or 0) < 0
    end
  else
    cmp = function(a, b) return tostring(a) < tostring(b) end
  end
  table.sort(items, cmp)
  for i = 1, len do thisVal[i] = items[i] end
  return thisVal
end)

M.arrayPrototype.reduceRight = Values.newNativeFunction(function(args, thisVal)
  local fn = args[1]
  local len = arrayLikeLength(thisVal)
  local acc
  local start
  if args[2] ~= nil then
    acc = args[2]
    start = len - 1
  else
    acc = arrayLikeGet(thisVal, len - 1)
    start = len - 2
  end
  for i = start, 0, -1 do
    acc = callJs(fn, { acc, arrayLikeGet(thisVal, i), i, thisVal }, Values.UNDEFINED, "Array.prototype.reduceRight callback")
  end
  return acc
end)

M.queueMicrotask = Values.newNativeFunction(function(args)
  enqueueMicrotask(args[1], "queueMicrotask callback")
  return Values.UNDEFINED
end)

M.drainMicrotasks = drainMicrotasks

local function buildPromise()
  local promiseProto
  local function makePromise(value, state)
    local promise = newPromise(value, state)
    if promiseProto then
      promise.__proto__ = promiseProto
    end
    return promise
  end
  local Promise = Values.newNativeFunction(function(args)
    local value = args[1]
    return resolvePromise(makePromise(), value)
  end)
  promiseProto = Values.newObject()
  promiseProto.constructor = Promise
  promiseProto["then"] = Values.newNativeFunction(function(args, thisVal)
    local onFulfilled = args[1]
    local next = makePromise()

    local function settle(value)
      if isPromise(value) then
        resolvePromise(next, value)
      else
        fulfillPromise(next, value)
      end
    end

    local function runHandler(value)
      if type(onFulfilled) == "table" and onFulfilled.__kind == "function" then
        local ok, result = pcall(callJs, onFulfilled, { value }, Values.UNDEFINED)
        if ok then
          settle(result)
        else
          local msg = tostring(result)
          local hl = rawget(_G, "__hostLog")
          if type(hl) == "function" then
            pcall(hl, 2, "[promise] error: " .. msg)
          end
          fulfillPromise(next, Values.UNDEFINED)
        end
      else
        settle(value)
      end
    end

    if isPromise(thisVal) and thisVal.state == "fulfilled" then
      enqueueMicrotask(Values.newNativeFunction(function()
        runHandler(thisVal.value)
        return Values.UNDEFINED
      end), "Promise.then fulfilled immediate")
    elseif isPromise(thisVal) and thisVal.state == "pending" then
      thisVal.handlers[#thisVal.handlers + 1] = runHandler
    else
      enqueueMicrotask(Values.newNativeFunction(function()
        runHandler(thisVal)
        return Values.UNDEFINED
      end), "Promise.then plain immediate")
    end

    return next
  end)
  Promise.prototype = promiseProto
  Promise.resolve = Values.newNativeFunction(function(args)
    local value = args[1]
    if isPromise(value) then
      return value
    end
    return resolvePromise(makePromise(), value)
  end)
  return Promise
end

-- ── String.prototype ─────────────────────────────────────

M.stringPrototype = {}

local function stringSlice(s, startIdx, endIdx)
  local len = #s
  startIdx = tonumber(startIdx) or 0
  endIdx = tonumber(endIdx)
  if startIdx < 0 then startIdx = len + startIdx end
  if endIdx == nil or endIdx == Values.UNDEFINED then
    endIdx = len
  elseif endIdx < 0 then
    endIdx = len + endIdx
  end
  if startIdx < 0 then startIdx = 0 end
  if endIdx < startIdx then return "" end
  return s:sub(startIdx + 1, endIdx)
end

local function splitPlain(s, sep, limit)
  local out = Values.newArray()
  local n = 0
  limit = tonumber(limit)
  if sep == "" then
    for i = 1, #s do
      if limit and limit > 0 and n >= limit then break end
      n = n + 1
      out[n] = s:sub(i, i)
    end
    out.length = n
    return out
  end
  local pos = 1
  while true do
    if limit and limit > 0 and n + 1 >= limit then
      n = n + 1
      out[n] = s:sub(pos)
      break
    end
    local start_pos, end_pos = s:find(sep, pos, true)
    if not start_pos then
      n = n + 1
      out[n] = s:sub(pos)
      break
    end
    n = n + 1
    out[n] = s:sub(pos, start_pos - 1)
    pos = end_pos + 1
  end
  out.length = n
  return out
end

local function splitPattern(s, pattern, limit)
  local out = Values.newArray()
  local n = 0
  local pos = 1
  limit = tonumber(limit)
  while true do
    if limit and limit > 0 and n + 1 >= limit then
      n = n + 1
      out[n] = s:sub(pos)
      break
    end
    local start_pos, end_pos = s:find(pattern, pos)
    if not start_pos then
      n = n + 1
      out[n] = s:sub(pos)
      break
    end
    n = n + 1
    out[n] = s:sub(pos, start_pos - 1)
    pos = end_pos + 1
    if end_pos < start_pos then
      pos = pos + 1
    end
  end
  out.length = n
  return out
end

local function matchArray(s, pattern, global)
  if global then
    local out = Values.newArray()
    local n = 0
    local pos = 1
    while true do
      local start_pos, end_pos = s:find(pattern, pos)
      if not start_pos then break end
      n = n + 1
      out[n] = s:sub(start_pos, end_pos)
      if end_pos < start_pos then
        pos = start_pos + 1
      else
        pos = end_pos + 1
      end
      if pos > #s + 1 then break end
    end
    out.length = n
    return out
  end

  local found = { s:find(pattern) }
  if #found == 0 then return Values.NULL end
  local out = Values.newArray()
  out[1] = s:sub(found[1], found[2])
  for i = 3, #found do
    out[i - 1] = found[i]
  end
  out.length = #found - 1
  return out
end

M.stringPrototype.toString = Values.newNativeFunction(function(args, thisVal)
  return tostring(thisVal)
end)
M.stringPrototype.valueOf = M.stringPrototype.toString
M.stringPrototype.trim = Values.newNativeFunction(function(args, thisVal)
  return (tostring(thisVal):match("^%s*(.-)%s*$"))
end)
M.stringPrototype.includes = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local pattern = toLuaPattern(args[1])
  return s:find(pattern) ~= nil
end)
M.stringPrototype.startsWith = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local prefix = tostring(args[1] or "")
  return s:sub(1, #prefix) == prefix
end)
M.stringPrototype.endsWith = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local suffix = tostring(args[1] or "")
  if #suffix > #s then return false end
  return s:sub(#s - #suffix + 1) == suffix
end)
M.stringPrototype.indexOf = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local pattern = toLuaPattern(args[1])
  local start = tonumber(args[2]) or 0
  if start < 0 then start = 0 end
  local found = s:find(pattern, start + 1)
  if not found then return -1 end
  return found - 1
end)
M.stringPrototype.lastIndexOf = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local search = tostring(args[1] or "")
  local start = tonumber(args[2])
  if start == nil or start > #s then start = #s end
  local last = nil
  local pos = 1
  while true do
    local i = s:find(search, pos, true)
    if not i or i > start + 1 then break end
    last = i
    pos = i + 1
  end
  if not last then return -1 end
  return last - 1
end)
M.stringPrototype.charAt = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local idx = tonumber(args[1]) or 0
  if idx < 0 or idx >= #s then return "" end
  return s:sub(idx + 1, idx + 1)
end)
M.stringPrototype.charCodeAt = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local idx = tonumber(args[1]) or 0
  if idx < 0 or idx >= #s then return 0/0 end
  return string.byte(s, idx + 1)
end)
M.stringPrototype.slice = Values.newNativeFunction(function(args, thisVal)
  return stringSlice(tostring(thisVal), args[1], args[2])
end)
M.stringPrototype.substring = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local startIdx = math.max(tonumber(args[1]) or 0, 0)
  local endIdx = args[2]
  if endIdx == nil or endIdx == Values.UNDEFINED then endIdx = #s end
  endIdx = math.max(tonumber(endIdx) or #s, 0)
  if startIdx > endIdx then startIdx, endIdx = endIdx, startIdx end
  return s:sub(startIdx + 1, endIdx)
end)
M.stringPrototype["repeat"] = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local count = tonumber(args[1]) or 0
  if count <= 0 then return "" end
  return s:rep(count)
end)
M.stringPrototype.toUpperCase = Values.newNativeFunction(function(args, thisVal)
  return tostring(thisVal):upper()
end)
M.stringPrototype.toLowerCase = Values.newNativeFunction(function(args, thisVal)
  return tostring(thisVal):lower()
end)
M.stringPrototype.split = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local sep = args[1]
  local limit = args[2]
  if sep == nil or sep == Values.UNDEFINED then
    local out = Values.newArray()
    for i = 1, #s do out[i] = s:sub(i, i) end
    out.length = #s
    return out
  end
  local pattern, is_global = toLuaPattern(sep)
  if type(sep) == "string" and not isRegex(sep) then
    return splitPlain(s, sep, limit)
  end
  return splitPattern(s, pattern, limit)
end)
M.stringPrototype.match = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local search = args[1]
  if search == nil or search == Values.UNDEFINED then
    return Values.NULL
  end
  local pattern, is_global = toLuaPattern(search)
  return matchArray(s, pattern, isRegex(search) and search.global or is_global)
end)
M.stringPrototype.replace = Values.newNativeFunction(function(args, thisVal)
  local s = tostring(thisVal)
  local search = args[1]
  local replacement = args[2]
  if search == nil or search == Values.UNDEFINED then return s end
  local pattern, _ = toLuaPattern(search)
  local count = (isRegex(search) and search.global) and 0 or 1
  if type(replacement) == "table" and replacement.__kind == "function" then
    local out = s:gsub(pattern, function(...)
      local repl_args = { ... }
      return tostring(callJs(replacement, repl_args, Values.UNDEFINED, "String.prototype.replace callback"))
    end, count)
    return out
  end
  local repl = tostring(replacement or "")
  local out = s:gsub(pattern, repl, count)
  return out
end)

-- ── Number.prototype ─────────────────────────────────────

M.numberPrototype = {}

-- toString(radix?): decimal by default, or radix-N encoding (2..36).
M.numberPrototype.toString = Values.newNativeFunction(function(args, thisVal)
  local n = tonumber(thisVal) or 0
  local radix = tonumber(args[1])
  if radix == nil or radix == 10 then
    if n == math.floor(n) and n > -1e16 and n < 1e16 then
      return string.format("%d", n)
    end
    return tostring(n)
  end
  -- Custom radix 2..36 (integer part only; decimals dropped, matches common usage).
  radix = math.floor(radix)
  if radix < 2 or radix > 36 then
    error("RangeError: toString() radix must be between 2 and 36", 0)
  end
  local neg = n < 0
  if neg then n = -n end
  n = math.floor(n)
  if n == 0 then return "0" end
  local digits = "0123456789abcdefghijklmnopqrstuvwxyz"
  local out = {}
  while n > 0 do
    local r = n % radix
    out[#out + 1] = digits:sub(r + 1, r + 1)
    n = math.floor(n / radix)
  end
  local s = {}
  for i = #out, 1, -1 do s[#s + 1] = out[i] end
  return (neg and "-" or "") .. table.concat(s)
end)

M.numberPrototype.valueOf = Values.newNativeFunction(function(_args, thisVal)
  return tonumber(thisVal) or 0
end)

-- toFixed(digits): decimal-formatted string with a fixed fractional length.
M.numberPrototype.toFixed = Values.newNativeFunction(function(args, thisVal)
  local n = tonumber(thisVal) or 0
  local digits = tonumber(args[1]) or 0
  digits = math.max(0, math.min(100, math.floor(digits)))
  return string.format("%." .. tostring(digits) .. "f", n)
end)

M.numberPrototype.toPrecision = Values.newNativeFunction(function(args, thisVal)
  local n = tonumber(thisVal) or 0
  if args[1] == nil or args[1] == Values.UNDEFINED then
    return tostring(n)
  end
  local precision = math.max(1, math.min(100, math.floor(tonumber(args[1]) or 1)))
  return string.format("%." .. tostring(precision - 1) .. "e", n)
end)

-- toLocaleString(): locale-formatted number. Minimal impl: integers get
-- US-style comma thousands separators; decimals passed through as decimal.
M.numberPrototype.toLocaleString = Values.newNativeFunction(function(_args, thisVal)
  local n = tonumber(thisVal) or 0
  if n ~= n then return "NaN" end
  if n == math.huge then return "∞" end
  if n == -math.huge then return "-∞" end
  local neg = n < 0
  if neg then n = -n end
  local int, frac
  if n == math.floor(n) then
    int = string.format("%d", n)
    frac = nil
  else
    local whole = math.floor(n)
    int = string.format("%d", whole)
    frac = string.format("%.3f", n - whole):sub(3) -- default 0..3 fractional digits
    frac = frac:gsub("0+$", "")
    if frac == "" then frac = nil end
  end
  -- Insert thousands separators.
  local out = {}
  local len = #int
  for i = 1, len do
    if i > 1 and (len - i + 1) % 3 == 0 then out[#out + 1] = "," end
    out[#out + 1] = int:sub(i, i)
  end
  local s = (neg and "-" or "") .. table.concat(out)
  if frac then s = s .. "." .. frac end
  return s
end)

-- ── Boolean.prototype ────────────────────────────────────

M.booleanPrototype = {}
M.booleanPrototype.toString = Values.newNativeFunction(function(_args, thisVal)
  if thisVal == true then return "true" end
  if thisVal == false then return "false" end
  return tostring(thisVal)
end)
M.booleanPrototype.valueOf = Values.newNativeFunction(function(_args, thisVal)
  return thisVal == true
end)

-- ── RegExp.prototype ─────────────────────────────────────

M.regexpPrototype = {}
M.regexpPrototype.toString = Values.newNativeFunction(function(args, thisVal)
  if not isRegex(thisVal) then return "/(?:)/" end
  return "/" .. (thisVal.source or "") .. "/" .. (thisVal.flags or "")
end)
M.regexpPrototype.exec = Values.newNativeFunction(function(args, thisVal)
  if not isRegex(thisVal) then return Values.NULL end
  local s = tostring(args[1] or "")
  local pattern = thisVal.lua_pattern or Values.regexToLuaPattern(thisVal.source or "")
  local found = { s:find(pattern) }
  if #found == 0 then return Values.NULL end
  local out = Values.newArray()
  out[1] = s:sub(found[1], found[2])
  for i = 3, #found do
    out[i - 1] = found[i]
  end
  out.length = #found - 1
  out.index = found[1] - 1
  out.input = s
  return out
end)
M.regexpPrototype.test = Values.newNativeFunction(function(args, thisVal)
  if not isRegex(thisVal) then return false end
  local s = tostring(args[1] or "")
  local pattern = thisVal.lua_pattern or Values.regexToLuaPattern(thisVal.source or "")
  return s:find(pattern) ~= nil
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

  proto.clear = Values.newNativeFunction(function(_args, thisVal)
    thisVal.__map_keys = {}
    thisVal.__map_vals = {}
    thisVal.__map_lookup = {}
    thisVal.size = 0
    return Values.UNDEFINED
  end)

  proto.forEach = Values.newNativeFunction(function(args, thisVal)
    local callback = args[1]
    local thisArg = args[2] or Values.UNDEFINED
    for i = 1, thisVal.size do
      callJs(
        callback,
        { thisVal.__map_vals[i], thisVal.__map_keys[i], thisVal },
        thisArg,
        "Map.prototype.forEach callback"
      )
    end
    return Values.UNDEFINED
  end)

  proto.keys = Values.newNativeFunction(function(args, thisVal)
    local index = 1
    local iterator = newIterator(function()
      if index > thisVal.size then
        return Values.newObject({ value = Values.UNDEFINED, done = true })
      end
      local value = thisVal.__map_keys[index]
      index = index + 1
      return Values.newObject({ value = value, done = false })
    end)
    return attachIteratorSelf(iterator)
  end)

  proto.values = Values.newNativeFunction(function(args, thisVal)
    local index = 1
    local iterator = newIterator(function()
      if index > thisVal.size then
        return Values.newObject({ value = Values.UNDEFINED, done = true })
      end
      local value = thisVal.__map_vals[index]
      index = index + 1
      return Values.newObject({ value = value, done = false })
    end)
    return attachIteratorSelf(iterator)
  end)

  proto.entries = Values.newNativeFunction(function(args, thisVal)
    local index = 1
    local iterator = newIterator(function()
      if index > thisVal.size then
        return Values.newObject({ value = Values.UNDEFINED, done = true })
      end
      local entry = Values.newArray()
      entry[1] = thisVal.__map_keys[index]
      entry[2] = thisVal.__map_vals[index]
      entry.length = 2
      index = index + 1
      return Values.newObject({ value = entry, done = false })
    end)
    return attachIteratorSelf(iterator)
  end)

  local mapIter = Values.newNativeFunction(function(args, thisVal)
    return proto.entries.__native(args, thisVal)
  end)
  proto[getSymbolIterator()] = mapIter
  proto["@@iterator"] = mapIter

  return ctor
end

-- ── Set ──────────────────────────────────────────────────

local function buildSet()
  local ctor = Values.newNativeFunction(function(args, thisVal)
    thisVal.__set_items = {}
    thisVal.__set_values = {}
    thisVal.size = 0
    return thisVal
  end)
  local proto = Values.newObject()
  proto.constructor = ctor
  ctor.prototype = proto

  proto.add = Values.newNativeFunction(function(args, thisVal)
    local v = args[1]
    if thisVal.__set_items[v] == nil then
      thisVal.__set_items[v] = thisVal.size + 1
      thisVal.__set_values[thisVal.size + 1] = v
      thisVal.size = thisVal.size + 1
    end
    return thisVal
  end)

  proto.has = Values.newNativeFunction(function(args, thisVal)
    return thisVal.__set_items[args[1]] ~= nil
  end)

  proto.delete = Values.newNativeFunction(function(args, thisVal)
    local idx = thisVal.__set_items[args[1]]
    if idx then
      thisVal.__set_items[args[1]] = nil
      for i = idx, thisVal.size - 1 do
        local moved = thisVal.__set_values[i + 1]
        thisVal.__set_values[i] = moved
        thisVal.__set_items[moved] = i
      end
      thisVal.__set_values[thisVal.size] = nil
      thisVal.size = thisVal.size - 1
      return true
    end
    return false
  end)

  proto.clear = Values.newNativeFunction(function(_args, thisVal)
    thisVal.__set_items = {}
    thisVal.__set_values = {}
    thisVal.size = 0
    return Values.UNDEFINED
  end)

  proto.forEach = Values.newNativeFunction(function(args, thisVal)
    local callback = args[1]
    local thisArg = args[2] or Values.UNDEFINED
    for i = 1, thisVal.size do
      local value = thisVal.__set_values[i]
      callJs(
        callback,
        { value, value, thisVal },
        thisArg,
        "Set.prototype.forEach callback"
      )
    end
    return Values.UNDEFINED
  end)

  proto.values = Values.newNativeFunction(function(args, thisVal)
    local index = 1
    local iterator = newIterator(function()
      if index > thisVal.size then
        return Values.newObject({ value = Values.UNDEFINED, done = true })
      end
      local value = thisVal.__set_values[index]
      index = index + 1
      return Values.newObject({ value = value, done = false })
    end)
    return attachIteratorSelf(iterator)
  end)

  proto.keys = Values.newNativeFunction(function(args, thisVal)
    return proto.values.__native(args, thisVal)
  end)

  proto.entries = Values.newNativeFunction(function(args, thisVal)
    local index = 1
    local iterator = newIterator(function()
      if index > thisVal.size then
        return Values.newObject({ value = Values.UNDEFINED, done = true })
      end
      local value = thisVal.__set_values[index]
      local entry = Values.newArray()
      entry[1] = value
      entry[2] = value
      entry.length = 2
      index = index + 1
      return Values.newObject({ value = entry, done = false })
    end)
    return attachIteratorSelf(iterator)
  end)

  local setIter = Values.newNativeFunction(function(args, thisVal)
    return proto.values.__native(args, thisVal)
  end)
  proto[getSymbolIterator()] = setIter
  proto["@@iterator"] = setIter

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

  local proto = Values.newObject()
  proto.hasOwnProperty = Values.newNativeFunction(function(args, thisVal)
    local key = args[1]
    if type(thisVal) ~= "table" then
      return false
    end
    return rawget(thisVal, key) ~= nil
  end)
  proto.toString = Values.newNativeFunction(function(_args, thisVal)
    local tag = "Object"
    if thisVal == Values.UNDEFINED then
      tag = "Undefined"
    elseif thisVal == Values.NULL then
      tag = "Null"
    elseif type(thisVal) == "table" then
      if thisVal.__kind == "array" then
        tag = "Array"
      elseif thisVal.__kind == "function" then
        tag = "Function"
      elseif thisVal.__kind == "regexp" then
        tag = "RegExp"
      end
    elseif type(thisVal) == "string" then
      tag = "String"
    elseif type(thisVal) == "number" then
      tag = "Number"
    elseif type(thisVal) == "boolean" then
      tag = "Boolean"
    end
    return "[object " .. tag .. "]"
  end)
  Object.prototype = proto
  Values.OBJECT_PROTOTYPE = proto
  M.arrayPrototype.__proto__ = proto
  Values.ARRAY_PROTOTYPE = M.arrayPrototype

  Object.keys = Values.newNativeFunction(function(args)
    local obj = args[1]
    local arr = Values.newArray()
    local keys = Values.orderedKeys(obj)
    for i = 1, #keys do arr[i] = keys[i] end
    arr.length = #keys
    return arr
  end)

  Object.values = Values.newNativeFunction(function(args)
    local obj = args[1]
    local arr = Values.newArray()
    local keys = Values.orderedKeys(obj)
    for i = 1, #keys do arr[i] = rawget(obj, keys[i]) end
    arr.length = #keys
    return arr
  end)

  Object.entries = Values.newNativeFunction(function(args)
    local obj = args[1]
    local arr = Values.newArray()
    local keys = Values.orderedKeys(obj)
    for i = 1, #keys do
      local pair = Values.newArray()
      pair[1] = keys[i]
      pair[2] = rawget(obj, keys[i])
      pair.length = 2
      arr[i] = pair
    end
    arr.length = #keys
    return arr
  end)

  Object.assign = Values.newNativeFunction(function(args)
    local target = args[1]
    if type(target) ~= "table" then return target end
    for i = 2, #args do
      local src = args[i]
      if type(src) == "table" then
        local keys = Values.orderedKeys(src)
        for j = 1, #keys do
          target[keys[j]] = rawget(src, keys[j])
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
  Object.isSealed = Values.newNativeFunction(function() return false end)
  Object.isExtensible = Values.newNativeFunction(function() return true end)
  Object.seal = Values.newNativeFunction(function(args)
    -- No-op seal — JSRT does not enforce object extensibility state.
    return args[1]
  end)
  Object.preventExtensions = Values.newNativeFunction(function(args)
    -- No-op preventExtensions — React only uses this as a defensive probe.
    return args[1]
  end)

  Object.create = Values.newNativeFunction(function(args)
    local proto = args[1]
    local obj = Values.newObject()
    if proto == Values.NULL or proto == Values.UNDEFINED then
      obj.__proto__ = Values.NULL
    elseif type(proto) == "table" then
      obj.__proto__ = proto
    end
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
  Object.getOwnPropertyDescriptors = Values.newNativeFunction(function(args)
    local target = args[1]
    local out = Values.newObject()
    if type(target) ~= "table" then
      return out
    end
    for k in pairs(target) do
      if type(k) == "string" and k:sub(1, 2) ~= "__" then
        out[k] = Object.getOwnPropertyDescriptor.__native({ target, k }, Values.UNDEFINED)
      end
    end
    return out
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
  Object.defineProperties = Values.newNativeFunction(function(args)
    local target, props = args[1], args[2]
    if type(target) ~= "table" or type(props) ~= "table" then
      return target
    end
    local keys = Object.keys.__native({ props }, Values.UNDEFINED)
    local len = keys.length or 0
    for i = 1, len do
      local key = keys[i]
      Object.defineProperty.__native({ target, key, props[key] }, Values.UNDEFINED)
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
      local keys = Values.orderedKeys(v)
      for i = 1, #keys do
        local k = keys[i]
        local s = jsonStringify(rawget(v, k), seen)
        if s then
          parts[#parts + 1] = '"' .. k .. '":' .. s
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
    local key = tostring(args[1] or "")
    local existing = M.symbolRegistry[key]
    if existing ~= nil then
      return existing
    end
    local sym = setmetatable({ __kind = "symbol", description = key }, {})
    M.symbolRegistry[key] = sym
    return sym
  end)
  Symbol.keyFor = Values.newNativeFunction(function(args)
    local target = args[1]
    for key, sym in pairs(M.symbolRegistry) do
      if sym == target then
        return key
      end
    end
    return Values.UNDEFINED
  end)
  -- JS spelling is Symbol.for, not for_
  Symbol["for"] = Symbol.for_
  return Symbol
end

function M.install(scope)
  local globalThis = Values.newObject()
  globalThis.__global_object = true
  globalThis.__global_scope = scope
  scope.globalObject = globalThis

  local performance = Values.newObject()
  performance.now = Values.newNativeFunction(function()
    return hostNowMs()
  end)
  globalThis.performance = performance
  scope:define("performance", performance)

  local function scheduleTimer(args, interval)
    local fn = args[1]
    local ms = tonumber(args[2]) or 0
    if ms < 0 then ms = 0 end
    local id = timerSeq
    timerSeq = timerSeq + 1
    timers[#timers + 1] = {
      id = id,
      fn = fn,
      due = hostNowMs() + ms,
      interval = interval and math.max(1, ms) or 0,
      cleared = false,
    }
    return id
  end

  local function clearTimer(args)
    local id = tonumber(args[1])
    if id == nil then return Values.UNDEFINED end
    for _, t in ipairs(timers) do
      if t.id == id then
        t.cleared = true
        break
      end
    end
    return Values.UNDEFINED
  end

  local setTimeoutFn = Values.newNativeFunction(function(args)
    return scheduleTimer(args, false)
  end)
  local setIntervalFn = Values.newNativeFunction(function(args)
    return scheduleTimer(args, true)
  end)
  local clearTimeoutFn = Values.newNativeFunction(function(args)
    return clearTimer(args)
  end)
  local clearIntervalFn = Values.newNativeFunction(function(args)
    return clearTimer(args)
  end)
  local zigTickFn = Values.newNativeFunction(function()
    drainTimers()
    return Values.UNDEFINED
  end)
  local drainMicrotasksFn = Values.newNativeFunction(function()
    drainMicrotasks()
    return Values.UNDEFINED
  end)

  globalThis.setTimeout = setTimeoutFn
  globalThis.setInterval = setIntervalFn
  globalThis.clearTimeout = clearTimeoutFn
  globalThis.clearInterval = clearIntervalFn
  globalThis.__zigOS_tick = zigTickFn
  globalThis.queueMicrotask = M.queueMicrotask
  globalThis.__jsrtDrainMicrotasks = drainMicrotasksFn

  scope:define("setTimeout", setTimeoutFn)
  scope:define("setInterval", setIntervalFn)
  scope:define("clearTimeout", clearTimeoutFn)
  scope:define("clearInterval", clearIntervalFn)
  scope:define("__zigOS_tick", zigTickFn)
  scope:define("queueMicrotask", M.queueMicrotask)
  scope:define("__jsrtDrainMicrotasks", drainMicrotasksFn)

  -- Zig's per-frame tick path calls Lua globals directly, not JSRT scope bindings.
  -- Mirror the timer + microtask drain hooks onto _G so post-eval commit flushes
  -- still run once control has returned to the engine loop.
  _G.__zigOS_tick = function()
    drainTimers()
  end
  _G.__jsrtDrainMicrotasks = function()
    drainMicrotasks()
  end

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

  -- Reuse the shared placeholder so native functions created during module load
  -- keep the same prototype object once call/apply/bind are attached here.
  if not Values.FUNCTION_PROTOTYPE then
    Values.FUNCTION_PROTOTYPE = Values.newObject()
  end

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
  globalThis.__proto__ = Values.OBJECT_PROTOTYPE
  Values.FUNCTION_PROTOTYPE.__proto__ = Values.OBJECT_PROTOTYPE
  Values.FUNCTION_PROTOTYPE.call = Values.newNativeFunction(function(args, thisVal)
    local fn = thisVal
    local thisArg = args[1]
    local callArgs = {}
    for i = 2, #args do
      callArgs[#callArgs + 1] = args[i]
    end
    return callJs(fn, callArgs, thisArg, "Function.prototype.call target")
  end)
  Values.FUNCTION_PROTOTYPE.apply = Values.newNativeFunction(function(args, thisVal)
    local fn = thisVal
    local thisArg = args[1]
    local argList = args[2]
    local callArgs = {}
    if argList ~= nil and argList ~= Values.NULL and argList ~= Values.UNDEFINED then
      appendArrayLike(callArgs, argList)
    end
    return callJs(fn, callArgs, thisArg, "Function.prototype.apply target")
  end)
  Values.FUNCTION_PROTOTYPE.bind = Values.newNativeFunction(function(args, thisVal)
    local target = thisVal
    local boundThis = args[1]
    local boundArgs = {}
    for i = 2, #args do
      boundArgs[#boundArgs + 1] = args[i]
    end
    return Values.newNativeFunction(function(callArgs)
      local merged = {}
      for i = 1, #boundArgs do
        merged[#merged + 1] = boundArgs[i]
      end
      for i = 1, #callArgs do
        merged[#merged + 1] = callArgs[i]
      end
      return callJs(target, merged, boundThis, "Function.prototype.bind target")
    end)
  end)

  local Function = Values.newNativeFunction(function()
    return Values.UNDEFINED
  end)
  Function.prototype = Values.FUNCTION_PROTOTYPE
  Values.FUNCTION_PROTOTYPE.constructor = Function
  scope:define("Function", Function)

  local Array = Values.newNativeFunction(function(args)
    local arr = Values.newArray()
    if #args == 1 and type(args[1]) == "number" then
      local len = tonumber(args[1]) or 0
      if len < 0 then len = 0 end
      arr.length = len
      return arr
    end
    local n = 0
    for i = 1, #args do
      n = n + 1
      arr[n] = args[i]
    end
    arr.length = n
    return arr
  end)
  Array.prototype = M.arrayPrototype
  M.arrayPrototype.constructor = Array
  Array.isArray = Values.newNativeFunction(function(args)
    local v = args[1]
    return type(v) == "table" and v.__kind == "array"
  end)
  scope:define("Array", Array)

  local String = Values.newNativeFunction(function(args)
    local v = args[1]
    if v == nil or v == Values.UNDEFINED then return "" end
    return tostring(v)
  end)
  String.prototype = M.stringPrototype
  M.stringPrototype.constructor = String
  scope:define("String", String)

  local RegExp = Values.newNativeFunction(function(args)
    local source = args[1]
    local flags = args[2]
    if type(source) == "table" and source.__kind == "regexp" then
      return Values.newRegExp(source.source or "", source.flags or "")
    end
    return Values.newRegExp(tostring(source or ""), tostring(flags or ""))
  end)
  RegExp.prototype = M.regexpPrototype
  M.regexpPrototype.constructor = RegExp
  scope:define("RegExp", RegExp)
  local Promise = buildPromise()
  globalThis.Promise = Promise
  scope:define("Promise", Promise)

  scope:define("Math",    buildMath())
  scope:define("Number",  buildNumber())
  scope:define("JSON",    buildJSON())
  scope:define("Symbol",  buildSymbol())
  scope:define("console", buildConsole())

  scope:define("globalThis", globalThis)
  scope:define("window", globalThis)
  scope:define("self", globalThis)
end

return M
