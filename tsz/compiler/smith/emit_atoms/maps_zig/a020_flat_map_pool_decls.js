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

function _a020_emit(ctx, meta) {
  var mapOrder = meta._mapOrder;
  if (!mapOrder) return '';

  var out = '';
  var hasFlatMaps = ctx.maps.some(function(m) { return !m.isNested && !m.isInline; });
  if (hasFlatMaps) {
    out += 'var _pool_arena: std.heap.ArenaAllocator = std.heap.ArenaAllocator.init(std.heap.page_allocator);\n';
  }

  for (var oi = 0; oi < mapOrder.length; oi++) {
    var mi = mapOrder[oi];
    var map = ctx.maps[mi];
    if (map.isNested || map.isInline) continue;

    if (map.oa && map.oa._computedColors && map.oa._computedColors.length > 0) {
      out += '// computed-map colors: ' + map.oa._computedColors.join(' ') + '\n';
    }
    if (map.oa && map.oa._computedHasTernary) {
      out += '// .none else .flex\n';
    }
    out += 'const MAX_MAP_' + mi + ': usize = 4096;\n';
    out += 'var _map_pool_' + mi + ': []Node = undefined;\n';
    out += 'var _map_count_' + mi + ': usize = 0;\n';
  }

  return out;
}

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
