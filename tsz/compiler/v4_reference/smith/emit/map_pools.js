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

// Emit map-pool declarations and shared metadata for rebuild passes

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

function emitMapPoolDeclarations(ctx, promotedToPerItem) {
  const mapMeta = [];
  const mapOrder = buildMapEmitOrder(ctx);
  if (ctx.maps.length === 0) return { out: '', mapMeta: mapMeta, mapOrder: mapOrder };

  let out = `\n// ── Map pools ───────────────────────────────────────────────────\n`;
  const emittedMapArrays = new Set();
  const hasFlatMaps = ctx.maps.some(function(map) {
    return !map.isNested && !map.isInline;
  });

  if (hasFlatMaps) {
    out += `var _pool_arena: std.heap.ArenaAllocator = std.heap.ArenaAllocator.init(std.heap.page_allocator);\n`;
  }

  ensureMapHandlerFieldRefs(ctx);

  for (const mi of mapOrder) {
    const map = ctx.maps[mi];
    if (map.isNested) {
      const parentMap = ctx.maps.find(function(parent) {
        return parent.oaIdx === map.parentOaIdx && !parent.isNested;
      });
      const parentMi = parentMap ? ctx.maps.indexOf(parentMap) : 0;
      map._parentMi = parentMi;
      out += `const MAX_MAP_${mi}: usize = 64;\n`;
      out += `const MAX_FLAT_${mi}: usize = 4096;\n`;
      const parentPoolSize = parentMap && !parentMap.isNested ? 128 : 64;
      out += `const MAX_NESTED_OUTER_${mi}: usize = ${parentPoolSize};\n`;
      out += `var _map_pool_${mi}: [MAX_NESTED_OUTER_${mi}][MAX_MAP_${mi}]Node = undefined;\n`;
      out += `var _map_count_${mi}: [MAX_NESTED_OUTER_${mi}]usize = undefined;\n`;
    } else if (map.isInline) {
      const parentMi = ctx.maps.indexOf(map.parentMap);
      map._parentMi = parentMi;
      out += `const MAX_MAP_${mi}: usize = 16;\n`;
      out += `const MAX_INLINE_OUTER_${mi}: usize = 8;\n`;
      out += `var _map_pool_${mi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}]Node = undefined;\n`;
      out += `var _map_count_${mi}: [MAX_INLINE_OUTER_${mi}]usize = undefined;\n`;
    } else {
      out += `const MAX_MAP_${mi}: usize = 4096;\n`;
      out += `var _map_pool_${mi}: []Node = undefined;\n`;
      out += `var _map_count_${mi}: usize = 0;\n`;
    }

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
          if (map.isInline) {
            out += `var _map_${arrName}_${mi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][${elemCount}]Node = undefined;\n`;
          } else if (map.isNested) {
            out += `var _map_${arrName}_${mi}: [MAX_MAP_${mi}][${elemCount}]Node = undefined;\n`;
          }
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

    const mapDynTexts = ctx.dynTexts.filter(function(dt) {
      return dt.inMap && dt.mapIdx === mi;
    });
    const texSizeConst = map.isNested ? `MAX_FLAT_${mi}` : map.isInline ? null : `MAX_MAP_${mi}`;
    const declaredBufIds = new Set();
    for (const dt of mapDynTexts) {
      dt._mapTextIdx = dt.bufId;
      if (declaredBufIds.has(dt.bufId)) continue;
      declaredBufIds.add(dt.bufId);
      if (map.isInline) {
        out += `var _map_text_bufs_${mi}_${dt.bufId}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][256]u8 = undefined;\n`;
        out += `var _map_texts_${mi}_${dt.bufId}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][]const u8 = undefined;\n`;
      } else {
        out += `var _map_text_bufs_${mi}_${dt.bufId}: [${texSizeConst}][256]u8 = undefined;\n`;
        out += `var _map_texts_${mi}_${dt.bufId}: [${texSizeConst}][]const u8 = undefined;\n`;
      }
    }

    const mapHandlers = ctx.handlers.filter(function(handler) {
      return handler.inMap && handler.mapIdx === mi;
    });
    if (mapHandlers.length > 0) {
      const luaSizeConst = map.isNested ? `MAX_FLAT_${mi}` : `MAX_MAP_${mi}`;
      for (let hi = 0; hi < mapHandlers.length; hi++) {
        const refsMap = map._handlerFieldRefsMap || {};
        const hasFieldRefs = refsMap[hi] && refsMap[hi].length > 0;
        const bufSize = hasFieldRefs ? 128 : 48;
        if (map.isInline) {
          out += `var _map_lua_bufs_${mi}_${hi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}][${bufSize}]u8 = undefined;\n`;
          out += `var _map_lua_ptrs_${mi}_${hi}: [MAX_INLINE_OUTER_${mi}][MAX_MAP_${mi}]?[*:0]const u8 = undefined;\n`;
        } else {
          out += `var _map_lua_bufs_${mi}_${hi}: [${luaSizeConst}][${bufSize}]u8 = undefined;\n`;
          out += `var _map_lua_ptrs_${mi}_${hi}: [${luaSizeConst}]?[*:0]const u8 = .{null} ** ${luaSizeConst};\n`;
        }
        if (!map.isNested && !map.isInline && !hasFieldRefs) {
          out += `fn _initMapLuaPtrs${mi}_${hi}() void {\n`;
          out += `    for (0..${luaSizeConst}) |_i| {\n`;
          out += `        const n = std.fmt.bufPrint(_map_lua_bufs_${mi}_${hi}[_i][0..${bufSize - 1}], "__mapPress_${mi}_${hi}({d})", .{_i}) catch continue;\n`;
          out += `        _map_lua_bufs_${mi}_${hi}[_i][n.len] = 0;\n`;
          out += `        _map_lua_ptrs_${mi}_${hi}[_i] = @ptrCast(_map_lua_bufs_${mi}_${hi}[_i][0..n.len :0]);\n`;
          out += `    }\n`;
          out += `}\n`;
        }
      }
    }

    mapMeta[mi] = {
      mapPerItemDecls: mapPerItemDecls,
      innerCount: innerCount,
      innerArr: innerArr,
      mapDynTexts: mapDynTexts,
      mapHandlers: mapHandlers,
    };
    map._mapPerItemDecls = mapPerItemDecls;
  }

  return { out: out, mapMeta: mapMeta, mapOrder: mapOrder };
}

