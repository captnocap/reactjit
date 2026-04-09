// ── Style expression token helpers (from attrs.js) ──

function _stylePeek(ts, offset) {
  return ts.tokens[ts.pos + (offset || 0)] || null;
}

function _styleMatch(ts, kind, value) {
  var tok = _stylePeek(ts, 0);
  if (!tok) return false;
  if (kind && tok.kind !== kind) return false;
  if (value !== undefined && tok.value !== value) return false;
  return true;
}

function _styleConsume(ts, kind, value) {
  if (!_styleMatch(ts, kind, value)) return null;
  return ts.tokens[ts.pos++];
}

function _styleLooksZigString(expr) {
  return typeof expr === 'string' &&
    (expr.includes('getSlotString') ||
     expr.includes('[0..') ||
     expr.includes('@as([]const u8') ||
     expr.includes('getString'));
}

function _styleLooksZigExpr(expr) {
  return typeof expr === 'string' &&
    (expr.includes('state.get') ||
     expr.includes('getSlot') ||
     expr.includes('_oa') ||
     expr.includes('@as(') ||
     expr.includes('@intCast(') ||
     expr.includes('std.mem.eql') ||
     _styleLooksBoolExpr(expr) ||
     expr.startsWith('if (') ||
     expr.startsWith('(if ('));
}

function _styleLooksBoolExpr(expr) {
  if (typeof expr !== 'string') return false;
  var trimmed = expr.trim();
  if (trimmed.length === 0) return false;
  if (trimmed === 'true' || trimmed === 'false') return true;
  if (trimmed.indexOf('?') >= 0) return false;
  if (trimmed.indexOf('getSlotBool') >= 0) return true;
  if (trimmed.indexOf('std.mem.eql') >= 0) return true;
  return /(?:===|!==|==|!=|>=|<=|\band\b|\bor\b|[<>])/.test(trimmed) || trimmed.charAt(0) === '!';
}
