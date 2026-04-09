(function() {
// ── Pattern 114: CSS-in-JS object ───────────────────────────────
// Index: 114
// Group: style
// Status: complete
//
// Soup syntax (copy-paste React):
//   const headerStyle = css({
//     color: theme.primary,
//     padding: 16,
//     '&:hover': { color: theme.secondary }
//   });
//   // or emotion's css prop:
//   <Box css={{ color: 'red', padding: 8 }} />
//
// Mixed syntax (hybrid):
//   // Not applicable — css() function calls are a web CSS-in-JS pattern.
//   // Mixed: use style={{ ... }} directly.
//
// Zig output target:
//   // N/A — css() calls produce CSS class names via runtime injection.
//   // The object form looks similar to inline styles but supports CSS
//   // features (pseudo-selectors, media queries) that have no native
//   // equivalent.
//   // The subset that IS supported is the inline style pattern (p105):
//   //   style={{ color: 'red', padding: 8 }}
//   //   → .{ .style = .{ .color = .{ .r=255, .g=0, .b=0, .a=255 }, .padding = 8 } }
//
// Notes:
//   CSS-in-JS object notation (emotion css(), stitches, vanilla-extract)
//   uses JavaScript objects that look like inline styles but produce CSS
//   classes. The key difference from inline styles:
//     - Pseudo-selectors ('&:hover')
//     - Media queries
//     - Keyframe animations
//     - Global styles
//   None of these exist in the native framework.
//   The css() function itself would be treated as a normal function call,
//   not recognized as a style declaration.
//   If the user has `css={{ color: 'red' }}` as a prop, it would be
//   treated as an unknown prop and dropped.
//   Users should use the `style` prop with inline objects instead.

function match(c, ctx) {
  // css({...})
  if (c.kind() !== TK.identifier || c.text() !== 'css') return false;
  if (c.pos + 2 >= c.count) return false;
  return c.kindAt(c.pos + 1) === TK.lparen && c.kindAt(c.pos + 2) === TK.lbrace;
}

function compile(c, children, ctx) {
  void children;
  void ctx;
  c.advance(); // css
  if (c.kind() === TK.lparen) c.advance();
  var payload = parseStyleBlock(c);
  if (c.kind() === TK.rparen) c.advance();
  return {
    kind: 'css_in_js_object',
    fields: payload,
    warning: '[W] css({...}) has no native class target; use style={{...}}',
  };
}

_patterns[114] = { id: 114, match: match, compile: compile };

})();
