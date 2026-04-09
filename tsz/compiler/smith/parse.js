// ── JSX parser ──

function parseJSXElement(c) {
  if (c.kind() !== TK.lt) return { nodeExpr: '.{}' };
  var _jsxStartPos = c.pos;
  c.advance(); // <

  const fragmentNode = tryParseFragmentElement(c);
  if (fragmentNode) return fragmentNode;

  let rawTag = readTagToken(c);
  const originalRawTag = rawTag;

  if (rawTag === 'script') return skipScriptElement(c);
  if (rawTag === 'lscript') return skipLScriptElement(c);

  const normalizedTag = normalizeRawTag(c, rawTag);
  rawTag = normalizedTag.rawTag;
  let clsDef = normalizedTag.clsDef;
  let clsName = normalizedTag.clsName;
  var displayTag = clsName ? ('C.' + clsName) : originalRawTag;

  if (ctx.inlineComponent && (ctx.inlineComponent === 'TopBar' || ctx.inlineComponent === 'Sidebar' || ctx.inlineComponent === 'MainSurfacePane')) {
    globalThis.__dbg = globalThis.__dbg || [];
    globalThis.__dbg.push('[INLINE_JSX_OPEN] owner=' + ctx.inlineComponent + ' tag=' + displayTag + ' start=' + _jsxStartPos + ' cursor=' + c.pos);
  }

  // Check if this is a component call
  const comp = findComponent(rawTag);
  if (globalThis.__SMITH_DEBUG_INLINE && comp) {
    globalThis.__dbg = globalThis.__dbg || [];
    globalThis.__dbg.push('[INLINE] component=' + rawTag + ' bodyPos=' + comp.bodyPos + ' cursorPos=' + c.pos);
    if (rawTag === 'SourcePage' && !globalThis.__sourcePageDumped) {
      globalThis.__sourcePageDumped = true;
      for (let di = comp.bodyPos; di < Math.min(comp.bodyPos + 15, c.count); di++) {
        globalThis.__dbg.push('[SP_TOK@' + di + '] kind=' + c.kindAt(di) + ' text="' + c.textAt(di).substring(0, 40) + '"');
      }
    }
  }
  if (comp) {
    tracePattern(73, 'direct_component', rawTag);
    const propValues = collectComponentPropValues(c);
    const compChildren = parseComponentCallChildren(c);
    const compResult = inlineComponentCall(c, comp, rawTag, propValues, compChildren);
    if (ctx.inlineComponent && (ctx.inlineComponent === 'TopBar' || ctx.inlineComponent === 'Sidebar' || ctx.inlineComponent === 'MainSurfacePane')) {
      globalThis.__dbg = globalThis.__dbg || [];
      globalThis.__dbg.push('[INLINE_JSX_DONE] owner=' + ctx.inlineComponent + ' tag=' + displayTag + ' end=' + c.pos + ' next=' + (c.pos < c.count ? c.text().substring(0, 24) : 'EOF'));
    }
    return compResult;
  }

  tracePattern(6, 'jsx_element', rawTag);
  const tag = resolveTag(rawTag);
  // Track source position for breadcrumb comments
  const tagSrcOffset = lastTokenOffset(c);

  let elementState = initElementParseState(rawTag, tag);
  const attrState = {
    styleFields: elementState.styleFields,
    nodeFields: elementState.nodeFields,
    ascriptScript: elementState.ascriptScript,
    ascriptOnResult: elementState.ascriptOnResult,
    handlerRef: elementState.handlerRef,
  };
  const effectiveTag = elementState.effectiveTag;

  var hasLiteralProp = false;
  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      var _attrStartPos = c.pos;
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (ctx.inlineComponent && (ctx.inlineComponent === 'TopBar' || ctx.inlineComponent === 'Sidebar' || ctx.inlineComponent === 'MainSurfacePane') && (displayTag === 'C.TopBar' || displayTag === 'C.Sidebar' || displayTag === 'C.Editor')) {
          globalThis.__dbg = globalThis.__dbg || [];
          globalThis.__dbg.push('[ATTR_BEFORE] owner=' + ctx.inlineComponent + ' tag=' + displayTag + ' attr=' + attr + ' start=' + _attrStartPos + ' pos=' + c.pos + ' kind=' + c.kind());
        }
        parseElementAttr(c, attr, rawTag, attrState);
        if (ctx.inlineComponent && (ctx.inlineComponent === 'TopBar' || ctx.inlineComponent === 'Sidebar' || ctx.inlineComponent === 'MainSurfacePane') && (displayTag === 'C.TopBar' || displayTag === 'C.Sidebar' || displayTag === 'C.Editor')) {
          globalThis.__dbg = globalThis.__dbg || [];
          globalThis.__dbg.push('[ATTR_AFTER] owner=' + ctx.inlineComponent + ' tag=' + displayTag + ' attr=' + attr + ' end=' + c.pos + ' kind=' + c.kind() + ' next=' + (c.pos < c.count ? c.text().substring(0, 24) : 'EOF'));
        }
      } else {
        if (attr === 'l') {
          // Bare `l` prop — literal text mode, skip glyph resolution
          hasLiteralProp = true;
        }
        // Bare attrs such as `background`, `bold`, and other flag-like props
        // still need to flow through the normal attr dispatcher.
        parseElementAttr(c, attr, rawTag, attrState);
      }
    } else { c.advance(); }
  }
  attrState._literalText = hasLiteralProp;

  finalizeElementAttrState(rawTag, clsDef, clsName, attrState);

  // Set literal text mode for children if `l` prop is present
  var prevLiteral = ctx._literalTextMode;
  if (attrState._literalText) ctx._literalTextMode = true;

  var _prevDebugParentTag = ctx._debugParentTag;
  if (ctx.inlineComponent && (ctx.inlineComponent === 'TopBar' || ctx.inlineComponent === 'Sidebar' || ctx.inlineComponent === 'MainSurfacePane')) {
    ctx._debugParentTag = displayTag;
  }

  var result = finishParsedElement(
    c,
    rawTag,
    effectiveTag,
    attrState.styleFields,
    null,
    attrState.handlerRef,
    attrState.nodeFields,
    clsDef,
    tagSrcOffset
  );
  ctx._debugParentTag = _prevDebugParentTag;

  if (ctx.inlineComponent && (ctx.inlineComponent === 'TopBar' || ctx.inlineComponent === 'Sidebar' || ctx.inlineComponent === 'MainSurfacePane')) {
    globalThis.__dbg = globalThis.__dbg || [];
    globalThis.__dbg.push('[INLINE_JSX_DONE] owner=' + ctx.inlineComponent + ' tag=' + displayTag + ' end=' + c.pos + ' next=' + (c.pos < c.count ? c.text().substring(0, 24) : 'EOF'));
  }

  ctx._literalTextMode = prevLiteral;
  return result;
}

