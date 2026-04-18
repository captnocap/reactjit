// ── Resolve: Comparison ──────────────────────────────────────────
// Normalize any comparison into valid Zig. This is the ONE place
// that handles ===, !==, string comparisons, empty string checks,
// and qjs eval numeric comparisons.
//
// Every consumer that currently has inline regex for === or
// std.mem.eql construction should call this instead.

function _stripOuterParensExpr(expr) {
  if (typeof expr !== 'string') return expr;
  var value = expr.trim();
  while (value.length >= 2 && value.charAt(0) === '(' && value.charAt(value.length - 1) === ')') {
    var depth = 0;
    var wrapsWhole = true;
    for (var i = 0; i < value.length; i++) {
      var ch = value.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0 && i < value.length - 1) {
          wrapsWhole = false;
          break;
        }
      }
    }
    if (!wrapsWhole) break;
    value = value.slice(1, -1).trim();
  }
  return value;
}

function _splitTopLevelLogicalExprParts(expr) {
  if (typeof expr !== 'string') return null;
  var value = expr.trim();
  var parts = [];
  var start = 0;
  var depthParen = 0;
  var depthBracket = 0;
  var depthBrace = 0;
  var quote = '';
  var escape = false;

  function pushPart(end) {
    var part = value.slice(start, end).trim();
    if (part.length > 0) parts.push(part);
  }

  for (var i = 0; i < value.length; i++) {
    var ch = value.charAt(i);
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') { depthParen++; continue; }
    if (ch === ')') { if (depthParen > 0) depthParen--; continue; }
    if (ch === '[') { depthBracket++; continue; }
    if (ch === ']') { if (depthBracket > 0) depthBracket--; continue; }
    if (ch === '{') { depthBrace++; continue; }
    if (ch === '}') { if (depthBrace > 0) depthBrace--; continue; }
    if (depthParen !== 0 || depthBracket !== 0 || depthBrace !== 0) continue;

    if (i + 1 < value.length && ((ch === '&' && value.charAt(i + 1) === '&') || (ch === '|' && value.charAt(i + 1) === '|'))) {
      pushPart(i);
      start = i + 2;
      i++;
      continue;
    }

    if ((i === 0 || /\s/.test(value.charAt(i - 1))) && value.slice(i, i + 5) === ' and ' ) {
      pushPart(i);
      start = i + 5;
      i += 4;
      continue;
    }
    if ((i === 0 || /\s/.test(value.charAt(i - 1))) && value.slice(i, i + 4) === ' or ') {
      pushPart(i);
      start = i + 4;
      i += 3;
      continue;
    }
  }

  if (parts.length === 0) return null;
  pushPart(value.length);
  return parts.length > 1 ? parts : null;
}

function _looksBoolLikeComparisonExpr(expr) {
  if (typeof expr !== 'string') return false;
  var trimmed = _stripOuterParensExpr(expr);
  if (trimmed.length === 0) return false;
  if (trimmed === 'true' || trimmed === 'false') return true;
  if (trimmed.indexOf('?') >= 0) return false;
  if (trimmed.indexOf('getSlotBool') >= 0) return true;
  if (trimmed.indexOf('std.mem.eql') >= 0) return true;
  if (trimmed.charAt(0) === '!') return _looksBoolLikeComparisonExpr(trimmed.slice(1));
  if (trimmed.indexOf('not ') === 0) return _looksBoolLikeComparisonExpr(trimmed.slice(4));
  var logicalParts = _splitTopLevelLogicalExprParts(trimmed);
  if (logicalParts) {
    for (var pi = 0; pi < logicalParts.length; pi++) {
      if (!_looksBoolLikeComparisonExpr(logicalParts[pi])) return false;
    }
    return true;
  }
  return /(?:==|!=|~=|>=|<=|[<>])/.test(trimmed);
}

function _unwrapNumericBoolIfExpr(expr) {
  if (typeof expr !== 'string') return null;
  var value = expr.trim();
  for (var _pi = 0; _pi < 2; _pi++) {
    if (value.charAt(0) !== '(' || value.charAt(value.length - 1) !== ')') break;
    var depth = 0;
    var wrapsWhole = true;
    for (var i = 0; i < value.length; i++) {
      var ch = value.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0 && i < value.length - 1) {
          wrapsWhole = false;
          break;
        }
      }
    }
    if (!wrapsWhole) break;
    value = value.slice(1, -1).trim();
  }
  if (value.indexOf('if (') !== 0) return null;
  var condStart = value.indexOf('(');
  var condDepth = 0;
  var condEnd = -1;
  for (var ci = condStart; ci < value.length; ci++) {
    var c = value.charAt(ci);
    if (c === '(') condDepth++;
    else if (c === ')') {
      condDepth--;
      if (condDepth === 0) {
        condEnd = ci;
        break;
      }
    }
  }
  if (condEnd < 0) return null;
  var cond = value.slice(condStart + 1, condEnd).trim();
  var tail = value.slice(condEnd + 1).trim();
  if (/^@as\(i64,\s*1\)\s*else\s*@as\(i64,\s*0\)$/.test(tail)) {
    return { cond: cond, truthyWhenTrue: true };
  }
  if (/^@as\(i64,\s*0\)\s*else\s*@as\(i64,\s*1\)$/.test(tail)) {
    return { cond: cond, truthyWhenTrue: false };
  }
  return null;
}

