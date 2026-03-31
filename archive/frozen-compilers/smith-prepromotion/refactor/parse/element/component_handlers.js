// ── JSX component prop handler helpers ───────────────────────────

function tryParseComponentHandlerProp(c, attr, propValues) {
  if (isPressLikeComponentAttr(attr) && c.kind() === TK.lbrace) {
    c.advance();
    const handlerName = `_handler_press_${ctx.handlerCount}`;
    const boundHandlerRef = bindPressHandlerExpression(c, handlerName);
    if (boundHandlerRef === handlerName) ctx.handlerCount++;
    propValues[attr] = boundHandlerRef;
    return true;
  }

  if (c.kind() !== TK.lbrace) return false;

  const saved = c.save();
  c.advance();
  if (!startsArrowHandler(c)) {
    c.restore(saved);
    return false;
  }

  const handlerName = `_handler_press_${ctx.handlerCount}`;
  pushInlinePressHandler(c, handlerName);
  ctx.handlerCount++;
  if (c.kind() === TK.rbrace) c.advance();
  propValues[attr] = handlerName;
  return true;
}

function isPressLikeComponentAttr(attr) {
  return attr === 'onPress' || attr === 'onTap' || attr === 'onToggle' || attr === 'onSelect' || attr === 'onChange';
}

function startsArrowHandler(c) {
  if (c.kind() !== TK.lparen) return false;

  let lookahead = c.pos;
  let parenDepth = 1;
  lookahead++;
  while (lookahead < c.count && parenDepth > 0) {
    if (c.kindAt(lookahead) === TK.lparen) parenDepth++;
    if (c.kindAt(lookahead) === TK.rparen) parenDepth--;
    lookahead++;
  }
  return lookahead < c.count && c.kindAt(lookahead) === TK.arrow;
}
