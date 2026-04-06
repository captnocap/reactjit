// Atom 23: Lua text content emission — emitLuaTextContent
// Extracted from emit/lua_maps.js lines 141-206

function emitLuaTextContent(c, itemParam) {
  // Collect text content until closing tag
  // Handles: plain text, {item.field}, {`template ${item.field}`}
  var parts = [];
  var _tcLastPos = -1;
  while (c.pos < c.count) {
    if (c.pos === _tcLastPos) { c.advance(); continue; }
    _tcLastPos = c.pos;
    if (c.kind() === TK.lt || c.kind() === TK.lt_slash) break; // closing tag
    if (c.kind() === TK.lbrace) {
      c.advance();
      if (c.kind() === TK.template_literal) {
        var raw = c.text().slice(1, -1);
        // Convert template literal to Lua concatenation
        var luaParts = [];
        var i = 0;
        while (i < raw.length) {
          if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
            var j = i + 2;
            var depth = 1;
            while (j < raw.length && depth > 0) {
              if (raw[j] === '{') depth++;
              if (raw[j] === '}') depth--;
              j++;
            }
            var expr = raw.slice(i + 2, j - 1).trim();
            expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
            luaParts.push('tostring(' + expr + ')');
            i = j;
          } else {
            var start = i;
            while (i < raw.length && !(raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{')) i++;
            var literal = raw.slice(start, i).replace(/"/g, '\\"');
            if (literal.length > 0) luaParts.push('"' + literal + '"');
          }
        }
        parts.push(luaParts.join(' .. '));
        c.advance();
      } else {
        // Brace expression: {item.field}
        var exprParts = [];
        var depth = 0;
        while (c.pos < c.count && !(c.kind() === TK.rbrace && depth === 0)) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          exprParts.push(c.text());
          c.advance();
        }
        var expr = exprParts.join(' ');
        expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
        parts.push('tostring(' + expr + ')');
      }
      if (c.kind() === TK.rbrace) c.advance();
    } else if (c.kind() === TK.string) {
      parts.push('"' + c.text().slice(1, -1) + '"');
      c.advance();
    } else if (c.kind() === TK.identifier || c.kind() === TK.number) {
      parts.push('"' + c.text() + '"');
      c.advance();
    } else {
      c.advance();
    }
  }
  if (parts.length === 0) return '""';
  return parts.join(' .. ');
}
