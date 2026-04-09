// ── Value expression parser (from attrs.js) ──

function parseValueExpr(c) {
  let parts = [];
  let depth = 0;
  while (c.kind() !== TK.eof) {
    if (c.kind() === TK.lparen) { depth++; parts.push('('); c.advance(); continue; }
    if (c.kind() === TK.rparen) {
      if (depth === 0) break;
      depth--; parts.push(')'); c.advance(); continue;
    }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      // Const OA row ref + .field (from prop or render local)
      var _pvRef = (ctx.propStack && ctx.propStack[name]) || (ctx.renderLocals && ctx.renderLocals[name]);
      if (typeof _pvRef === 'string' && _pvRef.charCodeAt(0) === 1 &&
          c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
        var _vfld = resolveConstOaFieldFromRef(_pvRef, c.textAt(c.pos + 2));
        if (_vfld !== null) {
          if (_vfld.charAt(0) === '"' && _vfld.charAt(_vfld.length - 1) === '"') _vfld = _vfld.slice(1, -1);
          parts.push(_vfld);
          c.advance(); c.advance(); c.advance(); continue;
        }
      }
      // Object state field access
      var _osRef = tryResolveObjectStateAccess(c);
      if (_osRef) { parts.push(_osRef); continue; }
      if (isGetter(name)) {
        parts.push(slotGet(name));
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        parts.push('0');
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        const pv = ctx.propStack[name];
        parts.push(/^-?\d+(\.\d+)?$/.test(pv) ? pv : '0');
      } else {
        // Unknown identifier (e.g. handler closure param) — emit 0 for valid Zig
        // The JS handler body provides the actual runtime behavior
        parts.push('0');
      }
      c.advance(); continue;
    }
    if (c.kind() === TK.number) { parts.push(c.text()); c.advance(); continue; }
    if (c.kind() === TK.plus) { parts.push(' + '); c.advance(); continue; }
    if (c.kind() === TK.minus) { parts.push(' - '); c.advance(); continue; }
    if (c.kind() === TK.star) { parts.push(' * '); c.advance(); continue; }
    if (c.kind() === TK.slash) { parts.push(' / '); c.advance(); continue; }
    if (c.kind() === TK.percent) { parts.push(' % '); c.advance(); continue; }
    if (c.kind() === TK.eq_eq) { parts.push(' == '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    if (c.kind() === TK.not_eq) { parts.push(' != '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    if (c.kind() === TK.gt) { parts.push(' > '); c.advance(); continue; }
    if (c.kind() === TK.lt) { parts.push(' < '); c.advance(); continue; }
    if (c.kind() === TK.gt_eq) { parts.push(' >= '); c.advance(); continue; }
    if (c.kind() === TK.lt_eq) { parts.push(' <= '); c.advance(); continue; }
    if (c.kind() === TK.question) {
      // Ternary: cond ? trueVal : falseVal → if ((cond)) (trueVal) else @as(i32, falseVal)
      c.advance();
      const trueVal = parseValueExpr(c); // reads until : at depth 0
      if (c.kind() === TK.colon) c.advance();
      const falseVal = parseValueExpr(c); // reads until ) at depth 0
      const cond = parts.join('');
      parts.length = 0;
      const hasOps = trueVal.includes(' + ') || trueVal.includes(' - ') || trueVal.includes(' * ') || trueVal.includes(' / ');
      const wrappedTrue = hasOps ? `(${trueVal})` : `@as(i32, ${trueVal})`;
      parts.push(`if ((${cond})) ${wrappedTrue} else @as(i32, ${falseVal})`);
      continue;
    }
    if (c.kind() === TK.colon) break; // stop for ternary false branch
    if (c.kind() === TK.string) {
      let s = c.text(); c.advance();
      // Convert single-quoted JS strings to double-quoted Zig strings
      if (s.startsWith("'") && s.endsWith("'")) {
        s = '"' + s.slice(1, -1).replace(/"/g, '\\"') + '"';
      }
      parts.push(s); continue;
    }
    // Default: skip
    parts.push(c.text());
    c.advance();
  }
  return parts.join('');
}
