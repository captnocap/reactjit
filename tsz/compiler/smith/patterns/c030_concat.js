// ── Chad Pattern c030: items.concat() append ────────────────────
// Group: collections
// Status: stub
//
// Chad syntax:
//   set_items is items.concat(input)
//   set_items is items.concat(newItem)
//
// Soup equivalent:
//   setItems([...items, input]);
//
// Zig output target:
//   OA append via JS bridge or runtime helper.
//
// Current owner: not yet implemented
//
// Notes:
//   Appends value to collection. Returns new collection.
//   No spread syntax. No push(). concat() is the only append.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
