// ── Pattern 074: Dot notation component ──────────────────────────
// Index: 74
// Group: component_ref
// Status: stub
//
// Soup syntax (copy-paste React):
//   <Form.Input />
//   <UI.Button variant="primary" />
//
// Mixed syntax (hybrid):
//   <Form.Input />
//   <UI.Button variant="primary" />
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Namespaced component lookup
//   .{
//     .tag = .Form_Input,  // or namespaced reference
//     .props = .{ .variant = "primary" },
//   }
//
// Notes:
//   Dot notation components like <Namespace.Component /> are common
//   in design systems. The namespace (Form, UI) is an object containing
//   component definitions. We resolve the full path and emit the
//   corresponding component reference.
//   This requires namespace resolution in the symbol table.

function match(c, ctx) {
  // Look for <Identifier.Identifier pattern
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 2 >= c.count) return false;
  return (
    c.kindAt(c.pos + 1) === TK.identifier &&
    c.kindAt(c.pos + 2) === TK.dot &&
    c.pos + 3 < c.count &&
    c.kindAt(c.pos + 3) === TK.identifier
  );
}

function compile(c, ctx) {
  // TODO: Parse namespace.Component reference
  // 1. Extract namespace and component name
  // 2. Resolve in symbol table / imports
  // 3. Emit component reference with namespacing preserved or flattened
  return null;
}

module.exports = {
  id: 74,
  name: 'dot_notation',
  status: 'stub',
  match,
  compile,
};
