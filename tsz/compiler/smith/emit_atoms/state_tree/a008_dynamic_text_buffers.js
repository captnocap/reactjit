// ── Emit Atom 008: Dynamic text buffers ─────────────────────────
// Index: 8
// Group: state_tree
// Target: zig
// Status: complete
// Current owner: emit/dyn_text.js
//
// Trigger: ctx.dynTexts contains non-map runtime text slots.
// Output target: _dyn_buf_* and _dyn_text_* declarations.

function _a008_applies(ctx, meta) {
  void meta;
  if (!ctx.dynTexts) return false;
  for (var i = 0; i < ctx.dynTexts.length; i++) {
    if (!ctx.dynTexts[i].inMap) return true;
  }
  if (ctx._jsEvalCount && ctx._jsEvalCount > 0) return true;
  return false;
}

function _a008_emit(ctx, meta) {
  void meta;
  var nonMapDynTexts = ctx.dynTexts.filter(function(dt) { return !dt.inMap; });
  var out = '\n// \u2500\u2500 Dynamic text buffers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';
  for (var i = 0; i < nonMapDynTexts.length; i++) {
    var dt = nonMapDynTexts[i];
    var bs = dt.bufSize || 64;
    out += 'var _dyn_buf_' + dt.bufId + ': [' + bs + ']u8 = undefined;\n';
    out += 'var _dyn_text_' + dt.bufId + ': []const u8 = "";\n';
  }
  // JS eval result buffers — for expressions evaluated via QuickJS at runtime
  var evalCount = ctx._jsEvalCount || 0;
  if (evalCount > 0) {
    out += '\n// \u2500\u2500 JS eval buffers (runtime expression results) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';
    for (var ei = 0; ei < evalCount; ei++) {
      out += 'var _eval_buf_' + ei + ': [256]u8 = undefined;\n';
    }
  }
  return out;
}

_emitAtoms[8] = {
  id: 8,
  name: 'dynamic_text_buffers',
  group: 'state_tree',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/dyn_text.js',
  applies: _a008_applies,
  emit: _a008_emit,
};
