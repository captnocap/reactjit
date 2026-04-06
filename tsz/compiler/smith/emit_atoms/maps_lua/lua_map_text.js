// ── Lua map text emit ───────────────────────────────────────────
// Turns text content into a Lua string expression.
// Uses _jsExprToLua from lua_map_subs.js.

function _textToLua(text, itemParam, indexParam) {
  if (!text) return '""';

  // Field reference: { field: "title" } → tostring(_item.title)
  if (typeof text === 'object' && text.field) {
    return 'tostring(_item.' + text.field + ')';
  }

  // State variable: { stateVar: "count" } → tostring(count)
  if (typeof text === 'object' && text.stateVar) {
    return 'tostring(' + text.stateVar + ')';
  }

  // Template literal: { parts: [{literal: "hi "}, {expr: "item.x"}] }
  if (typeof text === 'object' && text.parts) {
    var luaParts = [];
    for (var i = 0; i < text.parts.length; i++) {
      var part = text.parts[i];
      if (part.literal) {
        luaParts.push('"' + part.literal.replace(/"/g, '\\"') + '"');
      } else if (part.expr) {
        luaParts.push('tostring(' + _jsExprToLua(part.expr, itemParam, indexParam) + ')');
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
        tExpr = _jsExprToLua(tExpr, itemParam, indexParam);
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

  // Plain string with no dynamic refs
  if (typeof text === 'string' && text.indexOf(itemParam) < 0 && (!indexParam || text.indexOf(indexParam) < 0)) {
    return '"' + text.replace(/"/g, '\\"') + '"';
  }

  // Expression string with dynamic refs
  var luaExpr = _jsExprToLua(String(text), itemParam, indexParam);
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
