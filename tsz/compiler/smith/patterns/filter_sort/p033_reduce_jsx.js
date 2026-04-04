// ── Pattern 033: reduce() → JSX ─────────────────────────────────
// Index: 33
// Group: filter_sort
// Status: stub
//
// Soup syntax (copy-paste React):
//   {items.reduce((acc, item) => [...acc, <Box key={item.id}>{item.name}</Box>], [])}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // reduce() that accumulates JSX is semantically equivalent to .map()
//   // with optional filtering/transformation. Target output same as map:
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .style = .{} };
//     // text child from OA fields
//   }
//
// Notes:
//   .reduce() accumulating JSX elements (e.g., [...acc, <Element />]) is
//   functionally identical to .map() for rendering purposes. The accumulator
//   pattern adds no information that .map() doesn't — the result is still
//   one element per input item.
//
//   More complex reduce patterns (grouping, aggregation, interleaving
//   separators) are genuinely different from .map() and would need
//   different compilation strategies:
//   - Grouping: would need nested OA (group → items within group)
//   - Aggregation: collapses N items → 1 value, not a list render
//   - Separator interleaving: items.reduce((acc, i) => [...acc, <Sep/>, <C/>], [])
//     could compile to a map with 2N-1 pool entries and odd/even branching
//
//   The love2d reference does NOT handle reduce() — it only handles .map().
//   For now, reduce-to-JSX should be rewritten as .map() by the developer.
//
//   Smith's chain detection (_identifierStartsMapCall) does NOT recognize
//   .reduce() — it only looks for .filter()/.sort()/.slice() before .map().
//   The Lua bus path also does not handle .reduce().
//
//   Implementation plan:
//   1. Detect [...acc, <JSX>] pattern → rewrite to .map() internally
//   2. For separator patterns → emit 2N-1 pool with conditional display
//   3. For aggregation → fall through to QuickJS eval

function match(c, ctx) {
  // Detect: identifier.reduce(...)
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance();
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance();
  var result = c.isIdent('reduce') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Not yet implemented. reduce() → JSX requires pattern detection
  // to determine which reduce variant is in use (accumulate, group,
  // aggregate, interleave) and choose the appropriate compilation
  // strategy. For now, developers should rewrite as .map().
  return null;
}
