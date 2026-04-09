// ── Pending style expressions (from attrs.js) ──

function _pendingStyleFieldMeta(key) {
  if (colorKeys[key]) return { target: 'style', field: colorKeys[key], type: 'color' };
  if (styleKeys[key]) return { target: 'style', field: styleKeys[key], type: 'number' };
  if (enumKeys[key]) return { target: 'style', field: enumKeys[key].field, type: 'enum', values: enumKeys[key].values };
  if (key === 'fontSize') return { target: 'node', field: 'font_size', type: 'number' };
  if (key === 'color') return { target: 'node', field: 'text_color', type: 'color' };
  return null;
}

function _pendingStyleFieldEntryIndex(fields, field) {
  var target = '.' + field;
  for (var i = 0; i < fields.length; i++) {
    if (typeof fields[i] !== 'string') continue;
    var eq = fields[i].indexOf(' = ');
    if (eq < 0) continue;
    if (fields[i].slice(0, eq).trim() === target) return i;
  }
  return -1;
}

function _pendingStyleFieldExpr(fields, field) {
  var idx = _pendingStyleFieldEntryIndex(fields, field);
  if (idx < 0) return null;
  return fields[idx].slice(fields[idx].indexOf(' = ') + 3);
}

function _pendingStyleSetField(fields, field, expr) {
  var entry = '.' + field + ' = ' + expr;
  var idx = _pendingStyleFieldEntryIndex(fields, field);
  if (idx >= 0) fields[idx] = entry;
  else fields.push(entry);
}

function _pendingStylePlaceholder(meta) {
  if (!meta) return '0';
  if (meta.type === 'color') return 'Color{}';
  if (meta.type === 'enum') return '.none';
  return '0';
}

function _pendingStyleLiteralExpr(spec, meta, asBranch) {
  if (!spec || spec.kind !== 'literal') return _pendingStylePlaceholder(meta);
  if (meta.type === 'color') return parseColor(spec.value);
  if (meta.type === 'enum') {
    return (meta.values && meta.values[spec.value]) ? meta.values[spec.value] : _pendingStylePlaceholder(meta);
  }
  if (meta.type === 'number') {
    if (spec.type === 'string' && spec.value.startsWith('theme-')) {
      var resolved = resolveThemeToken(spec.value);
      return asBranch ? '@as(f32, ' + resolved + ')' : String(resolved);
    }
    if (spec.type === 'string' && spec.value.endsWith('%')) {
      var pct = parseFloat(spec.value);
      var pctVal = String(-(pct / 100));
      return asBranch ? '@as(f32, ' + pctVal + ')' : pctVal;
    }
    return asBranch ? '@as(f32, ' + spec.value + ')' : spec.value;
  }
  return spec.value;
}

function _pendingStyleExprValue(spec, meta, asBranch) {
  if (!spec || spec.kind !== 'expr') return _pendingStylePlaceholder(meta);
  if (meta.type === 'color') {
    if (spec.type === 'string') return 'Color.fromHex(' + spec.expr + ')';
    return spec.expr;
  }
  if (meta.type === 'number') {
    if (/^-?\d+(\.\d+)?$/.test(spec.expr)) return asBranch ? '@as(f32, ' + spec.expr + ')' : spec.expr;
    return spec.expr;
  }
  if (meta.type === 'enum') return spec.expr;
  return spec.expr;
}

function _pendingStyleSpecExpr(spec, meta, asBranch) {
  if (!spec) return _pendingStylePlaceholder(meta);
  if (spec.kind === 'literal') return _pendingStyleLiteralExpr(spec, meta, asBranch);
  if (spec.kind === 'expr') return _pendingStyleExprValue(spec, meta, asBranch);
  if (spec.kind === 'conditional') {
    return 'if ' + spec.condExpr + ' ' +
      _pendingStyleSpecExpr(spec.whenTrue, meta, true) +
      ' else ' +
      _pendingStyleSpecExpr(spec.whenFalse, meta, true);
  }
  return _pendingStylePlaceholder(meta);
}

function _pendingStyleSpecIsBase(spec, baseExpr) {
  if (!spec) return true;
  if (spec.kind !== 'expr') return false;
  return spec.expr === baseExpr;
}

function applyPendingStyleExprs(state) {
  if (!state || !state.pendingStyleExprs || state.pendingStyleExprs.length === 0) return;
  for (var pei = 0; pei < state.pendingStyleExprs.length; pei++) {
    var exprAst = state.pendingStyleExprs[pei];
    var keyMap = _styleExprCollectKeys(exprAst, {});
    for (var jsxKey in keyMap) {
      var meta = _pendingStyleFieldMeta(jsxKey);
      if (!meta) continue;
      var targetFields = meta.target === 'node' ? state.nodeFields : state.styleFields;
      var currentExpr = _pendingStyleFieldExpr(targetFields, meta.field);
      var baseExpr = currentExpr !== null ? currentExpr : _pendingStylePlaceholder(meta);
      var resolvedSpec = _styleExprResolveField(exprAst, jsxKey, _styleResolvedExpr(meta.type, baseExpr));
      if (!resolvedSpec || _pendingStyleSpecIsBase(resolvedSpec, baseExpr)) continue;
      print('[STYLE_EXPR_APPLY] key=' + jsxKey + ' field=' + meta.field + ' kind=' + resolvedSpec.kind);
      if (resolvedSpec.kind === 'conditional' || resolvedSpec.kind === 'expr') {
        if (currentExpr === null) _pendingStyleSetField(targetFields, meta.field, _pendingStylePlaceholder(meta));
        if (!ctx.dynStyles) ctx.dynStyles = [];
        var dynId = ctx.dynStyles.length;
        ctx.dynStyles.push({
          field: meta.field,
          expression: _pendingStyleSpecExpr(resolvedSpec, meta, resolvedSpec.kind === 'conditional'),
          arrName: '',
          arrIndex: -1,
          isColor: meta.type === 'color',
        });
        if (!targetFields._dynStyleIds) targetFields._dynStyleIds = [];
        targetFields._dynStyleIds.push(dynId);
      } else {
        _pendingStyleSetField(targetFields, meta.field, _pendingStyleSpecExpr(resolvedSpec, meta, false));
      }
    }
  }
  state.pendingStyleExprs = [];
}
