local chemistry = require("lua.capabilities.chemistry")
local handlers = chemistry.getHandlers()

local EPSILON = 1e-9
local failures = 0
local total = 0

local function fail(message)
  error(message, 2)
end

local function assertTrue(condition, message)
  if not condition then
    fail(message)
  end
end

local function assertNil(value, message)
  if value ~= nil then
    fail(string.format("%s (got %s)", message, tostring(value)))
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
    fail(string.format("%s (expected %.12f, got %.12f, eps %.2e)", message, expected, actual, epsilon))
  end
end

local function assertElementEqual(actual, expected, message)
  assertTrue(type(actual) == "table", message .. " returned non-table")
  assertTrue(type(expected) == "table", message .. " expected non-table counterpart")
  for _, key in ipairs({
    "number", "symbol", "name", "mass", "category", "group", "period",
    "phase", "electronegativity", "cpkColor", "meltingPoint", "boilingPoint", "density",
  }) do
    if key == "mass" or key == "meltingPoint" or key == "boilingPoint" or key == "density" then
      if actual[key] == nil or expected[key] == nil then
        assertEqual(actual[key], expected[key], message .. "." .. key)
      else
        assertAlmostEqual(actual[key], expected[key], EPSILON, message .. "." .. key)
      end
    else
      assertEqual(actual[key], expected[key], message .. "." .. key)
    end
  end
  assertEqual(#actual.shells, #expected.shells, message .. ".shells length")
  for i = 1, #expected.shells do
    assertEqual(actual.shells[i], expected.shells[i], string.format("%s.shells[%d]", message, i))
  end
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

local getElement = handlers["chemistry:element"]
local getElements = handlers["chemistry:elements"]

test("chemistry periodic table dataset contains the full ordered set of 118 elements", function()
  local elements = getElements({})
  assertEqual(#elements, 118, "element count")
  assertEqual(elements[1].number, 1, "first element number")
  assertEqual(elements[1].symbol, "H", "first element symbol")
  assertEqual(elements[#elements].number, 118, "last element number")
  assertEqual(elements[#elements].symbol, "Og", "last element symbol")

  for i = 1, #elements do
    assertEqual(elements[i].number, i, string.format("ordered element number at %d", i))
  end
end)

test("chemistry periodic table dataset keeps symbols, names, and atomic numbers unique", function()
  local elements = getElements({})
  local symbols = {}
  local names = {}
  local numbers = {}

  for _, element in ipairs(elements) do
    assertNil(symbols[element.symbol], "duplicate symbol " .. element.symbol)
    assertNil(names[element.name:lower()], "duplicate name " .. element.name)
    assertNil(numbers[element.number], "duplicate number " .. tostring(element.number))
    symbols[element.symbol] = true
    names[element.name:lower()] = true
    numbers[element.number] = true
  end
end)

test("chemistry periodic table dataset stores consistent structural fields for each element", function()
  for _, element in ipairs(getElements({})) do
    assertTrue(element.mass > 0, element.symbol .. " mass should be positive")
    assertTrue(element.group >= 1 and element.group <= 18, element.symbol .. " group range")
    assertTrue(element.period >= 1 and element.period <= 7, element.symbol .. " period range")
    assertTrue(element.cpkColor:match("^#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]$") ~= nil, element.symbol .. " cpk color")

    local shellTotal = 0
    for _, count in ipairs(element.shells) do
      shellTotal = shellTotal + count
    end
    assertEqual(shellTotal, element.number, element.symbol .. " shell electron total")
  end
end)

test("chemistry element lookup semantics find elements by atomic number, symbol, and case-insensitive name", function()
  local oxygenByNumber = getElement({ key = 8 })
  local oxygenBySymbol = getElement({ key = "O" })
  local oxygenByName = getElement({ key = "oxygen" })
  local oxygenByTitle = getElement({ key = "Oxygen" })

  assertElementEqual(oxygenByNumber, oxygenBySymbol, "oxygen symbol lookup")
  assertElementEqual(oxygenByNumber, oxygenByName, "oxygen lowercase name lookup")
  assertElementEqual(oxygenByNumber, oxygenByTitle, "oxygen titlecase name lookup")
  assertEqual(oxygenByNumber.name, "Oxygen", "oxygen lookup name")
end)

test("chemistry element lookup semantics return nil for unknown elements", function()
  assertNil(getElement({ key = 999 }), "unknown number lookup")
  assertNil(getElement({ key = "Xx" }), "unknown symbol lookup")
  assertNil(getElement({ key = "Unobtainium" }), "unknown name lookup")
end)

test("chemistry element lookup semantics preserve representative reference facts", function()
  local iron = getElement({ key = "Fe" })
  local mercury = getElement({ key = "Mercury" })
  local neon = getElement({ key = 10 })

  assertEqual(iron.category, "transition-metal", "iron category")
  assertEqual(iron.group, 8, "iron group")
  assertEqual(mercury.phase, "liquid", "mercury phase")
  assertEqual(neon.category, "noble-gas", "neon category")
  assertEqual(neon.period, 2, "neon period")
end)

io.write(string.format("\n%d tests, %d failures\n", total, failures))
os.exit(failures == 0 and 0 or 1)
