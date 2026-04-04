// ── Pattern 044: Object.entries().map() ────────────────────────
// Index: 44
// Group: array_construction
// Status: complete
//
// Soup syntax (copy-paste React):
//   {Object.entries(obj).map(([k, v]) => (
//     <Row label={k} value={v} />
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Indirect render-local form:
//   // const entries = Object.entries(obj)
//   // {entries.map(([k, v]) => <Row label={k} value={v} />)}
//   for (0.._oa0_len) |_i| {
//     // renderLocalAliases map k/v to synthesized OA fields
//   }
//
// Notes:
//   Direct inline `Object.entries(obj).map(...)` is not claimed by the live
//   parser for the same reason as p042/p043: the expression head is
//   `Object.entries(...)`, not an identifier already positioned at `.map()`.
//
//   The partial support path is a render-local:
//     const entries = Object.entries(obj);
//     {entries.map(([k, v]) => ...)}
//   In that route readMapParamList() records `[k, v]` destructuring, and
//   _buildDestructuredComputedPlan() synthesizes fields plus render-local
//   aliases so bare `k`/`v` references inside the JSX body resolve cleanly.
//
//   This stays partial because destructured aliases only become useful when the
//   callback body actually references them. If the aliases are unused, the OA
//   falls back toward a simple-array shape and no direct key/value fields exist.

function match(c, ctx) {
  // Detect: Object.entries(...).map(...)
  if (!c.isIdent('Object')) return false;
  var saved = c.save();

  c.advance(); // Object
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('entries')) { c.restore(saved); return false; }
  c.advance(); // entries
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }

  c.advance();
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();

  var result = c.kind() === TK.dot &&
    c.pos + 2 < c.count &&
    c.textAt(c.pos + 1) === 'map' &&
    c.kindAt(c.pos + 2) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Object.entries().map() is NOT supported inline by Smith's map pipeline.
  //
  // Why no inline support:
  //   - Same as p042/p043: the head expression is Object.entries(...) which
  //     does not match the chain detector's identifier.dot.map pattern
  //
  // Workaround (fully functional):
  //   Assign to a render local first:
  //     const entries = Object.entries(obj);
  //     {entries.map(([k, v]) => <Row label={k} value={v} />)}
  //   readMapParamList (header.js) records [k, v] destructuring, and
  //   _buildDestructuredComputedPlan synthesizes fields plus render-local
  //   aliases so bare k/v references inside the JSX body resolve cleanly.
  //
  // Destructured aliases only become useful when the callback body actually
  // references them. If unused, the OA falls back toward a simple-array
  // shape with no direct key/value fields.
  return null;
}
