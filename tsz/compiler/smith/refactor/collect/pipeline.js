// ── Collection pipeline ──────────────────────────────────────────

function collectCompilerInputs(c) {
  collectScript(c);
  collectComponents(c);
  collectState(c);
  collectConstArrays(c);
  collectClassifiers();
  collectVariantNames();
}

function collectVariantNames() {
  for (var clsKey in ctx.classifiers) {
    var def = ctx.classifiers[clsKey];
    if (def.variants) {
      for (var vn of Object.keys(def.variants)) {
        if (ctx.variantNames.indexOf(vn) === -1) ctx.variantNames.push(vn);
      }
    }
  }
}

function collectRenderLocals(c, appStart) {
  ctx.renderLocals = {};
  const saved = c.save();
  c.pos = appStart;
  while (c.pos < c.count && c.kind() !== TK.lbrace) c.advance();
  if (c.kind() === TK.lbrace) c.advance();
  while (c.pos < c.count) {
    if (c.isIdent('return')) break;
    if (c.isIdent('const') || c.isIdent('let')) {
      c.advance();
      if (c.kind() === TK.lbracket) {
        let depth = 1;
        c.advance();
        while (c.pos < c.count && depth > 0) {
          if (c.kind() === TK.lbracket) depth++;
          if (c.kind() === TK.rbracket) depth--;
          c.advance();
        }
        while (c.pos < c.count && c.kind() !== TK.rparen && !c.isIdent('const') && !c.isIdent('let') && !c.isIdent('return')) c.advance();
        if (c.kind() === TK.rparen) c.advance();
        continue;
      }
      if (c.kind() === TK.identifier) {
        const varName = c.text();
        c.advance();
        if (c.kind() === TK.equals) {
          c.advance();
          let valParts = [];
          let depth = 0;
          while (c.pos < c.count) {
            if (c.kind() === TK.semicolon && depth === 0) {
              c.advance();
              break;
            }
            if (depth === 0 && c.kind() === TK.identifier && (c.text() === 'const' || c.text() === 'let' || c.text() === 'return' || c.text() === 'function')) break;
            if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
            if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
              depth--;
              if (depth < 0) break;
            }
            if (c.kind() === TK.identifier && ctx.renderLocals[c.text()] !== undefined) {
              valParts.push(ctx.renderLocals[c.text()]);
            } else if (c.kind() === TK.identifier && isGetter(c.text())) {
              valParts.push(slotGet(c.text()));
            } else if (c.kind() === TK.star || c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.slash || c.kind() === TK.percent) {
              valParts.push(' ' + c.text() + ' ');
            } else {
              valParts.push(c.text());
            }
            c.advance();
          }
          const valStr = valParts.join('');
          if (!valStr.includes('useState')) ctx.renderLocals[varName] = valStr;
        }
      }
      continue;
    }
    c.advance();
  }
  c.restore(saved);
}
