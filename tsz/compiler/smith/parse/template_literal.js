// ── Template literal parsing ──────────────────────────────────────
// Rewired to use resolve layer (resolveIdentity, resolveField, buildEval).

function parseTemplateLiteral(raw) {
  // Split "text ${expr} more ${expr2}" into fmt string + args
  var fmt = '';
  var args = [];
  var i = 0;
  while (i < raw.length) {
    if (raw[i] === '$' && i + 1 < raw.length && raw[i + 1] === '{') {
      // Find matching }
      var j = i + 2;
      var depth = 1;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{') depth++;
        if (raw[j] === '}') depth--;
        j++;
      }
      var expr = raw.slice(i + 2, j - 1).trim();
      var result = _resolveTemplateExpr(expr);
      if (result.arg !== null) {
        fmt += result.spec;
        args.push(result.arg);
      } else {
        fmt += result.spec;
      }
      i = j;
    } else {
      fmt += raw[i] === '"' ? '\\"' : raw[i];
      i++;
    }
  }
  return { fmt: fmt, args: args };
}

function _resolveTemplateExpr(expr) {
  // 1. Simple identifier — resolve via identity layer
  if (/^[A-Za-z_]\w*$/.test(expr)) {
    return _resolveSimpleIdent(expr);
  }

  // 2. Identifier.length — resolve name then field
  if (expr.endsWith('.length')) {
    var baseName = expr.slice(0, -7);
    if (/^[A-Za-z_]\w*$/.test(baseName)) {
      var resolved = resolveIdentity(baseName, ctx);
      if (resolved.kind === 'oa') {
        return { spec: '{d}', arg: '@as(i64, @intCast(_oa' + resolved.oa.oaIdx + '_len))' };
      }
      if (resolved.kind === 'render_local') {
        if (ctx.scriptBlock || globalThis.__scriptContent) {
          return { spec: '{s}', arg: buildEval(expr, ctx) };
        }
        var lenResult = resolveField(resolved, 'length', ctx);
        if (lenResult.zigExpr) {
          return { spec: lenResult.type === 'string' ? '{s}' : '{d}', arg: lenResult.zigExpr };
        }
      }
      return { spec: expr, arg: null };
    }
  }

  // 3. Arithmetic expression: getter +/- N, getter + getter, etc.
  var arithMatch = expr.match(/^(\w+)\s*([+\-*\/%])\s*(.+)$/);
  if (arithMatch) {
    var lhsResolved = resolveIdentity(arithMatch[1], ctx);
    if (lhsResolved.kind === 'slot' || lhsResolved.kind === 'map_index') {
      var resolveArithIdent = function(w) {
        var r = resolveIdentity(w, ctx);
        if (r.zigExpr) return r.zigExpr;
        return w;
      };
      var resolvedExpr = expr.replace(/\b(\w+)\b/g, function(w) {
        return resolveArithIdent(w);
      });
      var op = arithMatch[2];
      if (op === '/' && !arithMatch[3].includes('+') && !arithMatch[3].includes('-')) {
        return { spec: '{d}', arg: '@divTrunc(' + resolveArithIdent(arithMatch[1]) + ', ' + resolveArithIdent(arithMatch[3].trim()) + ')' };
      }
      if (op === '%' && !arithMatch[3].includes('+') && !arithMatch[3].includes('-')) {
        return { spec: '{d}', arg: '@mod(' + resolveArithIdent(arithMatch[1]) + ', ' + resolveArithIdent(arithMatch[3].trim()) + ')' };
      }
      return { spec: '{d}', arg: resolvedExpr };
    }
  }

  // 4. Map item.field access (current map)
  if (ctx.currentMap && expr.startsWith(ctx.currentMap.itemParam + '.')) {
    return _resolveMapItemField(expr, ctx.currentMap);
  }

  // 5. Parent map item.field access
  if (ctx.currentMap && ctx.currentMap.parentMap && expr.startsWith(ctx.currentMap.parentMap.itemParam + '.')) {
    return _resolveMapItemField(expr, ctx.currentMap.parentMap);
  }

  // 6. Ternary expression
  if (expr.includes('?') && expr.includes(':')) {
    return _resolveTernaryExpr(expr);
  }

  // 7. Map-context wrapper functions and expressions
  if (ctx.currentMap) {
    return _resolveMapContextExpr(expr);
  }

  // 8. Function calls, logical ops, or script context → QuickJS eval
  if (expr.includes('(') || expr.includes('||') || expr.includes('&&') || ctx.scriptBlock || globalThis.__scriptContent) {
    var expanded = (typeof expandRenderLocalRawExpr === 'function' && ctx._renderLocalRaw)
      ? expandRenderLocalRawExpr(expr) : expr;
    return { spec: '{s}', arg: buildEval(expanded, ctx) };
  }

  // 9. Non-resolvable — embed as literal text
  return { spec: expr, arg: null };
}

