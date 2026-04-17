// ── Brace ternary parsing ─────────────────────────────────────────

// Resolve bracket index expression to a Zig usize for OA access
function _resolveOaBracketIdx(ident) {
  if (ctx.currentMap && ident === ctx.currentMap.indexParam) {
    return ctx.currentMap.iterVar || '_i';
  }
  if (ctx.propStack && ctx.propStack[ident] !== undefined) {
    var bpv = ctx.propStack[ident];
    if (typeof bpv === 'string' && bpv.includes('_oa')) {
      return '@as(usize, @intCast(' + bpv + '))';
    }
    if (typeof bpv === 'string' && bpv.includes('@intCast(')) {
      return bpv.replace('@as(i64, ', '@as(usize, ');
    }
    if (/^\d+$/.test(bpv)) return bpv;
  }
  if (ctx.currentMap && ctx.currentMap.oa) {
    var bf = ctx.currentMap.oa.fields.find(function(f) { return f.name === ident; });
    if (bf) {
      return '@as(usize, @intCast(_oa' + ctx.currentMap.oa.oaIdx + '_' + ident + '[' + (ctx.currentMap.iterVar || '_i') + ']))';
    }
  }
  return null;
}

// Resolve string comparisons: lhs == 'str' → std.mem.eql(u8, lhs, "str")
// Also handles runtime string comparisons: slice == getSlotString(N) → std.mem.eql
function _resolveStringComparison(condExpr) {
  // Empty string: x == '' → x.len == 0, x != '' → x.len > 0
  var mEmpty = condExpr.match(/^(.+?)\s*(==|!=)\s*['"]['"]$/);
  if (mEmpty) {
    var lhsE = mEmpty[1].trim();
    if (lhsE.includes('getSlotString') || lhsE.includes('[0..') || lhsE.includes('getString')) {
      return mEmpty[2] === '==' ? lhsE + '.len == 0' : lhsE + '.len > 0';
    }
  }
  var m = condExpr.match(/^(.+?)\s*==\s*['"]([^'"]+)['"]$/);
  if (m) {
    var lhs = m[1].trim();
    var rhs = m[2];
    if (!lhs.includes('[0..') && /_oa\d+_\w+\[_i\]$/.test(lhs)) {
      var lenField = lhs.replace(/\[_i\]$/, '_lens[_i]');
      lhs = lhs + '[0..' + lenField + ']';
    }
    return 'std.mem.eql(u8, ' + lhs + ', "' + rhs + '")';
  }
  var m2 = condExpr.match(/^(.+?)\s*!=\s*['"]([^'"]+)['"]$/);
  if (m2) {
    var lhs2 = m2[1].trim();
    var rhs2 = m2[2];
    if (!lhs2.includes('[0..') && /_oa\d+_\w+\[_i\]$/.test(lhs2)) {
      var lenField2 = lhs2.replace(/\[_i\]$/, '_lens[_i]');
      lhs2 = lhs2 + '[0..' + lenField2 + ']';
    }
    return '!std.mem.eql(u8, ' + lhs2 + ', "' + rhs2 + '")';
  }
  var m3 = condExpr.match(/^(.+?)\s*==\s*(.+)$/);
  if (m3) {
    var lhs3 = m3[1].trim();
    var rhs3 = m3[2].trim();
    // Don't apply std.mem.eql when LHS is an if-expression (produces i64, not []const u8)
    var lhsIsIfExpr = lhs3.startsWith('if (') || lhs3.includes(') @as(');
    var lhsIsStr = !lhsIsIfExpr && (lhs3.includes('[0..') || lhs3.includes('getSlotString') || lhs3.includes('getString'));
    var rhsIsStr = rhs3.includes('[0..') || rhs3.includes('getSlotString') || rhs3.includes('getString');
    if (lhsIsStr || rhsIsStr) {
      return 'std.mem.eql(u8, ' + lhs3 + ', ' + rhs3 + ')';
    }
  }
  return condExpr;
}

// Parse ternary condition tokens until ? is found. Returns condParts array or null.
function _parseTernaryCondParts(c) {
  var condParts = [];
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.question) {
      c.advance();
      return condParts;
    }
    if (c.kind() === TK.identifier && c.text() === 'exact') {
      c.advance();
      if (c.kind() === TK.equals) c.advance();
      if (c.kind() === TK.string) {
        condParts.push(' == ');
        condParts.push(c.text());
      } else if (c.kind() === TK.identifier) {
        var rhsName = c.text();
        if (ctx.currentMap && (rhsName === ctx.currentMap.itemParam || rhsName === ctx.currentMap.indexParam)) {
          condParts.push(' == ');
          continue;
        }
        var isRuntimeStr = false;
        if (isGetter(rhsName)) {
          var slotIdx = findSlot(rhsName);
          isRuntimeStr = slotIdx >= 0 && ctx.stateSlots[slotIdx].type === 'string';
        }
        if (isRuntimeStr || (ctx.propStack && ctx.propStack[rhsName] !== undefined)) {
          condParts.push(' == ');
          continue;
        } else {
          condParts.push(' == ');
          condParts.push("'" + rhsName + "'");
        }
      } else {
        condParts.push(' == ');
        continue;
      }
      c.advance();
      continue;
    }
    // props.X dot-access in ternary condition
    if (ctx.propsObjectName && c.kind() === TK.identifier && c.text() === ctx.propsObjectName &&
        c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
      var _missingProp = c.textAt(c.pos + 2);
      if (!(ctx.propStack && ctx.propStack[_missingProp] !== undefined)) {
        condParts.push('0');
        c.advance();
        c.advance();
        c.advance();
        if (c.kind() === TK.dot && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'length') {
          c.advance();
          c.advance();
        }
        continue;
      }
    }
    var pa = peekPropsAccess(c);
    if (pa) {
      skipPropsAccess(c, pa);
      condParts.push(_condPropValue(pa.value));
      continue;
    }
    if (c.kind() === TK.identifier) {
      var name = c.text();
      var prevPart = condParts.length > 0 ? String(condParts[condParts.length - 1]).trim() : '';
      if (prevPart === '.') {
        condParts.push(name);
        c.advance();
        continue;
      }
      // OA getter followed by .length → _oaN_len
      var _ternOa = ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.getter === name; }) : null;
      if (_ternOa && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.textAt(c.pos + 2) === 'length') {
        condParts.push('_oa' + _ternOa.oaIdx + '_len');
        c.advance(); c.advance(); c.advance();
        continue;
      }
      // OA getter followed by [expr] — primitive array or object array bracket access
      if (_ternOa && c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.lbracket) {
        var _tIdx = _resolveOaBracketIdx(c.textAt(c.pos + 2));
        if (_tIdx !== null && c.kindAt(c.pos + 3) === TK.rbracket) {
          if (_ternOa.isPrimitiveArray) {
            condParts.push('_oa' + _ternOa.oaIdx + '_value[' + _tIdx + ']');
            c.advance(); c.advance(); c.advance(); c.advance();
            continue;
          }
          if (c.pos + 5 < c.count && c.kindAt(c.pos + 4) === TK.dot && c.kindAt(c.pos + 5) === TK.identifier) {
            var _tf = c.textAt(c.pos + 5);
            condParts.push('_oa' + _ternOa.oaIdx + '_' + _tf + '[' + _tIdx + ']');
            c.advance(); c.advance(); c.advance(); c.advance(); c.advance(); c.advance();
            continue;
          }
        }
      }
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
        var rlVal = ctx.renderLocals[name];
        if (c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.textAt(c.pos + 2) === 'length') {
          condParts.push(rlVal + '.len');
          c.advance();
          c.advance();
          c.advance();
          continue;
        }
        if (isEval(rlVal)) {
          var nextK = c.pos + 1 < c.count ? c.kindAt(c.pos + 1) : TK.eof;
          var hasNumCmp = (nextK === TK.eq_eq || nextK === TK.not_eq) &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 2) === TK.number;
          if (!hasNumCmp && nextK === TK.eq_eq && c.pos + 2 < c.count && c.kindAt(c.pos + 2) === TK.equals &&
              c.pos + 3 < c.count && c.kindAt(c.pos + 3) === TK.number) hasNumCmp = true;
          if (hasNumCmp) {
            var isNeg = nextK === TK.not_eq;
            c.advance(); c.advance(); // skip name, skip == or !=
            if (c.kind() === TK.equals) c.advance(); // skip 3rd = of ===
            var cmpVal = c.text(); c.advance(); // skip number
            condParts.push(resolveComparison(rlVal, isNeg ? '!=' : '==', cmpVal, ctx));
            continue;
          }
          condParts.push(zigBool(rlVal, ctx));
        } else {
          condParts.push(rlVal);
        }
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        var pv = ctx.propStack[name];
        if (typeof pv === 'string' && pv.charCodeAt && pv.charCodeAt(0) === 2 &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip prop name
          c.advance(); // skip dot
          var _pvField = c.text();
          c.advance(); // skip field
          condParts.push('_item.' + _pvField);
          continue;
        }
        // If prop is a map-item ref and next is .field, resolve as OA field access
        if (ctx.currentMap && ctx.currentMap.oa &&
            typeof pv === 'string' && pv.includes('@intCast(') &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip prop name
          c.advance(); // skip dot
          var field = c.text();
          var mapOa = ctx.currentMap.oa;
          var iterVar = ctx.currentMap.iterVar || '_i';
          c.advance(); // skip field
          // Consume .length after OA field — nested arrays store count directly
          if (c.kind() === TK.dot && c.pos + 1 < c.count && c.textAt(c.pos + 1) === 'length') {
            c.advance(); // skip .
            c.advance(); // skip length
          }
          condParts.push('_oa' + mapOa.oaIdx + '_' + field + '[' + iterVar + ']');
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
            var field = c.text();
            c.advance();
            while (c.kind() === TK.dot && c.pos + 1 < c.count && c.kindAt(c.pos + 1) === TK.identifier) {
              c.advance();
              field += '_' + c.text();
              c.advance();
            }
            var oa = ctx.currentMap.oa;
            if (oa) {
              var fi2 = oa.fields.find(function(f) { return f.name === field; });
              var iv = ctx.currentMap.iterVar || '_i';
              if (fi2 && fi2.type === 'string') {
                condParts.push('_oa' + oa.oaIdx + '_' + field + '[' + iv + '][0.._oa' + oa.oaIdx + '_' + field + '_lens[' + iv + ']]');
              } else {
                condParts.push('_oa' + oa.oaIdx + '_' + field + '[' + iv + ']');
              }
            } else {
              condParts.push('0');
            }
            continue;
          }
        } else if (ctx.currentMap.isSimpleArray) {
          var oa3 = ctx.currentMap.oa;
          var iv3 = ctx.currentMap.iterVar || '_i';
          condParts.push('_oa' + oa3.oaIdx + '__v[' + iv3 + '][0.._oa' + oa3.oaIdx + '__v_lens[' + iv3 + ']]');
        } else {
          condParts.push('@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))');
        }
        continue;
      } else if (ctx.inlineComponent) {
        condParts.push('0');
      } else {
        condParts.push(name);
      }
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
    } else if (c.kind() === TK.number) {
      condParts.push(c.text());
    } else if (c.kind() === TK.gt) {
      condParts.push(' > ');
    } else if (c.kind() === TK.gt_eq) {
      condParts.push(' >= ');
    } else if (c.kind() === TK.lt_eq) {
      condParts.push(' <= ');
    } else if (c.kind() === TK.lt) {
      if (c.pos + 1 < c.count && (c.kindAt(c.pos + 1) === TK.number || (c.kindAt(c.pos + 1) === TK.identifier && (isGetter(c.textAt(c.pos + 1)) || (ctx.propStack && ctx.propStack[c.textAt(c.pos + 1)] !== undefined))))) {
        condParts.push(' < ');
        c.advance();
        continue;
      }
      return null;
    } else {
      condParts.push(c.text());
    }
    c.advance();
  }
  return null;
}

