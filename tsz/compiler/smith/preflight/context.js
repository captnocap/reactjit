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

// Classify each map as 'lua_runtime'.
// All maps go through LuaJIT — dynamic list rebuild, no fixed-size pools.
// Ported from love2d/scripts/tslx_compile.mjs rebuildList pattern:
// Lua iterates items, builds template table, calls __declareChildren.
// No MAX caps, no arena pools, no 6 copy-pasted Zig variants.
function classifyMapBackends(ctx) {
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var map = ctx.maps[mi];
    if (map.mapBackend) continue;
    map.mapBackend = 'lua_runtime';
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

  var luaMapCount = ctx.maps.length;
  var zigMapCount = 0;

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
