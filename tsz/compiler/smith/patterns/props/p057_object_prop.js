(function() {
// ── Pattern 057: Object prop ────────────────────────────────────
// Index: 57
// Group: props
// Status: complete
//
// Matches: attr={{ key: val, ... }} — double brace (object literal in JSX)
// Compile: collects the inner object as a raw expression string.
//          For style objects, this feeds into style resolution.
//          For data objects, this routes through QuickJS eval.
//
// React:   <Box style={{ color: 'red', padding: 10 }} />
//          <Chart data={{ x: 1, y: 2 }} />
// Zig:     propValues["style"] = "{ color: 'red', padding: 10 }" (then resolved)

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  return next < c.count && c.kindAt(next) === TK.lbrace;
}

function compile(c, ctx) {
  c.advance(); // skip outer {
  // Collect everything between inner { } including the braces
  var depth = 0;
  var raw = '';
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) {
      depth--;
      if (depth < 0) break; // outer }
      if (depth === 0) {
        raw += c.text();
        c.advance();
        break;
      }
    }
    raw += c.text();
    if (c.kind() !== TK.rbrace) raw += ' ';
    c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance(); // skip outer }

  // Return as an object marker for downstream style/data resolution
  return { __object: true, raw: raw.trim() };
}

_patterns[57] = { id: 57, group: 'props', name: 'object_prop', match: match, compile: compile };

})();
