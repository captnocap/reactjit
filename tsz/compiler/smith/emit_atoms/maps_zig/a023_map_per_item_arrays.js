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
  void meta;
  const emitMeta = ctx._mapEmitMeta;
  if (!emitMeta) return "";
  const promotedToPerItem = emitMeta.promotedToPerItem;
  const mapOrder = emitMeta.mapOrder;
  const mapMeta = emitMeta.mapMeta || (emitMeta.mapMeta = []);

  let out = '';
  const emittedMapArrays = new Set();
  for (const mi of mapOrder) {
    const map = ctx.maps[mi];
    const mapType = map.isInline ? 'inline' : map.isNested ? 'nested' : 'flat';
    if (map.mapBackend === 'lua_runtime') continue;

    const mapPerItemDecls = [];
    if (map.mapArrayDecls && map.mapArrayDecls.length > 0) {
      const declMap = {};
      for (const decl of map.mapArrayDecls) {
        const match = decl.match(/^var (_arr_\d+)/);
        if (match) declMap[match[1]] = decl;
      }

      const needsPerItem = new Set();
      for (const promotedName of promotedToPerItem) {
        if (declMap[promotedName]) needsPerItem.add(promotedName);
      }
      const pendingMapDynTexts = ctx.dynTexts.filter(function(dt) {
        return dt.inMap && dt.mapIdx === mi;
      });
      for (const entry of Object.entries(declMap)) {
        const name = entry[0];
        const decl = entry[1];
        if (decl.includes('[_i]') || decl.includes('_i)') || decl.includes('(_i')) {
          needsPerItem.add(name);
        }
        if (pendingMapDynTexts.length > 0 && (decl.includes('.text = ""') || /__mt\d+__/.test(decl))) {
          needsPerItem.add(name);
        }
      }

      const mapArrayNames = new Set(Object.keys(declMap));
      const staticOnlyNames = new Set();
      for (const decl of ctx.arrayDecls) {
        const match = decl.match(/^var (_arr_\d+)/);
        if (match && !mapArrayNames.has(match[1])) staticOnlyNames.add(match[1]);
      }

      for (const entry of Object.entries(declMap)) {
        const name = entry[0];
        if (staticOnlyNames.has(name)) continue;
        for (const otherEntry of Object.entries(declMap)) {
          const otherName = otherEntry[0];
          const otherDecl = otherEntry[1];
          if (otherName === name) continue;
          if (otherDecl.includes(`&${name}`)) {
            needsPerItem.add(name);
            break;
          }
        }
      }

      let changed = true;
      while (changed) {
        changed = false;
        for (const entry of Object.entries(declMap)) {
          const name = entry[0];
          const decl = entry[1];
          if (needsPerItem.has(name) || staticOnlyNames.has(name)) continue;
          for (const perItemName of needsPerItem) {
            if (decl.includes(`&${perItemName}`)) {
              needsPerItem.add(name);
              changed = true;
              break;
            }
          }
        }
      }

      for (const entry of Object.entries(declMap)) {
        const arrName = entry[0];
        const decl = entry[1];
        if (ctx.arrayDecls.some(function(arrayDecl) { return arrayDecl.startsWith(`var ${arrName}`); }) && !needsPerItem.has(arrName)) continue;
        if (emittedMapArrays.has(arrName)) continue;
        emittedMapArrays.add(arrName);
        const innerMatch = map.templateExpr ? map.templateExpr.match(/\.children = &(_arr_\d+)/) : null;
        if (innerMatch && arrName === innerMatch[1]) continue;
        if (needsPerItem.has(arrName)) {
          const elemCount = countTopLevelNodeDeclEntries(decl);
          mapPerItemDecls.push({ name: arrName, decl: decl, elemCount: elemCount });
          out += emitPerItemArrDecl(mi, arrName, elemCount, mapType);
        } else {
          out += decl + '\n';
        }
      }
    }
    map._mapPerItemDecls = mapPerItemDecls;

    const innerMatch = map.templateExpr.match(/\.children = &_arr_(\d+)/);
    const innerArr = innerMatch ? `_arr_${innerMatch[1]}` : null;
    let innerCount = 0;
    if (innerArr) {
      const innerDecl = (map.mapArrayDecls || []).find(function(decl) {
        return decl.startsWith(`var ${innerArr}`);
      }) || ctx.arrayDecls.find(function(decl) {
        return decl.startsWith(`var ${innerArr}`);
      });
      if (innerDecl) innerCount = countTopLevelNodeDeclEntries(innerDecl);
    }

    if (innerCount > 0) {
      if (map.isInline) {
        out += `var _map_inner_${mi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][${innerCount}]Node = undefined;\n`;
      } else if (map.isNested) {
        out += `var _map_inner_${mi}: [MAX_FLAT_${mi}][${innerCount}]Node = undefined;\n`;
      }
    }

    if (!mapMeta[mi]) mapMeta[mi] = {};
    mapMeta[mi].mapPerItemDecls = mapPerItemDecls;
    mapMeta[mi].innerCount = innerCount;
    mapMeta[mi].innerArr = innerArr;
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
