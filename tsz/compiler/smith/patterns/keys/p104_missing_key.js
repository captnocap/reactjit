// ── Pattern 104: Missing key ────────────────────────────────────
// Index: 104
// Group: keys
// Status: not_applicable
//
// Soup syntax (copy-paste React):
//   {items.map(item => <Box>{item.name}</Box>)}
//   // React warns: Each child in a list should have a unique "key" prop.
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Compiles normally — no warning, no error:
//   for (0.._oa0_len) |_i| {
//     nodes._arr_0[_i] = .{
//       .text = _oa0_name[_i][0.._oa0_name_lens[_i]],
//     };
//   }
//
// Notes:
//   In React, a missing key on mapped children triggers a console warning
//   because the reconciler needs keys for efficient diffing.
//
//   Smith does not warn about missing keys because:
//     1. Keys are silently dropped even when present (see p101)
//     2. There is no virtual DOM diffing — maps compile to Zig for-loops
//        over OA arrays with direct index access
//     3. The OA system handles identity through array indices, not keys
//
//   Smith could add a lint/preflight warning for missing keys (as a
//   soup-compatibility hint), but it would be informational only — the
//   compiled output is identical with or without keys.
//
//   Status is "not_applicable" — the anti-pattern doesn't apply when
//   there's no reconciliation.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
