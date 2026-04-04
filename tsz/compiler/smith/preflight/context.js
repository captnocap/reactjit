// ── Preflight scan context ───────────────────────────────────────

function derivePreflightIntents(ctx) {
  return {
    has_maps: ctx.maps.length > 0,
    has_map_handlers: ctx.handlers.some(function(h) { return h.inMap; }),
    has_state: ctx.stateSlots.length > 0,
    has_script_block: ctx.scriptBlock !== null || !!globalThis.__scriptContent,
    has_lua_block: ctx.luaBlock !== null,
    has_dynTexts: ctx.dynTexts.length > 0,
    has_dynColors: ctx.dynColors.length > 0,
    has_dynStyles: !!(ctx.dynStyles && ctx.dynStyles.length > 0),
    has_classifiers: Object.keys(ctx.classifiers).length > 0,
    has_components: ctx.components.length > 0,
    has_object_arrays: ctx.objectArrays.length > 0,
  };
}

function detectPreflightLane(ctx, intents) {
  if (ctx && ctx._sourceTier) return ctx._sourceTier;
  var lane = 'chad';
  if (intents.has_script_block) lane = 'soup';
  else if (intents.has_dynTexts || intents.has_dynColors || intents.has_dynStyles) lane = 'mixed';
  return lane;
}

// Classify each map as 'zig_oa' or 'lua_runtime'.
// Clean OA-backed structural data → Zig emit.
// Runtime/computed/chained/render-local sources → LuaJIT emit.
function classifyMapBackends(ctx) {
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var map = ctx.maps[mi];
    var oa = map.oa;

    // Already classified (e.g. by _luaMapRebuilders detection in brace.js)
    if (map.mapBackend) continue;

    // No OA → runtime
    if (!oa) {
      map.mapBackend = 'lua_runtime';
      continue;
    }

    // OA has _computedExpr → runtime (data comes from JS eval, not registered state)
    if (oa._computedExpr) {
      // Exception: _computedExpr that is just a getter name (direct state OA) → zig_oa
      var isDirectGetter = /^[A-Za-z_]\w*$/.test(oa._computedExpr) && isGetter(oa._computedExpr);
      if (!isDirectGetter) {
        map.mapBackend = 'lua_runtime';
        continue;
      }
    }

    // OA source is a render-local → runtime
    if (oa.getter && ctx.renderLocals && ctx.renderLocals[oa.getter] !== undefined) {
      map.mapBackend = 'lua_runtime';
      continue;
    }

    // Default: clean OA-backed → Zig
    map.mapBackend = 'zig_oa';
  }
}

function buildPreflightScanState(ctx, intents) {
  // Classify map backends before emit planning
  classifyMapBackends(ctx);

  var allDecls = ctx.arrayDecls.slice();
  for (var dti = 0; dti < ctx.dynTexts.length; dti++) {
    if (ctx.dynTexts[dti].fmtArgs) allDecls.push(ctx.dynTexts[dti].fmtArgs);
  }

  var allComments = (ctx.arrayComments || []).slice();
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].mapArrayDecls) {
      allDecls = allDecls.concat(ctx.maps[mi].mapArrayDecls);
      allComments = allComments.concat(ctx.maps[mi].mapArrayComments || []);
    }
  }

  var handlerNameSet = {};
  for (var hi = 0; hi < ctx.handlers.length; hi++) {
    handlerNameSet[ctx.handlers[hi].name] = true;
  }

  var luaMapCount = 0;
  var zigMapCount = 0;
  for (var mci = 0; mci < ctx.maps.length; mci++) {
    if (ctx.maps[mci].mapBackend === 'lua_runtime') luaMapCount++;
    else zigMapCount++;
  }

  return {
    intents: intents,
    lane: detectPreflightLane(ctx, intents),
    allDecls: allDecls,
    allComments: allComments,
    handlerNameSet: handlerNameSet,
    luaMapCount: luaMapCount,
    zigMapCount: zigMapCount,
  };
}
