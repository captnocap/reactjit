// ── Atom 28: emit_map_press.js ──────────────────────────────────
// __mapPress_N_H(args) function body emission.
// One function: emitMapPressBody(mapIdx, handlerIdx, handler, target)
// where target is 'lua', 'js', or 'zig'.
//
// Source:
//   Lua path: logic_blocks.js lines 315-401 (nested + top-level map handlers in LUA_LOGIC)
//   Zig path: map_pools.js lines 339, 409, 652, 703-705 (bufPrint calls building __mapPress strings)
//
// The Lua path emits `function __mapPress_N_H(params) body end` as Lua code lines.
// The Zig path emits `std.fmt.bufPrint(buf, "__mapPress_N_H(fmt)", .{args})` — the Zig code
// that builds the Lua function call string at runtime and stores it in a handler pointer buffer.
//
// This atom extracts the Lua function body emission. The Zig bufPrint emission stays in the
// rebuild atoms (emit_handler_fmt.js / atom 5) since it's part of the per-item rebuild loop.
//
// luaTransform() is NOT called here — the caller must transform the body before passing it in,
// or this function can be extended to accept a transform function parameter.

// Emit a Lua __mapPress function for a top-level (flat) map handler.
// Returns an array of Lua code lines.
function emitMapPressFlatLua(mi, hi, handler, map) {
  var lines = [];
  var oa = map.oa;
  var ip = map.itemParam;
  var fieldRefs = [];
  if (oa) {
    for (var fi = 0; fi < oa.fields.length; fi++) {
      var f = oa.fields[fi];
      if (f.type === 'nested_array') continue;
      var pat = new RegExp('\\b' + ip + '\\.' + f.name + '\\b');
      if (pat.test(handler.luaBody)) fieldRefs.push(f);
    }
  }
  var params = ['idx'].concat(fieldRefs.map(function(f) { return '_f_' + f.name; }));
  lines.push('function __mapPress_' + mi + '_' + hi + '(' + params.join(', ') + ')');
  lines.push('  local ' + map.indexParam + ' = idx');
  var body = handler.luaBody;
  for (var fi = 0; fi < fieldRefs.length; fi++) {
    var f = fieldRefs[fi];
    body = body.replace(new RegExp('\\b' + ip + '\\.' + f.name + '\\b', 'g'), '_f_' + f.name);
  }
  lines.push('  ' + body);
  lines.push('end');
  lines.push('');
  // Store field refs for Zig-side ptr building (per-handler)
  if (!map._handlerFieldRefsMap) map._handlerFieldRefsMap = {};
  map._handlerFieldRefsMap[hi] = fieldRefs;
  map._handlerFieldRefs = fieldRefs; // backward compat
  return lines;
}

// Emit a Lua __mapPress function for a nested map handler.
// Returns an array of Lua code lines.
function emitMapPressNestedLua(mi, hi, handler, map) {
  var lines = [];
  var outerIdxParam = map.parentMap.indexParam || 'gi';
  var innerIdxParam = map.indexParam || 'ii';
  var parentFieldRefs = [];
  var childFieldRefs = [];
  if (map.parentMap.oa) {
    for (var fi = 0; fi < map.parentMap.oa.fields.length; fi++) {
      var f = map.parentMap.oa.fields[fi];
      if (f.type === 'nested_array') continue;
      var pat = new RegExp('\\b' + map.parentMap.itemParam + '\\.' + f.name + '\\b');
      if (pat.test(handler.luaBody)) parentFieldRefs.push(f);
    }
  }
  if (map.oa) {
    for (var fi = 0; fi < map.oa.fields.length; fi++) {
      var f = map.oa.fields[fi];
      if (f.type === 'nested_array') continue;
      var pat = new RegExp('\\b' + map.itemParam + '\\.' + f.name + '\\b');
      if (pat.test(handler.luaBody)) childFieldRefs.push(f);
    }
  }
  var params = [outerIdxParam, innerIdxParam]
    .concat(parentFieldRefs.map(function(f) { return '_fp_' + f.name; }))
    .concat(childFieldRefs.map(function(f) { return '_fc_' + f.name; }));
  lines.push('function __mapPress_' + mi + '_' + hi + '(' + params.join(', ') + ')');
  var body = handler.luaBody;
  for (var fi = 0; fi < parentFieldRefs.length; fi++) {
    var f = parentFieldRefs[fi];
    body = body.replace(new RegExp('\\b' + map.parentMap.itemParam + '\\.' + f.name + '\\b', 'g'), '_fp_' + f.name);
  }
  for (var fi = 0; fi < childFieldRefs.length; fi++) {
    var f = childFieldRefs[fi];
    body = body.replace(new RegExp('\\b' + map.itemParam + '\\.' + f.name + '\\b', 'g'), '_fc_' + f.name);
  }
  lines.push('  ' + body);
  lines.push('end');
  lines.push('');
  // Store field refs for Zig-side ptr building
  if (!map._handlerFieldRefsMap) map._handlerFieldRefsMap = {};
  map._handlerFieldRefsMap[hi] = [].concat(parentFieldRefs, childFieldRefs);
  map._nestedParentFieldRefs = map._nestedParentFieldRefs || {};
  map._nestedParentFieldRefs[hi] = parentFieldRefs;
  map._nestedChildFieldRefs = map._nestedChildFieldRefs || {};
  map._nestedChildFieldRefs[hi] = childFieldRefs;
  return lines;
}

// Dispatch: emit the right __mapPress variant based on map type.
// handler.luaBody should already be luaTransform()'d by the caller if needed.
// target: 'lua' emits Lua function definitions. 'zig' is handled by emit_handler_fmt (atom 5).
function emitMapPressBody(mapIdx, handlerIdx, handler, map, target) {
  if (target === 'lua') {
    if (map.isNested && map.parentMap) {
      return emitMapPressNestedLua(mapIdx, handlerIdx, handler, map);
    } else {
      return emitMapPressFlatLua(mapIdx, handlerIdx, handler, map);
    }
  }
  // 'zig' target: bufPrint emission is part of the rebuild loop (atom 5 / emit_handler_fmt).
  // 'js' target: JS map press handlers were removed — all go through LUA_LOGIC.
  return [];
}
