// ── Pattern 062: destructured params ───────────────────────────
// Index: 62
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   function Card({name, age}) {
//     return <Text>{name}</Text>;
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Call site:
//   <Card name="Ada" age={37} />
//   //
//   // Inlined body:
//   var _root = Node{ .children = &_arr_0 };
//   var _arr_0 = [_]Node{
//     .{ .text = "Ada" },
//     .{ .text = "37" },
//   };
//
// Notes:
//   collectComponents() recognizes function Name({ ... }) signatures and
//   records each identifier inside the destructuring braces as a prop name.
//
//   During component inlining:
//     - collectComponentPropValues() captures opening-tag props
//     - inlineComponentCall() assigns them to ctx.propStack
//     - parse/children/brace.js resolves bare {name} / {age} through that map
//
//   The current implementation handles flat destructured signatures like
//   {name, age}. Nested destructuring is a different pattern and is not
//   claimed here.

function match(c, ctx) {
  // function Name({a, b}) { ... }
  var saved = c.save();
  if (!c.isIdent('function')) return false;
  c.advance();
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== TK.lbrace) { c.restore(saved); return false; }
  c.advance();

  var sawIdent = false;
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.equals || c.kind() === TK.spread) {
      c.restore(saved);
      return false;
    }
    if (c.kind() === TK.identifier) sawIdent = true;
    c.advance();
  }

  var ok = sawIdent && c.kind() === TK.rbrace;
  c.restore(saved);
  return ok;
}

function compile(c, ctx) {
  // Signature collection happens in collect/components.js, not inline here.
  return null;
}
