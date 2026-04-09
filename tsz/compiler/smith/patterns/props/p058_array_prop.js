(function() {
// ── Pattern 058: Array prop ─────────────────────────────────────
// Index: 58
// Group: props
// Status: complete
//
// Matches: attr={[1, 2, 3]} — brace with array literal inside
// Compile: collects the array expression, returns as eval marker
//          for QuickJS runtime resolution (arrays are JS-heap objects).
//
// React:   <List items={[1, 2, 3]} />
//          <Chart data={[{x:1}, {x:2}]} />
// Zig:     propValues["items"] = buildEval("[1, 2, 3]", ctx)

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  return next < c.count && c.kindAt(next) === TK.lbracket;
}

function compile(c, ctx) {
  c.advance(); // skip {
  // Collect array contents including brackets
  var raw = '';
  var depth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth < 0) break; // outer }
    }
    raw += c.text();
    c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance(); // skip outer }

  // Arrays live on JS heap — route through eval
  if (typeof buildEval === 'function') {
    return buildEval(raw, ctx);
  }
  return raw;
}

_patterns[58] = { id: 58, group: 'props', name: 'array_prop', match: match, compile: compile };

})();
