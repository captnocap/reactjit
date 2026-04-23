-- Tree-walking evaluator. Walks ESTree AST nodes (same shape as acorn/esprima
-- output) and executes JS semantics.
--
-- Input: AST nodes as Lua tables, straight off a JS parser.
-- Scope: ECMAScript semantics at the language level only. No framework awareness.
--
-- Day-1 coverage:
--   Program, ExpressionStatement, BlockStatement, VariableDeclaration,
--   Literal, Identifier, BinaryExpression (arithmetic + comparison).
--
-- Future features get added as handlers here, not as emission rules elsewhere.

local Values = require("framework.lua.jsrt.values")
local Scope  = require("framework.lua.jsrt.scope")
local Builtins = require("framework.lua.jsrt.builtins")
local bit    = require("bit")

local M = {}

local evalStatement
local evalExpression
local callFunction
local lookupProperty
local bindPattern
local hoistFunctionDeclarations
local exprSummary
local statementCounter = 0
local debugCounters = {}

local function fiberSummary(v)
  if type(v) ~= "table" then
    return tostring(v)
  end
  local parts = {}
  parts[#parts + 1] = "kind=" .. tostring(rawget(v, "__kind"))
  local tag = rawget(v, "tag")
  if tag ~= nil then parts[#parts + 1] = "tag=" .. tostring(tag) end
  local key = rawget(v, "key")
  if key ~= nil and key ~= Values.NULL and key ~= Values.UNDEFINED then parts[#parts + 1] = "key=" .. tostring(key) end
  local typev = rawget(v, "type")
  if type(typev) == "string" then
    parts[#parts + 1] = "type=" .. typev
  elseif type(typev) == "table" then
    parts[#parts + 1] = "typeKind=" .. tostring(rawget(typev, "__kind"))
  else
    parts[#parts + 1] = "type=" .. tostring(typev)
  end
  parts[#parts + 1] = "ptr=" .. tostring(v)
  return table.concat(parts, " ")
end

local function debugFloodEnabled()
  return rawget(_G, "__debugFlood") == true
end

local function floodLog(msg)
  if debugFloodEnabled() then
    io.stderr:write(msg, "\n")
  end
end

local function bumpCounter(name)
  local n = (debugCounters[name] or 0) + 1
  debugCounters[name] = n
  return n
end

-- KEY_FNS gates the `[render-trace] ...` writes to stderr. Emptied out so
-- nothing fires; add entries back if you need to inspect a specific fn.
local KEY_FNS = {}

local function summarizeArgs(args)
  local parts = {}
  for i = 1, math.min(#args, 5) do
    parts[#parts + 1] = string.format("[%d]=%s", i, fiberSummary(args[i]))
  end
  return table.concat(parts, " ")
end

local function currentFunctionName(scope)
  local s = scope
  while s do
    if rawget(s, "__fn_name") then
      return rawget(s, "__fn_name")
    end
    s = s.parent
  end
  return "<top-level>"
end

local COMMIT_TRACE_VARS = {
  finishedWork = true,
  lanes = true,
  subtreeHasEffects = true,
  rootHasEffect = true,
  rootDidHavePassiveEffects = true,
  remainingLanes = true,
}

local function stmtDetail(stmt)
  if type(stmt) ~= "table" then
    return tostring(stmt)
  end
  if stmt.type == "ExpressionStatement" then
    return exprSummary(stmt.expression)
  end
  if stmt.type == "IfStatement" then
    return "if " .. exprSummary(stmt.test)
  end
  if stmt.type == "WhileStatement" or stmt.type == "DoWhileStatement" then
    return stmt.type .. " " .. exprSummary(stmt.test)
  end
  if stmt.type == "ForStatement" then
    return "for"
  end
  if stmt.type == "VariableDeclaration" and stmt.declarations and stmt.declarations[1] then
    local decl = stmt.declarations[1]
    if decl.id and decl.id.type == "Identifier" then
      return stmt.kind .. " " .. decl.id.name
    end
  end
  if stmt.type == "ReturnStatement" then
    return "return " .. exprSummary(stmt.argument)
  end
  return stmt.type or "?"
end

local function labelMatches(errLabel, stmtLabel)
  if errLabel == nil then
    return true
  end
  return stmtLabel ~= nil and errLabel == stmtLabel
end

local function arrayLikeLength(value)
  if type(value) ~= "table" then
    return 0
  end
  local len = tonumber(rawget(value, "length")) or 0
  if len ~= len or len <= 0 then
    return 0
  end
  len = math.floor(len)
  if len > 4294967295 then len = 4294967295 end
  return len
end

local function arrayLikeGet(value, index0)
  if type(value) ~= "table" then
    return Values.UNDEFINED
  end
  local key = index0
  if rawget(value, "__kind") == "array" then
    key = index0 + 1
  end
  local item = rawget(value, key)
  if item == nil then
    return Values.UNDEFINED
  end
  return item
end

local function appendSpreadValues(dst, src)
  local len = arrayLikeLength(src)
  local added = 0
  for i = 0, len - 1 do
    dst[#dst + 1] = arrayLikeGet(src, i)
    added = added + 1
  end
  return added
end

local function programTrace(msg)
  if rawget(_G, "__traceProgram") ~= true then
    return
  end
  local logFn = rawget(_G, "__hostLog")
  if type(logFn) == "function" then
    pcall(logFn, msg)
  else
    print(msg)
  end
end

local function scopeDepth(scope)
  local depth = 0
  local s = scope
  while s do
    depth = depth + 1
    s = s.parent
  end
  return depth
end

local function stmtSummary(stmt)
  if type(stmt) ~= "table" then
    return tostring(stmt)
  end
  return stmt.type or "?"
end

exprSummary = function(expr)
  if type(expr) ~= "table" then
    return tostring(expr)
  end
  if expr.type == "Identifier" then
    return expr.name
  end
  if expr.type == "MemberExpression" then
    local left = exprSummary(expr.object)
    local right = expr.computed and ("[" .. exprSummary(expr.property) .. "]") or ("." .. (expr.property and expr.property.name or "?"))
    return left .. right
  end
  if expr.type == "CallExpression" then
    return exprSummary(expr.callee) .. "()"
  end
  if expr.type == "Literal" then
    return tostring(expr.value)
  end
  return expr.type or "?"
end

local function shouldTraceCall(name)
  if type(name) ~= "string" then return false end
  return name == "__commonJS" or name == "__toCommonJS" or name == "__esm" or name == "require" or name:match("^require")
end

local function drainMicrotasks()
  Builtins.drainMicrotasks()
end

-- Property read: object/array key lookup. Walks the __proto__ chain for objects,
-- checks Array.prototype for arrays. Anything not found returns UNDEFINED.
lookupProperty = function(obj, key)
  if type(obj) == "table" and obj.__kind == "array" then
    if key == "length" then return obj.length or 0 end
    local method = require("framework.lua.jsrt.builtins").arrayPrototype[key]
    if method then return method end
  end
  if type(obj) == "string" then
    if key == "length" then return #obj end
    local method = require("framework.lua.jsrt.builtins").stringPrototype[key]
    if method then return method end
  end
  if type(obj) == "number" then
    local method = require("framework.lua.jsrt.builtins").numberPrototype[key]
    if method then return method end
    return Values.UNDEFINED
  end
  if type(obj) == "boolean" then
    local method = require("framework.lua.jsrt.builtins").booleanPrototype[key]
    if method then return method end
    return Values.UNDEFINED
  end
  if type(obj) == "table" and obj.__kind == "regexp" then
    local method = require("framework.lua.jsrt.builtins").regexpPrototype[key]
    if method then return method end
  end
  if type(obj) ~= "table" then
    return Values.UNDEFINED
  end
  local current = obj
  while type(current) == "table" do
    local val = rawget(current, key)
    if val ~= nil then return val end
    current = rawget(current, "__proto__")
  end
  return Values.UNDEFINED
end
M.lookupProperty = lookupProperty

local function hasProperty(obj, key)
  if type(obj) == "table" and obj.__kind == "array" then
    if key == "length" then return true end
    if type(key) == "number" and key >= 0 and key == math.floor(key) then
      return rawget(obj, key + 1) ~= nil
    end
    if type(key) == "string" then
      local n = tonumber(key)
      if n and n >= 0 and n == math.floor(n) then
        return rawget(obj, n + 1) ~= nil
      end
    end
  end
  if type(obj) ~= "table" then
    return false
  end
  local current = obj
  while type(current) == "table" do
    if rawget(current, key) ~= nil then return true end
    current = rawget(current, "__proto__")
  end
  return false
end

-- Bind a destructuring pattern against a value, defining the resulting names
-- in `scope`. Handles:
--   Identifier            — direct name binding
--   ArrayPattern          — positional destructuring from arrays
--   ObjectPattern         — named destructuring from objects
--   RestElement           — "collect the rest" at the end of an ArrayPattern
--   AssignmentPattern     — default-value fallback when value is undefined
-- The same walker also handles destructuring assignment targets. In that mode,
-- identifiers update existing bindings instead of defining new ones.
-- Function params use this same machinery, so `function f({x, y}) {}` works.
bindPattern = function(pattern, value, scope, mode)
  local pt = pattern.type
  if pt == "Identifier" then
    if value == nil then value = Values.UNDEFINED end
    if mode == "assign" then
      scope:set(pattern.name, value)
    else
      scope:define(pattern.name, value)
    end
    return
  end
  if pt == "AssignmentPattern" then
    if value == nil or value == Values.UNDEFINED then
      value = evalExpression(pattern.right, scope)
    end
    bindPattern(pattern.left, value, scope, mode)
    return
  end
  if pt == "ArrayPattern" then
    local len = 0
    if type(value) == "table" and value.__kind == "array" then
      len = value.length or 0
    end
    for i, elem in ipairs(pattern.elements) do
      if elem == nil then
        -- hole in the pattern, skip
      elseif elem.type == "RestElement" then
        local rest = Values.newArray()
        local restLen = 0
        for j = i, len do
          restLen = restLen + 1
          rest[restLen] = value[j] or Values.UNDEFINED
        end
        rest.length = restLen
        bindPattern(elem.argument, rest, scope, mode)
        return
      else
        local v = Values.UNDEFINED
        if type(value) == "table" and value.__kind == "array" then
          v = value[i]
        end
        bindPattern(elem, v, scope, mode)
      end
    end
    return
  end
  if pt == "ObjectPattern" then
    for _, prop in ipairs(pattern.properties) do
      if prop.type == "RestElement" then
        -- Object rest is rarely needed and requires tracking consumed keys;
        -- punt until a real program needs it.
        error("ObjectPattern RestElement not yet supported", 0)
      end
      local key
      if prop.computed then
        key = evalExpression(prop.key, scope)
      elseif prop.key.type == "Identifier" then
        key = prop.key.name
      else
        key = tostring(prop.key.value)
      end
      local v = lookupProperty(value, key)
      bindPattern(prop.value, v, scope, mode)
    end
    return
  end
  error("bindPattern: unsupported pattern type " .. tostring(pt), 0)
end
M.bindPattern = bindPattern

-- Hoist function declarations in a single statement list. This is intentionally
-- shallow: nested blocks/functions manage their own hoisting when they execute.
hoistFunctionDeclarations = function(body, scope)
  for _, stmt in ipairs(body) do
    if stmt.type == "FunctionDeclaration" then
      local fn = Values.newFunction(stmt, scope)
      fn.__debug_name = stmt.id.name
      scope:define(stmt.id.name, fn)
    end
  end
end
M.hoistFunctionDeclarations = hoistFunctionDeclarations

-- Collect identifier names out of a pattern (used for var hoisting).
local function collectPatternNames(pattern, out)
  if not pattern then return end
  local pt = pattern.type
  if pt == "Identifier" then
    out[#out + 1] = pattern.name
  elseif pt == "ArrayPattern" then
    for _, elem in ipairs(pattern.elements or {}) do
      if elem then collectPatternNames(elem, out) end
    end
  elseif pt == "ObjectPattern" then
    for _, prop in ipairs(pattern.properties or {}) do
      if prop.type == "Property" then collectPatternNames(prop.value, out)
      elseif prop.type == "RestElement" then collectPatternNames(prop.argument, out)
      end
    end
  elseif pt == "RestElement" then
    collectPatternNames(pattern.argument, out)
  elseif pt == "AssignmentPattern" then
    collectPatternNames(pattern.left, out)
  end
end

-- Hoist `var` declarations to the surrounding function scope. Recurses into
-- compound statements (if/for/while/try/block/switch/labeled) but stops at
-- nested functions/classes. Every `var x` reachable without crossing a
-- function boundary becomes `x = UNDEFINED` in the passed scope, matching
-- JS hoisting semantics so identifier reads before the declaration line
-- don't throw ReferenceError.
local hoistVarDeclarations
hoistVarDeclarations = function(body, scope)
  if type(body) ~= "table" then return end
  for _, stmt in ipairs(body) do
    if type(stmt) == "table" then
      local t = stmt.type
      if t == "VariableDeclaration" and stmt.kind == "var" then
        local names = {}
        for _, decl in ipairs(stmt.declarations or {}) do
          collectPatternNames(decl.id, names)
        end
        for _, name in ipairs(names) do
          if scope.bindings[name] == nil then
            scope:define(name, Values.UNDEFINED)
          end
        end
      elseif t == "BlockStatement" then
        hoistVarDeclarations(stmt.body, scope)
      elseif t == "IfStatement" then
        if stmt.consequent then hoistVarDeclarations({ stmt.consequent }, scope) end
        if stmt.alternate then hoistVarDeclarations({ stmt.alternate }, scope) end
      elseif t == "ForStatement" then
        if stmt.init and stmt.init.type == "VariableDeclaration" and stmt.init.kind == "var" then
          local names = {}
          for _, decl in ipairs(stmt.init.declarations or {}) do
            collectPatternNames(decl.id, names)
          end
          for _, name in ipairs(names) do
            if scope.bindings[name] == nil then scope:define(name, Values.UNDEFINED) end
          end
        end
        if stmt.body then hoistVarDeclarations({ stmt.body }, scope) end
      elseif t == "ForInStatement" or t == "ForOfStatement" then
        if stmt.left and stmt.left.type == "VariableDeclaration" and stmt.left.kind == "var" then
          local names = {}
          for _, decl in ipairs(stmt.left.declarations or {}) do
            collectPatternNames(decl.id, names)
          end
          for _, name in ipairs(names) do
            if scope.bindings[name] == nil then scope:define(name, Values.UNDEFINED) end
          end
        end
        if stmt.body then hoistVarDeclarations({ stmt.body }, scope) end
      elseif t == "WhileStatement" or t == "DoWhileStatement" then
        if stmt.body then hoistVarDeclarations({ stmt.body }, scope) end
      elseif t == "TryStatement" then
        if stmt.block then hoistVarDeclarations(stmt.block.body, scope) end
        if stmt.handler and stmt.handler.body then
          hoistVarDeclarations(stmt.handler.body.body, scope)
        end
        if stmt.finalizer then hoistVarDeclarations(stmt.finalizer.body, scope) end
      elseif t == "SwitchStatement" then
        for _, case in ipairs(stmt.cases or {}) do
          hoistVarDeclarations(case.consequent, scope)
        end
      elseif t == "LabeledStatement" then
        if stmt.body then hoistVarDeclarations({ stmt.body }, scope) end
      end
      -- Do NOT recurse into FunctionDeclaration / FunctionExpression /
      -- ArrowFunctionExpression / ClassDeclaration / ClassExpression bodies.
    end
  end
end
M.hoistVarDeclarations = hoistVarDeclarations

-- Call a function value with an array of already-evaluated arguments plus an
-- optional `this` binding. Handles native (host-registered) functions and user
-- JS functions. Uses a pcall + sentinel-table pattern to propagate `return`
-- out of the function body without cluttering every statement handler.
callFunction = function(fn, args, thisVal, callerScope, calleeName)
  if type(fn) ~= "table" or fn.__kind ~= "function" then
    local fn_kind = nil
    if type(fn) == "table" then
      fn_kind = fn.__kind
    end
    _ = fn_kind
    if calleeName then
      error("TypeError: attempted to call a non-function value: " .. tostring(calleeName), 0)
    end
    error("TypeError: attempted to call a non-function value", 0)
  end
  thisVal = thisVal or Values.UNDEFINED
  local debugName = calleeName or rawget(fn, "__debug_name") or "<anonymous>"
  local callN = bumpCounter("call:" .. tostring(debugName))
  if callN <= 40 or KEY_FNS[debugName] then
    floodLog(string.format("[call-enter] fn=%s argc=%d this=%s %s", tostring(debugName), #args, fiberSummary(thisVal), summarizeArgs(args)))
  end
  if KEY_FNS[debugName] then
    io.stderr:write(string.format("[render-trace] enter fn=%s argc=%d this=%s %s\n", tostring(debugName), #args, fiberSummary(thisVal), summarizeArgs(args)))
  end
  if fn.__native then
    local nativeResult = fn.__native(args, thisVal)
    if callN <= 40 or KEY_FNS[debugName] then
      floodLog(string.format("[call-exit] fn=%s result=%s", tostring(debugName), fiberSummary(nativeResult)))
    end
    if KEY_FNS[debugName] then
      io.stderr:write(string.format("[render-trace] exit fn=%s result=%s\n", tostring(debugName), fiberSummary(nativeResult)))
    end
    return nativeResult
  end
  local callScope = Scope.new(fn.closure)
  callScope.__job_root = callerScope ~= nil and callerScope.parent == nil
  callScope.__fn_name = debugName
  if not fn.is_arrow then
    callScope:define("this", thisVal)
  end
  for i, paramNode in ipairs(fn.params) do
    if paramNode.type == "RestElement" then
      local rest = Values.newArray()
      local n = 0
      for j = i, #args do
        n = n + 1
        rest[n] = args[j]
      end
      rest.length = n
      bindPattern(paramNode.argument, rest, callScope)
      break
    end
    bindPattern(paramNode, args[i], callScope)
  end
  if not fn.is_arrow and callScope.bindings["arguments"] == nil then
    local argumentsObj = Values.newObject()
    argumentsObj.length = #args
    for i = 1, #args do
      argumentsObj[i - 1] = args[i]
    end
    callScope:define("arguments", argumentsObj)
  end
  -- Hoist var declarations to the function scope. Any `var x` reachable inside
  -- this function's body (even in nested non-function blocks) pre-seeds x as
  -- UNDEFINED so identifier lookups before the declaration statement don't
  -- throw ReferenceError. Matches JS hoisting semantics.
  if fn.body and fn.body.type == "BlockStatement" and fn.body.body then
    hoistVarDeclarations(fn.body.body, callScope)
  end
  -- Expression-bodied arrow: body IS the return expression.
  if fn.is_arrow and fn.body.type ~= "BlockStatement" then
    local exprResult = evalExpression(fn.body, callScope)
    if callN <= 40 or KEY_FNS[debugName] then
      floodLog(string.format("[call-exit] fn=%s result=%s", tostring(debugName), fiberSummary(exprResult)))
    end
    if KEY_FNS[debugName] then
      io.stderr:write(string.format("[render-trace] exit fn=%s result=%s\n", tostring(debugName), fiberSummary(exprResult)))
    end
    return exprResult
  end
  local ok, err = pcall(evalStatement, fn.body, callScope)
  if ok then
    if callN <= 40 or KEY_FNS[debugName] then
      floodLog(string.format("[call-exit] fn=%s result=%s", tostring(debugName), fiberSummary(Values.UNDEFINED)))
    end
    if KEY_FNS[debugName] then
      io.stderr:write(string.format("[render-trace] exit fn=%s result=%s\n", tostring(debugName), fiberSummary(Values.UNDEFINED)))
    end
    return Values.UNDEFINED
  end
  if type(err) == "table" and err.__return then
    if callN <= 40 or KEY_FNS[debugName] then
      floodLog(string.format("[call-exit] fn=%s result=%s", tostring(debugName), fiberSummary(err.value)))
    end
    if KEY_FNS[debugName] then
      io.stderr:write(string.format("[render-trace] exit fn=%s result=%s\n", tostring(debugName), fiberSummary(err.value)))
    end
    return err.value
  end
  floodLog(string.format("[call-throw] fn=%s err=%s", tostring(debugName), tostring(err)))
  if KEY_FNS[debugName] then
    io.stderr:write(string.format("[render-trace] throw fn=%s err=%s\n", tostring(debugName), tostring(err)))
  end
  error(err, 0)
end
M.callFunction = callFunction

-- ── Expressions ──────────────────────────────────────────────

evalExpression = function(node, scope)
  local t = node.type

  if t == "Literal" then
    if node.value == nil then return Values.NULL end
    if type(node.value) == "table" and node.value.__regex then
      return Values.newRegExp(node.value.source or "", node.value.flags or "")
    end
    return node.value
  end

  if t == "Identifier" then
    local fnName = currentFunctionName(scope)
    if node.name == "workInProgress" or node.name == "workInProgressRootExitStatus" or node.name == "next" or (fnName == "commitRootImpl" and COMMIT_TRACE_VARS[node.name]) then
      local n = bumpCounter("read:" .. node.name)
      if n <= 40 or n % 1000 == 0 then
        local value = scope:get(node.name)
        floodLog(string.format("[read] fn=%s name=%s n=%d value=%s", currentFunctionName(scope), node.name, n, fiberSummary(value)))
        return value
      end
    end
    return scope:get(node.name)
  end

  if t == "ArrayExpression" then
    local arr = Values.newArray()
    local n = 0
    for _, elem in ipairs(node.elements) do
      if elem == nil then
        n = n + 1
        arr[n] = Values.UNDEFINED
      elseif elem.type == "SpreadElement" then
        local src = evalExpression(elem.argument, scope)
        n = n + appendSpreadValues(arr, src)
      else
        n = n + 1
        arr[n] = evalExpression(elem, scope)
      end
    end
    arr.length = n
    return arr
  end

  if t == "ThisExpression" then
    if scope:has("this") then return scope:get("this") end
    return Values.UNDEFINED
  end

  if t == "ObjectExpression" then
    local obj = Values.newObject()
    for _, prop in ipairs(node.properties) do
      if prop.type == "Property" then
        local key
        if prop.computed then
          key = tostring(evalExpression(prop.key, scope))
        elseif prop.key.type == "Identifier" then
          key = prop.key.name
        elseif prop.key.type == "Literal" then
          key = tostring(prop.key.value)
        else
          error("ObjectExpression: unsupported key type " .. tostring(prop.key.type), 0)
        end
        obj[key] = evalExpression(prop.value, scope)
      end
    end
    return obj
  end

  if t == "MemberExpression" or t == "OptionalMemberExpression" then
    local obj = evalExpression(node.object, scope)
    if obj == nil or obj == Values.NULL or obj == Values.UNDEFINED then
      if node.optional or t == "OptionalMemberExpression" then
        -- Short-circuit a?.b chain. ChainExpression catches the sentinel
        -- and resolves the whole chain to undefined.
        error({ __chain_nullish = true }, 0)
      end
      error("TypeError: cannot read properties of " .. tostring(obj), 0)
    end
    local key
    if node.computed then
      key = evalExpression(node.property, scope)
      if type(obj) == "table" and obj.__kind == "array" and type(key) == "number" then
        key = key + 1
      end
    else
      key = node.property.name
    end
    return lookupProperty(obj, key)
  end

  if t == "ChainExpression" then
    local ok, result = pcall(evalExpression, node.expression, scope)
    if ok then return result end
    if type(result) == "table" and result.__chain_nullish then
      return Values.UNDEFINED
    end
    error(result, 0)
  end

  if t == "AssignmentExpression" then
    local rhs = evalExpression(node.right, scope)
    if node.operator ~= "=" then
      local current = evalExpression(node.left, scope)
      if node.operator == "+=" then
        -- JS `+=`: string concat if either operand is a string; otherwise numeric add.
        if type(current) == "string" or type(rhs) == "string" then
          rhs = tostring(current) .. tostring(rhs)
        else
          rhs = (tonumber(current) or 0) + (tonumber(rhs) or 0)
        end
      elseif node.operator == "-="  then rhs = (tonumber(current) or 0) - (tonumber(rhs) or 0)
      elseif node.operator == "*="  then rhs = (tonumber(current) or 0) * (tonumber(rhs) or 0)
      elseif node.operator == "/="  then rhs = (tonumber(current) or 0) / (tonumber(rhs) or 0)
      elseif node.operator == "%="  then rhs = (tonumber(current) or 0) % (tonumber(rhs) or 0)
      elseif node.operator == "|="  then rhs = bit.bor(bit.tobit(tonumber(current) or 0), bit.tobit(tonumber(rhs) or 0))
      elseif node.operator == "&="  then rhs = bit.band(bit.tobit(tonumber(current) or 0), bit.tobit(tonumber(rhs) or 0))
      elseif node.operator == "^="  then rhs = bit.bxor(bit.tobit(tonumber(current) or 0), bit.tobit(tonumber(rhs) or 0))
      elseif node.operator == "<<=" then rhs = bit.lshift(bit.tobit(tonumber(current) or 0), bit.tobit(tonumber(rhs) or 0))
      elseif node.operator == ">>=" then rhs = bit.arshift(bit.tobit(tonumber(current) or 0), bit.tobit(tonumber(rhs) or 0))
      elseif node.operator == ">>>=" then rhs = bit.rshift(bit.tobit(tonumber(current) or 0), bit.tobit(tonumber(rhs) or 0))
      elseif node.operator == "||=" then
        if not Values.truthy(current) then rhs = rhs else rhs = current end
      elseif node.operator == "&&=" then
        if Values.truthy(current) then rhs = rhs else rhs = current end
      elseif node.operator == "??=" then
        if current == nil or current == Values.NULL or current == Values.UNDEFINED then rhs = rhs else rhs = current end
      else error("AssignmentExpression: unsupported operator " .. tostring(node.operator), 0) end
    end
    if node.left.type == "Identifier" then
      local fnName = currentFunctionName(scope)
      if node.left.name == "workInProgress" or node.left.name == "workInProgressRootExitStatus" or node.left.name == "next" or (fnName == "commitRootImpl" and COMMIT_TRACE_VARS[node.left.name]) then
        local before = scope.bindings[node.left.name]
        floodLog(string.format("[write] fn=%s name=%s before=%s after=%s rhs=%s", currentFunctionName(scope), node.left.name, fiberSummary(before), fiberSummary(rhs), exprSummary(node.right)))
      end
      scope:set(node.left.name, rhs)
      return rhs
    end
    if node.left.type == "ArrayPattern" or node.left.type == "ObjectPattern" or node.left.type == "AssignmentPattern" then
      if node.operator ~= "=" then
        error("AssignmentExpression: destructuring assignment only supports '='", 0)
      end
      bindPattern(node.left, rhs, scope, "assign")
      return rhs
    end
    if node.left.type == "MemberExpression" then
      local target = evalExpression(node.left.object, scope)
      if type(target) ~= "table" then
        error("TypeError: cannot set property on " .. tostring(target), 0)
      end
      local key
      if node.left.computed then
        key = evalExpression(node.left.property, scope)
        if target.__kind == "array" and type(key) == "number" then
          key = key + 1
        end
      else
        key = node.left.property.name
      end
      if target.__global_object then
        rawset(target, key, rhs)
        local gscope = rawget(target, "__global_scope")
        if gscope then
          gscope:define(key, rhs)
        end
        return rhs
      end
      target[key] = rhs
      if target.__kind == "array" and type(key) == "number" and key > (target.length or 0) then
        target.length = key
      end
      return rhs
    end
    error("AssignmentExpression: unsupported target type " .. tostring(node.left.type), 0)
  end

  if t == "NewExpression" then
    local ctor = evalExpression(node.callee, scope)
    if type(ctor) ~= "table" or ctor.__kind ~= "function" then
      error("TypeError: value is not a constructor", 0)
    end
    local newObj = Values.newObject()
    newObj.__proto__ = ctor.prototype
    local args = {}
    for _, a in ipairs(node.arguments) do
      if a.type == "SpreadElement" then
        local src = evalExpression(a.argument, scope)
        appendSpreadValues(args, src)
      else
        args[#args + 1] = evalExpression(a, scope)
      end
    end
    local result = callFunction(ctor, args, newObj, nil, "new " .. exprSummary(node.callee))
    -- If ctor explicitly returned an object, that's what `new` gives back.
    -- Otherwise, `new` yields the freshly-allocated `this`.
    if type(result) == "table" and (result.__kind == "object" or result.__kind == "array" or result.__kind == "regexp") then
      return result
    end
    return newObj
  end

  if t == "CallExpression" or t == "OptionalCallExpression" then
    local callee_node = node.callee
    local thisVal = Values.UNDEFINED
    local fn
    local callee_name = exprSummary(callee_node)
    if callee_name == nil or callee_name == "" or callee_name == "?" then
      callee_name = "CallExpression<" .. tostring(callee_node and callee_node.type or "?") .. ">"
    end
    local trace_call = shouldTraceCall(callee_name)
    if trace_call then
      programTrace(string.format("[jsrt-call depth=%d] start %s", scopeDepth(scope), callee_name))
    end
    if callee_node.type == "MemberExpression" or callee_node.type == "OptionalMemberExpression" then
      -- Method call: evaluate the object separately so we can pass it as `this`.
      local obj = evalExpression(callee_node.object, scope)
      if obj == nil or obj == Values.NULL or obj == Values.UNDEFINED then
        if callee_node.optional or callee_node.type == "OptionalMemberExpression" then
          error({ __chain_nullish = true }, 0)
        end
        error("TypeError: cannot read properties of " .. tostring(obj), 0)
      end
      thisVal = obj
      local key
      if callee_node.computed then
        key = evalExpression(callee_node.property, scope)
        if type(obj) == "table" and obj.__kind == "array" and type(key) == "number" then
          key = key + 1
        end
      else
        key = callee_node.property.name
      end
      fn = lookupProperty(obj, key)
    else
      fn = evalExpression(callee_node, scope)
    end
    -- Optional call short-circuits when callee is nullish.
    if (node.optional or t == "OptionalCallExpression")
       and (fn == nil or fn == Values.NULL or fn == Values.UNDEFINED) then
      error({ __chain_nullish = true }, 0)
    end
    local args = {}
    for _, arg in ipairs(node.arguments) do
      if arg.type == "SpreadElement" then
        local src = evalExpression(arg.argument, scope)
        appendSpreadValues(args, src)
      else
        args[#args + 1] = evalExpression(arg, scope)
      end
    end
    local result = callFunction(fn, args, thisVal, scope, callee_name)
    if trace_call then
      programTrace(string.format("[jsrt-call depth=%d] done  %s", scopeDepth(scope), callee_name))
    end
    if scope.parent == nil then
      drainMicrotasks()
    end
    return result
  end

  if t == "ClassExpression" then
    -- Same shape as ClassDeclaration but returns the constructor as a value
    -- instead of binding it in scope. Named class expressions (with node.id)
    -- additionally bind the name inside their own body's scope so methods can
    -- refer to the class — for now treat same as anonymous since our method
    -- bodies already capture the enclosing scope.
    local ctor = nil
    local proto = Values.newObject()
    if node.body and node.body.body then
      for _, def in ipairs(node.body.body) do
        if def.type == "MethodDefinition" then
          local method = Values.newFunction(def.value, scope)
          method.__debug_name = def.key and def.key.name or nil
          if def.kind == "constructor" then
            ctor = method
          else
            proto[def.key.name] = method
          end
        end
      end
    end
    if not ctor then
      ctor = Values.newFunction({
        type = "FunctionExpression",
        params = {},
        body = { type = "BlockStatement", body = {} },
      }, scope)
    end
    ctor.prototype = proto
    proto.constructor = ctor
    return ctor
  end

  if t == "FunctionExpression" or t == "ArrowFunctionExpression" then
    return Values.newFunction(node, scope)
  end

  if t == "UnaryExpression" then
    local op = node.operator
    if op == "typeof" then
      -- Special case: typeof of an undeclared identifier is "undefined" (not an error).
      if node.argument.type == "Identifier" and not scope:has(node.argument.name) then
        return "undefined"
      end
      return Values.typeof(evalExpression(node.argument, scope))
    end
    if op == "delete" then
      -- Simplified: return true. Real delete removes own properties.
      return true
    end
    local val = evalExpression(node.argument, scope)
    if op == "!"    then return not Values.truthy(val) end
    if op == "-"    then return -val end
    if op == "+"    then return tonumber(val) or (0/0) end
    if op == "~"    then return bit.bnot(bit.tobit(val)) end
    if op == "void" then return Values.UNDEFINED end
    error("UnaryExpression: unsupported operator " .. tostring(op), 0)
  end

  if t == "UpdateExpression" then
    local current = evalExpression(node.argument, scope)
    if type(current) ~= "number" then current = tonumber(current) or (0/0) end
    local newVal
    if     node.operator == "++" then newVal = current + 1
    elseif node.operator == "--" then newVal = current - 1
    else error("UpdateExpression: unsupported operator " .. tostring(node.operator), 0) end
    if node.argument.type == "Identifier" then
      scope:set(node.argument.name, newVal)
    elseif node.argument.type == "MemberExpression" then
      local target = evalExpression(node.argument.object, scope)
      local key
      if node.argument.computed then
        key = evalExpression(node.argument.property, scope)
        if type(target) == "table" and target.__kind == "array" and type(key) == "number" then
          key = key + 1
        end
      else
        key = node.argument.property.name
      end
      target[key] = newVal
    else
      error("UpdateExpression: unsupported argument type " .. tostring(node.argument.type), 0)
    end
    if node.prefix then return newVal end
    return current
  end

  if t == "ConditionalExpression" then
    if Values.truthy(evalExpression(node.test, scope)) then
      return evalExpression(node.consequent, scope)
    end
    return evalExpression(node.alternate, scope)
  end

  if t == "TemplateLiteral" then
    -- Pattern: quasis[0] ++ exprs[0] ++ quasis[1] ++ exprs[1] ++ ... ++ quasis[n]
    local parts = {}
    for i, quasi in ipairs(node.quasis) do
      parts[#parts + 1] = (quasi.value and (quasi.value.cooked or quasi.value.raw)) or ""
      local exprNode = node.expressions[i]
      if exprNode then
        local v = evalExpression(exprNode, scope)
        if v == Values.UNDEFINED then v = "undefined"
        elseif v == Values.NULL then v = "null"
        end
        parts[#parts + 1] = tostring(v)
      end
    end
    return table.concat(parts)
  end

  if t == "SequenceExpression" then
    local last = Values.UNDEFINED
    for _, e in ipairs(node.expressions) do
      last = evalExpression(e, scope)
    end
    return last
  end

  if t == "LogicalExpression" then
    local left = evalExpression(node.left, scope)
    local op = node.operator
    if op == "||" then
      if Values.truthy(left) then return left end
      return evalExpression(node.right, scope)
    end
    if op == "&&" then
      if not Values.truthy(left) then return left end
      return evalExpression(node.right, scope)
    end
    if op == "??" then
      if left == nil or left == Values.NULL or left == Values.UNDEFINED then
        return evalExpression(node.right, scope)
      end
      return left
    end
    error("LogicalExpression: unsupported operator " .. tostring(op), 0)
  end

  if t == "BinaryExpression" then
    local left  = evalExpression(node.left,  scope)
    local right = evalExpression(node.right, scope)
    local op = node.operator
    if op == "+" then
      if type(left) == "string" or type(right) == "string" then
        return tostring(left) .. tostring(right)
      end
      return left + right
    end
    if op == "-"   then return left - right end
    if op == "*"   then return left * right end
    if op == "/"   then return left / right end
    if op == "%"   then return left % right end
    if op == "===" then return left == right end
    if op == "!==" then return left ~= right end
    if op == "=="  then return left == right end  -- TODO: loose equality coercion rules
    if op == "!="  then return left ~= right end
    if op == "<"   then return left <  right end
    if op == "<="  then return left <= right end
    if op == ">"   then return left >  right end
    if op == ">="  then return left >= right end
    if op == "|"   then return bit.bor(bit.tobit(left), bit.tobit(right)) end
    if op == "&"   then return bit.band(bit.tobit(left), bit.tobit(right)) end
    if op == "^"   then return bit.bxor(bit.tobit(left), bit.tobit(right)) end
    if op == "<<"  then return bit.lshift(bit.tobit(left), bit.tobit(right)) end
    if op == ">>"  then return bit.arshift(bit.tobit(left), bit.tobit(right)) end
    if op == ">>>" then return bit.rshift(bit.tobit(left), bit.tobit(right)) end
    if op == "in" then return hasProperty(right, left) end
    error("BinaryExpression: unsupported operator " .. tostring(op))
  end

  error("evalExpression: unsupported node type " .. tostring(t))
end

-- ── Statements ──────────────────────────────────────────────

evalStatement = function(node, scope)
  local t = node.type

  if t == "ExpressionStatement" then
    return evalExpression(node.expression, scope)
  end

  if t == "IfStatement" then
    local condition = evalExpression(node.test, scope)
    if Values.truthy(condition) then
      return evalStatement(node.consequent, scope)
    elseif node.alternate then
      return evalStatement(node.alternate, scope)
    end
    return Values.UNDEFINED
  end

  if t == "FunctionDeclaration" then
    if scope.bindings[node.id.name] == nil then
      local fn = Values.newFunction(node, scope)
      fn.__debug_name = node.id.name
      scope:define(node.id.name, fn)
    end
    return Values.UNDEFINED
  end

  if t == "ClassDeclaration" then
    local ctor = nil
    local proto = Values.newObject()
    for _, def in ipairs(node.body.body) do
      if def.type == "MethodDefinition" then
        local method = Values.newFunction(def.value, scope)
        method.__debug_name = def.key.name
        if def.kind == "constructor" then
          ctor = method
        else
          proto[def.key.name] = method
        end
      end
    end
    if not ctor then
      ctor = Values.newFunction({
        type = "FunctionExpression",
        params = {},
        body = { type = "BlockStatement", body = {} },
      }, scope)
    end
    ctor.prototype = proto
    proto.constructor = ctor
    scope:define(node.id.name, ctor)
    return Values.UNDEFINED
  end

  if t == "ReturnStatement" then
    local value = Values.UNDEFINED
    if node.argument then
      value = evalExpression(node.argument, scope)
    end
    error({ __return = true, value = value }, 0)
  end

  if t == "ThrowStatement" then
    local value = evalExpression(node.argument, scope)
    floodLog(string.format("[throw] fn=%s value=%s", currentFunctionName(scope), fiberSummary(value)))
    if currentFunctionName(scope) == "commitRootImpl" then
      local message = type(value) == "table" and rawget(value, "message") or nil
      local stack = type(value) == "table" and rawget(value, "stack") or nil
      io.stderr:write(string.format("[commit-throw] value=%s message=%s\n", fiberSummary(value), tostring(message)))
      if stack ~= nil then
        io.stderr:write(string.format("[commit-throw] stack=%s\n", tostring(stack)))
      end
      io.stderr:write(debug.traceback("[commit-throw] lua-trace", 2), "\n")
    end
    error({ __throw = true, value = value }, 0)
  end

  if t == "TryStatement" then
    local ok, err = pcall(evalStatement, node.block, scope)
    if ok then
      if node.finalizer then evalStatement(node.finalizer, scope) end
      return Values.UNDEFINED
    end
    floodLog(string.format("[try] fn=%s caught=%s handler=%s", currentFunctionName(scope), tostring(err), tostring(node.handler ~= nil)))
    -- Non-exception control-flow sentinels must pass through try/catch unchanged.
    if type(err) == "table" and (err.__return or err.__break or err.__continue) then
      if node.finalizer then evalStatement(node.finalizer, scope) end
      error(err, 0)
    end
    -- Thrown value — catch it.
    if node.handler then
      local catchScope = Scope.new(scope)
      if node.handler.param then
        local thrownValue
        if type(err) == "table" and err.__throw then
          thrownValue = err.value
        elseif type(err) == "string" then
          thrownValue = Values.newObject({ message = err, name = "Error" })
        else
          thrownValue = err
        end
        catchScope:define(node.handler.param.name, thrownValue)
      end
      local handler_ok, handler_err = pcall(evalStatement, node.handler.body, catchScope)
      if node.finalizer then evalStatement(node.finalizer, scope) end
      if not handler_ok then error(handler_err, 0) end
      return Values.UNDEFINED
    end
    -- No handler — finally then re-raise.
    if node.finalizer then evalStatement(node.finalizer, scope) end
    error(err, 0)
  end

  if t == "VariableDeclaration" then
    local mode = node.kind == "var" and "assign" or nil
    for _, decl in ipairs(node.declarations) do
      local value = Values.UNDEFINED
      if decl.init then
        value = evalExpression(decl.init, scope)
      end
      -- `var` writes to the hoisted binding in function scope via :set; fall
      -- back to :define if hoisting didn't reach this scope (e.g. code path
      -- never went through callFunction — shouldn't happen for user code).
      if mode == "assign" then
        local ok = pcall(bindPattern, decl.id, value, scope, "assign")
        if not ok then
          bindPattern(decl.id, value, scope)
        end
      else
        bindPattern(decl.id, value, scope)
      end
    end
    return Values.UNDEFINED
  end

  if t == "BlockStatement" then
    local inner = Scope.new(scope)
    inner.__drain_microtasks = scope.__job_root == true
    hoistFunctionDeclarations(node.body, inner)
    local last = Values.UNDEFINED
    local depth = scopeDepth(inner)
    programTrace(string.format("[jsrt-block depth=%d] start len=%d", depth, #node.body))
    for i, stmt in ipairs(node.body) do
      programTrace(string.format("[jsrt-block depth=%d] start #%d %s", depth, i, stmtSummary(stmt)))
      last = evalStatement(stmt, inner)
      programTrace(string.format("[jsrt-block depth=%d] done  #%d %s", depth, i, stmtSummary(stmt)))
      if inner.__drain_microtasks then
        drainMicrotasks()
      end
    end
    programTrace(string.format("[jsrt-block depth=%d] done len=%d", depth, #node.body))
    return last
  end

  if t == "EmptyStatement" then
    return Values.UNDEFINED
  end

  if t == "BreakStatement" then
    error({ __break = true, label = node.label and node.label.name }, 0)
  end

  if t == "ContinueStatement" then
    error({ __continue = true, label = node.label and node.label.name }, 0)
  end

  -- runLoopBody: encapsulates the pcall + break/continue handling used by all
  -- loop variants. Returns two values: continueLoop (bool), broke (bool).
  local function runLoopBody(body, s)
    local ok, err = pcall(evalStatement, body, s)
    if ok then return true, false end
    if type(err) == "table" then
      if err.__break then
        if labelMatches(err.label, node.__label) then
          return false, true
        end
      end
      if err.__continue then
        if labelMatches(err.label, node.__label) then
          return true, false
        end
      end
    end
    error(err, 0)
  end

  if t == "ForStatement" then
    local loopScope = Scope.new(scope)
    local iter = 0
    if node.init then
      if node.init.type == "VariableDeclaration" then
        evalStatement(node.init, loopScope)
      else
        evalExpression(node.init, loopScope)
      end
    end
    while true do
      iter = iter + 1
      if iter <= 20 or iter % 1000 == 0 then
        floodLog(string.format("[loop] fn=%s type=ForStatement iter=%d detail=%s", currentFunctionName(scope), iter, stmtDetail(node)))
      end
      if node.test then
        local testv = evalExpression(node.test, loopScope)
        if iter <= 20 or iter % 1000 == 0 then
          floodLog(string.format("[loop-test] fn=%s type=ForStatement iter=%d value=%s", currentFunctionName(scope), iter, fiberSummary(testv)))
        end
        if not Values.truthy(testv) then break end
      end
      local _, broke = runLoopBody(node.body, loopScope)
      if broke then return Values.UNDEFINED end
      if node.update then evalExpression(node.update, loopScope) end
    end
    return Values.UNDEFINED
  end

  if t == "WhileStatement" then
    local iter = 0
    while true do
      iter = iter + 1
      local testv = evalExpression(node.test, scope)
      if iter <= 20 or iter % 1000 == 0 then
        floodLog(string.format("[loop] fn=%s type=WhileStatement iter=%d test=%s value=%s", currentFunctionName(scope), iter, exprSummary(node.test), fiberSummary(testv)))
      end
      if not Values.truthy(testv) then break end
      local _, broke = runLoopBody(node.body, scope)
      if broke then return Values.UNDEFINED end
    end
    return Values.UNDEFINED
  end

  if t == "DoWhileStatement" then
    local iter = 0
    repeat
      iter = iter + 1
      if iter <= 20 or iter % 1000 == 0 then
        floodLog(string.format("[loop] fn=%s type=DoWhileStatement iter=%d detail=%s", currentFunctionName(scope), iter, stmtDetail(node)))
      end
      local _, broke = runLoopBody(node.body, scope)
      if broke then return Values.UNDEFINED end
      local testv = evalExpression(node.test, scope)
      if iter <= 20 or iter % 1000 == 0 then
        floodLog(string.format("[loop-test] fn=%s type=DoWhileStatement iter=%d value=%s", currentFunctionName(scope), iter, fiberSummary(testv)))
      end
    until not Values.truthy(testv)
    return Values.UNDEFINED
  end

  if t == "ForOfStatement" then
    local iterable = evalExpression(node.right, scope)
    if type(iterable) == "table" and iterable.__kind == "array" then
      local iter = 0
      for i = 1, iterable.length or 0 do
        iter = iter + 1
        if iter <= 20 or iter % 1000 == 0 then
          floodLog(string.format("[loop] fn=%s type=ForOfStatement iter=%d value=%s", currentFunctionName(scope), iter, fiberSummary(iterable[i])))
        end
        local loopScope = Scope.new(scope)
        if node.left.type == "VariableDeclaration" then
          bindPattern(node.left.declarations[1].id, iterable[i], loopScope)
        elseif node.left.type == "Identifier" then
          scope:set(node.left.name, iterable[i])
        else
          bindPattern(node.left, iterable[i], loopScope)
        end
        local _, broke = runLoopBody(node.body, loopScope)
        if broke then return Values.UNDEFINED end
      end
      return Values.UNDEFINED
    end
    -- TODO: full iterator protocol (Symbol.iterator) for non-array iterables.
    error("ForOfStatement: only arrays supported so far", 0)
  end

  if t == "ForInStatement" then
    local obj = evalExpression(node.right, scope)
    if type(obj) ~= "table" then return Values.UNDEFINED end
    -- Iterate own enumerable string keys in insertion order. Arrays iterate
    -- their indices as stringified numbers.
    local keys
    if obj.__kind == "array" then
      keys = {}
      local len = obj.length or 0
      for i = 0, len - 1 do keys[#keys + 1] = tostring(i) end
    else
      keys = Values.orderedKeys(obj)
    end
    for iter = 1, #keys do
      local k = keys[iter]
      if iter <= 20 or iter % 1000 == 0 then
        floodLog(string.format("[loop] fn=%s type=ForInStatement iter=%d key=%s", currentFunctionName(scope), iter, tostring(k)))
      end
      local loopScope = Scope.new(scope)
      if node.left.type == "VariableDeclaration" then
        bindPattern(node.left.declarations[1].id, k, loopScope)
      elseif node.left.type == "Identifier" then
        scope:set(node.left.name, k)
      else
        bindPattern(node.left, k, loopScope)
      end
      local _, broke = runLoopBody(node.body, loopScope)
      if broke then return Values.UNDEFINED end
    end
    return Values.UNDEFINED
  end

  if t == "SwitchStatement" then
    local discriminant = evalExpression(node.discriminant, scope)
    local inner = Scope.new(scope)
    inner.__drain_microtasks = scope.__job_root == true
    for _, case in ipairs(node.cases) do
      hoistFunctionDeclarations(case.consequent or {}, inner)
    end

    local startIndex = nil
    local defaultIndex = nil
    for i, case in ipairs(node.cases) do
      if case.test == nil then
        defaultIndex = i
      elseif startIndex == nil and evalExpression(case.test, inner) == discriminant then
        startIndex = i
      end
    end

    local firstIndex = startIndex or defaultIndex
    if not firstIndex then
      return Values.UNDEFINED
    end

    for i = firstIndex, #node.cases do
      local case = node.cases[i]
      if case.consequent then
        for _, stmt in ipairs(case.consequent) do
          local ok, err = pcall(evalStatement, stmt, inner)
          if not ok then
            if type(err) == "table" and err.__break then
              if labelMatches(err.label, node.__label) then
                return Values.UNDEFINED
              end
            end
            error(err, 0)
          end
          if inner.__drain_microtasks then
            drainMicrotasks()
          end
        end
      end
    end
    return Values.UNDEFINED
  end

  if t == "LabeledStatement" then
    local body = node.body
    local label = node.label and node.label.name or nil
    if type(body) == "table" and (
      body.type == "ForStatement" or
      body.type == "WhileStatement" or
      body.type == "DoWhileStatement" or
      body.type == "ForOfStatement" or
      body.type == "ForInStatement" or
      body.type == "SwitchStatement"
    ) then
      body.__label = label
      return evalStatement(body, scope)
    end
    local ok, err = pcall(evalStatement, body, scope)
    if ok then
      return err
    end
    if type(err) == "table" and err.__break and err.label == label then
      return Values.UNDEFINED
    end
    error(err, 0)
  end

  error("evalStatement: unsupported node type " .. tostring(t))
end

-- ── Program entry ──────────────────────────────────────────

function M.runProgram(ast, scope)
  assert(ast.type == "Program", "expected a Program node at top level")
  local last = Values.UNDEFINED
  programTrace(string.format("[jsrt-program] begin body len=%d", #ast.body))
  hoistFunctionDeclarations(ast.body, scope)
  programTrace("[jsrt-program] after hoist")
  for i, stmt in ipairs(ast.body) do
    programTrace(string.format("[jsrt-program] start #%d %s", i, stmt.type))
    last = evalStatement(stmt, scope)
    programTrace(string.format("[jsrt-program] done  #%d %s", i, stmt.type))
    drainMicrotasks()
  end
  drainMicrotasks()
  return last
end

-- Exposed for testing individual evaluator paths.
M._evalExpression = evalExpression
M._evalStatement  = evalStatement

return M