// Try to parse {expr ? (<JSX>) : (<JSX>)} ternary JSX branches
// Supports chained ternaries: {a ? <X> : b ? <Y> : <Z>}
function _parseTernaryBranchNode(c) {
  var saved = c.save();
  var wrapped = false;
  if (c.kind() === TK.lparen) {
    wrapped = true;
    c.advance();
  }

  if (c.kind() === TK.lt) {
    var jsxNode = parseJSXElement(c);
    if (wrapped && c.kind() === TK.rparen) c.advance();
    return jsxNode;
  }

  if (c.kind() === TK.identifier) {
    var branchChildren = [];
    if (_tryParseIdentifierMapExpression(c, branchChildren, false) && branchChildren.length > 0) {
      if (wrapped && c.kind() === TK.rparen) c.advance();
      return branchChildren[0];
    }
  }

  // Fallback: unresolvable branch (e.g. prop.field.map(...), runtime expression).
  // Skip to matching ) or } and emit a placeholder node so raw JS doesn't leak.
  if (wrapped || c.kind() === TK.identifier) {
    var _depth = wrapped ? 1 : 0;
    while (c.kind() !== TK.eof) {
      if (c.kind() === TK.lparen) _depth++;
      if (c.kind() === TK.rparen) { _depth--; if (_depth <= 0) break; }
      if (_depth === 0 && (c.kind() === TK.colon || c.kind() === TK.rbrace)) break;
      c.advance();
    }
    if (wrapped && c.kind() === TK.rparen) c.advance();
    return { nodeExpr: '.{ .text = "[runtime branch]" }' };
  }

  c.restore(saved);
  return null;
}

