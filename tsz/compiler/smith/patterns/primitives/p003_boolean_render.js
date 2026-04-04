(function() {
// ── Pattern 003: Boolean render (swallowed) ─────────────────────
// Index: 3
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{true}</Text>
//   <Text>{false}</Text>
//
// Mixed syntax (hybrid):
//   <Text>{true}</Text>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   (nothing — boolean renders are swallowed per React spec)
//
// Notes:
//   React swallows boolean values in JSX children — {true} and {false}
//   produce no visible output. The compiler detects bare `true`/`false`
//   identifiers inside braces and emits nothing. This is important for
//   patterns like {showX && <Component />} where the false branch
//   must not render "false" as text.

function match(c, ctx) {
  if (c.kind() !== TK.identifier) return false;
  var text = c.text();
  if (text !== 'true' && text !== 'false') return false;
  var saved = c.save();
  c.advance();
  var isMatch = c.kind() === TK.rbrace;
  c.restore(saved);
  return isMatch;
}

function compile(c, ctx) {
  c.advance(); // consume true/false
  if (c.kind() === TK.rbrace) c.advance(); // consume }
  // Swallowed — return null to emit nothing
  return null;
}

_patterns[3] = { id: 3, match: match, compile: compile };

})();
