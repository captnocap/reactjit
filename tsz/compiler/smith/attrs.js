// ── Color parser ──

// theme-* → Catppuccin Mocha defaults (resolved at compile time)
const themeColors = {
  'theme-bg':             [30, 30, 46],
  'theme-bgAlt':          [24, 24, 37],
  'theme-bgElevated':     [49, 50, 68],
  'theme-surface':        [49, 50, 68],
  'theme-surfaceHover':   [69, 71, 90],
  'theme-border':         [69, 71, 90],
  'theme-borderFocus':    [137, 180, 250],
  'theme-text':           [205, 214, 244],
  'theme-textSecondary':  [186, 194, 222],
  'theme-textDim':        [166, 173, 200],
  'theme-primary':        [137, 180, 250],
  'theme-primaryHover':   [116, 199, 236],
  'theme-primaryPressed': [137, 220, 235],
  'theme-accent':         [203, 166, 247],
  'theme-error':          [243, 139, 168],
  'theme-warning':        [250, 179, 135],
  'theme-success':        [166, 227, 161],
  'theme-info':           [137, 220, 235],
};

function parseColor(hex) {
  if (hex === 'transparent') return 'Color.rgba(0, 0, 0, 0)';
  if (themeColors[hex]) {
    const [r,g,b] = themeColors[hex];
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  if (namedColors[hex]) {
    const [r,g,b] = namedColors[hex];
    return `Color.rgb(${r}, ${g}, ${b})`;
  }
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 8) {
    return `Color.rgba(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)}, ${parseInt(h.slice(6,8),16)})`;
  }
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
    // Map item member access: tag.field
    if (ctx.currentMap && name === ctx.currentMap.itemParam) {
      c.advance(); // skip item name
      if (c.kind() === TK.dot) {
        c.advance(); // skip .
        if (c.kind() === TK.identifier) {
          const field = c.text();
          const oa = ctx.currentMap.oa;
          const fi = oa.fields.find(f => f.name === field);
          c.advance();
          if (fi) {
            const oaIdx = oa.oaIdx;
            const zigExpr = fi.type === 'string' ? `_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]` : `_oa${oaIdx}_${field}[_i]`;
            return { type: 'map_field', value: `_oa${oaIdx}_${field}[_i]`, zigExpr, fieldType: fi.type };
          }
        }
      }
      return { type: 'unknown', value: '' };
    }
    // Map index param (i, idx, etc.) — supports ternary/modulo in style blocks
    if (ctx.currentMap && name === ctx.currentMap.indexParam) {
      c.advance();
      return { type: 'map_index', value: name, zigExpr: `@as(i64, @intCast(_i))` };
    }
    // Render-local variable reference
    if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
      c.advance();
      const rlv = ctx.renderLocals[name];
      if (/^-?\d+(\.\d+)?$/.test(rlv)) return { type: 'number', value: rlv };
      if (rlv.startsWith('#') || namedColors[rlv]) return { type: 'string', value: rlv };
      const isZigExpr = rlv.includes('state.get') || rlv.includes('getSlot') || rlv.includes('_oa') || rlv.includes('@as');
      if (isZigExpr) return { type: 'state', value: name, zigExpr: rlv };
      return { type: 'number', value: rlv };
    }
    // Prop reference — detect type from prop value
    if (ctx.propStack[name] !== undefined) {
      c.advance();
      const pv = ctx.propStack[name];
      if (pv.startsWith('#') || namedColors[pv]) return { type: 'string', value: pv };
      return { type: 'number', value: pv };
    }
  }
  c.advance();
  return { type: 'unknown', value: '' };
}

