(function() {
// ── Pattern 055: Spread + override ──────────────────────────────
// Index: 55
// Group: props
// Status: complete
//
// Matches: {...obj} followed by explicit attr=value overrides
// This is a compile-time ordering pattern, not a distinct syntax.
// In React, <Btn {...defaults} color="red" /> means color="red"
// wins over defaults.color. The pattern system handles this by
// processing spread first (p054), then later props overwrite.
//
// React:   <Button {...defaults} variant="primary" />
// Zig:     spread fields applied first, then variant="primary" overwrites
//
// This pattern is a no-op recognizer — the override behavior is
// inherent in prop collection order. p054 handles the spread,
// subsequent attr= patterns overwrite as needed.

function match(c, ctx) {
  // Detect: spread followed by at least one more prop
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  if (next >= c.count || c.kindAt(next) !== TK.spread) return false;
  // Find closing } of spread
  var look = next + 1;
  while (look < c.count && c.kindAt(look) !== TK.rbrace) look++;
  look++; // past }
  // Must have another identifier (override prop) after the spread
  return look < c.count && c.kindAt(look) === TK.identifier;
}

function compile(c, ctx) {
  // Delegate to p054 for the spread itself.
  // Override props are handled by subsequent pattern matches in the attr loop.
  // Return null to let the caller fall through to p054.
  return null;
}

_patterns[55] = { id: 55, group: 'props', name: 'spread_override', match: match, compile: compile };

})();
