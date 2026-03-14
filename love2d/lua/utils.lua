--[[
  utils.lua — General-purpose utilities for ReactJIT

  All logic lives here. The TypeScript side exposes these as one-liner hooks
  that call bridge RPCs — no string manipulation, no math, no date parsing
  happens in JS. TS declares layout and diffs the tree. Lua does everything else.

  RPC handlers:
    utils:nanoid       — URL-safe alphanumeric ID
    utils:uuid         — v4 UUID string
    utils:deep_equal   — recursive table comparison with cycle detection
    utils:truncate     — UTF-8 aware string truncation
    utils:slugify      — URL-safe slug from arbitrary string
    utils:camel_case   — camelCase conversion
    utils:snake_case   — snake_case conversion
    utils:kebab_case   — kebab-case conversion
    utils:pascal_case  — PascalCase conversion
    utils:pluralize    — count-aware singular/plural
    utils:time_ago     — relative time string ("2 hours ago")
    utils:format_date  — strftime formatting
    utils:ms_parse     — human duration string → milliseconds
    utils:ms_format    — milliseconds → human duration string
    utils:duration     — milliseconds → {days, hours, minutes, seconds, ms}
    utils:safe_encode  — JSON encode with graceful cycle/type handling
    utils:batch        — batch array of {op, args} pairs
]]

local M = {}

local json = require("lua.json")

local floor = math.floor
local random = math.random
local format = string.format
local lower = string.lower
local upper = string.upper
local sub = string.sub
local byte = string.byte
local char = string.char
local gsub = string.gsub
local gmatch = string.gmatch
local find = string.find
local concat = table.concat
local insert = table.insert
local os_time = os.time
local os_date = os.date
local type = type
local pairs = pairs
local tostring = tostring
local pcall = pcall

-- ============================================================================
-- ID Generation
-- ============================================================================

local ALPHANUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
local ALPHANUM_LEN = #ALPHANUM

--- Generate a URL-safe alphanumeric ID of given length (default 16).
function M.nanoid(length)
  length = length or 16
  local buf = {}
  for i = 1, length do
    local idx = random(1, ALPHANUM_LEN)
    buf[i] = sub(ALPHANUM, idx, idx)
  end
  return concat(buf)
end

--- Generate a v4 UUID string.
function M.uuid()
  -- 8-4-4-4-12 hex format with version=4 and variant=10xx
  local template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  return (gsub(template, "[xy]", function(c)
    local v
    if c == "x" then
      v = random(0, 15)
    else
      -- variant bits: 10xx → 8, 9, a, b
      v = random(8, 11)
    end
    return format("%x", v)
  end))
end

-- ============================================================================
-- Deep Equality
-- ============================================================================

--- Recursive deep equality with cycle detection.
--- Handles nil, boolean, number, string, table. Non-table non-primitive types
--- compare by reference (which is all you can do for userdata/functions).
function M.deep_equal(a, b, seen)
  if a == b then return true end

  local ta, tb = type(a), type(b)
  if ta ~= tb then return false end
  if ta ~= "table" then return false end

  -- Cycle detection
  seen = seen or {}
  if seen[a] and seen[a] == b then return true end
  seen[a] = b

  -- Check all keys in a exist in b with equal values
  for k, v in pairs(a) do
    if not M.deep_equal(v, b[k], seen) then return false end
  end
  -- Check b doesn't have extra keys
  for k, _ in pairs(b) do
    if a[k] == nil then return false end
  end

  return true
end

-- ============================================================================
-- String Utilities
-- ============================================================================

--- UTF-8 aware string length. Falls back to byte length if utf8 unavailable.
local utf8_len, utf8_offset
if utf8 then
  utf8_len = utf8.len
  utf8_offset = utf8.offset
end

--- Truncate string to max characters, append ellipsis if truncated.
--- UTF-8 aware when the utf8 library is available.
function M.truncate(str, max, ellipsis)
  if not str or str == "" then return "" end
  max = max or 80
  ellipsis = ellipsis or "\xe2\x80\xa6" -- "…" U+2026

  if utf8_len then
    local len = utf8_len(str)
    if not len then
      -- invalid UTF-8, fall back to byte truncation
      if #str <= max then return str end
      return sub(str, 1, max) .. ellipsis
    end
    if len <= max then return str end
    local offset = utf8_offset(str, max + 1)
    if offset then
      return sub(str, 1, offset - 1) .. ellipsis
    end
    return str
  else
    if #str <= max then return str end
    return sub(str, 1, max) .. ellipsis
  end
end

