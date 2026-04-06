// ── Lua map style emit ──────────────────────────────────────────
// Turns a parsed style object into a Lua table string.
// Uses _hexToLua, _camelToSnake, _jsExprToLua from lua_map_subs.js.

function _styleToLua(style, itemParam, indexParam) {
  if (!style) return null;
  var parts = [];
  for (var key in style) {
    var val = style[key];
    var luaKey = _camelToSnake(key);
    if (typeof val === 'number') {
      parts.push(luaKey + ' = ' + val);
    } else if (typeof val === 'string' && val.charAt(0) === '#') {
      parts.push(luaKey + ' = ' + _hexToLua(val));
    } else if (typeof val === 'string' && /^#[0-9a-fA-F]+$/.test(val)) {
      parts.push(luaKey + ' = ' + _hexToLua(val));
    } else if (typeof val === 'string' && /^[0-9]+$/.test(val)) {
      parts.push(luaKey + ' = ' + val);
    } else if (typeof val === 'string' && (val.indexOf(itemParam) >= 0 || (indexParam && val.indexOf(indexParam) >= 0))) {
      parts.push(luaKey + ' = ' + _jsExprToLua(val, itemParam, indexParam));
    } else if (typeof val === 'string') {
      parts.push(luaKey + ' = "' + val + '"');
    }
  }
  return '{ ' + parts.join(', ') + ' }';
}
