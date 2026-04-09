// ── Emit Atom 035: Dynamic text updates ─────────────────────────
// Index: 35
// Group: logic_runtime
// Target: zig
// Status: complete
// Current owner: emit/runtime_updates.js
//
// Trigger: ctx.dynTexts has non-map entries, or ctx.dynColors/dynStyles
//   have entries needing runtime updates.
// Output target: fn _updateDynamicTexts() void { ... }
//
// Notes:
//   Emits a Zig function that updates dynamic text buffers and
//   dynamic style/color properties on each dirty tick.
//
//   Three sections:
//     1. Dynamic text bufPrint: for each non-map dynText, format the
//        buffer and assign to node .text (or .targetField).
//     2. Dynamic colors: state-driven text_color assignments on array nodes.
//     3. Dynamic styles: state-driven style field assignments (sorted by
//        arrNum then arrIndex for stable output).
//
//   Skips entries that belong to map pools (mapPoolArrayNames set) or
//   are promoted to per-item arrays. Map-scoped entries are handled
//   inside _rebuildMapN() instead.

function _a035_applies(ctx, meta) {
  void meta;
  // _updateDynamicTexts is always emitted (even if body is empty)
  return !!ctx;
}

function _a035_emit(ctx, meta) {
  var promotedToPerItem = meta.promotedToPerItem || new Set();
  var mapPoolArrayNames = new Set();
  for (var mi = 0; mi < ctx.maps.length; mi++) {
    var map = ctx.maps[mi];
    if (map._mapPerItemDecls) {
      for (var pi = 0; pi < map._mapPerItemDecls.length; pi++) mapPoolArrayNames.add(map._mapPerItemDecls[pi].name);
    }
    if (map.mapArrayDecls) {
      for (var mdi = 0; mdi < map.mapArrayDecls.length; mdi++) {
        var mdMatch = map.mapArrayDecls[mdi].match(/^var (_arr_\d+)/);
        if (mdMatch) mapPoolArrayNames.add(mdMatch[1]);
      }
    }
  }

  var out = '';
  if (meta._deferredInitState) out += meta._deferredInitState;
  out += 'fn _updateDynamicTexts() void {\n';
  for (var di = 0; di < ctx.dynTexts.length; di++) {
    var dt = ctx.dynTexts[di];
    if (dt.inMap) continue;
    if (dt.arrName && mapPoolArrayNames.has(dt.arrName)) continue;
    var dtField = dt.targetField || 'text';
    if (dt.arrName) {
      out += '    ' + dt.arrName + '[' + dt.arrIndex + '].' + dtField + ' = std.fmt.bufPrint(&_dyn_buf_' + dt.bufId + ', "' + dt.fmtString + '", .{ ' + dt.fmtArgs + ' }) catch "";\n';
    } else {
      out += '    _root.' + dtField + ' = std.fmt.bufPrint(&_dyn_buf_' + dt.bufId + ', "' + dt.fmtString + '", .{ ' + dt.fmtArgs + ' }) catch "";\n';
    }
  }

  var dynUpdates = [];
  if (ctx.dynColors) {
    for (var ci = 0; ci < ctx.dynColors.length; ci++) {
      var dc = ctx.dynColors[ci];
      if (dc.arrName && (promotedToPerItem.has(dc.arrName) || mapPoolArrayNames.has(dc.arrName))) continue;
      if (dc.arrName && dc.arrIndex >= 0) {
        var arrNum = parseInt(dc.arrName.replace('_arr_', ''));
        dynUpdates.push({ arrNum: arrNum, arrIndex: dc.arrIndex, line: '    ' + dc.arrName + '[' + dc.arrIndex + '].text_color = ' + dc.colorExpr + ';\n' });
      }
    }
  }
  if (ctx.dynStyles && ctx.dynStyles.length > 0) {
    for (var si = 0; si < ctx.dynStyles.length; si++) {
      var ds = ctx.dynStyles[si];
      if (ds.expression && (ds.expression.includes('_i)') || ds.expression.includes('_i]') || ds.expression.includes('(_i'))) continue;
      if (ds.arrName && (promotedToPerItem.has(ds.arrName) || mapPoolArrayNames.has(ds.arrName))) continue;
      if (ds.arrName && ds.arrIndex >= 0) {
        var arrNum2 = parseInt(ds.arrName.replace('_arr_', ''));
        var nodeFields = ['text_color', 'font_size', 'text'];
        var fieldPrefix = nodeFields.includes(ds.field) ? '' : 'style.';
        dynUpdates.push({ arrNum: arrNum2, arrIndex: ds.arrIndex, line: '    ' + ds.arrName + '[' + ds.arrIndex + '].' + fieldPrefix + ds.field + ' = ' + ds.expression + ';\n' });
      } else {
        var rootExpr = meta.rootExpr || '';
        var zigField = ds.field.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (rootExpr.includes(zigField) || rootExpr.includes(ds.field)) {
          var nodeFields2 = ['text_color', 'font_size', 'text'];
          var fieldPrefix2 = nodeFields2.includes(ds.field) ? '' : 'style.';
          dynUpdates.push({ arrNum: 99998, arrIndex: 0, line: '    _root.' + fieldPrefix2 + ds.field + ' = ' + ds.expression + ';\n' });
        }
      }
    }
  }
  dynUpdates.sort(function(a, b) { return a.arrNum - b.arrNum || a.arrIndex - b.arrIndex; });
  for (var ui = 0; ui < dynUpdates.length; ui++) out += dynUpdates[ui].line;
  out += '}\n\n';
  return out;
}

_emitAtoms[35] = {
  id: 35,
  name: 'dynamic_text_updates',
  group: 'logic_runtime',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/runtime_updates.js',
  applies: _a035_applies,
  emit: _a035_emit,
};
