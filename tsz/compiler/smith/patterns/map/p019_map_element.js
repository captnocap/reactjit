(function() {
// ── Pattern 019: .map() → element ───────────────────────────────
// Index: 19
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map(item => <Box>{item.name}</Box>)}
//   {items.map((item, i) => (
//     <Box key={item.id} style={{padding: 8}}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   {items.map(item => <Box>{item.name}</Box>)}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Object Array (OA) pools declared for each field:
//   //   var _oa0_name: [64][256]u8 = undefined;
//   //   var _oa0_name_lens: [64]u32 = .{0} ** 64;
//   //   var _oa0_id: [64]i64 = .{0} ** 64;
//   //   var _oa0_len: usize = 0;
//   //
//   // Map pool array for rendered nodes:
//   //   var _map0_pool: [64]Node = .{.{}} ** 64;
//   //
//   // In rebuild function:
//   //   for (0.._oa0_len) |_i| {
//   //     _map0_pool[_i] = .{
//   //       .style = .{ .padding = .{ .top = 8, .bottom = 8, .left = 8, .right = 8 } },
//   //       .sub = &_map0_children_0,
//   //     };
//   //     // dynamic text per item:
//   //     _ = std.fmt.bufPrint(&_mt0_buf[_i], "{s}", .{
//   //       _oa0_name[_i][0.._oa0_name_lens[_i]]
//   //     }) catch "";
//   //   }
//
// Notes:
//   .map() is the core list rendering pattern. The compiler:
//   1. Identifies the getter (state slot array) — e.g., `items` → slot N
//   2. Infers item shape from usage (item.name, item.id, etc.)
//   3. Creates Object Array (OA) pools: parallel typed arrays for each field
//   4. Creates a map pool for the rendered Node structs
//   5. In the rebuild function, iterates with for(0.._oaN_len) and
//      populates each pool entry from OA field data
//   6. Dynamic text inside maps uses per-item buffers (__mtN__)
//   Field type inference: strings → [64][256]u8 + _lens, numbers → [64]i64,
//   booleans → [64]i64 (0/1). Nested fields (item.a.b) flatten to a_b.
//   Key handling: key={item.id} is tracked but doesn't affect Zig output
//   (static array, no reconciliation needed).
//   Destructured params ({name, id}) are supported (p027).
//   Computed getters (filter/sort chains) create synthetic OAs (p030-p038).
//   Conformance tests: d01_nested_maps.tsz, d53_compound_conditionals.tsz,
//   d61_map_ternary_branch.tsz, many others.
//   Full implementation: parse/children/brace.js (map detection + OA inference),
//   emit/map_pools.js (Zig pool declarations + rebuild loops)
//   Love2d reference: tslx_compile.mjs line ~592 (listRebuilders)

function match(c, ctx) {
  // Look for `identifier.map(` or `identifier[expr].map(` pattern.
  // The identifier should resolve to a state getter (array slot).
  var saved = c.save();
  // First token should be an identifier
  if (c.kind() !== TK.identifier) {
    c.restore(saved);
    return false;
  }
  c.advance();
  // Walk through dot-access chains: items.map or data.items.map
  while (c.kind() === TK.dot && c.pos + 1 < c.count) {
    c.advance(); // skip .
    if (c.kind() === TK.identifier && c.text() === 'map') {
      c.advance(); // skip 'map'
      if (c.kind() === TK.lparen) {
        c.restore(saved);
        return true;
      }
    }
    if (c.kind() !== TK.identifier) break;
    c.advance(); // skip field name
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Delegates to the map parsing infrastructure in brace.js which:
  // 1. Identifies getter name → resolves to state slot or OA
  // 2. Parses .map( callback ) — extracts item param and optional index param
  // 3. Scans callback body to infer field shapes (item.x usages)
  // 4. Creates OA entry in ctx.objectArrays with field definitions
  // 5. Sets ctx.currentMap for nested parsing context
  // 6. Parses callback body JSX (single element for this pattern)
  // 7. Registers map in ctx.maps with all metadata
  // 8. Restores ctx.currentMap
  // 9. Pushes map wrapper node to children
  // The emit phase (map_pools.js) then generates:
  //   - OA pool declarations (typed arrays per field)
  //   - Map pool array for rendered nodes
  //   - Rebuild function with for loop
  //   - Per-item dynamic text buffers
  return null; // Handled by brace.js map dispatcher
}

_patterns[19] = { id: 19, match: match, compile: compile };

})();
