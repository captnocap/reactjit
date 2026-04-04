(function() {
// ── Pattern 004: Null render (swallowed) ────────────────────────
// Index: 4
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{null}</Text>
//
// Mixed syntax (hybrid):
//   <Text>{null}</Text>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   (nothing — null renders are swallowed per React spec)
//
// Notes:
//   React swallows null in JSX children. This is the explicit-null
//   counterpart to the ternary-null pattern (p012). Used in conditional
//   rendering: {condition ? <Component /> : null}. The null branch
//   must not emit any node.

function match(c, ctx) {
  if (c.kind() !== TK.identifier) return false;
  if (c.text() !== 'null') return false;
  var saved = c.save();
  c.advance();
  var isMatch = c.kind() === TK.rbrace;
  c.restore(saved);
  return isMatch;
}

function compile(c, ctx) {
  c.advance(); // consume null
  if (c.kind() === TK.rbrace) c.advance(); // consume }
  return null;
}

_patterns[4] = { id: 4, match: match, compile: compile };

})();
