// Atom 18: JS expression → Lua equivalent
// Extracted from emit/lua_maps.js lines 16-51
// Depends on: _luaColorOrPassthrough (atom 19, passed via caller or global)

// Convert JS bitwise operators to LuaJIT bit library calls.
// Must run AFTER && → and, || → or conversions so remaining &/| are bitwise.
function _bitwiseToLua(s) {
  if (s.indexOf('&') < 0 && s.indexOf('|') < 0 && s.indexOf('^') < 0 &&
      s.indexOf('>>') < 0 && s.indexOf('<<') < 0 && !/~(?!=)\w/.test(s)) return s;
  // Bitwise NOT: ~expr (but not ~= which is Lua not-equal)
  s = s.replace(/~(?!=)(\w+)/g, 'bit.bnot($1)');
  // Iterative: convert innermost ops first (shifts → &|^)
  for (var _bp = 0; _bp < 5; _bp++) {
    var prev = s;
    s = s.replace(/(\w+)\s*>>\s*(\w+)/g, 'bit.rshift($1, $2)');
    s = s.replace(/(\w+)\s*<<\s*(\w+)/g, 'bit.lshift($1, $2)');
    s = s.replace(/(\w+)\s*&\s*(\w+)/g, 'bit.band($1, $2)');
    s = s.replace(/(\w+)\s*\|\s*(\w+)/g, 'bit.bor($1, $2)');
    s = s.replace(/(\w+)\s*\^\s*(\w+)/g, 'bit.bxor($1, $2)');
    if (s === prev) break;
  }
  return s;
}

function _jsExprToLua(expr, itemParam, indexParam) {
  // Replace item param references
  expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
  // Replace index param references (Lua _i is 1-based, .tsz idx is 0-based)
  if (indexParam) expr = expr.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), '(_i - 1)');
  // Convert === to ==, !== to ~=, != to ~=
  expr = expr.replace(/!==/g, '~=').replace(/===/g, '==').replace(/!=/g, '~=');
  // Logical operators: && → and, || → or
  expr = expr.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
  // Bitwise operators → LuaJIT bit library (after &&/|| so remaining &/| are bitwise)
  expr = _bitwiseToLua(expr);
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
