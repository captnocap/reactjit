// ── Style expression Pratt parser (from attrs.js) ──

function _styleParsePrimary(ts) {
  if (_styleConsume(ts, '(')) {
    var inner = _styleParseOr(ts);
    _styleConsume(ts, ')');
    if (!inner) return null;
    return inner.kind === 'expr' ? _styleResolvedExpr(inner.type, '(' + inner.expr + ')') : inner;
  }
  var strTok = _styleConsume(ts, 'string');
  if (strTok) return _styleResolvedLiteral('string', strTok.value);
  var numTok = _styleConsume(ts, 'number');
  if (numTok) return _styleResolvedLiteral('number', numTok.value);
  var identTok = _styleConsume(ts, 'identifier');
  if (identTok) return _resolveStyleIdentifierValue(identTok.value);
  return null;
}

function _styleParseUnary(ts) {
  if (_styleConsume(ts, '!')) {
    var inner = _styleParseUnary(ts);
    return _styleResolvedExpr('bool', '(!' + _styleSpecBoolExpr(inner) + ')');
  }
  return _styleParsePrimary(ts);
}

function _styleParseComparison(ts) {
  var left = _styleParseUnary(ts);
  if (!left) return null;
  var opTok = _stylePeek(ts, 0);
  var opVal = null;
  if (opTok && opTok.kind === 'op' &&
      (opTok.value === '==' || opTok.value === '!=' || opTok.value === '===' || opTok.value === '!==' ||
       opTok.value === '>=' || opTok.value === '<=')) {
    opVal = opTok.value;
  } else if (opTok && (opTok.kind === '>' || opTok.kind === '<')) {
    opVal = opTok.value;
  }
  if (opVal) {
    ts.pos++;
    var right = _styleParseUnary(ts);
    if (!right) return _styleResolvedExpr('bool', resolveComparison(_styleSpecToExpr(left), opVal, '0', ctx));
    return _styleResolvedExpr('bool', resolveComparison(_styleSpecToExpr(left), opVal, _styleSpecToExpr(right), ctx));
  }
  return left;
}

function _styleParseAnd(ts) {
  var left = _styleParseComparison(ts);
  while (_styleMatch(ts, 'op', '&&')) {
    ts.pos++;
    var right = _styleParseComparison(ts);
    left = _styleResolvedExpr('bool', '(' + _styleSpecBoolExpr(left) + ' and ' + _styleSpecBoolExpr(right) + ')');
  }
  return left;
}

function _styleParseOr(ts) {
  var left = _styleParseAnd(ts);
  while (_styleMatch(ts, 'op', '||')) {
    ts.pos++;
    var right = _styleParseAnd(ts);
    left = _styleResolvedExpr('bool', '(' + _styleSpecBoolExpr(left) + ' or ' + _styleSpecBoolExpr(right) + ')');
  }
  return left;
}

function _styleParseObjectValue(ts) {
  var strTok = _styleConsume(ts, 'string');
  if (strTok) return _styleResolvedLiteral('string', strTok.value);
  var numTok = _styleConsume(ts, 'number');
  if (numTok) return _styleResolvedLiteral('number', numTok.value);
  var identTok = _styleConsume(ts, 'identifier');
  if (identTok) return _resolveStyleIdentifierValue(identTok.value);
  return null;
}

function _styleParseObject(ts) {
  if (!_styleConsume(ts, '{')) return null;
  var fields = {};
  while (!_styleMatch(ts, '}') && _stylePeek(ts, 0)) {
    var keyTok = _stylePeek(ts, 0);
    var key = null;
    if (keyTok.kind === 'identifier' || keyTok.kind === 'string') {
      key = keyTok.value;
      ts.pos++;
    } else {
      ts.pos++;
      continue;
    }
    _styleConsume(ts, ':');
    var valueSpec = _styleParseObjectValue(ts);
    if (key && valueSpec) fields[key] = valueSpec;
    _styleConsume(ts, ',');
  }
  _styleConsume(ts, '}');
  return { kind: 'object', fields: fields };
}

