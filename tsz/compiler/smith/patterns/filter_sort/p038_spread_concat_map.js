// ── Pattern 038: [...a, ...b].map() ─────────────────────────────
// Index: 38
// Group: filter_sort
// Status: complete
//
// Soup syntax (copy-paste React):
//   {[...listA, ...listB].map(item => (
//     <Box key={item.id}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Concatenated arrays → single OA with combined length.
//   // Both sources must share the same field schema.
//   // Pool size = sum of both OA lengths.
//   for (0..(_oa0_len + _oa1_len)) |_i| {
//     // Fields resolved via offset: _i < _oa0_len → _oa0, else _oa1
//     const field_name = if (_i < _oa0_len)
//       _oa0_name[_i][0.._oa0_name_lens[_i]]
//     else
//       _oa1_name[_i - _oa0_len][0.._oa1_name_lens[_i - _oa0_len]];
//     _map_pool_0[_i] = .{ .text = field_name };
//   }
//
// Notes:
//   Smith does NOT recognize [...spread] array construction before .map().
//   The _identifierStartsMapCall detector requires the chain to start
//   with an identifier followed by dot — [...X].map() starts with [,
//   which is a different token pattern entirely.
//
//   Detection would need:
//   1. Recognize [ ... identifier , ... identifier ] . map ( as a token sequence
//   2. Resolve each spread source to an OA
//   3. Create a synthetic merged OA with combined length
//   4. Emit iteration with offset-based field access
//
//   The _computedExpr path could handle this if the expression is
//   captured as a render local: `const merged = [...a, ...b]` then
//   `merged.map(...)` would go through _tryParseComputedChainMap
//   (brace.js:188) with the full expression as _computedExpr,
//   letting QuickJS handle the concatenation.
//
//   The love2d reference does not handle spread concat. Developers
//   should concatenate in a compute block and .map() the result.

function match(c, ctx) {
  // Detect: [...identifier, ...identifier].map(...)
  // This starts with [ not an identifier, so it requires different
  // token matching than the standard chain detection.
  if (c.kind() !== TK.lbracket) return false;
  var saved = c.save();
  c.advance(); // [
  // Look for spread patterns: ...ident
  var hasSpread = false;
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lbracket) depth++;
    if (c.kind() === TK.rbracket) depth--;
    if (c.kind() === TK.dotdotdot || c.text() === '...') hasSpread = true;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rbracket) c.advance();
  var result = hasSpread && c.kind() === TK.dot &&
    c.pos + 2 < c.count &&
    c.textAt(c.pos + 1) === 'map' &&
    c.kindAt(c.pos + 2) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // [...a, ...b].map() is NOT supported inline by Smith's map pipeline.
  //
  // Why no implementation:
  //   - The token sequence starts with [ not an identifier, so it bypasses
  //     _identifierStartsMapCall (brace.js) which requires identifier.dot
  //   - Would require a new token pattern recognizer for bracket-start maps
  //   - Each spread source needs OA resolution + merged iteration with
  //     offset-based field access in the emit phase
  //   - The love2d reference compiler does not handle spread concat
  //
  // Workaround (fully functional):
  //   Concatenate in a render local, then .map() the result:
  //     const merged = [...listA, ...listB];
  //     {merged.map(item => <Box>{item.name}</Box>)}
  //   This goes through _tryParseComputedChainMap (brace.js) with the full
  //   expression as _computedExpr, letting QuickJS handle the concatenation
  //   at runtime.
  //
  // This pattern is documented for completeness. match() detects it so the
  // compiler can produce a meaningful diagnostic rather than a cryptic failure.
  return null;
}
