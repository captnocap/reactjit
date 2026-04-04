// ── Pattern 022: .map() with ternary ───────────────────────────
// Index: 22
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map((item) => (
//     item.active ? (
//       <Box style={{backgroundColor: "#1e40af"}}>
//         <Text>{item.name}</Text>
//       </Box>
//     ) : (
//       <Box style={{backgroundColor: "#334155"}}>
//         <Text>{item.name} (inactive)</Text>
//       </Box>
//     )
//   ))}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   for (0.._oa0_len) |_i| {
//     if ((_oa0_active[_i]) != 0) {
//       _map_pool_0[_i] = .{ .style = .{ .bg_r = 0x1e, ... }, .children = &_arr_0 };
//     } else {
//       _map_pool_0[_i] = .{ .style = .{ .bg_r = 0x33, ... }, .children = &_arr_1 };
//     }
//   }
//
// Notes:
//   Inside a .map() callback, the return value is a ternary expression.
//   The parser (brace.js) sees a ternary inside the map body and emits
//   a conditional node. The condition references an OA field which gets
//   wrapped by _wrapMapCondition() to produce valid Zig bool expressions.
//
//   The ternary branches each produce independent template nodes with
//   potentially different child arrays. The emit pass generates an
//   if/else inside the map's for loop.
//
//   When the condition uses item.field comparisons (===, !==), they get
//   normalized through resolve/comparison.js (=== → ==, string → mem.eql).
//
//   If one branch is null, this degrades to pattern 023 (map + &&).
//
//   See conformance: d61_map_ternary_branch.tsz,
//   d108_ternary_component_in_map.tsz, d17_map_conditional_card.tsz

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
  // Compilation happens through the normal map + ternary pipeline:
  //   1. tryParsePlainMap() parses the map header
  //   2. parseJSXElement() is called for the template body
  //   3. Inside the template, brace child parsing encounters the ternary
  //   4. brace/ternary.js compiles it with resolve/ternary.js
  //   5. The condition gets OA field resolution (item.active → _oa0_active[_i])
  //   6. _wrapMapCondition() ensures valid Zig bool expression
  //   7. Both branches produce node expressions
  //   8. The emit pass generates if/else inside the for loop
  //
  // The OA may need _computedHasTernary flag for .none/.flex handling
  // when ternary branches produce elements vs null.
  return null;
}
