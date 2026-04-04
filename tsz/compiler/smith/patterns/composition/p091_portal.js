(function() {
// ── Pattern 091: Portal ─────────────────────────────────────────
// Index: 91
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   {createPortal(
//     <Modal><Text>Content</Text></Modal>,
//     document.body
//   )}
//
//   // Or with ReactDOM:
//   {ReactDOM.createPortal(<Tooltip />, targetEl)}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Portal children are compiled in place. The target argument
//   // is discarded. The children become normal nodes in the tree.
//   //
//   // createPortal(<Modal><Text>Content</Text></Modal>, document.body)
//   //   → compiles identically to: <Modal><Text>Content</Text></Modal>
//   //
//   // .{ .style = .{ ... }, .children = &_arr_0 }  // Modal node
//   // _arr_0 = [_]Node{ .{ .text = "Content" } };   // Text child
//
// Notes:
//   React portals render children into a different DOM subtree. In our
//   compiled model there is no DOM — the layout engine is a single tree
//   with absolute positioning, z-index, and overflow control. Modals
//   and overlays use position: 'absolute' + zIndex at the root level.
//
//   The framework's window system (framework/windows.zig) provides
//   independent rendering surfaces for true window-level separation.
//
//   Compilation strategy: strip createPortal wrapper, compile children.

function match(c, ctx) {
  // createPortal( children, target ) or ReactDOM.createPortal(...)
  var saved = c.save();
  if (c.kind() === 6 /* TK.identifier */ && c.text() === 'ReactDOM') {
    c.advance();
    if (c.kind() === 14 /* TK.dot */) c.advance();
    else { c.restore(saved); return false; }
  }
  if (c.kind() !== 6 || c.text() !== 'createPortal') {
    c.restore(saved);
    return false;
  }
  c.advance();
  var isCall = c.kind() === 8 /* TK.lparen */;
  c.restore(saved);
  return isCall;
}

function compile(c, ctx) {
  // Strip the createPortal wrapper and compile children in place.
  //
  // 1. Advance past 'createPortal' (or 'ReactDOM.createPortal')
  if (c.kind() === 6 && c.text() === 'ReactDOM') {
    c.advance(); // ReactDOM
    c.advance(); // .
  }
  c.advance(); // createPortal
  c.advance(); // (
  //
  // 2. Parse the first argument as JSX — this is the portal children.
  //    The JSX is compiled normally via parseJSXElement.
  var childNode = parseJSXElement(c);
  //
  // 3. Skip the comma and second argument (the target element).
  //    Target is meaningless in our model — we have no DOM.
  if (c.kind() === 15 /* TK.comma */) {
    c.advance(); // ,
    // Skip target expression (could be document.body, a ref, etc.)
    var depth = 0;
    while (c.pos < c.count) {
      if (c.kind() === 8 /* TK.lparen */) depth++;
      if (c.kind() === 9 /* TK.rparen */) {
        if (depth === 0) break;
        depth--;
      }
      c.advance();
    }
  }
  //
  // 4. Consume closing paren of createPortal(...)
  if (c.kind() === 9 /* TK.rparen */) c.advance();
  //
  // 5. Return the compiled child node as-is — it renders in place.
  return childNode;
}

_patterns[91] = { id: 91, match: match, compile: compile };

})();
