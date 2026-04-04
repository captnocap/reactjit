// ── Pattern 101: Key on element ─────────────────────────────────
// Index: 101
// Group: keys
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box key={item.id} />
//   <ListItem key={`item-${id}`} />
//   <Card key={card.uuid} style={{padding: 8}} />
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Keys are SILENTLY DROPPED. No Zig output.
//   // The key attribute is skipped during prop parsing:
//   //   if (propName === 'key') continue;
//   // The element compiles as if key were not present:
//   nodes._arr_0[0] = .{ .style = .{ .padding = 8 } };
//
// Notes:
//   Implemented in soup.js line 231:
//     if (propName === 'style' || propName === 'key' || propName === 'className') continue;
//
//   Keys are a React reconciliation concept — they tell the virtual DOM
//   diffing algorithm how to match elements across re-renders. Smith
//   compiles to a static Zig node tree with no virtual DOM and no diffing.
//   Re-renders are handled by direct slot updates (state.setSlot) and
//   map rebuilds (_rebuildMap), not by tree reconciliation.
//
//   Therefore keys serve no purpose in the compiled output and are
//   correctly dropped. This is not a missing feature — it's an intentional
//   design decision because the runtime model doesn't need them.
//
//   The key value expression (item.id, template literal, etc.) may still
//   appear in the OA field list if it's referenced elsewhere in the map
//   body (e.g., as a prop or text child).
//
//   Status is "complete" because the behavior (drop silently) is correct
//   and intentional for this compiler's architecture.

function match(c, ctx) {
  if (c.kind() !== TK.identifier || c.text() !== 'key') return false;
  if (c.pos + 1 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.equals;
}

function compile(c, ctx) {
  // No compilation — key is skipped.
  return null;
}
