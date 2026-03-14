local __tsl = require("lua.tsl_stdlib")

-- chemistry/reagents.tsl — Reagent test databases + correlation logic
--
-- Compiles to Lua. Full reagent databases, mechanisms, multi-test correlation.
local REAGENT_INFO = {
  marquis = {
  name = "Marquis",
  formula = "H2SO4 + HCHO",
  color = "#8B4513",
  description = "Formaldehyde + sulfuric acid. Primary test for alkaloids and phenethylamines.",
},
  mecke = {
  name = "Mecke",
  formula = "H2SeO3 + H2SO4",
  color = "#556B2F",
  description = "Selenious acid + sulfuric acid. Distinguishes between opioids and phenethylamines.",
},
  mandelin = {
  name = "Mandelin",
  formula = "NH4VO3 + H2SO4",
  color = "#B8860B",
  description = "Ammonium vanadate + sulfuric acid. Broad spectrum alkaloid detection.",
},
  simons = {
  name = "Simon's",
  formula = "NaHCO3 + Na2[Fe(CN)5NO] + CH3CHO",
  color = "#4682B4",
  description = "Sodium nitroprusside + acetaldehyde. Detects secondary amines.",
},
  ehrlich = {
  name = "Ehrlich",
  formula = "DMAB + HCl",
  color = "#DAA520",
  description = "p-Dimethylaminobenzaldehyde + HCl. Detects indole-containing compounds.",
},
  liebermann = {
  name = "Liebermann",
  formula = "NaNO2 + H2SO4",
  color = "#2F4F4F",
  description = "Sodium nitrite + sulfuric acid. Detects phenols and aromatic amines.",
},
  froehde = {
  name = "Froehde",
  formula = "Na2MoO4 + H2SO4",
  color = "#696969",
  description = "Sodium molybdate + sulfuric acid. Alkaloid differentiation.",
},
  ["gallic-acid"] = {
  name = "Gallic Acid",
  formula = "C7H6O5 + H2SO4",
  color = "#8B0000",
  description = "Gallic acid + sulfuric acid. Tests for alkaloids and glycosides.",
},
}
local REAGENT_DATABASES = {
  marquis = {
  MDMA = {
  color = "#1a0a2e",
  description = "Deep purple to black",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#9370DB", "#4B0082", "#1a0a2e"},
},
  MDA = {
  color = "#1a0a2e",
  description = "Black/dark purple",
  timeMs = 11500,
  intermediates = {"#f5f5dc", "#8B008B", "#2d0047", "#1a0a2e"},
},
  Amphetamine = {
  color = "#FF8C00",
  description = "Orange to dark reddish-brown",
  timeMs = 16000,
  intermediates = {"#f5f5dc", "#FFA500", "#FF6347", "#8B4513"},
},
  Methamphetamine = {
  color = "#FF4500",
  description = "Orange to dark orange",
  timeMs = 14500,
  intermediates = {"#f5f5dc", "#FFD700", "#FF8C00", "#FF4500"},
},
  Heroin = {
  color = "#800080",
  description = "Purple",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#DDA0DD", "#9932CC", "#800080"},
},
  Morphine = {
  color = "#800080",
  description = "Deep purple",
  timeMs = 11500,
  intermediates = {"#f5f5dc", "#DA70D6", "#9400D3", "#800080"},
},
  Codeine = {
  color = "#800080",
  description = "Deep purple",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#EE82EE", "#9932CC", "#800080"},
},
  Cocaine = {
  color = "#f5f5dc",
  description = "No reaction (remains clear)",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
  LSD = {
  color = "#808000",
  description = "Olive to black",
  timeMs = 19000,
  intermediates = {"#f5f5dc", "#BDB76B", "#808000", "#2F4F4F"},
},
  Aspirin = {
  color = "#FF6347",
  description = "Reddish",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#FFA07A", "#FF6347"},
},
  Sugar = {
  color = "#f5f5dc",
  description = "No significant reaction",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
  Caffeine = {
  color = "#f5f5dc",
  description = "No significant reaction",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
},
  mecke = {
  MDMA = {
  color = "#006400",
  description = "Blue-green to dark green",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#20B2AA", "#008080", "#006400"},
},
  MDA = {
  color = "#006400",
  description = "Green to blue-green",
  timeMs = 11500,
  intermediates = {"#f5f5dc", "#3CB371", "#2E8B57", "#006400"},
},
  Heroin = {
  color = "#006400",
  description = "Deep blue-green",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#66CDAA", "#2E8B57", "#006400"},
},
  Morphine = {
  color = "#006400",
  description = "Deep green",
  timeMs = 11500,
  intermediates = {"#f5f5dc", "#90EE90", "#228B22", "#006400"},
},
  Cocaine = {
  color = "#808000",
  description = "Slow olive green",
  timeMs = 28000,
  intermediates = {"#f5f5dc", "#BDB76B", "#808000"},
},
  Amphetamine = {
  color = "#f5f5dc",
  description = "No reaction",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
  Methamphetamine = {
  color = "#f5f5dc",
  description = "No reaction",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
  LSD = {
  color = "#8B4513",
  description = "Brownish-black",
  timeMs = 16000,
  intermediates = {"#f5f5dc", "#D2B48C", "#A0522D", "#8B4513"},
},
},
  mandelin = {
  MDMA = {
  color = "#1a0a2e",
  description = "Black",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#696969", "#2F2F2F", "#1a0a2e"},
},
  MDA = {
  color = "#1a0a2e",
  description = "Black to dark green",
  timeMs = 11500,
  intermediates = {"#f5f5dc", "#556B2F", "#2F4F4F", "#1a0a2e"},
},
  Amphetamine = {
  color = "#006400",
  description = "Dark green",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#8FBC8F", "#2E8B57", "#006400"},
},
  Methamphetamine = {
  color = "#006400",
  description = "Green",
  timeMs = 14500,
  intermediates = {"#f5f5dc", "#90EE90", "#32CD32", "#006400"},
},
  Cocaine = {
  color = "#FF8C00",
  description = "Orange",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#FFD700", "#FF8C00"},
},
  Heroin = {
  color = "#808080",
  description = "Brownish gray",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#D2B48C", "#808080"},
},
  Ketamine = {
  color = "#FF4500",
  description = "Orange",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#FFA500", "#FF4500"},
},
},
  simons = {
  MDMA = {
  color = "#00008B",
  description = "Blue (secondary amine)",
  timeMs = 8500,
  intermediates = {"#f5f5dc", "#87CEEB", "#4169E1", "#00008B"},
},
  Methamphetamine = {
  color = "#00008B",
  description = "Blue (secondary amine)",
  timeMs = 8500,
  intermediates = {"#f5f5dc", "#87CEEB", "#4169E1", "#00008B"},
},
  MDA = {
  color = "#f5f5dc",
  description = "No reaction (primary amine)",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
  Amphetamine = {
  color = "#f5f5dc",
  description = "No reaction (primary amine)",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
},
  ehrlich = {
  LSD = {
  color = "#800080",
  description = "Purple (indole ring)",
  timeMs = 19000,
  intermediates = {"#f5f5dc", "#DDA0DD", "#BA55D3", "#800080"},
},
  Psilocybin = {
  color = "#800080",
  description = "Purple (indole ring)",
  timeMs = 28000,
  intermediates = {"#f5f5dc", "#EE82EE", "#9932CC", "#800080"},
},
  DMT = {
  color = "#800080",
  description = "Purple to pink-purple",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#FF69B4", "#C71585", "#800080"},
},
  Tryptophan = {
  color = "#DDA0DD",
  description = "Light purple (indole)",
  timeMs = 22000,
  intermediates = {"#f5f5dc", "#E6E6FA", "#DDA0DD"},
},
  MDMA = {
  color = "#f5f5dc",
  description = "No reaction (no indole ring)",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
  Cocaine = {
  color = "#f5f5dc",
  description = "No reaction",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
},
  liebermann = {
  MDMA = {
  color = "#1a0a2e",
  description = "Black",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#696969", "#1a0a2e"},
},
  MDA = {
  color = "#1a0a2e",
  description = "Black",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#696969", "#1a0a2e"},
},
  Cocaine = {
  color = "#FFD700",
  description = "Yellow to orange",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#FFFACD", "#FFD700"},
},
  Morphine = {
  color = "#1a0a2e",
  description = "Black",
  timeMs = 11500,
  intermediates = {"#f5f5dc", "#556B2F", "#1a0a2e"},
},
},
  froehde = {
  MDMA = {
  color = "#1a0a2e",
  description = "Purple to black",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#9370DB", "#4B0082", "#1a0a2e"},
},
  Heroin = {
  color = "#006400",
  description = "Green to blue-green",
  timeMs = 11500,
  intermediates = {"#f5f5dc", "#3CB371", "#008080", "#006400"},
},
  Morphine = {
  color = "#800080",
  description = "Purple",
  timeMs = 10000,
  intermediates = {"#f5f5dc", "#DDA0DD", "#800080"},
},
  Codeine = {
  color = "#006400",
  description = "Green",
  timeMs = 13000,
  intermediates = {"#f5f5dc", "#90EE90", "#006400"},
},
  Cocaine = {
  color = "#f5f5dc",
  description = "No reaction",
  timeMs = 7000,
  intermediates = {"#f5f5dc"},
},
},
  ["gallic-acid"] = {},
}
local MECHANISMS = {
  marquis = {
  MDMA = "Formaldehyde attacks the methylenedioxy ring via electrophilic aromatic substitution. The electron-rich aromatic system donates electrons to the aldehyde, forming a carbocation intermediate that absorbs in the visible spectrum (purple). The 3,4-methylenedioxy group is the chromophore.",
  Amphetamine = "The primary amine undergoes condensation with formaldehyde forming a Schiff base. Sulfuric acid catalyzes further oxidation, producing orange quinone-like chromophores.",
  Heroin = "The phenolic hydroxyl group (exposed after ester hydrolysis by H2SO4) reacts with formaldehyde. The resulting conjugated system absorbs yellow-green light, appearing purple.",
  Cocaine = "No reactive functional groups accessible to formaldehyde under these conditions. The tropane nitrogen is tertiary and sterically hindered; the benzoyl ester is stable in concentrated H2SO4.",
},
  ehrlich = {
  LSD = "DMAB attacks position 2 of the indole ring via electrophilic substitution. The resulting azomethine dye has extended conjugation spanning the indole + DMAB systems, absorbing in the yellow-green range (appearing purple). This is specific to the indole NH.",
  Psilocybin = "Same indole ring mechanism as LSD. The 4-phosphoryloxy group does not interfere with position 2 substitution. Slower reaction due to the electron-withdrawing phosphate.",
  DMT = "Fastest Ehrlich reaction — unsubstituted indole with electron-donating dimethylamine. DMAB attacks C-2 readily.",
},
  simons = {
  MDMA = "Sodium nitroprusside forms a colored complex specifically with secondary amines. The nitrogen lone pair coordinates to iron in the [Fe(CN)5NO]2- complex. MDMA has a secondary amine (N-methyl); MDA has a primary amine and does not react.",
  Methamphetamine = "Same mechanism — secondary amine (N-methyl) coordinates to the nitroprusside iron center.",
  MDA = "Primary amines do not form the colored nitroprusside complex. This is the key distinction: Marquis alone cannot distinguish MDA from MDMA; adding Simon's resolves the ambiguity.",
},
}
local FUNCTIONAL_GROUPS = {
  "indole",
  "methylenedioxy",
  "phenol",
  "primary amine",
  "secondary amine",
  "tertiary amine",
  "hydroxyl",
  "ester",
  "tropane",
}
local function extractFunctionalGroup(mechanism)
  local mechLower = string.lower(mechanism)
  local bestGroup = nil
  local bestIndex = nil
  for _, g in ipairs(FUNCTIONAL_GROUPS) do
    local startIndex = __tsl.indexOf(mechLower, g)
    if startIndex ~= -1 and (bestIndex == nil or startIndex < bestIndex) then
      bestGroup = g
      bestIndex = startIndex
    end
  end
  return bestGroup
end
local function runReagentTest(reagent, compound)
  local db = REAGENT_DATABASES[reagent]
  local reaction = (db and db[compound] or nil)
  local mechanism = (MECHANISMS[reagent] and MECHANISMS[reagent][compound] or nil)
  local confidence = 0
  if reaction then
    confidence = (reaction.color == "#f5f5dc" and 0 or 0.65)
  end
  return {
    reagent = reagent,
    compound = compound,
    reaction = reaction,
    confidence = confidence,
    functionalGroup = (mechanism and extractFunctionalGroup(mechanism) or nil),
    mechanism = mechanism,
  }
end
local function runMultiReagentTest(reagents, compound)
  local results = {}
  for _, r in ipairs(reagents) do
    table.insert(results, runReagentTest(r, compound))
  end
  local reacting = {}
  for _, r in ipairs(results) do
    if r.reaction and r.reaction.color ~= "#f5f5dc" then
      table.insert(reacting, r)
    end
  end
  local confidence = math.min(1, #reacting * 0.3 + ((#reacting >= 3 and 0.15 or 0)))
  local identification = nil
  local reasoning = ""
  if #reacting == 0 then
    reasoning = "No color change observed with any reagent. Compound is either inert to these tests or not in the database."
  elseif #reacting == 1 then
    identification = compound
    reasoning = "Single reagent match (" .. tostring(REAGENT_INFO[reacting[1].reagent].name) .. "). Presumptive identification only — additional tests recommended."
  elseif #reacting >= 2 then
    identification = compound
    local names = __tsl.map(reacting, function(r) return REAGENT_INFO[r.reagent].name end)
    reasoning = "Corroborated by " .. tostring(#reacting) .. " reagents (" .. tostring(table.concat(names, ", ")) .. "). " .. tostring((confidence >= 0.8 and "High" or "Moderate")) .. " confidence identification."
  end
  return {
    results = results,
    identification = identification,
    confidence = confidence,
    reasoning = reasoning,
  }
end
local function getAvailableCompounds(reagent)
  local db = REAGENT_DATABASES[reagent]
  if not db then
    return {}
  end
  local result = table.sort(__tsl.keys(Object))
  return result
end
local function getAllTestedCompounds()
  local seen = {}
  local result = {}
  for reagent, _ in pairs(REAGENT_DATABASES) do
    for compound, _ in pairs(REAGENT_DATABASES[reagent]) do
      if not seen[compound] then
        seen[compound] = true
        table.insert(result, compound)
      end
    end
  end
  return table.sort(result)
end

return {
  runReagentTest = runReagentTest,
  runMultiReagentTest = runMultiReagentTest,
  getAvailableCompounds = getAvailableCompounds,
  getAllTestedCompounds = getAllTestedCompounds,
  REAGENT_INFO = REAGENT_INFO,
  REAGENT_DATABASES = REAGENT_DATABASES,
}
