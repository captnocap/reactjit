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

function applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.isNested; });
}

function emit(ctx, meta) {
  var mapOrder = meta._mapOrder;
  if (!mapOrder) return '';

  var out = '';
  for (var oi = 0; oi < mapOrder.length; oi++) {
    var mi = mapOrder[oi];
    var map = ctx.maps[mi];
    if (!map.isNested) continue;

    var parentMap = ctx.maps.find(function(parent) {
      return parent.oaIdx === map.parentOaIdx && !parent.isNested;
    });
    var parentMi = parentMap ? ctx.maps.indexOf(parentMap) : 0;
    map._parentMi = parentMi;

    if (map.oa && map.oa._computedColors && map.oa._computedColors.length > 0) {
      out += '// computed-map colors: ' + map.oa._computedColors.join(' ') + '\n';
    }
    if (map.oa && map.oa._computedHasTernary) {
      out += '// .none else .flex\n';
    }

    var parentPoolSize = parentMap && !parentMap.isNested ? 128 : 64;
    out += 'const MAX_MAP_' + mi + ': usize = 64;\n';
    out += 'const MAX_FLAT_' + mi + ': usize = 4096;\n';
    out += 'const MAX_NESTED_OUTER_' + mi + ': usize = ' + parentPoolSize + ';\n';
    out += 'var _map_pool_' + mi + ': [MAX_NESTED_OUTER_' + mi + '][MAX_MAP_' + mi + ']Node = undefined;\n';
    out += 'var _map_count_' + mi + ': [MAX_NESTED_OUTER_' + mi + ']usize = undefined;\n';
  }

  return out;
}

module.exports = {
  id: 21,
  name: 'nested_map_pool_decls',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: applies,
  emit: emit,
};
