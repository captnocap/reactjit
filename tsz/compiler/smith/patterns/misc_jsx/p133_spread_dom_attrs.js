// ── Pattern 133: Spread on native element ──────────────────────
// Index: 133
// Group: misc_jsx
// Status: partial
//
// Soup syntax (copy-paste React):
//   <div {...domProps} />
//   <input {...fieldProps} />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Desired:
//   // expand supported native attrs from the spread source into node/style fields
//   // before buildNode(...)
//
// Notes:
//   This is partial rather than complete because the underlying native attrs
//   *are* supported when spelled explicitly, but spread syntax is not.
//
//   parseJSXElement() only dispatches attrs when the next token is an
//   identifier; `{...domProps}` starts with TK.lbrace, so the loop just
//   advances token-by-token and drops it.
//
//   This is different from component spread (p054), which has a dedicated
//   parser in parse/element/component_spread.js. That support does not apply
//   to native JSX elements.

function match(c, ctx) {
  return c.kind() === TK.lbrace &&
    c.pos + 2 < c.count &&
    c.kindAt(c.pos + 1) === TK.spread &&
    c.kindAt(c.pos + 2) === TK.identifier;
}

function compile(c, ctx) {
  // Documentary only. Explicit attrs compile; spread attrs on native elements
  // currently fall through and are dropped.
  return null;
}
