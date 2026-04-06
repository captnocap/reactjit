// ── Atom 5: emit_handler_fmt.js — Build handler format strings ──
// One function that builds the std.fmt.bufPrint call for handler
// pointer initialization. Pattern: __mapPress_N_H(args...) with
// field refs. Returns the Zig block that does bufPrint + null
// terminator + ptrCast for one handler.
//
// Source: map_pools.js lines 396-412 (flat with field refs),
//         631-655 (nested), 700-709 (inline)

// emitHandlerFmt(mapIdx, handlerIdx, iterVar, bufExpr, bufSize, fmtParts, argParts, indent)
//
// mapIdx:      map index
// handlerIdx:  handler index within this map
// iterVar:     not used directly — iteration index is in bufExpr
// bufExpr:     the buffer access expression, e.g. '[_i]' or '[_flat_j]' or '[_i][_j]'
// bufSize:     buffer size (47 or 127)
// fmtParts:    array of format specifiers, e.g. ['{d}', '{d}'] or ['{d}', "'{s}'"]
// argParts:    array of argument expressions, e.g. ['_i', '_jj']
// indent:      indentation string
//
// Returns: Zig block string with bufPrint + null terminator + ptrCast.

function emitHandlerFmt(mapIdx, handlerIdx, iterVar, bufExpr, bufSize, fmtParts, argParts, indent) {
  void iterVar;
  var out = '';
  out += indent + '{\n';
  out += indent + '    const _n = std.fmt.bufPrint(_map_lua_bufs_' + mapIdx + '_' + handlerIdx + bufExpr + '[0..' + bufSize + '], "__mapPress_' + mapIdx + '_' + handlerIdx + '(' + fmtParts.join(',') + ')", .{' + argParts.join(', ') + '}) catch "";\n';
  out += indent + '    _map_lua_bufs_' + mapIdx + '_' + handlerIdx + bufExpr + '[_n.len] = 0;\n';
  out += indent + '    _map_lua_ptrs_' + mapIdx + '_' + handlerIdx + bufExpr + ' = @ptrCast(_map_lua_bufs_' + mapIdx + '_' + handlerIdx + bufExpr + '[0.._n.len :0]);\n';
  out += indent + '}\n';
  return out;
}

// buildFieldRefFmtArgs(fieldRefs, oaIdx, iterVar)
//
// Builds the fmtParts and argParts arrays for handler field refs.
// fieldRefs: array of {name, type} objects
// oaIdx:     OA index for field access
// iterVar:   iteration variable for array indexing
//
// Returns: {fmtParts: [...], argParts: [...]}

function buildFieldRefFmtArgs(fieldRefs, oaIdx, iterVar) {
  var fmtParts = [];
  var argParts = [];
  for (var fi = 0; fi < fieldRefs.length; fi++) {
    var f = fieldRefs[fi];
    if (f.type === 'string') {
      fmtParts.push("'{s}'");
      argParts.push('_oa' + oaIdx + '_' + f.name + '[' + iterVar + '][0.._oa' + oaIdx + '_' + f.name + '_lens[' + iterVar + ']]');
    } else {
      fmtParts.push('{d}');
      argParts.push('_oa' + oaIdx + '_' + f.name + '[' + iterVar + ']');
    }
  }
  return { fmtParts: fmtParts, argParts: argParts };
}
