// ── Atom 6: emit_inner_array.js — Build per-item inner arrays ───
// One function that constructs the inner children array for a map
// node. Replaces tagged map text refs, wires per-item array refs,
// wires nested/inline map children refs, wires handler pointers.
//
// Source: map_pools.js lines 900-965 (flat inner array construction)

// emitInnerArray(innerDecl, mapIdx, innerArr, innerCount, mapDynTexts,
//                dtConsumed, innerTextSlots, ctx, map, mapHandlers,
//                promotedToPerItem, indent)
//
// innerDecl:        the var declaration string for the inner array
// mapIdx:           current map index
// innerArr:         inner array name (e.g. '_arr_5')
// innerCount:       number of elements in inner array
// mapDynTexts:      dynTexts for this map
// dtConsumed:       number of dynTexts already consumed by per-item arrays
// innerTextSlots:   number of .text = "" slots in inner array
// ctx:              full compiler context
// map:              current map object
// mapHandlers:      handlers for this map
// promotedToPerItem: Set of promoted array names
// indent:           indentation string
//
// Returns: { out: string, poolNodeInnerRef: string }
//   out: Zig lines for inner array construction
//   poolNodeInnerRef: the variable name to use in pool node (.children = ...)

function emitInnerArray(innerDecl, mapIdx, innerArr, innerCount, mapDynTexts,
                        dtConsumed, innerTextSlots, ctx, map, mapHandlers,
                        promotedToPerItem, indent) {
  var out = '';
  var inner = innerDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');

  // Replace tagged map text refs in inner array
  for (var dti = 0; dti < mapDynTexts.length; dti++) {
    var dt = mapDynTexts[dti];
    var ti = dt._mapTextIdx;
    inner = inner.replace('"__mt' + ti + '__"', '_map_texts_' + mapIdx + '_' + ti + '[_i]');
  }

  // Legacy fallback: replace remaining untagged .text = "" sequentially
  for (var dti2 = dtConsumed; dti2 < dtConsumed + innerTextSlots && dti2 < mapDynTexts.length; dti2++) {
    var dt2 = mapDynTexts[dti2];
    var ti2 = dt2._mapTextIdx;
    inner = inner.replace('.text = ""', '.text = _map_texts_' + mapIdx + '_' + ti2 + '[_i]');
  }

  // Replace references to per-item arrays from ALL maps
  for (var mj = 0; mj < ctx.maps.length; mj++) {
    var otherMap = ctx.maps[mj];
    if (!otherMap._mapPerItemDecls) continue;
    for (var pi = 0; pi < otherMap._mapPerItemDecls.length; pi++) {
      var pid = otherMap._mapPerItemDecls[pi];
      if (!otherMap.isNested && !otherMap.isInline) {
        inner = inner.replace(new RegExp('&' + pid.name + '\\b', 'g'), '_pi_' + pid.name + '_' + mj);
      } else {
        inner = inner.replace(new RegExp('&' + pid.name + '\\b', 'g'), '&_map_' + pid.name + '_' + mj + '[_i]');
      }
    }
  }

  // Replace nested/inline map shared children refs with per-group pool slices
  for (var nmi = 0; nmi < ctx.maps.length; nmi++) {
    var nm = ctx.maps[nmi];
    var isChildOfThisMap = (nm.isNested && nm.parentOaIdx === map.oaIdx) || (nm.isInline && nm.parentMap === map);
    if (!isChildOfThisMap) continue;
    if (nm.parentArr && inner.includes('&' + nm.parentArr)) {
      inner = inner.replace('&' + nm.parentArr, '_map_pool_' + nmi + '[_i][0.._map_count_' + nmi + '[_i]]');
    }
  }

  // Wire handler refs with per-item handler string pointers
  var pressField = 'lua_on_press';
  for (var mj2 = 0; mj2 < ctx.maps.length; mj2++) {
    var allMH = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === mj2; });
    for (var hi = 0; hi < allMH.length; hi++) {
      var mh = allMH[hi];
      var ptrReplacement = '.' + pressField + ' = _map_lua_ptrs_' + mj2 + '_' + hi + '[_i]';
      if (mh.luaBody) {
        var escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        var escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        inner = inner.replace(new RegExp('\\.lua_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
        inner = inner.replace(new RegExp('\\.js_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
      }
      inner = inner.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh.name, 'g'), '.' + pressField + ' = _map_lua_ptrs_' + mj2 + '_' + hi + '[_i]');
    }
  }

  // Replace raw map index param with Zig loop variable
  var idxParam = map.indexParam || 'i';
  if (idxParam !== '_i') {
    inner = inner.replace(new RegExp('\\b' + idxParam + '\\b', 'g'), '@as(i64, @intCast(_i))');
  }

  out += indent + 'const _inner_' + mapIdx + ' = _pool_arena.allocator().alloc(Node, ' + innerCount + ') catch unreachable;\n';
  out += indent + '@memcpy(_inner_' + mapIdx + ', &[_]Node{ ' + inner + ' });\n';

  return { out: out, innerRef: '_inner_' + mapIdx };
}
