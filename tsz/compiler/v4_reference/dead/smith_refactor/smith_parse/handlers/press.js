// ── Press-style handler helpers ──────────────────────────────────

function collectHandlerZigProps() {
  const zigProps = {};
  if (!ctx.propStack) return zigProps;

  for (const [pn, pv] of Object.entries(ctx.propStack)) {
    if (typeof pv !== 'string') continue;
    if (pv.includes('@as(') || pv.includes('@intCast') || pv.includes('_oa') || pv.includes('state.get') || pv.includes('getSlot')) {
      zigProps[pn] = pv;
    }
  }
  return zigProps;
}

function pushBarePressHandler(handlerName, fname) {
  ctx.handlers.push({
    name: handlerName,
    body: `    qjs_runtime.callGlobal("${fname}");\n`,
    luaBody: `${fname}()`,
  });
}

function pushNamedPressHandler(handlerName, fname) {
  if (isScriptFunc(fname)) {
    ctx.handlers.push({
      name: handlerName,
      body: `    qjs_runtime.callGlobal("${fname}");\n`,
      luaBody: `${fname}()`,
    });
    return;
  }

  ctx.handlers.push({
    name: handlerName,
    body: `    // ${fname}\n`,
    luaBody: fname,
  });
}

function pushInlinePressHandler(c, handlerName) {
  const saved = c.save();
  const luaBody = luaParseHandler(c);
  c.restore(saved);
  const body = parseHandler(c);
  const isMapHandler = !!ctx.currentMap;
  const closureParams = ctx._lastClosureParams || [];
  ctx.handlers.push({
    name: handlerName,
    body,
    luaBody,
    inMap: isMapHandler,
    mapIdx: isMapHandler ? ctx.maps.indexOf(ctx.currentMap) : -1,
    zigProps: collectHandlerZigProps(),
    closureParams,
  });
}

function tryConsumeForwardedPressHandler(c) {
  const pa = peekPropsAccess(c);
  if (pa && typeof pa.value === 'string' && pa.value.startsWith('_handler_press_')) {
    skipPropsAccess(c);
    if (c.kind() === TK.rbrace) c.advance();
    return pa.value;
  }

  if (
    c.kind() === TK.identifier &&
    ctx.propStack &&
    ctx.propStack[c.text()] !== undefined &&
    typeof ctx.propStack[c.text()] === 'string' &&
    ctx.propStack[c.text()].startsWith('_handler_press_')
  ) {
    const handlerRef = ctx.propStack[c.text()];
    c.advance();
    if (c.kind() === TK.rbrace) c.advance();
    return handlerRef;
  }

  return null;
}

function bindPressHandlerExpression(c, handlerName) {
  const forwardedHandler = tryConsumeForwardedPressHandler(c);
  if (forwardedHandler) return forwardedHandler;

  if (c.kind() === TK.identifier && (isScriptFunc(c.text()) || isSetter(c.text()))) {
    const fname = c.text();
    c.advance();
    pushNamedPressHandler(handlerName, fname);
    if (c.kind() === TK.lparen) {
      c.advance();
      if (c.kind() === TK.rparen) c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    return handlerName;
  }

  // Skip 'function' keyword so pushInlinePressHandler sees (params)
  if (c.kind() === TK.identifier && c.text() === 'function') c.advance();
  pushInlinePressHandler(c, handlerName);
  if (c.kind() === TK.rbrace) c.advance();
  return handlerName;
}
