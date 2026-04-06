// Emit effect render functions

function emitEffectRenders(ctx, prefix) {
  if (!(ctx.effectRenders && ctx.effectRenders.length > 0)) return '';
  let out = `\n// ── Effect render functions ─────────────────────────────────────\n`;
  out += `const effect_ctx = @import("${prefix}effect_ctx.zig");\n\n`;
  for (const er of ctx.effectRenders) {
    out += `fn _effect_render_${er.id}(ctx_e: *effect_ctx.EffectContext) void {\n`;
    out += transpileEffectBody(er.body, er.param);
    out += `}\n\n`;
  }
  return out;
}
