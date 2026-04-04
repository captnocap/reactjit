// ── Pattern 039: Array(n).fill().map() ──────────────────────────
// Index: 39
// Group: array_construction
// Status: complete
//
// Soup syntax (copy-paste React):
//   {Array(5).fill(0).map((_, i) => (
//     <Box key={i} style={{height: 20, backgroundColor: '#eee'}} />
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Fixed-count iteration — no OA needed, just a static for loop:
//   for (0..5) |_i| {
//     _map_pool_0[_i] = .{ .style = .{ .height = 20, .background_color = 0xeeeeee } };
//   }
//   // Dynamic count (state slot):
//   for (0..@as(usize, @intCast(state.getSlot(N)))) |_i| {
//     _map_pool_0[_i] = .{ .style = .{ .height = 20, .background_color = 0xeeeeee } };
//   }
//
// Notes:
//   Array(n).fill(x).map() is a repeat pattern — render the same template
//   N times. The fill value is irrelevant (always ignored via _ param).
//   Only the index matters.
//
//   Smith does NOT detect this pattern. The token sequence starts with
//   'Array' which is an identifier, but Array(n) is a function call,
//   not a property access. The chain detection in _identifierStartsMapCall
//   requires identifier.dot as the first two tokens.
//
//   However, if written as a render local:
//     const stars = Array(5).fill(0);
//     {stars.map((_, i) => <Star key={i} />)}
//   Then _tryParseComputedChainMap handles it via _computedExpr.
//
//   The _cmIsImperative check (brace.js:347) does NOT flag Array(n).fill()
//   because it looks for 'Array.from' but not 'Array(' — so this would
//   take the OA path with a synthetic computed OA.
//
//   True compile-time support for the inline form would need:
//   1. Detect Array(N) as a token pattern (identifier + lparen + number + rparen)
//   2. Extract N as the loop bound
//   3. Skip .fill(...) entirely (irrelevant for _ params)
//   4. Emit a simple for(0..N) loop with index-only template
//
//   If N is a state variable: for(0..@intCast(state.getSlot(X)))
//   Pool size = max expected N (needs a cap, e.g., 100).

function match(c, ctx) {
  // Detect: Array(N).fill(...).map(...)
  if (c.kind() !== TK.identifier || c.text() !== 'Array') return false;
  var saved = c.save();
  c.advance(); // Array
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance(); // (
  // Skip Array(N) args
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance(); // )
  // Expect .fill(
  if (c.kind() !== TK.dot || !c.pos + 1 < c.count) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('fill')) { c.restore(saved); return false; }
  c.advance(); // fill
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance(); // (
  depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance(); // )
  // Must end with .map(
  var result = c.kind() === TK.dot &&
    c.pos + 2 < c.count &&
    c.textAt(c.pos + 1) === 'map' &&
    c.kindAt(c.pos + 2) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Array(n).fill().map() is NOT supported inline by Smith's map pipeline.
  //
  // Why no implementation:
  //   - Array(n) is a function call, not a property access — the token sequence
  //     starts as identifier + lparen, not identifier + dot
  //   - _identifierStartsMapCall (brace.js) requires identifier.dot as the
  //     first two tokens, so Array(n).fill().map() never enters map detection
  //   - _cmIsImperative (brace.js:347) checks for 'Array.from' but not 'Array('
  //
  // Workaround (fully functional):
  //   Assign to a render local first:
  //     const stars = Array(5).fill(0);
  //     {stars.map((_, i) => <Star key={i} />)}
  //   This goes through _tryParseComputedChainMap with the full expression
  //   as _computedExpr, letting QuickJS handle Array(n).fill() at runtime.
  //
  // True compile-time support would extract N from Array(N), skip .fill(),
  // and emit a simple for(0..N) loop. If N is a state variable, emit
  // for(0..@intCast(state.getSlot(X))) with a pool size cap.
  return null;
}
