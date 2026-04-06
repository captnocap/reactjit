// ── Emit Atom 028: Inline map rebuild ───────────────────────────
// Index: 28
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: inline OA-backed maps rendered inside another map item.
// Output target: inline child rebuilds and parent child assignment.
//
// Notes:
//   Inline map rebuilds are emitted INLINE inside the parent flat map
//   rebuild loop (atom 026). _a028_emitInlineRebuild() produces the
//   Zig fragment for one parent map's inline children.
//
//   The inline rebuild:
//   1. Sets _map_count_{imi}[_i] from the inline OA length
//   2. Loops _j over the inline items per parent iteration
//   3. Formats dynamic texts with [_i][_j] indexing
//   4. Builds handler ptrs with (outer, inner) or (inner) args
//   5. Fills per-item arrays with _i→_j field ref fixup
//   6. Constructs inner arrays with the same _i→_j rewriting
//   7. Builds the pool node, hoisting .style if needed
//   8. Evaluates per-item conditionals with resolveInlineCond()
//   9. Binds the inline pool slice to the parent per-item array
//
//   The _i→_j rewrite preserves outer-scope @as(i64, @intCast(_i))
//   references using a placeholder pattern (__SMITH_OUTER_I64_I__).
//
//   Also includes appendOrphanedMapArrays() — the cleanup pass that
//   catches map arrays referenced but never declared.

// wrapCondition is a global function defined in emit_ops/wrap_condition.js

function _a028_applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return m.isInline; });
}

