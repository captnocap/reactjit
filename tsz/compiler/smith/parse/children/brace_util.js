function _joinTokenText(c, start, end) {
  const parts = [];
  for (let ti = start; ti < end; ti++) parts.push(c.textAt(ti));
  return parts.join(' ');
}

function _expandRenderLocalJs(expr) {
  let out = expr;
  if (!ctx._renderLocalRaw) return out;
  const names = Object.keys(ctx._renderLocalRaw).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const raw = ctx._renderLocalRaw[name];
    if (!raw || raw === expr) continue;
    out = out.replace(new RegExp(`\\b${name}\\b`, 'g'), function(match, offset, full) {
      let prev = offset - 1;
      while (prev >= 0 && /\s/.test(full[prev])) prev--;
      if (prev >= 0 && full[prev] === '.') return match;
      return `(${_normalizeJoinedJsExpr(raw)})`;
    });
  }
  return out;
}

function _expandRenderLocalJsFully(expr) {
  let out = expr;
  for (let i = 0; i < 6; i++) {
    const next = _expandRenderLocalJs(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

function _makeEvalTruthyExpr(jsExpr) {
  return zigBool(buildEval(_expandRenderLocalJs(jsExpr), ctx), ctx);
}

function _normalizeJoinedJsExpr(expr) {
  return String(expr)
    .replace(/!\s*=\s*=/g, '!==')
    .replace(/=\s*=\s*=/g, '===')
    .replace(/!\s*=(?!=)/g, '!=')
    .replace(/=\s*=(?!=)/g, '==')
    .replace(/>\s*=/g, '>=')
    .replace(/<\s*=/g, '<=')
    .replace(/&\s*&/g, '&&')
    .replace(/\|\s*\|/g, '||')
    .replace(/\bexact\b/g, '===');
}

function _findLastTopLevelAmpAmp(c, start, end) {
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let last = -1;
  for (let ti = start; ti < end; ti++) {
    const kind = c.kindAt(ti);
    if (kind === TK.lparen) depthParen++;
    else if (kind === TK.rparen) { if (depthParen > 0) depthParen--; }
    else if (kind === TK.lbracket) depthBracket++;
    else if (kind === TK.rbracket) { if (depthBracket > 0) depthBracket--; }
    else if (kind === TK.lbrace) depthBrace++;
    else if (kind === TK.rbrace) { if (depthBrace > 0) depthBrace--; }
    else if (kind === TK.amp_amp && depthParen === 0 && depthBracket === 0 && depthBrace === 0) last = ti;
  }
  return last;
}