function parseChildren(c) {
  const children = [];
  traceEnter();
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    var _prePos = c.pos;
    if (ctx.inlineComponent && ctx._debugParentTag &&
        (ctx.inlineComponent === 'TopBar' || ctx.inlineComponent === 'Sidebar' || ctx.inlineComponent === 'MainSurfacePane')) {
      globalThis.__dbg = globalThis.__dbg || [];
      if (!ctx._inlineChildTraceCount) ctx._inlineChildTraceCount = 0;
      if (ctx._inlineChildTraceCount < 80) {
        globalThis.__dbg.push('[CHILD_LOOP] owner=' + ctx.inlineComponent + ' parent=' + ctx._debugParentTag +
          ' pos=' + c.pos + ' kind=' + c.kind() + ' text=' + (c.pos < c.count ? c.text().substring(0, 24) : 'EOF'));
        ctx._inlineChildTraceCount++;
      }
    }
    if (tryParseElementChild(c, children)) continue;
    if (tryParseBraceChild(c, children)) continue;
    if (tryParseChainedExpr(c, children)) continue;
    if (tryParseTextChild(c, children)) continue;
    // If no handler consumed the token, record and skip to avoid infinite loop
    if (c.pos === _prePos) {
      tracePatternFail(c.text(), c.pos, 'parseChildren');
      c.advance();
    }
  }
  traceExit();
  return children;
}
