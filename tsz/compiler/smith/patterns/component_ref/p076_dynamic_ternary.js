(function() {
// ── Pattern 076: Dynamic component via ternary ───────────────────
// Index: 76
// Group: component_ref
// Status: complete
//
// Soup syntax (copy-paste React):
//   {flag ? <A /> : <B />}
//   {isEditing ? <EditForm /> : <ViewMode />}
//   {items.length > 0 ? <List items={items} /> : <EmptyState />}
//
// Mixed syntax (hybrid):
//   {flag ? <A /> : <B />}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Both components emitted, display toggled via conditional
//   var _arr_0 = [_]Node{
//     .{ .style = .{ .display = .none }, ...A... },   // hidden initially
//     .{ .style = .{ .display = .flex }, ...B... },   // visible initially
//   };
//   // In _updateConditionals:
//   // nodes_arr[0].style.display = if (flag) .flex else .none;
//   // nodes_arr[1].style.display = if (flag) .none else .flex;
//
// Notes:
//   Choosing between two different component types at runtime based on
//   a condition. Unlike p075 (unknown variable), the component options
//   are known at compile time.
//
//   Both branches are emitted to the node tree. Visibility is toggled
//   via the display style property (.flex vs .none). This is handled
//   as a 'ternary_jsx' conditional type in ctx.conditionals.
//
//   Related to p011_ternary_element (general ternary → element) but
//   specifically for component-typed branches.
//
//   Implemented in parse/brace/ternary.js → tryParseTernaryJSX()
//   which detects JSX in both branches and registers the conditional.

function match(c, ctx) {
  // Look for ? followed by JSX element in both branches
  if (c.kind() !== TK.lbrace) return false;
  var saved = c.save();
  c.advance(); // skip {
  // Skip condition tokens
  var depth = 0;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.question && depth === 0) {
      c.advance();
      // Check true branch is JSX
      if (c.kind() === TK.lparen) c.advance();
      if (c.kind() !== TK.lt) { c.restore(saved); return false; }
      // Scan for : separator
      while (c.kind() !== TK.eof && c.kind() !== TK.colon && c.kind() !== TK.rbrace) {
        c.advance();
      }
      if (c.kind() !== TK.colon) { c.restore(saved); return false; }
      c.advance();
      // Check false branch is JSX
      if (c.kind() === TK.lparen) c.advance();
      var isJsxFalse = c.kind() === TK.lt;
      c.restore(saved);
      return isJsxFalse;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Delegates to tryParseTernaryJSX() which:
  // 1. Parses condition expression
  // 2. Parses true branch component via parseJSXElement()
  // 3. Expects : separator
  // 4. Parses false branch component via parseJSXElement()
  // 5. Registers 'ternary_jsx' conditional
  // 6. Pushes both branch nodes with condIdx/branch markers
  return null;
}

_patterns[76] = {
  id: 76,
  name: 'dynamic_ternary',
  status: 'complete',
  match,
  compile,
};

})();
