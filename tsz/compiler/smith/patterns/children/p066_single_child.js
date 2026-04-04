// ── Pattern 066: single child ──────────────────────────────────
// Index: 66
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box><Text>hi</Text></Box>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   var _arr_0 = [_]Node{ .{ .text = "hi" } };
//   var _root = Node{ .children = &_arr_0 };
//
// Notes:
//   parseChildren() walks until the matching close tag and appends each parsed
//   child in order. For the single-child case, buildNode() still allocates one
//   `_arr_N` and attaches it as `.children`.
//
//   This is the normal container path for non-Text parents. Text parents have
//   an extra hoist optimization in buildNode() and are covered more directly by
//   p068.
//
//   The distinction between p066 and p067 is made after parseChildren() has
//   already produced the full child array.

function match(c, ctx) {
  // Structural pattern decided after parseChildren() returns one child.
  return false;
}

function compile(c, ctx) {
  // Owned by parseChildren() + buildNode().
  return null;
}
