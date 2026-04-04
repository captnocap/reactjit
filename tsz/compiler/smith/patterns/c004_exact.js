// ── Chad Pattern c004: `exact` binding ──────────────────────────
// Group: core
// Status: stub
//
// Chad syntax:
//   // Immutable constant:
//   MAX exact 100
//
//   // Strict equality comparison:
//   <if count exact 0>
//   <if status exact 'active'>
//   a not exact b
//   a exact or above b
//   a exact or below b
//
//   // Locked classifier prop:
//   height exact 1
//   flexDirection exact row
//
//   // Locked type field:
//   .field exact value
//
// Soup equivalent:
//   const MAX = 100;
//   count === 0
//   status === 'active'
//
// Zig output target:
//   - Constants: comptime const or literal inline
//   - Comparisons: == (numeric), std.mem.eql (string)
//   - Classifier: non-overridable style field
//
// Current owner: lanes/chad.js, parse/children/conditional_blocks.js
//
// Notes:
//   `exact` carries the same meaning everywhere: locked/immutable/strict.
//   In declarations = const. In expressions = ===. In classifiers = no override.
//   Three-word operators: `exact or above` (>=), `exact or below` (<=).
//   Two-word: `not exact` (!=).

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
