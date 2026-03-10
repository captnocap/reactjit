-- chemistry/compounds.tsl — Common compounds library + name lookup
--
-- Compiles to Lua. Compound metadata, reverse name lookup.
local COMPOUNDS = {
  H2O = {
  name = "Water",
  iupac = "Dihydrogen monoxide",
  geometry = "bent",
  polarity = "polar",
},
  CO2 = {
  name = "Carbon Dioxide",
  iupac = "Carbon dioxide",
  geometry = "linear",
  polarity = "nonpolar",
},
  NaCl = { name = "Sodium Chloride", iupac = "Sodium chloride" },
  CH4 = {
  name = "Methane",
  iupac = "Methane",
  geometry = "tetrahedral",
  polarity = "nonpolar",
},
  NH3 = {
  name = "Ammonia",
  iupac = "Ammonia",
  geometry = "trigonal-pyramidal",
  polarity = "polar",
},
  HCl = {
  name = "Hydrochloric Acid",
  iupac = "Hydrogen chloride",
  geometry = "linear",
  polarity = "polar",
},
  H2SO4 = { name = "Sulfuric Acid", iupac = "Sulfuric acid", polarity = "polar" },
  HNO3 = { name = "Nitric Acid", iupac = "Nitric acid", polarity = "polar" },
  NaOH = { name = "Sodium Hydroxide", iupac = "Sodium hydroxide" },
  C6H12O6 = { name = "Glucose", iupac = "D-Glucose", polarity = "polar" },
  C2H5OH = { name = "Ethanol", iupac = "Ethanol", polarity = "polar" },
  C8H10N4O2 = {
  name = "Caffeine",
  iupac = "1,3,7-Trimethylxanthine",
},
  C9H8O4 = {
  name = "Aspirin",
  iupac = "Acetylsalicylic acid",
},
  C6H8O7 = { name = "Citric Acid", iupac = "Citric acid", polarity = "polar" },
  C2H4O2 = { name = "Acetic Acid", iupac = "Acetic acid", polarity = "polar" },
  H2O2 = { name = "Hydrogen Peroxide", iupac = "Hydrogen peroxide", polarity = "polar" },
  O3 = {
  name = "Ozone",
  iupac = "Ozone",
  geometry = "bent",
  polarity = "polar",
},
  C12H22O11 = { name = "Sucrose", iupac = "Sucrose", polarity = "polar" },
  CO = {
  name = "Carbon Monoxide",
  iupac = "Carbon monoxide",
  geometry = "linear",
  polarity = "polar",
},
  NO2 = {
  name = "Nitrogen Dioxide",
  iupac = "Nitrogen dioxide",
  geometry = "bent",
  polarity = "polar",
},
  SO2 = {
  name = "Sulfur Dioxide",
  iupac = "Sulfur dioxide",
  geometry = "bent",
  polarity = "polar",
},
  PCl5 = {
  name = "Phosphorus Pentachloride",
  iupac = "Phosphorus pentachloride",
  geometry = "trigonal-bipyramidal",
  polarity = "nonpolar",
},
  SF6 = {
  name = "Sulfur Hexafluoride",
  iupac = "Sulfur hexafluoride",
  geometry = "octahedral",
  polarity = "nonpolar",
},
  BF3 = {
  name = "Boron Trifluoride",
  iupac = "Boron trifluoride",
  geometry = "trigonal-planar",
  polarity = "nonpolar",
},
  CCl4 = {
  name = "Carbon Tetrachloride",
  iupac = "Tetrachloromethane",
  geometry = "tetrahedral",
  polarity = "nonpolar",
},
  N2 = { name = "Nitrogen", geometry = "linear", polarity = "nonpolar" },
  O2 = { name = "Oxygen", geometry = "linear", polarity = "nonpolar" },
  H2 = { name = "Hydrogen", geometry = "linear", polarity = "nonpolar" },
  Cl2 = { name = "Chlorine", geometry = "linear", polarity = "nonpolar" },
  Fe2O3 = { name = "Iron(III) Oxide", iupac = "Iron(III) oxide" },
  CaCO3 = { name = "Calcium Carbonate", iupac = "Calcium carbonate" },
  KMnO4 = {
  name = "Potassium Permanganate",
  iupac = "Potassium permanganate",
},
  C6H6 = { name = "Benzene", iupac = "Benzene", polarity = "nonpolar" },
  C3H8 = { name = "Propane", iupac = "Propane", polarity = "nonpolar" },
  C2H2 = {
  name = "Acetylene",
  iupac = "Ethyne",
  geometry = "linear",
  polarity = "nonpolar",
},
  C2H4 = { name = "Ethylene", iupac = "Ethene", polarity = "nonpolar" },
}
-- Name → formula reverse lookup
local BY_NAME = {}
for formula, _ in pairs(COMPOUNDS) do
  local info = COMPOUNDS[formula]
  if info.name then
    BY_NAME[string.lower(info.name)] = formula
  end
  if info.iupac then
    BY_NAME[string.lower(info.iupac)] = formula
  end
end

return {
  COMPOUNDS = COMPOUNDS,
  BY_NAME = BY_NAME,
}
