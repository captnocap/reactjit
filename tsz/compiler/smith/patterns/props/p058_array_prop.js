(function() {
// ── Pattern 058: Array prop ─────────────────────────────────────
// Index: 58
// Group: props
// Status: complete
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
  // Array prop: { [elem, elem, ...] }
  // Collect array elements as raw text. For typed array data, OA data blocks
  // are the proper path. This collects the literal for component prop inlining.
  c.advance(); // skip {

  var elements = [];
  var depth = 0;
  c.advance(); // skip [
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.rbracket && depth === 0) break;
    if (c.kind() === TK.lbracket) depth++;
    if (c.kind() === TK.rbracket) { depth--; continue; }
    if (c.kind() === TK.comma && depth === 0) { c.advance(); continue; }

    // Resolve element values
    if (c.kind() === TK.identifier && isGetter(c.text())) {
      elements.push(slotGet(c.text()));
    } else if (c.kind() === TK.string) {
      elements.push(c.text().slice(1, -1));
    } else {
      elements.push(c.text());
    }
    c.advance();
  }
  if (c.kind() === TK.rbracket) c.advance(); // skip ]
  if (c.kind() === TK.rbrace) c.advance(); // skip }

  return { value: elements, array: true };
}

_patterns[58] = { id: 58, match: match, compile: compile };

})();
