// ── Pattern 071: Array children ─────────────────────────────────
// Index: 71
// Group: children
// Status: stub
//
// Soup syntax (copy-paste React):
//   <Box>{[<A />, <B />]}</Box>
//
// Mixed syntax (hybrid):
//   <Box>{[<A />, <B />]}</Box>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Array literal children are flattened into parent children array
//   .{
//     .sub_nodes = &[_]Node{
//       .{ .tag = .A, ... },
//       .{ .tag = .B, ... },
//     },
//   }
//
// Notes:
//   Array children are wrapped in {} inside JSX. The array literal [...]
//   contains JSX elements that should be treated as multiple children.
//   This pattern handles the array literal wrapper, delegating element
//   parsing to p006_jsx_element for each array item.
//   Related: p067_multiple_children handles siblings without array wrapper.

function match(c, ctx) {
  // Look for { [...] } pattern - an array literal inside JSX expression
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lbracket;
}

function compile(c, ctx) {
  // TODO: Parse array literal containing JSX elements
  // 1. Consume opening { and [
  // 2. Parse each element in array (may be JSX elements, expressions, etc.)
  // 3. Handle spread elements ...arr
  // 4. Consume closing ] and }
  // 5. Return array of compiled child nodes
  return null;
}

module.exports = {
  id: 71,
  name: 'array_children',
  status: 'stub',
  match,
  compile,
};
