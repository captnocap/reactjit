(function() {
// ── Pattern 007: Fragment render ────────────────────────────────
// Index: 7
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <><A /><B /></>
//
// Mixed syntax (hybrid):
//   <><A /><B /></>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   .{
//     .sub_nodes = &[_]Node{
//       // children A, B...
//     },
//   }
//
// Notes:
//   Fragments (<>...</>) are shorthand for grouping children without
//   adding a DOM node. In our compiler, fragments compile to a Box
//   with no style — just sub_nodes. The existing compiler handles this
//   in parse/element/flow.js:tryParseFragmentElement(). After < is
//   consumed, if the next token is > (not an identifier), it's a
//   fragment opening. Children are parsed until </> is found.
//   The fragment becomes buildNode('Box', [], children, ...).

function match(c, ctx) {
  // Fragment: < immediately followed by > (no tag name)
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.gt;
}

function compile(c, ctx) {
  c.advance(); // consume <
  // Now cursor is on > — tryParseFragmentElement expects cursor on >
  return tryParseFragmentElement(c);
}

_patterns[7] = { id: 7, match: match, compile: compile };

})();
