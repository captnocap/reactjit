// ── Emit Atom 040: App tick ─────────────────────────────────────
// Index: 40
// Group: entry
// Target: zig
// Status: complete
// Current owner: emit/entrypoints.js
//
// Trigger: every app emit.
// Output target: _appTick() runtime refresh and Lua/JS tick orchestration.

function _a040_applies(ctx, meta) {
  void ctx; void meta;
  return true;
}

function _a040_emit(ctx, meta) {
  var hasLuaMaps = ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;

  var out = 'fn _appTick(now: u32) void {\n    _ = now;\n';

  if (ctx.usesApplescript) out += '    @import("framework/applescript.zig").pollResult();\n';

  if (meta.hasState || ctx.objectArrays.length > 0 || hasLuaMaps) {
    if (meta.hasDynStyles || ctx.maps.length > 0 || hasLuaMaps) {
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
    } else {
      out += '    if (state.isDirty()) {';
      out += ' _updateDynamicTexts();';
      if (meta.hasConds) out += ' _updateConditionals();';
      if (hasLuaMaps) out += ' luajit_runtime.callGlobal("__rebuildLuaMaps");';
      out += ' state.clearDirty(); }\n';
    }
  }

  if (meta.hasVariants) out += '    _updateVariants();\n';
  out += '}\n\n';
  return out;
}

_emitAtoms[40] = {
  id: 40,
  name: 'app_tick',
  group: 'entry',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/entrypoints.js',
  applies: _a040_applies,
  emit: _a040_emit,
};
