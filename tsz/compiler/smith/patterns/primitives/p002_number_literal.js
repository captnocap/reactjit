(function() {
// ── Pattern 002: Number literal render ──────────────────────────
// Index: 2
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{42}</Text>
//
// Mixed syntax (hybrid):
//   <Text>{42}</Text>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   .{ .text = "42" }
//
// Notes:
//   A bare number inside braces renders as static text. The number is
//   known at compile time so no dynamic text buffer is needed — we just
//   stringify it into the .text field. Handled in parse/children/brace.js
//   as a fallback when the brace content is a single number token.

function match(c, ctx) {
  // { NUMBER } — lbrace already consumed by caller. Peek: number token
  // followed by rbrace.
  if (c.kind() !== TK.number) return false;
  var saved = c.save();
  c.advance();
  var isMatch = c.kind() === TK.rbrace;
  c.restore(saved);
  return isMatch;
}

function compile(c, ctx) {
  var value = c.text();
  c.advance(); // consume number
  if (c.kind() === TK.rbrace) c.advance(); // consume }
  return { nodeExpr: '.{ .text = "' + value + '" }' };
}

_patterns[2] = { id: 2, match: match, compile: compile };

})();
