// ── Brace conditional parsing ─────────────────────────────────────

function _luaQuoteCondString(value) {
  return '"' + String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r') + '"';
}

function _looksDynamicJsExpr(value) {
  if (typeof value !== 'string') return false;
  var trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('_handler_press_')) return false;
  return /(?:===|!==|==|!=|>=|<=|&&|\|\||[?:()<>])/.test(trimmed);
}

function _splitTopLevelJsTernary(expr) {
  if (typeof expr !== 'string') return null;
  var depthParen = 0;
  var depthBracket = 0;
  var depthBrace = 0;
  var quote = '';
  var escape = false;
  var question = -1;
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
    if (ch === '(') { depthParen++; continue; }
    if (ch === ')') { if (depthParen > 0) depthParen--; continue; }
    if (ch === '[') { depthBracket++; continue; }
    if (ch === ']') { if (depthBracket > 0) depthBracket--; continue; }
    if (ch === '{') { depthBrace++; continue; }
    if (ch === '}') { if (depthBrace > 0) depthBrace--; continue; }
    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0 && ch === '?') {
      question = i;
      break;
    }
  }
  if (question < 0) return null;

  depthParen = 0;
  depthBracket = 0;
  depthBrace = 0;
  quote = '';
  escape = false;
  var ternaryDepth = 0;
  var colon = -1;
  for (var j = question + 1; j < expr.length; j++) {
    var ch2 = expr.charAt(j);
    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch2 === '\\') {
        escape = true;
        continue;
      }
      if (ch2 === quote) quote = '';
      continue;
    }
    if (ch2 === '"' || ch2 === "'") {
      quote = ch2;
      continue;
    }
    if (ch2 === '(') { depthParen++; continue; }
    if (ch2 === ')') { if (depthParen > 0) depthParen--; continue; }
    if (ch2 === '[') { depthBracket++; continue; }
    if (ch2 === ']') { if (depthBracket > 0) depthBracket--; continue; }
    if (ch2 === '{') { depthBrace++; continue; }
    if (ch2 === '}') { if (depthBrace > 0) depthBrace--; continue; }
    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      if (ch2 === '?') {
        ternaryDepth++;
        continue;
      }
      if (ch2 === ':') {
        if (ternaryDepth === 0) {
          colon = j;
          break;
        }
        ternaryDepth--;
      }
    }
  }
  if (colon < 0) return null;
  return {
    cond: expr.slice(0, question).trim(),
    whenTrue: expr.slice(question + 1, colon).trim(),
    whenFalse: expr.slice(colon + 1).trim(),
  };
}

function _normalizeLuaRuntimeExpr(expr) {
  if (typeof expr !== 'string') return expr;
  var trimmed = expr.trim();
  if (trimmed.length === 0) return trimmed;

  var ternary = _splitTopLevelJsTernary(trimmed);
  if (ternary) {
    return '((' + _normalizeLuaRuntimeExpr(ternary.cond) + ') and ' +
      _normalizeLuaRuntimeExpr(ternary.whenTrue) + ' or ' +
      _normalizeLuaRuntimeExpr(ternary.whenFalse) + ')';
  }

  return trimmed
    .replace(/!==/g, '~=')
    .replace(/===/g, '==')
    .replace(/!=/g, '~=')
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/!\s*(?!=)/g, 'not ');
}

function _looksBooleanLikeRuntimeExpr(expr) {
  if (typeof expr !== 'string') return false;
  return /(?:==|~=|>=|<=|\band\b|\bor\b|\bnot\b|[<>])/.test(expr);
}

function _peekNumericComparison(c, startPos) {
  if (startPos >= c.count) return null;
  var opKind = c.kindAt(startPos);
  if (opKind !== TK.eq_eq && opKind !== TK.not_eq) return null;
  var op = opKind === TK.eq_eq ? '==' : '!=';
  var pos = startPos + 1;
  if (pos < c.count && c.kindAt(pos) === TK.equals) pos++;
  if (pos >= c.count || c.kindAt(pos) !== TK.number) return null;
  return { op: op, value: c.textAt(pos), endPos: pos };
}

function _luaBoolNumericComparison(expr, cmp) {
  if (!cmp) return null;
  if (!expr || !_looksBooleanLikeRuntimeExpr(expr)) return null;
  if (cmp.value !== '0' && cmp.value !== '1') return null;
  var wrapped = '(' + expr + ')';
  if ((cmp.op === '==' && cmp.value === '1') || (cmp.op === '!=' && cmp.value === '0')) return wrapped;
  if ((cmp.op === '!=' && cmp.value === '1') || (cmp.op === '==' && cmp.value === '0')) return '(not ' + wrapped + ')';
  return null;
}

function _splitCondAtLastLogical(parts) {
  var splitAt = -1;
  for (var i = parts.length - 1; i >= 0; i--) {
    if (parts[i] === ' and ' || parts[i] === ' or ') {
      splitAt = i;
      break;
    }
  }
  return {
    prefix: splitAt >= 0 ? parts.slice(0, splitAt + 1) : [],
    tail: splitAt >= 0 ? parts.slice(splitAt + 1) : parts.slice(),
  };
}

