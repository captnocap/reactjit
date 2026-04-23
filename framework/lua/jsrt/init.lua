-- JSRT entry point. Builds a root scope, installs built-ins, host globals, and
-- any caller-provided globals, then runs the program AST through the evaluator.

local Evaluator = require("framework.lua.jsrt.evaluator")
local Scope     = require("framework.lua.jsrt.scope")
local Builtins  = require("framework.lua.jsrt.builtins")
local Host      = require("framework.lua.jsrt.host")

local M = {}

--- Run a program AST.
--- @param ast  ESTree-shaped Program node.
--- @param opts  Optional table. Keys:
---   globals = { name = value, ... }  extra bindings installed into the root
---             scope after built-ins. This is how host FFI globals like
---             __hostCreate / __dispatchEvent are wired in — they're just
---             native function values exposed as identifiers.
--- @return the value of the last top-level statement (useful for tests).
function M.run(ast, opts)
  opts = opts or {}
  local root = Scope.new(nil)
  Builtins.install(root)
  Host.install(root, opts.host)
  if opts.globals then
    for name, value in pairs(opts.globals) do
      root:define(name, value)
    end
  end
  return Evaluator.runProgram(ast, root)
end

return M
