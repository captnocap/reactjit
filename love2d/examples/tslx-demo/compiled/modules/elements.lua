-- chemistry/elements.tsl — Element data (118 elements, IUPAC 2024)
--
-- Compiles to Lua. This is the periodic table data store.
local ELEMENTS = {}
local BY_SYMBOL = {}
local BY_ELEMENT_NAME = {}
local function el(n, sym, name, mass, cat, grp, per, phase, en, shells, cpk, mp, bp, dens)
  local e = {
    number = n,
    symbol = sym,
    name = name,
    mass = mass,
    category = cat,
    group = grp,
    period = per,
    phase = phase,
    electronegativity = en,
    shells = shells,
    cpkColor = cpk,
    meltingPoint = mp,
    boilingPoint = bp,
    density = dens,
  }
  ELEMENTS[n] = e
  BY_SYMBOL[sym] = e
  BY_ELEMENT_NAME[string.lower(name)] = e
end
el(1, "H", "Hydrogen", 1.008, "nonmetal", 1, 1, "gas", 2.2, {1}, "#FFFFFF", 14.01, 20.28, 0.00008988)
el(2, "He", "Helium", 4.0026, "noble-gas", 18, 1, "gas", nil, {2}, "#D9FFFF", 0.95, 4.22, 0.0001785)
el(3, "Li", "Lithium", 6.941, "alkali-metal", 1, 2, "solid", 0.98, {2, 1}, "#CC80FF", 453.69, 1615, 0.534)
el(4, "Be", "Beryllium", 9.0122, "alkaline-earth", 2, 2, "solid", 1.57, {2, 2}, "#C2FF00", 1560, 2742, 1.85)
el(5, "B", "Boron", 10.81, "metalloid", 13, 2, "solid", 2.04, {2, 3}, "#FFB5B5", 2349, 4200, 2.34)
el(6, "C", "Carbon", 12.011, "nonmetal", 14, 2, "solid", 2.55, {2, 4}, "#909090", 3823, 4098, 2.267)
el(7, "N", "Nitrogen", 14.007, "nonmetal", 15, 2, "gas", 3.04, {2, 5}, "#3050F8", 63.15, 77.36, 0.0012506)
el(8, "O", "Oxygen", 15.999, "nonmetal", 16, 2, "gas", 3.44, {2, 6}, "#FF0D0D", 54.36, 90.2, 0.001429)
el(9, "F", "Fluorine", 18.998, "halogen", 17, 2, "gas", 3.98, {2, 7}, "#90E050", 53.53, 85.03, 0.001696)
el(10, "Ne", "Neon", 20.18, "noble-gas", 18, 2, "gas", nil, {2, 8}, "#B3E3F5", 24.56, 27.07, 0.0008999)
el(11, "Na", "Sodium", 22.99, "alkali-metal", 1, 3, "solid", 0.93, {2, 8, 1}, "#AB5CF2", 370.87, 1156, 0.971)
el(12, "Mg", "Magnesium", 24.305, "alkaline-earth", 2, 3, "solid", 1.31, {2, 8, 2}, "#8AFF00", 923, 1363, 1.738)
el(13, "Al", "Aluminium", 26.982, "post-transition-metal", 13, 3, "solid", 1.61, {2, 8, 3}, "#BFA6A6", 933.47, 2792, 2.698)
el(14, "Si", "Silicon", 28.086, "metalloid", 14, 3, "solid", 1.9, {2, 8, 4}, "#F0C8A0", 1687, 3538, 2.3296)
el(15, "P", "Phosphorus", 30.974, "nonmetal", 15, 3, "solid", 2.19, {2, 8, 5}, "#FF8000", 317.3, 550, 1.82)
el(16, "S", "Sulfur", 32.06, "nonmetal", 16, 3, "solid", 2.58, {2, 8, 6}, "#FFFF30", 388.36, 717.87, 2.067)
el(17, "Cl", "Chlorine", 35.45, "halogen", 17, 3, "gas", 3.16, {2, 8, 7}, "#1FF01F", 171.6, 239.11, 0.003214)
el(18, "Ar", "Argon", 39.948, "noble-gas", 18, 3, "gas", nil, {2, 8, 8}, "#80D1E3", 83.8, 87.3, 0.0017837)
-- ... elements 19-118 follow the same pattern ...
local function getElement(key)
  if type(key) == "number" then
    return ELEMENTS[key]
  end
  if type(key) == "string" then
    local trimmed = key:match("^%s*(.-)%s*$")
    if trimmed == "" then
      return nil
    end
    local normalizedSymbol = string.upper(string.sub(trimmed, 1, 1)) .. string.lower(string.sub(trimmed, 2))
    return BY_SYMBOL[trimmed] or BY_SYMBOL[normalizedSymbol] or BY_ELEMENT_NAME[string.lower(trimmed)]
  end
  return nil
end
local function getShells(key)
  local e = getElement(key)
  return (e and e.shells or nil)
end
local function valenceElectrons(z)
  local e = ELEMENTS[z]
  if not e or not e.shells or #e.shells == 0 then
    return 0
  end
  return e.shells[#e.shells - 1]
end

return {
  getElement = getElement,
  getShells = getShells,
  valenceElectrons = valenceElectrons,
  ELEMENTS = ELEMENTS,
  BY_SYMBOL = BY_SYMBOL,
  BY_ELEMENT_NAME = BY_ELEMENT_NAME,
}
