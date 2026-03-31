// ── JSX element flow helpers ──────────────────────────────────────

function tryParseFragmentElement(c) {
  if (c.kind() !== TK.gt) return null;

  const fragOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];
  c.advance();
  const children = parseChildren(c);
  if (c.kind() === TK.lt_slash) {
    c.advance();
    if (c.kind() === TK.gt) c.advance();
  }
  return buildNode('Box', [], children, null, null, '>', fragOffset);
}

function skipScriptElement(c) {
  if (c.kind() === TK.gt) c.advance();
  while (c.pos < c.count) {
    if (c.kind() === TK.lt_slash && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier && c.textAt(c.pos + 1) === 'script') {
      c.advance();
      c.advance();
      if (c.kind() === TK.gt) c.advance();
      break;
    }
    c.advance();
  }
  return { nodeExpr: '.{}' };
}

function finishParsedElement(c, rawTag, effectiveTag, styleFields, children, handlerRef, nodeFields, clsDef, tagSrcOffset) {
  if (c.kind() === TK.slash_gt) {
    c.advance();
    return buildNode(effectiveTag, styleFields, [], handlerRef, nodeFields, effectiveTag, tagSrcOffset);
  }
  if (c.kind() === TK.gt) c.advance();

  const parsedChildren = children || parseChildren(c);

  if (c.kind() === TK.lt_slash) {
    c.advance();
    const closingFull = readQualifiedClosingTag(c);
    if (c.kind() === TK.gt) c.advance();
    if (globalThis.__SMITH_DEBUG_INLINE && ctx.inlineComponent === 'SourcePage') {
      const openTag = clsDef ? ('C.' + (rawTag === 'Box' ? 'SourceSurface' : rawTag)) : rawTag;
      if (closingFull !== openTag && closingFull !== 'C.' + rawTag) {
        globalThis.__dbg = globalThis.__dbg || [];
        globalThis.__dbg.push('[TAG_MISMATCH] open=' + rawTag + ' close=' + closingFull + ' pos=' + c.pos + ' children=' + parsedChildren.length);
      }
    }
  } else if (globalThis.__SMITH_DEBUG_INLINE && ctx.inlineComponent === 'SourcePage') {
    globalThis.__dbg = globalThis.__dbg || [];
    globalThis.__dbg.push('[NO_CLOSE] tag=' + rawTag + ' pos=' + c.pos + ' kind=' + c.kind() + ' text=' + (c.pos < c.count ? c.text().substring(0, 30) : 'EOF') + ' children=' + parsedChildren.length);
  }

  return buildNode(effectiveTag, styleFields, parsedChildren, handlerRef, nodeFields, effectiveTag, tagSrcOffset);
}
