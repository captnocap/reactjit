// ── Chad Pattern c029: items.without() removal ──────────────────
// Group: collections
// Status: stub
//
// Chad syntax:
//   // Inside <for> scope:
//   set_items is items.without(item)
//
// Soup equivalent:
//   setItems(items.filter(i => i.id !== item.id));
//
// Zig output target:
//   OA removal by current iterator index or identity.
//
// Current owner: not yet implemented
//
// Notes:
//   Removes current item from collection. Scope-aware — `item`
//   comes from the enclosing <for> block.
//   Returns new collection (immutable operation).

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
