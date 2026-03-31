// ── OA inference fallback ─────────────────────────────────────────
// If collectState missed an array, re-scan source to find and register it.

function inferOaFromSource(c, name) {
  const saved = c.save();
  c.pos = 0;
  const setter = 'set' + name[0].toUpperCase() + name.slice(1);
  while (c.pos < c.count) {
    if (c.kind() === TK.identifier && c.text() === name) {
      c.advance();
      // Scan forward (max 20 tokens) looking for [{
      let limit = 20;
      while (limit-- > 0 && c.pos < c.count) {
        if (c.kind() === TK.lbracket) {
          c.advance();
          if (c.kind() === TK.lbrace) {
            c.advance(); // skip {
            const fields = [];
            while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
              if (c.kind() === TK.identifier) {
                const fname = c.text();
                c.advance();
                if (c.kind() === TK.colon) c.advance();
                let ftype = 'int';
                if (c.kind() === TK.string) {
                  ftype = 'string';
                  c.advance();
                } else if (c.kind() === TK.number) {
                  const nv = c.text();
                  ftype = nv.startsWith('0x') ? 'int' : (nv.includes('.') ? 'float' : 'int');
                  c.advance();
                } else if (c.isIdent('true') || c.isIdent('false')) {
                  ftype = 'boolean';
                  c.advance();
                }
                fields.push({ name: fname, type: ftype });
              }
              if (c.kind() === TK.comma) c.advance();
              else if (c.kind() !== TK.rbrace) c.advance();
            }
            if (fields.length > 0) {
              const oaIdx = ctx.objectArrays.length;
              const oa = { fields, getter: name, setter, oaIdx };
              ctx.objectArrays.push(oa);
              c.restore(saved);
              return oa;
            }
          }
          break;
        }
        c.advance();
      }
    }
    c.advance();
  }
  c.restore(saved);
  return null;
}
