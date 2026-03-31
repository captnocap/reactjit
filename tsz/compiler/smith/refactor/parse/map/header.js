// ── Map header parsing ────────────────────────────────────────────

function tryParseMapHeader(c, defaultItemParam, defaultIndexParam) {
  const saved = c.save();
  c.advance(); // skip array or field identifier
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
  // Skip .slice(...) or .filter(...) chaining before .map()
  if ((c.isIdent('slice') || c.isIdent('filter')) && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
    c.advance(); c.advance(); // skip 'slice' '('
    let pd = 1;
    while (c.pos < c.count && pd > 0) {
      if (c.kind() === TK.lparen) pd++;
      if (c.kind() === TK.rparen) pd--;
      if (pd > 0) c.advance();
    }
    if (c.kind() === TK.rparen) c.advance(); // skip closing )
    if (c.kind() !== TK.dot) { c.restore(saved); return null; }
    c.advance(); // skip .
  }
  if (!c.isIdent('map')) { c.restore(saved); return null; }
  c.advance(); // skip map
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  let itemParam = defaultItemParam;
  let indexParam = defaultIndexParam;
  if (c.kind() === TK.identifier) {
    itemParam = c.text();
    c.advance();
  }
  if (c.kind() === TK.comma) {
    c.advance();
    if (c.kind() === TK.identifier) {
      indexParam = c.text();
      c.advance();
    }
  }

  if (c.kind() === TK.rparen) c.advance(); // skip )
  if (c.kind() === TK.arrow) c.advance(); // skip =>
  if (c.kind() === TK.lparen) c.advance(); // skip ( before JSX

  return { itemParam, indexParam };
}
