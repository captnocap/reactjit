// Emit final cleanup/post-pass

function appendEmitDebugSections(out) {
  if (ctx._debugLines && ctx._debugLines.length > 0) {
    out += '\n// ── SMITH DEBUG ──\n';
    for (const line of ctx._debugLines) out += '// ' + line + '\n';
  }
  if (globalThis.__dbg && globalThis.__dbg.length > 0) {
    out += '\n// ── Smith debug log ──\n';
    for (const msg of globalThis.__dbg) out += '// DBG: ' + msg + '\n';
    globalThis.__dbg = [];
  }
  return out;
}

function finalizeEmitOutput(out, file) {
  out = appendEmitDebugSections(out);
  out = out.replace(/^(var \w+: )([^\n=]+) = undefined;$/gm, function(_, prefix, type) {
    return prefix + type + ' = std.mem.zeroes(' + type.trim() + ');';
  });
  if (globalThis.__splitOutput == 1) return splitOutput(out, file);
  return out;
}
