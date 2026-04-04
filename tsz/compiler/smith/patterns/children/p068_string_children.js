(function() {
// ── Pattern 068: string children ───────────────────────────────
// Index: 68
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>hello world</Text>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   var _root = Node{ .text = "hello world" };
//
// Notes:
//   Raw text between tags is parsed by tryParseTextChild() into child nodes of
//   the form:
//     .{ .text = "hello world" }
//
//   When the parent tag is Text, buildNode() recognizes the single static text
//   child and hoists it directly onto the Text node's `.text` field instead of
//   emitting a child array. That is why the generated output for this pattern
//   is a single `Node{ .text = ... }`.

function match(c, ctx) {
  // Raw text token inside children position.
  return c.kind() !== TK.lt &&
         c.kind() !== TK.lt_slash &&
         c.kind() !== TK.lbrace &&
         c.kind() !== TK.rbrace &&
         c.kind() !== TK.eof &&
         c.kind() !== TK.comment;
}

function compile(c, ctx) {
  var textStart = c.starts[c.pos];
  var textEnd = textStart;
  while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash &&
         c.kind() !== TK.lbrace && c.kind() !== TK.eof &&
         c.kind() !== TK.rbrace) {
    textEnd = c.ends[c.pos];
    c.advance();
  }
  var text = c._byteSlice(textStart, textEnd).trim();
  if (!text) return null;
  return { nodeExpr: '.{ .text = "' + text.replace(/"/g, '\\"') + '" }' };
}

_patterns[68] = { id: 68, match: match, compile: compile };

})();