--- Split a string on word boundaries for case conversion.
--- Splits on: spaces, hyphens, underscores, and camelCase boundaries.
local function split_words(str)
  if not str or str == "" then return {} end
  -- Insert a separator before uppercase letters that follow lowercase letters
  -- (camelCase boundary detection)
  local s = gsub(str, "(%l)(%u)", "%1 %2")
  -- Also split runs of uppercase followed by uppercase+lowercase (e.g. "HTMLParser" → "HTML Parser")
  s = gsub(s, "(%u+)(%u%l)", "%1 %2")
  local words = {}
  for word in gmatch(s, "[%w]+") do
    if #word > 0 then
      insert(words, lower(word))
    end
  end
  return words
end

--- Capitalize first letter of a string.
local function capitalize(s)
  if #s == 0 then return s end
  return upper(sub(s, 1, 1)) .. sub(s, 2)
end

--- URL-safe slug: lowercase, non-alnum replaced with hyphens, collapsed, trimmed.
function M.slugify(str)
  if not str or str == "" then return "" end
  local s = lower(str)
  -- Replace non-alphanumeric with hyphens
  s = gsub(s, "[^%w]+", "-")
  -- Collapse runs of hyphens
  s = gsub(s, "%-+", "-")
  -- Trim leading/trailing hyphens
  s = gsub(s, "^%-", "")
  s = gsub(s, "%-$", "")
  return s
end

--- camelCase: first word lowercase, rest capitalized.
function M.camel_case(str)
  local words = split_words(str)
  if #words == 0 then return "" end
  local buf = { words[1] }
  for i = 2, #words do
    buf[i] = capitalize(words[i])
  end
  return concat(buf)
end

--- snake_case: all lowercase, joined with underscores.
function M.snake_case(str)
  local words = split_words(str)
  return concat(words, "_")
end

--- kebab-case: all lowercase, joined with hyphens.
function M.kebab_case(str)
  local words = split_words(str)
  return concat(words, "-")
end

--- PascalCase: every word capitalized.
function M.pascal_case(str)
  local words = split_words(str)
  local buf = {}
  for i = 1, #words do
    buf[i] = capitalize(words[i])
  end
  return concat(buf)
end

--- Count-aware pluralization.
--- pluralize(1, "item") → "1 item"
--- pluralize(3, "item") → "3 items"
--- pluralize(2, "child", "children") → "2 children"
function M.pluralize(count, singular, plural)
  count = count or 0
  plural = plural or (singular .. "s")
  if count == 1 then
    return count .. " " .. singular
  else
    return count .. " " .. plural
  end
end

-- ============================================================================
-- Date / Time
-- ============================================================================

--- Relative time string from a unix timestamp.
--- Returns "just now", "X seconds ago", "X minutes ago", etc.
function M.time_ago(timestamp)
  if not timestamp then return "never" end
  local now = os_time()
  local diff = now - timestamp

  if diff < 0 then return "in the future" end
  if diff < 5 then return "just now" end
  if diff < 60 then return diff .. " seconds ago" end

  local minutes = floor(diff / 60)
  if minutes == 1 then return "1 minute ago" end
  if minutes < 60 then return minutes .. " minutes ago" end

  local hours = floor(diff / 3600)
  if hours == 1 then return "1 hour ago" end
  if hours < 24 then return hours .. " hours ago" end

  local days = floor(diff / 86400)
  if days == 1 then return "yesterday" end
  if days < 7 then return days .. " days ago" end

  local weeks = floor(days / 7)
  if weeks == 1 then return "1 week ago" end
  if weeks < 5 then return weeks .. " weeks ago" end

  local months = floor(days / 30)
  if months == 1 then return "1 month ago" end
  if months < 12 then return months .. " months ago" end

  local years = floor(days / 365)
  if years == 1 then return "1 year ago" end
  return years .. " years ago"
end

--- Format a unix timestamp using strftime pattern.
--- Wraps os.date which is a native C call.
function M.format_date(timestamp, pattern)
  pattern = pattern or "%Y-%m-%d %H:%M:%S"
  timestamp = timestamp or os_time()
  return os_date(pattern, timestamp)
end

--- Duration unit table for ms_parse.
local MS_UNITS = {
  ms = 1,
  s  = 1000,
  m  = 60000,
  h  = 3600000,
  d  = 86400000,
  w  = 604800000,
}

--- Parse a human duration string to milliseconds.
--- Supports: "500ms", "5s", "2m", "1h", "3d", "1w", "1h30m", "2d12h"
function M.ms_parse(str)
  if not str or str == "" then return 0 end
  -- If it's already a number, return it
  local n = tonumber(str)
  if n then return n end

  local total = 0
  for num, unit in gmatch(str, "(%d+%.?%d*)(%a+)") do
    local multiplier = MS_UNITS[lower(unit)]
    if multiplier then
      total = total + tonumber(num) * multiplier
    end
  end
  return total
end

