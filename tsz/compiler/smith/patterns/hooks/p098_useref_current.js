(function() {
// ── Pattern 098: useRef current ─────────────────────────────────
// Index: 98
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const inputRef = useRef(null);
//   const counterRef = useRef(0);
//
//   function App() {
//     return (
//       <Box>
//         <TextInput ref={inputRef} />
//         <Pressable onPress={() => inputRef.current.focus()}>
//           <Text>Focus</Text>
//         </Pressable>
//         <Text>{counterRef.current}</Text>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useRef(initialValue) → opaque state in QuickJS.
//   // The ref object { current: value } lives in JS runtime.
//   //
//   // For ref={inputRef} on elements:
//   //   The ref prop is stripped from the node. The framework's
//   //   input system manages focus via node indices directly.
//   //
//   // For counterRef.current in JSX text:
//   //   Compiled as a QuickJS eval: qjs_eval("counterRef.current")
//   //   → dynamic text with bridge call
//   //
//   // For counterRef.current in handlers:
//   //   The handler body runs in QuickJS where the ref object exists.
//   //   counterRef.current = 5 → direct JS assignment.
//
// Notes:
//   useRef serves two purposes in React:
//     1. DOM element reference (ref={inputRef}) for imperative access
//     2. Mutable value that persists without triggering re-render
//
//   In our compiled model, both map to existing mechanisms:
//
//   DOM references:
//     Nodes are Zig structs in static arrays, accessed by index.
//     The framework manages focus, scroll, and measure via node
//     indices. The ref prop on elements is stripped — it's a no-op
//     because there's no DOM node to capture.
//
//   Mutable values:
//     The ref object { current: value } is held in QuickJS as opaque
//     state. Reads go through the bridge (qjs eval). Writes in
//     handlers execute directly in QuickJS. This is identical to
//     how any non-slot JS value is handled.

function match(c, ctx) {
  // const X = useRef(initialValue)
  // Note: useRef uses const X = pattern, NOT [getter, setter] =
  var saved = c.save();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  var varName = c.text();
  c.advance();
  if (c.kind() !== 16 /* TK.equals */) { c.restore(saved); return false; }
  c.advance();
  var isRef = c.kind() === 6 && c.text() === 'useRef';
  c.restore(saved);
  return isRef;
}

function compile(c, ctx) {
  // 1. Parse: const refName = useRef(initialValue)
  c.advance(); // const/let
  var refName = c.text();
  c.advance(); // variable name
  c.advance(); // =
  c.advance(); // useRef
  c.advance(); // (

  // 2. Capture initial value
  var initialParts = [];
  var depth = 1;
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === 8 /* TK.lparen */) depth++;
    if (c.kind() === 9 /* TK.rparen */) {
      depth--;
      if (depth === 0) break;
    }
    initialParts.push(c.text());
    c.advance();
  }
  if (c.kind() === 9) c.advance(); // )
  var initialValue = initialParts.join('');

  // 3. Register as opaque state in QuickJS.
  //    The ref object { current: initialValue } lives in JS runtime.
  //    registerOpaqueStateMarker handles this.
  registerOpaqueStateMarker(refName, null);

  // 4. Register render local for refName.current access patterns.
  //    When JSX references {refName.current}, resolve/field_access.js
  //    maps it through the opaque state bridge.
  if (!ctx._refInitials) ctx._refInitials = {};
  ctx._refInitials[refName] = initialValue;

  // 5. The ref prop (ref={refName}) is stripped during attribute
  //    parsing — attrs_basic.js already skips attrName === 'ref'.

  // 6. In handlers, refName.current = value works because the
  //    handler body executes in QuickJS where the ref object exists.

  return null; // No node emitted — this is a declaration, not JSX.
}

_patterns[98] = { id: 98, match: match, compile: compile };

})();
