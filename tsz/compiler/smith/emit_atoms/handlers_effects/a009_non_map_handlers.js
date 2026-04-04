// ── Emit Atom 009: Non-map handlers ─────────────────────────────
// Index: 9
// Group: handlers_effects
// Target: zig
// Status: complete
// Current owner: emit/handlers.js
//
// Trigger: ctx.handlers filtered to !inMap.
// Output target: Zig handler stubs/functions for direct nodes.

function _a009_applies(ctx, meta) {
  void meta;
  if (!ctx.handlers || ctx.handlers.length === 0) return false;
  return ctx.handlers.some(function(handler) {
    return !handler.inMap;
  });
}

function _a009_emit(ctx, meta) {
  void meta;
  var nonMapHandlers = (ctx.handlers || []).filter(function(handler) {
    return !handler.inMap;
  });
  if (nonMapHandlers.length === 0) return '';

  var out = '\n// \u2500\u2500 Event handlers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';
  nonMapHandlers.forEach(function(handler) {
    out += 'fn ' + handler.name + '() void {\n' + (handler.body || '') + '}\n\n';
  });
  return out;
}

_emitAtoms[9] = {
  id: 9,
  name: 'non_map_handlers',
  group: 'handlers_effects',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/handlers.js',
  applies: _a009_applies,
  emit: _a009_emit,
};
