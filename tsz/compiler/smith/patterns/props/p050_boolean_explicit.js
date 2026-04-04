(function() {
// ── Pattern 050: Boolean explicit ──────────────────────────────
// Index: 50
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Button disabled={true} />
//   <Modal open={false} />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // Current behavior:
//   propValues["disabled"] = "true"
//   propValues["open"] = "false"
//   // These flow through propStack as strings, not typed booleans.
//
// Notes:
//   Implemented through parse/element/component_props.js ->
//   tryParseComponentBraceProp() -> parseComponentBraceValue().
//
//   The parser does accept `{true}` and `{false}`, but it stores the raw token
//   text as a string. That means:
//     - `...={true}` is usually usable because non-empty strings are truthy
//     - `...={false}` is NOT a real false boolean in many downstream paths
//       because _condPropValue() treats non-empty strings as truthy constants
//
//   This is why the pattern is partial rather than complete. The syntax parses,
//   but the value is not normalized to a typed boolean through the full pipeline.

function match(c, ctx) {
  // Value side only: attr = { true|false }
  if (c.kind() !== TK.lbrace) return false;
  var saved = c.save();
  c.advance();
  var result = c.kind() === TK.identifier &&
    (c.text() === 'true' || c.text() === 'false') &&
    c.pos + 1 < c.count &&
    c.kindAt(c.pos + 1) === TK.rbrace;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // { true } or { false } — consume brace, boolean, brace
  c.advance(); // skip {
  var val = c.text(); // "true" or "false"
  c.advance(); // skip boolean
  if (c.kind() === TK.rbrace) c.advance(); // skip }
  return { value: val };
}

_patterns[50] = { id: 50, match: match, compile: compile };

})();
