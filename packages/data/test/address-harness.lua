local data = require("lua.capabilities.data")
local handlers = data.getHandlers()

local failures = 0
local total = 0

local function fail(message)
  error(message, 2)
end

local function assertEqual(actual, expected, message)
  if actual ~= expected then
    fail(string.format("%s (expected %s, got %s)", message, tostring(expected), tostring(actual)))
  end
end

local function assertTableEqual(actual, expected, message)
  if type(actual) ~= "table" or type(expected) ~= "table" then
    fail(message .. " (non-table value)")
  end
  for key, value in pairs(expected) do
    assertEqual(actual[key], value, message .. "." .. key)
  end
end

local function assertNil(value, message)
  if value ~= nil then
    fail(string.format("%s (expected nil, got %s)", message, tostring(value)))
  end
end

local function assertListEqual(actual, expected, message)
  assertEqual(#actual, #expected, message .. ".length")
  for i = 1, #expected do
    assertEqual(actual[i], expected[i], string.format("%s[%d]", message, i))
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

local address = handlers["data:address"]

test("data address helpers convert zero-based indices to spreadsheet labels", function()
  assertEqual(address({ method = "label", index = 0 }), "A", "A")
  assertEqual(address({ method = "label", index = 25 }), "Z", "Z")
  assertEqual(address({ method = "label", index = 26 }), "AA", "AA")
  assertEqual(address({ method = "label", index = 702 }), "AAA", "AAA")
end)

test("data address helpers parse valid cells into zero-based coordinates", function()
  assertTableEqual(address({ method = "parse", address = "A1" }), { col = 0, row = 0 }, "A1")
  assertTableEqual(address({ method = "parse", address = " c12 " }), { col = 2, row = 11 }, "C12")
  assertTableEqual(address({ method = "parse", address = "$c$12" }), { col = 2, row = 11 }, "$C$12")
  assertTableEqual(address({ method = "parse", address = "AA10" }), { col = 26, row = 9 }, "AA10")
end)

test("data address helpers reject invalid cells", function()
  assertNil(address({ method = "parse", address = "" }), "empty parse")
  assertNil(address({ method = "parse", address = "A0" }), "A0 parse")
  assertNil(address({ method = "parse", address = "1A" }), "1A parse")
end)

test("data address helpers build row-major matrices", function()
  local matrix = address({ method = "matrix", rows = 2, cols = 3 })
  assertListEqual(matrix, { "A1", "B1", "C1", "A2", "B2", "C2" }, "matrix")
end)

test("data address helpers expand ranges with absolute references", function()
  local matrix = address({ method = "range", range = "$A$1:B$2" })
  assertListEqual(matrix, { "A1", "B1", "A2", "B2" }, "absolute range")
end)

io.write(string.format("\n%d tests, %d failures\n", total, failures))
os.exit(failures == 0 and 0 or 1)
