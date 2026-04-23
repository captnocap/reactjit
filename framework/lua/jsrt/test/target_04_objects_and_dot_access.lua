-- Target 04: objects and dot access.
--
-- JS: let o = { a: 1, b: 2 }; o.a + o.b
-- Expected: 3
--
-- Also tests nested access and missing-property-returns-undefined.

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT   = require("framework.lua.jsrt.init")
local Values = require("framework.lua.jsrt.values")

-- `let o = { a: 1, b: 2 }; o.a + o.b`
local ast_sum = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "o" },
          init = {
            type = "ObjectExpression",
            properties = {
              { type = "Property", kind = "init", computed = false,
                key = { type = "Identifier", name = "a" },
                value = { type = "Literal", value = 1 },
              },
              { type = "Property", kind = "init", computed = false,
                key = { type = "Identifier", name = "b" },
                value = { type = "Literal", value = 2 },
              },
            },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "BinaryExpression", operator = "+",
        left = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "o" },
          property = { type = "Identifier", name = "a" },
        },
        right = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "o" },
          property = { type = "Identifier", name = "b" },
        },
      },
    },
  },
}
local r1 = JSRT.run(ast_sum)
assert(r1 == 3, "o.a + o.b expected 3, got " .. tostring(r1))

-- `let o = { inner: { x: 10 } }; o.inner.x`
local ast_nested = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "o" },
          init = {
            type = "ObjectExpression",
            properties = {
              { type = "Property", kind = "init", computed = false,
                key = { type = "Identifier", name = "inner" },
                value = {
                  type = "ObjectExpression",
                  properties = {
                    { type = "Property", kind = "init", computed = false,
                      key = { type = "Identifier", name = "x" },
                      value = { type = "Literal", value = 10 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "MemberExpression", computed = false,
        object = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "o" },
          property = { type = "Identifier", name = "inner" },
        },
        property = { type = "Identifier", name = "x" },
      },
    },
  },
}
local r2 = JSRT.run(ast_nested)
assert(r2 == 10, "nested access expected 10, got " .. tostring(r2))

-- `let o = { a: 1 }; o.b` → undefined
local ast_missing = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "o" },
          init = {
            type = "ObjectExpression",
            properties = {
              { type = "Property", kind = "init", computed = false,
                key = { type = "Identifier", name = "a" },
                value = { type = "Literal", value = 1 },
              },
            },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "MemberExpression", computed = false,
        object = { type = "Identifier", name = "o" },
        property = { type = "Identifier", name = "b" },
      },
    },
  },
}
local r3 = JSRT.run(ast_missing)
assert(r3 == Values.UNDEFINED, "missing property expected UNDEFINED, got " .. tostring(r3))

-- Computed bracket access: `let o = { key: 42 }; o["key"]` → 42
local ast_bracket = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "o" },
          init = {
            type = "ObjectExpression",
            properties = {
              { type = "Property", kind = "init", computed = false,
                key = { type = "Identifier", name = "key" },
                value = { type = "Literal", value = 42 },
              },
            },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "MemberExpression", computed = true,
        object = { type = "Identifier", name = "o" },
        property = { type = "Literal", value = "key" },
      },
    },
  },
}
local r4 = JSRT.run(ast_bracket)
assert(r4 == 42, 'o["key"] expected 42, got ' .. tostring(r4))

print("target_04_objects_and_dot_access: ok")
