// ── Emit Atom 011: WGSL effect shaders ──────────────────────────
// Index: 11
// Group: handlers_effects
// Target: zig
// Status: complete
// Current owner: emit/effects.js, emit_split.js
//
// Trigger: effect nodes that can be promoted to GPU/WGSL paths.
// Output target: embedded WGSL shader source and shader glue.
//
// Notes:
//   Depends on the shared transpileEffectToWGSL() helper from emit_split.js.

function _a011_applies(ctx, meta) {
  void meta;
  return !!(ctx.effectRenders && ctx.effectRenders.length > 0);
}

function _a011_emit(ctx, meta) {
  void meta;
  if (!(ctx.effectRenders && ctx.effectRenders.length > 0)) return '';

  var out = '';
  ctx.effectRenders.forEach(function(effectRender) {
    var result = transpileEffectToWGSL(effectRender.body, effectRender.param);
    if (result && result.wgsl) {
      var wgslLines = result.wgsl.split('\n');
      out += 'pub const _effect_wgsl_' + effectRender.id + ': []const u8 =\n';
      wgslLines.forEach(function(wgslLine) {
        out += '    \\\\' + wgslLine + '\n';
      });
      out += ';\n';
      out += 'pub const _effect_shader_' + effectRender.id + ' = api.GpuShaderDesc{ .wgsl = _effect_wgsl_' + effectRender.id + ' };\n\n';
    } else {
      out += 'pub const _effect_shader_' + effectRender.id + ': ?api.GpuShaderDesc = null;  // CPU-only effect\n\n';
    }
  });
  return out;
}

_emitAtoms[11] = {
  id: 11,
  name: 'wgsl_effect_shaders',
  group: 'handlers_effects',
  target: 'zig',
  status: 'complete',
  currentOwner: 'emit/effects.js, emit_split.js',
  applies: _a011_applies,
  emit: _a011_emit,
};
