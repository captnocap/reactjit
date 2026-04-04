// ── Emit Atom 023: Map per-item arrays ──────────────────────────
// Index: 23
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: maps with mapArrayDecls that need per-iteration allocation.
// Output target: _map_arr_*_N storage declarations for nested/inline maps,
//   static array declarations for non-promoted arrays, inner array storage.
//
// Notes:
//   Per-item arrays are child node arrays that must be independently
//   allocated for each map iteration (because they contain dynamic text,
//   per-item refs, or other per-iteration state).
//   For flat maps, these are arena-allocated at rebuild time.
//   For nested/inline maps, these are fixed 2D/3D arrays declared here.

function _a023_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.mapArrayDecls && m.mapArrayDecls.length > 0; });
}

function _a023_emit(ctx, meta) {
  var mapOrder = meta._mapOrder;
  var promotedToPerItem = meta._promotedToPerItem;
  var countEntries = meta._countTopLevelNodeDeclEntries;
  if (!mapOrder) return '';

  var out = '';
  var emittedMapArrays = new Set();

  for (var oi = 0; oi < mapOrder.length; oi++) {
    var mi = mapOrder[oi];
    var map = ctx.maps[mi];

    var mapPerItemDecls = [];
    if (map.mapArrayDecls && map.mapArrayDecls.length > 0) {
      var declMap = {};
      for (var di = 0; di < map.mapArrayDecls.length; di++) {
        var decl = map.mapArrayDecls[di];
        var match = decl.match(/^var (_arr_\d+)/);
        if (match) declMap[match[1]] = decl;
      }

      var needsPerItem = new Set();
      for (var pn of promotedToPerItem) {
        if (declMap[pn]) needsPerItem.add(pn);
      }
      var pendingMapDynTexts = ctx.dynTexts.filter(function(dt) {
        return dt.inMap && dt.mapIdx === mi;
      });
      for (var entry of Object.entries(declMap)) {
        var name = entry[0];
        var d = entry[1];
        if (d.includes('[_i]') || d.includes('_i)') || d.includes('(_i')) {
          needsPerItem.add(name);
        }
        if (pendingMapDynTexts.length > 0 && (d.includes('.text = ""') || /__mt\d+__/.test(d))) {
          needsPerItem.add(name);
        }
      }

      var mapArrayNames = new Set(Object.keys(declMap));
      var staticOnlyNames = new Set();
      for (var ai = 0; ai < ctx.arrayDecls.length; ai++) {
        var am = ctx.arrayDecls[ai].match(/^var (_arr_\d+)/);
        if (am && !mapArrayNames.has(am[1])) staticOnlyNames.add(am[1]);
      }

      for (var e1 of Object.entries(declMap)) {
        var n1 = e1[0];
        if (staticOnlyNames.has(n1)) continue;
        for (var e2 of Object.entries(declMap)) {
          if (e2[0] === n1) continue;
          if (e2[1].includes('&' + n1)) {
            needsPerItem.add(n1);
            break;
          }
        }
      }

      var changed = true;
      while (changed) {
        changed = false;
        for (var e3 of Object.entries(declMap)) {
          var n3 = e3[0];
          var d3 = e3[1];
          if (needsPerItem.has(n3) || staticOnlyNames.has(n3)) continue;
          for (var piName of needsPerItem) {
            if (d3.includes('&' + piName)) {
              needsPerItem.add(n3);
              changed = true;
              break;
            }
          }
        }
      }

      for (var e4 of Object.entries(declMap)) {
        var arrName = e4[0];
        var arrDecl = e4[1];
        if (ctx.arrayDecls.some(function(ad) { return ad.startsWith('var ' + arrName); }) && !needsPerItem.has(arrName)) continue;
        if (emittedMapArrays.has(arrName)) continue;
        emittedMapArrays.add(arrName);
        var innerMatch = map.templateExpr ? map.templateExpr.match(/\.children = &(_arr_\d+)/) : null;
        if (innerMatch && arrName === innerMatch[1]) continue;
        if (needsPerItem.has(arrName)) {
          var elemCount = countEntries(arrDecl);
          mapPerItemDecls.push({ name: arrName, decl: arrDecl, elemCount: elemCount });
          if (map.isInline) {
            out += 'var _map_' + arrName + '_' + mi + ': [MAX_INLINE_OUTER_' + mi + '][MAX_MAP_' + mi + '][' + elemCount + ']Node = undefined;\n';
          } else if (map.isNested) {
            out += 'var _map_' + arrName + '_' + mi + ': [MAX_MAP_' + mi + '][' + elemCount + ']Node = undefined;\n';
          }
        } else {
          out += arrDecl + '\n';
        }
      }
    }
    map._mapPerItemDecls = mapPerItemDecls;

    // Inner array storage (children of the pool node template)
    var imMatch = map.templateExpr.match(/\.children = &_arr_(\d+)/);
    var innerArr = imMatch ? '_arr_' + imMatch[1] : null;
    var innerCount = 0;
    if (innerArr) {
      var innerDecl = (map.mapArrayDecls || []).find(function(d) {
        return d.startsWith('var ' + innerArr);
      }) || ctx.arrayDecls.find(function(d) {
        return d.startsWith('var ' + innerArr);
      });
      if (innerDecl) innerCount = countEntries(innerDecl);
    }

    if (innerCount > 0) {
      if (map.isInline) {
        out += 'var _map_inner_' + mi + ': [MAX_INLINE_OUTER_' + mi + '][MAX_MAP_' + mi + '][' + innerCount + ']Node = undefined;\n';
      } else if (map.isNested) {
        out += 'var _map_inner_' + mi + ': [MAX_FLAT_' + mi + '][' + innerCount + ']Node = undefined;\n';
      }
    }

    // Stash per-map metadata for downstream atoms
    if (!meta._perMap) meta._perMap = {};
    meta._perMap[mi] = {
      mapPerItemDecls: mapPerItemDecls,
      innerCount: innerCount,
      innerArr: innerArr,
    };
  }

  return out;
}

_emitAtoms[23] = {
  id: 23,
  name: 'map_per_item_arrays',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a023_applies,
  emit: _a023_emit,
};
