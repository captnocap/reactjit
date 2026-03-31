// ── JSX parser ──

function resolveTag(name) { return htmlTags[name] || name; }

function parseJSXElement(c) {
  if (c.kind() !== TK.lt) return { nodeExpr: '.{}' };
  c.advance(); // <

  const fragmentNode = tryParseFragmentElement(c);
  if (fragmentNode) return fragmentNode;

  let rawTag = c.text();
  c.advance();
  // Handle <3D...> — lexer tokenizes "3" (number) + "D" (identifier)
  if (rawTag === '3' && c.kind() === TK.identifier && c.text() === 'D') {
    rawTag = '3D';
    c.advance();
  }

  if (rawTag === 'script') return skipScriptElement(c);

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
  const tagSrcOffset = c.starts[c.pos > 0 ? c.pos - 1 : 0];

  let elementState = initElementParseState(rawTag, tag);
  const attrState = {
    styleFields: elementState.styleFields,
    nodeFields: elementState.nodeFields,
    ascriptScript: elementState.ascriptScript,
    ascriptOnResult: elementState.ascriptOnResult,
    handlerRef: elementState.handlerRef,
  };
  const effectiveTag = elementState.effectiveTag;

  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        parseElementAttr(c, attr, rawTag, attrState);
      }
    } else { c.advance(); }
  }

  finalizeElementAttrState(rawTag, clsDef, clsName, attrState);

  return finishParsedElement(
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



// Parse <Glyph d="..." fill="#color" fillEffect="name" /> inside <Text>
// Returns a glyph marker child node or null
function parseInlineGlyph(c) {
  if (c.kind() !== TK.lt) return null;
  c.advance(); // skip <
  if (c.text() !== 'Glyph') return null;
  c.advance(); // skip Glyph
  let d = '', fill = '#ffffff', fillEffect = '', stroke = '', strokeWidth = '0', scale = '1.0';
  while (c.kind() === TK.identifier && c.kind() !== TK.eof) {
    const aname = c.text(); c.advance();
    if (c.kind() !== TK.equals) continue;
    c.advance(); // skip =
    let aval = '';
    if (c.kind() === TK.string) { aval = c.text().slice(1, -1); c.advance(); }
    else if (c.kind() === TK.lbrace) { c.advance(); if (c.kind() === TK.identifier || c.kind() === TK.number) { aval = c.text(); c.advance(); } if (c.kind() === TK.rbrace) c.advance(); }
    else { aval = c.text(); c.advance(); }
    if (aname === 'd') d = aval;
    else if (aname === 'fill') fill = aval;
    else if (aname === 'fillEffect') fillEffect = aval;
    else if (aname === 'stroke') stroke = aval;
    else if (aname === 'strokeWidth') strokeWidth = aval;
    else if (aname === 'scale') scale = aval;
  }
  // Skip /> or >
  if (c.kind() === TK.slash_gt) c.advance();
  else if (c.kind() === TK.gt) c.advance();
  const fillColor = fill.startsWith('#') ? parseColor(fill) : 'Color.rgb(255, 255, 255)';
  const strokeColor = stroke ? (stroke.startsWith('#') ? parseColor(stroke) : 'Color.rgba(0, 0, 0, 0)') : 'Color.rgba(0, 0, 0, 0)';
  const fillEffectStr = fillEffect ? `, .fill_effect = "${fillEffect}"` : '';
  const glyphExpr = `.{ .d = "${d}", .fill = ${fillColor}, .stroke = ${strokeColor}, .stroke_width = ${strokeWidth}, .scale = ${scale}${fillEffectStr} }`;
  return { nodeExpr: '.{ .text = "\\x01" }', isGlyph: true, glyphExpr };
}
