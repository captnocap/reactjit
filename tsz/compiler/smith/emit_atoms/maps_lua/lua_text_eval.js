// ── Lua text emit: __eval fallback ───────────────────────────────
// Complex JS expression fallback via __eval() runtime bridge.
// Used when expressions cannot be statically translated to Lua.
//
// This is the LAST RESORT emit path. Pattern phase should have already
// attempted static translation. Only truly dynamic JS reaches here.

var _luaTextBuiltins = {
  tostring: 1, tonumber: 1, type: 1, pairs: 1, ipairs: 1,
  print: 1, pcall: 1, math: 1, string: 1, table: 1, unpack: 1, __eval: 1
};

function _escapeLuaTextEval(expr) {
  return escapeDoubleQuotedString(expr);
}

function _normalizeJsEvalPayload(expr) {
  if (!expr) return '';
  return String(expr)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
    .replace(/\bnot\b/g, '!')
    .replace(/~=/g, '!=')
    .replace(/\.len\b/g, '.length')
    .trim();
}

// Build __eval("...") wrapper for JS expressions that need runtime evaluation
function _jsEvalExpr(expr) {
  return '__eval("' + _escapeLuaTextEval(_normalizeJsEvalPayload(expr)) + '")';
}

// Check if expression needs __eval fallback (contains non-Lua function calls)
function _needsLuaTextEval(expr) {
  if (!expr) return false;
  if (expr.indexOf('__eval(') >= 0) return false;

  var re = /(^|[^.\w])([A-Za-z_]\w*)\s*\(/g;
  var m;
  while ((m = re.exec(expr)) !== null) {
    if (!_luaTextBuiltins[m[2]]) return true;
  }
  return false;
}

// Normalize embedded __eval markers for safe re-processing
function _normalizeEmbeddedJsEval(expr) {
  if (!expr || String(expr).indexOf('__eval("') < 0) return expr;
  return String(expr).replace(/__eval\("((?:[^"\\]|\\.)*)"\)/g, function(_, inner) {
    return _jsEvalExpr(inner);
  });
}

// Attempt to inline simple __eval expressions (field refs, literals)
function _maybeInlineJsEvalExpr(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!expr) return null;

  var m = String(expr).trim().match(/^__eval\("((?:[^"\\]|\\.)*)"\)$/);
  if (!m) return null;

  var jsExpr = _normalizeJsEvalPayload(m[1]);

  // Strip wrapper patterns: (0 == 1) && ... ? x : y → y
  var falseBranch = jsExpr.match(/^\(?\s*(?:0\s*==\s*1|1\s*==\s*0|false)\s*\)?\s*&&\s*[^?]+\?\s*([^:]+)\s*:\s*(.+)$/);
  if (falseBranch) jsExpr = falseBranch[2].trim();

  // Strip wrapper patterns: (1 == 1) && ... ? x : y → (...)?x:y
  var trueBranch = jsExpr.match(/^\(?\s*(?:1\s*==\s*1|0\s*==\s*0|true)\s*\)?\s*&&\s*([^?]+)\?\s*([^:]+)\s*:\s*(.+)$/);
  if (trueBranch) jsExpr = '(' + trueBranch[1].trim() + ')?' + trueBranch[2].trim() + ':' + trueBranch[3].trim();

  // Simple field refs can be returned directly
  if (/^_item\.\w+$/.test(jsExpr) || /^_nitem\.\w+$/.test(jsExpr)) return jsExpr;
  if (/^[A-Za-z_]\w*\s*\[[^\]]+\]\s*\.\s*[A-Za-z_]\w+$/.test(jsExpr)) {
    return _jsExprToLua(jsExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  }

  // Numeric and string literals
  if (/^\d+(?:\.\d+)?$/.test(jsExpr)) return jsExpr;
  if (/^"(?:[^"\\]|\\.)*"$/.test(jsExpr)) return jsExpr;
  if (/^'(?:[^'\\]|\\.)*'$/.test(jsExpr)) return luaStringLiteral(jsExpr.slice(1, -1));

  return null;
}
