// ── Emit Atom 005: Init state slots ─────────────────────────────
// Index: 5
// Group: state_tree
// Target: zig
// Status: complete
// Current owner: emit/state_manifest.js
//
// Trigger: every emitted app with zero or more state slots.
// Output target: _initState() slot creation calls.

function _a005_applies(ctx, meta) {
  void meta;
  // Always emitted — even with zero slots the function must exist
  return Array.isArray(ctx.stateSlots);
}

function _a005_emit(ctx, meta) {
  void meta;
  var out = 'fn _initState() void {\n';
  for (var i = 0; i < ctx.stateSlots.length; i++) {
    var s = ctx.stateSlots[i];
    if (s.type === 'int') out += '    _ = state.createSlot(' + s.initial + ');\n';
    else if (s.type === 'float') out += '    _ = state.createSlotFloat(' + s.initial + ');\n';
    else if (s.type === 'boolean') out += '    _ = state.createSlotBool(' + s.initial + ');\n';
    else if (s.type === 'string') out += '    _ = state.createSlotString("' + s.initial + '");\n';
  }
  out += '}\n\n';
  return out;
}

_emitAtoms[5] = {
  id: 5,
  name: 'init_state_slots',
  group: 'state_tree',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/state_manifest.js',
  applies: _a005_applies,
  emit: _a005_emit,
};
