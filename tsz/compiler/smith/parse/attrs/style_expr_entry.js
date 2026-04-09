// ── Style expression entry (from attrs.js) ──

function _parseStyleExprFromRaw(raw, seen) {
  var normalized = _normalizeStyleExprJs(raw);
  if (!normalized) return null;
  var tokens = _tokenizeStyleExpr(normalized);
  if (tokens.length === 0) return null;
  var ts = _makeStyleTokenStream(tokens);
  var parsed = _styleParseExpr(ts, seen || { names: {} });
  if (!parsed) return null;
  return parsed;
}

function parseStyleExpressionAttr(c) {
  if (c.kind() !== TK.lbrace) return null;
  if (c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lbrace) return null;
  var rawExpr = _readStyleAttrExpressionRaw(c);
  if (!rawExpr) return null;
  print('[STYLE_EXPR_RAW] ' + rawExpr.substring(0, 160));
  var parsed = _parseStyleExprFromRaw(rawExpr, { names: {} });
  if (parsed) {
    print('[STYLE_EXPR_PARSE] ' + rawExpr.substring(0, 160));
  }
  return parsed;
}

function _styleExprCollectKeys(ast, out) {
  if (!ast) return out || {};
  if (!out) out = {};
  if (ast.kind === 'object' && ast.fields) {
    for (var key in ast.fields) out[key] = true;
  } else if (ast.kind === 'ternary') {
    _styleExprCollectKeys(ast.whenTrue, out);
    _styleExprCollectKeys(ast.whenFalse, out);
  }
  return out;
}

function _styleExprResolveField(ast, key, baseSpec) {
  if (!ast) return baseSpec;
  if (ast.kind === 'object') {
    return ast.fields && ast.fields[key] ? ast.fields[key] : baseSpec;
  }
  if (ast.kind === 'ternary') {
    return {
      kind: 'conditional',
      condExpr: ast.condExpr,
      whenTrue: _styleExprResolveField(ast.whenTrue, key, baseSpec),
      whenFalse: _styleExprResolveField(ast.whenFalse, key, baseSpec),
    };
  }
  return baseSpec;
}
