// ── Pattern 140: Adjacent root elements ────────────────────────
// Index: 140
// Group: misc_jsx
// Status: complete
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
  // Scan forward through one complete element (matching < to /> or </tag>),
  // then check if the next token is also <.
  if (c.kind() !== TK.lt) return false;
  var saved = c.save();
  c.advance(); // skip opening <
  if (c.kind() === TK.eof) { c.restore(saved); return false; }
  // skip tag name (may be dotted: A.B)
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  while (c.kind() === TK.dot && c.pos + 1 < c.count) {
    c.advance(); // skip .
    c.advance(); // skip name part
  }
  // scan for element end, tracking depth
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    var k = c.kind();
    if (k === TK.eof) break;
    if (k === TK.slash_gt) {
      depth--;
      c.advance();
    } else if (k === TK.lt_slash) {
      // closing tag: </tag>
      c.advance(); // skip </
      // skip tag name tokens
      while (c.pos < c.count && c.kind() !== TK.gt && c.kind() !== TK.eof) c.advance();
      if (c.kind() === TK.gt) c.advance(); // skip >
      depth--;
    } else if (k === TK.lt) {
      // nested opening tag
      depth++;
      c.advance();
    } else {
      c.advance();
    }
  }
  // after the element, check if next token is <
  var result = (c.pos < c.count && c.kind() === TK.lt);
  c.restore(saved);
  return result;
}

function compile(c, children, ctx) {
  // Adjacent root elements (return <A /><B />) are not directly supported
  // as bare adjacent siblings. The component/app entry paths call
  // parseJSXElement() once for the root, so only the first element compiles.
  //
  // The supported path is explicit fragment wrapping:
  //   return <><A /><B /></>    — fragment (p007)
  //   return <Box><A /><B /></Box>  — container wrapper
  //
  // This compile() wraps adjacent siblings in an implicit fragment (Box with
  // column layout) so the pattern doesn't silently drop the second element.
  var siblings = [];

  // Parse all adjacent JSX elements
  while (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
    var node = parseJSXElement(c);
    if (node) siblings.push(node);
  }

  if (siblings.length === 0) return null;
  if (siblings.length === 1) {
    children.push(siblings[0]);
    return siblings[0];
  }

  // Wrap in implicit fragment container
  var wrapperExpr = '.{ .style = .{ .flex_direction = .column, .flex_grow = 1 } }';
  children.push({ nodeExpr: wrapperExpr, subChildren: siblings });
  return { nodeExpr: wrapperExpr, subChildren: siblings };
}
