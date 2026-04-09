(function() {
// ── Pattern 049: Boolean shorthand ─────────────────────────────
// Index: 49
// Group: props
// Status: complete
//
// Matches: <Btn disabled /> — attr name with no = (next token is
//          another identifier, / or >)
// Compile: returns "true" without advancing (the attr loop handles advance)
//
// React:   <Input disabled />
// Zig:     propValues["disabled"] = "true"
//
// In React, a bare attribute with no value is implicitly true.
// The cursor is at the token AFTER the attr name. If there's no =,
// the attr is boolean shorthand.

function match(c, ctx) {
  // Called when cursor is past attr name. If next is not =, it's boolean shorthand.
  // The caller checks: if (c.kind() === TK.equals) { advance; tryPatternMatch }
  // So this pattern only fires if the caller routes bare-attr detection here.
  // For standalone use: cursor is at an identifier and the next token is NOT =
  if (c.kind() !== TK.identifier) return false;
  var next = c.pos + 1;
  if (next >= c.count) return true; // last token = bare attr
  var nextKind = c.kindAt(next);
  return nextKind !== TK.equals;
}

function compile(c, ctx) {
  // Don't advance — the attr name is consumed by the outer loop.
  // Just return the boolean value.
  return 'true';
}

_patterns[49] = { id: 49, group: 'props', name: 'boolean_shorthand', match: match, compile: compile };

})();
