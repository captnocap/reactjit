// ── Pattern 086: Wrapper component ──────────────────────────────
// Index: 86
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   function Layout({ children }) {
//     return (
//       <Box style={{ flexGrow: 1 }}>
//         {children}
//       </Box>
//     );
//   }
//   // Usage: <Layout><Content /></Layout>
//
// Mixed syntax (hybrid):
//   function Layout({ children }) {
//     return (
//       <Box flexGrow={1}>
//         {children}
//       </Box>
//     );
//   }
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // The wrapper component is inlined at the call site.
//   // <Layout><Content /></Layout> becomes:
//   .{
//     .style = .{ .flex_grow = 1 },
//     .sub_nodes = &[_]Node{
//       // <Content /> inlined here (replaces {children})
//     },
//   }
//
// Notes:
//   Wrapper components are the simplest composition pattern — a
//   component that wraps its children in a styled container.
//   The compiler handles this via component inlining:
//
//   1. collectComponents() finds `function Layout({children})` and
//      records it with propNames=['children'] and bodyPos
//   2. When <Layout> is encountered, inlineComponentCall() is called
//   3. The children passed to <Layout> are stored in ctx.componentChildren
//   4. When {children} is encountered in the component body, the
//      stored children are spliced in (parse/children/brace.js line ~663)
//
//   This works for any level of nesting. Recursive wrappers are
//   detected and short-circuited to prevent infinite inlining.

function match(c, ctx) {
  // A wrapper component call is just a JSX element whose tag matches
  // a known component that accepts children. Detection happens during
  // parseJSXElement → findComponent → inlineComponentCall.
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 1 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  var tag = c.textAt(c.pos + 1);
  // Component names start with uppercase
  if (tag[0] < 'A' || tag[0] > 'Z') return false;
  var comp = findComponent(tag);
  if (!comp) return false;
  // Must have children (not self-closing) — but we can't cheaply check
  // for /> vs > without lookahead past all attrs. Let parseJSXElement handle it.
  return true;
}

function compile(c, ctx) {
  return parseJSXElement(c);
}
