--[[
  latex_parser.lua -- Recursive descent LaTeX math parser

  Converts a LaTeX math string into an AST suitable for layout.
  Handles: fractions, roots, super/subscripts, Greek, operators,
  functions, accents, delimiters, matrices, spacing, text.

  Returns:
    Parser.parse(tex) -> AST node (or error node)
]]

local Parser = {}

-- ============================================================================
-- Symbol tables
-- ============================================================================

local GREEK_LOWER = {
  alpha = "\206\177", beta = "\206\178", gamma = "\206\179", delta = "\206\180",
  epsilon = "\206\181", zeta = "\206\182", eta = "\206\183", theta = "\206\184",
  iota = "\206\185", kappa = "\206\186", lambda = "\206\187", mu = "\206\188",
  nu = "\206\189", xi = "\206\190", pi = "\207\128", rho = "\207\129",
  sigma = "\207\131", tau = "\207\132", upsilon = "\207\133", phi = "\207\134",
  chi = "\207\135", psi = "\207\136", omega = "\207\137",
  varepsilon = "\206\181", vartheta = "\207\145", varpi = "\207\150",
  varrho = "\207\177", varsigma = "\207\130", varphi = "\207\149",
}

local GREEK_UPPER = {
  Gamma = "\206\147", Delta = "\206\148", Theta = "\206\152", Lambda = "\206\155",
  Xi = "\206\158", Pi = "\206\160", Sigma = "\206\163", Upsilon = "\206\165",
  Phi = "\206\166", Psi = "\206\168", Omega = "\206\169",
}

local SYMBOLS = {
  -- Relations
  neq = "\226\137\160", leq = "\226\137\164", geq = "\226\137\165",
  ll = "\226\137\170", gg = "\226\137\171",
  approx = "\226\137\136", equiv = "\226\137\161", propto = "\226\136\157",
  sim = "\226\136\188", simeq = "\226\137\131", cong = "\226\137\133",
  -- Arrows
  to = "\226\134\146", rightarrow = "\226\134\146", leftarrow = "\226\134\144",
  leftrightarrow = "\226\134\148",
  Rightarrow = "\226\135\146", Leftarrow = "\226\135\144",
  Leftrightarrow = "\226\135\148", iff = "\226\135\148",
  mapsto = "\226\134\166",
  -- Set theory
  ["in"] = "\226\136\136", notin = "\226\136\137",
  subset = "\226\138\130", supset = "\226\138\131",
  subseteq = "\226\138\134", supseteq = "\226\138\135",
  cup = "\226\136\170", cap = "\226\136\169",
  emptyset = "\226\136\133", varnothing = "\226\136\133",
  -- Logic
  forall = "\226\136\128", exists = "\226\136\131",
  neg = "\194\172", land = "\226\136\167", lor = "\226\136\168",
  -- Calculus / analysis
  infty = "\226\136\158", partial = "\226\136\130", nabla = "\226\136\135",
  -- Dots
  ldots = "\226\128\166", cdots = "\226\139\175", vdots = "\226\139\174", ddots = "\226\139\177",
  -- Misc
  pm = "\194\177", mp = "\226\136\147",
  times = "\195\151", div = "\195\183", cdot = "\194\183",
  star = "\226\139\134", circ = "\226\136\152",
  dagger = "\226\128\160", ddagger = "\226\128\161",
  ell = "\226\132\147",
  hbar = "\226\132\143",
  Re = "\226\132\156", Im = "\226\132\145",
  aleph = "\226\132\181",
  -- Delimiters
  langle = "\226\159\168", rangle = "\226\159\169",
  lceil = "\226\140\136", rceil = "\226\140\137",
  lfloor = "\226\140\138", rfloor = "\226\140\139",
  -- Other
  degree = "\194\176",
  prime = "\226\128\178",
}

local BIG_OPS = {
  sum = "\226\136\145", prod = "\226\136\143", coprod = "\226\136\144",
  int = "\226\136\171", iint = "\226\136\172", iiint = "\226\136\173", oint = "\226\136\174",
  bigcup = "\226\139\131", bigcap = "\226\139\130",
  bigoplus = "\226\168\129", bigotimes = "\226\168\130",
}

local FUNCTIONS = {
  "sin", "cos", "tan", "cot", "sec", "csc",
  "arcsin", "arccos", "arctan",
  "sinh", "cosh", "tanh", "coth",
  "log", "ln", "exp", "arg",
  "lim", "limsup", "liminf",
  "min", "max", "sup", "inf",
  "det", "dim", "ker", "deg", "gcd", "hom",
  "mod", "Pr",
}
local FUNC_SET = {}
for _, f in ipairs(FUNCTIONS) do FUNC_SET[f] = true end

