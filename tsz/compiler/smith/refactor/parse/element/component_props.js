// ── JSX component call prop collection ────────────────────────────

function collectComponentPropValues(c) {
  const propValues = {};
  while (c.kind() !== TK.gt && c.kind() !== TK.slash_gt && c.kind() !== TK.eof) {
    if (tryParseComponentPropSpread(c, propValues)) {
      continue;
    }
    if (c.kind() === TK.identifier) {
      const attr = c.text();
      c.advance();
      if (c.kind() === TK.equals) {
        c.advance();
        if (c.kind() === TK.string) {
          propValues[attr] = c.text().slice(1, -1);
          c.advance();
        } else if (tryParseComponentHandlerProp(c, attr, propValues)) {
          continue;
        } else if (tryParseComponentBraceProp(c, attr, propValues)) {
          continue;
        }
      }
    } else {
      c.advance();
    }
  }
  return propValues;
}
