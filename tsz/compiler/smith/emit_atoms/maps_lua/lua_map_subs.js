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

function _jsExprToLua(expr, itemParam, indexParam, _luaIdxExpr) {
  // _luaIdxExpr: override for the Lua index expression. Defaults to '(_i - 1)'.
  // For nested maps, caller passes '(_ni - 1)' so inner index params resolve correctly.
  var _idxExpr = _luaIdxExpr || '(_i - 1)';
  if (itemParam) expr = expr.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), '_item');
  if (indexParam) expr = expr.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), _idxExpr);
  // Resolve component props — bare prop names from inlined components
  // need to be replaced with the actual value (OA ref cleaned for Lua)
  if (ctx && ctx.propStack) {
    for (var _pk in ctx.propStack) {
      if (new RegExp('\\b' + _pk + '\\b').test(expr)) {
        var _pv = ctx.propStack[_pk];
        if (typeof _pv === 'string') {
          // Clean Zig OA refs to Lua _item.field or _nitem.field
          _pv = _pv.replace(/_oa\d+_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, '_nitem.$1');
          _pv = _pv.replace(/_oa\d+_(\w+)\[_j\]/g, '_nitem.$1');
          _pv = _pv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
          _pv = _pv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
          // Index casts → Lua index expression (respects nesting via _idxExpr)
          // Zig uses _i (outer), _j (inner), _k (triple-nested) as iter vars.
          // Lua uses _i (outer), _ni (inner). Map accordingly.
          if (/@as\(i64,\s*@intCast\((_\w+)\)\)/.test(_pv)) {
            _pv = _pv.replace(/@as\(i64,\s*@intCast\((_\w+)\)\)/g, function(_, v) {
              // _i always maps to outer Lua index
              if (v === '_i') return '(_i - 1)';
              // Inner Zig iter vars (_j, _k) map to nested Lua index
              if (_luaIdxExpr) return _luaIdxExpr;
              return '(' + v + ' - 1)';
            });
          }
          // Strip remaining Zig casts
          for (var _ci2 = 0; _ci2 < 3; _ci2++) {
            _pv = _pv.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
            _pv = _pv.replace(/@intCast\(([^)]+)\)/g, '$1');
            _pv = _pv.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
          }
          expr = expr.replace(new RegExp('\\b' + _pk + '\\b', 'g'), _pv);
        }
      }
    }
  }
  // Strip Zig builtins that leak from parseTemplateLiteral into Lua expressions
  expr = expr.replace(/@divTrunc\(([^,]+),\s*([^)]+)\)/g, 'math.floor($1 / $2)');
  expr = expr.replace(/@mod\(([^,]+),\s*([^)]+)\)/g, '($1 % $2)');
  for (var _zi = 0; _zi < 3; _zi++) {
    expr = expr.replace(/@as\(\[\]const u8,\s*("[^"]*")\)/g, '$1');
    expr = expr.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
    expr = expr.replace(/@intCast\(([^)]+)\)/g, '$1');
    expr = expr.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
  }
  // Zig if/else chains → Lua and/or (from parseTemplateLiteral ternary emit)
  for (var _ifIter = 0; _ifIter < 10; _ifIter++) {
    var _ifPos = expr.indexOf('if (');
    if (_ifPos < 0) break;
    var _depth = 0, _ci3 = _ifPos + 3;
    for (; _ci3 < expr.length; _ci3++) {
      if (expr[_ci3] === '(') _depth++;
      if (expr[_ci3] === ')') { _depth--; if (_depth === 0) break; }
    }
    if (_depth !== 0) break;
    var _cond = expr.substring(_ifPos + 4, _ci3);
    var _after = expr.substring(_ci3 + 1).trim();
    var _elseIdx = _after.indexOf(' else ');
    if (_elseIdx < 0) break;
    var _trueVal = _after.substring(0, _elseIdx).trim();
    var _prefix = expr.substring(0, _ifPos);
    var _suffix = _after.substring(_elseIdx + 6).trim();
    expr = _prefix + '(' + _cond + ') and ' + _trueVal + ' or ' + _suffix;
  }
  expr = expr.replace(/!==/g, '~=');
  expr = expr.replace(/===/g, '==');
  expr = expr.replace(/!=/g, '~=');
  expr = expr.replace(/\|\|/g, ' or ');
  expr = expr.replace(/&&/g, ' and ');
  // Bitwise operators → LuaJIT bit library (after &&/|| so remaining &/| are bitwise)
  if (expr.indexOf('&') >= 0 || expr.indexOf('|') >= 0 || expr.indexOf('^') >= 0 ||
      expr.indexOf('>>') >= 0 || expr.indexOf('<<') >= 0 || /~(?!=)\w/.test(expr)) {
    expr = expr.replace(/~(?!=)(\w+)/g, 'bit.bnot($1)');
    for (var _bp = 0; _bp < 5; _bp++) {
      var _prevE = expr;
      expr = expr.replace(/(\w+)\s*>>\s*(\w+)/g, 'bit.rshift($1, $2)');
      expr = expr.replace(/(\w+)\s*<<\s*(\w+)/g, 'bit.lshift($1, $2)');
      expr = expr.replace(/(\w+)\s*&\s*(\w+)/g, 'bit.band($1, $2)');
      expr = expr.replace(/(\w+)\s*\|\s*(\w+)/g, 'bit.bor($1, $2)');
      expr = expr.replace(/(\w+)\s*\^\s*(\w+)/g, 'bit.bxor($1, $2)');
      if (expr === _prevE) break;
    }
  }
  expr = expr.replace(/'#([0-9a-fA-F]{3,8})'/g, '0x$1');
  expr = expr.replace(/"#([0-9a-fA-F]{3,8})"/g, '0x$1');
  return expr;
}
