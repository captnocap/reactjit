// ── Style block parser (from attrs.js) ──

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
      if (c.kind() === TK.percent && val.zigExpr) {
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
          var cond = resolveComparison(val.zigExpr, op, rhs, ctx);
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
        } else if (val.type === 'state') {
          fields.push(`.${colorKeys[key]} = Color{}`);
          if (!ctx.dynStyles) ctx.dynStyles = [];
          const dsColorId = ctx.dynStyles.length;
          const colorExpr = val.exprType === 'string' ? `Color.fromHex(${val.zigExpr})` : val.zigExpr;
          ctx.dynStyles.push({ field: colorKeys[key], expression: colorExpr, arrName: '', arrIndex: -1, isColor: true });
          if (!fields._dynStyleIds) fields._dynStyleIds = [];
          fields._dynStyleIds.push(dsColorId);
        } else if (val.type === 'map_field' && val.fieldType === 'int') {
          // Map item int field as color — hex-to-RGB with bit-shift extraction
          const v = val.value;
          fields.push(`.${colorKeys[key]} = Color.rgb(@intCast((${v} >> 16) & 0xFF), @intCast((${v} >> 8) & 0xFF), @intCast(${v} & 0xFF))`);
        } else if (val.type === 'map_field' && val.fieldType === 'string') {
          // Map item string field as color — runtime hex-to-Color parsing
          fields.push(`.${colorKeys[key]} = Color.fromHex(${val.zigExpr})`);
        } else {
          // State or unknown — placeholder Color{}, dynamic update at runtime
          fields.push(`.${colorKeys[key]} = Color{}`);
          // Track orphan Color{} for preflight F4 — no dynStyle/dynColor backs this
          // Exclude map_field/map_index (handled by map pool), state (backed by dynStyle),
          // and unknown (unresolvable JS expressions — will be Color{} at runtime, not a compiler bug)
          if (val.type !== 'map_field' && val.type !== 'map_index' && val.type !== 'state' && val.type !== 'unknown') {
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
          const styleExpr = val.exprType === 'bool'
            ? `@as(f32, @floatFromInt(@intFromBool(${val.zigExpr})))`
            : `@as(f32, @floatFromInt(${val.zigExpr}))`;
          ctx.dynStyles.push({ field: styleKeys[key], expression: styleExpr, arrName: '', arrIndex: -1 });
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
          fields.push(`.${styleKeys[key]} = ${-(pct / 100)}`);
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
