// ── Pattern 087: Higher-Order Component (HOC) ──────────────────
// Index: 87
// Group: composition
// Status: stub
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
//   // HOCs don't have a direct mixed equivalent — they're a
//   // composition pattern that the compiler would need to
//   // inline/expand. The equivalent in mixed mode is:
//   <if not isLoggedIn>
//     <Login />
//   </if>
//   <else>
//     <Dashboard />
//   </else>
//
// Zig output target:
//   // HOC inlining would produce the same output as writing the
//   // conditional + wrapped component inline.
//
// Notes:
//   HOCs are a React composition pattern that wraps a component in
//   another component to add behavior (auth, theming, data fetching).
//   The pattern is: `const Enhanced = withX(BaseComponent)`.
//
//   The compiler does NOT support HOCs because:
//   1. HOCs are factory functions that return new components — this
//      requires evaluating JS at compile time
//   2. The `withAuth(Dashboard)` call happens outside JSX, in the
//      module scope
//   3. Spread props (...props) forwarding is complex
//
//   HOCs should be refactored to either:
//   - Direct composition with <if>/<else> (for conditional HOCs)
//   - Slot patterns (for layout HOCs)
//   - Component props (for injection HOCs)

function match(c, ctx) {
  // HOCs aren't detectable at the JSX level — they're module-scope
  // function calls that create new component references.
  return false;
}

function compile(c, ctx) {
  // Not implemented — HOCs require runtime function evaluation.
  return null;
}
