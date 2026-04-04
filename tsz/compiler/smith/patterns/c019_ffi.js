// ── Chad Pattern c019: <ffi> block ──────────────────────────────
// Group: data
// Status: stub
//
// Chad syntax:
//   <sqlite3 ffi>
//     open
//     close
//     errmsg
//     exec
//     prepare_v2
//   </sqlite3>
//
//   <libmpv ffi>
//     create
//     play
//     destroy
//   </libmpv>
//
// Soup equivalent:
//   // No direct equivalent — typically done via native bindings/FFI libs
//
// Zig output target:
//   @cImport / extern fn declarations.
//   open → sqlite3_open (implicit prefix join).
//
// Current owner: smith/mod.js (module block compiler)
//
// Notes:
//   Block name = C library name. Listed suffixes auto-prefix.
//   One block per library. No master <ffi> block.
//   Compiler handles prefix join and library linking per block.

function match(c, ctx) {
  return false;
}

function compile(c, ctx) {
  return null;
}
