--[[
  lua/capabilities/data.lua — Spreadsheet formula evaluator + cell address utils

  All formula parsing, cell evaluation, and address math runs in LuaJIT.
  The QuickJS side just sends the cell map and gets back { values, errors }.

  RPC methods:
    data:evaluate  { cells: {[addr]: raw}, targets?: string[], maxRangeCells?: number }
                   → { values: {[addr]: scalar}, errors: {[addr]: string} }
    data:address   { method: 'label'|'index'|'parse'|'build'|'range'|'matrix', ...args }
                   → depends on method
]]

local M = {}

-- ============================================================================
-- Cell address utilities
-- ============================================================================

local function columnToLabel(index)
  local n = math.floor(index)
  local out = ''
  repeat
    out = string.char(65 + (n % 26)) .. out
    n = math.floor(n / 26) - 1
  until n < 0
  return out
end

local function labelToColumn(label)
  label = label:upper()
  local n = 0
  for i = 1, #label do
    n = n * 26 + (string.byte(label, i) - 64)
  end
  return n - 1  -- 0-based
end

local function parseCell(address)
  local norm = address:upper():gsub('%s', '')
  local col_str, row_str = norm:match('^([A-Z]+)([1-9][0-9]*)$')
  if not col_str then return nil end
  local row = tonumber(row_str) - 1  -- 0-based
  if row < 0 then return nil end
  return { col = labelToColumn(col_str), row = row }
end

local function buildAddress(col, row)
  return columnToLabel(col) .. tostring(row + 1)
end

