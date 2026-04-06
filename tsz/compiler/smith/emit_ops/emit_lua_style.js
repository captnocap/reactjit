// Atom 22: Lua style emission — emitLuaStyle
// Extracted from emit/lua_maps.js lines 60-139
// Depends on: hexToLuaColor (atom 19), _jsExprToLua (atom 18)

function emitLuaStyle(c, itemParam) {
  // Cursor is at {{ — skip to inner object, collect key:value pairs
  var parts = [];
  if (c.kind() !== TK.lbrace) return '{}';
  c.advance(); // skip outer {
  if (c.kind() !== TK.lbrace) return '{}';
  c.advance(); // skip inner {
  var _styleLastPos = -1;
  while (c.pos < c.count) {
    if (c.pos === _styleLastPos) { c.advance(); continue; }
    _styleLastPos = c.pos;
    if (c.kind() === TK.rbrace) { c.advance(); break; }
    if (c.kind() === TK.comma) { c.advance(); continue; }
    if (c.kind() === TK.identifier) {
      var key = c.text();
      c.advance();
      if (c.kind() === TK.colon) c.advance();
      // Map camelCase to snake_case for Zig Node.Style fields
      var zigKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      // Value
      if (c.kind() === TK.number) {
        parts.push(zigKey + ' = ' + c.text());
        c.advance();
      } else if (c.kind() === TK.string) {
        var sv = c.text().slice(1, -1);
        if (sv.charAt(0) === '#') {
          parts.push(zigKey + ' = ' + hexToLuaColor(sv));
        } else if (sv === 'row') {
          parts.push(zigKey + ' = "row"');
        } else if (sv === 'none') {
          parts.push(zigKey + ' = "none"');
        } else if (sv.endsWith('%')) {
          // percentage — skip for now
        } else {
          parts.push(zigKey + ' = "' + sv + '"');
        }
        c.advance();
      } else if (c.kind() === TK.lbrace) {
        // Dynamic value: { item.field } or { expr }
        c.advance();
        var exprParts = [];
        var depth = 0;
        while (c.pos < c.count && !(c.kind() === TK.rbrace && depth === 0)) {
          if (c.kind() === TK.lbrace) depth++;
          if (c.kind() === TK.rbrace) depth--;
          exprParts.push(c.text());
          c.advance();
        }
        if (c.kind() === TK.rbrace) c.advance();
        var expr = exprParts.join(' ');
        // Convert JS expressions (ternaries, comparisons, colors) to Lua
        expr = _jsExprToLua(expr, itemParam);
        parts.push(zigKey + ' = ' + expr);
      } else if (c.kind() === TK.identifier) {
        // Bare expression value: ident ? trueVal : falseVal (ternary), or ident
        // Track both paren/brace depth AND ternary depth (? increments, : decrements)
        // so chained ternaries like a ? b : c ? d : e don't stop at the first :
        var exprParts = [];
        var depth = 0;
        var ternDepth = 0;
        while (c.pos < c.count) {
          if (depth === 0 && ternDepth === 0 && (c.kind() === TK.comma || c.kind() === TK.rbrace)) break;
          if (c.kind() === TK.lparen || c.kind() === TK.lbrace || c.kind() === TK.lbracket) depth++;
          if (c.kind() === TK.rparen || c.kind() === TK.rbrace || c.kind() === TK.rbracket) depth--;
          if (depth === 0 && c.kind() === TK.question) ternDepth++;
          if (depth === 0 && c.kind() === TK.colon && ternDepth > 0) ternDepth--;
          exprParts.push(c.text());
          c.advance();
        }
        var expr = exprParts.join(' ');
        expr = _jsExprToLua(expr, itemParam);
        parts.push(zigKey + ' = ' + expr);
      }
    } else {
      c.advance();
    }
  }
  if (c.kind() === TK.rbrace) c.advance(); // skip outer }
  return '{ ' + parts.join(', ') + ' }';
}
