-- Object literals → tables
local point = { x = 10, y = 20 }
-- Shorthand properties
local name = "alice"
local age = 30
local person = { name = name, age = age }
-- Arrays → tables
local nums = {1, 2, 3, 4, 5}
-- Nested
local config = {
  window = { width = 800, height = 600 },
  debug = false,
}
-- Object destructuring
local _tsl_tmp = point
local x = _tsl_tmp.x
local y = _tsl_tmp.y
-- Array destructuring
local _tsl_tmp = nums
local first = _tsl_tmp[1]
local second = _tsl_tmp[2]
-- Computed keys
local key = "dynamic"
local map = { [key] = true }
