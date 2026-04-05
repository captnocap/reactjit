// ── Emit Atom 028: Inline map rebuild ───────────────────────────
// Index: 28
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: inline OA-backed maps rendered inside another map item.
// Output target: inline child rebuilds and parent child assignment.
//
// Notes:
//   In the live emitter, inline map rebuilds are emitted INLINE inside
//   the parent flat map rebuild loop (atom 026). This atom exists as
//   a reference catalog of the inline rebuild logic extracted from
//   emitMapPoolRebuilds() lines 643-871.
//
//   The inline rebuild:
//   1. Sets _map_count_{imi}[_i] from the inline OA length
//   2. Loops _j over the inline items per parent iteration
//   3. Formats dynamic texts with [_i][_j] indexing
//   4. Builds handler ptrs with (outer, inner) or (inner) args
//   5. Fills per-item arrays with _i→_j field ref fixup
//   6. Constructs inner arrays with the same _i→_j rewriting
//   7. Builds the pool node, hoisting .style if needed
//   8. Evaluates per-item conditionals with resolveInlineCond()
//   9. Binds the inline pool slice to the parent per-item array
//
//   The _i→_j rewrite preserves outer-scope @as(i64, @intCast(_i))
//   references using a placeholder pattern (__SMITH_OUTER_I64_I__).
//
//   This atom produces no output — atom 026 handles it. It serves as
//   documentation of the inline rebuild contract.

function _a028_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.isInline; });
}

function _a028_emit(ctx, meta) { return ""; /* live emit in map_pools.js */ }

_emitAtoms[28] = {
  id: 28,
  name: 'inline_map_rebuild',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a028_applies,
  emit: _a028_emit,
};
