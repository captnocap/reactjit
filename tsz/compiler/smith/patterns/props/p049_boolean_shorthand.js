// ── Pattern 049: Boolean shorthand ─────────────────────────────
// Index: 49
// Group: props
// Status: complete
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
//   Shorthand booleans exist in the parser, but only partially.
//
//   Native element parsing already has a bare-attr path in parseJSXElement():
//   identifiers without `=` still flow through parseElementAttr(), which is
//   how flags like `bold`, `background`, and literal-mode `l` work today.
//
//   Component props are weaker. collectComponentPropValues() only records an
//   attribute when it is followed by `=`, so `<C disabled />` is currently
//   advanced past and dropped at the component-call layer.
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
  // Boolean shorthand: bare attribute name with no = after it.
  // Consume the identifier and return true as the prop value.
  var name = c.text();
  c.advance();
  return { value: 'true', attr: name };
}
