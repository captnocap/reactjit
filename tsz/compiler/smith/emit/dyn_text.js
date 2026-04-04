// Emit dynamic text buffer declarations

function emitDynamicTextBuffers(ctx) {
  const nonMapDynTexts = ctx.dynTexts.filter(function(dt) { return !dt.inMap; });
  if (nonMapDynTexts.length === 0) return '';

  let out = `\n// ── Dynamic text buffers ─────────────────────────────────────────\n`;
  for (const dt of nonMapDynTexts) {
    const bs = dt.bufSize || 64;
    out += `var _dyn_buf_${dt.bufId}: [${bs}]u8 = undefined;\n`;
    out += `var _dyn_text_${dt.bufId}: []const u8 = "";\n`;
  }
  // JS eval result buffers — for expressions evaluated via QuickJS at runtime
  const evalCount = ctx._jsEvalCount || 0;
  if (evalCount > 0) {
    out += `\n// ── JS eval buffers (runtime expression results) ─────────────────\n`;
    for (let ei = 0; ei < evalCount; ei++) {
      out += `var _eval_buf_${ei}: [256]u8 = undefined;\n`;
    }
  }
  return out;
}
