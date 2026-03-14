local __tsl = require("lua.tsl_stdlib")

-- Test stdlib helper functions
local nums = {10, 20, 30, 40, 50}
-- map
local doubled = __tsl.map(nums, function(n) return n * 2 end)
print("doubled:", doubled[1], doubled[2], doubled[3])
-- filter
local big = __tsl.filter(nums, function(n) return n > 25 end)
print("big:", big[1], big[2], big[3])
-- indexOf
local idx = __tsl.indexOf(nums, 30)
print("indexOf 30:", idx)
-- reverse
local rev = {1, 2, 3}
__tsl.reverse(rev)
print("reversed:", rev[1], rev[2], rev[3])
-- Object methods
local obj = { a = 1, b = 2, c = 3 }
local k = __tsl.keys(obj)
print("keys count:", #k)
-- split
local parts = __tsl.split("hello-world-test", "-")
print("split:", parts[1], parts[2], parts[3])
-- spread merge
local base = { x = 1, y = 2 }
local extra = { y = 3, z = 4 }
local merged = __tsl.merge(base, extra)
print("merged:", merged.x, merged.y, merged.z)
