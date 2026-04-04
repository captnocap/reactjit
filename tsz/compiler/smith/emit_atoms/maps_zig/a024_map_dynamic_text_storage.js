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

function applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.dynTexts.some(function(dt) { return dt.inMap; });
}

function emit(ctx, meta) {
  var mapOrder = meta._mapOrder;
  if (!mapOrder) return '';

  var out = '';
  for (var oi = 0; oi < mapOrder.length; oi++) {
    var mi = mapOrder[oi];
    var map = ctx.maps[mi];

    var mapDynTexts = ctx.dynTexts.filter(function(dt) {
      return dt.inMap && dt.mapIdx === mi;
    });
    if (mapDynTexts.length === 0) continue;

    var texSizeConst = map.isNested ? 'MAX_FLAT_' + mi : map.isInline ? null : 'MAX_MAP_' + mi;
    var declaredBufIds = new Set();
    for (var di = 0; di < mapDynTexts.length; di++) {
      var dt = mapDynTexts[di];
      dt._mapTextIdx = dt.bufId;
      if (declaredBufIds.has(dt.bufId)) continue;
      declaredBufIds.add(dt.bufId);
      if (map.isInline) {
        out += 'var _map_text_bufs_' + mi + '_' + dt.bufId + ': [MAX_INLINE_OUTER_' + mi + '][MAX_MAP_' + mi + '][256]u8 = undefined;\n';
        out += 'var _map_texts_' + mi + '_' + dt.bufId + ': [MAX_INLINE_OUTER_' + mi + '][MAX_MAP_' + mi + '][]const u8 = undefined;\n';
      } else {
        out += 'var _map_text_bufs_' + mi + '_' + dt.bufId + ': [' + texSizeConst + '][256]u8 = undefined;\n';
        out += 'var _map_texts_' + mi + '_' + dt.bufId + ': [' + texSizeConst + '][]const u8 = undefined;\n';
      }
    }

    // Stash mapDynTexts on per-map meta
    if (meta._perMap && meta._perMap[mi]) {
      meta._perMap[mi].mapDynTexts = mapDynTexts;
    }
  }

  return out;
}

module.exports = {
  id: 24,
  name: 'map_dynamic_text_storage',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: applies,
  emit: emit,
};
