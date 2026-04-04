(function() {
// ── Pattern 020: .map() → fragment ──────────────────────────────
// Index: 20
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map(item => <><A key={item.id} /><B /></>)}
//   {items.map((item, i) => (
//     <>
//       <Text>{item.label}</Text>
//       <Box style={{height: 1, backgroundColor: "#333"}} />
//     </>
//   ))}
//
// Mixed syntax (hybrid):
//   {items.map(item => <><A /><B /></>)}
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Same OA pools as p019, but the map pool has multiple nodes per item.
//   // Fragment children are flattened — each child gets its own pool entry:
//   //   var _map0_pool: [128]Node = .{.{}} ** 128;  // 64 items × 2 children
//   //
//   // In rebuild function:
//   //   for (0.._oa0_len) |_i| {
//   //     const base = _i * 2;  // 2 children per fragment
//   //     _map0_pool[base + 0] = .{ .text = ... };     // <Text>
//   //     _map0_pool[base + 1] = .{ .style = .{ ... } }; // <Box> separator
//   //   }
//   //
//   // OR: fragment children become separate sub-arrays:
//   //   var _map0_sub0: [64]Node = ...;  // first child per item
//   //   var _map0_sub1: [64]Node = ...;  // second child per item
//
// Notes:
//   When .map() callback returns a fragment (<>...</>), the fragment is
//   unwrapped and its children are treated as multiple nodes per iteration.
//   The pool sizing accounts for (items × children_per_item).
//   parseJSXElement handles <> as a fragment, returning a node with
//   subChildren. The map emitter (map_pools.js) detects multi-child maps
//   and allocates pool space accordingly.
//   Key is typically on the fragment itself (not supported — use wrapper)
//   or on the first child.
//   Love2d reference: tslx_compile.mjs → listItemEntryToLua handles
//   JsxFragment by calling listItemChildrenToLua which processes each child.
//   Conformance tests: fragment maps are common in multi-column list items.
//   Full implementation: parse/children/brace.js (map detection),
//   parse.js → parseJSXElement (fragment handling),
//   emit/map_pools.js (multi-child pool emission)

function match(c, ctx) {
  // Same as p019 — look for `identifier.map(` pattern.
  // Differentiation from p019 happens during compile when the
  // callback body is a fragment instead of a single element.
  var saved = c.save();
  if (c.kind() !== TK.identifier) {
    c.restore(saved);
    return false;
  }
  c.advance();
  while (c.kind() === TK.dot && c.pos + 1 < c.count) {
    c.advance();
    if (c.kind() === TK.identifier && c.text() === 'map') {
      c.advance();
      if (c.kind() === TK.lparen) {
        c.restore(saved);
        return true;
      }
    }
    if (c.kind() !== TK.identifier) break;
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, children, ctx) {
  // Same dispatch as p019. The map infrastructure in brace.js handles
  // both single-element and fragment callbacks transparently.
  // parseJSXElement detects <> and returns a fragment node.
  // The map emitter sizes pools based on actual children count per item.
  return null; // Handled by brace.js map dispatcher
}

_patterns[20] = { id: 20, match: match, compile: compile };

})();
