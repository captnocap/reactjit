// ── Pattern 058: Array prop ─────────────────────────────────────
// Index: 58
// Group: props
// Status: partial
//
// Soup syntax (copy-paste React):
//   <Select options={[1, 2, 3]} />
//   <Chart data={[10, 20, 30, 40]} />
//   <Tags items={["react", "zig", "wgpu"]} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Array literals would need to become Zig array/slice:
//   // Option A: comptime array
//   const _prop_options = [_]i64{ 1, 2, 3 };
//   // Option B: for string arrays
//   const _prop_items = [_][]const u8{ "react", "zig", "wgpu" };
//   // Then referenced in the component's prop resolution.
//   // Currently NOT emitted.
//
// Notes:
//   NOT IMPLEMENTED as a distinct pattern.
//
//   When an array literal appears as a prop value, parseComponentBraceValue()
//   encounters TK.lbracket and collects it as raw token text. The result is
//   a string like "[1, 2, 3]" in propValues — which is not valid Zig.
//
//   For this to work properly, the compiler would need to:
//     1. Detect array literal syntax [elem, elem, ...]
//     2. Determine element type (all numbers? all strings? mixed?)
//     3. Emit a Zig array declaration
//     4. Pass the array as a slice to the component
//
//   Workaround: use a data block or OA (object array) for array data.
//   OAs already handle array-of-objects with proper Zig array emission.
//   Primitive arrays (numbers, strings) don't have an OA path yet.
//
//   Related: p071_array_children.js handles [<A />, <B />] as children.

function match(c, ctx) {
  // attr={ [ ... ] }
  if (c.kind() !== TK.lbrace) return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lbracket;
}

function compile(c, ctx) {
  // parseComponentBraceValue() collects array tokens as raw text.
  // Valid when component inlining doesn't need typed array access.
  // For typed array data, use OA (object array) data blocks instead.
  return null;
}
