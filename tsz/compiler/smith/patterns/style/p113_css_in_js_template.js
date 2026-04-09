(function() {
// ── Pattern 113: CSS-in-JS template literal ─────────────────────
// Index: 113
// Group: style
// Status: complete
//
// Soup syntax (copy-paste React):
//   const Header = styled.div`
//     color: ${theme.primary};
//     padding: 16px;
//   `;
//   // or:
//   css`color: ${props.color}; font-size: 14px;`
//
// Mixed syntax (hybrid):
//   // Not applicable — tagged template literals for CSS are a web pattern.
//   // Mixed: use inline style objects.
//
// Zig output target:
//   // N/A — tagged template literals (styled-components, emotion css``)
//   // generate CSS at runtime via the DOM's CSSOM. No equivalent in native.
//   // The closest native equivalent is the inline style object pattern:
//   //   .{ .style = .{ .color = parseColor("#primary"), .padding = 16 } }
//
// Notes:
//   CSS-in-JS template literals (styled-components, emotion, linaria)
//   use tagged template literals to define component styles. These produce
//   CSS strings injected into the DOM — no Zig equivalent exists.
//   The lexer can tokenize template literals but doesn't handle tagged
//   templates specially. The tag function (styled.div, css) would be
//   treated as a normal expression.
//   To support this, the compiler would need:
//     1. Recognize tagged template literal syntax
//     2. Parse the CSS inside the template
//     3. Map CSS properties to Zig style struct fields
//     4. Handle dynamic interpolations (${props.color})
//   Users should convert to inline style objects.

function match(c, ctx) {
  // css`...` or styled.div`...`
  if (c.kind() !== TK.identifier) return false;
  var t = c.text();
  if (t === 'css') {
    if (c.pos + 1 >= c.count) return false;
    return c.kindAt(c.pos + 1) === TK.template_literal;
  }
  if (t === 'styled') {
    if (c.pos + 3 >= c.count) return false;
    return c.kindAt(c.pos + 1) === TK.dot &&
           c.kindAt(c.pos + 2) === TK.identifier &&
           c.kindAt(c.pos + 3) === TK.template_literal;
  }
  return false;
}

function compile(c, children, ctx) {
  void children;
  void ctx;
  var tag = c.text();
  c.advance();
  if (tag === 'styled' && c.kind() === TK.dot) {
    tag += '.';
    c.advance();
    if (c.kind() === TK.identifier) {
      tag += c.text();
      c.advance();
    }
  }
  var template = '';
  if (c.kind() === TK.template_literal) {
    template = c.text().slice(1, -1);
    c.advance();
  }
  return {
    kind: 'css_in_js_template',
    tag: tag,
    template: template,
    warning: '[W] CSS-in-JS template has no native style target; use style={{...}}',
  };
}

_patterns[113] = { id: 113, match: match, compile: compile };

})();