// Produce the inline rebuild fragment for parent map `mi` (map object `m`).
// Called from inside the parent's `for (_i)` loop body.
// `_mapMeta` is meta.mapMeta, `_promotedToPerItem` is meta.promotedToPerItem.
function _a028_emitInlineRebuild(ctx, meta, mi, m, _mapMeta, _promotedToPerItem) {
  var out = '';
  for (var imi = 0; imi < ctx.maps.length; imi++) {
    var im = ctx.maps[imi];
    if (!im.isInline || im._parentMi !== mi) continue;
    var imMeta = _mapMeta[imi];
    if (!imMeta) continue;
    var imOa = im.oa;
    var imPressField = 'lua_on_press';

    out += '        // inline map ' + imi + ': ' + imOa.getter + '.map (per-parent)\n';
    out += '        _map_count_' + imi + '[_i] = @min(_oa' + im.oaIdx + '_len, MAX_MAP_' + imi + ');\n';
    out += '        {\n        var _j: usize = 0;\n        while (_j < _map_count_' + imi + '[_i]) : (_j += 1) {\n';

    // Text formatting with [_i][_j], inner OA uses _j
    for (var dti = 0; dti < imMeta.mapDynTexts.length; dti++) {
      var dt = imMeta.mapDynTexts[dti];
      var ti = dt._mapTextIdx;
      var args = dt.fmtArgs;
      for (var fi = 0; fi < imOa.fields.length; fi++) {
        var f = imOa.fields[fi];
        args = args.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + f.name + '_lens\\[_i\\]\\]', 'g'),
          '_oa' + im.oaIdx + '_' + f.name + '[_j][0.._oa' + im.oaIdx + '_' + f.name + '_lens[_j]]');
        args = args.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '_lens\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f.name + '_lens[_j]');
        args = args.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f.name + '[_j]');
      }
      // Do not rewrite @as(i64, @intCast(_i)) here — that is the outer map index; inner uses _j from template_literal / props.
      out += '            _map_texts_' + imi + '_' + ti + '[_i][_j] = std.fmt.bufPrint(&_map_text_bufs_' + imi + '_' + ti + '[_i][_j], "' + dt.fmtString + '", .{ ' + args + ' }) catch "";\n';
    }

    // Handler pointers BEFORE node literals that embed .js_on_press / .lua_on_press (otherwise nodes capture null).
    for (var hi = 0; hi < imMeta.mapHandlers.length; hi++) {
      out += '            {\n';
      if (im.parentMap) {
        // Inline map inside another map — pass both outer (_i) and inner (_j) indices
        out += '                const _n = std.fmt.bufPrint(_map_lua_bufs_' + imi + '_' + hi + '[_i][_j][0..47], "__mapPress_' + imi + '_' + hi + '({d},{d})", .{_i, _j}) catch "";\n';
      } else {
        out += '                const _n = std.fmt.bufPrint(_map_lua_bufs_' + imi + '_' + hi + '[_i][_j][0..47], "__mapPress_' + imi + '_' + hi + '({d})", .{_j}) catch "";\n';
      }
      out += '                _map_lua_bufs_' + imi + '_' + hi + '[_i][_j][_n.len] = 0;\n';
      out += '                _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j] = @ptrCast(_map_lua_bufs_' + imi + '_' + hi + '[_i][_j][0.._n.len :0]);\n';
      out += '            }\n';
    }

    // Per-item array fills with content fixup
    // IMPORTANT: handler replacement FIRST (before _i→_j), since handler body
    // strings in declarations match the original pre-fixup content
    var imDtConsumed = 0;
    for (var pidi = 0; pidi < imMeta.mapPerItemDecls.length; pidi++) {
      var pid = imMeta.mapPerItemDecls[pidi];
      var content = pid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
      // 1. Wire handler refs FIRST — match original handler body before content changes
      for (var hi2 = 0; hi2 < imMeta.mapHandlers.length; hi2++) {
        var mh = imMeta.mapHandlers[hi2];
        if (mh.luaBody) {
          var escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          var escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          content = content.replace(new RegExp('\\.lua_on_press = "' + escapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi2 + '[_i][_j]');
          content = content.replace(new RegExp('\\.js_on_press = "' + escapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi2 + '[_i][_j]');
        }
        content = content.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh.name, 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi2 + '[_i][_j]');
      }
      // 2. Fix inner OA field refs: _i→_j
      for (var fi2 = 0; fi2 < imOa.fields.length; fi2++) {
        var f2 = imOa.fields[fi2];
        content = content.replace(new RegExp('_oa' + im.oaIdx + '_' + f2.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + f2.name + '_lens\\[_i\\]\\]', 'g'),
          '_oa' + im.oaIdx + '_' + f2.name + '[_j][0.._oa' + im.oaIdx + '_' + f2.name + '_lens[_j]]');
        content = content.replace(new RegExp('_oa' + im.oaIdx + '_' + f2.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f2.name + '[_j]');
      }
      // Preserve outer-section @as(i64, @intCast(_i)) while rewriting inner-index _i→_j elsewhere
      content = content.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
      content = content.replace(/@intCast\(_i\)/g, '@intCast(_j)');
      content = content.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
      // 3. Fix per-item array refs to [_i][_j]
      for (var pidi2 = 0; pidi2 < imMeta.mapPerItemDecls.length; pidi2++) {
        var pid2 = imMeta.mapPerItemDecls[pidi2];
        content = content.replace(new RegExp('&' + pid2.name + '\\b', 'g'), '&_map_' + pid2.name + '_' + imi + '[_i][_j]');
      }
      // 4. Wire tagged map text refs [_i][_j], then fallback sequential
      for (var dti2 = 0; dti2 < imMeta.mapDynTexts.length; dti2++) {
        var dt2 = imMeta.mapDynTexts[dti2];
        var ti2 = dt2._mapTextIdx;
        content = content.replace('"__mt' + ti2 + '__"', '_map_texts_' + imi + '_' + ti2 + '[_i][_j]');
      }
      while (imDtConsumed < imMeta.mapDynTexts.length) {
        var dt3 = imMeta.mapDynTexts[imDtConsumed];
        var ti3 = dt3._mapTextIdx;
        var next = content.replace('.text = ""', '.text = _map_texts_' + imi + '_' + ti3 + '[_i][_j]');
        if (next === content) break;
        content = next;
        imDtConsumed++;
      }
      out += '            _map_' + pid.name + '_' + imi + '[_i][_j] = [' + pid.elemCount + ']Node{ ' + content + ' };\n';
    }

    // Inner array construction
    if (imMeta.innerArr && imMeta.innerCount > 0) {
      var sharedDecl = (im.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + imMeta.innerArr); }) ||
                       ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + imMeta.innerArr); });
      if (sharedDecl) {
        var ic = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
        for (var fi3 = 0; fi3 < imOa.fields.length; fi3++) {
          var f3 = imOa.fields[fi3];
          ic = ic.replace(new RegExp('_oa' + im.oaIdx + '_' + f3.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + f3.name + '_lens\\[_i\\]\\]', 'g'),
            '_oa' + im.oaIdx + '_' + f3.name + '[_j][0.._oa' + im.oaIdx + '_' + f3.name + '_lens[_j]]');
          ic = ic.replace(new RegExp('_oa' + im.oaIdx + '_' + f3.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f3.name + '[_j]');
        }
        ic = ic.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
        ic = ic.replace(/@intCast\(_i\)/g, '@intCast(_j)');
        ic = ic.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
        for (var pidi3 = 0; pidi3 < imMeta.mapPerItemDecls.length; pidi3++) {
          var pid3 = imMeta.mapPerItemDecls[pidi3];
          ic = ic.replace(new RegExp('&' + pid3.name + '\\b', 'g'), '&_map_' + pid3.name + '_' + imi + '[_i][_j]');
        }
        for (var dti3 = 0; dti3 < imMeta.mapDynTexts.length; dti3++) {
          var dt4 = imMeta.mapDynTexts[dti3];
          var ti4 = dt4._mapTextIdx;
          ic = ic.replace('"__mt' + ti4 + '__"', '_map_texts_' + imi + '_' + ti4 + '[_i][_j]');
          ic = ic.replace('.text = ""', '.text = _map_texts_' + imi + '_' + ti4 + '[_i][_j]');
        }
        for (var hi3 = 0; hi3 < imMeta.mapHandlers.length; hi3++) {
          var mh2 = imMeta.mapHandlers[hi3];
          if (mh2.luaBody) {
            var escaped2 = mh2.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            var escapedRegex2 = escaped2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            ic = ic.replace(new RegExp('\\.lua_on_press = "' + escapedRegex2 + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi3 + '[_i][_j]');
            ic = ic.replace(new RegExp('\\.js_on_press = "' + escapedRegex2 + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi3 + '[_i][_j]');
          }
          ic = ic.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh2.name, 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi3 + '[_i][_j]');
        }
        out += '            _map_inner_' + imi + '[_i][_j] = [' + imMeta.innerCount + ']Node{ ' + ic + ' };\n';
      }
    }

    // Pool node
    var imPool = im.templateExpr;
    for (var fi4 = 0; fi4 < imOa.fields.length; fi4++) {
      var f4 = imOa.fields[fi4];
      imPool = imPool.replace(new RegExp('_oa' + im.oaIdx + '_' + f4.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f4.name + '[_j]');
    }
    imPool = imPool.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
    imPool = imPool.replace(/@intCast\(_i\)/g, '@intCast(_j)');
    imPool = imPool.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
    if (imMeta.innerArr) imPool = imPool.replace('&' + imMeta.innerArr, '&_map_inner_' + imi + '[_i][_j]');
    for (var pidi4 = 0; pidi4 < imMeta.mapPerItemDecls.length; pidi4++) {
      var pid4 = imMeta.mapPerItemDecls[pidi4];
      imPool = imPool.replace(new RegExp('&' + pid4.name + '\\b', 'g'), '&_map_' + pid4.name + '_' + imi + '[_i][_j]');
    }
    for (var hi4 = 0; hi4 < imMeta.mapHandlers.length; hi4++) {
      var mh3 = imMeta.mapHandlers[hi4];
      if (mh3.luaBody) {
        var escaped3 = mh3.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        imPool = imPool.replace('.lua_on_press = "' + escaped3 + '"', '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi4 + '[_i][_j]');
        imPool = imPool.replace('.js_on_press = "' + escaped3 + '"', '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi4 + '[_i][_j]');
      }
      imPool = imPool.replace('.on_press = handlers.' + mh3.name, '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi4 + '[_i][_j]');
      imPool = imPool.replace('.on_press = ' + mh3.name, '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi4 + '[_i][_j]');
    }
    // Per-item conditionals for inline map (display:none toggling)
    // Resolve raw .tsz names in condition expressions:
    //   item.field → _oaX_field[_j], parentItem.field → _oaY_field[_i]
    //   innerIdx → @as(i64, @intCast(_j)), outerIdx → @as(i64, @intCast(_i))
    function resolveInlineCond(expr) {
      var r = expr;
      // Inner map item.field → _oaX_field[_j]
      if (imOa) {
        var ip = im.itemParam || 'item';
        for (var rfi = 0; rfi < imOa.fields.length; rfi++) {
          var rf = imOa.fields[rfi];
          r = r.replace(new RegExp(ip + '\\.' + rf.name, 'g'), '_oa' + im.oaIdx + '_' + rf.name + '[_j]');
          r = r.replace(new RegExp('_oa' + im.oaIdx + '_' + rf.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + rf.name + '[_j]');
        }
      }
      // Outer map item.field → _oaY_field[_i]
      if (m.oa) {
        var op = m.itemParam || 'col';
        for (var rfi2 = 0; rfi2 < m.oa.fields.length; rfi2++) {
          var rf2 = m.oa.fields[rfi2];
          r = r.replace(new RegExp(op + '\\.' + rf2.name, 'g'), '_oa' + m.oa.oaIdx + '_' + rf2.name + '[_i]');
        }
      }
      // Index params: outer stays _i, inner becomes _j
      var outerIdx = m.indexParam || 'ci';
      var innerIdx = im.indexParam || 'ti';
      // Use placeholder to prevent overwrite: outer→__OUTER__, then inner→_j, then __OUTER__→_i
      r = r.replace(new RegExp('\\b' + outerIdx + '\\b', 'g'), '@as(i64, @intCast(__OUTER_IDX__))');
      r = r.replace(new RegExp('\\b' + innerIdx + '\\b', 'g'), '@as(i64, @intCast(_j))');
      // Inner OA _i refs already handled above.
      // Any remaining @intCast(_i) are outer-scope references — leave as _i.
      // Restore outer index placeholder
      r = r.replace(/__OUTER_IDX__/g, '_i');
      return r;
    }
    for (var ci = 0; ci < ctx.conditionals.length; ci++) {
      var cond = ctx.conditionals[ci];
      if (!cond.arrName) continue;
      var condPid = imMeta.mapPerItemDecls.find(function(p) { return p.name === cond.arrName; });
      if (!condPid) continue;
      var poolArr = '_map_' + cond.arrName + '_' + imi + '[_i][_j]';
      var resolvedExpr = resolveInlineCond(cond.condExpr);
      if (cond.kind === 'show_hide') {
        out += '            ' + poolArr + '[' + cond.trueIdx + '].style.display = if ((' + resolvedExpr + ')) .flex else .none;\n';
      } else if (cond.kind === 'ternary_jsx') {
        var _w = wrapCondition(resolvedExpr);
        out += '            ' + poolArr + '[' + cond.trueIdx + '].style.display = if ' + _w + ' .flex else .none;\n';
        out += '            ' + poolArr + '[' + cond.falseIdx + '].style.display = if ' + _w + ' .none else .flex;\n';
      }
    }
    // Inner array conditionals (applied to _map_inner)
    if (imMeta.innerArr && imMeta.innerCount > 0) {
      for (var ci2 = 0; ci2 < ctx.conditionals.length; ci2++) {
        var cond2 = ctx.conditionals[ci2];
        if (!cond2.arrName || cond2.arrName !== imMeta.innerArr) continue;
        var resolvedExpr2 = resolveInlineCond(cond2.condExpr);
        if (cond2.kind === 'show_hide') {
          out += '            _map_inner_' + imi + '[_i][_j][' + cond2.trueIdx + '].style.display = if ((' + resolvedExpr2 + ')) .flex else .none;\n';
        } else if (cond2.kind === 'ternary_jsx') {
          var _w2 = wrapCondition(resolvedExpr2);
          out += '            _map_inner_' + imi + '[_i][_j][' + cond2.trueIdx + '].style.display = if ' + _w2 + ' .flex else .none;\n';
          out += '            _map_inner_' + imi + '[_i][_j][' + cond2.falseIdx + '].style.display = if ' + _w2 + ' .none else .flex;\n';
        }
      }
    }

    // If inner node has display conditional and pool node doesn't, hoist display to pool
    var imHadStyle = imPool.includes('.style');
    if (!imHadStyle) {
      imPool = imPool.replace('.{', '.{ .style = .{},');
    }
    out += '            _map_pool_' + imi + '[_i][_j] = ' + imPool + ';\n';
    if (!imHadStyle && imMeta.innerArr && imMeta.innerCount > 0) {
      out += '            _map_pool_' + imi + '[_i][_j].style.display = _map_inner_' + imi + '[_i][_j][0].style.display;\n';
    }
    out += '        }\n        }\n';

    // Bind inline pool to parent's per-item array
    if (im.parentArr) {
      var isPerItem = _promotedToPerItem.has(im.parentArr) ||
                      (m._mapPerItemDecls && m._mapPerItemDecls.some(function(p) { return p.name === im.parentArr; }));
      if (isPerItem) {
        out += '        _pi_' + im.parentArr + '_' + mi + '[' + im.childIdx + '].children = _map_pool_' + imi + '[_i][0.._map_count_' + imi + '[_i]];\n';
      }
    }
  }
  return out;
}

// Cleanup pass: catches map arrays that are referenced but never declared.
// Called as a post-pass on the full generated output string.
function _a028_appendOrphanedMapArrays(out, ctx) {
  var declared = new Set();
  var declMatches = out.matchAll(/^var (_arr_\d+)/gm);
  for (var match of declMatches) declared.add(match[1]);

  var poolMatches = out.matchAll(/var _map_(_arr_\d+)_\d+/g);
  for (var match of poolMatches) declared.add(match[1]);

  var refMatches = out.matchAll(/&(_arr_\d+)\b/g);
  var missing = new Set();
  for (var match of refMatches) {
    if (!declared.has(match[1])) missing.add(match[1]);
  }

  if (missing.size > 0) {
    var allDecls = [].concat(ctx.arrayDecls);
    for (var i = 0; i < ctx.maps.length; i++) {
      var map = ctx.maps[i];
      if (map.mapArrayDecls) allDecls.push.apply(allDecls, map.mapArrayDecls);
      if (map._mapPerItemDecls) {
        for (var j = 0; j < map._mapPerItemDecls.length; j++) {
          allDecls.push(map._mapPerItemDecls[j].decl);
        }
      }
    }
    for (var k = 0; k < allDecls.length; k++) {
      var decl = allDecls[k];
      var m = decl.match(/^var (_arr_\d+)/);
      if (m && missing.has(m[1])) {
        out += decl + '\n';
        missing.delete(m[1]);
      }
    }
    for (var name of missing) {
      out += 'var ' + name + ' = [_]Node{ .{} }; // orphan stub\n';
    }
  }

  var allRefs = [];
  for (var match of out.matchAll(/(?:&|\b)(_arr_\d+)\b/g)) allRefs.push(match[1]);
  var allDeclSet = new Set();
  for (var match of out.matchAll(/^var (_arr_\d+)/gm)) allDeclSet.add(match[1]);
  var stubs = [];
  for (var ri = 0; ri < allRefs.length; ri++) {
    var ref = allRefs[ri];
    if (!allDeclSet.has(ref)) {
      stubs.push('var ' + ref + ' = [_]Node{ .{} };\n');
      allDeclSet.add(ref);
    }
  }
  if (stubs.length > 0) {
    var insertPoint = out.indexOf('var _root =');
    if (insertPoint >= 0) {
      out = out.slice(0, insertPoint) + stubs.join('') + out.slice(insertPoint);
    }
  }

  return out;
}

function _a028_emit(ctx, meta) {
  // In practice, inline rebuilds are emitted per-parent-map by calling
  // _a028_emitInlineRebuild(ctx, meta, mi, m, _mapMeta, _promotedToPerItem)
  // from the parent loop in atom 026 / map_pools.js. This top-level _emit
  // produces the full output for all parent maps that have inline children.
  if (!ctx.maps || ctx.maps.length === 0) return '';
  var _mapMeta = meta.mapMeta;
  var _promotedToPerItem = meta.promotedToPerItem;
  var out = '';
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var m = ctx.maps[mi];
    if (m.isNested || m.isInline) continue;
    var fragment = _a028_emitInlineRebuild(ctx, meta, mi, m, _mapMeta, _promotedToPerItem);
    if (fragment) out += fragment;
  }
  return out;
}

_emitAtoms[28] = {
  id: 28,
  name: 'inline_map_rebuild',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: _a028_applies,
  emit: _a028_emit,
  emitInlineRebuild: _a028_emitInlineRebuild,
  appendOrphanedMapArrays: _a028_appendOrphanedMapArrays,
};
