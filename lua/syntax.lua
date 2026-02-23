--[[
  syntax.lua -- Multi-language syntax tokenizer (Catppuccin Mocha)

  Used by texteditor.lua and codeblock.lua.
  Public API:
    Syntax.colors                       -- shared palette
    Syntax.tokenizeLine(line, lang)     -- returns {text, color}[] tokens
    Syntax.detectLanguage(lines)        -- heuristic language detection
]]

local Color = require("lua.color")

local Syntax = {}

-- ============================================================================
-- Catppuccin Mocha palette
-- ============================================================================

Syntax.colors = {
  keyword     = Color.toTable("#cba6f7"),  -- mauve
  string      = Color.toTable("#a6e3a1"),  -- green
  number      = Color.toTable("#fab387"),  -- peach
  constant    = Color.toTable("#fab387"),  -- peach
  comment     = Color.toTable("#9399b2"),  -- overlay2
  component   = Color.toTable("#89b4fa"),  -- blue
  tag         = Color.toTable("#f38ba8"),  -- red
  prop        = Color.toTable("#89b4fa"),  -- blue
  funcCall    = Color.toTable("#89b4fa"),  -- blue
  property    = Color.toTable("#94e2d5"),  -- teal
  builtin     = Color.toTable("#f38ba8"),  -- red
  typeName    = Color.toTable("#f9e2af"),  -- yellow
  operator    = Color.toTable("#94e2d5"),  -- teal
  identifier  = Color.toTable("#cdd6f4"),  -- text
  punctuation = Color.toTable("#9399b2"),  -- overlay2
  text        = Color.toTable("#cdd6f4"),  -- text
  decorator   = Color.toTable("#f2cdcd"),  -- flamingo
  macro       = Color.toTable("#f2cdcd"),  -- flamingo
  label       = Color.toTable("#eba0ac"),  -- maroon
  variable    = Color.toTable("#cba6f7"),  -- mauve
  attribute   = Color.toTable("#89b4fa"),  -- blue
  unit        = Color.toTable("#fab387"),  -- peach
  selector    = Color.toTable("#f38ba8"),  -- red
  cssValue    = Color.toTable("#a6e3a1"),  -- green
  lifetime    = Color.toTable("#eba0ac"),  -- maroon
  namespace_  = Color.toTable("#89dceb"),  -- sky
  sqlKeyword  = Color.toTable("#cba6f7"),  -- mauve
  glslType    = Color.toTable("#f9e2af"),  -- yellow
  yamlKey     = Color.toTable("#89b4fa"),  -- blue
  regex       = Color.toTable("#f5c2e7"),  -- pink
}

-- ============================================================================
-- Shared utilities
-- ============================================================================

--- Scan from i consuming whitespace, return start, advance i.
local function skipWS(line, i)
  while i <= #line and line:sub(i,i):match("%s") do i = i + 1 end
  return i
end

--- Consume a string delimited by `quote` starting at i (i points to quote char).
--- Returns (text, newI).
local function consumeString(line, i, quote)
  local j = i + 1
  local len = #line
  while j <= len do
    local c = line:sub(j,j)
    if c == '\\' then j = j + 2
    elseif c == quote then j = j + 1; break
    else j = j + 1 end
  end
  return line:sub(i, j-1), j
end

-- ============================================================================
-- JavaScript / TypeScript / JSX / TSX
-- ============================================================================

local JS_KW = {
  const=1,let=1,var=1,["function"]=1,["return"]=1,["if"]=1,["else"]=1,
  ["for"]=1,["while"]=1,["do"]=1,["switch"]=1,["case"]=1,["break"]=1,
  ["continue"]=1,["new"]=1,["class"]=1,["extends"]=1,["import"]=1,
  ["export"]=1,["from"]=1,["default"]=1,["typeof"]=1,["instanceof"]=1,
  ["in"]=1,["of"]=1,["try"]=1,["catch"]=1,["finally"]=1,["throw"]=1,
  ["async"]=1,["await"]=1,["yield"]=1,["void"]=1,["delete"]=1,["with"]=1,
}
local TS_KW = {
  interface=1,type=1,enum=1,namespace=1,declare=1,abstract=1,
  implements=1,readonly=1,keyof=1,infer=1,satisfies=1,as=1,["is"]=1,
  override=1,private=1,protected=1,public=1,static=1,module=1,
}
local JS_CONST = { ["true"]=1,["false"]=1,["null"]=1,["undefined"]=1,["NaN"]=1,["Infinity"]=1 }
local JS_BUILTIN = {
  Math=1,JSON=1,Object=1,Array=1,String=1,Number=1,Boolean=1,Promise=1,
  RegExp=1,Map=1,Set=1,Date=1,Error=1,console=1,parseInt=1,parseFloat=1,
  setTimeout=1,setInterval=1,clearTimeout=1,clearInterval=1,require=1,
  globalThis=1,window=1,document=1,Symbol=1,WeakMap=1,WeakSet=1,
  Proxy=1,Reflect=1,fetch=1,URL=1,URLSearchParams=1,
  this=1,super=1,
}
local JS_PUNCT = {}; for c in ("{}()[];:,"):gmatch(".") do JS_PUNCT[c]=true end
local JS_OP_CH = {}; for c in ("=+-><!&|?*/%~^"):gmatch(".") do JS_OP_CH[c]=true end
local JS_3OP = {["==="]=1,["!=="]=1,["**="]=1,[">>="]=1,["<<="]=1,["??="]=1,[">>>"]=1}
local JS_2OP = {
  ["=>"]=1,["=="]=1,["!="]=1,["&&"]=1,["||"]=1,["??"]=1,["?."]=1,
  [">="]=1,["<="]=1,["+="]=1,["-="]=1,["*="]=1,["/="]=1,["%="]=1,
  ["++"]=1,["--"]=1,["<<"]=1,[">>"]=1,["**"]=1,["!!"]=1,
}

