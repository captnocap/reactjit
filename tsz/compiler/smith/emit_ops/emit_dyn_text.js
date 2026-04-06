// ── Atom 4: emit_dyn_text.js — Format dynamic text buffers ──────
// One function that emits std.fmt.bufPrint lines for dynamic text
// in any map context. No hardcoded _i vs _flat_j.
//
// Source: map_pools.js lines 382-384 (flat), 582-600 (nested),
//         685-696 (inline)

// emitMapDynText(dynTexts, mapIdx, iterExpr, oaFields, oaIdx, indent)
//
// dynTexts:   array of dynText objects for this map (filtered by mapIdx)
// mapIdx:     the map index
// iterExpr:   index expression for text buffer access, e.g. '[_i]' or '[_flat_j]' or '[_i][_j]'
// oaFields:   (optional) OA fields for fromVar->toVar replacement in fmtArgs
// oaIdx:      (optional) OA index for field ref rewriting
// fromVar:    (optional) source var in fmtArgs to replace, e.g. '_i'
// toVar:      (optional) target var to replace with, e.g. '_flat_j'
// indent:     indentation string (spaces)
//
// Returns: string of Zig lines that do bufPrint for each dynText.

function emitMapDynText(dynTexts, mapIdx, iterExpr, oaFields, oaIdx, fromVar, toVar, indent) {
  var out = '';
  for (var dti = 0; dti < dynTexts.length; dti++) {
    var dt = dynTexts[dti];
    var ti = dt._mapTextIdx;
    var args = dt.fmtArgs;

    // Optionally rewrite OA field refs in args (e.g. _i -> _flat_j for nested maps)
    if (oaFields && fromVar && toVar) {
      for (var fi = 0; fi < oaFields.length; fi++) {
        var f = oaFields[fi];
        args = args.replace(
          new RegExp('_oa' + oaIdx + '_' + f.name + '\\[' + fromVar + '\\]', 'g'),
          '_oa' + oaIdx + '_' + f.name + '[' + toVar + ']'
        );
        args = args.replace(
          new RegExp('_oa' + oaIdx + '_' + f.name + '_lens\\[' + fromVar + '\\]', 'g'),
          '_oa' + oaIdx + '_' + f.name + '_lens[' + toVar + ']'
        );
      }
      // Also replace bare iteration variable refs
      args = args.replace(new RegExp('_oa' + oaIdx + '_(\\w+)\\[' + fromVar + '\\]', 'g'), '_oa' + oaIdx + '_$1[' + toVar + ']');
      args = args.replace(new RegExp('_oa' + oaIdx + '_(\\w+)_lens\\[' + fromVar + '\\]', 'g'), '_oa' + oaIdx + '_$1_lens[' + toVar + ']');
      args = args.replace(new RegExp('@intCast\\(' + fromVar + '\\)', 'g'), '@intCast(' + toVar + ')');
    }

    out += indent + '_map_texts_' + mapIdx + '_' + ti + iterExpr + ' = std.fmt.bufPrint(&_map_text_bufs_' + mapIdx + '_' + ti + iterExpr + ', "' + dt.fmtString + '", .{ ' + args + ' }) catch "";\n';
  }
  return out;
}
