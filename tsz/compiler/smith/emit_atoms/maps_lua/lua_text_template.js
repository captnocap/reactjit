// ── Lua text emit: Template literals ─────────────────────────────
// Template literal emission: `${expr}` interpolation in strings.
// Consumes pattern-normalized contract; emits Lua concat expressions.
// Dependencies: _jsExprToLua from lua_map_subs.js, _luaTextValueExpr from lua_text_value.js

// Contract: { parts: [{literal: "..."}, {expr: "..."}, ...] }
function _luaTextTemplateParts(parts, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!parts || parts.length === 0) return '""';

  var luaParts = [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.literal) {
      if (part.literal.length > 0) luaParts.push(luaStringLiteral(part.literal));
    } else if (part.expr) {
      luaParts.push('tostring(' + _luaTextValueExpr(part.expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) + ')');
    }
  }

  if (luaParts.length === 0) return '""';
  if (luaParts.length === 1) return luaParts[0];
  return luaParts.join(' .. ');
}

// String input: "prefix${expr}suffix" parsed for ${...} interpolations
function _luaTextTemplateString(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!text || text.indexOf('${') < 0) {
    return _luaTextPlain(text);
  }

  var parts = [];
  var i = 0;
  while (i < text.length) {
    if (text[i] === '$' && i + 1 < text.length && text[i + 1] === '{') {
      // Found interpolation start
      var j = i + 2;
      var depth = 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        if (text[j] === '}') depth--;
        j++;
      }
      var expr = text.slice(i + 2, j - 1).trim();
      var luaExpr = _luaTextValueExpr(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
      parts.push('tostring(' + luaExpr + ')');
      i = j;
    } else {
      // Collect literal segment
      var start = i;
      while (i < text.length && !(text[i] === '$' && i + 1 < text.length && text[i + 1] === '{')) {
        i++;
      }
      var lit = text.slice(start, i);
      if (lit.length > 0) parts.push(luaStringLiteral(lit));
    }
  }

  if (parts.length === 0) return '""';
  if (parts.length === 1) return parts[0];
  return parts.join(' .. ');
}
