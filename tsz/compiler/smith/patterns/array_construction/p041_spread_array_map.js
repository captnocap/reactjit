// ── Pattern 041: [...Array(n)].map() ───────────────────────────
// Index: 41
// Group: array_construction
// Status: partial
//
// Soup syntax (copy-paste React):
//   {[...Array(n)].map((_, i) => (
//     <Box key={i}>
//       <Text>{i}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Indirectly supported when first assigned to a render-local:
//   // const slots = [...Array(n)]
//   // {slots.map((_, i) => <Box key={i}><Text>{i}</Text></Box>)}
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .style = .{} };
//     // index param resolves to @as(i64, @intCast(_i))
//   }
//
// Notes:
//   Direct inline bracket-start map sources are not detected by the live
//   brace parser. tryParseBraceChild() dispatches map parsing only from an
//   identifier head (parse/children/brace.js), so {[...Array(n)].map(...)}
//   never enters the map pipeline today.
//
//   The partial support comes from render-local indirection:
//     const slots = [...Array(n)];
//     {slots.map((_, i) => ...)}
//   In that form _tryParseIdentifierMapExpression() + _tryParseComputedChainMap()
//   synthesize a computed OA and let QuickJS materialize the array at runtime.
//
//   For this source shape the item value itself is usually not useful:
//   [...Array(n)] produces `undefined` elements, and simple-array OAs store
//   element text through JS_ToCString. The reliable piece is the index param.

function match(c, ctx) {
  // Detect: [ ... Array(...) ].map(...)
  if (c.kind() !== TK.lbracket) return false;
  var saved = c.save();

  c.advance(); // [
  if (c.kind() !== TK.spread) { c.restore(saved); return false; }
  c.advance(); // ...
  if (!c.isIdent('Array')) { c.restore(saved); return false; }
  c.advance(); // Array
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }

  // Skip Array(...)
  c.advance();
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();

  if (c.kind() !== TK.rbracket) { c.restore(saved); return false; }
  c.advance(); // ]

  var result = c.kind() === TK.dot &&
    c.pos + 2 < c.count &&
    c.textAt(c.pos + 1) === 'map' &&
    c.kindAt(c.pos + 2) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Direct inline support is not wired. The existing partial behavior lives
  // in the render-local computed-map path, not here.
  return null;
}
