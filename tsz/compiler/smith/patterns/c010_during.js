// ── Chad Pattern c010: <during> reactive lifecycle ──────────────
// Group: control_flow
// Status: stub
//
// Chad syntax:
//   // Variable-driven lifecycle:
//   <during recording>
//     media.captureFrame every 33
//   </during>
//
//   // In JSX — replaces if/else state chains:
//   <during loading>
//     <C.Spinner />
//   </during>
//   <during ready>
//     <for items>
//       <C.ListItem>{item.name}</C.ListItem>
//     </for>
//   </during>
//
//   // Nested — inner only when ALL ancestors active:
//   <during connected>
//     <during authenticated>
//       fetchData
//     </during>
//   </during>
//
//   // Recursive tree walk:
//   <during paintNode(node)>
//     paintNodeVisuals(node)
//     <for node.children as child>
//       paintNode(child)
//     </for>
//   </during>
//
// Soup equivalent:
//   useEffect(() => { ... }, [recording]);
//   {loading && <Spinner />}
//   {ready && items.map(...)}
//
// Zig output target:
//   In JSX: show_hide conditional (same as <if>).
//   In functions: lifecycle activation/deactivation hooks.
//
// Current owner: parse/children/conditional_blocks.js (parseDuringBlock)
//
// Notes:
//   Replaces useEffect, lifecycle hooks, event subscriptions, while loops.
//   Multiple blocks on same variable = all activate independently.
//   Component-scoped: deactivates on unmount regardless of condition.
//   Cleanup: paired cleanup runs in reverse on deactivation.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
