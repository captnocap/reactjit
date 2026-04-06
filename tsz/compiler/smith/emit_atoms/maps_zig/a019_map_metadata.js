// ── Emit Atom 019: Map metadata ─────────────────────────────────
// Index: 19
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: ctx.maps.length > 0 for OA-backed maps.
// Output target: map order, field-ref scans, promoted-array metadata.
//
// Notes:
//   This atom produces NO Zig output. It computes metadata that
//   downstream atoms (020-028) depend on:
//   - mapOrder (flat → inline → nested emission ordering)
//   - promotedToPerItem (which arrays need per-iteration allocation)
//   - handler field refs (which OA fields handlers reference)
//   All stored on ctx and meta for downstream consumption.

function _a019_applies(ctx, meta) {
  void meta;
  return ctx.maps && ctx.maps.length > 0;
}

function _a019_emit(ctx, meta) {
  void meta;
  const promotedToPerItem = computePromotedMapArrays(ctx);
  const mapOrder = buildMapEmitOrder(ctx);
  ensureMapHandlerFieldRefs(ctx);
  ctx._mapEmitMeta = {
    promotedToPerItem: promotedToPerItem,
    mapOrder: mapOrder,
  };
  return "";
}

_emitAtoms[19] = {
  id: 19,
  name: 'map_metadata',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a019_applies,
  emit: _a019_emit,
  // Exported for direct use by other atoms and the live emitter
  _wrapMapCondition: wrapCondition,
  buildMapEmitOrder: buildMapEmitOrder,
  ensureMapHandlerFieldRefs: ensureMapHandlerFieldRefs,
  countTopLevelNodeDeclEntries: countTopLevelNodeDeclEntries,
  computePromotedMapArrays: computePromotedMapArrays,
};
