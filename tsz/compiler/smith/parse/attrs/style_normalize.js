// ── Style expression normalizers (from attrs.js) ──

function _normalizeStyleExprJs(expr) {
  return String(expr || '')
    .replace(/\s*\.\s*/g, '.')
    .replace(/!\s*=\s*=/g, '!==')
    .replace(/=\s*=\s*=/g, '===')
    .replace(/!\s*=(?!=)/g, '!=')
    .replace(/=\s*=(?!=)/g, '==')
    .replace(/>\s*=/g, '>=')
    .replace(/<\s*=/g, '<=')
    .replace(/&\s*&/g, '&&')
    .replace(/\|\s*\|/g, '||')
    .replace(/\bexact\b/g, '===')
    .trim();
}

function _styleExprQuote(str) {
  return '"' + String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r') + '"';
}
