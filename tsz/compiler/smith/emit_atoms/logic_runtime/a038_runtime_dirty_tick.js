// ── Emit Atom 038: Runtime dirty tick ───────────────────────────
// Index: 38
// Group: logic_runtime
// Target: zig
// Status: complete
// Current owner: emit/entrypoints.js, emit/runtime_updates.js
//
// Trigger: any state, OA, or Lua map activity that requires dirty-driven refresh.
// Output target: fn _dirtyTick() void { ... } with runtime refresh
//   calls for dynamic text, conditionals, map rebuilds, and Lua rebuilds.
//
// Notes:
//   This atom captures the body of the legacy _dirtyTick() helper from
//   runtime_updates.js. The entry/tick wrappers are emitted elsewhere.
//
//   Three code paths based on what the app uses:
//     1. dynamic text / conditionals / styles / colors
//     2. flat map rebuilds with arena reset
//     3. Lua map data evaluation + __rebuildLuaMaps dispatch
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
  var out = 'fn _dirtyTick() void {\n';

  out += '    _updateDynamicTexts();\n';
  if (meta.hasConds) out += '    _updateConditionals();\n';
  if (meta.hasDynStyles && meta.hasDynText) out += '    _updateDynamicStyles();\n';
  if (meta.hasVariants) out += '    _updateVariants();\n';
  if (meta.hasFlatMaps) out += '    _ = _pool_arena.reset(.retain_capacity);\n';
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
    out += '    _rebuildMap' + mi + '();\n';
  }
  if (hasLuaMaps) {
    for (var ldi = 0; ldi < ctx._luaMapRebuilders.length; ldi++) {
      if (ctx._luaMapRebuilders[ldi].isNested) continue;
      var ldSrc = (ctx._luaMapRebuilders[ldi].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      out += '    qjs_runtime.evalLuaMapData(' + ldi + ', "' + ldSrc + '");\n';
    }
    out += '    luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
  }
  out += '}\n\n';

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
