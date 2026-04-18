// ── Acorn-backed expression parsing for brace conditions ─────────

function _smithExprSourceFromTokens(c, start, end, ctx) {
  const parts = [];
  let ti = start;
  while (ti < end) {
    const kind = c.kindAt(ti);
    const text = c.textAt(ti);
    const nextText = ti + 1 < end ? c.textAt(ti + 1) : '';
    const nextNextText = ti + 2 < end ? c.textAt(ti + 2) : '';
    if (kind === TK.identifier) {
      const prev = parts.length > 0 ? parts[parts.length - 1] : '';
      if ((prev === '===' || prev === '!==' || prev === '==' || prev === '!=') &&
          text !== 'true' && text !== 'false' && text !== 'null' && text !== 'undefined' &&
          !isGetter(text) &&
          !(ctx && ctx.renderLocals && ctx.renderLocals[text] !== undefined) &&
          !(ctx && ctx.propStack && ctx.propStack[text] !== undefined)) {
        parts.push(JSON.stringify(text));
        ti++;
        continue;
      }
      if (text === 'not' && nextText === 'exact') {
        parts.push('!==');
        ti += 2;
        continue;
      }
      if (text === 'exact' && nextText === 'or' && nextNextText === 'above') {
        parts.push('>=');
        ti += 3;
        continue;
      }
      if (text === 'exact' && nextText === 'or' && nextNextText === 'below') {
        parts.push('<=');
        ti += 3;
        continue;
      }
      if (text === 'exact') {
        parts.push('===');
        ti++;
        continue;
      }
      if (text === 'above') {
        parts.push('>');
        ti++;
        continue;
      }
      if (text === 'below') {
        parts.push('<');
        ti++;
        continue;
      }
      if (text === 'and') {
        parts.push('&&');
        ti++;
        continue;
      }
      if (text === 'or') {
        parts.push('||');
        ti++;
        continue;
      }
      if (text === 'not') {
        parts.push('!');
        ti++;
        continue;
      }
    }
    parts.push(text);
    ti++;
  }
  return _normalizeJoinedJsExpr(parts.join(' ')).trim();
}

function _parseSmithExprAst(source) {
  if (!globalThis.acorn || typeof globalThis.acorn.parseExpressionAt !== 'function') return null;
  const expr = String(source || '').trim();
  if (!expr) return null;
  try {
    const node = globalThis.acorn.parseExpressionAt(expr, 0, { ecmaVersion: 2020 });
    if (expr.slice(node.end).trim().length > 0) return null;
    return node;
  } catch (_err) {
    return null;
  }
}

function _wrapSmithCondOperandExpr(expr) {
  if (typeof expr !== 'string') return expr;
  const trimmed = expr.trim();
  if (!trimmed) return trimmed;
  if (trimmed.charAt(0) === '(' && trimmed.charAt(trimmed.length - 1) === ')') return trimmed;
  if (/(?:===|!==|==|!=|>=|<=|&&|\|\||\band\b|\bor\b|\bnot\b|[?:<>])/.test(trimmed)) {
    return '(' + trimmed + ')';
  }
  return trimmed;
}

function _lowerSmithCondIdentifier(name, ctx) {
  if (name === 'true') return '1';
  if (name === 'false') return '0';
  if (isGetter(name)) return slotGet(name);
  if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) return _wrapSmithCondOperandExpr(ctx.renderLocals[name]);
  if (ctx.propStack && ctx.propStack[name] !== undefined) return _condPropValue(ctx.propStack[name]);
  return null;
}

function _lowerSmithCondMember(node, ctx) {
  if (!node || node.type !== 'MemberExpression' || node.computed) return null;
  if (!node.property || node.property.type !== 'Identifier') return null;
  const propName = node.property.name;

  if (propName === 'length') {
    if (node.object && node.object.type === 'Identifier' && ctx.propStack && ctx.propStack[node.object.name] !== undefined) {
      return _condDirectLengthExpr(ctx.propStack[node.object.name]);
    }
    if (node.object &&
        node.object.type === 'MemberExpression' &&
        !node.object.computed &&
        node.object.object &&
        node.object.object.type === 'Identifier' &&
        node.object.property &&
        node.object.property.type === 'Identifier' &&
        ctx.propsObjectName &&
        node.object.object.name === ctx.propsObjectName &&
        ctx.propStack &&
        ctx.propStack[node.object.property.name] !== undefined) {
      return _condDirectLengthExpr(ctx.propStack[node.object.property.name]);
    }
  }

  if (node.object &&
      node.object.type === 'Identifier' &&
      ctx.propsObjectName &&
      node.object.name === ctx.propsObjectName &&
      ctx.propStack &&
      ctx.propStack[propName] !== undefined) {
    return _condPropValue(ctx.propStack[propName]);
  }

  if (node.object &&
      node.object.type === 'Identifier' &&
      ctx.currentMap &&
      node.object.name === ctx.currentMap.itemParam &&
      ctx.currentMap.oa) {
    const mapOa = ctx.currentMap.oa;
    const iterVar = ctx.currentMap.iterVar || '_i';
    const fieldInfo = mapOa.fields.find(function (f) { return f.name === propName; });
    if (!fieldInfo) return null;
    if (fieldInfo.type === 'string') {
      return `_oa${mapOa.oaIdx}_${propName}[${iterVar}][0.._oa${mapOa.oaIdx}_${propName}_lens[${iterVar}]]`;
    }
    return `_oa${mapOa.oaIdx}_${propName}[${iterVar}]`;
  }

  return null;
}

