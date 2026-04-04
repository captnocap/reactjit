// ── Chad Pattern c028: items.where() filter ─────────────────────
// Group: collections
// Status: stub
//
// Chad syntax:
//   items.where(item.active)
//   items.where(item.col exact 'todo')
//
//   // With conditional binding:
//   <if items.where(item.active) as active>
//     set_count is active.length
//   </if>
//
// Soup equivalent:
//   items.filter(item => item.active)
//   items.filter(item => item.col === 'todo')
//
// Zig output target:
//   Filtered OA subset via runtime evaluation.
//
// Current owner: not yet implemented
//
// Notes:
//   `item` inside .where() is implicit from the collection.
//   No lambda syntax. Condition uses word operators (exact, above, etc.).
//   Replaces .filter() with lambdas entirely.
//
//   Related collection methods (same no-lambda contract):
//     items.reverse — reversed copy
//     items.search(query) — fuzzy search across string fields
//     items.regex(pattern) — regex match across string fields
//     items.length — count (already handled in conditional_blocks.js)

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
