// ── Pattern 075: Dynamic component variable ──────────────────────
// Index: 75
// Group: component_ref
// Status: stub
//
// Soup syntax (copy-paste React):
//   const C = components[type];
//   <C />
//
// Mixed syntax (hybrid):
//   const C = components[type];
//   <C />
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Dynamic lookup requires runtime dispatch
//   .{
//     .tag = .Dynamic,
//     .props = .{
//       .component_ref = _resolveComponent(components, type),
//       // ...other props
//     },
//   }
//
// Notes:
//   When a variable (not literal) is used as JSX tag: <Component />.
//   The variable's value determines which component renders.
//   This requires runtime dispatch since the component type is not
//   known at compile time. Limited support in static compilation -
//   may require explicit component registry or inline switch.
//   See also: p076_dynamic_ternary for choosing between known options.

function match(c, ctx) {
  // Dynamic component: variable used as tag name
  // <VarName /> where VarName is not a known component
  // This is detected when the tag is an uppercase identifier
  // that doesn't resolve to a static component definition
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  var next = c.tokenAt(c.pos + 1);
  if (next.kind !== TK.identifier) return false;
  var firstChar = next.text[0];
  // Uppercase but not a known static component
  if (firstChar < 'A' || firstChar > 'Z') return false;
  // Would need ctx to check if it's a known component
  // For now, this is handled by fallback in component resolution
  return false;
}

function compile(c, ctx) {
  // TODO: Emit runtime component dispatch
  // Options:
  // 1. Generate a switch on known component types
  // 2. Use a component registry lookup
  // 3. Emit Cartridge wrapper with dynamic src
  return null;
}

module.exports = {
  id: 75,
  name: 'dynamic_variable',
  status: 'stub',
  match,
  compile,
};
