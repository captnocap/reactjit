-- Target 11: React-shape createElement + mount via host FFI.
--
-- Proves the whole pipeline handles a React-shaped program: a JS helper
-- builds an element tree, the program walks it and calls the host FFI to
-- mount a Text node with a string child. The evaluator does NOT know that
-- `createElement` is React — it's just a user-defined function.
--
-- Expected op stream:
--   CREATE_TEXT("hello") → id = 1
--   CREATE("Text", {}) → id = 2
--   APPEND(2, 1)
--   APPEND_TO_ROOT(2)

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT   = require("framework.lua.jsrt.init")
local Values = require("framework.lua.jsrt.values")
local AST    = require("framework.lua.jsrt.test.load_generated_ast")

-- Build AST from JS source.
local here = debug.getinfo(1, "S").source:sub(2):match("(.+)/[^/]+$") or "."
local src  = here .. "/target_11_source.js"
local out  = here .. "/target_11_source.ast.lua"
local build_cmd = string.format('node scripts/build-jsast.mjs %q %q', src, out)
local ok = os.execute(build_cmd)
assert(ok == 0 or ok == true, "build-jsast.mjs failed (status " .. tostring(ok) .. ")")
local ast = AST.load(out)

-- Recording host-fns. Each appends to `ops` and returns a fresh id.
local ops = {}
local next_id = 0

local function newId()
  next_id = next_id + 1
  return next_id
end

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
}

JSRT.run(ast, { globals = globals })

-- Verify op stream
assert(#ops == 4, "expected 4 ops, got " .. #ops)

assert(ops[1].op == "CREATE_TEXT", "op[1]: expected CREATE_TEXT, got " .. tostring(ops[1].op))
assert(ops[1].text == "hello",     'op[1].text expected "hello", got ' .. tostring(ops[1].text))
assert(ops[1].id == 1,             "op[1].id expected 1, got " .. tostring(ops[1].id))

assert(ops[2].op == "CREATE",      "op[2]: expected CREATE, got " .. tostring(ops[2].op))
assert(ops[2].type == "Text",      'op[2].type expected "Text", got ' .. tostring(ops[2].type))
assert(ops[2].id == 2,             "op[2].id expected 2, got " .. tostring(ops[2].id))

assert(ops[3].op == "APPEND",      "op[3]: expected APPEND, got " .. tostring(ops[3].op))
assert(ops[3].parentId == 2,       "op[3].parentId expected 2, got " .. tostring(ops[3].parentId))
assert(ops[3].childId == 1,        "op[3].childId expected 1, got " .. tostring(ops[3].childId))

assert(ops[4].op == "APPEND_TO_ROOT", "op[4]: expected APPEND_TO_ROOT, got " .. tostring(ops[4].op))
assert(ops[4].childId == 2,           "op[4].childId expected 2, got " .. tostring(ops[4].childId))

print("target_11_real_react_createElement: ok")
