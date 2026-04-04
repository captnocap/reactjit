// ── Pattern 029: .map() with explicit return ───────────────────
// Index: 29
// Group: map
// Status: complete
//
// Soup syntax (copy-paste React):
//   {items.map(function(item) {
//     return (
//       <Box style={{padding: 8}}>
//         <Text>{item.name}</Text>
//       </Box>
//     );
//   })}
//
//   // Also with arrow function:
//   {items.map((item) => {
//     return <Box><Text>{item.name}</Text></Box>;
//   })}
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
//   Explicit return in map callback: (item) => { return <JSX>; }
//   or function(item) { return <JSX>; }
//
//   tryParseMapHeader() handles the function body:
//     1. Parses params normally
//     2. If next token after => is {, enters function body mode
//     3. Scans for top-level `return` keyword (bodyDepth === 1)
//     4. Advances past `return`
//     5. Optionally consumes ( before JSX
//     6. Falls through to parseJSXElement
//
//   tryParseMapHeaderFromMethod() has identical logic for the
//   function() form.
//
//   consumeMapClose() handles the closing sequence:
//     ) — close paren around JSX (if present)
//     ; — semicolon after return statement
//     } — close function body
//     ) — close .map(...)
//
//   The Zig output is identical to implicit return (p028). The
//   explicit return is just a different JS syntax for the same thing.
//
//   See conformance: some tests use function() form for .map callbacks.

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
      // Also handle function(params) { ... }
      if (c.kind() === TK.identifier && c.text() === 'function') {
        // function(params) { — explicit return form
        c.restore(saved);
        return true;
      }
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
      // Explicit return: next is { (block body)
      if (c.kind() === TK.lbrace) {
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
  // Compilation:
  //   1. Header parser detects { after => or function keyword
  //   2. Scans for return at bodyDepth === 1
  //   3. Advances past return, optional (
  //   4. parseJSXElement for template body (same as implicit return)
  //   5. consumeMapClose handles }  ) closings
  //   6. Zig output identical to implicit return
  return null;
}
