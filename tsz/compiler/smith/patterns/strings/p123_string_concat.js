// ── Pattern 123: String concatenation ───────────────────────────
// Index: 123
// Group: strings
// Status: partial
//
// Soup syntax (copy-paste React):
//   <Text>{"Hello " + name}</Text>
//   <Text>{firstName + " " + lastName}</Text>
//   <Text>{"Total: " + (count * price)}</Text>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // String + state getter → dynText with concat format:
//   .{ .text = "" }  // dynText: fmtString="Hello {s}", fmtArgs="state.getSlotString(0)"
//
//   // String + string → static text (could be folded at compile time):
//   .{ .text = "Hello World" }
//
//   // Complex expressions → QuickJS eval:
//   .{ .text = "" }  // dynText: fmtString="{s}", fmtArgs="qjs_runtime.evalToString(...)"
//
// Notes:
//   String concatenation with + is NOT directly handled by Smith as a
//   distinct pattern. When the brace parser encounters {expr}, it tries
//   to resolve the expression. The + operator between strings/variables
//   is treated as a general expression.
//
//   If the expression involves only state getters and literals, the
//   conditional/expression resolution in brace.js can sometimes pick it
//   apart. More often, the entire expression falls through to QuickJS eval:
//   qjs_runtime.evalToString("Hello " + name, &_eval_buf_N)
//
//   This works correctly but is slower than the template literal path
//   (p121) which resolves expressions at compile time to std.fmt.bufPrint.
//
//   Recommendation: rewrite "Hello " + name as `Hello ${name}` — template
//   literals get full compile-time resolution while concat falls to eval.
//
//   Implementation plan for native concat support:
//   1. Detect pattern: string_literal + identifier (or + string_literal)
//   2. Rewrite internally as template literal format string
//   3. Use the same fmtString/fmtArgs machinery as p121

function match(c, ctx) {
  // Detect: "string" + identifier or identifier + "string" in brace context
  // This is hard to detect without consuming tokens — the + could be
  // arithmetic. Would need type inference to distinguish string + from number +.
  if (c.kind() !== TK.string) return false;
  var saved = c.save();
  c.advance();
  var result = c.kind() === TK.plus;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Not implemented as a dedicated pattern. Falls through to QuickJS eval
  // in the brace expression handler. Template literals (p121) are the
  // preferred path for string interpolation.
  return null;
}
