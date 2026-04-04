// ── Pattern 070: mixed children ────────────────────────────────
// Index: 70
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box><Text>hi</Text>{name}<A /></Box>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   var _arr_0 = [_]Node{
//     .{ .text = "hi" },
//     .{ .text = "Ada" },
//     .{ ...A... },
//   };
//   var _root = Node{ .children = &_arr_0 };
//
// Notes:
//   parseChildren() interleaves:
//     - element children from tryParseElementChild()
//     - brace children from tryParseBraceChild()
//     - raw text children from tryParseTextChild()
//
//   The resulting child list preserves source order. buildNode() only hoists
//   a single static text child on Text parents; once the child list is mixed,
//   it emits a normal `_arr_N` array and keeps every entry in order.
//
//   The verification probe for:
//     <Box><Text>hi</Text>{name}<Badge /></Box>
//   generated:
//     [_]Node{ .{ .text = "hi" }, .{ .text = "Ada" }, .{ .text = "!" } }

function match(c, ctx) {
  // Peek: <Tag ...> then check if children contain BOTH element (<) and brace ({) children
  if (c.kind() !== TK.lt) return false;
  var saved = c.save();
  c.advance(); // skip <
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance(); // skip tag name
  // Skip attributes until > or />
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.slash_gt) { c.restore(saved); return false; } // self-closing
    if (c.kind() === TK.gt) { c.advance(); break; }
    c.advance();
  }
  // Track whether we see element children and brace children
  var hasElement = false;
  var hasBrace = false;
  var depth = 1;
  while (c.kind() !== TK.eof && depth > 0) {
    if (c.kind() === TK.lt_slash) {
      depth--;
      if (depth === 0) break;
      c.advance();
      if (c.kind() === TK.identifier) c.advance();
      if (c.kind() === TK.gt) c.advance();
      continue;
    }
    if (c.kind() === TK.lt && depth === 1) {
      hasElement = true;
      depth++;
      c.advance();
      continue;
    }
    if (c.kind() === TK.lbrace && depth === 1) {
      hasBrace = true;
      var braceDepth = 1;
      c.advance();
      while (c.kind() !== TK.eof && braceDepth > 0) {
        if (c.kind() === TK.lbrace) braceDepth++;
        if (c.kind() === TK.rbrace) braceDepth--;
        c.advance();
      }
      continue;
    }
    c.advance();
  }
  c.restore(saved);
  return hasElement && hasBrace;
}

function compile(c, ctx) {
  // Owned by parseChildren() + buildNode().
  return null;
}
