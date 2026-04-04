// ── Emit Atom 039: App init ─────────────────────────────────────
// Index: 39
// Group: entry
// Target: zig
// Status: complete
// Current owner: emit/entrypoints.js
//
// Trigger: every app emit.
// Output target: _appInit() setup for state, handlers, maps, wrappers.

function _a039_applies(ctx, meta) {
  void ctx; void meta;
  return true;
}

function _a039_emit(ctx, meta) {
  var out = 'fn _appInit() void {\n    _initState();\n';

  for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
    var oa = ctx.objectArrays[oi];
    if (oa.isNested || oa.isConst) continue;
    out += '    qjs_runtime.registerHostFn("__setObjArr' + oa.oaIdx + '", @ptrCast(&_oa' + oa.oaIdx + '_unpack), 1);\n';
  }

  if (meta.hasVariants) {
    out += '    qjs_runtime.registerHostFn("__setVariant", @ptrCast(&_setVariantHost), 1);\n';
  }

  var inputMod = '@import("' + meta.prefix + 'input.zig")';
  if (ctx._inputSubmitHandlers) {
    for (var si = 0; si < ctx._inputSubmitHandlers.length; si++) {
      var sh = ctx._inputSubmitHandlers[si];
      out += '    ' + inputMod + '.setOnSubmit(' + sh.inputId + ', &_inputSubmit' + sh.inputId + ');\n';
    }
  }
  if (ctx._inputChangeHandlers) {
    for (var ci = 0; ci < ctx._inputChangeHandlers.length; ci++) {
      var ch = ctx._inputChangeHandlers[ci];
      out += '    ' + inputMod + '.setOnChange(' + ch.inputId + ', &_inputChange' + ch.inputId + ');\n';
    }
  }

  if (meta.hasDynText) out += '    _updateDynamicTexts();\n';
  if (meta.hasConds) out += '    _updateConditionals();\n';
  if (meta.hasVariants) out += '    _updateVariants();\n';

  for (var mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].isNested || ctx.maps[mi].isInline) continue;
    var mapHandlers = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === mi; });
    var fieldRefsMap = ctx.maps[mi]._handlerFieldRefsMap || {};
    for (var hi = 0; hi < mapHandlers.length; hi++) {
      var hasFieldRefs = fieldRefsMap[hi] && fieldRefsMap[hi].length > 0;
      if (!hasFieldRefs) out += '    _initMapLuaPtrs' + mi + '_' + hi + '();\n';
    }
  }

  if (meta.hasFlatMaps) out += '    _ = _pool_arena.reset(.retain_capacity);\n';
  for (var mi2 = 0; mi2 < ctx.maps.length; mi2++) {
    if (ctx.maps[mi2].isNested || ctx.maps[mi2].isInline) continue;
    out += '    _rebuildMap' + mi2 + '();\n';
  }

  // Register Lua map wrapper pointers with LuaJIT
  if (ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0) {
    for (var lmi = 0; lmi < ctx._luaMapRebuilders.length; lmi++) {
      for (var ai = 0; ai < ctx.arrayDecls.length; ai++) {
        var decl = ctx.arrayDecls[ai];
        var tag = '__lmw' + lmi;
        var tagIdx = decl.indexOf(tag);
        if (tagIdx >= 0) {
          var arrMatch = decl.match(/^(?:pub )?var (_arr_\d+)/);
          if (arrMatch) {
            var before = decl.substring(0, tagIdx);
            var elemIdx = (before.match(/\.{/g) || []).length - 1;
            out += '    luajit_runtime.setMapWrapper(' + lmi + ', @ptrCast(&nodes.' + arrMatch[1] + '[' + elemIdx + ']));\n';
          }
          break;
        }
      }
    }
  }

  out += '}\n\n';
  return out;
}

_emitAtoms[39] = {
  id: 39,
  name: 'app_init',
  group: 'entry',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/entrypoints.js',
  applies: _a039_applies,
  emit: _a039_emit,
};
