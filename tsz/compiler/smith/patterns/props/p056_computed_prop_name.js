(function() {
// ── Pattern 056: Computed prop name ─────────────────────────────
// Index: 56
// Group: props
// Status: complete
//
// Matches: cursor at [ indicating computed property name in JSX
//          e.g. <Comp [dynamicKey]={value} />
// Compile: extracts the key expression, returns marker for runtime resolution
//
// React:   <Comp {...{[key]: value}} />  (computed keys in spread)
// Note:    JSX doesn't natively support [key]= syntax. This pattern
//          recognizes the React idiom of computed keys inside spread
//          objects: {...{[expr]: val}}.
//
// In tsz compilation, computed prop names require QuickJS eval at runtime
// since the key isn't known at compile time.

function match(c, ctx) {
  // Inside a brace context: { [expr]: value }
  if (c.kind() !== TK.lbracket) return false;
  // Must have a closing ] followed by :
  var look = c.pos + 1;
  var depth = 1;
  while (look < c.count && depth > 0) {
    if (c.kindAt(look) === TK.lbracket) depth++;
    if (c.kindAt(look) === TK.rbracket) depth--;
    look++;
  }
  return look < c.count && c.kindAt(look) === TK.colon;
}

function compile(c, ctx) {
  c.advance(); // skip [
  var keyExpr = '';
  var depth = 1;
  while (c.kind() !== TK.eof && depth > 0) {
    if (c.kind() === TK.lbracket) depth++;
    if (c.kind() === TK.rbracket) {
      depth--;
      if (depth === 0) break;
    }
    keyExpr += c.text();
    c.advance();
  }
  if (c.kind() === TK.rbracket) c.advance(); // skip ]
  if (c.kind() === TK.colon) c.advance(); // skip :

  // Collect value
  var val = '';
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace && c.kind() !== TK.comma) {
    val += c.text();
    c.advance();
  }

  return { __computed: true, key: keyExpr, value: val };
}

_patterns[56] = { id: 56, group: 'props', name: 'computed_prop_name', match: match, compile: compile };

})();
