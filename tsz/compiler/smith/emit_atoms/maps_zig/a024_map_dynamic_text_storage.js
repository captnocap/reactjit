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

function _a024_emit(ctx, meta) {
  void meta;
  const emitMeta = ctx._mapEmitMeta;
  if (!emitMeta) return "";
  const mapOrder = emitMeta.mapOrder;
  const mapMeta = emitMeta.mapMeta || (emitMeta.mapMeta = []);

  let out = '';
  for (const mi of mapOrder) {
    const map = ctx.maps[mi];
    const mapType = map.isInline ? 'inline' : map.isNested ? 'nested' : 'flat';
    if (map.mapBackend === 'lua_runtime') continue;

    const mapDynTexts = ctx.dynTexts.filter(function(dt) {
      return dt.inMap && dt.mapIdx === mi;
    });
    const declaredBufIds = new Set();
    for (const dt of mapDynTexts) {
      dt._mapTextIdx = dt.bufId;
      if (declaredBufIds.has(dt.bufId)) continue;
      declaredBufIds.add(dt.bufId);
      out += emitTextStorage(mi, dt.bufId, mapType);
    }

    if (!mapMeta[mi]) mapMeta[mi] = {};
    mapMeta[mi].mapDynTexts = mapDynTexts;
  }

  return out;
}

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
