// ── Pattern 067: multiple children ─────────────────────────────
// Index: 67
// Group: children
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box><A /><B /><C /></Box>
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   var _arr_0 = [_]Node{
//     .{ ...A... },
//     .{ ...B... },
//     .{ ...C... },
//   };
//   var _root = Node{ .children = &_arr_0 };
//
// Notes:
//   parseChildren() preserves child order while interleaving element, brace,
//   and text child parsing. buildNode() then materializes a `_arr_N` with one
//   entry per parsed child and wires all dynamic-text / map / conditional
//   bookkeeping back onto that array.
//
//   The current compiler emits this path correctly for multiple static
//   children; the generated array for the verification probe was:
//     [_]Node{ .{ .text = "a" }, .{ .text = "b" }, .{ .text = "c" } }

function match(c, ctx) {
  // Peek: <Tag ...> then count top-level children until </
  if (c.kind() !== TK.lt) return false;
  var saved = c.save();
  c.advance(); // skip <
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance(); // skip tag name
  // Skip attributes until > or />
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.slash_gt) { c.restore(saved); return false; } // self-closing, no children
    if (c.kind() === TK.gt) { c.advance(); break; }
    c.advance();
  }
  // Count top-level children
  var childCount = 0;
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
      childCount++;
      depth++;
      c.advance();
      continue;
    }
    if (c.kind() === TK.lbrace && depth === 1) {
      childCount++;
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
  return childCount > 1;
}

function compile(c, ctx) {
  // Owned by parseChildren() + buildNode().
  return null;
}
