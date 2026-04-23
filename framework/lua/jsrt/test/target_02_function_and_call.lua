-- Target 02: function declaration and call.
--
-- JS: function add(a, b) { return a + b } add(3, 4)
-- Expected: 7
--
-- Plus a nested-call case to prove the pcall-return-sentinel pattern works
-- through multiple layers.

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")

-- `function add(a, b) { return a + b } add(3, 4)`
local ast_add = {
  type = "Program",
  body = {
    { type = "FunctionDeclaration",
      id = { type = "Identifier", name = "add" },
      params = {
        { type = "Identifier", name = "a" },
        { type = "Identifier", name = "b" },
      },
      body = {
        type = "BlockStatement",
        body = {
          { type = "ReturnStatement",
            argument = {
              type = "BinaryExpression", operator = "+",
              left  = { type = "Identifier", name = "a" },
              right = { type = "Identifier", name = "b" },
            },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "add" },
        arguments = {
          { type = "Literal", value = 3 },
          { type = "Literal", value = 4 },
        },
      },
    },
  },
}
local r1 = JSRT.run(ast_add)
assert(r1 == 7, "add(3, 4) expected 7, got " .. tostring(r1))

-- Nested call: `function dbl(x) { return x + x } function quad(y) { return dbl(dbl(y)) } quad(5)` → 20
local ast_nested = {
  type = "Program",
  body = {
    { type = "FunctionDeclaration",
      id = { type = "Identifier", name = "dbl" },
      params = { { type = "Identifier", name = "x" } },
      body = {
        type = "BlockStatement",
        body = {
          { type = "ReturnStatement",
            argument = {
              type = "BinaryExpression", operator = "+",
              left  = { type = "Identifier", name = "x" },
              right = { type = "Identifier", name = "x" },
            },
          },
        },
      },
    },
    { type = "FunctionDeclaration",
      id = { type = "Identifier", name = "quad" },
      params = { { type = "Identifier", name = "y" } },
      body = {
        type = "BlockStatement",
        body = {
          { type = "ReturnStatement",
            argument = {
              type = "CallExpression",
              callee = { type = "Identifier", name = "dbl" },
              arguments = {
                { type = "CallExpression",
                  callee = { type = "Identifier", name = "dbl" },
                  arguments = { { type = "Identifier", name = "y" } },
                },
              },
            },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "quad" },
        arguments = { { type = "Literal", value = 5 } },
      },
    },
  },
}
local r2 = JSRT.run(ast_nested)
assert(r2 == 20, "quad(5) expected 20, got " .. tostring(r2))

-- Function with no explicit return — should yield undefined.
local Values = require("framework.lua.jsrt.values")
local ast_noreturn = {
  type = "Program",
  body = {
    { type = "FunctionDeclaration",
      id = { type = "Identifier", name = "noop" },
      params = {},
      body = { type = "BlockStatement", body = {} },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "noop" },
        arguments = {},
      },
    },
  },
}
local r3 = JSRT.run(ast_noreturn)
assert(r3 == Values.UNDEFINED, "noop() expected UNDEFINED, got " .. tostring(r3))

print("target_02_function_and_call: ok")
