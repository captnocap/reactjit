--[[
  syntax.lua -- Shared JSX/TypeScript tokenizer (Catppuccin Mocha)

  Used by texteditor.lua and codeblock.lua.
  Returns { colors, tokenizeLine } where tokenizeLine(line) produces
  an array of { text = string, color = {r,g,b,a} } tokens.
]]

local Color = require("lua.color")

local Syntax = {}

-- ============================================================================
-- Catppuccin Mocha syntax palette
-- ============================================================================

Syntax.colors = {
  keyword     = Color.toTable("#cba6f7"),  -- mauve: if, return, const, etc.
  string      = Color.toTable("#a6e3a1"),  -- green
  number      = Color.toTable("#fab387"),  -- peach
  constant    = Color.toTable("#fab387"),  -- peach: true, false, null, undefined
  comment     = Color.toTable("#9399b2"),  -- overlay2
  component   = Color.toTable("#89b4fa"),  -- blue: JSX <Component>
  tag         = Color.toTable("#f38ba8"),  -- red: JSX <div>
  prop        = Color.toTable("#89b4fa"),  -- blue: JSX attributes
  funcCall    = Color.toTable("#89b4fa"),  -- blue: function/method calls
  property    = Color.toTable("#94e2d5"),  -- teal: object keys, .property access
  builtin     = Color.toTable("#f38ba8"),  -- red: Math, console, JSON, this, super
  typeName    = Color.toTable("#f9e2af"),  -- yellow: type/interface names
  operator    = Color.toTable("#94e2d5"),  -- teal: +, -, ===, &&, etc.
  identifier  = Color.toTable("#cdd6f4"),  -- text
  punctuation = Color.toTable("#9399b2"),  -- overlay2: {, }, (, ), ;
  text        = Color.toTable("#cdd6f4"),  -- text
}

-- ============================================================================
-- Token classification tables
-- ============================================================================

local KEYWORDS = {
  ["const"]=true, ["let"]=true, ["var"]=true, ["function"]=true,
  ["return"]=true, ["if"]=true, ["else"]=true, ["for"]=true,
  ["while"]=true, ["do"]=true, ["switch"]=true, ["case"]=true,
  ["break"]=true, ["continue"]=true, ["new"]=true,
  ["class"]=true, ["extends"]=true, ["import"]=true, ["export"]=true,
  ["from"]=true, ["default"]=true, ["typeof"]=true, ["instanceof"]=true,
  ["in"]=true, ["of"]=true, ["try"]=true, ["catch"]=true,
  ["finally"]=true, ["throw"]=true, ["async"]=true, ["await"]=true,
  ["yield"]=true, ["void"]=true, ["delete"]=true, ["with"]=true,
}

local CONSTANTS = {
  ["true"]=true, ["false"]=true, ["null"]=true, ["undefined"]=true,
  ["NaN"]=true, ["Infinity"]=true,
}

local TS_KEYWORDS = {
  ["interface"]=true, ["type"]=true, ["enum"]=true, ["namespace"]=true,
  ["declare"]=true, ["abstract"]=true, ["implements"]=true,
  ["readonly"]=true, ["keyof"]=true, ["infer"]=true, ["satisfies"]=true,
  ["as"]=true, ["is"]=true, ["override"]=true, ["private"]=true,
  ["protected"]=true, ["public"]=true, ["static"]=true, ["module"]=true,
}

local BUILTINS = {
  ["Math"]=true, ["JSON"]=true, ["Object"]=true, ["Array"]=true,
  ["String"]=true, ["Number"]=true, ["Boolean"]=true, ["Promise"]=true,
  ["RegExp"]=true, ["Map"]=true, ["Set"]=true, ["Date"]=true,
  ["Error"]=true, ["console"]=true, ["parseInt"]=true, ["parseFloat"]=true,
  ["setTimeout"]=true, ["setInterval"]=true, ["clearTimeout"]=true,
  ["clearInterval"]=true, ["require"]=true, ["globalThis"]=true,
  ["window"]=true, ["document"]=true, ["Symbol"]=true, ["WeakMap"]=true,
  ["WeakSet"]=true, ["Proxy"]=true, ["Reflect"]=true,
  ["this"]=true, ["super"]=true,
}

