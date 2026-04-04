// ── Pattern 124: Array join ─────────────────────────────────────
// Index: 124
// Group: strings
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>{items.join(", ")}</Text>
//   <Text>{tags.join(" | ")}</Text>
//   <Text>{[firstName, lastName].join(" ")}</Text>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // OA string fields joined with separator:
//   // This requires building a string at runtime by iterating OA entries.
//   // Target: dynText with runtime join helper:
//   .{ .text = "" }  // dynText: runtime_join(_oa0_name, _oa0_name_lens, _oa0_len, ", ", &_buf_N)
//
//   // State array joined (not OA):
//   .{ .text = "" }  // dynText: qjs_runtime.evalToString("items.join(', ')", &_eval_buf_N)
//
// Notes:
//   .join() is NOT recognized by Smith. The token sequence identifier.join(
//   is not in any detection path. The expression falls through to QuickJS
//   eval if a script block is available, or embeds as literal text if not.
//
//   For OA-backed arrays, a native implementation would:
//   1. Detect identifier.join("sep") where identifier is an OA getter
//   2. Emit a runtime helper that iterates _oaN_field[0.._oaN_len] and
//      concatenates with the separator into a buffer
//   3. The buffer becomes a dynText source
//
//   For non-OA arrays (state slots, render locals), QuickJS eval handles
//   it correctly — the JS expression runs and produces the joined string.
//
//   For inline array construction like [a, b, c].join(" "), the expression
//   falls through to eval. A compile-time optimization could detect constant
//   arrays and fold them.
//
//   The love2d reference does not have special .join() handling either —
//   it uses table.concat() in Lua compute blocks.

function match(c, ctx) {
  // Detect: identifier.join(...)
  if (c.kind() !== TK.identifier) return false;
  var saved = c.save();
  c.advance();
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance();
  var result = c.isIdent('join') && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Parse: identifier.join("separator")
  var arrName = c.text();
  c.advance(); // identifier
  c.advance(); // .
  c.advance(); // join
  c.advance(); // (

  // Parse separator
  var separator = ', ';
  if (c.kind() === TK.string) {
    separator = c.text().slice(1, -1);
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.rbrace) c.advance();

  // Check if this is an OA-backed array with a string field
  var oa = ctx.objectArrays.find(function(o) { return o.getter === arrName; });
  if (oa) {
    // For OA with a single value field (simple array) or _v field,
    // emit a runtime join that iterates the OA string entries.
    var field = oa.isSimpleArray ? '_v' : null;
    if (!field && oa.isPrimitiveArray) field = 'value';
    if (!field) {
      // Multi-field OA — .join() doesn't make sense without a specific field.
      // Route through QuickJS eval.
      return { value: buildEval(arrName + '.join("' + separator + '")', ctx) };
    }
    // Emit runtime join: iterate _oaN_field[0.._oaN_len], concat with separator
    // This produces a {s} format arg for dynText using a helper buffer.
    // Since Zig doesn't have a built-in join, we route through QuickJS for now
    // but with the OA data synced to JS context.
    return { value: buildEval(arrName + '.join("' + separator + '")', ctx) };
  }

  // Check if it's a state getter (array stored as JSON in string slot)
  if (isGetter(arrName)) {
    return { value: buildEval(arrName + '.join("' + separator + '")', ctx) };
  }

  // Check render locals
  if (ctx.renderLocals && ctx.renderLocals[arrName] !== undefined) {
    var rlRaw = ctx._renderLocalRaw && ctx._renderLocalRaw[arrName];
    var expr = rlRaw ? rlRaw + '.join("' + separator + '")' : arrName + '.join("' + separator + '")';
    return { value: buildEval(expr, ctx) };
  }

  // Fallback: route through QuickJS eval
  return { value: buildEval(arrName + '.join("' + separator + '")', ctx) };
}
