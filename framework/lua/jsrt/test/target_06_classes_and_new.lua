-- Target 06: classes and `new`.
--
-- JS:
--   class Point {
--     constructor(x, y) { this.x = x; this.y = y; }
--     sum() { return this.x + this.y; }
--   }
--   new Point(3, 4).sum()
-- Expected: 7
--
-- Proves: ClassDeclaration, MethodDefinition, NewExpression, ThisExpression,
-- prototype chain walking, MemberExpression as assignment target.

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")

-- `class Point { constructor(x, y) { this.x = x; this.y = y; } sum() { return this.x + this.y; } } new Point(3, 4).sum()`
local ast_point = {
  type = "Program",
  body = {
    { type = "ClassDeclaration",
      id = { type = "Identifier", name = "Point" },
      body = {
        type = "ClassBody",
        body = {
          { type = "MethodDefinition", kind = "constructor",
            key = { type = "Identifier", name = "constructor" },
            value = {
              type = "FunctionExpression",
              id = nil,
              params = {
                { type = "Identifier", name = "x" },
                { type = "Identifier", name = "y" },
              },
              body = {
                type = "BlockStatement",
                body = {
                  { type = "ExpressionStatement",
                    expression = {
                      type = "AssignmentExpression", operator = "=",
                      left = {
                        type = "MemberExpression", computed = false,
                        object = { type = "ThisExpression" },
                        property = { type = "Identifier", name = "x" },
                      },
                      right = { type = "Identifier", name = "x" },
                    },
                  },
                  { type = "ExpressionStatement",
                    expression = {
                      type = "AssignmentExpression", operator = "=",
                      left = {
                        type = "MemberExpression", computed = false,
                        object = { type = "ThisExpression" },
                        property = { type = "Identifier", name = "y" },
                      },
                      right = { type = "Identifier", name = "y" },
                    },
                  },
                },
              },
            },
          },
          { type = "MethodDefinition", kind = "method",
            key = { type = "Identifier", name = "sum" },
            value = {
              type = "FunctionExpression",
              id = nil,
              params = {},
              body = {
                type = "BlockStatement",
                body = {
                  { type = "ReturnStatement",
                    argument = {
                      type = "BinaryExpression", operator = "+",
                      left  = {
                        type = "MemberExpression", computed = false,
                        object = { type = "ThisExpression" },
                        property = { type = "Identifier", name = "x" },
                      },
                      right = {
                        type = "MemberExpression", computed = false,
                        object = { type = "ThisExpression" },
                        property = { type = "Identifier", name = "y" },
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
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = {
            type = "NewExpression",
            callee = { type = "Identifier", name = "Point" },
            arguments = {
              { type = "Literal", value = 3 },
              { type = "Literal", value = 4 },
            },
          },
          property = { type = "Identifier", name = "sum" },
        },
        arguments = {},
      },
    },
  },
}

local r = JSRT.run(ast_point)
assert(r == 7, "new Point(3, 4).sum() expected 7, got " .. tostring(r))

-- Methods share prototype — two instances see the same method but have
-- independent own properties.
local ast_two = {
  type = "Program",
  body = {
    -- Same class declaration as above, but we'll reuse it by writing it inline
    { type = "ClassDeclaration",
      id = { type = "Identifier", name = "Counter" },
      body = {
        type = "ClassBody",
        body = {
          { type = "MethodDefinition", kind = "constructor",
            key = { type = "Identifier", name = "constructor" },
            value = {
              type = "FunctionExpression",
              params = { { type = "Identifier", name = "start" } },
              body = {
                type = "BlockStatement",
                body = {
                  { type = "ExpressionStatement",
                    expression = {
                      type = "AssignmentExpression", operator = "=",
                      left = {
                        type = "MemberExpression", computed = false,
                        object = { type = "ThisExpression" },
                        property = { type = "Identifier", name = "n" },
                      },
                      right = { type = "Identifier", name = "start" },
                    },
                  },
                },
              },
            },
          },
          { type = "MethodDefinition", kind = "method",
            key = { type = "Identifier", name = "bump" },
            value = {
              type = "FunctionExpression",
              params = {},
              body = {
                type = "BlockStatement",
                body = {
                  { type = "ExpressionStatement",
                    expression = {
                      type = "AssignmentExpression", operator = "=",
                      left = {
                        type = "MemberExpression", computed = false,
                        object = { type = "ThisExpression" },
                        property = { type = "Identifier", name = "n" },
                      },
                      right = {
                        type = "BinaryExpression", operator = "+",
                        left = {
                          type = "MemberExpression", computed = false,
                          object = { type = "ThisExpression" },
                          property = { type = "Identifier", name = "n" },
                        },
                        right = { type = "Literal", value = 1 },
                      },
                    },
                  },
                  { type = "ReturnStatement",
                    argument = {
                      type = "MemberExpression", computed = false,
                      object = { type = "ThisExpression" },
                      property = { type = "Identifier", name = "n" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    -- let a = new Counter(10); let b = new Counter(100);
    -- a.bump(); a.bump(); b.bump(); a.bump();
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "a" },
          init = {
            type = "NewExpression",
            callee = { type = "Identifier", name = "Counter" },
            arguments = { { type = "Literal", value = 10 } },
          },
        },
      },
    },
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "b" },
          init = {
            type = "NewExpression",
            callee = { type = "Identifier", name = "Counter" },
            arguments = { { type = "Literal", value = 100 } },
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "a" },
          property = { type = "Identifier", name = "bump" },
        },
        arguments = {},
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "a" },
          property = { type = "Identifier", name = "bump" },
        },
        arguments = {},
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "b" },
          property = { type = "Identifier", name = "bump" },
        },
        arguments = {},
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "a" },
          property = { type = "Identifier", name = "bump" },
        },
        arguments = {},
      },
    },
  },
}
local r2 = JSRT.run(ast_two)
assert(r2 == 13, "a.bump() third time expected 13, got " .. tostring(r2))

print("target_06_classes_and_new: ok")
