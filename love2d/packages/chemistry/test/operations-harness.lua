local chemistry = require("lua.capabilities.chemistry")
local handlers = chemistry.getHandlers()

local EPSILON = 1e-6
local failures = 0
local total = 0

local balance = handlers["chemistry:balance"]
local element = handlers["chemistry:element"]
local elements = handlers["chemistry:elements"]
local molecule = handlers["chemistry:molecule"]
local formula = handlers["chemistry:formula"]
local molarMass = handlers["chemistry:molarmass"]
local compute = handlers["chemistry:compute"]
local reagentTest = handlers["chemistry:reagentTest"]
local reagentTestMulti = handlers["chemistry:reagentTestMulti"]
local reagentInfo = handlers["chemistry:reagentInfo"]
local identifyIR = handlers["chemistry:identifyIR"]
local irAbsorptions = handlers["chemistry:irAbsorptions"]
local wavelengthToColor = handlers["chemistry:wavelengthToColor"]
local absorptionColor = handlers["chemistry:absorptionColor"]
local availableCompounds = handlers["chemistry:availableCompounds"]
local compounds = handlers["chemistry:compounds"]

local function fail(message)
  error(message, 2)
end

local function assertTrue(condition, message)
  if not condition then
    fail(message)
  end
end

local function assertEqual(actual, expected, message)
  if actual ~= expected then
    fail(string.format("%s (expected %s, got %s)", message, tostring(expected), tostring(actual)))
  end
end

local function assertAlmostEqual(actual, expected, epsilon, message)
  epsilon = epsilon or EPSILON
  if math.abs(actual - expected) > epsilon then
    fail(string.format("%s (expected %.6f, got %.6f)", message, expected, actual))
  end
end

local function assertContains(list, expected, message)
  for _, item in ipairs(list) do
    if item == expected then
      return
    end
  end
  fail(message .. " (missing " .. tostring(expected) .. ")")
end

local function assertHasAbsorption(matches, expectedGroup, expectedBond, message)
  for _, match in ipairs(matches) do
    if match.group == expectedGroup and match.bond == expectedBond then
      return
    end
  end
  fail(message .. string.format(" (missing %s %s)", expectedGroup, expectedBond))
end

local function assertContainsCompoundNamed(list, expectedName, message)
  for _, item in ipairs(list) do
    if item.name == expectedName then
      return
    end
  end
  fail(message .. " (missing " .. tostring(expectedName) .. ")")
end

local function test(name, fn)
  total = total + 1
  local ok, err = pcall(fn)
  if ok then
    io.write("ok - " .. name .. "\n")
    return
  end

  failures = failures + 1
  io.write("not ok - " .. name .. "\n")
  io.write("  " .. tostring(err) .. "\n")
end

