(function() {
// ── Pattern 089: Context provider ───────────────────────────────
// Index: 89
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   const ThemeCtx = React.createContext('light');
//   function App() {
//     const [theme, setTheme] = useState('light');
//     return (
//       <ThemeCtx.Provider value={theme}>
//         <Toolbar />
//       </ThemeCtx.Provider>
//     );
//   }
//
// Mixed syntax (hybrid):
//   // No provider needed — state is flat and globally accessible.
//   // The theme slot is available to all inlined components.
//   function App() {
//     const [theme, setTheme] = useState('light');
//     return <Toolbar />;
//   }
//
// Zig output target:
//   // Provider tags are transparent wrappers — they compile to their
//   // children only. <ThemeCtx.Provider value={theme}><Toolbar /></ThemeCtx.Provider>
//   // produces the same output as just <Toolbar />.
//   // The value prop is consumed during collection but has no Zig output.
//
// Notes:
//   React Context solves prop drilling — passing data through many
//   layers of components without explicit props at each level. A Provider
//   sets the value, and useContext consumers read it.
//
//   In our compiler, Context is unnecessary because:
//
//   1. All state is flat — useState slots are globally accessible since
//      all components are inlined into a single function scope
//   2. There's no component tree hierarchy at runtime — everything is
//      a flat node array, so there's nothing to "drill" through
//   3. The Provider's `value` prop just maps to a state slot that
//      any component can already read directly
//
//   When the compiler encounters X.Provider tags:
//   - normalizeRawTag handles dot notation (ThemeCtx.Provider)
//   - The tag resolves through the normal element path
//   - Attributes including `value` are parsed normally
//   - Children are rendered — the Provider wrapper adds no nodes
//
//   Soup code with Providers compiles correctly — the Providers are
//   transparent and their children render as expected.

function match(c, ctx) {
  // Match X.Provider tag pattern: < Identifier . Provider
  if (c.kind() !== TK.lt) return false;
  if (c.pos + 3 >= c.count) return false;
  if (c.kindAt(c.pos + 1) !== TK.identifier) return false;
  if (c.kindAt(c.pos + 2) !== TK.dot) return false;
  if (c.kindAt(c.pos + 3) !== TK.identifier) return false;
  return c.textAt(c.pos + 3) === 'Provider';
}

function compile(c, ctx) {
  // Delegate to parseJSXElement — dot-notation tag normalization
  // handles X.Provider as a transparent wrapper. Children render normally.
  return parseJSXElement(c);
}

_patterns[89] = { id: 89, match: match, compile: compile };

})();
