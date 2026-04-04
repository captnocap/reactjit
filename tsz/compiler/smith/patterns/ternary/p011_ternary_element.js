// ── Pattern 011: Ternary → element ──────────────────────────────
// Index: 11
// Group: ternary
// Status: complete
//
// Soup syntax (copy-paste React):
//   {flag ? <A /> : <B />}
//
// Mixed syntax (hybrid):
//   {flag ? <A /> : <B />}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Both branches emitted as sibling nodes, conditional toggles display:
//   //   .{ .style = .{ .display = .none }, ... },  // branch A
//   //   .{ .style = .{ .display = .none }, ... },  // branch B
//   // In _updateConditionals:
//   //   nodes_arr[trueIdx].style.display = if ((cond)) .flex else .none;
//   //   nodes_arr[falseIdx].style.display = if ((cond)) .none else .flex;
//
// Notes:
//   Both JSX branches exist in the node tree at all times. The runtime
//   toggles display between .flex and .none based on the condition.
//   This is the "ternary_jsx" conditional kind in ctx.conditionals.
//   Condition resolution handles: state slots (getSlotI64/getSlotBool),
//   render-locals, props, map item fields (OA), string comparisons
//   (→ std.mem.eql), and qjs eval expressions.
//   Full implementation: parse/brace/ternary.js → tryParseTernaryJSX()

function match(c, ctx) {
  // Peek forward for ? token before } or EOF, then check if
  // the branch after ? starts with ( or < (JSX element).
  var saved = c.save();
  var depth = 0;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.question && depth === 0) {
      c.advance(); // skip ?
      // Skip optional (
      if (c.kind() === TK.lparen) c.advance();
      var isJsx = c.kind() === TK.lt;
      c.restore(saved);
      return isJsx;
    }
    // If we hit < before ?, this isn't a ternary — it's a JSX element
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
  // Delegates to tryParseTernaryJSX which:
  // 1. Parses condition tokens until ? via _parseTernaryCondParts
  // 2. Resolves string comparisons (=== → std.mem.eql)
  // 3. Parses true branch JSX via _parseTernaryBranchNode → parseJSXElement
  // 4. Expects : separator
  // 5. Checks false branch: if null → show_hide (pattern 012),
  //    if JSX → ternary_jsx (this pattern), if more conditions → chained (014)
  // 6. Pushes conditional to ctx.conditionals with kind 'ternary_jsx'
  // 7. Pushes both branch nodes to children with ternaryCondIdx/ternaryBranch
  return tryParseTernaryJSX(c, children);
}
