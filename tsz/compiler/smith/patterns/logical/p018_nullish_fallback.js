// ── Pattern 018: ?? nullish fallback ────────────────────────────
// Index: 18
// Group: logical
// Status: complete
//
// Soup syntax (copy-paste React):
//   {value ?? "default"}
//   <Text>{user.name ?? "Guest"}</Text>
//
// Mixed syntax (hybrid):
//   {value ?? "default"}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Falls through to expression interpolation (p010) via qjs eval:
//   //   .{ .text = "" }   // dynamic text placeholder
//   // In _updateDynText:
//   //   _ = std.fmt.bufPrint(&_dyn_N, "{s}", .{
//   //     qjs_runtime.evalToString("String(value ?? 'default')", &_eval_buf_N)
//   //   }) catch "";
//
// Notes:
//   ?? (nullish coalescing) differs from || in that it only falls back
//   for null/undefined, not for falsy values (0, "", false).
//   The lexer HAS a dedicated ?? token (question_question, lexer.zig:64).
//   No dedicated pattern handler exists — the expression falls through
//   to p010 (expression interpolation) which delegates to qjs eval.
//   QuickJS handles ?? natively in JavaScript, so the expression works
//   correctly at runtime.
//   In the Zig target the null/undefined vs falsy distinction mostly
//   doesn't apply because state slots are always initialized.
//   A dedicated compile path could optimize:
//     - For state slots: always defined → value always wins (elide ??)
//     - For string slots: ?? "default" → if (getSlotString(S).len > 0) ... else "default"
//   But the qjs eval fallback is correct for all cases.
//   Love2d reference: doesn't handle ?? specially — TS compiler resolves it.

function match(c, ctx) {
  // Look for ?? (question_question) token before } or EOF.
  var saved = c.save();
  var depth = 0;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.question_question && depth === 0) {
      c.restore(saved);
      return true;
    }
    // If we hit ? (ternary) first, this is a different pattern
    if (c.kind() === TK.question && depth === 0) {
      c.restore(saved);
      return false;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // ?? (nullish coalescing) only falls back for null/undefined, not falsy.
  // For state slots that are always initialized, the LHS always wins.
  // For unresolvable expressions, route through QuickJS which handles ?? natively.

  // Parse LHS: collect tokens before ??
  var lhsRaw = [];
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace && c.kind() !== TK.question_question) {
    lhsRaw.push(c.text());
    c.advance();
  }
  if (c.kind() !== TK.question_question) return null;
  c.advance(); // skip ??

  // Parse RHS: the fallback value
  var fallback = null;
  var fallbackQuoted = false;
  if (c.kind() === TK.string) {
    fallback = c.text().slice(1, -1);
    fallbackQuoted = true;
    c.advance();
  } else if (c.kind() === TK.number) {
    fallback = c.text();
    c.advance();
  } else {
    // Complex RHS — collect and route through eval
    var rhsParts = [];
    while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
      rhsParts.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    var rawExpr = lhsRaw.join(' ') + ' ?? ' + rhsParts.join(' ');
    return { value: buildEval(rawExpr, ctx) };
  }

  var lhsName = lhsRaw.length === 1 ? lhsRaw[0] : null;

  // State slots are always initialized — ?? never triggers, LHS always wins.
  // But we still generate the conditional for correctness.
  if (lhsName && isGetter(lhsName)) {
    var slotIdx = findSlot(lhsName);
    var slot = slotIdx >= 0 ? ctx.stateSlots[slotIdx] : null;
    if (slot && slot.type === 'string') {
      // String slot: null/undefined maps to empty string in Zig, so check len
      var zigExpr = 'if (' + slotGet(lhsName) + '.len > 0) ' + slotGet(lhsName) + ' else "' + (fallback || '') + '"';
      if (c.kind() === TK.rbrace) c.advance();
      return { value: zigExpr };
    }
    // Numeric slot: always defined, LHS always wins
    if (c.kind() === TK.rbrace) c.advance();
    return { value: slotGet(lhsName) };
  }

  if (lhsName && ctx.renderLocals && ctx.renderLocals[lhsName] !== undefined) {
    var rlVal = ctx.renderLocals[lhsName];
    if (isEval(rlVal)) {
      var rawExpr2 = lhsRaw.join(' ') + ' ?? ' + (fallbackQuoted ? '"' + fallback + '"' : fallback);
      if (c.kind() === TK.rbrace) c.advance();
      return { value: buildEval(rawExpr2, ctx) };
    }
    // Zig render local — always defined, LHS wins
    if (c.kind() === TK.rbrace) c.advance();
    return { value: rlVal };
  }

  if (lhsName && ctx.propStack && ctx.propStack[lhsName] !== undefined) {
    var pv = ctx.propStack[lhsName];
    // Props are always resolved at compile time — LHS wins
    if (c.kind() === TK.rbrace) c.advance();
    if (typeof pv === 'string' && pv.length > 0) {
      return { value: pv.includes('state.get') || pv.includes('_oa') ? pv : '"' + pv + '"' };
    }
    return { value: fallbackQuoted ? '"' + fallback + '"' : fallback };
  }

  // Unresolvable — route through QuickJS which handles ?? natively
  var rawExprFull = lhsRaw.join(' ') + ' ?? ' + (fallbackQuoted ? '"' + fallback + '"' : fallback);
  if (c.kind() === TK.rbrace) c.advance();
  return { value: buildEval(rawExprFull, ctx) };
}
