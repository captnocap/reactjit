(function() {
// ── Pattern 048: Number prop ──────────────────────────────────
// Index: 48
// Group: props
// Status: complete
//
// Matches: attr={42} or attr={-3.14} — cursor at { with number inside
// Compile: extracts numeric value, advances past }, returns value
//
// React:   <Grid columns={3} />
// Zig:     propValues["columns"] = "3"

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  if (next < c.count && c.kindAt(next) === TK.minus) next++;
  if (next >= c.count) return false;
  if (c.kindAt(next) !== TK.number) return false;
  var afterNum = next + 1;
  return afterNum < c.count && c.kindAt(afterNum) === TK.rbrace;
}

function compile(c, ctx) {
  c.advance(); // skip {
  var neg = '';
  if (c.kind() === TK.minus) {
    neg = '-';
    c.advance();
  }
  var value = neg + c.text();
  c.advance(); // skip number
  if (c.kind() === TK.rbrace) c.advance();
  return value;
}

_patterns[48] = { id: 48, group: 'props', name: 'number_prop', match: match, compile: compile };

})();
