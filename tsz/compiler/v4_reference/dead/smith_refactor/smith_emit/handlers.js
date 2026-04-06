// Emit non-map handlers

function emitNonMapHandlers(nonMapHandlers) {
  if (nonMapHandlers.length === 0) return '';
  let out = `\n// ── Event handlers ──────────────────────────────────────────────\n`;
  for (const h of nonMapHandlers) {
    out += `fn ${h.name}() void {\n${h.body || ''}}\n\n`;
  }
  return out;
}
