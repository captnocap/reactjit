// ── Emit Atom 024: Map dynamic text storage ─────────────────────
// Index: 24
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: maps with dynamic text (template literals, fmt expressions).
// Output target: _map_text_bufs_N_B and _map_texts_N_B arrays.
//
// Notes:
//   Each dynamic text slot in a map gets a [MAX][256]u8 buffer array
//   and a [MAX][]const u8 slice array. Inline maps get 3D arrays
//   [outer][inner][256]u8 for the extra nesting dimension.

function _a024_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.dynTexts.some(function(dt) { return dt.inMap; });
}

function _a024_emit(ctx, meta) { return ""; /* live emit in map_pools.js */ }

_emitAtoms[24] = {
  id: 24,
  name: 'map_dynamic_text_storage',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a024_applies,
  emit: _a024_emit,
};
