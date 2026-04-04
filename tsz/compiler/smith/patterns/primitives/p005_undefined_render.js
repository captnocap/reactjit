(function() {
// ── Pattern 005: Undefined render (swallowed) ───────────────────
// Index: 5
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{undefined}</Text>
//
// Mixed syntax (hybrid):
//   <Text>{undefined}</Text>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   (nothing — undefined renders are swallowed per React spec)
//
// Notes:
//   React swallows undefined in JSX children, same as null/boolean.
//   Common source: optional props that weren't passed, or functions
//   with no return value used in JSX. The compiler must not emit
//   "undefined" as visible text.

function match(c, ctx) {
  if (c.kind() !== TK.identifier) return false;
  if (c.text() !== 'undefined') return false;
  var saved = c.save();
  c.advance();
  var isMatch = c.kind() === TK.rbrace;
  c.restore(saved);
  return isMatch;
}

function compile(c, ctx) {
  c.advance(); // consume undefined
  if (c.kind() === TK.rbrace) c.advance(); // consume }
  return null;
}

_patterns[5] = { id: 5, match: match, compile: compile };

})();
