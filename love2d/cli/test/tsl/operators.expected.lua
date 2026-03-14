-- Equality
local a = 1 == 1
local b = 1 ~= 2
-- Logical
local c = true and false
local d = true or false
local e = not true
-- Arithmetic
local f = 2 ^ 3
local g = 10 % 3
-- Ternary
local max = (a > b and a or b)
-- Nullish coalescing
local val = (nil ~= nil and nil or "default")
-- Optional chaining
local len = (obj and obj.name)
-- typeof
local t = type(x)
-- Template literal
local msg = "hello " .. tostring(name) .. ", you are " .. tostring(age) .. " years old"
-- Compound assignment
local n = 10
n = n + 5
n = n - 2
n = n * 3
n = n / 2
