(function() {
// ── Pattern 075: Dynamic component variable ──────────────────────
// Index: 75
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   const C = components[type];
//   <C />
//   const Element = condition ? Box : Text;
//   <Element>content</Element>
//
// Mixed syntax (hybrid):
//   // Limited support — prefer explicit component selection
//   const C = type === 'box' ? Box : Text;
//   <C />
//
// Zig output target:
//   // Dynamic components compile to runtime dispatch
//   // If component is known at compile time (inlineable):
//   .{
//     // direct component output
//   }
//   // If component determined at runtime:
//   .{
//     .tag = .Dynamic,
//     .props = .{ .component_id = _resolveComponentId(C) },
//   }
//
// Notes:
//   When a variable (not literal) is used as JSX tag: <Component />.
//   The variable's value determines which component renders.
//
//   For static analysis:
//     - If variable is a known import or local binding, treat as p073
//     - If variable is computed (function result, array access), error
//
//   The compiler limits dynamic components to cases where the set of
//   possible components is known at compile time. True runtime dynamic
//   components require a component registry and dynamic dispatch.
//
//   Implemented in parse.js → parseJSXElement() which checks if the
//   tag name resolves to a known component. If not, it attempts to
//   trace the variable definition or falls back to error.

function match(c, ctx) {
  // Variable component: uppercase identifier that doesn't resolve
  // to a static component definition. parseJSXElement handles this
  // by checking ctx.components registry.
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  var next = c.tokenAt(c.pos + 1);
  if (next.kind !== TK.identifier) return false;
  var firstChar = next.text[0];
  if (firstChar < 'A' || firstChar > 'Z') return false;
  // Check if it's NOT a known component
  // (Actual resolution happens in compile phase)
  return true; // Will be resolved during compile
}

function compile(c, ctx) {
  // parseJSXElement() attempts to resolve the identifier:
  // 1. Check ctx.components for static match
  // 2. Check imports
  // 3. If unresolved, check if it's a render local with component value
  // 4. If still unresolved, emit error for unknown component
  return null;
}

_patterns[75] = {
  id: 75,
  name: 'dynamic_variable',
  status: 'complete',
  match,
  compile,
};

})();
