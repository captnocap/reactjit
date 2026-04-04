(function() {
// ── Pattern 094: useState value in JSX ──────────────────────────
// Index: 94
// Group: hooks
// Status: complete
//
// Soup syntax (copy-paste React):
//   const [count, setCount] = useState(0);
//   function App() {
//     return <Text>{count}</Text>;
//   }
//
// Mixed syntax (hybrid):
//   Same as soup for this pattern.
//
// Zig output target:
//   // useState(0) → state slot with getter/setter
//   // {count} in JSX → dynamic text with slot accessor
//   //
//   // State slot declaration (in state init):
//   //   slots[0] = .{ .tag = .int, .value = .{ .int = 0 } };
//   //
//   // Dynamic text in rebuild:
//   //   _ = std.fmt.bufPrint(&_dyn_buf_0, "{d}", .{state.getSlot(0)})
//   //     catch @as([]const u8, "");
//   //   node.text = _dyn_buf_0[0..len];
//
// Notes:
//   useState is THE core state primitive. Smith's collection pass
//   (collect/state.js:collectState) handles it:
//
//   1. Parses: const [getter, setter] = useState(initialValue)
//   2. Determines type from initial value:
//      - number → int (or float if has decimal)
//      - true/false → boolean
//      - "string" → string
//      - [...] → object array (OA) — see p019+ map patterns
//      - {...} → object flat (per-field slots)
//      - new X / identifier → opaque state
//   3. Pushes to ctx.stateSlots with { getter, setter, initial, type }
//
//   In JSX, {count} resolves through findSlot(getter) → slot index.
//   The brace child parser (brace.js) detects state getters and emits
//   dynamic text nodes with:
//     - fmt string: '{d}' for int, '{d:.2}' for float, '{s}' for string
//     - fmt args: state.getSlot(N) or state.getSlotString(N)
//     - bufPrint into _dyn_buf_N
//
//   The setter (setCount) is used in event handlers (onPress, etc.)
//   and compiled to state.setSlot(N, value) calls in the handler
//   system.
//
//   See: virtually every conformance test uses useState.

function match(c, ctx) {
  // Detect: const/let [getter, setter] = useState(
  if (c.kind() !== TK.identifier) return false;
  var kw = c.text();
  if (kw !== 'const' && kw !== 'let') return false;
  var saved = c.save();
  c.advance(); // skip const/let
  if (c.kind() !== TK.lbracket) { c.restore(saved); return false; }
  c.advance(); // skip [
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance(); // skip getter
  if (c.kind() !== TK.comma) { c.restore(saved); return false; }
  c.advance(); // skip ,
  if (c.kind() !== TK.identifier) { c.restore(saved); return false; }
  c.advance(); // skip setter
  if (c.kind() !== TK.rbracket) { c.restore(saved); return false; }
  c.advance(); // skip ]
  if (c.kind() !== TK.equals) { c.restore(saved); return false; }
  c.advance(); // skip =
  var isUseState = (c.kind() === TK.identifier && c.text() === 'useState');
  if (!isUseState) { c.restore(saved); return false; }
  c.advance(); // skip useState
  if (c.kind() !== TK.lparen) { c.restore(saved); return false; }
  c.restore(saved);
  return true;
}

function compile(c, ctx) {
  // Compilation:
  //   1. Collection pass creates the slot (collect/state.js)
  //   2. In JSX, findSlot(getter) returns slot index
  //   3. Brace parser emits dynamic text:
  //      - Allocates _dyn_buf_N
  //      - Creates dynText entry with fmt/args
  //      - Node gets .text = buf slice
  //   4. Rebuild pass calls bufPrint with slot accessor
  //   5. Event handlers use state.setSlot(N, value)
  return null;
}

_patterns[94] = { id: 94, match: match, compile: compile };

})();
