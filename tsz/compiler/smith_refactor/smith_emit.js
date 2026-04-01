function emitOutput(rootExpr, file) {
  const basename = file.split('/').pop();
  const appName = basename.replace(/\.tsz$/, '');
  const hasState = ctx.stateSlots.length > 0;
  const hasDynText = ctx.dynCount > 0;
  const prefix = 'framework/';

  let out = '';
  const pfLane = ctx._preflight ? ctx._preflight.lane : 'unknown';
  const hasDynamicOA = ctx.objectArrays.some(o => !o.isConst && !o.isNested);
  const fastBuild = globalThis.__fastBuild === 1;
  const hasScriptRuntime = hasDynamicOA || ctx.scriptBlock || ctx.luaBlock || globalThis.__scriptContent;

  out += emitPreamble({
    basename: basename,
    pfLane: pfLane,
    prefix: prefix,
    hasState: hasState,
    hasDynamicOA: hasDynamicOA,
    hasRuntimeLog: ctx._needsRuntimeLog === true,
    fastBuild: fastBuild,
    hasScriptRuntime: hasScriptRuntime,
  });
  out += emitStateManifest(ctx, hasState);

  const _promotedToPerItem = computePromotedMapArrays(ctx);

  out += emitNodeTree(ctx, rootExpr, _promotedToPerItem);
  out += emitDynamicTextBuffers(ctx);

  // Emit Zig fns for non-map handlers (map handlers dispatch through QuickJS/Lua, no Zig stub needed)
  const nonMapHandlers = ctx.handlers.filter(h => !h.inMap);
  out += emitNonMapHandlers(nonMapHandlers);

  // Effect render functions — transpile JS onRender callbacks to Zig
  out += emitEffectRenders(ctx, prefix);

  out += emitObjectArrayInfrastructure(ctx, {
    fastBuild: fastBuild,
    prefix: prefix,
  });

  // Map pools — two passes: (1) all declarations, (2) all rebuild functions
  const mapPoolDecls = emitMapPoolDeclarations(ctx, _promotedToPerItem);
  const _mapMeta = mapPoolDecls.mapMeta;
  const mapOrder = mapPoolDecls.mapOrder;
  out += mapPoolDecls.out;
  out += emitMapPoolRebuilds(ctx, {
    mapMeta: _mapMeta,
    mapOrder: mapOrder,
    promotedToPerItem: _promotedToPerItem,
  });

  out = appendOrphanedMapArrays(out, ctx);

  if (nonMapHandlers.length > 0 && !out.endsWith('\n\n')) out += '\n';

  out += emitLogicBlocks(ctx);
  out += emitInitState(ctx);
  const runtimeSections = emitRuntimeSupportSections(ctx, {
    promotedToPerItem: _promotedToPerItem,
    rootExpr: rootExpr,
    prefix: prefix,
    fastBuild: fastBuild,
  });
  out += runtimeSections.out;
  out += emitRuntimeEntrypoints(ctx, {
    appName: appName,
    prefix: prefix,
    fastBuild: fastBuild,
    hasState: hasState,
    hasDynText: hasDynText,
    hasConds: runtimeSections.hasConds,
    hasVariants: runtimeSections.hasVariants,
    hasDynStyles: runtimeSections.hasDynStyles,
    hasFlatMaps: runtimeSections.hasFlatMaps,
  });

  return finalizeEmitOutput(out, file);
}
