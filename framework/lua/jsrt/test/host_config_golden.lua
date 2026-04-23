-- Unit test for renderer/hostConfig.lua's emitter + diff protocol.
--
-- Exercises createText / createInstance / append / update / flush in
-- isolation, with golden assertions on the emitted mutation stream. Does
-- not touch JSRT — it's a narrow correctness test for the reconciler
-- infrastructure JSRT drives. Salvaged from the old tests/eqjs/ harness.
--
-- Run from repo root:
--   luajit framework/lua/jsrt/test/host_config_golden.lua

package.path = package.path .. ";./?.lua;./?/init.lua"

local host = require("renderer.hostConfig")

local function assert_eq(got, expected, label)
  if got ~= expected then
    error(string.format("%s expected %s, got %s", label, tostring(expected), tostring(got)), 2)
  end
end

local function assert_table_eq(got, expected, label)
  local function normalize(value)
    if type(value) ~= "table" then return value end
    local out = {}
    for k, v in pairs(value) do out[k] = normalize(v) end
    return out
  end
  local function serialize(value)
    if type(value) ~= "table" then return tostring(value) end
    local keys = {}
    for k in pairs(value) do keys[#keys + 1] = k end
    table.sort(keys, function(a, b) return tostring(a) < tostring(b) end)
    local parts = {}
    for _, k in ipairs(keys) do
      parts[#parts + 1] = tostring(k) .. "=" .. serialize(value[k])
    end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  if serialize(normalize(got)) ~= serialize(normalize(expected)) then
    error(label .. " mismatch:\n  got: " .. serialize(got) .. "\n  expected: " .. serialize(expected), 2)
  end
end

-- extractHandlers: on* props get split out into their own table.
do
  local clean, handlers = host.extractHandlers({
    style = { width = 10 },
    onPress = function() end,
    onChange = function() end,
    children = "x",
  })
  assert(type(handlers.onPress) == "function", "onPress classified as handler")
  assert(type(handlers.onChange) == "function", "onChange classified as handler")
  assert_eq(handlers.children, nil, "children never moves to handlers")
  assert_table_eq(clean, { style = { width = 10 } }, "clean props")
end

-- diffCleanProps: nil when nothing changed; removeKeys / removeStyleKeys
-- populated correctly when keys disappear.
do
  local diff = host.diffCleanProps({ style = { width = 5 } }, { style = { width = 5 } })
  assert(diff == nil, "identical clean props should diff to nil")

  local diff2 = host.diffCleanProps({ a = 1 }, { a = 2 })
  assert_eq(diff2.diff.a, 2, "primitive prop change")

  local diff3 = host.diffCleanProps({ style = { w = 1, h = 2 } }, { style = { w = 1 } })
  assert_eq(#diff3.removeStyleKeys, 1, "one removed style key")
  assert_eq(diff3.removeStyleKeys[1], "h", "removed style key name")

  local diff4 = host.diffCleanProps({ a = 1, b = 2 }, { a = 1 })
  assert_eq(#diff4.removeKeys, 1, "one removed top-level key")
  assert_eq(diff4.removeKeys[1], "b", "removed key name")
end

-- Emitter: createText / createInstance / append / flush golden stream.
do
  local emitter = host.newEmitter()
  local textId = emitter:createText("hello")
  local boxId  = emitter:createInstance("Box", { style = { width = 100 } })
  emitter:append(boxId, textId)
  emitter:appendToRoot(boxId)
  local ops = emitter:flush()

  assert_eq(#ops, 4, "four ops")
  assert_eq(ops[1].op, "CREATE_TEXT",    "op 1 type")
  assert_eq(ops[1].text, "hello",        "op 1 text")
  assert_eq(ops[2].op, "CREATE",         "op 2 type")
  assert_eq(ops[2].type, "Box",          "op 2 element type")
  assert_eq(ops[3].op, "APPEND",         "op 3 type")
  assert_eq(ops[3].parentId, boxId,      "op 3 parent")
  assert_eq(ops[3].childId, textId,      "op 3 child")
  assert_eq(ops[4].op, "APPEND_TO_ROOT", "op 4 type")
end

-- coalesceCommands: back-to-back UPDATE ops on the same id fold into one.
do
  local out = host.coalesceCommands({
    { op = "UPDATE", id = 7, props = { a = 1 } },
    { op = "UPDATE", id = 7, props = { b = 2 } },
  })
  assert_eq(#out, 1, "two UPDATEs on same id coalesce")
  assert_eq(out[1].props.a, 1, "coalesced preserves earlier key")
  assert_eq(out[1].props.b, 2, "coalesced adds later key")
end

print("host_config_golden: ok")
