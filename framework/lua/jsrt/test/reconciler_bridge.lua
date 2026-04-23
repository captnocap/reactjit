-- JSRT ↔ renderer/reconciler.lua integration proof.
--
-- Boots a JS counter program through JSRT with the renderer's host emitter,
-- mounts the output into a retained tree via renderer.reconciler, then
-- dispatches a click through the registered JS handler and verifies the
-- tree-level text update. Salvaged from the old tests/eqjs/ harness (the
-- EQJS tree is dead; this test isn't — it exercises live JSRT wiring).
--
-- Not a formal target. Run manually from repo root:
--   luajit framework/lua/jsrt/test/reconciler_bridge.lua

package.path = package.path .. ";./?.lua;./?/init.lua"

local JSRT       = require("framework.lua.jsrt.init")
local Values     = require("framework.lua.jsrt.values")
local Evaluator  = require("framework.lua.jsrt.evaluator")
local host       = require("renderer.hostConfig")
local reconciler = require("renderer.reconciler")
local AST        = require("framework.lua.jsrt.test.load_generated_ast")

local function assert_eq(got, expected, label)
  if got ~= expected then
    error(string.format("%s expected %s, got %s", label, tostring(expected), tostring(got)), 2)
  end
end

local here = debug.getinfo(1, "S").source:sub(2):match("(.+)/[^/]+$") or "."
local src  = here .. "/target_12_source.js"
local out  = here .. "/target_12_source.ast.lua"

local ok = os.execute(string.format('node scripts/build-jsast.mjs %q %q', src, out))
assert(ok == 0 or ok == true, "build-jsast.mjs failed")
local ast = AST.load(out)

local emitter = host.newEmitter()
local dispatch_slot = {}

JSRT.run(ast, {
  host = {
    emitter = emitter,
    dispatchSlot = dispatch_slot,
  },
})

local mount_ops = emitter:flush()
assert(#mount_ops > 0, "expected mount ops from JSRT run")

local tree = host.newTreeState()
reconciler.applyCommands(tree, mount_ops)

assert_eq(#tree.children, 1, "root child count")
local pressable = tree.children[1]
assert_eq(pressable.type, "Pressable", "root node type")
assert_eq(#pressable.children, 1, "pressable child count")
local text = pressable.children[1]
assert_eq(text.type, "Text", "text node type")
assert_eq(#text.children, 1, "text child count")
assert_eq(text.children[1]._text, "0", "initial text value")

assert(dispatch_slot.fn ~= nil, "dispatch function not registered")

Evaluator.callFunction(dispatch_slot.fn, {}, Values.UNDEFINED, nil, "reconciler_bridge dispatch")
local update_ops = emitter:flush()
assert_eq(#update_ops, 1, "update op count")
assert_eq(update_ops[1].op, "UPDATE_TEXT", "update op type")

reconciler.applyCommands(tree, update_ops)
assert_eq(text.children[1]._text, "1", "updated text value")

print("reconciler_bridge: ok")
