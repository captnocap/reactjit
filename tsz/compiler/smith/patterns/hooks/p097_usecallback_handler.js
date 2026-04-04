(function() {
// ── Pattern 097: useCallback handler ────────────────────────────
// Index: 97
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const handlePress = useCallback(() => {
//     setCount(count + 1);
//   }, [count]);
//
//   function App() {
//     return (
//       <Pressable onPress={handlePress}>
//         <Text>Press me</Text>
//       </Pressable>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useCallback is a no-op. The inner function IS the handler.
//   //
//   // const handlePress = useCallback(() => { setCount(count + 1) }, [count])
//   //   compiles identically to:
//   // const handlePress = () => { setCount(count + 1) }
//   //
//   // onPress={handlePress} resolves to the handler body:
//   //   handler_0: "setCount(count + 1)"
//   //   → state.setSlot(0, state.getSlot(0) + 1) in Zig
//   //   or QuickJS eval for complex expressions
//
// Notes:
//   useCallback exists in React to stabilize function references
//   across re-renders. When a parent passes onPress={fn} to a child,
//   React uses referential equality to decide whether the child needs
//   to re-render. useCallback ensures fn is the same object unless
//   deps change.
//
//   In our compiled model, this concept is meaningless:
//     - There is no reconciler. No referential equality checks.
//     - The tree is rebuilt from scratch on every state change.
//     - Handlers are compiled to static function pointers or eval
//       strings — their "identity" is a compile-time constant.
//     - Passing the same handler to a child component costs nothing.
//
//   Compilation:
//     useCallback(fn, [deps]) → fn
//
//     The wrapper is stripped. The dependency array is discarded.
//     The inner function becomes a render local.
//
//   Collection pass (collect/render_locals.js):
//     When collectRenderLocals encounters:
//       const X = useCallback(() => { body }, [deps])
//     It strips useCallback and registers X as a render local
//     whose value is the function expression () => { body }.
//
//   Handler resolution (attrs_handlers.js):
//     When onPress={handlePress} is encountered, the attr parser
//     looks up handlePress in render locals. If it resolves to a
//     function expression, the function body is extracted and
//     compiled as the handler. This produces the same output as
//     onPress={() => { body }}.
//
//   This is complete because:
//     - Inline handlers (onPress={() => ...}) are fully supported
//     - Named handler references resolve through render locals
//     - useCallback is transparently stripped
//     - The dependency array is irrelevant in our model

function match(c, ctx) {
  // const X = useCallback(() => { ... }, [deps])
  // Detected during render local collection.
  var saved = c.save();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== 16 /* TK.equals */) { c.restore(saved); return false; }
  c.advance();
  var isCb = c.text() === 'useCallback';
  c.restore(saved);
  return isCb;
}

function compile(c, ctx) {
  // Compilation: strip wrapper, register inner function as render local.
  //   1. Detect useCallback in const X = useCallback(...)
  //   2. Skip useCallback( token
  //   3. Extract inner function: () => { body } or (args) => { body }
  //   4. Skip , [deps]) — discard dependency array
  //   5. Register X = function expression as render local
  //   6. onPress={X} resolves through render locals → handler body
  //   7. Handler body compiled via normal handler pipeline
  //   8. Produces identical output to onPress={() => { body }}
  return null;
}

_patterns[97] = { id: 97, match: match, compile: compile };

})();
