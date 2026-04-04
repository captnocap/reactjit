// ── Pattern 088: forwardRef ─────────────────────────────────────
// Index: 88
// Group: composition
// Status: stub
//
// Soup syntax (copy-paste React):
//   const FancyInput = React.forwardRef((props, ref) => (
//     <input ref={ref} className="fancy" {...props} />
//   ));
//   // Usage: <FancyInput ref={inputRef} />
//
// Mixed syntax (hybrid):
//   // forwardRef doesn't have a direct mixed equivalent.
//   // In our framework, ref handling is implicit — the runtime
//   // manages node references through the tree structure.
//   <TextInput className="fancy" />
//
// Zig output target:
//   // Refs in our framework are node tree indices, not React refs.
//   // The compiled output is just a normal node with no ref concept.
//   .{ .style = .{ ... } }
//
// Notes:
//   React's forwardRef is a mechanism for passing refs through
//   components to their children. It solves a React-specific problem
//   (function components can't receive refs by default).
//
//   In our compiler, this pattern is NOT APPLICABLE because:
//   1. We don't have React refs — the node tree IS the reference
//   2. Components are statically inlined, not runtime instances
//   3. The runtime can address any node by tree index
//
//   forwardRef calls in soup mode are simply ignored — the inner
//   component body is parsed normally through collectComponents.

function match(c, ctx) {
  // forwardRef is a module-scope wrapper, not a JSX pattern.
  return false;
}

function compile(c, ctx) {
  // Not applicable — our framework doesn't need ref forwarding.
  return null;
}
