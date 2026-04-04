function _tryParseStoredRenderLocal(c, children, varName) {
  const rawExpr = ctx._renderLocalRaw && ctx._renderLocalRaw[varName];
  const span = ctx._renderLocalSpan && ctx._renderLocalSpan[varName];
  if (!rawExpr || !span) return false;
  if (rawExpr.indexOf('.map(') < 0 && rawExpr.indexOf('<') < 0) return false;

  const originalPos = c.save();
  let condExpr = null;
  let payloadStart = span.start;
  const lastAnd = _findLastTopLevelAmpAmp(c, span.start, span.end);
  if (lastAnd >= 0) {
    const condJs = _joinTokenText(c, span.start, lastAnd).trim();
    if (condJs.length > 0) condExpr = _makeEvalTruthyExpr(condJs);
    payloadStart = lastAnd + 1;
  }

  c.pos = payloadStart;
  let wrapped = false;
  if (c.kind() === TK.lparen) {
    wrapped = true;
    c.advance();
  }

  let parsed = null;
  if (c.kind() === TK.identifier) {
    const tmpChildren = [];
    if (_tryParseIdentifierMapExpression(c, tmpChildren, false) && tmpChildren.length > 0) parsed = tmpChildren[0];
  }
  if (!parsed && c.kind() === TK.lt) {
    parsed = parseJSXElement(c);
  }
  if (!parsed) {
    c.restore(originalPos);
    return false;
  }
  if (wrapped && c.kind() === TK.rparen) c.advance();

  c.restore(originalPos);
  c.advance();
  if (c.kind() === TK.rbrace) c.advance();

  if (condExpr) {
    const condIdx = ctx.conditionals.length;
    ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
    const wrappedNode = Object.assign({}, parsed);
    wrappedNode.condIdx = condIdx;
    children.push(wrappedNode);
  } else {
    children.push(parsed);
  }
  return true;
}
