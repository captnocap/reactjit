// ── Pattern 093: Slot pattern ───────────────────────────────────
// Index: 93
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Layout
//     header={<Header title="Dashboard" />}
//     sidebar={<Sidebar items={navItems} />}
//     footer={<Footer />}
//   />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Slot props are compiled as inline component instances.
//   // Each slot JSX is parsed and emitted as part of the parent's
//   // node tree, wired into the component's child array at the
//   // position where the component references {props.header}, etc.
//   //
//   // Layout's template might produce:
//   _arr_0 = [_]Node{
//     .{ .style = .{ ... }, .children = &_arr_1 },  // header slot
//     .{ .style = .{ ... }, .children = &_arr_2 },  // sidebar slot
//     .{ .style = .{ ... }, .children = &_arr_3 },  // footer slot
//   };
//
// Notes:
//   The slot pattern passes JSX as props. In React, these are just
//   regular props that happen to contain JSX elements. The component
//   renders them by placing {props.header} in its return JSX.
//
//   In Smith's compilation model, component inlining
//   (parse/element/component_inline.js) handles this:
//     1. When a prop value is JSX (starts with <), it's parsed as
//        a component brace value (component_brace_values.js)
//     2. The JSX is compiled to a node expression
//     3. During inlining, references to props.header in the
//        component body are replaced with the compiled node
//     4. The slot content becomes part of the parent's child array
//
//   This is identical to pattern p059 (JSX as prop) from the
//   consumer's perspective. The difference is semantic: slots imply
//   named insertion points in a layout component, while JSX props
//   are generic.
//
//   Chad-tier syntax may use explicit <slot> elements for this
//   pattern, handled by parse/children/conditional_blocks.js.
//
//   See conformance: d105_shell_slot_filter_pipeline.tsz

function match(c, ctx) {
  // Detect: { followed by < — JSX element inside prop braces (slot value)
  // e.g. header={<Header />}  — cursor is at the {
  if (c.kind() !== TK.lbrace) return false;
  var saved = c.save();
  c.advance(); // skip {
  if (c.kind() === TK.lt) { c.restore(saved); return true; }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Compilation via component inlining:
  //   1. Prop value parsed as JSX → node expression
  //   2. Component body inlined with prop substitution
  //   3. {props.slotName} replaced with the compiled JSX node
  //   4. Slot content becomes children in the flattened tree
  return null;
}
