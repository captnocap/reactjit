-- chemistry/formulas.tsl — Formula parsing + molar mass
--
-- Compiles to Lua. Character-by-character formula parser.
local _mod___elements = require("lua.generated.chemistry.elements")
local BY_SYMBOL = _mod___elements.BY_SYMBOL
local function parseFormula(formula)
  local atoms = {}
  local seen = {}
  local i = 0
  local len = #formula
  while i < len do
    local c = string.sub(formula, i + 1, i + 1)
    if c >= "A" and c <= "Z" then
      local sym = c
      i = i + 1
      if i < len and string.sub(formula, i + 1, i + 1) >= "a" and string.sub(formula, i + 1, i + 1) <= "z" then
        sym = sym .. string.sub(formula, i + 1, i + 1)
        i = i + 1
      end
      local countStr = ""
      while i < len and string.sub(formula, i + 1, i + 1) >= "0" and string.sub(formula, i + 1, i + 1) <= "9" do
        countStr = countStr .. string.sub(formula, i + 1, i + 1)
        i = i + 1
      end
      local count = (countStr ~= "" and tonumber(countStr) or 1)
      if seen[sym] ~= nil then
        atoms[seen[sym]].count = atoms[seen[sym]].count + count
      else
        seen[sym] = #atoms
        table.insert(atoms, { symbol = sym, count = count })
      end
    else
      i = i + 1
    end
  end
  return atoms
end
local function molarMass(formula)
  local atoms = parseFormula(formula)
  local mass = 0
  for _, a in ipairs(atoms) do
    local e = BY_SYMBOL[a.symbol]
    if e then
      mass = mass + e.mass * a.count
    end
  end
  return math.floor(mass * 1000 + 0.5) / 1000
end

return {
  parseFormula = parseFormula,
  molarMass = molarMass,
}
