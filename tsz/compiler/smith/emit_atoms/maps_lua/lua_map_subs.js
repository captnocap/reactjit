// ── Lua map substitutions ───────────────────────────────────────
// The ONLY translations from .tsz expressions to Lua expressions.
// Every other maps_lua file uses these. Nothing else does translations.

function _hexToLua(hex) {
  if (hex.charAt(0) === '#') return '0x' + hex.slice(1);
  if (hex.charAt(0) === "'" || hex.charAt(0) === '"') {
    var inner = hex.slice(1, -1);
    if (inner.charAt(0) === '#') return '0x' + inner.slice(1);
  }
  return hex;
}

function _camelToSnake(s) {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function _unwrapQuotedDynamicExpr(expr) {
  return expr.replace(/"((?:[^"\\]|\\.)*)"/g, function(full, inner) {
    var decoded = inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (/^\(+.*(?:==|~=|>=|<=|&&|\|\||\band\b|\bor\b|\?|:).*\)+$/.test(decoded.trim())) {
      if (full.indexOf('widget') >= 0 || decoded.indexOf('widget') >= 0) {
        var widx = decoded.indexOf('widget');
        print('[UNWRAP_TRACE] FIRED. full[0..60]=' + JSON.stringify(full.slice(0,60)) + ' decoded around widget=' + JSON.stringify(decoded.slice(Math.max(0,widx-30), widx+30)));
      }
      return decoded;
    }
    return full;
  });
}

function _convertSimpleJsTernary(expr) {
  for (var _ti = 0; _ti < 8; _ti++) {
    var next = expr.replace(
      /\(([^()?:]+(?:\s+(?:and|or)\s+[^()?:]+)*)\s*\?\s*("[^"]*"|'[^']*'|\d+)\s*:\s*("[^"]*"|'[^']*'|\d+)\)/g,
      '(($1) and $2 or $3)'
    );
    next = next.replace(
      /(^|[=(]\s*)([^?:()]+?)\s*\?\s*([^:]+?)\s*:\s*([^)=]+)(?=$|[),])/g,
      function(_, prefix, cond, whenTrue, whenFalse) {
        return prefix + '((' + cond.trim() + ') and (' + whenTrue.trim() + ') or (' + whenFalse.trim() + '))';
      }
    );
    if (next === expr) break;
    expr = next;
  }
  return expr;
}

function _collapseRedundantParens(expr) {
  for (var _pi = 0; _pi < 8; _pi++) {
    var next = expr.replace(/\(\s*\(([^()]+)\)\s*\)/g, '($1)');
    if (next === expr) break;
    expr = next;
  }
  return expr;
}

function _simplifyBoolNumericComparison(expr) {
  function _boolCmp(lhs, op, rhs) {
    lhs = lhs.trim();
    if (lhs === 'true') {
      if ((op === '==' && rhs === '1') || (op === '~=' && rhs === '0')) return 'true';
      if ((op === '~=' && rhs === '1') || (op === '==' && rhs === '0')) return 'false';
    }
    if (lhs === 'false') {
      if ((op === '==' && rhs === '1') || (op === '~=' && rhs === '0')) return 'false';
      if ((op === '~=' && rhs === '1') || (op === '==' && rhs === '0')) return 'true';
    }
    if ((op === '==' && rhs === '1') || (op === '~=' && rhs === '0')) return '(' + lhs + ')';
    if ((op === '~=' && rhs === '1') || (op === '==' && rhs === '0')) return '(not (' + lhs + '))';
    return '(' + lhs + ' ' + op + ' ' + rhs + ')';
  }

  for (var _bi = 0; _bi < 8; _bi++) {
    var next = expr
      .replace(/\(\s*([^()]+(?:==|~=| and | or |not [^()]+)[^()]*)\s*\)\s*(==|~=)\s*(0|1)\b/g, function(_, lhs, op, rhs) {
        return _boolCmp(lhs, op, rhs);
      })
      .replace(/((?:\b[\w.]+\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+)\s*(?:==|~=|>=|<=|>|<)\s*(?:\b[\w.]+\b|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+))\s*(==|~=)\s*(0|1)\b/g, function(_, lhs, op, rhs) {
        return _boolCmp(lhs, op, rhs);
      })
      .replace(/\b(true|false)\b\s*(==|~=)\s*(0|1)\b/g, function(_, lhs, op, rhs) {
        return _boolCmp(lhs, op, rhs);
      });
    if (next === expr) break;
    expr = next;
  }
  return expr;
}

