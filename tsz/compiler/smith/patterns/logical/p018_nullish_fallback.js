// ── Pattern 018: ?? nullish fallback ────────────────────────────
// Index: 18
// Group: logical
// Status: stub
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
//   // Conceptually similar to || but only triggers on null/undefined:
//   //   .{ .text = "" }   // dynamic text placeholder
//   // In _updateDynText:
//   //   _ = std.fmt.bufPrint(&_dyn_N, "{s}", .{
//   //     if (slot_is_defined) getSlotString(S) else "default"
//   //   }) catch "";
//
// Notes:
//   ?? (nullish coalescing) differs from || in that it only falls back
//   for null/undefined, not for falsy values (0, "", false).
//   In the Zig target this distinction mostly doesn't apply because:
//     - State slots are always initialized (never truly null)
//     - Strings default to "" (which ?? would NOT trigger, but || would)
//     - Numbers default to 0 (which ?? would NOT trigger, but || would)
//   The ?? token may not be in the lexer — needs verification.
//   If the lexer produces two separate ? tokens, this would conflict
//   with ternary detection.
//   Love2d reference: doesn't handle ?? specially — TS compiler resolves it.
//   Implementation path:
//     1. Add ?? token to lexer if missing
//     2. In match(): look for ?? token
//     3. In compile(): treat as "is_defined ? value : fallback"
//     4. For slots: always defined → value always wins (optimize away)
//     5. For qjs eval: pass through as JS expression
//   Currently falls through to expression interpolation (p010) via qjs eval
//   which handles ?? natively in JavaScript.

function match(c, ctx) {
  // Look for ?? token. Currently the lexer may not produce a dedicated
  // ?? token — two consecutive ? tokens would be ambiguous with ternary.
  // Stub: always returns false until lexer support is confirmed.
  return false;
}

function compile(c, children, ctx) {
  // Stub: not implemented.
  // When implemented:
  // 1. Parse LHS → resolve identifier
  // 2. Skip ??
  // 3. Parse RHS fallback value
  // 4. For state slots: optimize to just the value (always defined)
  // 5. For qjs eval expressions: wrap in JS ?? and eval
  // 6. For optional chaining results: check .len > 0 or sentinel
  return null;
}
