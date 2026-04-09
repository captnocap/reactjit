(function() {
// ── Pattern 060: Render prop ────────────────────────────────────
// Index: 60
// Group: props
// Status: complete
//
// Matches: attr={(data) => <Component data={data} />}
//          A callback prop whose body returns JSX.
// Compile: registers the render callback, returns a marker.
//          The component system inlines the JSX when the prop is consumed.
//
// React:   <Mouse render={(pos) => <Cat position={pos} />} />
//          <DataLoader children={(data) => <Table rows={data} />} />
// Zig:     The JSX body is inlined at the call site with param bindings.

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  if (next >= c.count) return false;
  // Must start with ( for params
  if (c.kindAt(next) !== TK.lparen) return false;
  // Find => after parens
  var look = next + 1;
  var pd = 1;
  while (look < c.count && pd > 0) {
    if (c.kindAt(look) === TK.lparen) pd++;
    if (c.kindAt(look) === TK.rparen) pd--;
    look++;
  }
  if (look >= c.count || c.kindAt(look) !== TK.arrow) return false;
  // After =>, must have < (JSX return)
  look++;
  // Skip whitespace tokens if any
  while (look < c.count && c.kindAt(look) === TK.whitespace) look++;
  return look < c.count && c.kindAt(look) === TK.lt;
}

function compile(c, ctx) {
  c.advance(); // skip {
  c.advance(); // skip (

  // Collect parameter names
  var params = [];
  while (c.kind() !== TK.eof && c.kind() !== TK.rparen) {
    if (c.kind() === TK.identifier) params.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.arrow) c.advance();

  // Parse the JSX body
  var jsxResult = null;
  if (typeof parseJSXElement === 'function' && c.kind() === TK.lt) {
    jsxResult = parseJSXElement(c);
  } else {
    // Skip to closing }
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
  return { __renderProp: true, params: params, result: jsxResult };
}

_patterns[60] = { id: 60, group: 'props', name: 'render_prop', match: match, compile: compile };

})();
