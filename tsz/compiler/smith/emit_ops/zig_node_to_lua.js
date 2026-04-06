// Atom 21: Convert Zig node expression to Lua — _zigNodeExprToLua + _nodeResultToLuaRebuilder
// Extracted from emit/lua_maps.js lines 684-734

function _zigNodeExprToLua(nodeExpr) {
  if (!nodeExpr || typeof nodeExpr !== 'string') return '{}';
  // Convert Zig struct literal to Lua table:
  // .{ .field = value, ... } → { field = value, ... }
  var lua = nodeExpr;
  // Strip leading .{ and trailing }
  lua = lua.replace(/^\.{\s*/, '{ ').replace(/\s*}$/, ' }');
  // .field = → field =
  lua = lua.replace(/\.(\w+)\s*=/g, '$1 =');
  // .{ → { (nested structs)
  lua = lua.replace(/\.\{/g, '{');
  // .enum_value → "enum_value" (Zig enum → Lua string)
  lua = lua.replace(/=\s*\.(\w+)/g, '= "$1"');
  // Color.rgb(r,g,b) → simplified hex (or pass through)
  lua = lua.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
    return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
  });
  // &_arr_N references → nil (array refs don't translate to Lua)
  lua = lua.replace(/&_arr_\d+/g, 'nil');
  // OA field refs: _oaN_field[_i][0.._oaN_field_lens[_i]] → _item.field
  lua = lua.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, 'tostring(_item.$1)');
  lua = lua.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  // std.fmt.bufPrint refs → tostring(_item.field)
  lua = lua.replace(/std\.fmt\.bufPrint\([^)]+\)/g, '"..."');
  // Clean up: children = nil → remove
  lua = lua.replace(/,?\s*children\s*=\s*nil/g, '');
  return lua;
}

function _nodeResultToLuaRebuilder(mapIdx, nodeResult, oa) {
  // templateNodeExpr has the actual parsed JSX template — nodeExpr is always '.{}'
  // because finalizeMapNode stubs the wrapper node. Use the real template.
  var templateLua = _zigNodeExprToLua(nodeResult.templateNodeExpr || nodeResult.nodeExpr || '.{}');
  var fn = '';
  fn += 'function __rebuildLuaMap' + mapIdx + '()\n';
  fn += '  __clearLuaNodes()\n';
  fn += '  local wrapper = __mw' + mapIdx + '\n';
  fn += '  if not wrapper then return end\n';
  fn += '  local items = __luaMapData' + mapIdx + '\n';
  fn += '  if not items or #items == 0 then\n';
  fn += '    __declareChildren(wrapper, {})\n';
  fn += '    return\n';
  fn += '  end\n';
  fn += '  local tmpl = {}\n';
  fn += '  for _i, _item in ipairs(items) do\n';
  fn += '    tmpl[#tmpl + 1] = ' + templateLua + '\n';
  fn += '  end\n';
  fn += '  __declareChildren(wrapper, tmpl)\n';
  fn += 'end\n';
  return fn;
}
