-- Target 09: host FFI call.
--
-- Prove native function values injected as globals are callable from evaluated
-- JS, and that arguments/returns marshal across the boundary correctly.
--
-- JS:
--   let id = __hostCreateText("hello");
--   __hostAppendToRoot(id);
--
-- After run, the recorded op stream must be:
--   [{op: "CREATE_TEXT", text: "hello", id: 1}, {op: "APPEND_TO_ROOT", id: 1}]

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT   = require("framework.lua.jsrt.init")
local Values = require("framework.lua.jsrt.values")

local ops = {}
local id_counter = 0

local globals = {
  __hostCreateText = Values.newNativeFunction(function(args)
    id_counter = id_counter + 1
    ops[#ops + 1] = { op = "CREATE_TEXT", text = args[1], id = id_counter }
    return id_counter
  end),
  __hostAppendToRoot = Values.newNativeFunction(function(args)
    ops[#ops + 1] = { op = "APPEND_TO_ROOT", id = args[1] }
    return Values.UNDEFINED
  end),
}

local ast = {
  type = "Program",
  body = {
    -- let id = __hostCreateText("hello");
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "id" },
          init = {
            type = "CallExpression",
            callee = { type = "Identifier", name = "__hostCreateText" },
            arguments = { { type = "Literal", value = "hello" } },
          },
        },
      },
    },
    -- __hostAppendToRoot(id);
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "__hostAppendToRoot" },
        arguments = { { type = "Identifier", name = "id" } },
      },
    },
  },
}

JSRT.run(ast, { globals = globals })

assert(#ops == 2, "expected 2 ops, got " .. #ops)
assert(ops[1].op == "CREATE_TEXT", "op[1].op expected CREATE_TEXT, got " .. tostring(ops[1].op))
assert(ops[1].text == "hello",     'op[1].text expected "hello", got ' .. tostring(ops[1].text))
assert(ops[1].id == 1,             "op[1].id expected 1, got " .. tostring(ops[1].id))
assert(ops[2].op == "APPEND_TO_ROOT", "op[2].op expected APPEND_TO_ROOT, got " .. tostring(ops[2].op))
assert(ops[2].id == 1,             "op[2].id expected 1, got " .. tostring(ops[2].id))

-- Chain: value returned from one host fn is used as arg to another.
-- JS: __hostAppendToRoot(__hostCreateText("goodbye"))
ops = {}
id_counter = 0
local ast_chain = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "__hostAppendToRoot" },
        arguments = {
          { type = "CallExpression",
            callee = { type = "Identifier", name = "__hostCreateText" },
            arguments = { { type = "Literal", value = "goodbye" } },
          },
        },
      },
    },
  },
}
JSRT.run(ast_chain, { globals = globals })
assert(#ops == 2, "chained: expected 2 ops, got " .. #ops)
assert(ops[1].text == "goodbye", 'chained: op[1].text expected "goodbye", got ' .. tostring(ops[1].text))
assert(ops[2].id == 1, "chained: op[2].id expected 1, got " .. tostring(ops[2].id))

print("target_09_host_ffi_call: ok")
