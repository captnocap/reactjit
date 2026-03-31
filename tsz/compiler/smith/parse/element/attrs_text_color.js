// ── JSX text color attr helpers ──────────────────────────────────

function tryParseTextColorAttr(c, attr, nodeFields) {
  if (attr !== 'color') return false;

  if (c.kind() === TK.string) {
    const value = c.text().slice(1, -1);
    nodeFields.push(`.text_color = ${parseColor(value)}`);
    c.advance();
    return true;
  }

  if (c.kind() !== TK.lbrace) return true;

  c.advance();
  if (c.kind() === TK.identifier) {
    const propName = c.text();
    c.advance();

    let colorLhs = null;
    let colorLhsIsString = false;
    if (isGetter(propName)) {
      const slotIndex = findSlot(propName);
      colorLhs = slotGet(propName);
      colorLhsIsString = slotIndex >= 0 && ctx.stateSlots[slotIndex].type === 'string';
    } else if (ctx.currentMap && propName === ctx.currentMap.itemParam && c.kind() === TK.dot) {
      c.advance();
      if (c.kind() === TK.identifier) {
        const field = c.text();
        c.advance();
        const oa = ctx.currentMap.oa;
        const fieldInfo = oa ? oa.fields.find(f => f.name === field) : null;
        if (fieldInfo) {
          colorLhs = `_oa${oa.oaIdx}_${field}[_i]`;
          colorLhsIsString = fieldInfo.type === 'string';
          if (colorLhsIsString) colorLhs = `${colorLhs}[0.._oa${oa.oaIdx}_${field}_lens[_i]]`;
        }
      }
    }

    if (colorLhs && (c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq)) {
      const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
      c.advance();
      if ((op === '==' || op === '!=') && c.kind() === TK.equals) c.advance();

      let rhs = '';
      let rhsIsString = false;
      if (c.kind() === TK.number) {
        rhs = c.text();
        c.advance();
      } else if (c.kind() === TK.string) {
        rhs = c.text().slice(1, -1);
        c.advance();
        rhsIsString = true;
      } else if (c.kind() === TK.identifier) {
        const name = c.text();
        c.advance();
        if (isGetter(name)) {
          rhs = slotGet(name);
        } else if (ctx.currentMap && name === ctx.currentMap.itemParam && c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            const field = c.text();
            c.advance();
            const oa = ctx.currentMap.oa;
            const fieldInfo = oa ? oa.fields.find(f => f.name === field) : null;
            if (fieldInfo && fieldInfo.type === 'string') {
              rhs = `_oa${oa.oaIdx}_${field}[_i][0.._oa${oa.oaIdx}_${field}_lens[_i]]`;
              rhsIsString = true;
            } else if (fieldInfo) {
              rhs = `_oa${oa.oaIdx}_${field}[_i]`;
            } else {
              rhs = name + '.' + field;
            }
          }
        } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
          rhs = '@as(i64, @intCast(_i))';
        } else if (ctx.propStack && ctx.propStack[name] !== undefined && typeof ctx.propStack[name] === 'string') {
          rhs = ctx.propStack[name];
        } else {
          rhs = name;
        }
      }

      if (c.kind() === TK.question) {
        c.advance();
        const truthyValue = parseTernaryBranch(c, 'color');
        if (c.kind() === TK.colon) c.advance();
        const falsyValue = parseTernaryBranch(c, 'color');

        let cond;
        if (rhsIsString || colorLhsIsString) {
          const rhsExpr = (rhs.includes('[_i]') || rhs.includes('_oa') || rhs.includes('state.get') || rhs.includes('getSlot')) ? rhs : `"${rhs}"`;
          const eql = `std.mem.eql(u8, ${colorLhs}, ${rhsExpr})`;
          cond = op === '!=' ? `(!${eql})` : `(${eql})`;
        } else {
          cond = `(${colorLhs} ${op} ${rhs})`;
        }

        const resolveColor = (value) => value.type === 'zig_expr' ? value.zigExpr : value.type === 'string' ? parseColor(value.value) : 'Color{}';
        const colorExpr = `if ${cond} ${resolveColor(truthyValue)} else ${resolveColor(falsyValue)}`;
        if (ctx.currentMap || (colorLhs && colorLhs.includes('_oa'))) {
          nodeFields.push(`.text_color = ${colorExpr}`);
        } else {
          nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
          if (!ctx.dynStyles) ctx.dynStyles = [];
          const dynStyleId = ctx.dynStyles.length;
          ctx.dynStyles.push({ field: 'text_color', expression: colorExpr, arrName: '', arrIndex: -1, isColor: true });
          if (!nodeFields._dynStyleIds) nodeFields._dynStyleIds = [];
          nodeFields._dynStyleIds.push(dynStyleId);
        }
      } else {
        nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
      }
    } else {
      nodeFields.push(`.text_color = Color.rgb(0, 0, 0)`);
      const propValue = ctx.propStack && ctx.propStack[propName];
      if (propValue && typeof propValue === 'string' && propValue.startsWith('#')) {
        const dynColorId = ctx.dynColors.length;
        ctx.dynColors.push({ dcId: dynColorId, arrName: '', arrIndex: -1, colorExpr: parseColor(propValue) });
        nodeFields._dynColorId = dynColorId;
      }
    }
  }

  if (c.kind() === TK.rbrace) c.advance();
  return true;
}
