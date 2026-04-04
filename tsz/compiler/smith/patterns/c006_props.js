// ── Chad Pattern c006: <props> block ────────────────────────────
// Group: core
// Status: stub
//
// Chad syntax:
//   <counter component>
//     <props>
//       initial is 0
//       max exact number
//       onSave
//     </props>
//
// Soup equivalent:
//   function Counter({ initial = 0, max, onSave }: Props) { ... }
//
// Zig output target:
//   Prop stack entries. Props flow through classifier resolution
//   and become node style fields or handler references.
//
// Current owner: lanes/chad.js (component prop handling)
//
// Notes:
//   - `name` — bare, required, any type
//   - `name exact type` — required, typed
//   - `name is value` — optional with default
//   - `onSave` — function reference (callback to parent)
//   Components are opaque — they don't see caller scope.
//   Data comes in via <props> only.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
