(function() {
// ── Pattern 137: Namespaced attrs ──────────────────────────────
// Index: 137
// Group: misc_jsx
// Status: complete
//
// Soup syntax (copy-paste React):
//   <use xlinkHref="#icon" />
//   <svg><use xlink:href="#icon" /></svg>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Desired:
//   // preserve the namespaced reference on an SVG-like node
//
// Notes:
//   Namespaced attrs are not compiled today.
//   - `xlinkHref` lexes as a normal identifier attr, but attrs_dispatch.js has
//     no handler for it, so the value is consumed and dropped
//   - `xlink:href` is even less compatible with the token model because the
//     colon splits the name into multiple tokens
//
//   This is blocked on first-class SVG support. Without an SVG target node,
//   preserving namespaced references has nowhere meaningful to land.

function match(c, ctx) {
  // identifier:identifier — namespaced attribute (e.g. xlink:href)
  if (c.kind() !== TK.identifier) return false;
  if (c.pos + 2 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.colon && c.kindAt(c.pos + 2) === TK.identifier;
}

function compile(c, ctx) {
  // Blocked on first-class SVG support; intentionally not compiled today.
  return null;
}

_patterns[137] = { id: 137, match: match, compile: compile };

})();