function _normalizeEmbeddedJsEvalForLua(expr) {
  if (!expr || expr.indexOf('__eval("') < 0) return expr;
  return expr.replace(/__eval\("((?:[^"\\]|\\.)*)"\)/g, function(_, inner) {
    var jsExpr = inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\b/g, '!')
      .replace(/~=/g, '!=')
      .replace(/\.len\b/g, '.length');
    return '__eval("' + jsExpr.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '")';
  });
}

function _protectEmbeddedJsEvalForLua(expr) {
  var protectedExprs = [];
  if (!expr || expr.indexOf('__eval("') < 0) return { expr: expr, protectedExprs: protectedExprs };
  var out = expr.replace(/__eval\("((?:[^"\\]|\\.)*)"\)/g, function(full) {
    var slot = '__JS_EVAL_SLOT_' + protectedExprs.length + '__';
    protectedExprs.push(_normalizeEmbeddedJsEvalForLua(full));
    return slot;
  });
  return { expr: out, protectedExprs: protectedExprs };
}

function _restoreEmbeddedJsEvalForLua(expr, protectedExprs) {
  if (!protectedExprs || protectedExprs.length === 0) return expr;
  return expr.replace(/__JS_EVAL_SLOT_(\d+)__/g, function(_, idx) {
    var restored = protectedExprs[+idx];
    return restored === undefined ? '' : restored;
  });
}

function _isLuaStringLiteral(expr) {
  return /^"(?:[^"\\]|\\.)*"$/.test(expr) || /^'(?:[^'\\]|\\.)*'$/.test(expr);
}

function _splitTopLevelPlus(expr) {
  var parts = [];
  var cur = '';
  var quote = '';
  var escape = false;
  var paren = 0;
  var bracket = 0;
  var brace = 0;
  for (var i = 0; i < expr.length; i++) {
    var ch = expr.charAt(i);
    if (quote) {
      cur += ch;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')' && paren > 0) paren--;
    else if (ch === '[') bracket++;
    else if (ch === ']' && bracket > 0) bracket--;
    else if (ch === '{') brace++;
    else if (ch === '}' && brace > 0) brace--;
    if (paren === 0 && bracket === 0 && brace === 0 && ch === '+') {
      var prev = i > 0 ? expr.charAt(i - 1) : '';
      var next = i + 1 < expr.length ? expr.charAt(i + 1) : '';
      if (prev !== '+' && next !== '+' && prev !== '=' && next !== '=' && prev !== 'e' && prev !== 'E') {
        parts.push(cur.trim());
        cur = '';
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim().length > 0) parts.push(cur.trim());
  return parts;
}

function _hasTopLevelConcatUnsafeOps(expr) {
  var quote = '';
  var escape = false;
  var paren = 0;
  var bracket = 0;
  var brace = 0;
  for (var i = 0; i < expr.length; i++) {
    var ch = expr.charAt(i);
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') paren++;
    else if (ch === ')' && paren > 0) paren--;
    else if (ch === '[') bracket++;
    else if (ch === ']' && bracket > 0) bracket--;
    else if (ch === '{') brace++;
    else if (ch === '}' && brace > 0) brace--;
    if (paren !== 0 || bracket !== 0 || brace !== 0) continue;
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      var j = i + 1;
      while (j < expr.length) {
        var next = expr.charAt(j);
        if (!((next >= 'a' && next <= 'z') || (next >= 'A' && next <= 'Z') || (next >= '0' && next <= '9') || next === '_')) break;
        j++;
      }
      var word = expr.substring(i, j);
      if (word === 'and' || word === 'or') return true;
      i = j - 1;
      continue;
    }
    if (ch === '?' || ch === ':' || ch === '*' || ch === '/' || ch === '%' || ch === '<' || ch === '>' || ch === '=' || ch === '&' || ch === '|' || ch === '^') {
      return true;
    }
  }
  return false;
}

function _isWrappedByOuterParens(expr) {
  if (!expr || expr.charAt(0) !== '(' || expr.charAt(expr.length - 1) !== ')') return false;
  var quote = '';
  var escape = false;
  var depth = 0;
  for (var i = 0; i < expr.length; i++) {
    var ch = expr.charAt(i);
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0 && i < expr.length - 1) return false;
    }
  }
  return depth === 0;
}

function _stripOuterParens(expr) {
  var out = expr.trim();
  while (_isWrappedByOuterParens(out)) out = out.substring(1, out.length - 1).trim();
  return out;
}