function emitMapPoolRebuilds(ctx, meta) {
  const _mapMeta = meta.mapMeta;
  const mapOrder = meta.mapOrder;
  const _promotedToPerItem = meta.promotedToPerItem;
  if (ctx.maps.length === 0) return '';

  let out = '';
  // Pass 2: emit rebuild functions (all declarations are now above)
  for (const mi of mapOrder) {
    const m = ctx.maps[mi];
    if (m.isNested || m.isInline) continue; // nested/inline rebuilds inlined into parent
    const { mapPerItemDecls, mapDynTexts, mapHandlers } = _mapMeta[mi];
    let { innerCount, innerArr } = _mapMeta[mi];
  
    out += `fn _rebuildMap${mi}() void {\n`;
    out += `    _map_count_${mi} = @min(_oa${m.oaIdx}_len, MAX_MAP_${mi});\n`;
    out += `    _map_pool_${mi} = _pool_arena.allocator().alloc(Node, _map_count_${mi}) catch unreachable;\n`;
    out += `    for (0.._map_count_${mi}) |_i| {\n`;
  
    // Emit per-item text formatting
    for (const dt of mapDynTexts) {
      const ti = dt._mapTextIdx;
      out += `        _map_texts_${mi}_${ti}[_i] = std.fmt.bufPrint(&_map_text_bufs_${mi}_${ti}[_i], "${dt.fmtString}", .{ ${dt.fmtArgs} }) catch "";\n`;
    }

    // Emit handler ptr init BEFORE per-item arrays that reference them.
    // When handlers use OA field refs, the ptrs are built inline per-iteration
    // (not pre-computed in _initMapLuaPtrs). They must be set before @memcpy
    // copies js_on_press into nodes, otherwise nodes get null pointers.
    {
      const _earlyFieldRefsMap = m._handlerFieldRefsMap || {};
      for (let _ehi = 0; _ehi < mapHandlers.length; _ehi++) {
        const _erefs = _earlyFieldRefsMap[_ehi] || [];
        if (_erefs.length > 0) {
          const _eoaIdx = m.oa ? m.oa.oaIdx : (m.oaIdx || 0);
          const _efmtParts = ['{d}'];
          const _eargParts = ['_i'];
          for (const _ef of _erefs) {
            if (_ef.type === 'string') {
              _efmtParts.push("'{s}'");
              _eargParts.push(`_oa${_eoaIdx}_${_ef.name}[_i][0.._oa${_eoaIdx}_${_ef.name}_lens[_i]]`);
            } else {
              _efmtParts.push('{d}');
              _eargParts.push(`_oa${_eoaIdx}_${_ef.name}[_i]`);
            }
          }
          out += `        {\n`;
          out += `            const _n = std.fmt.bufPrint(_map_lua_bufs_${mi}_${_ehi}[_i][0..127], "__mapPress_${mi}_${_ehi}(${_efmtParts.join(',')})", .{${_eargParts.join(', ')}}) catch "";\n`;
          out += `            _map_lua_bufs_${mi}_${_ehi}[_i][_n.len] = 0;\n`;
          out += `            _map_lua_ptrs_${mi}_${_ehi}[_i] = @ptrCast(_map_lua_bufs_${mi}_${_ehi}[_i][0.._n.len :0]);\n`;
          out += `        }\n`;
        }
      }
    }

    // Pre-count how many .text = "" slots are in inner array vs per-item arrays
    // so we can assign dynTexts in JSX order (inner first, then per-item)
    if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
      ctx._debugLines.push('[MAP_TEXT_DEBUG] map ' + mi + ': ' + mapDynTexts.length + ' dynTexts');
      for (let _dbi = 0; _dbi < mapDynTexts.length; _dbi++) {
        const _ddt = mapDynTexts[_dbi];
        ctx._debugLines.push('[MAP_TEXT_DEBUG]   dt[' + _dbi + '] bufId=' + _ddt.bufId + ' fmt="' + _ddt.fmtString + '" args="' + _ddt.fmtArgs + '"');
      }
      if (innerArr) {
        const _innerDecl2 = (m.mapArrayDecls || []).find(d => d.startsWith('var ' + innerArr)) || ctx.arrayDecls.find(d => d.startsWith('var ' + innerArr));
        ctx._debugLines.push('[MAP_TEXT_DEBUG]   innerArr=' + innerArr + ' decl=' + (_innerDecl2 ? _innerDecl2.substring(0, 200) : 'null'));
      }
      for (const _pid of m._mapPerItemDecls) {
        ctx._debugLines.push('[MAP_TEXT_DEBUG]   perItem=' + _pid.name + ' decl=' + _pid.decl.substring(0, 200));
      }
    }
    let innerTextSlots = 0;
    if (innerArr) {
      const innerDecl = (m.mapArrayDecls || []).find(d => d.startsWith(`var ${innerArr}`)) ||
                        ctx.arrayDecls.find(d => d.startsWith(`var ${innerArr}`));
      if (innerDecl) innerTextSlots = (innerDecl.match(/\.text = ""/g) || []).length;
    }
  
    // Fill per-item component arrays
    let dtConsumed = 0;
    // Per-item child arrays come FIRST in JSX depth-first order, inner array texts come LAST
    let dtSkippedForInner = 0;
    for (const pid of m._mapPerItemDecls) {
      const content = pid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
      // Replace references to per-item arrays from ALL maps
      let fixedContent = content;
      for (let mj = 0; mj < ctx.maps.length; mj++) {
        const otherMap = ctx.maps[mj];
        if (!otherMap._mapPerItemDecls) continue;
        for (const pid2 of otherMap._mapPerItemDecls) {
          if (!otherMap.isNested && !otherMap.isInline) {
            fixedContent = fixedContent.replace(new RegExp(`&${pid2.name}\\b`, 'g'), `_pi_${pid2.name}_${mj}`);
          } else {
            fixedContent = fixedContent.replace(new RegExp(`&${pid2.name}\\b`, 'g'), `&_map_${pid2.name}_${mj}[_i]`);
          }
        }
      }
      // Replace tagged map text refs in this per-item array
      // Tags are "__mtN__" where N is the specific text buffer index
      for (const dt of mapDynTexts) {
        const ti = dt._mapTextIdx;
        fixedContent = fixedContent.replace(`"__mt${ti}__"`, `_map_texts_${mi}_${ti}[_i]`);
      }
      // Legacy fallback: replace any remaining untagged .text = "" sequentially
      let pidDtIdx = dtConsumed;
      while (pidDtIdx < mapDynTexts.length) {
        const dt = mapDynTexts[pidDtIdx];
        const ti = dt._mapTextIdx;
        const next = fixedContent.replace('.text = ""', `.text = _map_texts_${mi}_${ti}[_i]`);
        if (next === fixedContent) break;
        fixedContent = next;
        pidDtIdx++;
        dtConsumed++;
      }
      // Replace handler refs in per-item arrays with per-item handler string pointers
      // Must check ALL maps' handlers since nested map handlers may appear in parent per-item arrays
      const pidPressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
      for (let mj = 0; mj < ctx.maps.length; mj++) {
        const allMH = ctx.handlers.filter(h => h.inMap && h.mapIdx === mj);
        for (let hi = 0; hi < allMH.length; hi++) {
          const mh = allMH[hi];
          if (mh.luaBody) {
            const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Match both .lua_on_press and .js_on_press — parse.js emits js_on_press for script blocks
            const ptrReplacement = `.${pidPressField} = _map_lua_ptrs_${mj}_${hi}[_i]`;
            if (globalThis.__SMITH_DEBUG_MAP_PTRS) {
              print(`[MAP_PTR_WIRE] map=${mj} handler=${hi} field=${pidPressField} escaped="${escaped.substring(0,60)}..." replacing in fixedContent(len=${fixedContent.length})`);
            }
            fixedContent = fixedContent.replace(new RegExp(`\\.lua_on_press = "${escapedRegex}"`, 'g'), ptrReplacement);
            fixedContent = fixedContent.replace(new RegExp(`\\.js_on_press = "${escapedRegex}"`, 'g'), ptrReplacement);
          }
          const ptrReplacement2 = `.${pidPressField} = _map_lua_ptrs_${mj}_${hi}[_i]`;
          fixedContent = fixedContent.replace(new RegExp(`\\.on_press = (?:handlers\\.)?${mh.name}`, 'g'), ptrReplacement2);
        }
      }
      // Replace raw map index param (e.g. 'i') with Zig loop variable in ternary conditions
      const idxParam = m.indexParam || 'i';
      if (idxParam !== '_i') {
        fixedContent = fixedContent.replace(new RegExp(`\\b${idxParam}\\b`, 'g'), '@as(i64, @intCast(_i))');
      }
      out += `        const _pi_${pid.name}_${mi} = _pool_arena.allocator().alloc(Node, ${pid.elemCount}) catch unreachable;\n`;
      out += `        @memcpy(_pi_${pid.name}_${mi}, &[_]Node{ ${fixedContent} });\n`;
    }
  
    // Per-item conditionals (visibility toggling inside map components)
    for (const cond of ctx.conditionals) {
      if (!cond.arrName || !m._mapPerItemDecls) continue;
      // Skip conditionals that belong to a different map
      if (cond.inMap && cond.mapIdx !== undefined && cond.mapIdx !== mi) continue;
      const pid = m._mapPerItemDecls.find(p => p.name === cond.arrName);
      if (!pid) continue;
      const poolArr = `_pi_${cond.arrName}_${mi}`;
      // Resolve item.field references to OA field access
      let resolvedExpr = cond.condExpr;
      // DEBUG: trace map cond resolution
      if (resolvedExpr.includes('0.0')) ctx._debugLines.push('[MAP_COND_DEBUG] raw=' + resolvedExpr + ' arrName=' + cond.arrName + ' mapIdx=' + mi + ' itemParam=' + (m.itemParam || '?'));
      if (m.oa) {
        const itemParam = m.itemParam || 'item';
        for (const f of m.oa.fields) {
          resolvedExpr = resolvedExpr.replace(new RegExp(`${itemParam}\\.${f.name}`, 'g'), `_oa${m.oa.oaIdx}_${f.name}[_i]`);
        }
      }
      // Skip unresolvable conditionals (e.g. JS function calls that can't compile to Zig)
      if (/\b0\(/.test(resolvedExpr) || /\b0\b.*@as/.test(resolvedExpr)) continue;
      const wrapped = _wrapMapCondition(resolvedExpr);
      if (cond.kind === 'show_hide') {
        out += `        ${poolArr}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
      } else if (cond.kind === 'ternary_jsx') {
        out += `        ${poolArr}[${cond.trueIdx}].style.display = if ${wrapped} .flex else .none;\n`;
        out += `        ${poolArr}[${cond.falseIdx}].style.display = if ${wrapped} .none else .flex;\n`;
      }
    }

    // Per-item dynamic texts (text formatting inside map components)
    for (const dt of ctx.dynTexts) {
      if (dt.inMap) continue;  // inMap texts handled separately
      if (!dt.arrName || !m._mapPerItemDecls) continue;
      const pid = m._mapPerItemDecls.find(p => p.name === dt.arrName);
      if (!pid) continue;
      const poolArr = `_pi_${dt.arrName}_${mi}`;
      const dtF = dt.targetField || 'text';
      out += `        ${poolArr}[${dt.arrIndex}].${dtF} = std.fmt.bufPrint(&_dyn_buf_${dt.bufId}, "${dt.fmtString}", .{ ${dt.fmtArgs} }) catch "";\n`;
    }
  
    // Inline nested map rebuilds — for each nested map that belongs to this parent
    for (let nmi = 0; nmi < ctx.maps.length; nmi++) {
      const nm = ctx.maps[nmi];
      if (!nm.isNested || nm.parentOaIdx !== m.oaIdx) continue;
      const nestedOa = nm.oa;
      const cidx = nestedOa.oaIdx;
      // Build inner pool by filtering nested OA items by parentIdx
      out += `        // Nested map ${nmi}: ${nm.nestedField}\n`;
      out += `        _map_count_${nmi}[_i] = 0;\n`;
      out += `        for (0.._oa${cidx}_len) |_flat_j| {\n`;
      out += `            if (_oa${cidx}_parentIdx[_flat_j] == _i) {\n`;
      out += `                const _jj = _map_count_${nmi}[_i];\n`;
      out += `                if (_jj >= MAX_MAP_${nmi}) break;\n`;
      // Build nested pool node from template, replacing field refs
      let nestedPoolNode = nm.templateExpr;
      // Replace nested OA field refs: _oaX_field[_i] → _oaX_field[_flat_j]
      for (const cf of nestedOa.fields) {
        if (cf.type === 'string') {
          nestedPoolNode = nestedPoolNode.replace(
            new RegExp(`_oa${cidx}_${cf.name}\\[_i\\]\\[0\\.\\._{1}oa${cidx}_${cf.name}_lens\\[_i\\]\\]`, 'g'),
            `_oa${cidx}_${cf.name}[_flat_j][0.._oa${cidx}_${cf.name}_lens[_flat_j]]`
          );
        }
        nestedPoolNode = nestedPoolNode.replace(
          new RegExp(`_oa${cidx}_${cf.name}\\[_i\\]`, 'g'),
          `_oa${cidx}_${cf.name}[_flat_j]`
        );
      }
      // Replace nested map dynamic texts — use _flat_j for flat indexing
      const nestedMapDynTexts = ctx.dynTexts.filter(dt => dt.inMap && dt.mapIdx === nmi);
      for (const dt of nestedMapDynTexts) {
        const ti = dt._mapTextIdx;
        // Fix fmt args to use _flat_j instead of _i for nested OA access
        let fixedArgs = dt.fmtArgs;
        for (const cf of nestedOa.fields) {
          fixedArgs = fixedArgs.replace(
            new RegExp(`_oa${cidx}_${cf.name}\\[_i\\]`, 'g'),
            `_oa${cidx}_${cf.name}[_flat_j]`
          );
          fixedArgs = fixedArgs.replace(
            new RegExp(`_oa${cidx}_${cf.name}_lens\\[_i\\]`, 'g'),
            `_oa${cidx}_${cf.name}_lens[_flat_j]`
          );
        }
        // Also replace bare _j refs (from template literal iterVar) with _flat_j
        fixedArgs = fixedArgs.replace(new RegExp(`_oa${cidx}_(\\w+)\\[_j\\]`, 'g'), `_oa${cidx}_$1[_flat_j]`);
        fixedArgs = fixedArgs.replace(new RegExp(`_oa${cidx}_(\\w+)_lens\\[_j\\]`, 'g'), `_oa${cidx}_$1_lens[_flat_j]`);
        fixedArgs = fixedArgs.replace(/@intCast\(_j\)/g, '@intCast(_flat_j)');
        out += `                _map_texts_${nmi}_${ti}[_flat_j] = std.fmt.bufPrint(&_map_text_bufs_${nmi}_${ti}[_flat_j], "${dt.fmtString}", .{ ${fixedArgs} }) catch "";\n`;
      }
      // Build per-item inner array from the shared children template
      const nestedMeta = _mapMeta[nmi];
      if (nestedMeta && nestedMeta.innerArr && nestedMeta.innerCount > 0) {
        // Find the shared array declaration to get the node template
        const sharedDecl = (nm.mapArrayDecls || []).find(d => d.startsWith(`var ${nestedMeta.innerArr}`)) ||
                           ctx.arrayDecls.find(d => d.startsWith(`var ${nestedMeta.innerArr}`));
        if (sharedDecl) {
          let innerContent = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          // Replace tagged map text refs, then fallback to sequential for untagged
          for (const dt of nestedMapDynTexts) {
            const ti = dt._mapTextIdx;
            innerContent = innerContent.replace(`"__mt${ti}__"`, `_map_texts_${nmi}_${ti}[_flat_j]`);
          }
          for (const dt of nestedMapDynTexts) {
            const ti = dt._mapTextIdx;
            innerContent = innerContent.replace('.text = ""', `.text = _map_texts_${nmi}_${ti}[_flat_j]`);
          }
          out += `                _map_inner_${nmi}[_flat_j] = [${nestedMeta.innerCount}]Node{ ${innerContent} };\n`;
          // Replace children ref in pool node to use per-item inner array
          nestedPoolNode = nestedPoolNode.replace(`&${nestedMeta.innerArr}`, `&_map_inner_${nmi}[_flat_j]`);
        }
      }
      // Replace handler refs + build per-item Lua ptrs with (parent_idx, item_idx)
      const nestedHandlers = ctx.handlers.filter(h => h.inMap && h.mapIdx === nmi);
      for (let nhi = 0; nhi < nestedHandlers.length; nhi++) {
        out += `                {\n`;
        out += `                    const _n = std.fmt.bufPrint(_map_lua_bufs_${nmi}_${nhi}[_flat_j][0..47], "__mapPress_${nmi}_${nhi}({d},{d})", .{_i, _jj}) catch "";\n`;
        out += `                    _map_lua_bufs_${nmi}_${nhi}[_flat_j][_n.len] = 0;\n`;
        out += `                    _map_lua_ptrs_${nmi}_${nhi}[_flat_j] = @ptrCast(_map_lua_bufs_${nmi}_${nhi}[_flat_j][0.._n.len :0]);\n`;
        out += `                }\n`;
        const mh = nestedHandlers[nhi];
        const nestedPressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
        const nestedPtrRepl = `.${nestedPressField} = _map_lua_ptrs_${nmi}_${nhi}[_flat_j]`;
        nestedPoolNode = nestedPoolNode.replace(`.lua_on_press = "${mh.luaBody ? mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : ''}"`, nestedPtrRepl);
        nestedPoolNode = nestedPoolNode.replace(`.js_on_press = "${mh.luaBody ? mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : ''}"`, nestedPtrRepl);
        nestedPoolNode = nestedPoolNode.replace(`.on_press = handlers.${mh.name}`, nestedPtrRepl);
        nestedPoolNode = nestedPoolNode.replace(`.on_press = ${mh.name}`, nestedPtrRepl);
      }
      out += `                _map_pool_${nmi}[_i][_jj] = ${nestedPoolNode};\n`;
      out += `                _map_count_${nmi}[_i] += 1;\n`;
      out += `            }\n`;
      out += `        }\n`;
    }
  
    // Inline map rebuilds — separate-OA maps inside this map's JSX template
    // Love2d pattern: inner loop runs per outer iteration, giving each parent independent child nodes
    for (let imi = 0; imi < ctx.maps.length; imi++) {
      const im = ctx.maps[imi];
      if (!im.isInline || im._parentMi !== mi) continue;
      const imMeta = _mapMeta[imi];
      if (!imMeta) continue;
      const imOa = im.oa;
      const imPressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
  
      out += `        // inline map ${imi}: ${imOa.getter}.map (per-parent)\n`;
      out += `        _map_count_${imi}[_i] = @min(_oa${im.oaIdx}_len, MAX_MAP_${imi});\n`;
      out += `        {\n        var _j: usize = 0;\n        while (_j < _map_count_${imi}[_i]) : (_j += 1) {\n`;
  
      // Text formatting with [_i][_j], inner OA uses _j
      for (const dt of imMeta.mapDynTexts) {
        const ti = dt._mapTextIdx;
        let args = dt.fmtArgs;
        for (const f of imOa.fields) {
          args = args.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]\\[0\\.\\._{1}oa${im.oaIdx}_${f.name}_lens\\[_i\\]\\]`, 'g'),
            `_oa${im.oaIdx}_${f.name}[_j][0.._oa${im.oaIdx}_${f.name}_lens[_j]]`);
          args = args.replace(new RegExp(`_oa${im.oaIdx}_${f.name}_lens\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}_lens[_j]`);
          args = args.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
        }
        // Do not rewrite @as(i64, @intCast(_i)) here — that is the outer map index; inner uses _j from template_literal / props.
        out += `            _map_texts_${imi}_${ti}[_i][_j] = std.fmt.bufPrint(&_map_text_bufs_${imi}_${ti}[_i][_j], "${dt.fmtString}", .{ ${args} }) catch "";\n`;
      }
  
      // Handler pointers BEFORE node literals that embed .js_on_press / .lua_on_press (otherwise nodes capture null).
      for (let hi = 0; hi < imMeta.mapHandlers.length; hi++) {
        out += `            {\n`;
        out += `                const _n = std.fmt.bufPrint(_map_lua_bufs_${imi}_${hi}[_i][_j][0..47], "__mapPress_${imi}_${hi}({d})", .{_j}) catch "";\n`;
        out += `                _map_lua_bufs_${imi}_${hi}[_i][_j][_n.len] = 0;\n`;
        out += `                _map_lua_ptrs_${imi}_${hi}[_i][_j] = @ptrCast(_map_lua_bufs_${imi}_${hi}[_i][_j][0.._n.len :0]);\n`;
        out += `            }\n`;
      }
  
      // Per-item array fills with content fixup
      // IMPORTANT: handler replacement FIRST (before _i→_j), since handler body
      // strings in declarations match the original pre-fixup content
      let imDtConsumed = 0;
      for (const pid of imMeta.mapPerItemDecls) {
        let content = pid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
        // 1. Wire handler refs FIRST — match original handler body before content changes
        for (let hi = 0; hi < imMeta.mapHandlers.length; hi++) {
          const mh = imMeta.mapHandlers[hi];
          if (mh.luaBody) {
            const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            content = content.replace(new RegExp(`\\.lua_on_press = "${escapedRegex}"`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
            content = content.replace(new RegExp(`\\.js_on_press = "${escapedRegex}"`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
          }
          content = content.replace(new RegExp(`\\.on_press = (?:handlers\\.)?${mh.name}`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
        }
        // 2. Fix inner OA field refs: _i→_j
        for (const f of imOa.fields) {
          content = content.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]\\[0\\.\\._{1}oa${im.oaIdx}_${f.name}_lens\\[_i\\]\\]`, 'g'),
            `_oa${im.oaIdx}_${f.name}[_j][0.._oa${im.oaIdx}_${f.name}_lens[_j]]`);
          content = content.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
        }
        // Preserve outer-section @as(i64, @intCast(_i)) while rewriting inner-index _i→_j elsewhere
        content = content.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
        content = content.replace(/@intCast\(_i\)/g, '@intCast(_j)');
        content = content.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
        // 3. Fix per-item array refs to [_i][_j]
        for (const pid2 of imMeta.mapPerItemDecls) {
          content = content.replace(new RegExp(`&${pid2.name}\\b`, 'g'), `&_map_${pid2.name}_${imi}[_i][_j]`);
        }
        // 4. Wire tagged map text refs [_i][_j], then fallback sequential
        for (const dt of imMeta.mapDynTexts) {
          const ti = dt._mapTextIdx;
          content = content.replace(`"__mt${ti}__"`, `_map_texts_${imi}_${ti}[_i][_j]`);
        }
        while (imDtConsumed < imMeta.mapDynTexts.length) {
          const dt = imMeta.mapDynTexts[imDtConsumed];
          const ti = dt._mapTextIdx;
          const next = content.replace('.text = ""', `.text = _map_texts_${imi}_${ti}[_i][_j]`);
          if (next === content) break;
          content = next;
          imDtConsumed++;
        }
        out += `            _map_${pid.name}_${imi}[_i][_j] = [${pid.elemCount}]Node{ ${content} };\n`;
      }
  
      // Inner array construction
      if (imMeta.innerArr && imMeta.innerCount > 0) {
        const sharedDecl = (im.mapArrayDecls || []).find(d => d.startsWith(`var ${imMeta.innerArr}`)) ||
                           ctx.arrayDecls.find(d => d.startsWith(`var ${imMeta.innerArr}`));
        if (sharedDecl) {
          let ic = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          for (const f of imOa.fields) {
            ic = ic.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]\\[0\\.\\._{1}oa${im.oaIdx}_${f.name}_lens\\[_i\\]\\]`, 'g'),
              `_oa${im.oaIdx}_${f.name}[_j][0.._oa${im.oaIdx}_${f.name}_lens[_j]]`);
            ic = ic.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
          }
          ic = ic.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
          ic = ic.replace(/@intCast\(_i\)/g, '@intCast(_j)');
          ic = ic.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
          for (const pid of imMeta.mapPerItemDecls) {
            ic = ic.replace(new RegExp(`&${pid.name}\\b`, 'g'), `&_map_${pid.name}_${imi}[_i][_j]`);
          }
          for (const dt of imMeta.mapDynTexts) {
            const ti = dt._mapTextIdx;
            ic = ic.replace(`"__mt${ti}__"`, `_map_texts_${imi}_${ti}[_i][_j]`);
            ic = ic.replace('.text = ""', `.text = _map_texts_${imi}_${ti}[_i][_j]`);
          }
          for (let hi = 0; hi < imMeta.mapHandlers.length; hi++) {
            const mh = imMeta.mapHandlers[hi];
            if (mh.luaBody) {
              const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              const escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              ic = ic.replace(new RegExp(`\\.lua_on_press = "${escapedRegex}"`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
              ic = ic.replace(new RegExp(`\\.js_on_press = "${escapedRegex}"`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
            }
            ic = ic.replace(new RegExp(`\\.on_press = (?:handlers\\.)?${mh.name}`, 'g'), `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
          }
          out += `            _map_inner_${imi}[_i][_j] = [${imMeta.innerCount}]Node{ ${ic} };\n`;
        }
      }
  
      // Pool node
      let imPool = im.templateExpr;
      for (const f of imOa.fields) {
        imPool = imPool.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
      }
      imPool = imPool.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
      imPool = imPool.replace(/@intCast\(_i\)/g, '@intCast(_j)');
      imPool = imPool.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
      if (imMeta.innerArr) imPool = imPool.replace(`&${imMeta.innerArr}`, `&_map_inner_${imi}[_i][_j]`);
      for (const pid of imMeta.mapPerItemDecls) {
        imPool = imPool.replace(new RegExp(`&${pid.name}\\b`, 'g'), `&_map_${pid.name}_${imi}[_i][_j]`);
      }
      for (let hi = 0; hi < imMeta.mapHandlers.length; hi++) {
        const mh = imMeta.mapHandlers[hi];
        if (mh.luaBody) {
          const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          imPool = imPool.replace(`.lua_on_press = "${escaped}"`, `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
          imPool = imPool.replace(`.js_on_press = "${escaped}"`, `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
        }
        imPool = imPool.replace(`.on_press = handlers.${mh.name}`, `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
        imPool = imPool.replace(`.on_press = ${mh.name}`, `.${imPressField} = _map_lua_ptrs_${imi}_${hi}[_i][_j]`);
      }
      // Per-item conditionals for inline map (display:none toggling)
      // Resolve raw .tsz names in condition expressions:
      //   item.field → _oaX_field[_j], parentItem.field → _oaY_field[_i]
      //   innerIdx → @as(i64, @intCast(_j)), outerIdx → @as(i64, @intCast(_i))
      function resolveInlineCond(expr) {
        let r = expr;
        // Inner map item.field → _oaX_field[_j]
        if (imOa) {
          const ip = im.itemParam || 'item';
          for (const f of imOa.fields) {
            r = r.replace(new RegExp(`${ip}\\.${f.name}`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
            r = r.replace(new RegExp(`_oa${im.oaIdx}_${f.name}\\[_i\\]`, 'g'), `_oa${im.oaIdx}_${f.name}[_j]`);
          }
        }
        // Outer map item.field → _oaY_field[_i]
        if (m.oa) {
          const op = m.itemParam || 'col';
          for (const f of m.oa.fields) {
            r = r.replace(new RegExp(`${op}\\.${f.name}`, 'g'), `_oa${m.oa.oaIdx}_${f.name}[_i]`);
          }
        }
        // Index params: outer stays _i, inner becomes _j
        const outerIdx = m.indexParam || 'ci';
        const innerIdx = im.indexParam || 'ti';
        // Use placeholder to prevent overwrite: outer→__OUTER__, then inner→_j, then __OUTER__→_i
        r = r.replace(new RegExp(`\\b${outerIdx}\\b`, 'g'), '@as(i64, @intCast(__OUTER_IDX__))');
        r = r.replace(new RegExp(`\\b${innerIdx}\\b`, 'g'), '@as(i64, @intCast(_j))');
        // Inner OA _i refs already handled above (lines 1054-1059).
        // Any remaining @intCast(_i) are outer-scope references — leave as _i.
        // Restore outer index placeholder
        r = r.replace(/__OUTER_IDX__/g, '_i');
        return r;
      }
      for (const cond of ctx.conditionals) {
        if (!cond.arrName) continue;
        const pid = imMeta.mapPerItemDecls.find(p => p.name === cond.arrName);
        if (!pid) continue;
        const poolArr = `_map_${cond.arrName}_${imi}[_i][_j]`;
        let resolvedExpr = resolveInlineCond(cond.condExpr);
        if (cond.kind === 'show_hide') {
          out += `            ${poolArr}[${cond.trueIdx}].style.display = if ((${resolvedExpr})) .flex else .none;\n`;
        } else if (cond.kind === 'ternary_jsx') {
          const _w = _wrapMapCondition(resolvedExpr);
          out += `            ${poolArr}[${cond.trueIdx}].style.display = if ${_w} .flex else .none;\n`;
          out += `            ${poolArr}[${cond.falseIdx}].style.display = if ${_w} .none else .flex;\n`;
        }
      }
      // Inner array conditionals (applied to _map_inner)
      if (imMeta.innerArr && imMeta.innerCount > 0) {
        for (const cond of ctx.conditionals) {
          if (!cond.arrName || cond.arrName !== imMeta.innerArr) continue;
          let resolvedExpr = resolveInlineCond(cond.condExpr);
          if (cond.kind === 'show_hide') {
            out += `            _map_inner_${imi}[_i][_j][${cond.trueIdx}].style.display = if ((${resolvedExpr})) .flex else .none;\n`;
          } else if (cond.kind === 'ternary_jsx') {
            const _w2 = _wrapMapCondition(resolvedExpr);
            out += `            _map_inner_${imi}[_i][_j][${cond.trueIdx}].style.display = if ${_w2} .flex else .none;\n`;
            out += `            _map_inner_${imi}[_i][_j][${cond.falseIdx}].style.display = if ${_w2} .none else .flex;\n`;
          }
        }
      }
  
      // If inner node has display conditional and pool node doesn't, hoist display to pool
      if (!imPool.includes('.style')) {
        imPool = imPool.replace('.{', '.{ .style = .{},');
        out += `            _map_pool_${imi}[_i][_j] = ${imPool};\n`;
        out += `            _map_pool_${imi}[_i][_j].style.display = _map_inner_${imi}[_i][_j][0].style.display;\n`;
      } else {
        out += `            _map_pool_${imi}[_i][_j] = ${imPool};\n`;
      }
      out += `        }\n        }\n`;
  
      // Bind inline pool to parent's per-item array
      if (im.parentArr) {
        const isPerItem = _promotedToPerItem.has(im.parentArr) ||
                          (m._mapPerItemDecls && m._mapPerItemDecls.some(function(p) { return p.name === im.parentArr; }));
        if (isPerItem) {
          out += `        _pi_${im.parentArr}_${mi}[${im.childIdx}].children = _map_pool_${imi}[_i][0.._map_count_${imi}[_i]];\n`;
        }
      }
    }
  
    // Emit inner array + pool node
    if (innerCount > 0) {
      // Build inner array items, replacing dynamic text refs
      let innerItems = [];
      if (innerArr) {
        const decl = (m.mapArrayDecls || []).find(d => d.startsWith(`var ${innerArr}`)) ||
                     ctx.arrayDecls.find(d => d.startsWith(`var ${innerArr}`));
        if (decl) {
          // Replace tagged map text refs in inner array — tags "__mtN__" wire precisely
          let inner = decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          for (const dt of mapDynTexts) {
            const ti = dt._mapTextIdx;
            inner = inner.replace(`"__mt${ti}__"`, `_map_texts_${mi}_${ti}[_i]`);
          }
          // Legacy fallback: replace any remaining untagged .text = "" sequentially
          for (let dti = dtConsumed; dti < dtConsumed + innerTextSlots && dti < mapDynTexts.length; dti++) {
            const dt = mapDynTexts[dti];
            const ti = dt._mapTextIdx;
            inner = inner.replace('.text = ""', `.text = _map_texts_${mi}_${ti}[_i]`);
          }
          // Replace references to per-item arrays from ALL maps
          for (let mj = 0; mj < ctx.maps.length; mj++) {
            const otherMap = ctx.maps[mj];
            if (!otherMap._mapPerItemDecls) continue;
            for (const pid of otherMap._mapPerItemDecls) {
              if (!otherMap.isNested && !otherMap.isInline) {
                inner = inner.replace(new RegExp(`&${pid.name}\\b`, 'g'), `_pi_${pid.name}_${mj}`);
              } else {
                inner = inner.replace(new RegExp(`&${pid.name}\\b`, 'g'), `&_map_${pid.name}_${mj}[_i]`);
              }
            }
          }
          // Replace nested map shared children refs with per-group pool slices
          for (let nmi = 0; nmi < ctx.maps.length; nmi++) {
            const nm = ctx.maps[nmi];
            if (!nm.isNested || nm.parentOaIdx !== m.oaIdx) continue;
            if (nm.parentArr && inner.includes(`&${nm.parentArr}`)) {
              inner = inner.replace(`&${nm.parentArr}`, `_map_pool_${nmi}[_i][0.._map_count_${nmi}[_i]]`);
            }
          }
          // Replace handler refs in inner array items with per-item handler string pointers
          // Must check ALL maps' handlers since nested map handlers may appear in parent inner arrays
          const innerPressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
          for (let mj = 0; mj < ctx.maps.length; mj++) {
            const allMH = ctx.handlers.filter(h => h.inMap && h.mapIdx === mj);
            for (let hi = 0; hi < allMH.length; hi++) {
              const mh = allMH[hi];
              if (mh.luaBody) {
                const escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                const escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const ptrReplacement = `.${innerPressField} = _map_lua_ptrs_${mj}_${hi}[_i]`;
                inner = inner.replace(new RegExp(`\\.lua_on_press = "${escapedRegex}"`, 'g'), ptrReplacement);
                inner = inner.replace(new RegExp(`\\.js_on_press = "${escapedRegex}"`, 'g'), ptrReplacement);
              }
              inner = inner.replace(new RegExp(`\\.on_press = (?:handlers\\.)?${mh.name}`, 'g'), `.${innerPressField} = _map_lua_ptrs_${mj}_${hi}[_i]`);
            }
          }
          // Replace raw map index param with Zig loop variable in inner node ternaries
          const innerIdxParam = m.indexParam || 'i';
          if (innerIdxParam !== '_i') {
            inner = inner.replace(new RegExp(`\\b${innerIdxParam}\\b`, 'g'), '@as(i64, @intCast(_i))');
          }
          out += `        const _inner_${mi} = _pool_arena.allocator().alloc(Node, ${innerCount}) catch unreachable;\n`;
          out += `        @memcpy(_inner_${mi}, &[_]Node{ ${inner} });\n`;
        }
      }
  
      // Inner array conditionals (display toggling for conditionals on inner array children)
      // These are conditionals like {filter == 0 && <Box>...} inside a map template,
      // where the conditional target is a child of the inner array, not a per-item sub-array.
      if (innerArr) {
        for (const cond of ctx.conditionals) {
          if (!cond.arrName || cond.arrName !== innerArr) continue;
          let resolvedExpr = cond.condExpr;
          // Resolve any remaining item.field references to OA field access
          if (m.oa) {
            const itemParam = m.itemParam || 'item';
            for (const f of m.oa.fields) {
              resolvedExpr = resolvedExpr.replace(new RegExp(`${itemParam}\\.${f.name}`, 'g'), `_oa${m.oa.oaIdx}_${f.name}[_i]`);
            }
          }
          // Skip unresolvable conditionals (e.g. JS function calls that can't compile to Zig)
          if (/\b0\(/.test(resolvedExpr) || /\b0\b.*@as/.test(resolvedExpr)) continue;
          const _wc = _wrapMapCondition(resolvedExpr);
          if (cond.kind === 'show_hide') {
            out += `        _inner_${mi}[${cond.trueIdx}].style.display = if ${_wc} .flex else .none;\n`;
          } else if (cond.kind === 'ternary_jsx') {
            out += `        _inner_${mi}[${cond.trueIdx}].style.display = if ${_wc} .flex else .none;\n`;
            out += `        _inner_${mi}[${cond.falseIdx}].style.display = if ${_wc} .none else .flex;\n`;
          }
        }
      }
  
      // Assign nested map children to the correct inner array slot
      for (let nmi = 0; nmi < ctx.maps.length; nmi++) {
        const nm = ctx.maps[nmi];
        if (!nm.isNested || nm.parentOaIdx !== m.oaIdx) continue;
        if (nm.parentArr) {
          // Find which inner array slot this nested map targets
          // nm.parentArr is the array name, nm.childIdx is the slot index
          // Check if parentArr is in the inner array
          const isInnerChild = innerArr && nm.parentArr === innerArr;
          if (isInnerChild) {
            out += `        _inner_${mi}[${nm.childIdx}].children = _map_pool_${nmi}[_i][0.._map_count_${nmi}[_i]];\n`;
          } else if (_promotedToPerItem.has(nm.parentArr) || (m._mapPerItemDecls && m._mapPerItemDecls.some(p => p.name === nm.parentArr))) {
            out += `        _pi_${nm.parentArr}_${mi}[${nm.childIdx}].children = _map_pool_${nmi}[_i][0.._map_count_${nmi}[_i]];\n`;
          } else {
            out += `        ${nm.parentArr}[${nm.childIdx}].children = _map_pool_${nmi}[_i][0.._map_count_${nmi}[_i]];\n`;
          }
        }
      }
  
      // Build pool node from template, replacing children ref + handler refs
      let poolNode = m.templateExpr;
      if (innerArr) {
        poolNode = poolNode.replace(`&${innerArr}`, `_inner_${mi}`);
      }
      // Replace per-item array refs in pool node from ALL maps
      for (let mj = 0; mj < ctx.maps.length; mj++) {
        const otherMap = ctx.maps[mj];
        if (!otherMap._mapPerItemDecls) continue;
        for (const pid of otherMap._mapPerItemDecls) {
          if (!otherMap.isNested && !otherMap.isInline) {
            poolNode = poolNode.replace(new RegExp(`&${pid.name}\\b`, 'g'), `_pi_${pid.name}_${mj}`);
          } else {
            poolNode = poolNode.replace(new RegExp(`&${pid.name}\\b`, 'g'), `&_map_${pid.name}_${mj}[_i]`);
          }
        }
      }
      // Replace handler refs with per-item handler string pointers
      // Use js_on_press when there's a <script> block (QuickJS dispatch)
      const pressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
      if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
        ctx._debugLines.push('[MAP_POOL_NODE] mi=' + mi + ' pressField=' + pressField + ' poolNode=' + poolNode.substring(0, 300));
      }
      for (let hi = 0; hi < mapHandlers.length; hi++) {
        const mh = mapHandlers[hi];
        const escaped = mh.luaBody ? mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
        const ptrReplacement = `.${pressField} = _map_lua_ptrs_${mi}_${hi}[_i]`;
        if (globalThis.__SMITH_DEBUG_MAP_PTRS) {
          print(`[MAP_PTR_WIRE_POOL] map=${mi} handler=${hi} field=${pressField} escaped="${escaped.substring(0,60)}..." poolNode has lua_on_press=${poolNode.includes('.lua_on_press')} js_on_press=${poolNode.includes('.js_on_press')}`);
        }
        // Match both .lua_on_press and .js_on_press — parse.js emits js_on_press for script blocks
        poolNode = poolNode.replace(`.lua_on_press = "${escaped}"`, ptrReplacement);
        poolNode = poolNode.replace(`.js_on_press = "${escaped}"`, ptrReplacement);
        poolNode = poolNode.replace(`.on_press = handlers.${mh.name}`, ptrReplacement);
        poolNode = poolNode.replace(`.on_press = ${mh.name}`, ptrReplacement);
      }
      // Swap field order: .children before .handlers in map pool nodes (matches reference)
      const hm = poolNode.match(/\.handlers = \.{[^}]+\}/);
      const cm = poolNode.match(/\.children = &[\w\[\]_]+/);
      if (hm && cm) {
        poolNode = poolNode.replace(hm[0] + ', ' + cm[0], cm[0] + ', ' + hm[0]);
      }
      // Handler ptr init moved to top of loop body (before @memcpy reads them).
      // Debug logging kept here for reference.
      const fieldRefsMap = m._handlerFieldRefsMap || {};
      if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
        ctx._debugLines.push('[MAP_HANDLER_DEBUG] map=' + mi + ' fieldRefsMap keys=' + JSON.stringify(Object.keys(fieldRefsMap)) + ' mapHandlers.length=' + mapHandlers.length);
        for (let _dhi = 0; _dhi < mapHandlers.length; _dhi++) {
          const _dmh = mapHandlers[_dhi];
          ctx._debugLines.push('[MAP_HANDLER_DEBUG]   handler[' + _dhi + '] name=' + _dmh.name + ' luaBody=' + (_dmh.luaBody || '').substring(0, 100) + ' fieldRefs=' + JSON.stringify(fieldRefsMap[_dhi] || []));
        }
      }
      // Replace raw map index param (e.g. 'i') with Zig loop variable in pool node ternary conditions
      const poolIdxParam = m.indexParam || 'i';
      if (poolIdxParam !== '_i') {
        poolNode = poolNode.replace(new RegExp(`\\b${poolIdxParam}\\b`, 'g'), '@as(i64, @intCast(_i))');
      }
      // If inner node has display conditional and pool node doesn't, hoist display to pool
      // so hidden items don't occupy gap space in the parent container
      if (innerCount === 1 && !poolNode.includes('.display') && !poolNode.includes('.style')) {
        poolNode = poolNode.replace('.{', '.{ .style = .{},');
        out += `        _map_pool_${mi}[_i] = ${poolNode};\n`;
        out += `        _map_pool_${mi}[_i].style.display = _inner_${mi}[0].style.display;\n`;
      } else {
        out += `        _map_pool_${mi}[_i] = ${poolNode};\n`;
      }
    } else {
      // Single-node map template (no inner array) — wire dynamic text refs
      let tExpr = m.templateExpr;
      for (let dti = 0; dti < mapDynTexts.length; dti++) {
        const dt = mapDynTexts[dti];
        const ti = dt._mapTextIdx;
        tExpr = tExpr.replace(`"__mt${ti}__"`, `_map_texts_${mi}_${ti}[_i]`);
        tExpr = tExpr.replace('.text = ""', `.text = _map_texts_${mi}_${ti}[_i]`);
      }
      out += `        _map_pool_${mi}[_i] = ${tExpr};\n`;
    }
  
    // Deferred canvas attributes — dynamic gx/gy/d from map item fields
    if (m._deferredCanvasAttrs) {
      for (const da of m._deferredCanvasAttrs) {
        const oaIdx = m.oaIdx;
        const oaField = `_oa${oaIdx}_${da.oaField}`;
        if (da.type === 'string') {
          out += `        _map_pool_${mi}[_i].${da.zigField} = ${oaField}[_i][0..${oaField}_lens[_i]];\n`;
        } else {
          out += `        _map_pool_${mi}[_i].${da.zigField} = @floatFromInt(${oaField}[_i]);\n`;
        }
      }
    }
    // Variant patches for classifier nodes inside this map (must be in-loop where _pi_ locals are in scope)
    const mapVBs = ctx.variantBindings.filter(function(vb) { return vb.inMap; });
    if (mapVBs.length > 0 && ctx.variantNames.length > 0) {
      out += `        {\n`;
      out += `        const _v = @as(usize, api.theme.rjit_theme_active_variant());\n`;
      for (const vb of mapVBs) {
        let target;
        if (!vb.arrName) {
          target = `_map_pool_${mi}[_i]`;
        } else if (vb.arrName === innerArr) {
          target = `_inner_${mi}[${vb.arrIndex}]`;
        } else {
          target = `_pi_${vb.arrName}_${mi}[${vb.arrIndex}]`;
        }
        for (let vi = 0; vi < vb.styles.length; vi++) {
          if (!vb.styles[vi]) continue;
          const fields = vb.styles[vi].split(/,\s*(?=\.)/).filter(function(f) { return f.trim().startsWith('.'); });
          const assignments = fields.map(function(f) {
            const eqIdx = f.indexOf('=');
            if (eqIdx < 0) return '';
            const sf = f.trim().slice(1, eqIdx).trim();
            const sv = f.slice(eqIdx + 1).trim();
            return `        ${target}.style.${sf} = ${sv};\n`;
          }).join('');
          if (!assignments) continue;
          if (vi === 0) {
            out += `        if (_v == 0) {\n${assignments}        }\n`;
          } else {
            out += `        else if (_v == ${vi}) {\n${assignments}        }\n`;
          }
        }
      }
      out += `        }\n`;
    }
    out += `    }\n`;
    // Bind pool to parent array
    if (m.parentArr) {
      out += `    ${m.parentArr}[${m.childIdx}].children = _map_pool_${mi}[0.._map_count_${mi}];\n`;
    }
    out += `}\n\n`;
  }

  return out;
}

function appendOrphanedMapArrays(out, ctx) {
  const declared = new Set();
  const declMatches = out.matchAll(/^var (_arr_\d+)/gm);
  for (const match of declMatches) declared.add(match[1]);

  const poolMatches = out.matchAll(/var _map_(_arr_\d+)_\d+/g);
  for (const match of poolMatches) declared.add(match[1]);

  const refMatches = out.matchAll(/&(_arr_\d+)\b/g);
  const missing = new Set();
  for (const match of refMatches) {
    if (!declared.has(match[1])) missing.add(match[1]);
  }

  if (missing.size > 0) {
    const allDecls = [].concat(ctx.arrayDecls);
    for (const map of ctx.maps) {
      if (map.mapArrayDecls) allDecls.push.apply(allDecls, map.mapArrayDecls);
      if (map._mapPerItemDecls) {
        for (const perItemDecl of map._mapPerItemDecls) allDecls.push(perItemDecl.decl);
      }
    }
    for (const decl of allDecls) {
      const match = decl.match(/^var (_arr_\d+)/);
      if (match && missing.has(match[1])) {
        out += decl + '\n';
        missing.delete(match[1]);
      }
    }
    for (const name of missing) {
      out += `var ${name} = [_]Node{ .{} }; // orphan stub\n`;
    }
  }

  const allRefs = [];
  for (const match of out.matchAll(/(?:&|\b)(_arr_\d+)\b/g)) allRefs.push(match[1]);
  const allDecls = new Set();
  for (const match of out.matchAll(/^var (_arr_\d+)/gm)) allDecls.add(match[1]);
  const stubs = [];
  for (const ref of allRefs) {
    if (!allDecls.has(ref)) {
      stubs.push(`var ${ref} = [_]Node{ .{} };\n`);
      allDecls.add(ref);
    }
  }
  if (stubs.length > 0) {
    const insertPoint = out.indexOf('var _root =');
    if (insertPoint >= 0) {
      out = out.slice(0, insertPoint) + stubs.join('') + out.slice(insertPoint);
    }
  }

  return out;
}
