// ── Pattern 036: flat().map() ───────────────────────────────────
// Index: 36
// Group: filter_sort
// Status: complete
//
// Soup syntax (copy-paste React):
//   {nested.flat().map(item => (
//     <Box key={item.id}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // .flat() produces a single-level array from nested arrays.
//   // If the source is a nested OA (parent → child relationship),
//   // flat() concatenates all child OA entries into one iteration:
//   for (0.._oa1_total_len) |_i| {
//     _map_pool_0[_i] = .{ .style = .{} };
//     // fields come from the flattened child OA
//   }
//
// Notes:
//   .flat() is not recognized by Smith's chain detection. The
//   _identifierStartsMapCall function (brace.js:261) only recognizes
//   .filter(), .sort(), and .slice() as valid pre-map chain methods.
//
//   Adding .flat() support would require:
//   1. Adding 'flat' to the chain method whitelist in brace.js:261
//   2. Adding 'flat' skip logic in tryParseMapHeader (header.js:40)
//   3. In the emit phase, iterating over flattened child OA entries
//      rather than parent entries
//
//   For _computedExpr OAs, .flat() is part of the JS expression and
//   QuickJS handles it at runtime — but the OA field types need to
//   match the flattened structure, not the nested one.
//
//   The love2d reference does not handle .flat(). Nested arrays are
//   handled via nested .map() (p021) instead.
//
//   Practical alternative: use nested .map() (p021) which is fully
//   supported, or flatten the data in a compute block before rendering.

function match(c, ctx) {
  // Detect: identifier.flat().map(...)
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance();
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance();
  if (!c.isIdent('flat')) { c.restore(saved); return false; }
  c.advance(); // flat
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance(); // (
  // flat() takes optional depth argument
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
  // .flat().map() is NOT supported by Smith's map pipeline.
  //
  // Why no implementation:
  //   - .flat() is not in the chain method whitelist in brace.js or header.js
  //     (only filter/sort/slice are recognized pre-map chain methods)
  //   - Adding .flat() would require changes to both _identifierStartsMapCall
  //     and tryParseMapHeader, plus emit-phase logic for flattened OA iteration
  //   - The love2d reference compiler does not handle .flat() either
  //
  // Workarounds:
  //   - Use nested .map() (p021) which is fully supported
  //   - Flatten the data in a compute block / render local before .map()
  //   - For _computedExpr OAs via render local, QuickJS handles .flat() at
  //     runtime, but OA field types must match the flattened structure
  //
  // This pattern is documented for completeness. match() detects it so the
  // compiler can produce a meaningful diagnostic rather than a cryptic failure.
  return null;
}
