(function() {
// ── Pattern 069: expression children ───────────────────────────
// Index: 69
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{count + 1}</Text>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // With a <script> block present, Smith routes the expression through
//   // a JS eval slot and a dynamic text buffer:
//   var _root = Node{ .text = "" };
//   // + __jsExpr_N state slot
//   // + __evalDynTexts() { __setStateString(N, String(1 + 1)); }
//   //
//   // Without script runtime, the same expression is dropped:
//   //   F12: dropped expression {count + 1}
//
// Notes:
//   Generic multi-token brace expressions in child position are not resolved
//   by the bare-prop / bare-variable fast paths.
//
//   parse/children/brace.js handles them in two modes:
//     1. If ctx.scriptBlock exists, the expression is stored in ctx._jsDynTexts
//        and refreshed through QuickJS into a string state slot.
//     2. Otherwise, the expression is recorded in ctx._droppedExpressions and
//        preflight blocks the build with F12.
//
//   Verified current behavior:
//     - `{count + 1}` without script runtime preflight-blocks
//     - `{1 + 1}` with a <script> block compiles to a JS eval-backed dyn text

function match(c, ctx) {
  // Same structural matcher as the generic expression interpolation pattern:
  // anything in braces that is not a single identifier / literal and not a
  // more specific ternary/map/logical form.
  if (c.kind() === TK.eof || c.kind() === TK.rbrace) return false;

  if (c.kind() === TK.identifier) {
    var saved = c.save();
    c.advance();
    var singleIdent = c.kind() === TK.rbrace;
    c.restore(saved);
    if (singleIdent) return false;
  }

  if (c.kind() === TK.number) {
    var saved2 = c.save();
    c.advance();
    var singleNum = c.kind() === TK.rbrace;
    c.restore(saved2);
    if (singleNum) return false;
  }

  if (c.kind() === TK.string) {
    var saved3 = c.save();
    c.advance();
    var singleStr = c.kind() === TK.rbrace;
    c.restore(saved3);
    if (singleStr) return false;
  }

  return true;
}

function compile(c, ctx) {
  // Expression children {expr} where expr is multi-token (not a single
  // identifier/literal/string). Delegates to the same logic as p010
  // (expression interpolation):
  //
  // 1. With <script> block: expression is stored in ctx._jsDynTexts and
  //    refreshed through QuickJS into a string state slot. A dynText
  //    buffer is allocated with {s} format pointing at the JS-backed slot.
  //
  // 2. Without <script>: tries to resolve state getter arithmetic
  //    (count + 1 → getSlot + 1) into a direct dynText buffer. If that
  //    fails, the expression is recorded in ctx._droppedExpressions and
  //    preflight blocks the build with F12.
  //
  // Collect all tokens until matching }
  var parts = [];
  var braceDepth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) braceDepth++;
    if (c.kind() === TK.rbrace) {
      if (braceDepth === 0) break;
      braceDepth--;
    }
    parts.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();

  var expr = parts.join(' ');

  // Try to resolve as state slot expression
  var hasStateRef = false;
  var fmtParts = [];
  var fmtArgs = [];
  for (var i = 0; i < parts.length; i++) {
    var slotIdx = findSlot(parts[i]);
    if (slotIdx >= 0) {
      hasStateRef = true;
      var slot = ctx.stateSlots[slotIdx];
      if (slot.type === 'string') {
        fmtParts.push('{s}');
        fmtArgs.push(slotGet(parts[i]));
      } else {
        fmtParts.push('{d}');
        fmtArgs.push(slotGet(parts[i]));
      }
    } else if (parts[i] === '+' || parts[i] === '-' || parts[i] === '*' || parts[i] === '/') {
      if (fmtArgs.length > 0) {
        fmtArgs[fmtArgs.length - 1] += ' ' + parts[i];
      }
    } else if (/^\d+$/.test(parts[i])) {
      if (fmtArgs.length > 0) {
        fmtArgs[fmtArgs.length - 1] += ' ' + parts[i];
      } else {
        fmtParts.push(parts[i]);
      }
    }
  }

  if (hasStateRef && fmtArgs.length > 0) {
    return { fmtString: fmtParts.join(''), fmtArgs: fmtArgs.join(', ') };
  }

  // Script runtime fallback — route to QuickJS eval
  if (ctx.scriptBlock || ctx.luaBlock) {
    return { value: buildEval(expr, ctx) };
  }

  // No runtime — signal as dropped expression
  if (!ctx._droppedExpressions) ctx._droppedExpressions = [];
  ctx._droppedExpressions.push({ expr: expr, line: 0 });
  return { value: '""' };
}

_patterns[69] = { id: 69, match: match, compile: compile };

})();
