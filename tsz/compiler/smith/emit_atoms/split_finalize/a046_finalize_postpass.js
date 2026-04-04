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
  // Always runs — it's the final step
  return true;
}

function _a046_emit(out, ctx, file) {
  // ── 1. Debug appendix ──
  if (ctx._debugLines && ctx._debugLines.length > 0) {
    out += '\n// ── SMITH DEBUG ──\n';
    for (var i = 0; i < ctx._debugLines.length; i++) {
      out += '// ' + ctx._debugLines[i] + '\n';
    }
  }
  if (globalThis.__dbg && globalThis.__dbg.length > 0) {
    out += '\n// ── Smith debug log ──\n';
    for (var j = 0; j < globalThis.__dbg.length; j++) {
      out += '// DBG: ' + globalThis.__dbg[j] + '\n';
    }
    globalThis.__dbg = [];
  }

  // ── 2. Undefined-zeroing ──
  out = out.replace(/^(var \w+: )([^\n=]+) = undefined;$/gm, function(_, prefix, type) {
    return prefix + type + ' = std.mem.zeroes(' + type.trim() + ');';
  });

  // ── 3. Split handoff ──
  // If split output is enabled, the monolith is passed to splitOutput()
  // (atoms 043-045) which returns the encoded multi-file string.
  // This decision lives in the live finalizeEmitOutput() in emit/finalize.js.

  return out;
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
