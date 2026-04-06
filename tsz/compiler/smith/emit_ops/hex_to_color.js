// Atom 19: Color conversion — hexToLuaColor + _luaColorOrPassthrough
// Extracted from emit/lua_maps.js lines 8-57

function hexToLuaColor(hex) {
  // "#58a6ff" → 0x58a6ff
  if (hex.charAt(0) === '#') return '0x' + hex.slice(1);
  return '0x000000';
}

function _luaColorOrPassthrough(val) {
  // '#rrggbb' or "#rrggbb" → 0xrrggbb
  var m = val.match(/^['"]#([0-9a-fA-F]{3,8})['"]$/);
  if (m) return '0x' + m[1];
  return val;
}
