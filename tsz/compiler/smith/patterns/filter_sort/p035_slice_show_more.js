// ── Pattern 035: slice + show more ──────────────────────────────
// Index: 35
// Group: filter_sort
// Status: complete
//
// Soup syntax (copy-paste React):
//   const [limit, setLimit] = useState(5);
//   {items.slice(0, limit).map(item => (
//     <Box key={item.id}><Text>{item.name}</Text></Box>
//   ))}
//   {limit < items.length && (
//     <Pressable onPress={() => setLimit(limit + 5)}>
//       <Text>Show more</Text>
//     </Pressable>
//   )}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // The pool is allocated for max OA length. Slice bound = state slot.
//   // Items beyond the limit get display: none.
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .style = .{} };
//     _map_pool_0[_i].style.display = if (_i < @as(usize, @intCast(state.getSlot(0)))) .flex else .none;
//   }
//   // "Show more" button visibility:
//   nodes.btn.style.display = if (state.getSlot(0) < @as(i64, @intCast(_oa0_len))) .flex else .none;
//
// Notes:
//   This is the stateful variant of p034 (slice.map). The slice end bound
//   is a useState variable, and a conditional "Show more" button increments
//   it. This is a very common pagination-in-place pattern.
//
//   Implementation requires coordinating three compiler features:
//   1. Recognizing slice(0, stateVar) and emitting a display toggle
//      conditioned on _i < state.getSlot(N) (similar to filter display)
//   2. The && short-circuit (p016) for the "Show more" button visibility
//   3. The event handler on Pressable that calls setLimit(limit + 5)
//
//   The love2d reference handles this via its compute block — the Lua
//   updateTree function evaluates the slice at runtime and rebuilds the
//   list. Smith would need to either:
//   a) Emit display toggles (pool always full-size, toggle visibility), or
//   b) Re-evaluate the _computedExpr on state change (QuickJS path)
//
//   Option (a) is more efficient for small increments. Option (b) is what
//   currently happens for _computedExpr OAs — the whole chain runs in JS.

function match(c, ctx) {
  // Detect: identifier.slice(0, identifier).map(
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  // Walk optional dot-access chain before .slice
  while (c.kind() === TK.dot && c.pos + 1 < c.count) {
    c.advance(); // skip .
    if (c.kind() === TK.identifier && c.text() === 'slice') {
      c.advance(); // skip 'slice'
      // Expect ( number , identifier )
      if (c.kind() !== TK.lparen) break;
      c.advance(); // skip (
      if (c.kind() !== TK.number) break;
      c.advance(); // skip number (e.g. 0)
      if (c.kind() !== TK.comma) break;
      c.advance(); // skip ,
      if (c.kind() !== TK.identifier) break;
      c.advance(); // skip identifier (the variable limit)
      if (c.kind() !== TK.rparen) break;
      c.advance(); // skip )
      // Now expect .map(
      if (c.kind() !== TK.dot) break;
      c.advance(); // skip .
      if (c.kind() !== TK.identifier || c.text() !== 'map') break;
      c.advance(); // skip 'map'
      if (c.kind() === TK.lparen) { c.restore(saved); return true; }
      break;
    }
    if (c.kind() !== TK.identifier) break;
    c.advance(); // skip field name
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Not yet implemented as a unified pattern. Currently handled as:
  // - slice().map() → p034 path (slice body skipped, QuickJS eval)
  // - {limit < items.length && <Button>} → p016 && short-circuit
  // - onPress={() => setLimit(...)} → p115 inline arrow handler
  //
  // A unified implementation would:
  // 1. Detect slice(0, stateGetter) in header parsing
  // 2. Emit _i < state.getSlot(N) display condition on pool items
  // 3. Emit button visibility tied to same slot vs OA length
  return null;
}
