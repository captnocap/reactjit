(function() {
// ── Pattern 090: Context consumer (useContext) ──────────────────
// Index: 90
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   function Toolbar() {
//     const theme = useContext(ThemeCtx);
//     return (
//       <Box style={{ backgroundColor: theme.bg }}>
//         <Text style={{ color: theme.fg }}>Hello</Text>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   // useContext resolves to a render local or state slot.
//   // theme.bg → prop from the theme state slot, or a render local
//   // computed from the parent's state.
//   function Toolbar() {
//     return (
//       <Box backgroundColor={themeBg}>
//         <Text color={themeFg}>Hello</Text>
//       </Box>
//     );
//   }
//
// Zig output target:
//   .{
//     .style = .{ .background_color = Color.parse("#...") },
//     .sub_nodes = &[_]Node{
//       .{ .style = .{ .color = Color.parse("#...") }, .text = "Hello" },
//     },
//   }
//
// Notes:
//   useContext reads a value from the nearest Context Provider in the
//   React component tree. The consumer re-renders when the context
//   value changes.
//
//   In our compiler, useContext is handled through render local collection
//   during component inlining (component_inline.js):
//
//   1. collectComponents scans component bodies for variable declarations
//   2. `const theme = useContext(ThemeCtx)` is seen as a render local
//   3. The useContext call is evaluated — since state is flat, the
//      "context value" is just the state slot that the Provider's
//      `value` prop points to
//   4. When `theme.bg` is used in JSX, it resolves through the render
//      local → prop chain → state slot resolution
//
//   For soup code, this means:
//   - useContext calls become render locals during component scanning
//   - If the context value maps to a state slot, field access works
//   - If it doesn't resolve, the variable produces a dropped expression
//     warning (fix: use direct state access instead of context)
//
//   The pattern compiles fully when the context value chain resolves
//   to known state slots. No runtime context propagation needed.

function match(c, ctx) {
  // Detect: useContext(
  if (c.kind() !== TK.identifier) return false;
  if (c.text() !== 'useContext') return false;
  var saved = c.save();
  c.advance(); // skip useContext
  if (c.kind() === TK.lparen) { c.restore(saved); return true; }
  c.restore(saved);
  return false;
}

function compile(c, ctx) {
  // useContext values are resolved during component inlining.
  // By the time JSX parsing runs, the context value is already a
  // render local that attribute/child resolution uses directly.
  return null;
}

_patterns[90] = { id: 90, match: match, compile: compile };

})();
