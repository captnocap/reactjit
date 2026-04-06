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

function _zigOaToLuaItem(val) {
  // Color.rgb(@intCast((_oa0_labelBg[_i] >> 16) & 0xFF), ...) → _item.labelBg
  var m = val.match(/_oa\d+_(\w+)\[_i\]/);
  if (m) return '_item.' + m[1];
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

    // Zig if/else ternary → Lua (cond) and val or val
    if (typeof val === 'string' && val.indexOf('if ') === 0) {
      var _ifm = val.match(/^if\s+(.+?)\s+(@as\([^)]+,\s*)?(\S+)\)?\s+else\s+(@as\([^)]+,\s*)?(\S+)\)?$/);
      if (_ifm) {
        var _cond = _ifm[1].replace(/\(([^)]+)\)/, '$1');
        // Convert Zig cond syntax: OA refs → _item.field, slotGet → var name
        _cond = _cond.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
        _cond = _cond.replace(/state\.getSlotInt\(\d+\)/g, function(m) { return m; }); // TODO: resolve
        var _tv = _ifm[3];
        var _fv = _ifm[5];
        // Convert Color values
        var _tvc = _zigColorToLuaHex(_tv);
        var _fvc = _zigColorToLuaHex(_fv);
        parts.push(luaKey + ' = (' + _cond + ') and ' + (_tvc || _tv) + ' or ' + (_fvc || _fv));
        continue;
      }
      // Fallback: run luaTransform on the whole expression
      if (typeof luaTransform === 'function') {
        var _ltVal = luaTransform(val.replace(/^if\s+/, '').replace(/@as\([^)]+,\s*/g, '').replace(/\)\s*$/g, ''));
        parts.push(luaKey + ' = ' + _ltVal);
        continue;
      }
    }

    // Zig OA field reference → _item.field
    var oaItem = _zigOaToLuaItem(val);
    if (oaItem) {
      parts.push(luaKey + ' = ' + oaItem);
      continue;
    }

    // Color.rgb() → hex
    var colorHex = _zigColorToLuaHex(val);
    if (colorHex) {
      parts.push(luaKey + ' = ' + colorHex);
      continue;
    }

    // -1 = 100% (Zig encoding for percentage — keep as -1 for readLuaStyle)
    if (val === '-1' || val === -1) {
      parts.push(luaKey + ' = -1');
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
