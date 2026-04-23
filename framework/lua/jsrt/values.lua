-- JSRT value representation.
--
-- Most JS values map to Lua types naturally:
--   number  → Lua number
--   string  → Lua string
--   boolean → Lua boolean
--
-- Values Lua can't represent directly:
--   null      → dedicated NULL sentinel (distinct from Lua nil, which stands for
--               "missing binding" / "not declared")
--   undefined → dedicated UNDEFINED sentinel (distinct from NULL — JS treats them
--               as different values: `null === undefined` is false)
--
-- Objects, arrays, and functions: Lua tables with a __kind field.
--   __kind == "object"   → plain object, keys are string properties
--   __kind == "array"    → array, 1-indexed Lua storage + explicit length field
--   __kind == "function" → callable, either { __native = fn } for host fns or
--                          { params, body, closure, is_arrow } for user fns

local M = {}
M.OBJECT_PROTOTYPE = nil
M.FUNCTION_PROTOTYPE = { __kind = "object" }

M.NULL      = setmetatable({}, { __tostring = function() return "null" end })
M.UNDEFINED = setmetatable({}, { __tostring = function() return "undefined" end })

local function regexToLuaPattern(source)
  local parts = {}
  local i = 1
  while i <= #source do
    local c = source:sub(i, i)
    if c == "\\" and i < #source then
      local n = source:sub(i + 1, i + 1)
      if n == "s" then parts[#parts + 1] = "%s"
      elseif n == "S" then parts[#parts + 1] = "%S"
      elseif n == "d" then parts[#parts + 1] = "%d"
      elseif n == "D" then parts[#parts + 1] = "%D"
      elseif n == "w" then parts[#parts + 1] = "%w"
      elseif n == "W" then parts[#parts + 1] = "%W"
      elseif n == "n" then parts[#parts + 1] = "\n"
      elseif n == "r" then parts[#parts + 1] = "\r"
      elseif n == "t" then parts[#parts + 1] = "\t"
      elseif n == "f" then parts[#parts + 1] = "\f"
      elseif n == "v" then parts[#parts + 1] = "\v"
      else
        parts[#parts + 1] = n
      end
      i = i + 2
    elseif c == "%" then
      parts[#parts + 1] = "%%"
      i = i + 1
    else
      parts[#parts + 1] = c
      i = i + 1
    end
  end
  return table.concat(parts)
end

function M.regexToLuaPattern(source)
  return regexToLuaPattern(source or "")
end

function M.newRegExp(source, flags)
  return {
    __kind = "regexp",
    source = source or "",
    flags = flags or "",
    lua_pattern = regexToLuaPattern(source or ""),
    global = type(flags) == "string" and flags:find("g", 1, true) ~= nil,
  }
end

function M.typeof(v)
  if v == M.NULL then return "object" end       -- JS quirk: typeof null === "object"
  if v == M.UNDEFINED then return "undefined" end
  local t = type(v)
  if t == "nil" then return "undefined" end
  if t == "number" or t == "string" or t == "boolean" then return t end
  if t == "table" then
    if v.__kind == "function" then return "function" end
    if v.__kind == "regexp" then return "object" end
    return "object"
  end
  return "object"
end

-- JS truthiness: 0, "", NaN, null, undefined all falsy (Lua only treats false/nil that way).
function M.truthy(v)
  if v == nil or v == M.NULL or v == M.UNDEFINED then return false end
  if v == false then return false end
  if v == 0 then return false end
  if v == "" then return false end
  if type(v) == "number" and v ~= v then return false end
  return true
end

-- Shared metatable for JS-like objects. Intercepts first-write to each
-- user-visible key and appends it to __keys, giving Object.keys / .values /
-- .entries / Object.assign / for-in insertion-order iteration — a real JS
-- spec requirement that React (and most JS libs) silently depend on.
-- Re-assigning an existing key does NOT fire __newindex, so ordering stays
-- stable across updates. Internal fields (anything prefixed with __) are
-- excluded from the keys list.
local ObjectMeta = {
  __newindex = function(t, k, v)
    if type(k) == "string" and k:sub(1, 2) ~= "__" then
      local keys = rawget(t, "__keys")
      if keys and v ~= nil then
        keys[#keys + 1] = k
      end
    end
    rawset(t, k, v)
  end,
}
M.ObjectMeta = ObjectMeta

-- Delete a user property, keeping __keys in sync. Callers use this when they
-- want JS-style delete semantics.
function M.deleteProp(obj, key)
  if type(obj) ~= "table" then return end
  rawset(obj, key, nil)
  local keys = rawget(obj, "__keys")
  if keys and type(key) == "string" then
    for i = 1, #keys do
      if keys[i] == key then
        table.remove(keys, i)
        return
      end
    end
  end
end

-- Ordered list of user keys for iteration. Falls back to `pairs` filtering
-- for objects that never went through the metatable (shouldn't happen in
-- practice, but keeps backwards compatibility).
function M.orderedKeys(obj)
  if type(obj) ~= "table" then return {} end
  local keys = rawget(obj, "__keys")
  if type(keys) == "table" then
    local out = {}
    for i = 1, #keys do out[i] = keys[i] end
    return out
  end
  local out = {}
  for k in pairs(obj) do
    if type(k) == "string" and k:sub(1, 2) ~= "__" then
      out[#out + 1] = k
    end
  end
  return out
end

function M.newObject(props)
  local o = { __kind = "object", __keys = {} }
  setmetatable(o, ObjectMeta)
  if M.OBJECT_PROTOTYPE then
    rawset(o, "__proto__", M.OBJECT_PROTOTYPE)
  end
  if props then
    for k, v in pairs(props) do o[k] = v end
  end
  return o
end

function M.newArray(items)
  local a = { __kind = "array", length = items and #items or 0 }
  if M.ARRAY_PROTOTYPE then
    a.__proto__ = M.ARRAY_PROTOTYPE
  end
  if items then
    for i = 1, #items do a[i] = items[i] end
  end
  return a
end

function M.newNativeFunction(fn)
  local out = { __kind = "function", __native = fn }
  if M.FUNCTION_PROTOTYPE then
    out.__proto__ = M.FUNCTION_PROTOTYPE
  end
  return out
end

-- User-authored JS function. Captures the defining scope as its closure.
-- `params` stored as the raw AST nodes (Identifier / ArrayPattern / ObjectPattern /
-- RestElement / AssignmentPattern) so callFunction can use bindPattern for
-- destructuring + rest + defaults.
-- Non-arrow functions get a fresh `prototype` object so they can be used as
-- constructors via `new`. Arrows don't have `prototype` — they can't be `new`'d.
function M.newFunction(node, closure)
  local fn = {
    __kind = "function",
    params = node.params or {},
    body = node.body,
    closure = closure,
    is_arrow = (node.type == "ArrowFunctionExpression"),
  }
  if M.FUNCTION_PROTOTYPE then
    fn.__proto__ = M.FUNCTION_PROTOTYPE
  end
  if not fn.is_arrow then
    fn.prototype = M.newObject()
    fn.prototype.constructor = fn
  end
  return fn
end

return M
