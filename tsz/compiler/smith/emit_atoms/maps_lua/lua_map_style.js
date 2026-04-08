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
  // Color.rgba(255, 255, 255, 64) → 0xffffff (alpha dropped — Lua nodes don't carry alpha yet)
  var m = val.match(/^Color\.rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+)?\)$/);
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

function _styleToLua(style, itemParam, indexParam, _luaIdxExpr) {
  if (!style) return null;
  var parts = [];
  for (var key in style) {
    var val = style[key];
    // Strip Zig enum prefix: .hidden → hidden, .center → center
    if (typeof val === 'string' && val.charAt(0) === '.') val = val.slice(1);
    var luaKey = key; // already snake_case from buildNode

    // Overflow: pass through for ScrollView/auto-overflow
    // readLuaStyle handles scroll/hidden/auto

    // Color{} placeholder → 0x000000
    if (typeof val === 'string' && val === 'Color{}') val = '0x000000';

    // JS ternary in style: cond ? valA : valB → (cond) and valA or valB
    if (typeof val === 'string' && val.indexOf('?') >= 0 && val.indexOf(':') >= 0) {
      var _tParts = val.match(/^(.+?)\s*\?\s*(.+?)\s*:\s*(.+)$/);
      if (_tParts) {
        var _tCond = _tParts[1].replace(/===/g, '==').replace(/!==/g, '~=');
        var _tTrue = _tParts[2].charAt(0) === '#' ? _hexToLua(_tParts[2].replace(/"/g, '')) : _tParts[2].replace(/"/g, '');
        var _tFalse = _tParts[3].charAt(0) === '#' ? _hexToLua(_tParts[3].replace(/"/g, '')) : _tParts[3].replace(/"/g, '');
        if (typeof _tTrue === 'string' && _tTrue.charAt(0) === '#') _tTrue = _hexToLua(_tTrue);
        if (typeof _tFalse === 'string' && _tFalse.charAt(0) === '#') _tFalse = _hexToLua(_tFalse);
        parts.push(luaKey + ' = (' + _tCond + ') and ' + _tTrue + ' or ' + _tFalse);
        continue;
      }
    }

    // Zig if/else or any complex expression → __eval() escape hatch
    if (typeof val === 'string' && (val.indexOf('if ') === 0 || val.indexOf('if(') === 0 || val.indexOf('@as(') >= 0 || val.indexOf('@intCast') >= 0 || val.indexOf('state.getSlot') >= 0 || val.indexOf('Color.rgb') >= 0 || val.indexOf(' and ') >= 0)) {
      var _jsExpr = val;
      // 1. Color.rgb/rgba → 0xRRGGBB FIRST (before paren stripping mangles them)
      _jsExpr = _jsExpr.replace(/Color\.rgba\((\d+),\s*(\d+),\s*(\d+),\s*\d+\)/g, function(_, r, g, b) {
        return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
      });
      _jsExpr = _jsExpr.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
        return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
      });
      // 2a. Index cast → 0-based Lua index (must run before generic @as stripping
      //     so _i doesn't leak as a raw 1-based variable into comparisons)
      _jsExpr = _jsExpr.replace(/@as\(i64,\s*@intCast\((_\w+)\)\)/g, function(_, v) {
        return '(' + v + ' - 1)';
      });
      // 2. @as wrappers — balanced paren strip
      for (var _ai = 0; _ai < 5; _ai++) {
        var _asPos = _jsExpr.indexOf('@as(');
        if (_asPos < 0) { _asPos = _jsExpr.indexOf('@intCast('); }
        if (_asPos < 0) { _asPos = _jsExpr.indexOf('@floatFromInt('); }
        if (_asPos < 0) break;
        var _fnEnd = _jsExpr.indexOf('(', _asPos);
        var _ad = 1, _aIdx = _fnEnd + 1, _commaPos = -1;
        while (_aIdx < _jsExpr.length && _ad > 0) {
          if (_jsExpr[_aIdx] === '(') _ad++;
          if (_jsExpr[_aIdx] === ')') { _ad--; if (_ad === 0) break; }
          if (_ad === 1 && _commaPos < 0 && _jsExpr[_aIdx] === ',') _commaPos = _aIdx;
          _aIdx++;
        }
        if (_ad === 0) {
          // @as(TYPE, VAL) → VAL, @intCast(VAL) → VAL
          var _stripVal = _commaPos >= 0
            ? _jsExpr.substring(_commaPos + 1, _aIdx).trim()
            : _jsExpr.substring(_fnEnd + 1, _aIdx).trim();
          _jsExpr = _jsExpr.substring(0, _asPos) + _stripVal + _jsExpr.substring(_aIdx + 1);
        } else break;
      }
      _jsExpr = _jsExpr.replace(/@intCast\(/g, '(').replace(/@floatFromInt\(/g, '(');
      // 2b. JS logical operators → Lua
      _jsExpr = _jsExpr.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
      _jsExpr = _jsExpr.replace(/===/g, '==').replace(/!==/g, '~=');
      // 3. State slot refs → getter names
      _jsExpr = _jsExpr.replace(/state\.getSlot(?:Int|Float|Bool|String)?\((\d+)\)/g, function(_, idx) {
        return (ctx && ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
      });
      // 4. OA refs → _item.field
      _jsExpr = _jsExpr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
      _jsExpr = _jsExpr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
      // 4b. std.mem.eql → Lua string compare
      _jsExpr = _jsExpr.replace(/!std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 ~= $2)');
      _jsExpr = _jsExpr.replace(/std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 == $2)');
      // 5. Zig if/else → Lua (cond) and val or val
      // Handles chained: if (a) X else if (b) Y else Z
      // → (a) and X or (b) and Y or Z
      // Iterate: find each "if (" with balanced parens, convert to "(cond) and val or"
      for (var _ifIter = 0; _ifIter < 10; _ifIter++) {
        var _ifPos = _jsExpr.indexOf('if (');
        if (_ifPos < 0) break;
        // Find balanced close paren
        var _depth = 0, _ci = _ifPos + 3;
        for (; _ci < _jsExpr.length; _ci++) {
          if (_jsExpr[_ci] === '(') _depth++;
          if (_jsExpr[_ci] === ')') { _depth--; if (_depth === 0) break; }
        }
        if (_depth !== 0) break;
        var _cond = _jsExpr.substring(_ifPos + 4, _ci);
        var _after = _jsExpr.substring(_ci + 1).trim();
        // Find " else " — the true value is between ) and else
        var _elseIdx = _after.indexOf(' else ');
        if (_elseIdx < 0) break;
        var _trueVal = _after.substring(0, _elseIdx).trim();
        var _prefix = _jsExpr.substring(0, _ifPos);
        var _suffix = _after.substring(_elseIdx + 6).trim();
        _jsExpr = _prefix + '(' + _cond + ') and ' + _trueVal + ' or ' + _suffix;
      }
      // 6. Color.rgb with bit-shift extraction → _item.field
      if (_jsExpr.indexOf('Color.rgb(') >= 0 && _jsExpr.indexOf('_item.') >= 0 && _jsExpr.indexOf('>> 16') >= 0) {
        var _colorFieldMatch = _jsExpr.match(/_item\.(\w+)/);
        if (_colorFieldMatch) _jsExpr = '_item.' + _colorFieldMatch[1];
      }
      // 7. Clean orphan closing parens
      var _eo = (_jsExpr.match(/\(/g) || []).length;
      var _ec = (_jsExpr.match(/\)/g) || []).length;
      while (_ec > _eo && _jsExpr.endsWith(')')) { _jsExpr = _jsExpr.slice(0, -1); _ec--; }
      // 8. Emit — check if result is valid Lua
      if (/^[a-zA-Z_][\w.]*$/.test(_jsExpr) || /^_item\.\w+$/.test(_jsExpr)) {
        parts.push(luaKey + ' = ' + _jsExpr);
      } else if (/^[\w._\s+\-*/%()]+$/.test(_jsExpr) && !/[?:]/.test(_jsExpr) && !/\bif\b/.test(_jsExpr)) {
        parts.push(luaKey + ' = ' + _jsExpr);
      } else if (/\band\b/.test(_jsExpr) && !/[?:]/.test(_jsExpr) && !/\bif\b/.test(_jsExpr)) {
        parts.push(luaKey + ' = ' + _jsExpr);
      } else {
        parts.push(luaKey + ' = __eval("' + _jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")');
      }
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

    // String keyword BEFORE dynamic item ref check — prevents "row" item param collision
    var _enumPattern = /^(center|row|column|start|end|stretch|baseline|wrap|nowrap|hidden|scroll|auto|none|flex|absolute|relative|spaceBetween|spaceAround|space_between|space_around|flex_start|flex_end|row_reverse|column_reverse|space_evenly)$/;
    if (typeof val === 'string' && _enumPattern.test(val)) {
      parts.push(luaKey + ' = "' + val + '"');
      continue;
    }

    // Dynamic item reference
    if (typeof val === 'string' && itemParam && val.indexOf(itemParam) >= 0) {
      parts.push(luaKey + ' = ' + _jsExprToLua(val, itemParam, indexParam, _luaIdxExpr));
      continue;
    }
    if (typeof val === 'string' && indexParam && val.indexOf(indexParam) >= 0) {
      parts.push(luaKey + ' = ' + _jsExprToLua(val, itemParam, indexParam, _luaIdxExpr));
      continue;
    }

    // Bare variable reference (state getter resolved by buildNode)
    if (typeof val === 'string' && /^[a-zA-Z_]\w*$/.test(val)) {
      parts.push(luaKey + ' = ' + val);
      continue;
    }

    // String fallback
    if (typeof val === 'string') {
      parts.push(luaKey + ' = "' + val + '"');
      continue;
    }
  }
  // Post-process: quote any bare enum values that slipped through
  var result = '{ ' + parts.join(', ') + ' }';
  result = result.replace(/= (center|row|column|row_reverse|column_reverse|flex_start|flex_end|space_between|space_around|space_evenly|stretch|baseline|wrap|nowrap|hidden|visible|scroll|auto|absolute|relative|none)([,} ])/g, '= "$1"$2');
  return result;
}
