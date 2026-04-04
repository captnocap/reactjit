// ── Emit Atom 032: Lua map master dispatch ──────────────────────
// Index: 32
// Group: maps_lua
// Target: lua_in_zig
// Status: complete
// Current owner: emit_split.js
//
// Trigger: one or more Lua map rebuilders are present.
// Output target: __rebuildLuaMaps() master function in LUA_LOGIC
//                and luajit_runtime.callGlobal("__rebuildLuaMaps")
//                calls in _appInit/_appTick.
//
// The master dispatch calls each individual __rebuildLuaMapN() in order.
// It is invoked from Zig via luajit_runtime.callGlobal on state change.

function applies(ctx) {
  return ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
}

function emit(ctx) {
  var lines = [];
  lines.push('function __rebuildLuaMaps()');
  lines.push('  __clearLuaNodes()');
  for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
    lines.push('  __rebuildLuaMap' + lmi + '()');
  }
  lines.push('end');
  lines.push('');
  return lines;
}

module.exports = {
  id: 32,
  name: 'lua_map_master_dispatch',
  group: 'maps_lua',
  target: 'lua_in_zig',
  status: 'complete',
  currentOwner: 'emit_split.js',
  applies: applies,
  emit: emit,
};