function _isStaticStringPropValue(pv) {
  if (typeof pv !== 'string') return false;
  if (pv.length === 0) return true;
  if (/^-?\d+(\.\d+)?$/.test(pv)) return false;
  if (pv.startsWith('_handler_press_')) return false;
  if (pv.startsWith('if (')) return false;
  if (pv.startsWith('state.')) return false;
  if (pv.startsWith('_oa')) return false;
  if (pv.startsWith('@as(')) return false;
  if (pv.startsWith('@intCast(')) return false;
  if (_looksDynamicJsExpr(pv)) return false;
  if (pv.charCodeAt(0) === 2) return false;
  return true;
}

function _isStringLikePropExpr(pv) {
  if (_isStaticStringPropValue(pv)) return true;
  if (typeof pv !== 'string') return false;
  if (pv.indexOf('state.getSlotString(') >= 0) return true;
  if (pv.indexOf('@as([]const u8') >= 0) return true;
  if (/\[0\.\._oa\d+_\w+_lens\[/.test(pv)) return true;
  return false;
}

function _condComparatorContext(c, parts, nextPos) {
  var prev = parts.length > 0 ? String(parts[parts.length - 1]).trim() : '';
  if (prev === '==' || prev === '~=' || prev === '>' || prev === '<' || prev === '>=' || prev === '<=') return true;
  if (nextPos >= c.count) return false;
  var nextKind = c.kindAt(nextPos);
  return nextKind === TK.eq_eq || nextKind === TK.not_eq ||
    nextKind === TK.gt || nextKind === TK.gt_eq ||
    nextKind === TK.lt || nextKind === TK.lt_eq;
}

function _luaCondPropExpr(rawPv, normalizedPv, valueContext) {
  if (rawPv === undefined) return 'false';
  if (typeof rawPv !== 'string') return 'true';
  if (/^-?\d+(\.\d+)?$/.test(rawPv)) return normalizedPv;
  if (rawPv.startsWith('_handler_press_')) return 'true';

  if (_isStaticStringPropValue(rawPv)) {
    var quoted = _luaQuoteCondString(rawPv);
    return valueContext ? quoted : '(' + quoted + ' ~= "" and ' + quoted + ' or false)';
  }

  if (_isStringLikePropExpr(rawPv)) {
    return valueContext ? normalizedPv : '((' + normalizedPv + ') ~= "" and (' + normalizedPv + ') or false)';
  }

  return normalizedPv;
}

function _luaCondPropLengthExpr(rawPv, normalizedPv) {
  if (rawPv === undefined) return '0';
  if (_isStaticStringPropValue(rawPv)) return String(rawPv.length);
  if (_isStringLikePropExpr(rawPv)) return '#(' + normalizedPv + ')';
  // Computed prop values like visibleTabs(...) are real runtime collections even
  // when we can't project a direct Lua length expression here. Treat them as
  // present so the surrounding container can render and let the nested map
  // decide whether it contributes any children.
  return '1';
}

function _condDirectLengthExpr(rawPv) {
  if (rawPv === undefined) return '0';
  if (typeof rawPv !== 'string') return '1';
  if (/^-?\d+(\.\d+)?$/.test(rawPv)) return '0';
  if (_isStaticStringPropValue(rawPv)) return String(rawPv.length);
  if (_isStringLikePropExpr(rawPv)) return rawPv + '.len';
  if (rawPv.startsWith('state.') || rawPv.startsWith('_oa') ||
      rawPv.startsWith('@as(') || rawPv.startsWith('@intCast(')) {
    return rawPv + '.len';
  }
  // Computed runtime props do not have a direct Zig length expression here.
  // Keep them truthy instead of generating invalid `1.len` output.
  return '1';
}

// Build Lua condition by reading raw tokens from saved position.
function _buildLuaCondFromTokens(c, savedStart) {
  var _cur = c.save();
  var _stopAmp = _findLastTopLevelAmpAmp(c, savedStart.pos, _cur.pos);
  c.restore(savedStart);
  var parts = [];
  while (c.pos < _cur.pos && c.kind() !== TK.rbrace && c.kind() !== TK.question) {
    if (c.pos === _stopAmp) break;
    if (c.kind() === TK.amp_amp) { parts.push('and'); c.advance(); continue; }
    if (c.kind() === TK.eq_eq) { parts.push('=='); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    if (c.kind() === TK.not_eq) { parts.push('~='); c.advance(); if (c.kind() === TK.equals) c.advance(); continue; }
    if (c.kind() === TK.bang) { parts.push('not'); c.advance(); continue; }
    if (c.kind() === TK.pipe_pipe) { parts.push('or'); c.advance(); continue; }
    if (c.kind() === TK.string) {
      var sv = c.text().slice(1, -1);
      if (sv.charAt(0) === '#' && /^#[0-9a-fA-F]{3,8}$/.test(sv)) { parts.push('0x' + sv.slice(1)); }
      else { parts.push('"' + sv + '"'); }
      c.advance(); continue;
    }
    // Resolve props.X dot-access (bare-param component: function Comp(props) { ... props.X ... })
    if (c.kind() === TK.identifier && ctx.propsObjectName && c.text() === ctx.propsObjectName &&
        c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
      var _ppField = c.textAt(c.pos + 2);
      var _hasProp = ctx.propStack && ctx.propStack[_ppField] !== undefined;
      var _nextIsLength = c.pos + 4 < c.count && c.kindAt(c.pos + 3) === TK.dot && c.textAt(c.pos + 4) === 'length';
      if (_hasProp) {
        var _ppRaw = ctx.propStack[_ppField];
        var _ppv = String(_ppRaw);
        if (isEval(_ppv)) {
          var _ppExpr = extractRuntimeJsExpr(_ppv, null, null);
          if (_ppExpr) _ppv = _ppExpr;
        }
        _ppv = _normalizeLuaRuntimeExpr(_ppv);
        _ppv = _ppv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
        _ppv = _ppv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
        for (var _ppi = 0; _ppi < 3; _ppi++) {
          _ppv = _ppv.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
          _ppv = _ppv.replace(/@intCast\(([^)]+)\)/g, '$1');
        }
        _ppv = _ppv.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
          return (ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
        });
        _ppv = _ppv.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
          return (ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
        });
        if (/[?:]/.test(_ppv) || _ppv.indexOf('&&') >= 0 || _ppv.indexOf('||') >= 0) {
          _ppv = '(' + _ppv + ')';
        }
        if (!_nextIsLength) {
          var _ppCmp = _peekNumericComparison(c, c.pos + 3);
          var _ppBoolCmp = _luaBoolNumericComparison(_ppv, _ppCmp);
          if (_ppBoolCmp) {
            parts.push(_ppBoolCmp);
            while (c.pos <= _ppCmp.endPos) c.advance();
            continue;
          }
        }
        if (_nextIsLength) {
          parts.push(_luaCondPropLengthExpr(_ppRaw, _ppv));
          c.advance(); c.advance(); c.advance(); c.advance(); c.advance(); // skip props . field . length
        } else {
          parts.push(_luaCondPropExpr(_ppRaw, _ppv, _condComparatorContext(c, parts, c.pos + 3)));
          c.advance(); c.advance(); c.advance(); // skip props . field
        }
        continue;
      }
      parts.push(_nextIsLength ? '0' : 'false');
      if (_nextIsLength) c.advance(), c.advance(), c.advance(), c.advance(), c.advance();
      else c.advance(), c.advance(), c.advance();
      continue;
    }
    // Resolve component prop names to their values (OA refs cleaned for Lua)
    // Skip if preceded by a dot (field access like _nitem.deptIdx — not a prop ref)
    var _isPropRef = c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined;
    if (_isPropRef && parts.length > 0 && parts[parts.length - 1] === '.') _isPropRef = false;
    if (_isPropRef) {
      var _rawPv = ctx.propStack[c.text()];
      var _pv = String(_rawPv);
      if (isEval(_pv)) {
        var _pvExpr = extractRuntimeJsExpr(_pv, null, null);
        if (_pvExpr) _pv = _pvExpr;
      }
      _pv = _normalizeLuaRuntimeExpr(_pv);
      // OA field refs → _item.field or _nitem.field
      _pv = _pv.replace(/_oa\d+_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, '_nitem.$1');
      _pv = _pv.replace(/_oa\d+_(\w+)\[_j\]/g, '_nitem.$1');
      _pv = _pv.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
      _pv = _pv.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
      // Index casts → Lua index expression
      // Zig: _i (outer), _j (inner), _k (triple-nested) → Lua: _i, _ni, _nni
      if (/@as\(i64,\s*@intCast\((_\w+)\)\)/.test(_pv)) {
        _pv = _pv.replace(/@as\(i64,\s*@intCast\((_\w+)\)\)/g, function(_, v) {
          if (v === '_i') return '(_i - 1)';
          if (v === '_j') return '(_ni - 1)';
          if (v === '_k') return '(_nni - 1)';
          return '(' + v + ' - 1)';
        });
      }
      // Strip remaining Zig casts
      for (var _ci = 0; _ci < 3; _ci++) {
        _pv = _pv.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
        _pv = _pv.replace(/@intCast\(([^)]+)\)/g, '$1');
        _pv = _pv.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
      }
      if (/[?:]/.test(_pv) || _pv.indexOf('&&') >= 0 || _pv.indexOf('||') >= 0) {
        _pv = '(' + _pv + ')';
      }
      var _pvCmp = _peekNumericComparison(c, c.pos + 1);
      var _pvBoolCmp = _luaBoolNumericComparison(_pv, _pvCmp);
      if (_pvBoolCmp) {
        parts.push(_pvBoolCmp);
        while (c.pos <= _pvCmp.endPos) c.advance();
        continue;
      }
      parts.push(_luaCondPropExpr(_rawPv, _pv, _condComparatorContext(c, parts, c.pos + 1)));
      c.advance(); continue;
    }
    // Resolve render-local aliased to map item param: var tab = props.tab where tab → itemParam
    // When tab.modified is encountered, resolve via renderLocals → itemParam → _item.field
    if (c.kind() === TK.identifier && ctx.renderLocals && ctx.renderLocals[c.text()] !== undefined) {
      var _rlName2 = c.text();
      var _rlv2 = ctx.renderLocals[_rlName2];
      var _rlRaw2 = ctx._renderLocalRaw && ctx._renderLocalRaw[_rlName2];
      if (isEval(_rlv2)) {
        var _rlExpr2 = extractRuntimeJsExpr(_rlv2, _rlRaw2, _rlName2);
        if (_rlExpr2) _rlv2 = '__eval("' + String(_rlExpr2).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
      }
      if (typeof _rlv2 === 'string') _rlv2 = _normalizeLuaRuntimeExpr(_rlv2);
      if (ctx.currentMap && _rlv2 === ctx.currentMap.itemParam &&
          c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
        parts.push('_item');
        c.advance(); continue;
      }
      // Resolve state.getSlot → getter name for Lua, .len → # prefix
      if (typeof _rlv2 === 'string') {
        _rlv2 = _rlv2.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
          return (ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
        });
        _rlv2 = _rlv2.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
          return (ctx.stateSlots && ctx.stateSlots[+idx]) ? ctx.stateSlots[+idx].getter : '_slot' + idx;
        });
        for (var _ci3 = 0; _ci3 < 3; _ci3++) {
          _rlv2 = _rlv2.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
          _rlv2 = _rlv2.replace(/@intCast\(([^)]+)\)/g, '$1');
        }
        // Zig .len → Lua # (string/array length)
        _rlv2 = _rlv2.replace(/(\w+)\.len\b/g, '#$1');
        // Wrap compound expressions in parens for correct Lua precedence (not X > 0 → not (X > 0))
        if (/[><=!~+\-*\/%]/.test(_rlv2) || /\band\b|\bor\b/.test(_rlv2)) {
          _rlv2 = '(' + _rlv2 + ')';
        }
        var _rlCmp = _peekNumericComparison(c, c.pos + 1);
        var _rlBoolCmp = _luaBoolNumericComparison(_rlv2, _rlCmp);
        if (_rlBoolCmp) {
          parts.push(_rlBoolCmp);
          while (c.pos <= _rlCmp.endPos) c.advance();
          continue;
        }
        parts.push(_rlv2);
        c.advance(); continue;
      }
    }
    // Resolve map item param access: item.field → _item.field
    if (c.kind() === TK.identifier && ctx.currentMap && c.text() === ctx.currentMap.itemParam) {
      parts.push('_item');
      c.advance(); continue;
    }
    // Resolve map index param: si → (_i - 1), fi → (_ni - 1)
    if (c.kind() === TK.identifier && ctx.currentMap) {
      var _mapCur = ctx.currentMap;
      var _idxResolved = false;
      while (_mapCur) {
        if (c.text() === _mapCur.indexParam) {
          var _zigIter = _mapCur.iterVar || '_i';
          // Map Zig iter vars to Lua: _i→_i, _j→_ni, _k→_nni
          if (_zigIter === '_j') parts.push('(_ni - 1)');
          else if (_zigIter === '_k') parts.push('(_nni - 1)');
          else parts.push('(' + _zigIter + ' - 1)');
          _idxResolved = true;
          break;
        }
        _mapCur = _mapCur.parentMap || null;
      }
      if (_idxResolved) { c.advance(); continue; }
    }
    parts.push(c.text());
    c.advance();
  }
  c.restore(_cur);
  var _joined = parts.join(' ').trim();
  if (_joined.indexOf('.0') >= 0 || _joined.indexOf('0.0') >= 0) {
    print('[LUA_COND_DEBUG] raw=' + _joined);
  }
  // JS empty-array literal `[]` → lua empty-table `{}`
  _joined = _joined.replace(/\[\s*\]/g, '{}');
  // Operator-precedence fix: `EXPRS or {}.len OP RHS` should be
  // `(EXPRS or {}).len OP RHS`. The OR chain produces a value, then we take
  // its length. Without grouping, lua parses `or {}.len` as `or ({}.len)`.
  // Wrap the OR chain leading up to `{}.len` in parens.
  _joined = _joined.replace(/((?:^|[(,\s])(?:[A-Za-z_][\w.()]*\s+or\s+)+)\{\}\s*\.\s*len(\s*[=~<>])/g, '($1{}).len$3');
  return _joined;
}

