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
    var pa = peekPropsAccess(c);
    if (pa) {
      skipPropsAccess(c);
      condParts.push(_condPropValue(pa.value));
      continue;
    }
    if (c.kind() === TK.identifier) {
      var name = c.text();
      // OA getter followed by [expr] — primitive array or object array bracket access
      var _ternOa = ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.getter === name; }) : null;
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
        condParts.push(ctx.renderLocals[name]);
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        var pv = ctx.propStack[name];
        // If prop is a map-item ref and next is .field, resolve as OA field access
        if (ctx.currentMap && ctx.currentMap.oa &&
            typeof pv === 'string' && pv.includes('@intCast(') &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip prop name
          c.advance(); // skip dot
          var field = c.text();
          var mapOa = ctx.currentMap.oa;
          var iterVar = ctx.currentMap.iterVar || '_i';
          condParts.push('_oa' + mapOa.oaIdx + '_' + field + '[' + iterVar + ']');
          c.advance(); // skip field
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
function tryParseTernaryJSX(c, children) {
  var saved = c.save();
  var condParts = _parseTernaryCondParts(c);
  if (!condParts) {
    c.restore(saved);
    return false;
  }

  if (c.kind() === TK.lparen) c.advance();
  if (c.kind() !== TK.lt) {
    c.restore(saved);
    return false;
  }
  var firstBranch = parseJSXElement(c);
  if (c.kind() === TK.rparen) c.advance();
  if (c.kind() !== TK.colon) {
    c.restore(saved);
    return false;
  }
  c.advance();

  var allBranches = [{ condExpr: _resolveStringComparison(condParts.join('')), branch: firstBranch }];

  while (true) {
    if (c.kind() === TK.lparen) c.advance();

    if (c.kind() === TK.identifier && c.text() === 'null') {
      c.advance();
      if (c.kind() === TK.rparen) c.advance();
      break;
    }

    if (c.kind() === TK.lt) {
      var defaultBranch = parseJSXElement(c);
      if (c.kind() === TK.rparen) c.advance();
      allBranches.push({ condExpr: null, branch: defaultBranch });
      break;
    }

    var nextCondParts = _parseTernaryCondParts(c);
    if (!nextCondParts) {
      c.restore(saved);
      return false;
    }

    if (c.kind() === TK.lparen) c.advance();
    if (c.kind() !== TK.lt) {
      c.restore(saved);
      return false;
    }
    var nextBranch = parseJSXElement(c);
    if (c.kind() === TK.rparen) c.advance();
    allBranches.push({ condExpr: _resolveStringComparison(nextCondParts.join('')), branch: nextBranch });

    if (c.kind() !== TK.colon) break;
    c.advance();
  }

  if (c.kind() === TK.rbrace) c.advance();

  var hasDefault = allBranches.length > 1 && allBranches[allBranches.length - 1].condExpr === null;

  if (allBranches.length === 1) {
    var condIdx = ctx.conditionals.length;
    ctx.conditionals.push({ condExpr: allBranches[0].condExpr, kind: 'show_hide', inMap: !!ctx.currentMap });
    children.push({ nodeExpr: allBranches[0].branch.nodeExpr, condIdx: condIdx, dynBufId: allBranches[0].branch.dynBufId });
  } else if (allBranches.length === 2 && hasDefault) {
    var condExpr = allBranches[0].condExpr;
    var condIdx2 = ctx.conditionals.length;
    ctx.conditionals.push({ condExpr: condExpr, kind: 'ternary_jsx', trueIdx: -1, falseIdx: -1, inMap: !!ctx.currentMap });
    children.push({ nodeExpr: allBranches[0].branch.nodeExpr, ternaryCondIdx: condIdx2, ternaryBranch: 'true', dynBufId: allBranches[0].branch.dynBufId });
    children.push({ nodeExpr: allBranches[1].branch.nodeExpr, ternaryCondIdx: condIdx2, ternaryBranch: 'false', dynBufId: allBranches[1].branch.dynBufId });
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

// Try to parse {expr == val ? "a" : "b"} ternary text
function tryParseTernaryText(c, children) {
  const saved = c.save();
  let condParts = [];
  let foundQuestion = false;
  while (c.kind() !== TK.eof && c.kind() !== TK.rbrace) {
    if (c.kind() === TK.question) {
      foundQuestion = true;
      c.advance();
      break;
    }
    if (c.kind() === TK.lparen || c.kind() === TK.lt || c.kind() === TK.arrow || c.kind() === TK.lbrace) {
      c.restore(saved);
      return false;
    }
    // props.X dot-access in ternary condition
    {
      const pa = peekPropsAccess(c);
      if (pa) {
        skipPropsAccess(c);
        condParts.push(_condPropValue(pa.value));
        continue;
      }
    }
    if (c.kind() === TK.identifier) {
      const name = c.text();
      const oa = ctx.objectArrays.find(o => o.getter === name);
      if (oa && c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.textAt(c.pos + 2) === 'length') {
        condParts.push(`_oa${oa.oaIdx}_len`);
        c.advance();
        c.advance();
        c.advance();
        continue;
      }
      if (name === 'exact') {
        condParts.push(' == ');
        c.advance();
        if (c.kind() === TK.equals) c.advance();
        continue;
      }
      // OA getter followed by [expr] — primitive array or object array bracket access
      var _ternOa2 = ctx.objectArrays ? ctx.objectArrays.find(function(o) { return o.getter === name; }) : null;
      if (_ternOa2 && c.pos + 3 < c.count && c.kindAt(c.pos + 1) === TK.lbracket) {
        var _tIdx2 = _resolveOaBracketIdx(c.textAt(c.pos + 2));
        if (_tIdx2 !== null && c.kindAt(c.pos + 3) === TK.rbracket) {
          if (_ternOa2.isPrimitiveArray) {
            condParts.push('_oa' + _ternOa2.oaIdx + '_value[' + _tIdx2 + ']');
            c.advance(); c.advance(); c.advance(); c.advance();
            continue;
          }
          if (c.pos + 5 < c.count && c.kindAt(c.pos + 4) === TK.dot && c.kindAt(c.pos + 5) === TK.identifier) {
            var _tf2 = c.textAt(c.pos + 5);
            condParts.push('_oa' + _ternOa2.oaIdx + '_' + _tf2 + '[' + _tIdx2 + ']');
            c.advance(); c.advance(); c.advance(); c.advance(); c.advance(); c.advance();
            continue;
          }
        }
      }
      if (isGetter(name)) {
        condParts.push(slotGet(name));
      } else if (ctx.renderLocals && ctx.renderLocals[name] !== undefined) {
        const rlVal = ctx.renderLocals[name];
        // If renderLocal resolves to map itemParam, treat as item field access
        if (ctx.currentMap && rlVal === ctx.currentMap.itemParam &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip name
          c.advance(); // skip .
          const field = c.text();
          c.advance(); // skip field
          const mapOa = ctx.currentMap.oa;
          const fieldInfo = mapOa ? mapOa.fields.find(function(f) { return f.name === field; }) : null;
          if (mapOa && fieldInfo && fieldInfo.type === 'string') {
            condParts.push(`_oa${mapOa.oaIdx}_${field}[${ctx.currentMap.iterVar || '_i'}][0.._oa${mapOa.oaIdx}_${field}_lens[${ctx.currentMap.iterVar || '_i'}]]`);
          } else if (mapOa) {
            condParts.push(`_oa${mapOa.oaIdx}_${field}[${ctx.currentMap.iterVar || '_i'}]`);
          } else {
            condParts.push('0');
          }
          continue;
        }
        condParts.push(rlVal);
      } else if (ctx.propStack && ctx.propStack[name] !== undefined) {
        const _pv2 = ctx.propStack[name];
        // If prop is a map-item ref and next is .field, resolve as OA field access
        if (ctx.currentMap && ctx.currentMap.oa &&
            typeof _pv2 === 'string' && _pv2.includes('@intCast(') &&
            c.pos + 2 < c.count && c.kindAt(c.pos + 1) === TK.dot && c.kindAt(c.pos + 2) === TK.identifier) {
          c.advance(); // skip prop name
          c.advance(); // skip dot
          const _f2 = c.text();
          const _moa2 = ctx.currentMap.oa;
          const _iv2 = ctx.currentMap.iterVar || '_i';
          condParts.push(`_oa${_moa2.oaIdx}_${_f2}[${_iv2}]`);
          c.advance(); // skip field
          continue;
        }
        condParts.push(_condPropValue(_pv2));
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
      } else if (ctx.currentMap && name === ctx.currentMap.indexParam) {
        condParts.push('@as(i64, @intCast(' + (ctx.currentMap.iterVar || '_i') + '))');
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
    } else {
      condParts.push(c.text());
    }
    c.advance();
  }
  if (!foundQuestion) {
    c.restore(saved);
    return false;
  }
  let trueVal = '';
  if (c.kind() === TK.string) {
    trueVal = c.text().slice(1, -1);
    c.advance();
  } else {
    c.restore(saved);
    return false;
  }
  if (c.kind() !== TK.colon) {
    c.restore(saved);
    return false;
  }
  c.advance();
  let falseVal = '';
  if (c.kind() === TK.string) {
    falseVal = c.text().slice(1, -1);
    c.advance();
  } else {
    c.restore(saved);
    return false;
  }
  if (c.kind() === TK.rbrace) c.advance();
  var condExpr = condParts.join('');
  var strEqlMatch = condExpr.match(/^(.+?)\s*==\s*['"]([^'"]+)['"]$/);
  if (strEqlMatch) {
    var lhs = strEqlMatch[1].trim();
    var rhs = strEqlMatch[2];
    if (lhs.includes('[_i]') && lhs.includes('_oa') && !lhs.includes('[0..')) {
      var lenField = lhs.replace(/\[_i\]$/, '_lens[_i]');
      condExpr = `std.mem.eql(u8, ${lhs}[0..${lenField}], "${rhs}")`;
    } else if (lhs.includes('getSlotString')) {
      condExpr = `std.mem.eql(u8, ${lhs}, "${rhs}")`;
    } else {
      condExpr = `std.mem.eql(u8, ${lhs}, "${rhs}")`;
    }
  }
  const isComparison = condExpr.includes('==') || condExpr.includes('!=') ||
    condExpr.includes('>=') || condExpr.includes('<=') ||
    condExpr.includes(' > ') || condExpr.includes(' < ') ||
    condExpr.includes('std.mem.eql');
  const isBool = condExpr.includes('getSlotBool');
  const zigCond = (isComparison || isBool) ? `(${condExpr})` : `((${condExpr}) != 0)`;
  const fmtArgs = `if ${zigCond} @as([]const u8, "${trueVal}") else @as([]const u8, "${falseVal}")`;
  if (ctx.currentMap && (fmtArgs.includes('_oa') || condExpr.includes('_oa'))) {
    const mapBufId = ctx.mapDynCount || 0;
    ctx.mapDynCount = mapBufId + 1;
    ctx.dynTexts.push({ bufId: mapBufId, fmtString: '{s}', fmtArgs, arrName: '', arrIndex: 0, bufSize: 256, inMap: true, mapIdx: ctx.maps.indexOf(ctx.currentMap) });
    children.push({ nodeExpr: `.{ .text = "__mt${mapBufId}__" }`, dynBufId: mapBufId, inMap: true });
  } else {
    const bufId = ctx.dynCount;
    ctx.dynTexts.push({ bufId, fmtString: '{s}', fmtArgs, arrName: '', arrIndex: 0, bufSize: 64 });
    ctx.dynCount++;
    children.push({ nodeExpr: `.{ .text = "" }`, dynBufId: bufId });
  }
  return true;
}
