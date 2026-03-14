local __tsl = require("lua.tsl_stdlib")

-- chemistry/stoichiometry.tsl — Stoichiometry, gas laws, equilibrium
--
-- Compiles to Lua. All the unit conversion and thermodynamics math.
local _mod___elements = require("lua.generated.chemistry.elements")
local ELEMENTS = _mod___elements.ELEMENTS
local BY_SYMBOL = _mod___elements.BY_SYMBOL
local _mod___formulas = require("lua.generated.chemistry.formulas")
local parseFormula = _mod___formulas.parseFormula
local molarMass = _mod___formulas.molarMass
local AVOGADRO = 6.02214076e+23
local R_GAS = 8.314
local function gcd(a, b)
  a = math.abs(a)
  b = math.abs(b)
  while b ~= 0 do
    local t = b
    b = a % b
    a = t
  end
  return a
end
local function atomCount(formula)
  local atoms = parseFormula(formula)
  local n = 0
  for _, a in ipairs(atoms) do
    n = n + a.count
  end
  return n
end
local function massComposition(formula)
  local atoms = parseFormula(formula)
  local total = molarMass(formula)
  if total == 0 then
    return {}
  end
  local result = {}
  for _, a in ipairs(atoms) do
    local e = BY_SYMBOL[a.symbol]
    if e then
      result[a.symbol] = math.floor((e.mass * a.count / total) * 10000 + 0.5) / 100
    end
  end
  return result
end
local function empiricalFormula(formula)
  local atoms = parseFormula(formula)
  if #atoms == 0 then
    return ""
  end
  local d = atoms[1].count
  for i = 1 + 1, #atoms do
    d = gcd(d, atoms[i].count)
  end
  return table.concat(__tsl.map(atoms, function(a)
    local n = a.count / d
    return a.symbol .. ((n > 1 and tostring(math.floor(n)) or ""))
  end), "")
end
local function electronegativityDiff(symbol1, symbol2)
  local e1 = BY_SYMBOL[symbol1]
  local e2 = BY_SYMBOL[symbol2]
  if not e1 or not e2 or not e1.electronegativity or not e2.electronegativity then
    return nil
  end
  return math.abs(e1.electronegativity - e2.electronegativity)
end
local function bondCharacter(symbol1, symbol2)
  local e1 = BY_SYMBOL[symbol1]
  local e2 = BY_SYMBOL[symbol2]
  if not e1 or not e2 or not e1.electronegativity or not e2.electronegativity then
    return nil
  end
  local diff = math.abs(e1.electronegativity - e2.electronegativity)
  if diff < 0.5 then
    return "nonpolar-covalent"
  end
  if diff < 1.7 then
    return "polar-covalent"
  end
  return "ionic"
end
local OXIDATION = {
  H = {1, -1},
  He = {0},
  Li = {1},
  Be = {2},
  B = {3},
  C = {
  -4,
  -3,
  -2,
  -1,
  0,
  1,
  2,
  3,
  4,
},
  N = {
  -3,
  -2,
  -1,
  0,
  1,
  2,
  3,
  4,
  5,
},
  O = {-2, -1},
  F = {-1},
  Ne = {0},
  Na = {1},
  Mg = {2},
  Al = {3},
  Si = {-4, 4},
  P = {-3, 3, 5},
  S = {-2, 2, 4, 6},
  Cl = {-1, 1, 3, 5, 7},
  Ar = {0},
  K = {1},
  Ca = {2},
  Fe = {2, 3},
  Cu = {1, 2},
  Zn = {2},
  Ag = {1},
  Au = {1, 3},
  Pt = {2, 4},
  Mn = {2, 3, 4, 7},
  Cr = {2, 3, 6},
  Co = {2, 3},
  Ni = {2},
  Ti = {2, 3, 4},
  V = {2, 3, 4, 5},
  Sn = {2, 4},
  Pb = {2, 4},
  Hg = {1, 2},
  Br = {-1, 1, 3, 5},
  I = {-1, 1, 3, 5, 7},
}
local function oxidationStates(symbol)
  return OXIDATION[symbol] or {}
end
local function isotopeNotation(symbol, massNumber)
  local e = BY_SYMBOL[symbol]
  local sym = (e and e.symbol or symbol)
  return tostring(massNumber) .. sym
end
local function massToMoles(formula, mass)
  local mm = molarMass(formula)
  return (mm > 0 and mass / mm or 0)
end
local function molesToMass(formula, moles)
  return moles * molarMass(formula)
end
local function molesToParticles(moles)
  return moles * AVOGADRO
end
local function particlesToMoles(particles)
  return particles / AVOGADRO
end
local function massToParticles(formula, mass)
  local mm = molarMass(formula)
  local moles = (mm > 0 and mass / mm or 0)
  return moles * AVOGADRO
end
local function idealGasPressure(n, T, V)
  return n * R_GAS * T / V
end
local function idealGasVolume(n, T, P)
  return n * R_GAS * T / P
end
local function idealGasMoles(P, V, T)
  return P * V / (R_GAS * T)
end
local function molarity(moles, liters)
  return (liters > 0 and moles / liters or 0)
end
local function dilution(M1, V1, M2)
  return (M2 > 0 and M1 * V1 / M2 or 0)
end
local function equilibrium(args)
  local kEq = args.kEq or 1
  local shift = "none"
  local direction = "equilibrium"
  if args.changeTemp and args.deltaH then
    shift = (args.changeTemp > 0 and ((args.deltaH > 0 and "right" or "left")) or ((args.deltaH > 0 and "left" or "right")))
  end
  if args.changePressure then
    shift = (args.changePressure > 0 and "left" or "right")
  end
  if kEq > 1 then
    direction = "forward"
  elseif kEq < 1 then
    direction = "reverse"
  end
  return {
    kEq = kEq,
    direction = direction,
    shift = shift,
    temperature = (args.temperature or 298) + (args.changeTemp or 0),
    pressure = (args.pressure or 1) + (args.changePressure or 0),
  }
end

return {
  atomCount = atomCount,
  massComposition = massComposition,
  empiricalFormula = empiricalFormula,
  electronegativityDiff = electronegativityDiff,
  bondCharacter = bondCharacter,
  oxidationStates = oxidationStates,
  isotopeNotation = isotopeNotation,
  massToMoles = massToMoles,
  molesToMass = molesToMass,
  molesToParticles = molesToParticles,
  particlesToMoles = particlesToMoles,
  massToParticles = massToParticles,
  idealGasPressure = idealGasPressure,
  idealGasVolume = idealGasVolume,
  idealGasMoles = idealGasMoles,
  molarity = molarity,
  dilution = dilution,
  equilibrium = equilibrium,
}
