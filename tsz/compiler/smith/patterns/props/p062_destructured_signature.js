(function() {
// ── Pattern 062: Destructured params ────────────────────────────
// Index: 62
// Group: props
// Status: complete
//
// Matches: function Component({ title, body, children }) — destructured
//          parameter in component function signature.
// Compile: extracts prop names from the destructuring pattern, registers
//          them as expected props for the component so the prop stack
//          can resolve them during inlining.
//
// React:   function Card({ title, body }) { return <div>{title}</div>; }
// Zig:     Component's propStack is seeded with ["title", "body"]
//
// This pattern fires at component definition time, not at call site.
// The cursor is at { inside a function parameter list.

function match(c, ctx) {
  // Cursor at { inside function params: function Name({ ... })
  return c.kind() === TK.lbrace;
}

function compile(c, ctx) {
  c.advance(); // skip {
  var props = [];
  var defaults = {};

  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.identifier) {
      var name = c.text();
      c.advance();

      // Check for default value: prop = defaultValue
      if (c.kind() === TK.equals) {
        c.advance();
        // Collect default value tokens until , or }
        var defVal = '';
        var depth = 0;
        while (c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace || c.kind() === TK.lbracket || c.kind() === TK.lparen) depth++;
          if (c.kind() === TK.rbrace || c.kind() === TK.rbracket || c.kind() === TK.rparen) {
            if (depth === 0) break;
            depth--;
          }
          if (c.kind() === TK.comma && depth === 0) break;
          defVal += c.text();
          c.advance();
        }
        defaults[name] = defVal.trim();
      }

      // Check for rename: originalName: localName
      if (c.kind() === TK.colon) {
        c.advance();
        if (c.kind() === TK.identifier) {
          name = c.text(); // use the local name
          c.advance();
        }
      }

      props.push(name);
    }

    if (c.kind() === TK.comma) c.advance();
    else if (c.kind() !== TK.rbrace && c.kind() !== TK.identifier) c.advance();
  }

  if (c.kind() === TK.rbrace) c.advance();
  return { __destructuredProps: true, props: props, defaults: defaults };
}

_patterns[62] = { id: 62, group: 'props', name: 'destructured_signature', match: match, compile: compile };

})();
