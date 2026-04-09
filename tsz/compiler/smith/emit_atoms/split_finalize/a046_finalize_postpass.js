// ── Emit Atom 046: Finalize post-pass ───────────────────────────
// Index: 46
// Group: split_finalize
// Target: zig
// Status: complete
// Current owner: emit/finalize.js
//
// Trigger: final step of emitOutput().
// Output target: debug appendix, undefined-zeroing, split handoff.
//
// Three operations run in sequence:
// 1. Debug appendix — appends ctx._debugLines and globalThis.__dbg
//    as Zig comments (// ── SMITH DEBUG ──).
// 2. Undefined-zeroing — replaces `var X: Type = undefined;` with
//    `var X: Type = std.mem.zeroes(Type);` so Zig doesn't leave
//    memory uninitialized.
// 3. Split handoff — if __splitOutput == 1, passes the monolith
//    to splitOutput() which returns the encoded multi-file string.

function _a046_applies() {
  // No-op in atom pipeline — finalizeEmitOutput() in emit/finalize.js
  // handles debug appendix, undefined-zeroing, and split handoff after
  // runEmitAtoms() returns.
  return false;
}

function _a046_emit(ctx, meta) {
  void ctx; void meta;
  return '';
}

_emitAtoms[46] = {
  id: 46,
  name: 'finalize_postpass',
  group: 'split_finalize',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/finalize.js',
  applies: _a046_applies,
  emit: _a046_emit,
};
