(function() {
// ── Pattern 066: single child ──────────────────────────────────
// Index: 66
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box><Text>hi</Text></Box>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   var _arr_0 = [_]Node{ .{ .text = "hi" } };
//   var _root = Node{ .children = &_arr_0 };
//
// Notes:
//   parseChildren() walks until the matching close tag and appends each parsed
//   child in order. For the single-child case, buildNode() still allocates one
//   `_arr_N` and attaches it as `.children`.
//
//   This is the normal container path for non-Text parents. Text parents have
//   an extra hoist optimization in buildNode() and are covered more directly by
//   p068.
//
//   The distinction between p066 and p067 is made after parseChildren() has
//   already produced the full child array.

function match(c, ctx) {
  // Peek: <Tag ...> then count top-level children until </
  if (c.kind() !== TK.lt) return false;
  var saved = c.save();
  c.advance(); // skip <
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance(); // skip tag name
  // Skip attributes until > or />
  var depth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.slash_gt) { c.restore(saved); return false; } // self-closing, no children
    if (c.kind() === TK.gt) { c.advance(); break; }
    c.advance();
  }
  // Count top-level children: each < (not </) starts an element child, each { starts a brace child
  var childCount = 0;
  depth = 1;
  while (c.kind() !== TK.eof && depth > 0) {
    if (c.kind() === TK.lt_slash) {
      depth--;
      if (depth === 0) break;
      // skip past closing tag
      c.advance(); // lt_slash
      if (c.kind() === TK.identifier) c.advance(); // tag name
      if (c.kind() === TK.gt) c.advance(); // >
      continue;
    }
    if (c.kind() === TK.lt && depth === 1) {
      childCount++;
      // Enter child element
      depth++;
      c.advance();
      continue;
    }
    if (c.kind() === TK.lbrace && depth === 1) {
      childCount++;
      // Skip brace block
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
  return childCount === 1;
}

function compile(c, ctx) {
  // Owned by parseChildren() + buildNode().
  return null;
}

_patterns[66] = { id: 66, match: match, compile: compile };

})();
