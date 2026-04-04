// ── Pattern 089: Context provider ───────────────────────────────
// Index: 89
// Group: composition
// Status: partial
//
// Soup syntax (copy-paste React):
//   const ThemeCtx = React.createContext('light');
//   function App() {
//     return (
//       <ThemeCtx.Provider value={theme}>
//         <Toolbar />
//       </ThemeCtx.Provider>
//     );
//   }
//
// Mixed syntax (hybrid):
//   // Context providers don't have a mixed equivalent.
//   // State is shared through the flat state model (useState slots).
//   // No provider/consumer hierarchy needed — all state is global.
//   <Toolbar />
//
// Zig output target:
//   // Provider tags are stripped — they compile to their children only.
//   // <ThemeCtx.Provider value={theme}><Toolbar /></ThemeCtx.Provider>
//   // becomes just the Toolbar nodes.
//
// Notes:
//   React Context provides a way to pass data through the component
//   tree without prop drilling. Our compiler handles this differently:
//
//   1. State is global — useState slots are accessible from any component
//      because components are inlined, not instantiated
//   2. Provider tags (X.Provider) are treated as transparent wrappers —
//      the compiler parses the tag through normalizeRawTag which handles
//      dot notation (ThemeCtx.Provider → just renders children)
//   3. The `value` prop on a Provider is ignored since there's no
//      context propagation mechanism
//
//   For soup compatibility, Provider tags should be silently passed
//   through. The children render normally with access to all state.

function match(c, ctx) {
  // Match X.Provider tag pattern
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 3 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  if (c.kindAt(c.pos + 2) !== TK.dot) return false;
  if (c.kindAt(c.pos + 3) !== TK.identifier) return false;
  return c.textAt(c.pos + 3) === 'Provider';
}

function compile(c, ctx) {
  // Delegate to parseJSXElement which handles dot-notation tags.
  // The tag normalization will handle X.Provider as a transparent wrapper.
  return parseJSXElement(c);
}
