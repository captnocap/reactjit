-- Demo: real TSX → esbuild → acorn → JSRT → host ops.
--
-- Not a formal target (not picked up by run_targets.sh) because its run cost
-- includes esbuild + node. But it's the concrete proof that JSRT handles a
-- program produced by the real authoring pipeline, not only hand-written JS.
--
-- Run: luajit framework/lua/jsrt/test/demo_esbuild_bridge.lua

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT      = require("framework.lua.jsrt.init")
local Values    = require("framework.lua.jsrt.values")
local Evaluator = require("framework.lua.jsrt.evaluator")
local AST       = require("framework.lua.jsrt.test.load_generated_ast")

local here = debug.getinfo(1, "S").source:sub(2):match("(.+)/[^/]+$") or "."
local tsx  = here .. "/demo_esbuild_bridge.tsx"
local js   = here .. "/demo_esbuild_bridge.js"
local ast  = here .. "/demo_esbuild_bridge.ast.lua"

local ok
ok = os.execute(string.format(
  'npx esbuild %q --bundle --format=iife --jsx-factory=h --jsx-fragment=Fragment --outfile=%q 2>&1 >/dev/null',
  tsx, js
))
assert(ok == 0 or ok == true, "esbuild failed")
ok = os.execute(string.format('node scripts/build-jsast.mjs %q %q', js, ast))
assert(ok == 0 or ok == true, "build-jsast.mjs failed")
local program = AST.load(ast)

local ops = {}
local nextId = 0
local function newId() nextId = nextId + 1; return nextId end

local globals = {
  -- JSX factory. esbuild lowers `<X>...</X>` to `h(X, props, ...children)`.
  -- If X is a function, invoke it with props.children set — then return its tree.
  h = Values.newNativeFunction(function(args)
    local Type = args[1]
    local props = args[2]
    local children = {}
    for i = 3, #args do children[#children + 1] = args[i] end
    if type(Type) == "table" and Type.__kind == "function" then
      local finalProps = Values.newObject()
      if type(props) == "table" then
        for k, v in pairs(props) do
          if type(k) == "string" and k:sub(1, 2) ~= "__" then finalProps[k] = v end
        end
      end
      if #children == 1 then
        finalProps.children = children[1]
      elseif #children > 1 then
        local arr = Values.newArray()
        for i, c in ipairs(children) do arr[i] = c end
        arr.length = #children
        finalProps.children = arr
      end
      return Evaluator.callFunction(Type, { finalProps }, Values.UNDEFINED, nil, "demo_esbuild_bridge component")
    end
    -- Fallback for host-string types (not exercised here)
    return { kind = Type, props = props, children = children }
  end),

  __hostCreate = Values.newNativeFunction(function(args)
    local id = newId()
    ops[#ops + 1] = { op = "CREATE", type = args[1], id = id }
    return id
  end),
  __hostCreateText = Values.newNativeFunction(function(args)
    local id = newId()
    ops[#ops + 1] = { op = "CREATE_TEXT", text = args[1], id = id }
    return id
  end),
  __hostAppend = Values.newNativeFunction(function(args)
    ops[#ops + 1] = { op = "APPEND", parentId = args[1], childId = args[2] }
    return Values.UNDEFINED
  end),
  __hostAppendToRoot = Values.newNativeFunction(function(args)
    ops[#ops + 1] = { op = "APPEND_TO_ROOT", id = args[1] }
    return Values.UNDEFINED
  end),
}

JSRT.run(program, { globals = globals })

assert(#ops == 4, "expected 4 ops, got " .. #ops)
assert(ops[1].op == "CREATE" and ops[1].type == "Text", "op 1 expected CREATE Text")
assert(ops[2].op == "CREATE_TEXT" and ops[2].text == "hello", 'op 2 expected CREATE_TEXT "hello"')
assert(ops[3].op == "APPEND",        "op 3 expected APPEND")
assert(ops[4].op == "APPEND_TO_ROOT", "op 4 expected APPEND_TO_ROOT")

print("demo_esbuild_bridge: ok — real TSX → esbuild → JSRT produced the expected host-op stream")
