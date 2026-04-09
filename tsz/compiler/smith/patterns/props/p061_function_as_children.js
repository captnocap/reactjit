(function() {
// ── Pattern 061: Function-as-children ───────────────────────────
// Index: 61
// Group: props
// Status: complete
//
// Matches: <Parent>{(data) => <Child data={data} />}</Parent>
//          Children slot contains a function that receives data and returns JSX.
//          This is the "children" variant of render props (p060).
// Compile: same as p060 but the function appears in children position,
//          not as a named prop. Returns a render prop marker tagged as children.
//
// React:   <Mouse>{(pos) => <Cat position={pos} />}</Mouse>
// Zig:     Inlined at component expansion with param binding.

function match(c, ctx) {
  // In children context: cursor at { after opening tag's >
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  if (next >= c.count) return false;
  if (c.kindAt(next) !== TK.lparen) return false;
  // Find => after parens
  var look = next + 1;
  var pd = 1;
  while (look < c.count && pd > 0) {
    if (c.kindAt(look) === TK.lparen) pd++;
    if (c.kindAt(look) === TK.rparen) pd--;
    look++;
  }
  return look < c.count && c.kindAt(look) === TK.arrow;
}

function compile(c, ctx) {
  c.advance(); // skip {
  c.advance(); // skip (

  var params = [];
  while (c.kind() !== TK.eof && c.kind() !== TK.rparen) {
    if (c.kind() === TK.identifier) params.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.arrow) c.advance();

  // Parse body — could be JSX or expression
  var jsxResult = null;
  if (typeof parseJSXElement === 'function' && c.kind() === TK.lt) {
    jsxResult = parseJSXElement(c);
  } else {
    var depth = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) {
        if (depth === 0) break;
        depth--;
      }
      c.advance();
    }
  }

  if (c.kind() === TK.rbrace) c.advance();
  return { __renderProp: true, isChildren: true, params: params, result: jsxResult };
}

_patterns[61] = { id: 61, group: 'props', name: 'function_as_children', match: match, compile: compile };

})();