local PUNCT_SET = {}
for i = 1, #"{}()[];:," do
  PUNCT_SET[("{}()[];:,"):sub(i,i)] = true
end

local OPERATOR_SET = {}
for i = 1, #"=+-><!&|?*/%~^" do
  OPERATOR_SET[("=+-><!&|?*/%~^"):sub(i,i)] = true
end

local THREE_CHAR_OP = {
  ["==="]=true, ["!=="]=true, ["**="]=true, [">>="]=true,
  ["<<="]=true, ["??="]=true, [">>>"]= true,
}
local TWO_CHAR_OP = {
  ["=>"]=true, ["=="]=true, ["!="]=true, ["&&"]=true, ["||"]=true,
  ["??"]=true, ["?."]=true, [">="]=true, ["<="]=true, ["+="]=true,
  ["-="]=true, ["*="]=true, ["/="]=true, ["%="]=true, ["++"]=true,
  ["--"]=true, ["<<"]=true, [">>"]=true, ["**"]=true,
}

-- ============================================================================
-- Tokenizer
-- ============================================================================

--- Tokenize a single line into {text, color} pairs.
function Syntax.tokenizeLine(line)
  local tokens = {}
  local i = 1
  local len = #line
  local inJSXTag = false
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i, i)

    -- Single-line comment
    if ch == "/" and line:sub(i+1, i+1) == "/" then
      tokens[#tokens+1] = { text = line:sub(i), color = sc.comment }
      break
    end

    -- Block comment
    if ch == "/" and line:sub(i+1, i+1) == "*" then
      local endPos = line:find("%*/", i + 2, true)
      if endPos then
        tokens[#tokens+1] = { text = line:sub(i, endPos + 1), color = sc.comment }
        i = endPos + 2
      else
        tokens[#tokens+1] = { text = line:sub(i), color = sc.comment }
        break
      end
      break
    end

    -- Strings
    if ch == '"' or ch == "'" or ch == '`' then
      local quote = ch
      local j = i + 1
      while j <= len and line:sub(j, j) ~= quote do
        if line:sub(j, j) == '\\' then j = j + 1 end
        j = j + 1
      end
      if j <= len then j = j + 1 end
      tokens[#tokens+1] = { text = line:sub(i, j - 1), color = sc.string }
      i = j
      break
    end

    -- Closing JSX tag </
    if ch == '<' and line:sub(i+1, i+1) == '/' then
      tokens[#tokens+1] = { text = '</', color = sc.tag }
      i = i + 2
      inJSXTag = true
      local s = i
      while i <= len and line:sub(i,i):match("[a-zA-Z0-9_.]") do i = i + 1 end
      if i > s then
        local name = line:sub(s, i - 1)
        local first = name:sub(1,1)
        tokens[#tokens+1] = { text = name, color = (first >= 'A' and first <= 'Z') and sc.component or sc.tag }
      end
      break
    end

    -- Fragment <>
    if ch == '<' and line:sub(i+1, i+1) == '>' then
      tokens[#tokens+1] = { text = '<>', color = sc.tag }
      i = i + 2
      break
    end

    -- Opening JSX tag
    if ch == '<' and i + 1 <= len and line:sub(i+1, i+1):match("[a-zA-Z]") then
      tokens[#tokens+1] = { text = '<', color = sc.tag }
      i = i + 1
      inJSXTag = true
      local s = i
      while i <= len and line:sub(i,i):match("[a-zA-Z0-9_.]") do i = i + 1 end
      if i > s then
        local name = line:sub(s, i - 1)
        local first = name:sub(1,1)
        tokens[#tokens+1] = { text = name, color = (first >= 'A' and first <= 'Z') and sc.component or sc.tag }
      end
      break
    end

    -- Self-closing />
    if ch == '/' and line:sub(i+1, i+1) == '>' then
      tokens[#tokens+1] = { text = '/>', color = sc.tag }
      i = i + 2
      inJSXTag = false
      break
    end

    -- Closing >
    if ch == '>' and inJSXTag then
      tokens[#tokens+1] = { text = '>', color = sc.tag }
      i = i + 1
      inJSXTag = false
      break
    end

    -- Numbers
    if ch:match("[0-9]") then
      local s = i
      if ch == '0' and (line:sub(i+1, i+1) == 'x' or line:sub(i+1, i+1) == 'X') then
        i = i + 2
        while i <= len and line:sub(i,i):match("[0-9a-fA-F]") do i = i + 1 end
      else
        while i <= len and line:sub(i,i):match("[0-9.]") do i = i + 1 end
      end
      tokens[#tokens+1] = { text = line:sub(s, i - 1), color = sc.number }
      break
    end

    -- Identifiers and keywords
    if ch:match("[a-zA-Z_$]") then
      local s = i
      while i <= len and line:sub(i,i):match("[a-zA-Z0-9_$]") do i = i + 1 end
      local word = line:sub(s, i - 1)
      local color

      local peek = i
      while peek <= len and line:sub(peek, peek):match("%s") do peek = peek + 1 end
      local nextChar = peek <= len and line:sub(peek, peek) or ""

      local afterDot = s > 1 and line:sub(s-1, s-1) == '.'

      if inJSXTag and nextChar == '=' then
        color = sc.prop
      elseif CONSTANTS[word] then
        color = sc.constant
      elseif BUILTINS[word] then
        color = sc.builtin
      elseif KEYWORDS[word] or TS_KEYWORDS[word] then
        color = sc.keyword
      elseif afterDot and nextChar == '(' then
        color = sc.funcCall
      elseif afterDot then
        color = sc.property
      elseif nextChar == '(' then
        color = sc.funcCall
      elseif nextChar == ':' and not (peek + 1 <= len and line:sub(peek+1, peek+1) == ':') then
        color = sc.property
      else
        color = sc.identifier
      end
      tokens[#tokens+1] = { text = word, color = color }
      break
    end

    -- Whitespace
    if ch:match("%s") then
      local s = i
      while i <= len and line:sub(i,i):match("%s") do i = i + 1 end
      tokens[#tokens+1] = { text = line:sub(s, i - 1), color = sc.text }
      break
    end

    -- Dot accessor
    if ch == '.' then
      if line:sub(i, i+2) == '...' then
        tokens[#tokens+1] = { text = '...', color = sc.operator }
        i = i + 3
      else
        local nextCh = i + 1 <= len and line:sub(i+1, i+1) or ""
        if nextCh:match("[a-zA-Z_$]") then
          tokens[#tokens+1] = { text = '.', color = sc.operator }
        else
          tokens[#tokens+1] = { text = '.', color = sc.punctuation }
        end
        i = i + 1
      end
      break
    end

    -- Operators (teal)
    if OPERATOR_SET[ch] then
      local three = line:sub(i, i + 2)
      local two = line:sub(i, i + 1)
      if #three == 3 and THREE_CHAR_OP[three] then
        tokens[#tokens+1] = { text = three, color = sc.operator }
        i = i + 3
      elseif #two == 2 and TWO_CHAR_OP[two] then
        tokens[#tokens+1] = { text = two, color = sc.operator }
        i = i + 2
      else
        tokens[#tokens+1] = { text = ch, color = sc.operator }
        i = i + 1
      end
      break
    end

    -- Punctuation (overlay2)
    if PUNCT_SET[ch] then
      tokens[#tokens+1] = { text = ch, color = sc.punctuation }
      i = i + 1
      break
    end

    -- Fallback
    tokens[#tokens+1] = { text = ch, color = sc.text }
    i = i + 1

  until true end
  return tokens
end

return Syntax
