(function() {
// ── Pattern 037: flatMap() → element ────────────────────────────
// Index: 37
// Group: filter_sort
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.flatMap(item => [
//     <Text key={`${item.id}-label`}>{item.label}</Text>,
//     <Text key={`${item.id}-value`}>{item.value}</Text>
//   ])}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // flatMap producing N elements per item → pool size = items.len * N
//   // Each item maps to a fixed number of nodes (2 in this example):
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i * 2] = .{ .text = _oa0_label[_i][0.._oa0_label_lens[_i]] };
//     _map_pool_0[_i * 2 + 1] = .{ .text = _oa0_value[_i][0.._oa0_value_lens[_i]] };
//   }
//
// Notes:
//   .flatMap() is not recognized by Smith's chain detection. It would need
//   to be added to the method whitelist, but unlike filter/sort/slice which
//   are pre-map transforms, flatMap REPLACES .map() — it IS the mapping
//   function, just with array-returning semantics.
//
//   Two sub-patterns:
//   a) Fixed-count return: [<A/>, <B/>] → compile-time known multiplier
//      Pool size = items.len * returnCount. Each iteration fills N slots.
//   b) Variable-count return: conditional arrays → needs runtime pooling
//
//   Pattern (a) is tractable: parse the array literal inside the arrow
//   body, count JSX elements, multiply pool size, emit with stride.
//
//   Pattern (b) is equivalent to a nested map with inline arrays and
//   would need the Lua bus or QuickJS eval path.
//
//   The love2d reference does not handle .flatMap(). Developers should
//   use nested JSX or multiple .map() calls instead.
//
//   Related: p036 (flat().map()) flattens input, this flattens output.

function match(c, ctx) {
  // Detect: identifier.flatMap(...)
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance();
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance();
  var result = c.isIdent('flatMap') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // .flatMap() is NOT supported by Smith's map pipeline.
  //
  // Why no implementation:
  //   - .flatMap() REPLACES .map() rather than chaining before it — it IS the
  //     mapping function with array-returning semantics
  //   - _identifierStartsMapCall (brace.js) does not recognize .flatMap()
  //   - The love2d reference compiler does not handle .flatMap()
  //   - Two sub-patterns exist with different compilation requirements:
  //     a) Fixed-count return [<A/>, <B/>] → pool size = items.len * N,
  //        each iteration fills N slots (tractable but not implemented)
  //     b) Variable-count return (conditional arrays) → needs runtime pooling
  //        (equivalent to nested map with inline arrays)
  //
  // Workarounds:
  //   - Use multiple children inside a single .map() callback
  //   - Use nested .map() (p021) for the variable-count case
  //   - Restructure data so each item maps to a single element
  //
  // This pattern is documented for completeness. match() detects it so the
  // compiler can produce a meaningful diagnostic rather than a cryptic failure.
  return null;
}

_patterns[37] = { id: 37, match: match, compile: compile };

})();