// Parse a ternary branch value — handles parens wrapping nested ternaries
// Returns { type, value } like parseStyleValue, OR { type: 'zig_expr', zigExpr } for nested ternary
function parseTernaryBranch(c, key) {
  const hasParen = c.kind() === TK.lparen;
  if (hasParen) c.advance();
  const val = parseStyleValue(c);
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
        c.advance(); if (c.kind() === TK.identifier) { const field = c.text(); c.advance(); const oa = ctx.currentMap.oa;
          if (oa) { const fi = oa.fields.find(f => f.name === field); if (fi) { rhs = fi.type === 'string' ? `_oa${oa.oaIdx}_${field}[_i][0.._oa${oa.oaIdx}_${field}_lens[_i]]` : `_oa${oa.oaIdx}_${field}[_i]`; if (fi.type === 'string') rhsIsString = true; } else { rhs = n + '.' + field; } } else { rhs = n + '.' + field; }
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
      let cond;
      if (rhsIsString || val.fieldType === 'string') {
        const eql = `std.mem.eql(u8, ${val.zigExpr}, ${rhsIsString && !rhs.startsWith('"') ? rhs : '"' + rhs + '"'})`;
        cond = op === '!=' ? `(!${eql})` : `(${eql})`;
      } else {
        cond = `(${val.zigExpr} ${op} ${rhs})`;
      }
      if (colorKeys[key] && tv.type === 'string' && fv.type === 'string') {
        return { type: 'zig_expr', zigExpr: `if ${cond} ${parseColor(tv.value)} else ${parseColor(fv.value)}` };
      }
      // Nested zig exprs
      const tvExpr = tv.zigExpr || (tv.type === 'string' ? parseColor(tv.value) : tv.value);
      const fvExpr = fv.zigExpr || (fv.type === 'string' ? parseColor(fv.value) : fv.value);
      return { type: 'zig_expr', zigExpr: `if ${cond} ${tvExpr} else ${fvExpr}` };
    }
  }
  if (hasParen && c.kind() === TK.rparen) c.advance();
  return val;
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
      let val = parseStyleValue(c);
      // Handle modulo before comparison: i % 2 == 0 — consume % N and fold into zigExpr
      if (c.kind() === TK.mod && val.zigExpr) {
        c.advance();
        if (c.kind() === TK.number) {
          val = { type: val.type, value: val.value, zigExpr: `(${val.zigExpr} % ${c.text()})` };
          c.advance();
        }
      }
      // Ternary in style value: expr == N ? valA : valB
      if ((c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) && val.zigExpr) {
        const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
        c.advance();
        // Handle === (eq_eq + eq) → ==
        if (op === '==' && c.kind() === TK.equals) c.advance();
        let rhs = '';
        let rhsIsStringExpr = false;
        if (c.kind() === TK.number) { rhs = c.text(); c.advance(); }
        else if (c.kind() === TK.minus && c.pos+1 < c.count && c.kindAt(c.pos+1) === TK.number) { c.advance(); rhs = '-' + c.text(); c.advance(); }
        else if (c.kind() === TK.string) { rhs = `"${c.text().slice(1,-1)}"`; c.advance(); }
        else if (c.kind() === TK.identifier) {
          const n = c.text(); c.advance();
          if (isGetter(n)) {
            rhs = slotGet(n);
            // Check if this getter is a string state slot
            const slot = ctx.stateSlots.find(s => s.getter === n);
            if (slot && slot.type === 'string') rhsIsStringExpr = true;
          }
          else if (ctx.currentMap && n === ctx.currentMap.indexParam) { rhs = '@as(i64, @intCast(_i))'; }
          else if (ctx.currentMap && n === ctx.currentMap.itemParam && c.kind() === TK.dot) {
            // Map item field access: opt.id → _oaN_field[_i]
            c.advance(); // skip .
            if (c.kind() === TK.identifier) {
              const field = c.text(); c.advance();
              const oa = ctx.currentMap.oa;
              if (oa) {
                const fi = oa.fields.find(f => f.name === field);
                if (fi) {
                  rhs = fi.type === 'string'
                    ? `_oa${oa.oaIdx}_${field}[_i][0.._oa${oa.oaIdx}_${field}_lens[_i]]`
                    : `_oa${oa.oaIdx}_${field}[_i]`;
                  if (fi.type === 'string') rhsIsStringExpr = true;
                } else { rhs = n + '.' + field; }
              } else { rhs = n + '.' + field; }
            }
          }
          else if (ctx.propStack && ctx.propStack[n] !== undefined) { rhs = ctx.propStack[n]; }
          else { rhs = n; }
        }
        if (c.kind() === TK.question) {
          c.advance(); // skip ?
          const trueVal = parseTernaryBranch(c, key);
          if (c.kind() === TK.colon) c.advance();
          const falseVal = parseTernaryBranch(c, key);
          // String comparison: use std.mem.eql instead of == / !=
          let cond;
          const lhsIsString = val.fieldType === 'string' || (val.type === 'state' && ctx.stateSlots.find(s => s.getter === val.value)?.type === 'string');
          if (rhs.startsWith('"') || rhsIsStringExpr || lhsIsString) {
            const eql = `std.mem.eql(u8, ${val.zigExpr}, ${rhs})`;
            cond = op === '!=' ? `(!${eql})` : `(${eql})`;
          } else {
            cond = `(${val.zigExpr} ${op} ${rhs})`;
          }
          // Resolve branch expressions: string→parseColor, zig_expr→zigExpr, number→value
          const resolveColorBranch = (v) => v.type === 'zig_expr' ? v.zigExpr : v.type === 'string' ? parseColor(v.value) : v.type === 'number' ? parseColor(v.value) : 'Color{}';
          const resolveNumBranch = (v) => v.type === 'zig_expr' ? v.zigExpr : v.value;
          if (colorKeys[key] && (trueVal.type === 'string' || trueVal.type === 'zig_expr' || trueVal.type === 'number') && (falseVal.type === 'string' || falseVal.type === 'zig_expr' || falseVal.type === 'number')) {
            const colorExpr = `if ${cond} ${resolveColorBranch(trueVal)} else ${resolveColorBranch(falseVal)}`;
            if (ctx.currentMap) {
              // Inside map: emit inline — _rebuildMap re-evaluates per item
              fields.push(`.${colorKeys[key]} = ${colorExpr}`);
            } else {
              // Outside map: placeholder + dynStyle runtime update
              fields.push(`.${colorKeys[key]} = Color{}`);
              if (!ctx.dynStyles) ctx.dynStyles = [];
              const dsId = ctx.dynStyles.length;
              ctx.dynStyles.push({ field: colorKeys[key], expression: colorExpr, arrName: '', arrIndex: -1, isColor: true });
              if (!fields._dynStyleIds) fields._dynStyleIds = [];
              fields._dynStyleIds.push(dsId);
            }
            if (c.kind() === TK.comma) c.advance();
            continue;
          } else if (styleKeys[key] && trueVal.type === 'number' && falseVal.type === 'number') {
            // Ternary numeric style — also needs runtime
            fields.push(`.${styleKeys[key]} = 0`);
            if (!ctx.dynStyles) ctx.dynStyles = [];
            const dsId2 = ctx.dynStyles.length;
            ctx.dynStyles.push({ field: styleKeys[key], expression: `if ${cond} @as(f32, ${trueVal.value}) else @as(f32, ${falseVal.value})`, arrName: '', arrIndex: -1 });
            if (!fields._dynStyleIds) fields._dynStyleIds = [];
            fields._dynStyleIds.push(dsId2);
            if (c.kind() === TK.comma) c.advance();
            continue;
          } else if (enumKeys[key]) {
            const e = enumKeys[key];
            const tv = trueVal.type === 'string' && e.values[trueVal.value] ? e.values[trueVal.value] : '.flex';
            const fv = falseVal.type === 'string' && e.values[falseVal.value] ? e.values[falseVal.value] : '.none';
            fields.push(`.${e.field} = if ${cond} ${tv} else ${fv}`);
            if (c.kind() === TK.comma) c.advance();
            continue;
          }
        }
      }
      if (colorKeys[key]) {
        if (val.type === 'string') {
          fields.push(`.${colorKeys[key]} = ${parseColor(val.value)}`);
        } else if (val.type === 'number') {
          // Prop with numeric value passed as color — resolve hex from prop
          const propVal = ctx.propStack && Object.values(ctx.propStack).length > 0 ? val.value : '0';
          fields.push(`.${colorKeys[key]} = ${parseColor(propVal)}`);
        } else if (val.type === 'map_field' && val.fieldType === 'int') {
          // Map item int field as color — hex-to-RGB with bit-shift extraction
          const v = val.value;
          fields.push(`.${colorKeys[key]} = Color.rgb(@intCast((${v} >> 16) & 0xFF), @intCast((${v} >> 8) & 0xFF), @intCast(${v} & 0xFF))`);
        } else {
          // State or unknown — placeholder Color{}, dynamic update at runtime
          fields.push(`.${colorKeys[key]} = Color{}`);
          // Track orphan Color{} for preflight F4 — no dynStyle/dynColor backs this
          // Exclude map_field/map_index (handled by map pool) and state (often backed by dynStyle from ternary path)
          if (val.type !== 'map_field' && val.type !== 'map_index' && val.type !== 'state') {
            if (!ctx._orphanColors) ctx._orphanColors = [];
            ctx._orphanColors.push({ field: colorKeys[key], value: val.type + ':' + (val.value || '?') });
          }
        }
      } else if (styleKeys[key]) {
        if (val.type === 'state') {
          // Dynamic style — placeholder 0, update at runtime
          fields.push(`.${styleKeys[key]} = 0`);
          if (!ctx.dynStyles) ctx.dynStyles = [];
          const dsId = ctx.dynStyles.length;
          ctx.dynStyles.push({ field: styleKeys[key], expression: `@as(f32, @floatFromInt(${val.zigExpr}))`, arrName: '', arrIndex: -1 });
          if (!fields._dynStyleIds) fields._dynStyleIds = [];
          fields._dynStyleIds.push(dsId);
        } else if (val.type === 'map_field') {
          // Map field in style — e.g. width: bar.pct * 3
          let expr = val.value;
          // Consume optional arithmetic: * N, + N, - N
          while (c.kind() === TK.star || c.kind() === TK.plus || c.kind() === TK.minus) {
            const op = c.text(); c.advance();
            if (c.kind() === TK.number) { expr = `(${expr} ${op} ${c.text()})`; c.advance(); }
          }
          fields.push(`.${styleKeys[key]} = @as(f32, @floatFromInt(${expr}))`);
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
  // Check instance remap first (per-component-inline override)
  if (ctx.slotRemap && name in ctx.slotRemap) return ctx.slotRemap[name];
  for (let i = 0; i < ctx.stateSlots.length; i++) {
    if (ctx.stateSlots[i].getter === name || ctx.stateSlots[i].setter === name) return i;
  }
  return -1;
}

function isGetter(name) {
  if (ctx.slotRemap && name in ctx.slotRemap) return true;
  return ctx.stateSlots.some(s => s.getter === name);
}

function isSetter(name) {
  if (ctx.slotRemap && name in ctx.slotRemap) return true;
  return ctx.stateSlots.some(s => s.setter === name);
}

// Resolve a prop value for use in a conditional expression.
// Zig expressions (state.getSlot, numbers, if-expressions) pass through.
// String literals (multi-word text from prop="value") resolve to a truthy constant
// since a provided string prop is always non-zero in a truthiness check.
function _condPropValue(pv) {
  if (/^-?\d+(\.\d+)?$/.test(pv)) return pv; // numeric literal
  if (pv.startsWith('state.') || pv.startsWith('_oa') || pv.startsWith('if (') || pv.startsWith('@as(') || pv.startsWith('@intCast(')) return pv; // Zig expression
  if (pv.startsWith('_handler_press_')) return '1'; // handler ref = truthy
  // String literal — non-empty means truthy (1), empty means falsy (0)
  return pv.length > 0 ? '1' : '0';
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
          const needsParens = valExpr.includes(' + ') || valExpr.includes(' - ') || valExpr.includes(' * ') || valExpr.includes(' / ') || valExpr.includes('if (');
          const wrapped = needsParens ? `(${valExpr})` : valExpr;
          body += `    ${slotSet(slotIdx)}(${slotIdx}, ${wrapped});\n`;
          if (c.kind() === TK.rparen) c.advance();
        }
      } else if (c.kind() === TK.identifier && isScriptFunc(c.text())) {
        const fname = c.text();
        c.advance();
        let args = '';
        if (c.kind() === TK.lparen) {
          c.advance();
          let depth = 1;
          while (c.kind() !== TK.eof && depth > 0) {
            if (c.kind() === TK.lparen) depth++;
            else if (c.kind() === TK.rparen) { depth--; if (depth === 0) { c.advance(); break; } }
            args += c.text();
            c.advance();
          }
        }
        args = args.trim();
        if (args.length === 0) {
          body += `    qjs_runtime.callGlobal("${fname}");\n`;
        } else {
          // Single string arg: 'value' → callGlobalStr (avoids single-quote lint)
          const strMatch = args.match(/^['"](.*)['"]$/);
          if (strMatch) {
            body += `    qjs_runtime.callGlobalStr("${fname}", "${strMatch[1]}");\n`;
          } else if (/^-?\d+$/.test(args)) {
            body += `    qjs_runtime.callGlobalInt("${fname}", ${args});\n`;
          } else {
            const jsCall = `${fname}(${args.replace(/'/g, '\\"')})`;
            body += `    qjs_runtime.evalExpr("${jsCall}");\n`;
          }
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

// ── Lua handler parser ──
// Mirrors parseHandler/parseValueExpr but outputs Lua syntax.
// Uses raw variable names (defined in LUA_LOGIC state wrappers).

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
        } else {
          parts.push(pv);
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

function luaParseHandler(c) {
  // Skip () =>
  if (c.kind() === TK.lparen) c.advance();
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() === TK.arrow) c.advance();

  if (c.kind() === TK.lbrace) {
    // Block body: capture all tokens with spacing, resolve names, let luaTransform fix syntax
    c.advance();
    let parts = [];
    let depth = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.rbrace && depth === 0) { c.advance(); break; }
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) depth--;
      // Resolve state getter/setter names through instance remap
      if (c.kind() === TK.identifier) {
        const name = c.text();
        const remapped = (ctx.nameRemap && ctx.nameRemap[name]) || name;
        if (isGetter(name)) {
          parts.push(remapped);
        } else if (isSetter(name)) {
          parts.push(remapped);
        } else if (isScriptFunc(name)) {
          parts.push(name);
        } else if (ctx.currentMap && name === ctx.currentMap.itemParam) {
          parts.push(name);
        } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
          parts.push(name);
        } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
          parts.push(ctx.propStack[name]);
        } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
          parts.push(ctx.renderLocals[name]);
        } else {
          parts.push(remapped);
        }
      } else if (c.kind() === TK.semicolon) {
        parts.push('; ');
      } else if (c.kind() === TK.eq_eq) {
        parts.push(' == ');
        c.advance();
        if (c.kind() === TK.equals) c.advance(); // === → ==
        continue;
      } else if (c.kind() === TK.not_eq) {
        parts.push(' ~= ');
        c.advance();
        if (c.kind() === TK.equals) c.advance(); // !== → ~=
        continue;
      } else if (c.kind() === TK.amp_amp) {
        parts.push(' and ');
      } else if (c.kind() === TK.pipe_pipe) {
        parts.push(' or ');
      } else if (c.kind() === TK.bang) {
        parts.push('not ');
      } else if (c.kind() === TK.plus || c.kind() === TK.minus || c.kind() === TK.star || c.kind() === TK.slash || c.kind() === TK.percent) {
        parts.push(' ' + c.text() + ' ');
      } else if (c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq) {
        parts.push(' ' + c.text() + ' ');
      } else {
        parts.push(c.text());
      }
      c.advance();
    }
    return luaTransform(parts.join(''));
  }

  // Single expression: setter(expr) or scriptFunc()
  let stmts = [];
  if (c.kind() === TK.identifier && (isSetter(c.text()) || isScriptFunc(c.text()))) {
    const fname = (ctx.nameRemap && ctx.nameRemap[c.text()]) || c.text();
    c.advance();
    if (c.kind() === TK.lparen) {
      c.advance();
      if (c.kind() === TK.rparen) {
        stmts.push(`${fname}()`);
      } else {
        const valExpr = luaParseValueExpr(c);
        stmts.push(`${fname}(${valExpr})`);
      }
      if (c.kind() === TK.rparen) c.advance();
    }
  }
  return stmts.join('; ');
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
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        parts.push('0'); // map index → 0 in handler context (reference behavior)
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        const pv = ctx.propStack[name];
        // Use numeric prop values directly; non-numeric (like _i map var) fall back to 0
        parts.push(/^-?\d+(\.\d+)?$/.test(pv) ? pv : '0');
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

