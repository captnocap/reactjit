// ── Pattern 133: Spread on native element ──────────────────────
// Index: 133
// Group: misc_jsx
// Status: complete
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
  // Spread on native DOM elements ({...props}) is NOT supported in the native
  // framework. Native elements have a fixed set of known attributes (style,
  // fontSize, placeholder, onPress, etc.) that must be spelled explicitly.
  //
  // Unlike component spread (p054) which has dedicated support in
  // parse/element/component_spread.js to expand prop objects into the
  // propStack, native element attributes require compile-time-known field
  // names to map into the Node struct.
  //
  // When {...domProps} appears on a native element, parseJSXElement() sees
  // TK.lbrace and advances past the spread without extracting any attrs.
  // The spread content is silently consumed and dropped.
  //
  // To support this, the compiler would need to:
  //   1. Resolve the spread source (render local, prop, etc.)
  //   2. Enumerate known attribute names from the resolved object
  //   3. Map each to the corresponding node field or style field
  //   4. This requires type information that Smith doesn't track
  //
  // For now, consume the spread tokens and return null. The explicit attrs
  // path is the supported mechanism.

  // Consume: {...identifier}
  if (c.kind() === TK.lbrace) c.advance();
  if (c.kind() === TK.spread) c.advance();
  // Skip everything until matching }
  var depth = 1;
  while (c.kind() !== TK.eof && depth > 0) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();

  return null;
}
