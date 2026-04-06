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

    // Overflow: pass through for ScrollView/auto-overflow
    // readLuaStyle handles scroll/hidden/auto

    // Zig if/else or any complex expression → __eval() escape hatch
    // If the value contains Zig syntax, it came from a ternary or complex expression.
    // Store the original .tsz expression on the style field (via _luaRawExpr) and __eval it.
    // For now: detect Zig patterns and use __eval with a cleaned-up version.
    if (typeof val === 'string' && (val.indexOf('if ') === 0 || val.indexOf('@as(') >= 0 || val.indexOf('@intCast') >= 0 || val.indexOf('state.getSlot') >= 0)) {
      // Try to extract a clean JS expression from the Zig
      var _jsExpr = val;
      _jsExpr = _jsExpr.replace(/^if\s+\((.+?)\)\s+/, '$1 ? ');
      _jsExpr = _jsExpr.replace(/\s+else\s+/, ' : ');
      _jsExpr = _jsExpr.replace(/@as\([^,]+,\s*/g, '');
      _jsExpr = _jsExpr.replace(/@intCast\(/g, '(');
      _jsExpr = _jsExpr.replace(/\)\s*$/g, '');
      // OA refs → item field access
      _jsExpr = _jsExpr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
      // Color.rgb(R,G,B) → 0xRRGGBB (QJS doesn't know Color.rgb)
      _jsExpr = _jsExpr.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
        return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
      });
      // State slot refs → getter names
      _jsExpr = _jsExpr.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
        return (ctx && ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
      });
      parts.push(luaKey + ' = __eval("' + _jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")');
      continue;
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

    // Bare variable reference (state getter resolved by buildNode)
    // A single identifier like "barWidth" should be emitted bare, not quoted
    if (typeof val === 'string' && /^[a-zA-Z_]\w*$/.test(val) && !/^(center|row|column|start|end|stretch|baseline|wrap|hidden|scroll|auto|none|flex|absolute|relative|spaceBetween|spaceAround|space_between|space_around|flex_start|flex_end)$/.test(val)) {
      parts.push(luaKey + ' = ' + val);
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
