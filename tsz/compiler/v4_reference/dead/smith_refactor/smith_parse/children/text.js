// ── Child parsing: text/comment fallthrough ───────────────────────

function tryParseTextChild(c, children) {
  if (c.kind() === TK.lt || c.kind() === TK.lbrace) return false;

  if (c.kind() === TK.comment) {
    c.advance();
    return true;
  }

  if (c.kind() !== TK.rbrace) {
    const textStart = c.starts[c.pos];
    let textEnd = textStart;
    while (c.kind() !== TK.lt && c.kind() !== TK.lt_slash && c.kind() !== TK.lbrace && c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
      textEnd = c.ends[c.pos];
      c.advance();
    }
    const text = c._byteSlice(textStart, textEnd).trim();
    if (text.trim()) {
      if (globalThis.__SMITH_DEBUG_INLINE && (text.includes('import') || text.includes('function ') || text.includes('setMyPid'))) {
        globalThis.__dbg = globalThis.__dbg || [];
        globalThis.__dbg.push('[TEXT_LEAK] text="' + text.substring(0, 80) + '" pos=' + c.pos + ' inline=' + (ctx.inlineComponent || 'none'));
        for (let di = Math.max(0, c.pos - 5); di < Math.min(c.count, c.pos + 5); di++) {
          globalThis.__dbg.push('[TOK@' + di + '] kind=' + c.kindAt(di) + ' text="' + c.textAt(di).substring(0, 40) + '"');
        }
        if (!globalThis.__firstLeakDumped) {
          globalThis.__firstLeakDumped = true;
          globalThis.__dbg.push('[CONTEXT] SourcePage bodyPos check: components=' + ctx.components.map(function(cc) { return cc.name + '@' + cc.bodyPos; }).join(', '));
        }
      }
      children.push({ nodeExpr: `.{ .text = "${text.trim().replace(/"/g, '\\"')}" }` });
    }
    return true;
  }

  c.advance();
  return true;
}
