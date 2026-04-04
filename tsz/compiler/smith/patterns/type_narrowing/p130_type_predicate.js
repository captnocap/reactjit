(function() {
// ── Pattern 130: Type predicate ─────────────────────────────────
// Index: 130
// Group: type_narrowing
// Status: complete
//
// Soup syntax (copy-paste React):
//   {isAdmin(user) && <AdminPanel />}
//   {hasPermission(user, 'edit') && <EditButton />}
//   {isLoaded(data) ? <Content data={data} /> : <Loading />}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Function call in condition → QuickJS eval truthiness:
//   nodes.guard.style.display = if (
//     qjs_runtime.evalToString("(isAdmin(user)) ? 'T' : ''", &_eval_buf_0).len > 0
//   ) .flex else .none;
//
//   // Script function with boolean return → direct eval:
//   nodes.guard.style.display = if (
//     qjs_runtime.evalToString("(isAdmin(user)) ? 'T' : ''", &_eval_buf_0).len > 0
//   ) .flex else .none;
//
// Notes:
//   Type predicates (isX(value)) are TypeScript type-narrowing functions
//   that return boolean. At runtime they're just function calls that
//   return true/false. Smith handles them as general function calls in
//   conditions.
//
//   The conditional parser (conditional.js) encounters the function call
//   pattern: identifier(args). Since the function is not a known state
//   getter or built-in, the expression falls through to QuickJS eval.
//
//   If the predicate function is defined in a <script> or .script.tsz
//   block, QuickJS can evaluate it. The truthiness wrapper converts the
//   boolean result to 'T'/'' for display toggling.
//
//   If the function is NOT available in the QuickJS context (e.g., it's
//   imported from an external module), the eval will fail silently and
//   the guard defaults to hidden.
//
//   For render-local function references (e.g., const check = someLib.isAdmin),
//   the render-local expansion (brace.js:218-227) tries to expand the
//   function call. If it resolves to a QuickJS-evaluable expression,
//   the eval path handles it.
//
//   Smith does not distinguish type predicates from regular function calls —
//   both are just expressions evaluated for truthiness.

function match(c, ctx) {
  // Detect: identifier(args) in condition position (before && or ?)
  // This is a general function call pattern, not specific to type predicates.
  // Detection happens in the conditional parser, not here.
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance();
  var result = c.kind() === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Type predicates (isX(value)) are just function calls that return boolean.
  // Smith doesn't distinguish them from regular function calls. They route
  // through QuickJS eval for truthiness evaluation.
  //
  // If the predicate function is defined in a <script> block, QuickJS can
  // evaluate it. If it's an external import, the eval fails silently and
  // the guard defaults to hidden.
  //
  // Collect: funcName(args)
  var funcName = c.text();
  c.advance(); // identifier
  c.advance(); // (

  var argParts = [];
  var depth = 1;
  while (c.kind() !== TK.eof && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) {
      argParts.push(c.text());
      c.advance();
    }
  }
  if (c.kind() === TK.rparen) c.advance();

  var expr = funcName + '(' + argParts.join(' ') + ')';
  return { condExpr: zigBool(buildEval(expr, ctx), ctx) };
}

_patterns[130] = { id: 130, match: match, compile: compile };

})();