--- Format milliseconds to the most appropriate human string.
--- 86400000 → "1d", 3661000 → "1h1m1s", 500 → "500ms"
function M.ms_format(ms)
  if not ms or ms == 0 then return "0ms" end

  local negative = ms < 0
  if negative then ms = -ms end

  if ms < 1000 then
    return (negative and "-" or "") .. floor(ms) .. "ms"
  end

  local parts = {}
  local days = floor(ms / 86400000)
  if days > 0 then insert(parts, days .. "d"); ms = ms - days * 86400000 end
  local hours = floor(ms / 3600000)
  if hours > 0 then insert(parts, hours .. "h"); ms = ms - hours * 3600000 end
  local minutes = floor(ms / 60000)
  if minutes > 0 then insert(parts, minutes .. "m"); ms = ms - minutes * 60000 end
  local seconds = floor(ms / 1000)
  if seconds > 0 then insert(parts, seconds .. "s") end

  local result = concat(parts)
  if negative then result = "-" .. result end
  return result
end

--- Decompose milliseconds into structured duration.
function M.duration(ms)
  if not ms then return { days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0 } end

  local negative = ms < 0
  if negative then ms = -ms end

  local days = floor(ms / 86400000)
  ms = ms - days * 86400000
  local hours = floor(ms / 3600000)
  ms = ms - hours * 3600000
  local minutes = floor(ms / 60000)
  ms = ms - minutes * 60000
  local seconds = floor(ms / 1000)
  local millis = ms - seconds * 1000

  return {
    days = days,
    hours = hours,
    minutes = minutes,
    seconds = seconds,
    milliseconds = floor(millis),
  }
end

-- ============================================================================
-- Safe JSON Encode
-- ============================================================================

--- JSON encode with graceful handling of cycles, functions, userdata.
--- Instead of erroring on circular references or unsupported types,
--- replaces them with descriptive strings.
function M.safe_encode(value, max_depth)
  max_depth = max_depth or 64

  local function clean(val, depth, seen)
    if depth > max_depth then return '"[max depth]"' end

    local t = type(val)
    if t == "function" then return nil end
    if t == "userdata" then return '"[userdata]"' end
    if t == "thread" then return '"[coroutine]"' end
    if t ~= "table" then return val end

    -- Cycle detection
    if seen[val] then return nil end
    seen[val] = true

    local result = {}
    -- Detect array vs object
    if rawget(val, 1) ~= nil or next(val) == nil then
      for i = 1, #val do
        result[i] = clean(val[i], depth + 1, seen)
      end
    else
      for k, v in pairs(val) do
        local cleaned = clean(v, depth + 1, seen)
        if cleaned ~= nil then
          result[tostring(k)] = cleaned
        end
      end
    end

    seen[val] = nil
    return result
  end

  local cleaned = clean(value, 0, {})
  local ok, result = pcall(json.encode, cleaned)
  if ok then
    return result
  else
    return '{"error":' .. json.encode(tostring(result)) .. '}'
  end
end

-- ============================================================================
-- RPC Handler Registry
-- ============================================================================

local handlers = {}

-- ID generation
handlers["utils:nanoid"] = function(args)
  return M.nanoid(args.length)
end

handlers["utils:uuid"] = function(args)
  return M.uuid()
end

-- Deep equality
handlers["utils:deep_equal"] = function(args)
  return M.deep_equal(args.a, args.b)
end

-- String utilities
handlers["utils:truncate"] = function(args)
  return M.truncate(args.str, args.max, args.ellipsis)
end

handlers["utils:slugify"] = function(args)
  return M.slugify(args.str)
end

handlers["utils:camel_case"] = function(args)
  return M.camel_case(args.str)
end

handlers["utils:snake_case"] = function(args)
  return M.snake_case(args.str)
end

handlers["utils:kebab_case"] = function(args)
  return M.kebab_case(args.str)
end

handlers["utils:pascal_case"] = function(args)
  return M.pascal_case(args.str)
end

handlers["utils:pluralize"] = function(args)
  return M.pluralize(args.count, args.singular, args.plural)
end

-- Date/time
handlers["utils:time_ago"] = function(args)
  return M.time_ago(args.timestamp)
end

handlers["utils:format_date"] = function(args)
  return M.format_date(args.timestamp, args.pattern)
end

handlers["utils:ms_parse"] = function(args)
  return M.ms_parse(args.str)
end

handlers["utils:ms_format"] = function(args)
  return M.ms_format(args.ms)
end

handlers["utils:duration"] = function(args)
  return M.duration(args.ms)
end

-- JSON safety
handlers["utils:safe_encode"] = function(args)
  return M.safe_encode(args.value, args.max_depth)
end

-- Batch dispatch (same pattern as math:batch)
handlers["utils:batch"] = function(args)
  local ops = args.ops or {}
  local results = {}
  for i = 1, #ops do
    local entry = ops[i]
    local handler = handlers[entry.op]
    if handler then
      results[i] = handler(entry.args or {})
    end
  end
  return results
end

function M.getHandlers()
  return handlers
end

return M
