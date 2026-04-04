// ── Pattern 042: Object.keys().map() ───────────────────────────
// Index: 42
// Group: array_construction
// Status: partial
//
// Soup syntax (copy-paste React):
//   {Object.keys(obj).map((k) => (
//     <Text>{k}</Text>
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Indirectly supported when keys are first assigned to a render-local:
//   // const keys = Object.keys(obj)
//   // {keys.map(k => <Text>{k}</Text>)}
//   for (0.._oa0_len) |_i| {
//     // bare key text child reads _oa0__v[_i][0.._oa0__v_lens[_i]]
//   }
//
// Notes:
//   The direct inline form starts with `Object.keys(...)`, but the live map
//   detector only recognizes identifier heads that already lead into `.map()`
//   or a small pre-map chain (.filter/.slice/.sort). `Object.keys(obj).map(...)`
//   therefore does not match the runtime parser as written.
//
//   The partial path is:
//     const keys = Object.keys(obj);
//     {keys.map(k => ...)}
//   In that form _tryParseIdentifierMapExpression() sees `keys`, notices the
//   render-local raw JS, and _tryParseComputedChainMap() creates a computed OA.
//   Because this is a simple string array, bare `k` text children work well.
//
//   Prop passthrough of the bare item value is weaker than text rendering in
//   simple-array maps; the current prop brace resolver primarily treats bare
//   item params as index-like unless they arrive through render-local aliases.

function match(c, ctx) {
  // Detect: Object.keys(...).map(...)
  if (!c.isIdent('Object')) return false;
  var saved = c.save();

  c.advance(); // Object
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('keys')) { c.restore(saved); return false; }
  c.advance(); // keys
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
