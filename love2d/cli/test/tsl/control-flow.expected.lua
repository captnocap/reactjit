-- If/else
local x = 10
if x > 5 then
  print("big")
elseif x > 0 then
  print("small")
else
  print("zero or negative")
end
-- While loop
local count = 0
while count < 10 do
  count = count + 1
end
-- For-of
local items = {1, 2, 3}
for _, item in ipairs(items) do
  print(item)
end
-- For-in
local obj = { a = 1, b = 2 }
for key, _ in pairs(obj) do
  print(key)
end
-- Numeric for
for i = 1, 10 do
  print(i)
end
-- Do-while
local n = 0
repeat
  n = n + 1
until not (n < 5)
