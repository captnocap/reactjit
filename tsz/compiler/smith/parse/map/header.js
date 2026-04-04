// ── Map header parsing ────────────────────────────────────────────

function readMapParamList(c, defaultItemParam, defaultIndexParam) {
  let itemParam = defaultItemParam;
  let indexParam = defaultIndexParam;
  let destructuredAliases = null;

  if (c.kind() === TK.lbracket) {
    destructuredAliases = [];
    c.advance(); // skip [
    while (c.pos < c.count && c.kind() !== TK.rbracket) {
      if (c.kind() === TK.identifier) destructuredAliases.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rbracket) c.advance();
  } else if (c.kind() === TK.identifier) {
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

  return { itemParam, indexParam, destructuredAliases };
}

function tryParseMapHeader(c, defaultItemParam, defaultIndexParam) {
  const saved = c.save();
  c.advance(); // skip array or field identifier
  if (c.kind() !== TK.dot) { c.restore(saved); return null; }
  c.advance(); // skip .
  // Skip .slice(...), .filter(...), .sort(...) chaining before .map()
  // Capture filter conditions for display toggle compilation
  var filterConditions = [];
  while ((c.isIdent('slice') || c.isIdent('filter') || c.isIdent('sort')) && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
    var chainMethod = c.text();
    c.advance(); c.advance(); // skip method name and (

    if (chainMethod === 'filter') {
      // Parse: (param) => condition  OR  function(param) { return condition; }
      var filterParam = 'item';
      if (c.kind() === TK.lparen) c.advance(); // skip (
      if (c.kind() === TK.identifier) { filterParam = c.text(); c.advance(); }
      if (c.kind() === TK.rparen) c.advance(); // skip )
      if (c.kind() === TK.arrow) c.advance(); // skip =>
      // Collect raw condition text until balanced closing )
      var condParts = [];
      var fd = 0;
      while (c.pos < c.count) {
        if (c.kind() === TK.rparen && fd === 0) break;
        if (c.kind() === TK.lparen) fd++;
        if (c.kind() === TK.rparen) fd--;
        condParts.push(c.text());
        c.advance();
      }
      filterConditions.push({ param: filterParam, raw: condParts.join(' ') });
    } else {
      // slice/sort — skip body
      var pd = 1;
      while (c.pos < c.count && pd > 0) {
        if (c.kind() === TK.lparen) pd++;
        if (c.kind() === TK.rparen) pd--;
        if (pd > 0) c.advance();
      }
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

  const params = readMapParamList(c, defaultItemParam, defaultIndexParam);
  let itemParam = params.itemParam;
  let indexParam = params.indexParam;

  if (c.kind() === TK.rparen) c.advance(); // skip )
  if (c.kind() === TK.arrow) c.advance(); // skip =>
  // Handle function body: scan to the top-level return and ignore body details.
  if (c.kind() === TK.lbrace) {
    c.advance(); // skip {
    var bodyDepth = 1;
    while (c.pos < c.count && bodyDepth > 0) {
      if (bodyDepth === 1 && c.isIdent('return')) {
        c.advance();
        break;
      }
      if (c.kind() === TK.lbrace) bodyDepth++;
      else if (c.kind() === TK.rbrace) bodyDepth--;
      c.advance();
    }
  }
  if (c.kind() === TK.lparen) c.advance(); // skip ( before JSX

  return { itemParam, indexParam, destructuredAliases: params.destructuredAliases, filterConditions };
}

function tryParseMapHeaderFromMethod(c, defaultItemParam, defaultIndexParam) {
  const saved = c.save();
  if (!c.isIdent('map')) { c.restore(saved); return null; }
  c.advance(); // skip map
  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  if (c.isIdent('function')) c.advance();

  if (c.kind() !== TK.lparen) { c.restore(saved); return null; }
  c.advance(); // skip (

  const params = readMapParamList(c, defaultItemParam, defaultIndexParam);
  let itemParam = params.itemParam;
  let indexParam = params.indexParam;

  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.arrow) c.advance();
  if (c.kind() === TK.lbrace) {
    c.advance();
    var bodyDepth = 1;
    while (c.pos < c.count && bodyDepth > 0) {
      if (bodyDepth === 1 && c.isIdent('return')) {
        c.advance();
        break;
      }
      if (c.kind() === TK.lbrace) bodyDepth++;
      else if (c.kind() === TK.rbrace) bodyDepth--;
      c.advance();
    }
  }
  if (c.kind() === TK.lparen) c.advance();

  return { itemParam, indexParam, destructuredAliases: params.destructuredAliases, filterConditions: [] };
}
