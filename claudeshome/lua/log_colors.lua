--[[
  log_colors.lua -- Colorize [tag] prefixes in terminal output

  Patches the global print() and io.write() so any string starting with
  "[something]" gets that bracket portion ANSI-colored. Each unique tag
  gets a stable color from a rotating palette. The rest of the line is
  unchanged.

  Require this module once at startup — it has no return value.

    require("lua.log_colors")

  "WARNING" in a tag gets yellow. "ERROR"/"FAIL" gets red. Everything
  else cycles through the palette.
]]

-- ANSI escape helpers
local ESC   = "\27["
local RESET = ESC .. "0m"
local BOLD  = ESC .. "1m"
local DIM   = ESC .. "2m"

-- Palette: bright, saturated, easy to distinguish on dark backgrounds
local PALETTE = {
  ESC .. "36m",   -- cyan
  ESC .. "35m",   -- magenta
  ESC .. "33m",   -- yellow
  ESC .. "32m",   -- green
  ESC .. "34m",   -- blue
  ESC .. "91m",   -- bright red
  ESC .. "96m",   -- bright cyan
  ESC .. "95m",   -- bright magenta
  ESC .. "93m",   -- bright yellow
  ESC .. "92m",   -- bright green
  ESC .. "94m",   -- bright blue
}

local RED    = ESC .. "31m"
local YELLOW = ESC .. "33m"

-- Tag → color cache (stable across the session)
local tagColors = {}
local nextColor = 1

local function colorForTag(tag)
  -- Check cache first
  local c = tagColors[tag]
  if c then return c end

  -- Special tags
  local upper = tag:upper()
  if upper:find("ERROR") or upper:find("FAIL") then
    c = BOLD .. RED
  elseif upper:find("WARN") then
    c = BOLD .. YELLOW
  else
    c = PALETTE[nextColor]
    nextColor = (nextColor % #PALETTE) + 1
  end

  tagColors[tag] = c
  return c
end

-- Pattern: [tag] at the start of a string (with optional leading whitespace)
-- Captures: (leading_ws, bracket_content, rest)
local TAG_PATTERN = "^(%s*%[)([^%]]+)(%])"

--- Colorize any [tag] prefix in a string.
local function colorize(s)
  if type(s) ~= "string" then return s end

  local pre, tag, post = s:match(TAG_PATTERN)
  if not tag then return s end

  local c = colorForTag(tag)
  local body = s:sub(#pre + #tag + #post + 1):gsub("^%s+", "")

  -- Color the body based on severity keywords
  local bodyColor = DIM
  local bodyUpper = body:upper()
  if bodyUpper:find("^WARNING") or bodyUpper:find("^WARN") then
    bodyColor = YELLOW
  elseif bodyUpper:find("^ERROR") or bodyUpper:find("^FAIL") then
    bodyColor = RED
  end

  return pre .. c .. tag .. RESET .. post .. " "
    .. bodyColor .. body .. RESET
end

-- ============================================================================
-- Patch print()
-- ============================================================================

local _print = print
function print(...)
  local args = { ... }
  local n = select("#", ...)
  if n >= 1 then
    args[1] = colorize(args[1])
  end
  return _print(unpack(args, 1, n))
end

-- ============================================================================
-- Patch io.write()
-- ============================================================================

local _iowrite = io.write
io.write = function(...)
  local args = { ... }
  local n = select("#", ...)
  if n >= 1 then
    args[1] = colorize(args[1])
  end
  return _iowrite(unpack(args, 1, n))
end

return true
