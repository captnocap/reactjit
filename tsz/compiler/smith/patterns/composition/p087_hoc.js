(function() {
// ── Pattern 087: Higher-Order Component (HOC) ──────────────────
// Index: 87
// Group: composition
// Status: complete
//
// Soup syntax (copy-paste React):
//   function withAuth(WrappedComponent) {
//     return function AuthWrapper(props) {
//       const isLoggedIn = useAuth();
//       if (!isLoggedIn) return <Login />;
//       return <WrappedComponent {...props} />;
//     };
//   }
//   const ProtectedDashboard = withAuth(Dashboard);
//   // Usage: <ProtectedDashboard />
//
// Mixed syntax (hybrid):
//   // HOCs dissolve into direct composition. The auth check becomes
//   // a wrapper component with <if>/<else>:
//   function AuthGuard({ children }) {
//     return (
//       <if not isLoggedIn>
//         <Login />
//       </if>
//       <else>
//         {children}
//       </else>
//     );
//   }
//   // Usage: <AuthGuard><Dashboard /></AuthGuard>
//
// Zig output target:
//   // The wrapper component is inlined at call site (p086).
//   // The conditional is compiled as show_hide (p081/p082).
//   // No HOC abstraction exists at compile time.
//
// Notes:
//   HOCs are a React composition pattern where a function takes a
//   component and returns a new enhanced component. Common uses:
//   withAuth, withTheme, withRouter, connect (Redux).
//
//   This pattern is NOT APPLICABLE in our compiler because:
//
//   1. Components are statically inlined, not dynamically instantiated.
//      There's no "component identity" that a HOC could wrap — the
//      compiler flattens everything at compile time.
//
//   2. The HOC pattern exists to solve React's lack of cross-cutting
//      concerns. Our flat state model + <if>/<else> blocks + wrapper
//      components (p086) provide the same capabilities directly:
//      - Auth guards → wrapper component with <if> block
//      - Theme injection → flat state slots (no context needed)
//      - Data fetching → script block + state slots
//
//   3. HOCs require runtime function composition (withX(Component))
//      which our ahead-of-time compiler cannot evaluate.
//
//   Every HOC has a direct equivalent as a wrapper component (p086)
//   with conditional logic (p081). The refactoring is mechanical.

function match(c, ctx) {
  // Detect: identifier(Component) where identifier starts lowercase, Component starts uppercase
  // e.g. withAuth(Dashboard), connect(App)
  if (c.kind() !== TK.identifier) return false;
  var name = c.text();
  if (name.length === 0 || name.charCodeAt(0) < 97 || name.charCodeAt(0) > 122) return false; // must start lowercase
  var saved = c.save();
  c.advance(); // skip identifier
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.advance(); // skip (
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  var arg = c.text();
  c.restore(saved);
  // Argument must start with uppercase (PascalCase component)
  if (arg.length === 0 || arg.charCodeAt(0) < 65 || arg.charCodeAt(0) > 90) return false;
  return true;
}

function compile(c, ctx) {
  // Not applicable — refactored to wrapper + conditional at source level.
  return null;
}

_patterns[87] = { id: 87, match: match, compile: compile };

})();
