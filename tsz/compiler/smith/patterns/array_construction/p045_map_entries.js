(function() {
// ── Pattern 045: Map.entries() via Array.from().map() ──────────
// Index: 45
// Group: array_construction
// Status: complete
//
// Soup syntax (copy-paste React):
//   {Array.from(map.entries()).map(([k, v]) => (
//     <Row label={k} value={v} />
//   ))}
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Indirect render-local form:
//   // const entries = Array.from(map.entries())
//   // {entries.map(([k, v]) => <Row label={k} value={v} />)}
//   for (0.._oa0_len) |_i| {
//     // data order and materialization come from QuickJS runtime
//   }
//
// Notes:
//   The direct inline `Array.from(map.entries()).map(...)` form is not matched
//   by the live brace parser because map dispatch begins from an identifier head
//   already at `.map(...)` position. `Array.from(...)` does not fit that shape.
//
//   The partial path is render-local indirection. `_tryParseIdentifierMapExpression()`
//   sees the render-local identifier, notices the raw JS contains `Array.from`,
//   and still allows `_tryParseComputedChainMap()` to synthesize a computed OA.
//   QuickJS evaluates the Array.from(...) call before Zig-side OA unpacking.
//
//   Destructured `[k, v]` params work the same way as p044 when those aliases
//   are actually referenced in the JSX body.

function match(c, ctx) {
  // Detect: Array.from(...).map(...)
  if (!c.isIdent('Array')) return false;
  var saved = c.save();

  c.advance(); // Array
  if (c.kind() !== TK.dot) { c.restore(saved); return false; }
  c.advance(); // .
  if (!c.isIdent('from')) { c.restore(saved); return false; }
  c.advance(); // from
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }

  c.advance();
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lparen) depth++;
    if (c.kind() === TK.rparen) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();

  var result = c.kind() === TK.dot &&
    c.pos + 2 < c.count &&
    c.textAt(c.pos + 1) === 'map' &&
    c.kindAt(c.pos + 2) === TK.lparen;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Array.from(map.entries()).map() is NOT supported inline by Smith.
  //
  // Why no inline support:
  //   - The head expression is Array.from(...) — same limitation as p040.
  //     The chain detector sees 'Array' as the identifier and 'from' after
  //     the dot, which does not match the map dispatch pattern.
  //
  // Workaround (fully functional):
  //   Assign to a render local first:
  //     const entries = Array.from(map.entries());
  //     {entries.map(([k, v]) => <Row label={k} value={v} />)}
  //   _tryParseIdentifierMapExpression sees the render-local identifier,
  //   notices the raw JS contains 'Array.from', and _tryParseComputedChainMap
  //   synthesizes a computed OA. QuickJS evaluates Array.from(map.entries())
  //   at runtime. Destructured [k, v] params work the same as p044.
  return null;
}

_patterns[45] = { id: 45, match: match, compile: compile };

})();
