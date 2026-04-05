// ── Emit Atom 026: Flat map rebuild ─────────────────────────────
// Index: 26
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: top-level OA-backed maps (not nested, not inline).
// Output target: _rebuildMapN() function with arena alloc, per-item
//   text formatting, handler ptr init, per-item array fills, per-item
//   conditionals, nested/inline sub-rebuilds, inner array construction,
//   pool node assignment, filter display toggles, variant patches,
//   deferred canvas attrs, and parent array binding.
//
// Notes:
//   This is the largest single atom — it contains the full flat map
//   rebuild loop from emitMapPoolRebuilds() lines 359-1166.
//   Nested and inline rebuilds are emitted INSIDE this loop body
//   (they run per parent iteration), but are extracted to atoms 027/028
//   as reference. In the live emitter they remain inlined here.

// _wrapMapCondition is a global function defined in a019_map_metadata.js

function _a026_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return !m.isNested && !m.isInline; });
}

function _a026_emit(ctx, meta) { return ""; /* live emit in map_pools.js */ }