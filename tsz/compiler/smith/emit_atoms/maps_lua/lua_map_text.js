// ── Lua map text emit ───────────────────────────────────────────
// Turns text content into a Lua string expression.
// Uses _jsExprToLua from lua_map_subs.js.

function _textToLua(text, itemParam, indexParam, _luaIdxExpr) {
  if (!text) return '""';

  // Normalize pre-escaped quotes from parser (prevents double-escaping: \" → \\")
  if (typeof text === 'string') text = text.replace(/\\"/g, '"');

  // Field reference: { field: "title" } → tostring(_item.title)
  if (typeof text === 'object' && text.field) {
    return 'tostring(_item.' + text.field + ')';
  }

  // State variable: { stateVar: "count" } → tostring(count)
  if (typeof text === 'object' && text.stateVar) {
    var _sv = text.stateVar;
    // Resolve component props — bare prop names need _item.field substitution
    _sv = _jsExprToLua(_sv, itemParam, indexParam, _luaIdxExpr);
    // If stateVar still has Zig syntax, clean it up
    if (/@|state\.getSlot|\bif\b/.test(_sv)) {
      // Color.rgb → 0xHEX
      _sv = _sv.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
        return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
      });
      // Strip Zig @as wrappers — handle []const u8 type parameter
      for (var _i = 0; _i < 5; _i++) {
        _sv = _sv.replace(/@as\(\[\]const u8,\s*("[^"]*")\)/g, '$1');
        _sv = _sv.replace(/@as\(\w+,\s*([^)]+)\)/g, '$1');
        _sv = _sv.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
        _sv = _sv.replace(/@intCast\(([^)]+)\)/g, '$1');
        _sv = _sv.replace(/@divTrunc\(([^,]+),\s*([^)]+)\)/g, 'math.floor($1 / $2)');
        _sv = _sv.replace(/@mod\(([^,]+),\s*([^)]+)\)/g, '($1 % $2)');
      }
      // JS operators → Lua
      _sv = _sv.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
      _sv = _sv.replace(/===/g, '==').replace(/!==/g, '~=');
      // State slots → getter names
      _sv = _sv.replace(/state\.getSlot(?:Int|Float|Bool|String)?\((\d+)\)/g, function(_, idx) {
        return (typeof ctx !== 'undefined' && ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
      });
      // OA refs → _item.field
      _sv = _sv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
      _sv = _sv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
      // qjs_runtime.evalToString → bare expression
      _sv = _sv.replace(/qjs_runtime\.evalToString\("String\(([^)]+)\)"[^)]*\)/g, '$1');
      _sv = _sv.replace(/&_eval_buf_\d+/g, '');
      // Iterative if/else → and/or (balanced parens, handles chaining)
      for (var _ifIter = 0; _ifIter < 10; _ifIter++) {
        var _ifPos = _sv.indexOf('if (');
        if (_ifPos < 0) break;
        var _depth = 0, _ci = _ifPos + 3;
        for (; _ci < _sv.length; _ci++) {
          if (_sv[_ci] === '(') _depth++;
          if (_sv[_ci] === ')') { _depth--; if (_depth === 0) break; }
        }
        if (_depth !== 0) break;
        var _cond = _sv.substring(_ifPos + 4, _ci);
        var _after = _sv.substring(_ci + 1).trim();
        var _elseIdx = _after.indexOf(' else ');
        if (_elseIdx < 0) break;
        var _trueVal = _after.substring(0, _elseIdx).trim();
        var _prefix = _sv.substring(0, _ifPos);
        var _suffix = _after.substring(_elseIdx + 6).trim();
        _sv = _prefix + '(' + _cond + ') and ' + _trueVal + ' or ' + _suffix;
      }
      // Clean orphan parens
      var _open = (_sv.match(/\(/g) || []).length;
      var _close = (_sv.match(/\)/g) || []).length;
      while (_close > _open && _sv.endsWith(')')) { _sv = _sv.slice(0, -1); _close--; }
      // If clean Lua now (no Zig syntax left), emit bare
      if (!/[@?]/.test(_sv) && !/\bif\b/.test(_sv) && !/qjs_runtime/.test(_sv)) {
        return 'tostring(' + _sv + ')';
      }
      return 'tostring(__eval("' + _sv.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"))';
    }
    return 'tostring(' + _sv + ')';
  }

  // Lua expression: { luaExpr: "(mode == 0) and \"A\" or \"B\"" }
  if (typeof text === 'object' && text.luaExpr) {
    return text.luaExpr;
  }

  // Template literal: { parts: [{literal: "hi "}, {expr: "item.x"}] }
  if (typeof text === 'object' && text.parts) {
    var luaParts = [];
    for (var i = 0; i < text.parts.length; i++) {
      var part = text.parts[i];
      if (part.literal) {
        luaParts.push('"' + part.literal.replace(/"/g, '\\"') + '"');
      } else if (part.expr) {
        luaParts.push('tostring(' + _jsExprToLua(part.expr, itemParam, indexParam, _luaIdxExpr) + ')');
      }
    }
    return luaParts.join(' .. ');
  }

  // Template literal string containing ${...} interpolation
  if (typeof text === 'string' && text.indexOf('${') >= 0) {
    var tParts = [];
    var ti = 0;
    while (ti < text.length) {
      if (text[ti] === '$' && ti + 1 < text.length && text[ti + 1] === '{') {
        var tj = ti + 2;
        var tDepth = 1;
        while (tj < text.length && tDepth > 0) {
          if (text[tj] === '{') tDepth++;
          if (text[tj] === '}') tDepth--;
          tj++;
        }
        var tExpr = text.slice(ti + 2, tj - 1).trim();
        tExpr = _jsExprToLua(tExpr, itemParam, indexParam, _luaIdxExpr);
        tParts.push('tostring(' + tExpr + ')');
        ti = tj;
      } else {
        var tStart = ti;
        while (ti < text.length && !(text[ti] === '$' && ti + 1 < text.length && text[ti + 1] === '{')) ti++;
        var tLit = text.slice(tStart, ti).replace(/"/g, '\\"');
        if (tLit.length > 0) tParts.push('"' + tLit + '"');
      }
    }
    return tParts.join(' .. ');
  }

  // "label: expr" pattern — template literal was unwrapped, label text + expression mashed together
  // e.g. "id: _item.children[subMapIndex].id" → "id: " .. tostring(__eval("_item.children[subMapIndex].id"))
  if (typeof text === 'string' && /^\w+:\s+/.test(text) && (text.indexOf('_item') >= 0 || text.indexOf('[') >= 0 || text.indexOf('.') >= 0)) {
    var _colonIdx = text.indexOf(': ');
    var _label = text.slice(0, _colonIdx + 2);
    var _expr = text.slice(_colonIdx + 2).trim();
    // Clean up Zig artifacts
    _expr = _expr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
    _expr = _expr.replace(/\.length\b/g, '.length');
    // If expr has brackets or dots, use __eval for safety
    if (/[\[\].]/.test(_expr)) {
      return '"' + _label + '" .. tostring(__eval("' + _expr.replace(/"/g, '\\"') + '"))';
    }
    return '"' + _label + '" .. tostring(' + _expr + ')';
  }

  // Plain string with no dynamic refs
  if (typeof text === 'string' && text.indexOf(itemParam) < 0 && (!indexParam || text.indexOf(indexParam) < 0)) {
    return '"' + text.replace(/"/g, '\\"') + '"';
  }

  // Expression string with dynamic refs
  var luaExpr = _jsExprToLua(String(text), itemParam, indexParam, _luaIdxExpr);
  // Simple cleanups
  luaExpr = luaExpr.replace(/(\w+(?:\.\w+)*)\.length\b/g, '#$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  // If still has Zig/JS syntax or broken expressions → __eval with original source
  if (/@|state\.get|getSlot|\bconst\b|\blet\b|=>/.test(luaExpr) ||
      /\)\s+\w/.test(luaExpr) || /\w+\s+\w+/.test(luaExpr.replace(/\band\b|\bor\b|\bnot\b|\btostring\b/g, '').trim())) {
    // Use tostring(__eval("expr")) for safe conversion
    var _jsText = String(text);
    _jsText = _jsText.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
    _jsText = _jsText.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
    _jsText = _jsText.replace(/@as\([^,]+,\s*/g, '').replace(/@intCast\(/g, '(');
    return 'tostring(__eval("' + _jsText.replace(/\\/g, '\\\\').replace(/"/g, '\\"').trim() + '"))';
  }
  luaExpr = luaExpr.trim();
  if (luaExpr.indexOf('_item') >= 0 || luaExpr.indexOf('(_i - 1)') >= 0 ||
      luaExpr.indexOf('#') >= 0 || luaExpr.indexOf('(') >= 0) {
    return 'tostring(' + luaExpr + ')';
  }
  return '"' + luaExpr.replace(/"/g, '\\"') + '"';
}
