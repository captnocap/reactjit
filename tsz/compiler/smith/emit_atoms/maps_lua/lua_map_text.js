// ── Lua map text emit ───────────────────────────────────────────
// Turns text content into a Lua string expression.
// Uses _jsExprToLua from lua_map_subs.js.

function _textToLua(text, itemParam, indexParam) {
  if (!text) return '""';

  // Field reference: { field: "title" } → tostring(_item.title)
  if (typeof text === 'object' && text.field) {
    return 'tostring(_item.' + text.field + ')';
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
