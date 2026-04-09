// ── Parity Intercept ────────────────────────────────────────────
//
// When globalThis.__parityMode is set, wraps emitOutput() to also
// run runEmitAtoms() on the same ctx, storing atom output in
// globalThis.__parityAtomOutput for forge to read.
//
// Loaded AFTER emit.js and emit_atoms/index.js via smith_LOAD_ORDER.txt.

(function() {
  if (typeof emitOutput !== 'function') return;
  if (typeof runEmitAtoms !== 'function') return;

  var _origEmitOutput = emitOutput;

  emitOutput = function(rootExpr, file) {
    // Always run legacy path
    var legacyOut = _origEmitOutput(rootExpr, file);

    // If parity mode, also run atoms
    if (globalThis.__parityMode) {
      try {
        var basename = file.split('/').pop();
        var pfLane = (ctx && ctx._preflight) ? ctx._preflight.lane : 'unknown';
        var prefix = 'framework/';
        var hasState = ctx && ctx.stateSlots && ctx.stateSlots.length > 0;
        var hasDynText = ctx && ctx.dynCount > 0;
        var oa = (ctx && ctx.objectArrays) || [];
        var hasDynamicOA = false;
        for (var _i = 0; _i < oa.length; _i++) {
          if (!oa[_i].isConst && !oa[_i].isNested) { hasDynamicOA = true; break; }
        }
        var fastBuild = globalThis.__fastBuild === 1;
        var hasScriptRuntime = hasDynamicOA || (ctx && ctx.scriptBlock) || (ctx && ctx.luaBlock) || globalThis.__scriptContent;
        var hasLuaMaps = ctx && ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
        var promotedToPerItem = (typeof computePromotedMapArrays === 'function')
          ? computePromotedMapArrays(ctx) : {};

        // Approximate runtime section flags from ctx
        var conds = (ctx && ctx.conditionals) || [];
        var variants = (ctx && ctx.variants) || [];
        var dynStyles = (ctx && ctx.dynStyles) || [];
        var maps = (ctx && ctx.maps) || [];
        var hasConds = conds.length > 0;
        var hasVariants = variants.length > 0;
        var hasDynStyles = dynStyles.length > 0;
        var hasFlatMaps = false;
        for (var _j = 0; _j < maps.length; _j++) {
          if (!maps[_j].isNested && maps[_j].mapBackend !== 'lua_runtime') { hasFlatMaps = true; break; }
        }

        var meta = {
          basename: basename,
          appName: basename.replace(/\.tsz$/, ''),
          pfLane: pfLane,
          prefix: prefix,
          hasState: hasState,
          hasDynText: hasDynText,
          hasDynamicOA: hasDynamicOA,
          fastBuild: fastBuild,
          hasScriptRuntime: hasScriptRuntime,
          hasLuaMaps: hasLuaMaps,
          hasRuntimeLog: ctx && ctx._needsRuntimeLog === true,
          promotedToPerItem: promotedToPerItem,
          rootExpr: rootExpr,
          hasConds: hasConds,
          hasVariants: hasVariants,
          hasDynStyles: hasDynStyles,
          hasFlatMaps: hasFlatMaps,
        };

        // runEmitAtoms calls atom.emit(ctx, meta) but a046 expects (out, ctx, file).
        // Run atoms 1-45 via runEmitAtoms, then apply a046 post-pass manually.
        var saved46 = _emitAtoms[46];
        _emitAtoms[46] = null;
        var atomOut = runEmitAtoms(ctx, meta);
        _emitAtoms[46] = saved46;

        // Apply a046 post-pass (debug appendix + undefined-zeroing)
        if (saved46 && saved46.applies(ctx, meta)) {
          atomOut = saved46.emit(atomOut, ctx, file);
        }

        globalThis.__parityAtomOutput = atomOut;
      } catch (e) {
        globalThis.__parityAtomOutput = '__PARITY_ERROR__: ' + (e.message || e) + ' stack: ' + (e.stack || 'none');
      }
    }

    return legacyOut;
  };
})();
