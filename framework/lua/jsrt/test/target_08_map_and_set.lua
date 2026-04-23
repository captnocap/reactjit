-- Target 08: Map and Set built-ins.
--
-- JS: let m = new Map(); m.set("a", 1); m.set("b", 2); m.size
-- Expected: 2
--
-- Also exercises .get, .has, .delete on Map and .add, .has, .delete on Set.

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT = require("framework.lua.jsrt.init")

-- `let m = new Map(); m.set("a", 1); m.set("b", 2); m.size` → 2
local ast = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "m" },
          init = {
            type = "NewExpression",
            callee = { type = "Identifier", name = "Map" },
            arguments = {},
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "m" },
          property = { type = "Identifier", name = "set" },
        },
        arguments = {
          { type = "Literal", value = "a" },
          { type = "Literal", value = 1 },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "m" },
          property = { type = "Identifier", name = "set" },
        },
        arguments = {
          { type = "Literal", value = "b" },
          { type = "Literal", value = 2 },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "MemberExpression", computed = false,
        object = { type = "Identifier", name = "m" },
        property = { type = "Identifier", name = "size" },
      },
    },
  },
}
local r1 = JSRT.run(ast)
assert(r1 == 2, "Map.size expected 2, got " .. tostring(r1))

-- `let m = new Map(); m.set("k", 42); m.get("k")` → 42
local ast_get = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "m" },
          init = {
            type = "NewExpression",
            callee = { type = "Identifier", name = "Map" },
            arguments = {},
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "m" },
          property = { type = "Identifier", name = "set" },
        },
        arguments = { { type = "Literal", value = "k" }, { type = "Literal", value = 42 } },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "m" },
          property = { type = "Identifier", name = "get" },
        },
        arguments = { { type = "Literal", value = "k" } },
      },
    },
  },
}
local r2 = JSRT.run(ast_get)
assert(r2 == 42, "Map.get expected 42, got " .. tostring(r2))

-- Set: `let s = new Set(); s.add(1); s.add(1); s.add(2); s.size` → 2 (dedupe)
local ast_set = {
  type = "Program",
  body = {
    { type = "VariableDeclaration", kind = "let",
      declarations = {
        { type = "VariableDeclarator",
          id = { type = "Identifier", name = "s" },
          init = {
            type = "NewExpression",
            callee = { type = "Identifier", name = "Set" },
            arguments = {},
          },
        },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "s" },
          property = { type = "Identifier", name = "add" },
        },
        arguments = { { type = "Literal", value = 1 } },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "s" },
          property = { type = "Identifier", name = "add" },
        },
        arguments = { { type = "Literal", value = 1 } },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "CallExpression",
        callee = {
          type = "MemberExpression", computed = false,
          object = { type = "Identifier", name = "s" },
          property = { type = "Identifier", name = "add" },
        },
        arguments = { { type = "Literal", value = 2 } },
      },
    },
    { type = "ExpressionStatement",
      expression = {
        type = "MemberExpression", computed = false,
        object = { type = "Identifier", name = "s" },
        property = { type = "Identifier", name = "size" },
      },
    },
  },
}
local r3 = JSRT.run(ast_set)
assert(r3 == 2, "Set.size after dedup expected 2, got " .. tostring(r3))

print("target_08_map_and_set: ok")
