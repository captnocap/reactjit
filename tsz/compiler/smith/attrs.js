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
  const h = hex.startsWith('#') ? hex.slice(1) : hex.startsWith('0x') ? hex.slice(2) : hex;
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
    // OA getter followed by [mapIndex].field → resolve to OA field access
    const _svOa = ctx.objectArrays ? ctx.objectArrays.find(o => o.getter === name) : null;
    if (_svOa && c.pos + 4 < c.count && c.kindAt(c.pos + 1) === TK.lbracket) {
      const saved = c.save();
      c.advance(); // skip name
      c.advance(); // skip [
      // Check if bracket contains map index param or a prop that resolves to map index
      let isMapIdx = false;
      if (c.kind() === TK.identifier) {
        const bracketName = c.text();
        isMapIdx = (ctx.currentMap && bracketName === ctx.currentMap.indexParam) ||
                   (ctx.propStack && ctx.propStack[bracketName] !== undefined &&
                    typeof ctx.propStack[bracketName] === 'string' &&
                    ctx.propStack[bracketName].includes('@intCast('));
      }
      if (isMapIdx && c.pos + 3 < c.count) {
        c.advance(); // skip index identifier
        if (c.kind() === TK.rbracket) {
          c.advance(); // skip ]
          if (c.kind() === TK.dot) {
            c.advance(); // skip .
            if (c.kind() === TK.identifier) {
              const field = c.text(); c.advance();
              const iterVar = (ctx.currentMap && ctx.currentMap.iterVar) || '_i';
              const fi = _svOa.fields.find(f => f.name === field);
              if (fi && fi.type === 'string') {
                return { type: 'map_field', value: `_oa${_svOa.oaIdx}_${field}[${iterVar}]`, zigExpr: `_oa${_svOa.oaIdx}_${field}[${iterVar}][0.._oa${_svOa.oaIdx}_${field}_lens[${iterVar}]]`, fieldType: 'string' };
              }
              return { type: 'map_field', value: `_oa${_svOa.oaIdx}_${field}[${iterVar}]`, zigExpr: `_oa${_svOa.oaIdx}_${field}[${iterVar}]`, fieldType: fi ? fi.type : 'int' };
            }
          }
        }
      }
      c.restore(saved);
    }
    if (isGetter(name)) {
      c.advance();
      return { type: 'state', value: name, zigExpr: slotGet(name) };
    }
    // Map item member access: tag.field (supports multi-level: tag.config.theme.bg)
    if (ctx.currentMap && name === ctx.currentMap.itemParam) {
      c.advance(); // skip item name
      if (c.kind() === TK.dot) {
        c.advance(); // skip .
        if (c.kind() === TK.identifier) {
          let field = c.text(); c.advance();
          // Multi-level dot access: item.config.theme.bg → config_theme_bg
          while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
            c.advance(); field += '_' + c.text(); c.advance();
          }
          const oa = ctx.currentMap.oa;
          const fi = oa.fields.find(f => f.name === field);
          if (fi) {
            const oaIdx = oa.oaIdx;
            const zigExpr = fi.type === 'string' ? `_oa${oaIdx}_${field}[_i][0.._oa${oaIdx}_${field}_lens[_i]]` : `_oa${oaIdx}_${field}[_i]`;
            return { type: 'map_field', value: `_oa${oaIdx}_${field}[_i]`, zigExpr, fieldType: fi.type };
          } else {
            // Field exists but wasn't in schema — emit anyway
            const oaIdx = oa.oaIdx;
            return { type: 'map_field', value: `_oa${oaIdx}_${field}[_i]`, zigExpr: `_oa${oaIdx}_${field}[_i]`, fieldType: 'int' };
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
      // Detect OA field references passed through props (e.g., proj.color → _oa0_color[_i])
      const oaMatch = pv.match(/^_oa(\d+)_(\w+)\[/);
      if (oaMatch) {
        // Determine field type from the OA schema
        const oaIdx = parseInt(oaMatch[1]);
        const fieldName = oaMatch[2];
        const srcOa = ctx.objectArrays ? ctx.objectArrays.find(o => o.oaIdx === oaIdx) : null;
        const fi = srcOa ? srcOa.fields.find(f => f.name === fieldName) : null;
        const fieldType = fi ? fi.type : 'int';
        return { type: 'map_field', value: pv, zigExpr: pv, fieldType };
      }
      // Check for arithmetic after prop: prop * N, prop / N
      if (/^-?\d+(\.\d+)?$/.test(pv) && (c.kind() === TK.star || c.kind() === TK.slash || c.kind() === TK.plus || c.kind() === TK.minus)) {
        const op = c.kind(); c.advance();
        if (c.kind() === TK.number) {
          const rhs = parseFloat(c.text()); c.advance();
          const lhs = parseFloat(pv);
          const result = op === TK.star ? lhs * rhs : op === TK.slash ? lhs / rhs : op === TK.plus ? lhs + rhs : lhs - rhs;
          return { type: 'number', value: String(Math.round(result)) };
        }
      }
      // Check if prop value is a Zig expression that needs zigExpr for ternary resolution
      const isZigExpr = typeof pv === 'string' && (pv.includes('state.get') || pv.includes('getSlot') || pv.includes('_oa') || pv.includes('@as') || pv.includes('if ('));
      if (isZigExpr) {
        // Wrap if-expressions in parens so they compose safely in further comparisons
        const zigExpr = pv.startsWith('if (') ? '(' + pv + ')' : pv;
        return { type: 'state', value: name, zigExpr };
      }
      // Ensure numeric props have zigExpr so ternary resolution works (prop == N ? A : B)
      return { type: 'number', value: pv, zigExpr: pv };
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
      let cond;
      if (rhsIsString || val.fieldType === 'string') {
        const rhsQuoted = rhs.startsWith('"') ? rhs : '"' + rhs + '"';
        const eql = `std.mem.eql(u8, ${val.zigExpr}, ${rhsQuoted})`;
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
            const numExpr = `if ${cond} @as(f32, ${trueVal.value}) else @as(f32, ${falseVal.value})`;
            if (ctx.currentMap) {
              // Inside map: emit inline — _rebuildMap re-evaluates per item
              fields.push(`.${styleKeys[key]} = ${numExpr}`);
            } else {
              // Outside map: placeholder + dynStyle runtime update
              fields.push(`.${styleKeys[key]} = 0`);
              if (!ctx.dynStyles) ctx.dynStyles = [];
              const dsId2 = ctx.dynStyles.length;
              ctx.dynStyles.push({ field: styleKeys[key], expression: numExpr, arrName: '', arrIndex: -1 });
              if (!fields._dynStyleIds) fields._dynStyleIds = [];
              fields._dynStyleIds.push(dsId2);
            }
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
        } else if (val.type === 'string' && val.value.startsWith('theme-')) {
          const resolved = resolveThemeToken(val.value);
          if (typeof resolved === 'number') fields.push(`.${styleKeys[key]} = ${resolved}`);
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
      } else if (key === 'fontSize') {
        // Text node field — not a style field, hoist to node level
        if (!fields._nodeFields) fields._nodeFields = [];
        if (val.type === 'number') {
          fields._nodeFields.push(`.font_size = ${val.value}`);
        } else if (val.type === 'string' && val.value.startsWith('theme-')) {
          fields._nodeFields.push(`.font_size = ${resolveThemeToken(val.value)}`);
        }
      } else if (key === 'color') {
        // Text node field — not a style field, hoist to node level
        if (!fields._nodeFields) fields._nodeFields = [];
        if (val.type === 'string') {
          const resolved = resolveThemeToken(val.value);
          fields._nodeFields.push(`.text_color = ${parseColor(String(resolved))}`);
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

// Resolve a prop value for use in a conditional expression.
// Zig expressions (state.getSlot, numbers, if-expressions) pass through.
// String literals (multi-word text from prop="value") resolve to a truthy constant
// since a provided string prop is always non-zero in a truthiness check.
function _condPropValue(pv) {
  if (typeof pv !== 'string') return '1'; // JSX slot objects are always truthy
  if (/^-?\d+(\.\d+)?$/.test(pv)) return pv; // numeric literal
  if (pv.startsWith('if (')) return '(' + pv + ')'; // Zig if-else needs parens for correct precedence
  if (pv.startsWith('state.') || pv.startsWith('_oa') || pv.startsWith('@as(') || pv.startsWith('@intCast(')) return pv; // Zig expression
  if (pv.startsWith('_handler_press_')) return '1'; // handler ref = truthy
  // String literal — non-empty means truthy (1), empty means falsy (0)
  return pv.length > 0 ? '1' : '0';
}

function slotSet(slotIdx) {
  const s = ctx.stateSlots[slotIdx];
  if (s.type === 'float') return `state.setSlotFloat`;
  if (s.type === 'boolean') return `state.setSlotBool`;
  if (s.type === 'string') return `state.setSlotString`;
  return `state.setSlot`;
}

// Parse a handler expression: () => setCount(expr)
// Returns the Zig body as a string
function parseHandler(c) {
  // Skip (params) =>
  if (c.kind() === TK.lparen) {
    c.advance();
    while (c.kind() !== TK.rparen && c.kind() !== TK.eof) c.advance();
    if (c.kind() === TK.rparen) c.advance();
  }
  if (c.kind() === TK.arrow) c.advance();

  // Parse body — could be { stmts } or single expression
  let body = '';
  if (c.kind() === TK.lbrace) {
    // Block body: { stmt; stmt; stmt; }
    c.advance();
    let body = '';
    while (c.kind() !== TK.rbrace && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier && isSetter(c.text())) {
        // Delegate setter calls to JS so the JS variable AND Zig slot both update.
        // Direct Zig slot writes (state.setSlot) bypass the JS variable, causing
        // desync when JS logic later reads the variable (e.g. goNext checks `name`).
        const setter = c.text();
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
          body += `    qjs_runtime.callGlobal("${setter}");\n`;
        } else {
          const strMatch = args.match(/^'([^']*)'$/) || args.match(/^"([^"]*)"$/);
          if (strMatch) {
            var _strVal = strMatch[1].replace(/"/g, '\\"');
            body += `    qjs_runtime.callGlobalStr("${setter}", "${_strVal}");\n`;
          } else if (/^-?\d+$/.test(args)) {
            body += `    qjs_runtime.callGlobalInt("${setter}", ${args});\n`;
          } else {
            const jsCall = `${setter}(${args.replace(/'/g, '\\"')})`;
            body += `    qjs_runtime.evalExpr("${jsCall}");\n`;
          }
        }
      } else if (c.kind() === TK.identifier && c.text() === 'setVariant') {
        c.advance();
        if (c.kind() === TK.lparen) {
          c.advance();
          const val = c.text(); c.advance();
          if (c.kind() === TK.rparen) c.advance();
          body += globalThis.__fastBuild === 1
            ? `    api.theme.rjit_theme_set_variant(${val});\n`
            : `    @import("framework/theme.zig").setVariant(${val});\n`;
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
          const strMatch = args.match(/^'([^']*)'$/) || args.match(/^"([^"]*)"$/);
          if (strMatch) {
            var _strVal = strMatch[1].replace(/"/g, '\\"');
            body += `    qjs_runtime.callGlobalStr("${fname}", "${_strVal}");\n`;
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

  // Single expression: setVariant(N)
  if (c.kind() === TK.identifier && c.text() === 'setVariant') {
    c.advance();
    if (c.kind() === TK.lparen) {
      c.advance();
      const val = c.text(); c.advance();
      if (c.kind() === TK.rparen) c.advance();
      body = `    @import("framework/theme.zig").setVariant(${val});\n`;
    }
    return body;
  }
  // Single expression: setCount(expr) — delegate to JS (same reason as block body)
  if (c.kind() === TK.identifier && isSetter(c.text())) {
    const setter = c.text();
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
      body = `    qjs_runtime.callGlobal("${setter}");\n`;
    } else {
      const strMatch = args.match(/^'([^']*)'$/) || args.match(/^"([^"]*)"$/);
      if (strMatch) {
        var _strVal2 = strMatch[1].replace(/"/g, '\\"');
        body = `    qjs_runtime.callGlobalStr("${setter}", "${_strVal2}");\n`;
      } else if (/^-?\d+$/.test(args)) {
        body = `    qjs_runtime.callGlobalInt("${setter}", ${args});\n`;
      } else {
        const jsCall = `${setter}(${args.replace(/'/g, '\\"')})`;
        body = `    qjs_runtime.evalExpr("${jsCall}");\n`;
      }
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

function luaParseHandler(c) {
  // Skip (params) => — capture parameter names for JS wrapper emission
  var _closureParams = [];
  if (c.kind() === TK.lparen) {
    c.advance();
    while (c.kind() !== TK.rparen && c.kind() !== TK.eof) {
      if (c.kind() === TK.identifier) _closureParams.push(c.text());
      c.advance();
    }
    if (c.kind() === TK.rparen) c.advance();
  }
  if (c.kind() === TK.arrow) c.advance();
  // Store params on context for the handler creator to pick up
  ctx._lastClosureParams = _closureParams;

  if (c.kind() === TK.lbrace) {
    // Block body: capture all tokens with spacing, resolve names, let luaTransform fix syntax
    c.advance();
    let parts = [];
    let depth = 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.rbrace && depth === 0) { c.advance(); break; }
      if (c.kind() === TK.lbrace) depth++;
      if (c.kind() === TK.rbrace) depth--;
      // Resolve props.X dot-access in handler body
      {
        const pa = peekPropsAccess(c);
        if (pa) {
          skipPropsAccess(c);
          const pv = pa.value;
          if (typeof pv === 'string') {
            const isZigExpr = pv.includes('@as(') || pv.includes('@intCast') || pv.includes('_oa') || pv.includes('state.get') || pv.includes('getSlot');
            if (isZigExpr) {
              parts.push(pa.field);
            } else if (/^-?\d+(\.\d+)?$/.test(pv) || /^0x[0-9a-fA-F]+$/.test(pv) || pv.startsWith("'") || pv.startsWith('"')) {
              parts.push(pv);
            } else {
              parts.push("'" + pv.replace(/'/g, "\\'") + "'");
            }
          } else {
            parts.push(String(pv));
          }
          continue;
        }
      }
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
        } else if (ctx.propStack && ctx.propStack[name] !== undefined && typeof ctx.propStack[name] === 'string') {
          // In Lua/JS handler context, emit the prop NAME (not the Zig value).
          const pv = ctx.propStack[name];
          // Const OA row ref with .field access
          if (typeof pv === 'string' && pv.charCodeAt(0) === 1 &&
              c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
            var _hpfld = resolveConstOaFieldFromRef(pv, c.textAt(c.pos + 2));
            if (_hpfld !== null) {
              if (_hpfld.charAt(0) === '"' && _hpfld.charAt(_hpfld.length - 1) === '"') _hpfld = _hpfld.slice(1, -1);
              parts.push(_hpfld);
              c.advance(); c.advance(); c.advance();
              continue;
            }
          }
          const isZigExpr = pv.includes('@as(') || pv.includes('@intCast') || pv.includes('_oa') || pv.includes('state.get') || pv.includes('getSlot');
          if (isZigExpr) {
            parts.push(name);
          } else if (/^-?\d+(\.\d+)?$/.test(pv) || /^0x[0-9a-fA-F]+$/.test(pv)) {
            parts.push(pv);
          } else if (pv.startsWith("'") || pv.startsWith('"')) {
            parts.push(pv);
          } else {
            // String prop value — quote it for valid JS/Lua
            parts.push("'" + pv.replace(/'/g, "\\'") + "'");
          }
        } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
          var _hrlv = ctx.renderLocals[name];
          // Resolve const OA row ref + .field in handler bodies
          if (typeof _hrlv === 'string' && _hrlv.charCodeAt(0) === 1 &&
              c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
            var _hfld = resolveConstOaFieldFromRef(_hrlv, c.textAt(c.pos + 2));
            if (_hfld !== null) {
              // Strip quotes for JS/Lua handler context
              if (_hfld.charAt(0) === '"' && _hfld.charAt(_hfld.length - 1) === '"') _hfld = _hfld.slice(1, -1);
              parts.push(_hfld);
              c.advance(); c.advance(); // skip name and dot; field advanced by loop
              c.advance(); // advance past field
              continue;
            }
          }
          parts.push(_hrlv);
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
    const joined = parts.join('');
    // Empty handler body () => {} — return a no-op so map handlers have a valid luaBody
    if (joined.trim() === '') return '-- noop';
    return luaTransform(joined);
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
