// ── Pattern 121: Template literal in JSX ────────────────────────
// Index: 121
// Group: strings
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{`Hello ${name}`}</Text>
//   <Text>{`${count} items found`}</Text>
//   <Text>{`Score: ${score + bonus}`}</Text>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // State slot (integer):
//   .{ .text = "" }  // + dynText: fmtString="{d} items found", fmtArgs="state.getSlot(0)"
//
//   // State slot (string):
//   .{ .text = "" }  // + dynText: fmtString="Hello {s}", fmtArgs="state.getSlotString(0)"
//
//   // Map item field:
//   .{ .text = "__mt0__" }  // mapDynText: fmtString="{s}", fmtArgs="_oa0_name[_i][0.._oa0_name_lens[_i]]"
//
//   // Arithmetic expression:
//   .{ .text = "" }  // + dynText: fmtString="Score: {d}", fmtArgs="state.getSlot(0) + state.getSlot(1)"
//
// Notes:
//   Fully implemented. Template literals are detected by the TK.template_literal
//   token kind in brace.js:594. The raw string (backtick-stripped) is passed to
//   parseTemplateLiteral() in parse/template_literal.js, which splits it into
//   a format string + args array.
//
//   The parser resolves ${expr} interpolations to Zig expressions:
//   - State getters → state.getSlot(N) or state.getSlotString(N)
//   - Arithmetic (getter + N) → resolved with left-fold
//   - OA .length → _oaN_len
//   - Render locals → their resolved Zig value
//   - Prop values → concrete prop from propStack
//   - Map index param → @as(i64, @intCast(_i))
//   - Map item.field → _oaN_field[_i] with type-appropriate format spec
//   - Ternary in template → if/else Zig expression
//   - Function calls → qjs_runtime.evalToString() fallback
//   - Logical || / && → qjs_runtime.evalToString() fallback
//
//   Non-map templates emit a dynText entry (bufId, fmtString, fmtArgs)
//   and the node gets .text = "" which is filled at runtime via std.fmt.bufPrint.
//   Map templates emit with .text = "__mtN__" placeholder, rewritten in map_pools.js.

function match(c, ctx) {
  return c.kind() === TK.template_literal;
}

function compile(c, ctx) {
  // Implemented inline in brace.js:594-621.
  // The consumer reads TK.template_literal, calls parseTemplateLiteral(),
  // and emits either a static text node (no interpolations) or a dynText
  // entry (with interpolations). Map-context templates get special mapDynText
  // treatment with __mtN__ placeholders.
  //
  // This compile function is not called directly — the consumer handles
  // template literals before reaching pattern dispatch.
  return null;
}
