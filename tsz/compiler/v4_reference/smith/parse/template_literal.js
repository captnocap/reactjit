// ── Template literal parsing ──────────────────────────────────────

function parseTemplateLiteral(raw) {
  // Split "text ${expr} more ${expr2}" into fmt string + args
  let fmt = '';
  const args = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
      // Find matching }
      let j = i + 2;
      let depth = 1;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{') depth++;
        if (raw[j] === '}') depth--;
        j++;
      }
      const expr = raw.slice(i + 2, j - 1).trim();
      // Determine format specifier based on expression type
      const slotIdx = findSlot(expr);
      if (slotIdx >= 0) {
        const slot = ctx.stateSlots[slotIdx];
        fmt += slot.type === 'string' ? '{s}' : '{d}';
        args.push(slotGet(expr));
      } else if (expr.endsWith('.length')) {
        // Array .length → OA _len variable
        const arrName = expr.slice(0, -7);
        const oa = ctx.objectArrays.find(function(o) { return o.getter === arrName; });
        if (oa) {
          fmt += '{d}';
          args.push(`@as(i64, @intCast(_oa${oa.oaIdx}_len))`);
        } else {
          fmt += expr;
        }
      } else if (/^(\w+)\s*([+\-*\/])\s*(.+)$/.test(expr)) {
        // Arithmetic expression: getter + N, getter - 1, getter + getter + getter, etc.
        // Resolve ALL state getter identifiers in the expression
        const resolveArithExpr = (e) => {
          return e.replace(/\b(\w+)\b/g, (w) => {
            const si = findSlot(w);
            if (si >= 0) return slotGet(w);
            if (ctx.currentMap && w === ctx.currentMap.indexParam) {
              return '@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))';
            }
            return w;
          });
        };
        const m = expr.match(/^(\w+)\s*([+\-*\/])\s*(.+)$/);
        const lhsSlot = findSlot(m[1]);
        if (lhsSlot >= 0 || (ctx.currentMap && m[1] === ctx.currentMap.indexParam)) {
          const resolved = resolveArithExpr(expr);
          fmt += '{d}';
          if (m[2] === '/' && !m[3].includes('+') && !m[3].includes('-')) {
            args.push(`@divTrunc(${resolveArithExpr(m[1])}, ${resolveArithExpr(m[3].trim())})`);
          } else if (m[2] === '%' && !m[3].includes('+') && !m[3].includes('-')) {
            args.push(`@mod(${resolveArithExpr(m[1])}, ${resolveArithExpr(m[3].trim())})`);
          } else {
            args.push(resolved);
          }
        } else {
          fmt += expr;
        }
      } else if (ctx.renderLocals && ctx.renderLocals[expr] !== undefined) {
        // Render-local variable substitution in template literal
        const rlVal = ctx.renderLocals[expr];
        const isNum = /^-?\d+(\.\d+)?$/.test(rlVal);
        const isZigExpr = rlVal.includes('state.get') || rlVal.includes('getSlot') || rlVal.includes('_oa') || rlVal.includes('@as');
        if (isNum) {
          fmt += '{d}';
          args.push(rlVal);
        } else if (isZigExpr) {
          fmt += '{d}';
          args.push(leftFoldExpr(rlVal));
        } else {
          fmt += rlVal;
        }
      } else if (ctx.propStack[expr] !== undefined) {
        // Prop substitution — use the concrete prop value
        const propVal = ctx.propStack[expr];
        const isNum = /^-?\d+(\.\d+)?$/.test(propVal);
        const isZigExpr = propVal.includes('state.get') || propVal.includes('getSlot') || propVal.includes('_oa') || propVal.includes('@as');
        const isStringArray = isZigExpr && propVal.includes('[') && propVal.includes('..');
        if (isNum) {
          fmt += '{d}';
          args.push(propVal);
        } else if (isStringArray) {
          // String array slice: _oaN_field[_i][0.._oaN_field_lens[_i]]
          fmt += '{s}';
          args.push(propVal);
        } else if (isZigExpr) {
          // Other Zig expressions (OA integer fields, state getters)
          fmt += '{d}';
          args.push(leftFoldExpr(propVal));
        } else {
          // Plain string literal
          fmt += '{s}';
          args.push(`"${propVal}"`);
        }
      } else if (ctx.currentMap && expr === ctx.currentMap.indexParam) {
        // Map index: use iterVar so inline inner maps use _j, outer maps use _i
        const iv = ctx.currentMap.iterVar || '_i';
        fmt += '{d}';
        args.push('@as(i64, @intCast(' + iv + '))');
      } else if (ctx.currentMap && ctx.currentMap.parentMap && expr === ctx.currentMap.parentMap.indexParam) {
        // Parent map index parameter: ${parent_idx} → outer loop variable (inline: _i)
        const piv = ctx.currentMap.parentMap.iterVar || '_i';
        fmt += '{d}';
        args.push('@as(i64, @intCast(' + piv + '))');
      } else if (ctx.currentMap && expr.startsWith(ctx.currentMap.itemParam + '.')) {
        // Map item member access: ${item.field} → {s}/{d} with OA field ref
        const field = expr.slice(ctx.currentMap.itemParam.length + 1);
        const oa = ctx.currentMap.oa;
        const fi = oa.fields.find(f => f.name === field);
        const iv = ctx.currentMap.iterVar || '_i';
        if (fi) {
          const oaIdx = oa.oaIdx;
          if (fi.type === 'string') {
            fmt += '{s}';
            args.push(`_oa${oaIdx}_${field}[${iv}][0.._oa${oaIdx}_${field}_lens[${iv}]]`);
          } else {
            fmt += '{d}';
            args.push(`_oa${oaIdx}_${field}[${iv}]`);
          }
        } else {
          fmt += expr;
        }
      } else if (expr.includes('?') && expr.includes(':')) {
        // Ternary expression in template literal
        const parseTernaryExpr = (e) => {
          const qIdx = e.indexOf('?');
          if (qIdx < 0) return { isLiteral: true, value: e.trim() };
          const condStr = e.slice(0, qIdx).trim();
          const rest = e.slice(qIdx + 1);
          let depth = 0;
          let colonIdx = -1;
          for (let ci = 0; ci < rest.length; ci++) {
            if (rest[ci] === '?') depth++;
            else if (rest[ci] === ':') {
              if (depth === 0) {
                colonIdx = ci;
                break;
              }
              depth--;
            }
          }
          if (colonIdx < 0) return { isLiteral: true, value: e.trim() };
          let trueStr = rest.slice(0, colonIdx).trim();
          let falseStr = rest.slice(colonIdx + 1).trim();
          const stripQ = (s) => (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")) ? s.slice(1, -1) : null;
          let condZig = condStr;
          for (const s of ctx.stateSlots) {
            if (condStr.includes(s.getter)) {
              condZig = condZig.replace(new RegExp('\\b' + s.getter + '\\b', 'g'), slotGet(s.getter));
            }
          }
          condZig = condZig.replace(/===/g, '==').replace(/!==/g, '!=');
          const tv = stripQ(trueStr);
          const fv = stripQ(falseStr);
          if (tv !== null && fv !== null) {
            return { isLiteral: false, zigExpr: `if (${condZig}) "${tv}" else "${fv}"`, spec: '{s}' };
          }
          const fvParsed = parseTernaryExpr(falseStr);
          if (tv !== null && !fvParsed.isLiteral) {
            return { isLiteral: false, zigExpr: `if (${condZig}) "${tv}" else ${fvParsed.zigExpr}`, spec: '{s}' };
          }
          if (/^-?\d+$/.test(trueStr) && /^-?\d+$/.test(falseStr)) {
            return { isLiteral: false, zigExpr: `if (${condZig}) @as(i64, ${trueStr}) else @as(i64, ${falseStr})`, spec: '{d}' };
          }
          return { isLiteral: true, value: e.trim() };
        };
        const result = parseTernaryExpr(expr);
        if (!result.isLiteral) {
          fmt += result.spec;
          args.push(result.zigExpr);
        } else {
          fmt += result.value;
        }
      } else {
        // Non-resolvable arithmetic/complex expression — embed as literal text
        fmt += expr;
      }
      i = j;
    } else {
      fmt += raw[i] === '"' ? '\\"' : raw[i];
      i++;
    }
  }
  return { fmt, args };
}
