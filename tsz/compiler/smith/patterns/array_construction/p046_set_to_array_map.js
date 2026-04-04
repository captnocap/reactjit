// ── Pattern 046: Set -> array -> map() ─────────────────────────
// Index: 46
// Group: array_construction
// Status: partial
//
// Soup syntax (copy-paste React):
//   {Array.from(set).map((v) => (
//     <Tag value={v} />
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Indirect render-local form:
//   // const values = Array.from(set)
//   // {values.map(v => <Text>{v}</Text>)}
//   for (0.._oa0_len) |_i| {
//     // simple-array item text: _oa0__v[_i][0.._oa0__v_lens[_i]]
//   }
//
// Notes:
//   Direct inline `Array.from(set).map(...)` is not recognized by the live
//   brace parser because the head expression is `Array.from(...)`, not an
//   identifier already at `.map(...)`.
//
//   The render-local form is partially supported. Computed OAs materialize the
//   `Array.from(set)` result in QuickJS, then the Zig-side OA unpacker treats it
//   as a simple array.
//
//   As with p043, simple-array item values are strongest in child text position.
//   Passing the bare item through component brace props can still lose the raw
//   value depending on how the downstream resolver interprets it.

function match(c, ctx) {
  // Detect: Array.from(...).map(...)
  if (!c.isIdent('Array')) return false;
  var saved = c.save();

  c.advance(); // Array
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('from')) { c.restore(saved); return false; }
  c.advance(); // from
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
