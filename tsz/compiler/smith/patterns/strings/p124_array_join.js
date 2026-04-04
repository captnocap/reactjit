// ── Pattern 124: Array join ─────────────────────────────────────
// Index: 124
// Group: strings
// Status: stub
//
// Soup syntax (copy-paste React):
//   <Text>{items.join(", ")}</Text>
//   <Text>{tags.join(" | ")}</Text>
//   <Text>{[firstName, lastName].join(" ")}</Text>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // OA string fields joined with separator:
//   // This requires building a string at runtime by iterating OA entries.
//   // Target: dynText with runtime join helper:
//   .{ .text = "" }  // dynText: runtime_join(_oa0_name, _oa0_name_lens, _oa0_len, ", ", &_buf_N)
//
//   // State array joined (not OA):
//   .{ .text = "" }  // dynText: qjs_runtime.evalToString("items.join(', ')", &_eval_buf_N)
//
// Notes:
//   .join() is NOT recognized by Smith. The token sequence identifier.join(
//   is not in any detection path. The expression falls through to QuickJS
//   eval if a script block is available, or embeds as literal text if not.
//
//   For OA-backed arrays, a native implementation would:
//   1. Detect identifier.join("sep") where identifier is an OA getter
//   2. Emit a runtime helper that iterates _oaN_field[0.._oaN_len] and
//      concatenates with the separator into a buffer
//   3. The buffer becomes a dynText source
//
//   For non-OA arrays (state slots, render locals), QuickJS eval handles
//   it correctly — the JS expression runs and produces the joined string.
//
//   For inline array construction like [a, b, c].join(" "), the expression
//   falls through to eval. A compile-time optimization could detect constant
//   arrays and fold them.
//
//   The love2d reference does not have special .join() handling either —
//   it uses table.concat() in Lua compute blocks.

function match(c, ctx) {
  // Detect: identifier.join(...)
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance();
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance();
  var result = c.isIdent('join') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Not yet implemented. .join() expressions fall through to QuickJS eval
  // when a script block is available. For OA-backed arrays, a native
  // implementation would emit a runtime join helper over OA string fields.
  return null;
}
