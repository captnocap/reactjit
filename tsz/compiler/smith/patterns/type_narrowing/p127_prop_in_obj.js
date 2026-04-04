// ── Pattern 127: 'prop' in obj ──────────────────────────────────
// Index: 127
// Group: type_narrowing
// Status: complete
//
// Soup syntax (copy-paste React):
//   {'url' in item && <Image source={{uri: item.url}} />}
//   {'name' in data && <Text>{data.name}</Text>}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // 'in' operator → QuickJS eval truthiness:
//   nodes.guard.style.display = if (
//     qjs_runtime.evalToString("('url' in item) ? 'T' : ''", &_eval_buf_0).len > 0
//   ) .flex else .none;
//
// Notes:
//   The `in` operator is a JavaScript runtime check that tests whether a
//   property exists on an object. Smith has no equivalent — Zig structs
//   have known fields at compile time.
//
//   When used in && conditions, the `in` expression falls through to
//   QuickJS eval like other unresolvable conditions (p125 typeof, p126
//   isArray). The truthiness wrapper handles display toggling.
//
//   The lexer tokenizes 'url' as TK.string and `in` as TK.identifier
//   (not a keyword). The conditional parser collects the tokens as raw
//   condition text.
//
//   For OA-backed data, the field always exists (it's a declared OA field),
//   so the `in` check is always true. Smith could optimize this to a
//   no-op, but the QuickJS path handles it correctly.
//
//   For non-OA data (QuickJS-managed JS objects), the `in` check is
//   meaningful and the eval path is correct.

function match(c, ctx) {
  // Detect: 'string' in identifier
  // The 'in' keyword appears as TK.identifier with text 'in'.
  if (c.kind() !== TK.string) return false;
  var saved = c.save();
  c.advance();
  var result = c.kind() === TK.identifier && c.text() === 'in';
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // The `in` operator is a JavaScript runtime check — no Zig equivalent.
  // Zig structs have known fields at compile time, so property existence
  // checks are only meaningful in the JS eval context.
  //
  // For OA-backed data, the field always exists (declared OA field), so
  // the check is always true. We don't optimize that away — correctness
  // through QuickJS eval is preferred.

  // Collect: 'prop' in obj
  var parts = [];
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace &&
         c.kind() !== TK.amp_amp && c.kind() !== TK.question) {
    parts.push(c.text());
    c.advance();
  }

  var expr = parts.join(' ');
  return { condExpr: zigBool(buildEval(expr, ctx), ctx) };
}