function _resolveSimpleIdent(expr) {
  var resolved = resolveIdentity(expr, ctx);
  switch (resolved.kind) {
    case 'slot':
      return {
        spec: (resolved.slot.type === 'string') ? '{s}' : '{d}',
        arg: resolved.zigExpr
      };
    case 'render_local':
      var rlVal = resolved.zigExpr;
      var isNum = /^-?\d+(\.\d+)?$/.test(rlVal);
      if (resolved.type === 'qjs_eval') {
        return { spec: '{s}', arg: rlVal };
      }
      if (isNum) {
        return { spec: '{d}', arg: rlVal };
      }
      var isZigExpr = rlVal.includes('state.get') || rlVal.includes('getSlot') || rlVal.includes('_oa') || rlVal.includes('@as');
      var isStringArray = isZigExpr && rlVal.includes('[') && rlVal.includes('..');
      if (isStringArray) {
        return { spec: '{s}', arg: rlVal };
      }
      if (isZigExpr) {
        return { spec: '{d}', arg: leftFoldExpr(rlVal) };
      }
      return { spec: rlVal, arg: null };
    case 'prop':
      var propVal = resolved.zigExpr;
      var isPropNum = /^-?\d+(\.\d+)?$/.test(propVal);
      var isPropZig = typeof propVal === 'string' && (propVal.includes('state.get') || propVal.includes('getSlot') || propVal.includes('_oa') || propVal.includes('@as'));
      var isPropStr = isPropZig && propVal.includes('[') && propVal.includes('..');
      if (isPropNum) {
        return { spec: '{d}', arg: propVal };
      }
      if (isPropStr) {
        return { spec: '{s}', arg: propVal };
      }
      if (isPropZig) {
        return { spec: '{d}', arg: leftFoldExpr(propVal) };
      }
      return { spec: '{s}', arg: '"' + propVal + '"' };
    case 'map_index':
    case 'parent_map_index':
      return { spec: '{d}', arg: resolved.zigExpr };
    case 'map_item':
      // Bare item name without .field → treat as index
      var iv = ctx.currentMap ? (ctx.currentMap.iterVar || '_i') : '_i';
      return { spec: '{d}', arg: '@as(i64, @intCast(' + iv + '))' };
    default:
      return { spec: expr, arg: null };
  }
}

function _resolveMapItemField(expr, mapCtx) {
  var fieldPart = expr.slice(mapCtx.itemParam.length + 1);
  var oa = mapCtx.oa;
  var iv = mapCtx.iterVar || '_i';

  // Handle item.field || 'fallback' — logical OR with string default
  var orFallback = null;
  var orMatch = fieldPart.match(/^(\w+)\s*\|\|\s*['"]([^'"]*)['"]\s*$/);
  if (orMatch) {
    fieldPart = orMatch[1];
    orFallback = orMatch[2];
  }

  var fi = oa ? oa.fields.find(function(f) { return f.name === fieldPart; }) : null;
  if (fi) {
    var oaIdx = oa.oaIdx;
    if (fi.type === 'string') {
      var arg;
      if (orFallback !== null) {
        arg = 'if (_oa' + oaIdx + '_' + fieldPart + '_lens[' + iv + '] > 0) _oa' + oaIdx + '_' + fieldPart + '[' + iv + '][0.._oa' + oaIdx + '_' + fieldPart + '_lens[' + iv + ']] else "' + orFallback + '"';
      } else {
        arg = '_oa' + oaIdx + '_' + fieldPart + '[' + iv + '][0.._oa' + oaIdx + '_' + fieldPart + '_lens[' + iv + ']]';
      }
      return { spec: '{s}', arg: arg };
    }
    return { spec: '{d}', arg: '_oa' + oaIdx + '_' + fieldPart + '[' + iv + ']' };
  }
  return { spec: expr, arg: null };
}

function _resolveTernaryExpr(expr) {
  var result = _parseTernaryExpr(expr);
  if (!result.isLiteral) {
    return { spec: result.spec, arg: result.zigExpr };
  }
  return { spec: '{s}', arg: buildEval(expr, ctx) };
}

