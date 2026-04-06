// ── Lua map style emit ──────────────────────────────────────────
// Turns a parsed style object into a Lua table string.
// Uses _hexToLua, _camelToSnake, _jsExprToLua from lua_map_subs.js.
//
// Style values arrive as Zig strings from buildNode. This function
// converts them back to Lua:
//   Color.rgb(r,g,b) → 0xRRGGBB
//   -1 (percentage) → "100%"
//   .center → "center"
//   numeric → number

function _zigColorToLuaHex(val) {
  // Color.rgb(30, 30, 30) → 0x1e1e1e
  var m = val.match(/^Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (m) {
    var hex = ((+m[1] << 16) | (+m[2] << 8) | +m[3]).toString(16).padStart(6, '0');
    return '0x' + hex;
  }
  // Color{} placeholder → 0x000000
  if (val === 'Color{}') return '0x000000';
  return null;
}

function _styleToLua(style, itemParam, indexParam) {
  if (!style) return null;
  var parts = [];
  for (var key in style) {
    var val = style[key];
    var luaKey = key; // already snake_case from buildNode

    // Skip overflow (Zig-only layout concern)
    if (luaKey === 'overflow') continue;

    // Color.rgb() → hex
    var colorHex = _zigColorToLuaHex(val);
    if (colorHex) {
      parts.push(luaKey + ' = ' + colorHex);
      continue;
    }

    // -1 = 100% (Zig encoding for percentage)
    if (val === '-1' || val === -1) {
      parts.push(luaKey + ' = "100%"');
      continue;
    }

    // Pure number
    if (typeof val === 'number') {
      parts.push(luaKey + ' = ' + val);
      continue;
    }

    // Numeric string
    if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val)) {
      parts.push(luaKey + ' = ' + val);
      continue;
    }

    // Hex color string
    if (typeof val === 'string' && val.charAt(0) === '#') {
      parts.push(luaKey + ' = ' + _hexToLua(val));
      continue;
    }

    // Dynamic item reference
    if (typeof val === 'string' && itemParam && val.indexOf(itemParam) >= 0) {
      parts.push(luaKey + ' = ' + _jsExprToLua(val, itemParam, indexParam));
      continue;
    }
    if (typeof val === 'string' && indexParam && val.indexOf(indexParam) >= 0) {
      parts.push(luaKey + ' = ' + _jsExprToLua(val, itemParam, indexParam));
      continue;
    }

    // String keyword (center, row, flexStart, etc.)
    if (typeof val === 'string') {
      parts.push(luaKey + ' = "' + val + '"');
      continue;
    }
  }
  return '{ ' + parts.join(', ') + ' }';
}
