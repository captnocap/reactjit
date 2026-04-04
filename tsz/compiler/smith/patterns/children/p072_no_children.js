(function() {
// ── Pattern 072: Self-closing element (no children) ──────────────
// Index: 72
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Image src="a.png" />
//   <Box style={{width: 100}} />
//   <input type="text" />
//
// Mixed syntax (hybrid):
//   <Image src="a.png" />
//   <Box />
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Empty children array
//   var _root = Node{
//     .tag = .Image,
//     .props = .{ .src = "a.png" },
//     .children = &[_]Node{},
//   };
//
// Notes:
//   Self-closing tags end with /> and have no children content.
//   This is the base case for element parsing - all elements can
//   potentially have no children. The element parser detects the />
//   token and skips child parsing entirely.
//
//   Empty open/close pairs <Box></Box> are semantically equivalent
//   to <Box /> and produce the same output.
//
//   Implemented in parse.js → parseJSXElement() which checks for
//   TK.slash_gt (/>) after attributes to determine if children exist.

function match(c, ctx) {
  // Detected during element parsing by the /> token
  // Not a standalone pattern - parseJSXElement handles this
  if (c.kind() !== TK.lt) return false;
  var saved = c.save();
  c.advance(); // skip <
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  // Skip tag name
  c.advance();
  // Scan forward for /> or >
  while (c.kind() !== TK.eof && c.kind() !== TK.gt && c.kind() !== TK.slash_gt) {
    c.advance();
  }
  var isSelfClosing = c.kind() === TK.slash_gt;
  c.restore(saved);
  return isSelfClosing;
}

function compile(c, ctx) {
  // parseJSXElement handles self-closing detection.
// When /> is found, children parsing is skipped.
  return null;
}

_patterns[72] = {
  id: 72,
  name: 'no_children',
  status: 'complete',
  match,
  compile,
};

})();
