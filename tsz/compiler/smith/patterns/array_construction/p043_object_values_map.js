// ── Pattern 043: Object.values().map() ─────────────────────────
// Index: 43
// Group: array_construction
// Status: partial
//
// Soup syntax (copy-paste React):
//   {Object.values(obj).map((v) => (
//     <Card value={v} />
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Indirect render-local form:
//   // const values = Object.values(obj)
//   // {values.map(v => <Text>{v}</Text>)}
//   for (0.._oa0_len) |_i| {
//     // simple-array item text: _oa0__v[_i][0.._oa0__v_lens[_i]]
//   }
//
// Notes:
//   Like p042, the direct inline `Object.values(obj).map(...)` form is not
//   claimed by the live brace parser because the parser only dispatches map
//   handling from identifier heads that are already in `.map(...)` position.
//
//   The partial support path is render-local indirection:
//     const values = Object.values(obj);
//     {values.map(v => ...)}
//   That route creates a computed simple-array OA whose runtime data is pushed
//   from QuickJS before the Zig map emit runs.
//
//   The support is partial because the simple-array item value is strongest in
//   child text position. Passing bare `v` through component brace props can
//   still degrade into index-like behavior in the current resolver depending on
//   how the consumer uses it.

function match(c, ctx) {
  // Detect: Object.values(...).map(...)
  if (!c.isIdent('Object')) return false;
  var saved = c.save();

  c.advance(); // Object
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('values')) { c.restore(saved); return false; }
  c.advance(); // values
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
  // Handled only through the render-local computed-map path today.
  return null;
}
