// ── Pattern 013: Ternary → string ───────────────────────────────
// Index: 13
// Group: ternary
// Status: complete
//
// Soup syntax (copy-paste React):
//   {flag ? "yes" : "no"}
//   <Text>{mode === 0 ? "Default" : "Custom"}</Text>
//
// Mixed syntax (hybrid):
//   {flag ? "yes" : "no"}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Dynamic text node with conditional format arg:
//   //   .{ .text = "" }   // placeholder, filled at runtime
//   // In _updateDynText:
//   //   _ = std.fmt.bufPrint(&_dyn_N, "{s}", .{
//   //     if ((mode == 0)) @as([]const u8, "Default") else @as([]const u8, "Custom")
//   //   }) catch "";
//
// Notes:
//   Both branches are string literals — no JSX elements. This creates a
//   dynamic text node whose content is selected at runtime via Zig if/else.
//   The @as([]const u8, ...) cast ensures both branches have the same type.
//   Condition can be: comparison (==, !=, >, <), bare boolean (slot != 0),
//   or qjs eval expression (rewrites to truthiness check).
//   Inside a map context, uses map-specific dyn text buffers (__mtN__).
//   String comparisons in condition are resolved to std.mem.eql.
//   Full implementation: parse/brace/ternary.js → tryParseTernaryText()

function match(c, ctx) {
  // Look for `expr ? string : string` — the key signal is ? followed by
  // a string token, then : and another string.
  var saved = c.save();
  var depth = 0;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (c.kind() === TK.question && depth === 0) {
      c.advance();
      if (c.kind() === TK.string) {
        c.advance();
        if (c.kind() === TK.colon) {
          c.advance();
          var isStr = c.kind() === TK.string;
          c.restore(saved);
          return isStr;
        }
      }
      c.restore(saved);
      return false;
    }
    // Bail on ( < { which indicate non-ternary-string patterns
    if ((c.kind() === TK.lt || c.kind() === TK.arrow || c.kind() === TK.lbrace) && depth === 0) {
      c.restore(saved);
      return false;
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Delegates to tryParseTernaryText which:
  // 1. Collects condition tokens until ? (similar to _parseTernaryCondParts)
  // 2. Resolves identifiers → slot getters, render-locals, props, OA fields
  // 3. Reads true string value (strip quotes)
  // 4. Expects : separator
  // 5. Reads false string value (strip quotes)
  // 6. Builds condExpr with string comparison resolution
  // 7. Wraps in Zig if/else with @as([]const u8, ...) casts
  // 8. Creates dynText entry: bufId, fmtString: '{s}', fmtArgs: the if/else
  // 9. Pushes .{ .text = "" } node to children with dynBufId
  // Inside map: uses mapDynCount and __mtN__ format.
  return tryParseTernaryText(c, children);
}
