// ── Pattern 126: Array.isArray gate ─────────────────────────────
// Index: 126
// Group: type_narrowing
// Status: complete
//
// Soup syntax (copy-paste React):
//   {Array.isArray(items) && items.map(i => <Box key={i.id}>{i.name}</Box>)}
//   {Array.isArray(value) && <Text>{value.join(", ")}</Text>}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Array.isArray() in && condition → QuickJS eval truthiness:
//   nodes.guard.style.display = if (
//     qjs_runtime.evalToString("(Array.isArray(items)) ? 'T' : ''", &_eval_buf_0).len > 0
//   ) .flex else .none;
//
// Notes:
//   Array.isArray() is a JavaScript runtime check with no compile-time
//   equivalent in Smith's type model. When used as a condition in &&
//   short-circuit (p016), it falls through to QuickJS eval.
//
//   The conditional parser (conditional.js) treats Array.isArray(x) as
//   an unresolvable expression — 'Array' is not a state getter, OA, or
//   render local. The identifier chain Array.isArray(x) is collected as
//   raw condition text and eventually wrapped in a QuickJS eval call.
//
//   This works correctly at runtime — QuickJS evaluates the isArray check
//   and the truthiness wrapper produces 'T' or '' for the display toggle.
//
//   For the guarded body (items.map), if items is an OA-backed array, the
//   map renders normally. The isArray guard just controls visibility.
//
//   In practice, this pattern is defensive coding — if the data source
//   guarantees array type (which OA-backed data always is), the isArray
//   check is unnecessary. Smith could detect and optimize it away, but
//   the QuickJS eval path handles it correctly without optimization.

function match(c, ctx) {
  // Detect: Array.isArray(...)
  if (c.kind() !== TK.identifier || c.text() !== 'Array') return false;
  var saved = c.save();
  c.advance();
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance();
  var result = c.isIdent('isArray') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Array.isArray() is a JavaScript runtime check with no compile-time
  // equivalent. Collect the full expression and route through QuickJS eval.
  //
  // For OA-backed arrays, this check is always true (the data is always an
  // array), but we don't optimize that away — the eval path is correct and
  // the check is typically guarding against missing data from external sources.

  // Collect: Array.isArray(expr)
  var parts = [];
  // Consume Array.isArray(
  parts.push(c.text()); c.advance(); // Array
  parts.push(c.text()); c.advance(); // .
  parts.push(c.text()); c.advance(); // isArray
  parts.push(c.text()); c.advance(); // (

  // Collect arguments until matching )
  var depth = 1;
  while (c.kind() !== TK.eof && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) {
      parts.push(c.text());
      c.advance();
    }
  }
  parts.push(')');
  if (c.kind() === TK.rparen) c.advance();

  var expr = parts.join('');
  return { condExpr: zigBool(buildEval(expr, ctx), ctx) };
}
