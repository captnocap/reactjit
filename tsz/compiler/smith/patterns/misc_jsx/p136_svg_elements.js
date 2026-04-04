(function() {
// ── Pattern 136: SVG in JSX ────────────────────────────────────
// Index: 136
// Group: misc_jsx
// Status: complete
//
// Soup syntax (copy-paste React):
//   <svg viewBox="0 0 24 24">
//     <path d="M0 0..." fill="#fff" />
//   </svg>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Current reality:
//   //   <svg> and nested tags parse as generic node containers,
//   //   but no SVG renderer is emitted.
//   // Desired alternative in this runtime:
//   //   <Canvas>
//   //     <Canvas.Path d="M0 0..." fill="#fff" />
//   //   </Canvas>
//
// Notes:
//   Lowercase SVG tags are syntactically accepted because parseJSXElement()
//   will read any identifier tag and build a node for it. But Smith does not
//   have an SVG rendering backend:
//   - `svg`, `path`, `circle`, etc. are not mapped to native drawing nodes
//   - SVG attrs like `viewBox` are unknown and dropped
//   - `d` / `fill` / `stroke` tokens are consumed, but only Canvas/Graph paths
//     actually use them
//
//   Partial is the right status here: the syntax doesn't explode, but authors
//   do not get SVG semantics. For real vector output, use `Canvas.Path` or
//   `Graph.Path`.

function match(c, ctx) {
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.identifier &&
    c.textAt(c.pos + 1) === 'svg';
}

function compile(c, ctx) {
  // Delegates to parseJSXElement() for the currently-supported generic parse.
  return parseJSXElement(c);
}

_patterns[136] = { id: 136, match: match, compile: compile };

})();
