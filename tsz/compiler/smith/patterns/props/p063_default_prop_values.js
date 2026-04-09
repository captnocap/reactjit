(function() {
// ── Pattern 063: Default prop values ────────────────────────────
// Index: 63
// Group: props
// Status: complete
//
// Matches: { title = 'Untitled', count = 0 } — destructured params
//          with default values in component signature.
// Compile: extracts prop names and their defaults. When a prop isn't
//          provided at the call site, the default is used during inlining.
//
// React:   function Card({ title = 'Untitled', size = 'md' }) { ... }
// Zig:     propStack["title"] = caller's value OR "Untitled"
//
// This is a specialization of p062 that focuses on the default extraction.
// p062 already handles the full destructuring; this pattern specifically
// matches when defaults are present and ensures they're recorded.

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  // Scan ahead for = inside the destructuring (indicates defaults)
  var look = c.pos + 1;
  var depth = 1;
  var hasDefault = false;
  while (look < c.count && depth > 0) {
    if (c.kindAt(look) === TK.lbrace) depth++;
    if (c.kindAt(look) === TK.rbrace) depth--;
    if (depth === 1 && c.kindAt(look) === TK.equals) {
      hasDefault = true;
      break;
    }
    look++;
  }
  return hasDefault;
}

function compile(c, ctx) {
  // Delegate to p062's destructuring logic which already handles defaults
  var result = _patterns[62] ? _patterns[62].compile(c, ctx) : null;
  if (result && result.__destructuredProps) {
    result.__hasDefaults = Object.keys(result.defaults).length > 0;
  }
  return result;
}

_patterns[63] = { id: 63, group: 'props', name: 'default_prop_values', match: match, compile: compile };

})();
