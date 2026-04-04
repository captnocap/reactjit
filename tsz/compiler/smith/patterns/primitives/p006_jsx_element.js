(function() {
// ── Pattern 006: JSX element render ─────────────────────────────
// Index: 6
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box><Text>hi</Text></Box>
//
// Mixed syntax (hybrid):
//   <Box><Text>hi</Text></Box>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   .{
//     .style = .{ ... },
//     .sub_nodes = &[_]Node{
//       .{ .text = "hi" },
//     },
//   }
//
// Notes:
//   This is the fundamental JSX element pattern — an opening tag with
//   attributes, children, and a closing tag. The existing compiler
//   handles this entirely in parse.js:parseJSXElement(). Tags are
//   resolved through htmlTags (div→Box, span→Text, etc.), component
//   lookup, and classifier lookup. Attributes become style fields or
//   node fields. Children are recursively parsed.
//
//   This pattern delegates to parseJSXElement since element parsing
//   is deeply integrated with tag resolution, component inlining,
//   attribute normalization, and child recursion.

function match(c, ctx) {
  // An element starts with < followed by an identifier (tag name)
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  var nextKind = c.kindAt(c.pos + 1);
  // Must be identifier (tag) — not </ (close tag) or <> (fragment)
  return nextKind === TK.identifier;
}

function compile(c, ctx) {
  // Delegate to the main parseJSXElement which handles the full
  // element lifecycle: tag resolution, attrs, children, closing tag.
  return parseJSXElement(c);
}

_patterns[6] = { id: 6, match: match, compile: compile };

})();
