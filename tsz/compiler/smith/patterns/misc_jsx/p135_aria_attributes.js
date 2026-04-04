// ── Pattern 135: ARIA / role attrs ─────────────────────────────
// Index: 135
// Group: misc_jsx
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box aria-label="close" role="button" />
//   <Text aria-hidden="true">Decorative</Text>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Desired:
//   // accessibility metadata attached to the generated node tree
//
// Notes:
//   There is no ARIA attr compilation path today.
//   - Hyphenated names like `aria-label` are split by the lexer and never
//     arrive as a single attr key.
//   - Bare identifier attrs like `role` *do* parse as a key, but unknown attrs
//     fall through attrs_dispatch.js and are simply consumed and dropped.
//
//   The framework may grow a native accessibility layer later, but that would
//   need explicit node fields and emit plumbing. React/HTML ARIA strings are
//   not currently preserved.

function match(c, ctx) {
  // aria-* attribute or role attribute
  if (c.kind() !== TK.identifier) return false;
  var t = c.text();
  if (t === 'role') return true;
  if (t === 'aria') {
    if (c.pos + 1 >= c.count) return false;
    return c.kindAt(c.pos + 1) === TK.minus;
  }
  return false;
}

function compile(c, ctx) {
  // Intentionally outside the current node-field model.
  return null;
}
