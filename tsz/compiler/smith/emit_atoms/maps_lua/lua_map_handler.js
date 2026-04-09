// ── Lua map handler emit ────────────────────────────────────────
// Turns an onPress handler body into a Lua string expression.
// Uses _jsExprToLua from lua_map_subs.js.

function _handlerToLua(handler, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  if (!handler) return null;
  // Get canonical map identity (itemVar, idxVar, idxExpr)
  var id = (typeof _getMapIdentity === 'function') ? _getMapIdentity(_luaIdxExpr) : { itemVar: '_item', idxVar: '_i', idxExpr: _luaIdxExpr || '(_i - 1)' };
  var h = _jsExprToLua(handler, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  // Safety pass: inlined component props can still leave bare callback param
  // names behind here. Normalize them before deciding whether the handler is
  // static so mapped clicks always receive a concrete row-specific payload.
  if (itemParam) h = h.replace(new RegExp('\\b' + itemParam + '\\b', 'g'), id.itemVar);
  if (indexParam) h = h.replace(new RegExp('\\b' + indexParam + '\\b', 'g'), id.idxExpr);
  h = _normalizeHandlerIndexExprs(h, id.idxExpr);
  // Check for dynamic content: uses item variable or index expression
  var hasDynamic = h.indexOf('_item') >= 0 || h.indexOf('_nitem') >= 0 || h.indexOf(id.idxExpr) >= 0 || h.indexOf('(_i - 1)') >= 0 || h.indexOf('(_ni - 1)') >= 0 || /(^|[^A-Za-z0-9_])_i\s*-\s*1(?=[^A-Za-z0-9_]|$)/.test(h) || /(^|[^A-Za-z0-9_])_ni\s*-\s*1(?=[^A-Za-z0-9_]|$)/.test(h);
  var spliced = _spliceDynamicHandler(h, id.idxExpr);
  if (hasDynamic || spliced !== h) {
    return '"' + spliced + '"';
  }
  return '"' + h.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function _normalizeHandlerIndexExprs(h, _ixStr) {
  if (!h) return h;
  var out = String(h);
  function _replaceBare(expr, name, repl) {
    return expr.replace(new RegExp('(^|[^A-Za-z0-9_])' + name.replace(/[$]/g, '\\$&') + '(?=[^A-Za-z0-9_]|$)', 'g'), function(_, pfx) {
      return pfx + repl;
    });
  }
  out = out.replace(/\(_ni\s*-\s*1\)/g, '__HANDLER_NI0__');
  out = out.replace(/\(_i\s*-\s*1\)/g, '__HANDLER_I0__');
  out = out.replace(/(^|[^A-Za-z0-9_])_ni\s*-\s*1(?=[^A-Za-z0-9_]|$)/g, function(_, pfx) {
    return pfx + '__HANDLER_NI0__';
  });
  out = out.replace(/(^|[^A-Za-z0-9_])_i\s*-\s*1(?=[^A-Za-z0-9_]|$)/g, function(_, pfx) {
    return pfx + '__HANDLER_I0__';
  });
  out = _replaceBare(out, '_ni', '(_ni - 1)');
  out = _replaceBare(out, '_i', _ixStr || '(_i - 1)');
  out = out.replace(/__HANDLER_NI0__/g, '(_ni - 1)');
  out = out.replace(/__HANDLER_I0__/g, _ixStr || '(_i - 1)');
  return out;
}

// "toggleTodo(_item.id)" → 'toggleTodo(" .. (_item.id) .. ")'
function _spliceDynamicHandler(h, _ixStr) {
  var out = '';
  var i = 0;
  while (i < h.length) {
    var fnStart = h.indexOf('(', i);
    if (fnStart < 0) { out += h.slice(i); break; }
    var fnNameEnd = fnStart;
    while (fnNameEnd > i && h[fnNameEnd - 1] === ' ') fnNameEnd--;
    var fnNameStart = fnNameEnd;
    while (fnNameStart > i && /\w/.test(h[fnNameStart - 1])) fnNameStart--;
    var fnName = h.slice(fnNameStart, fnNameEnd);
    var depth = 1;
    var argStart = fnStart + 1;
    var argEnd = argStart;
    while (argEnd < h.length && depth > 0) {
      if (h[argEnd] === '(') depth++;
      if (h[argEnd] === ')') depth--;
      argEnd++;
    }
    var args = h.slice(argStart, argEnd - 1).trim();
    var argDyn = args.indexOf('_item') >= 0 || args.indexOf('_nitem') >= 0 || args.indexOf('(_i - 1)') >= 0 || args.indexOf('(_ni - 1)') >= 0 || (_ixStr && args.indexOf(_ixStr) >= 0) || /(^|[^A-Za-z0-9_])_i\s*-\s*1(?=[^A-Za-z0-9_]|$)/.test(args) || /(^|[^A-Za-z0-9_])_ni\s*-\s*1(?=[^A-Za-z0-9_]|$)/.test(args);
    out += h.slice(i, fnNameStart);
    if (argDyn && fnName) {
      // Split multi-arg calls: "removeItem(_item.id, _item.label)" → each arg spliced separately
      var _splitArgs = [];
      var _ad = 0, _aStart = 0;
      for (var _ai = 0; _ai <= args.length; _ai++) {
        if (_ai < args.length && args[_ai] === '(') _ad++;
        if (_ai < args.length && args[_ai] === ')') _ad--;
        if ((_ai === args.length || (args[_ai] === ',' && _ad === 0))) {
          _splitArgs.push(args.slice(_aStart, _ai).trim());
          _aStart = _ai + 1;
        }
      }
      var _splicedArgs = [];
      for (var _si = 0; _si < _splitArgs.length; _si++) {
        var _sa = _splitArgs[_si];
        var _isDyn = _sa.indexOf('_item') >= 0 || _sa.indexOf('_nitem') >= 0 || _sa.indexOf('(_i - 1)') >= 0 || _sa.indexOf('(_ni - 1)') >= 0 || (_ixStr && _sa.indexOf(_ixStr) >= 0) || /(^|[^A-Za-z0-9_])_i\s*-\s*1(?=[^A-Za-z0-9_]|$)/.test(_sa) || /(^|[^A-Za-z0-9_])_ni\s*-\s*1(?=[^A-Za-z0-9_]|$)/.test(_sa);
        if (_isDyn) {
          if (/^_n?item\s*\.\s*\w+$/.test(_sa)) {
            _splicedArgs.push('\'" .. (' + _sa + ') .. "\'');
          } else {
            _splicedArgs.push('" .. (' + _sa + ') .. "');
          }
        } else {
          _splicedArgs.push(_sa.replace(/"/g, '\\"'));
        }
      }
      out += fnName + '(' + _splicedArgs.join(', ') + ')';
    } else {
      // Escape string args so inner quotes don't break the outer lua_on_press = "..." wrapper
      var escapedArgs = args.replace(/"/g, '\\"');
      out += fnName + '(' + escapedArgs + ')';
    }
    i = argEnd;
  }
  return out;
}
