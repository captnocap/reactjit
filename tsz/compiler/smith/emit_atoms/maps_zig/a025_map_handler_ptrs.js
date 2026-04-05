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

function _a025_emit(ctx, meta) { return ""; /* live emit in map_pools.js */ }

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
