// ── Pattern 090: Context consumer (useContext) ──────────────────
// Index: 90
// Group: composition
// Status: partial
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
//   // useContext maps to state access in our model.
//   // The theme value is a state slot, not a context value.
//   <Box backgroundColor={themeBg}>
//     <Text color={themeFg}>Hello</Text>
//   </Box>
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
//   useContext in React reads a value from the nearest Provider above
//   in the tree. In our compiler, this doesn't exist because:
//
//   1. All state is flat — useState slots are globally accessible
//   2. Components are inlined, not instantiated with their own scope
//   3. There's no component tree hierarchy at runtime
//
//   When the compiler encounters `const theme = useContext(ThemeCtx)`:
//   - The collectComponents pass sees `const theme = ...` as a
//     render local in the component body
//   - If the value resolves to something static (a prop, a slot),
//     it becomes a render local that's inlined at usage sites
//   - If it doesn't resolve, the variable is unknown and usages
//     produce dropped expression warnings
//
//   To make useContext patterns compile, refactor the context value
//   to useState slots and pass them directly or through props.

function match(c, ctx) {
  // useContext is a function call in the component body, not a JSX pattern.
  // It's handled during render local collection, not during JSX parsing.
  return false;
}

function compile(c, ctx) {
  // Not directly compilable — useContext calls become render locals
  // during component body scanning.
  return null;
}
