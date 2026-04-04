// ── Emit Atom 010: CPU effect renderers ─────────────────────────
// Index: 10
// Group: handlers_effects
// Target: zig
// Status: complete
// Current owner: emit/effects.js
//
// Trigger: effect nodes requiring CPU-side render callbacks.
// Output target: transpiled Zig effect render functions.
//
// Notes:
//   Uses the shared effect transpilers currently hosted in emit_split.js.

function _a010_applies(ctx, meta) {
  void meta;
  return !!(ctx.effectRenders && ctx.effectRenders.length > 0);
}

function _a010_emit(ctx, meta) {
  var prefix = meta && typeof meta.prefix === 'string' ? meta.prefix : 'framework/';
  if (!(ctx.effectRenders && ctx.effectRenders.length > 0)) return '';

  var out = '\n// \u2500\u2500 Effect render functions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n';
  out += 'const effect_ctx = @import("' + prefix + 'effect_ctx.zig");\n';
  out += 'const api = @import("' + prefix + 'api.zig");\n\n';

  ctx.effectRenders.forEach(function(effectRender) {
    out += 'pub fn _effect_render_' + effectRender.id + '(ctx_e: *effect_ctx.EffectContext) void {\n';
    out += transpileEffectBody(effectRender.body, effectRender.param);
    out += '}\n\n';
  });
  return out;
}

_emitAtoms[10] = {
  id: 10,
  name: 'cpu_effect_renderers',
  group: 'handlers_effects',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/effects.js',
  applies: _a010_applies,
  emit: _a010_emit,
};
