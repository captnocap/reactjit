// ── Emit Atom 023: Map per-item arrays ──────────────────────────
// Index: 23
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: maps with mapArrayDecls that need per-iteration allocation.
// Output target: _map_arr_*_N storage declarations for nested/inline maps,
//   static array declarations for non-promoted arrays, inner array storage.
//
// Notes:
//   Per-item arrays are child node arrays that must be independently
//   allocated for each map iteration (because they contain dynamic text,
//   per-item refs, or other per-iteration state).
//   For flat maps, these are arena-allocated at rebuild time.
//   For nested/inline maps, these are fixed 2D/3D arrays declared here.

function _a023_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.mapArrayDecls && m.mapArrayDecls.length > 0; });
}

function _a023_emit(ctx, meta) { return ""; /* live emit in map_pools.js */ }

_emitAtoms[23] = {
  id: 23,
  name: 'map_per_item_arrays',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a023_applies,
  emit: _a023_emit,
};
