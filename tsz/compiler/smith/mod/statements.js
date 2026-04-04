// Mod statements — extracted from mod.js

// Emit a semicolon-separated statement list, each through modTranspileExpr
function emitStatementList(expr, ind) {
  var out = '';
  var stmts = expr.split(';').map(function(s) { return s.trim(); }).filter(Boolean);
  for (var s = 0; s < stmts.length; s++) {
    var stmt = stmts[s];
    var am = stmt.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
    if (am) {
      var target = modTranspileExpr(am[1].trim());
      var val = modTranspileExpr(am[2].trim());
      var esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var inc = val.match(new RegExp('^' + esc + '\\s*\\+\\s*(.+)$'));
      var dec = !inc ? val.match(new RegExp('^' + esc + '\\s*-\\s*(.+)$')) : null;
      if (inc) { out += ind + target + ' += ' + inc[1] + ';\n'; }
      else if (dec) { out += ind + target + ' -= ' + dec[1] + ';\n'; }
      else { out += ind + target + ' = ' + val + ';\n'; }
    } else {
      out += ind + modTranspileExpr(stmt) + ';\n';
    }
  }
  return out;
}

function emitInlineStatements(expr, depth, typeNames, lines, lineIdx, guardRetVal, ctx) {
  let out = '';
  const stmts = expr.split(';').map(function(s) { return s.trim(); }).filter(Boolean);
  for (let s = 0; s < stmts.length; s++) {
    out += emitSingleStatement(stmts[s], depth, typeNames, lines, lineIdx, guardRetVal, ctx);
  }
  return out;
}

function emitSingleStatement(stmt, depth, typeNames, lines, lineIdx, guardRetVal, ctx) {
  const ind = '    '.repeat(depth);
  const knownVars = ctx.knownVars || [];
  const localNames = ctx.localNames || [];
  const narrowedVars = ctx.narrowedVars || [];
  const text = applyOptionalUnwraps(stmt.trim(), narrowedVars);
  if (!text || text === 'go') return '';
  if (text === 'continue') return ind + 'continue;\n';
  if (text === 'stop') return ind + guardRetVal + ';\n';
  if (text.startsWith('return ')) return ind + 'return ' + modTranspileValue(text.slice(7), ctx) + ';\n';

  const structAssign = text.match(/^(.+?)\s*=\s*\{(.+)\}\s*$/);
  if (structAssign && !isComparison(structAssign[1])) {
    const target = structAssign[1].trim();
    return ind + target + ' = ' + transpileStructLiteral(structAssign[2]) + ';\n';
  }

  const assignMatch = text.match(/^([^=!<>]+?)\s*=\s*([^=].*)$/);
  if (assignMatch && !assignMatch[1].includes('(') && !isComparison(assignMatch[1])) {
    const rawTarget = assignMatch[1].trim();
    const target = rawTarget;
    const val = modTranspileValue(assignMatch[2].trim(), ctx);

    if (/^\w+$/.test(rawTarget) && !rawTarget.includes('.') && !rawTarget.includes('[') && knownVars.indexOf(rawTarget) === -1) {
      knownVars.push(rawTarget);
      localNames.push(rawTarget);
      const inferredType = inferTypeFromValue(assignMatch[2].trim());
      const isMutable = localIsReassigned(rawTarget, lines, lineIdx);
      if (inferredType) {
        return ind + (isMutable ? 'var ' : 'const ') + target + ': ' + inferredType + ' = ' + val + ';\n';
      }
      return ind + (isMutable ? 'var ' : 'const ') + target + ' = ' + val + ';\n';
    }

    const esc = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const incMatch = val.match(new RegExp('^' + esc + '\\s*\\+\\s*(.+)$'));
    if (incMatch) return ind + target + ' += ' + incMatch[1] + ';\n';
    const decMatch = val.match(new RegExp('^' + esc + '\\s*-\\s*(.+)$'));
    if (decMatch) return ind + target + ' -= ' + decMatch[1] + ';\n';
    return ind + target + ' = ' + val + ';\n';
  }

  return ind + modTranspileExpr(text, ctx) + ';\n';
}
