// ── Pattern 069: expression children ───────────────────────────
// Index: 69
// Group: children
// Status: partial
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
  // Delegates to parse/children/brace.js. Behavior is partial because the
  // no-script path still drops the expression and relies on preflight to stop.
  return null;
}