function _resolveBoolNumericComparison(expr, op, rhs) {
  var wrapped = '(' + expr + ')';
  if ((op === '==' && rhs === '1') || (op === '!=' && rhs === '0')) return wrapped;
  if ((op === '!=' && rhs === '1') || (op === '==' && rhs === '0')) return '(!' + wrapped + ')';
  return '(' + expr + ' ' + op + ' ' + rhs + ')';
}

function _isQuotedStringLiteral(expr) {
  return typeof expr === 'string' && (/^"[^"]*"$/.test(expr) || /^'[^']*'$/.test(expr));
}

function _isBareStringSlotGetter(expr, ctx) {
  if (typeof expr !== 'string') return false;
  var trimmed = expr.trim();
  if (!/^[A-Za-z_]\w*$/.test(trimmed)) return false;
  var slotIdx = findSlot(trimmed);
  return slotIdx >= 0 && ctx && ctx.stateSlots && ctx.stateSlots[slotIdx] && ctx.stateSlots[slotIdx].type === 'string';
}

function _normalizeStringComparisonOperand(expr, ctx) {
  var value = String(expr).trim();
  if (_isBareStringSlotGetter(value, ctx)) {
    return slotGet(value);
  }
  if (_isQuotedStringLiteral(value)) {
    if (value.charAt(0) === "'") {
      return '"' + value.slice(1, -1).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
    return value;
  }
  return value;
}

function _wrapLogicalComparisonOperand(expr) {
  if (typeof expr !== 'string') return expr;
  var value = expr.trim();
  if (value.length === 0) return value;
  if (/(?:\|\||&&|\band\b|\bor\b)/.test(value)) return '(' + value + ')';
  return value;
}

// Normalize a comparison expression to valid Zig.
// Input: lhs (Zig expr), op (JS operator string), rhs (Zig expr or literal)
// Returns: Zig bool expression string
function resolveComparison(lhs, op, rhs, ctx) {
  // 1. Normalize JS operators to Zig
  if (op === '===') op = '==';
  if (op === '!==') op = '!=';

  // 2. Detect types
  var lhsIsQjs = isEval(lhs);
  var rhsIsQjs = isEval(rhs);
  var lhsIsStr = !lhsIsQjs && (lhs.includes('getSlotString') || lhs.includes('[0..') || lhs.includes('getString') || _isBareStringSlotGetter(lhs, ctx));
  var rhsIsStr = !rhsIsQjs && (rhs.includes('getSlotString') || rhs.includes('[0..') || rhs.includes('getString') || _isBareStringSlotGetter(rhs, ctx) || /^"[^"]*"$/.test(rhs));
  var rhsIsEmptyStr = /^['"]['"]$/.test(rhs) || rhs === '""';
  var rhsIsNum = /^-?\d+(\.\d+)?$/.test(rhs);
  var lhsBoolIf = _unwrapNumericBoolIfExpr(lhs);

  // 2.5. Bool expr vs 0/1 — preserve JS truthiness semantics.
  if ((rhs === '0' || rhs === '1') && lhsBoolIf) {
    var boolExpr = lhsBoolIf.truthyWhenTrue ? lhsBoolIf.cond : '(!(' + lhsBoolIf.cond + '))';
    return _resolveBoolNumericComparison(boolExpr, op, rhs);
  }
  if ((rhs === '0' || rhs === '1') && _looksBoolLikeComparisonExpr(lhs)) {
    return _resolveBoolNumericComparison(lhs, op, rhs);
  }

  // 3. QJS eval vs number → do comparison in JS
  if (lhsIsQjs && rhsIsNum) {
    var inner = extractInner(lhs);
    if (inner) {
      return '(' + buildComparisonEval(inner, op, rhs, ctx) + '.len > 0)';
    }
    // Fallback — shouldn't happen if eval_builder works
    return '(' + lhs + '.len > 0)';
  }

  // 4. QJS eval vs string → do comparison in JS
  if (lhsIsQjs && (rhsIsStr || /^"[^"]*"$/.test(rhs))) {
    var inner2 = extractInner(lhs);
    var rhsClean = rhs.replace(/^"/, '').replace(/"$/, '');
    if (inner2) {
      return '(' + buildComparisonEval(inner2, op, "'" + rhsClean + "'", ctx) + '.len > 0)';
    }
    return '(' + lhs + '.len > 0)';
  }

  // 5. Empty string comparison → .len check
  if (rhsIsEmptyStr && (lhsIsStr || lhs.includes('getSlotString'))) {
    if (op === '==' || op === '===') return '(' + lhs + '.len == 0)';
    if (op === '!=' || op === '!==') return '(' + lhs + '.len > 0)';
  }

  // 6. String comparison → std.mem.eql
  if (lhsIsStr || rhsIsStr) {
    var lhsExpr = _normalizeStringComparisonOperand(lhs, ctx);
    var rhsExpr = _normalizeStringComparisonOperand(rhs, ctx);
    var eql = 'std.mem.eql(u8, ' + lhsExpr + ', ' + rhsExpr + ')';
    return op === '!=' ? '(!' + eql + ')' : '(' + eql + ')';
  }

  // 7. Normal numeric/bool comparison — pass through
  var lhsExpr2 = _wrapLogicalComparisonOperand(lhs);
  var rhsExpr2 = _wrapLogicalComparisonOperand(rhs);
  return '(' + lhsExpr2 + ' ' + op + ' ' + rhsExpr2 + ')';
}

// Normalize a JS operator token to Zig
function normalizeOp(op) {
  if (op === '===') return '==';
  if (op === '!==') return '!=';
  return op;
}