local function tokenizeJS(line)
  local tokens = {}
  local i = 1
  local len = #line
  local inJSXTag = false
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Single-line comment
    if ch == '/' and line:sub(i+1,i+1) == '/' then
      tokens[#tokens+1] = {text=line:sub(i), color=sc.comment}; break
    end

    -- Block comment
    if ch == '/' and line:sub(i+1,i+1) == '*' then
      local e = line:find("%*/", i+2, true)
      if e then
        tokens[#tokens+1] = {text=line:sub(i,e+1), color=sc.comment}; i=e+2
      else
        tokens[#tokens+1] = {text=line:sub(i), color=sc.comment}; break
      end
      break
    end

    -- Regex literal (heuristic: / not inside expression)
    -- (skip — hard to distinguish from division reliably)

    -- Strings
    if ch=='"' or ch=="'" or ch=='`' then
      local s, ni = consumeString(line, i, ch)
      tokens[#tokens+1] = {text=s, color=sc.string}; i=ni; break
    end

    -- Decorator @
    if ch == '@' then
      local s = i; i = i + 1
      while i <= len and line:sub(i,i):match("[a-zA-Z0-9_$]") do i=i+1 end
      tokens[#tokens+1] = {text=line:sub(s,i-1), color=sc.decorator}; break
    end

    -- Closing JSX tag </
    if ch=='<' and line:sub(i+1,i+1)=='/' then
      tokens[#tokens+1] = {text='</', color=sc.tag}; i=i+2; inJSXTag=true
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_.]") do i=i+1 end
      if i>s then
        local nm=line:sub(s,i-1)
        tokens[#tokens+1] = {text=nm, color=(nm:sub(1,1):match("%u")) and sc.component or sc.tag}
      end
      break
    end

    -- Fragment <>
    if ch=='<' and line:sub(i+1,i+1)=='>' then
      tokens[#tokens+1] = {text='<>', color=sc.tag}; i=i+2; break
    end

    -- Opening JSX tag
    if ch=='<' and i+1<=len and line:sub(i+1,i+1):match("[a-zA-Z]") then
      tokens[#tokens+1] = {text='<', color=sc.tag}; i=i+1; inJSXTag=true
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_.]") do i=i+1 end
      if i>s then
        local nm=line:sub(s,i-1)
        tokens[#tokens+1] = {text=nm, color=(nm:sub(1,1):match("%u")) and sc.component or sc.tag}
      end
      break
    end

    -- Self-closing />
    if ch=='/' and line:sub(i+1,i+1)=='>' then
      tokens[#tokens+1] = {text='/>', color=sc.tag}; i=i+2; inJSXTag=false; break
    end

    -- Closing >
    if ch=='>' and inJSXTag then
      tokens[#tokens+1] = {text='>', color=sc.tag}; i=i+1; inJSXTag=false; break
    end

    -- Numbers
    if ch:match("[0-9]") or (ch=='-' and line:sub(i+1,i+1):match("[0-9]") and i>1 and line:sub(i-1,i-1):match("[^%w_]")) then
      local s=i
      if ch=='-' then i=i+1 end
      if line:sub(i,i+1):lower()=='0x' then
        i=i+2; while i<=len and line:sub(i,i):match("[0-9a-fA-F_]") do i=i+1 end
      elseif line:sub(i,i+1):lower()=='0b' then
        i=i+2; while i<=len and line:sub(i,i):match("[01_]") do i=i+1 end
      else
        while i<=len and line:sub(i,i):match("[0-9._]") do i=i+1 end
        if i<=len and line:sub(i,i):lower()=='e' then
          i=i+1
          if i<=len and (line:sub(i,i)=='+' or line:sub(i,i)=='-') then i=i+1 end
          while i<=len and line:sub(i,i):match("[0-9]") do i=i+1 end
        end
        if i<=len and (line:sub(i,i)=='n') then i=i+1 end  -- BigInt
      end
      tokens[#tokens+1] = {text=line:sub(s,i-1), color=sc.number}; break
    end

    -- Identifiers and keywords
    if ch:match("[a-zA-Z_$]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_$]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local afterDot=s>1 and line:sub(s-1,s-1)=='.'
      local color
      if inJSXTag and nextCh=='=' then color=sc.prop
      elseif JS_CONST[word] then color=sc.constant
      elseif JS_BUILTIN[word] then color=sc.builtin
      elseif JS_KW[word] or TS_KW[word] then color=sc.keyword
      elseif word:match("^[A-Z]") and nextCh~='(' then color=sc.typeName
      elseif afterDot and nextCh=='(' then color=sc.funcCall
      elseif afterDot then color=sc.property
      elseif nextCh=='(' then color=sc.funcCall
      elseif nextCh==':' and not(peek+1<=len and line:sub(peek+1,peek+1)==':') then color=sc.property
      else color=sc.identifier end
      tokens[#tokens+1] = {text=word, color=color}; break
    end

    -- Whitespace
    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1] = {text=line:sub(s,i-1), color=sc.text}; break
    end

    -- Dot / spread
    if ch=='.' then
      if line:sub(i,i+2)=='...' then
        tokens[#tokens+1]={text='...', color=sc.operator}; i=i+3
      else
        tokens[#tokens+1]={text='.', color=(line:sub(i+1,i+1):match("[a-zA-Z_$]")) and sc.operator or sc.punctuation}
        i=i+1
      end
      break
    end

    -- Operators
    if JS_OP_CH[ch] then
      local t3=line:sub(i,i+2); local t2=line:sub(i,i+1)
      if #t3==3 and JS_3OP[t3] then tokens[#tokens+1]={text=t3,color=sc.operator}; i=i+3
      elseif #t2==2 and JS_2OP[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end

    -- Punctuation
    if JS_PUNCT[ch] then
      tokens[#tokens+1]={text=ch, color=sc.punctuation}; i=i+1; break
    end

    tokens[#tokens+1]={text=ch, color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- Python
-- ============================================================================

local PY_KW = {
  ["and"]=1,["as"]=1,["assert"]=1,["async"]=1,["await"]=1,["break"]=1,
  ["class"]=1,["continue"]=1,["def"]=1,["del"]=1,["elif"]=1,["else"]=1,
  ["except"]=1,["finally"]=1,["for"]=1,["from"]=1,["global"]=1,["if"]=1,
  ["import"]=1,["in"]=1,["is"]=1,["lambda"]=1,["nonlocal"]=1,["not"]=1,
  ["or"]=1,["pass"]=1,["raise"]=1,["return"]=1,["try"]=1,["while"]=1,
  ["with"]=1,["yield"]=1,
}
local PY_CONST = {["True"]=1,["False"]=1,["None"]=1}
local PY_BUILTIN = {
  print=1,len=1,range=1,enumerate=1,zip=1,map=1,filter=1,list=1,dict=1,
  set=1,tuple=1,str=1,int=1,float=1,bool=1,bytes=1,type=1,isinstance=1,
  issubclass=1,hasattr=1,getattr=1,setattr=1,delattr=1,open=1,super=1,
  property=1,staticmethod=1,classmethod=1,input=1,abs=1,max=1,min=1,sum=1,
  sorted=1,reversed=1,any=1,all=1,round=1,repr=1,format=1,id=1,hash=1,
  object=1,callable=1,iter=1,next=1,vars=1,dir=1,
}
local PY_OP_CH = {}; for c in ("=+-><!&|*/%~^@"):gmatch(".") do PY_OP_CH[c]=true end

local function tokenizePython(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Comment
    if ch=='#' then tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end

    -- Triple-quoted string (single line portion)
    if line:sub(i,i+2)=='"""' or line:sub(i,i+2)=="'''" then
      local q=line:sub(i,i+2)
      local e=line:find(q, i+3, true)
      if e then
        tokens[#tokens+1]={text=line:sub(i,e+2),color=sc.string}; i=e+3
      else
        tokens[#tokens+1]={text=line:sub(i),color=sc.string}; break
      end
      break
    end

    -- F-string prefix
    if (ch=='f' or ch=='F' or ch=='r' or ch=='R' or ch=='b' or ch=='B') and
       (line:sub(i+1,i+1)=='"' or line:sub(i+1,i+1)=="'") then
      local prefix=ch; i=i+1; ch=line:sub(i,i)
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=prefix..s2, color=sc.string}; i=ni; break
    end

    -- String
    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2, color=sc.string}; i=ni; break
    end

    -- Decorator
    if ch=='@' then
      local s=i; i=i+1
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_.]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.decorator}; break
    end

    -- Numbers
    if ch:match("[0-9]") then
      local s=i
      if line:sub(i,i+1):lower()=='0x' then
        i=i+2; while i<=len and line:sub(i,i):match("[0-9a-fA-F_]") do i=i+1 end
      elseif line:sub(i,i+1):lower()=='0b' then
        i=i+2; while i<=len and line:sub(i,i):match("[01_]") do i=i+1 end
      elseif line:sub(i,i+1):lower()=='0o' then
        i=i+2; while i<=len and line:sub(i,i):match("[0-7_]") do i=i+1 end
      else
        while i<=len and line:sub(i,i):match("[0-9_.]") do i=i+1 end
        if i<=len and line:sub(i,i):lower()=='e' then
          i=i+1
          if i<=len and (line:sub(i,i)=='+' or line:sub(i,i)=='-') then i=i+1 end
          while i<=len and line:sub(i,i):match("[0-9]") do i=i+1 end
        end
        if i<=len and line:sub(i,i):lower()=='j' then i=i+1 end  -- complex
      end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.number}; break
    end

    -- Identifiers
    if ch:match("[a-zA-Z_]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local color
      if PY_CONST[word] then color=sc.constant
      elseif PY_KW[word] then color=sc.keyword
      elseif PY_BUILTIN[word] then color=sc.builtin
      elseif word:match("^__") and word:match("__$") then color=sc.builtin  -- dunder
      elseif word:match("^[A-Z]") then color=sc.typeName
      elseif nextCh=='(' then color=sc.funcCall
      else color=sc.identifier end
      tokens[#tokens+1]={text=word, color=color}; break
    end

    -- Whitespace
    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.text}; break
    end

    -- Dot
    if ch=='.' then
      tokens[#tokens+1]={text='.', color=(line:sub(i+1,i+1):match("[a-zA-Z_]")) and sc.operator or sc.punctuation}
      i=i+1; break
    end

    -- Operators
    if PY_OP_CH[ch] then
      local t2=line:sub(i,i+1)
      local two2op={["=="]=1,["!="]=1,["<="]=1,[">="]=1,["**"]=1,["//"]=1,
                    ["+="]=1,["-="]=1,["*="]=1,["/="]=1,["%="]=1,["&="]=1,
                    ["|="]=1,["^="]=1,["->"]=1,["<<"]=1,[">>"]=1,["@="]=1}
      if two2op[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      elseif ch==':' then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end

    local punct2={}; for c in ("{}()[];:,"):gmatch(".") do punct2[c]=true end
    if punct2[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch, color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- Lua
-- ============================================================================

local LUA_KW = {
  ["and"]=1,["break"]=1,["do"]=1,["else"]=1,["elseif"]=1,["end"]=1,
  ["false"]=1,["for"]=1,["function"]=1,["goto"]=1,["if"]=1,["in"]=1,
  ["local"]=1,["nil"]=1,["not"]=1,["or"]=1,["repeat"]=1,["return"]=1,
  ["then"]=1,["true"]=1,["until"]=1,["while"]=1,
}
local LUA_BUILTIN = {
  print=1,tostring=1,tonumber=1,type=1,pairs=1,ipairs=1,next=1,select=1,
  unpack=1,table=1,string=1,math=1,io=1,os=1,package=1,rawget=1,rawset=1,
  rawequal=1,rawlen=1,setmetatable=1,getmetatable=1,error=1,assert=1,
  pcall=1,xpcall=1,require=1,load=1,loadfile=1,dofile=1,collectgarbage=1,
  coroutine=1,bit=1,jit=1,ffi=1,love=1,
}

local function tokenizeLua(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Single-line comment
    if ch=='-' and line:sub(i+1,i+1)=='-' then
      -- Check for long comment --[[ ]]
      if line:sub(i+2,i+3)=='[[' then
        local e=line:find("%]%]", i+4, true)
        if e then
          tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.comment}; i=e+2
        else
          tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
        end
      else
        tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
      end
      break
    end

    -- Long string [[ ]]
    if ch=='[' and line:sub(i+1,i+1)=='[' then
      local e=line:find("%]%]", i+2, true)
      if e then
        tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.string}; i=e+2
      else
        tokens[#tokens+1]={text=line:sub(i),color=sc.string}; break
      end
      break
    end

    -- String
    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2, color=sc.string}; i=ni; break
    end

    -- Numbers
    if ch:match("[0-9]") then
      local s=i
      if line:sub(i,i+1):lower()=='0x' then
        i=i+2; while i<=len and line:sub(i,i):match("[0-9a-fA-F]") do i=i+1 end
      else
        while i<=len and line:sub(i,i):match("[0-9._]") do i=i+1 end
        if i<=len and line:sub(i,i):lower()=='e' then
          i=i+1
          if i<=len and (line:sub(i,i)=='+' or line:sub(i,i)=='-') then i=i+1 end
          while i<=len and line:sub(i,i):match("[0-9]") do i=i+1 end
        end
      end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.number}; break
    end

    -- Identifiers
    if ch:match("[a-zA-Z_]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local afterDot=s>1 and line:sub(s-1,s-1)=='.'
      local color
      if LUA_KW[word] then
        color=(word=='true' or word=='false' or word=='nil') and sc.constant or sc.keyword
      elseif LUA_BUILTIN[word] then color=sc.builtin
      elseif afterDot and nextCh=='(' then color=sc.funcCall
      elseif afterDot then color=sc.property
      elseif nextCh=='(' then color=sc.funcCall
      elseif nextCh==':' then color=sc.property
      else color=sc.identifier end
      tokens[#tokens+1]={text=word, color=color}; break
    end

    -- Whitespace
    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.text}; break
    end

    -- Dot / colon
    if ch=='.' then
      if line:sub(i,i+2)=='...' then tokens[#tokens+1]={text='...',color=sc.operator}; i=i+3
      elseif line:sub(i,i+1)=='..' then tokens[#tokens+1]={text='..',color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text='.',color=sc.operator}; i=i+1 end
      break
    end
    if ch==':' then
      if line:sub(i,i+1)=='::' then tokens[#tokens+1]={text='::',color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=':',color=sc.punctuation}; i=i+1 end
      break
    end

    local luaop={}; for c in ("=+-*/%^&|~<>#"):gmatch(".") do luaop[c]=true end
    local luapunct={}; for c in ("{}()[],;"):gmatch(".") do luapunct[c]=true end
    if luaop[ch] then
      local t2=line:sub(i,i+1)
      local two2={["=="]=1,["~="]=1,["<="]=1,[">="]=1,["~="]=1}
      if two2[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end
    if luapunct[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch, color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- Bash / Shell
-- ============================================================================

local BASH_KW = {
  ["if"]=1,["fi"]=1,["then"]=1,["else"]=1,["elif"]=1,["for"]=1,["do"]=1,
  ["done"]=1,["while"]=1,["until"]=1,["case"]=1,["esac"]=1,["in"]=1,
  ["function"]=1,["return"]=1,["exit"]=1,["break"]=1,["continue"]=1,
  ["local"]=1,["readonly"]=1,["export"]=1,["declare"]=1,["typeset"]=1,
  ["select"]=1,["shift"]=1,["set"]=1,["unset"]=1,["trap"]=1,
}
local BASH_BUILTIN = {
  echo=1,printf=1,read=1,cd=1,pwd=1,ls=1,cp=1,mv=1,rm=1,mkdir=1,rmdir=1,
  touch=1,cat=1,grep=1,sed=1,awk=1,find=1,sort=1,head=1,tail=1,wc=1,
  source=1,["."]=1,eval=1,exec=1,test=1,["["]=1,["[["]=1,true=1,false=1,
  curl=1,wget=1,git=1,make=1,npm=1,node=1,python=1,python3=1,bash=1,sh=1,
}

local function tokenizeBash(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  -- Shebang
  if line:sub(1,2)=='#!' then
    tokens[#tokens+1]={text=line, color=sc.comment}; return tokens
  end

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Comment
    if ch=='#' then tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end

    -- Strings
    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2, color=sc.string}; i=ni; break
    end

    -- Backtick subshell
    if ch=='`' then
      local j=i+1
      while j<=len and line:sub(j,j)~='`' do j=j+1 end
      if j<=len then j=j+1 end
      tokens[#tokens+1]={text=line:sub(i,j-1), color=sc.builtin}; i=j; break
    end

    -- Variable $VAR ${VAR} $( )
    if ch=='$' then
      local s=i; i=i+1
      if i<=len and line:sub(i,i)=='(' then
        -- $(...)
        local depth=1; i=i+1
        while i<=len and depth>0 do
          if line:sub(i,i)=='(' then depth=depth+1
          elseif line:sub(i,i)==')' then depth=depth-1 end
          i=i+1
        end
        tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.funcCall}
      elseif i<=len and line:sub(i,i)=='{' then
        while i<=len and line:sub(i,i)~='}' do i=i+1 end
        if i<=len then i=i+1 end
        tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.variable}
      elseif i<=len and line:sub(i,i):match("[a-zA-Z_0-9?#@*!-]") then
        while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
        tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.variable}
      else
        tokens[#tokens+1]={text='$', color=sc.operator}
      end
      break
    end

    -- Numbers
    if ch:match("[0-9]") then
      local s=i; while i<=len and line:sub(i,i):match("[0-9.]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.number}; break
    end

    -- Identifiers
    if ch:match("[a-zA-Z_]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local color
      -- Check for variable assignment (WORD=)
      if nextCh=='=' and not line:sub(peek+1,peek+1):match("[=]") then
        color=sc.variable
      elseif BASH_KW[word] then color=sc.keyword
      elseif BASH_BUILTIN[word] then color=sc.builtin
      else color=sc.identifier end
      tokens[#tokens+1]={text=word, color=color}; break
    end

    -- Whitespace
    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.text}; break
    end

    -- Redirection and pipes
    local bashop={[">"]=1,["<"]=1,["|"]=1,["&"]=1}
    if bashop[ch] then
      local t2=line:sub(i,i+1)
      local two2={[">>"]=1,["<<"]=1,["2>"]=1,["&>"]=1,["&&"]=1,["||"]=1}
      if two2[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end

    local bpunct={}; for c in ("{}()[]=;:,"):gmatch(".") do bpunct[c]=true end
    if bpunct[ch] then
      tokens[#tokens+1]={text=ch, color=(ch=='=' or ch==';' or ch==':') and sc.operator or sc.punctuation}
      i=i+1; break
    end

    tokens[#tokens+1]={text=ch, color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- JSON
-- ============================================================================

local function tokenizeJSON(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    if ch=='"' then
      local s2,ni=consumeString(line,i,ch)
      -- Check if it's a key (followed by :)
      local peek=skipWS(line,ni)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      tokens[#tokens+1]={text=s2, color=(nextCh==':') and sc.yamlKey or sc.string}
      i=ni; break
    end

    if ch:match("[0-9]") or (ch=='-' and line:sub(i+1,i+1):match("[0-9]")) then
      local s=i
      if ch=='-' then i=i+1 end
      while i<=len and line:sub(i,i):match("[0-9.]") do i=i+1 end
      if i<=len and line:sub(i,i):lower()=='e' then
        i=i+1
        if i<=len and (line:sub(i,i)=='+' or line:sub(i,i)=='-') then i=i+1 end
        while i<=len and line:sub(i,i):match("[0-9]") do i=i+1 end
      end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.number}; break
    end

    if ch:match("[a-z]") then
      local s=i; while i<=len and line:sub(i,i):match("[a-z]") do i=i+1 end
      local word=line:sub(s,i-1)
      tokens[#tokens+1]={text=word, color=(word=='true' or word=='false' or word=='null') and sc.constant or sc.text}
      break
    end

    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.text}; break
    end

    local jpunct={}; for c in ("{}[],:"):gmatch(".") do jpunct[c]=true end
    if jpunct[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end
    if ch==':' then tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1; break end

    tokens[#tokens+1]={text=ch, color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- CSS / SCSS
-- ============================================================================

local CSS_PROPS = {
  display=1,flex=1,width=1,height=1,margin=1,padding=1,color=1,background=1,
  ["background-color"]=1,["font-size"]=1,["font-family"]=1,["font-weight"]=1,
  border=1,["border-radius"]=1,position=1,top=1,left=1,right=1,bottom=1,
  ["z-index"]=1,overflow=1,opacity=1,transform=1,transition=1,animation=1,
  content=1,cursor=1,["text-align"]=1,["line-height"]=1,["letter-spacing"]=1,
  ["flex-direction"]=1,["flex-wrap"]=1,["justify-content"]=1,["align-items"]=1,
  ["align-self"]=1,["flex-grow"]=1,["flex-shrink"]=1,["flex-basis"]=1,
  gap=1,grid=1,["grid-template"]=1,["grid-column"]=1,["grid-row"]=1,
  ["box-shadow"]=1,["text-shadow"]=1,["max-width"]=1,["min-width"]=1,
  ["max-height"]=1,["min-height"]=1,visibility=1,pointer=1,
}
local CSS_VALUES = {
  auto=1,none=1,block=1,inline=1,flex=1,grid=1,absolute=1,relative=1,
  fixed=1,sticky=1,hidden=1,visible=1,scroll=1,center=1,left=1,right=1,
  top=1,bottom=1,normal=1,bold=1,italic=1,inherit=1,initial=1,unset=1,
  solid=1,dashed=1,dotted=1,["1px"]=1,transparent=1,currentColor=1,
  ["space-between"]=1,["space-around"]=1,["flex-start"]=1,["flex-end"]=1,
  stretch=1,wrap=1,nowrap=1,row=1,column=1,pointer=1,default=1,
}
local CSS_AT = {
  ["@media"]=1,["@keyframes"]=1,["@import"]=1,["@charset"]=1,
  ["@font-face"]=1,["@supports"]=1,["@mixin"]=1,["@include"]=1,
  ["@extend"]=1,["@use"]=1,["@forward"]=1,
}

local function tokenizeCSS(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Comment
    if ch=='/' and line:sub(i+1,i+1)=='*' then
      local e=line:find("%*/", i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.comment}; i=e+2
      else tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end
      break
    end
    if ch=='/' and line:sub(i+1,i+1)=='/' then
      tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
    end

    -- At-rules
    if ch=='@' then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z@-]") do i=i+1 end
      local word=line:sub(s,i-1)
      tokens[#tokens+1]={text=word, color=CSS_AT[word] and sc.keyword or sc.decorator}
      break
    end

    -- String
    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2, color=sc.string}; i=ni; break
    end

    -- Color hex
    if ch=='#' and line:sub(i+1,i+1):match("[0-9a-fA-F]") then
      local s=i; i=i+1
      while i<=len and line:sub(i,i):match("[0-9a-fA-F]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.number}; break
    end

    -- Variable --var
    if ch=='-' and line:sub(i+1,i+1)=='-' then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_%-]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.variable}; break
    end

    -- Numbers with units
    if ch:match("[0-9]") or (ch=='.' and line:sub(i+1,i+1):match("[0-9]")) then
      local s=i
      while i<=len and line:sub(i,i):match("[0-9.]") do i=i+1 end
      local num=line:sub(s,i-1)
      local unitStart=i
      while i<=len and line:sub(i,i):match("[a-zA-Z%%]") do i=i+1 end
      local unit=line:sub(unitStart,i-1)
      tokens[#tokens+1]={text=num, color=sc.number}
      if #unit>0 then tokens[#tokens+1]={text=unit, color=sc.unit} end
      break
    end

    -- Identifiers (property names, values, selectors)
    if ch:match("[a-zA-Z_]") or ch=='-' then
      local s=i
      if ch=='-' then i=i+1 end
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_%-]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local color
      if CSS_PROPS[word] and nextCh==':' then color=sc.attribute
      elseif CSS_VALUES[word] then color=sc.cssValue
      elseif nextCh=='(' then color=sc.funcCall
      else color=sc.selector end
      tokens[#tokens+1]={text=word, color=color}; break
    end

    -- Pseudo-class/element
    if ch==':' then
      if line:sub(i+1,i+1)==':' then
        tokens[#tokens+1]={text='::', color=sc.operator}; i=i+2
      else
        local j=i+1; local s2=j
        while j<=len and line:sub(j,j):match("[a-zA-Z0-9_-]") do j=j+1 end
        if j>s2 then
          tokens[#tokens+1]={text=':', color=sc.operator}; i=i+1
          tokens[#tokens+1]={text=line:sub(s2,j-1), color=sc.keyword}; i=j
        else
          tokens[#tokens+1]={text=':', color=sc.operator}; i=i+1
        end
      end
      break
    end

    -- Whitespace
    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.text}; break
    end

    local cpunct={}; for c in ("{}[];(),>+~"):gmatch(".") do cpunct[c]=true end
    if cpunct[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch, color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- HTML
-- ============================================================================

local HTML_VOID = {
  area=1,base=1,br=1,col=1,embed=1,hr=1,img=1,input=1,link=1,meta=1,
  param=1,source=1,track=1,wbr=1,
}

local function tokenizeHTML(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Comment <!-- -->
    if line:sub(i,i+3)=='<!--' then
      local e=line:find("-->", i+4, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+2),color=sc.comment}; i=e+3
      else tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end
      break
    end

    -- Doctype
    if line:sub(i,i+1)=='<!' then
      local e=line:find(">", i, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e),color=sc.keyword}; i=e+1
      else tokens[#tokens+1]={text=line:sub(i),color=sc.keyword}; break end
      break
    end

    -- Tags
    if ch=='<' then
      local isClose=line:sub(i+1,i+1)=='/'
      tokens[#tokens+1]={text=isClose and '</' or '<', color=sc.tag}
      i=i+(isClose and 2 or 1)
      -- Tag name
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_:-]") do i=i+1 end
      if i>s then
        local nm=line:sub(s,i-1)
        local isComp=nm:sub(1,1):match("%u")
        tokens[#tokens+1]={text=nm, color=isComp and sc.component or sc.tag}
      end
      -- Attributes
      while i<=len do
        local c2=line:sub(i,i)
        if c2=='>' then tokens[#tokens+1]={text='>',color=sc.tag}; i=i+1; break end
        if line:sub(i,i+1)='/>' then tokens[#tokens+1]={text='/>',color=sc.tag}; i=i+2; break end
        if c2:match("%s") then
          local s2=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
          tokens[#tokens+1]={text=line:sub(s2,i-1),color=sc.text}
        elseif c2:match("[a-zA-Z_:]") then
          local s2=i; while i<=len and line:sub(i,i):match("[a-zA-Z0-9_:.-]") do i=i+1 end
          local attr=line:sub(s2,i-1)
          tokens[#tokens+1]={text=attr,color=sc.attribute}
        elseif c2=='=' then
          tokens[#tokens+1]={text='=',color=sc.operator}; i=i+1
        elseif c2=='"' or c2=="'" then
          local s2,ni=consumeString(line,i,c2)
          tokens[#tokens+1]={text=s2,color=sc.string}; i=ni
        else
          tokens[#tokens+1]={text=c2,color=sc.text}; i=i+1
        end
      end
      break
    end

    -- Entity references &amp;
    if ch=='&' then
      local e=line:find(";", i, true)
      if e and e-i <= 10 then
        tokens[#tokens+1]={text=line:sub(i,e),color=sc.constant}; i=e+1
      else
        tokens[#tokens+1]={text='&',color=sc.text}; i=i+1
      end
      break
    end

    -- Text content
    local s=i
    while i<=len and line:sub(i,i)~='<' and line:sub(i,i)~='&' do i=i+1 end
    if i>s then tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text} end
  until true end
  return tokens
end

-- ============================================================================
-- Rust
-- ============================================================================

local RUST_KW = {
  as=1,async=1,await=1,break=1,const=1,continue=1,crate=1,dyn=1,["else"]=1,
  enum=1,extern=1,["false"]=1,fn=1,["for"]=1,["if"]=1,impl=1,["in"]=1,
  let=1,loop=1,match=1,mod=1,move=1,mut=1,pub=1,ref=1,["return"]=1,
  self=1,Self=1,static=1,struct=1,super=1,trait=1,["true"]=1,type=1,
  unsafe=1,use=1,where=1,while=1,
}
local RUST_PRIMITIVE = {
  i8=1,i16=1,i32=1,i64=1,i128=1,isize=1,u8=1,u16=1,u32=1,u64=1,u128=1,
  usize=1,f32=1,f64=1,bool=1,char=1,str=1,
}
local RUST_BUILTIN = {
  String=1,Vec=1,HashMap=1,HashSet=1,Option=1,Result=1,Box=1,Rc=1,Arc=1,
  Cell=1,RefCell=1,Mutex=1,RwLock=1,Cow=1,Path=1,PathBuf=1,Error=1,
  println=1,print=1,eprintln=1,eprint=1,format=1,write=1,writeln=1,
  todo=1,unimplemented=1,unreachable=1,panic=1,assert=1,dbg=1,
}

local function tokenizeRust(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Line comment // or doc ///
    if ch=='/' and line:sub(i+1,i+1)=='/' then
      local color=line:sub(i+2,i+2)=='/' and sc.property or sc.comment
      tokens[#tokens+1]={text=line:sub(i),color=color}; break
    end

    -- Block comment /* */
    if ch=='/' and line:sub(i+1,i+1)=='*' then
      local e=line:find("%*/", i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.comment}; i=e+2
      else tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end
      break
    end

    -- String r"..." or b"..."
    if (ch=='r' or ch=='b') and (line:sub(i+1,i+1)=='"' or line:sub(i+1,i+1)=="'") then
      local s2,ni=consumeString(line,i+1,line:sub(i+1,i+1))
      tokens[#tokens+1]={text=ch..s2,color=sc.string}; i=ni; break
    end

    -- Raw string r#"..."#
    if ch=='r' and line:sub(i+1,i+1)=='#' then
      local s=i; local e=line:find('"#', i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(s,e+1),color=sc.string}; i=e+2
      else tokens[#tokens+1]={text=line:sub(s),color=sc.string}; break end
      break
    end

    -- String
    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2, color=sc.string}; i=ni; break
    end

    -- Attribute #[...] or #![...]
    if ch=='#' then
      local s=i
      if line:sub(i+1,i+2)=='![' or line:sub(i+1,i+1)=='[' then
        local e=line:find("]", i, true)
        if e then tokens[#tokens+1]={text=line:sub(s,e),color=sc.decorator}; i=e+1
        else tokens[#tokens+1]={text=line:sub(s),color=sc.decorator}; break end
      else
        tokens[#tokens+1]={text='#',color=sc.punctuation}; i=i+1
      end
      break
    end

    -- Lifetime 'a
    if ch=="'" and line:sub(i+1,i+1):match("[a-z]") and
       not(line:sub(i+2,i+2)=="'") then
      local s=i; i=i+1
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1), color=sc.lifetime}; break
    end

    -- Numbers
    if ch:match("[0-9]") then
      local s=i
      if line:sub(i,i+1):lower()=='0x' then i=i+2; while i<=len and line:sub(i,i):match("[0-9a-fA-F_]") do i=i+1 end
      elseif line:sub(i,i+1):lower()=='0b' then i=i+2; while i<=len and line:sub(i,i):match("[01_]") do i=i+1 end
      elseif line:sub(i,i+1):lower()=='0o' then i=i+2; while i<=len and line:sub(i,i):match("[0-7_]") do i=i+1 end
      else
        while i<=len and line:sub(i,i):match("[0-9_.]") do i=i+1 end
        if i<=len and line:sub(i,i):lower()=='e' then
          i=i+1; if i<=len and (line:sub(i,i)=='+' or line:sub(i,i)=='-') then i=i+1 end
          while i<=len and line:sub(i,i):match("[0-9_]") do i=i+1 end
        end
        -- Type suffix (u32, i64, f32, etc.)
        if i<=len and line:sub(i,i):match("[uf]") then
          local ts=i; while i<=len and line:sub(i,i):match("[a-z0-9]") do i=i+1 end
          tokens[#tokens+1]={text=line:sub(s,ts-1),color=sc.number}
          tokens[#tokens+1]={text=line:sub(ts,i-1),color=sc.glslType}
          break
        end
      end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.number}; break
    end

    -- Identifiers
    if ch:match("[a-zA-Z_]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      -- Check macro: word!
      if i<=len and line:sub(i,i)=='!' then
        tokens[#tokens+1]={text=word..'!', color=sc.macro}; i=i+1; break
      end
      local color
      if word=='true' or word=='false' then color=sc.constant
      elseif RUST_KW[word] then color=sc.keyword
      elseif RUST_PRIMITIVE[word] then color=sc.glslType
      elseif RUST_BUILTIN[word] then color=sc.builtin
      elseif word:match("^[A-Z]") and nextCh~='(' then color=sc.typeName
      elseif nextCh=='(' then color=sc.funcCall
      elseif nextCh==':' and line:sub(peek+1,peek+1)==':' then color=sc.namespace_
      else color=sc.identifier end
      tokens[#tokens+1]={text=word, color=color}; break
    end

    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text}; break
    end

    local rustop={}; for c in ("=+-><!&|*/%^~@.?:"):gmatch(".") do rustop[c]=true end
    local rustpunct={}; for c in ("{}()[],;#"):gmatch(".") do rustpunct[c]=true end

    if ch=='.' then
      if line:sub(i,i+2)=='..=' then tokens[#tokens+1]={text='..=',color=sc.operator}; i=i+3
      elseif line:sub(i,i+1)=='..' then tokens[#tokens+1]={text='..',color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text='.',color=sc.operator}; i=i+1 end
      break
    end

    if rustop[ch] then
      local t3=line:sub(i,i+2); local t2=line:sub(i,i+1)
      local r3={["..="]=1,[">>="]=1,["<<="]=1}
      local r2={["->"]=1,["=>"]=1,["=="]=1,["!="]=1,[">="]=1,["<="]=1,
                ["&&"]=1,["||"]=1,["+="]=1,["-="]=1,["*="]=1,["/="]=1,
                ["|="]=1,["&="]=1,["^="]=1,["<<"]=1,[">>"]=1,["::"]=1}
      if r3[t3] then tokens[#tokens+1]={text=t3,color=sc.operator}; i=i+3
      elseif r2[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end
    if rustpunct[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch, color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- Go
-- ============================================================================

local GO_KW = {
  ["break"]=1,["case"]=1,["chan"]=1,["const"]=1,["continue"]=1,["default"]=1,
  ["defer"]=1,["else"]=1,["fallthrough"]=1,["for"]=1,["func"]=1,["go"]=1,
  ["goto"]=1,["if"]=1,["import"]=1,["interface"]=1,["map"]=1,["package"]=1,
  ["range"]=1,["return"]=1,["select"]=1,["struct"]=1,["switch"]=1,["type"]=1,
  ["var"]=1,
}
local GO_BUILTIN = {
  append=1,cap=1,close=1,complex=1,copy=1,delete=1,imag=1,len=1,make=1,
  new=1,panic=1,print=1,println=1,real=1,recover=1,
  string=1,int=1,int8=1,int16=1,int32=1,int64=1,uint=1,uint8=1,uint16=1,
  uint32=1,uint64=1,uintptr=1,byte=1,rune=1,float32=1,float64=1,
  complex64=1,complex128=1,bool=1,error=1,
}

local function tokenizeGo(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    if ch=='/' and line:sub(i+1,i+1)=='/' then
      tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
    end
    if ch=='/' and line:sub(i+1,i+1)=='*' then
      local e=line:find("%*/", i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.comment}; i=e+2
      else tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end
      break
    end

    -- Raw string backtick
    if ch=='`' then
      local j=i+1; while j<=len and line:sub(j,j)~='`' do j=j+1 end
      if j<=len then j=j+1 end
      tokens[#tokens+1]={text=line:sub(i,j-1),color=sc.string}; i=j; break
    end

    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2,color=sc.string}; i=ni; break
    end

    if ch:match("[0-9]") then
      local s=i
      if line:sub(i,i+1):lower()=='0x' then i=i+2; while i<=len and line:sub(i,i):match("[0-9a-fA-F_]") do i=i+1 end
      elseif line:sub(i,i+1):lower()=='0b' then i=i+2; while i<=len and line:sub(i,i):match("[01_]") do i=i+1 end
      else while i<=len and line:sub(i,i):match("[0-9_.]") do i=i+1 end end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.number}; break
    end

    if ch:match("[a-zA-Z_]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local color
      if word=='true' or word=='false' or word=='nil' or word=='iota' then color=sc.constant
      elseif GO_KW[word] then color=sc.keyword
      elseif GO_BUILTIN[word] then color=sc.builtin
      elseif word:match("^[A-Z]") then color=sc.typeName
      elseif nextCh=='(' then color=sc.funcCall
      else color=sc.identifier end
      tokens[#tokens+1]={text=word,color=color}; break
    end

    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text}; break
    end

    if ch=='.' then
      tokens[#tokens+1]={text='.',color=(line:sub(i+1,i+1):match("[a-zA-Z_]")) and sc.operator or sc.punctuation}
      i=i+1; break
    end

    local goop={}; for c in ("=+-><!&|*/%^~:"):gmatch(".") do goop[c]=true end
    local gopunct={}; for c in ("{}()[],;"):gmatch(".") do gopunct[c]=true end
    if goop[ch] then
      local t2=line:sub(i,i+1)
      local g2={[":="]=1,["=="]=1,["!="]=1,[">="]=1,["<="]=1,["&&"]=1,["||"]=1,
                ["+="]=1,["-="]=1,["*="]=1,["/="]=1,["%="]=1,"[<<]"=1,[">>"]="1",
                ["<-"]=1,["++"]=1,["--"]=1}
      if g2[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end
    if gopunct[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- C / C++
-- ============================================================================

local C_KW = {
  auto=1,break=1,case=1,char=1,const=1,continue=1,default=1,do=1,
  double=1,["else"]=1,enum=1,extern=1,float=1,["for"]=1,goto=1,["if"]=1,
  inline=1,int=1,long=1,register=1,restrict=1,["return"]=1,short=1,
  signed=1,sizeof=1,static=1,struct=1,switch=1,typedef=1,union=1,
  unsigned=1,void=1,volatile=1,while=1,
  -- C++
  alignas=1,alignof=1,["and"]=1,["and_eq"]=1,asm=1,bitand=1,bitor=1,
  bool=1,catch=1,class=1,compl=1,concept=1,consteval=1,constexpr=1,
  constinit=1,["co_await"]=1,["co_return"]=1,["co_yield"]=1,decltype=1,
  delete=1,dynamic_cast=1,explicit=1,export=1,["false"]=1,friend=1,
  mutable=1,namespace=1,new=1,noexcept=1,not=1,["not_eq"]=1,nullptr=1,
  operator=1,or=1,or_eq=1,private=1,protected=1,public=1,
  reinterpret_cast=1,requires=1,static_assert=1,static_cast=1,
  template=1,this=1,thread_local=1,throw=1,["true"]=1,try=1,typeid=1,
  typename=1,using=1,virtual=1,["xor"]=1,xor_eq=1,
}
local C_BUILTIN = {
  printf=1,scanf=1,malloc=1,free=1,calloc=1,realloc=1,memcpy=1,memset=1,
  memmove=1,strcmp=1,strcpy=1,strlen=1,strcat=1,sprintf=1,snprintf=1,
  atoi=1,atof=1,exit=1,abort=1,assert=1,fopen=1,fclose=1,fread=1,fwrite=1,
  fprintf=1,fscanf=1,getchar=1,putchar=1,puts=1,gets=1,
  std=1,cout=1,cin=1,endl=1,vector=1,string=1,map=1,set=1,
}

local function tokenizeC(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Preprocessor
    if ch=='#' then
      local s=i; while i<=len and not line:sub(i,i):match("\n") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.keyword}; break
    end

    if ch=='/' and line:sub(i+1,i+1)=='/' then
      tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
    end
    if ch=='/' and line:sub(i+1,i+1)=='*' then
      local e=line:find("%*/", i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.comment}; i=e+2
      else tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end
      break
    end

    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2,color=sc.string}; i=ni; break
    end

    if ch:match("[0-9]") then
      local s=i
      if line:sub(i,i+1):lower()=='0x' then i=i+2; while i<=len and line:sub(i,i):match("[0-9a-fA-F_]") do i=i+1 end
      else
        while i<=len and line:sub(i,i):match("[0-9_.]") do i=i+1 end
        if i<=len and line:sub(i,i):lower()=='e' then
          i=i+1; if i<=len and (line:sub(i,i)=='+' or line:sub(i,i)=='-') then i=i+1 end
          while i<=len and line:sub(i,i):match("[0-9]") do i=i+1 end
        end
        -- suffix: u, l, f, ul, ull, etc.
        while i<=len and line:sub(i,i):match("[uUlLfF]") do i=i+1 end
      end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.number}; break
    end

    if ch:match("[a-zA-Z_]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local afterDot=s>1 and (line:sub(s-1,s-1)=='.' or line:sub(s-1,s-1)=='>')
      local color
      if word=='true' or word=='false' or word=='NULL' or word=='nullptr' or word=='nil' then color=sc.constant
      elseif C_KW[word] then color=sc.keyword
      elseif C_BUILTIN[word] then color=sc.builtin
      elseif word:match("^[A-Z_][A-Z0-9_]+$") then color=sc.macro  -- ALL_CAPS macros
      elseif afterDot and nextCh=='(' then color=sc.funcCall
      elseif afterDot then color=sc.property
      elseif nextCh=='(' then color=sc.funcCall
      else color=sc.identifier end
      tokens[#tokens+1]={text=word,color=color}; break
    end

    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text}; break
    end

    if ch=='.' then
      if line:sub(i,i+2)=='...' then tokens[#tokens+1]={text='...',color=sc.operator}; i=i+3
      else tokens[#tokens+1]={text='.',color=sc.operator}; i=i+1 end
      break
    end

    if ch=='-' and line:sub(i+1,i+1)=='>' then
      tokens[#tokens+1]={text='->',color=sc.operator}; i=i+2; break
    end

    local cop={}; for c in ("=+-><!&|*/%^~"):gmatch(".") do cop[c]=true end
    local cpunct={}; for c in ("{}()[],;:"):gmatch(".") do cpunct[c]=true end
    if cop[ch] then
      local t3=line:sub(i,i+2); local t2=line:sub(i,i+1)
      local c3={[">>="]=1,["<<="]=1}
      local c2={["=="]=1,["!="]=1,[">="]=1,["<="]=1,["&&"]=1,["||"]=1,
                ["+="]=1,["-="]=1,["*="]=1,["/="]=1,["%="]=1,["&="]=1,
                ["|="]=1,["^="]=1,["++"]=1,["--"]=1,["<<"]=1,[">>"]=1,
                ["::"]=1}
      if c3[t3] then tokens[#tokens+1]={text=t3,color=sc.operator}; i=i+3
      elseif c2[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end
    if cpunct[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- Java / Kotlin (combined, good enough for both)
-- ============================================================================

local JAVA_KW = {
  abstract=1,assert=1,boolean=1,break=1,byte=1,case=1,catch=1,char=1,
  class=1,const=1,continue=1,default=1,do=1,double=1,["else"]=1,enum=1,
  extends=1,final=1,finally=1,float=1,["for"]=1,goto=1,["if"]=1,
  implements=1,import=1,instanceof=1,int=1,interface=1,long=1,native=1,
  new=1,package=1,private=1,protected=1,public=1,["return"]=1,short=1,
  static=1,strictfp=1,super=1,switch=1,synchronized=1,this=1,throw=1,
  throws=1,transient=1,try=1,var=1,void=1,volatile=1,while=1,
  -- Kotlin
  val=1,fun=1,["when"]=1,["is"]=1,["as"]=1,["in"]=1,["out"]=1,by=1,
  companion=1,object=1,data=1,sealed=1,inline=1,suspend=1,reified=1,
  crossinline=1,noinline=1,operator=1,infix=1,override=1,open=1,
  internal=1,lateinit=1,init=1,constructor=1,get=1,set=1,
}
local JAVA_CONST = {["true"]=1,["false"]=1,["null"]=1}
local JAVA_BUILTIN = {
  System=1,String=1,Integer=1,Long=1,Double=1,Float=1,Boolean=1,
  Object=1,Class=1,Math=1,StringBuilder=1,StringBuffer=1,
  ArrayList=1,HashMap=1,HashSet=1,LinkedList=1,Arrays=1,Collections=1,
  Optional=1,Stream=1,List=1,Map=1,Set=1,
}

local function tokenizeJava(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    if ch=='/' and line:sub(i+1,i+1)=='/' then
      tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
    end
    if ch=='/' and line:sub(i+1,i+1)=='*' then
      local e=line:find("%*/", i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.comment}; i=e+2
      else tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end
      break
    end

    -- Annotation @
    if ch=='@' then
      local s=i; i=i+1
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.decorator}; break
    end

    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2,color=sc.string}; i=ni; break
    end

    if ch:match("[0-9]") then
      local s=i
      while i<=len and line:sub(i,i):match("[0-9_.xXbBlLfFdD]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.number}; break
    end

    if ch:match("[a-zA-Z_$]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_$]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local afterDot=s>1 and line:sub(s-1,s-1)=='.'
      local color
      if JAVA_CONST[word] then color=sc.constant
      elseif JAVA_KW[word] then color=sc.keyword
      elseif JAVA_BUILTIN[word] then color=sc.builtin
      elseif word:match("^[A-Z]") and nextCh~='(' then color=sc.typeName
      elseif afterDot and nextCh=='(' then color=sc.funcCall
      elseif afterDot then color=sc.property
      elseif nextCh=='(' then color=sc.funcCall
      else color=sc.identifier end
      tokens[#tokens+1]={text=word,color=color}; break
    end

    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text}; break
    end

    if ch=='.' then
      tokens[#tokens+1]={text='.',color=sc.operator}; i=i+1; break
    end

    local jop={}; for c in ("=+-><!&|*/%^~?:"):gmatch(".") do jop[c]=true end
    local jpunct2={}; for c in ("{}()[],;"):gmatch(".") do jpunct2[c]=true end
    if jop[ch] then
      local t2=line:sub(i,i+1)
      local j2={["=="]=1,["!="]=1,[">="]=1,["<="]=1,["&&"]=1,["||"]=1,
                ["+="]=1,["-="]=1,["*="]=1,["/="]=1,["%="]=1,["->"]=1,
                ["++"]=1,["--"]=1,["<<"]=1,[">>"]=1,["??"]=1,["::"]=1}
      if j2[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end
    if jpunct2[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- SQL
-- ============================================================================

local SQL_KW = {
  SELECT=1,FROM=1,WHERE=1,JOIN=1,LEFT=1,RIGHT=1,INNER=1,OUTER=1,FULL=1,
  ON=1,AS=1,AND=1,OR=1,NOT=1,IN=1,EXISTS=1,BETWEEN=1,LIKE=1,ILIKE=1,
  IS=1,NULL=1,TRUE=1,FALSE=1,ORDER=1,BY=1,GROUP=1,HAVING=1,LIMIT=1,
  OFFSET=1,INSERT=1,INTO=1,VALUES=1,UPDATE=1,SET=1,DELETE=1,CREATE=1,
  DROP=1,ALTER=1,TABLE=1,INDEX=1,VIEW=1,DATABASE=1,SCHEMA=1,COLUMN=1,
  ADD=1,COLUMN=1,CONSTRAINT=1,PRIMARY=1,KEY=1,FOREIGN=1,UNIQUE=1,
  DEFAULT=1,CHECK=1,REFERENCES=1,CASCADE=1,RESTRICT=1,BEGIN=1,COMMIT=1,
  ROLLBACK=1,TRANSACTION=1,DISTINCT=1,ALL=1,UNION=1,INTERSECT=1,EXCEPT=1,
  WITH=1,RECURSIVE=1,CASE=1,WHEN=1,THEN=1,ELSE=1,END=1,COALESCE=1,
  NULLIF=1,CAST=1,CONVERT=1,EXTRACT=1,DATE=1,TIME=1,TIMESTAMP=1,
  -- lowercase variants
  select=1,from=1,where=1,join=1,left=1,right=1,inner=1,outer=1,
  on=1,["as"]=1,["and"]=1,["or"]=1,["not"]=1,["in"]=1,["is"]=1,
  ["null"]=1,["true"]=1,["false"]=1,order=1,by=1,group=1,having=1,
  limit=1,offset=1,insert=1,into=1,values=1,update=1,set=1,delete=1,
  create=1,drop=1,alter=1,table=1,index=1,view=1,distinct=1,
  case=1,when=1,then=1,["else"]=1,["end"]=1,with=1,
}
local SQL_FUNC = {
  COUNT=1,SUM=1,AVG=1,MAX=1,MIN=1,COALESCE=1,NULLIF=1,CAST=1,
  CONCAT=1,SUBSTRING=1,LENGTH=1,UPPER=1,LOWER=1,TRIM=1,REPLACE=1,
  NOW=1,CURRENT_DATE=1,CURRENT_TIME=1,CURRENT_TIMESTAMP=1,
  ROUND=1,FLOOR=1,CEIL=1,ABS=1,MOD=1,POWER=1,SQRT=1,
  count=1,sum=1,avg=1,max=1,min=1,coalesce=1,nullif=1,cast=1,
  concat=1,length=1,upper=1,lower=1,trim=1,replace=1,now=1,round=1,
}

local function tokenizeSQL(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Comment -- or #
    if ch=='-' and line:sub(i+1,i+1)=='-' then
      tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
    end
    if ch=='#' then
      tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
    end
    -- Block comment /* */
    if ch=='/' and line:sub(i+1,i+1)=='*' then
      local e=line:find("%*/", i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.comment}; i=e+2
      else tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end
      break
    end

    -- String
    if ch=="'" or ch=='"' or ch=='`' then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2,color=sc.string}; i=ni; break
    end

    -- Numbers
    if ch:match("[0-9]") then
      local s=i
      while i<=len and line:sub(i,i):match("[0-9_.]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.number}; break
    end

    -- Identifiers / keywords
    if ch:match("[a-zA-Z_]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local color
      if SQL_FUNC[word] and nextCh=='(' then color=sc.funcCall
      elseif SQL_KW[word] then color=sc.sqlKeyword
      else color=sc.identifier end
      tokens[#tokens+1]={text=word,color=color}; break
    end

    -- Quoted identifier
    if ch=='"' then
      local s2,ni=consumeString(line,i,'"')
      tokens[#tokens+1]={text=s2,color=sc.identifier}; i=ni; break
    end

    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text}; break
    end

    local sqlop={}; for c in ("=<>!|"):gmatch(".") do sqlop[c]=true end
    local sqlpunct={}; for c in ("()[],.;:*"):gmatch(".") do sqlpunct[c]=true end
    if sqlop[ch] then
      local t2=line:sub(i,i+1)
      local s2={["<>"]=1,["<="]=1,[">="]=1,["!="]=1,["||"]=1}
      if s2[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end
    if sqlpunct[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- GLSL / HLSL
-- ============================================================================

local GLSL_KW = {
  attribute=1,const=1,uniform=1,varying=1,["break"]=1,continue=1,["do"]=1,
  ["for"]=1,["while"]=1,["if"]=1,["else"]=1,["in"]=1,out=1,inout=1,
  float=1,int=1,uint=1,bool=1,lowp=1,mediump=1,highp=1,precision=1,
  sampler2D=1,samplerCube=1,sampler3D=1,["return"]=1,struct=1,void=1,
  layout=1,location=1,["in"]=1,
  -- HLSL
  cbuffer=1,tbuffer=1,SamplerState=1,Texture2D=1,RWTexture2D=1,
  register=1,packoffset=1,
}
local GLSL_TYPES = {
  vec2=1,vec3=1,vec4=1,ivec2=1,ivec3=1,ivec4=1,uvec2=1,uvec3=1,uvec4=1,
  bvec2=1,bvec3=1,bvec4=1,mat2=1,mat3=1,mat4=1,mat2x2=1,mat2x3=1,
  mat2x4=1,mat3x2=1,mat3x3=1,mat3x4=1,mat4x2=1,mat4x3=1,mat4x4=1,
  -- HLSL types
  float2=1,float3=1,float4=1,int2=1,int3=1,int4=1,uint2=1,uint3=1,uint4=1,
  half=1,half2=1,half3=1,half4=1,double=1,
}
local GLSL_BUILTIN = {
  gl_Position=1,gl_FragCoord=1,gl_FragColor=1,gl_Normal=1,gl_Vertex=1,
  gl_PointSize=1,gl_FrontFacing=1,gl_PointCoord=1,gl_InstanceID=1,
  gl_VertexID=1,gl_Layer=1,gl_ViewportIndex=1,
  radians=1,degrees=1,sin=1,cos=1,tan=1,asin=1,acos=1,atan=1,
  sinh=1,cosh=1,tanh=1,pow=1,exp=1,log=1,exp2=1,log2=1,sqrt=1,
  inversesqrt=1,abs=1,sign=1,floor=1,ceil=1,fract=1,mod=1,min=1,max=1,
  clamp=1,mix=1,step=1,smoothstep=1,length=1,distance=1,dot=1,cross=1,
  normalize=1,reflect=1,refract=1,faceforward=1,texture=1,texture2D=1,
  textureCube=1,textureSize=1,texelFetch=1,transpose=1,inverse=1,
  determinant=1,matrixCompMult=1,
}

local function tokenizeGLSL(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Preprocessor
    if ch=='#' then
      local s=i; while i<=len do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.keyword}; break
    end

    if ch=='/' and line:sub(i+1,i+1)=='/' then
      tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break
    end
    if ch=='/' and line:sub(i+1,i+1)=='*' then
      local e=line:find("%*/", i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.comment}; i=e+2
      else tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end
      break
    end

    if ch=='"' then
      local s2,ni=consumeString(line,i,'"')
      tokens[#tokens+1]={text=s2,color=sc.string}; i=ni; break
    end

    if ch:match("[0-9]") then
      local s=i
      while i<=len and line:sub(i,i):match("[0-9_.fF]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.number}; break
    end

    if ch:match("[a-zA-Z_]") then
      local s=i
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_]") do i=i+1 end
      local word=line:sub(s,i-1)
      local peek=skipWS(line,i)
      local nextCh=peek<=len and line:sub(peek,peek) or ""
      local color
      if GLSL_KW[word] then color=sc.keyword
      elseif GLSL_TYPES[word] then color=sc.glslType
      elseif GLSL_BUILTIN[word] then color=sc.builtin
      elseif word:match("^gl_") then color=sc.builtin
      elseif nextCh=='(' then color=sc.funcCall
      else color=sc.identifier end
      tokens[#tokens+1]={text=word,color=color}; break
    end

    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text}; break
    end

    if ch=='.' then
      tokens[#tokens+1]={text='.',color=sc.operator}; i=i+1; break
    end

    local gop={}; for c in ("=+-><!&|*/%^~"):gmatch(".") do gop[c]=true end
    local gpunct={}; for c in ("{}()[],;:"):gmatch(".") do gpunct[c]=true end
    if gop[ch] then
      local t2=line:sub(i,i+1)
      local g2={["=="]=1,["!="]=1,[">="]=1,["<="]=1,["&&"]=1,["||"]=1,
                ["+="]=1,["-="]=1,["*="]=1,["/="]=1,["++"]=1,["--"]=1}
      if g2[t2] then tokens[#tokens+1]={text=t2,color=sc.operator}; i=i+2
      else tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1 end
      break
    end
    if gpunct[ch] then tokens[#tokens+1]={text=ch,color=sc.punctuation}; i=i+1; break end

    tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- YAML
-- ============================================================================

local YAML_CONST = {["true"]=1,["false"]=1,["null"]=1,["yes"]=1,["no"]=1,["on"]=1,["off"]=1}

local function tokenizeYAML(line)
  local tokens = {}
  local i = 1
  local len = #line
  local sc = Syntax.colors

  -- Blank / whitespace only
  if line:match("^%s*$") then
    tokens[#tokens+1]={text=line,color=sc.text}; return tokens
  end

  -- Comment
  if line:match("^%s*#") then
    tokens[#tokens+1]={text=line,color=sc.comment}; return tokens
  end

  -- Directives --- and ...
  if line:match("^%-%-%-") or line:match("^%.%.%.") then
    tokens[#tokens+1]={text=line,color=sc.keyword}; return tokens
  end

  while i <= len do repeat
    local ch = line:sub(i,i)

    -- Inline comment
    if ch=='#' then tokens[#tokens+1]={text=line:sub(i),color=sc.comment}; break end

    -- Anchors & aliases
    if ch=='&' or ch=='*' then
      local s=i; i=i+1
      while i<=len and line:sub(i,i):match("[a-zA-Z0-9_-]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.variable}; break
    end

    -- Tags
    if ch=='!' then
      local s=i; i=i+1
      while i<=len and not line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.decorator}; break
    end

    -- Strings
    if ch=='"' or ch=="'" then
      local s2,ni=consumeString(line,i,ch)
      tokens[#tokens+1]={text=s2,color=sc.string}; i=ni; break
    end

    -- Block scalars | and >
    if (ch=='|' or ch=='>') and i==1 then
      tokens[#tokens+1]={text=line:sub(i),color=sc.string}; break
    end

    -- List item -
    if ch=='-' and line:sub(i+1,i+1):match("%s") then
      tokens[#tokens+1]={text='- ',color=sc.operator}; i=i+2; break
    end

    -- Numbers
    if ch:match("[0-9]") or (ch=='-' and line:sub(i+1,i+1):match("[0-9]")) then
      local s=i
      if ch=='-' then i=i+1 end
      while i<=len and line:sub(i,i):match("[0-9_.:+-]") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.number}; break
    end

    -- Keys (word followed by colon)
    if ch:match("[a-zA-Z_]") or ch=='.' then
      local s=i
      while i<=len and not line:sub(i,i):match("%s") and line:sub(i,i)~=':' do i=i+1 end
      local word=line:sub(s,i-1)
      -- peek past whitespace for colon
      local peek=i
      while peek<=len and line:sub(peek,peek):match("%s") do peek=peek+1 end
      local isKey=peek<=len and line:sub(peek,peek)==':'
      local color
      if YAML_CONST[word:lower()] then color=sc.constant
      elseif isKey then color=sc.yamlKey
      else color=sc.identifier end
      tokens[#tokens+1]={text=word,color=color}; break
    end

    if ch:match("%s") then
      local s=i; while i<=len and line:sub(i,i):match("%s") do i=i+1 end
      tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text}; break
    end

    local ypunct={}; for c in ("{}[],:|>"):gmatch(".") do ypunct[c]=true end
    if ypunct[ch] then tokens[#tokens+1]={text=ch,color=sc.operator}; i=i+1; break end

    tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1
  until true end
  return tokens
end

-- ============================================================================
-- Markdown (minimal: headers, bold, code, links)
-- ============================================================================

local function tokenizeMarkdown(line)
  local tokens = {}
  local sc = Syntax.colors

  -- Code fence
  if line:match("^```") then
    tokens[#tokens+1]={text=line,color=sc.string}; return tokens
  end
  -- Heading
  if line:match("^#+%s") then
    local hashes=line:match("^(#+)")
    local rest=line:sub(#hashes+1)
    tokens[#tokens+1]={text=hashes,color=sc.keyword}
    tokens[#tokens+1]={text=rest,color=sc.typeName}
    return tokens
  end
  -- Blockquote
  if line:match("^>") then
    tokens[#tokens+1]={text=line,color=sc.comment}; return tokens
  end
  -- HR
  if line:match("^[-*_][%s]*[-*_][%s]*[-*_]") then
    tokens[#tokens+1]={text=line,color=sc.punctuation}; return tokens
  end
  -- List
  if line:match("^%s*[-*+]%s") or line:match("^%s*%d+%.%s") then
    tokens[#tokens+1]={text=line:match("^%s*[-*+%d.]+%s?"),color=sc.operator}
    tokens[#tokens+1]={text=line:sub(#(line:match("^%s*[-*+%d.]+%s?") or "")+1),color=sc.text}
    return tokens
  end

  -- Inline: scan for **bold**, *italic*, `code`, [link](url)
  local i=1; local len=#line
  while i<=len do
    local ch=line:sub(i,i)
    if line:sub(i,i+1)=='**' then
      local e=line:find("%*%*", i+2, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e+1),color=sc.typeName}; i=e+2
      else tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1 end
    elseif ch=='*' or ch=='_' then
      local e=line:find(ch, i+1, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e),color=sc.identifier}; i=e+1
      else tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1 end
    elseif ch=='`' then
      local e=line:find('`', i+1, true)
      if e then tokens[#tokens+1]={text=line:sub(i,e),color=sc.string}; i=e+1
      else tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1 end
    elseif ch=='[' then
      local e=line:find("%]%b()", i, true)
      if e then
        local full=line:match("%b[]%b()", i)
        if full then tokens[#tokens+1]={text=full,color=sc.attribute}; i=i+#full
        else tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1 end
      else tokens[#tokens+1]={text=ch,color=sc.text}; i=i+1 end
    else
      local s=i
      while i<=len and line:sub(i,i)~='*' and line:sub(i,i)~='_' and
            line:sub(i,i)~='`' and line:sub(i,i)~='[' do i=i+1 end
      if i>s then tokens[#tokens+1]={text=line:sub(s,i-1),color=sc.text} end
    end
  end
  return tokens
end

-- ============================================================================
-- Plain text fallback
-- ============================================================================

local function tokenizePlain(line)
  return {{text=line, color=Syntax.colors.text}}
end

-- ============================================================================
-- Language dispatch
-- ============================================================================

local TOKENIZERS = {
  -- JavaScript / TypeScript
  js=tokenizeJS, javascript=tokenizeJS,
  ts=tokenizeJS, typescript=tokenizeJS,
  jsx=tokenizeJS, tsx=tokenizeJS,
  -- Python
  py=tokenizePython, python=tokenizePython,
  -- Lua
  lua=tokenizeLua,
  -- Shell
  sh=tokenizeBash, bash=tokenizeBash, shell=tokenizeBash, zsh=tokenizeBash,
  -- Data formats
  json=tokenizeJSON, jsonc=tokenizeJSON,
  yaml=tokenizeYAML, yml=tokenizeYAML,
  -- Web
  css=tokenizeCSS, scss=tokenizeCSS, less=tokenizeCSS, sass=tokenizeCSS,
  html=tokenizeHTML, xml=tokenizeHTML, svg=tokenizeHTML,
  -- Systems
  c=tokenizeC, cpp=tokenizeC, ["c++"]=tokenizeC, h=tokenizeC, hpp=tokenizeC,
  rust=tokenizeRust, rs=tokenizeRust,
  go=tokenizeGo, golang=tokenizeGo,
  -- JVM
  java=tokenizeJava, kotlin=tokenizeJava, kt=tokenizeJava,
  -- Query
  sql=tokenizeSQL,
  -- GPU
  glsl=tokenizeGLSL, hlsl=tokenizeGLSL, vert=tokenizeGLSL, frag=tokenizeGLSL,
  wgsl=tokenizeGLSL,
  -- Docs
  md=tokenizeMarkdown, markdown=tokenizeMarkdown,
  -- Plain
  text=tokenizePlain, txt=tokenizePlain, plain=tokenizePlain,
}

-- ============================================================================
-- Auto-detect language from content
-- ============================================================================

function Syntax.detectLanguage(lines)
  lines = lines or {}
  local sample = table.concat(lines, "\n", 1, math.min(10, #lines))

  -- Shebangs
  if lines[1] then
    if lines[1]:match("^#!/.*python") then return "python" end
    if lines[1]:match("^#!/.*node") then return "javascript" end
    if lines[1]:match("^#!/.*(bash|sh|zsh)") then return "bash" end
  end

  -- Strong signals
  if sample:match("<!DOCTYPE html") or sample:match("<html") then return "html" end
  if sample:match("^%s*{%s*\"") or sample:match("^%[") then return "json" end
  if sample:match("^%-%-%-") or sample:match("%n%w[%w_-]*:%s") then return "yaml" end
  if sample:match("#include") or sample:match("int main%(") then return "c" end
  if sample:match("fn %w+%(") or sample:match("let mut ") or sample:match("impl ") then return "rust" end
  if sample:match("^package ") or sample:match("func %w+%(") then return "go" end
  if sample:match("def %w+%(") or sample:match("^import ") or sample:match("^from ") then return "python" end
  if sample:match("local %w+ =") or sample:match("function%s*%(") or sample:match("%-%-") then return "lua" end
  if sample:match("SELECT%s") or sample:match("FROM%s") then return "sql" end
  if sample:match("uniform ") or sample:match("gl_Position") or sample:match("vec[234]") then return "glsl" end
  if sample:match("{$") or sample:match("%.[a-z%-]+%s*{") then return "css" end
  if sample:match("^##") or sample:match("%*%*%w") then return "markdown" end
  if sample:match("interface%s+%w") or sample:match("public class") then return "java" end
  if sample:match("<%?php") then return "php" end

  -- TSX/JSX signals
  if sample:match("<%u[%w]+") or sample:match("import React") then return "tsx" end
  if sample:match("=>") or sample:match("const%s+%w+%s*=") or sample:match("interface%s") then return "typescript" end
  if sample:match("function%s+%w") or sample:match("var%s+%w") then return "javascript" end

  return "text"
end

-- ============================================================================
-- Public API
-- ============================================================================

--- Tokenize a single line with the given language.
--- language: string like "python", "lua", "typescript", etc.
---   Pass nil or "auto" to fall back to the JS/TS tokenizer (legacy default).
function Syntax.tokenizeLine(line, language)
  if not language or language == "auto" then
    return tokenizeJS(line)
  end
  local fn = TOKENIZERS[language:lower()]
  if fn then return fn(line) end
  return tokenizePlain(line)
end

--- Return the tokenizer function for a language (nil if unknown).
function Syntax.getTokenizer(language)
  if not language then return nil end
  return TOKENIZERS[language:lower()]
end

return Syntax
