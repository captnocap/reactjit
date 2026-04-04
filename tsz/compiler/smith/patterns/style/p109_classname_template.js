// ── Pattern 109: className template literal ─────────────────────
// Index: 109
// Group: style
// Status: complete
//
// Soup syntax (copy-paste React):
//   <div className={`btn ${variant}`} />
//   <Box className={`card card-${size}`} />
//
// Mixed syntax (hybrid):
//   Not applicable — use inline styles or classifiers.
//
// Zig output target:
//   // className is DROPPED with a warning.
//   // Warning: [W] dynamic className dropped
//
// Notes:
//   Same handling as p107/p108 — all className values are dropped.
//   Template literal className is a dynamic className and gets the
//   "[W] dynamic className dropped" warning.
//
//   Status is "complete" because dropping with a warning is correct.

function match(c, ctx) {
  // className={`template`}
  if (c.kind() !== TK.identifier) return false;
  var t = c.text();
  if (t !== 'className' && t !== 'class') return false;
  if (c.pos + 3 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.equals &&
         c.kindAt(c.pos + 2) === TK.lbrace &&
         c.kindAt(c.pos + 3) === TK.template_literal;
}

function compile(c, ctx) {
  return null;
}
