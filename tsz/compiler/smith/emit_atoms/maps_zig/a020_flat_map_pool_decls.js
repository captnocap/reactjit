// ── Emit Atom 020: Flat map pool declarations ──────────────────
// Index: 20
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: top-level OA-backed maps (not nested, not inline).
// Output target: MAX_MAP_* constants, _map_pool_* slices, arena allocator, count storage.
//
// Notes:
//   Flat maps use dynamic arena allocation (std.heap.ArenaAllocator).
//   Pool is a []Node slice allocated per-rebuild, not a fixed array.

function _a020_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return !m.isNested && !m.isInline; });
}

function _a020_emit(ctx, meta) { return ""; /* live emit in map_pools.js */ }

_emitAtoms[20] = {
  id: 20,
  name: 'flat_map_pool_decls',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a020_applies,
  emit: _a020_emit,
};
