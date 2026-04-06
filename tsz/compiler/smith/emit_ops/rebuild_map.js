// ── Emit Op: rebuild_map — THE recursive map rebuild ────────────
// Atom 16 from 003-real-atoms.md
//
// One function that handles flat, nested, and inline map rebuilds.
// Replaces a026_flat_map_rebuild + a027_nested_map_rebuild + a028_inline_map_rebuild.
// Flat/nested/inline are NOT separate concepts — they're the same rebuild at different depths.
//
// The orchestrator calls rebuildMap() once. It iterates all top-level (non-nested,
// non-inline) maps and emits _rebuildMapN() functions. Nested and inline sub-rebuilds
// are emitted INSIDE the parent loop body (they run per parent iteration).
//
// Uses: atoms 2 (replace_field_refs), 3 (wire_handler_ptrs), 4 (emit_dyn_text),
//       5 (emit_handler_fmt), 6 (emit_inner_array), 7 (emit_pool_node),
//       8 (emit_display_toggle) — composes them.
//
// Status: extracted from a026/a027/a028 — byte-identical output.

// _wrapMapCondition is a global function defined in a019_map_metadata.js

function rebuildMap(ctx, meta) {
  var _mapMeta = meta.mapMeta;
  var mapOrder = meta.mapOrder;
  var _promotedToPerItem = meta.promotedToPerItem;
  if (ctx.maps.length === 0) return '';

  var out = '';
  // Pass 2: emit rebuild functions (all declarations are now above)
  for (var _oi = 0; _oi < mapOrder.length; _oi++) {
    var mi = mapOrder[_oi];
    var m = ctx.maps[mi];
    if (m.isNested || m.isInline) continue; // nested/inline rebuilds inlined into parent
    if (m.mapBackend === 'lua_runtime') continue; // lua maps rebuild via LuaJIT, not Zig
    var mapPerItemDecls = _mapMeta[mi].mapPerItemDecls;
    var mapDynTexts = _mapMeta[mi].mapDynTexts;
    var mapHandlers = _mapMeta[mi].mapHandlers;
    var innerCount = _mapMeta[mi].innerCount;
    var innerArr = _mapMeta[mi].innerArr;

    out += 'fn _rebuildMap' + mi + '() void {\n';
    out += '    _map_count_' + mi + ' = @min(_oa' + m.oaIdx + '_len, MAX_MAP_' + mi + ');\n';
    out += '    _map_pool_' + mi + ' = _pool_arena.allocator().alloc(Node, _map_count_' + mi + ') catch unreachable;\n';
    out += '    for (0.._map_count_' + mi + ') |_i| {\n';

    // ── Per-item text formatting ──
    for (var _dti = 0; _dti < mapDynTexts.length; _dti++) {
      var dt = mapDynTexts[_dti];
      var ti = dt._mapTextIdx;
      out += '        _map_texts_' + mi + '_' + ti + '[_i] = std.fmt.bufPrint(&_map_text_bufs_' + mi + '_' + ti + '[_i], "' + dt.fmtString + '", .{ ' + dt.fmtArgs + ' }) catch "";\n';
    }

    // ── Early handler ptr init (field-ref handlers before @memcpy) ──
    {
      var _earlyFieldRefsMap = m._handlerFieldRefsMap || {};
      for (var _ehi = 0; _ehi < mapHandlers.length; _ehi++) {
        var _erefs = _earlyFieldRefsMap[_ehi] || [];
        if (_erefs.length > 0) {
          var _eoaIdx = m.oa ? m.oa.oaIdx : (m.oaIdx || 0);
          var _efmtParts = ['{d}'];
          var _eargParts = ['_i'];
          for (var _efi = 0; _efi < _erefs.length; _efi++) {
            var _ef = _erefs[_efi];
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
    }

    // ── Debug: map text tracking ──
    if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
      ctx._debugLines.push('[MAP_TEXT_DEBUG] map ' + mi + ': ' + mapDynTexts.length + ' dynTexts');
      for (var _dbi = 0; _dbi < mapDynTexts.length; _dbi++) {
        var _ddt = mapDynTexts[_dbi];
        ctx._debugLines.push('[MAP_TEXT_DEBUG]   dt[' + _dbi + '] bufId=' + _ddt.bufId + ' fmt="' + _ddt.fmtString + '" args="' + _ddt.fmtArgs + '"');
      }
      if (innerArr) {
        var _innerDecl2 = (m.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + innerArr); }) || ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + innerArr); });
        ctx._debugLines.push('[MAP_TEXT_DEBUG]   innerArr=' + innerArr + ' decl=' + (_innerDecl2 ? _innerDecl2.substring(0, 200) : 'null'));
      }
      for (var _pii = 0; _pii < m._mapPerItemDecls.length; _pii++) {
        var _pid = m._mapPerItemDecls[_pii];
        ctx._debugLines.push('[MAP_TEXT_DEBUG]   perItem=' + _pid.name + ' decl=' + _pid.decl.substring(0, 200));
      }
    }
    var innerTextSlots = 0;
    if (innerArr) {
      var innerDecl = (m.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + innerArr); }) ||
                      ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + innerArr); });
      if (innerDecl) innerTextSlots = (innerDecl.match(/\.text = ""/g) || []).length;
    }

    // ── Fill per-item component arrays ──
    var dtConsumed = 0;
    var dtSkippedForInner = 0;
    for (var _pidx = 0; _pidx < m._mapPerItemDecls.length; _pidx++) {
      var pid = m._mapPerItemDecls[_pidx];
      var content = pid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
      // Replace references to per-item arrays from ALL maps
      var fixedContent = content;
      for (var mj = 0; mj < ctx.maps.length; mj++) {
        var otherMap = ctx.maps[mj];
        if (!otherMap._mapPerItemDecls) continue;
        for (var _pj = 0; _pj < otherMap._mapPerItemDecls.length; _pj++) {
          var pid2 = otherMap._mapPerItemDecls[_pj];
          if (!otherMap.isNested && !otherMap.isInline) {
            fixedContent = fixedContent.replace(new RegExp('&' + pid2.name + '\\b', 'g'), '_pi_' + pid2.name + '_' + mj);
          } else {
            fixedContent = fixedContent.replace(new RegExp('&' + pid2.name + '\\b', 'g'), '&_map_' + pid2.name + '_' + mj + '[_i]');
          }
        }
      }
      // Replace tagged map text refs in this per-item array
      var _taggedCount = 0;
      for (var _tdi = 0; _tdi < mapDynTexts.length; _tdi++) {
        dt = mapDynTexts[_tdi];
        ti = dt._mapTextIdx;
        var before = fixedContent;
        fixedContent = fixedContent.replace('"__mt' + ti + '__"', '_map_texts_' + mi + '_' + ti + '[_i]');
        if (fixedContent !== before) _taggedCount++;
      }
      // Legacy fallback: replace any remaining untagged .text = "" sequentially
      var pidDtIdx = dtConsumed + _taggedCount;
      dtConsumed += _taggedCount;
      while (pidDtIdx < mapDynTexts.length) {
        dt = mapDynTexts[pidDtIdx];
        ti = dt._mapTextIdx;
        var next = fixedContent.replace('.text = ""', '.text = _map_texts_' + mi + '_' + ti + '[_i]');
        if (next === fixedContent) break;
        fixedContent = next;
        pidDtIdx++;
        dtConsumed++;
      }
      // Replace handler refs in per-item arrays with per-item handler string pointers
      var pidPressField = 'lua_on_press';
      for (mj = 0; mj < ctx.maps.length; mj++) {
        var allMH = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === mj; });
        for (var hi = 0; hi < allMH.length; hi++) {
          var mh = allMH[hi];
          if (mh.luaBody) {
            var escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            var escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var ptrReplacement = '.' + pidPressField + ' = _map_lua_ptrs_' + mj + '_' + hi + '[_i]';
            if (globalThis.__SMITH_DEBUG_MAP_PTRS) {
              print('[MAP_PTR_WIRE] map=' + mj + ' handler=' + hi + ' field=' + pidPressField + ' escaped="' + escaped.substring(0,60) + '..." replacing in fixedContent(len=' + fixedContent.length + ')');
            }
            fixedContent = fixedContent.replace(new RegExp('\\.lua_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
            fixedContent = fixedContent.replace(new RegExp('\\.js_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
          }
          var ptrReplacement2 = '.' + pidPressField + ' = _map_lua_ptrs_' + mj + '_' + hi + '[_i]';
          fixedContent = fixedContent.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh.name, 'g'), ptrReplacement2);
        }
      }
      // Replace raw map index param with Zig loop variable in ternary conditions
      var idxParam = m.indexParam || 'i';
      if (idxParam !== '_i') {
        fixedContent = fixedContent.replace(new RegExp('\\b' + idxParam + '\\b', 'g'), '@as(i64, @intCast(_i))');
      }
      out += '        const _pi_' + pid.name + '_' + mi + ' = _pool_arena.allocator().alloc(Node, ' + pid.elemCount + ') catch unreachable;\n';
      out += '        @memcpy(_pi_' + pid.name + '_' + mi + ', &[_]Node{ ' + fixedContent + ' });\n';
    }

    // ── Per-item conditionals (visibility toggling) ──
    for (var _ci = 0; _ci < ctx.conditionals.length; _ci++) {
      var cond = ctx.conditionals[_ci];
      if (!cond.arrName || !m._mapPerItemDecls) continue;
      if (cond.inMap && cond.mapIdx !== undefined && cond.mapIdx !== mi) continue;
      pid = m._mapPerItemDecls.find(function(p) { return p.name === cond.arrName; });
      if (!pid) continue;
      var poolArr = '_pi_' + cond.arrName + '_' + mi;
      var resolvedExpr = cond.condExpr;
      if (resolvedExpr.includes('0.0')) ctx._debugLines.push('[MAP_COND_DEBUG] raw=' + resolvedExpr + ' arrName=' + cond.arrName + ' mapIdx=' + mi + ' itemParam=' + (m.itemParam || '?'));
      if (m.oa) {
        var itemParam = m.itemParam || 'item';
        for (var _fi = 0; _fi < m.oa.fields.length; _fi++) {
          var f = m.oa.fields[_fi];
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

    // ── Per-item dynamic texts (non-inMap) ──
    for (_dti = 0; _dti < ctx.dynTexts.length; _dti++) {
      dt = ctx.dynTexts[_dti];
      if (dt.inMap) continue;
      if (!dt.arrName || !m._mapPerItemDecls) continue;
      pid = m._mapPerItemDecls.find(function(p) { return p.name === dt.arrName; });
      if (!pid) continue;
      poolArr = '_pi_' + dt.arrName + '_' + mi;
      var dtF = dt.targetField || 'text';
      out += '        ' + poolArr + '[' + dt.arrIndex + '].' + dtF + ' = std.fmt.bufPrint(&_dyn_buf_' + dt.bufId + ', "' + dt.fmtString + '", .{ ' + dt.fmtArgs + ' }) catch "";\n';
    }

    // ── Nested map rebuilds (depth+1: parentIdx filtering) ──
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
      var nestedPoolNode = nm.templateExpr;
      for (var _cfi = 0; _cfi < nestedOa.fields.length; _cfi++) {
        var cf = nestedOa.fields[_cfi];
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
      var nestedMapDynTexts = ctx.dynTexts.filter(function(ndt) { return ndt.inMap && ndt.mapIdx === nmi; });
      for (var _ndti = 0; _ndti < nestedMapDynTexts.length; _ndti++) {
        dt = nestedMapDynTexts[_ndti];
        ti = dt._mapTextIdx;
        var fixedArgs = dt.fmtArgs;
        for (_cfi = 0; _cfi < nestedOa.fields.length; _cfi++) {
          cf = nestedOa.fields[_cfi];
          fixedArgs = fixedArgs.replace(
            new RegExp('_oa' + cidx + '_' + cf.name + '\\[_i\\]', 'g'),
            '_oa' + cidx + '_' + cf.name + '[_flat_j]'
          );
          fixedArgs = fixedArgs.replace(
            new RegExp('_oa' + cidx + '_' + cf.name + '_lens\\[_i\\]', 'g'),
            '_oa' + cidx + '_' + cf.name + '_lens[_flat_j]'
          );
        }
        fixedArgs = fixedArgs.replace(new RegExp('_oa' + cidx + '_(\\w+)\\[_j\\]', 'g'), '_oa' + cidx + '_$1[_flat_j]');
        fixedArgs = fixedArgs.replace(new RegExp('_oa' + cidx + '_(\\w+)_lens\\[_j\\]', 'g'), '_oa' + cidx + '_$1_lens[_flat_j]');
        fixedArgs = fixedArgs.replace(/@intCast\(_j\)/g, '@intCast(_flat_j)');
        out += '                _map_texts_' + nmi + '_' + ti + '[_flat_j] = std.fmt.bufPrint(&_map_text_bufs_' + nmi + '_' + ti + '[_flat_j], "' + dt.fmtString + '", .{ ' + fixedArgs + ' }) catch "";\n';
      }
      var nestedMeta = _mapMeta[nmi];
      if (nestedMeta && nestedMeta.innerArr && nestedMeta.innerCount > 0) {
        var sharedDecl = (nm.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + nestedMeta.innerArr); }) ||
                         ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + nestedMeta.innerArr); });
        if (sharedDecl) {
          var innerContent = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          for (_ndti = 0; _ndti < nestedMapDynTexts.length; _ndti++) {
            dt = nestedMapDynTexts[_ndti];
            ti = dt._mapTextIdx;
            innerContent = innerContent.replace('"__mt' + ti + '__"', '_map_texts_' + nmi + '_' + ti + '[_flat_j]');
          }
          for (_ndti = 0; _ndti < nestedMapDynTexts.length; _ndti++) {
            dt = nestedMapDynTexts[_ndti];
            ti = dt._mapTextIdx;
            innerContent = innerContent.replace('.text = ""', '.text = _map_texts_' + nmi + '_' + ti + '[_flat_j]');
          }
          out += '                _map_inner_' + nmi + '[_flat_j] = [' + nestedMeta.innerCount + ']Node{ ' + innerContent + ' };\n';
          nestedPoolNode = nestedPoolNode.replace('&' + nestedMeta.innerArr, '&_map_inner_' + nmi + '[_flat_j]');
        }
      }
      var nestedHandlers = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === nmi; });
      for (var nhi = 0; nhi < nestedHandlers.length; nhi++) {
        var _npRefs = (nm._nestedParentFieldRefs && nm._nestedParentFieldRefs[nhi]) || [];
        var _ncRefs = (nm._nestedChildFieldRefs && nm._nestedChildFieldRefs[nhi]) || [];
        var _hasNRefs = _npRefs.length > 0 || _ncRefs.length > 0;
        var _nBufSize = _hasNRefs ? 127 : 47;
        var _nFmtParts = ['{d}', '{d}'];
        var _nArgParts = ['_i', '_jj'];
        for (var _pfi = 0; _pfi < _npRefs.length; _pfi++) {
          var _pf = _npRefs[_pfi];
          if (_pf.type === 'string') {
            _nFmtParts.push("'{s}'");
            _nArgParts.push('_oa' + m.oaIdx + '_' + _pf.name + '[_i][0.._oa' + m.oaIdx + '_' + _pf.name + '_lens[_i]]');
          } else {
            _nFmtParts.push('{d}');
            _nArgParts.push('_oa' + m.oaIdx + '_' + _pf.name + '[_i]');
          }
        }
        for (var _cri = 0; _cri < _ncRefs.length; _cri++) {
          var _cf = _ncRefs[_cri];
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
        mh = nestedHandlers[nhi];
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

    // ── Inline map rebuilds (depth+1: separate-OA per parent) ──
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
      for (_dti = 0; _dti < imMeta.mapDynTexts.length; _dti++) {
        dt = imMeta.mapDynTexts[_dti];
        ti = dt._mapTextIdx;
        var args = dt.fmtArgs;
        for (_fi = 0; _fi < imOa.fields.length; _fi++) {
          f = imOa.fields[_fi];
          args = args.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + f.name + '_lens\\[_i\\]\\]', 'g'),
            '_oa' + im.oaIdx + '_' + f.name + '[_j][0.._oa' + im.oaIdx + '_' + f.name + '_lens[_j]]');
          args = args.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '_lens\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f.name + '_lens[_j]');
          args = args.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f.name + '[_j]');
        }
        out += '            _map_texts_' + imi + '_' + ti + '[_i][_j] = std.fmt.bufPrint(&_map_text_bufs_' + imi + '_' + ti + '[_i][_j], "' + dt.fmtString + '", .{ ' + args + ' }) catch "";\n';
      }

      // Handler pointers BEFORE node literals
      for (hi = 0; hi < imMeta.mapHandlers.length; hi++) {
        out += '            {\n';
        if (im.parentMap) {
          out += '                const _n = std.fmt.bufPrint(_map_lua_bufs_' + imi + '_' + hi + '[_i][_j][0..47], "__mapPress_' + imi + '_' + hi + '({d},{d})", .{_i, _j}) catch "";\n';
        } else {
          out += '                const _n = std.fmt.bufPrint(_map_lua_bufs_' + imi + '_' + hi + '[_i][_j][0..47], "__mapPress_' + imi + '_' + hi + '({d})", .{_j}) catch "";\n';
        }
        out += '                _map_lua_bufs_' + imi + '_' + hi + '[_i][_j][_n.len] = 0;\n';
        out += '                _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j] = @ptrCast(_map_lua_bufs_' + imi + '_' + hi + '[_i][_j][0.._n.len :0]);\n';
        out += '            }\n';
      }

      // Per-item array fills with content fixup
      var imDtConsumed = 0;
      for (_pidx = 0; _pidx < imMeta.mapPerItemDecls.length; _pidx++) {
        pid = imMeta.mapPerItemDecls[_pidx];
        content = pid.decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
        // 1. Wire handler refs FIRST
        for (hi = 0; hi < imMeta.mapHandlers.length; hi++) {
          mh = imMeta.mapHandlers[hi];
          if (mh.luaBody) {
            escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            content = content.replace(new RegExp('\\.lua_on_press = "' + escapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
            content = content.replace(new RegExp('\\.js_on_press = "' + escapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
          }
          content = content.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh.name, 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
        }
        // 2. Fix inner OA field refs: _i→_j
        for (_fi = 0; _fi < imOa.fields.length; _fi++) {
          f = imOa.fields[_fi];
          content = content.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + f.name + '_lens\\[_i\\]\\]', 'g'),
            '_oa' + im.oaIdx + '_' + f.name + '[_j][0.._oa' + im.oaIdx + '_' + f.name + '_lens[_j]]');
          content = content.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f.name + '[_j]');
        }
        content = content.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
        content = content.replace(/@intCast\(_i\)/g, '@intCast(_j)');
        content = content.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
        // 3. Fix per-item array refs to [_i][_j]
        for (_pj = 0; _pj < imMeta.mapPerItemDecls.length; _pj++) {
          pid2 = imMeta.mapPerItemDecls[_pj];
          content = content.replace(new RegExp('&' + pid2.name + '\\b', 'g'), '&_map_' + pid2.name + '_' + imi + '[_i][_j]');
        }
        // 4. Wire tagged map text refs [_i][_j], then fallback sequential
        for (_tdi = 0; _tdi < imMeta.mapDynTexts.length; _tdi++) {
          dt = imMeta.mapDynTexts[_tdi];
          ti = dt._mapTextIdx;
          content = content.replace('"__mt' + ti + '__"', '_map_texts_' + imi + '_' + ti + '[_i][_j]');
        }
        while (imDtConsumed < imMeta.mapDynTexts.length) {
          dt = imMeta.mapDynTexts[imDtConsumed];
          ti = dt._mapTextIdx;
          next = content.replace('.text = ""', '.text = _map_texts_' + imi + '_' + ti + '[_i][_j]');
          if (next === content) break;
          content = next;
          imDtConsumed++;
        }
        out += '            _map_' + pid.name + '_' + imi + '[_i][_j] = [' + pid.elemCount + ']Node{ ' + content + ' };\n';
      }

      // Inner array construction
      if (imMeta.innerArr && imMeta.innerCount > 0) {
        sharedDecl = (im.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + imMeta.innerArr); }) ||
                     ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + imMeta.innerArr); });
        if (sharedDecl) {
          var ic = sharedDecl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          for (_fi = 0; _fi < imOa.fields.length; _fi++) {
            f = imOa.fields[_fi];
            ic = ic.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]\\[0\\.\\._{1}oa' + im.oaIdx + '_' + f.name + '_lens\\[_i\\]\\]', 'g'),
              '_oa' + im.oaIdx + '_' + f.name + '[_j][0.._oa' + im.oaIdx + '_' + f.name + '_lens[_j]]');
            ic = ic.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f.name + '[_j]');
          }
          ic = ic.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
          ic = ic.replace(/@intCast\(_i\)/g, '@intCast(_j)');
          ic = ic.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
          for (_pj = 0; _pj < imMeta.mapPerItemDecls.length; _pj++) {
            pid = imMeta.mapPerItemDecls[_pj];
            ic = ic.replace(new RegExp('&' + pid.name + '\\b', 'g'), '&_map_' + pid.name + '_' + imi + '[_i][_j]');
          }
          for (_tdi = 0; _tdi < imMeta.mapDynTexts.length; _tdi++) {
            dt = imMeta.mapDynTexts[_tdi];
            ti = dt._mapTextIdx;
            ic = ic.replace('"__mt' + ti + '__"', '_map_texts_' + imi + '_' + ti + '[_i][_j]');
            ic = ic.replace('.text = ""', '.text = _map_texts_' + imi + '_' + ti + '[_i][_j]');
          }
          for (hi = 0; hi < imMeta.mapHandlers.length; hi++) {
            mh = imMeta.mapHandlers[hi];
            if (mh.luaBody) {
              escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              ic = ic.replace(new RegExp('\\.lua_on_press = "' + escapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
              ic = ic.replace(new RegExp('\\.js_on_press = "' + escapedRegex + '"', 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
            }
            ic = ic.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh.name, 'g'), '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
          }
          out += '            _map_inner_' + imi + '[_i][_j] = [' + imMeta.innerCount + ']Node{ ' + ic + ' };\n';
        }
      }

      // Pool node
      var imPool = im.templateExpr;
      for (_fi = 0; _fi < imOa.fields.length; _fi++) {
        f = imOa.fields[_fi];
        imPool = imPool.replace(new RegExp('_oa' + im.oaIdx + '_' + f.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + f.name + '[_j]');
      }
      imPool = imPool.replace(/@as\(i64, @intCast\(_i\)\)/g, '__SMITH_OUTER_I64_I__');
      imPool = imPool.replace(/@intCast\(_i\)/g, '@intCast(_j)');
      imPool = imPool.replace(/__SMITH_OUTER_I64_I__/g, '@as(i64, @intCast(_i))');
      if (imMeta.innerArr) imPool = imPool.replace('&' + imMeta.innerArr, '&_map_inner_' + imi + '[_i][_j]');
      for (_pj = 0; _pj < imMeta.mapPerItemDecls.length; _pj++) {
        pid = imMeta.mapPerItemDecls[_pj];
        imPool = imPool.replace(new RegExp('&' + pid.name + '\\b', 'g'), '&_map_' + pid.name + '_' + imi + '[_i][_j]');
      }
      for (hi = 0; hi < imMeta.mapHandlers.length; hi++) {
        mh = imMeta.mapHandlers[hi];
        if (mh.luaBody) {
          escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          imPool = imPool.replace('.lua_on_press = "' + escaped + '"', '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
          imPool = imPool.replace('.js_on_press = "' + escaped + '"', '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
        }
        imPool = imPool.replace('.on_press = handlers.' + mh.name, '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
        imPool = imPool.replace('.on_press = ' + mh.name, '.' + imPressField + ' = _map_lua_ptrs_' + imi + '_' + hi + '[_i][_j]');
      }
      // Per-item conditionals for inline map
      function resolveInlineCond(expr) {
        var r = expr;
        if (imOa) {
          var ip = im.itemParam || 'item';
          for (var _rfi = 0; _rfi < imOa.fields.length; _rfi++) {
            var rf = imOa.fields[_rfi];
            r = r.replace(new RegExp(ip + '\\.' + rf.name, 'g'), '_oa' + im.oaIdx + '_' + rf.name + '[_j]');
            r = r.replace(new RegExp('_oa' + im.oaIdx + '_' + rf.name + '\\[_i\\]', 'g'), '_oa' + im.oaIdx + '_' + rf.name + '[_j]');
          }
        }
        if (m.oa) {
          var op = m.itemParam || 'col';
          for (var _rfi2 = 0; _rfi2 < m.oa.fields.length; _rfi2++) {
            var rf2 = m.oa.fields[_rfi2];
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
      for (_ci = 0; _ci < ctx.conditionals.length; _ci++) {
        cond = ctx.conditionals[_ci];
        if (!cond.arrName) continue;
        pid = imMeta.mapPerItemDecls.find(function(p) { return p.name === cond.arrName; });
        if (!pid) continue;
        poolArr = '_map_' + cond.arrName + '_' + imi + '[_i][_j]';
        resolvedExpr = resolveInlineCond(cond.condExpr);
        if (cond.kind === 'show_hide') {
          out += '            ' + poolArr + '[' + cond.trueIdx + '].style.display = if ((' + resolvedExpr + ')) .flex else .none;\n';
        } else if (cond.kind === 'ternary_jsx') {
          var _w = _wrapMapCondition(resolvedExpr);
          out += '            ' + poolArr + '[' + cond.trueIdx + '].style.display = if ' + _w + ' .flex else .none;\n';
          out += '            ' + poolArr + '[' + cond.falseIdx + '].style.display = if ' + _w + ' .none else .flex;\n';
        }
      }
      // Inner array conditionals
      if (imMeta.innerArr && imMeta.innerCount > 0) {
        for (_ci = 0; _ci < ctx.conditionals.length; _ci++) {
          cond = ctx.conditionals[_ci];
          if (!cond.arrName || cond.arrName !== imMeta.innerArr) continue;
          resolvedExpr = resolveInlineCond(cond.condExpr);
          if (cond.kind === 'show_hide') {
            out += '            _map_inner_' + imi + '[_i][_j][' + cond.trueIdx + '].style.display = if ((' + resolvedExpr + ')) .flex else .none;\n';
          } else if (cond.kind === 'ternary_jsx') {
            var _w2 = _wrapMapCondition(resolvedExpr);
            out += '            _map_inner_' + imi + '[_i][_j][' + cond.trueIdx + '].style.display = if ' + _w2 + ' .flex else .none;\n';
            out += '            _map_inner_' + imi + '[_i][_j][' + cond.falseIdx + '].style.display = if ' + _w2 + ' .none else .flex;\n';
          }
        }
      }

      // Hoist display to pool if needed
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

    // ── Inner array + pool node for flat map ──
    if (innerCount > 0) {
      var innerItems = [];
      if (innerArr) {
        var decl = (m.mapArrayDecls || []).find(function(d) { return d.startsWith('var ' + innerArr); }) ||
                   ctx.arrayDecls.find(function(d) { return d.startsWith('var ' + innerArr); });
        if (decl) {
          var inner = decl.replace(/var \w+ = \[_\]Node\{ /, '').replace(/ \};.*$/, '');
          for (_dti = 0; _dti < mapDynTexts.length; _dti++) {
            dt = mapDynTexts[_dti];
            ti = dt._mapTextIdx;
            inner = inner.replace('"__mt' + ti + '__"', '_map_texts_' + mi + '_' + ti + '[_i]');
          }
          for (_dti = dtConsumed; _dti < dtConsumed + innerTextSlots && _dti < mapDynTexts.length; _dti++) {
            dt = mapDynTexts[_dti];
            ti = dt._mapTextIdx;
            inner = inner.replace('.text = ""', '.text = _map_texts_' + mi + '_' + ti + '[_i]');
          }
          for (mj = 0; mj < ctx.maps.length; mj++) {
            otherMap = ctx.maps[mj];
            if (!otherMap._mapPerItemDecls) continue;
            for (_pj = 0; _pj < otherMap._mapPerItemDecls.length; _pj++) {
              pid = otherMap._mapPerItemDecls[_pj];
              if (!otherMap.isNested && !otherMap.isInline) {
                inner = inner.replace(new RegExp('&' + pid.name + '\\b', 'g'), '_pi_' + pid.name + '_' + mj);
              } else {
                inner = inner.replace(new RegExp('&' + pid.name + '\\b', 'g'), '&_map_' + pid.name + '_' + mj + '[_i]');
              }
            }
          }
          for (nmi = 0; nmi < ctx.maps.length; nmi++) {
            nm = ctx.maps[nmi];
            var isChildOfThisMap = (nm.isNested && nm.parentOaIdx === m.oaIdx) || (nm.isInline && nm.parentMap === m);
            if (!isChildOfThisMap) continue;
            if (nm.parentArr && inner.includes('&' + nm.parentArr)) {
              inner = inner.replace('&' + nm.parentArr, '_map_pool_' + nmi + '[_i][0.._map_count_' + nmi + '[_i]]');
            }
          }
          var innerPressField = 'lua_on_press';
          for (mj = 0; mj < ctx.maps.length; mj++) {
            allMH = ctx.handlers.filter(function(h) { return h.inMap && h.mapIdx === mj; });
            for (hi = 0; hi < allMH.length; hi++) {
              mh = allMH[hi];
              if (mh.luaBody) {
                escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                ptrReplacement = '.' + innerPressField + ' = _map_lua_ptrs_' + mj + '_' + hi + '[_i]';
                inner = inner.replace(new RegExp('\\.lua_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
                inner = inner.replace(new RegExp('\\.js_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
              }
              inner = inner.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh.name, 'g'), '.' + innerPressField + ' = _map_lua_ptrs_' + mj + '_' + hi + '[_i]');
            }
          }
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
        for (_ci = 0; _ci < ctx.conditionals.length; _ci++) {
          cond = ctx.conditionals[_ci];
          if (!cond.arrName || cond.arrName !== innerArr) continue;
          resolvedExpr = cond.condExpr;
          if (m.oa) {
            itemParam = m.itemParam || 'item';
            for (_fi = 0; _fi < m.oa.fields.length; _fi++) {
              f = m.oa.fields[_fi];
              resolvedExpr = resolvedExpr.replace(new RegExp(itemParam + '\\.' + f.name, 'g'), '_oa' + m.oa.oaIdx + '_' + f.name + '[_i]');
            }
          }
          if (/\b0\(/.test(resolvedExpr) || /(?<!\()0\b.*@as/.test(resolvedExpr)) continue;
          var _wc = _wrapMapCondition(resolvedExpr);
          if (cond.kind === 'show_hide') {
            out += '        _inner_' + mi + '[' + cond.trueIdx + '].style.display = if ' + _wc + ' .flex else .none;\n';
          } else if (cond.kind === 'ternary_jsx') {
            out += '        _inner_' + mi + '[' + cond.trueIdx + '].style.display = if ' + _wc + ' .flex else .none;\n';
            out += '        _inner_' + mi + '[' + cond.falseIdx + '].style.display = if ' + _wc + ' .none else .flex;\n';
          }
        }
      }

      // Assign nested/inline map children to the correct inner array slot
      for (nmi = 0; nmi < ctx.maps.length; nmi++) {
        nm = ctx.maps[nmi];
        isChildOfThisMap = (nm.isNested && nm.parentOaIdx === m.oaIdx) || (nm.isInline && nm.parentMap === m);
        if (!isChildOfThisMap) continue;
        if (nm.parentArr) {
          var isInnerChild = innerArr && nm.parentArr === innerArr;
          if (isInnerChild) {
            out += '        _inner_' + mi + '[' + nm.childIdx + '].children = _map_pool_' + nmi + '[_i][0.._map_count_' + nmi + '[_i]];\n';
          } else if (_promotedToPerItem.has(nm.parentArr) || (m._mapPerItemDecls && m._mapPerItemDecls.some(function(p) { return p.name === nm.parentArr; }))) {
            out += '        _pi_' + nm.parentArr + '_' + mi + '[' + nm.childIdx + '].children = _map_pool_' + nmi + '[_i][0.._map_count_' + nmi + '[_i]];\n';
          } else {
            out += '        ' + nm.parentArr + '[' + nm.childIdx + '].children = _map_pool_' + nmi + '[_i][0.._map_count_' + nmi + '[_i]];\n';
          }
        }
      }

      // Build pool node from template
      var poolNode = m.templateExpr;
      if (innerArr) {
        poolNode = poolNode.replace('&' + innerArr, '_inner_' + mi);
      }
      for (mj = 0; mj < ctx.maps.length; mj++) {
        otherMap = ctx.maps[mj];
        if (!otherMap._mapPerItemDecls) continue;
        for (_pj = 0; _pj < otherMap._mapPerItemDecls.length; _pj++) {
          pid = otherMap._mapPerItemDecls[_pj];
          if (!otherMap.isNested && !otherMap.isInline) {
            poolNode = poolNode.replace(new RegExp('&' + pid.name + '\\b', 'g'), '_pi_' + pid.name + '_' + mj);
          } else {
            poolNode = poolNode.replace(new RegExp('&' + pid.name + '\\b', 'g'), '&_map_' + pid.name + '_' + mj + '[_i]');
          }
        }
      }
      var pressField = 'lua_on_press';
      if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
        ctx._debugLines.push('[MAP_POOL_NODE] mi=' + mi + ' pressField=' + pressField + ' poolNode=' + poolNode.substring(0, 300));
      }
      for (hi = 0; hi < mapHandlers.length; hi++) {
        mh = mapHandlers[hi];
        escaped = mh.luaBody ? mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
        ptrReplacement = '.' + pressField + ' = _map_lua_ptrs_' + mi + '_' + hi + '[_i]';
        if (globalThis.__SMITH_DEBUG_MAP_PTRS) {
          print('[MAP_PTR_WIRE_POOL] map=' + mi + ' handler=' + hi + ' field=' + pressField + ' escaped="' + escaped.substring(0,60) + '..." poolNode has lua_on_press=' + poolNode.includes('.lua_on_press') + ' js_on_press=' + poolNode.includes('.js_on_press'));
        }
        poolNode = poolNode.replace('.lua_on_press = "' + escaped + '"', ptrReplacement);
        poolNode = poolNode.replace('.js_on_press = "' + escaped + '"', ptrReplacement);
        poolNode = poolNode.replace('.on_press = handlers.' + mh.name, ptrReplacement);
        poolNode = poolNode.replace('.on_press = ' + mh.name, ptrReplacement);
      }
      var hm = poolNode.match(/\.handlers = \.{[^}]+\}/);
      var cm = poolNode.match(/\.children = &[\w\[\]_]+/);
      if (hm && cm) {
        poolNode = poolNode.replace(hm[0] + ', ' + cm[0], cm[0] + ', ' + hm[0]);
      }
      var fieldRefsMap = m._handlerFieldRefsMap || {};
      if (typeof globalThis.__SMITH_DEBUG_MAP_TEXT !== 'undefined') {
        ctx._debugLines.push('[MAP_HANDLER_DEBUG] map=' + mi + ' fieldRefsMap keys=' + JSON.stringify(Object.keys(fieldRefsMap)) + ' mapHandlers.length=' + mapHandlers.length);
        for (var _dhi = 0; _dhi < mapHandlers.length; _dhi++) {
          var _dmh = mapHandlers[_dhi];
          ctx._debugLines.push('[MAP_HANDLER_DEBUG]   handler[' + _dhi + '] name=' + _dmh.name + ' luaBody=' + (_dmh.luaBody || '').substring(0, 100) + ' fieldRefs=' + JSON.stringify(fieldRefsMap[_dhi] || []));
        }
      }
      var poolIdxParam = m.indexParam || 'i';
      if (poolIdxParam !== '_i') {
        poolNode = poolNode.replace(new RegExp('\\b' + poolIdxParam + '\\b', 'g'), '@as(i64, @intCast(_i))');
      }
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
        for (var fi = 0; fi < m.filterConditions.length; fi++) {
          var fc = m.filterConditions[fi];
          var fcCond = fc.raw;
          if (m.oa) {
            for (var ffi = 0; ffi < m.oa.fields.length; ffi++) {
              f = m.oa.fields[ffi];
              fcCond = fcCond.replace(new RegExp('\\b' + fc.param + '\\s*\\.\\s*' + f.name + '\\b', 'g'), '_oa' + m.oaIdx + '_' + f.name + '[_i]');
            }
          }
          for (var si = 0; si < ctx.stateSlots.length; si++) {
            var s = ctx.stateSlots[si];
            fcCond = fcCond.replace(new RegExp('\\b' + s.getter + '\\b', 'g'), 'state.getSlot(' + si + ')');
          }
          fcCond = fcCond.replace(/\|\|/g, ' or ');
          fcCond = fcCond.replace(/&&/g, ' and ');
          fcCond = fcCond.replace(/===/g, '==');
          fcCond = fcCond.replace(/!==/g, '!=');
          filterParts.push('(' + fcCond.trim() + ')');
        }
        var filterExpr = filterParts.join(' and ');
        out += '        _map_pool_' + mi + '[_i].style.display = if (' + filterExpr + ') .flex else .none;\n';
      }
    } else {
      // Single-node map template (no inner array)
      var tExpr = m.templateExpr;
      for (_dti = 0; _dti < mapDynTexts.length; _dti++) {
        dt = mapDynTexts[_dti];
        ti = dt._mapTextIdx;
        tExpr = tExpr.replace('"__mt' + ti + '__"', '_map_texts_' + mi + '_' + ti + '[_i]');
        tExpr = tExpr.replace('.text = ""', '.text = _map_texts_' + mi + '_' + ti + '[_i]');
      }
      out += '        _map_pool_' + mi + '[_i] = ' + tExpr + ';\n';
    }

    // ── Deferred canvas attributes ──
    if (m._deferredCanvasAttrs) {
      for (var _dai = 0; _dai < m._deferredCanvasAttrs.length; _dai++) {
        var da = m._deferredCanvasAttrs[_dai];
        var oaIdx = m.oaIdx;
        var oaField = '_oa' + oaIdx + '_' + da.oaField;
        var target = '_map_pool_' + mi + '[_i]';
        var isPathAttr = da.zigField === 'canvas_path_d' || da.zigField === 'canvas_fill_effect' ||
            da.zigField === 'canvas_fill_color' || da.zigField === 'canvas_stroke_width' ||
            da.zigField === 'canvas_flow_speed';
        var isGraphAttr = da.zigField === 'canvas_view_zoom';
        if (m._mapPerItemDecls) {
          if (isPathAttr) {
            for (_pidx = 0; _pidx < m._mapPerItemDecls.length; _pidx++) {
              pid = m._mapPerItemDecls[_pidx];
              if (pid.expr && pid.expr.includes('.canvas_path = true')) {
                target = '_pi_' + pid.name + '_' + mi + '[0]';
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

    // ── Variant patches for classifier nodes inside this map ──
    var mapVBs = ctx.variantBindings.filter(function(vb) { return vb.inMap; });
    if (mapVBs.length > 0 && ctx.variantNames.length > 0) {
      out += '        {\n';
      out += '        const _v = @as(usize, api.theme.rjit_theme_active_variant());\n';
      for (var _vbi = 0; _vbi < mapVBs.length; _vbi++) {
        var vb = mapVBs[_vbi];
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
          var fields = vb.styles[vi].split(/,\s*(?=\.)/).filter(function(fld) { return fld.trim().startsWith('.'); });
          var assignments = fields.map(function(fld) {
            var eqIdx = fld.indexOf('=');
            if (eqIdx < 0) return '';
            var sf = fld.trim().slice(1, eqIdx).trim();
            var sv = fld.slice(eqIdx + 1).trim();
            return '        ' + vbTarget + '.style.' + sf + ' = ' + sv + ';\n';
          }).join('');
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
