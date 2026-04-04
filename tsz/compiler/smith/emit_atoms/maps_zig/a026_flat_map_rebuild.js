// ── Emit Atom 026: Flat map rebuild ─────────────────────────────
// Index: 26
// Group: maps_zig
// Target: zig
// Status: complete
// Current owner: emit/map_pools.js
//
// Trigger: top-level OA-backed maps (not nested, not inline).
// Output target: _rebuildMapN() function with arena alloc, per-item
//   text formatting, handler ptr init, per-item array fills, per-item
//   conditionals, nested/inline sub-rebuilds, inner array construction,
//   pool node assignment, filter display toggles, variant patches,
//   deferred canvas attrs, and parent array binding.
//
// Notes:
//   This is the largest single atom — it contains the full flat map
//   rebuild loop from emitMapPoolRebuilds() lines 359-1166.
//   Nested and inline rebuilds are emitted INSIDE this loop body
//   (they run per parent iteration), but are extracted to atoms 027/028
//   as reference. In the live emitter they remain inlined here.

var a019 = require('./a019_map_metadata.js');
var _wrapMapCondition = a019._wrapMapCondition;

function applies(ctx, meta) {
  void meta;
  if (!ctx.maps || ctx.maps.length === 0) return false;
  return ctx.maps.some(function(m) { return !m.isNested && !m.isInline; });
}

