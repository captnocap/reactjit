(function() {
// ── Pattern 074: Dot notation component ──────────────────────────
// Index: 74
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Form.Input />
//   <UI.Button variant="primary" />
//   <Modal.Header title="Welcome" />
//
// Mixed syntax (hybrid):
//   <Form.Input />
//   <UI.Button variant="primary" />
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Namespaced component — resolved through component registry
//   .{
//     .tag = .Button,  // UI.Button resolves to Button component
//     .props = .{ .variant = "primary" },
//   }
//   // Namespace (UI) is used for resolution then discarded
//
// Notes:
//   Dot notation components like <Namespace.Component /> are common
//   in design systems. The namespace (Form, UI, Modal) is an object
//   containing component definitions.
//
//   Resolution:
//     1. Resolve Namespace in component registry
//     2. Access .Component property
//     3. Use resolved component for inlining or cartridge
//
//   The namespace itself doesn't affect output — it's just a
//   resolution path. The final component name is what matters.
//
//   Implemented in parse.js → parseJSXElement() which handles
//   dot-notation tags by splitting on '.' and resolving the
//   qualified name through the component registry.

function match(c, ctx) {
  // <Namespace.Component pattern
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 3 >= c.count) return false;
  // Check for Identifier . Identifier sequence
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  if (c.kindAt(c.pos + 2) !== TK.dot) return false;
  if (c.kindAt(c.pos + 3) !== TK.identifier) return false;
  // First part should start with uppercase (namespace convention)
  var first = c.tokenAt(c.pos + 1).text;
  return first[0] >= 'A' && first[0] <= 'Z';
}

function compile(c, ctx) {
  // Delegates to parseJSXElement() which:
  // 1. Splits tag name on '.'
  // 2. Resolves namespace object
  // 3. Looks up component property
  // 4. Proceeds with resolved component as in p073
  return null;
}

_patterns[74] = {
  id: 74,
  name: 'dot_notation',
  status: 'complete',
  match,
  compile,
};

})();
