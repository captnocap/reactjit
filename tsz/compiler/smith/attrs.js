// ── Color parser ──

function parseColor(hex) {
  if (namedColors[hex]) {
    const [r,g,b] = namedColors[hex];
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 6) {
    return `Color.rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`;
  }
  if (h.length === 3) {
    return `Color.rgb(${parseInt(h[0],16)*17}, ${parseInt(h[1],16)*17}, ${parseInt(h[2],16)*17})`;
  }
  return 'Color.rgb(255, 255, 255)';
}

// ── Style parser ──

function parseStyleValue(c) {
  if (c.kind() === TK.string) {
    const raw = c.text(); c.advance();
    return { type: 'string', value: raw.slice(1, -1) };
  }
  if (c.kind() === TK.number) {
    const val = c.text(); c.advance();
    return { type: 'number', value: val };
  }
  if (c.kind() === TK.minus && c.pos + 1 < c.count && c.kindAt(c.pos+1) === TK.number) {
    c.advance(); const val = '-' + c.text(); c.advance();
    return { type: 'number', value: val };
  }
  if (c.kind() === TK.identifier) {
    const name = c.text();
    if (isGetter(name)) {
      c.advance();
      return { type: 'state', value: name, zigExpr: slotGet(name) };
    }
    // Prop reference
    if (ctx.propStack[name] !== undefined) {
      c.advance();
      return { type: 'number', value: ctx.propStack[name] };
    }
  }
  c.advance();
  return { type: 'unknown', value: '' };
}

function parseStyleBlock(c) {
  const fields = [];
  if (c.kind() === TK.lbrace) c.advance();
  if (c.kind() === TK.lbrace) c.advance();
  while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
    if (c.kind() === TK.identifier || c.kind() === TK.string) {
      let key = c.text();
      if (c.kind() === TK.string) key = key.slice(1, -1);
      c.advance();
      if (c.kind() === TK.colon) c.advance();
      const val = parseStyleValue(c);
      if (colorKeys[key] && val.type === 'string') {
        fields.push(`.${colorKeys[key]} = ${parseColor(val.value)}`);
      } else if (styleKeys[key]) {
        if (val.type === 'state') {
          // Dynamic style — placeholder 0, update at runtime
          fields.push(`.${styleKeys[key]} = 0`);
          if (!ctx.dynStyles) ctx.dynStyles = [];
          ctx.dynStyles.push({ field: styleKeys[key], expression: `@floatFromInt(${val.zigExpr})` });
        } else if (val.type === 'string' && val.value.endsWith('%')) {
          const pct = parseFloat(val.value);
          fields.push(`.${styleKeys[key]} = ${pct === 100 ? -1 : pct / 100}`);
        } else if (val.type === 'number') {
          fields.push(`.${styleKeys[key]} = ${val.value}`);
        }
      } else if (enumKeys[key]) {
        const e = enumKeys[key];
        if (val.type === 'string' && e.values[val.value]) {
          fields.push(`.${e.field} = ${e.values[val.value]}`);
        }
      }
      if (c.kind() === TK.comma) c.advance();
    } else { c.advance(); }
  }
  if (c.kind() === TK.rbrace) c.advance();
  if (c.kind() === TK.rbrace) c.advance();
  return fields;
}

// ── Handler parser ──

function findSlot(name) {
  for (let i = 0; i < ctx.stateSlots.length; i++) {
    if (ctx.stateSlots[i].getter === name || ctx.stateSlots[i].setter === name) return i;
  }
  return -1;
}

function isGetter(name) {
  return ctx.stateSlots.some(s => s.getter === name);
}

function isSetter(name) {
  return ctx.stateSlots.some(s => s.setter === name);
}

function slotGet(name) {
  const i = findSlot(name);
  if (i < 0) return name;
  const s = ctx.stateSlots[i];
  if (s.type === 'string') return `state.getSlotString(${i})`;
  if (s.type === 'float') return `state.getSlotFloat(${i})`;
  if (s.type === 'boolean') return `state.getSlotBool(${i})`;
  return `state.getSlot(${i})`;
}