function emit(ctx, meta) {
  var mapOrder = meta._mapOrder;
  var _promotedToPerItem = meta._promotedToPerItem;
  var _mapMeta = meta._perMap;
  if (!mapOrder || !_mapMeta) return '';

  var out = '';
  for (var oi = 0; oi < mapOrder.length; oi++) {
    var mi = mapOrder[oi];
    var m = ctx.maps[mi];
    if (m.isNested || m.isInline) continue;

    var pmeta = _mapMeta[mi];
    if (!pmeta) continue;
    var mapPerItemDecls = pmeta.mapPerItemDecls || [];
    var mapDynTexts = pmeta.mapDynTexts || [];
    var mapHandlers = pmeta.mapHandlers || [];
    var innerCount = pmeta.innerCount;
    var innerArr = pmeta.innerArr;

    out += 'fn _rebuildMap' + mi + '() void {\n';
    out += '    _map_count_' + mi + ' = @min(_oa' + m.oaIdx + '_len, MAX_MAP_' + mi + ');\n';
    out += '    _map_pool_' + mi + ' = _pool_arena.allocator().alloc(Node, _map_count_' + mi + ') catch unreachable;\n';
    out += '    for (0.._map_count_' + mi + ') |_i| {\n';

    // Per-item text formatting
    for (var dti = 0; dti < mapDynTexts.length; dti++) {
      var dt = mapDynTexts[dti];
      var ti = dt._mapTextIdx;
      out += '        _map_texts_' + mi + '_' + ti + '[_i] = std.fmt.bufPrint(&_map_text_bufs_' + mi + '_' + ti + '[_i], "' + dt.fmtString + '", .{ ' + dt.fmtArgs + ' }) catch "";\n';
    }

    // Handler ptr init BEFORE per-item arrays (field-ref handlers built inline)
    var _earlyFieldRefsMap = m._handlerFieldRefsMap || {};
    for (var _ehi = 0; _ehi < mapHandlers.length; _ehi++) {
      var _erefs = _earlyFieldRefsMap[_ehi] || [];
      if (_erefs.length > 0) {
        var _eoaIdx = m.oa ? m.oa.oaIdx : (m.oaIdx || 0);
        var _efmtParts = ['{d}'];
        var _eargParts = ['_i'];
        for (var efi = 0; efi < _erefs.length; efi++) {
          var _ef = _erefs[efi];
          if (_ef.type === 'string') {
            _efmtParts.push("'{s}'");
            _eargParts.push('_oa' + _eoaIdx + '_' + _ef.name + '[_i][0.._oa' + _eoaIdx + '_' + _ef.name + '_lens[_i]]');
          } else {
            _efmtParts.push('{d}');
            _eargParts.push('_oa' + _eoaIdx + '_' + _ef.name + '[_i]');
          }
        }
        out += '        {\n';
        out += '            const _n = std.fmt.bufPrint(_map_lua_bufs_' + mi + '_' + _ehi + '[_i][0..127], "__mapPress_' + mi + '_' + _ehi + '(' + _efmtParts.join(',') + ')", .{' + _eargParts.join(', ') + '}) catch "";\n';
        out += '            _map_lua_bufs_' + mi + '_' + _ehi + '[_i][_n.len] = 0;\n';
        out += '            _map_lua_ptrs_' + mi + '_' + _ehi + '[_i] = @ptrCast(_map_lua_bufs_' + mi + '_' + _ehi + '[_i][0.._n.len :0]);\n';
        out += '        }\n';
      }
    }

    // Debug trace
    if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
      ctx._debugLines.push('[MAP_TEXT_DEBUG] map ' + mi + ': ' + mapDynTexts.length + ' dynTexts');
    }

    // Inner text slot counting for JSX-order assignment
    var innerTextSlots = 0;
    if (innerArr) {
      var innerDecl = (m.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + innerArr); }) ||
                      ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + innerArr); });
      if (innerDecl) innerTextSlots = (innerDecl.match(/\.text = ""/g) || []).length;
    }

    // Fill per-item component arrays
    var dtConsumed = 0;
    var dtSkippedForInner = 0;
    var pidPressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
    for (var pi = 0; pi < mapPerItemDecls.length; pi++) {
      var pid = mapPerItemDecls[pi];
      var content = pid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
      var fixedContent = content;
      // Replace refs to per-item arrays from ALL maps
      for (var mj = 0; mj < ctx.maps.length; mj++) {
        var otherMap = ctx.maps[mj];
        if (!otherMap._mapPerItemDecls) continue;
        for (var pj = 0; pj < otherMap._mapPerItemDecls.length; pj++) {
          var pid2 = otherMap._mapPerItemDecls[pj];
          if (!otherMap.isNested && !otherMap.isInline) {
            fixedContent = fixedContent.replace(new RegExp('&' + pid2.name + '\\b', 'g'), '_pi_' + pid2.name + '_' + mj);
          } else {
            fixedContent = fixedContent.replace(new RegExp('&' + pid2.name + '\\b', 'g'), '&_map_' + pid2.name + '_' + mj + '[_i]');
          }
        }
      }
      // Tagged map text refs
      var _taggedCount = 0;
      for (var tdi = 0; tdi < mapDynTexts.length; tdi++) {
        var tdt = mapDynTexts[tdi];
        var tti = tdt._mapTextIdx;
        var before = fixedContent;
        fixedContent = fixedContent.replace('"__mt' + tti + '__"', '_map_texts_' + mi + '_' + tti + '[_i]');
        if (fixedContent !== before) _taggedCount++;
      }
      // Legacy fallback: sequential .text = "" replacement
      var pidDtIdx = dtConsumed + _taggedCount;
      dtConsumed += _taggedCount;
      while (pidDtIdx < mapDynTexts.length) {
        var sdt = mapDynTexts[pidDtIdx];
        var sti = sdt._mapTextIdx;
        var next = fixedContent.replace('.text = ""', '.text = _map_texts_' + mi + '_' + sti + '[_i]');
        if (next === fixedContent) break;
        fixedContent = next;
        pidDtIdx++;
        dtConsumed++;
      }
      // Handler refs → per-item handler string pointers
      for (var hmj = 0; hmj < ctx.maps.length; hmj++) {
        var allMH = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === hmj; });
        for (var hhi = 0; hhi < allMH.length; hhi++) {
          var mh = allMH[hhi];
          if (mh.luaBody) {
            var escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            var escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var ptrReplacement = '.' + pidPressField + ' = _map_lua_ptrs_' + hmj + '_' + hhi + '[_i]';
            fixedContent = fixedContent.replace(new RegExp('\\.lua_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
            fixedContent = fixedContent.replace(new RegExp('\\.js_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
          }
          var ptrReplacement2 = '.' + pidPressField + ' = _map_lua_ptrs_' + hmj + '_' + hhi + '[_i]';
          fixedContent = fixedContent.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh.name, 'g'), ptrReplacement2);
        }
      }
      // Replace raw map index param with Zig loop variable
      var idxParam = m.indexParam || 'i';
      if (idxParam !== '_i') {
        fixedContent = fixedContent.replace(new RegExp('\\b' + idxParam + '\\b', 'g'), '@as(i64, @intCast(_i))');
      }
      out += '        const _pi_' + pid.name + '_' + mi + ' = _pool_arena.allocator().alloc(Node, ' + pid.elemCount + ') catch unreachable;\n';
      out += '        @memcpy(_pi_' + pid.name + '_' + mi + ', &[_]Node{ ' + fixedContent + ' });\n';
    }

    // Per-item conditionals (visibility toggling inside map components)
    for (var ci = 0; ci < ctx.conditionals.length; ci++) {
      var cond = ctx.conditionals[ci];
      if (!cond.arrName || !m._mapPerItemDecls) continue;
      if (cond.inMap && cond.mapIdx !== undefined && cond.mapIdx !== mi) continue;
      var cpid = m._mapPerItemDecls.find(function(p) { return p.name === cond.arrName; });
      if (!cpid) continue;
      var poolArr = '_pi_' + cond.arrName + '_' + mi;
      var resolvedExpr = cond.condExpr;
      if (m.oa) {
        var itemParam = m.itemParam || 'item';
        for (var fi = 0; fi < m.oa.fields.length; fi++) {
          var f = m.oa.fields[fi];
          resolvedExpr = resolvedExpr.replace(new RegExp(itemParam + '\\.' + f.name, 'g'), '_oa' + m.oa.oaIdx + '_' + f.name + '[_i]');
        }
      }
      if (/\b0\(/.test(resolvedExpr) || /(?<!\()0\b.*@as/.test(resolvedExpr)) continue;
      var wrapped = _wrapMapCondition(resolvedExpr);
      if (cond.kind === 'show_hide') {
        out += '        ' + poolArr + '[' + cond.trueIdx + '].style.display = if ' + wrapped + ' .flex else .none;\n';
      } else if (cond.kind === 'ternary_jsx') {
        out += '        ' + poolArr + '[' + cond.trueIdx + '].style.display = if ' + wrapped + ' .flex else .none;\n';
        out += '        ' + poolArr + '[' + cond.falseIdx + '].style.display = if ' + wrapped + ' .none else .flex;\n';
      }
    }

    // Per-item dynamic texts (non-inMap texts targeting per-item arrays)
    for (var pdi = 0; pdi < ctx.dynTexts.length; pdi++) {
      var pdt = ctx.dynTexts[pdi];
      if (pdt.inMap) continue;
      if (!pdt.arrName || !m._mapPerItemDecls) continue;
      var pdPid = m._mapPerItemDecls.find(function(p) { return p.name === pdt.arrName; });
      if (!pdPid) continue;
      var pdPoolArr = '_pi_' + pdt.arrName + '_' + mi;
      var dtF = pdt.targetField || 'text';
      out += '        ' + pdPoolArr + '[' + pdt.arrIndex + '].' + dtF + ' = std.fmt.bufPrint(&_dyn_buf_' + pdt.bufId + ', "' + pdt.fmtString + '", .{ ' + pdt.fmtArgs + ' }) catch "";\n';
    }

    // Nested map rebuilds (atom 027 reference — emitted inline here)
    for (var nmi = 0; nmi < ctx.maps.length; nmi++) {
      var nm = ctx.maps[nmi];
      if (!nm.isNested || nm.parentOaIdx !== m.oaIdx) continue;
      var nestedOa = nm.oa;
      var cidx = nestedOa.oaIdx;
      out += '        // Nested map ' + nmi + ': ' + nm.nestedField + '\n';
      out += '        _map_count_' + nmi + '[_i] = 0;\n';
      out += '        for (0.._oa' + cidx + '_len) |_flat_j| {\n';
      out += '            if (_oa' + cidx + '_parentIdx[_flat_j] == _i) {\n';
      out += '                const _jj = _map_count_' + nmi + '[_i];\n';
      out += '                if (_jj >= MAX_MAP_' + nmi + ') break;\n';
      // Nested pool node from template
      var nestedPoolNode = nm.templateExpr;
      for (var nfi = 0; nfi < nestedOa.fields.length; nfi++) {
        var cf = nestedOa.fields[nfi];
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
      // Nested map dynamic texts
      var nestedMapDynTexts = ctx.dynTexts.filter(function(ndt) { return ndt.inMap && ndt.mapIdx === nmi; });
      for (var ndi = 0; ndi < nestedMapDynTexts.length; ndi++) {
        var ndt = nestedMapDynTexts[ndi];
        var nti = ndt._mapTextIdx;
        var fixedArgs = ndt.fmtArgs;
        for (var nfi2 = 0; nfi2 < nestedOa.fields.length; nfi2++) {
          var ncf = nestedOa.fields[nfi2];
          fixedArgs = fixedArgs.replace(new RegExp('_oa' + cidx + '_' + ncf.name + '\\[_i\\]', 'g'), '_oa' + cidx + '_' + ncf.name + '[_flat_j]');
          fixedArgs = fixedArgs.replace(new RegExp('_oa' + cidx + '_' + ncf.name + '_lens\\[_i\\]', 'g'), '_oa' + cidx + '_' + ncf.name + '_lens[_flat_j]');
        }
        fixedArgs = fixedArgs.replace(new RegExp('_oa' + cidx + '_(\\w+)\\[_j\\]', 'g'), '_oa' + cidx + '_$1[_flat_j]');
        fixedArgs = fixedArgs.replace(new RegExp('_oa' + cidx + '_(\\w+)_lens\\[_j\\]', 'g'), '_oa' + cidx + '_$1_lens[_flat_j]');
        fixedArgs = fixedArgs.replace(/@intCast\(_j\)/g, '@intCast(_flat_j)');
        out += '                _map_texts_' + nmi + '_' + nti + '[_flat_j] = std.fmt.bufPrint(&_map_text_bufs_' + nmi + '_' + nti + '[_flat_j], "' + ndt.fmtString + '", .{ ' + fixedArgs + ' }) catch "";\n';
      }
      // Per-item inner array for nested
      var nestedMeta = _mapMeta[nmi];
      if (nestedMeta && nestedMeta.innerArr && nestedMeta.innerCount > 0) {
        var sharedDecl = (nm.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + nestedMeta.innerArr); }) ||
                         ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + nestedMeta.innerArr); });
        if (sharedDecl) {
          var innerContent = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          for (var ndi2 = 0; ndi2 < nestedMapDynTexts.length; ndi2++) {
            var ndt2 = nestedMapDynTexts[ndi2];
            var nti2 = ndt2._mapTextIdx;
            innerContent = innerContent.replace('"__mt' + nti2 + '__"', '_map_texts_' + nmi + '_' + nti2 + '[_flat_j]');
          }
          for (var ndi3 = 0; ndi3 < nestedMapDynTexts.length; ndi3++) {
            var ndt3 = nestedMapDynTexts[ndi3];
            var nti3 = ndt3._mapTextIdx;
            innerContent = innerContent.replace('.text = ""', '.text = _map_texts_' + nmi + '_' + nti3 + '[_flat_j]');
          }
          out += '                _map_inner_' + nmi + '[_flat_j] = [' + nestedMeta.innerCount + ']Node{ ' + innerContent + ' };\n';
          nestedPoolNode = nestedPoolNode.replace('&' + nestedMeta.innerArr, '&_map_inner_' + nmi + '[_flat_j]');
        }
      }
      // Nested handler ptrs
      var nestedHandlers = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === nmi; });
      for (var nhi = 0; nhi < nestedHandlers.length; nhi++) {
        out += '                {\n';
        out += '                    const _n = std.fmt.bufPrint(_map_lua_bufs_' + nmi + '_' + nhi + '[_flat_j][0..47], "__mapPress_' + nmi + '_' + nhi + '({d},{d})", .{_i, _jj}) catch "";\n';
        out += '                    _map_lua_bufs_' + nmi + '_' + nhi + '[_flat_j][_n.len] = 0;\n';
        out += '                    _map_lua_ptrs_' + nmi + '_' + nhi + '[_flat_j] = @ptrCast(_map_lua_bufs_' + nmi + '_' + nhi + '[_flat_j][0.._n.len :0]);\n';
        out += '                }\n';
        var nmh = nestedHandlers[nhi];
        var nestedPressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
        var nestedPtrRepl = '.' + nestedPressField + ' = _map_lua_ptrs_' + nmi + '_' + nhi + '[_flat_j]';
        nestedPoolNode = nestedPoolNode.replace('.lua_on_press = "' + (nmh.luaBody ? nmh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '') + '"', nestedPtrRepl);
        nestedPoolNode = nestedPoolNode.replace('.js_on_press = "' + (nmh.luaBody ? nmh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '') + '"', nestedPtrRepl);
        nestedPoolNode = nestedPoolNode.replace('.on_press = handlers.' + nmh.name, nestedPtrRepl);
        nestedPoolNode = nestedPoolNode.replace('.on_press = ' + nmh.name, nestedPtrRepl);
      }
      out += '                _map_pool_' + nmi + '[_i][_jj] = ' + nestedPoolNode + ';\n';
      out += '                _map_count_' + nmi + '[_i] += 1;\n';
      out += '            }\n';
      out += '        }\n';
    }

    // Inline map rebuilds (atom 028 reference — emitted inline here)
    for (var imi = 0; imi < ctx.maps.length; imi++) {
      var im = ctx.maps[imi];
      if (!im.isInline || im._parentMi !== mi) continue;
      var imMeta = _mapMeta[imi];
      if (!imMeta) continue;
      var imOa = im.oa;
      var imPressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';

      out += '        // inline map ' + imi + ': ' + imOa.getter + '.map (per-parent)\n';
      out += '        _map_count_' + imi + '[_i] = @min(_oa' + im.oaIdx + '_len, MAX_MAP_' + imi + ');\n';
      out += '        {\n        var _j: usize = 0;\n        while (_j < _map_count_' + imi + '[_i]) : (_j += 1) {\n';

      // Inline text formatting [_i][_j]
      for (var imdi = 0; imdi < (imMeta.mapDynTexts || []).length; imdi++) {
        var imdt = imMeta.mapDynTexts[imdi];
        var imti = imdt._mapTextIdx;
        var imArgs = imdt.fmtArgs;
        for (var imfi = 0; imfi < imOa.fields.length; imfi++) {
          var imf = imOa.fields[imfi];
          imArgs = imArgs.replace(new RegExp('_oa' + im.oaIdx + '_' + imf.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + imf.name + '_lens\\[_i\\]\\]', 'g'),
            '_oa' + im.oaIdx + '_' + imf.name + '[_j][0.._oa' + im.oaIdx + '_' + imf.name + '_lens[_j]]');
          imArgs = imArgs.replace(new RegExp('_oa' + im.oaIdx + '_' + imf.name + '_lens\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + imf.name + '_lens[_j]');
          imArgs = imArgs.replace(new RegExp('_oa' + im.oaIdx + '_' + imf.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + imf.name + '[_j]');
        }
        out += '            _map_texts_' + imi + '_' + imti + '[_i][_j] = std.fmt.bufPrint(&_map_text_bufs_' + imi + '_' + imti + '[_i][_j], "' + imdt.fmtString + '", .{ ' + imArgs + ' }) catch "";\n';
      }

      // Inline handler ptrs BEFORE node literals
      for (var imhi = 0; imhi < (imMeta.mapHandlers || []).length; imhi++) {
        out += '            {\n';
        if (im.parentMap) {
          out += '                const _n = std.fmt.bufPrint(_map_lua_bufs_' + imi + '_' + imhi + '[_i][_j][0..47], "__mapPress_' + imi + '_' + imhi + '({d},{d})", .{_i, _j}) catch "";\n';
        } else {
          out += '                const _n = std.fmt.bufPrint(_map_lua_bufs_' + imi + '_' + imhi + '[_i][_j][0..47], "__mapPress_' + imi + '_' + imhi + '({d})", .{_j}) catch "";\n';
        }
        out += '                _map_lua_bufs_' + imi + '_' + imhi + '[_i][_j][_n.len] = 0;\n';
        out += '                _map_lua_ptrs_' + imi + '_' + imhi + '[_i][_j] = @ptrCast(_map_lua_bufs_' + imi + '_' + imhi + '[_i][_j][0.._n.len :0]);\n';
        out += '            }\n';
      }

      // Inline per-item array fills
      var imDtConsumed = 0;
      for (var impi = 0; impi < (imMeta.mapPerItemDecls || []).length; impi++) {
        var impid = imMeta.mapPerItemDecls[impi];
        var imContent = impid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
        // 1. Wire handler refs FIRST
        for (var imhi2 = 0; imhi2 < (imMeta.mapHandlers || []).length; imhi2++) {
          var immh = imMeta.mapHandlers[imhi2];
          if (immh.luaBody) {
            var imEscaped = immh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            var imEscapedRegex = imEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            imContent = imContent.replace(new RegExp('\\.lua_on_press = "' + imEscapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + imhi2 + '[_i][_j]');
            imContent = imContent.replace(new RegExp('\\.js_on_press = "' + imEscapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + imhi2 + '[_i][_j]');
          }
          imContent = imContent.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + immh.name, 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + imhi2 + '[_i][_j]');
        }
        // 2. Fix inner OA field refs: _i→_j
        for (var imfi2 = 0; imfi2 < imOa.fields.length; imfi2++) {
          var imf2 = imOa.fields[imfi2];
          imContent = imContent.replace(new RegExp('_oa' + im.oaIdx + '_' + imf2.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + imf2.name + '_lens\\[_i\\]\\]', 'g'),
            '_oa' + im.oaIdx + '_' + imf2.name + '[_j][0.._oa' + im.oaIdx + '_' + imf2.name + '_lens[_j]]');
          imContent = imContent.replace(new RegExp('_oa' + im.oaIdx + '_' + imf2.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + imf2.name + '[_j]');
        }
        // Preserve outer-section @as(i64, @intCast(_i))
        imContent = imContent.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
        imContent = imContent.replace(/@intCast\(_i\)/g, '@intCast(_j)');
        imContent = imContent.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
        // 3. Fix per-item array refs to [_i][_j]
        for (var impi2 = 0; impi2 < (imMeta.mapPerItemDecls || []).length; impi2++) {
          var impid2 = imMeta.mapPerItemDecls[impi2];
          imContent = imContent.replace(new RegExp('&' + impid2.name + '\\b', 'g'), '&_map_' + impid2.name + '_' + imi + '[_i][_j]');
        }
        // 4. Wire tagged map text refs [_i][_j], then fallback sequential
        for (var imtdi = 0; imtdi < (imMeta.mapDynTexts || []).length; imtdi++) {
          var imtdt = imMeta.mapDynTexts[imtdi];
          var imtti = imtdt._mapTextIdx;
          imContent = imContent.replace('"__mt' + imtti + '__"', '_map_texts_' + imi + '_' + imtti + '[_i][_j]');
        }
        while (imDtConsumed < (imMeta.mapDynTexts || []).length) {
          var imfdt = imMeta.mapDynTexts[imDtConsumed];
          var imfti = imfdt._mapTextIdx;
          var imNext = imContent.replace('.text = ""', '.text = _map_texts_' + imi + '_' + imfti + '[_i][_j]');
          if (imNext === imContent) break;
          imContent = imNext;
          imDtConsumed++;
        }
        out += '            _map_' + impid.name + '_' + imi + '[_i][_j] = [' + impid.elemCount + ']Node{ ' + imContent + ' };\n';
      }

      // Inline inner array construction
      if (imMeta.innerArr && imMeta.innerCount > 0) {
        var imSharedDecl = (im.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + imMeta.innerArr); }) ||
                           ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + imMeta.innerArr); });
        if (imSharedDecl) {
          var ic = imSharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          for (var icfi = 0; icfi < imOa.fields.length; icfi++) {
            var icf = imOa.fields[icfi];
            ic = ic.replace(new RegExp('_oa' + im.oaIdx + '_' + icf.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + icf.name + '_lens\\[_i\\]\\]', 'g'),
              '_oa' + im.oaIdx + '_' + icf.name + '[_j][0.._oa' + im.oaIdx + '_' + icf.name + '_lens[_j]]');
            ic = ic.replace(new RegExp('_oa' + im.oaIdx + '_' + icf.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + icf.name + '[_j]');
          }
          ic = ic.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
          ic = ic.replace(/@intCast\(_i\)/g, '@intCast(_j)');
          ic = ic.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
          for (var icpi = 0; icpi < (imMeta.mapPerItemDecls || []).length; icpi++) {
            var icpid = imMeta.mapPerItemDecls[icpi];
            ic = ic.replace(new RegExp('&' + icpid.name + '\\b', 'g'), '&_map_' + icpid.name + '_' + imi + '[_i][_j]');
          }
          for (var ictdi = 0; ictdi < (imMeta.mapDynTexts || []).length; ictdi++) {
            var ictdt = imMeta.mapDynTexts[ictdi];
            var ictti = ictdt._mapTextIdx;
            ic = ic.replace('"__mt' + ictti + '__"', '_map_texts_' + imi + '_' + ictti + '[_i][_j]');
            ic = ic.replace('.text = ""', '.text = _map_texts_' + imi + '_' + ictti + '[_i][_j]');
          }
          for (var ichi = 0; ichi < (imMeta.mapHandlers || []).length; ichi++) {
            var icmh = imMeta.mapHandlers[ichi];
            if (icmh.luaBody) {
              var icEscaped = icmh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              var icEscapedRegex = icEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              ic = ic.replace(new RegExp('\\.lua_on_press = "' + icEscapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + ichi + '[_i][_j]');
              ic = ic.replace(new RegExp('\\.js_on_press = "' + icEscapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + ichi + '[_i][_j]');
            }
            ic = ic.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + icmh.name, 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + ichi + '[_i][_j]');
          }
          out += '            _map_inner_' + imi + '[_i][_j] = [' + imMeta.innerCount + ']Node{ ' + ic + ' };\n';
        }
      }

      // Inline pool node
      var imPool = im.templateExpr;
      for (var ipfi = 0; ipfi < imOa.fields.length; ipfi++) {
        var ipf = imOa.fields[ipfi];
        imPool = imPool.replace(new RegExp('_oa' + im.oaIdx + '_' + ipf.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + ipf.name + '[_j]');
      }
      imPool = imPool.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
      imPool = imPool.replace(/@intCast\(_i\)/g, '@intCast(_j)');
      imPool = imPool.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
      if (imMeta.innerArr) imPool = imPool.replace('&' + imMeta.innerArr, '&_map_inner_' + imi + '[_i][_j]');
      for (var ippi = 0; ippi < (imMeta.mapPerItemDecls || []).length; ippi++) {
        var ippid = imMeta.mapPerItemDecls[ippi];
        imPool = imPool.replace(new RegExp('&' + ippid.name + '\\b', 'g'), '&_map_' + ippid.name + '_' + imi + '[_i][_j]');
      }
      for (var iphi = 0; iphi < (imMeta.mapHandlers || []).length; iphi++) {
        var ipmh = imMeta.mapHandlers[iphi];
        if (ipmh.luaBody) {
          var ipEscaped = ipmh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          imPool = imPool.replace('.lua_on_press = "' + ipEscaped + '"', '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + iphi + '[_i][_j]');
          imPool = imPool.replace('.js_on_press = "' + ipEscaped + '"', '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + iphi + '[_i][_j]');
        }
        imPool = imPool.replace('.on_press = handlers.' + ipmh.name, '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + iphi + '[_i][_j]');
        imPool = imPool.replace('.on_press = ' + ipmh.name, '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + iphi + '[_i][_j]');
      }
      // Inline per-item conditionals
      function resolveInlineCond(expr) {
        var r = expr;
        if (imOa) {
          var ip = im.itemParam || 'item';
          for (var rfi = 0; rfi < imOa.fields.length; rfi++) {
            var rf = imOa.fields[rfi];
            r = r.replace(new RegExp(ip + '\\.' + rf.name, 'g'), '_oa' + im.oaIdx + '_' + rf.name + '[_j]');
            r = r.replace(new RegExp('_oa' + im.oaIdx + '_' + rf.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + rf.name + '[_j]');
          }
        }
        if (m.oa) {
          var op = m.itemParam || 'col';
          for (var rfi2 = 0; rfi2 < m.oa.fields.length; rfi2++) {
            var rf2 = m.oa.fields[rfi2];
            r = r.replace(new RegExp(op + '\\.' + rf2.name, 'g'), '_oa' + m.oa.oaIdx + '_' + rf2.name + '[_i]');
          }
        }
        var outerIdx = m.indexParam || 'ci';
        var innerIdx = im.indexParam || 'ti';
        r = r.replace(new RegExp('\\b' + outerIdx + '\\b', 'g'), '@as(i64, @intCast(__OUTER_IDX__))');
        r = r.replace(new RegExp('\\b' + innerIdx + '\\b', 'g'), '@as(i64, @intCast(_j))');
        r = r.replace(/__OUTER_IDX__/g, '_i');
        return r;
      }
      for (var icci = 0; icci < ctx.conditionals.length; icci++) {
        var icCond = ctx.conditionals[icci];
        if (!icCond.arrName) continue;
        var icPid = (imMeta.mapPerItemDecls || []).find(function(p) { return p.name === icCond.arrName; });
        if (!icPid) continue;
        var icPoolArr = '_map_' + icCond.arrName + '_' + imi + '[_i][_j]';
        var icResolved = resolveInlineCond(icCond.condExpr);
        if (icCond.kind === 'show_hide') {
          out += '            ' + icPoolArr + '[' + icCond.trueIdx + '].style.display = if ((' + icResolved + ')) .flex else .none;\n';
        } else if (icCond.kind === 'ternary_jsx') {
          var icW = _wrapMapCondition(icResolved);
          out += '            ' + icPoolArr + '[' + icCond.trueIdx + '].style.display = if ' + icW + ' .flex else .none;\n';
          out += '            ' + icPoolArr + '[' + icCond.falseIdx + '].style.display = if ' + icW + ' .none else .flex;\n';
        }
      }
      // Inner array conditionals
      if (imMeta.innerArr && imMeta.innerCount > 0) {
        for (var icci2 = 0; icci2 < ctx.conditionals.length; icci2++) {
          var icCond2 = ctx.conditionals[icci2];
          if (!icCond2.arrName || icCond2.arrName !== imMeta.innerArr) continue;
          var icResolved2 = resolveInlineCond(icCond2.condExpr);
          if (icCond2.kind === 'show_hide') {
            out += '            _map_inner_' + imi + '[_i][_j][' + icCond2.trueIdx + '].style.display = if ((' + icResolved2 + ')) .flex else .none;\n';
          } else if (icCond2.kind === 'ternary_jsx') {
            var icW2 = _wrapMapCondition(icResolved2);
            out += '            _map_inner_' + imi + '[_i][_j][' + icCond2.trueIdx + '].style.display = if ' + icW2 + ' .flex else .none;\n';
            out += '            _map_inner_' + imi + '[_i][_j][' + icCond2.falseIdx + '].style.display = if ' + icW2 + ' .none else .flex;\n';
          }
        }
      }

      // Style hoist for inline pool
      var imHadStyle = imPool.includes('.style');
      if (!imHadStyle) {
        imPool = imPool.replace('.{', '.{ .style = .{},');
      }
      out += '            _map_pool_' + imi + '[_i][_j] = ' + imPool + ';\n';
      if (!imHadStyle && imMeta.innerArr && imMeta.innerCount > 0) {
        out += '            _map_pool_' + imi + '[_i][_j].style.display = _map_inner_' + imi + '[_i][_j][0].style.display;\n';
      }
      out += '        }\n        }\n';

      // Bind inline pool to parent per-item array
      if (im.parentArr) {
        var isPerItem = _promotedToPerItem.has(im.parentArr) ||
                        (m._mapPerItemDecls && m._mapPerItemDecls.some(function(p) { return p.name === im.parentArr; }));
        if (isPerItem) {
          out += '        _pi_' + im.parentArr + '_' + mi + '[' + im.childIdx + '].children = _map_pool_' + imi + '[_i][0.._map_count_' + imi + '[_i]];\n';
        }
      }
    }

    // Emit inner array + pool node
    if (innerCount > 0) {
      var innerItems = [];
      if (innerArr) {
        var fDecl = (m.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + innerArr); }) ||
                    ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + innerArr); });
        if (fDecl) {
          var inner = fDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          // Tagged text refs
          for (var ftdi = 0; ftdi < mapDynTexts.length; ftdi++) {
            var ftdt = mapDynTexts[ftdi];
            var ftti = ftdt._mapTextIdx;
            inner = inner.replace('"__mt' + ftti + '__"', '_map_texts_' + mi + '_' + ftti + '[_i]');
          }
          // Legacy fallback
          for (var fsdti = dtConsumed; fsdti < dtConsumed + innerTextSlots && fsdti < mapDynTexts.length; fsdti++) {
            var fsdt = mapDynTexts[fsdti];
            var fsti = fsdt._mapTextIdx;
            inner = inner.replace('.text = ""', '.text = _map_texts_' + mi + '_' + fsti + '[_i]');
          }
          // Per-item array refs
          for (var fmj = 0; fmj < ctx.maps.length; fmj++) {
            var fOther = ctx.maps[fmj];
            if (!fOther._mapPerItemDecls) continue;
            for (var fpj = 0; fpj < fOther._mapPerItemDecls.length; fpj++) {
              var fpid = fOther._mapPerItemDecls[fpj];
              if (!fOther.isNested && !fOther.isInline) {
                inner = inner.replace(new RegExp('&' + fpid.name + '\\b', 'g'), '_pi_' + fpid.name + '_' + fmj);
              } else {
                inner = inner.replace(new RegExp('&' + fpid.name + '\\b', 'g'), '&_map_' + fpid.name + '_' + fmj + '[_i]');
              }
            }
          }
          // Nested/inline children pool slices
          for (var fnmi = 0; fnmi < ctx.maps.length; fnmi++) {
            var fnm = ctx.maps[fnmi];
            var isChildOfThisMap = (fnm.isNested && fnm.parentOaIdx === m.oaIdx) || (fnm.isInline && fnm.parentMap === m);
            if (!isChildOfThisMap) continue;
            if (fnm.parentArr && inner.includes('&' + fnm.parentArr)) {
              inner = inner.replace('&' + fnm.parentArr, '_map_pool_' + fnmi + '[_i][0.._map_count_' + fnmi + '[_i]]');
            }
          }
          // Handler refs in inner array
          var innerPressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
          for (var fhmj = 0; fhmj < ctx.maps.length; fhmj++) {
            var fhMH = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === fhmj; });
            for (var fhhi = 0; fhhi < fhMH.length; fhhi++) {
              var fhmh = fhMH[fhhi];
              if (fhmh.luaBody) {
                var fhEscaped = fhmh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                var fhEscapedRegex = fhEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                var fhPtr = '.' + innerPressField + ' = _map_lua_ptrs_' + fhmj + '_' + fhhi + '[_i]';
                inner = inner.replace(new RegExp('\\.lua_on_press = "' + fhEscapedRegex + '"', 'g'), fhPtr);
                inner = inner.replace(new RegExp('\\.js_on_press = "' + fhEscapedRegex + '"', 'g'), fhPtr);
              }
              inner = inner.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + fhmh.name, 'g'), '.' + innerPressField + ' = _map_lua_ptrs_' + fhmj + '_' + fhhi + '[_i]');
            }
          }
          // Index param replacement
          var innerIdxParam = m.indexParam || 'i';
          if (innerIdxParam !== '_i') {
            inner = inner.replace(new RegExp('\\b' + innerIdxParam + '\\b', 'g'), '@as(i64, @intCast(_i))');
          }
          out += '        const _inner_' + mi + ' = _pool_arena.allocator().alloc(Node, ' + innerCount + ') catch unreachable;\n';
          out += '        @memcpy(_inner_' + mi + ', &[_]Node{ ' + inner + ' });\n';
        }
      }

      // Inner array conditionals
      if (innerArr) {
        for (var iaci = 0; iaci < ctx.conditionals.length; iaci++) {
          var iaCond = ctx.conditionals[iaci];
          if (!iaCond.arrName || iaCond.arrName !== innerArr) continue;
          var iaExpr = iaCond.condExpr;
          if (m.oa) {
            var iaParam = m.itemParam || 'item';
            for (var iafi = 0; iafi < m.oa.fields.length; iafi++) {
              var iaf = m.oa.fields[iafi];
              iaExpr = iaExpr.replace(new RegExp(iaParam + '\\.' + iaf.name, 'g'), '_oa' + m.oa.oaIdx + '_' + iaf.name + '[_i]');
            }
          }
          if (/\b0\(/.test(iaExpr) || /(?<!\()0\b.*@as/.test(iaExpr)) continue;
          var iaW = _wrapMapCondition(iaExpr);
          if (iaCond.kind === 'show_hide') {
            out += '        _inner_' + mi + '[' + iaCond.trueIdx + '].style.display = if ' + iaW + ' .flex else .none;\n';
          } else if (iaCond.kind === 'ternary_jsx') {
            out += '        _inner_' + mi + '[' + iaCond.trueIdx + '].style.display = if ' + iaW + ' .flex else .none;\n';
            out += '        _inner_' + mi + '[' + iaCond.falseIdx + '].style.display = if ' + iaW + ' .none else .flex;\n';
          }
        }
      }

      // Nested/inline children slot assignment
      for (var snmi = 0; snmi < ctx.maps.length; snmi++) {
        var snm = ctx.maps[snmi];
        var sIsChild = (snm.isNested && snm.parentOaIdx === m.oaIdx) || (snm.isInline && snm.parentMap === m);
        if (!sIsChild) continue;
        if (snm.parentArr) {
          var sIsInner = innerArr && snm.parentArr === innerArr;
          if (sIsInner) {
            out += '        _inner_' + mi + '[' + snm.childIdx + '].children = _map_pool_' + snmi + '[_i][0.._map_count_' + snmi + '[_i]];\n';
          } else if (_promotedToPerItem.has(snm.parentArr) || (m._mapPerItemDecls && m._mapPerItemDecls.some(function(p) { return p.name === snm.parentArr; }))) {
            out += '        _pi_' + snm.parentArr + '_' + mi + '[' + snm.childIdx + '].children = _map_pool_' + snmi + '[_i][0.._map_count_' + snmi + '[_i]];\n';
          } else {
            out += '        ' + snm.parentArr + '[' + snm.childIdx + '].children = _map_pool_' + snmi + '[_i][0.._map_count_' + snmi + '[_i]];\n';
          }
        }
      }

      // Pool node from template
      var poolNode = m.templateExpr;
      if (innerArr) {
        poolNode = poolNode.replace('&' + innerArr, '_inner_' + mi);
      }
      for (var pmj = 0; pmj < ctx.maps.length; pmj++) {
        var pOther = ctx.maps[pmj];
        if (!pOther._mapPerItemDecls) continue;
        for (var ppj = 0; ppj < pOther._mapPerItemDecls.length; ppj++) {
          var ppid = pOther._mapPerItemDecls[ppj];
          if (!pOther.isNested && !pOther.isInline) {
            poolNode = poolNode.replace(new RegExp('&' + ppid.name + '\\b', 'g'), '_pi_' + ppid.name + '_' + pmj);
          } else {
            poolNode = poolNode.replace(new RegExp('&' + ppid.name + '\\b', 'g'), '&_map_' + ppid.name + '_' + pmj + '[_i]');
          }
        }
      }
      // Handler refs in pool node
      var pressField = ctx.handlerDispatch === 'lua' ? 'lua_on_press' : 'js_on_press';
      for (var phi = 0; phi < mapHandlers.length; phi++) {
        var pmh = mapHandlers[phi];
        var pEscaped = pmh.luaBody ? pmh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
        var pPtr = '.' + pressField + ' = _map_lua_ptrs_' + mi + '_' + phi + '[_i]';
        poolNode = poolNode.replace('.lua_on_press = "' + pEscaped + '"', pPtr);
        poolNode = poolNode.replace('.js_on_press = "' + pEscaped + '"', pPtr);
        poolNode = poolNode.replace('.on_press = handlers.' + pmh.name, pPtr);
        poolNode = poolNode.replace('.on_press = ' + pmh.name, pPtr);
      }
      // Swap field order: .children before .handlers
      var hm = poolNode.match(/\.handlers = \.{[^}]+\}/);
      var cm = poolNode.match(/\.children = &[\w\[\]_]+/);
      if (hm && cm) {
        poolNode = poolNode.replace(hm[0] + ', ' + cm[0], cm[0] + ', ' + hm[0]);
      }
      // Index param
      var poolIdxParam = m.indexParam || 'i';
      if (poolIdxParam !== '_i') {
        poolNode = poolNode.replace(new RegExp('\\b' + poolIdxParam + '\\b', 'g'), '@as(i64, @intCast(_i))');
      }
      // Display hoist
      if (innerCount === 1 && !poolNode.includes('.display') && !poolNode.includes('.style')) {
        poolNode = poolNode.replace('.{', '.{ .style = .{},');
        out += '        _map_pool_' + mi + '[_i] = ' + poolNode + ';\n';
        out += '        _map_pool_' + mi + '[_i].style.display = _inner_' + mi + '[0].style.display;\n';
      } else {
        out += '        _map_pool_' + mi + '[_i] = ' + poolNode + ';\n';
      }
      // .filter() display toggles
      if (m.filterConditions && m.filterConditions.length > 0) {
        var filterParts = [];
        for (var fci = 0; fci < m.filterConditions.length; fci++) {
          var fc = m.filterConditions[fci];
          var fcCond = fc.raw;
          if (m.oa) {
            for (var fcfi = 0; fcfi < m.oa.fields.length; fcfi++) {
              var fcf = m.oa.fields[fcfi];
              fcCond = fcCond.replace(new RegExp('\\b' + fc.param + '\\s*\\.\\s*' + fcf.name + '\\b', 'g'), '_oa' + m.oaIdx + '_' + fcf.name + '[_i]');
            }
          }
          for (var fcsi = 0; fcsi < ctx.stateSlots.length; fcsi++) {
            var fcs = ctx.stateSlots[fcsi];
            fcCond = fcCond.replace(new RegExp('\\b' + fcs.getter + '\\b', 'g'), 'state.getSlot(' + fcsi + ')');
          }
          fcCond = fcCond.replace(/\|\|/g, ' or ');
          fcCond = fcCond.replace(/&&/g, ' and ');
          fcCond = fcCond.replace(/===/g, '==');
          fcCond = fcCond.replace(/!==/g, '!=');
          filterParts.push('(' + fcCond.trim() + ')');
        }
        out += '        _map_pool_' + mi + '[_i].style.display = if (' + filterParts.join(' and ') + ') .flex else .none;\n';
      }
    } else {
      // Single-node map template (no inner array)
      var tExpr = m.templateExpr;
      for (var sdti = 0; sdti < mapDynTexts.length; sdti++) {
        var sdt = mapDynTexts[sdti];
        var sti = sdt._mapTextIdx;
        tExpr = tExpr.replace('"__mt' + sti + '__"', '_map_texts_' + mi + '_' + sti + '[_i]');
        tExpr = tExpr.replace('.text = ""', '.text = _map_texts_' + mi + '_' + sti + '[_i]');
      }
      out += '        _map_pool_' + mi + '[_i] = ' + tExpr + ';\n';
    }

    // Deferred canvas attributes
    if (m._deferredCanvasAttrs) {
      for (var dai = 0; dai < m._deferredCanvasAttrs.length; dai++) {
        var da = m._deferredCanvasAttrs[dai];
        var oaIdx = m.oaIdx;
        var oaField = '_oa' + oaIdx + '_' + da.oaField;
        var target = '_map_pool_' + mi + '[_i]';
        var isPathAttr = da.zigField === 'canvas_path_d' || da.zigField === 'canvas_fill_effect' ||
            da.zigField === 'canvas_fill_color' || da.zigField === 'canvas_stroke_width' ||
            da.zigField === 'canvas_flow_speed';
        var isGraphAttr = da.zigField === 'canvas_view_zoom';
        if (m._mapPerItemDecls) {
          if (isPathAttr) {
            for (var dapi = 0; dapi < m._mapPerItemDecls.length; dapi++) {
              var daPid = m._mapPerItemDecls[dapi];
              if (daPid.expr && daPid.expr.includes('.canvas_path = true')) {
                target = '_pi_' + daPid.name + '_' + mi + '[0]';
                break;
              }
            }
          } else if (isGraphAttr) {
            target = '_inner_' + mi + '[0]';
          }
        }
        if (da.type === 'string') {
          out += '        ' + target + '.' + da.zigField + ' = ' + oaField + '[_i][0..' + oaField + '_lens[_i]];\n';
        } else {
          out += '        ' + target + '.' + da.zigField + ' = @floatFromInt(' + oaField + '[_i]);\n';
        }
      }
    }

    // Variant patches for classifier nodes inside this map
    var mapVBs = ctx.variantBindings.filter(function(vb) { return vb.inMap; });
    if (mapVBs.length > 0 && ctx.variantNames.length > 0) {
      out += '        {\n';
      out += '        const _v = @as(usize, api.theme.rjit_theme_active_variant());\n';
      for (var vbi = 0; vbi < mapVBs.length; vbi++) {
        var vb = mapVBs[vbi];
        var vbTarget;
        if (!vb.arrName) {
          vbTarget = '_map_pool_' + mi + '[_i]';
        } else if (vb.arrName === innerArr) {
          vbTarget = '_inner_' + mi + '[' + vb.arrIndex + ']';
        } else {
          vbTarget = '_pi_' + vb.arrName + '_' + mi + '[' + vb.arrIndex + ']';
        }
        for (var vi = 0; vi < vb.styles.length; vi++) {
          if (!vb.styles[vi]) continue;
          var fields = vb.styles[vi].split(/,\s*(?=\.)/).filter(function(f) { return f.trim().startsWith('.'); });
          var assignments = '';
          for (var vfi = 0; vfi < fields.length; vfi++) {
            var vf = fields[vfi];
            var eqIdx = vf.indexOf('=');
            if (eqIdx < 0) continue;
            var sf = vf.trim().slice(1, eqIdx).trim();
            var sv = vf.slice(eqIdx + 1).trim();
            assignments += '        ' + vbTarget + '.style.' + sf + ' = ' + sv + ';\n';
          }
          if (!assignments) continue;
          if (vi === 0) {
            out += '        if (_v == 0) {\n' + assignments + '        }\n';
          } else {
            out += '        else if (_v == ' + vi + ') {\n' + assignments + '        }\n';
          }
        }
      }
      out += '        }\n';
    }

    out += '    }\n';
    // Bind pool to parent array
    if (m.parentArr) {
      out += '    ' + m.parentArr + '[' + m.childIdx + '].children = _map_pool_' + mi + '[0.._map_count_' + mi + '];\n';
    }
    out += '}\n\n';
  }

  return out;
}

module.exports = {
  id: 26,
  name: 'flat_map_rebuild',
  group: 'maps_zig',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/map_pools.js',
  applies: applies,
  emit: emit,
};
