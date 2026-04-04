// ── Chad Pattern c011: <while> condition loop ───────────────────
// Group: control_flow
// Status: stub
//
// Chad syntax:
//   <while sdl.pollEvent as event>
//     handleEvent
//   </while>
//
// Soup equivalent:
//   while (const event = sdl.pollEvent()) { handleEvent(event); }
//
// Zig output target:
//   while loop with optional binding.
//
// Current owner: not yet implemented
//
// Notes:
//   Explicit iteration, not lifecycle/reactive (use <during> for that).
//   `stop` breaks out. `skip` continues to next iteration.
//   `as` binding attaches the condition result to a name.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
