// ── Pattern 014: Nested ternary ─────────────────────────────────
// Index: 14
// Group: ternary
// Status: complete
//
// Soup syntax (copy-paste React):
//   {a ? <A /> : b ? <B /> : <C />}
//   {level === 0 ? <None /> : level === 1 ? <Low /> : level === 2 ? <Mid /> : <High />}
//
// Mixed syntax (hybrid):
//   {a ? <A /> : b ? <B /> : <C />}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // N branches emitted as sibling nodes, each with compound show_hide:
//   //   .{ .style = .{ .display = .none }, ... },  // branch A: cond = (a)
//   //   .{ .style = .{ .display = .none }, ... },  // branch B: cond = !(a) and (b)
//   //   .{ .style = .{ .display = .none }, ... },  // branch C: cond = !(a) and !(b)
//   // In _updateConditionals:
//   //   nodes_arr[0].style.display = if ((a)) .flex else .none;
//   //   nodes_arr[1].style.display = if (!(a) and (b)) .flex else .none;
//   //   nodes_arr[2].style.display = if (!(a) and !(b)) .flex else .none;
//
// Notes:
//   Chained ternaries are flattened into N independent show_hide conditionals
//   with compound boolean expressions. The first branch uses its condition
//   directly. Each subsequent branch negates all prior conditions AND adds
//   its own. The default (else) branch negates ALL prior conditions.
//   This avoids nested if/else in Zig — each node is independently toggled.
//   Conformance test: d47_nested_ternary.tsz
//   Full implementation: parse/brace/ternary.js → tryParseTernaryJSX()
//   (the while(true) loop at ~line 334 handles chaining)

function match(c, ctx) {
  // Nested ternaries start the same as p011/p012 — differentiation
  // happens during compile when a second ? is found after the first :.
  // Match is the same: look for ? before } with JSX after it.
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
  // Same entry point as p011/p012. tryParseTernaryJSX detects nesting:
  // After parsing first true branch and `:`, if the false branch is neither
  // null nor JSX, it tries _parseTernaryCondParts again for the next link.
  // allBranches accumulates [{condExpr, branch}, ...].
  // When allBranches.length > 2 or last branch has no condExpr (default):
  //   - First branch: condExpr[0]
  //   - Middle branches: !(cond[0]) and !(cond[1]) and ... and (cond[N])
  //   - Default: !(cond[0]) and !(cond[1]) and ... and !(cond[N-1])
  // Each gets its own show_hide conditional + child entry.
  return tryParseTernaryJSX(c, children);
}
