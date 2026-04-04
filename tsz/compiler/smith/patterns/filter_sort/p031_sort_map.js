// ── Pattern 031: sort().map() ───────────────────────────────────
// Index: 31
// Group: filter_sort
// Status: partial
//
// Soup syntax (copy-paste React):
//   {items.sort((a, b) => a.name - b.name).map(item => (
//     <Box key={item.id}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Sort is a runtime concern — the OA data arrives pre-sorted from
//   // QuickJS eval. The Zig loop iterates in OA order:
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .style = .{} };
//     // text child: _oa0_name[_i][0.._oa0_name_lens[_i]]
//   }
//
// Notes:
//   Smith currently SKIPS the sort body during header parsing (header.js:62-69).
//   The .sort() comparator is consumed and discarded — no Zig sort emit happens.
//   Instead, the data order depends on the QuickJS eval that populates the OA
//   arrays at runtime. For _computedExpr OAs (render-local chains), the JS
//   expression includes the .sort() call, so QuickJS runs it and the OA data
//   arrives pre-sorted.
//
//   For static OAs (prop-driven), sort order is whatever the host provides.
//   True compile-time sort would require emitting std.mem.sort() over OA
//   index arrays — not yet implemented.
//
//   The chain detection in _identifierStartsMapCall (brace.js:261) recognizes
//   .sort() as a valid pre-map chain method and skips past it to find .map().
//   tryParseMapHeader (header.js:40) also skips .sort() bodies.

function match(c, ctx) {
  // Detect: identifier.sort(...).map(...)
  // We peek without advancing. The chain detector in brace.js already
  // handles this — this match function documents the token pattern.
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance(); // identifier
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('sort')) { c.restore(saved); return false; }
  c.advance(); // sort
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  // Skip sort(...) body
  c.advance(); // (
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance(); // )
  // Must be followed by .map(
  var result = c.kind() === TK.dot &&
    c.pos + 2 < c.count &&
    c.textAt(c.pos + 1) === 'map' &&
    c.kindAt(c.pos + 2) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Compilation is handled by the existing map pipeline.
  // tryParseMapHeader skips .sort() and proceeds to .map().
  // The sort comparator is discarded — OA data order comes from
  // the _computedExpr evaluated by QuickJS at runtime.
  //
  // This compile function is a no-op stub because the consumer
  // (brace.js) calls tryParsePlainMap / tryParsePlainMapFromMethod
  // directly, which already handles the full chain.
  return null;
}
