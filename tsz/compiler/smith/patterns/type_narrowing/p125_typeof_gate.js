// ── Pattern 125: typeof gate ────────────────────────────────────
// Index: 125
// Group: type_narrowing
// Status: partial
//
// Soup syntax (copy-paste React):
//   {typeof x === 'string' && <Text>{x}</Text>}
//   {typeof count === 'number' && <Text>{count}</Text>}
//   {typeof handler === 'function' && <Pressable onPress={handler}><Text>Go</Text></Pressable>}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // typeof checks compile as QuickJS eval truthiness tests:
//   // The && short-circuit (p016) handles the conditional rendering.
//   // The typeof condition becomes a QuickJS eval:
//   nodes.guard.style.display = if (
//     qjs_runtime.evalToString("(typeof x === 'string') ? 'T' : ''", &_eval_buf_0).len > 0
//   ) .flex else .none;
//
// Notes:
//   typeof is a JavaScript operator with no Zig equivalent. Smith's
//   conditional parser (conditional.js) does not have special handling
//   for typeof — it's treated as an identifier, and the expression
//   `typeof x === 'string'` is parsed as tokens that get assembled
//   into a condition string.
//
//   When the condition cannot be resolved to pure Zig (no matching state
//   slot, OA, or render local), it falls through to QuickJS eval via
//   the truthiness pattern: eval("(expr) ? 'T' : ''").len > 0.
//
//   This works correctly for && short-circuit (p016): the guarded element
//   gets display toggled based on the eval result. The element itself
//   renders normally.
//
//   For ternary (p011-p015), typeof in the condition works the same way —
//   the ternary resolver in brace/ternary.js falls through to eval for
//   unresolvable conditions.
//
//   Smith has no type system — all values are either i64 (integers),
//   string slices, or QuickJS-managed JS values. typeof is meaningful
//   only in the JS eval context, not in compiled Zig.

function match(c, ctx) {
  // Detect: typeof identifier === 'type'
  if (c.kind() !== TK.identifier || c.text() !== 'typeof') return false;
  return true;
}

function compile(c, ctx) {
  // Handled by the conditional parser (conditional.js / ternary.js).
  // typeof expressions that can't be resolved statically fall through
  // to QuickJS eval. The && / ternary consumer handles display toggling.
  return null;
}
