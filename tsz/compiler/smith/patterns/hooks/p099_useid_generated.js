// ── Pattern 099: useId generated ─────────────────────────────────
// Index: 99
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const id = useId();
//
//   function App() {
//     return (
//       <Box>
//         <Text>{id}</Text>
//         <TextInput id={id} />
//         <Text aria-describedby={id}>Help text</Text>
//       </Box>
//     );
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useId() → comptime-generated unique string render local.
//   //
//   // const id = useId()
//   //   → render local: id = "__uid_0"
//   //
//   // {id} in JSX text:
//   //   .{ .text = "__uid_0" }
//   //
//   // id={id} as prop:
//   //   Stripped or passed as string prop depending on element type.
//   //
//   // aria-describedby={id}:
//   //   Compiled as accessibility attribute with the unique string.
//
// Notes:
//   useId generates a stable unique string in React, primarily for
//   HTML id/htmlFor pairing and ARIA attributes. In our model:
//
//   - No HTML means no id/htmlFor pairing needed
//   - Node identity is positional (array index), not string-based
//   - But the unique string may be used in text display or as a
//     prop value, so we still need to generate one
//
//   Compilation: generate a comptime unique string "__uid_N" where N
//   is a monotonically increasing counter per compilation unit. This
//   is deterministic and stable across rebuilds (same source → same
//   IDs). The string is registered as a render local.

function match(c, ctx) {
  // const X = useId()
  var saved = c.save();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') { c.restore(saved); return false; }
  c.advance();
  if (c.kind() !== 6) { c.restore(saved); return false; }
  c.advance(); // variable name
  if (c.kind() !== 16 /* TK.equals */) { c.restore(saved); return false; }
  c.advance();
  var isUseId = c.kind() === 6 && c.text() === 'useId';
  c.restore(saved);
  return isUseId;
}

function compile(c, ctx) {
  // 1. Parse: const varName = useId()
  c.advance(); // const/let
  var varName = c.text();
  c.advance(); // variable name
  c.advance(); // =
  c.advance(); // useId
  c.advance(); // (
  if (c.kind() === 9 /* TK.rparen */) c.advance(); // )

  // 2. Generate a unique ID string for this compilation unit.
  if (!ctx._useIdCounter) ctx._useIdCounter = 0;
  var uid = '__uid_' + ctx._useIdCounter;
  ctx._useIdCounter++;

  // 3. Register as a render local with the generated string.
  //    Any reference to {varName} in JSX resolves to this string.
  ctx.renderLocals[varName] = '"' + uid + '"';

  // 4. In text nodes: {id} → .{ .text = "__uid_0" }
  //    Static text, no dynamic buffer needed.

  // 5. As prop value: id={id} → attribute with string value "__uid_0"
  //    Most id/htmlFor/aria props compile to string props on the node.

  // 6. In template literals: {`label-${id}`} → bufPrint with the
  //    render local, which resolves to the static string.

  return null; // Declaration, not JSX — no node emitted.
}