function _parseTernaryExpr(e) {
  var qIdx = e.indexOf('?');
  if (qIdx < 0) return { isLiteral: true, value: e.trim() };
  var condStr = e.slice(0, qIdx).trim();
  var rest = e.slice(qIdx + 1);
  var depth = 0;
  var colonIdx = -1;
  for (var ci = 0; ci < rest.length; ci++) {
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
  var trueStr = rest.slice(0, colonIdx).trim();
  var falseStr = rest.slice(colonIdx + 1).trim();

  // Build Zig condition — resolve identifiers via resolve layer
  var condZig = condStr;
  // Resolve OA .length → _oaN_len (before getter resolution to avoid partial match)
  for (var oi = 0; oi < ctx.objectArrays.length; oi++) {
    var oa = ctx.objectArrays[oi];
    if (condZig.includes(oa.getter + '.length')) {
      condZig = condZig.replace(new RegExp('\\b' + oa.getter + '\\.length\\b', 'g'), '_oa' + oa.oaIdx + '_len');
    }
  }
  for (var si = 0; si < ctx.stateSlots.length; si++) {
    var s = ctx.stateSlots[si];
    if (condStr.includes(s.getter)) {
      condZig = condZig.replace(new RegExp('\\b' + s.getter + '\\b', 'g'), slotGet(s.getter));
    }
  }
  condZig = condZig.replace(/===/g, '==').replace(/!==/g, '!=');

  var tv = stripQuotes(trueStr);
  var fv = stripQuotes(falseStr);
  if (tv !== null && fv !== null) {
    return { isLiteral: false, zigExpr: zigTernary('(' + condZig + ')', '"' + tv + '"', '"' + fv + '"', 'text'), spec: '{s}' };
  }
  var fvParsed = _parseTernaryExpr(falseStr);
  if (tv !== null && !fvParsed.isLiteral) {
    return { isLiteral: false, zigExpr: 'if (' + condZig + ') "' + tv + '" else ' + fvParsed.zigExpr, spec: '{s}' };
  }
  if (/^-?\d+$/.test(trueStr) && /^-?\d+$/.test(falseStr)) {
    return { isLiteral: false, zigExpr: zigTernary('(' + condZig + ')', trueStr, falseStr, 'number'), spec: '{d}' };
  }
  return { isLiteral: true, value: e.trim() };
}

function _resolveMapContextExpr(expr) {
  // Wrapper function call: String(item.field), formatX(item.field)
  var wrapper = expr.match(/^([A-Za-z_]\w*)\(([^(),]+)\)$/);
  if (wrapper && /^(String|format[A-Z]\w*)$/.test(wrapper[1])) {
    var innerExpr = wrapper[2].trim();
    if (ctx.currentMap && innerExpr.startsWith(ctx.currentMap.itemParam + '.')) {
      var field = innerExpr.slice(ctx.currentMap.itemParam.length + 1).replace(/\./g, '_');
      var oa = ctx.currentMap.oa;
      var fi = oa ? oa.fields.find(function(f) { return f.name === field; }) : null;
      var iv = ctx.currentMap.iterVar || '_i';
      if (fi && fi.type === 'string') {
        return { spec: '{s}', arg: '_oa' + oa.oaIdx + '_' + field + '[' + iv + '][0.._oa' + oa.oaIdx + '_' + field + '_lens[' + iv + ']]' };
      }
      if (fi) {
        return { spec: '{d}', arg: '_oa' + oa.oaIdx + '_' + field + '[' + iv + ']' };
      }
      return { spec: expr, arg: null };
    }
    // Wrapper around render-local
    var innerResolved = resolveIdentity(innerExpr, ctx);
    if (innerResolved.kind === 'render_local') {
      var rlVal = innerResolved.zigExpr;
      var isStringArray = typeof rlVal === 'string' && rlVal.includes('[') && rlVal.includes('..');
      if (isStringArray) {
        return { spec: '{s}', arg: rlVal };
      }
      return { spec: '{d}', arg: leftFoldExpr(rlVal) };
    }
    return { spec: expr, arg: null };
  }

  // Function call expression in map context → QuickJS eval
  if (expr.includes('(') && expr.includes(')')) {
    return { spec: '{s}', arg: buildEval(expr, ctx) };
  }

  // Non-resolvable — literal text
  return { spec: expr, arg: null };
}
