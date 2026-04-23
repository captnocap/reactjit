-- Target 12: useState counter with re-render on event.
--
-- Mount a Counter component (Pressable + Text with n). Dispatch a simulated
-- click. Verify the resulting op stream:
--
--   Initial mount:
--     CREATE_TEXT("0"), CREATE("Text"), APPEND, CREATE("Pressable"),
--     APPEND, APPEND_TO_ROOT
--   Click dispatch:
--     UPDATE_TEXT(textId, "1")
--   Second click dispatch:
--     UPDATE_TEXT(textId, "2")

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT      = require("framework.lua.jsrt.init")
local Values    = require("framework.lua.jsrt.values")
local Evaluator = require("framework.lua.jsrt.evaluator")
local AST       = require("framework.lua.jsrt.test.load_generated_ast")

-- Build AST.
local here = debug.getinfo(1, "S").source:sub(2):match("(.+)/[^/]+$") or "."
local src  = here .. "/target_12_source.js"
local out  = here .. "/target_12_source.ast.lua"
local ok = os.execute(string.format('node scripts/build-jsast.mjs %q %q', src, out))
assert(ok == 0 or ok == true, "build-jsast.mjs failed")
local ast = AST.load(out)

-- Op recorder + dispatch holder.
local ops = {}
local next_id = 0
local function newId()
  next_id = next_id + 1
  return next_id
end

local dispatchFn = nil

local globals = {
  __hostCreateText = Values.newNativeFunction(function(args)
    local id = newId()
    ops[#ops + 1] = { op = "CREATE_TEXT", text = args[1], id = id }
    return id
  end),
  __hostCreate = Values.newNativeFunction(function(args)
    local id = newId()
    ops[#ops + 1] = { op = "CREATE", type = args[1], props = args[2], id = id }
    return id
  end),
  __hostAppend = Values.newNativeFunction(function(args)
    ops[#ops + 1] = { op = "APPEND", parentId = args[1], childId = args[2] }
    return Values.UNDEFINED
  end),
  __hostAppendToRoot = Values.newNativeFunction(function(args)
    ops[#ops + 1] = { op = "APPEND_TO_ROOT", childId = args[1] }
    return Values.UNDEFINED
  end),
  __hostUpdateText = Values.newNativeFunction(function(args)
    ops[#ops + 1] = { op = "UPDATE_TEXT", id = args[1], text = args[2] }
    return Values.UNDEFINED
  end),
  __registerDispatch = Values.newNativeFunction(function(args)
    dispatchFn = args[1]
    return Values.UNDEFINED
  end),
}

JSRT.run(ast, { globals = globals })

-- Initial mount: expect 6 ops (CREATE Pressable, CREATE Text, CREATE_TEXT "0",
-- APPEND text↔string, APPEND pressable↔text, APPEND_TO_ROOT). Order varies by
-- mount strategy; check presence rather than position.
assert(#ops == 6, "initial mount expected 6 ops, got " .. #ops)

local textId, foundZero, appendToRootCount = nil, false, 0
for _, o in ipairs(ops) do
  if o.op == "CREATE" and o.type == "Text" then textId = o.id end
  if o.op == "CREATE_TEXT" and o.text == "0" then foundZero = true end
  if o.op == "APPEND_TO_ROOT" then appendToRootCount = appendToRootCount + 1 end
end
assert(textId ~= nil,        "expected a CREATE Text op in mount stream")
assert(foundZero,             'expected CREATE_TEXT "0" in mount stream')
assert(appendToRootCount == 1, "expected exactly one APPEND_TO_ROOT, got " .. appendToRootCount)

-- Simulate a click. Should fire handler → setN(1) → rerender → UPDATE_TEXT.
local prevCount = #ops
assert(dispatchFn ~= nil, "dispatch not registered")
Evaluator.callFunction(dispatchFn, {}, Values.UNDEFINED, nil, "target_12 first dispatch")

assert(#ops == prevCount + 1, "click expected 1 new op, got " .. (#ops - prevCount))
local u1 = ops[#ops]
assert(u1.op == "UPDATE_TEXT", "click op expected UPDATE_TEXT, got " .. tostring(u1.op))
assert(u1.id == textId,        "click UPDATE_TEXT id expected " .. tostring(textId) .. ", got " .. tostring(u1.id))
assert(u1.text == "1",         'click UPDATE_TEXT text expected "1", got ' .. tostring(u1.text))

-- Second click.
Evaluator.callFunction(dispatchFn, {}, Values.UNDEFINED, nil, "target_12 second dispatch")
assert(#ops == prevCount + 2, "second click expected 1 more op, got " .. (#ops - prevCount - 1))
local u2 = ops[#ops]
assert(u2.op == "UPDATE_TEXT",  "second click op expected UPDATE_TEXT, got " .. tostring(u2.op))
assert(u2.text == "2",          'second click text expected "2", got ' .. tostring(u2.text))

-- Third click to prove state really persists (not a fluke).
Evaluator.callFunction(dispatchFn, {}, Values.UNDEFINED, nil, "target_12 third dispatch")
local u3 = ops[#ops]
assert(u3.text == "3",          'third click text expected "3", got ' .. tostring(u3.text))

print("target_12_useState_counter: ok")
