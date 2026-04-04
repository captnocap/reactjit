// ── Pattern 072: Self-closing element (no children) ──────────────
// Index: 72
// Group: children
// Status: stub
//
// Soup syntax (copy-paste React):
//   <Image src="a.png" />
//   <Box></Box>
//
// Mixed syntax (hybrid):
//   <Image src="a.png" />
//   <Box />
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   .{
//     .tag = .Image,
//     .props = .{ .src = "a.png" },
//     .sub_nodes = &[_]Node{}, // empty children array
//   }
//
// Notes:
//   Self-closing tags end with /> and have no children. Empty tags
//   <Box></Box> are equivalent. The parser should handle both forms
//   and produce a node with an empty sub_nodes array.
//   This is the base case for element parsing - all elements can
//   potentially have no children.

function match(c, ctx) {
  // Self-closing tag detection happens during element parsing
  // This pattern serves as a marker for the "no children" case
  // Actual matching is done by the element parser seeing /> or </tag>
  return false; // Not a standalone pattern - handled by element parser
}

function compile(c, ctx) {
  // No compilation needed - children list is simply empty
  // The parent element parser handles this case
  return { children: [] };
}

module.exports = {
  id: 72,
  name: 'no_children',
  status: 'stub',
  match,
  compile,
};
