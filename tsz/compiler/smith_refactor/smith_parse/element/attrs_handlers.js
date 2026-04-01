// ── JSX element callback attribute helpers ───────────────────────

function tryParseElementHandlerAttr(c, attr, rawTag, nodeFields, currentHandlerRef) {
  if (attr === 'onPress' || attr === 'onTap' || attr === 'onToggle' || attr === 'onSelect' || attr === 'onChange') {
    return { handlerRef: parseElementPressAttr(c, currentHandlerRef) };
  }

  if (attr === 'onRender') {
    parseElementRenderAttr(c, nodeFields);
    return { handlerRef: currentHandlerRef };
  }

  if ((attr === 'onSubmit' || attr === 'onChangeText') && (rawTag === 'TextInput' || rawTag === 'TextArea')) {
    parseTextInputHandlerAttr(c, attr);
    return { handlerRef: currentHandlerRef };
  }

  return null;
}

function parseElementPressAttr(c, currentHandlerRef) {
  if (c.kind() === TK.identifier && c.kindAt(c.pos + 1) !== TK.dot) {
    const fname = c.text();
    c.advance();
    if (isScriptFunc(fname) || isSetter(fname)) {
      const handlerRef = `_handler_press_${ctx.handlerCount}`;
      pushBarePressHandler(handlerRef, fname);
      ctx.handlerCount++;
      return handlerRef;
    }
    return currentHandlerRef;
  }

  if (c.kind() === TK.lbrace) {
    c.advance();
    const handlerRef = `_handler_press_${ctx.handlerCount}`;
    const boundHandlerRef = bindPressHandlerExpression(c, handlerRef);
    if (boundHandlerRef === handlerRef) ctx.handlerCount++;
    return boundHandlerRef;
  }

  return currentHandlerRef;
}

function parseElementRenderAttr(c, nodeFields) {
  if (c.kind() !== TK.lbrace) return;

  c.advance();
  let effectParam = 'e';
  if (c.kind() === TK.lparen) {
    c.advance();
    if (c.kind() === TK.identifier) {
      effectParam = c.text();
      c.advance();
    }
    if (c.kind() === TK.rparen) c.advance();
  }
  if (c.kind() === TK.arrow) c.advance();

  if (c.kind() === TK.lbrace) {
    const bodyStart = c.starts[c.pos];
    let depth = 1;
    c.advance();
    while (depth > 0 && c.kind() !== TK.eof) {
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) depth--;
      if (depth > 0) c.advance();
    }
    const bodyEnd = c.starts[c.pos];
    const bodySource = c._byteSlice(bodyStart + 1, bodyEnd).trim();
    if (c.kind() === TK.rbrace) c.advance();
    if (c.kind() === TK.rbrace) c.advance();

    if (!ctx.effectRenders) ctx.effectRenders = [];
    const effectId = ctx.effectRenders.length;
    ctx.effectRenders.push({ id: effectId, param: effectParam, body: bodySource });
    nodeFields.push(`.effect_render = _effect_render_${effectId}`);
    return;
  }

  skipBraces(c);
}

function parseTextInputHandlerAttr(c, attr) {
  if (c.kind() !== TK.lbrace) return;

  c.advance();
  if (c.kind() === TK.lparen) c.advance();
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.arrow) c.advance();

  let jsBody = '';
  if (c.kind() === TK.lbrace) {
    c.advance();
    let depth = 1;
    while (depth > 0 && c.kind() !== TK.eof) {
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) {
        depth--;
        if (depth === 0) break;
      }
      jsBody += c.text() + ' ';
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
  } else {
    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
      jsBody += c.text() + ' ';
      c.advance();
    }
  }

  jsBody = jsBody.trim().replace(/\s*;\s*$/, '').replace(/\s+/g, ' ');
  if (jsBody.length > 0) {
    const list = attr === 'onSubmit' ? '_inputSubmitHandlers' : '_inputChangeHandlers';
    if (!ctx[list]) ctx[list] = [];
    ctx[list].push({ inputId: ctx.inputCount - 1, jsBody });
  }
  if (c.kind() === TK.rbrace) c.advance();
}
