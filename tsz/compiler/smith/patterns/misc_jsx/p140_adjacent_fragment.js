// ── Pattern 140: Adjacent root elements ────────────────────────
// Index: 140
// Group: misc_jsx
// Status: partial
//
// Soup syntax (copy-paste React):
//   function App() {
//     return <A /><B />;
//   }
//
// Mixed syntax (hybrid):
//   function App() {
//     return (
//       <>
//         <A />
//         <B />
//       </>
//     );
//   }
//
// Zig output target:
//   // Desired:
//   .{
//     .children = &[_]Node{
//       .{ /* A */ },
//       .{ /* B */ },
//     },
//   }
//
// Notes:
//   The adjacent-root *intent* is supported in Smith, but only through an
//   explicit fragment wrapper or container node.
//
//   Bare adjacent root siblings are not supported as a raw return form.
//   The component/app entry paths record the first root JSX position and then
//   call parseJSXElement() once. That means `return <A /><B />` only has a
//   chance to compile the first element; the second sibling is not wrapped into
//   a fragment automatically.
//
//   Authors need to wrap adjacent roots explicitly with `<>...</>` or a `Box`.

function match(c, ctx) {
  // Not safely matchable without parsing one full element and checking for
  // another top-level sibling immediately after it.
  return false;
}

function compile(c, ctx) {
  // Documentary only. Use an explicit fragment wrapper for the supported path.
  return null;
}
