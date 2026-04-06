// ── JSX parser ──

function parseJSXElement(c) {
  if (c.kind() !== TK.lt) return { nodeExpr: '.{}' };
  c.advance(); // <

  const fragmentNode = tryParseFragmentElement(c);
  if (fragmentNode) return fragmentNode;

  let rawTag = readTagToken(c);

  if (rawTag === 'script') return skipScriptElement(c);
  if (rawTag === 'lscript') return skipLScriptElement(c);

  const normalizedTag = normalizeRawTag(c, rawTag);
  rawTag = normalizedTag.rawTag;
  let clsDef = normalizedTag.clsDef;
  let clsName = normalizedTag.clsName;

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
    const propValues = collectComponentPropValues(c);
    const compChildren = parseComponentCallChildren(c);
    return inlineComponentCall(c, comp, rawTag, propValues, compChildren);
  }

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
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        parseElementAttr(c, attr, rawTag, attrState);
      } else if (attr === 'l') {
        // Bare `l` prop — literal text mode, skip glyph resolution
        hasLiteralProp = true;
      }
    } else { c.advance(); }
  }
  attrState._literalText = hasLiteralProp;

  finalizeElementAttrState(rawTag, clsDef, clsName, attrState);

  // Set literal text mode for children if `l` prop is present
  var prevLiteral = ctx._literalTextMode;
  if (attrState._literalText) ctx._literalTextMode = true;

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

  ctx._literalTextMode = prevLiteral;
  return result;
}

function parseChildren(c) {
  const children = [];
  while (c.kind() !== TK.lt_slash && c.kind() !== TK.eof) {
    if (tryParseElementChild(c, children)) continue;
    if (tryParseBraceChild(c, children)) continue;
    if (tryParseTextChild(c, children)) continue;
  }
  return children;
}
