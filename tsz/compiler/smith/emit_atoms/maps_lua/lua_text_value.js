// ── Lua text emit: Value expression handling ─────────────────────
// General value expression emission with proper Lua translation.
// Dependencies: _jsExprToLua from lua_map_subs.js, _jsEvalExpr from lua_text_eval.js

// State variable expression: resolve and emit
function _luaTextStateVar(stateVarExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  // Check for ternary first
  var ternResult = _luaTextTernaryString(stateVarExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (ternResult) return ternResult;

  var sv = stateVarExpr;

  // Translate via _jsExprToLua
  sv = _jsExprToLua(sv, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  sv = _normalizeEmbeddedJsEval(sv);

  // Try to inline simple __eval
  var inlineEval = _maybeInlineJsEvalExpr(sv, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (inlineEval) sv = inlineEval;

  // Check again for ternary after translation
  var postTern = _luaTextTernaryString(sv, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (postTern) return postTern;

  // Handle Zig artifacts if present
  if (/@|state\.getSlot|\bif\b/.test(sv)) {
    return _luaTextZigArtifacts(sv);
  }

  // Detect literal prefix before expression
  var litMatch = sv.match(/^([^a-zA-Z_(\d#]+)(.+)$/);
  if (litMatch && litMatch[1].trim().length > 0) {
    return luaStringLiteral(litMatch[1]) + ' .. tostring(' + litMatch[2] + ')';
  }

  if (_needsLuaTextEval(sv)) {
    return 'tostring(' + _jsEvalExpr(sv) + ')';
  }

  return 'tostring(' + sv + ')';
}

// Pre-translated Lua expression: wrap tostring calls, clean up artifacts
function _luaTextLuaExpr(luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  return _wrapLuaTextTostringCalls(luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
}

// Dynamic expression with item/index refs
function _luaTextDynamicExpr(text, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var luaExpr = _jsExprToLua(String(text), itemParam, indexParam, _luaIdxExpr, _currentOaIdx);

  // Cleanups
  luaExpr = luaExpr.replace(/(\w+(?:\.\w+)*)\.length\b/g, '#$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  luaExpr = _normalizeEmbeddedJsEval(luaExpr);

  // Try inline eval
  var inlineEval = _maybeInlineJsEvalExpr(luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (inlineEval) return 'tostring(' + inlineEval + ')';

  // If still has Zig/JS syntax → __eval fallback
  if (/@|state\.get|getSlot|\bconst\b|\blet\b|=>/.test(luaExpr) ||
      /\)\s+\w/.test(luaExpr) ||
      /\w+\s+\w+/.test(luaExpr.replace(/\band\b|\bor\b|\bnot\b|\btostring\b/g, '').trim())) {
    var jsText = String(text)
      .replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1')
      .replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1')
      .replace(/@as\([^,]+,\s*/g, '')
      .replace(/@intCast\(/g, '(');
    return 'tostring(' + _jsEvalExpr(jsText) + ')';
  }

  luaExpr = luaExpr.trim();
  if (luaExpr.indexOf('_item') >= 0 || luaExpr.indexOf('(_i - 1)') >= 0 ||
      luaExpr.indexOf('#') >= 0 || luaExpr.indexOf('(') >= 0) {

    var litMatch = luaExpr.match(/^([^a-zA-Z_(\d#]+)(.+)$/);
    if (litMatch && litMatch[1].trim().length > 0) {
      var litTail = litMatch[2].trim();
      if (_needsLuaTextEval(litTail)) {
        litTail = _jsEvalExpr(litTail);
      }
      return luaStringLiteral(litMatch[1]) + ' .. tostring(' + litTail + ')';
    }

    if (_needsLuaTextEval(luaExpr)) {
      return 'tostring(' + _jsEvalExpr(luaExpr) + ')';
    }
    return 'tostring(' + luaExpr + ')';
  }

  return luaStringLiteral(luaExpr);
}

// Wrap tostring() calls around inner expressions
function _wrapLuaTextTostringCalls(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var out = '';
  var cursor = 0;

  while (cursor < expr.length) {
    var start = expr.indexOf('tostring(', cursor);
    if (start < 0) {
      out += expr.slice(cursor);
      break;
    }

    out += expr.slice(cursor, start);
    var innerStart = start + 9;
    var depth = 1;
    var i = innerStart;

    while (i < expr.length && depth > 0) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      i++;
    }

    if (depth !== 0) {
      out += expr.slice(start);
      break;
    }

    var inner = expr.slice(innerStart, i - 1);
    var luaInner = _luaTextValueExpr(inner, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
    out += 'tostring(' + luaInner + ')';
    cursor = i;
  }

  return out;
}

// General value expression → Lua (used by template and ternary handlers)
function _luaTextValueExpr(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx) {
  var luaExpr = _jsExprToLua(expr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);

  // OA refs and length cleanups
  luaExpr = luaExpr.replace(/(\w+(?:\.\w+)*)\.length\b/g, '#$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  luaExpr = luaExpr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  luaExpr = _normalizeEmbeddedJsEval(luaExpr);

  // Try inline simple __eval
  var inline = _maybeInlineJsEvalExpr(luaExpr, itemParam, indexParam, _luaIdxExpr, _currentOaIdx);
  if (inline) return inline;

  luaExpr = luaExpr.trim();
  if (_needsLuaTextEval(luaExpr)) {
    return _jsEvalExpr(luaExpr);
  }

  return luaExpr;
}

// Handle Zig artifacts in translated expressions
function _luaTextZigArtifacts(sv) {
  // Color.rgb → 0xHEX
  sv = sv.replace(/Color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/g, function(_, r, g, b) {
    return '0x' + ((+r << 16) | (+g << 8) | +b).toString(16).padStart(6, '0');
  });

  // Strip Zig @as wrappers
  for (var i = 0; i < 5; i++) {
    sv = sv.replace(/@as\(\[\]const u8,\s*("[^"]*")\)/g, '$1');
    sv = sv.replace(/@as\(\w+,\s*([^)]+)\)/g, '$1');
    sv = sv.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
    sv = sv.replace(/@intCast\(([^)]+)\)/g, '$1');
    sv = sv.replace(/@divTrunc\(([^,]+),\s*([^)]+)\)/g, 'math.floor($1 / $2)');
    sv = sv.replace(/@mod\(([^,]+),\s*([^)]+)\)/g, '($1 % $2)');
  }

  // JS operators → Lua
  sv = sv.replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
  sv = sv.replace(/===/g, '==').replace(/!==/g, '~=');

  // State slots → getter names
  sv = sv.replace(/state\.getSlot(?:Int|Float|Bool|String)?\((\d+)\)/g, function(_, idx) {
    return (typeof ctx !== 'undefined' && ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
  });

  // OA refs → _item.field
  sv = sv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  sv = sv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');

  // qjs_runtime.evalToString → bare expression
  sv = sv.replace(/qjs_runtime\.evalToString\("String\(([^)]+)\)"[^)]*\)/g, '$1');
  sv = sv.replace(/&_eval_buf_\d+/g, '');

  // Iterative if/else → and/or
  for (var ifIter = 0; ifIter < 10; ifIter++) {
    var ifPos = sv.indexOf('if (');
    if (ifPos < 0) break;
    var depth = 0, ci = ifPos + 3;
    for (; ci < sv.length; ci++) {
      if (sv[ci] === '(') depth++;
      if (sv[ci] === ')') { depth--; if (depth === 0) break; }
    }
    if (depth !== 0) break;
    var cond = sv.substring(ifPos + 4, ci);
    var after = sv.substring(ci + 1).trim();
    var elseIdx = after.indexOf(' else ');
    if (elseIdx < 0) break;
    var trueVal = after.substring(0, elseIdx).trim();
    var prefix = sv.substring(0, ifPos);
    var suffix = after.substring(elseIdx + 6).trim();
    sv = prefix + '(' + cond + ') and ' + trueVal + ' or ' + suffix;
  }

  // Clean orphan parens
  var open = (sv.match(/\(/g) || []).length;
  var close = (sv.match(/\)/g) || []).length;
  while (close > open && sv.endsWith(')')) { sv = sv.slice(0, -1); close--; }

  // If clean Lua now (no Zig syntax left), emit bare
  if (!/[@?]/.test(sv) && !/\bif\b/.test(sv) && !/qjs_runtime/.test(sv)) {
    if (_needsLuaTextEval(sv)) {
      return 'tostring(' + _jsEvalExpr(sv) + ')';
    }
    var litMatch = sv.match(/^([^a-zA-Z_(\d#]+)(.+)$/);
    if (litMatch && litMatch[1].trim().length > 0) {
      return luaStringLiteral(litMatch[1]) + ' .. tostring(' + litMatch[2] + ')';
    }
    return 'tostring(' + sv + ')';
  }

  return 'tostring(' + _jsEvalExpr(sv) + ')';
}
