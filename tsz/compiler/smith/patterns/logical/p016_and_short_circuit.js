(function() {
// ── Pattern 016: && short-circuit ───────────────────────────────
// Index: 16
// Group: logical
// Status: complete
//
// Soup syntax (copy-paste React):
//   {isOpen && <Modal />}
//   {items.length > 0 && <List />}
//   {user && user.isAdmin && <AdminPanel />}
//
// Mixed syntax (hybrid):
//   {isOpen && <Modal />}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Node emitted with display toggled by condition:
//   //   .{ .style = .{ .display = .none }, ... },
//   // In _updateConditionals:
//   //   nodes_arr[idx].style.display = if ((getSlotI64(S) != 0)) .flex else .none;
//   //
//   // Inside a map with item field comparison, inlines display into style:
//   //   .{ .style = .{ .display = if (_oa0_active[_i] == 1) .flex else .none } }
//
// Notes:
//   The most common conditional rendering pattern in React. Condition is
//   evaluated as a boolean:
//     - State slots: getSlotI64(N) != 0 or getSlotBool(N)
//     - Render-locals: evaluated for truthiness (qjs eval → 'T'/'' check)
//     - Props: propValue != 0 or propValue.len > 0
//     - Map item fields: _oaN_field[_i] (== / != / > etc.)
//     - Negation: !expr → (expr == 0)
//   Chained && conditions (a && b && <C />) fold into a single compound
//   Zig `and` expression: (a != 0) and (b != 0).
//   Inside maps, simple item.field comparisons are optimized to inline
//   display style instead of _updateConditionals (avoids per-frame update).
//   || in conditions is mapped to Zig `or`.
//   Conformance tests: d53_compound_conditionals.tsz, d03_conditional_wrapping_map.tsz
//   Full implementation: parse/brace/conditional.js → tryParseConditional()

function match(c, ctx) {
  // Peek for && token before } or EOF, where the token after && is
  // either < (JSX) or ( followed by < (paren-wrapped JSX).
  var saved = c.save();
  var depth = 0;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.amp_amp && depth === 0) {
      c.advance();
      // Check for optional ( wrapper
      if (c.kind() === TK.lparen) c.advance();
      var isJsx = c.kind() === TK.lt;
      c.restore(saved);
      return isJsx;
    }
    // If we hit ? first, this is a ternary — not our pattern
    if (c.kind() === TK.question && depth === 0) {
      c.restore(saved);
      return false;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Delegates to tryParseConditional which:
  // 1. Collects condition tokens: identifiers → slot/rl/prop/OA resolution,
  //    operators → Zig equivalents (===→==, !==→!=)
  // 2. On &&: checks if next is JSX. If yes → parse JSX element, register
  //    conditional, push child. If no → append 'and' and continue.
  // 3. Handles ! prefix (negation): slot → (val == 0), rl → negate
  // 4. String comparisons: resolved via std.mem.eql
  // 5. Map optimization: item.field == N inlines into display style
  // 6. Registers 'show_hide' conditional in ctx.conditionals
  // 7. Pushes node to children with condIdx
  return tryParseConditional(c, children);
}

_patterns[16] = { id: 16, match: match, compile: compile };

})();
