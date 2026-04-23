-- Target 01: literals and binding.
--
-- Proves: Literal, Identifier, VariableDeclaration, BinaryExpression
--         (arithmetic + string concat), scope lookup.
--
-- Run: luajit framework/lua/jsrt/test/target_01_literals_and_binding.lua

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")

-- `1 + 2`
local ast_sum = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      expression = {
        type = "BinaryExpression", operator = "+",
        left  = { type = "Literal", value = 1 },
        right = { type = "Literal", value = 2 },
      },
    },
  },
}
local r1 = JSRT.run(ast_sum)
assert(r1 == 3, "1 + 2 expected 3, got " .. tostring(r1))

-- `var x = 1 + 2; x`
local ast_var = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "var",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "x" },
          init = {
            type = "BinaryExpression", operator = "+",
            left  = { type = "Literal", value = 1 },
            right = { type = "Literal", value = 2 },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = { type = "Identifier", name = "x" },
    },
  },
}
local r2 = JSRT.run(ast_var)
assert(r2 == 3, "var x = 1 + 2; x expected 3, got " .. tostring(r2))

-- `"hello " + "world"`
local ast_concat = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      expression = {
        type = "BinaryExpression", operator = "+",
        left  = { type = "Literal", value = "hello " },
        right = { type = "Literal", value = "world" },
      },
    },
  },
}
local r3 = JSRT.run(ast_concat)
assert(r3 == "hello world", 'string concat expected "hello world", got ' .. tostring(r3))

print("target_01_literals_and_binding: ok")