// Try to parse {expr && <JSX>} conditional — returns true if consumed
function tryParseConditional(c, children) {
  // Look ahead: identifier (op identifier/number)* && <
  const saved = c.save();
  // Map expressions own their own callback-local conditionals. If we scan them
  // here, a nested `&&` inside the callback can hijack the whole brace expr.
  if (c.kind() === TK.identifier && typeof _identifierStartsMapCall === 'function' && _identifierStartsMapCall(c)) {
    c.restore(saved);
    return false;
  }
  const _luaCondStart = c.save(); // save position for lua-tree expr conversion
  let condParts = [];
  // Collect condition expression until && or }
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    // Handle ! prefix (boolean negation)
    if (c.kind() === TK.bang) {
      c.advance();
      if (c.kind() === TK.identifier) {
        const name = c.text();
        if (isGetter(name)) {
          condParts.push('(' + slotGet(name) + ' == 0)');
        } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
          const rlVal = ctx.renderLocals[name];
          const isBoolExpr = / > | < | >= | <= | == | != /.test(rlVal) || rlVal.includes('.len');
          if (isBoolExpr) {
            condParts.push('(!(' + rlVal + '))');
          } else {
            condParts.push('((' + rlVal + ') == 0)');
          }
        } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
          condParts.push('((' + _condPropValue(ctx.propStack[name]) + ') == 0)');
        } else {
          condParts.push('(0)');
        }
        c.advance();
        continue;
      }
      condParts.push('!');
      continue;
    }
    if (c.kind() === TK.amp_amp) {
      c.advance();
      // Skip optional ( wrapper around JSX
      let parenWrapped = false;
      let savedBeforeParen = null;
      if (c.kind() === TK.lparen) {
        savedBeforeParen = c.save();
        c.advance();
        parenWrapped = true;
      }
      // Check if next is props.children or children — forward component children as conditional body
      if (ctx.componentChildren &&
          ((c.kind() === TK.identifier && c.text() === 'children') ||
           (c.kind() === TK.identifier && ctx.propsObjectName && c.text() === ctx.propsObjectName &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.textAt(c.pos + 2) === 'children'))) {
        const condExpr = condParts.join('');
        // Skip tokens: children or props.children
        if (c.text() === 'children') { c.advance(); }
        else { c.advance(); c.advance(); c.advance(); } // props . children
        if (parenWrapped && c.kind() === TK.rparen) c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // Build Lua condition
        var _luaCond2 = _buildLuaCondFromTokens(c, _luaCondStart);
        // Inject each child with the conditional wrapping
        for (var _cci = 0; _cci < ctx.componentChildren.length; _cci++) {
          var _ccChild = ctx.componentChildren[_cci];
          // Preserve the original child but add condition metadata for Lua tree
          _ccChild.condition = _luaCond2 || condExpr;
          children.push(_ccChild);
        }
        return true;
      }
      // Check if next is JSX
      if (c.kind() === TK.lt) {
        const condExpr = condParts.join('');
        const jsxNode = parseJSXElement(c);
        if (parenWrapped && c.kind() === TK.rparen) c.advance();
        if (c.kind() === TK.rbrace) c.advance();
        // Map-item conditional: inject display style inline instead of _updateConditionals
        if (ctx.currentMap) {
          const ip = ctx.currentMap.itemParam;
          const mm = condExpr.match(new RegExp('^' + ip + '\\.(\\w+)(\\s*==\\s*)(\\d+)$'));
          if (mm) {
            const oa = ctx.currentMap.oa;
            const resolved = `_oa${oa.oaIdx}_${mm[1]}[_i] == ${mm[3]}`;
            // Merge display into existing style if present, otherwise add new style
            let modified;
            if (jsxNode.nodeExpr.includes('.style = .{')) {
              modified = jsxNode.nodeExpr.replace('.style = .{', `.style = .{ .display = if (${resolved}) .flex else .none,`);
            } else {
              modified = jsxNode.nodeExpr.replace(/ \}$/, `, .style = .{ .display = if (${resolved}) .flex else .none } }`);
            }
            children.push({ nodeExpr: modified, dynBufId: jsxNode.dynBufId });
            return true;
          }
        }
        // Register as conditional
        const condIdx = ctx.conditionals.length;
        // Build Lua condition from raw tokens
        var _luaCond = _buildLuaCondFromTokens(c, _luaCondStart);
        ctx.conditionals.push({ condExpr, luaCondExpr: _luaCond, kind: 'show_hide', inMap: !!ctx.currentMap });
        children.push({ nodeExpr: jsxNode.nodeExpr, condIdx, dynBufId: jsxNode.dynBufId, luaNode: jsxNode.luaNode });
        return true;
      }
      // Check for conditional children splice: && children or && props.children
      if (c.kind() === TK.identifier) {
        // {cond && children}
        if (c.text() === 'children' && ctx.componentChildren) {
          c.advance();
          if (parenWrapped && c.kind() === TK.rparen) c.advance();
          if (c.kind() === TK.rbrace) c.advance();
          const condExpr = condParts.join('');
          // Wrap all children in a conditional Box
          const condIdx = ctx.conditionals.length;
          ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
          const wrapperStyle = '.{ .flex_direction = .column }';
          // Build children nodes list for the wrapper
          const childExprs = [];
          for (const ch of ctx.componentChildren) {
            childExprs.push(ch.nodeExpr || '.{}');
          }
          const wrapperExpr = `.{ .style = ${wrapperStyle} }`;
          children.push({ nodeExpr: wrapperExpr, condIdx, subChildren: ctx.componentChildren.slice() });
          return true;
        }
        // {cond && props.children} — direct check since children isn't in propStack
        if (ctx.propsObjectName && c.text() === ctx.propsObjectName &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot &&
            c.textAt(c.pos + 2) === 'children' && ctx.componentChildren) {
          c.advance(); // props
          c.advance(); // .
          c.advance(); // children
          if (parenWrapped && c.kind() === TK.rparen) c.advance();
          if (c.kind() === TK.rbrace) c.advance();
          const condExpr = condParts.join('');
          const condIdx = ctx.conditionals.length;
          ctx.conditionals.push({ condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
          const wrapperExpr = `.{ .style = .{ .flex_direction = .column } }`;
          children.push({ nodeExpr: wrapperExpr, condIdx, subChildren: ctx.componentChildren.slice() });
          return true;
        }
      }
      // {cond && expr.map((item) => (<JSX>))} — conditional map
      // The condition controls visibility, the map goes to Lua.
      if (c.kind() === TK.identifier) {
        // Peek ahead for .map( in the token stream
        var _cmPeek = c.save();
        var _cmHasMap = false;
        var _cmDepth = 0;
        while (c.pos < c.count && c.kind() !== TK.rbrace) {
          if (_cmDepth === 0 && c.kind() === TK.identifier && c.text() === 'map' &&
              c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
            _cmHasMap = true;
            break;
          }
          if (c.kind() === TK.lparen) _cmDepth++;
          if (c.kind() === TK.rparen) { if (_cmDepth > 0) _cmDepth--; else break; }
          c.advance();
        }
        c.restore(_cmPeek);
        if (_cmHasMap) {
          // Restore to after && and let the normal brace child parser handle the map
          // Wrap in a conditional show/hide
          var condExpr = condParts.join('');
          var condIdx = ctx.conditionals.length;
          ctx.conditionals.push({ condExpr: condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
          // Parse the map expression as a child — the map parser will route to Lua
          var mapChildren = [];
          if (_tryParseIdentifierMapExpression(c, mapChildren, false)) {
            if (parenWrapped && c.kind() === TK.rparen) c.advance();
            if (c.kind() === TK.rbrace) c.advance();
            // Wrap the map result in a conditional Box
            var mapChild = mapChildren[0] || { nodeExpr: '.{}' };
            children.push({ nodeExpr: mapChild.nodeExpr, condIdx: condIdx, mapIdx: mapChild.mapIdx, _luaMapWrapper: mapChild._luaMapWrapper });
            return true;
          }
          // Map parse failed — undo conditional registration
          ctx.conditionals.pop();
        }
      }
      // Restore paren if we consumed it but didn't find JSX or children
      if (parenWrapped && savedBeforeParen) {
        c.restore(savedBeforeParen);
      }
      // Not JSX after && — might be chained condition, put && back
      condParts.push(' and ');
      continue;
    }
    if (c.kind() === TK.pipe_pipe) {
      condParts.push(' or ');
      c.advance();
      continue;
    }
    // Build condition expression with Zig-compatible ops
    if (c.kind() === TK.identifier && c.text() === 'exact') {
      condParts.push(' == ');
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      continue;
    }
    // props.X dot-access in conditional condition
    if (ctx.propsObjectName && c.kind() === TK.identifier && c.text() === ctx.propsObjectName &&
        c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
      const _missingProp = c.textAt(c.pos + 2);
      if (!(ctx.propStack && ctx.propStack[_missingProp] !== undefined)) {
        condParts.push('0');
        c.advance(); c.advance(); c.advance();
        if (c.kind() === TK.dot && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'length') {
          c.advance();
          c.advance();
        }
        continue;
      }
    }
    {
      const pa = peekPropsAccess(c);
      if (pa) {
        skipPropsAccess(c, pa);
        // Handle .length after props access: props.X.length → resolved.len
        if (c.kind() === TK.dot && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'length') {
          condParts.push(_condDirectLengthExpr(pa.value));
          c.advance(); // skip .
          c.advance(); // skip length
        } else {
          const pav = _condPropValue(pa.value);
          condParts.push(pav);
        }
        continue;
      }
    }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      const prevPart = condParts.length > 0 ? String(condParts[condParts.length - 1]).trim() : '';
      if (prevPart === '.') {
        condParts.push(name);
        c.advance();
        continue;
      }
      if (globalThis.__SMITH_DEBUG_INLINE && (name === 'activeTab' || name === 'connectedApp' || name === 'selectedIdx' || name === 'crashCount' || name === 'copied')) {
        globalThis.__dbg = globalThis.__dbg || [];
        globalThis.__dbg.push('[COND] name=' + name + ' isGetter=' + isGetter(name) + ' slot=' + findSlot(name) + ' inline=' + (ctx.inlineComponent || 'App') + ' pos=' + c.pos);
      }
      // Check for OA getter followed by .length BEFORE isGetter (OA names aren't in stateSlots)
      const oa = ctx.objectArrays.find(o => o.getter === name);
      if (oa && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.textAt(c.pos + 2) === 'length') {
        condParts.push(`_oa${oa.oaIdx}_len`);
        c.advance();
        c.advance();
        c.advance();
        continue;
      }
      // OA getter followed by [expr] or [expr].field → resolve to OA field access
      if (oa && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.lbracket) {
        // Resolve bracket expression to Zig index
        const bracketIdent = c.textAt(c.pos + 2);
        let resolvedIdx = null;
        if (ctx.currentMap && bracketIdent === ctx.currentMap.indexParam) {
          resolvedIdx = ctx.currentMap.iterVar || '_i';
        } else if (ctx.propStack && ctx.propStack[bracketIdent] !== undefined) {
          const bpv = ctx.propStack[bracketIdent];
          if (typeof bpv === 'string' && bpv.includes('_oa')) {
            resolvedIdx = `@as(usize, @intCast(${bpv}))`;
          } else if (typeof bpv === 'string' && bpv.includes('@intCast(')) {
            resolvedIdx = bpv.replace('@as(i64, ', '@as(usize, ');
          } else if (/^\d+$/.test(bpv)) {
            resolvedIdx = bpv;
          }
        } else if (ctx.currentMap && ctx.currentMap.oa) {
          const bracketField = ctx.currentMap.oa.fields.find(f => f.name === bracketIdent);
          if (bracketField) {
            resolvedIdx = `@as(usize, @intCast(_oa${ctx.currentMap.oa.oaIdx}_${bracketIdent}[${ctx.currentMap.iterVar || '_i'}]))`;
          }
        }
        if (resolvedIdx !== null && c.kindAt(c.pos + 3) === TK.rbracket) {
          // Check for .field after ] (object array bracket access)
          if (c.pos + 5 < c.count && c.kindAt(c.pos + 4) === TK.dot && c.kindAt(c.pos + 5) === TK.identifier) {
            const field = c.textAt(c.pos + 5);
            const fieldInfo = oa.fields.find(f => f.name === field);
            if (fieldInfo && fieldInfo.type === 'string') {
              condParts.push(`_oa${oa.oaIdx}_${field}[${resolvedIdx}][0.._oa${oa.oaIdx}_${field}_lens[${resolvedIdx}]]`);
            } else {
              condParts.push(`_oa${oa.oaIdx}_${field}[${resolvedIdx}]`);
            }
            c.advance(); c.advance(); c.advance(); c.advance(); c.advance(); c.advance(); // skip name [ idx ] . field
            continue;
          }
          // Primitive array: no .field — just oaName[idx] → _oaN_value[idx]
          if (oa.isPrimitiveArray) {
            condParts.push(`_oa${oa.oaIdx}_value[${resolvedIdx}]`);
            c.advance(); c.advance(); c.advance(); c.advance(); // skip name [ idx ]
            continue;
          }
        }
      }
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
        const rlVal = ctx.renderLocals[name];
        const rawExpr = ctx._renderLocalRaw && ctx._renderLocalRaw[name];
        const nextKind = c.pos + 1 < c.count ? c.kindAt(c.pos + 1) : TK.eof;
        const hasExplicitComparison = nextKind === TK.eq_eq || nextKind === TK.not_eq ||
          nextKind === TK.gt || nextKind === TK.gt_eq || nextKind === TK.lt || nextKind === TK.lt_eq;
      if (rawExpr && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.lparen && c.kindAt(c.pos + 2) === TK.rparen) {
        condParts.push(zigBool(buildEval('( ' + rawExpr + ' )()', ctx), ctx));
        c.advance();
        c.advance();
        c.advance();
        continue;
      }
      if (ctx.currentMap && rlVal === ctx.currentMap.itemParam &&
          c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
        c.advance();
        c.advance();
        let rlField = c.text();
        c.advance();
        while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
          c.advance();
          rlField += '_' + c.text();
          c.advance();
        }
        const mapOa = ctx.currentMap.oa;
        if (mapOa) {
          condParts.push(`_oa${mapOa.oaIdx}_${rlField}[${ctx.currentMap.iterVar || '_i'}]`);
        } else {
          condParts.push('0');
        }
        continue;
      }
      if (rawExpr && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
        const field = c.textAt(c.pos + 2);
        condParts.push(zigBool(buildFieldEval(rawExpr, field, ctx), ctx));
        c.advance();
        c.advance();
          c.advance();
          continue;
        }
        if (rlVal === 'null' || rlVal === 'undefined') condParts.push('0');
        else if (isEval(rlVal) && !hasExplicitComparison) condParts.push(zigBool(rlVal, ctx));
        else condParts.push(rlVal);
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        const pv = ctx.propStack[name];
        if (typeof pv === 'string' && pv.charCodeAt && pv.charCodeAt(0) === 2 &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip prop name
          c.advance(); // skip dot
          const field = c.text();
          c.advance(); // skip field
          condParts.push(`_item.${field}`);
          continue;
        }
        // If prop is a map-item ref and next is .field, resolve as OA field access
        if (ctx.currentMap && ctx.currentMap.oa &&
            typeof pv === 'string' && pv.includes('@intCast(') &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip prop name
          c.advance(); // skip dot
          const field = c.text();
          const mapOa = ctx.currentMap.oa;
          const iterVar = ctx.currentMap.iterVar || '_i';
          c.advance(); // skip field
          // Consume .length after OA field — nested arrays store count directly
          if (c.kind() === TK.dot && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'length') {
            c.advance(); // skip .
            c.advance(); // skip length
          }
          // Bracket access on nested array count → bounds check (count > index)
          if (c.kind() === TK.lbracket) {
            c.advance(); // skip [
            var _bracketParts = [];
            while (c.kind() !== TK.rbracket && c.kind() !== TK.eof) {
              if (c.kind() === TK.identifier && isGetter(c.text())) _bracketParts.push(slotGet(c.text()));
              else if (c.kind() === TK.identifier && ctx.propStack && ctx.propStack[c.text()] !== undefined) _bracketParts.push(_condPropValue(ctx.propStack[c.text()]));
              else _bracketParts.push(c.text());
              c.advance();
            }
            if (c.kind() === TK.rbracket) c.advance();
            condParts.push(`(_oa${mapOa.oaIdx}_${field}[${iterVar}] > @as(i64, ${_bracketParts.join('')}))`);
            continue;
          }
          condParts.push(`_oa${mapOa.oaIdx}_${field}[${iterVar}]`);
          continue;
        }
        condParts.push(_condPropValue(pv));
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))');
      } else if (ctx.currentMap && name === ctx.currentMap.itemParam) {
        c.advance();
        if (c.kind() === TK.dot) {
          c.advance();
          if (c.kind() === TK.identifier) {
            let field = c.text();
            c.advance();
            while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
              c.advance();
              field += '_' + c.text();
              c.advance();
            }
            const mapOa = ctx.currentMap.oa;
            if (mapOa) {
              condParts.push(`_oa${mapOa.oaIdx}_${field}[${ctx.currentMap.iterVar || '_i'}]`);
            } else {
              condParts.push('0');
            }
            continue;
          }
        } else {
          condParts.push('@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))');
        }
      } else if (c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.lparen) {
        // Unknown identifier followed by ( — script function call.
        // Collect func(args) and route through QJS eval.
        var _fnCall = name;
        c.advance(); // skip name
        _fnCall += c.text(); // (
        c.advance();
        var _fnDepth = 1;
        while (c.kind() !== TK.eof && _fnDepth > 0) {
          if (c.kind() === TK.lparen) _fnDepth++;
          if (c.kind() === TK.rparen) _fnDepth--;
          _fnCall += c.text();
          c.advance();
        }
        condParts.push(zigBool(buildEval(_fnCall, ctx), ctx));
        continue;
      } else if (ctx.inlineComponent) {
        condParts.push('0');
      } else {
        condParts.push(name);
      }
    } else if (c.kind() === TK.number) {
      const lastPart = condParts.length > 0 ? condParts[condParts.length - 1] : '';
      if (lastPart.endsWith(' ')) condParts.push(' ' + c.text());
      else condParts.push(c.text());
    } else if (c.kind() === TK.eq_eq) {
      condParts.push(' == ');
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      continue;
    } else if (c.kind() === TK.not_eq) {
      condParts.push(' != ');
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      continue;
    } else if (c.kind() === TK.gt_eq) {
      condParts.push(' >= ');
    } else if (c.kind() === TK.lt_eq) {
      condParts.push(' <= ');
    } else if (c.kind() === TK.gt) {
      condParts.push(' > ');
    } else if (c.kind() === TK.lt) {
      if (c.pos + 1 < c.count && (c.kindAt(c.pos + 1) === TK.number || (c.kindAt(c.pos + 1) === TK.identifier && (isGetter(c.textAt(c.pos + 1)) || (ctx.propStack && ctx.propStack[c.textAt(c.pos + 1)] !== undefined))))) {
        condParts.push(' < ');
        c.advance();
        continue;
      }
      break;
    } else if (c.kind() === TK.question) {
      break;
    } else if (c.kind() === TK.string) {
      const sv = c.text().slice(1, -1);
      const lastOp = condParts.length > 0 ? condParts[condParts.length - 1] : '';
      if (sv === '' && (lastOp === ' == ' || lastOp === ' != ')) {
        const split = _splitCondAtLastLogical(condParts);
        const lhs = split.tail.slice(0, -1).join('');
        condParts.length = 0;
        for (var _pi = 0; _pi < split.prefix.length; _pi++) condParts.push(split.prefix[_pi]);
        if (/^__eval\("/.test(lhs)) {
          condParts.push(lastOp === ' == ' ? `(${lhs} == "")` : `(${lhs} ~= "")`);
        } else {
          condParts.push(lastOp === ' == ' ? `${lhs}.len == 0` : `${lhs}.len > 0`);
        }
      } else if (lastOp === ' == ' || lastOp === ' != ') {
        const split = _splitCondAtLastLogical(condParts);
        const lhs = split.tail.slice(0, -1).join('');
        condParts.length = 0;
        for (var _pj = 0; _pj < split.prefix.length; _pj++) condParts.push(split.prefix[_pj]);
        const eql = `std.mem.eql(u8, ${lhs}, "${sv}")`;
        condParts.push(lastOp === ' == ' ? eql : `!${eql}`);
      } else {
        condParts.push(`"${sv}"`);
      }
    } else {
      condParts.push(c.text());
    }
    c.advance();
  }
  c.restore(saved);
  return false;
}
