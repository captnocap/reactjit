// Atom 20: Lua map rebuild emission — emitLuaRebuildList
// Extracted from emit/lua_maps.js lines 635-676
// Depends on: emitLuaElement (atom 17)

function emitLuaRebuildList(mapIdx, c, itemParam, wrapperTag) {
  // c is positioned at the first child of the map body (after the arrow)
  // Walk the JSX and emit Lua
  _luaEmitIter = 0; // reset iteration counter per map

  // Skip optional ( wrapper
  if (c.kind() === TK.lparen) c.advance();

  var bodyLua = emitLuaElement(c, itemParam, '      ');

  // Skip optional ) and ))
  while (c.kind() === TK.rparen) c.advance();

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
  fn += '    tmpl[#tmpl + 1] = ' + bodyLua + '\n';
  fn += '  end\n';
  fn += '  __declareChildren(wrapper, tmpl)\n';
  fn += 'end\n';
  fn += '\n';
  fn += '-- Nested map helper\n';
  fn += 'function __luaNestedMap(arr, fn)\n';
  fn += '  if not arr then return nil end\n';
  fn += '  local result = {}\n';
  fn += '  for _, v in ipairs(arr) do\n';
  fn += '    result[#result + 1] = fn(v)\n';
  fn += '  end\n';
  fn += '  return { children = result }\n';
  fn += 'end\n';

  return fn;
}
