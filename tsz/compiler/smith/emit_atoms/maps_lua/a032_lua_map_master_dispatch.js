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

function _a032_applies(ctx) {
  // Disabled — Lua map content is emitted by a034 inside LUA_LOGIC
  return false; void ctx;
  return ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
}

function _a032_emit(ctx) {
  var lines = [];
  lines.push('function __rebuildLuaMaps()');
  lines.push('  __clearLuaNodes()');
  for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
    var lmr = ctx._luaMapRebuilders[lmi];
    if (!lmr.bodyNode && !lmr.luaCode) continue;
    lines.push('  __rebuildLuaMap' + lmr.index + '()');
  }
  lines.push('end');
  lines.push('');
  return lines.join('\n') + '\n';
}

_emitAtoms[32] = {
  id: 32,
  name: 'lua_map_master_dispatch',
  group: 'maps_lua',
  target: 'lua_in_zig',
  status: 'complete',
  currentOwner: 'emit_split.js',
  applies: _a032_applies,
  emit: _a032_emit,
};
