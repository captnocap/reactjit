// ── Pattern 026: .map() with compound key ──────────────────────
// Index: 26
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map((item) => (
//     <Box key={`${item.category}-${item.id}`}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Compound key is parsed and discarded, same as simple keys.
//   // No key field on the node struct. Pool index = identity.
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .children = &_arr_0 };
//   }
//
// Notes:
//   Template literal keys like `${a}-${b}` are common in React when
//   items don't have a single unique field. In our compiled model,
//   all keys are no-ops — the pool is rebuilt from scratch, so
//   identity is positional.
//
//   The template literal inside key={...} is parsed by the attribute
//   system but the entire key attribute is discarded (attrs_basic.js
//   skips attrName === 'key'). The template literal is never compiled
//   to a fmt/bufPrint call.
//
//   The fields referenced in the key (item.category, item.id) may
//   still be used elsewhere in the template and will be normal OA
//   field accesses there.
//
//   See also: p024 (index key), p025 (stable key)

function match(c, ctx) {
  // Map with key={template literal or expression} on root element.
  // Same parse path — key is stripped in attrs.
  return false;
}

function compile(c, ctx) {
  // No special compilation. Key is consumed and discarded.
  // Template literal in key position is never emitted.
  return null;
}
