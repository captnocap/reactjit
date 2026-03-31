// Emit state manifest/init

function emitStateManifest(ctx, hasState) {
  if (!hasState) return '';
  let out = `// ── State manifest ──────────────────────────────────────────────\n`;
  ctx.stateSlots.forEach(function(s, i) {
    const typeLabel = s.type === 'boolean' ? 'bool' : s.type;
    out += `// slot ${i}: ${s.getter} (${typeLabel})\n`;
  });
  out += `comptime { if (${ctx.stateSlots.length} != ${ctx.stateSlots.length}) @compileError("state slot count mismatch"); }\n\n`;
  return out;
}

function emitInitState(ctx) {
  let out = `fn _initState() void {\n`;
  for (const s of ctx.stateSlots) {
    if (s.type === 'int') out += `    _ = state.createSlot(${s.initial});\n`;
    else if (s.type === 'float') out += `    _ = state.createSlotFloat(${s.initial});\n`;
    else if (s.type === 'boolean') out += `    _ = state.createSlotBool(${s.initial});\n`;
    else if (s.type === 'string') out += `    _ = state.createSlotString("${s.initial}");\n`;
  }
  out += `}\n\n`;
  return out;
}
