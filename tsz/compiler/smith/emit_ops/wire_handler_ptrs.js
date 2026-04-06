// ── Atom 3: wire_handler_ptrs.js — Wire handler pointers into pool nodes ─
// One function that takes a pool node template string and replaces static
// handler string literals with per-item pointer references.
//
// Source: map_pools.js lines 483-502 (flat per-item), 656-662 (nested),
//         719-728 (inline per-item), 781-789 (inline inner),
//         807-815 (inline pool), 941-956 (flat inner), 1037-1048 (flat pool)

// wireHandlerPtrs(content, handlers, mapIdx, iterExpr, pressField)
//
// content:    the template string to rewrite
// handlers:   array of handler objects (from ctx.handlers filtered to this map)
// mapIdx:     the map index (for _map_lua_ptrs_N_H naming)
// iterExpr:   the index expression string, e.g. '[_i]' or '[_flat_j]' or '[_i][_j]'
// pressField: typically 'lua_on_press'
//
// Returns: modified content with handler body strings replaced by pointer refs.

function wireHandlerPtrs(content, handlers, mapIdx, iterExpr, pressField) {
  var result = content;
  for (var hi = 0; hi < handlers.length; hi++) {
    var mh = handlers[hi];
    var ptrReplacement = '.' + pressField + ' = _map_lua_ptrs_' + mapIdx + '_' + hi + iterExpr;

    // Replace literal handler body strings (both lua_on_press and js_on_press variants)
    if (mh.luaBody) {
      var escaped = mh.luaBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      var escapedRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp('\\.lua_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
      result = result.replace(new RegExp('\\.js_on_press = "' + escapedRegex + '"', 'g'), ptrReplacement);
    }

    // Replace named handler refs (.on_press = handlers.name or .on_press = name)
    result = result.replace(new RegExp('\\.on_press = (?:handlers\\.)?' + mh.name, 'g'), ptrReplacement);
  }
  return result;
}
