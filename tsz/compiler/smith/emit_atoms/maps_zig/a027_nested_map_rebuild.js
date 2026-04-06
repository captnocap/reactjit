// ── Emit Atom 027: Nested map rebuild ───────────────────────────
// Index: 27
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: nested OA-backed maps under a parent flat map.
// Output target: nested child pool rebuilds inside parent loops.
//
// Notes:
//   Nested map rebuilds are emitted INLINE inside the parent flat map
//   rebuild loop (atom 026). _a027_emitNestedRebuild() produces the
//   Zig fragment for one parent map's nested children.
//
//   The nested rebuild:
//   1. Iterates _oa{cidx}_len scanning for _oa{cidx}_parentIdx == _i
//   2. For each match, formats nested dynamic texts with _flat_j indexing
//   3. Builds per-item inner arrays from shared declaration templates
//   4. Constructs nested handler ptrs with (parent_idx, item_idx) args
//   5. Assigns the pool node and increments the nested count

function _a027_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.isNested; });
}

// Produce the nested rebuild fragment for parent map `mi` (map object `m`).
// Called from inside the parent's `for (_i)` loop body.
// `_mapMeta` is meta.mapMeta, passed through to avoid re-lookup.
function _a027_emitNestedRebuild(ctx, meta, mi, m, _mapMeta) {
  var out = '';
  for (var nmi = 0; nmi < ctx.maps.length; nmi++) {
    var nm = ctx.maps[nmi];
    if (!nm.isNested || nm.parentOaIdx !== m.oaIdx) continue;
    var nestedOa = nm.oa;
    var cidx = nestedOa.oaIdx;
    // Build inner pool by filtering nested OA items by parentIdx
    out += '        // Nested map ' + nmi + ': ' + nm.nestedField + '\n';
    out += '        _map_count_' + nmi + '[_i] = 0;\n';
    out += '        for (0.._oa' + cidx + '_len) |_flat_j| {\n';
    out += '            if (_oa' + cidx + '_parentIdx[_flat_j] == _i) {\n';
    out += '                const _jj = _map_count_' + nmi + '[_i];\n';
    out += '                if (_jj >= MAX_MAP_' + nmi + ') break;\n';
    // Build nested pool node from template, replacing field refs
    var nestedPoolNode = nm.templateExpr;
    // Replace nested OA field refs: _oaX_field[_i] → _oaX_field[_flat_j]
    for (var fi = 0; fi < nestedOa.fields.length; fi++) {
      var cf = nestedOa.fields[fi];
      if (cf.type === 'string') {
        nestedPoolNode = nestedPoolNode.replace(
          new RegExp('_oa' + cidx + '_' + cf.name + '\\[_i\\]\\[0\\.\\._{1}oa' + cidx + '_' + cf.name + '_lens\\[_i\\]\\]', 'g'),
          '_oa' + cidx + '_' + cf.name + '[_flat_j][0.._oa' + cidx + '_' + cf.name + '_lens[_flat_j]]'
        );
      }
      nestedPoolNode = nestedPoolNode.replace(
        new RegExp('_oa' + cidx + '_' + cf.name + '\\[_i\\]', 'g'),
        '_oa' + cidx + '_' + cf.name + '[_flat_j]'
      );
    }
    // Replace nested map dynamic texts — use _flat_j for flat indexing
    var nestedMapDynTexts = ctx.dynTexts.filter(function(dt) { return dt.inMap && dt.mapIdx === nmi; });
    for (var dti = 0; dti < nestedMapDynTexts.length; dti++) {
      var dt = nestedMapDynTexts[dti];
      var ti = dt._mapTextIdx;
      // Fix fmt args to use _flat_j instead of _i for nested OA access
      var fixedArgs = dt.fmtArgs;
      for (var fi2 = 0; fi2 < nestedOa.fields.length; fi2++) {
        var cf2 = nestedOa.fields[fi2];
        fixedArgs = fixedArgs.replace(
          new RegExp('_oa' + cidx + '_' + cf2.name + '\\[_i\\]', 'g'),
          '_oa' + cidx + '_' + cf2.name + '[_flat_j]'
        );
        fixedArgs = fixedArgs.replace(
          new RegExp('_oa' + cidx + '_' + cf2.name + '_lens\\[_i\\]', 'g'),
          '_oa' + cidx + '_' + cf2.name + '_lens[_flat_j]'
        );
      }
      // Also replace bare _j refs (from template literal iterVar) with _flat_j
      fixedArgs = fixedArgs.replace(new RegExp('_oa' + cidx + '_(\\w+)\\[_j\\]', 'g'), '_oa' + cidx + '_$1[_flat_j]');
      fixedArgs = fixedArgs.replace(new RegExp('_oa' + cidx + '_(\\w+)_lens\\[_j\\]', 'g'), '_oa' + cidx + '_$1_lens[_flat_j]');
      fixedArgs = fixedArgs.replace(/@intCast\(_j\)/g, '@intCast(_flat_j)');
      out += '                _map_texts_' + nmi + '_' + ti + '[_flat_j] = std.fmt.bufPrint(&_map_text_bufs_' + nmi + '_' + ti + '[_flat_j], "' + dt.fmtString + '", .{ ' + fixedArgs + ' }) catch "";\n';
    }
    // Build per-item inner array from the shared children template
    var nestedMeta = _mapMeta[nmi];
    if (nestedMeta && nestedMeta.innerArr && nestedMeta.innerCount > 0) {
      // Find the shared array declaration to get the node template
      var sharedDecl = (nm.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + nestedMeta.innerArr); }) ||
                       ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + nestedMeta.innerArr); });
      if (sharedDecl) {
        var innerContent = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
        // Replace tagged map text refs, then fallback to sequential for untagged
        for (var dti2 = 0; dti2 < nestedMapDynTexts.length; dti2++) {
          var dt2 = nestedMapDynTexts[dti2];
          var ti2 = dt2._mapTextIdx;
          innerContent = innerContent.replace('"__mt' + ti2 + '__"', '_map_texts_' + nmi + '_' + ti2 + '[_flat_j]');
        }
        for (var dti3 = 0; dti3 < nestedMapDynTexts.length; dti3++) {
          var dt3 = nestedMapDynTexts[dti3];
          var ti3 = dt3._mapTextIdx;
          innerContent = innerContent.replace('.text = ""', '.text = _map_texts_' + nmi + '_' + ti3 + '[_flat_j]');
        }
        out += '                _map_inner_' + nmi + '[_flat_j] = [' + nestedMeta.innerCount + ']Node{ ' + innerContent + ' };\n';
        // Replace children ref in pool node to use per-item inner array
        nestedPoolNode = nestedPoolNode.replace('&' + nestedMeta.innerArr, '&_map_inner_' + nmi + '[_flat_j]');
      }
    }
    // Replace handler refs + build per-item Lua ptrs with (parent_idx, item_idx, ...field_refs)
    var nestedHandlers = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === nmi; });
    for (var nhi = 0; nhi < nestedHandlers.length; nhi++) {
      var _npRefs = (nm._nestedParentFieldRefs && nm._nestedParentFieldRefs[nhi]) || [];
      var _ncRefs = (nm._nestedChildFieldRefs && nm._nestedChildFieldRefs[nhi]) || [];
      var _hasNRefs = _npRefs.length > 0 || _ncRefs.length > 0;
      var _nBufSize = _hasNRefs ? 127 : 47;
      var _nFmtParts = ['{d}', '{d}'];
      var _nArgParts = ['_i', '_jj'];
      for (var pfi = 0; pfi < _npRefs.length; pfi++) {
        var _pf = _npRefs[pfi];
        if (_pf.type === 'string') {
          _nFmtParts.push("'{s}'");
          _nArgParts.push('_oa' + m.oaIdx + '_' + _pf.name + '[_i][0.._oa' + m.oaIdx + '_' + _pf.name + '_lens[_i]]');
        } else {
          _nFmtParts.push('{d}');
          _nArgParts.push('_oa' + m.oaIdx + '_' + _pf.name + '[_i]');
        }
      }
      for (var cfi = 0; cfi < _ncRefs.length; cfi++) {
        var _cf = _ncRefs[cfi];
        if (_cf.type === 'string') {
          _nFmtParts.push("'{s}'");
          _nArgParts.push('_oa' + cidx + '_' + _cf.name + '[_flat_j][0.._oa' + cidx + '_' + _cf.name + '_lens[_flat_j]]');
        } else {
          _nFmtParts.push('{d}');
          _nArgParts.push('_oa' + cidx + '_' + _cf.name + '[_flat_j]');
        }
      }
      out += '                {\n';
      out += '                    const _n = std.fmt.bufPrint(_map_lua_bufs_' + nmi + '_' + nhi + '[_flat_j][0..' + _nBufSize + '], "__mapPress_' + nmi + '_' + nhi + '(' + _nFmtParts.join(',') + ')", .{' + _nArgParts.join(', ') + '}) catch "";\n';
      out += '                    _map_lua_bufs_' + nmi + '_' + nhi + '[_flat_j][_n.len] = 0;\n';
      out += '                    _map_lua_ptrs_' + nmi + '_' + nhi + '[_flat_j] = @ptrCast(_map_lua_bufs_' + nmi + '_' + nhi + '[_flat_j][0.._n.len :0]);\n';
      out += '                }\n';
      var mh = nestedHandlers[nhi];
      var nestedPressField = 'lua_on_press';
      var nestedPtrRepl = '.' + nestedPressField + ' = _map_lua_ptrs_' + nmi + '_' + nhi + '[_flat_j]';
      nestedPoolNode = nestedPoolNode.replace('.lua_on_press = "' + (mh.luaBody ? mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '') + '"', nestedPtrRepl);
      nestedPoolNode = nestedPoolNode.replace('.js_on_press = "' + (mh.luaBody ? mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '') + '"', nestedPtrRepl);
      nestedPoolNode = nestedPoolNode.replace('.on_press = handlers.' + mh.name, nestedPtrRepl);
      nestedPoolNode = nestedPoolNode.replace('.on_press = ' + mh.name, nestedPtrRepl);
    }
    out += '                _map_pool_' + nmi + '[_i][_jj] = ' + nestedPoolNode + ';\n';
    out += '                _map_count_' + nmi + '[_i] += 1;\n';
    out += '            }\n';
    out += '        }\n';
  }
  return out;
}

function _a027_emit(ctx, meta) {
  // In practice, nested rebuilds are emitted per-parent-map by calling
  // _a027_emitNestedRebuild(ctx, meta, mi, m, _mapMeta) from the parent
  // loop in atom 026 / map_pools.js. This top-level _emit produces the
  // full output for all parent maps that have nested children.
  if (!ctx.maps || ctx.maps.length === 0) return '';
  var _mapMeta = meta.mapMeta;
  var out = '';
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var m = ctx.maps[mi];
    if (m.isNested || m.isInline) continue;
    var fragment = _a027_emitNestedRebuild(ctx, meta, mi, m, _mapMeta);
    if (fragment) out += fragment;
  }
  return out;
}

_emitAtoms[27] = {
  id: 27,
  name: 'nested_map_rebuild',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a027_applies,
  emit: _a027_emit,
  emitNestedRebuild: _a027_emitNestedRebuild,
};
