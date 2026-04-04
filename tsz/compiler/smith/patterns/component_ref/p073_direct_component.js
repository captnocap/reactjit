// ── Pattern 073: Direct component call ───────────────────────────
// Index: 73
// Group: component_ref
// Status: stub
//
// Soup syntax (copy-paste React):
//   <MyComp />
//   <UserCard user={user} />
//
// Mixed syntax (hybrid):
//   <MyComp />
//   <UserCard user={user} />
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // If inlined:
//   .{
//     .sub_nodes = &[_]Node{
//       // ...UserCard's rendered output
//     },
//   }
//   // If as cartridge:
//   .{
//     .tag = .Cartridge,
//     .props = .{ .src = "MyComp.so" },
//   }
//
// Notes:
//   Direct component reference where the tag name is an identifier
//   starting with uppercase (PascalCase). Components are resolved
//   through: 1) built-in registry, 2) imports, 3) local definitions.
//   May be inlined (render function body inserted) or loaded as
//   dynamic cartridge based on compiler configuration.
//   See also: p006_jsx_element for lowercase HTML-like tags.

function match(c, ctx) {
  // Component tag: starts with uppercase letter
  // Usually handled by the main element parser which checks isComponentTag()
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  var next = c.tokenAt(c.pos + 1);
  if (next.kind !== TK.identifier) return false;
  // Check if first char is uppercase
  var firstChar = next.text[0];
  return firstChar >= 'A' && firstChar <= 'Z';
}

function compile(c, ctx) {
  // TODO: Resolve component reference and either:
  // 1. Inline the component's render function body
  // 2. Emit a Cartridge node for dynamic loading
  // 3. Emit a component call with props passing
  return null;
}

module.exports = {
  id: 73,
  name: 'direct_component',
  status: 'stub',
  match,
  compile,
};
