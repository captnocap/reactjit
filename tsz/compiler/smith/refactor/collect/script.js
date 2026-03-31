// ── Collection: <script> blocks ──────────────────────────────────

function collectScript(c) {
  const saved = c.save();
  c.pos = 0;
  const scriptParts = [];
  while (c.pos < c.count) {
    if (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'script') {
      c.advance();
      c.advance();
      if (c.kind() === TK.gt) c.advance();
      const startOff = c.starts[c.pos];
      let endOff = startOff;
      while (c.pos < c.count) {
        if (c.kind() === TK.lt_slash && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'script') {
          endOff = c.starts[c.pos];
          c.advance();
          c.advance();
          if (c.kind() === TK.gt) c.advance();
          break;
        }
        c.advance();
      }
      const block = c._byteSlice(startOff, endOff).trim();
      if (block.length > 0) scriptParts.push(block);
    }
    c.advance();
  }
  if (scriptParts.length > 0) {
    ctx.scriptBlock = scriptParts.join('\n\n');
    scanScriptFunctionNames(ctx.scriptBlock);
  }
  c.restore(saved);

  if (globalThis.__scriptContent) {
    scanScriptFunctionNames(globalThis.__scriptContent, true);
  }
}

function scanScriptFunctionNames(scriptText, dedupeOnly) {
  const funcRegex = /function\s+(\w+)/g;
  let match;
  while ((match = funcRegex.exec(scriptText)) !== null) {
    if (!dedupeOnly || !ctx.scriptFuncs.includes(match[1])) ctx.scriptFuncs.push(match[1]);
  }
}

function isScriptFunc(name) {
  return ctx.scriptFuncs.includes(name);
}
