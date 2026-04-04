(function() {
// ── Pattern 108: className ternary ──────────────────────────────
// Index: 108
// Group: style
// Status: complete
//
// Soup syntax (copy-paste React):
//   <div className={active ? 'on' : 'off'} />
//   <Box className={isError ? 'error-box' : 'normal-box'} />
//
// Mixed syntax (hybrid):
//   Not applicable — use computed inline styles instead:
//   <Box style={{backgroundColor: active ? 'red' : 'blue'}} />
//
// Zig output target:
//   // className is DROPPED with a warning, regardless of value type.
//   // Warning: [W] dynamic className dropped
//
// Notes:
//   Same handling as p107 — className is dropped in all forms.
//   Dynamic className values (ternary, template literal, function call)
//   produce the warning "[W] dynamic className dropped" (soup.js:514).
//
//   The equivalent in Smith is a computed inline style (p106):
//     style={{backgroundColor: isActive ? 'theme-error' : 'theme-bg'}}
//   which compiles to a Zig conditional Color expression.
//
//   Status is "complete" because dropping with a warning is correct.

function match(c, ctx) {
  // className={expr ? a : b}
  if (c.kind() !== TK.identifier) return false;
  var t = c.text();
  if (t !== 'className' && t !== 'class') return false;
  if (c.pos + 2 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.equals) return false;
  if (c.kindAt(c.pos + 2) !== TK.lbrace) return false;
  // scan inside braces for ? before }
  var saved = c.save();
  c.advance(); c.advance(); c.advance(); // skip className = {
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    var k = c.kind();
    if (k === TK.lbrace) depth++;
    else if (k === TK.rbrace) depth--;
    else if (k === TK.question && depth === 1) { c.restore(saved); return true; }
    if (k === TK.eof) break;
    c.advance();
  }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  return null;
}

_patterns[108] = { id: 108, match: match, compile: compile };

})();
