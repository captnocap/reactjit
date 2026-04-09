(function() {
// ── Pattern 050: Boolean explicit ──────────────────────────────
// Index: 50
// Group: props
// Status: complete
//
// Matches: attr={true} or attr={false} — cursor at { with boolean inside
// Compile: extracts boolean value, advances past }, returns "true"/"false"
//
// React:   <Modal visible={false} />
// Zig:     propValues["visible"] = "false"

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  var next = c.pos + 1;
  if (next >= c.count) return false;
  if (c.kindAt(next) !== TK.identifier) return false;
  var text = c.textAt(next);
  if (text !== 'true' && text !== 'false') return false;
  var afterBool = next + 1;
  return afterBool < c.count && c.kindAt(afterBool) === TK.rbrace;
}

function compile(c, ctx) {
  c.advance(); // skip {
  var value = c.text(); // "true" or "false"
  c.advance(); // skip boolean
  if (c.kind() === TK.rbrace) c.advance();
  return value;
}

_patterns[50] = { id: 50, group: 'props', name: 'boolean_explicit', match: match, compile: compile };

})();
