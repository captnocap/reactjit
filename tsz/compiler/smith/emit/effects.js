// Emit effect render functions

function emitEffectRenders(ctx, prefix) {
  if (!(ctx.effectRenders && ctx.effectRenders.length > 0)) return '';
  let out = `\n// ── Effect render functions ─────────────────────────────────────\n`;
  out += `const effect_ctx = @import("${prefix}effect_ctx.zig");\n`;
  out += `const api = @import("${prefix}api.zig");\n\n`;
  for (const er of ctx.effectRenders) {
    // CPU fallback render function (kept for named effects that need pixel sampling)
    out += `pub fn _effect_render_${er.id}(ctx_e: *effect_ctx.EffectContext) void {\n`;
    out += transpileEffectBody(er.body, er.param);
    out += `}\n\n`;
    // GPU shader (WGSL) — compiled from the same onRender body
    const wgsl = transpileEffectToWGSL(er.body, er.param);
    // Emit as a Zig string literal (multiline \\)
    const wgslLines = wgsl.split('\n');
    out += `pub const _effect_wgsl_${er.id}: []const u8 =\n`;
    for (const wl of wgslLines) {
      out += `    \\\\${wl}\n`;
    }
    out += `;\n`;
    out += `pub const _effect_shader_${er.id} = api.GpuShaderDesc{ .wgsl = _effect_wgsl_${er.id} };\n\n`;
  }
  return out;
}
