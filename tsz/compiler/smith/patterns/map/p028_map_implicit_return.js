(function() {
// ── Pattern 028: .map() with implicit return ───────────────────
// Index: 28
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map(item => (
//     <Box style={{padding: 8}}>
//       <Text>{item.name}</Text>
//     </Box>
//   ))}
//
//   // Also valid without parens for single element:
//   {items.map(item => <Text>{item.name}</Text>)}
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   for (0.._oa0_len) |_i| {
//     _map_pool_0[_i] = .{ .style = .{ .padding = .{ .all = 8 } },
//       .children = &_arr_0 };
//   }
//
// Notes:
//   Arrow function with implicit return: (item) => (<JSX>) or
//   (item) => <JSX>. This is the most common map pattern in React.
//
//   tryParseMapHeader() handles this path:
//     1. Parses (item) or item
//     2. Consumes =>
//     3. If next token is (, consumes it (paren-wrapped JSX)
//     4. Falls through to parseJSXElement for the template body
//
//   The optional parens around the JSX body are consumed by the
//   header parser. consumeMapClose() then handles the closing ) and
//   the .map() closing ).
//
//   This is the default/happy path for map parsing. Patterns p024-p026
//   (key variants) all use this return style. The only difference from
//   p029 (explicit return) is that there's no { return ... } wrapper.
//
//   See: virtually all map conformance tests use implicit return.

function match(c, ctx) {
  var saved = c.save();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  while (c.kind() === TK.dot && c.pos + 1 < c.count) {
    c.advance(); // skip .
    if (c.kind() === TK.identifier && c.text() === 'map') {
      c.advance(); // skip 'map'
      if (c.kind() !== TK.lparen) break;
      c.advance(); // skip ( after map
      // Skip callback params: either (params) => or param =>
      var depth = 0;
      if (c.kind() === TK.lparen) {
        depth = 1;
        c.advance();
        while (c.pos < c.count && depth > 0) {
          if (c.kind() === TK.lparen) depth++;
          if (c.kind() === TK.rparen) depth--;
          c.advance();
        }
      } else if (c.kind() === TK.identifier) {
        c.advance(); // skip bare param
      } else { break; }
      // Expect =>
      if (c.kind() !== TK.arrow) break;
      c.advance(); // skip =>
      // Implicit return: next is ( (paren-wrapped JSX) or < (direct JSX)
      if (c.kind() === TK.lparen || c.kind() === TK.lt) {
        c.restore(saved);
        return true;
      }
      break;
    }
    if (c.kind() !== TK.identifier) break;
    c.advance(); // skip field name
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // Standard map compilation path:
  //   1. Header parsed by tryParseMapHeader
  //   2. => consumed, optional ( consumed
  //   3. parseJSXElement called for template body
  //   4. consumeMapClose handles ) ) closings
  //   5. Normal map pool emission
  return null;
}

_patterns[28] = { id: 28, match: match, compile: compile };

})();
