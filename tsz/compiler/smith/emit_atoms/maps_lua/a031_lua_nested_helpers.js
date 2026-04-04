// ── Emit Atom 031: Lua nested helpers ───────────────────────────
// Index: 31
// Group: maps_lua
// Target: lua_in_zig
// Status: complete
// Current owner: emit/lua_maps.js
//
// Trigger: Lua-side nested mapped children.
// Output target: __luaNestedMap() helper function in LUA_LOGIC.
//
// When a Lua map body contains item.children.map((child) => ...),
// the compiler emits a call to __luaNestedMap(arr, fn) which
// iterates the sub-array and wraps results in { children = result }.
//
// This helper is emitted once per cart that has any Lua map rebuilder,
// inside emitLuaRebuildList() in emit/lua_maps.js. It is included
// at the end of each rebuilder's luaCode output.

function applies(ctx) {
  return ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
}

function emit() {
  // The __luaNestedMap helper is already included in the luaCode
  // output from emitLuaRebuildList. This atom documents its shape.
  var lines = [];
  lines.push('-- Nested map helper');
  lines.push('function __luaNestedMap(arr, fn)');
  lines.push('  if not arr then return nil end');
  lines.push('  local result = {}');
  lines.push('  for _, v in ipairs(arr) do');
  lines.push('    result[#result + 1] = fn(v)');
  lines.push('  end');
  lines.push('  return { children = result }');
  lines.push('end');
  return lines;
}

module.exports = {
  id: 31,
  name: 'lua_nested_helpers',
  group: 'maps_lua',
  target: 'lua_in_zig',
  status: 'complete',
  currentOwner: 'emit/lua_maps.js',
  applies: applies,
  emit: emit,
};
