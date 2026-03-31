// ── JSX component prop spread helpers ────────────────────────────

function tryParseComponentPropSpread(c, propValues) {
  if (!(c.kind() === TK.lbrace && c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.spread && c.kindAt(c.pos + 2) === TK.identifier)) {
    return false;
  }

  c.advance();
  c.advance();
  const spreadName = c.text();
  c.advance();
  if (c.kind() === TK.rbrace) c.advance();

  if (ctx.currentMap && spreadName === ctx.currentMap.itemParam) {
    const oa = ctx.currentMap.oa;
    for (const field of oa.fields) {
      if (field.type === 'nested_array') continue;
      if (field.type === 'string') {
        propValues[field.name] = `_oa${oa.oaIdx}_${field.name}[_i][0.._oa${oa.oaIdx}_${field.name}_lens[_i]]`;
      } else {
        propValues[field.name] = `_oa${oa.oaIdx}_${field.name}[_i]`;
      }
    }
  }

  return true;
}
