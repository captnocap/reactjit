// ── Render-local collection ──────────────────────────────────────

function skipRenderLocalDestructure(c) {
  var depth = 1;
  c.advance();
  while (c.pos < c.count && depth > 0) {
    if (c.kind() === TK.lbracket) depth++;
    if (c.kind() === TK.rbracket) depth--;
    c.advance();
  }
  while (c.pos < c.count &&
         c.kind() !== TK.rparen &&
         !c.isIdent('const') &&
         !c.isIdent('let') &&
         !c.isIdent('return')) {
    c.advance();
  }
  if (c.kind() === TK.rparen) c.advance();
}

function appendRenderLocalToken(c, valParts) {
  if (c.kind() === TK.identifier && ctx.renderLocals[c.text()] !== undefined) {
    valParts.push(ctx.renderLocals[c.text()]);
    return true;
  }
  if (c.kind() === TK.identifier && isGetter(c.text())) {
    valParts.push(slotGet(c.text()));
    return true;
  }
  if (c.kind() === TK.eq_eq) {
    c.advance();
    if (c.kind() === TK.equals) c.advance();
    if (c.kind() === TK.string) {
      const lhs = valParts.join('');
      const rhs = c.text().slice(1, -1);
      valParts.length = 0;
      valParts.push('std.mem.eql(u8, ' + lhs + ', "' + rhs + '")');
    } else {
      valParts.push(' == ');
      return false;
    }
    return true;
  }
  if (c.kind() === TK.not_eq) {
    c.advance();
    if (c.kind() === TK.equals) c.advance();
    if (c.kind() === TK.string) {
      const lhs = valParts.join('');
      const rhs = c.text().slice(1, -1);
      valParts.length = 0;
      valParts.push('!std.mem.eql(u8, ' + lhs + ', "' + rhs + '")');
    } else {
      valParts.push(' != ');
      return false;
    }
    return true;
  }
  if (c.kind() === TK.star || c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.slash || c.kind() === TK.percent) {
    valParts.push(' ' + c.text() + ' ');
    return true;
  }
  if (c.kind() === TK.string) {
    valParts.push('"' + c.text().slice(1, -1) + '"');
    return true;
  }
  valParts.push(c.text());
  return true;
}

function readRenderLocalValue(c) {
  var valParts = [];
  var depth = 0;
  while (c.pos < c.count) {
    if (c.kind() === TK.semicolon && depth === 0) {
      c.advance();
      break;
    }
    if (depth === 0 &&
        c.kind() === TK.identifier &&
        (c.text() === 'const' || c.text() === 'let' || c.text() === 'return' || c.text() === 'function')) {
      break;
    }
    if (c.kind() === TK.lparen || c.kind() === TK.lbracket || c.kind() === TK.lbrace) depth++;
    if (c.kind() === TK.rparen || c.kind() === TK.rbracket || c.kind() === TK.rbrace) {
      depth--;
      if (depth < 0) break;
    }
    if (!appendRenderLocalToken(c, valParts)) continue;
    c.advance();
  }
  return valParts.join('');
}

function collectRenderLocals(c, appStart) {
  ctx.renderLocals = {};
  const saved = c.save();
  c.pos = appStart;
  while (c.pos < c.count && c.kind() !== TK.lbrace) c.advance();
  if (c.kind() === TK.lbrace) c.advance();
  if (!ctx._useEffectBodies) ctx._useEffectBodies = [];
  while (c.pos < c.count) {
    if (c.isIdent('return')) break;
    // useEffect(() => { ... }) — collect body as init-time JS
    if (c.isIdent('useEffect')) {
      c.advance();
      if (c.kind() === TK.lparen) {
        c.advance();
        // Skip () =>
        if (c.kind() === TK.lparen) { c.advance(); if (c.kind() === TK.rparen) c.advance(); }
        if (c.kind() === TK.arrow) c.advance();
        if (c.kind() === TK.lbrace) {
          c.advance();
          var parts = [];
          var depth = 0;
          while (c.kind() !== TK.eof) {
            if (c.kind() === TK.rbrace && depth === 0) { c.advance(); break; }
            if (c.kind() === TK.lbrace) depth++;
            if (c.kind() === TK.rbrace) depth--;
            parts.push(c.text());
            if (c.kind() === TK.semicolon) parts.push(' ');
            c.advance();
          }
          if (parts.length > 0) ctx._useEffectBodies.push(parts.join(''));
        }
        // Skip closing )
        if (c.kind() === TK.rparen) c.advance();
        // Skip optional ;
        if (c.kind() === TK.semicolon) c.advance();
      }
      continue;
    }
    if (c.isIdent('const') || c.isIdent('let') || c.isIdent('var')) {
      c.advance();
      if (c.kind() === TK.lbracket) {
        skipRenderLocalDestructure(c);
        continue;
      }
      if (c.kind() === TK.identifier) {
        const varName = c.text();
        c.advance();
        if (c.kind() === TK.equals) {
          c.advance();
          // Skip if this is a registered const OA (handled by object array system)
          var _isConstOa = false;
          for (var _coi = 0; _coi < ctx.objectArrays.length; _coi++) {
            if (ctx.objectArrays[_coi].getter === varName && ctx.objectArrays[_coi].isConst) { _isConstOa = true; break; }
          }
          if (!_isConstOa) {
            const valStr = readRenderLocalValue(c);
            if (!valStr.includes('useState')) ctx.renderLocals[varName] = valStr;
          }
        }
      }
      continue;
    }
    c.advance();
  }
  c.restore(saved);
}
