// ── Pattern 070: mixed children ────────────────────────────────
// Index: 70
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box><Text>hi</Text>{name}<A /></Box>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   var _arr_0 = [_]Node{
//     .{ .text = "hi" },
//     .{ .text = "Ada" },
//     .{ ...A... },
//   };
//   var _root = Node{ .children = &_arr_0 };
//
// Notes:
//   parseChildren() interleaves:
//     - element children from tryParseElementChild()
//     - brace children from tryParseBraceChild()
//     - raw text children from tryParseTextChild()
//
//   The resulting child list preserves source order. buildNode() only hoists
//   a single static text child on Text parents; once the child list is mixed,
//   it emits a normal `_arr_N` array and keeps every entry in order.
//
//   The verification probe for:
//     <Box><Text>hi</Text>{name}<Badge /></Box>
//   generated:
//     [_]Node{ .{ .text = "hi" }, .{ .text = "Ada" }, .{ .text = "!" } }

function match(c, ctx) {
  // Structural pattern decided after parseChildren() returns a mixed child list.
  return false;
}

function compile(c, ctx) {
  // Owned by parseChildren() + buildNode().
  return null;
}
