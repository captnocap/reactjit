// ── Pattern 067: multiple children ─────────────────────────────
// Index: 67
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box><A /><B /><C /></Box>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   var _arr_0 = [_]Node{
//     .{ ...A... },
//     .{ ...B... },
//     .{ ...C... },
//   };
//   var _root = Node{ .children = &_arr_0 };
//
// Notes:
//   parseChildren() preserves child order while interleaving element, brace,
//   and text child parsing. buildNode() then materializes a `_arr_N` with one
//   entry per parsed child and wires all dynamic-text / map / conditional
//   bookkeeping back onto that array.
//
//   The current compiler emits this path correctly for multiple static
//   children; the generated array for the verification probe was:
//     [_]Node{ .{ .text = "a" }, .{ .text = "b" }, .{ .text = "c" } }

function match(c, ctx) {
  // Structural pattern decided after parseChildren() returns >1 child.
  return false;
}

function compile(c, ctx) {
  // Owned by parseChildren() + buildNode().
  return null;
}
