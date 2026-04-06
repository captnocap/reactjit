// ── JSX element attr dispatch ────────────────────────────────────

function parseElementAttr(c, attr, rawTag, state) {
  if (attr === 'style') {
    const inlineStyles = parseStyleBlock(c);
    const preInjected = state.styleFields.filter(f => !inlineStyles.some(s => s.split(' = ')[0] === f.split(' = ')[0]));
    state.styleFields = preInjected.concat(inlineStyles);
    if (inlineStyles._dynStyleIds) state.styleFields._dynStyleIds = inlineStyles._dynStyleIds;
    if (inlineStyles._dynStyleId !== undefined) state.styleFields._dynStyleId = inlineStyles._dynStyleId;
    // Hoist Text node fields (fontSize, color) from style block to node level
    if (inlineStyles._nodeFields) {
      for (var nfi = 0; nfi < inlineStyles._nodeFields.length; nfi++) {
        state.nodeFields.push(inlineStyles._nodeFields[nfi]);
      }
    }
    return;
  }

  const handlerAttrResult = tryParseElementHandlerAttr(c, attr, rawTag, state.nodeFields, state.handlerRef);
  if (handlerAttrResult) {
    state.handlerRef = handlerAttrResult.handlerRef;
    return;
  }

  const basicAttrResult = tryParseBasicElementAttr(c, attr, rawTag, state.nodeFields, {
    ascriptScript: state.ascriptScript,
    ascriptOnResult: state.ascriptOnResult,
  });
  if (basicAttrResult) {
    state.ascriptScript = basicAttrResult.ascriptScript;
    state.ascriptOnResult = basicAttrResult.ascriptOnResult;
    return;
  }

  if (tryParseTextColorAttr(c, attr, state.nodeFields)) return;
  if (tryParseCanvasAttr(c, attr, rawTag, state.nodeFields)) return;
  if (tryParseSpatialAttr(c, attr, rawTag, state.styleFields, state.nodeFields)) return;

  if (attr === 'color' && rawTag.startsWith('3D.')) {
    if (c.kind() === TK.string) {
      const hex = c.text().slice(1, -1).replace('#', '');
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      state.nodeFields.push(`.scene3d_color_r = ${r.toFixed(3)}`);
      state.nodeFields.push(`.scene3d_color_g = ${g.toFixed(3)}`);
      state.nodeFields.push(`.scene3d_color_b = ${b.toFixed(3)}`);
      c.advance();
    } else if (c.kind() === TK.lbrace) {
      skipBraces(c);
    }
    return;
  }

  if (attr === 'color' && rawTag.startsWith('Physics.')) {
    if (c.kind() === TK.string) {
      const value = c.text().slice(1, -1);
      state.styleFields.push(`.background_color = ${parseColor(value)}`);
      c.advance();
    } else if (c.kind() === TK.lbrace) {
      skipBraces(c);
    }
    return;
  }

  if (attr === 'bold') {
    state.nodeFields.push('.bold = true');
    return;
  }

  if (attr === 'd' || attr === 'fill' || attr === 'fillEffect' || attr === 'stroke' || attr === 'strokeWidth' || attr === 'scale') {
    if (c.kind() === TK.string) c.advance();
    else if (c.kind() === TK.lbrace) skipBraces(c);
    else if (c.kind() === TK.number) c.advance();
    return;
  }

  if (c.kind() === TK.string) c.advance();
  else if (c.kind() === TK.lbrace) skipBraces(c);
}