local ACCENTS = {
  hat = "\204\130", bar = "\204\132", vec = "\226\131\151",
  dot = "\204\135", ddot = "\204\136", tilde = "\204\131",
  acute = "\204\129", grave = "\204\128", breve = "\204\134",
  check = "\204\140",
}

local SPACING = {
  [","] = "thin",    -- 3mu
  [":"] = "medium",  -- 4mu
  [";"] = "thick",   -- 5mu
  ["!"] = "neg",     -- -3mu
  quad = "quad",     -- 1em
  qquad = "qquad",  -- 2em
  [" "] = "thick",
}

-- ============================================================================
-- Tokenizer
-- ============================================================================

local function tokenize(tex)
  local tokens = {}
  local i = 1
  local len = #tex

  while i <= len do
    local ch = tex:sub(i, i)

    if ch == " " or ch == "\t" or ch == "\n" or ch == "\r" then
      -- Skip whitespace (LaTeX math mode ignores it)
      i = i + 1

    elseif ch == "\\" then
      -- Command or escaped character
      i = i + 1
      if i > len then
        tokens[#tokens + 1] = { type = "error", value = "trailing backslash" }
        break
      end
      local next = tex:sub(i, i)
      -- Escaped symbols: \{ \} \| \\ \  (backslash space)
      if next == "{" or next == "}" or next == "|" or next == "\\" or next == " " or next == "," or next == ";" or next == ":" or next == "!" then
        -- Check if it's a spacing command
        if SPACING[next] then
          tokens[#tokens + 1] = { type = "spacing", value = SPACING[next] }
        elseif next == "{" then
          tokens[#tokens + 1] = { type = "literal", value = "{" }
        elseif next == "}" then
          tokens[#tokens + 1] = { type = "literal", value = "}" }
        elseif next == "|" then
          tokens[#tokens + 1] = { type = "literal", value = "\226\136\165" } -- ∥
        elseif next == "\\" then
          tokens[#tokens + 1] = { type = "newline" }
        elseif next == " " then
          tokens[#tokens + 1] = { type = "spacing", value = "thick" }
        end
        i = i + 1
      else
        -- Read alphabetic command name
        local cmdStart = i
        while i <= len and tex:sub(i, i):match("[a-zA-Z]") do
          i = i + 1
        end
        local cmd = tex:sub(cmdStart, i - 1)
        if cmd == "" then
          tokens[#tokens + 1] = { type = "error", value = "empty command" }
        else
          tokens[#tokens + 1] = { type = "command", value = cmd }
        end
      end

    elseif ch == "{" then
      tokens[#tokens + 1] = { type = "lbrace" }
      i = i + 1
    elseif ch == "}" then
      tokens[#tokens + 1] = { type = "rbrace" }
      i = i + 1
    elseif ch == "^" then
      tokens[#tokens + 1] = { type = "caret" }
      i = i + 1
    elseif ch == "_" then
      tokens[#tokens + 1] = { type = "underscore" }
      i = i + 1
    elseif ch == "&" then
      tokens[#tokens + 1] = { type = "ampersand" }
      i = i + 1
    elseif ch == "[" then
      tokens[#tokens + 1] = { type = "lbracket" }
      i = i + 1
    elseif ch == "]" then
      tokens[#tokens + 1] = { type = "rbracket" }
      i = i + 1
    else
      -- Literal character (letters, digits, operators, parens, etc.)
      tokens[#tokens + 1] = { type = "literal", value = ch }
      i = i + 1
    end
  end

  return tokens
end

-- ============================================================================
-- Recursive descent parser
-- ============================================================================

local function makeParser(tokens)
  local pos = 1
  local P = {}

  function P.peek()
    return tokens[pos]
  end

  function P.advance()
    local tok = tokens[pos]
    pos = pos + 1
    return tok
  end

  function P.expect(ttype)
    local tok = P.peek()
    if not tok or tok.type ~= ttype then
      return nil
    end
    return P.advance()
  end

  -- Parse a brace-delimited group: { ... }
  function P.parseGroup()
    if not P.expect("lbrace") then
      -- Single token group (e.g. x^2 means x^{2})
      return P.parseAtom()
    end
    local children = {}
    while P.peek() and P.peek().type ~= "rbrace" do
      local node = P.parseExpr()
      if node then children[#children + 1] = node end
    end
    P.expect("rbrace") -- consume }
    if #children == 0 then
      return { type = "group", children = {} }
    elseif #children == 1 then
      return children[1]
    else
      return { type = "group", children = children }
    end
  end

  -- Parse an atom: literal, command, or group
  function P.parseAtom()
    local tok = P.peek()
    if not tok then return nil end

    if tok.type == "lbrace" then
      return P.parseGroup()
    end

    if tok.type == "literal" then
      P.advance()
      return { type = "literal", text = tok.value }
    end

    if tok.type == "spacing" then
      P.advance()
      return { type = "spacing", size = tok.value }
    end

    if tok.type == "newline" then
      P.advance()
      return { type = "newline" }
    end

    if tok.type == "command" then
      return P.parseCommand()
    end

    if tok.type == "lbracket" then
      P.advance()
      return { type = "literal", text = "[" }
    end

    if tok.type == "rbracket" then
      P.advance()
      return { type = "literal", text = "]" }
    end

    -- Unexpected token — skip
    P.advance()
    return nil
  end

  -- Parse a command: \name ...
  function P.parseCommand()
    local tok = P.advance() -- consume the command token
    local cmd = tok.value

    -- Greek letters
    if GREEK_LOWER[cmd] then
      return { type = "literal", text = GREEK_LOWER[cmd], italic = true }
    end
    if GREEK_UPPER[cmd] then
      return { type = "literal", text = GREEK_UPPER[cmd] }
    end

    -- Symbols
    if SYMBOLS[cmd] then
      return { type = "literal", text = SYMBOLS[cmd] }
    end

    -- Big operators
    if BIG_OPS[cmd] then
      return { type = "bigop", symbol = BIG_OPS[cmd], name = cmd }
    end

    -- Functions (sin, cos, log, lim, ...)
    if FUNC_SET[cmd] then
      return { type = "func", name = cmd }
    end

    -- Fractions
    if cmd == "frac" or cmd == "dfrac" or cmd == "tfrac" then
      local num = P.parseGroup()
      local den = P.parseGroup()
      return { type = "frac", num = num, den = den, display = (cmd == "dfrac") }
    end

    -- Roots
    if cmd == "sqrt" then
      local index = nil
      if P.peek() and P.peek().type == "lbracket" then
        P.advance() -- consume [
        local indexChildren = {}
        while P.peek() and P.peek().type ~= "rbracket" do
          local n = P.parseExpr()
          if n then indexChildren[#indexChildren + 1] = n end
        end
        P.expect("rbracket")
        if #indexChildren == 1 then
          index = indexChildren[1]
        elseif #indexChildren > 1 then
          index = { type = "group", children = indexChildren }
        end
      end
      local body = P.parseGroup()
      return { type = "sqrt", index = index, body = body }
    end

    -- Accents
    if ACCENTS[cmd] then
      local body = P.parseGroup()
      return { type = "accent", kind = cmd, body = body }
    end

    -- Overline / underline
    if cmd == "overline" or cmd == "underline" then
      local body = P.parseGroup()
      return { type = "accent", kind = cmd, body = body }
    end

    -- Text
    if cmd == "text" or cmd == "mathrm" or cmd == "textrm" or cmd == "textbf" or cmd == "mathbf" then
      local body = P.parseGroup()
      local bold = (cmd == "textbf" or cmd == "mathbf")
      return { type = "text", body = body, bold = bold }
    end

    -- Left/right delimiters
    if cmd == "left" then
      local delim = P.parseDelimiter()
      local children = {}
      while P.peek() do
        local next = P.peek()
        if next.type == "command" and next.value == "right" then break end
        local node = P.parseExpr()
        if node then children[#children + 1] = node end
      end
      local rightDelim = "."
      if P.peek() and P.peek().type == "command" and P.peek().value == "right" then
        P.advance()
        rightDelim = P.parseDelimiter()
      end
      local body
      if #children == 1 then
        body = children[1]
      else
        body = { type = "group", children = children }
      end
      return { type = "delimited", left = delim, right = rightDelim, body = body }
    end

    -- Begin/end environments (matrices)
    if cmd == "begin" then
      return P.parseEnvironment()
    end

    -- Spacing commands by name
    if SPACING[cmd] then
      return { type = "spacing", size = SPACING[cmd] }
    end

    -- Unknown command — render as text
    return { type = "literal", text = "\\" .. cmd }
  end

  function P.parseDelimiter()
    local tok = P.peek()
    if not tok then return "." end

    if tok.type == "literal" then
      P.advance()
      return tok.value
    end

    if tok.type == "command" then
      P.advance()
      if tok.value == "langle" then return "\226\159\168" end
      if tok.value == "rangle" then return "\226\159\169" end
      if tok.value == "lceil" then return "\226\140\136" end
      if tok.value == "rceil" then return "\226\140\137" end
      if tok.value == "lfloor" then return "\226\140\138" end
      if tok.value == "rfloor" then return "\226\140\139" end
      if SYMBOLS[tok.value] then return SYMBOLS[tok.value] end
      -- \{ and \} are tokenized as literal already, but handle backslash forms
      return tok.value
    end

    -- Period means invisible delimiter
    P.advance()
    return "."
  end

  function P.parseEnvironment()
    -- We just consumed \begin, now expect {envname}
    local envName = ""
    if P.expect("lbrace") then
      while P.peek() and P.peek().type ~= "rbrace" do
        local t = P.advance()
        envName = envName .. (t.value or "")
      end
      P.expect("rbrace")
    end

    -- Parse matrix-like environments
    if envName == "matrix" or envName == "pmatrix" or envName == "bmatrix"
       or envName == "vmatrix" or envName == "Bmatrix" or envName == "Vmatrix"
       or envName == "cases" then
      local rows = {}
      local currentRow = {}
      local currentCell = {}

      while P.peek() do
        local tok = P.peek()
        -- Check for \end
        if tok.type == "command" and tok.value == "end" then
          P.advance()
          -- consume {envname}
          if P.expect("lbrace") then
            while P.peek() and P.peek().type ~= "rbrace" do P.advance() end
            P.expect("rbrace")
          end
          break
        end

        -- Check for & (column separator)
        if tok.type == "ampersand" then
          P.advance()
          local cell = #currentCell == 1 and currentCell[1]
                    or { type = "group", children = currentCell }
          currentRow[#currentRow + 1] = cell
          currentCell = {}
        -- Check for \\ (row separator)
        elseif tok.type == "newline" or (tok.type == "command" and tok.value == "\\") then
          P.advance()
          local cell = #currentCell == 1 and currentCell[1]
                    or { type = "group", children = currentCell }
          currentRow[#currentRow + 1] = cell
          rows[#rows + 1] = currentRow
          currentRow = {}
          currentCell = {}
        else
          local node = P.parseExpr()
          if node then currentCell[#currentCell + 1] = node end
        end
      end

      -- Flush remaining
      if #currentCell > 0 or #currentRow > 0 then
        local cell = #currentCell == 1 and currentCell[1]
                  or { type = "group", children = currentCell }
        currentRow[#currentRow + 1] = cell
        rows[#rows + 1] = currentRow
      end

      local delims = {
        pmatrix = { "(", ")" },
        bmatrix = { "[", "]" },
        vmatrix = { "|", "|" },
        Bmatrix = { "{", "}" },
        Vmatrix = { "\226\136\165", "\226\136\165" },
        cases   = { "{", "." },
      }
      local d = delims[envName]

      local matNode = { type = "matrix", rows = rows }
      if d then
        return { type = "delimited", left = d[1], right = d[2], body = matNode }
      end
      return matNode
    end

    -- Unknown environment — skip to \end
    while P.peek() do
      local tok = P.peek()
      if tok.type == "command" and tok.value == "end" then
        P.advance()
        if P.expect("lbrace") then
          while P.peek() and P.peek().type ~= "rbrace" do P.advance() end
          P.expect("rbrace")
        end
        break
      end
      P.advance()
    end
    return { type = "literal", text = "[" .. envName .. "]" }
  end

  -- Parse an expression: atom with optional super/subscripts
  function P.parseExpr()
    local base = P.parseAtom()
    if not base then return nil end

    -- Check for super/subscript chains
    local sup, sub
    while P.peek() do
      local tok = P.peek()
      if tok.type == "caret" and not sup then
        P.advance()
        sup = P.parseGroup()
      elseif tok.type == "underscore" and not sub then
        P.advance()
        sub = P.parseGroup()
      else
        break
      end
    end

    if sup and sub then
      return { type = "supsub", base = base, sup = sup, sub = sub }
    elseif sup then
      return { type = "super", base = base, script = sup }
    elseif sub then
      return { type = "sub", base = base, script = sub }
    end

    return base
  end

  -- Parse the full expression (sequence of exprs)
  function P.parseAll()
    local children = {}
    while P.peek() and P.peek().type ~= "rbrace" do
      local node = P.parseExpr()
      if node then
        children[#children + 1] = node
      else
        break
      end
    end
    if #children == 0 then
      return { type = "group", children = {} }
    elseif #children == 1 then
      return children[1]
    else
      return { type = "group", children = children }
    end
  end

  return P
end

-- ============================================================================
-- Public API
-- ============================================================================

function Parser.parse(tex)
  if not tex or tex == "" then
    return { type = "group", children = {} }
  end
  local ok, tokens = pcall(tokenize, tex)
  if not ok then
    return { type = "literal", text = "Parse error" }
  end
  local parser = makeParser(tokens)
  local ok2, ast = pcall(parser.parseAll)
  if not ok2 then
    return { type = "literal", text = "Parse error" }
  end
  return ast
end

return Parser
