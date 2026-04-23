-- Target 07: try/catch + throw + Error built-in.
--
-- JS: try { throw new Error("oops") } catch (e) { e.message }
-- Expected: "oops"

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")

-- `try { throw new Error("oops") } catch (e) { e.message }`
local ast = {
  type = "Program",
  body = {
    { type = "ExpressionStatement",
      -- Wrap in an IIFE so the try's result becomes the expression's value.
      -- In plain ES the try/catch itself isn't an expression, but runProgram
      -- returns the last statement's result, and for catch the body's last
      -- expression is a MemberExpression that evaluates to a string.
      expression = {
        type = "CallExpression",
        callee = {
          type = "ArrowFunctionExpression",
          params = {},
          body = {
            type = "BlockStatement",
            body = {
              { type = "TryStatement",
                block = {
                  type = "BlockStatement",
                  body = {
                    { type = "ThrowStatement",
                      argument = {
                        type = "NewExpression",
                        callee = { type = "Identifier", name = "Error" },
                        arguments = { { type = "Literal", value = "oops" } },
                      },
                    },
                  },
                },
                handler = {
                  type = "CatchClause",
                  param = { type = "Identifier", name = "e" },
                  body = {
                    type = "BlockStatement",
                    body = {
                      { type = "ReturnStatement",
                        argument = {
                          type = "MemberExpression", computed = false,
                          object = { type = "Identifier", name = "e" },
                          property = { type = "Identifier", name = "message" },
                        },
                      },
                    },
                  },
                },
                finalizer = nil,
              },
            },
          },
          expression = false,
        },
        arguments = {},
      },
    },
  },
}

local r = JSRT.run(ast)
assert(r == "oops", 'try/catch expected "oops", got ' .. tostring(r))

-- Throw from inside a called function, catch at the outer level.
local ast_nested = {
  type = "Program",
  body = {
    { type = "FunctionDeclaration",
      id = { type = "Identifier", name = "bad" },
      params = {},
      body = {
        type = "BlockStatement",
        body = {
          { type = "ThrowStatement",
            argument = {
              type = "NewExpression",
              callee = { type = "Identifier", name = "TypeError" },
              arguments = { { type = "Literal", value = "nope" } },
            },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "ArrowFunctionExpression",
          params = {},
          body = {
            type = "BlockStatement",
            body = {
              { type = "TryStatement",
                block = {
                  type = "BlockStatement",
                  body = {
                    { type = "ExpressionStatement",
                      expression = {
                        type = "CallExpression",
                        callee = { type = "Identifier", name = "bad" },
                        arguments = {},
                      },
                    },
                  },
                },
                handler = {
                  type = "CatchClause",
                  param = { type = "Identifier", name = "err" },
                  body = {
                    type = "BlockStatement",
                    body = {
                      { type = "ReturnStatement",
                        argument = {
                          type = "BinaryExpression", operator = "+",
                          left = {
                            type = "MemberExpression", computed = false,
                            object = { type = "Identifier", name = "err" },
                            property = { type = "Identifier", name = "name" },
                          },
                          right = {
                            type = "BinaryExpression", operator = "+",
                            left = { type = "Literal", value = ": " },
                            right = {
                              type = "MemberExpression", computed = false,
                              object = { type = "Identifier", name = "err" },
                              property = { type = "Identifier", name = "message" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          expression = false,
        },
        arguments = {},
      },
    },
  },
}
local r2 = JSRT.run(ast_nested)
assert(r2 == "TypeError: nope", 'nested throw expected "TypeError: nope", got ' .. tostring(r2))

-- Finally runs on both the success path and the error path.
-- Track with a mutable object the catch writes to.
local ast_finally = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "log" },
          init = { type = "ArrayExpression", elements = {} },
        },
      },
    },
    { type = "TryStatement",
      block = {
        type = "BlockStatement",
        body = {
          { type = "ThrowStatement",
            argument = {
              type = "NewExpression",
              callee = { type = "Identifier", name = "Error" },
              arguments = { { type = "Literal", value = "x" } },
            },
          },
        },
      },
      handler = {
        type = "CatchClause",
        param = { type = "Identifier", name = "e" },
        body = {
          type = "BlockStatement",
          body = {
            { type = "ExpressionStatement",
              expression = {
                type = "CallExpression",
                callee = {
                  type = "MemberExpression", computed = false,
                  object = { type = "Identifier", name = "log" },
                  property = { type = "Identifier", name = "push" },
                },
                arguments = { { type = "Literal", value = "catch" } },
              },
            },
          },
        },
      },
      finalizer = {
        type = "BlockStatement",
        body = {
          { type = "ExpressionStatement",
            expression = {
              type = "CallExpression",
              callee = {
                type = "MemberExpression", computed = false,
                object = { type = "Identifier", name = "log" },
                property = { type = "Identifier", name = "push" },
              },
              arguments = { { type = "Literal", value = "finally" } },
            },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "log" },
          property = { type = "Identifier", name = "join" },
        },
        arguments = { { type = "Literal", value = "," } },
      },
    },
  },
}
local r3 = JSRT.run(ast_finally)
assert(r3 == "catch,finally", 'finally order expected "catch,finally", got ' .. tostring(r3))

print("target_07_try_catch: ok")
