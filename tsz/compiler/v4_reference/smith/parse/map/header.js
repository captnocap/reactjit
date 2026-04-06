// ── Map header parsing ────────────────────────────────────────────

function tryParseMapHeader(c, defaultItemParam, defaultIndexParam) {
  const saved = c.save();
  c.advance(); // skip array or field identifier
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
  // Skip .slice(...), .filter(...), .sort(...) chaining before .map()
  while ((c.isIdent('slice') || c.isIdent('filter') || c.isIdent('sort')) && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
    c.advance(); c.advance(); // skip 'filter/slice/sort' '('
    var pd = 1;
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

  // Handle function keyword: .map(function(item, idx) { ... })
  if (c.isIdent('function')) {
    c.advance(); // skip 'function'
  }

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
  // Handle function body: { var x = ...; return ( <JSX> ) }
  if (c.kind() === TK.lbrace) {
    c.advance(); // skip {
    // Skip var/const/let declarations before return, collecting as render locals
    while (c.kind() !== TK.eof && (c.isIdent('var') || c.isIdent('const') || c.isIdent('let'))) {
      c.advance(); // skip var/const/let
      if (c.kind() === TK.identifier) {
        var _mapVarName = c.text();
        c.advance(); // skip name
        if (c.kind() === TK.equals) {
          c.advance(); // skip =
          // Consume value tokens up to semicolon (prevents leaking as text)
          // Don't store as render local — JS expressions can't compile to Zig
          var _mvDepth = 0;
          while (c.pos < c.count) {
            if (c.kind() === TK.semicolon && _mvDepth === 0) { c.advance(); break; }
            if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) _mvDepth++;
            if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) { _mvDepth--; if (_mvDepth < 0) break; }
            c.advance();
          }
        }
      }
    }
    if (c.isIdent('return')) c.advance(); // skip return
  }
  if (c.kind() === TK.lparen) c.advance(); // skip ( before JSX

  return { itemParam, indexParam };
}
