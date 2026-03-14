-- Named function
local function add(a, b)
  return a + b
end
-- Arrow function assigned to const
local function multiply(a, b)
  return a * b
end
-- Expression arrow
local function double(x)
  return x * 2
end
-- Rest params
local function sum(...)
  local total = 0
  for _, n in ipairs(args) do
    total = total + n
  end
  return total
end
-- Export
local function greet(name)
  return "hello " + name
end

return {
  greet = greet,
}
