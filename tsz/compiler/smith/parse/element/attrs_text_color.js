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

    var colorLhs = null;
    var colorLhsIsString = false;
    var _lhsResolved = resolveIdentity(propName, ctx);
    if (_lhsResolved.kind === 'slot') {
      colorLhs = _lhsResolved.zigExpr;
      colorLhsIsString = _lhsResolved.slot && _lhsResolved.slot.type === 'string';
    } else if (_lhsResolved.kind === 'map_item' && c.kind() === TK.dot) {
      c.advance();
      if (c.kind() === TK.identifier) {
        var lhsField = c.text();
        c.advance();
        var lhsFieldResult = resolveField(_lhsResolved, lhsField, ctx);
        colorLhs = lhsFieldResult.zigExpr;
        colorLhsIsString = lhsFieldResult.type === 'string';
      }
    } else if (_lhsResolved.kind === 'prop') {
      var propVal = _lhsResolved.zigExpr;
      if (typeof propVal === 'string') {
        colorLhs = propVal;
        colorLhsIsString = propVal.includes('getSlotString') || (propVal.includes('[0..') && propVal.includes('_lens'));
      }
    }

    if (colorLhs && (c.kind() === TK.eq_eq || c.kind() === TK.not_eq || c.kind() === TK.gt || c.kind() === TK.lt || c.kind() === TK.gt_eq || c.kind() === TK.lt_eq)) {
      const op = c.kind() === TK.eq_eq ? '==' : c.kind() === TK.not_eq ? '!=' : c.text();
      c.advance();
      if ((op === '==' || op === '!=') && c.kind() === TK.equals) c.advance();

      var rhs = '';
      var rhsIsString = false;
      if (c.kind() === TK.number) {
        rhs = c.text();
        c.advance();
      } else if (c.kind() === TK.string) {
        rhs = c.text().slice(1, -1);
        c.advance();
        rhsIsString = true;
      } else if (c.kind() === TK.identifier) {
        var rhsName = c.text();
        c.advance();
        var _rhsResolved = resolveIdentity(rhsName, ctx);
        if (_rhsResolved.kind === 'slot') {
          rhs = _rhsResolved.zigExpr;
        } else if (_rhsResolved.kind === 'map_item' && c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            var rhsField = c.text();
            c.advance();
            var rhsFieldResult = resolveField(_rhsResolved, rhsField, ctx);
            rhs = rhsFieldResult.zigExpr;
            rhsIsString = rhsFieldResult.type === 'string';
          }
        } else if (_rhsResolved.kind === 'map_index' || _rhsResolved.kind === 'parent_map_index') {
          rhs = _rhsResolved.zigExpr;
        } else if (_rhsResolved.kind === 'prop' && typeof _rhsResolved.zigExpr === 'string') {
          rhs = _rhsResolved.zigExpr;
        } else {
          rhs = rhsName;
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
          cond = resolveComparison(colorLhs, op, rhsExpr, ctx);
        } else {
          cond = resolveComparison(colorLhs, op, rhs, ctx);
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
