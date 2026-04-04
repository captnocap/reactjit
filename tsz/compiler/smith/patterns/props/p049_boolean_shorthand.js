// ── Pattern 049: Boolean shorthand ─────────────────────────────
// Index: 49
// Group: props
// Status: stub
//
// Soup syntax (copy-paste React):
//   <Button disabled />
//   <Modal open />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Desired:
//   propValues["disabled"] = true;
//   // so inline component bodies can treat the prop as a real boolean flag
//
// Notes:
//   Not implemented in the current component prop collector.
//   collectComponentPropValues() only records an attribute when it is followed
//   by `=`. A bare identifier attr is currently advanced past and dropped.
//
//   Supporting this would require an attribute-position rule roughly like:
//     if (attr seen and next token !== '=') propValues[attr] = true;
//   plus real boolean normalization so downstream conditionals can distinguish
//   true from false instead of treating both as non-empty strings.

function match(c, ctx) {
  // Attribute-position pattern: identifier with no equals after it.
  if (c.kind() !== TK.identifier) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) !== TK.equals;
}

function compile(c, ctx) {
  // No live implementation yet.
  return null;
}
