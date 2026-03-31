// ── Map header parsing ────────────────────────────────────────────

function tryParseMapHeader(c, defaultItemParam, defaultIndexParam) {
  const saved = c.save();
  c.advance(); // skip array or field identifier
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
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
