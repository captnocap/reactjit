-- Target 05: arrays, method calls, arrow functions, Array.prototype.
--
-- JS: [1, 2, 3].reduce((a, b) => a + b, 0)
-- Expected: 6
--
-- Also exercises .map, .filter, .length, and reduce without initial value.

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")

-- Shared arrow `(a,b) => a+b`
local function arrow_add()
  return {
    type = "ArrowFunctionExpression",
    id = nil,
    params = {
      { type = "Identifier", name = "a" },
      { type = "Identifier", name = "b" },
    },
    body = {
      type = "BinaryExpression", operator = "+",
      left  = { type = "Identifier", name = "a" },
      right = { type = "Identifier", name = "b" },
    },
    expression = true,
  }
end

local function arr123()
  return {
    type = "ArrayExpression",
    elements = {
      { type = "Literal", value = 1 },
      { type = "Literal", value = 2 },
      { type = "Literal", value = 3 },
    },
  }
end

-- `[1,2,3].reduce((a,b) => a+b, 0)` → 6
local ast_reduce = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = arr123(),
          property = { type = "Identifier", name = "reduce" },
        },
        arguments = { arrow_add(), { type = "Literal", value = 0 } },
      },
    },
  },
}
local r1 = JSRT.run(ast_reduce)
assert(r1 == 6, "reduce with initial expected 6, got " .. tostring(r1))

-- `[1,2,3].reduce((a,b) => a+b)` → 6 (no initial → uses first element)
local ast_reduce_no_init = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = arr123(),
          property = { type = "Identifier", name = "reduce" },
        },
        arguments = { arrow_add() },
      },
    },
  },
}
local r2 = JSRT.run(ast_reduce_no_init)
assert(r2 == 6, "reduce without initial expected 6, got " .. tostring(r2))

-- `[1,2,3].length` → 3
local ast_length = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      expression = {
        type = "MemberExpression", computed = false,
        object = arr123(),
        property = { type = "Identifier", name = "length" },
      },
    },
  },
}
local r3 = JSRT.run(ast_length)
assert(r3 == 3, "array.length expected 3, got " .. tostring(r3))

-- `[1,2,3].map(x => x * 2).reduce((a,b) => a+b, 0)` → 12
local ast_chain = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = {
            type = "CallExpression",
            callee = {
              type = "MemberExpression", computed = false,
              object = arr123(),
              property = { type = "Identifier", name = "map" },
            },
            arguments = {
              {
                type = "ArrowFunctionExpression",
                params = { { type = "Identifier", name = "x" } },
                body = {
                  type = "BinaryExpression", operator = "*",
                  left  = { type = "Identifier", name = "x" },
                  right = { type = "Literal", value = 2 },
                },
                expression = true,
              },
            },
          },
          property = { type = "Identifier", name = "reduce" },
        },
        arguments = { arrow_add(), { type = "Literal", value = 0 } },
      },
    },
  },
}
local r4 = JSRT.run(ast_chain)
assert(r4 == 12, "map→reduce chain expected 12, got " .. tostring(r4))

-- `[1,2,3].filter(x => x > 1).length` → 2
local ast_filter = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      expression = {
        type = "MemberExpression", computed = false,
        object = {
          type = "CallExpression",
          callee = {
            type = "MemberExpression", computed = false,
            object = arr123(),
            property = { type = "Identifier", name = "filter" },
          },
          arguments = {
            {
              type = "ArrowFunctionExpression",
              params = { { type = "Identifier", name = "x" } },
              body = {
                type = "BinaryExpression", operator = ">",
                left  = { type = "Identifier", name = "x" },
                right = { type = "Literal", value = 1 },
              },
              expression = true,
            },
          },
        },
        property = { type = "Identifier", name = "length" },
      },
    },
  },
}
local r5 = JSRT.run(ast_filter)
assert(r5 == 2, "filter result length expected 2, got " .. tostring(r5))

print("target_05_arrays_and_iteration: ok")
