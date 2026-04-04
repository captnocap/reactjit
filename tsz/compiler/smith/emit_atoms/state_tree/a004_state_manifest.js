// ── Emit Atom 004: State manifest ───────────────────────────────
// Index: 4
// Group: state_tree
// Target: zig
// Status: complete
// Current owner: emit/state_manifest.js
//
// Trigger: ctx.stateSlots.length > 0.
// Output target: slot comments and comptime slot-count guard.

function _a004_applies(ctx, meta) {
  void meta;
  return ctx.stateSlots && ctx.stateSlots.length > 0;
}

function _a004_emit(ctx, meta) {
  void meta;
  var out = '// \u2500\u2500 State manifest \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';
  ctx.stateSlots.forEach(function(s, i) {
    var typeLabel = s.type === 'boolean' ? 'bool' : s.type;
    out += '// slot ' + i + ': ' + s.getter + ' (' + typeLabel + ')\n';
  });
  out += 'comptime { if (' + ctx.stateSlots.length + ' != ' + ctx.stateSlots.length + ') @compileError("state slot count mismatch"); }\n\n';
  return out;
}

_emitAtoms[4] = {
  id: 4,
  name: 'state_manifest',
  group: 'state_tree',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/state_manifest.js',
  applies: _a004_applies,
  emit: _a004_emit,
};