test("chemistry formula parsing preserves atomic counts for benchmark compounds", function()
  local water = formula({ formula = "H2O" })
  local glucose = formula({ formula = "C6H12O6" })
  local salt = formula({ formula = "NaCl" })

  assertEqual(#water, 2, "water atom kinds")
  assertEqual(water[1].symbol, "H", "water hydrogen symbol")
  assertEqual(water[1].count, 2, "water hydrogen count")
  assertEqual(water[2].symbol, "O", "water oxygen symbol")
  assertEqual(water[2].count, 1, "water oxygen count")

  assertEqual(glucose[1].symbol, "C", "glucose carbon symbol")
  assertEqual(glucose[1].count, 6, "glucose carbon count")
  assertEqual(glucose[2].symbol, "H", "glucose hydrogen symbol")
  assertEqual(glucose[2].count, 12, "glucose hydrogen count")
  assertEqual(glucose[3].symbol, "O", "glucose oxygen symbol")
  assertEqual(glucose[3].count, 6, "glucose oxygen count")

  assertEqual(salt[1].symbol, "Na", "salt sodium symbol")
  assertEqual(salt[1].count, 1, "salt sodium count")
  assertEqual(salt[2].symbol, "Cl", "salt chlorine symbol")
  assertEqual(salt[2].count, 1, "salt chlorine count")
end)

test("chemistry element handlers preserve lookup and filtering semantics", function()
  local oxygenByNumber = element({ key = 8 })
  local oxygenBySymbol = element({ key = "O" })
  local oxygenByName = element({ key = "oxygen" })
  local nobleGases = elements({ category = "noble-gas" })
  local gasesMatchingNe = elements({ phase = "gas", search = "ne" })

  assertEqual(oxygenByNumber.name, "Oxygen", "oxygen lookup by number")
  assertEqual(oxygenBySymbol.number, 8, "oxygen lookup by symbol")
  assertEqual(oxygenByName.symbol, "O", "oxygen lookup by name")
  assertEqual(#nobleGases, 7, "noble gas count")
  assertContains({ nobleGases[1].symbol, nobleGases[2].symbol, nobleGases[3].symbol, nobleGases[4].symbol, nobleGases[5].symbol, nobleGases[6].symbol, nobleGases[7].symbol }, "Ne", "noble gas list should include neon")
  assertContains({ gasesMatchingNe[1].symbol, gasesMatchingNe[2].symbol, gasesMatchingNe[3].symbol }, "Ne", "gas search should include neon")
end)

test("chemistry molar mass and composition match accepted reference values", function()
  assertAlmostEqual(molarMass({ formula = "H2O" }), 18.015, EPSILON, "water molar mass")
  assertAlmostEqual(molarMass({ formula = "CO2" }), 44.009, EPSILON, "carbon dioxide molar mass")
  assertAlmostEqual(molarMass({ formula = "C6H12O6" }), 180.156, EPSILON, "glucose molar mass")

  local waterComposition = compute({ method = "massComposition", formula = "H2O" })
  assertAlmostEqual(waterComposition.H, 11.19, 0.01, "water hydrogen mass percent")
  assertAlmostEqual(waterComposition.O, 88.81, 0.01, "water oxygen mass percent")

  local carbonDioxideComposition = compute({ method = "massComposition", formula = "CO2" })
  assertAlmostEqual(carbonDioxideComposition.C, 27.29, 0.01, "CO2 carbon mass percent")
  assertAlmostEqual(carbonDioxideComposition.O, 72.71, 0.01, "CO2 oxygen mass percent")
end)

test("chemistry molecule lookup resolves real-world geometry, polarity, and naming", function()
  local water = molecule({ formula = "H2O" })
  local carbonDioxide = molecule({ formula = "Carbon Dioxide" })
  local aspirin = molecule({ formula = "Aspirin" })

  assertEqual(water.name, "Water", "water common name")
  assertEqual(water.iupac, "Dihydrogen monoxide", "water iupac")
  assertEqual(water.geometry, "bent", "water geometry")
  assertEqual(water.polarity, "polar", "water polarity")

  assertEqual(carbonDioxide.formula, "CO2", "carbon dioxide formula")
  assertEqual(carbonDioxide.geometry, "linear", "carbon dioxide geometry")
  assertEqual(carbonDioxide.polarity, "nonpolar", "carbon dioxide polarity")

  assertEqual(aspirin.formula, "C9H8O4", "aspirin reverse lookup")
  assertEqual(aspirin.name, "Aspirin", "aspirin common name")
  assertEqual(aspirin.iupac, "Acetylsalicylic acid", "aspirin iupac")
end)

test("chemistry balancing returns canonical coefficients and reaction metadata", function()
  local waterFormation = balance({ equation = "H2 + O2 -> H2O" })
  local methaneCombustion = balance({ equation = "CH4 + O2 => CO2 + H2O" })
  local ammoniaSynthesis = balance({ equation = "N2 + H2 -> NH3" })
  local limestoneDecomposition = balance({ equation = "CaCO3 -> CaO + CO2" })

  assertEqual(waterFormation.balanced, "2H2 + O2 -> 2H2O", "water formation balance")
  assertTrue(waterFormation.isBalanced, "water formation should balance")
  assertEqual(waterFormation.type, "synthesis", "water formation type")
  assertAlmostEqual(waterFormation.enthalpy, -571.6, EPSILON, "water formation enthalpy")

  assertEqual(methaneCombustion.balanced, "CH4 + 2O2 -> CO2 + 2H2O", "methane combustion balance")
  assertEqual(methaneCombustion.type, "combustion", "methane combustion type")
  assertAlmostEqual(methaneCombustion.enthalpy, -890.4, EPSILON, "methane combustion enthalpy")

  assertEqual(ammoniaSynthesis.balanced, "N2 + 3H2 -> 2NH3", "ammonia synthesis balance")
  assertEqual(ammoniaSynthesis.type, "synthesis", "ammonia synthesis type")

  assertEqual(limestoneDecomposition.balanced, "CaCO3 -> CaO + CO2", "limestone decomposition balance")
  assertEqual(limestoneDecomposition.type, "decomposition", "limestone decomposition type")
  assertAlmostEqual(limestoneDecomposition.enthalpy, 178.1, EPSILON, "limestone decomposition enthalpy")
end)

test("chemistry compute helpers preserve stoichiometric and bonding baselines", function()
  assertEqual(compute({ method = "empiricalFormula", formula = "C6H12O6" }), "CH2O", "glucose empirical formula")
  assertEqual(compute({ method = "empiricalFormula", formula = "H2O2" }), "HO", "hydrogen peroxide empirical formula")

  assertEqual(compute({ method = "valenceElectrons", key = "O" }), 6, "oxygen valence electrons")
  assertAlmostEqual(compute({ method = "electronegativityDiff", symbol1 = "O", symbol2 = "H" }), 1.24, EPSILON, "O-H electronegativity difference")
  assertEqual(compute({ method = "bondCharacter", symbol1 = "H", symbol2 = "H" }), "nonpolar-covalent", "H-H bond character")
  assertEqual(compute({ method = "bondCharacter", symbol1 = "O", symbol2 = "H" }), "polar-covalent", "O-H bond character")
  assertEqual(compute({ method = "bondCharacter", symbol1 = "Na", symbol2 = "Cl" }), "ionic", "Na-Cl bond character")
end)

test("chemistry compute helpers preserve mole, particle, and gas-law conversions", function()
  assertAlmostEqual(compute({ method = "massToMoles", formula = "H2O", mass = 36.03 }), 2.0, 1e-3, "water mass to moles")
  assertAlmostEqual(compute({ method = "molesToMass", formula = "CO2", moles = 2 }), 88.018, 1e-3, "CO2 moles to mass")
  assertAlmostEqual(compute({ method = "molesToParticles", moles = 1 }), 6.02214076e23, 1e8, "Avogadro conversion")
  assertAlmostEqual(compute({ method = "particlesToMoles", particles = 3.01107038e23 }), 0.5, 1e-9, "particles to moles")
  assertAlmostEqual(compute({ method = "idealGasVolume", n = 1, T = 273.15, P = 101.325 }), 22.414, 0.01, "ideal gas molar volume at STP")
  assertAlmostEqual(compute({ method = "molarity", moles = 0.5, liters = 0.25 }), 2.0, EPSILON, "molarity")
  assertAlmostEqual(compute({ method = "dilution", M1 = 2.0, V1 = 0.5, M2 = 0.5 }), 2.0, EPSILON, "dilution volume")
end)

test("chemistry reagent tests reflect known presumptive outcomes", function()
  local simonsMdma = reagentTest({ type = "simons", compound = "MDMA" })
  local simonsMda = reagentTest({ type = "simons", compound = "MDA" })
  local ehrlichLsd = reagentTest({ type = "ehrlich", compound = "LSD" })
  local ehrlichMdma = reagentTest({ type = "ehrlich", compound = "MDMA" })

  assertEqual(simonsMdma.reaction.color, "#00008B", "Simon's MDMA color")
  assertEqual(simonsMdma.functionalGroup, "secondary amine", "Simon's MDMA functional group")
  assertAlmostEqual(simonsMdma.confidence, 0.65, EPSILON, "Simon's MDMA confidence")

  assertEqual(simonsMda.reaction.color, "#f5f5dc", "Simon's MDA color")
  assertAlmostEqual(simonsMda.confidence, 0.0, EPSILON, "Simon's MDA confidence")

  assertEqual(ehrlichLsd.reaction.color, "#800080", "Ehrlich LSD color")
  assertEqual(ehrlichLsd.functionalGroup, "indole", "Ehrlich LSD functional group")
  assertEqual(ehrlichMdma.reaction.color, "#f5f5dc", "Ehrlich MDMA no reaction")
end)

test("chemistry reagent metadata stays aligned with the in-house spot-test catalog", function()
  local allInfo = reagentInfo({})
  local simons = reagentInfo({ type = "simons" })

  assertEqual(simons.name, "Simon's", "Simon's reagent name")
  assertEqual(simons.formula, "NaHCO3 + Na2[Fe(CN)5NO] + CH3CHO", "Simon's reagent formula")
  assertEqual(simons.color, "#4682B4", "Simon's reagent swatch")
  assertEqual(allInfo.marquis.formula, "H2SO4 + HCHO", "Marquis formula")
  assertEqual(allInfo.ehrlich.formula, "DMAB + HCl", "Ehrlich formula")
end)

test("chemistry multi-reagent correlation increases identification confidence", function()
  local result = reagentTestMulti({
    reagents = { "marquis", "mecke", "simons" },
    compound = "MDMA",
  })

  assertEqual(result.identification, "MDMA", "multi test identification")
  assertAlmostEqual(result.confidence, 1.0, EPSILON, "multi test confidence")
  assertContains({ result.results[1].reagent, result.results[2].reagent, result.results[3].reagent }, "marquis", "multi test marquis result")
  assertTrue(result.reasoning:find("Corroborated by 3 reagents", 1, true) ~= nil, "multi test reasoning")
end)

test("chemistry spectra helpers map hallmark peaks and visible light ranges", function()
  local carbonylMatches = identifyIR({ wavenumber = 1715 })
  local nitrileMatches = identifyIR({ wavenumber = 2250, tolerance = 10 })
  local referenceAbsorptions = irAbsorptions({})

  assertHasAbsorption(carbonylMatches, "Carbonyl", "C=O stretch", "1715 cm-1 should include a carbonyl assignment")
  assertHasAbsorption(carbonylMatches, "Ketone", "C=O stretch", "1715 cm-1 should include a ketone assignment")
  assertHasAbsorption(nitrileMatches, "Nitrile", "C≡N stretch", "2250 cm-1 should include a nitrile assignment")
  assertHasAbsorption(referenceAbsorptions, "Alcohol", "O-H stretch", "IR reference table should include alcohol O-H")
  assertHasAbsorption(referenceAbsorptions, "Aromatic", "C-H bend (OOP)", "IR reference table should include aromatic out-of-plane bending")

  assertEqual(wavelengthToColor({ nm = 350 }), "#7F00FF", "UV edge color")
  assertEqual(wavelengthToColor({ nm = 450 }), "rgb(0, 51, 255)", "blue visible color")
  assertEqual(wavelengthToColor({ nm = 650 }), "#FF0000", "red visible color")

  assertEqual(absorptionColor({ nm = 450 }), "#FF8C00", "blue absorption complementary color")
  assertEqual(absorptionColor({ nm = 650 }), "#00FF00", "red absorption complementary color")
end)

test("chemistry available compound listings expose the tested reagent corpus", function()
  local simonsCompounds = availableCompounds({ type = "simons" })
  local allCompounds = availableCompounds({})
  local acidCompounds = compounds({ search = "acid" })

  assertContains(simonsCompounds, "MDMA", "Simon's reagent compounds")
  assertContains(simonsCompounds, "MDA", "Simon's reagent compounds")
  assertContains(allCompounds, "Cocaine", "global compound list")
  assertContains(allCompounds, "LSD", "global compound list")
  assertContains(allCompounds, "Methamphetamine", "global compound list")
  assertContainsCompoundNamed(acidCompounds, "Hydrochloric Acid", "compound search should include hydrochloric acid")
end)

io.write(string.format("\n%d tests, %d failures\n", total, failures))
os.exit(failures == 0 and 0 or 1)
