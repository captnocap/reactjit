(function() {
// ── Pattern 138: JSX comment ───────────────────────────────────
// Index: 138
// Group: misc_jsx
// Status: complete
//
// Soup syntax (copy-paste React):
//   <Box>
//     {/* this is a comment */}
//     <Text>hello</Text>
//   </Box>
//
// Mixed syntax (hybrid):
//   // Mixed: same as soup for this pattern
//
// Zig output target:
//   // No node emitted. Comments are swallowed.
//
// Notes:
//   The lexer emits `/* ... */` as TK.comment, including the JSX form
//   `{/* ... */}`. tryParseBraceChild() has an explicit fast path:
//     1. sees `{`
//     2. advances
//     3. if next token is TK.comment, consumes it
//     4. consumes closing `}` and emits nothing
//
//   Text-position comments are also swallowed in parse/children/text.js.

function match(c, ctx) {
  return c.kind() === TK.comment;
}

function compile(c, ctx) {
  c.advance(); // comment
  if (c.kind() === TK.rbrace) c.advance();
  return null;
}

_patterns[138] = { id: 138, match: match, compile: compile };

})();
