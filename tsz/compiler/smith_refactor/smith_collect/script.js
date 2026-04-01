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

// ── Collection: <lscript> blocks ─────────────────────────────────

function collectLScript(c) {
  const saved = c.save();
  c.pos = 0;
  const lscriptParts = [];
  while (c.pos < c.count) {
    if (c.kind() === TK.lt && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'lscript') {
      c.advance();
      c.advance();
      if (c.kind() === TK.gt) c.advance();
      const startOff = c.starts[c.pos];
      let endOff = startOff;
      while (c.pos < c.count) {
        if (c.kind() === TK.lt_slash && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'lscript') {
          endOff = c.starts[c.pos];
          c.advance();
          c.advance();
          if (c.kind() === TK.gt) c.advance();
          break;
        }
        c.advance();
      }
      const block = c._byteSlice(startOff, endOff).trim();
      if (block.length > 0) lscriptParts.push(block);
    }
    c.advance();
  }
  if (lscriptParts.length > 0) {
    ctx.luaBlock = lscriptParts.join('\n\n');
    scanLScriptFunctionNames(ctx.luaBlock);
  }
  c.restore(saved);
}

function scanLScriptFunctionNames(luaText) {
  // Lua function declaration patterns:
  // function name(...)
  // local function name(...)
  // name = function(...)
  const funcRegex = /(?:^|\s)(?:local\s+)?function\s+(\w+)|\b(\w+)\s*=\s*function/g;
  let match;
  while ((match = funcRegex.exec(luaText)) !== null) {
    const funcName = match[1] || match[2];
    if (funcName && !ctx.scriptFuncs.includes(funcName)) {
      ctx.scriptFuncs.push(funcName);
    }
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
