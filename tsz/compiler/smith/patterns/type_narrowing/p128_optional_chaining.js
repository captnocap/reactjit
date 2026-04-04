(function() {
// ── Pattern 128: Optional chaining ──────────────────────────────
// Index: 128
// Group: type_narrowing
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{user?.name}</Text>
//   <Text>{data?.items?.length}</Text>
//   <Image source={{uri: item?.imageUrl}} />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Optional chaining on OA field (field might be null):
//   // If the OA field type is string, null = empty string (len 0).
//   // The ?. is stripped and treated as regular field access:
//   .{ .text = _oa0_name[_i][0.._oa0_name_lens[_i]] }
//
//   // Optional chaining on state (QuickJS eval):
//   .{ .text = "" }  // dynText: qjs_runtime.evalToString("String(user?.name)", &_eval_buf_0)
//
//   // Optional chaining in Zig (orelse):
//   const name = user.?.name;  // Zig optional unwrap
//
// Notes:
//   The ?. operator (optional chaining) is NOT tokenized by Smith's lexer.
//   The lexer produces TK.question + TK.dot as separate tokens, or may
//   not recognize the ?. sequence at all depending on context.
//
//   The lexer (lexer.zig) has TK.question (39) and TK.question_question (40)
//   for ? and ?? respectively. There is no TK.question_dot token.
//
//   When ?. appears in an expression that falls through to QuickJS eval,
//   it works correctly — QuickJS supports optional chaining natively.
//   The eval string preserves the ?. syntax.
//
//   For OA field access (item?.field inside a map), the ?. could be
//   stripped since OA fields always exist. But the parser would need
//   to recognize TK.question + TK.dot as a field access sequence, which
//   it currently doesn't.
//
//   In the mod.js compiler (module blocks), optional chaining IS handled:
//   `name + '.?.'` replaces ?. with Zig's optional field access syntax
//   (mod.js:1245). But this is for module code, not JSX expressions.
//
//   Implementation plan:
//   1. Add TK.question_dot to lexer (or recognize ? + . sequence)
//   2. In field access resolution, treat ?. same as . for OA fields
//   3. For non-OA expressions, preserve ?. in QuickJS eval strings
//   4. For Zig output in module code, use .?. (orelse) syntax

function match(c, ctx) {
  // Detect: identifier?.identifier
  // Without a TK.question_dot token, this is identifier + ? + . + identifier
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance();
  var result = c.kind() === TK.question &&
    c.pos + 2 < c.count &&
    c.kindAt(c.pos + 1) === TK.dot &&
    c.kindAt(c.pos + 2) === TK.identifier;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Optional chaining (?.) has no dedicated lexer token — it arrives as
  // identifier + TK.question + TK.dot + identifier. QuickJS supports ?.
  // natively, so the expression works correctly via eval.
  //
  // For OA field access in maps, ?. could be stripped (fields always exist),
  // but we'd need to recognize the ? + . sequence as a field access, which
  // the current token stream doesn't support cleanly.
  //
  // Collect the full expression and route through QuickJS eval.
  var parts = [];
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    // Reconstruct ?. from separate tokens
    if (c.kind() === TK.question &&
        c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.dot) {
      parts.push('?.');
      c.advance(); // skip ?
      c.advance(); // skip .
      continue;
    }
    parts.push(c.text());
    c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();

  var expr = parts.join('');
  return { value: buildEval(expr, ctx) };
}

_patterns[128] = { id: 128, match: match, compile: compile };

})();
