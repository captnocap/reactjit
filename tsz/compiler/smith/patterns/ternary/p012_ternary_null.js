// ── Pattern 012: Ternary → null (conditional render) ────────────
// Index: 12
// Group: ternary
// Status: complete
//
// Soup syntax (copy-paste React):
//   {flag ? <A /> : null}
//
// Mixed syntax (hybrid):
//   {flag ? <A /> : null}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Single node with display toggled by condition:
//   //   .{ .style = .{ .display = .none }, ... },
//   // In _updateConditionals:
//   //   nodes_arr[idx].style.display = if ((cond)) .flex else .none;
//
// Notes:
//   This is the most common conditional rendering pattern. The false branch
//   is `null` (or `undefined`), so only one JSX node is emitted. The node
//   starts hidden (display: none) and _updateConditionals shows/hides it.
//   This produces a 'show_hide' conditional kind (vs 'ternary_jsx' for p011).
//   Functionally equivalent to `{flag && <A />}` (pattern 016) but parsed
//   through the ternary path.
//   The null check is at ternary.js line ~344: after `:`, if next token
//   is identifier "null", consume it and break (no false branch node).
//   Full implementation: parse/brace/ternary.js → tryParseTernaryJSX()

function match(c, ctx) {
  // Same initial check as p011 — look for ? with JSX after it.
  // Differentiation from p011 happens during compile when the
  // false branch resolves to null instead of JSX.
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
  // Same entry point as p011. tryParseTernaryJSX handles the null case:
  // After parsing true branch and `:`, it checks for identifier "null".
  // If found, registers a single-branch 'show_hide' conditional.
  // allBranches.length === 1 → condIdx on the single child node.
  return tryParseTernaryJSX(c, children);
}
