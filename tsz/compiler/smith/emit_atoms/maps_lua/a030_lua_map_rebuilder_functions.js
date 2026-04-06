// ── Emit Atom 030: Lua map rebuilder functions ─────────────────
// Index: 30
// Group: maps_lua
// Target: lua_in_zig
//
// Emits one __rebuildLuaMapN() per map. Uses:
//   lua_map_subs.js  — substitution rules
//   lua_map_style.js — style emit
//   lua_map_text.js  — text emit
//   lua_map_handler.js — handler emit
//   lua_map_node.js  — recursive node → Lua table

function _a030_applies(ctx) {
  return ctx._luaMapRebuilders && ctx._luaMapRebuilders.length > 0;
}

var _nestedHelperEmitted = false;

function _a030_emit(ctx) {
  var lines = [];
  lines.push('-- Lua map rebuilders');

  if (!_nestedHelperEmitted) {
    lines.push('function __luaNestedMap(arr, fn)');
    lines.push('  if not arr then return nil end');
    lines.push('  local result = {}');
    lines.push('  for _ni, _nitem in ipairs(arr) do');
    lines.push('    result[#result + 1] = fn(_nitem, _ni)');
    lines.push('  end');
    lines.push('  return { children = result }');
    lines.push('end');
    lines.push('');
    _nestedHelperEmitted = true;
  }

  for (var i = 0; i < ctx._luaMapRebuilders.length; i++) {
    var lmr = ctx._luaMapRebuilders[i];
    var idx = lmr.index;
    var itemParam = lmr.itemParam || 'item';
    var indexParam = lmr.indexParam || null;
    var bodyNode = lmr.bodyNode || null;

    if (bodyNode) {
      var bodyLua = _nodeToLua(bodyNode, itemParam, indexParam, '      ');
      lines.push('function __rebuildLuaMap' + idx + '()');
      lines.push('  __clearLuaNodes()');
      lines.push('  local wrapper = __mw' + idx);
      lines.push('  if not wrapper then return end');
      lines.push('  local items = __luaMapData' + idx);
      lines.push('  if not items or #items == 0 then');
      lines.push('    __declareChildren(wrapper, {})');
      lines.push('    return');
      lines.push('  end');
      lines.push('  local tmpl = {}');
      lines.push('  for _i, _item in ipairs(items) do');
      lines.push('    tmpl[#tmpl + 1] = ' + bodyLua);
      lines.push('  end');
      lines.push('  __declareChildren(wrapper, tmpl)');
      lines.push('end');
      lines.push('');
    } else if (lmr.luaCode) {
      // Legacy fallback — remove when all maps provide bodyNode
      var codeLines = lmr.luaCode.split('\n');
      for (var li = 0; li < codeLines.length; li++) {
        lines.push(codeLines[li]);
      }
    }
  }
  return lines;
}

_emitAtoms[30] = {
  id: 30,
  name: 'lua_map_rebuilder_functions',
  group: 'maps_lua',
  target: 'lua_in_zig',
  status: 'complete',
  currentOwner: 'a030 (self-contained)',
  applies: _a030_applies,
  emit: _a030_emit,
};