function slotSet(slotIdx) {
  const s = ctx.stateSlots[slotIdx];
  if (s.type === 'float') return `state.setSlotFloat`;
  if (s.type === 'boolean') return `state.setSlotBool`;
  return `state.setSlot`;
}

// Parse a handler expression: () => setCount(expr)
// Returns the Zig body as a string
function parseHandler(c) {
  // Skip () =>
  if (c.kind() === TK.lparen) c.advance();
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.arrow) c.advance();

  // Parse body — could be { stmts } or single expression
  let body = '';
  if (c.kind() === TK.lbrace) {
    // Block body: { stmt; stmt; stmt; }
    c.advance();
    let body = '';
    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier && isSetter(c.text())) {
        const setter = c.text();
        const slotIdx = findSlot(setter);
        c.advance();
        if (c.kind() === TK.lparen) {
          c.advance();
          const valExpr = parseValueExpr(c);
          const needsParens = valExpr.includes(' + ') || valExpr.includes(' - ') || valExpr.includes(' * ') || valExpr.includes(' / ') || valExpr.includes(' ? ');
          const wrapped = needsParens ? `(${valExpr})` : valExpr;
          body += `    ${slotSet(slotIdx)}(${slotIdx}, ${wrapped});\n`;
          if (c.kind() === TK.rparen) c.advance();
        }
      }
      if (c.kind() === TK.semicolon) c.advance();
      else if (c.kind() !== TK.rbrace) c.advance();
    }
    if (c.kind() === TK.rbrace) c.advance();
    return body;
  }

  // Single expression: setCount(expr)
  if (c.kind() === TK.identifier && isSetter(c.text())) {
    const setter = c.text();
    const slotIdx = findSlot(setter);
    c.advance();
    if (c.kind() === TK.lparen) {
      c.advance();
      // Parse the value expression until matching )
      const valExpr = parseValueExpr(c);
      // Only wrap in parens if expression has operators
      const needsParens = valExpr.includes(' + ') || valExpr.includes(' - ') || valExpr.includes(' * ') || valExpr.includes(' / ');
      const wrapped = needsParens ? `(${valExpr})` : valExpr;
      body = `    ${slotSet(slotIdx)}(${slotIdx}, ${wrapped});\n`;
      if (c.kind() === TK.rparen) c.advance();
    }
  }
  return body;
}

// Parse a value expression (inside setter call) until ) at depth 0
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
      if (isGetter(name)) {
        parts.push(slotGet(name));
      } else {
        parts.push(name);
      }
      c.advance(); continue;
    }
    if (c.kind() === TK.number) { parts.push(c.text()); c.advance(); continue; }
    if (c.kind() === TK.plus) { parts.push(' + '); c.advance(); continue; }
    if (c.kind() === TK.minus) { parts.push(' - '); c.advance(); continue; }
    if (c.kind() === TK.star) { parts.push(' * '); c.advance(); continue; }
    if (c.kind() === TK.slash) { parts.push(' / '); c.advance(); continue; }
    if (c.kind() === TK.percent) { parts.push(' % '); c.advance(); continue; }
    if (c.kind() === TK.eq_eq) { parts.push(' == '); c.advance(); continue; }
    if (c.kind() === TK.not_eq) { parts.push(' != '); c.advance(); continue; }
    if (c.kind() === TK.question) {
      // Ternary: cond ? trueVal : falseVal → if (cond) @as(i32, trueVal) else @as(i32, falseVal)
      c.advance();
      const trueVal = parseValueExpr(c); // reads until : at depth 0
      // : already consumed by parseValueExpr stopping, or we need to skip it
      if (c.kind() === TK.colon) c.advance();
      const falseVal = parseValueExpr(c); // reads until ) at depth 0
      const cond = parts.join('');
      parts.length = 0;
      parts.push(`if ((${cond})) @as(i32, ${trueVal}) else @as(i32, ${falseVal})`);
      continue;
    }
    if (c.kind() === TK.colon) break; // stop for ternary false branch
    if (c.kind() === TK.string) {
      const s = c.text(); c.advance();
      parts.push(s); continue;
    }
    // Default: skip
    parts.push(c.text());
    c.advance();
  }
  return parts.join('');
}

