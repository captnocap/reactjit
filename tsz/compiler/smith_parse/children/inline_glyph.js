// ── Child parsing: inline glyphs inside <Text> ───────────────────

function readInlineGlyphAttrValue(c) {
  if (c.kind() === TK.string) {
    const value = c.text().slice(1, -1);
    c.advance();
    return value;
  }
  if (c.kind() === TK.lbrace) {
    c.advance();
    var value = '';
    if (c.kind() === TK.identifier || c.kind() === TK.number) {
      value = c.text();
      c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    return value;
  }
  const fallback = c.text();
  c.advance();
  return fallback;
}

function parseInlineGlyph(c) {
  if (c.kind() !== TK.lt) return null;
  c.advance();
  if (c.text() !== 'Glyph') return null;
  c.advance();

  let d = '';
  let fill = '#ffffff';
  let fillEffect = '';
  let stroke = '';
  let strokeWidth = '0';
  let scale = '1.0';

  while (c.kind() === TK.identifier && c.kind() !== TK.eof) {
    const attrName = c.text();
    c.advance();
    if (c.kind() !== TK.equals) continue;
    c.advance();
    const attrValue = readInlineGlyphAttrValue(c);
    if (attrName === 'd') d = attrValue;
    else if (attrName === 'fill') fill = attrValue;
    else if (attrName === 'fillEffect') fillEffect = attrValue;
    else if (attrName === 'stroke') stroke = attrValue;
    else if (attrName === 'strokeWidth') strokeWidth = attrValue;
    else if (attrName === 'scale') scale = attrValue;
  }

  if (c.kind() === TK.slash_gt) c.advance();
  else if (c.kind() === TK.gt) c.advance();

  const fillColor = fill.startsWith('#') ? parseColor(fill) : 'Color.rgb(255, 255, 255)';
  const strokeColor = stroke
    ? (stroke.startsWith('#') ? parseColor(stroke) : 'Color.rgba(0, 0, 0, 0)')
    : 'Color.rgba(0, 0, 0, 0)';
  const fillEffectStr = fillEffect ? `, .fill_effect = "${fillEffect}"` : '';
  const glyphExpr = `.{ .d = "${d}", .fill = ${fillColor}, .stroke = ${strokeColor}, .stroke_width = ${strokeWidth}, .scale = ${scale}${fillEffectStr} }`;
  return { nodeExpr: '.{ .text = "\\x01" }', isGlyph: true, glyphExpr };
}
