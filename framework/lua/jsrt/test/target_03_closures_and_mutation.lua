-- Target 03: closures and mutation.
--
-- JS:
--   function counter() {
--     let n = 0;
--     return function() { n = n + 1; return n };
--   }
--   let c = counter();
--   c(); c(); c();
-- Expected: 3
--
-- Proves: closure capture of upvalues, AssignmentExpression, repeated invocation
-- of a returned-function with shared mutable state.

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")

local function callC()
  return { type = "ExpressionStatement",
    expression = {
      type = "CallExpression",
      callee = { type = "Identifier", name = "c" },
      arguments = {},
    },
  }
end

local ast = {
  type = "Program",
  body = {
    { type = "FunctionDeclaration",
      id = { type = "Identifier", name = "counter" },
      params = {},
      body = {
        type = "BlockStatement",
        body = {
          { type = "VariableDeclaration", kind = "let",
            declarations = {
              { type = "VariableDeclarator",
                id = { type = "Identifier", name = "n" },
                init = { type = "Literal", value = 0 },
              },
            },
          },
          { type = "ReturnStatement",
            argument = {
              type = "FunctionExpression",
              id = nil,
              params = {},
              body = {
                type = "BlockStatement",
                body = {
                  { type = "ExpressionStatement",
                    expression = {
                      type = "AssignmentExpression", operator = "=",
                      left  = { type = "Identifier", name = "n" },
                      right = {
                        type = "BinaryExpression", operator = "+",
                        left  = { type = "Identifier", name = "n" },
                        right = { type = "Literal", value = 1 },
                      },
                    },
                  },
                  { type = "ReturnStatement",
                    argument = { type = "Identifier", name = "n" },
                  },
                },
              },
            },
          },
        },
      },
    },
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "c" },
          init = {
            type = "CallExpression",
            callee = { type = "Identifier", name = "counter" },
            arguments = {},
          },
        },
      },
    },
    callC(), callC(), callC(),
  },
}

local r = JSRT.run(ast)
assert(r == 3, "counter sequence expected 3, got " .. tostring(r))

-- Two independent counters must not share state.
local ast2 = {
  type = "Program",
  body = {
    -- Same counter function definition
    { type = "FunctionDeclaration",
      id = { type = "Identifier", name = "counter" },
      params = {},
      body = {
        type = "BlockStatement",
        body = {
          { type = "VariableDeclaration", kind = "let",
            declarations = {
              { type = "VariableDeclarator",
                id = { type = "Identifier", name = "n" },
                init = { type = "Literal", value = 0 },
              },
            },
          },
          { type = "ReturnStatement",
            argument = {
              type = "FunctionExpression",
              id = nil, params = {},
              body = {
                type = "BlockStatement",
                body = {
                  { type = "ExpressionStatement",
                    expression = {
                      type = "AssignmentExpression", operator = "=",
                      left  = { type = "Identifier", name = "n" },
                      right = {
                        type = "BinaryExpression", operator = "+",
                        left  = { type = "Identifier", name = "n" },
                        right = { type = "Literal", value = 1 },
                      },
                    },
                  },
                  { type = "ReturnStatement",
                    argument = { type = "Identifier", name = "n" },
                  },
                },
              },
            },
          },
        },
      },
    },
    -- let a = counter(); let b = counter();
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "a" },
          init = { type = "CallExpression",
            callee = { type = "Identifier", name = "counter" },
            arguments = {},
          },
        },
      },
    },
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "b" },
          init = { type = "CallExpression",
            callee = { type = "Identifier", name = "counter" },
            arguments = {},
          },
        },
      },
    },
    -- a(); a(); b(); then return a() — should be 3 (a's n is independent of b's)
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "a" },
        arguments = {},
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "a" },
        arguments = {},
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "b" },
        arguments = {},
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = { type = "Identifier", name = "a" },
        arguments = {},
      },
    },
  },
}
local r2 = JSRT.run(ast2)
assert(r2 == 3, "independent counters: a's third call expected 3, got " .. tostring(r2))

print("target_03_closures_and_mutation: ok")
