(function() {
// ── Pattern 017: || fallback ────────────────────────────────────
// Index: 17
// Group: logical
// Status: complete
//
// Soup syntax (copy-paste React):
//   {name || "Anonymous"}
//   <Text>{title || "Untitled"}</Text>
//
// Mixed syntax (hybrid):
//   {name || "Anonymous"}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // As a text expression, would need conditional text:
//   //   .{ .text = "" }   // dynamic text placeholder
//   // In _updateDynText:
//   //   _ = std.fmt.bufPrint(&_dyn_N, "{s}", .{
//   //     if (getSlotString(S).len > 0) getSlotString(S) else "Anonymous"
//   //   }) catch "";
//   //
//   // For numeric slots:
//   //   if (getSlotI64(S) != 0) getSlotI64(S) else fallbackValue
//
// Notes:
//   || as a RENDERING pattern (not in a condition chain) is partially
//   supported. When || appears inside a condition chain leading to && <JSX>,
//   it maps to Zig `or` and works correctly (tryParseConditional line ~123).
//   However, as a STANDALONE text expression ({name || "default"}), this
//   requires either:
//     a) Ternary rewrite: treat as {name ? name : "default"} → p013
//     b) QuickJS eval: evalToString("name || 'default'")
//   The current compiler falls through to expression interpolation (p010)
//   which uses qjs eval for the whole expression.
//   Love2d reference: `(condLua) and (exprToLua(rhs)) or ""` — Lua has
//   native truthiness for `or`, Zig does not.
//   To fully support this, resolve/ would need a truthiness resolver that
//   generates the appropriate Zig if/else for each identifier type.
//   Full implementation: partial in parse/brace/conditional.js (condition chains)
//   Standalone text: falls through to expression interpolation

function match(c, ctx) {
  // Look for || token where the RHS is a string or expression (not JSX).
  // Must not contain && with JSX after it (that's p016 with || in condition).
  var saved = c.save();
  var depth = 0;
  var sawOr = false;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.pipe_pipe && depth === 0) {
      sawOr = true;
      c.advance();
      // If next is a string literal, this is our pattern
      if (c.kind() === TK.string) {
        c.restore(saved);
        return true;
      }
      continue;
    }
    // If we hit && or ? or <, this is a different pattern
    if ((c.kind() === TK.amp_amp || c.kind() === TK.question || c.kind() === TK.lt) && depth === 0) {
      c.restore(saved);
      return false;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Parse LHS: collect tokens before ||
  var lhsParts = [];
  var lhsRaw = [];
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace && c.kind() !== TK.pipe_pipe) {
    lhsRaw.push(c.text());
    c.advance();
  }
  if (c.kind() !== TK.pipe_pipe) return null;
  c.advance(); // skip ||

  // Parse RHS: the fallback value
  var fallback = null;
  if (c.kind() === TK.string) {
    fallback = c.text().slice(1, -1); // strip quotes
    c.advance();
  } else if (c.kind() === TK.number) {
    fallback = c.text();
    c.advance();
  } else {
    // Complex RHS — collect remaining tokens and route through eval
    var rhsParts = [];
    while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
      rhsParts.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    var rawExpr = lhsRaw.join(' ') + ' || ' + rhsParts.join(' ');
    return { value: buildEval(rawExpr, ctx) };
  }

  // Resolve LHS identifier
  var lhsName = lhsRaw.length === 1 ? lhsRaw[0] : null;

  if (lhsName && isGetter(lhsName)) {
    var slotIdx = findSlot(lhsName);
    var slot = slotIdx >= 0 ? ctx.stateSlots[slotIdx] : null;
    if (slot && slot.type === 'string') {
      var zigExpr = 'if (' + slotGet(lhsName) + '.len > 0) ' + slotGet(lhsName) + ' else "' + fallback + '"';
      if (c.kind() === TK.rbrace) c.advance();
      return { value: zigExpr };
    }
    // Numeric slot
    var numFallback = /^-?\d+(\.\d+)?$/.test(fallback) ? fallback : '0';
    var zigExprNum = 'if (' + slotGet(lhsName) + ' != 0) ' + slotGet(lhsName) + ' else ' + numFallback;
    if (c.kind() === TK.rbrace) c.advance();
    return { value: zigExprNum };
  }

  if (lhsName && ctx.renderLocals && ctx.renderLocals[lhsName] !== undefined) {
    var rlVal = ctx.renderLocals[lhsName];
    if (isEval(rlVal)) {
      // QuickJS-backed render local — route whole expression through eval
      var rawExpr2 = lhsRaw.join(' ') + ' || "' + fallback + '"';
      if (c.kind() === TK.rbrace) c.advance();
      return { value: buildEval(rawExpr2, ctx) };
    }
    // Zig expression render local — check length for strings
    var zigExprRl = 'if (' + rlVal + '.len > 0) ' + rlVal + ' else "' + fallback + '"';
    if (c.kind() === TK.rbrace) c.advance();
    return { value: zigExprRl };
  }

  if (lhsName && ctx.propStack && ctx.propStack[lhsName] !== undefined) {
    var pv = ctx.propStack[lhsName];
    var isZig = typeof pv === 'string' && (pv.includes('state.get') || pv.includes('getSlot') || pv.includes('_oa'));
    if (isZig && (pv.includes('String') || pv.includes('..'))) {
      var zigExprProp = 'if (' + pv + '.len > 0) ' + pv + ' else "' + fallback + '"';
      if (c.kind() === TK.rbrace) c.advance();
      return { value: zigExprProp };
    }
    if (isZig) {
      var numFb = /^-?\d+(\.\d+)?$/.test(fallback) ? fallback : '0';
      var zigExprPropNum = 'if (' + pv + ' != 0) ' + pv + ' else ' + numFb;
      if (c.kind() === TK.rbrace) c.advance();
      return { value: zigExprPropNum };
    }
    // Static prop — if non-empty, use it; otherwise use fallback
    if (typeof pv === 'string' && pv.length > 0) {
      if (c.kind() === TK.rbrace) c.advance();
      return { value: '"' + pv + '"' };
    }
    if (c.kind() === TK.rbrace) c.advance();
    return { value: '"' + fallback + '"' };
  }

  // Unresolvable LHS — route through QuickJS eval
  var rawExprFull = lhsRaw.join(' ') + ' || "' + fallback + '"';
  if (c.kind() === TK.rbrace) c.advance();
  return { value: buildEval(rawExprFull, ctx) };
}

_patterns[17] = { id: 17, match: match, compile: compile };

})();
