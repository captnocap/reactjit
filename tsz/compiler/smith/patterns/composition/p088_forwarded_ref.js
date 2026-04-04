// ── Pattern 088: forwardRef ─────────────────────────────────────
// Index: 88
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   const FancyInput = React.forwardRef((props, ref) => (
//     <input ref={ref} className="fancy" {...props} />
//   ));
//   // Parent: const inputRef = useRef(null);
//   // Usage: <FancyInput ref={inputRef} placeholder="Type..." />
//
// Mixed syntax (hybrid):
//   // No ref forwarding needed — just use the component directly.
//   // The runtime addresses nodes by tree index, not by ref.
//   function FancyInput({ placeholder }) {
//     return <TextInput className="fancy" placeholder={placeholder} />;
//   }
//   // Usage: <FancyInput placeholder="Type..." />
//
// Zig output target:
//   // Compiles as a normal component (p086). No ref concept in output.
//   .{ .style = .{ ... }, .text_input = true }
//
// Notes:
//   React's forwardRef solves a React-specific problem: function
//   components can't receive refs by default because they don't have
//   instances. forwardRef wraps a component to make `ref` available
//   as a second argument.
//
//   This pattern is NOT APPLICABLE in our compiler because:
//
//   1. We don't have React refs. The node tree IS the reference system.
//      Every node has a deterministic index in the compiled tree.
//      The runtime can address any node by `nodes[i]`.
//
//   2. Components are statically inlined. There's no "instance" to ref.
//      `<FancyInput />` becomes its body nodes directly in the parent's
//      sub_nodes array.
//
//   3. The use cases for refs in React map to different mechanisms:
//      - Focus management → runtime event handlers (onMount focus)
//      - Measuring DOM elements → layout engine provides dimensions
//      - Imperative animations → effect system / GPU shaders
//      - Third-party DOM libs → not applicable (no DOM)
//
//   When the compiler encounters forwardRef in soup mode, it strips
//   the wrapper and parses the inner component body normally through
//   collectComponents. The `ref` parameter is ignored.

function match(c, ctx) {
  // Detect: forwardRef( or React.forwardRef(
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  var name = c.text();
  if (name === 'forwardRef') {
    c.advance();
    if (c.kind() === TK.lparen) { c.restore(saved); return true; }
    c.restore(saved);
    return false;
  }
  if (name === 'React') {
    c.advance(); // skip React
    if (c.kind() !== TK.dot) { c.restore(saved); return false; }
    c.advance(); // skip .
    if (c.kind() !== TK.identifier || c.text() !== 'forwardRef') { c.restore(saved); return false; }
    c.advance(); // skip forwardRef
    if (c.kind() === TK.lparen) { c.restore(saved); return true; }
    c.restore(saved);
    return false;
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Not applicable — no ref concept in our compilation model.
  return null;
}
