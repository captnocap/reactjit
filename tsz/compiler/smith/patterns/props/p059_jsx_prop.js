(function() {
// ── Pattern 059: JSX as prop ────────────────────────────────────
// Index: 59
// Group: props
// Status: complete
//
// Matches: attr={<Element />} — brace with JSX element inside
// Compile: parses the inner JSX element, returns as a slot marker
//          for component inlining. Mirrors tryParseComponentBraceProp()
//          JSX slot handling.
//
// React:   <Layout header={<Header />} sidebar={<Nav />} />
// Zig:     propValues["header"] = { __jsxSlot: true, result: parsedNode }

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  return next < c.count && c.kindAt(next) === TK.lt;
}

function compile(c, ctx) {
  c.advance(); // skip {

  // Parse the inner JSX element
  var jsxResult = null;
  if (typeof parseJSXElement === 'function') {
    jsxResult = parseJSXElement(c);
  } else {
    // Fallback: skip to closing }
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
  return { __jsxSlot: true, result: jsxResult };
}

_patterns[59] = { id: 59, group: 'props', name: 'jsx_prop', match: match, compile: compile };

})();
