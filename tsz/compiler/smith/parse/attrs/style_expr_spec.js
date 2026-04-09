// ── Style expression spec helpers (from attrs.js) ──

function _styleSpecToExpr(spec) {
  if (!spec) return '0';
  if (spec.kind === 'expr') return spec.expr;
  if (spec.kind === 'literal') {
    if (spec.type === 'string') return _styleExprQuote(spec.value);
    if (spec.type === 'bool') return spec.value === 'false' ? 'false' : 'true';
    return spec.value;
  }
  return '0';
}

function _styleSpecBoolExpr(spec) {
  if (!spec) return '(false)';
  if (spec.kind === 'expr' && spec.type === 'bool') return spec.expr;
  return zigBool(_styleSpecToExpr(spec), ctx);
}

function _styleResolvedLiteral(type, value) {
  return { kind: 'literal', type: type, value: String(value) };
}

function _styleResolvedExpr(type, expr) {
  return { kind: 'expr', type: type || 'unknown', expr: String(expr) };
}

function _coerceResolvedStyleValue(rawValue) {
  if (rawValue === undefined || rawValue === null) return _styleResolvedExpr('number', '0');
  if (typeof rawValue !== 'string') return _styleResolvedLiteral('number', rawValue);
  var value = String(rawValue).trim();
  if (value.length === 0) return _styleResolvedLiteral('string', '');
  if (value === 'true' || value === 'false') return _styleResolvedLiteral('bool', value);
  if (/^-?\d+(\.\d+)?$/.test(value)) return _styleResolvedLiteral('number', value);
  if (value.startsWith('#') || namedColors[value]) return _styleResolvedLiteral('string', value);
  if (isEval(value)) return _styleResolvedExpr('qjs', value);
  if (_styleLooksBoolExpr(value)) return _styleResolvedExpr('bool', value);
  if (_styleLooksZigString(value)) return _styleResolvedExpr('string', value);
  if (_styleLooksZigExpr(value)) {
    if (value.includes('getSlotBool')) return _styleResolvedExpr('bool', value);
    return _styleResolvedExpr('number', value);
  }
  return _styleResolvedLiteral('string', value);
}

function _resolveNestedStylePropValue(rawValue, seen) {
  if (rawValue === undefined || rawValue === null) return _styleResolvedLiteral('number', 0);
  if (typeof rawValue !== 'string') return _coerceResolvedStyleValue(rawValue);
  var value = String(rawValue).trim();
  if (ctx.propsObjectName && value.indexOf(ctx.propsObjectName + '.') === 0) {
    var parts = value.split('.');
    if (parts.length === 2) {
      if (!seen) seen = {};
      if (seen[value]) return _styleResolvedExpr('unknown', value);
      seen[value] = true;
      if (ctx.propStack && ctx.propStack[parts[1]] !== undefined) return _resolveNestedStylePropValue(ctx.propStack[parts[1]], seen);
      return _styleResolvedLiteral('number', 0);
    }
  }
  return _coerceResolvedStyleValue(value);
}

function _resolveStyleIdentifierValue(name) {
  if (!name) return _styleResolvedExpr('unknown', '0');
  if (name === 'true' || name === 'false') return _styleResolvedLiteral('bool', name);

  if (name.indexOf('.') >= 0) {
    var parts = name.split('.');
    if (ctx.propsObjectName && parts[0] === ctx.propsObjectName && parts.length === 2 &&
        ctx.propStack) {
      return _resolveNestedStylePropValue(ctx.propStack[parts[1]]);
    }
    var baseName = parts[0];
    var fieldPath = parts.slice(1).join('_');
    var baseResolved = resolveIdentity(baseName, ctx);
    if ((baseResolved.kind === 'map_item' || baseResolved.kind === 'oa') && fieldPath.length > 0) {
      var fieldResolved = resolveField(baseResolved, fieldPath, ctx);
      if (fieldResolved) return _styleResolvedExpr(fieldResolved.type || 'number', fieldResolved.zigExpr);
    }
    if (baseResolved.kind === 'render_local' && ctx.currentMap && baseResolved.zigExpr === ctx.currentMap.itemParam) {
      var rlFieldResolved = resolveField({ kind: 'map_item', oa: ctx.currentMap.oa }, fieldPath, ctx);
      if (rlFieldResolved) return _styleResolvedExpr(rlFieldResolved.type || 'number', rlFieldResolved.zigExpr);
    }
  }

  var resolved = resolveIdentity(name, ctx);
  if (resolved.kind === 'slot') {
    var slotType = resolved.slot && resolved.slot.type === 'boolean' ? 'bool' : (resolved.slot && resolved.slot.type) || 'number';
    return _styleResolvedExpr(slotType, resolved.zigExpr);
  }
  if (resolved.kind === 'render_local' || resolved.kind === 'prop') {
    return _coerceResolvedStyleValue(resolved.zigExpr);
  }
  if (resolved.kind === 'map_index' || resolved.kind === 'parent_map_index') {
    return _styleResolvedExpr('number', resolved.zigExpr);
  }
  if (resolved.kind === 'map_item' || resolved.kind === 'oa') {
    return _styleResolvedExpr('unknown', name);
  }
  return _styleResolvedExpr('unknown', name);
}

function _resolveStyleObjectReference(name, seen) {
  if (!name) return null;
  if (!seen) seen = { names: {} };
  if (!seen.names) seen.names = {};
  if (seen.names[name]) return null;
  var raw = null;
  if (ctx._renderLocalRaw && ctx._renderLocalRaw[name] !== undefined) raw = ctx._renderLocalRaw[name];
  else if (ctx.renderLocals && typeof ctx.renderLocals[name] === 'string') raw = ctx.renderLocals[name];
  else if (name.indexOf('.') >= 0) {
    var parts = name.split('.');
    if (ctx.propsObjectName && parts[0] === ctx.propsObjectName && parts.length === 2 &&
        ctx.propStack && typeof ctx.propStack[parts[1]] === 'string') {
      raw = ctx.propStack[parts[1]];
    }
  }
  if (!raw) return null;
  var trimmed = _normalizeStyleExprJs(String(raw));
  if (name === 'props.style' || name === 'props.shellStyle') {
    print('[STYLE_OBJ_REF] name=' + name + ' raw=' + trimmed);
  }
  if (!(trimmed.startsWith('{') || trimmed.startsWith('(function') || trimmed.indexOf('?') >= 0)) return null;
  seen.names[name] = true;
  var parsed = _parseStyleExprFromRaw(trimmed, seen);
  if (name === 'props.style' || name === 'props.shellStyle') {
    print('[STYLE_OBJ_PARSED] name=' + name + ' ok=' + (parsed ? 1 : 0));
  }
  seen.names[name] = false;
  return parsed;
}
