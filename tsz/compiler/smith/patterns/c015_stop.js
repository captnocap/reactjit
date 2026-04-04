// ── Chad Pattern c015: stop / skip ──────────────────────────────
// Group: functions
// Status: stub
//
// Chad syntax:
//   // Halt function/chain:
//   <if input exact ''>
//     stop
//   </if>
//
//   // Skip iteration:
//   <for items as item>
//     <if not item.active>
//       skip
//     </if>
//     process
//   </for>
//
// Soup equivalent:
//   if (input === '') return;
//   if (!item.active) continue;
//
// Zig output target:
//   stop → return / break (context-dependent)
//   skip → continue
//
// Current owner: not yet implemented
//
// Notes:
//   `stop` halts current function. In composed chain, halts entire chain.
//   Inside <while>, breaks out of loop.
//   `skip` only valid in <for> / <while> — skips to next iteration.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
