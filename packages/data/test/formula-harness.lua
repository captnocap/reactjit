local data = require("lua.capabilities.data")
local convert = require("lua.capabilities.convert")

local dataHandlers = data.getHandlers()
local convertHandlers = convert.getHandlers()

local EPSILON = 1e-6
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

local evaluate = dataHandlers["data:evaluate"]
local convertRpc = convertHandlers["convert:convert"]

test("convert backend resolves representative unit conversions", function()
  local distance = convertRpc({ from = "mi", to = "km", value = 5 })
  local temp = convertRpc({ from = "f", to = "c", value = 72 })
  local volume = convertRpc({ from = "gal", to = "l", value = 1 })

  assertTrue(distance.error == nil, "distance conversion should succeed")
  assertTrue(temp.error == nil, "temperature conversion should succeed")
  assertTrue(volume.error == nil, "volume conversion should succeed")
  assertAlmostEqual(distance.result, 8.04672, EPSILON, "5 mi -> km")
  assertAlmostEqual(temp.result, 22.2222222222, 1e-4, "72 F -> C")
  assertAlmostEqual(volume.result, 3.78541, 1e-5, "1 gal -> l")
end)

test("spreadsheet evaluator resolves CONVERT formulas through the shared backend", function()
  local result = evaluate({
    cells = {
      B2 = "18",
      C2 = '=ROUND(CONVERT(B2, "mi", "km"), 2)',
      D2 = "2.8",
      E2 = '=ROUND(CONVERT(D2, "gal", "l"), 2)',
      F2 = '=ROUND(CONVERT(72, "f", "c"), 2)',
    },
    targets = { "C2", "E2", "F2" },
  })

  assertEqual(result.errors.C2, nil, "C2 should not error")
  assertEqual(result.errors.E2, nil, "E2 should not error")
  assertEqual(result.errors.F2, nil, "F2 should not error")
  assertAlmostEqual(result.values.C2, 28.97, EPSILON, "C2 converted miles")
  assertAlmostEqual(result.values.E2, 10.6, EPSILON, "E2 converted gallons")
  assertAlmostEqual(result.values.F2, 22.22, EPSILON, "F2 converted temperature")
end)

test("spreadsheet evaluator composes converted values into range formulas", function()
  local result = evaluate({
    cells = {
      B2 = "10",
      B3 = "15",
      C2 = '=ROUND(CONVERT(B2, "mi", "km"), 2)',
      C3 = '=ROUND(CONVERT(B3, "mi", "km"), 2)',
      C4 = '=ROUND(SUM(C2:C3), 2)',
    },
    targets = { "C4" },
  })

  assertEqual(result.errors.C4, nil, "C4 should not error")
  assertAlmostEqual(result.values.C2, 16.09, EPSILON, "C2 converted miles")
  assertAlmostEqual(result.values.C3, 24.14, EPSILON, "C3 converted miles")
  assertAlmostEqual(result.values.C4, 40.23, EPSILON, "C4 summed converted values")
end)

test("spreadsheet evaluator resolves arithmetic, comparisons, and text helpers", function()
  local result = evaluate({
    cells = {
      A1 = "5",
      A2 = "7",
      B1 = "=A1+A2*2",
      B2 = '=IF(B1 >= 19, CONCAT("ok-", UPPER("go")), "bad")',
      B3 = '=TRIM("  hi  ") & "-" & LOWER("LOUD")',
    },
    targets = { "B1", "B2", "B3" },
  })

  assertEqual(result.errors.B1, nil, "B1 should not error")
  assertEqual(result.errors.B2, nil, "B2 should not error")
  assertEqual(result.errors.B3, nil, "B3 should not error")
  assertAlmostEqual(result.values.B1, 19, EPSILON, "B1 arithmetic")
  assertEqual(result.values.B2, "ok-GO", "B2 logical/text result")
  assertEqual(result.values.B3, "hi-loud", "B3 trim/lower/concat result")
end)

test("spreadsheet evaluator detects circular references", function()
  local result = evaluate({
    cells = {
      A1 = "=B1",
      B1 = "=A1",
    },
    targets = { "A1", "B1" },
  })

  assertTrue(type(result.errors.A1) == "string", "A1 should report circular reference")
  assertTrue(result.errors.A1:match("Circular reference") ~= nil, "A1 circular reference text")
  assertEqual(result.values.A1, "", "A1 should collapse to empty string")
end)

test("spreadsheet evaluator parses raw literals consistently", function()
  local result = evaluate({
    cells = {
      A1 = "42",
      A2 = "true",
      A3 = '"quoted"',
      A4 = "'0012",
      A5 = "   ",
    },
    targets = { "A1", "A2", "A3", "A4", "A5" },
  })

  assertAlmostEqual(result.values.A1, 42, EPSILON, "A1 number literal")
  assertEqual(result.values.A2, true, "A2 boolean literal")
  assertEqual(result.values.A3, "quoted", "A3 quoted string")
  assertEqual(result.values.A4, "0012", "A4 forced text")
  assertEqual(result.values.A5, "", "A5 empty string")
end)

test("spreadsheet evaluator resolves absolute and mixed references", function()
  local result = evaluate({
    cells = {
      A1 = "3",
      B1 = "4",
      C1 = "=$A$1 + B$1 + $B1",
      C2 = "=SUM($A$1:B$1)",
    },
    targets = { "C1", "C2" },
  })

  assertEqual(result.errors.C1, nil, "C1 should not error")
  assertEqual(result.errors.C2, nil, "C2 should not error")
  assertAlmostEqual(result.values.C1, 11, EPSILON, "C1 absolute and mixed refs")
  assertAlmostEqual(result.values.C2, 7, EPSILON, "C2 absolute range")
end)

test("spreadsheet evaluator surfaces converter lookup failures as formula errors", function()
  local result = evaluate({
    cells = {
      A1 = '=CONVERT(1, "bogus", "km")',
    },
    targets = { "A1" },
  })

  assertEqual(result.values.A1, "", "A1 should collapse to empty string on error")
  assertTrue(type(result.errors.A1) == "string", "A1 should capture an error string")
  assertTrue(result.errors.A1:match("no converter") ~= nil, "A1 should expose converter failure")
end)

io.write(string.format("\n%d tests, %d failures\n", total, failures))
os.exit(failures == 0 and 0 or 1)
