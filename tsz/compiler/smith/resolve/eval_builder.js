// ── Resolve: Eval Builder ────────────────────────────────────────
// Single source of truth for building and parsing QuickJS eval strings.
// No other file should construct evalToString() calls directly.
//
// Two eval string formats exist in the wild:
//   Simple:   "String(expr)"
//   Var-decl: "var X = expr; String(X)"
// This module handles both transparently.

// Allocate the next eval buffer index
function allocBuf(ctx) {
  if (!ctx._jsEvalCount) ctx._jsEvalCount = 0;
  var id = ctx._jsEvalCount;
  ctx._jsEvalCount = id + 1;
  return id;
}

// Build a string eval: returns the JS value as a string
// qjs_runtime.evalToString("String(jsExpr)", &_eval_buf_N)
function buildEval(jsExpr, ctx) {
  var bufId = allocBuf(ctx);
  var escaped = jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return 'qjs_runtime.evalToString("String(' + escaped + ')", &_eval_buf_' + bufId + ')';
}

// Build a boolean eval: returns 'T' for truthy, '' for falsy
// qjs_runtime.evalToString("(jsExpr) ? 'T' : ''", &_eval_buf_N)
function buildBoolEval(jsExpr, ctx) {
  var bufId = allocBuf(ctx);
  var escaped = jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return 'qjs_runtime.evalToString("(' + escaped + ") ? 'T' : ''" + '", &_eval_buf_' + bufId + ')';
}

// Build a comparison eval: does the comparison in JS, returns 'T' or ''
// qjs_runtime.evalToString("(jsExpr) op rhs ? 'T' : ''", &_eval_buf_N)
function buildComparisonEval(jsExpr, op, rhs, ctx) {
  var bufId = allocBuf(ctx);
  var escaped = jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return 'qjs_runtime.evalToString("(' + escaped + ') ' + op + ' ' + rhs + " ? 'T' : ''" + '", &_eval_buf_' + bufId + ')';
}

// Build a field access eval: evaluates expr.field in JS
// qjs_runtime.evalToString("String((jsExpr).field)", &_eval_buf_N)
function buildFieldEval(jsExpr, field, ctx) {
  var bufId = allocBuf(ctx);
  var escaped = jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return 'qjs_runtime.evalToString("String((' + escaped + ').' + field + ')", &_eval_buf_' + bufId + ')';
}

// Extract the inner JS expression from an eval string.
// Handles both formats:
//   "String(expr)" → expr
//   "var X = expr; String(X)" → expr (substitutes X back)
// Returns null if the string isn't a recognized eval format.
function extractInner(evalStr) {
  if (!evalStr || typeof evalStr !== 'string') return null;

  // Format 1: Simple — evalToString("String(expr)", &...)
  var m1 = evalStr.match(/evalToString\("String\((.+)\)",\s*&/);
  if (m1) {
    var inner = m1[1];
    // Check it's not the var-decl format that matched greedily
    if (!inner.includes('; String(')) return inner;
  }

  // Format 2: Var-decl — evalToString("var X = expr; String(X)", &...)
  var m2 = evalStr.match(/evalToString\("var (\w+) = (.+?);\s*String\(\1\)",\s*&/);
  if (m2) return m2[2];

  // Format 3: Bool eval — evalToString("(expr) ? 'T' : ''", &...)
  var m3 = evalStr.match(/evalToString\("\((.+?)\) \? 'T' : ''",\s*&/);
  if (m3) return m3[1];

  return null;
}

// Build a var-decl eval: assigns to a named JS variable then returns it as string.
// Used for render locals where the variable name must be visible in the JS scope.
// qjs_runtime.evalToString("var varName = jsExpr; String(varName)", &_eval_buf_N)
function buildVarEval(varName, jsExpr, ctx) {
  var bufId = allocBuf(ctx);
  var escaped = jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return 'qjs_runtime.evalToString("var ' + varName + ' = ' + escaped + '; String(' + varName + ')", &_eval_buf_' + bufId + ')';
}

// Check if a string is a qjs eval expression
function isEval(expr) {
  return typeof expr === 'string' && expr.includes('qjs_runtime.evalToString');
}
