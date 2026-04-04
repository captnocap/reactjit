// ── Emit Atom 038: Runtime dirty tick ───────────────────────────
// Index: 38
// Group: logic_runtime
// Target: zig
// Status: complete
// Current owner: emit/entrypoints.js, emit/runtime_updates.js
//
// Trigger: any state, OA, or Lua map activity that requires dirty-driven refresh.
// Output target: the state.isDirty() gate inside _appTick() that calls
//   _updateDynamicTexts, _updateConditionals, map rebuilds, Lua map rebuilds,
//   and state.clearDirty().
//
// Notes:
//   This atom captures the dirty-tick dispatch logic inside _appTick().
//   The tick function is emitted by entrypoints.js, but the dirty gate
//   orchestrates calls to functions defined by runtime_updates.js.
//
//   Three code paths based on what the app uses:
//     1. hasDynStyles (dynamic style properties):
//        if (state.isDirty()) { _updateDynamicTexts(); [_updateConditionals();]
//          [arena reset;] [_rebuildMapN();] [luajit __rebuildLuaMaps;]
//          state.clearDirty(); }
//
//     2. has maps (but no dyn styles):
//        Same structure but triggered by map presence instead of dyn styles.
//
//     3. state-only (no maps, no dyn styles):
//        Compact single-line: if (state.isDirty()) { updates; clearDirty(); }
//
//   Variant updates (_updateVariants) run OUTSIDE the dirty gate —
//   they execute every tick unconditionally.
//
//   Applescript polling also runs outside the dirty gate (every tick).

function _a038_applies(ctx, meta) {
  return (meta.hasState || ctx.objectArrays.length > 0 ||
    (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0));
}

function _a038_emit(ctx, meta) {
  var hasLuaMaps = ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
  var out = '';

  if (meta.hasDynStyles) {
    out += '    if (state.isDirty()) { _updateDynamicTexts();';
    if (meta.hasConds) out += ' _updateConditionals();';
    out += '\n';
    if (meta.hasFlatMaps) out += '        _ = _pool_arena.reset(.retain_capacity);\n';
    for (var mi = 0; mi < ctx.maps.length; mi++) {
      if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
      out += '        _rebuildMap' + mi + '();\n';
    }
    if (hasLuaMaps) out += '        luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
    out += ' state.clearDirty(); }\n';
  } else if (ctx.maps.length > 0 || hasLuaMaps) {
    out += '    if (state.isDirty()) { _updateDynamicTexts();';
    if (meta.hasConds) out += ' _updateConditionals();';
    out += '\n';
    if (meta.hasFlatMaps) out += '        _ = _pool_arena.reset(.retain_capacity);\n';
    for (var mi2 = 0; mi2 < ctx.maps.length; mi2++) {
      if (ctx.maps[mi2].isNested || ctx.maps[mi2].isInline) continue;
      out += '        _rebuildMap' + mi2 + '();\n';
    }
    if (hasLuaMaps) out += '        luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
    out += ' state.clearDirty(); }\n';
  } else {
    out += '    if (state.isDirty()) {';
    out += ' _updateDynamicTexts();';
    if (meta.hasConds) out += ' _updateConditionals();';
    if (hasLuaMaps) out += ' luajit_runtime.callGlobal("__rebuildLuaMaps");';
    out += ' state.clearDirty(); }\n';
  }

  return out;
}

_emitAtoms[38] = {
  id: 38,
  name: 'runtime_dirty_tick',
  group: 'logic_runtime',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/entrypoints.js, emit/runtime_updates.js',
  applies: _a038_applies,
  emit: _a038_emit,
};