function _lowerSmithCondOperand(node, ctx) {
  if (!node) return null;
  if (node.type === 'Identifier') return _lowerSmithCondIdentifier(node.name, ctx);
  if (node.type === 'Literal') {
    if (typeof node.value === 'string') return JSON.stringify(node.value);
    if (typeof node.value === 'number') return String(node.value);
    if (typeof node.value === 'boolean') return node.value ? '1' : '0';
    if (node.value == null) return '0';
    return null;
  }
  if (node.type === 'MemberExpression') return _lowerSmithCondMember(node, ctx);
  if (node.type === 'UnaryExpression' || node.type === 'BinaryExpression' || node.type === 'LogicalExpression') {
    return _lowerSmithCondExprAst(node, ctx);
  }
  return null;
}

function _ensureSmithCondBoolean(expr) {
  if (typeof expr !== 'string') return null;
  const trimmed = expr.trim();
  if (!trimmed) return null;
  if (trimmed === '1' || trimmed === '0') return '(' + trimmed + ' ==  1)';
  if (_looksBooleanLikeCondExpr(trimmed)) return trimmed;
  return '((' + trimmed + ') == 1)';
}

function _lowerSmithCondExprAst(node, ctx) {
  if (!node) return null;
  if (node.type === 'LogicalExpression') {
    const lhs = _ensureSmithCondBoolean(_lowerSmithCondOperand(node.left, ctx));
    const rhs = _ensureSmithCondBoolean(_lowerSmithCondOperand(node.right, ctx));
    if (!lhs || !rhs) return null;
    return '(' + lhs + ')' + (node.operator === '&&' ? ' and ' : ' or ') + '(' + rhs + ')';
  }
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    const arg = _lowerSmithCondOperand(node.argument, ctx);
    if (!arg) return null;
    const boolArg = _ensureSmithCondBoolean(arg);
    if (!boolArg) return null;
    return '(!(' + boolArg + '))';
  }
  if (node.type === 'BinaryExpression') {
    if (node.operator === '&&' || node.operator === '||') {
      const lhs2 = _ensureSmithCondBoolean(_lowerSmithCondOperand(node.left, ctx));
      const rhs2 = _ensureSmithCondBoolean(_lowerSmithCondOperand(node.right, ctx));
      if (!lhs2 || !rhs2) return null;
      return '(' + lhs2 + ')' + (node.operator === '&&' ? ' and ' : ' or ') + '(' + rhs2 + ')';
    }
    const lhs = _lowerSmithCondOperand(node.left, ctx);
    const rhs = _lowerSmithCondOperand(node.right, ctx);
    if (!lhs || !rhs) return null;
    return resolveComparison(lhs, normalizeOp(node.operator), rhs, ctx);
  }
  return null;
}

function _invertSmithCondExprAst(node, ctx) {
  if (!node) return null;
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    return _lowerSmithCondExprAst(node.argument, ctx);
  }
  if (node.type === 'LogicalExpression') {
    const lhs = _invertSmithCondExprAst(node.left, ctx);
    const rhs = _invertSmithCondExprAst(node.right, ctx);
    if (!lhs || !rhs) return null;
    return '(' + lhs + ')' + (node.operator === '&&' ? ' or ' : ' and ') + '(' + rhs + ')';
  }
  if (node.type === 'BinaryExpression') {
    var invertedOp = null;
    if (node.operator === '==') invertedOp = '!=';
    else if (node.operator === '===') invertedOp = '!==';
    else if (node.operator === '!=') invertedOp = '==';
    else if (node.operator === '!==') invertedOp = '===';
    else if (node.operator === '>') invertedOp = '<=';
    else if (node.operator === '>=') invertedOp = '<';
    else if (node.operator === '<') invertedOp = '>=';
    else if (node.operator === '<=') invertedOp = '>';
    if (invertedOp) {
      return _lowerSmithCondExprAst({
        type: 'BinaryExpression',
        operator: invertedOp,
        left: node.left,
        right: node.right
      }, ctx);
    }
  }
  const lowered = _lowerSmithCondExprAst(node, ctx);
  if (!lowered) return null;
  return '(!(' + lowered + '))';
}

function _parseSmithConditionExprFromTokens(c, start, end, ctx) {
  const expr = _smithExprSourceFromTokens(c, start, end, ctx);
  const ast = _parseSmithExprAst(expr);
  if (!ast) return null;
  if (ast.type !== 'BinaryExpression' && ast.type !== 'LogicalExpression' && ast.type !== 'UnaryExpression') return null;
  const lowered = _lowerSmithCondExprAst(ast, ctx);
  return lowered;
}

function _parseSmithInvertedConditionExprFromTokens(c, start, end, ctx) {
  const expr = _smithExprSourceFromTokens(c, start, end, ctx);
  const ast = _parseSmithExprAst(expr);
  if (!ast) return null;
  if (ast.type !== 'BinaryExpression' && ast.type !== 'LogicalExpression' && ast.type !== 'UnaryExpression') return null;
  return _invertSmithCondExprAst(ast, ctx);
}
