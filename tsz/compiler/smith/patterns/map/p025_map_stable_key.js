// ── Pattern 025: .map() with stable key ────────────────────────
// Index: 25
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map((item) => (
//     <Box key={item.id}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // key={item.id} is parsed and discarded. No key field in the node.
//   // Pool ordering matches OA ordering — identity is positional.
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .children = &_arr_0 };
//   }
//
// Notes:
//   In React, key={item.id} enables efficient reconciliation when
//   items are reordered, added, or removed. In our compiled model,
//   there is no reconciler — the OA is the source of truth, and the
//   pool is rebuilt from scratch on every state change.
//
//   The key attribute is stripped during attribute parsing (attrs_basic.js
//   skips attrName === 'key'). The item.id field may still be used
//   elsewhere in the template (e.g. as a prop or in text), in which
//   case it's a normal OA field access.
//
//   This pattern is "complete" because key handling is intentionally
//   a no-op in our compilation model. React keys exist for diffing;
//   we don't diff.
//
//   See also: p024 (index key), p026 (compound key)

function match(c, ctx) {
  // A map with key={item.field} on the root element.
  // Same parse path as any map — key is stripped in attrs.
  return false;
}

function compile(c, ctx) {
  // No special compilation needed. Key is consumed and discarded.
  // The field used as key (item.id) may still be referenced
  // elsewhere and will be a normal OA field.
  return null;
}
