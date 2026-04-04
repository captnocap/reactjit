(function() {
// ── Pattern 032: filter().sort().map() ──────────────────────────
// Index: 32
// Group: filter_sort
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.filter(i => i.active).sort((a, b) => a.order - b.order).map(item => (
//     <Box key={item.id}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // filter → display toggle, sort → runtime OA order
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .style = .{} };
//     _map_pool_0[_i].style.display = if ((_oa0_active[_i] != 0)) .flex else .none;
//     // text child: _oa0_name[_i][0.._oa0_name_lens[_i]]
//   }
//
// Notes:
//   Combines patterns 030 (filter) and 031 (sort). The chain detection in
//   _identifierStartsMapCall (brace.js:261) handles arbitrary chains of
//   .filter()/.sort()/.slice() before .map().
//
//   tryParseMapHeader (header.js:40-75) processes the chain left-to-right:
//   - .filter() → captures { param, raw } into filterConditions[]
//   - .sort() → skips body entirely (runtime concern)
//   - .slice() → skips body entirely (runtime concern)
//   Multiple .filter() calls accumulate — all conditions are ANDed in emit.
//
//   The emit phase (map_pools.js:1054-1080) resolves filter conditions:
//   1. param.field → _oaX_field[_i]
//   2. State getters → state.getSlot(N)
//   3. JS operators → Zig (|| → or, && → and, === → ==)
//   4. Emits: style.display = if (filterExpr) .flex else .none
//
//   Sort order depends on the QuickJS _computedExpr which includes
//   the full chain. For static OAs, sort is not applied.

function match(c, ctx) {
  // Detect: identifier.filter(...).sort(...).map(...)
  // Also matches .sort(...).filter(...).map(...) and longer chains.
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance(); // identifier
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .

  var hasFilter = false;
  var hasSort = false;

  // Walk chain methods
  while (c.isIdent('filter') || c.isIdent('sort') || c.isIdent('slice')) {
    if (c.isIdent('filter')) hasFilter = true;
    if (c.isIdent('sort')) hasSort = true;
    c.advance(); // method name
    if (c.kind() !== TK.lparen) break;
    c.advance(); // (
    var depth = 1;
    while (c.pos < c.count && depth > 0) {
      if (c.kind() === TK.lparen) depth++;
      if (c.kind() === TK.rparen) depth--;
      if (depth > 0) c.advance();
    }
    if (c.kind() === TK.rparen) c.advance(); // )
    if (c.kind() !== TK.dot) break;
    c.advance(); // .
  }

  var result = hasFilter && hasSort &&
    c.isIdent('map') &&
    c.pos + 1 < c.count &&
    c.kindAt(c.pos + 1) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Handled by the map pipeline — tryParseMapHeader (header.js:40-75)
  // processes the full chain left-to-right:
  //   1. .filter() → captures { param, raw } into filterConditions[]
  //   2. .sort() → skips body entirely (runtime concern via QuickJS)
  //   3. .slice() → skips body entirely (runtime concern)
  //   4. Multiple .filter() calls accumulate — all ANDed in emit
  //   5. The emit phase (map_pools.js) wraps iteration body in
  //      if(filterExpr) guard using resolved OA field references
  //   6. Sort order comes from _computedExpr evaluated by QuickJS
  //
  // No compile action needed — the map pipeline owns this end-to-end.
  return null;
}

_patterns[32] = { id: 32, match: match, compile: compile };

})();
