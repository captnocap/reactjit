// ── Cursor helpers ────────────────────────────────────────────────
// Consolidated from parse/utils.js and parse/children/brace_util.js
// per migration steps 565-568.

function lastTokenOffset(c) {
  return c.starts[c.pos > 0 ? c.pos - 1 : 0];
}

function skipBraces(c) {
  let depth = 1;
  c.advance();
  while (depth > 0 && c.kind() !== TK.eof) {
    if (c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rbrace) depth--;
    if (depth > 0) c.advance();
  }
  if (c.kind() === TK.rbrace) c.advance();
}

function offsetToLine(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function _joinTokenText(c, start, end) {
  const parts = [];
  for (let ti = start; ti < end; ti++) parts.push(c.textAt(ti));
  return parts.join(' ');
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
    // Reconstitute postfix increment/decrement from space-joined tokens:
    // `i + + ;`, `i + + )`, `i + + ,`, `i + + }` → `i++;`, `i++)`, etc.
    // Only fires when `+ +` is terminated by a non-operand — unambiguously
    // postfix, so we don't corrupt `a + +b` (unary plus RHS).
    .replace(/(\w)\s*\+\s*\+(\s*[);,}\]])/g, '$1++$2')
    .replace(/(\w)\s*-\s*-(\s*[);,}\]])/g, '$1--$2')
    .replace(/\bexact\b/g, '===');
}
