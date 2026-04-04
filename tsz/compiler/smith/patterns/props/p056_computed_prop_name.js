(function() {
// ── Pattern 056: Computed prop name ─────────────────────────────
// Index: 56
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Component {[dynamicKey]: value} />
//   <Box {[`data-${type}`]: id} />
//   <Input {[fieldName]: fieldValue} />
//
// Mixed syntax (hybrid):
//   Not applicable — chad syntax uses explicit named props.
//   Soup-only pattern.
//
// Zig output target:
//   // Would require runtime property resolution:
//   // The prop name is not known at compile time, so we'd need either:
//   //   1. QuickJS eval to resolve the key at runtime
//   //   2. A string-keyed prop map on the node (doesn't exist in Zig struct)
//   // Neither is currently implemented.
//
// Notes:
//   NOT IMPLEMENTED. The compiler does not support dynamic/computed property
//   names on JSX elements.
//
//   Zig structs require known field names at compile time. A computed prop
//   name like [dynamicKey] cannot be resolved to a struct field without
//   either:
//     1. Exhaustive enumeration of possible key values at compile time
//     2. Runtime string-keyed property map (contradicts static struct model)
//
//   This pattern is rare in practice. Most React code that uses computed
//   props does so for DOM data attributes or ARIA attributes, which have
//   dedicated handling (p134, p135).
//
//   If needed, the escape hatch is QuickJS eval for the entire component
//   or using explicit conditional props instead.

function match(c, ctx) {
  // { [ expression ] : value }
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 2 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lbracket;
}

function compile(c, ctx) {
  // Not applicable — Zig structs require compile-time field names.
  // Workaround: use explicit conditional props or data-* attributes (p134).
  return null;
}

_patterns[56] = { id: 56, match: match, compile: compile };

})();
