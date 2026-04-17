// ── Ternary branch parser (from attrs.js) ──

function parseTernaryBranch(c, key) {
  const hasParen = c.kind() === TK.lparen;
  if (hasParen) c.advance();
  const val = parseStyleValue(c);
  const truthyCond = function(v) {
    const expr = (v && (v.zigExpr || v.value)) || '0';
    const exprType = (v && (v.exprType || v.fieldType || v.type)) || 'number';
    if (exprType === 'bool') return expr;
    if (exprType === 'string') return `${expr}.len > 0`;
    return `${expr} != 0`;
  };
  // Check for nested ternary: val == N ? ... : ...
  if ((c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) && val.zigExpr) {
    const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
    c.advance();
    if ((op === '==' || op === '!=') && c.kind() === TK.equals) c.advance();
    let rhs = '';
    let rhsIsString = false;
    if (c.kind() === TK.number) { rhs = c.text(); c.advance(); }
    else if (c.kind() === TK.string) { rhs = c.text().slice(1, -1); c.advance(); rhsIsString = true; }
    else if (c.kind() === TK.identifier) {
      const n = c.text(); c.advance();
      if (isGetter(n)) { rhs = slotGet(n); }
      else if (ctx.currentMap && n === ctx.currentMap.indexParam) { rhs = '@as(i64, @intCast(_i))'; }
      else if (ctx.currentMap && n === ctx.currentMap.itemParam && c.kind() === TK.dot) {
        c.advance(); if (c.kind() === TK.identifier) { let field = c.text(); c.advance();
          // Multi-level dot access: item.config.theme.bg → config_theme_bg
          while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) { c.advance(); field += '_' + c.text(); c.advance(); }
          const oa = ctx.currentMap.oa;
          if (oa) { const fi = oa.fields.find(f => f.name === field); if (fi) { rhs = fi.type === 'string' ? `_oa${oa.oaIdx}_${field}[_i][0.._oa${oa.oaIdx}_${field}_lens[_i]]` : `_oa${oa.oaIdx}_${field}[_i]`; if (fi.type === 'string') rhsIsString = true; } else { rhs = `_oa${oa.oaIdx}_${field}[_i]`; } } else { rhs = n + '.' + field; }
        }
      }
      else if (ctx.propStack && ctx.propStack[n] !== undefined) { rhs = ctx.propStack[n]; }
      else { rhs = n; }
    }
    if (c.kind() === TK.question) {
      c.advance();
      const tv = parseTernaryBranch(c, key);
      if (c.kind() === TK.colon) c.advance();
      const fv = parseTernaryBranch(c, key);
      if (hasParen && c.kind() === TK.rparen) c.advance();
      var cond = resolveComparison(val.zigExpr, op, rhs, ctx);
      if (colorKeys[key] && tv.type === 'string' && fv.type === 'string') {
        return { type: 'zig_expr', zigExpr: `if (${cond}) ${parseColor(tv.value)} else ${parseColor(fv.value)}` };
      }
      // Nested zig exprs
      const tvExpr = tv.zigExpr || (tv.type === 'string' ? parseColor(tv.value) : tv.value);
      const fvExpr = fv.zigExpr || (fv.type === 'string' ? parseColor(fv.value) : fv.value);
      return { type: 'zig_expr', zigExpr: `if (${cond}) ${tvExpr} else ${fvExpr}` };
    }
  }
  if (c.kind() === TK.question && val.zigExpr) {
    c.advance();
    const tv = parseTernaryBranch(c, key);
    if (c.kind() === TK.colon) c.advance();
    const fv = parseTernaryBranch(c, key);
    if (hasParen && c.kind() === TK.rparen) c.advance();
    const cond = truthyCond(val);
    if (colorKeys[key] && tv.type === 'string' && fv.type === 'string') {
      return { type: 'zig_expr', zigExpr: `if (${cond}) ${parseColor(tv.value)} else ${parseColor(fv.value)}` };
    }
    const tvExpr = tv.zigExpr || (tv.type === 'string' ? parseColor(tv.value) : tv.type === 'number' ? `@as(f32, ${tv.value})` : tv.value);
    const fvExpr = fv.zigExpr || (fv.type === 'string' ? parseColor(fv.value) : fv.type === 'number' ? `@as(f32, ${fv.value})` : fv.value);
    return { type: 'zig_expr', zigExpr: `if (${cond}) ${tvExpr} else ${fvExpr}` };
  }
  if (hasParen && c.kind() === TK.rparen) c.advance();
  return val;
}
