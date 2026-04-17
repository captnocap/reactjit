(function() {
// ── Pattern 001: String literal render ──────────────────────────
// Index: 1
// Group: primitives
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Text>hello</Text>
//
// Mixed syntax (hybrid):
//   <Text>hello</Text>
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   .{ .text = "hello" }
//
// Notes:
//   String literal text is the simplest case — raw text tokens between
//   an opening and closing tag become a .text field on the node struct.
//   The existing compiler handles this in parse/children/text.js via
//   tryParseTextChild(). Text is trimmed and quotes are escaped.
//   Glyph shortcodes (:name:) are resolved unless `l` (literal) prop is set.

function match(c, ctx) {
  // A string literal child is any token that is NOT < (element), { (brace),
  // or } (close brace) — i.e., raw text between tags. We peek without advancing.
  // HARD GUARD: this pattern is only valid for raw text BETWEEN JSX tags.
  // If tryPatternMatch is called from tryParseBraceChild (cursor already past
  // the opening `{`), refuse to match — otherwise we byte-slice the brace
  // expression source as if it were plain text (see d159_classifier_text_fn_call).
  if (ctx && ctx._inBraceChildDispatch) return false;
  var k = c.kind();
  return k !== TK.lt && k !== TK.lt_slash && k !== TK.lbrace &&
         k !== TK.rbrace && k !== TK.eof && k !== TK.comment;
}

function compile(c, children, ctx) {
  // Collect contiguous text tokens into a single string, trim, and emit
  // as a static .text node field.
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
  var escaped = text.replace(/"/g, '\\"');
  return { nodeExpr: '.{ .text = "' + escaped + '" }' };
}

_patterns[1] = { id: 1, match: match, compile: compile };

})();
