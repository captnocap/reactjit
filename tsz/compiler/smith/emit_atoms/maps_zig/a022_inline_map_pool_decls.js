// ─�� Emit Atom 022: Inline map pool declarations ───��─────────────
// Index: 22
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: inline OA-backed maps (isInline = true).
// Output target: MAX_MAP_*, MAX_INLINE_OUTER_* constants,
//   fixed 2D pool arrays [outer][inner]Node, count arrays [outer]usize.
//
// Notes:
//   Inline maps are separate-OA maps inside another map's JSX template.
//   Their pools are fixed-size 2D arrays indexed by [parent_i][inline_j].
//   _parentMi is stashed on the map for rebuild-time parent reference.

function _a022_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.isInline; });
}

function _a022_emit(ctx, meta) {
  var mapOrder = meta._mapOrder;
  if (!mapOrder) return '';

  var out = '';
  for (var oi = 0; oi < mapOrder.length; oi++) {
    var mi = mapOrder[oi];
    var map = ctx.maps[mi];
    if (!map.isInline) continue;

    var parentMi = ctx.maps.indexOf(map.parentMap);
    map._parentMi = parentMi;

    if (map.oa && map.oa._computedColors && map.oa._computedColors.length > 0) {
      out += '// computed-map colors: ' + map.oa._computedColors.join(' ') + '\n';
    }
    if (map.oa && map.oa._computedHasTernary) {
      out += '// .none else .flex\n';
    }

    out += 'const MAX_MAP_' + mi + ': usize = 16;\n';
    out += 'const MAX_INLINE_OUTER_' + mi + ': usize = 8;\n';
    out += 'var _map_pool_' + mi + ': [MAX_INLINE_OUTER_' + mi + '][MAX_MAP_' + mi + ']Node = undefined;\n';
    out += 'var _map_count_' + mi + ': [MAX_INLINE_OUTER_' + mi + ']usize = undefined;\n';
  }

  return out;
}

_emitAtoms[22] = {
  id: 22,
  name: 'inline_map_pool_decls',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a022_applies,
  emit: _a022_emit,
};
