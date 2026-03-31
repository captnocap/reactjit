// ── Shared JSX attr value readers ────────────────────────────────

function parseSignedNumberToken(c) {
  let neg = '';
  if (c.kind() === TK.minus) {
    neg = '-';
    c.advance();
  }
  if (c.kind() !== TK.number) return null;

  const value = neg + c.text();
  c.advance();
  return value;
}

function parseVectorValueToken(c, allowExpressions) {
  let neg = '';
  if (c.kind() === TK.minus) {
    neg = '-';
    c.advance();
  }

  if (c.kind() === TK.number) {
    const value = neg + c.text();
    c.advance();
    return value;
  }

  if (allowExpressions && c.kind() === TK.identifier) {
    let expr = neg + c.text();
    c.advance();
    while (c.kind() !== TK.comma && c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
      expr += ' ' + c.text();
      c.advance();
    }
    return expr;
  }

  return null;
}

function parseBracketVectorValues(c, allowExpressions) {
  const vals = [];
  while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
    const value = parseVectorValueToken(c, allowExpressions);
    if (value !== null) vals.push(value);
    else c.advance();
    if (c.kind() === TK.comma) c.advance();
  }
  return vals;
}

function parseBracedVectorValues(c, allowExpressions) {
  if (c.kind() !== TK.lbrace) return null;

  c.advance();
  if (c.kind() !== TK.lbracket) {
    if (c.kind() === TK.rbrace) c.advance();
    return null;
  }

  c.advance();
  const vals = parseBracketVectorValues(c, allowExpressions);
  if (c.kind() === TK.rbracket) c.advance();
  if (c.kind() === TK.rbrace) c.advance();
  return vals;
}

function parseNumericAttrValue(c, signed) {
  if (c.kind() === TK.lbrace) {
    c.advance();
    const value = signed
      ? parseSignedNumberToken(c)
      : (c.kind() === TK.number ? c.text() : null);
    if (!signed && c.kind() === TK.number) c.advance();
    if (c.kind() === TK.rbrace) c.advance();
    return value;
  }

  if (signed) return parseSignedNumberToken(c);
  if (c.kind() !== TK.number) return null;

  const value = c.text();
  c.advance();
  return value;
}

function pushAxisFields(fields, prefix, suffixes, values) {
  for (let i = 0; i < suffixes.length; i++) {
    if (values[i]) fields.push(`.${prefix}_${suffixes[i]} = ${values[i]}`);
  }
}

function pushUniformAxisFields(fields, prefix, suffixes, value) {
  for (const suffix of suffixes) {
    fields.push(`.${prefix}_${suffix} = ${value}`);
  }
}
