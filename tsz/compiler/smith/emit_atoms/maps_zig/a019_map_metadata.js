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

// ── Zig boolean wrapping for map conditions ──
// OA fields are i64, so bare values need != 0. But !(i64) is invalid Zig —
// negated expressions need (expr == 0) instead of !(expr) != 0.
function _wrapMapCondition(expr) {
  var isComp = expr.includes('==') || expr.includes('!=') ||
    expr.includes('>=') || expr.includes('<=') ||
    expr.includes(' > ') || expr.includes(' < ') ||
    expr.includes('std.mem.eql') || expr.includes('getSlotBool');
  if (isComp) return '(' + expr + ')';
  if (expr.match(/^!\s*\(/)) {
    var inner = expr.replace(/^!\s*\(/, '').replace(/\)\s*$/, '');
    return '((' + inner + ') == 0)';
  }
  if (expr.startsWith('!')) {
    return '((' + expr.slice(1).trim() + ') == 0)';
  }
  return '((' + expr + ') != 0)';
}

function buildMapEmitOrder(ctx) {
  const mapOrder = [];
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    if (!ctx.maps[mi].isNested && !ctx.maps[mi].isInline) mapOrder.push(mi);
  }
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].isInline) mapOrder.push(mi);
  }
  for (let mi = 0; mi < ctx.maps.length; mi++) {
    if (ctx.maps[mi].isNested) mapOrder.push(mi);
  }
  return mapOrder;
}

function ensureMapHandlerFieldRefs(ctx) {
  for (let mapIdx = 0; mapIdx < ctx.maps.length; mapIdx++) {
    const map = ctx.maps[mapIdx];
    if (map._handlerFieldRefsMap) continue;
    const mapHandlers = ctx.handlers.filter(function(handler) {
      return handler.inMap && handler.mapIdx === mapIdx;
    });
    for (let hi = 0; hi < mapHandlers.length; hi++) {
      const handler = mapHandlers[hi];
      if (!handler.luaBody || map.isNested) continue;
      const objectArray = map.oa;
      const itemParam = map.itemParam;
      const fieldRefs = [];
      if (objectArray) {
        for (const field of objectArray.fields) {
          if (field.type === 'nested_array') continue;
          if (new RegExp(`\\b${itemParam}\\.${field.name}\\b`).test(handler.luaBody)) fieldRefs.push(field);
        }
      }
      if (!map._handlerFieldRefsMap) map._handlerFieldRefsMap = {};
      map._handlerFieldRefsMap[hi] = fieldRefs;
      map._handlerFieldRefs = fieldRefs;
    }
  }
}

function countTopLevelNodeDeclEntries(decl) {
  if (!decl) return 0;
  const content = decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
  let depth = 0;
  let count = content.length > 0 ? 1 : 0;
  for (let ci = 0; ci < content.length; ci++) {
    if (content[ci] === '{') depth++;
    if (content[ci] === '}') depth--;
    if (content[ci] === ',' && depth === 0) count++;
  }
  return count;
}

function computePromotedMapArrays(ctx) {
  const mapParentArrs = new Set();
  for (const map of ctx.maps) {
    if (map.parentArr && !map.isInline) mapParentArrs.add(map.parentArr);
  }

  const promotedToPerItem = new Set();
  for (const map of ctx.maps) {
    if (!map.mapArrayDecls) continue;
    const pendingDynTexts = ctx.dynTexts.filter(function(dt) {
      return dt.inMap && dt.mapIdx === ctx.maps.indexOf(map);
    });
    if (pendingDynTexts.length === 0) continue;
    for (const decl of map.mapArrayDecls) {
      if (!decl.includes('.text = ""')) continue;
      const match = decl.match(/^var (_arr_\d+)/);
      if (match) promotedToPerItem.add(match[1]);
    }

    const allDecls = [].concat(map.mapArrayDecls, ctx.arrayDecls);
    let changed = true;
    while (changed) {
      changed = false;
      for (const decl of map.mapArrayDecls) {
        const match = decl.match(/^var (_arr_\d+)/);
        if (!match || promotedToPerItem.has(match[1])) continue;
        for (const promotedName of promotedToPerItem) {
          if (decl.includes(`&${promotedName}`)) {
            promotedToPerItem.add(match[1]);
            changed = true;
            break;
          }
        }
      }
      for (const promotedName of promotedToPerItem) {
        const parentDecl = allDecls.find(function(decl) {
          return decl.startsWith(`var ${promotedName} `);
        });
        if (!parentDecl) continue;
        const childRefs = parentDecl.match(/&(_arr_\d+)/g);
        if (!childRefs) continue;
        for (const ref of childRefs) {
          const childName = ref.slice(1);
          if (!promotedToPerItem.has(childName) && !mapParentArrs.has(childName)) {
            promotedToPerItem.add(childName);
            changed = true;
          }
        }
      }
    }

    for (const decl of ctx.arrayDecls) {
      const match = decl.match(/^var (_arr_\d+)/);
      if (!match || !promotedToPerItem.has(match[1])) continue;
      if (!map.mapArrayDecls.some(function(mapDecl) {
        return mapDecl.startsWith(`var ${match[1]}`);
      })) {
        map.mapArrayDecls.push(decl);
      }
    }
  }

  return promotedToPerItem;
}

function _a019_applies(ctx, meta) {
  void meta;
  return ctx.maps && ctx.maps.length > 0;
}

function _a019_emit(ctx, meta) {
  // Compute and stash metadata — no Zig output
  var promotedToPerItem = computePromotedMapArrays(ctx);
  var mapOrder = buildMapEmitOrder(ctx);
  ensureMapHandlerFieldRefs(ctx);

  // Store on meta for downstream atoms
  meta._mapOrder = mapOrder;
  meta._promotedToPerItem = promotedToPerItem;
  meta._wrapMapCondition = _wrapMapCondition;
  meta._countTopLevelNodeDeclEntries = countTopLevelNodeDeclEntries;
  return '';
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
  _wrapMapCondition: _wrapMapCondition,
  buildMapEmitOrder: buildMapEmitOrder,
  ensureMapHandlerFieldRefs: ensureMapHandlerFieldRefs,
  countTopLevelNodeDeclEntries: countTopLevelNodeDeclEntries,
  computePromotedMapArrays: computePromotedMapArrays,
};
