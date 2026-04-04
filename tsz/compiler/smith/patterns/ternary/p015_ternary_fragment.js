// ── Pattern 015: Ternary → fragment ─────────────────────────────
// Index: 15
// Group: ternary
// Status: complete
//
// Soup syntax (copy-paste React):
//   {flag ? <><A /><B /></> : null}
//   {flag ? <><A /><B /></> : <><C /><D /></>}
//
// Mixed syntax (hybrid):
//   {flag ? <><A /><B /></> : null}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Fragment children become sibling nodes wrapped in a conditional Box:
//   //   .{ .style = .{ .display = .none, .flex_direction = .column } },
//   //     // child A
//   //     // child B
//   // In _updateConditionals:
//   //   nodes_arr[wrapperIdx].style.display = if ((cond)) .flex else .none;
//
// Notes:
//   Fragments (<>...</>) in ternary branches are handled by parseJSXElement
//   which recognizes <> (lt + gt with no tag name) as a fragment.
//   _parseTernaryBranchNode calls parseJSXElement for both branches.
//   When a fragment is the branch, its children get wrapped in a container
//   node so the conditional can toggle a single display property.
//   Both ternary_jsx (both branches are fragments) and show_hide (one is
//   null) are supported — same logic as p011/p012.
//   Conformance tests: d06_ternary_jsx_branches.tsz exercises this.
//   Full implementation: parse/brace/ternary.js → tryParseTernaryJSX()
//   Fragment parsing: parse.js → parseJSXElement()

function match(c, ctx) {
  // Same as p011 — fragments start with < just like elements.
  // After ?, we expect < which could be <TagName or <> (fragment).
  var saved = c.save();
  var depth = 0;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.question && depth === 0) {
      c.advance();
      if (c.kind() === TK.lparen) c.advance();
      var isJsx = c.kind() === TK.lt;
      c.restore(saved);
      return isJsx;
    }
    if (c.kind() === TK.lt && depth === 0) {
      c.restore(saved);
      return false;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Delegates to tryParseTernaryJSX. parseJSXElement handles fragments
  // transparently — the returned node wraps fragment children.
  return tryParseTernaryJSX(c, children);
}
