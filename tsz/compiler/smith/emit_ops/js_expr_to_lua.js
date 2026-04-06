// Atom 18: JS expression → Lua equivalent
// Extracted from emit/lua_maps.js lines 16-51
// Depends on: _luaColorOrPassthrough (atom 19, passed via caller or global)

function _jsExprToLua(expr, itemParam, indexParam) {
  // Replace item param references
  expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
  // Replace index param references (Lua _i is 1-based, .tsz idx is 0-based)
  if (indexParam) expr = expr.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), '(_i - 1)');
  // Convert === to ==, !== to ~=
  expr = expr.replace(/===/g, '==').replace(/!==/g, '~=');
  // Handle ternary: cond ? trueVal : falseVal
  var qIdx = expr.indexOf(' ? ');
  if (qIdx >= 0) {
    var cond = expr.slice(0, qIdx).trim();
    var rest = expr.slice(qIdx + 3);
    // Find the matching : (handle nested ternaries by tracking ? depth)
    var depth = 0;
    var cIdx = -1;
    for (var ci = 0; ci < rest.length; ci++) {
      if (rest[ci] === '?' && rest[ci + 1] === ' ') depth++;
      else if (rest[ci] === ':' && rest[ci - 1] === ' ' && rest[ci + 1] === ' ') {
        if (depth === 0) { cIdx = ci; break; }
        depth--;
      }
    }
    if (cIdx >= 0) {
      var trueVal = rest.slice(0, cIdx).trim();
      var falseVal = rest.slice(cIdx + 1).trim();
      // Recursively convert nested ternaries
      trueVal = _jsExprToLua(trueVal, '_item');
      falseVal = _jsExprToLua(falseVal, '_item');
      // Convert color string literals to hex
      trueVal = _luaColorOrPassthrough(trueVal);
      falseVal = _luaColorOrPassthrough(falseVal);
      return '(' + cond + ') and (' + trueVal + ') or (' + falseVal + ')';
    }
  }
  return _luaColorOrPassthrough(expr);
}