local function expandRange(range_str, max_cells)
  max_cells = max_cells or 10000
  local norm = range_str:upper():gsub('%s', '')
  local a_str, b_str = norm:match('^([A-Z]+[1-9][0-9]*):([A-Z]+[1-9][0-9]*)$')
  if not a_str then return nil, 'Invalid range: ' .. range_str end
  local a = parseCell(a_str)
  local b = parseCell(b_str)
  if not a or not b then return nil, 'Invalid range: ' .. range_str end
  local c1 = math.min(a.col, b.col); local c2 = math.max(a.col, b.col)
  local r1 = math.min(a.row, b.row); local r2 = math.max(a.row, b.row)
  local count = (c2 - c1 + 1) * (r2 - r1 + 1)
  if count > max_cells then return nil, 'Range too large: ' .. count .. ' cells' end
  local out = {}
  for r = r1, r2 do
    for c = c1, c2 do out[#out + 1] = buildAddress(c, r) end
  end
  return out
end

local function buildMatrix(rows, cols)
  local out = {}
  for r = 0, rows - 1 do
    for c = 0, cols - 1 do out[#out + 1] = buildAddress(c, r) end
  end
  return out
end

-- ============================================================================
-- Tokenizer
-- ============================================================================

local TK = { NUM='NUM', STR='STR', BOOL='BOOL', IDENT='IDENT',
             OP='OP', LP='LP', RP='RP', COMMA='COMMA', COLON='COLON', EOF='EOF' }

local function tokenize(src)
  local tokens = {}
  local i = 1
  local n = #src

  while i <= n do
    local c = src:sub(i, i)

    -- Whitespace
    if c:match('%s') then i = i + 1

    -- String literal (double-quoted)
    elseif c == '"' then
      local j = i + 1
      local s = ''
      while j <= n do
        local ch = src:sub(j, j)
        if ch == '"' then break end
        if ch == '\\' and j + 1 <= n then s = s .. src:sub(j+1,j+1); j = j + 2
        else s = s .. ch; j = j + 1 end
      end
      tokens[#tokens+1] = { type=TK.STR, value=s }
      i = j + 1

    -- Number
    elseif c:match('%d') or (c == '.' and i+1 <= n and src:sub(i+1,i+1):match('%d')) then
      local j = i
      while j <= n and src:sub(j,j):match('[%d%.]') do j = j + 1 end
      if j <= n and src:sub(j,j):match('[eE]') then
        j = j + 1
        if j <= n and src:sub(j,j):match('[%+%-]') then j = j + 1 end
        while j <= n and src:sub(j,j):match('%d') do j = j + 1 end
      end
      tokens[#tokens+1] = { type=TK.NUM, value=tonumber(src:sub(i, j-1)) or 0 }
      i = j

    -- Identifier / bool / cell-ref
    elseif c:match('[A-Za-z_]') then
      local j = i
      while j <= n and src:sub(j,j):match('[A-Za-z0-9_]') do j = j + 1 end
      local word = src:sub(i, j-1)
      local up = word:upper()
      if up == 'TRUE'  then tokens[#tokens+1] = { type=TK.BOOL, value=true  }
      elseif up == 'FALSE' then tokens[#tokens+1] = { type=TK.BOOL, value=false }
      else tokens[#tokens+1] = { type=TK.IDENT, value=word } end
      i = j

    -- Two-char operators
    elseif c == '<' and i+1 <= n and src:sub(i+1,i+1) == '>' then tokens[#tokens+1]={type=TK.OP,value='<>'}; i=i+2
    elseif c == '<' and i+1 <= n and src:sub(i+1,i+1) == '=' then tokens[#tokens+1]={type=TK.OP,value='<='}; i=i+2
    elseif c == '>' and i+1 <= n and src:sub(i+1,i+1) == '=' then tokens[#tokens+1]={type=TK.OP,value='>='}; i=i+2

    -- Single-char
    elseif c == '(' then tokens[#tokens+1]={type=TK.LP};     i=i+1
    elseif c == ')' then tokens[#tokens+1]={type=TK.RP};     i=i+1
    elseif c == ',' then tokens[#tokens+1]={type=TK.COMMA};  i=i+1
    elseif c == ':' then tokens[#tokens+1]={type=TK.COLON};  i=i+1
    elseif c:match('[%+%-%*/%%^&=<>]') then tokens[#tokens+1]={type=TK.OP,value=c}; i=i+1
    else i=i+1  -- skip unknown
    end
  end

  tokens[#tokens+1] = { type=TK.EOF }
  return tokens
end

-- ============================================================================
-- Built-in functions
-- ============================================================================

local function toNum(v)
  if type(v) == 'number' then return (v == v and math.abs(v) ~= math.huge) and v or nil end
  if type(v) == 'boolean' then return v and 1 or 0 end
  if type(v) == 'string' then
    local t = v:match('^%s*(.-)%s*$')
    if #t == 0 then return nil end
    local n = tonumber(t)
    return n and (n == n) and n or nil
  end
  return nil
end

local function flatNums(args)
  local out = {}
  local function collect(v)
    if type(v) == 'table' then for _,vv in ipairs(v) do collect(vv) end
    else local n=toNum(v); if n then out[#out+1]=n end end
  end
  for _,v in ipairs(args) do collect(v) end
  return out
end

local function flatAll(args)
  local out = {}
  local function collect(v)
    if type(v) == 'table' then for _,vv in ipairs(v) do collect(vv) end
    else out[#out+1] = v end
  end
  for _,v in ipairs(args) do collect(v) end
  return out
end

local function toScalar(v)
  if v == nil then return '' end
  if type(v) == 'string' or type(v) == 'number' or type(v) == 'boolean' then return v end
  if type(v) == 'table' then
    if #v == 0 then return '' end
    if #v == 1 then return toScalar(v[1]) end
    local parts = {}
    for _,vv in ipairs(v) do parts[#parts+1] = tostring(toScalar(vv)) end
    return table.concat(parts, ', ')
  end
  return tostring(v)
end

local BUILTINS = {
  SUM     = function(...) local ns=flatNums({...}); local s=0; for _,n in ipairs(ns) do s=s+n end; return s end,
  AVG     = function(...) local ns=flatNums({...}); if #ns==0 then return 0 end; local s=0; for _,n in ipairs(ns) do s=s+n end; return s/#ns end,
  AVERAGE = function(...) local ns=flatNums({...}); if #ns==0 then return 0 end; local s=0; for _,n in ipairs(ns) do s=s+n end; return s/#ns end,
  MIN     = function(...) local ns=flatNums({...}); if #ns==0 then return 0 end; local m=ns[1]; for _,n in ipairs(ns) do if n<m then m=n end end; return m end,
  MAX     = function(...) local ns=flatNums({...}); if #ns==0 then return 0 end; local m=ns[1]; for _,n in ipairs(ns) do if n>m then m=n end end; return m end,
  COUNT   = function(...) return #flatNums({...}) end,
  COUNTA  = function(...)
    local count=0
    for _,v in ipairs(flatAll({...})) do if tostring(v or ''):match('^%s*$') == nil then count=count+1 end end
    return count
  end,
  IF      = function(cond, when_true, when_false) return cond and when_true or when_false end,
  AND     = function(...) for _,v in ipairs(flatAll({...})) do if not v then return false end end; return true end,
  OR      = function(...) for _,v in ipairs(flatAll({...})) do if v then return true end end; return false end,
  NOT     = function(v) return not v end,
  ROUND = function(v, digits)
    local n=toNum(v) or 0; local d=math.max(0,math.floor(toNum(digits) or 0)); local s=10^d
    return math.floor(n*s+0.5)/s
  end,
  ROUNDUP = function(v, digits)
    local n=toNum(v) or 0; local d=math.max(0,math.floor(toNum(digits) or 0)); local s=10^d
    return (n>=0 and math.ceil(n*s) or math.floor(n*s))/s
  end,
  ROUNDDOWN = function(v, digits)
    local n=toNum(v) or 0; local d=math.max(0,math.floor(toNum(digits) or 0)); local s=10^d
    return (n>=0 and math.floor(n*s) or math.ceil(n*s))/s
  end,
  ABS   = function(v) return math.abs(toNum(v) or 0) end,
  SQRT  = function(v) return math.sqrt(math.max(0, toNum(v) or 0)) end,
  POW   = function(v,p) return (toNum(v) or 0)^(toNum(p) or 0) end,
  LOG   = function(v, base)
    local n=math.max(1e-300, toNum(v) or 1); local b=math.max(1e-300, toNum(base) or math.exp(1))
    return math.log(n)/math.log(b)
  end,
  EXP     = function(v) return math.exp(toNum(v) or 0) end,
  CLAMP   = function(v,lo,hi) local n=toNum(v) or 0; return math.max(toNum(lo) or 0, math.min(toNum(hi) or 0, n)) end,
  LERP    = function(a,b,t) local ta,tb,tt=toNum(a) or 0,toNum(b) or 0,toNum(t) or 0; return ta+(tb-ta)*tt end,
  REMAP   = function(v,iMin,iMax,oMin,oMax)
    local vv,ia,ib,oa,ob=toNum(v) or 0,toNum(iMin) or 0,toNum(iMax) or 1,toNum(oMin) or 0,toNum(oMax) or 1
    local denom=ib-ia; if denom==0 then return oa end
    return oa+(ob-oa)*((vv-ia)/denom)
  end,
  SMOOTHSTEP = function(e0,e1,x)
    local a,b,xx=toNum(e0) or 0,toNum(e1) or 1,toNum(x) or 0
    local denom=b-a; if denom==0 then return 0 end
    local t=math.max(0,math.min(1,(xx-a)/denom)); return t*t*(3-2*t)
  end,
  DIST2D  = function(x1,y1,x2,y2)
    local dx=(toNum(x2) or 0)-(toNum(x1) or 0); local dy=(toNum(y2) or 0)-(toNum(y1) or 0)
    return math.sqrt(dx*dx+dy*dy)
  end,
  NORM2D  = function(x,y) local vx,vy=toNum(x) or 0,toNum(y) or 0; return math.sqrt(vx*vx+vy*vy) end,
  LEN     = function(v) return #tostring(v or '') end,
  UPPER   = function(v) return tostring(v or ''):upper() end,
  LOWER   = function(v) return tostring(v or ''):lower() end,
  TRIM    = function(v) return (tostring(v or ''):match('^%s*(.-)%s*$')) end,
  CONCAT  = function(...) local parts={}; for _,v in ipairs(flatAll({...})) do parts[#parts+1]=tostring(v or '') end; return table.concat(parts) end,
  TEXT    = function(v) return tostring(toScalar(v)) end,
  VALUE   = function(v) return toNum(v) or 0 end,
  MOD     = function(v,d) local n=toNum(v) or 0; local dd=toNum(d) or 1; return dd~=0 and n%dd or 0 end,
  INT     = function(v) return math.floor(toNum(v) or 0) end,
  SIGN    = function(v) local n=toNum(v) or 0; return n>0 and 1 or n<0 and -1 or 0 end,
  PI      = function() return math.pi end,
  E       = function() return math.exp(1) end,
  SIN     = function(v) return math.sin(toNum(v) or 0) end,
  COS     = function(v) return math.cos(toNum(v) or 0) end,
  TAN     = function(v) return math.tan(toNum(v) or 0) end,
  ATAN    = function(y,x) if x then return math.atan2(toNum(y) or 0, toNum(x) or 1) else return math.atan(toNum(y) or 0) end end,
  ATAN2   = function(y,x) return math.atan2(toNum(y) or 0, toNum(x) or 1) end,
}

-- ============================================================================
-- Recursive-descent parser / evaluator
-- ============================================================================

local function makeEval(cell_fn, range_fn)
  return function(tokens)
    local pos = 1
    local function peek()    return tokens[pos] end
    local function advance() local t=tokens[pos]; pos=pos+1; return t end

    local parseExpr  -- forward decl

    -- Parse a possibly-range argument inside a function call
    -- Returns the value (or range array)
    local function parseArg()
      -- Peek: is this an IDENT that looks like a cell addr, followed by ':'?
      if peek().type == TK.IDENT then
        local saved = pos
        local a_tok = advance()
        if peek().type == TK.COLON then
          advance()  -- eat ':'
          if peek().type == TK.IDENT then
            local b_tok = advance()
            local range_str = a_tok.value:upper() .. ':' .. b_tok.value:upper()
            -- rjit-ignore-next-line
            local addrs, err = range_fn(range_str)
            if err then error(err) end
            local vals = {}
            -- rjit-ignore-next-line
            for _, addr in ipairs(addrs) do vals[#vals+1] = cell_fn(addr) end
            return vals
          end
        end
        pos = saved  -- backtrack
      end
      return parseExpr()
    end

    -- primary: literal | ident/fn-call/cell-ref | unary | (expr)
    local function primary()
      local t = peek()

      if t.type == TK.NUM  then advance(); return t.value
      elseif t.type == TK.STR  then advance(); return t.value
      elseif t.type == TK.BOOL then advance(); return t.value

      elseif t.type == TK.OP and t.value == '-' then
        advance(); return -(primary())

      elseif t.type == TK.OP and t.value == '+' then
        advance(); return primary()

      elseif t.type == TK.LP then
        advance()
        local v = parseExpr()
        if peek().type == TK.RP then advance() end
        return v

      elseif t.type == TK.IDENT then
        local name = advance().value
        if peek().type == TK.LP then
          -- Function call
          advance()  -- eat '('
          local args = {}
          while peek().type ~= TK.RP and peek().type ~= TK.EOF do
            args[#args+1] = parseArg()
            if peek().type == TK.COMMA then advance() end
          end
          if peek().type == TK.RP then advance() end
          local fn = BUILTINS[name:upper()]
          if fn then return fn(table.unpack(args))
          else error('Unknown function: ' .. name) end
        else
          -- Cell reference
          local up = name:upper()
          -- rjit-ignore-next-line
          if up:match('^[A-Z]+[1-9][0-9]*$') then return cell_fn(up) end
          error('Unknown identifier: ' .. name)
        end

      else
        return 0
      end
    end

    -- power (right-associative)
    local function power()
      local left = primary()
      if peek().type == TK.OP and peek().value == '^' then
        advance(); return left ^ power()
      end
      return left
    end

    -- multiplicative
    local function multiplicative()
      local left = power()
      while peek().type == TK.OP do
        local op = peek().value
        if op ~= '*' and op ~= '/' and op ~= '%' then break end
        advance()
        local right = power()
        if op == '*' then left = left * right
        elseif op == '/' then left = right ~= 0 and left / right or 0
        elseif op == '%' then left = right ~= 0 and left % right or 0 end
      end
      return left
    end

    -- additive (+ - &)
    local function additive()
      local left = multiplicative()
      while peek().type == TK.OP do
        local op = peek().value
        if op ~= '+' and op ~= '-' and op ~= '&' then break end
        advance()
        local right = multiplicative()
        if op == '+' then
          if type(left) == 'string' or type(right) == 'string'
          then left = tostring(left) .. tostring(right)
          else left = (toNum(left) or 0) + (toNum(right) or 0) end
        elseif op == '-' then left = (toNum(left) or 0) - (toNum(right) or 0)
        elseif op == '&' then left = tostring(left) .. tostring(right) end
      end
      return left
    end

    -- comparison (= < > <= >= <>)
    local CMP_OPS = { ['<']=true,['>']=true,['<=']=true,['>=']=true,['=']=true,['<>']=true }
    local function comparison()
      local left = additive()
      while peek().type == TK.OP and CMP_OPS[peek().value] do
        local op = advance().value
        local right = additive()
        if op == '<'  then left = left < right
        elseif op == '>'  then left = left > right
        elseif op == '<=' then left = left <= right
        elseif op == '>=' then left = left >= right
        elseif op == '='  then left = left == right
        elseif op == '<>' then left = left ~= right end
      end
      return left
    end

    parseExpr = comparison
    return parseExpr()
  end
end

-- ============================================================================
-- Cell literal parser (for non-formula cells)
-- ============================================================================

local function parseLiteral(raw)
  raw = raw:match('^%s*(.-)%s*$')
  if #raw == 0 then return '' end
  if raw:sub(1,1) == "'" then return raw:sub(2) end
  if raw:sub(1,1) == '"' and raw:sub(-1) == '"' then return raw:sub(2,-2) end
  local low = raw:lower()
  if low == 'true' then return true end
  if low == 'false' then return false end
  local n = tonumber(raw)
  if n then return n end
  return raw
end

-- ============================================================================
-- Spreadsheet evaluator
-- ============================================================================

local function evaluateAll(cells, targets, max_range_cells)
  local values    = {}
  local errors    = {}
  local evaluating = {}

  local eval_cell  -- forward decl

  local function cell_fn(addr)
    addr = addr:upper():gsub('%s', '')
    return eval_cell(addr)
  end

  local function range_fn(range_str)
    return expandRange(range_str, max_range_cells)
  end

  local evaluate_expr = makeEval(cell_fn, range_fn)

  eval_cell = function(address)
    address = address:upper():gsub('%s', '')
    if values[address] ~= nil then return values[address] end
    if errors[address] then return '' end

    local raw = cells[address]
    if raw == nil then values[address] = ''; return '' end
    raw = tostring(raw):match('^%s*(.-)%s*$')

    if raw:sub(1,1) ~= '=' then
      local lit = parseLiteral(raw)
      values[address] = lit
      return lit
    end

    if evaluating[address] then
      errors[address]  = 'Circular reference at ' .. address
      values[address] = ''
      return ''
    end

    evaluating[address] = true
    local ok, result = pcall(function()
      local toks = tokenize(raw:sub(2))  -- strip leading '='
      return evaluate_expr(toks)
    end)
    evaluating[address] = nil

    if ok then
      local scalar = toScalar(result)
      values[address] = scalar
      return scalar
    else
      local msg = type(result) == 'string' and result or 'Error'
      errors[address]  = msg
      values[address] = ''
      return ''
    end
  end

  for _, addr in ipairs(targets) do
    eval_cell(addr:upper():gsub('%s', ''))
  end

  return { values = values, errors = errors }
end

-- ============================================================================
-- RPC handlers
-- ============================================================================

function M.getHandlers()
  return {
    ["data:evaluate"] = function(args)
      if not args or not args.cells then return { values = {}, errors = {} } end
      local max_cells = args.maxRangeCells or 10000
      local targets = args.targets
      if not targets or #targets == 0 then
        targets = {}
        for addr in pairs(args.cells) do targets[#targets+1] = addr end
      end
      return evaluateAll(args.cells, targets, max_cells)
    end,

    ["data:address"] = function(args)
      if not args or not args.method then return nil end
      local m = args.method
      if m == 'label'  then return columnToLabel(args.index or 0)
      elseif m == 'index'  then return labelToColumn(args.label or 'A')
      elseif m == 'parse'  then return parseCell(args.address or '')
      elseif m == 'build'  then return buildAddress(args.col or 0, args.row or 0)
      elseif m == 'range'  then
        local addrs, err = expandRange(args.range or '', args.maxCells or 10000)
        return err and { error = err } or addrs
      elseif m == 'matrix' then return buildMatrix(args.rows or 0, args.cols or 0)
      end
      return nil
    end,
  }
end

return M
