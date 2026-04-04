// ── Pattern 085: IIFE in JSX ────────────────────────────────────
// Index: 85
// Group: conditional_rendering
// Status: stub
//
// Soup syntax (copy-paste React):
//   <Box>
//     {(() => {
//       if (x > 10) return <BigWidget />;
//       if (x > 5) return <MediumWidget />;
//       return <SmallWidget />;
//     })()}
//   </Box>
//
// Mixed syntax (hybrid):
//   <Box>
//     <if x above 10>
//       <BigWidget />
//     </if>
//     <else if x above 5>
//       <MediumWidget />
//     </else>
//     <else>
//       <SmallWidget />
//     </else>
//   </Box>
//
// Zig output target:
//   // Same as chained conditionals — the IIFE is just a wrapper
//   // around if/else logic that the compiler should decompose.
//
// Notes:
//   IIFEs (Immediately Invoked Function Expressions) in JSX are a
//   soup-mode escape hatch for complex conditional logic that can't
//   be expressed with ternaries. The pattern is:
//     {(() => { /* imperative logic */ })()}
//
//   The compiler does NOT parse IIFEs. They must be refactored to
//   <if>/<else if>/<else> blocks for compilation.
//
//   This is an anti-pattern in our compiler because:
//   1. Arrow functions inside JSX create runtime closures (no static compile)
//   2. The imperative control flow (if/else/switch) inside the IIFE
//      is exactly what <if>/<else> blocks are designed to replace
//   3. IIFEs are unreadable and a code smell even in standard React

function match(c, ctx) {
  // IIFEs start with { ( () => { ... } ) () }
  // Not matchable without deep lookahead into the brace content.
  return false;
}

function compile(c, ctx) {
  // Not implemented — IIFE must be refactored to <if>/<else> blocks.
  return null;
}