function _rewriteJsStringConcatNode(expr, depth) {
  if (!expr) return { expr: expr, isConcat: false, hasString: false };
  if (depth > 12) return { expr: expr, isConcat: false, hasString: false };
  var stripped = _stripOuterParens(expr);
  var parts = _splitTopLevelPlus(stripped);
  if (parts.length < 2 || _hasTopLevelConcatUnsafeOps(stripped)) {
    return { expr: stripped, isConcat: false, hasString: _isLuaStringLiteral(stripped) };
  }

  var hasString = false;
  var rewritten = [];
  for (var i = 0; i < parts.length; i++) {
    var child = _rewriteJsStringConcatNode(parts[i], depth + 1);
    if (child.hasString || child.isConcat || _isLuaStringLiteral(child.expr)) hasString = true;
    rewritten.push(child);
  }
  if (!hasString) return { expr: stripped, isConcat: false, hasString: false };

  var luaParts = [];
  for (var j = 0; j < rewritten.length; j++) {
    var partExpr = rewritten[j].expr.trim();
    if (partExpr.length === 0) return { expr: stripped, isConcat: false, hasString: false };
    if (rewritten[j].isConcat || _isLuaStringLiteral(partExpr) || /^tostring\(([\s\S]+)\)$/.test(partExpr)) luaParts.push(partExpr);
    else luaParts.push('tostring(' + partExpr + ')');
  }
  return { expr: luaParts.join(' .. '), isConcat: true, hasString: true };
}

function _rewriteJsStringConcatToLua(expr) {
  if (!expr || expr.indexOf('+') < 0) return expr;
  var rewritten = _rewriteJsStringConcatNode(expr, 0);
  return rewritten.isConcat ? rewritten.expr : expr;
}

function _findObjectArrayByIdx(oaIdx) {
  if (!ctx || !ctx.objectArrays || oaIdx === undefined || oaIdx === null) return null;
  for (var i = 0; i < ctx.objectArrays.length; i++) {
    if (+ctx.objectArrays[i].oaIdx === +oaIdx) return ctx.objectArrays[i];
  }
  return null;
}

function _normalizeFlatItemFieldAccess(expr, itemVar, oaIdx) {
  if (!expr || !itemVar) return expr;
  var oa = _findObjectArrayByIdx(oaIdx);
  if (!oa || !oa.fields || !oa.fields.length) return expr;
  var fieldSet = {};
  for (var fi = 0; fi < oa.fields.length; fi++) fieldSet[oa.fields[fi].name] = true;
  var itemPattern = new RegExp('\\b' + itemVar + '\\s*\\.\\s*([A-Za-z_]\\w*(?:\\s*\\.\\s*[A-Za-z_]\\w+)+)', 'g');
  return expr.replace(itemPattern, function(full, chain) {
    var segments = chain.split(/\s*\.\s*/g).filter(Boolean);
    if (segments.length < 2) return full;
    var flat = segments.join('_');
    if (!fieldSet[flat]) return full;
    return itemVar + '.' + flat;
  });
}

function _normalizePropValueForLua(propValue, _luaIdxExpr, _currentOaIdx) {
  if (typeof propValue !== 'string') return String(propValue);
  var _pv = propValue;
  if (_pv.charCodeAt && _pv.charCodeAt(0) === 2) {
    // Whole map item passed through an inlined component prop.
    // In Lua-tree emit we bind the active item to `_item`/`_nitem`, not the
    // original JS callback param name stored in the marker.
    return _luaIdxExpr === '(_ni - 1)' ? '_nitem' : '_item';
  }
  _pv = _pv.replace(/_oa(\d+)_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, function(_, oaIdx, field) {
    if (_currentOaIdx !== undefined && _currentOaIdx !== null && +oaIdx === +_currentOaIdx) return '_nitem.' + field;
    var _oa = ctx && ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.oaIdx === +oaIdx; }) : null;
    return _oa ? (_oa.getter + '[_ni].' + field) : ('_nitem.' + field);
  });
  _pv = _pv.replace(/_oa(\d+)_(\w+)\[_j\]/g, function(_, oaIdx, field) {
    if (_currentOaIdx !== undefined && _currentOaIdx !== null && +oaIdx === +_currentOaIdx) return '_nitem.' + field;
    var _oa = ctx && ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.oaIdx === +oaIdx; }) : null;
    return _oa ? (_oa.getter + '[_ni].' + field) : ('_nitem.' + field);
  });
  _pv = _pv.replace(/_oa(\d+)_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, function(_, oaIdx, field) {
    if (_currentOaIdx !== undefined && _currentOaIdx !== null && +oaIdx === +_currentOaIdx) return '_item.' + field;
    var _oa = ctx && ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.oaIdx === +oaIdx; }) : null;
    return _oa ? (_oa.getter + '[_i].' + field) : ('_item.' + field);
  });
  _pv = _pv.replace(/_oa(\d+)_(\w+)\[_i\]/g, function(_, oaIdx, field) {
    if (_currentOaIdx !== undefined && _currentOaIdx !== null && +oaIdx === +_currentOaIdx) return '_item.' + field;
    var _oa = ctx && ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.oaIdx === +oaIdx; }) : null;
    return _oa ? (_oa.getter + '[_i].' + field) : ('_item.' + field);
  });
  if (/@as\(i64,\s*@intCast\((_\w+)\)\)/.test(_pv)) {
    _pv = _pv.replace(/@as\(i64,\s*@intCast\((_\w+)\)\)/g, function(_, v) {
      if (v === '_i') return '(_i - 1)';
      if (_luaIdxExpr) return _luaIdxExpr;
      return '(' + v + ' - 1)';
    });
  }
  for (var _ci2 = 0; _ci2 < 3; _ci2++) {
    _pv = _pv.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
    _pv = _pv.replace(/@intCast\(([^)]+)\)/g, '$1');
    _pv = _pv.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
  }
  return _pv;
}

