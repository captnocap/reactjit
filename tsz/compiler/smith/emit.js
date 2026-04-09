function buildEmitMeta(ctx, rootExpr, file) {
  var basename = file.split('/').pop();
  var appName = basename.replace(/\.tsz$/, '');
  var hasState = ctx.stateSlots.length > 0;
  var hasDynText = ctx.dynCount > 0;
  var prefix = 'framework/';
  var pfLane = ctx._preflight ? ctx._preflight.lane : 'unknown';
  var hasDynamicOA = ctx.objectArrays.some(function(o) { return !o.isConst && !o.isNested; });
  var fastBuild = globalThis.__fastBuild === 1;
  var hasScriptRuntime = hasDynamicOA || ctx.scriptBlock || ctx.luaBlock || globalThis.__scriptContent;
  var promotedToPerItem = computePromotedMapArrays(ctx);
  var hasConds = ctx.conditionals && ctx.conditionals.length > 0;
  var hasVariants = ctx.variantBindings && ctx.variantBindings.length > 0;
  var hasDynStyles = ctx.dynStyles && ctx.dynStyles.length > 0;
  var hasFlatMaps = ctx.maps && ctx.maps.some(function(m) { return !m.isNested && !m.isInline; });
  var hasLuaMaps = ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
  return {
    basename: basename,
    appName: appName,
    hasState: hasState,
    hasDynText: hasDynText,
    prefix: prefix,
    pfLane: pfLane,
    hasDynamicOA: hasDynamicOA,
    fastBuild: fastBuild,
    hasScriptRuntime: hasScriptRuntime,
    rootExpr: rootExpr,
    promotedToPerItem: promotedToPerItem,
    hasConds: hasConds,
    hasVariants: hasVariants,
    hasDynStyles: hasDynStyles,
    hasFlatMaps: hasFlatMaps,
    hasLuaMaps: hasLuaMaps,
    hasRuntimeLog: ctx._needsRuntimeLog === true,
  };
}

function emitOutput(rootExpr, file) {
  // ── Lua-tree path: if we have a parsed luaNode, emit Lua-first ──
  if (ctx._luaRootNode && typeof emitLuaTreeApp === 'function') {
    var _ltOut = emitLuaTreeApp(ctx, rootExpr, file);
    return finalizeEmitOutput(_ltOut, file);
  }

  // Dump pattern trace if enabled (--dbg-compiler / -c) or if unknowns were hit
  if (ctx._patternTrace.length > 0) {
    var hasUnknowns = false;
    for (var _ti = 0; _ti < ctx._patternTrace.length; _ti++) {
      if (ctx._patternTrace[_ti].indexOf('???') >= 0) { hasUnknowns = true; break; }
    }
    if (hasUnknowns || ctx._patternTraceEnabled) dumpPatternTrace();
  }
  var meta = buildEmitMeta(ctx, rootExpr, file);

  // ── Atom-based emit path (non-lua-tree carts) ──
  var out = runEmitAtoms(ctx, meta);

  return finalizeEmitOutput(out, file);
}
