// ── Pattern 024: .map() with index as key ──────────────────────
// Index: 24
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map((item, i) => (
//     <Box key={i}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Key is implicit — the pool index IS the key.
//   // No key field emitted on the struct. Pool ordering = iteration order.
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .children = &_arr_0 };
//   }
//
// Notes:
//   In React, key={i} (index as key) is an anti-pattern for reordering
//   but common for static lists. In our compiled model, keys are
//   irrelevant for rendering — the pool index IS the identity. There's
//   no virtual DOM diffing, no reconciliation. The node at pool[i]
//   always corresponds to OA row i.
//
//   The key attribute is parsed and discarded by attrs_basic.js
//   (attrName === 'key' → continue). The index parameter is still
//   captured by the map header for use in template literals and
//   expressions (e.g. {`Item ${i}`}).
//
//   The index param (second arg to map callback) is available as the
//   iteration variable in the Zig for loop. tryParseMapHeader captures
//   it as indexParam. If the map uses index in expressions, it maps
//   to _i (or _j for nested maps).
//
//   See also: p025 (stable key), p026 (compound key), p104 (missing key)

function match(c, ctx) {
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  while (c.kind() === TK.dot && c.pos + 1 < c.count) {
    c.advance(); // skip .
    if (c.kind() === TK.identifier && c.text() === 'map') {
      c.advance(); // skip 'map'
      if (c.kind() === TK.lparen) { c.restore(saved); return true; }
    }
    if (c.kind() !== TK.identifier) break;
    c.advance(); // skip field name
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // No special compilation. The key attribute is consumed and discarded.
  // The index parameter is available as the iteration variable.
  // Pool index = item identity. No reconciliation needed.
  return null;
}