function _getMapIdentity(_luaIdxExpr) {
  // Determine canonical map identity variables based on context
  // _luaIdxExpr === '(_ni - 1)' indicates nested map context
  var isNested = _luaIdxExpr === '(_ni - 1)';
  return {
    itemVar: isNested ? '_nitem' : '_item',
    idxVar: isNested ? '_ni' : '_i',
    idxExpr: _luaIdxExpr || '(_i - 1)'
  };
}

// Resolve OA field reference to the correct item variable based on map context
function _resolveOaFieldRef(oaIdx, field, _luaIdxExpr, _currentOaIdx) {
  var id = _getMapIdentity(_luaIdxExpr);
  // If this OA matches the current map context, use canonical item variable
  if (_currentOaIdx !== undefined && _currentOaIdx !== null && +oaIdx === +_currentOaIdx) {
    return id.itemVar + '.' + field;
  }
  // Otherwise fall back to OA getter lookup
  var _oa = ctx && ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.oaIdx === +oaIdx; }) : null;
  if (_oa) {
    return _oa.getter + '[' + id.idxVar + '].' + field;
  }
  return id.itemVar + '.' + field;
}

function _jsExprToLua(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var _origExpr = expr;
  var _hasW = typeof expr === 'string' && expr.indexOf('widget') >= 0;
  if (_hasW) {
    var _wi0 = expr.indexOf('widget');
    print('[J2L_IN] around widget: ' + JSON.stringify(expr.slice(Math.max(0,_wi0-30), _wi0+30)));
  }
  var id = _getMapIdentity(_luaIdxExpr);
  var _idxExpr = id.idxExpr;
  
  if (typeof expandRenderLocalRawExpr === 'function' && ctx && ctx._renderLocalRaw) {
    expr = expandRenderLocalRawExpr(expr);
  }
  // Replace callback param names with canonical item variable (_item or _nitem)
  if (itemParam) expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), id.itemVar);
  if (indexParam) expr = expr.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), _idxExpr);
  
  // Resolve props from inlined components
  if (ctx && ctx.propStack && ctx.propsObjectName) {
    expr = expr.replace(new RegExp('\\b' + ctx.propsObjectName + '\\.(\\w+)\\b', 'g'), function(_, field) {
      if (ctx.propStack[field] === undefined) return ctx.propsObjectName + '.' + field;
      return _normalizePropValueForLua(ctx.propStack[field], _luaIdxExpr, _currentOaIdx);
    });
  }
  // Resolve whole-item props (marker char \x02)
  if (ctx && ctx.propStack) {
    for (var _pkf in ctx.propStack) {
      var _pvf = ctx.propStack[_pkf];
      if (typeof _pvf === 'string' && _pvf.charCodeAt && _pvf.charCodeAt(0) === 2) {
        var _itemRef = _normalizePropValueForLua(_pvf, _luaIdxExpr, _currentOaIdx);
        expr = expr.replace(new RegExp('\\b' + _pkf + '\\s*\\.\\s*(\\w+)\\b', 'g'), _itemRef + '.$1');
      }
    }
  }
  // Resolve component props
  if (ctx && ctx.propStack) {
    for (var _pk in ctx.propStack) {
      if (new RegExp('\\b' + _pk + '\\b').test(expr)) {
        expr = expr.replace(new RegExp('\\b' + _pk + '\\b', 'g'), _normalizePropValueForLua(ctx.propStack[_pk], _luaIdxExpr, _currentOaIdx));
      }
    }
  }
  // OA array access with field: arr[idx].field → arr[(idx + 1)].field
  if (typeof ctx !== 'undefined' && ctx.objectArrays) {
    expr = expr.replace(/\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*\.\s*([A-Za-z_]\w+)\b/g, function(full, arrName, idxExpr, field) {
      var _oaArr = null;
      for (var _oi = 0; _oi < ctx.objectArrays.length; _oi++) {
        if (ctx.objectArrays[_oi].getter === arrName) { _oaArr = ctx.objectArrays[_oi]; break; }
      }
      if (!_oaArr) return full;
      return arrName + '[((' + idxExpr.trim() + ') + 1)].' + field;
    });
    expr = expr.replace(/\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\b/g, function(full, arrName, idxExpr) {
      var _oaArr2 = null;
      for (var _oi2 = 0; _oi2 < ctx.objectArrays.length; _oi2++) {
        if (ctx.objectArrays[_oi2].getter === arrName) { _oaArr2 = ctx.objectArrays[_oi2]; break; }
      }
      if (!_oaArr2) return full;
      return arrName + '[((' + idxExpr.trim() + ') + 1)]';
    });
  }
  // Pure JS→Lua conversion is done by sanitize_for_lua.js (one source of truth).
  // This function only handles context-dependent resolution below.

  // OA length refs: _oa0_len → #getter_name
  if (typeof ctx !== 'undefined' && ctx.objectArrays) {
    expr = expr.replace(/_oa(\d+)_len\b/g, function(_, oaIdx) {
      var _oa = ctx.objectArrays[+oaIdx];
      return _oa ? '#' + _oa.getter : '#_oa' + oaIdx;
    });
  }
  // OA field refs: unified through _resolveOaFieldRef
  expr = expr.replace(/_oa(\d+)_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, function(_, oaIdx, field) {
    return _resolveOaFieldRef(oaIdx, field, _luaIdxExpr, _currentOaIdx);
  });
  expr = expr.replace(/_oa(\d+)_(\w+)\[_i\]/g, function(_, oaIdx, field) {
    return _resolveOaFieldRef(oaIdx, field, _luaIdxExpr, _currentOaIdx);
  });
  expr = expr.replace(/_oa(\d+)_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, function(_, oaIdx, field) {
    return _resolveOaFieldRef(oaIdx, field, '(_ni - 1)', _currentOaIdx);
  });
  expr = expr.replace(/_oa(\d+)_(\w+)\[_j\]/g, function(_, oaIdx, field) {
    return _resolveOaFieldRef(oaIdx, field, '(_ni - 1)', _currentOaIdx);
  });
  // Flat field access normalization (for nested fields like _item.foo_bar)
  expr = _normalizeFlatItemFieldAccess(expr, id.itemVar, _currentOaIdx);
  if (id.itemVar === '_nitem') {
    expr = _normalizeFlatItemFieldAccess(expr, '_item', _currentOaIdx);
  }
  // Zig inner map iterator _j → Lua _ni
  expr = expr.replace(/\b_j\b/g, '_ni');
  // .len → # (Lua length operator)
  expr = expr.replace(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)*)\.len\b/g, '#$1');
  expr = expr.replace(/([A-Za-z_]\w*\[[^\]]+\]\.[A-Za-z_]\w+)\.len\b/g, '#$1');
  expr = expr.replace(/([A-Za-z_]\w*\[[^\]]+\]\.[A-Za-z_]\w+)\.length\b/g, '#$1');
  expr = expr.replace(/([A-Za-z_]\w*)\.\#([A-Za-z_]\w+)/g, '#$1.$2');
  expr = expr.replace(/([A-Za-z_]\w*\[[^\]]+\])\.\#([A-Za-z_]\w+)/g, '#$1.$2');
  // Index variable comparison normalization
  if (_idxExpr) {
    expr = expr.replace(/([=!<>]=?)\s*_i\b/g, '$1 ' + _idxExpr);
    expr = expr.replace(/\b_i\s*([=!<>]=?)/g, _idxExpr + ' $1');
    expr = expr.replace(/([=!<>]=?)\s*_ni\b/g, '$1 (_ni - 1)');
    expr = expr.replace(/\b_ni\s*([=!<>]=?)/g, '(_ni - 1) $1');
  }
  // Zig state.getSlot* → Lua getter name
  if (typeof ctx !== 'undefined' && ctx.stateSlots) {
    expr = expr.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
      var _s = ctx.stateSlots[+idx];
      return _s ? _s.getter : '_slot' + idx;
    });
    expr = expr.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
      var _s = ctx.stateSlots[+idx];
      return _s ? _s.getter : '_slot' + idx;
    });
  }
  // Pure JS→Lua operator/syntax conversion removed — handled by sanitize_for_lua.js.
  // Only context-dependent Zig→Lua rewrites that need OA/state context remain here.

  // Zig qjs_runtime.evalToString → __eval
  // Capture group must respect escape sequences (e.g. inner \"widget\") — the prior
  // [^"]+ pattern stopped at the first escaped inner quote and mangled the tail,
  // which broke any inlined render-local that contained a JS string literal.
  expr = expr.replace(/qjs_runtime\.evalToString\("String\(((?:[^"\\]|\\.)+)\)"[^)]*\)/g, '__eval("$1")');
  expr = expr.replace(/qjs_runtime\.evalToString\("((?:[^"\\]|\\.)+)"[^)]*\)/g, '__eval("$1")');
  expr = expr.replace(/,\s*&_eval_buf_\d+/g, '');
  expr = expr.replace(/&_eval_buf_\d+/g, '');
  expr = _unwrapQuotedDynamicExpr(expr);
  expr = _collapseRedundantParens(expr);
  expr = _simplifyBoolNumericComparison(expr);
  // DEFENSIVE: _item._item is a bug — collapse to single _item
  expr = expr.replace(/\b_item\._item\b/g, '_item');
  expr = expr.replace(/\b_nitem\._nitem\b/g, '_nitem');
  // DEFENSIVE: mixed nested item refs are bugs too
  expr = expr.replace(/\b_item\._nitem\b/g, '_nitem');
  expr = expr.replace(/\b_nitem\._item\b/g, '_item');
  // JS empty-array literal `[]` → lua empty-table `{}`. Required when smith
  // inlines JS `(props.X || [])` patterns into lua source via prop chains.
  // Lua doesn't understand `[]` syntax.
  expr = expr.replace(/\[\s*\]/g, '{}');
  if (expr.indexOf('_item.0') >= 0 || expr.indexOf('0.0') >= 0) {
    print('[MAP_SUB_DEBUG] before=' + _origExpr + ' after=' + expr + ' item=' + (itemParam || '') + ' idx=' + (indexParam || '') + ' props=' + JSON.stringify((ctx && ctx.propStack) || {}));
  }
  if (_hasW || (typeof expr === 'string' && expr.indexOf('widget') >= 0)) {
    var _wi1 = expr.indexOf('widget');
    if (_wi1 >= 0) print('[J2L_OUT] around widget: ' + JSON.stringify(expr.slice(Math.max(0,_wi1-30), _wi1+30)));
    else print('[J2L_OUT] widget gone from expr');
  }

  // FALLBACK: if smith's JS→Lua translation produced syntax that lua can't parse
  // (e.g. `{}.len` from `[].length` because lua doesn't allow direct access on
  // a literal table; or `or {}.len == 0` which has wrong precedence vs the
  // intended `(... or {}).len`), wrap the ORIGINAL JS expression in __eval(...)
  // so QJS evaluates it natively at runtime. Detected patterns:
  //   - `{}.len`   — empty-table literal followed by length
  //   - `[]`       — JS array literal that escaped the [] → {} translation
  //   - `||`       — JS-style logical operator that survived translation
  //   - `===`/`!==` — JS-style equality that survived translation
  function _hasLuaUnsafePatterns(s) {
    if (typeof s !== 'string') return false;
    if (s.indexOf('{}.len') >= 0) return true;
    if (/\[(?!\s*[A-Za-z_]\w*\s*\])\s*\]/.test(s)) return true;  // `[]` not as `[ident]`
    if (/(?:^|[^|])\|\|(?!\|)/.test(s)) return true;
    if (s.indexOf('===') >= 0 || s.indexOf('!==') >= 0) return true;
    return false;
  }
  if (_hasLuaUnsafePatterns(expr) && typeof _origExpr === 'string') {
    var _safeOrig = _origExpr
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
    return '__eval("' + _safeOrig + '")';
  }
  return expr;
}
