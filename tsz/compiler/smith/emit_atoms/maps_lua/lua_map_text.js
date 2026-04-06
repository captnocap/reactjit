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
  if (luaExpr.indexOf('_item') >= 0 || luaExpr.indexOf('(_i - 1)') >= 0) {
    return 'tostring(' + luaExpr + ')';
  }
  return '"' + luaExpr.replace(/"/g, '\\"') + '"';
}
