// ── Child parsing: element-like branches ──────────────────────────

function tryParseElementChild(c, children) {
  if (c.kind() !== TK.lt) return false;

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
