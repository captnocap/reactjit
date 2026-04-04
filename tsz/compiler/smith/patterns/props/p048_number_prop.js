// ── Pattern 048: Number prop ───────────────────────────────────
// Index: 48
// Group: props
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Counter count={5} />
//   <Spacer size={24} />
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // During component call collection:
//   propValues["count"] = "5"
//   // Numeric consumers regex-match this as a numeric literal and reuse it as
//   // a Zig numeric expression where appropriate.
//
// Notes:
//   Implemented through parse/element/component_props.js ->
//   tryParseComponentBraceProp() -> parseComponentBraceValue().
//
//   For the simple `{5}` case the brace-value parser collects the numeric token
//   and stores the literal text in propValues[attr]. Downstream consumers treat
//   numeric-looking strings as numbers:
//     - conditionals use _condPropValue() numeric passthrough
//     - numeric attrs regex-match prop strings back into numeric expressions
//     - plain text interpolation still renders "5"

function match(c, ctx) {
  // Value side only: attr = { number }
  if (c.kind() !== TK.lbrace) return false;
  var saved = c.save();
  c.advance();
  var result = c.kind() === TK.number &&
    c.pos + 1 < c.count &&
    c.kindAt(c.pos + 1) === TK.rbrace;
  c.restore(saved);
  return result;
}

function compile(c, ctx) {
  // Delegates to tryParseComponentBraceProp() / parseComponentBraceValue().
  return null;
}
