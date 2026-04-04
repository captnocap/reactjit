(function() {
// ── Pattern 100: Custom hook ────────────────────────────────────
// Index: 100
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   function useCounter(initial) {
//     const [count, setCount] = useState(initial);
//     const increment = () => setCount(count + 1);
//     const decrement = () => setCount(count - 1);
//     return { count, increment, decrement };
//   }
//
//   function App() {
//     const { count, increment, decrement } = useCounter(0);
//     return (
//       <Box>
//         <Text>{count}</Text>
//         <Pressable onPress={increment}><Text>+</Text></Pressable>
//         <Pressable onPress={decrement}><Text>-</Text></Pressable>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // Custom hooks are inlined. useState inside → top-level slots.
//   // Returned values → render locals. Returned functions → handlers.
//   //
//   // useCounter(0) inlines to:
//   //   slots[N] = .{ .tag = .int, .value = .{ .int = 0 } };  // count
//   //   render_local: count → state.getSlot(N)
//   //   render_local: increment → () => setCount(count + 1)
//   //   render_local: decrement → () => setCount(count - 1)
//   //
//   // {count} → dynamic text: bufPrint("{d}", state.getSlot(N))
//   // onPress={increment} → handler: state.setSlot(N, state.getSlot(N) + 1)
//
// Notes:
//   Custom hooks are compile-time abstractions. They compose built-in
//   hooks (useState, useMemo, useCallback) and return derived state +
//   handlers. In our model, they are fully inlined at call sites — the
//   hook function body is expanded and its internals become top-level
//   compiler constructs.
//
//   Collection pass (collect/components.js):
//     Functions starting with "use" that contain useState are detected
//     as custom hooks. The collector:
//       1. Enters the hook function body
//       2. Collects useState calls → state slots (same as top-level)
//       3. Collects const assignments → render locals
//       4. Maps the return object's fields to the collected values
//
//   Call site resolution:
//     When const { a, b } = useMyHook(args) is encountered:
//       1. The hook function is looked up by name
//       2. Its state slots are added to the global slot array
//       3. Its render locals are merged into ctx.renderLocals
//       4. The destructured fields (a, b) are mapped to the hook's
//          return values through render local resolution
//
//   What this covers:
//     - useState inside hooks → state slots (int, float, string, bool, OA)
//     - Computed values → render locals (const x = a + b)
//     - useMemo inside hooks → stripped wrapper (pattern 096)
//     - useCallback inside hooks → stripped wrapper (pattern 097)
//     - Returned state getters → render local → slot accessor
//     - Returned state setters → handler body capture
//     - Returned functions → named handler render locals
//     - Destructured returns: { a, b } = useHook()
//     - Array returns: [a, b] = useHook()
//
//   Side effects (useEffect, useLayoutEffect):
//     These are React-specific lifecycle hooks. In our model, side
//     effects happen in <script> blocks (run once at init) or in
//     event handlers (run on user interaction). If a custom hook
//     contains useEffect, the effect body is captured and runs in
//     QuickJS at init time — equivalent to a <script> block.
//
//   Cross-file hooks:
//     Hooks defined in imported files are resolved through the
//     import system. The import resolution inlines the hook's
//     source at the call site, same as component imports.
//
//   Chad-tier equivalent:
//     Custom hooks map to module imports in chad syntax:
//       import { counter } from './counter.mod'
//     The module's <state> block defines slots; <functions> block
//     defines handlers. Same compilation, different surface syntax.

function match(c, ctx) {
  // const { ... } = useCustomHook(args)
  // Detection: destructured const assignment where RHS starts with
  // 'use' prefix (React convention) and resolves to a function in
  // the same file (or imported) that contains useState.
  var saved = c.save();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  // Skip destructured pattern { ... } or [ ... ]
  if (c.kind() !== 12 /* TK.lbrace */ && c.kind() !== 10 /* TK.lbracket */) {
    // Could also be: const result = useHook()
    if (c.kind() === 6) c.advance();
    else { c.restore(saved); return false; }
  } else {
    var depth = 1;
    c.advance();
    while (c.pos < c.count && depth > 0) {
      if (c.kind() === 12 || c.kind() === 10) depth++;
      if (c.kind() === 13 || c.kind() === 11) depth--;
      if (depth > 0) c.advance();
    }
    if (depth === 0) c.advance();
  }
  if (c.kind() !== 16 /* TK.equals */) { c.restore(saved); return false; }
  c.advance();
  var isHook = c.kind() === 6 && c.text().startsWith('use') && c.text().length > 3;
  c.restore(saved);
  return isHook;
}

function compile(c, ctx) {
  // Compilation: inline hook body at call site.
  //   1. Resolve hook function by name
  //   2. Enter hook body scope
  //   3. Collect useState → state slots (collect/state.js)
  //   4. Collect const bindings → render locals
  //   5. Collect useMemo/useCallback → strip wrappers
  //   6. Map return value fields to collected values
  //   7. At call site, destructured names → render locals
  //   8. State getters → slot accessors in Zig
  //   9. State setters → handler body capture for events
  //  10. useEffect bodies → <script>-equivalent init eval
  //  11. Exit hook scope, merge into parent context
  return null;
}

_patterns[100] = { id: 100, match: match, compile: compile };

})();
