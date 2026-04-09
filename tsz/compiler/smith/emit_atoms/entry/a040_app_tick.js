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
  if (globalThis.__parityMode) return '';
  var hasLuaMaps = ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
  var hasFlatMaps = !!(meta.hasFlatMaps || (ctx.maps && ctx.maps.some(function(m) { return !m.isNested && !m.isInline; })));

  var out = 'fn _appTick(now: u32) void {\n';
  out += '    _ = now;\n';

  if (ctx.usesApplescript) out += '    @import("framework/applescript.zig").pollResult();\n';

  if (meta.hasState || ctx.objectArrays.length > 0 || hasLuaMaps) {
    if (meta.hasDynStyles) {
      out += '    if (state.isDirty()) { _updateDynamicTexts();';
      if (meta.hasConds) out += ' _updateConditionals();';
      out += '\n';
      if (hasFlatMaps) out += '        _ = _pool_arena.reset(.retain_capacity);\n';
      for (var mi = 0; mi < ctx.maps.length; mi++) {
        if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
        if (ctx.maps[mi].mapBackend === 'lua_runtime') continue;
        out += '        _rebuildMap' + mi + '();\n';
      }
      if (hasLuaMaps) {
        for (var ldi = 0; ldi < ctx._luaMapRebuilders.length; ldi++) {
          if (ctx._luaMapRebuilders[ldi].isNested) continue;
          var ldSrc = (ctx._luaMapRebuilders[ldi].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          out += '        qjs_runtime.evalLuaMapData(' + ldi + ', "' + ldSrc + '");\n';
        }
        out += '        luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
      }
      out += ' state.clearDirty(); }\n';
    } else if (ctx.maps.length > 0 || hasLuaMaps) {
      out += '    if (state.isDirty()) { _updateDynamicTexts();';
      if (meta.hasConds) out += ' _updateConditionals();';
      out += '\n';
      if (hasFlatMaps) out += '        _ = _pool_arena.reset(.retain_capacity);\n';
      for (var mi2 = 0; mi2 < ctx.maps.length; mi2++) {
        if (ctx.maps[mi2].isNested || ctx.maps[mi2].isInline) continue;
        if (ctx.maps[mi2].mapBackend === 'lua_runtime') continue;
        out += '        _rebuildMap' + mi2 + '();\n';
      }
      if (hasLuaMaps) {
        for (var ldi2 = 0; ldi2 < ctx._luaMapRebuilders.length; ldi2++) {
          if (ctx._luaMapRebuilders[ldi2].isNested) continue;
          var ldSrc2 = (ctx._luaMapRebuilders[ldi2].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          out += '        qjs_runtime.evalLuaMapData(' + ldi2 + ', "' + ldSrc2 + '");\n';
        }
        out += '        luajit_runtime.callGlobal("__rebuildLuaMaps");\n';
      }
      out += ' state.clearDirty(); }\n';
    } else {
      out += '    if (state.isDirty()) {';
      out += ' _updateDynamicTexts();';
      if (meta.hasConds) out += ' _updateConditionals();';
      if (hasLuaMaps) {
        for (var ldi3 = 0; ldi3 < ctx._luaMapRebuilders.length; ldi3++) {
          if (ctx._luaMapRebuilders[ldi3].isNested) continue;
          var ldSrc3 = (ctx._luaMapRebuilders[ldi3].rawSource || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          out += ' qjs_runtime.evalLuaMapData(' + ldi3 + ', "' + ldSrc3 + '");';
        }
        out += ' luajit_runtime.callGlobal("__rebuildLuaMaps");';
      }
      out += ' state.clearDirty(); }\n';
    }
  }

  if (meta.hasVariants) out += '    _updateVariants();\n';
  // qjs_runtime.tick()/luajit_runtime.tick() not needed — the engine
  // drives VM ticks from its own loop, not from the generated cart.
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
