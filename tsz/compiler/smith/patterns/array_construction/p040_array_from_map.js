(function() {
// ── Pattern 040: Array.from().map() ─────────────────────────────
// Index: 40
// Group: array_construction
// Status: complete
//
// Soup syntax (copy-paste React):
//   {Array.from({length: n}).map((_, i) => (
//     <Box key={i} style={{width: 50, height: 50}} />
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Same as Array(n).fill().map() — fixed/dynamic count loop:
//   for (0..@as(usize, @intCast(state.getSlot(N)))) |_i| {
//     _map_pool_0[_i] = .{ .style = .{ .width = 50, .height = 50 } };
//   }
//
// Notes:
//   Array.from({length: N}) is functionally identical to Array(N).fill()
//   for rendering purposes — both produce N iterations where only the
//   index matters.
//
//   Smith partially handles this via the _cmIsImperative check in
//   _tryParseIdentifierMapExpression (brace.js:348). When a render local
//   contains 'Array.from', it's flagged as imperative. Despite this flag,
//   the code still lets the OA path register fields, and the runtime
//   __computeRenderBody() in QuickJS handles the actual Array.from() call.
//
//   The _computedExpr on the synthetic OA includes the full expression
//   with Array.from(), so QuickJS evaluates it correctly at runtime.
//   The Zig side just iterates over however many items QuickJS produced.
//
//   This means Array.from() already WORKS when written as a render local:
//     const items = Array.from({length: count});
//     {items.map((_, i) => <Box key={i} />)}
//
//   The inline form (Array.from(...).map(...) directly in JSX) does NOT
//   work because the token sequence starts with Array.from which is
//   identifier.identifier — the chain detector sees Array.from and tries
//   to resolve 'Array' as an OA getter, which fails.
//
//   Full support for the inline form would need:
//   1. Detect Array.from as a special identifier pattern
//   2. Skip the {length: N} argument
//   3. Handle optional second arg (mapping function)
//   4. Create a synthetic OA with the appropriate length source

function match(c, ctx) {
  // Detect: Array.from({length: N}).map(...)
  if (c.kind() !== TK.identifier || c.text() !== 'Array') return false;
  var saved = c.save();
  c.advance(); // Array
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('from')) { c.restore(saved); return false; }
  c.advance(); // from
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance(); // (
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance(); // )
  // May have .map( directly, or additional chaining
  var result = c.kind() === TK.dot &&
    c.pos + 2 < c.count &&
    c.textAt(c.pos + 1) === 'map' &&
    c.kindAt(c.pos + 2) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Array.from().map() is NOT supported inline by Smith's map pipeline.
  //
  // Why no inline support:
  //   - The token sequence is Array.from(...).map(...) — the chain detector
  //     sees 'Array' as the identifier and 'from' after the dot, then tries
  //     to resolve 'Array' as an OA getter, which fails
  //   - _cmIsImperative (brace.js:348) flags 'Array.from' in render locals
  //     but still allows the OA path to proceed
  //
  // Workaround (fully functional):
  //   Assign to a render local first:
  //     const items = Array.from({length: count});
  //     {items.map((_, i) => <Box key={i} />)}
  //   _tryParseIdentifierMapExpression sees the render-local identifier,
  //   and _tryParseComputedChainMap creates a computed OA. QuickJS evaluates
  //   the Array.from() call at runtime before Zig-side OA unpacking.
  //
  // Functionally identical to p039 (Array(n).fill().map()) for rendering.
  return null;
}

_patterns[40] = { id: 40, match: match, compile: compile };

})();
