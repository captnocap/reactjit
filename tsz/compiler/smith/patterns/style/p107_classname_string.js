(function() {
// ── Pattern 107: className string ───────────────────────────────
// Index: 107
// Group: style
// Status: complete
//
// Soup syntax (copy-paste React):
//   <div className="header" />
//   <span className="btn primary" />
//   <section className="container" />
//
// Mixed syntax (hybrid):
//   Not applicable — Smith uses inline style objects, not CSS classes.
//
// Zig output target:
//   // className is SILENTLY DROPPED with a warning.
//   // No Zig output for className.
//   // The element compiles as if className were not present.
//   // Warning: [W] className="header" dropped
//
// Notes:
//   Implemented in soup.js lines 231, 511-515:
//     if (propName === 'style' || propName === 'key' || propName === 'className') continue;
//     var cn = attrs['classname'] || attrs['class'];
//     if (cn) warns.push('[W] className="' + String(cn).substring(0, 40) + '" dropped');
//
//   Smith compiles to a native Zig UI framework with no CSS engine.
//   There are no stylesheets, no class-to-style resolution, and no
//   CSS specificity. All styling is done through the inline style={{...}}
//   prop which maps directly to Zig Node struct fields.
//
//   When soup-mode code uses className, the compiler drops it and emits
//   a warning so the developer knows to convert to inline styles.
//
//   For chad-tier code, the equivalent is classifiers (.cls.tsz files)
//   which are compile-time style presets — not CSS classes.
//
//   Status is "complete" because dropping with a warning is the correct
//   and intentional behavior.

function match(c, ctx) {
  // className="string" or class="string"
  if (c.kind() !== TK.identifier) return false;
  var t = c.text();
  if (t !== 'className' && t !== 'class') return false;
  if (c.pos + 2 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.equals && c.kindAt(c.pos + 2) === TK.string;
}

function compile(c, ctx) {
  void ctx;
  var attr = c.text();
  c.advance();
  if (c.kind() === TK.equals) c.advance();
  var value = '';
  if (c.kind() === TK.string) {
    value = c.text().slice(1, -1);
    c.advance();
  }
  return {
    kind: 'dropped_classname',
    attr: attr,
    dynamic: false,
    className: value,
    warning: '[W] className="' + String(value).substring(0, 40) + '" dropped',
  };
}

_patterns[107] = { id: 107, match: match, compile: compile };

})();
