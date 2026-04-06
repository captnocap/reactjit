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

  // Skip 'function' keyword so pushInlinePressHandler sees (params)
  if (c.kind() === TK.identifier && c.text() === 'function') c.advance();
  const handlerName = `_handler_press_${ctx.handlerCount}`;
  pushInlinePressHandler(c, handlerName);
  ctx.handlerCount++;
  if (c.kind() === TK.rbrace) c.advance();
  propValues[attr] = handlerName;
  return true;
}

function isPressLikeComponentAttr(attr) {
  // Match any on + uppercase pattern (onPress, onToggleChat, onSelectItem, etc.)
  return attr.length > 2 && attr[0] === 'o' && attr[1] === 'n' && attr[2] >= 'A' && attr[2] <= 'Z';
}

function startsArrowHandler(c) {
  // Arrow function: (params) => { ... }
  if (c.kind() === TK.lparen) {
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
  // function keyword: function(params) { ... }
  if (c.kind() === TK.identifier && c.text() === 'function') return true;
  return false;
}
