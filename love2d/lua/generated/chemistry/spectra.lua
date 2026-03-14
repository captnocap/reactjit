-- chemistry/spectra.tsl — IR absorption data + visible light helpers
--
-- Compiles to Lua. Spectroscopy lookup tables and color conversion.
local IR_ABSORPTIONS = {
  {
  group = "Alcohol",
  bond = "O-H stretch",
  rangeMin = 3200,
  rangeMax = 3550,
  intensity = "strong",
  description = "Broad peak, hydrogen bonding",
},
  {
  group = "Carboxylic Acid",
  bond = "O-H stretch",
  rangeMin = 2500,
  rangeMax = 3300,
  intensity = "strong",
  description = "Very broad, overlaps C-H",
},
  {
  group = "Amine",
  bond = "N-H stretch",
  rangeMin = 3300,
  rangeMax = 3500,
  intensity = "medium",
  description = "Primary: two peaks; secondary: one peak",
},
  {
  group = "Alkane",
  bond = "C-H stretch",
  rangeMin = 2850,
  rangeMax = 2960,
  intensity = "strong",
  description = "sp3 C-H",
},
  {
  group = "Alkene",
  bond = "C-H stretch",
  rangeMin = 3020,
  rangeMax = 3100,
  intensity = "medium",
  description = "sp2 C-H",
},
  {
  group = "Alkyne",
  bond = "C-H stretch",
  rangeMin = 3300,
  rangeMax = 3320,
  intensity = "strong",
  description = "sp C-H, sharp",
},
  {
  group = "Aldehyde",
  bond = "C-H stretch",
  rangeMin = 2700,
  rangeMax = 2850,
  intensity = "medium",
  description = "Two peaks (Fermi resonance)",
},
  {
  group = "Nitrile",
  bond = "C≡N stretch",
  rangeMin = 2210,
  rangeMax = 2260,
  intensity = "medium",
  description = "Sharp, characteristic",
},
  {
  group = "Alkyne",
  bond = "C≡C stretch",
  rangeMin = 2100,
  rangeMax = 2260,
  intensity = "weak",
  description = "May be absent if symmetric",
},
  {
  group = "Carbonyl",
  bond = "C=O stretch",
  rangeMin = 1680,
  rangeMax = 1750,
  intensity = "strong",
  description = "Very characteristic, exact position varies",
},
  {
  group = "Ketone",
  bond = "C=O stretch",
  rangeMin = 1705,
  rangeMax = 1725,
  intensity = "strong",
  description = "Conjugation lowers frequency",
},
  {
  group = "Aldehyde",
  bond = "C=O stretch",
  rangeMin = 1720,
  rangeMax = 1740,
  intensity = "strong",
  description = "Higher than ketone",
},
  {
  group = "Ester",
  bond = "C=O stretch",
  rangeMin = 1735,
  rangeMax = 1750,
  intensity = "strong",
  description = "Highest carbonyl frequency",
},
  {
  group = "Amide",
  bond = "C=O stretch",
  rangeMin = 1630,
  rangeMax = 1690,
  intensity = "strong",
  description = "Amide I band",
},
  {
  group = "Carboxylic Acid",
  bond = "C=O stretch",
  rangeMin = 1700,
  rangeMax = 1725,
  intensity = "strong",
  description = "Dimeric form",
},
  {
  group = "Alkene",
  bond = "C=C stretch",
  rangeMin = 1620,
  rangeMax = 1680,
  intensity = "variable",
  description = "Weak if symmetric",
},
  {
  group = "Aromatic",
  bond = "C=C stretch",
  rangeMin = 1450,
  rangeMax = 1600,
  intensity = "variable",
  description = "Ring stretching, multiple peaks",
},
  {
  group = "Nitro",
  bond = "N=O stretch",
  rangeMin = 1515,
  rangeMax = 1560,
  intensity = "strong",
  description = "Asymmetric stretch",
},
  {
  group = "Ether",
  bond = "C-O stretch",
  rangeMin = 1000,
  rangeMax = 1300,
  intensity = "strong",
  description = "Broad region",
},
  {
  group = "Alcohol",
  bond = "C-O stretch",
  rangeMin = 1000,
  rangeMax = 1260,
  intensity = "strong",
  description = "Primary/secondary/tertiary differ",
},
  {
  group = "Aromatic",
  bond = "C-H bend (OOP)",
  rangeMin = 675,
  rangeMax = 900,
  intensity = "strong",
  description = "Substitution pattern diagnostic",
},
}
local function identifyIRPeaks(wavenumber, tolerance)
  local result = {}
  for _, a in ipairs(IR_ABSORPTIONS) do
    if wavenumber >= a.rangeMin - tolerance and wavenumber <= a.rangeMax + tolerance then
      table.insert(result, a)
    end
  end
  return result
end
local function wavelengthToColor(nm)
  if nm < 380 then
    return "#7F00FF"
  end
  if nm < 440 then
    local t = (nm - 380) / 60
    return "rgb(" .. tostring(math.floor(255 * (1 - t) + 0.5)) .. ", 0, 255)"
  end
  if nm < 490 then
    local t = (nm - 440) / 50
    return "rgb(0, " .. tostring(math.floor(255 * t + 0.5)) .. ", 255)"
  end
  if nm < 510 then
    local t = (nm - 490) / 20
    return "rgb(0, 255, " .. tostring(math.floor(255 * (1 - t) + 0.5)) .. ")"
  end
  if nm < 580 then
    local t = (nm - 510) / 70
    return "rgb(" .. tostring(math.floor(255 * t + 0.5)) .. ", 255, 0)"
  end
  if nm < 645 then
    local t = (nm - 580) / 65
    return "rgb(255, " .. tostring(math.floor(255 * (1 - t) + 0.5)) .. ", 0)"
  end
  if nm < 780 then
    return "#FF0000"
  end
  return "#7F0000"
end
local function absorptionToObservedColor(absorbedNm)
  local COMPLEMENTARY = {
    {380, 430, "#FFFF00"},
    {430, 480, "#FF8C00"},
    {480, 500, "#FF0000"},
    {500, 530, "#FF00FF"},
    {530, 560, "#8B00FF"},
    {560, 580, "#0000FF"},
    {580, 620, "#00BFFF"},
    {620, 780, "#00FF00"},
  }
  for _, c in ipairs(COMPLEMENTARY) do
    if absorbedNm >= string.sub(c, 1, 1) and absorbedNm < string.sub(c, 2, 2) then
      return string.sub(c, 3, 3)
    end
  end
  return "#FFFFFF"
end

return {
  identifyIRPeaks = identifyIRPeaks,
  wavelengthToColor = wavelengthToColor,
  absorptionToObservedColor = absorptionToObservedColor,
  IR_ABSORPTIONS = IR_ABSORPTIONS,
}
