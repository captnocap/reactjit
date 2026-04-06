// ── Child parsing: element-like branches ──────────────────────────

function tryParseElementChild(c, children) {
  if (c.kind() !== TK.lt) return false;

  if (c.pos + 1 < c.count) {
    var nextTag = c.textAt(c.pos + 1);

    if (nextTag === 'if') {
      return parseIfBlock(c, children);
    }

    if (nextTag === 'during') {
      return parseDuringBlock(c, children);
    }

    if (nextTag === 'else') {
      return parseElseBlock(c, children);
    }
  }

  // <varName page /> — dynamic page selector: render state value as text
  if (c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.identifier &&
      c.kindAt(c.pos + 2) === TK.identifier && c.textAt(c.pos + 2) === 'page') {
    var pageVarName = c.textAt(c.pos + 1);
    if (isGetter(pageVarName)) {
      var pageSlotIdx = findSlot(pageVarName);
      var pageSlot = pageSlotIdx >= 0 ? ctx.stateSlots[pageSlotIdx] : null;
      c.advance(); // skip <
      c.advance(); // skip varName
      c.advance(); // skip 'page'
      if (c.kind() === TK.slash_gt) c.advance(); // skip />
      else if (c.kind() === TK.gt) c.advance(); // skip >
      // Emit dynamic text node showing the current page name
      var pageBufId = ctx.dynCount;
      var pageFmt = pageSlot && pageSlot.type === 'string' ? '{s}' : '{d}';
      var pageBufSize = pageSlot && pageSlot.type === 'string' ? 128 : 64;
      ctx.dynTexts.push({ bufId: pageBufId, fmtString: pageFmt, fmtArgs: slotGet(pageVarName), arrName: '', arrIndex: 0, bufSize: pageBufSize });
      ctx.dynCount++;
      children.push({ nodeExpr: '.{ .text = "" }', dynBufId: pageBufId });
      return true;
    }
  }

  if (c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'For') {
    const forResult = parseForLoop(c);
    if (forResult) {
      children.push(forResult);
      return true;
    }
  }

  if (c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'Glyph') {
    const glyph = parseInlineGlyph(c);
    if (glyph) {
      children.push(glyph);
      return true;
    }
  }

  children.push(parseJSXElement(c));
  return true;
}
