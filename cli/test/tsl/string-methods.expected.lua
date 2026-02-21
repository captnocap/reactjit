local s = "hello world"
local upper = string.upper(s)
local lower = string.lower(s)
local trimmed = s:match("^%s*(.-)%s*$")
local starts = (string.sub(s, 1, #"hello") == "hello")
local ends = (string.sub(s, -#"world") == "world")
local repeated = string.rep(s, 3)
local len = #s