function tryParseTernaryJSX(c, children) {
  var saved = c.save();
  var condParts = _parseTernaryCondParts(c);
  if (!condParts) {
    c.restore(saved);
    return false;
  }

  var firstBranch = _parseTernaryBranchNode(c);
  if (!firstBranch) {
    c.restore(saved);
    return false;
  }
  if (c.kind() !== TK.colon) {
    c.restore(saved);
    return false;
  }
  c.advance();

  var _rawCondStr = condParts.join('').replace(/!==/g, '~=').replace(/===/g, '==').replace(/&&/g, ' and ').replace(/\|\|/g, ' or ');
  // Resolve OA refs and state slots in Lua condition
  _rawCondStr = _rawCondStr.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  _rawCondStr = _rawCondStr.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  _rawCondStr = _rawCondStr.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
    var _s = ctx.stateSlots[+idx]; return _s ? _s.getter : '_slot' + idx;
  });
  _rawCondStr = _rawCondStr.replace(/@as\(\w+,\s*/g, '').replace(/@intCast\(/g, '(');
  var _rco = (_rawCondStr.match(/\(/g) || []).length;
  var _rcc = (_rawCondStr.match(/\)/g) || []).length;
  while (_rcc > _rco && _rawCondStr.endsWith(')')) { _rawCondStr = _rawCondStr.slice(0, -1); _rcc--; }
  var allBranches = [{ condExpr: _resolveStringComparison(condParts.join('')), luaCondExpr: _rawCondStr, branch: firstBranch }];

  while (true) {
    var defaultSaved = c.save();
    var wrappedDefault = false;
    if (c.kind() === TK.lparen) {
      wrappedDefault = true;
      c.advance();
    }

    if (c.kind() === TK.identifier && c.text() === 'null') {
      c.advance();
      if (wrappedDefault && c.kind() === TK.rparen) c.advance();
      break;
    }

    c.restore(defaultSaved);
    var defaultBranch = _parseTernaryBranchNode(c);
    if (defaultBranch) {
      allBranches.push({ condExpr: null, branch: defaultBranch });
      break;
    }

    c.restore(defaultSaved);
    var nextCondParts = _parseTernaryCondParts(c);
    if (!nextCondParts) {
      c.restore(saved);
      return false;
    }

    var nextBranch = _parseTernaryBranchNode(c);
    if (!nextBranch) {
      c.restore(saved);
      return false;
    }
    allBranches.push({ condExpr: _resolveStringComparison(nextCondParts.join('')), branch: nextBranch });

    if (c.kind() !== TK.colon) break;
    c.advance();
  }

  if (c.kind() === TK.rbrace) c.advance();

  var hasDefault = allBranches.length > 1 && allBranches[allBranches.length - 1].condExpr === null;

  if (allBranches.length === 1) {
    var condIdx = ctx.conditionals.length;
    ctx.conditionals.push({ condExpr: allBranches[0].condExpr, luaCondExpr: allBranches[0].luaCondExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
    children.push({ nodeExpr: allBranches[0].branch.nodeExpr, condIdx: condIdx, dynBufId: allBranches[0].branch.dynBufId, luaNode: allBranches[0].branch.luaNode });
  } else if (allBranches.length === 2 && hasDefault) {
    var condExpr = allBranches[0].condExpr;
    var condIdx2 = ctx.conditionals.length;
    ctx.conditionals.push({ condExpr: condExpr, luaCondExpr: allBranches[0].luaCondExpr, kind: 'ternary_jsx', trueIdx: -1, falseIdx: -1, inMap: !!ctx.currentMap });
    children.push({ nodeExpr: allBranches[0].branch.nodeExpr, ternaryCondIdx: condIdx2, ternaryBranch: 'true', dynBufId: allBranches[0].branch.dynBufId, luaNode: allBranches[0].branch.luaNode });
    children.push({ nodeExpr: allBranches[1].branch.nodeExpr, ternaryCondIdx: condIdx2, ternaryBranch: 'false', dynBufId: allBranches[1].branch.dynBufId, luaNode: allBranches[1].branch.luaNode });
  } else {
    var resolvedConds = [];
    for (var bi = 0; bi < allBranches.length; bi++) {
      if (allBranches[bi].condExpr !== null) resolvedConds.push(allBranches[bi].condExpr);
    }

    for (var bi2 = 0; bi2 < allBranches.length; bi2++) {
      var compoundExpr;
      if (bi2 === 0) {
        compoundExpr = resolvedConds[0];
      } else if (allBranches[bi2].condExpr === null) {
        var negParts = [];
        for (var ni = 0; ni < resolvedConds.length; ni++) negParts.push('!(' + resolvedConds[ni] + ')');
        compoundExpr = negParts.join(' and ');
      } else {
        var parts = [];
        for (var ni2 = 0; ni2 < bi2; ni2++) parts.push('!(' + resolvedConds[ni2] + ')');
        parts.push('(' + resolvedConds[bi2] + ')');
        compoundExpr = parts.join(' and ');
      }
      var branchCondIdx = ctx.conditionals.length;
      ctx.conditionals.push({ condExpr: compoundExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
      children.push({ nodeExpr: allBranches[bi2].branch.nodeExpr, condIdx: branchCondIdx, dynBufId: allBranches[bi2].branch.dynBufId });
    }
  }

  return true;
}

function _escapeTernaryTextLiteral(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function _normalizeLuaTernaryCond(luaCond) {
  if (!luaCond) return 'false';
  luaCond = luaCond.trim();
  if (!/[=~<>]/.test(luaCond) && !/\band\b|\bor\b|\bnot\b/.test(luaCond)) {
    luaCond = luaCond + ' ~= 0';
  }
  return luaCond;
}

function _ternaryCondExprToLua(condExpr) {
  if (!condExpr || typeof condExpr !== 'string') return 'false';
  var out = _resolveTernaryTextMarkers(condExpr);
  out = out.replace(/!std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 ~= $2)');
  out = out.replace(/std\.mem\.eql\(u8,\s*([^,]+),\s*([^)]+)\)/g, '($1 == $2)');
  out = out.replace(/state\.getSlot(?:Int|Float|Bool)?\((\d+)\)/g, function(_, idx) {
    var _s = ctx.stateSlots[+idx];
    return _s ? _s.getter : '_slot' + idx;
  });
  out = out.replace(/state\.getSlotString\((\d+)\)/g, function(_, idx) {
    var _s = ctx.stateSlots[+idx];
    return _s ? _s.getter : '_slot' + idx;
  });
  out = out.replace(/_oa\d+_(\w+)\[_j\]\[0\.\._oa\d+_\w+_lens\[_j\]\]/g, '_nitem.$1');
  out = out.replace(/_oa\d+_(\w+)\[_j\]/g, '_nitem.$1');
  out = out.replace(/_oa\d+_(\w+)\[_i\]\[0\.\._oa\d+_\w+_lens\[_i\]\]/g, '_item.$1');
  out = out.replace(/_oa\d+_(\w+)\[_i\]/g, '_item.$1');
  out = out.replace(/\b_j\b/g, '_ni');
  out = out.replace(/([A-Za-z_]\w*(?:\.[A-Za-z_]\w+)*)\.len\b/g, '#$1');
  for (var i = 0; i < 3; i++) {
    out = out.replace(/@as\([^,]+,\s*([^)]+)\)/g, '$1');
    out = out.replace(/@intCast\(([^)]+)\)/g, '$1');
    out = out.replace(/@floatFromInt\(([^)]+)\)/g, '$1');
  }
  out = out.replace(/\s+!=\s+/g, ' ~= ');
  return _normalizeLuaTernaryCond(out);
}

function _resolveTernaryTextMarkers(expr) {
  if (!expr || expr.indexOf('\x02') === -1) return expr;
  return expr.replace(/\x02OA_ITEM:\d+:[^:]+:(\w+)\s*\.\s*(\w+)/g, function(_, itemParam, field) {
    void itemParam;
    return '_item.' + field;
  }).replace(/\x02OA_ITEM:\d+:[^:]+:(\w+)/g, function(_, itemParam) {
    void itemParam;
    return '_item';
  });
}

function _parseNestedTernaryTextExpr(c) {
  var saved = c.save();
  var condParts = _parseTernaryCondParts(c);
  if (!condParts) {
    c.restore(saved);
    return null;
  }

  if (c.kind() !== TK.string) {
    c.restore(saved);
    return null;
  }
  var trueVal = c.text().slice(1, -1);
  c.advance();

  if (c.kind() !== TK.colon) {
    c.restore(saved);
    return null;
  }
  c.advance();

  var falseBranch = null;
  if (c.kind() === TK.string) {
    falseBranch = { kind: 'string', value: c.text().slice(1, -1) };
    c.advance();
  } else {
    var nested = _parseNestedTernaryTextExpr(c);
    if (!nested) {
      c.restore(saved);
      return null;
    }
    falseBranch = { kind: 'expr', value: nested };
  }

  var condExpr = _resolveTernaryTextMarkers(_resolveStringComparison(condParts.join('')));
  var luaCond = _ternaryCondExprToLua(condExpr);

  return {
    condExpr: condExpr,
    luaCond: luaCond,
    trueVal: trueVal,
    falseBranch: falseBranch,
  };
}

function _nestedTernaryTextToZig(expr) {
  var zigCond = zigBool(expr.condExpr, ctx);
  var trueLit = '@as([]const u8, "' + _escapeTernaryTextLiteral(expr.trueVal) + '")';
  var falseLit = expr.falseBranch.kind === 'string'
    ? '@as([]const u8, "' + _escapeTernaryTextLiteral(expr.falseBranch.value) + '")'
    : _nestedTernaryTextToZig(expr.falseBranch.value);
  return 'if ' + zigCond + ' ' + trueLit + ' else ' + falseLit;
}

function _nestedTernaryTextToLua(expr) {
  var trueLit = '"' + _escapeTernaryTextLiteral(expr.trueVal) + '"';
  var falseLit = expr.falseBranch.kind === 'string'
    ? '"' + _escapeTernaryTextLiteral(expr.falseBranch.value) + '"'
    : _nestedTernaryTextToLua(expr.falseBranch.value);
  return '(' + expr.luaCond + ') and ' + trueLit + ' or ' + falseLit;
}

// Try to parse {expr == val ? "a" : "b"} ternary text
function tryParseTernaryText(c, children) {
  const saved = c.save();
  var parsed = _parseNestedTernaryTextExpr(c);
  if (!parsed) {
    c.restore(saved);
    return false;
  }
  if (c.kind() === TK.rbrace) c.advance();
  const fmtArgs = _nestedTernaryTextToZig(parsed);
  if (ctx.currentMap && fmtArgs.includes('_oa')) {
    const mapBufId = ctx.mapDynCount || 0;
    ctx.mapDynCount = mapBufId + 1;
    ctx.dynTexts.push({ bufId: mapBufId, fmtString: '{s}', fmtArgs, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
    children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true, _luaTernaryText: _nestedTernaryTextToLua(parsed) });
  } else {
    const bufId = ctx.dynCount;
    ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs, arrName: '', arrIndex: 0, bufSize: 64 });
    ctx.dynCount++;
    children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId, _luaTernaryText: _nestedTernaryTextToLua(parsed) });
  }
  return true;
}
