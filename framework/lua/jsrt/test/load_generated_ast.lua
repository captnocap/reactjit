local Json = require("framework.lua.jsrt.json")

local M = {}

function M.load(path)
  local loader = assert(loadfile(path), "failed to load generated AST: " .. path)
  local blob = loader()
  assert(type(blob) == "string", "generated AST blob is not a string: " .. path)
  local ast = Json.decode(blob)
  assert(type(ast) == "table" and ast.type == "Program", "decoded AST is not a Program: " .. path)
  return ast
end

return M
