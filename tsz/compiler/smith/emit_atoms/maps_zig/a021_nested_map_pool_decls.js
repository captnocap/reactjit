// ── Emit Atom 021: Nested map pool declarations ─────────────────
// Index: 21
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: nested OA-backed maps (isNested = true).
// Output target: MAX_MAP_*, MAX_FLAT_*, MAX_NESTED_OUTER_* constants,
//   fixed 2D pool arrays [outer][inner]Node, count arrays [outer]usize.
//
// Notes:
//   Nested maps are children of a parent flat map. Their pools are
//   fixed-size 2D arrays indexed by [parent_i][nested_j].
//   _parentMi is stashed on the map for rebuild-time parent reference.

function _a021_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.isNested; });
}

function _a021_emit(ctx, meta) { return ""; /* live emit in map_pools.js */ }

_emitAtoms[21] = {
  id: 21,
  name: 'nested_map_pool_decls',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a021_applies,
  emit: _a021_emit,
};
