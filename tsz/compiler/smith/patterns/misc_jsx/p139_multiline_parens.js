(function() {
// ── Pattern 139: Multiline parenthesized JSX ───────────────────
// Index: 139
// Group: misc_jsx
// Status: complete
//
// Soup syntax (copy-paste React):
//   function App() {
//     return (
//       <Box>
//         <Text>hello</Text>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   .{
//     .children = &[_]Node{
//       .{ .text = "hello" },
//     },
//   }
//
// Notes:
//   Parenthesized multiline JSX is already supported across the main entry
//   points:
//   - collect/components.js skips an optional `(` after `return`
//   - parse/map/header.js skips an optional `(` before JSX in map callbacks
//   - soup.js explicitly searches for `return (` when extracting soup JSX
//
//   The parens are purely structural; the actual node compilation still flows
//   through parseJSXElement().

function match(c, ctx) {
  if (c.kind() !== TK.lparen) return false;
  var saved = c.save();
  c.advance();
  while (c.kind() === TK.comment) c.advance();
  var result = c.kind() === TK.lt;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  c.advance(); // (
  while (c.kind() === TK.comment) c.advance();
  return parseJSXElement(c);
}

_patterns[139] = { id: 139, match: match, compile: compile };

})();
