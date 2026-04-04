(function() {
// ── Pattern 034: slice().map() ──────────────────────────────────
// Index: 34
// Group: filter_sort
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.slice(0, 5).map(item => (
//     <Box key={item.id}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Static slice with constant bounds:
//   for (0..5) |_i| {
//     _map_pool_0[_i] = .{ .style = .{} };
//   }
//   // Dynamic slice (bound is a state slot):
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .style = .{} };
//     _map_pool_0[_i].style.display = if (_i < @as(usize, @intCast(state.getSlot(N)))) .flex else .none;
//   }
//
// Notes:
//   Smith currently SKIPS the slice body during header parsing (header.js:62-69).
//   The .slice() arguments are consumed and discarded. Chain detection in
//   _identifierStartsMapCall (brace.js:261) recognizes .slice() as valid
//   pre-map chain method.
//
//   For _computedExpr OAs (render-local chains), the slice() call is included
//   in the JS expression evaluated by QuickJS, so the OA data is already
//   sliced — correct but allocates the full pool size.
//
//   For static OAs, slice is not applied — all items render.
//
//   True compile-time slice would need:
//   1. Parse slice(start, end) arguments
//   2. If both are constants → adjust for loop bounds
//   3. If end is a state slot → emit display toggle like filter
//   4. If start > 0 → offset the iteration variable
//
//   This is closely related to p035 (slice + show more) where the slice
//   end bound is a state variable controlled by a button.

function match(c, ctx) {
  // Detect: identifier.slice(...).map(...)
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance(); // identifier
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('slice')) { c.restore(saved); return false; }
  c.advance(); // slice
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance(); // (
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance(); // )
  var result = c.kind() === TK.dot &&
    c.pos + 2 < c.count &&
    c.textAt(c.pos + 1) === 'map' &&
    c.kindAt(c.pos + 2) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Handled by the map pipeline — tryParseMapHeader (header.js:62-69)
  // skips .slice() body and proceeds to .map():
  //   1. _identifierStartsMapCall (brace.js) recognizes .slice() as
  //      a valid pre-map chain method and skips past it
  //   2. tryParseMapHeader consumes .slice() args without capturing them
  //   3. For _computedExpr OAs, the .slice() call is included in the JS
  //      expression — QuickJS evaluates it so OA data is already sliced
  //   4. For static/prop-driven OAs, slice is NOT applied (all items render)
  //   5. The .map() body is parsed normally after the chain is consumed
  //
  // True compile-time slice (adjusting for loop bounds from constant args)
  // is not yet implemented. The runtime path via _computedExpr is correct
  // but allocates the full pool size regardless of slice bounds.
  //
  // No compile action needed — the map pipeline owns this end-to-end.
  return null;
}

_patterns[34] = { id: 34, match: match, compile: compile };

})();
