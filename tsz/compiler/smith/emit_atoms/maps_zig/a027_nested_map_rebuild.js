// ── Emit Atom 027: Nested map rebuild ───────────────────────────
// Index: 27
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: nested OA-backed maps under a parent flat map.
// Output target: nested child pool rebuilds inside parent loops.
//
// Notes:
//   In the live emitter, nested map rebuilds are emitted INLINE inside
//   the parent flat map rebuild loop (atom 026). This atom exists as
//   a reference catalog of the nested rebuild logic extracted from
//   emitMapPoolRebuilds() lines 550-641.
//
//   The nested rebuild:
//   1. Iterates _oa{cidx}_len scanning for _oa{cidx}_parentIdx == _i
//   2. For each match, formats nested dynamic texts with _flat_j indexing
//   3. Builds per-item inner arrays from shared declaration templates
//   4. Constructs nested handler ptrs with (parent_idx, item_idx) args
//   5. Assigns the pool node and increments the nested count
//
//   This atom produces no output — atom 026 handles it. It serves as
//   documentation of the nested rebuild contract.

function applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.isNested; });
}

function emit(ctx, meta) {
  void ctx; void meta;
  // Nested rebuilds are emitted inline by atom 026 (flat_map_rebuild).
  // This atom is a reference/documentation placeholder.
  return '';
}

module.exports = {
  id: 27,
  name: 'nested_map_rebuild',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: applies,
  emit: emit,
};
