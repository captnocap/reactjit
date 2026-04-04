(function() {
// ── Pattern 030: .filter().map() ────────────────────────────────
// Index: 30
// Group: filter_sort
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.filter(item => item.active).map(item => (
//     <Box style={{padding: 8}}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Filter conditions captured at parse time, applied in rebuild loop.
//   // The OA still contains all items; filtering happens at render time.
//   for (0.._oa0_len) |_i| {
//     // filterConditions[0]: item.active → (_oa0_active[_i]) != 0
//     if ((_oa0_active[_i]) != 0) {
//       _map_pool_0[_map_count_0] = .{ .style = .{ .padding = .{ .all = 8 } },
//         .children = &_arr_0 };
//       _map_count_0 += 1;
//     }
//   }
//
// Notes:
//   .filter().map() is the most common chained pipeline in React.
//   The filter predicate runs before map but after OA population.
//
//   tryParseMapHeader() in parse/map/header.js handles this:
//     1. After the base identifier and dot, it checks for slice/filter/sort
//     2. When it finds 'filter', it parses the callback:
//        - Captures the param name (filterParam)
//        - Collects the condition tokens as raw text
//        - Stores as { param, raw } in filterConditions[]
//     3. Continues scanning past the closing ) and .
//     4. Eventually reaches 'map' and parses the map header normally
//     5. filterConditions are passed through to the mapInfo
//
//   The emit pass (map_pools.js / runtime_updates.js) wraps the
//   map body in an if() check using the filter condition. The condition
//   goes through OA field resolution: item.active → _oa0_active[_i],
//   and through _wrapMapCondition() for valid Zig bool expression.
//
//   Multiple .filter() calls chain: each adds to filterConditions[].
//   The emit combines them with && in the Zig if() guard.
//
//   The love2d reference handles this identically — filter predicates
//   become if guards inside the ipairs loop.
//
//   See conformance: d101_filter_sort_map_render.tsz (comprehensive
//   chained pipeline with filter + sort + slice + map),
//   d105_shell_slot_filter_pipeline.tsz
//
//   Interaction with sort: .filter().sort().map() — the sort is a
//   runtime operation that reorders the OA. The filter still applies
//   as an if guard. See p031 (sort_map) and p032 (filter_sort_map).

function match(c, ctx) {
  // Detection: identifier.filter(...).map(...)
  // tryParseMapHeader checks for filter/sort/slice chaining before .map().
  // Also _identifierStartsMapCall in brace.js peeks ahead through
  // filter/sort chains to confirm a .map() follows.
  var saved = c.save();
  if (c.kind() !== 6 /* TK.identifier */) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== 14 /* TK.dot */) { c.restore(saved); return false; }
  c.advance();
  if (c.text() !== 'filter') { c.restore(saved); return false; }
  // Skip filter(...)
  c.advance();
  if (c.kind() !== 8 /* TK.lparen */) { c.restore(saved); return false; }
  c.advance();
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === 8) depth++;
    if (c.kind() === 9) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === 9) c.advance(); // closing )
  if (c.kind() !== 14) { c.restore(saved); return false; }
  c.advance();
  var isMap = c.text() === 'map' && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === 8;
  c.restore(saved);
  return isMap;
}

function compile(c, ctx) {
  // Compilation is handled by the standard map pipeline:
  //   1. tryParseMapHeader encounters .filter() before .map()
  //   2. Parses filter callback, captures condition in filterConditions[]
  //   3. Continues to parse .map() header normally
  //   4. filterConditions stored on mapInfo
  //   5. Emit pass generates if() guard inside for loop
  //   6. _map_count only incremented when filter passes
  //   7. Nodes beyond count get .display = .none
  return null;
}

_patterns[30] = { id: 30, match: match, compile: compile };

})();
