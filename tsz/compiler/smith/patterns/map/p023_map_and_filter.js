// ── Pattern 023: .map() with && short-circuit ──────────────────
// Index: 23
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map((item) => (
//     item.visible && (
//       <Box style={{padding: 8}}>
//         <Text>{item.name}</Text>
//       </Box>
//     )
//   ))}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   for (0.._oa0_len) |_i| {
//     if ((_oa0_visible[_i]) != 0) {
//       _map_pool_0[_map_count_0] = .{ .style = .{ .padding = .{ .all = 8 } },
//         .children = &_arr_0 };
//       _map_count_0 += 1;
//     }
//     // else: node not added to pool (filtered out)
//   }
//
// Notes:
//   This is the render-time filter pattern. Unlike .filter().map() (p030),
//   the filtering happens inside the map callback via &&. The falsy branch
//   produces no node — the item is simply skipped.
//
//   The condition (left side of &&) gets resolved through the OA field
//   system and wrapped by _wrapMapCondition(). The truthy branch (right
//   side) is the JSX template.
//
//   This is effectively a ternary with null as the else branch:
//   item.visible ? <Box>...</Box> : null
//
//   The emit pass generates a conditional inside the for loop that only
//   increments _map_count when the condition is true.
//
//   See conformance: d67_conditional_in_map_component.tsz,
//   d17_map_conditional_card.tsz

function match(c, ctx) {
  // Inside a map body, the return expression uses && short-circuit:
  //   (item) => item.show && <JSX>
  //
  // Detection: after map header, the body starts with an expression
  // followed by && and then JSX. Parsed by brace child handling
  // which recognizes logical && with JSX on the right.
  return false;
}

function compile(c, ctx) {
  // Compilation:
  //   1. Map header parsed normally by tryParsePlainMap
  //   2. Template body encounters && expression in brace children
  //   3. Left side: condition → OA field lookup + _wrapMapCondition
  //   4. Right side: JSX element → normal node compilation
  //   5. Emit wraps in if() inside the for loop
  //   6. _map_count only incremented when condition passes
  //   7. Nodes after the conditional count are .display = .none
  return null;
}
