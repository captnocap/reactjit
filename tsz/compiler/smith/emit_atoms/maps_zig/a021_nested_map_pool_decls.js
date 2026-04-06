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

function _a021_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.isNested; });
}

function _a021_emit(ctx, meta) {
  void meta;
  const mapMeta = ctx._mapEmitMeta;
  if (!mapMeta) return "";
  const mapOrder = mapMeta.mapOrder;

  let out = '';
  for (const mi of mapOrder) {
    const map = ctx.maps[mi];
    if (!map.isNested) continue;
    if (map.mapBackend === 'lua_runtime') continue;
    if (map.oa && map.oa._computedColors && map.oa._computedColors.length > 0) {
      out += `// computed-map colors: ${map.oa._computedColors.join(' ')}\n`;
    }
    if (map.oa && map.oa._computedHasTernary) {
      out += `// .none else .flex\n`;
    }
    const parentMap = ctx.maps.find(function(parent) {
      return parent.oaIdx === map.parentOaIdx && !parent.isNested;
    });
    const parentMi = parentMap ? ctx.maps.indexOf(parentMap) : 0;
    map._parentMi = parentMi;
    const parentPoolSize = parentMap && !parentMap.isNested ? 128 : 64;
    out += emitMapDecl(mi, 'nested', parentPoolSize);
  }

  return out;
}

_emitAtoms[21] = {
  id: 21,
  name: 'nested_map_pool_decls',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a021_applies,
  emit: _a021_emit,
};
