(function() {
// ── Pattern 064: Rest props ─────────────────────────────────────
// Index: 64
// Group: props
// Status: complete
//
// Matches: { title, ...rest } — destructured params with rest element.
//          The ...rest collects all props not explicitly named.
// Compile: extracts named props and the rest identifier. At compile
//          time, rest is resolved to the remaining OA fields or
//          prop stack entries not already destructured.
//
// React:   function Card({ title, ...rest }) { return <Box {...rest} />; }
// Zig:     Named props resolved individually, rest = remaining fields

function match(c, ctx) {
  if (c.kind() !== TK.lbrace) return false;
  // Scan ahead for ... inside the destructuring
  var look = c.pos + 1;
  var depth = 1;
  var hasRest = false;
  while (look < c.count && depth > 0) {
    if (c.kindAt(look) === TK.lbrace) depth++;
    if (c.kindAt(look) === TK.rbrace) depth--;
    if (depth === 1 && c.kindAt(look) === TK.spread) {
      hasRest = true;
      break;
    }
    look++;
  }
  return hasRest;
}

function compile(c, ctx) {
  c.advance(); // skip {
  var named = [];
  var restName = null;

  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    // Rest element: ...name
    if (c.kind() === TK.spread) {
      c.advance();
      if (c.kind() === TK.identifier) {
        restName = c.text();
        c.advance();
      }
      continue;
    }

    if (c.kind() === TK.identifier) {
      var name = c.text();
      c.advance();
      // Skip default value if present
      if (c.kind() === TK.equals) {
        c.advance();
        var depth = 0;
        while (c.kind() !== TK.eof) {
          if (c.kind() === TK.lbrace || c.kind() === TK.lbracket || c.kind() === TK.lparen) depth++;
          if (c.kind() === TK.rbrace || c.kind() === TK.rbracket || c.kind() === TK.rparen) {
            if (depth === 0) break;
            depth--;
          }
          if (c.kind() === TK.comma && depth === 0) break;
          c.advance();
        }
      }
      // Skip rename
      if (c.kind() === TK.colon) {
        c.advance();
        if (c.kind() === TK.identifier) c.advance();
      }
      named.push(name);
    }

    if (c.kind() === TK.comma) c.advance();
    else if (c.kind() !== TK.rbrace && c.kind() !== TK.identifier && c.kind() !== TK.spread) c.advance();
  }

  if (c.kind() === TK.rbrace) c.advance();
  return { __destructuredProps: true, props: named, rest: restName, defaults: {} };
}

_patterns[64] = { id: 64, group: 'props', name: 'rest_props', match: match, compile: compile };

})();
