// ── Pattern 047: String prop ───────────────────────────────────
// Index: 47
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Card title="hello" />
//   <Button label="Save" />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // During component call collection:
//   propValues["title"] = "hello";
//   // When the component is inlined, propStack["title"] resolves to "hello"
//   // and downstream consumers inline it where needed.
//
// Notes:
//   Implemented in parse/element/component_props.js inside
//   collectComponentPropValues(). After `attr =`, if the value token is
//   TK.string the compiler stores c.text().slice(1, -1) directly into
//   propValues[attr].
//
//   This is the cleanest component-prop case:
//     - No brace parsing
//     - No runtime evaluation
//     - No handler special-casing
//     - Value is immediately available through ctx.propStack when the
//       component body is inlined

function match(c, ctx) {
  // Value side only: attr = "string"
  return c.kind() === TK.string;
}

function compile(c, ctx) {
  // Delegates to collectComponentPropValues() in component_props.js.
  return null;
}
