// ── Chad Pattern c009: <for> iteration ──────────────────────────
// Group: control_flow
// Status: stub
//
// Chad syntax:
//   // Collection (implicit item):
//   <for items>
//     <C.ListItem>{item.name}</C.ListItem>
//   </for>
//
//   // Collection with as binding:
//   <for channels as ch>
//     <for ch.effects as fx>
//       <C.Body>{ch.label + ': ' + fx.name}</C.Body>
//     </for>
//   </for>
//
//   // Range iteration:
//   <for 0..count as i>
//     set_total is total + scores[i]
//   </for>
//
// Soup equivalent:
//   {items.map(item => <ListItem>{item.name}</ListItem>)}
//   {channels.map(ch => ch.effects.map(fx => ...))}
//
// Zig output target:
//   for (0.._oaN_len) |_i| { ... }
//   OA field access: _oa0_name[_i][0.._oa0_name_lens[_i]]
//
// Current owner: lanes/chad.js (JSX parsing), parse/element/for_block handling
//
// Notes:
//   `item` is implicit — always available inside <for>.
//   `as name` optional — for readability or nested loop disambiguation.
//   No .map(), no lambdas. <for> is the only iteration.
//   Range: 0..count is exclusive end (0 to count-1).
//   `as` binding required for ranges.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
