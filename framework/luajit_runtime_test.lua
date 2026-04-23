package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")
local Values = require("framework.lua.jsrt.values")
local Evaluator = require("framework.lua.jsrt.evaluator")
local AST = require("framework.lua.jsrt.test.load_generated_ast")

local src = "./framework/lua/jsrt/test/target_12_source.js"
local out = "/tmp/reactjit_luajit_runtime_target12.ast.lua"
local ok = os.execute(string.format("node scripts/build-jsast.mjs %q %q", src, out))
assert(ok == 0 or ok == true, "build-jsast.mjs failed")
local ast = AST.load(out)

local dispatchFn = nil
local globals = {
  __hostCreate = Values.newNativeFunction(function(args)
    return __hostCreate(tostring(args[1] or ""), args[2] or {})
  end),
  __hostCreateText = Values.newNativeFunction(function(args)
    return __hostCreateText(tostring(args[1] or ""))
  end),
  __hostAppend = Values.newNativeFunction(function(args)
    __hostAppend(args[1], args[2])
    return Values.UNDEFINED
  end),
  __hostAppendToRoot = Values.newNativeFunction(function(args)
    __hostAppendToRoot(args[1])
    return Values.UNDEFINED
  end),
  __hostUpdateText = Values.newNativeFunction(function(args)
    __hostUpdateText(args[1], tostring(args[2] or ""))
    return Values.UNDEFINED
  end),
  __registerDispatch = Values.newNativeFunction(function(args)
    dispatchFn = args[1]
    return Values.UNDEFINED
  end),
}

JSRT.run(ast, { globals = globals })
assert(dispatchFn ~= nil, "dispatch not registered")

function __zig_dispatch()
  Evaluator.callFunction(dispatchFn, {}, Values.UNDEFINED)
end
