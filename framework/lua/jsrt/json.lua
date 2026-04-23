-- Minimal JSON decoder for JSRT boot-time AST blobs.
--
-- This intentionally handles only the JSON surface we emit from
-- scripts/build-jsast.mjs: objects, arrays, strings, numbers, booleans, and
-- null. It returns plain Lua tables/primitives so the AST shape matches the
-- evaluator's existing input.

local M = {}

local function utf8_encode(cp)
  if cp < 0x80 then
    return string.char(cp)
  elseif cp < 0x800 then
    return string.char(
      0xC0 + math.floor(cp / 0x40),
      0x80 + (cp % 0x40)
    )
  elseif cp < 0x10000 then
    return string.char(
      0xE0 + math.floor(cp / 0x1000),
      0x80 + (math.floor(cp / 0x40) % 0x40),
      0x80 + (cp % 0x40)
    )
  elseif cp <= 0x10FFFF then
    return string.char(
      0xF0 + math.floor(cp / 0x40000),
      0x80 + (math.floor(cp / 0x1000) % 0x40),
      0x80 + (math.floor(cp / 0x40) % 0x40),
      0x80 + (cp % 0x40)
    )
  end
  error("invalid Unicode codepoint in JSON escape: " .. tostring(cp), 0)
end

function M.decode(text)
  if type(text) ~= "string" then
    error("json.decode expected a string", 0)
  end

  local i = 1
  local n = #text

  local function fail(msg)
    error(string.format("json decode error at byte %d: %s", i, msg), 0)
  end

  local function peek()
    return text:sub(i, i)
  end

  local function nextc()
    local c = text:sub(i, i)
    i = i + 1
    return c
  end

  local function skip_ws()
    while true do
      local c = peek()
      if c == " " or c == "\n" or c == "\r" or c == "\t" then
        i = i + 1
      else
        return
      end
    end
  end

  local parse_value

  local function parse_string()
    if nextc() ~= '"' then fail("expected string") end
    local out = {}
    while i <= n do
      local c = nextc()
      if c == '"' then
        return table.concat(out)
      elseif c == "\\" then
        local esc = nextc()
        if esc == '"' or esc == "\\" or esc == "/" then
          out[#out + 1] = esc
        elseif esc == "b" then
          out[#out + 1] = "\b"
        elseif esc == "f" then
          out[#out + 1] = "\f"
        elseif esc == "n" then
          out[#out + 1] = "\n"
        elseif esc == "r" then
          out[#out + 1] = "\r"
        elseif esc == "t" then
          out[#out + 1] = "\t"
        elseif esc == "u" then
          local hex = text:sub(i, i + 3)
          if #hex < 4 or not hex:match("^[0-9a-fA-F]+$") then
            fail("invalid \\u escape")
          end
          i = i + 4
          local cp = tonumber(hex, 16)
          if cp >= 0xD800 and cp <= 0xDBFF then
            if text:sub(i, i + 1) == "\\u" then
              local low_hex = text:sub(i + 2, i + 5)
              if #low_hex < 4 or not low_hex:match("^[0-9a-fA-F]+$") then
                fail("invalid surrogate pair")
              end
              local low = tonumber(low_hex, 16)
              if low < 0xDC00 or low > 0xDFFF then
                fail("invalid surrogate pair")
              end
              i = i + 6
              cp = 0x10000 + ((cp - 0xD800) * 0x400) + (low - 0xDC00)
            else
              fail("unpaired high surrogate")
            end
          elseif cp >= 0xDC00 and cp <= 0xDFFF then
            fail("unpaired low surrogate")
          end
          out[#out + 1] = utf8_encode(cp)
        else
          fail("invalid escape sequence")
        end
      elseif c == "" then
        fail("unterminated string")
      else
        out[#out + 1] = c
      end
    end
    fail("unterminated string")
  end

  local function parse_number()
    local start = i
    if peek() == "-" then i = i + 1 end
    local c = peek()
    if c == "0" then
      i = i + 1
    elseif c >= "1" and c <= "9" then
      repeat
        i = i + 1
        c = peek()
      until not (c >= "0" and c <= "9")
    else
      fail("invalid number")
    end
    if peek() == "." then
      i = i + 1
      c = peek()
      if not (c >= "0" and c <= "9") then fail("invalid fractional part") end
      repeat
        i = i + 1
        c = peek()
      until not (c >= "0" and c <= "9")
    end
    c = peek()
    if c == "e" or c == "E" then
      i = i + 1
      c = peek()
      if c == "+" or c == "-" then
        i = i + 1
        c = peek()
      end
      if not (c >= "0" and c <= "9") then fail("invalid exponent") end
      repeat
        i = i + 1
        c = peek()
      until not (c >= "0" and c <= "9")
    end
    local num = tonumber(text:sub(start, i - 1))
    if num == nil then fail("invalid number") end
    return num
  end

  local function parse_array()
    if nextc() ~= "[" then fail("expected '['") end
    local arr = {}
    skip_ws()
    if peek() == "]" then
      i = i + 1
      return arr
    end
    local idx = 0
    while true do
      idx = idx + 1
      arr[idx] = parse_value()
      skip_ws()
      local c = nextc()
      if c == "]" then
        return arr
      end
      if c ~= "," then fail("expected ',' or ']'") end
      skip_ws()
    end
  end

  local function parse_object()
    if nextc() ~= "{" then fail("expected '{'") end
    local obj = {}
    skip_ws()
    if peek() == "}" then
      i = i + 1
      return obj
    end
    while true do
      if peek() ~= '"' then fail("expected object key") end
      local key = parse_string()
      skip_ws()
      if nextc() ~= ":" then fail("expected ':'") end
      skip_ws()
      obj[key] = parse_value()
      skip_ws()
      local c = nextc()
      if c == "}" then
        return obj
      end
      if c ~= "," then fail("expected ',' or '}'") end
      skip_ws()
    end
  end

  parse_value = function()
    skip_ws()
    local c = peek()
    if c == '"' then return parse_string() end
    if c == "[" then return parse_array() end
    if c == "{" then return parse_object() end
    if c == "-" or (c >= "0" and c <= "9") then return parse_number() end
    if text:sub(i, i + 3) == "true" then i = i + 4; return true end
    if text:sub(i, i + 4) == "false" then i = i + 5; return false end
    if text:sub(i, i + 3) == "null" then i = i + 4; return nil end
    fail("unexpected token")
  end

  local value = parse_value()
  skip_ws()
  if i <= n then fail("trailing data") end
  return value
end

return M
