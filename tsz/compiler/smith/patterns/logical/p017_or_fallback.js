// ── Pattern 017: || fallback ────────────────────────────────────
// Index: 17
// Group: logical
// Status: partial
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

function compile(c, children, ctx) {
  // Partial: currently handled by expression interpolation (p010) via
  // qjs eval. A proper implementation would:
  // 1. Parse LHS identifier → resolve to slot/rl/prop
  // 2. Skip ||
  // 3. Parse RHS string/expression
  // 4. Generate: if (lhs.len > 0) lhs else "fallback" (for strings)
  //    or: if (lhs != 0) lhs else fallback (for numbers)
  // For now, returns null to let the fallback expression handler take over.
  return null;
}
