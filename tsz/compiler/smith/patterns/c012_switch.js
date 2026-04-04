// ── Chad Pattern c012: <switch> / <case> ────────────────────────
// Group: control_flow
// Status: stub
//
// Chad syntax:
//   <switch event.type>
//     <case quit>
//       stop
//     </case>
//     <case resize>
//       updateSize
//     </case>
//     <case else>
//       ignore
//     </case>
//   </switch>
//
// Soup equivalent:
//   switch (event.type) {
//     case 'quit': return stop();
//     case 'resize': return updateSize();
//     default: return ignore();
//   }
//
// Zig output target:
//   switch statement or if/else chain depending on type.
//
// Current owner: not yet implemented
//
// Notes:
//   Each case self-closes with </case>.
//   <case else> is the default — must be last.
//   No fallthrough. Unmatched values do nothing.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
