(function() {
// ── Pattern 096: useMemo computed value ─────────────────────────
// Index: 96
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const sorted = useMemo(() => {
//     return items.sort((a, b) => a.score - b.score);
//   }, [items]);
//
//   function App() {
//     return (
//       <Box>
//         {sorted.map(item => <Text>{item.name}</Text>)}
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useMemo(() => EXPR, [deps]) compiles to: const sorted = EXPR
//   // The wrapper is stripped. The inner expression becomes a render local.
//   //
//   // Scalar: const total = useMemo(() => a + b, [a, b])
//   //   → render local: total = slotGet(a) + slotGet(b)
//   //   → referenced in JSX as a normal render local
//   //
//   // Array: const sorted = useMemo(() => items.sort(...), [items])
//   //   → render local pointing to the OA (items is already an OA)
//   //   → sorted.map() triggers normal map parsing on the same OA
//   //   → or: computed OA with _computedExpr for JS-eval sort
//
// Notes:
//   useMemo memoizes a computed value in React, recomputing only when
//   dependencies change. In our compiled model, the entire tree rebuilds
//   on every state change — there is no selective recomputation. This
//   makes useMemo a pure no-op wrapper around its inner expression.
//
//   The compilation is straightforward:
//     useMemo(() => EXPR, [deps]) → EXPR
//     useMemo(() => { return EXPR; }, [deps]) → EXPR
//
//   The dependency array [deps] is discarded entirely. It exists for
//   React's reconciler to decide when to recompute. We always recompute.
//
//   Collection pass (collect/render_locals.js):
//     When collectRenderLocals encounters:
//       const X = useMemo(() => EXPR, [deps])
//     It strips the useMemo wrapper and registers X as a render local
//     with the value EXPR. This is the same path as:
//       const X = EXPR
//     The useMemo is transparent to the rest of the compiler.
//
//   For scalar results (numbers, strings, booleans):
//     The expression resolves through the normal slot/render-local
//     system. {total} in JSX becomes a dynamic text node.
//
//   For array results (.sort(), .filter(), derived arrays):
//     The expression feeds into the OA system. If it's a chained
//     pipeline (items.sort().filter()), _tryParseComputedChainMap
//     in brace.js handles it. The computed OA's _computedExpr is
//     the sort/filter JS expression, evaluated in QuickJS at runtime.
//
//   For object results ({ x: a, y: b }):
//     The expression produces an object render local. Field access
//     (sorted.x) resolves through resolve/field_access.js.
//
//   This covers every useMemo return type. The wrapper is always
//   stripped; the inner expression always compiles through existing
//   paths.

function match(c, ctx) {
  // const X = useMemo(() => expr, [deps])
  // Detected during render local collection when the RHS starts
  // with useMemo( and contains an arrow/function body.
  var saved = c.save();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  c.advance(); // skip variable name
  if (c.kind() !== 16 /* TK.equals */) { c.restore(saved); return false; }
  c.advance();
  var isMemo = c.text() === 'useMemo';
  c.restore(saved);
  return isMemo;
}

function compile(c, ctx) {
  // Compilation: strip wrapper, register inner expression as render local.
  //   1. Detect useMemo in const X = useMemo(...)
  //   2. Skip useMemo token and opening (
  //   3. Parse inner: () => EXPR  or  () => { return EXPR; }
  //   4. Skip , [deps]) — discard dependency array
  //   5. Register X = EXPR as a render local in ctx.renderLocals
  //   6. All subsequent references to X resolve through render locals
  //   7. If EXPR produces an array, it becomes a computed OA
  //   8. If EXPR produces a scalar, it's a direct expression
  return null;
}

_patterns[96] = { id: 96, match: match, compile: compile };

})();
