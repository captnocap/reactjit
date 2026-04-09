// ── Lua value expression parser (from attrs.js) ──

function luaParseValueExpr(c) {
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
      // Map item member access: item.field → item.field (Lua table access)
      if (ctx.currentMap && name === ctx.currentMap.itemParam) {
        parts.push(name);
        c.advance();
        // Check for .field
        if (c.kind() === TK.dot) {
          parts.push('.');
          c.advance();
          if (c.kind() === TK.identifier) {
            parts.push(c.text());
            c.advance();
          }
        }
        continue;
      }
      if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        parts.push(name); // raw index variable name
        c.advance(); continue;
      }
      // Resolve props, then raw variable names (with instance name remap)
      if (ctx.propStack && ctx.propStack[name] !== undefined) {
        const pv = ctx.propStack[name];
        // Zig expressions (@as, @intCast, _i) must not leak into Lua/JS handler bodies
        // Map index props → use raw index variable name; other Zig → use '0' fallback
        if (pv.includes('@') || pv === '_i') {
          parts.push(ctx.currentMap ? ctx.currentMap.indexParam : '0');
        } else if (pv === 'ci' || pv === '_j' || (ctx.currentMap && ctx.currentMap.parentMap && pv === ctx.currentMap.parentMap.indexParam)) {
          // Outer map index variable leaked as prop — keep raw name
          parts.push(pv);
        } else if (/^-?\d+(\.\d+)?$/.test(pv) || /^0x[0-9a-fA-F]+$/.test(pv)) {
          // Numeric prop — push as-is
          parts.push(pv);
        } else if (pv.startsWith("'") || pv.startsWith('"')) {
          // Already quoted — push as-is
          parts.push(pv);
        } else {
          // String prop value — quote it for valid JS/Lua
          parts.push("'" + pv.replace(/'/g, "\\'") + "'");
        }
      } else {
        parts.push((ctx.nameRemap && ctx.nameRemap[name]) || name);
      }
      c.advance(); continue;
    }
    if (c.kind() === TK.number) { parts.push(c.text()); c.advance(); continue; }
    if (c.kind() === TK.plus) {
      // Use Lua concat (..) if any part is a string literal
      const hasStr = parts.some(p => (p.startsWith("'") || p.startsWith('"')) && p.length > 1);
      parts.push(hasStr ? ' .. ' : ' + ');
      c.advance(); continue;
    }
    if (c.kind() === TK.minus) { parts.push(' - '); c.advance(); continue; }
    if (c.kind() === TK.star) { parts.push(' * '); c.advance(); continue; }
    if (c.kind() === TK.slash) { parts.push(' / '); c.advance(); continue; }
    if (c.kind() === TK.percent) { parts.push(' % '); c.advance(); continue; }
    if (c.kind() === TK.eq_eq) { parts.push(' == '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    if (c.kind() === TK.not_eq) { parts.push(' ~= '); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    if (c.kind() === TK.gt) { parts.push(' > '); c.advance(); continue; }
    if (c.kind() === TK.lt) { parts.push(' < '); c.advance(); continue; }
    if (c.kind() === TK.gt_eq) { parts.push(' >= '); c.advance(); continue; }
    if (c.kind() === TK.lt_eq) { parts.push(' <= '); c.advance(); continue; }
    if (c.kind() === TK.question) {
      // Ternary: cond ? trueVal : falseVal → (cond) and trueVal or falseVal
      c.advance();
      const trueVal = luaParseValueExpr(c);
      if (c.kind() === TK.colon) c.advance();
      const falseVal = luaParseValueExpr(c);
      const cond = parts.join('');
      parts.length = 0;
      parts.push(`(${cond}) and ${trueVal} or ${falseVal}`);
      continue;
    }
    if (c.kind() === TK.colon) break;
    if (c.kind() === TK.dot) { parts.push('.'); c.advance(); continue; }
    if (c.kind() === TK.string) {
      // Convert JS string to Lua string: "foo" or 'foo' → 'foo'
      const s = c.text();
      const inner = s.slice(1, -1);
      parts.push(`'${inner}'`);
      c.advance(); continue;
    }
    parts.push(c.text());
    c.advance();
  }
  return parts.join('');
}
