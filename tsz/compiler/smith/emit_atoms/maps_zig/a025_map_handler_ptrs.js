// ── Emit Atom 025: Map handler ptrs ────────────────���────────────
// Index: 25
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: maps with event handlers (on_press inside .map()).
// Output target: _map_lua_bufs_N_H and _map_lua_ptrs_N_H arrays,
//   plus _initMapLuaPtrsN_H() functions for simple flat map handlers.
//
// Notes:
//   Each handler in a map gets a per-item buffer for building the
//   Lua callback string ("__mapPress_N_H(idx)"). Flat maps without
//   field refs get a pre-init function. Handlers with field refs
//   build ptrs inline during rebuild (not here).
//   Inline maps get 3D arrays [outer][inner][bufSize]u8.

function _a025_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.handlers.some(function(h) { return h.inMap; });
}

function _a025_emit(ctx, meta) {
  void meta;
  const emitMeta = ctx._mapEmitMeta;
  if (!emitMeta) return "";
  const mapOrder = emitMeta.mapOrder;
  const mapMeta = emitMeta.mapMeta || (emitMeta.mapMeta = []);

  let out = '';
  ensureMapHandlerFieldRefs(ctx);

  for (const mi of mapOrder) {
    const map = ctx.maps[mi];
    const mapType = map.isInline ? 'inline' : map.isNested ? 'nested' : 'flat';
    if (map.mapBackend === 'lua_runtime') continue;

    const mapHandlers = ctx.handlers.filter(function(handler) {
      return handler.inMap && handler.mapIdx === mi;
    });
    if (mapHandlers.length > 0 && map.mapBackend !== 'lua_runtime') {
      for (let hi = 0; hi < mapHandlers.length; hi++) {
        const refsMap = map._handlerFieldRefsMap || {};
        const bufSize = refsMap[hi] && refsMap[hi].length > 0 ? 128 : 48;
        out += emitHandlerStorage(mi, hi, bufSize, mapType);
      }
    }

    if (!mapMeta[mi]) mapMeta[mi] = {};
    mapMeta[mi].mapHandlers = mapHandlers;
  }

  return out;
}

_emitAtoms[25] = {
  id: 25,
  name: 'map_handler_ptrs',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a025_applies,
  emit: _a025_emit,
};