function _styleParseIife(ts, seen) {
  var start = ts.pos;
  if (!_styleConsume(ts, '(')) return null;
  var fnTok = _styleConsume(ts, 'identifier');
  if (!fnTok || fnTok.value !== 'function') { ts.pos = start; return null; }
  if (!_styleConsume(ts, '(') || !_styleConsume(ts, ')') || !_styleConsume(ts, '{')) { ts.pos = start; return null; }
  var varTok = _styleConsume(ts, 'identifier');
  if (!varTok || varTok.value !== 'var') { ts.pos = start; return null; }
  var tempNameTok = _styleConsume(ts, 'identifier');
  if (!tempNameTok) { ts.pos = start; return null; }
  if (!_styleConsume(ts, '=')) { ts.pos = start; return null; }
  var baseExpr = _styleParseExpr(ts, seen);
  if (!baseExpr) { ts.pos = start; return null; }
  _styleConsume(ts, ';');

  var steps = [];
  while (_stylePeek(ts, 0)) {
    var tok = _stylePeek(ts, 0);
    if (tok.kind === 'identifier' && tok.value === 'return') break;
    if (!(tok.kind === 'identifier' && tok.value === 'if')) { ts.pos = start; return null; }
    ts.pos++;
    if (!_styleConsume(ts, '(')) { ts.pos = start; return null; }
    var cond = _styleParseOr(ts);
    if (!_styleConsume(ts, ')') || !_styleConsume(ts, '{')) { ts.pos = start; return null; }
    var assignTok = _styleConsume(ts, 'identifier');
    if (!assignTok || assignTok.value !== tempNameTok.value || !_styleConsume(ts, '=')) { ts.pos = start; return null; }
    var nextExpr = _styleParseExpr(ts, seen);
    if (!nextExpr) { ts.pos = start; return null; }
    _styleConsume(ts, ';');
    if (!_styleConsume(ts, '}')) { ts.pos = start; return null; }
    steps.push({ condExpr: _styleSpecBoolExpr(cond), expr: nextExpr });
  }

  var retTok = _styleConsume(ts, 'identifier');
  if (!retTok || retTok.value !== 'return') { ts.pos = start; return null; }
  var retNameTok = _styleConsume(ts, 'identifier');
  if (!retNameTok || retNameTok.value !== tempNameTok.value) { ts.pos = start; return null; }
  _styleConsume(ts, ';');
  if (!_styleConsume(ts, '}') || !_styleConsume(ts, ')') || !_styleConsume(ts, '(') || !_styleConsume(ts, ')')) {
    ts.pos = start;
    return null;
  }

  var current = baseExpr;
  for (var si = 0; si < steps.length; si++) {
    current = {
      kind: 'ternary',
      condExpr: steps[si].condExpr,
      whenTrue: steps[si].expr,
      whenFalse: current,
    };
  }
  return current;
}

function _styleParseBase(ts, seen) {
  if (_styleMatch(ts, '{')) return _styleParseObject(ts);
  if (_styleMatch(ts, '(') && _stylePeek(ts, 1) && _stylePeek(ts, 1).kind === 'identifier' && _stylePeek(ts, 1).value === 'function') {
    return _styleParseIife(ts, seen);
  }
  if (_styleConsume(ts, '(')) {
    var inner = _styleParseExpr(ts, seen);
    _styleConsume(ts, ')');
    return inner;
  }
  var identTok = _styleConsume(ts, 'identifier');
  if (identTok) {
    return _resolveStyleObjectReference(identTok.value, seen);
  }
  return null;
}

function _styleParseExpr(ts, seen) {
  var saved = ts.pos;
  var cond = _styleParseOr(ts);
  if (cond && _styleConsume(ts, '?')) {
    var whenTrue = _styleParseExpr(ts, seen);
    if (!_styleConsume(ts, ':')) return null;
    var whenFalse = _styleParseExpr(ts, seen);
    if (!whenTrue || !whenFalse) return null;
    return {
      kind: 'ternary',
      condExpr: _styleSpecBoolExpr(cond),
      whenTrue: whenTrue,
      whenFalse: whenFalse,
    };
  }
  ts.pos = saved;
  return _styleParseBase(ts, seen);
}

